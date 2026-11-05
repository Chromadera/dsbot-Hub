#!/usr/bin/env bash
# DSBots Hub release preflight.
#
#   ./preflight.sh [release-dir]
#
# Checks the host and the unpacked release before anything is installed.
# Prints one PASS / WARN / FAIL line per check, then a summary. Exits 1 if any
# check failed. It never prints a key, token, cookie, or the contents of .env.
set -uo pipefail

DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
DSH_BIN="${DSH_BIN:-dsh}"
PASS=0
WARN=0
FAIL=0

pass() { printf 'PASS  %s\n' "$1"; PASS=$((PASS + 1)); }
warn() { printf 'WARN  %s\n' "$1"; WARN=$((WARN + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; FAIL=$((FAIL + 1)); }

echo "== DSBots Hub preflight =="
echo "release dir: $DIR"
echo

if [ ! -d "$DIR" ]; then
  echo "FAIL  release dir does not exist: $DIR"
  exit 1
fi

# --- host -----------------------------------------------------------------
case "$(uname -s)" in
  Linux) pass "os: Linux" ;;
  *) fail "os: $(uname -s); the bundled server image is Linux-only" ;;
esac

if command -v node >/dev/null 2>&1; then
  if node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&b>=9)?0:1)' 2>/dev/null; then
    pass "node: $(node --version) (>= 24.9.0)"
  else
    fail "node: $(node --version) is older than 24.9.0"
  fi
else
  fail "node: not found on PATH"
fi

if command -v docker >/dev/null 2>&1; then
  pass "docker: $(docker --version 2>/dev/null)"
  if docker compose version >/dev/null 2>&1; then
    pass "docker compose: $(docker compose version --short 2>/dev/null || echo available)"
  else
    fail "docker compose: plugin not available"
  fi
  if docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
    pass "docker daemon: reachable"
  else
    fail "docker daemon: not reachable (not running, or no permission for this user)"
  fi
else
  fail "docker: not found on PATH"
  fail "docker compose: cannot check without docker"
fi

if command -v "$DSH_BIN" >/dev/null 2>&1; then
  DSH_VERSION="$("$DSH_BIN" --version 2>/dev/null | head -1)"
  DSH_SEMVER="$(printf '%s' "$DSH_VERSION" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  if [ -n "$DSH_SEMVER" ] && node -e '
      const [a, b, c] = process.argv[1].split(".").map(Number);
      process.exit(a > 0 || b > 2 || (b === 2 && c >= 2) ? 0 : 1);
    ' "$DSH_SEMVER" 2>/dev/null; then
    pass "dsh: ${DSH_VERSION:-$DSH_SEMVER}"
  else
    warn "dsh: ${DSH_VERSION:-unknown}; this release targets 0.2.2-alpha.3+ (desktop panel may still work)"
  fi
else
  fail "dsh: '$DSH_BIN' not found on PATH (set DSH_BIN if it lives elsewhere)"
fi

# --- release files --------------------------------------------------------
echo
if find "$DIR" -type l | grep -q .; then
  fail "layout: release contains symlinks"
  find "$DIR" -type l >&2
else
  pass "layout: no symlinks"
fi

for f in install.sh SHA256SUMS server/compose.yml server/Dockerfile \
         server/install-existing.sh server/.env.example \
         profile/package.json examples/dsh-web.service; do
  if [ -f "$DIR/$f" ]; then pass "file: $f"; else fail "file: $f is missing"; fi
done

HUB_TGZ="$(cd "$DIR" && ls -1 dsbot-hub-*.tgz 2>/dev/null | head -1)"
GATE_TGZ="$(cd "$DIR" && ls -1 dsbot-mobile-desktop-gate-*.tgz 2>/dev/null | head -1)"
FORK_TGZ="$(cd "$DIR" && ls -1 ds-bot-*.tgz 2>/dev/null | head -1)"

for pair in "hub:$HUB_TGZ" "gate:$GATE_TGZ" "ds-bot fork:$FORK_TGZ"; do
  name="${pair%%:*}"
  value="${pair#*:}"
  if [ -n "$value" ]; then pass "artifact: $name -> $value"; else fail "artifact: no $name tarball"; fi
done

if [ -f "$DIR/SHA256SUMS" ] && command -v sha256sum >/dev/null 2>&1; then
  if (cd "$DIR" && sha256sum -c SHA256SUMS >/dev/null 2>&1); then
    pass "checksums: SHA256SUMS verified"
  else
    fail "checksums: sha256sum -c SHA256SUMS failed"
  fi
else
  fail "checksums: SHA256SUMS or sha256sum is unavailable"
fi

# --- artifact versions ----------------------------------------------------
if [ -n "${HUB_TGZ:-}" ] && [ -n "${FORK_TGZ:-}" ]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  tar -xOf "$DIR/$HUB_TGZ" package/package.json > "$TMP/hub.json" 2>/dev/null || echo '{}' > "$TMP/hub.json"
  tar -xOf "$DIR/$FORK_TGZ" package/package.json > "$TMP/fork.json" 2>/dev/null || echo '{}' > "$TMP/fork.json"
  HUB_VERSION="$(node -e 'try{process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).version)}catch{}' "$TMP/hub.json")"
  FORK_VERSION="$(node -e 'try{process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).version)}catch{}' "$TMP/fork.json")"
  if [ -n "$HUB_VERSION" ]; then pass "hub package version: $HUB_VERSION"; else fail "hub package version: unreadable"; fi
  case "$FORK_VERSION" in
    0.2.6-hub.*) pass "ds-bot fork version: $FORK_VERSION" ;;
    '') fail "ds-bot fork version: unreadable" ;;
    *) fail "ds-bot fork version: $FORK_VERSION (expected 0.2.6-hub.x)" ;;
  esac
fi

# --- optional local configuration ----------------------------------------
echo
if [ -f "$DIR/server/.env" ]; then
  MODE="$(stat -c '%a' "$DIR/server/.env" 2>/dev/null || echo '?')"
  case "$MODE" in
    600|400) pass "server/.env: present, mode $MODE" ;;
    *) warn "server/.env: present, mode $MODE (recommended 600)" ;;
  esac
  KEY_NAME="$(grep -E '^[A-Z][A-Z0-9_]*_API_KEY=.+' "$DIR/server/.env" 2>/dev/null | head -1 | cut -d= -f1)"
  if [ -n "$KEY_NAME" ]; then
    pass "server/.env: provider key set ($KEY_NAME; value not printed)"
  else
    warn "server/.env: no *_API_KEY value (fine for an existing server, or keys stored in DSH)"
  fi
else
  warn "server/.env: not created yet (needed before starting a new DS Bot server)"
fi

ENV_PORT="$(grep -E '^DS_BOT_PORT=[0-9]+' "$DIR/server/.env" 2>/dev/null | tail -1 | cut -d= -f2)"
PUBLISH_PORT="${ENV_PORT:-13081}"
if command -v ss >/dev/null 2>&1; then
  if ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "(^|:)${PUBLISH_PORT}$"; then
    warn "port ${PUBLISH_PORT}: already listening (an existing container may own it)"
  else
    pass "port ${PUBLISH_PORT}: free for the bundled compose file"
  fi
fi

# --- summary --------------------------------------------------------------
echo
printf '== summary: %d passed, %d warnings, %d failed ==\n' "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "Preflight failed. Fix the FAIL lines before continuing."
  exit 1
fi
echo "Preflight OK. Continue with SETUP.md phase 1."
