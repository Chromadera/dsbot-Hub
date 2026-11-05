# Releasing

## 1. Prepare

- Set the version in `package.json`, `release/profile/package.json` and
  `release/VERSIONS.md`; update `CHANGELOG.md`.
- Set `repository`, `homepage` and `bugs` in `package.json`. `npm publish
  --provenance` fails without `repository`, and the release workflow enforces it.
- Confirm `release/server/.env.example` exists and contains no value.

## 2. Check

```bash
npm test
npm run check-release
npm run check-secrets
npm run check-secrets -- --history
```

All four must pass. `check-secrets` masks any value it finds. Treat a history hit
as real: a later commit does not remove a secret from a published history.

## 3. Build the archive

`release/ds-bot-0.2.6-hub.2.tgz` must exist first. It is built from the DS Bot
fork source, not from this repository's tracked files (`vendor/` carries the
`hub.1` fork source; `hub.2` adds the applied host patch and `REACTIONS.md`).
The build refuses to run without it, because the archive would otherwise ship
without a server.

```bash
npm run build:release
```

This writes the hub tarball, the gate tarball, `RELEASE.json`,
`dsbot-hub-release-<version>.tar.gz` and two `SHA256SUMS` files: one inside the
archive for its artifacts, one beside it for the archive itself. It copies
`preflight.sh`, `server/.env.example`, `SECURITY.md`, `NOTICE`, `LICENSE`,
`THIRD_PARTY.md` and `docs/` into the staging directory.

The build normalizes file modes, stamps `0/0` ownership, refuses symlinks, and
dereferences hardlinks. It ends by running `node scripts/check-artifacts.mjs`,
which also audits the prebuilt fork and gate tarballs. A fork tarball packed
under a restrictive umask fails that check; repack it before building:

```bash
tmp=$(mktemp -d)
tar -xzf release/ds-bot-<version>.tgz -C "$tmp"
find "$tmp" -type d -exec chmod 755 {} +
find "$tmp" -type f -exec chmod 644 {} +
tar --owner=0 --group=0 --numeric-owner -czf release/ds-bot-<version>.tgz -C "$tmp" package
rm -rf "$tmp"
```

## 4. Verify the archive

```bash
mkdir -p /tmp/release-check
tar -xzf release/dsbot-hub-release-<version>.tar.gz -C /tmp/release-check
cd /tmp/release-check
sha256sum -c SHA256SUMS
./preflight.sh
tar -tzf dsbot-hub-release-<version>.tar.gz | grep -E 'preflight|\.env\.example'
```

Check that the archive is portable, not a copy of this machine:

```bash
node scripts/check-artifacts.mjs
```

Expected: `artifact check passed`. It rejects a local owner, symlink or hardlink
entries, private `600`/`700` modes, and absolute entry names. Then
install into a **clean** DSH profile and confirm the hub, desktop set and gate
load as real packages, not symlinks:

```bash
./install.sh test-profile
```

## 5. Manual checks

- Desktop: panel in the sidebar, server chip, iframe loads.
- Phone: bottom nav, safe area, long-press sheet, back closing the top layer.
- Reactions: user chip appears, bot sees it, `react` tool works.
- A wrong token shows sign-in, not an empty team.

## 6. Publish

```bash
git tag -a v<version> -m "dsbot-hub <version>"
git push origin v<version>
```

The release workflow runs the tests and both checks, then publishes the npm
package with provenance. It does **not** build the archive: CI has no fork
tarball, so the archive is built on a release machine and attached to the GitHub
release by hand. Do not publish from a working tree with uncommitted changes.

## Rollback

Keep the previous hub tarball and the server's timestamped package backup. To
roll back, reinstall the previous tarball into the same profile and restart DSH.
Never delete the data volume.
