const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { packages } = require('./release-plan.cjs');

function npm(args) {
  const result = spawnSync('npm', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

function publishPackages(directory, expected, run = npm) {
  const plan = JSON.parse(readFileSync(join(directory, 'release-plan.json')));
  const { packages: packed, ...metadata } = plan;
  assert.deepEqual({ ...metadata, packages: packed.map(({ filename, integrity, ...pkg }) => pkg) }, expected, 'Artifact does not match the validated release plan');
  if (!['next', 'latest'].includes(plan.distTag)) throw new Error('Unexpected npm dist-tag');
  for (const pkg of plan.packages) {
    if (!packages.some(item => item.path === pkg.path && item.name === pkg.name)) throw new Error('Package is not publishable');
    if (!/^linkoi-[a-z-]+-[0-9][a-z0-9.-]*\.tgz$/.test(pkg.filename)) throw new Error('Invalid tarball filename');
    const tarball = join(directory, pkg.filename);
    const integrity = 'sha512-' + createHash('sha512').update(readFileSync(tarball)).digest('base64');
    if (integrity !== pkg.integrity) throw new Error('Tarball integrity mismatch');
    const existing = run(['view', `${pkg.name}@${pkg.version}`, 'dist.integrity', '--json', '--registry=https://registry.npmjs.org/']);
    if (existing.status === 0) {
      if (JSON.parse(existing.stdout) !== integrity) throw new Error(`${pkg.name}@${pkg.version} exists with different contents`);
      console.log(`Already published ${pkg.name}@${pkg.version}; leaving dist-tags unchanged`);
      continue;
    }
    let error;
    try { error = JSON.parse(existing.stdout).error; } catch { /* Not a registry JSON error. */ }
    if (error?.code !== 'E404') throw new Error(`Cannot check npm for ${pkg.name}: ${existing.stderr}`);
    const result = run(['publish', tarball, '--ignore-scripts', '--access=public', `--tag=${plan.distTag}`, '--registry=https://registry.npmjs.org/']);
    if (result.status !== 0) throw new Error(`Publication failed for ${pkg.name}: ${result.stderr}`);
    console.log(`Published ${pkg.name}@${pkg.version} under ${plan.distTag}`);
  }
}

if (require.main === module) publishPackages(resolve(process.argv[2]), JSON.parse(process.env.RELEASE_PLAN));
module.exports = { publishPackages };
