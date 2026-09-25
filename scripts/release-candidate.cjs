const releaseBranch = 'release-please--branches--main--components--linkoi';
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

async function resolveCandidate(github, repo, input) {
  if (!/^[1-9]\d*$/.test(String(input))) throw new Error('Enter a release PR number');
  const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: Number(input) });
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'main' ||
      pr.head.ref !== releaseBranch || pr.head.repo?.full_name !== `${repo.owner}/${repo.repo}` ||
      pr.user.login !== 'github-actions[bot]' ||
      !pr.labels.some(label => label.name === 'autorelease: pending')) {
    throw new Error('Expected an open, ready Release Please PR in this repository');
  }
  const readJson = async path => {
    const { data } = await github.rest.repos.getContent({ ...repo, path, ref: pr.head.sha });
    if (data.type !== 'file' || data.encoding !== 'base64') throw new Error(`Cannot read ${path}`);
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  };
  const manifest = await readJson('.release-please-manifest.json');
  const pkg = await readJson('package.json');
  const version = manifest['.'];
  if (!stableVersion.test(version) || pkg.version !== version ||
      pr.title !== `chore(main): release ${version}`) {
    throw new Error('Release PR title, manifest and package version must agree on a stable version');
  }
  return { pr: pr.number, sha: pr.head.sha, version };
}

async function publishCandidate(github, repo, expected) {
  const current = await resolveCandidate(github, repo, String(expected.pr));
  if (current.sha !== expected.sha || current.version !== expected.version) {
    throw new Error('Release PR changed during validation. Run a new candidate build');
  }
  const refs = await github.paginate(github.rest.git.listMatchingRefs, {
    ...repo, ref: `tags/v${current.version}`,
  });
  if (refs.some(ref => ref.ref === `refs/tags/v${current.version}`)) {
    throw new Error('This version already has a stable tag');
  }
  const prefix = `refs/tags/v${current.version}-rc.`;
  const candidates = refs.filter(ref => ref.ref.startsWith(prefix) &&
    /^[1-9]\d*$/.test(ref.ref.slice(prefix.length)));
  const existing = candidates.find(ref => ref.object.type === 'commit' && ref.object.sha === current.sha);
  const next = Math.max(0, ...candidates.map(ref => Number(ref.ref.slice(prefix.length)))) + 1;
  const tag = existing ? existing.ref.slice('refs/tags/'.length) : `v${current.version}-rc.${next}`;
  if (!existing) {
    await github.rest.git.createRef({ ...repo, ref: `refs/tags/${tag}`, sha: current.sha });
  }
  // Recover a partial run where the tag was created but the release call failed.
  try {
    const { data: release } = await github.rest.repos.getReleaseByTag({ ...repo, tag });
    if (!release.prerelease || release.draft) throw new Error('Existing release is not a published prerelease');
    return release;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const { data: release } = await github.rest.repos.createRelease({
    ...repo, tag_name: tag, target_commitish: current.sha, name: tag,
    prerelease: true, make_latest: 'false',
    body: `Candidate for #${current.pr}, validated at commit ${current.sha}.\n\n` +
      `Test in Kitmo with \`github:${repo.owner}/${repo.repo}#${tag}\` and update its lockfile.\n\n` +
      'This tag identifies the tested source commit. Package manifests retain the proposed stable version; ' +
      'workspace package versions are independent. No npm packages are published.\n\n' +
      'If the release PR changes, validate a fresh candidate before merging it.',
  });
  return release;
}

module.exports = { resolveCandidate, publishCandidate };
