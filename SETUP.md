# DSBots Hub — agent setup runbook

<p>
  <strong>English</strong> ·
  <a href="SETUP.pt-BR.md">Português (Brasil)</a> ·
  <a href="SETUP.zh-CN.md">简体中文</a>
</p>

> **This file is an execution contract, not an introduction.** It is written so
> an operator can hand it to an AI agent with shell access, and the agent can
> install DSBots Hub one verified phase at a time. Read the whole file before
> running anything.

## Contract

1. Read this entire file first. Run the phases in order.
2. Ask the operator for every required input. Never invent a token, key,
   hostname, endpoint, container name, profile name, or path.
3. Never print, echo, log, or paste a secret. Capture it into a shell variable,
   use it, and report only whether it is set. If a command prints one by
   accident, do not repeat it.
4. Never write a secret to a tracked file. The provider key goes to
   `server/.env` with mode `600`; tokens stay in shell variables or the hub UI.
5. Do not install Docker, DSH, Node, or system packages without permission.
6. Do not restart a service unless the operator gave you the exact command
   (`DSH_RESTART_CMD`) or explicitly asked you to.
7. Do not delete a volume, container, profile, or backup. Rollback restores; it
   does not prune.
8. Stop at the first failed verification. Report the phase, the exact command,
   the exit code, and the output with secrets redacted.
9. The only server base image is `ghcr.io/fei2411/ds-bot:dev`. Do not pull other
   images or packages on your own.
10. Do not push an image, tag a release, change DNS, or open a port to the
    internet without explicit permission.
11. Setup success does not make a previously exposed credential safe. Tell the
    operator to rotate anything that may have leaked before this run.

## What must already exist (not bundled)

None of these ship in the archive. `preflight.sh` reports them; installing any of
them needs the operator's permission.

| Prerequisite | Needed for | Note |
|---|---|---|
| DSH 0.2.2-alpha.3+ with an existing web profile | the hub itself | The release installs a plugin into DSH; it does not install DSH |
| Node 24.9.0+ | preflight, packaging, the DSH host | `node --version` |
| Docker Engine + Compose plugin | the bundled server image | Not needed if you only point the hub at an existing DS Bot server |
| Network access to `ghcr.io` | pulling `ghcr.io/fei2411/ds-bot:dev` | Pre-pull it for an offline host |
| Network access to the npm registry | the pinned desktop plugins in `install.sh` | Skip with `WITH_DESKTOP=0` |
| A model provider account and key, or an existing DS Bot server | model access | Any provider DSH serves; OpenCode Go is only the default route |
| A browser | Phase 4 and the UI checks | There is no supported headless path |
| Optionally Tailscale/LAN + TLS | phone access | Not needed for same-host use |

## Inputs

Collect these before Phase 2. Use these exact variable names in every command.

| Variable | Required | Default | How to get it |
|---|---|---|---|
| `RELEASE_DIR` | yes | directory of `preflight.sh` | Operator tells you where the archive was unpacked |
| `DSH_PROFILE` | no | `web` | Operator's DSH profile name |
| `DSH_BIN` | no | `dsh` | Path to the DSH CLI if it is not on `PATH` |
| `DSH_RESTART_CMD` | no | empty | Operator-provided restart command; ask, do not guess |
| `DS_BOT_CONTAINER` | no | `ds-bot` | `docker ps --format '{{.Names}}'` |
| `DS_BOT_PROFILE` | no | `web` | Profile inside the container, normally `web` |
| `DS_BOT_ENDPOINT` | yes | `http://127.0.0.1:13081` | Where the hub dials the server; must match the published port |
| `SERVER_LABEL` | yes | none | Short human name, e.g. `Main` |
| `PROVIDER_KEY_ENV` | new server | `OPENCODE_GO_API_KEY` | Env var name the container's model route expects (`apiKeyEnv`) |
| `PROVIDER_API_KEY` | new server | none | The key value; it must not appear in your transcript |
| `HUB_PROXY_BIND` | phone only | `127.0.0.1` | Tailnet or LAN address the phone can reach |
| `PUBLIC_HOST` | phone only | none | Host the phone uses for the DSH URL |

If `DSH_RESTART_CMD` is empty, install and report the restart as a **manual
step**. Do not stop or kill the DSH process yourself.

## Phase 0 — preflight

```bash
cd "$RELEASE_DIR"
./preflight.sh
```

Expected: a list of `PASS` lines and `== summary: N passed, 0 warnings, 0 failed ==`.

- Any `FAIL`: stop and report it. Do not work around a missing dependency.
- A `WARN` about `server/.env` is expected before Phase 2A.
- If `preflight.sh` is missing, the archive is incomplete: stop.

Record the printed release directory; later phases assume you are still there.

## Phase 1 — verify the release

```bash
cd "$RELEASE_DIR"
sha256sum -c SHA256SUMS
```

Expected: every line ends in `OK`.

Then read the fork version without installing it:

```bash
tar -xOf ds-bot-0.2.6-hub.3.tgz package/package.json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))'
```

Expected: `0.2.6-hub.3`. Any other value: stop.

## Phase 2 — DS Bot server

Choose **one** branch. Ask the operator which applies.

### 2A. New server

Any provider DSH serves works here. The container's model route names the
environment variable it reads (`apiKeyEnv`); the bundled compose defaults to an
OpenCode Go route. Agree on `PROVIDER_KEY_ENV` with the operator before writing.

```bash
cp server/.env.example server/.env
chmod 600 server/.env
# One line per route. Write it without printing the value:
#   printf '%s=%s\n' "$PROVIDER_KEY_ENV" "$PROVIDER_API_KEY" > server/.env
grep -Eq '^[A-Z][A-Z0-9_]*_API_KEY=.+' server/.env && echo "provider key present"
```

Never grep a key without `-q`; that prints the value. Never run
`docker compose config` in a way that writes the resolved environment into the
transcript. If the operator uses another provider, its route must already exist
or be added first; see [docs/providers.md](docs/providers.md).

Start the server:

```bash
docker compose -f server/compose.yml up -d --build
```

If you set `DS_BOT_PORT` in `server/.env`, set `DS_BOT_ENDPOINT` to
`http://127.0.0.1:<port>` and use that value below.

Wait for the container and verify the versions. The retry covers the container's
first boot:

```bash
for _ in $(seq 1 30); do
  DATA_VERSION="$(docker exec "$DS_BOT_CONTAINER" node -p \
    "require('/data/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/package.json').version" 2>/dev/null)"
  TEMPLATE_VERSION="$(docker exec "$DS_BOT_CONTAINER" node -p \
    "require('/opt/dsh-template/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/package.json').version" 2>/dev/null)"
  if [ "$DATA_VERSION" = "0.2.6-hub.3" ] && [ "$TEMPLATE_VERSION" = "0.2.6-hub.3" ]; then break; fi
  sleep 2
done
printf 'data=%s template=%s\n' "$DATA_VERSION" "$TEMPLATE_VERSION"
```

Expected: `data=0.2.6-hub.3 template=0.2.6-hub.3`. Anything else after the retry:
stop and read the container logs.

### 2B. Existing server

Install the fork into the live data profile. The script creates its own
timestamped backup and restarts the container:

```bash
./server/install-existing.sh "$DS_BOT_CONTAINER" ds-bot-0.2.6-hub.3.tgz "$DS_BOT_PROFILE"
```

Capture the backup path it prints (`backup: /data/.../ds-bot.bak-<stamp>`) for
the report and for rollback. Verify the data-profile version as in 2A. The image
template is unchanged unless you rebuild it.

If the operator wants the image template upgraded as well, rebuild and recreate
from `server/` — never remove the data volume.

### 2C. Capture the login token

The container's `dsh web` line prints the token. It changes on every restart, so
capture it after the server is running — and again after any restart.

```bash
TOKEN=""
for _ in $(seq 1 60); do
  TOKEN="$(docker logs "$DS_BOT_CONTAINER" 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-)"
  if [ -n "$TOKEN" ]; then break; fi
  sleep 2
done
test -n "$TOKEN" && echo "token captured"
```

`echo "token captured"` prints a status, never the value.

### 2D. Additional local servers

Repeat Phase 2 for every server the operator wants. Each one is an independent
container with its own name, host port, data directory and token. Reuse the
image the compose build produced:

```bash
docker run -d --name dsbot-b \
  --restart unless-stopped \
  -p "127.0.0.1:${DS_BOT_PORT:-14001}:3080" \
  --env-file server/.env \
  -v /opt/dsbot-b/data:/data \
  -v /opt/dsbot-b/workspace:/workspace \
  dsbots/ds-bot:0.2.6-hub.3
```

Rules:

- Create the host directories first, owned by the container's `PUID`/`PGID`
  (default `1000:1000`).
- Keep host ports out of `13090`–`13199`; the hub allocates browser origins there.
- Use a separate `--env-file` when the second team uses another provider or key.
- Never mount one data volume in two containers.
- Capture each container's token with 2C, using its own `DS_BOT_CONTAINER`.

## Phase 3 — install the hub

```bash
cd "$RELEASE_DIR"
./install.sh "$DSH_PROFILE"
```

Hub and mobile gate only:

```bash
WITH_DESKTOP=0 ./install.sh "$DSH_PROFILE"
```

Verify the profile dependency:

```bash
"${DSH_BIN:-dsh}" plugin --profile "$DSH_PROFILE" list --depth 0 | grep dsbot-hub
```

Expected: a `dsbot-hub` row at `0.11.14`. If the CLI syntax differs on this
install, stop and ask for the profile path rather than editing the profile by
hand.

Then run `DSH_RESTART_CMD` if the operator gave one, and tell them to
hard-refresh. Otherwise report the restart as manual.

## Phase 4 — add the first server

This is normally a browser step: the hub uses a host-only grant cookie.

1. Open the DSH URL.
2. Choose **Bots** (mobile shell) or the **DS Bot Hub** sidebar panel.
3. Open the server chip → gear → **Add server**.
4. Enter `SERVER_LABEL`, `DS_BOT_ENDPOINT`, and the token captured in Phase 2C.
5. Save.
6. Confirm the selected server becomes `SERVER_LABEL` and its bots load.

Repeat steps 1–6 for every container, with a unique id, label and endpoint. Each
server has its own token; one being unreachable leaves the others switchable.

To hand the token over without printing it, the cleanest path is to let the
operator read it in their own terminal:

```bash
docker logs "$DS_BOT_CONTAINER" 2>&1 | grep -o 'token=[^ ]*' | tail -1 | cut -d= -f2-
```

If you already hold it in `$TOKEN`, paste it directly into the form you are
driving. If neither a browser nor a clipboard is available, stop at **manual
pending**. Never paste the token into chat to "help".

## Phase 5 — verify

Run these checks for each container:

```bash
docker ps --format '{{.Names}} {{.Image}} {{.Status}}' | grep "$DS_BOT_CONTAINER"

docker exec "$DS_BOT_CONTAINER" node -p \
  "require('/data/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/package.json').version"

docker exec "$DS_BOT_CONTAINER" sh -lc \
  "test -f /data/profiles/$DS_BOT_PROFILE/node_modules/ds-bot/src/host/reactions.js && echo reactions_present"
```

Expected: the expected image, `0.2.6-hub.3`, `reactions_present`.

In the hub UI, confirm:

- the server iframe loads and shows its bots;
- long-press opens the action sheet;
- Select Text opens the reader and back closes it;
- a reaction chip appears after adding a reaction;
- asking a bot what reaction you left returns it.

If you cannot check the UI, mark it **pending**; do not report complete setup.

## Phase 6 — phone and remote access

Only if the operator wants phone access. Ask for `PUBLIC_HOST` and
`HUB_PROXY_BIND`, then show the exact file and diff before editing:

```yaml
- id: dsbot-hub
  config:
    proxy:
      bind: <tailnet-or-lan-address>
```

Rules:

- `127.0.0.1` works only for a browser on the same host.
- `0.0.0.0` exposes the origin ports on every interface; require a firewall/ACL.
- The phone URL is the DSH web URL, not an origin port.
- If the DSH page is HTTPS, the origins must be HTTPS too.

Restart DSH with `DSH_RESTART_CMD`, then have the operator open the DSH URL on
the phone and choose **Bots**.

## Phase 7 — report

Return exactly this shape, with no secret values:

```text
Status: success | pending-manual | failed
Phase: <last completed phase>
Release: 0.11.14
DS Bot: 0.2.6-hub.3
Hub: 0.11.14
Server container: <name / image / status>
Data profile: <version>
Image template: <version>
Hub URL: <url>
Servers: <count and labels>
Phone bind: <address or not configured>
Manual steps remaining: <restart / hard refresh / add server / phone bind>
Secrets printed: no
Rollback backup: <path or none>
Failures: <none, or phase / command / exit code / redacted output>
```

Do not include a token, key, cookie, container environment, or `.env` contents.

## Phase 8 — rollback

Use this only after a failed verification, and only with operator approval.

Data profile — use the backup path captured in Phase 2B:

```bash
docker exec -u 0 -e PROFILE="$DS_BOT_PROFILE" -e BACKUP="<captured backup path>" \
  "$DS_BOT_CONTAINER" sh -ec '
    profile="/data/profiles/$PROFILE"
    test -d "$BACKUP"
    rm -rf "$profile/node_modules/ds-bot"
    mv "$BACKUP" "$profile/node_modules/ds-bot"
    chown -R node:node "$profile/node_modules/ds-bot"
  '
docker restart "$DS_BOT_CONTAINER"
```

Hub — reinstall the previous tarball into the same profile, then restart DSH:

```bash
"${DSH_BIN:-dsh}" plugin --profile "$DSH_PROFILE" add ./dsbot-hub-<previous>.tgz
```

Never delete the data volume, and never `docker compose down -v`.

## Stop conditions

Stop and ask the operator when:

- a required input is missing or ambiguous;
- preflight or a checksum fails;
- a version is not `0.11.14` / `0.2.6-hub.3`;
- the container is not running or logs show a startup error;
- a command would print or persist a secret;
- a restart, image push, DNS change, or deletion has not been authorized;
- a browser step is required but no browser is available.

## Appendix — secret handling

| Value | Safe handling |
|---|---|
| Provider key(s) | In `server/.env` (mode 600) under the route's `apiKeyEnv` name; never a CLI argument |
| Container login token | Shell variable; paste into the hub UI; never echo or commit |
| Team cookie | Lives in DSH credentials; never export it or copy it between machines |
| `.env`, `secrets.json`, cookies | Never open in a command whose output you print |

If a secret was printed anyway:

1. Say that it was exposed, without repeating it.
2. Tell the operator to rotate it (provider key: reissue; token: restart to mint
   a new one; cookie: paste a fresh token).
3. Do not continue the setup until the operator confirms rotation.

<p>
  <a href="README.md">README</a> ·
  <a href="SETUP.pt-BR.md">Português (Brasil)</a> ·
  <a href="SETUP.zh-CN.md">简体中文</a>
</p>
