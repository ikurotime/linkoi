# Package releases

Release Please manages independent versions for the four public npm packages.
One combined release PR can update several packages without giving them the same
version. The repository root and `@linkoi/accounts` remain private and are not
release units.

| Package | Stable Git tag example | Initial release baseline |
| --- | --- | --- |
| `@linkoi/core` | `core-v0.1.2` | Already published at `0.1.1` |
| `@linkoi/client` | `client-v0.1.2` | Already published at `0.1.1` |
| `@linkoi/worker` | `worker-v0.1.2` | Already published at `0.1.1` |
| `@linkoi/deep-links` | `deep-links-v0.1.0` | Not yet published |

Each package has its own changelog and manifest entry. The deep-links baseline
`0.0.0` means no release yet; `initial-version: 0.1.0` defines its first release.
The old root `v0.1.x` tags and `v0.2.0-rc.1` remain historical references. They
do not describe the npm package versions. The root version is not bumped.

## PR titles and affected packages

Use Conventional Commit titles and squash merge PRs. GitHub uses the PR title
as the squash commit title. Release Please uses the commit type for the bump and
changed file paths to identify affected packages. A scope is useful context, not
a replacement for the changed paths.

| Title | Impact on affected packages |
| --- | --- |
| `fix(deep-links): preserve timestamps` | Patch |
| `feat(client): add a request option` | Minor |
| `feat(core)!: change metadata fields` | Major, including `0.x` to `1.0.0` |
| `docs: clarify examples` or `ci: update workflows` | No release by itself |

A commit touching multiple packages can bump each of them. Root-only website,
workflow and documentation changes do not release the npm packages. Keep PRs
focused so the title describes the package changes accurately.

The `node-workspace` plugin updates internal dependencies, including peer
and development dependencies, and the root lockfile. For example, a core
feature can bump core to `0.2.0` and worker to `0.1.2` with an updated core peer
range. Client and deep-links remain unchanged. Review compatibility when a
release PR updates a peer range across a breaking change.

## Stable release flow

1. Merge a feature or fix into `main`.
2. Release Please opens or updates `chore: release main` on the combined
   `release-please--branches--main` branch. Review package bumps, changelogs and CI.
3. Optionally test npm release candidates as described below.
4. Merge the release PR. Release Please creates a tag and GitHub release for
   each changed package and dispatches **Publish npm packages** with those tags.
5. The publish workflow verifies the tagged source, builds and tests it, packs
   only those packages, and publishes them under npm's `latest` dist-tag.

Both CI and npm publication are dispatched explicitly because events created by
`GITHUB_TOKEN` do not start ordinary PR/release workflows. Merging a release PR
is the publication decision. A GitHub release alone does not prove npm
publication succeeded; check **Publish npm packages** too.

Publication runs sequentially with core before worker. A retry skips versions
whose existing npm tarball integrity matches; different contents or unexpected
registry errors fail the run. Existing versions are never overwritten and a
retry does not move dist-tags backwards. For recovery, run **Publish npm
packages** on `main`, provide a JSON list such as `["core-v0.1.2"]` in `tags`,
and leave `release_pr` empty. Tags in one run must share a commit. To retry a
partial multi-package publication, supply the original tag list.

## Optional npm release candidates

Run **Publish npm packages** on `main`, leave `tags` empty, and enter the open
combined release PR number in `release_pr`. The workflow selects packages whose
manifest versions changed relative to the PR base and checks the exact head SHA.

The candidate version appends `-rc.<workflow-run-number>` to each proposed
package version, for example `@linkoi/deep-links@0.1.0-rc.42`. The number identifies
the workflow run, not a consecutive candidate count for that package. Rerunning
the same run retains its versions; starting a new run allocates new versions.
Internal dependency and peer ranges between selected packages are rewritten to
the matching RC versions in the packed artifacts. Source files on GitHub and
the release PR's stable versions stay unchanged.

Candidates publish under `next` without creating stable Git tags. For a package
that already exists, RC publication leaves `latest` unchanged. npm assigns
`latest` as well on a package's very first publication, even when `--tag next`
is specified, and rejects removing that tag. Until the first stable release,
`latest` can therefore point to the bootstrap RC. The package README must clearly
state its experimental status; consumers should pin a tested version. Install an exact candidate version in Kitmo and update its lockfile:

```sh
bun add --exact @linkoi/deep-links@0.1.0-rc.42
```

Import from `@linkoi/deep-links`, run Kitmo's tests/build, and test app handoff on
physical iPhone/Android devices, including Instagram and LinkedIn browsers.
Record the version and SHA tested in the release PR. If the PR changes during
validation, publication fails. If it changes after testing, test a fresh RC
before merging. Candidate testing is optional and is not a branch protection gate.

## npm authentication

The publication job uses Node 22 and npm 11.16.0 with GitHub OIDC permissions.
Configure each public npm package's trusted publisher for GitHub owner
`ikurotime`, repository `linkoi`, workflow filename `npm-publish.yml`, and no
GitHub environment. Package metadata must point to this repository.

For a package that does not exist yet, bootstrap publication using an npm
account with access to `@linkoi`. This can be a locally validated RC under `next`;
be aware of npm's initial `latest` behavior described above. The npm CLI can then
configure trust for the new package:

```sh
npm trust github @linkoi/deep-links --repository ikurotime/linkoi --file npm-publish.yml --allow-publish --yes
```

Complete npm's browser 2FA confirmation. Use the same command with `core`,
`client`, and `worker` to configure those existing packages. A granular publishing token stored as the
GitHub Actions secret `NPM_TOKEN` can be used for that first workflow run. Once
trusted publishing is configured, remove the token to use OIDC. Authentication
setup on npm is separate from merging this code. Do not commit tokens or paste
them into PRs. Neither local login nor an npm dry run configures OIDC.

The build job has read-only GitHub permissions and no npm credential. The publish
job downloads verified tarballs, runs trusted tooling from `main`, and disables
npm lifecycle scripts. No website or API deployment is part of these workflows.

## Migration

Close the old root release PR and the superseded repository-RC/manual npm-RC PRs
when adopting this configuration. Keep historical tags; do not rename or delete
them. The bootstrap SHA points to the last root `v0.1.1` baseline so existing npm
versions are preserved while deep-links receives its first independent release.
Do not manually bump package versions for ordinary changes or publish all
workspaces together. Release Please owns version selection and dependency updates.

References:

- [Release Please manifest and workspace plugin](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm initial latest tag behavior](https://github.com/npm/cli/issues/8490)
