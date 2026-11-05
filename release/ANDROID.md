# Android release check

Use the **DSH web URL**, not an origin port:

```text
http://<tailnet-ip>:<dsh-port>/?token=<token>
```

After the first load the session cookie should let the bare URL work.

## Checklist

- Bottom bar: **Chat · Sessions · Bots · More**
- Hub opens from **Bots**; server chip and switcher work
- Embedded team frame loads; no “unreachable” unless the server is down
- No pixel pets or better-sidebar workbench over the bottom bar
- **Context Insights** is absent from **More**
- **Plugin Market** is absent from Settings
- Composer stays above the keyboard and the bottom safe area
- Rotate to landscape: no horizontal page scroll, controls reachable
- Back gesture closes the sidecard, then the hub, then returns to Chat

Report the Android model, browser version and any screenshot of a failure.
