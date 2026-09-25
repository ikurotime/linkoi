const config = require('../release-please-config.json');
const packages = Object.entries(config.packages).map(([path, value]) => ({
  path, component: value.component, name: `@linkoi/${value.component}`,
}));
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

async function readJson(github, repo, path, ref) {
  const { data } = await github.rest.repos.getContent({ ...repo, path, ref });
  if (data.type !== 'file' || data.encoding !== 'base64') throw new Error(`Cannot read ${path}`);
  return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
}

async function validatePackage(github, repo, pkg, version, sha) {
  const manifest = await readJson(github, repo, `${pkg.path}/package.json`, sha);
  if (!stableVersion.test(version) || manifest.version !== version ||
      manifest.name !== pkg.name || manifest.private || manifest.publishConfig?.access !== 'public') {
    throw new Error(`Invalid public package metadata: ${pkg.path}`);
  }
}

async function resolvePlan(github, repo, { tags, releasePr, runNumber }) {
  if (Boolean(tags) === Boolean(releasePr)) throw new Error('Provide release tags OR a release PR number');
  let sha;
  const selected = [];
  if (releasePr) {
    if (!/^[1-9]\d*$/.test(releasePr) || !/^[1-9]\d*$/.test(String(runNumber))) {
      throw new Error('Invalid release PR or run number');
    }
    const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: Number(releasePr) });
    if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'main' ||
        pr.head.ref !== 'release-please--branches--main' ||
        pr.head.repo?.full_name !== `${repo.owner}/${repo.repo}` ||
        pr.user.login !== 'github-actions[bot]' ||
        !pr.labels.some(label => label.name === 'autorelease: pending')) {
      throw new Error('Expected an open combined Release Please PR from this repository');
    }
    sha = pr.head.sha;
    const before = await readJson(github, repo, '.release-please-manifest.json', pr.base.sha);
    const after = await readJson(github, repo, '.release-please-manifest.json', sha);
    for (const pkg of packages) {
      if (after[pkg.path] === before[pkg.path]) continue;
      await validatePackage(github, repo, pkg, after[pkg.path], sha);
      selected.push({ ...pkg, version: `${after[pkg.path]}-rc.${runNumber}` });
    }
  } else {
    const requested = JSON.parse(tags);
    if (!Array.isArray(requested) || !requested.length || new Set(requested).size !== requested.length) {
      throw new Error('Release tags must be a nonempty JSON array without duplicates');
    }
    for (const tag of requested) {
      const pkg = packages.find(pkg => typeof tag === 'string' && tag.startsWith(`${pkg.component}-v`));
      const version = pkg && tag.slice(`${pkg.component}-v`.length);
      if (!pkg || !stableVersion.test(version) || selected.some(item => item.path === pkg.path)) {
        throw new Error(`Not a configured stable package tag: ${tag}`);
      }
      const { data: release } = await github.rest.repos.getReleaseByTag({ ...repo, tag });
      if (release.draft || release.prerelease || release.author.login !== 'github-actions[bot]') {
        throw new Error(`Expected a published Release Please release: ${tag}`);
      }
      let { data: ref } = await github.rest.git.getRef({ ...repo, ref: `tags/${tag}` });
      let object = ref.object;
      // Support both lightweight and annotated release tags.
      while (object.type === 'tag') {
        const { data } = await github.rest.git.getTag({ ...repo, tag_sha: object.sha });
        object = data.object;
      }
      if (object.type !== 'commit' || (sha && sha !== object.sha)) {
        throw new Error('All release tags in a publish run must refer to the same commit');
      }
      sha = object.sha;
      const { data: comparison } = await github.rest.repos.compareCommits({ ...repo, base: sha, head: 'main' });
      if (!['ahead', 'identical'].includes(comparison.status)) throw new Error('Release commit is not on main');
      await validatePackage(github, repo, pkg, version, sha);
      selected.push({ ...pkg, version });
    }
  }
  if (!selected.length) throw new Error('No packages need releasing');
  // Publish core before its dependent worker. Other packages are independent.
  selected.sort((a, b) => packages.indexOf(packages.find(p => p.path === a.path)) -
    packages.indexOf(packages.find(p => p.path === b.path)));
  return { sha, pr: releasePr ? Number(releasePr) : null, distTag: releasePr ? 'next' : 'latest', packages: selected };
}

module.exports = { resolvePlan, packages };
