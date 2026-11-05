# Views: desktop and mobile

How the hub appears in DSH, from a desktop browser down to a 360px phone. Setup
itself lives in [Install](install.md); this page is the view contract and the
checks that keep it honest.

## Desktop (1025px and wider)

DSH renders its three-column frame. The hub is one entry in the sidebar's panel
list, and the panel takes the centre column:

```
┌────────────┬───────────────────────────────────────────────┐
│ DSH        │ ┌───────────────────────────────────────────┐ │
│ sidebar    │ │ ● Server chip  side  reload  open  gear   │ │  hub bar, 44px
│            │ ├──────────┬────────────────────────────────┤ │
│ ▸ Chat     │ │ bot rail │ DS Bot app (iframe)            │ │
│ ▸ Sessions │ │ 240px    │ team, chat, composer           │ │
│ ▸ Plugins  │ │          │                                │ │
│ ▸ Bots     │ │          │                                │ │
└────────────┴─┴──────────┴────────────────────────────────┴─┘
```

- The hub bar is the only chrome the hub adds: server chip (opens the switcher),
  side panel, reload, open-in-tab, settings.
- **Side panel** opens the current Session's DSH right sidebar (files, terminal,
  previews) beside the hub; on mobile it opens as the shell's full-frame right
  layer and Back collapses it. The hub panel itself does not replace that
  surface.
- Below it, everything is the DS Bot's own UI, served from that server's own
  origin. The bot rail is the DS Bot's, not the hub's.
- The hub's own pages — **Servers** (list, status, switcher order) and
  **Add/Edit server** — render inside the same panel; the DS Bot view returns
  when a server is chosen.
- Switching servers keeps each server's own thread: the frame is re-created
  only when the selected server changes or you press reload.
- Settings is an overlay over the live frame; opening or closing it does not
  reload the team app.

## Mobile (1024px and narrower)

DSH switches to its mobile shell: a content band over a persistent bottom bar
(**Chat · Sessions · Bots · More**). The hub is the **Bots** destination.

```
┌───────────────────────────────┐
│ ● Local · this PC  ⟳ ↗ ⚙     │  hub bar (44px)
├───────────────────────────────┤
│ ▣  │ Chief                   │  DS Bot rail (its own, 88px)
│ 🐳 │ …transcript…            │
│ +  │ Message Chief           │
├───────────────────────────────┤
│ Chat  Sessions  Bots  More    │  DSH bottom bar (56px + safe area)
└───────────────────────────────┘
```

- The hub does **not** render a second bottom bar inside the shell; Bots is one
  destination in DSH's bar. Tapping **Chat** returns to the DSH conversation
  without tearing the hub panel down.
- The server chip opens the switcher sheet. Picking the already-selected server
  is a no-op: it must not re-key the frame or restart the remote view.
- The DS Bot lays itself out for the narrow viewport. The origin proxy injects
  a small stylesheet only: an opaque chat header (the stock one is transparent
  and the transcript paints through it), a 16px input floor, wider bubbles/cards
  and per-card overflow guards. It does not rewrite the app's URLs or globals.
- The shell opts into `viewport-fit=cover` and reserves the top safe area; the
  bottom bar reserves its own. Test on a notched phone, not just a simulator.
- Back gesture: shell-only layers use the shell sentinel. Hub/DS-Bot layers use the shared Navigation API stack in [back-gesture.md](back-gesture.md) and unwind in-app first —
  an open overlay (dialog or menu) through its own close path, then the right
  panel, then a global panel (returning to the Sessions/More page it was opened
  from), then that tab page, then an open Session. With nothing open, back
  leaves the page immediately, as a browser tab normally would.
- Copy buttons work on plain HTTP: the origin proxy installs a
  `navigator.clipboard.writeText` fallback inside the DS Bot document (a secure
  context is not available on a tailnet IP). See
  [mobile.md](mobile.md#clipboard-on-plain-http).

## Checking a build

Open DSH at each width and confirm the mode line, then walk the destinations:

```
node tools/mobile-audit.mjs "<url>" shots 360,390,430,768,834,1024,1280 matrix
```

Expected: `mode=mobile` through 1024, `mode=desktop` at 1280, no horizontal
overflow, and the bottom bar present at every mobile width. Then, by hand:

1. **Chat** renders and the composer sits above the bar. Walk back through a
   chain — open Settings from More, then back: the dialog closes and More stays;
   back again returns to Chat; back again leaves the page.
2. **Sessions** and **More** are pages, not sheets; the bar stays visible.
3. **Bots** shows the server chip, the DS Bot transcript (history, not a
   spinner), and no second navigation bar.
4. Tap the chip and pick the current server: the view must not reload.
5. On a reply, **Copy** and paste it somewhere else.
6. **Settings** opens from the footer menu on the More page (currently two taps) as a full-frame sheet.

## Known limits

- The mobile shell is in DSH 0.2.2-alpha.3 (source checkout). A 0.2.1-rc.2
  install is desktop-only; see
  [mobile-architecture.md](mobile-architecture.md#8-deployment-status).
- The DS Bot iframe is the remote product's frontend; the origin proxy can
  adjust it with CSS and a clipboard fallback, not rebuild it.
