# Install

Requires **DSH 0.2.2-alpha.3+ web**, **Node >= 24.9.0**, **ds-bot 0.2.6**, and a
model provider DSH can serve (or an existing DS Bot server). None of these ship
with the hub.

The hub package does not fork or patch ds-bot: it calls the routes the DS Bot UI
itself uses, so a stock 0.2.6 server works. The release archive also ships
`ds-bot-0.2.6-hub.2.tgz`, a fork that adds server-owned reactions, the bot
`react` tool and the shared back stack. The bundled compose image bakes that fork
in; on an existing server, install it with `server/install-existing.sh`.

## 1. Install the bundle

From a published package:

```
dsh plugin --profile web add dsbot-hub
```

From a checkout, install the package directory with the Plugin Manager
(`install_bundle`, target = this directory). The bundle inserts one `dsbot-hub`
row; the panel appears in the sidebar after a page refresh.

The hub does not install the DSH plugin marketplace. If the release profile
should offer one, install `dshmarket` in the same profile as an ordinary DSH
bundle; it then registers its panel in **More** alongside the hub. The hub has no
runtime dependency on it.

## 2. Add a server

Open **DS Bot Hub**, click the gear, then **Add server**. Enter:

- **Name** — shown in the switcher and tool results.
- **Endpoint** — where the hub dials ds-bot. The bundled compose publishes
  `http://127.0.0.1:13081`; a hand-run ds-bot is commonly on `8080` (usually the
  local end of an SSH tunnel).
- **Login token** — optional now, or paste it after saving.

The hub assigns a private loopback proxy port automatically (13090–13199). The
browser origin is hidden from the normal form; the settings layer keeps it on
the server and the panel derives the public host from the DSH page.

The token is the login URL or bare token the container prints:

```
docker logs ds-bot 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-
```

The token changes when the container restarts. Read it without printing it into a
shared log.

The hub exchanges it for the signed cookie and stores it as a DSH secret. The
browser never holds the team cookie.

## Local quickstart (browser on the same machine)

1. Open DSH at `http://127.0.0.1:3080`, then **DS Bot Hub**.
2. Add a server with endpoint `http://127.0.0.1:8080` and paste the token.
3. Done — no DNS, no certificate, no tunnel, no port to choose. The hub opens a
   loopback origin port and injects the team cookie.

If ds-bot is not running yet, run it as a local DSH web profile with the ds-bot
plugin on a free port (the hub's DSH owns `3080`):

```
DSH_HOME=$HOME/.dsbot dsh plugin --profile web add ds-bot
DSH_HOME=$HOME/.dsbot dsh --profile web --no-open
```

Point the hub at the port that profile prints.

## Phone / Tailscale

The phone runs the same DSH web app. The hub is the **Bots** destination in the
bottom bar (**Chat · Sessions · Bots · More**).

1. Bind DSH to the tailnet (or `0.0.0.0` behind a firewall) and open it from the
   phone using the Tailscale IP or MagicDNS name.
2. Set the hub's `proxy.bind` to the same interface (or `0.0.0.0`) so the phone
   can reach the per-server origin ports.
3. Open the hub and add the server normally. The grant uses the host you opened
   DSH with, so the iframe is same-site and the session cookie works.

Tailscale routes every port on the hub host; you do **not** need per-port
forwarding. Tailscale ACLs are the outer boundary; the origin grant/session is
the inner one. Do not expose `proxy.bind: 0.0.0.0` to an untrusted network.

If DSH is served over HTTPS, the origins must be HTTPS too or the browser will
block the mixed-content iframe. One certificate for the hub host covers every
port. Use a TLS terminator (Caddy) or `tailscale serve` per port.

### SSH tunnel

If the browser is on another machine and you want no tailnet route:

```
ssh -N \
  -L 3080:127.0.0.1:3080 \
  -L 13090:127.0.0.1:13090 \
  -L 13091:127.0.0.1:13091 \
  user@hub
```

Open `http://127.0.0.1:3080`. Forward **every** configured origin port; a
missing forward is a blank frame, not a plugin error. The hub uses the same host
form you opened DSH with, so forward to the same ports.

## Public hostnames (optional)

For a public VPS, one hostname per server behind a single TLS terminator is the
cleanest firewall shape:

```caddyfile
*.dsh.example.com {
  @alpha host alpha.dsh.example.com
  handle @alpha { reverse_proxy 127.0.0.1:13092 }
  @beta host beta.dsh.example.com
  handle @beta { reverse_proxy 127.0.0.1:13092 }
  handle { reverse_proxy 127.0.0.1:3080 }
}
```

- Wildcard DNS `*.dsh.example.com` and a wildcard certificate (DNS-01).
- Set each server's `origin` to `https://alpha.dsh.example.com` and
  `proxy.listen: 127.0.0.1:13092`.
- Caddy sets `X-Forwarded-Proto: https`, so the proxy marks the session cookie
  `Secure`.
- Caddy keeps `Host` and forwards WebSocket upgrades by default.
- The DSH host stays on `3080`; the server hostnames never reach DSH.

## 3. Verify

- The sidebar shows **DS Bot Hub**; opening it shows the server chip and the
  switcher.
- Selecting a server loads its real UI in the frame; the live dot shows idle /
  working / waiting.
- `curl http://127.0.0.1:13090/` without a session returns **401**, not the UI.
- The iframe's origin is the server's origin, not the DSH origin. In devtools,
  `location.origin` inside the frame differs from the panel.
- A wrong or expired cookie shows **sign in / re-paste**, not an empty team.
- Stopping one ds-bot leaves the other server switchable.

## Model providers

The container's models come from DSH's `llm-pi-ai` routes, and each route names
the variable holding its key. OpenCode Go is the bundled default; any provider
DSH serves works. See [Model providers](providers.md).

## Several servers

One container is one team. Give each its own host port, data volume and token,
keep host ports out of `13090`–`13199`, then add each endpoint in the hub. See
[Multiple local servers](multiple-servers.md).

## Troubleshooting

See [Troubleshooting](troubleshooting.md) for 401/403, blank frames, ports and
the panel API.

## dsh-Go

dsh-Go is **not** a supported surface for this release. The earlier WebView /
same-origin compatibility path was removed because it could not keep the team
UI isolated from DSH. Use the DSH web app in the phone browser (or an installed
PWA) over Tailscale.
