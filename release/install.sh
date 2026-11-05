#!/usr/bin/env bash
# Install DS Bot Hub, the mobile gate, and (optionally) the desktop plugin set
# into an existing DSH profile.
#
#   ./install.sh [profile]           # default: web
#   WITH_DESKTOP=0 ./install.sh web  # hub + gate only
#
# The release directory must contain dsbot-hub-<version>.tgz, built with:
#   npm pack --pack-destination release
set -euo pipefail
umask 022

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${1:-${DSH_PROFILE:-web}}"
DSH_BIN="${DSH_BIN:-dsh}"
HUB_TGZ="${HUB_TGZ:-}"
if [[ -z "$HUB_TGZ" ]]; then
  HUB_TGZ="$(find "$HERE" -maxdepth 1 -name 'dsbot-hub-*.tgz' -print | sort -V | tail -1)"
fi
WITH_DESKTOP="${WITH_DESKTOP:-1}"

command -v "$DSH_BIN" >/dev/null 2>&1 || {
  echo "dsh not found on PATH; set DSH_BIN or install DSH 0.2.2-alpha.3+ first." >&2
  exit 1
}
if [[ -z "$HUB_TGZ" || ! -f "$HUB_TGZ" ]]; then
  echo "Hub tarball not found in $HERE" >&2
  echo "Build it with: npm pack --pack-destination release" >&2
  exit 1
fi
GATE_TGZ="$(find "$HERE" -maxdepth 1 -name 'dsbot-mobile-desktop-gate-*.tgz' -print -quit)"
if [[ -z "$GATE_TGZ" || ! -f "$GATE_TGZ" ]]; then
  echo "Gate tarball not found in $HERE" >&2
  exit 1
fi

echo "== installing dsbot-hub into profile '$PROFILE' =="
"$DSH_BIN" plugin --profile "$PROFILE" add "$HUB_TGZ"
echo "== installing the mobile desktop-UI gate =="
"$DSH_BIN" plugin --profile "$PROFILE" add "$GATE_TGZ"

if [[ "$WITH_DESKTOP" == "1" ]]; then
  echo "== installing the pinned desktop plugin set =="
  "$DSH_BIN" plugin --profile "$PROFILE" add dsh-better-sidebar@0.28.0
  "$DSH_BIN" plugin --profile "$PROFILE" add dsh-context@0.80.2
  "$DSH_BIN" plugin --profile "$PROFILE" add dshmarket@1.73.10
fi

cat <<'TXT'

== next ==
1. Restart DSH web, then hard-refresh the browser.
2. Open DS Bot Hub, click the gear, and add a server endpoint.
3. On a phone/tailnet build, set the hub proxy.bind to the tailnet address
   (or 0.0.0.0 behind an ACL) before using the frame.
4. Optional dskin: dsh plugin --profile <profile> add github:dancingmemory/dskin

The desktop plugins are optional. The mobile gate is harmless when they are
absent and hides their UI at <=1024px when they are present.
TXT
