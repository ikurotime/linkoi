# First release

1. Review docs/licensing.md and the full LICENSE, including the breadth of competition restrictions. Confirm copyright ownership of the extracted code.
2. The repository is private at https://github.com/ikurotime/linkoi. Before making it public, review repository contents and enable private vulnerability reporting. Package metadata points to this repository.
3. Run npm ci, npm run verify, npm run build:site, and npm run pack:local. Inspect all public package tarballs with npm pack --dry-run in each package.
4. Smoke-test the packed core in Node 22 and the Worker with wrangler deploy --dry-run. Run a representative public-URL benchmark before making coverage claims.
5. Set package private flags to false only when ready to publish. Publish core first, then worker. Publish client separately when its version changes. npm publishing is deliberately not part of CI.
6. Switch Tabstash's vendor dependencies to those exact published versions and run the same compatibility checks before deployment.
