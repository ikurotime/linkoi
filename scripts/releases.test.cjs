const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { resolvePlan, packages } = require('./release-plan.cjs');
const { candidateManifests } = require('./pack-release.cjs');
const { publishPackages } = require('./publish-packages.cjs');
const repo = { owner: 'ikurotime', repo: 'linkoi' };
const sha = 'a'.repeat(40);

function fixture() {
  const before = Object.fromEntries(packages.map(p => [p.path, p.component === 'deep-links' ? '0.0.0' : '0.1.1']));
  const after = { ...before, 'packages/deep-links': '0.1.0' };
  const pr = { state: 'open', draft: false, base: { ref: 'main', sha: 'base' },
    head: { ref: 'release-please--branches--main', sha, repo: { full_name: 'ikurotime/linkoi' } },
    user: { login: 'github-actions[bot]' }, labels: [{ name: 'autorelease: pending' }] };
  const state = { before, after, pr, private: false, author: 'github-actions[bot]', comparison: 'ahead', draft: false };
  const github = { rest: {
    pulls: { get: async () => ({ data: pr }) },
    repos: {
      getContent: async ({ path, ref }) => {
        const pkg = packages.find(p => `${p.path}/package.json` === path);
        const value = pkg ? { name: pkg.name, version: after[pkg.path], private: state.private, publishConfig: { access: 'public' } }
          : ref === 'base' ? before : after;
        return { data: { type: 'file', encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') } };
      },
      getReleaseByTag: async () => ({ data: { draft: state.draft, prerelease: false, author: { login: state.author } } }),
      compareCommits: async () => ({ data: { status: state.comparison } }),
    },
    git: { getRef: async () => ({ data: { object: { type: 'commit', sha } } }) },
  } };
  return { state, github };
}
const rcInput = { releasePr: '7', runNumber: 42 };

test('only public packages are configured; versions are independent', () => {
  assert.deepEqual(packages.map(p => p.name), ['@linkoi/core', '@linkoi/client', '@linkoi/worker', '@linkoi/deep-links']);
  const config = require('../release-please-config.json');
  assert.equal(config.separatePullRequests, undefined);
  assert.equal(config['separate-pull-requests'], false);
  assert.deepEqual(config.plugins, [{ type: 'node-workspace', updatePeerDependencies: true }]);
  assert.equal(require('../package.json').private, true);
  assert.equal(require('../packages/accounts/package.json').private, true);
});

test('a deep-links-only change selects no other packages for RC publication', async () => {
  const { github } = fixture();
  const plan = await resolvePlan(github, repo, rcInput);
  assert.equal(plan.sha, sha);
  assert.equal(plan.distTag, 'next');
  assert.deepEqual(plan.packages.map(p => [p.name, p.version]), [['@linkoi/deep-links', '0.1.0-rc.42']]);
});

for (const [name, change] of [
  ['fork', s => { s.pr.head.repo.full_name = 'someone/linkoi'; }],
  ['closed PR', s => { s.pr.state = 'closed'; }],
  ['draft PR', s => { s.pr.draft = true; }],
  ['old repository release branch', s => { s.pr.head.ref += '--components--linkoi'; }],
  ['ordinary branch', s => { s.pr.head.ref = 'feature'; }],
  ['wrong base', s => { s.pr.base.ref = 'develop'; }],
  ['non-bot author', s => { s.pr.user.login = 'someone'; }],
  ['missing release label', s => { s.pr.labels = []; }],
  ['private package', s => { s.private = true; }],
  ['prerelease in stable manifest', s => { s.after['packages/deep-links'] = '0.1.0-rc.1'; }],
  ['unchanged manifest', s => { Object.assign(s.after, s.before); }],
]) {
  test(`rejects ${name}`, async () => {
    const { github, state } = fixture(); change(state);
    await assert.rejects(resolvePlan(github, repo, rcInput));
  });
}

test('validates stable tags and selects only released packages in dependency order', async () => {
  const { github, state } = fixture();
  state.after['packages/core'] = '0.2.0'; state.after['packages/worker'] = '0.1.2';
  const plan = await resolvePlan(github, repo, { tags: '["worker-v0.1.2","core-v0.2.0"]' });
  assert.equal(plan.distTag, 'latest');
  assert.deepEqual(plan.packages.map(p => p.name), ['@linkoi/core', '@linkoi/worker']);
});

for (const tags of ['["v0.2.0"]', '["accounts-v0.1.0"]', '["deep-links-v0.1.0-rc.1"]',
  '["deep-links-v0.1.0","deep-links-v0.1.0"]', '["deep-links-v0.2.0"]', '[]', '{}']) {
  test(`rejects invalid stable tag selection ${tags}`, async () => {
    const { github } = fixture(); await assert.rejects(resolvePlan(github, repo, { tags }));
  });
}

test('rejects mixed stable and RC inputs', async () => {
  const { github } = fixture();
  await assert.rejects(resolvePlan(github, repo, { ...rcInput, tags: '[]' }));
});

test('rejects unofficial or draft releases and commits outside main', async () => {
  for (const change of [s => { s.author = 'someone'; }, s => { s.draft = true; }, s => { s.comparison = 'diverged'; }]) {
    const { github, state } = fixture(); change(state);
    await assert.rejects(resolvePlan(github, repo, { tags: '["deep-links-v0.1.0"]' }));
  }
});

test('RC tarball manifests use RC versions for selected internal dependencies and peers', () => {
  const manifests = [{ name: '@linkoi/core', version: '0.2.0' }, { name: '@linkoi/worker', version: '0.1.2',
    dependencies: { hono: '^4.0.0' }, peerDependencies: { '@linkoi/core': '^0.2.0' }, devDependencies: { '@linkoi/core': '0.2.0' } }];
  const result = candidateManifests(manifests, [
    { name: '@linkoi/core', version: '0.2.0-rc.42' }, { name: '@linkoi/worker', version: '0.1.2-rc.42' },
  ]);
  assert.equal(result[0].version, '0.2.0-rc.42');
  assert.equal(result[1].peerDependencies['@linkoi/core'], '0.2.0-rc.42');
  assert.equal(result[1].devDependencies['@linkoi/core'], '0.2.0-rc.42');
  assert.equal(result[1].dependencies.hono, '^4.0.0');
  assert.equal(manifests[0].version, '0.2.0');
});

function publishFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'linkoi-publish-test-'));
  const pkg = { ...packages.find(p => p.component === 'deep-links'), version: '0.1.0-rc.42' };
  const expected = { sha, pr: 7, distTag: 'next', packages: [pkg] };
  const filename = 'linkoi-deep-links-0.1.0-rc.42.tgz';
  const contents = Buffer.from('test tarball');
  const integrity = 'sha512-' + createHash('sha512').update(contents).digest('base64');
  writeFileSync(join(directory, filename), contents);
  writeFileSync(join(directory, 'release-plan.json'), JSON.stringify({ ...expected, packages: [{ ...pkg, filename, integrity }] }));
  return { directory, expected, integrity, filename };
}

test('publishes new versions under next with lifecycle scripts disabled', () => {
  const { directory, expected } = publishFixture(); const calls = [];
  publishPackages(directory, expected, args => {
    calls.push(args);
    return args[0] === 'view' ? { status: 1, stdout: '{"error":{"code":"E404"}}' } : { status: 0 };
  });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes('--ignore-scripts')); assert.ok(calls[1].includes('--tag=next'));
});

test('a retry skips an identical published tarball without moving dist-tags', () => {
  const { directory, expected, integrity } = publishFixture(); const calls = [];
  publishPackages(directory, expected, args => { calls.push(args); return { status: 0, stdout: JSON.stringify(integrity) }; });
  assert.equal(calls.length, 1);
});

test('registry failures and different published contents abort instead of publishing', () => {
  for (const response of [{ status: 1, stdout: '{"error":{"code":"E401"}}' }, { status: 0, stdout: '"different"' }]) {
    const { directory, expected } = publishFixture(); let count = 0;
    assert.throws(() => publishPackages(directory, expected, () => { count++; return response; }));
    assert.equal(count, 1);
  }
});

test('artifact tampering and changed package selection fail before contacting npm', () => {
  const { directory, expected, filename } = publishFixture();
  const never = () => { assert.fail('Must not contact npm'); };
  assert.throws(() => publishPackages(directory, { ...expected, distTag: 'latest' }, never));
  writeFileSync(join(directory, filename), 'modified');
  assert.throws(() => publishPackages(directory, expected, never), /integrity/);
});
