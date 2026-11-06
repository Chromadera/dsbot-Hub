# Third-party components

The hub package itself is Apache-2.0. It interoperates with, but does not copy,
the components below. The release archive additionally bundles the DS Bot fork
as a separate tarball; it is not part of the npm package.

| Component | License | Project |
|---|---|---|
| DeepSeek Harness (DSH) | MIT | https://github.com/deepseek-harness/deepseek-harness |
| DS Bot | Apache-2.0 | https://github.com/Fei2411/DeepSeek-Bot |
| DS Bot fork `0.2.6-hub.3` (bundled in the release archive) | Apache-2.0 | https://github.com/Fei2411/DS-Bot |
| dsh-better-sidebar 0.28.0 | MIT | https://github.com/omdsh-dev/DSH-better-sidebar |
| dsh-context 0.80.2 | Apache-2.0 | https://github.com/bowenliang123/dsh-context |
| dshmarket 1.73.10 | MIT | https://github.com/dsh-market/dsh-market |
| dskin 1.0.17 (optional) | MIT | https://github.com/dancingmemory/dskin |

The desktop plugins are not installed by the hub package itself. The reference
release profile installs them; review their licenses and release notes before
redistributing a bundle that contains them. `dskin` is not published on npm and
is intentionally excluded from the default profile.
