# Config

All fields live on the `dsbot-hub` row. The settings panel (gear) is the normal
editor: it writes the `servers` list through DSH's `configEditor` into the
profile's user layer and applies the change live. The row config is the
bootstrap / advanced override; YAML is for images and automation.

```yaml
- id: dsbot-hub
  config:
    servers: [...]
    panel: {...}
    proxy: {...}
```

## servers[]

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | `[a-z0-9][a-z0-9_-]*`, unique. Prefixes the tool names. |
| `label` | no | Shown in the chip, switcher and tool results. Defaults to `id`. |
| `endpoint` | yes | Upstream base URL the hub dials, e.g. `http://127.0.0.1:8081`. |
| `origin` | no | Browser origin for this server's real UI. When omitted the settings layer allocates a loopback port; the panel swaps a loopback host for the host DSH was opened on. |
| `hostname` | no | Shorthand: `origin: https://<hostname>` when `origin` is absent. |
| `cookieRef` | no | Name of the DSH secret / env var holding the cookie. Default `DSBOT_<ID>_COOKIE`. |
| `devCookieFile` | no | **Dev only.** Netscape cookie jar or raw `name=value` cookie. Never in a shared profile. |
| `expectedVersion` | no | Preserved for compatibility; never used to hard-fail. |

The **cookie is bound to `endpoint`'s authority** (host and port). If the
endpoint authority changes, the stored cookie stops working; re-paste the token.
`origin` is only the browser address of the origin proxy; it may differ in
scheme, host and port.

Origin rules:

- An origin is a scheme, host and port only. A path is rejected: the grant
  cookie needs a host, not a path prefix.
- Every server needs a distinct origin. For loopback origins, that means a
  distinct port. The settings editor allocates one automatically when `origin`
  is omitted.
- For a loopback origin the grant URL uses the **same hostname** the DSH panel
  was opened on (and the same scheme), so the iframe is same-site with DSH and
  the `SameSite=Lax` session cookie is sent. This is what makes `127.0.0.1`,
  `localhost`, a Tailscale IP and a MagicDNS name all work without editing the
  config on every device.
- A non-loopback origin is used verbatim. That is the public subdomain model:
  `https://alpha.example.com` behind your TLS terminator and the shared
  `proxy.listen` port.

## panel

| Field | Default | Meaning |
|---|---|---|
| `defaultServer` | first server | Initial selection; an unknown id falls back to the first. |

## proxy

| Field | Default | Meaning |
|---|---|---|
| `listen` | `127.0.0.1:13091` | Shared listener for **hostname** origins. |
| `bind` | `127.0.0.1` | Interface the per-server origin listeners bind. |
| `grantTtlSeconds` | `60` | Lifetime of the one-time grant the panel uses to open a frame. |
| `sessionHours` | `12` | Lifetime of the host-only proxy session cookie. |

The proxy **does not** open a DSH route per server and does not rewrite HTML.
Each server is a normal origin listener (or the shared hostname listener). The
listeners bind loopback by default. Set `bind` to the tailnet/LAN address (or
`0.0.0.0` behind a firewall) only when a phone or another machine must reach
them; the grant/session gate still applies.

## dev

| Field | Default | Meaning |
|---|---|---|
| `grantFile` | empty | **Dev only.** Write one grant URL per active server to this file. |
| `grantTtlSeconds` | `600` | Dev grant lifetime for that file. |

Remove `dev` and `devCookieFile` before sharing a profile.

## Cookie resolution

1. DSH credentials (`cookieRef`), written by the panel's sign-in.
2. The environment variable named by `cookieRef`.
3. `devCookieFile` (dev only).

No cookie → the session reports `unauthorized`; the proxy refuses to serve that
server. The panel prompts for the token; it never shows an empty team.

## Settings persistence

The gear's settings view writes the whole `servers` list through DSH's
`configEditor` into the profile's user layer, then the row reconciles live:
sessions, origin listeners, health, tools and panel. Add, rename, reorder,
sign in and delete all use the same path.

- The login token is stored as a DSH secret; deleting a server unsets its secret.
- The form no longer asks for a browser origin. A new server gets the first free
  loopback port (13090–13199); an existing server keeps its origin.
- `devCookieFile` and `expectedVersion` are preserved per id and are not shown in
  the settings view (dev/test fields).
- A YAML profile patch still wins as the bootstrap layer; the settings writes the
  user layer over it. Use the settings for day-to-day changes.

## Examples

Local, one server (origin assigned by the settings panel):

```yaml
servers:
  - { id: alpha, endpoint: 'http://127.0.0.1:8080' }
```

Local, two servers with explicit ports (hand-written YAML):

```yaml
servers:
  - { id: alpha, endpoint: 'http://127.0.0.1:8080', origin: 'http://127.0.0.1:13090' }
  - { id: beta,  endpoint: 'http://127.0.0.1:8081', origin: 'http://127.0.0.1:13091' }
```

Public subdomains, one shared listener:

```yaml
servers:
  - id: alpha
    endpoint: http://127.0.0.1:8080
    origin: https://alpha.dsh.example.com
    cookieRef: DSBOT_ALPHA_COOKIE
  - id: beta
    endpoint: http://127.0.0.1:8081
    origin: https://beta.dsh.example.com
    cookieRef: DSBOT_BETA_COOKIE
proxy:
  listen: 127.0.0.1:13092
```

## Phone / Tailscale

The panel builds the grant URL from the **request host**. If DSH is opened at
`http://hub.example.com:3081`, a loopback origin becomes
`http://hub.example.com:13090`; open the phone's browser to the same host. Set
`proxy.bind` to the tailnet interface (or `0.0.0.0`) so the phone can reach those
ports. Do not mix `127.0.0.1` and `localhost` in the origin; the grant follows
the page host, so using the page's own host form is enough.

If DSH is HTTPS, every origin must be HTTPS too (mixed content). One certificate
for the hub host covers all ports; a TLS terminator per port, or a wildcard
subdomain layout on 443, both work.
