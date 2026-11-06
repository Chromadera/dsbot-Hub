#!/usr/bin/env sh
# Upgrade an existing DS Bot container's data profile from the fork tarball.
# Usage: ./install-existing.sh [container] [ds-bot-0.2.6-hub.3.tgz] [profile]
set -eu

CONTAINER="${1:-ds-bot}"
TGZ="${2:-ds-bot-0.2.6-hub.3.tgz}"
PROFILE="${3:-web}"

[ -f "$TGZ" ] || { echo "fork tarball not found: $TGZ" >&2; exit 1; }
docker cp "$TGZ" "$CONTAINER:/tmp/ds-bot.tgz"

docker exec -u 0 -e PROFILE="$PROFILE" "$CONTAINER" sh -ec '
  set -eu
  profile="/data/profiles/$PROFILE"
  test -d "$profile/node_modules/ds-bot" || {
    echo "no ds-bot package under $profile/node_modules" >&2
    exit 1
  }
  stamp=$(date -u +%Y%m%d-%H%M%S)
  backup="$profile/node_modules/ds-bot.bak-$stamp"
  cp -a "$profile/node_modules/ds-bot" "$backup"
  rm -rf "$profile/node_modules/ds-bot"
  tar -xzf /tmp/ds-bot.tgz -C "$profile/node_modules"
  mv "$profile/node_modules/package" "$profile/node_modules/ds-bot"
  chown -R node:node "$profile/node_modules/ds-bot"
  test -f "$profile/node_modules/ds-bot/src/host/reactions.js"
  node -e "const p=require(\"$profile/node_modules/ds-bot/package.json\"); if(p.version!==\"0.2.6-hub.3\") throw new Error(p.version)"
  echo "installed 0.2.6-hub.3; backup: $backup"
'
docker restart "$CONTAINER"
