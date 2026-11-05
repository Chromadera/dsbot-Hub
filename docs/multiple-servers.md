# Multiple local DS Bot servers

Each DS Bot container is an independent server. The hub treats it exactly like a
remote team: one endpoint, one origin, one cookie identity.

## Rule of thumb

```text
one container = one data volume = one endpoint port = one cookie
```

Do not run two containers against the same SQLite/data volume. DS Bot is
stateful; two writers will fight over locks and data.

## Ports

Use a unique **host** port per container. The internal port can stay the same.
Keep host ports out of `13090`–`13199`: the hub allocates its per-server browser
origins from that range, and a container sitting there will collide with them.

```text
dsbot-a  ->  127.0.0.1:13081  ->  /opt/ds-bot/data
dsbot-b  ->  127.0.0.1:14001  ->  /opt/dsbot-b/data
dsbot-c  ->  127.0.0.1:14002  ->  /opt/dsbot-c/data
```

`-p 127.0.0.1:<host-port>:3080` keeps the servers off the LAN; the hub dials
loopback and serves the browser side on its own origins.

## Run a second container

The bundled compose builds the image once. Reuse it with different values:

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p 127.0.0.1:14001:3080 \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.2
```

- `--env-file` can point at a different file when the second team uses another
  provider or key.
- Create `/opt/dsbot-b/{data,workspace}` first, owned by the `PUID`/`PGID` the
  container runs as (default `1000:1000`).
- Every container prints its own login token; capture it with the same command
  used for the first server.
- With the bundled compose, the same values are `DS_BOT_CONTAINER`,
  `DS_BOT_PORT`, `DS_BOT_DATA_DIR` and `DS_BOT_WORKSPACE_DIR` in `server/.env`;
  the compose file hardcodes none of them.
- To use compose for a second one, give it its own `.env` and run compose from a
  second directory. Never mount the same volume twice.

## Add each server

In the hub settings add:

- a unique **id** (lowercase slug)
- a label
- the endpoint, e.g. `http://127.0.0.1:14001`
- its own login token / cookie reference

Leave **origin** empty; the hub allocates one in `13090`–`13199`. Every server gets
a separate browser origin, so their cookies and local storage do not cross.

The hub config ends up with multiple rows:

```yaml
servers:
  - id: local-a
    label: Local A
    endpoint: http://127.0.0.1:13081
    cookieRef: DSBOT_LOCAL_A_COOKIE
  - id: local-b
    label: Local B
    endpoint: http://127.0.0.1:14001
    cookieRef: DSBOT_LOCAL_B_COOKIE
```

## Resources and failure behavior

- Each container has its own memory, model connections and WebSocket clients.
  Ports are cheap; RAM/CPU are not.
- One container being down only marks that server unreachable; the others remain
  switchable.
- Back up each data volume separately. A hub backup does not contain DS Bot
  conversations or memory.
- If the image hardcodes a public URL or base path, set the image's override or
  put a reverse proxy in front of it; the hub cannot rewrite the bot app's
  absolute URLs beyond the origin it serves.

## Same team, multiple containers?

That is a different problem. DS Bot is not designed as a cluster: separate
containers with separate volumes are separate teams. Replicas sharing one team
state are not supported by this hub.
