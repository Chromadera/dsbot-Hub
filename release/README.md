# DSBots Hub — release guide

This is the release-specific quick path. The full project documentation is in
the root `README.md` (next to this file in the archive); it covers features,
architecture, configuration, and troubleshooting.

The directory contains the hub plugin, the mobile gate, the DS Bot fork, and the
server image build. It is a **private, single-user** deployment: one DSH profile,
one hub, one or more DS Bot servers.

## Contents

```
install.sh                     DSH profile installer
preflight.sh                   host and artifact checks
profile/                       reference DSH profile (hub + desktop set + gate)
gate/                          mobile desktop-UI gate
server/                        DS Bot image build, compose file, .env.example
docs/                          install, config, mobile, operations, upgrade
dsbot-hub-<version>.tgz        hub bundle
ds-bot-0.2.6-hub.3.tgz         DS Bot fork (reactions + back gestures)
dsbot-mobile-desktop-gate-*.tgz
SHA256SUMS                     artifact checksums
VERSIONS.md                    the tested version set
```

## Requirements

- DSH **0.2.2-alpha.3+** web profile
- Node **24.9.0+**
- Docker with Compose, for the bundled server image
- a model provider key, or an existing DS Bot server
- a private network (Tailscale, LAN, or a TLS terminator)

DS Bot runs on any provider DSH serves; OpenCode Go is only the default route.
See `docs/providers.md`, and open the full `README.md` for features and
configuration.

## Install

1. Verify the archive:

   ```bash
   sha256sum -c SHA256SUMS
   ./preflight.sh
   ```

2. Configure the provider key in a private file, then start the server:

   ```bash
   cp server/.env.example server/.env
   chmod 600 server/.env
   $EDITOR server/.env          # set a provider key; OpenCode Go is the default
   docker compose -f server/compose.yml up -d --build
   ```

3. Install the hub into the DSH profile:

   ```bash
   ./install.sh web             # or the profile name you use
   ```

   `WITH_DESKTOP=0 ./install.sh web` installs the hub and gate only.

4. Restart DSH web, hard-refresh, open **Bots** (mobile) or **DS Bot Hub**
   (sidebar), then **Add server** with:

   - endpoint `http://127.0.0.1:13081`
   - the login token printed by the container:
     ```bash
     docker logs ds-bot 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-
     ```

   The token changes when the container restarts; paste a fresh one if the server
   later shows **sign in**.

## Existing DS Bot server

A stock DS Bot 0.2.6 server works with the hub: add its endpoint and login token.
The bundled fork adds reactions and back gestures. To move an existing container
onto it:

```bash
./server/install-existing.sh ds-bot ds-bot-0.2.6-hub.3.tgz
```

The script backs up the old package under
`/data/profiles/web/node_modules/ds-bot.bak-<timestamp>`, installs the fork,
checks the version and `reactions.js`, and restarts the container. It never
deletes the data volume.

## Several local servers

One container is one team. Give each additional one its own name, host port
(outside `13090`–`13199`), data directory and token:

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p 127.0.0.1:14001:3080 \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.3
```

Then add each endpoint in the hub. Never share a data volume. See
`docs/multiple-servers.md`.

## Phone

Set `proxy.bind` to the interface the phone reaches (the tailnet address, or
`0.0.0.0` behind an ACL), then open the DSH web URL on the phone — not an origin
port. Tailscale routes every port on the host. If DSH is HTTPS, the origins must
be HTTPS too. See `docs/install.md`.

## Upgrade and rollback

See `docs/upgrade.md`. Keep the previous hub tarball and the server's timestamped
backup; rollback restores them and never prunes a volume.

## Limitations

- One shared DSH token; no accounts, roles, or SSO.
- The desktop plugins are hidden at 1024px and below by the gate, but their
  server-side code stays active. This is a UI boundary.
- `dsh-better-sidebar`, `dsh-context` and `dshmarket` are third-party projects.
  The versions in `VERSIONS.md` are the tested set; the gate's selectors are tied
  to them, so re-test after upgrading.

## Security

Do not expose DSH or the origin ports to the public internet. Keep
`server/.env` at mode `600`. Read `SECURITY.md` before sharing access.

## License

Apache-2.0. The DS Bot fork ships its own `LICENSE`, `NOTICE` and
`MODIFICATIONS.md` inside `ds-bot-0.2.6-hub.3.tgz`. See `NOTICE`,
`THIRD_PARTY.md`, and `VERSIONS.md`.
