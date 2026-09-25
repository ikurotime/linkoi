# Releases

Release Please manages the repository version, changelog, `vX.Y.Z` tags and
GitHub releases. The baseline is `v0.1.1`. The root `package.json` and lockfile
track this repository version; individual npm package versions remain separate.
The first feature release after this setup is expected to be `v0.2.0`.

## PR titles determine the bump

Use Conventional Commit titles and squash merge PRs. The repository is configured
to use the PR title as the squash commit title and an empty squash body. This
keeps intermediate commit messages out of release calculations.

| PR title | Release impact |
| --- | --- |
| `fix: preserve video timestamps` | Patch, such as `0.1.1` to `0.1.2` |
| `perf: reduce parsing allocations` | Patch |
| `feat: add YouTube deep links` | Minor, such as `0.1.1` to `0.2.0` |
| `feat!: change the resolver return type` | Major, including `0.x` to `1.0.0` |
| `docs: explain mobile handoff` or `ci: update workflows` | No release by itself |

Scopes work too: `fix(youtube): preserve timestamps`. `!` marks a breaking
change for any accepted type. A breaking change takes precedence over features
and fixes when several PRs are included in a release. The title workflow checks
format on PR creation and edits. It does not determine whether a change really
is breaking; reviewers still need to assess that.

Direct pushes must also use Conventional Commit messages for releasable work.
Release Please reads the merged Git history, not PR labels.

## Release flow

1. Merge a feature or fix PR into `main`.
2. Release Please opens or updates a release PR containing the version bump and
   generated changelog. It includes subsequent releasable changes automatically.
3. Review that release PR and its CI run, then squash merge it.
4. Release Please creates the matching tag and GitHub release.

The workflow uses the repository `GITHUB_TOKEN`; no personal token is needed.
Actions must be allowed to create PRs in Settings > Actions > General. Because
PRs created with `GITHUB_TOKEN` do not trigger normal PR workflows, the release
workflow explicitly dispatches `ci.yml` on the release branch. Check that run
before merging the release PR. A failed dispatch makes the release workflow fail.
The CI workflow can also be rerun manually on that branch.

Releases are not automatically merged. npm publication and website/API deployment
are separate from this workflow. No moving `latest` or major-only tags are made.

## Package releases and consumers

This setup versions the Git repository consumed by Kitmo. It does not bump
unchanged `@linkoi/core`, `@linkoi/worker`, `@linkoi/client` or other workspace
packages. Their package versions describe their separately packed/npm artifacts.
When publishing an npm package, update its version and dependent package ranges,
run `npm run verify`, `npm run build:site` and `npm run pack:local`, inspect the
tarball, and publish intentionally. npm publishing is not part of CI.

Once a repository release exists, Kitmo can pin `github:ikurotime/linkoi#v0.2.0`
and update its lockfile. Consumer updates remain explicit; a Linkoi release does
not silently change an installed Kitmo dependency.

The bootstrap SHA in `release-please-config.json` is the existing `v0.1.1` commit.
It limits the first changelog scan and is ignored after the first managed release.
Do not use `release-as` for routine bumps or manually edit the manifest to request
a new version. If correcting a release, follow the Release Please recovery docs.

References:

- [Release Please action](https://github.com/googleapis/release-please-action)
- [Manifest configuration](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
