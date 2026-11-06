# Upgrade

## Hub 0.11.12 → 0.11.13

Install the new hub tarball and the DS Bot `0.2.6-hub.3` fork, restart DSH web
and the DS Bot container, then hard-refresh. The fork adds server-owned
reactions and the shared back stack. Existing local-only reactions remain in
browser storage but are not used for bot context.

## Minor update within 0.11.x

No data migration. Sessions, server entries and credentials are unchanged.

1. Back up `DSH_HOME` (at minimum `profiles/<profile>/package.json`,
   `profiles/<profile>/cordis.patch.yml` and the DSH credentials store).
2. Install the new tarball:
   ```bash
   dsh plugin --profile <profile> add ./dsbot-hub-<version>.tgz
   ```
3. Restart DSH web and hard-refresh the browser.
4. Confirm `/dsbot-hub/s/<id>/` is still 404, `/open` is still a 302, and the
   embedded origin still returns 401 without a grant.
5. Re-check the phone Bots page and the side panel after the refresh.

A minor update does not change the server config schema. If a release does, the
changelog says so and the settings panel migrates the row on first save.

## Desktop plugin profile

The reference profile pins:

- `dsh-better-sidebar@0.28.0`
- `dsh-context@0.80.2`
- `dshmarket@1.73.10`
- optional `dskin` from GitHub

Upgrade each with `dsh plugin --profile web add <package>@<version>`, then
restart. **Do not install `dshmarket@1.66.14` on DSH 0.2.2**; its peer range
rejects the runtime and pnpm fails. Re-test the mobile gate after any desktop
plugin upgrade because it uses their generated class prefixes.

## Rollback

Keep the previous hub tarball and profile backup. To roll back:

```bash
dsh plugin --profile web add ./dsbot-hub-<previous>.tgz
```

Restart DSH. Sessions and server credentials are untouched. Remove a desktop
plugin with `dsh plugin --profile web remove <package>` if it interferes.

## DSH runtime

Do not mix a 0.2.2 source CLI with a 0.2.1 profile core. The core packages are
pinned to exact versions; the `tools` service will not activate. Upgrade the
whole profile/runtime together. See [Compatibility](compatibility.md).
