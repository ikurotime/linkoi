const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveCandidate, publishCandidate } = require('./release-candidate.cjs');
const repo = { owner: 'ikurotime', repo: 'linkoi' };
const expected = { pr: 3, sha: 'a'.repeat(40), version: '0.2.0' };

function fixture() {
  const pr = {
    number: 3, state: 'open', draft: false, base: { ref: 'main' },
    head: { ref: 'release-please--branches--main--components--linkoi', sha: expected.sha,
      repo: { full_name: 'ikurotime/linkoi' } },
    user: { login: 'github-actions[bot]' }, labels: [{ name: 'autorelease: pending' }],
    title: 'chore(main): release 0.2.0',
  };
  const state = { pr, refs: [], releases: new Map(), writes: [], version: '0.2.0' };
  const github = {
    paginate: async () => state.refs,
    rest: {
      pulls: { get: async () => ({ data: pr }) },
      git: {
        listMatchingRefs: () => {},
        createRef: async args => {
          state.writes.push(args);
          state.refs.push({ ref: args.ref, object: { type: 'commit', sha: args.sha } });
        },
      },
      repos: {
        getContent: async args => {
          assert.equal(args.ref, pr.head.sha);
          return { data: { type: 'file', encoding: 'base64', content: Buffer.from(JSON.stringify(
            args.path === 'package.json' ? { version: state.version } : { '.': '0.2.0' },
          )).toString('base64') } };
        },
        getReleaseByTag: async ({ tag }) => {
          if (!state.releases.has(tag)) throw Object.assign(new Error('Not found'), { status: 404 });
          return { data: state.releases.get(tag) };
        },
        createRelease: async args => {
          state.writes.push(args);
          state.releases.set(args.tag_name, args);
          return { data: args };
        },
      },
    },
  };
  return { state, github };
}

test('resolves the exact release commit and matching version', async () => {
  const { github } = fixture();
  assert.deepEqual(await resolveCandidate(github, repo, '3'), expected);
});

for (const [name, change] of [
  ['fork', s => { s.pr.head.repo.full_name = 'someone/linkoi'; }],
  ['closed PR', s => { s.pr.state = 'closed'; }],
  ['draft PR', s => { s.pr.draft = true; }],
  ['ordinary branch', s => { s.pr.head.ref = 'feature'; }],
  ['wrong base', s => { s.pr.base.ref = 'develop'; }],
  ['non-bot author', s => { s.pr.user.login = 'someone'; }],
  ['missing release label', s => { s.pr.labels = []; }],
  ['mismatched version', s => { s.version = '0.3.0'; }],
  ['mismatched title', s => { s.pr.title = 'chore(main): release 0.3.0'; }],
]) {
  test(`rejects ${name} before writing`, async () => {
    const { github, state } = fixture();
    change(state);
    await assert.rejects(publishCandidate(github, repo, expected));
    assert.equal(state.writes.length, 0);
  });
}

test('rejects invalid PR input', async () => {
  const { github } = fixture();
  for (const input of ['0', '-3', '3;echo bad', '3.5', '']) {
    await assert.rejects(resolveCandidate(github, repo, input));
  }
});

test('publishes the first candidate as a non-latest prerelease at the tested SHA', async () => {
  const { github, state } = fixture();
  const release = await publishCandidate(github, repo, expected);
  assert.equal(release.tag_name, 'v0.2.0-rc.1');
  assert.equal(release.prerelease, true);
  assert.equal(release.make_latest, 'false');
  assert.equal(state.writes[0].sha, expected.sha);
});

test('allocates the next numeric RC without touching earlier tags', async () => {
  const { github, state } = fixture();
  state.refs = [2, 10].map(n => ({ ref: `refs/tags/v0.2.0-rc.${n}`, object: { type: 'commit', sha: 'old' } }));
  const release = await publishCandidate(github, repo, expected);
  assert.equal(release.tag_name, 'v0.2.0-rc.11');
});

test('rerunning the same SHA performs no extra writes', async () => {
  const { github, state } = fixture();
  await publishCandidate(github, repo, expected);
  state.writes = [];
  const release = await publishCandidate(github, repo, expected);
  assert.equal(release.tag_name, 'v0.2.0-rc.1');
  assert.equal(state.writes.length, 0);
});

test('recovers a tag whose release creation failed', async () => {
  const { github, state } = fixture();
  state.refs.push({ ref: 'refs/tags/v0.2.0-rc.1', object: { type: 'commit', sha: expected.sha } });
  const release = await publishCandidate(github, repo, expected);
  assert.equal(release.tag_name, 'v0.2.0-rc.1');
  assert.equal(state.writes.length, 1);
});

test('rejects a PR that changed after testing', async () => {
  const { github, state } = fixture();
  state.pr.head.sha = 'b'.repeat(40);
  await assert.rejects(publishCandidate(github, repo, expected), /changed/);
  assert.equal(state.writes.length, 0);
});

test('rejects a version already released as stable', async () => {
  const { github, state } = fixture();
  state.refs.push({ ref: 'refs/tags/v0.2.0', object: { type: 'commit', sha: 'stable' } });
  await assert.rejects(publishCandidate(github, repo, expected), /stable tag/);
  assert.equal(state.writes.length, 0);
});

test('API errors do not trigger duplicate release creation', async () => {
  const { github, state } = fixture();
  state.refs.push({ ref: 'refs/tags/v0.2.0-rc.1', object: { type: 'commit', sha: expected.sha } });
  github.rest.repos.getReleaseByTag = async () => { throw Object.assign(new Error('Forbidden'), { status: 403 }); };
  await assert.rejects(publishCandidate(github, repo, expected), /Forbidden/);
  assert.equal(state.writes.length, 0);
});
