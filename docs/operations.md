# Operations

## Backup

Back up these separately; the hub does not contain DS Bot data.

- DSH home: `profiles/web/package.json`, `profiles/web/cordis.patch.yml`,
  credentials and sessions.
- Each DS Bot container's data volume.
- The hub server rows live in the profile patch; credentials live in the DSH
  credentials store.

Never commit cookie jars, DSH credentials or session logs.

## Restore

1. Restore the DSH home and credentials.
2. Restore each DS Bot volume to its own container.
3. Restart DSH, then hard-refresh.
4. Re-check the server endpoints and the origin ports; a moved machine or
   changed endpoint authority requires re-pasting the DS Bot login token.

## Uninstall

```bash
dsh plugin --profile web remove dsbot-hub
dsh plugin --profile web remove dsbot-mobile-desktop-gate
# optional desktop set
dsh plugin --profile web remove dsh-better-sidebar dsh-context dshmarket
```

Restart DSH. Removing the hub does not delete DS Bot data or DSH sessions.
Remove `proxy.bind`/server rows from the profile patch if you want a clean
config.

## Service

An example systemd user unit is in `../release/examples/dsh-web.service` in the
source tree, and in `examples/` in the release archive. Replace the tailnet IP
and paths, then:

```bash
systemctl --user daemon-reload
systemctl --user enable --now dsh-web
journalctl --user -u dsh-web -f
```

`setsid` is enough for a session, but systemd gives you boot persistence and a
clean restart command.

## Tailscale boundary

The DSH port and every per-server origin must be reachable by the phone. Use a
tailnet ACL restricted to your own devices/users for:

- the DSH web port
- the configured origin port range (default `13090–13199`)

Do not expose the origin ports to the public internet. The origins return 401
without a grant, but the grant is not a user account system.

## Token rotation

The DSH token is a bearer secret. If it leaks:

1. Restart/rotate the DSH browser-session secret through the supported DSH
   credential flow.
2. Re-open DSH with a fresh token URL.
3. Re-check that old browser cookies no longer work.

Restarting alone may not invalidate a stateless token.
