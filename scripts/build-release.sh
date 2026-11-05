#!/usr/bin/env bash
# Build the npm tarball and a staging release directory.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"
VERSION="$(node -p "require('./package.json').version")"
OUT="$HERE/release"
# The fork tarball is built from the DS Bot fork source, not from this repo's
# tracked files. Without it the archive would silently ship without a server.
if ! compgen -G "$OUT/ds-bot-*.tgz" > /dev/null; then
  echo "error: no release/ds-bot-*.tgz fork tarball." >&2
  echo "The release archive would be incomplete. Build or copy the fork into" >&2
  echo "release/ before running build:release (see vendor/README.md)." >&2
  exit 1
fi
rm -f "$OUT"/dsbot-hub-*.tgz "$OUT"/dsbot-hub-release-*.tar.gz
# npm records the source file modes. A checkout made under umask 077 would pack
# 600 files, so add the read bit before packing (exec bits are kept).
find "$HERE" \( -name .git -o -name node_modules -o -name .probe -o -name '.probe-*' \) -prune \
  -o -type f -exec chmod a+r {} +
npm pack --pack-destination "$OUT"
( cd "$OUT/gate" && npm pack --pack-destination .. )
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
RELEASED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node - "$OUT" "$VERSION" "$COMMIT" "$RELEASED_AT" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')
const [out, version, commit, releasedAt] = process.argv.slice(2)
const release = {
  name: 'dsbot-hub',
  version,
  commit,
  releasedAt,
  dsh: '0.2.2-alpha.3+',
  node: '>=24.9.0',
  dsbot: '0.2.6-hub.2',
  serverImage: 'dsbots/ds-bot:0.2.6-hub.2',
  desktopPlugins: {
    'dsh-better-sidebar': '0.28.0',
    'dsh-context': '0.80.2',
    'dshmarket': '1.73.10',
    dskin: 'optional 1.0.17 (GitHub)'
  },
  artifacts: {
    hub: `dsbot-hub-${version}.tgz`,
    gate: (() => {
      const fs = require('node:fs')
      const gate = fs.readdirSync(out).find(name => name.startsWith('dsbot-mobile-desktop-gate-') && name.endsWith('.tgz'))
      return gate ?? 'dsbot-mobile-desktop-gate-0.1.1.tgz'
    })(),
    dsbot: (() => {
      const fs = require('node:fs')
      const fork = fs.readdirSync(out).find(name => name.startsWith('ds-bot-') && name.endsWith('.tgz'))
      return fork ?? null
    })(),
    archive: `dsbot-hub-release-${version}.tar.gz`
  }
}
fs.writeFileSync(path.join(out, 'RELEASE.json'), JSON.stringify(release, null, 2) + '\n')
NODE
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -a "$OUT/gate" "$OUT/profile" "$OUT/server" "$OUT/install.sh" "$OUT/preflight.sh" "$OUT/VERSIONS.md" "$OUT/RELEASE.json" "$STAGE/"
# The archive root README is the project README. The release-specific guide is
# RELEASE.md, so the three language READMEs point at each other correctly.
cp -a "$OUT/README.md" "$STAGE/RELEASE.md"
cp -a "$HERE/README.md" "$HERE/SECURITY.md" "$HERE/LICENSE" "$HERE/NOTICE" "$HERE/CHANGELOG.md" "$HERE/THIRD_PARTY.md" "$HERE/docs" "$OUT/examples" "$OUT/ANDROID.md" "$STAGE/"
cp -a "$HERE/README.pt-BR.md" "$HERE/README.zh-CN.md" "$HERE/SETUP.md" "$HERE/SETUP.pt-BR.md" "$HERE/SETUP.zh-CN.md" "$STAGE/"
cp "$OUT/dsbot-hub-$VERSION.tgz" "$STAGE/"
cp "$OUT"/dsbot-mobile-desktop-gate-*.tgz "$STAGE/"
if compgen -G "$OUT/ds-bot-*.tgz" > /dev/null; then
  cp "$OUT"/ds-bot-*.tgz "$STAGE/"
fi

# Distribution hygiene: the archive must not carry this machine's links,
# ownership, or private modes.
if find "$STAGE" -type l | grep -q .; then
  echo "error: release staging contains a symlink:" >&2
  find "$STAGE" -type l >&2
  exit 1
fi
find "$STAGE" -type d -exec chmod 755 {} +
find "$STAGE" -type f -exec chmod 644 {} +
chmod 755 "$STAGE/install.sh" "$STAGE/preflight.sh" "$STAGE/server/install-existing.sh"

# Inner checksums: a reader who unpacks the archive can verify its artifacts.
# The archive's own checksum cannot live inside itself; it goes in the outer
# SHA256SUMS next to the archive.
( cd "$STAGE" && ls dsbot-hub-*.tgz dsbot-mobile-desktop-gate-*.tgz ds-bot-*.tgz 2>/dev/null | xargs -r sha256sum > SHA256SUMS )
chmod 644 "$STAGE/SHA256SUMS"
ARCHIVE="$OUT/dsbot-hub-release-$VERSION.tar.gz"
tar --owner=0 --group=0 --numeric-owner --hard-dereference -czf "$ARCHIVE" -C "$STAGE" .
if tar -tvzf "$ARCHIVE" | awk '$2 != "0/0" || $1 ~ /^[lh]/ { bad = 1 } END { exit bad ? 0 : 1 }'; then
  echo "error: archive has local ownership or link entries" >&2
  tar -tvzf "$ARCHIVE" | awk '$2 != "0/0" || $1 ~ /^[lh]/' >&2
  exit 1
fi
if tar -tvzf "$ARCHIVE" | grep -qE '^-rw-------|^drwx------'; then
  echo "error: archive has private file modes" >&2
  exit 1
fi
echo "built $ARCHIVE"
( cd "$OUT" && ls dsbot-hub-*.tgz dsbot-mobile-desktop-gate-*.tgz ds-bot-*.tgz dsbot-hub-release-*.tar.gz | xargs sha256sum > SHA256SUMS )
node "$HERE/scripts/check-artifacts.mjs"
