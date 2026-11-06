# Troubleshooting

## The panel is not in the sidebar

- Refresh the DSH page after installing or updating the bundle; the client
  module is read at boot.
- Confirm the bundle is in the profile and the `dsbot-hub` row is active.
- Check the DSH startup log for `[dsbot-hub]` and for a plugin load error.
- On DSH older than 0.2.2-alpha.3 the mobile **Bots** destination is absent; the
  sidebar panel still works. Upgrade DSH for the mobile shell.

## Settings save fails

- **503 `configEditor is unavailable`** — the profile's DSH lacks the config
  editor; update DSH.
- **503 `The dsbot-hub config entry was not found`** — the bundle row is not in
  the profile; reinstall and reload. The response lists the entry ids it found.
- **409** — the profile config changed while saving; reload the list and retry.
- The save reconciles through the Loader; the panel re-fetches its server list
  and the iframe reloads its grant.

## "Hub API unavailable"

The panel API is same-origin and fenced by DSH's connection admission. Open the
panel from the DSH page (not a copied URL from another origin) and make sure the
DSH session is valid. A 401 is a DSH session problem, not a ds-bot problem.

## Sign in / 401 on a server

- The token is the login URL printed by the ds-bot container. Paste the URL or
  the bare token.
- The cookie is bound to the **endpoint's authority** (`host:port`). Changing the
  tunnel port invalidates it; paste a fresh token.
- The 30-day cookie can expire; paste a fresh token.
- `devCookieFile` is a development fallback. In a real install the cookie lives
  in DSH credentials and is written by the panel's sign-in.

## "Link expired" / 403 on a grant

- The grant is short-lived (60 s) and single-use. Open the server from the panel
  again; it mints a fresh one.
- After replacing the bundle, restart the process serving DSH so the old
  listeners and process secret are gone.
- The grant file under `dev.grantFile` is a development hook only.

## The frame is blank

1. Open the server's **origin** directly in a tab. Without a grant/session it
   should show **401**, not the UI.
2. If the origin is unreachable, the origin listener is not up, its port is not
   bound on the interface you are using, or the request went to the wrong host.
3. On a phone, set `proxy.bind` to the tailnet/LAN interface (or `0.0.0.0` behind
   a firewall) and open DSH using that host. The grant follows the page host.
4. If DSH is HTTPS and the origin is HTTP, the browser blocks the mixed-content
   iframe. Terminate TLS on the origin ports too; one certificate for the host
   covers every port.
5. DS Bot 0.2.6-hub.3 sends no `X-Frame-Options` and no CSP. If a future version
   adds one, the frame is blocked by the upstream; its UI in a tab still works.

## 403 from the upstream (not the grant)

The proxy rewrites `Host` and `Origin` to the endpoint authority. A 403 with a
valid cookie usually means the request reached ds-bot with the wrong authority:

- `endpoint` and the authority the cookie was minted at must match exactly
  (`127.0.0.1:8081` ≠ `localhost:13081`).
- A reverse proxy in front of DSH or ds-bot must preserve `Host`.
- A cross-origin iframe would send `Sec-Fetch-Site: cross-site`, which ds-bot
  refuses. The hub's origin proxy makes the app same-origin with its own API, so
  the header stays `same-origin`; keep that architecture.

## "unreachable" / "misconfigured" / "incompatible"

- `unreachable` — the hub cannot dial `endpoint`; check the tunnel, container,
  port and firewall.
- `misconfigured` — ds-bot answered 403; check the endpoint authority and the
  cookie's authority.
- `incompatible` — `state` did not have the expected shape. The hub reports the
  reason and does not show a partial roster. Stock ds-bot 0.2.x is supported; an
  upstream shape change needs a hub update.
- One failing server never blocks another; the switcher shows each state.

## Port already in use

- Each loopback origin needs its own port (13090–13199 by default). The settings
  editor allocates the first free one; hand-written YAML must choose unique
  ports.
- An old DSH process can hold a port. Restart the process serving DSH.
- `proxy.listen` is only for hostname origins; do not point a loopback origin at
  it.
- The origin listeners bind `proxy.bind` (default `127.0.0.1`). A port held by
  another process makes that server inactive; check the startup log.

## Tools

- Tool names are `dsbot_<server>_list_bots`, `_ask_bot`, `_read_chat`. Each tool
  reaches exactly one server.
- `wrong_server` — the bot name exists on another server; the error names it.
  Select that server and use its tool.
- `unknown_bot` — the local roster is listed.
- `timeout` — the reply is still running; the turn id is in the result. Use
  `read_chat` later.
- The old prototype MCP bridges (`mcp__dsbot-alpha__*`) are separate; keep one
  tool set.

## Installer

`ERR_PNPM_ADDING_TO_ROOT` means the profile is a pnpm workspace root and the
installer runs `pnpm add` without `-w`. Add to the profile's
`pnpm-workspace.yaml`:

```yaml
ignoreWorkspaceRootCheck: true
```

`already-installed` on a version change is expected: remove the bundle, then
install the new package directory.

## dsh-Go

dsh-Go is not supported for this release. The WebView/same-origin compatibility
path was removed. Use the DSH web app in a phone browser over Tailscale.
