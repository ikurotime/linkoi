const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');

function candidateManifests(manifests, selected) {
  const versions = new Map(selected.map(pkg => [pkg.name, pkg.version]));
  return manifests.map(manifest => {
    const updated = structuredClone(manifest);
    updated.version = versions.get(manifest.name);
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(updated[field] || {})) {
        if (versions.has(name)) updated[field][name] = versions.get(name);
      }
    }
    return updated;
  });
}

function packRelease(root, output, plan) {
  mkdirSync(output, { recursive: true });
  if (plan.distTag === 'next') {
    const manifests = plan.packages.map(pkg => JSON.parse(readFileSync(join(root, pkg.path, 'package.json'))));
    const updated = candidateManifests(manifests, plan.packages);
    plan.packages.forEach((pkg, index) => writeFileSync(join(root, pkg.path, 'package.json'), JSON.stringify(updated[index], null, 2) + '\n'));
  }
  const packed = plan.packages.map(pkg => {
    // Compilation was completed before this step. Do not rebuild in pack hooks.
    const result = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output], {
      cwd: join(root, pkg.path), encoding: 'utf8',
    }))[0];
    if (result.name !== pkg.name || result.version !== pkg.version) throw new Error('Packed unexpected package');
    const integrity = 'sha512-' + createHash('sha512').update(readFileSync(join(output, result.filename))).digest('base64');
    return { ...pkg, filename: result.filename, integrity };
  });
  writeFileSync(join(output, 'release-plan.json'), JSON.stringify({ ...plan, packages: packed }, null, 2) + '\n');
}

if (require.main === module) packRelease(resolve(process.argv[2]), resolve(process.argv[3]), JSON.parse(process.env.RELEASE_PLAN));
module.exports = { candidateManifests, packRelease };
