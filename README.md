<p align="center"><img src="icon.svg" width="72" height="72" alt="DSBots Hub"></p>

<h1 align="center">DSBots Hub</h1>

<p align="center">Run one or more DS Bot servers behind a single switcher in DeepSeek Harness.</p>

<p align="center">
  <strong>English</strong> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  Release <strong>0.11.13</strong> · DS Bot <strong>0.2.6-hub.2</strong> · DSH <strong>0.2.2-alpha.3+</strong>
</p>

---

DSBots Hub adds a server switcher to DeepSeek Harness (DSH) and embeds the real
DS Bot interface for the selected server. Each server keeps its own origin, its
own session cookie, and its own bots. The browser never holds the upstream team
credential.

It is built for **one operator running one or more self-hosted DS Bot teams**:
one DSH profile, one hub, any number of servers.

> **Not a multi-tenant service.** There are no user accounts, roles, or audit
> logs. Run it on Tailscale or a LAN behind a TLS proxy, never on the open
> internet. See [Security](#security).

## Features

- **One switcher, many servers.** The bots under the chip belong to the selected
  server. Switching keeps each server's thread.
- **Origin isolation.** The embedded UI is never served from the DSH origin. Each
  server gets its own proxy origin and host-only session cookie.
- **Server-owned reactions.** Users can leave up to two reactions per message;
  bots leave one. Bots receive a `react` tool and a note before their next turn
  when you react to them. *(Requires the bundled DS Bot fork.)*
- **Back gestures.** Android back and edge swipe close the top layer — action
  sheet, quote, message reader, settings, server sheet — before the hub navigates
  away.
- **Mobile and tablet flow.** Long-press action sheet, native emoji input,
  selectable message reader, and a desktop-only hover toolbar hidden on touch.
- **Nothing is copied.** Bots, chats, memory, and credentials stay on their
  servers.

## How it works

```text
Browser
  |
  +-- DSH + DSBots Hub panel .......... DSH origin
  |     |  same-origin panel API: /dsbot-hub/api
  |     |  GET /dsbot-hub/api/servers/<id>/open -> short-lived grant
  |     v
  +-- iframe --> per-server origin --> hub proxy --> DS Bot server
  |              (host-only cookie)      (injects the team cookie)
  |
  +-- tools --> /api/bot on each server endpoint
```

The hub asks for a grant, the grant sets a host-only cookie on that server's
origin, and the proxy injects the real team cookie upstream. No HTML rewriting,
no shared cookies, no cross-server actions. Origin ports are allocated
automatically from `13090`–`13199`.

## Requirements

| Component | Version | Notes |
|---|---|---|
| DSH | 0.2.2-alpha.3+ | web profile; the mobile shell needs 0.2.2+ |
| Node | 24.9.0+ | host CLI and build |
| DS Bot | 0.2.6 | stock works for the hub; the bundled fork adds reactions and back gestures |
| Docker + Compose | current | only for the bundled server image |
| Model provider | any DSH-supported | OpenCode Go is the bundled default; see [Model providers](#model-providers) |
| Network | Tailscale, LAN, or TLS proxy | the hub is plain HTTP behind it |

Nothing above ships in the archive. The release installs a DSH plugin and a
server image build; DSH, Node, Docker, and your provider account are yours to
provide. [SETUP.md](SETUP.md) lists them per phase.

## Quick start

The release archive contains the hub, the mobile gate, the DS Bot fork, and the
server image build.

### 1. Unpack and verify

```bash
mkdir -p dsbot-hub-0.11.13
tar -xzf dsbot-hub-release-0.11.13.tar.gz -C dsbot-hub-0.11.13
cd dsbot-hub-0.11.13

sha256sum -c SHA256SUMS     # every line must end in OK
./preflight.sh              # host and artifact checks
```

### 2. Configure and start the DS Bot server

Put the provider key in a private env file rather than on the command line:

```bash
cp server/.env.example server/.env
chmod 600 server/.env
$EDITOR server/.env         # set a provider key; OpenCode Go is the default

docker compose -f server/compose.yml up -d --build
```

The compose file publishes `127.0.0.1:13081` and stores data under `/opt/ds-bot`.
Both are defaults, not fixed paths: `DS_BOT_PORT`, `DS_BOT_CONTAINER`,
`DS_BOT_DATA_DIR` and `DS_BOT_WORKSPACE_DIR` in `server/.env` override them. If
the data directories do not exist, create them owned by `PUID`/`PGID` (default
`1000:1000`) before starting.

The container reads every value in `server/.env`. The bundled compose is set up
for an OpenCode Go route, but that is one provider, not a requirement — see
[Model providers](#model-providers).

### 3. Install the hub into DSH

```bash
./install.sh web            # or: ./install.sh "$DSH_PROFILE"
```

This installs `dsbot-hub`, the mobile gate, and the pinned desktop plugin set.
Use `WITH_DESKTOP=0 ./install.sh web` for the hub and gate only.

### 4. Restart DSH and open the hub

Restart the process that serves DSH web, then hard-refresh the browser. The
panel appears in the sidebar and as **Bots** on the mobile shell.

### 5. Add the server

Open **DS Bot Hub → gear → Add server** and fill in:

| Field | Value |
|---|---|
| Name | Anything you like, e.g. `Main` |
| Endpoint | `http://127.0.0.1:13081` |
| Login token | the token printed by the container (below) |

The container's DSH prints its login URL on startup. Read the token without
echoing it into a shared log:

```bash
docker logs ds-bot 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-
```

Paste that value into the token field. The hub stores it as a DSH secret and
exchanges it for the team cookie; the browser never sees the cookie.

> The token changes when the container restarts. If the server later shows
> **sign in**, paste a fresh token.

That's it. The chip should show the server name and its bots should load.

## Model providers

DS Bot is not tied to OpenCode Go. Models come from DSH's `llm-pi-ai` adapter:
every route names the environment variable holding its key (`apiKeyEnv`). The
bundled compose passes all of `server/.env` into the container, so adding a
provider does not mean editing the compose file.

The bundled compose is written for an OpenCode Go route (`OPENCODE_GO_API_KEY`). For another
provider:

1. Add its route under `providers` in the container profile's `llm-pi-ai` row.
2. Put the key in `server/.env` under the name that route's `apiKeyEnv` references.
3. Restart the container, then pick the model for the bot in DS Bot.

```yaml
providers:
  opencode-go:
    apiKeyEnv: OPENCODE_GO_API_KEY
  openai:
    apiKeyEnv: OPENAI_API_KEY
```

A `config:` block in a patch replaces the entry's whole config, so restate every
route you still want. Custom gateways also need `api`, `baseURL` and `models`.

Full field list, gateway examples and key-storage options are in
[docs/providers.md](docs/providers.md).

## Using an existing DS Bot server

The hub talks to the routes the DS Bot UI itself uses, so an existing DS Bot
0.2.6 server works without changes: add it with its endpoint and login token.

The bundled fork adds server-owned reactions, the bot `react` tool, and the
shared back stack. Two ways to move to it:

```bash
# existing container: back up and patch its live data profile
./server/install-existing.sh ds-bot ds-bot-0.2.6-hub.2.tgz

# or rebuild the image so new containers are already on the fork
docker compose -f server/compose.yml up -d --build
```

`install-existing.sh` keeps a timestamped backup of the old package under
`/data/profiles/web/node_modules/ds-bot.bak-<timestamp>` and restarts the
container. It does not delete the data volume.

## Several local servers

One container is one team. To run a second team on the same host, give it its own
name, host port, data directory and token:

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p 127.0.0.1:14001:3080 \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.2
```

Keep host ports out of `13090`–`13199`: the hub allocates its browser origins
there. Never mount one data volume in two containers. Then add
`http://127.0.0.1:14001` in the hub with its own id, label and token. Repeat for
each server; every container has its own token, and one being down does not hide
the others.

More: [docs/multiple-servers.md](docs/multiple-servers.md).

## Phone and remote access

The phone loads the DSH web app, and the hub's embedded origins must be
reachable from it. Point both at the same interface:

```yaml
- id: dsbot-hub
  config:
    proxy:
      listen: 127.0.0.1:13091
      bind: 100.x.y.z        # tailnet address, or 0.0.0.0 behind an ACL
```

Then open the DSH URL from the phone, for example
`http://<tailnet-ip>:3080/`, and choose **Bots**. Tailscale routes every port on
the host, so no per-port forwarding is needed.

If DSH is served over HTTPS, the origin ports must be HTTPS too or the browser
blocks the mixed-content iframe. One certificate for the host covers all its
ports; terminate TLS with Caddy or `tailscale serve`.

The full walkthrough — including SSH tunnels and public subdomains — is in
[docs/install.md](docs/install.md).

## Configuration

The gear panel is the normal editor. YAML on the `dsbot-hub` row is the
bootstrap and automation path:

```yaml
- id: dsbot-hub
  config:
    servers:
      - id: main
        label: Main
        endpoint: http://127.0.0.1:13081
    proxy:
      listen: 127.0.0.1:13091
      bind: 127.0.0.1
```

| Field | Default | Meaning |
|---|---|---|
| `servers[].endpoint` | — | Address the hub dials; the cookie is bound to its host and port |
| `servers[].origin` | auto | Browser origin for the embedded UI; a loopback port is allocated |
| `servers[].cookieRef` | `DSBOT_<ID>_COOKIE` | DSH secret name holding the team cookie |
| `proxy.listen` | `127.0.0.1:13091` | Shared listener for hostname-based origins |
| `proxy.bind` | `127.0.0.1` | Interface the per-server origins bind to |
| `proxy.grantTtlSeconds` | `60` | Grant lifetime |
| `proxy.sessionHours` | `12` | Embedded session lifetime |

See [docs/config.md](docs/config.md) for every field and the origin rules.

## Release contents

| Artifact | Purpose |
|---|---|
| `dsbot-hub-0.11.13.tgz` | DSH hub plugin |
| `dsbot-mobile-desktop-gate-0.1.1.tgz` | mobile desktop-UI gate |
| `ds-bot-0.2.6-hub.2.tgz` | DS Bot fork: reactions and back gestures |
| `dsbot-hub-release-0.11.13.tar.gz` | unpacked release: docs, profile, installer, server build |
| `SHA256SUMS` | artifact checksums |
| `preflight.sh` | host and release verification |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| The panel is missing from the sidebar | DSH not restarted, or the bundle is not in the profile |
| Blank embedded frame | Origin port not bound on the interface you opened, or an HTTPS page embedding an HTTP origin |
| **Sign in** / 401 on a server | Token changed, or the endpoint host/port changed after the cookie was minted |
| **Link expired** / 403 | Grants are single-use and short-lived; reopen the server |
| `compose` exits: `env file ... not found` | `server/.env` is missing; copy `server/.env.example` |
| A bot replies `MISSING_CREDENTIAL` | No key for that model route; add it to `server/.env` under the route's `apiKeyEnv` name |
| A second server's frame is blank | Its host port collides with `13090`–`13199`, or is not bound on the interface you use |
| 403 from the upstream | Endpoint authority and cookie authority disagree |

More in [docs/troubleshooting.md](docs/troubleshooting.md).

## Documentation

- [SETUP.md](SETUP.md) — agent-executable setup runbook
- [Install and networking](docs/install.md)
- [Configuration](docs/config.md)
- [Model providers](docs/providers.md)
- [Multiple servers](docs/multiple-servers.md)
- [Mobile shell and gestures](docs/mobile.md)
- [Back gestures](docs/back-gesture.md)
- [Upgrade](docs/upgrade.md)
- [Compatibility](docs/compatibility.md)
- [Operations](docs/operations.md)
- [Troubleshooting](docs/troubleshooting.md)

## Security

- The DS Bot login token is full control of that team. The provider key is
  spendable credit. Keep both out of shell history, chat, and git.
- Keep the hub on a private network. Tailscale ACLs are the outer boundary; the
  grant/session cookies are the inner one.
- Do not expose the DSH port, the proxy ports, or the DS Bot port to the public
  internet.
- Run as a non-root user. Keep `server/.env` at mode `600` and the DSH home
  private.
- Read [SECURITY.md](SECURITY.md) before exposing the hub to anyone else.

## License

Apache-2.0. The bundled DS Bot fork is also Apache-2.0, with its own `LICENSE`,
`NOTICE`, and `MODIFICATIONS.md` inside the tarball. See [NOTICE](NOTICE) and
[THIRD_PARTY.md](THIRD_PARTY.md).

<p align="center">
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="SETUP.md">Setup</a>
</p>
