# Sharing sessions between DSH profiles

DSH profiles are isolated by `DSH_HOME`; two apps on the same PC do **not**
automatically share sessions. Each profile's JSONL persistence backend has a
configurable root:

```yaml
- id: session-persistence-jsonl
  config:
    root: /home/<user>/.dsh/sessions
```

Both profiles must use the same DSH **version**. Sharing a session store across
0.2.1 and 0.2.2 is not supported: 0.2.2 can read 0.2.1 logs, but the reverse
showed `Failed to load history: Cannot read properties of undefined
(reading 'send')` in testing. Use one DSH version as the writer.

## Single-app migration (the 3080 → 3081 pattern)

1. Stop the old app, or leave it read-only while verifying.
2. Back up **both** session stores and both profile patches.
3. Merge the secondary store into the primary with no overwrites:
   ```bash
   rsync -a --ignore-existing --exclude='session.lock' \
     "$OLD_HOME/sessions/" "$SHARED_HOME/sessions/"
   ```
4. Add the `root` override above to the remaining app's profile patch.
5. Restart DSH and open the session list.
6. Only then stop the old app.

The 3081 deployment now points at `/home/<user>/.dsh/sessions`, with the 3081
test sessions copied in and the original stores backed up.

## Attachments

Session logs reference attachment objects under:

```text
<DSH_HOME>/attachments/v1/
```

Sharing sessions without sharing attachments produces **Attachment object is
missing** when a message with an image/file is opened. Point the target
`<DSH_HOME>/attachments` at the source store (a symlink is enough when both
profiles run as the same user), or merge the two content-addressed trees. The
request-image cache under `attachments/request-images` / the XDG cache can be
rebuilt; do not confuse it with the durable v1 store.

## Workspace grouping

Sharing the session root only shares the logs. Workspace membership is a
separate Host registry in `storages/workspace.json`. If that registry is not
shared, imported sessions appear under **Ungrouped** even though their `cwd` is
correct.

Either:

- copy/merge the source profile's `workspace.json` into the target's
  `storages/workspace.json` while DSH is stopped, or
- add the workspace path in the target UI and keep it registered.

The registry contains workspace paths, ordered session membership, archived and
pinned ids. Back it up before editing; an invalid registry can drop groups.
The 3081 deployment now uses the 3080 workspace registry plus a **Mobile test**
group for the copied 3081 sessions.

## Toggle

To switch back, remove the `session-persistence-jsonl` override from the profile
patch and restart. Both stores remain on disk; no session files are deleted.
Do not run two DSH versions against the same root at the same time.
