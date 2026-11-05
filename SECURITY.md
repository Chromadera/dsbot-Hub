# Security

DSBots Hub is a **private, single-user** deployment tool. It is meant for one
operator on a trusted network such as Tailscale or a LAN behind a firewall. It
does not provide user accounts, roles, per-server authorization, or audit logs.
Do not run it as a shared or multi-tenant service.

## What counts as a secret

| Secret | Where it lives | What it grants |
|---|---|---|
| DSH login token | Printed once by `dsh web` as `?token=...`; stored by the browser | Full control of that DSH instance |
| DS Bot / DSH container token | Printed by the container's `dsh web` line | Full control of that team |
| DS Bot team cookie | DSH credentials store, never the browser | Full control of that team |
| Model provider key(s) | `server/.env` (mode 600), under the name each route's `apiKeyEnv` expects | Spend and access for that provider |
| DSH secret values (`DSH_SECRET_*`) | `secrets.json` in the DSH home | Whatever that secret protects |
| Session / grant cookies | Browser and hub process memory | Access to one embedded origin |

Any one of these is equivalent to being that user. Treat them as passwords.

## Trust boundaries

- **Network.** Tailscale/WireGuard, a LAN firewall, or a TLS reverse proxy is
  the outer boundary. The hub itself speaks plain HTTP behind that boundary.
- **DSH token.** A bearer secret. Anyone with the token and a route to the DSH
  origin is the same user. The hub exchanges it for a signed, host-only session
  cookie.
- **Hub grant/session.** Each embedded DS Bot origin uses a short-lived,
  single-use grant (60 s by default) and a host-only session cookie (12 h by
  default). The browser never receives the DS Bot team cookie.
- **Per-server origins.** The proxy listens on a loopback port per server by
  default. `proxy.bind: 0.0.0.0` publishes those origins on every interface and
  must sit behind a firewall or ACL. Prefer the tailnet address.
- **Embedded app.** Served on a different origin, so it cannot read the DSH
  session or another server's proxy. The proxy strips inbound browser cookies
  and upstream `Set-Cookie` and requires a grant session.
- **Third-party desktop plugins.** `dsh-better-sidebar`, `dsh-context`,
  `dshmarket` and `dskin` are separate code with their own licenses. The mobile
  gate only hides their UI; it does not disable their server-side code.

## Deployment rules

1. Do not expose DSH or the origin ports directly to the public internet.
2. Terminate TLS if the DSH page is HTTPS. Mixed-content iframes are blocked, and
   one certificate for the hub host covers its origin ports.
3. Restrict who can reach the DSH port and the origin ports with Tailscale ACLs.
4. Run behind a non-root user. Keep the DSH home and `server/.env` private
   (`600`); both contain credentials.
5. Keep every port and cookie on one host. The team cookie is bound to the
   endpoint authority, so changing the host or port invalidates it.
6. Review and pin third-party plugins. The desktop set in the release profile is
   tested; custom pins are not.

## Handling secrets in this repository

- Put the provider key in `server/.env` (mode 600). Docker Compose reads it
  automatically. Never pass it on a command line where shell history captures it,
  and never add it to a tracked file.
- Do not commit `.env`, `secrets.json`, cookies, keys, or logs. `.gitignore`
  covers the common names; it is not a substitute for checking.
- Run both gates before any push or publish:
  ```bash
  npm run check-release
  npm run check-secrets
  node scripts/check-secrets.mjs --history
  ```
- The release checker fails on credential-shaped strings and on host-identifying
  paths and addresses. History findings are reported separately: old commits are
  not fixed by editing the working tree.
- Publishing a repository exposes its full git history. If history ever held a
  real secret, rotate it **and** rewrite history (or publish a fresh repository
  with a single commit). Removing it in a later commit is not enough.

## If a secret leaks

1. Rotate it first; assume it is public.
   - Provider key: revoke and reissue it at the provider.
   - Container/DSH token: restart the container or DSH to mint a new token, then
     update the hub entry.
   - Team cookie: sign in again from the hub to replace the stored credential.
2. Remove it from the working tree, then from history if it was committed.
3. Check whether anything else in the same trust boundary shares that value.
4. Re-run `node scripts/check-secrets.mjs --history`.

## Reporting a vulnerability

Report privately through
[Security → Report a vulnerability](https://github.com/Chromadera/dsbot-Hub/security/advisories/new).
Do not open a public issue for a vulnerability or a leaked credential, and do not
include a live token in the report; a redacted example is enough.
