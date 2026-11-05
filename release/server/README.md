# DSBots Hub server image

This directory bakes DS Bot `0.2.6-hub.2` into the server template, so new
containers get server-owned reactions and the shared back stack without a
post-install patch.

## New install

```bash
cp server/.env.example server/.env
chmod 600 server/.env
$EDITOR server/.env          # set a provider key; OpenCode Go is the default

docker compose -f server/compose.yml up -d --build
```

Compose reads `server/.env` automatically because it sits next to `compose.yml`,
and passes the whole file into the container. Any provider DSH serves works: the
variable name must match the model route's `apiKeyEnv`. See `docs/providers.md`
in the release root.

`DS_BOT_CONTAINER`, `DS_BOT_PORT`, `DS_BOT_DATA_DIR` and
`DS_BOT_WORKSPACE_DIR` in the same file override the container name, published
port and host data paths. The defaults are `ds-bot`, `13081`,
`/opt/ds-bot/data` and `/opt/ds-bot/workspace`.

The build uses `ds-bot-0.2.6-hub.2.tgz` from the release root and replaces the
`/opt/dsh-template/profiles/web/node_modules/ds-bot` copy inside the image.

The container publishes `127.0.0.1:13081` (container port `3080`) and mounts
`/opt/ds-bot/data` and `/opt/ds-bot/workspace`. Create those directories as the
runtime user if you do not want Docker to create them as root.

## Existing container

After rebuilding or recreating the image, upgrade the data profile once:

```bash
./server/install-existing.sh ds-bot ds-bot-0.2.6-hub.2.tgz web
```

The third argument is the profile inside the container; it defaults to `web`. The
script backs up the existing `node_modules/ds-bot` under
`/data/profiles/<profile>/node_modules/ds-bot.bak-<timestamp>`, installs the
fork, checks `src/host/reactions.js` and the version, then restarts the
container.

The web token changes when the container restarts. Re-paste the new token in
DSBots Hub only if the stored cookie stops working.

## A second local server

Each container is an independent team: its own volume, host port and token.
Reuse the built image and keep host ports out of `13090`–`13199` (the hub's
browser-origin range):

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p 127.0.0.1:14001:3080 \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.2
```

Never mount one data volume in two containers.
