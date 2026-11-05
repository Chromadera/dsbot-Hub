> **Historical note (0.9.0):** the hub no longer uses the same-origin path
> proxy or the DSH webserver host-scope patch. Each server is served on its own
> origin; treat proxy/path references below as superseded. The mobile-shell and
> layout sections remain the design of record. See the README and
> `docs/config.md`.

# Mobile architecture (DSH 0.2.2-alpha.3 + hub 0.9.0)

This is the structural mobile model for the DSH web app and the DS Bot hub.
It replaces the previous approach — media-query overrides injected into a
desktop layout — with a second presentation inside the shell.

## 1. One shell, two presentations

`packages/client/ui-layout` registers a single component into the runtime's
`root` slot (`ShellFrame`). It measures the frame box and selects:

| Frame width | Presentation | Owner |
|---|---|---|
| `<= 1024px` | Mobile navigation shell | `MobileFrame.tsx` |
| `> 1024px` | Three-column desktop grid | `AppFrame.tsx` |

Both presentations consume the same child slots (`sidebar`, `main`,
`rightbar`, `shell.overlay`, `shell.leading`, `shell.mobile.nav`), the same
layout store and the same locale seat. Occupants never learn which one is
mounted, so no feature package contains a width branch.

`ShellFrame` also writes `data-dsh-shell="mobile|desktop"` onto the document
element. Portalled surfaces (settings, menus, dialogs) cannot inherit the
frame's DOM context, so they follow the shell through that attribute — the
same mechanism as the existing `data-platform` markers. Plain CSS module
rules in the feature that owns a surface read it (for example the conversation
header in `ui-conversation`).

The old desktop frame keeps its narrow-width logic for the `> 1024` range it
still serves; the runtime no longer reaches its drawer below 1025.

## 2. Navigation model

```
┌───────────────────────────────┐
│ chat header / panel chrome    │   content band
│                               │
├───────────────────────────────┤
│  Chat   │  Servers  │ Settings│   bottom navigation (56px + safe area)
└───────────────────────────────┘
```

- **Content band** — the `main` keyed slot: the Conversation, or a selected
  global panel rendered full-frame. Only the shown occupant is visible, but the
  conversation and any mounted global panel stay mounted behind a tab page:
  unmounting them rebuilt iframe-backed panels and reloaded their remote app on
  every return. The band keeps one visible and one hidden occupant.
- **Bottom navigation** — one persistent bar owned by the mobile frame. Its
  entries are the `shell.mobile.nav` list slot. Each entry renders its own
  button, active state (`aria-current="page"`), accessible name and activation;
  the frame owns the bar's height, safe-area padding, separator, equal cells
  and the `--dsh-mobile-nav-height` metric. Entries registered today:
  - `Chat` — `ui-sidebar` (`MobileChatTab`), selects the Conversation.
  - `Servers` — `dsbot-hub` (`ServersTab`), selects the hub's main panel.
  - `Settings` — `ui-settings-general` (`MobileSettingsTab`), opens the
    settings sheet.
- **Sessions / workspace sheet** — the left column as a destination surface.
  It is the same `SidebarRoot` occupant (workspace picker, session list, panel
  navigation, settings foot), presented as a sheet over the content band:
  full-width at `<= 700px`, at most 420px on tablets. The sheet is driven by
  the layout store's `narrowExpanded` flag, opened by the floating
  `shell.leading` opener over the chat header, and closed by the scrim,
  Escape, or any destination selection.
- **Global panels** — Plugins, Automation tasks, the DS Bot hub. They render
  full-frame in the content band; the bottom bar stays as the way back, and the
  floating opener is omitted so it cannot land on the panel's own header.
- **Settings** — the existing `SettingsRoot` dialog, which already becomes a
  full-viewport, horizontally sectioned sheet below 768px.
- **Right column** — the panel occupant derives fullscreen from the frame
  width at `<= 1024px` and covers the content band; it keeps its own chrome and
  close affordance.

## 3. File map

| Concern | File |
|---|---|
| Presentation choice, shell attribute | `packages/client/ui-layout/src/client/ShellFrame.tsx` |
| Mobile shell, sheets, nav bar | `packages/client/ui-layout/src/client/MobileFrame.tsx` + `.module.css` |
| Desktop grid (unchanged > 1024) | `packages/client/ui-layout/src/client/AppFrame.tsx` + `.module.css` |
| Breakpoints | `packages/client/ui-layout/src/client/mobile.ts` |
| Store (sheet flag, panel selection) | `packages/client/ui-layout/src/client/stores.ts` |
| Frame measurement, shell attribute | `packages/client/ui-layout/src/client/frame-measure.ts` |
| Slot declarations, root registration | `packages/client/ui-layout/src/client/index.ts` |
| Nav item primitive | `packages/client/ui-primitives/src/MobileNavItem.tsx` |
| Chat destination | `packages/client/ui-sidebar/src/client/MobileChatTab.tsx` |
| Settings destination | `packages/client/ui-settings-general/src/client/MobileSettingsTab.tsx` |
| Compact mobile chat header | `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css` |
| Viewport, `dvh`, no page scroll | `packages/client/web/src/base.css` |
| Hub destination + panel | `dsbot-hub/client.js` |
| Iframe CSS, clipboard fallback, URL shim | `dsbot-hub/src/host/path.js` |
| Upgrade forwarding (prefixed mux) | `dsbot-hub/src/host/{proxy,index}.js` |
| Hub host (no shell CSS injection) | `dsbot-hub/src/host/index.js` |

## 4. Host changes required by the hub

The hub serves each DS Bot origin on its own authority (host) beside the DSH
webserver on the same port. Two host APIs lost their authority scoping in
0.2.2, which made hub 0.8.3 fail to boot (`duplicate upgrade route`,
`fallback already registered`). Both are restored in
`packages/host/webserver/src/index.ts`:

- `registerUpgrade({ path, host, handler })` — routes are keyed by
  `(authority, path)`; a host-scoped route composes with a hostless route on
  the same path, and dispatch prefers the matching authority.
- `registerFallback(fallback, { host })` — one fallback per authority; the
  hostless seat answers every other authority.

Tests: `packages/host/webserver/tests/webserver.spec.ts` covers both scoping
rules (matching authority, other authority falling through, duplicates
rejected, disposal releasing the seat).

## 5. Hub integration

Inside the mobile shell the hub contributes `Servers` to the bottom bar and
renders its DS Bot view in the content band:

- The hub reads `html[data-dsh-shell]` and, on mobile, suppresses its own
  bottom bar (the previous Chat/Servers/Settings bar) so there is one
  navigation model.
- The top bar keeps the server chip (opens the server switcher sheet), reload,
  open-in-tab and settings.
- The DS Bot surface itself is the remote product in an iframe under
  `/dsbot-hub/s/<id>/`; the path proxy still injects the DS Bot's own mobile
  styles (`bt-*`) because that frontend is not built from this source tree.
- The hub no longer injects DSH-shell CSS (`_sidebarCol` and friends) into the
  main DSH index. That injection fought the new grid; `src/host/index.js` drops
  `tapIndex(injectMobileCss)` and the proxied DS Bot pages keep it.
- The proxied DS Bot pages get only non-layout adjustments from the hub: a 16px
  input floor, a `clip-path` on the conversation body so its scroll content
  cannot paint over the app's own sticky header, and a
  `navigator.clipboard.writeText` fallback for plain-HTTP origins. Layout rules
  the hub used to inject (a 49px sidebar, a rail below the fold) were removed —
  they fought the DS Bot's own narrow-viewport solve.
- The DSH mobile shell has a sentinel for shell-only layers. Hub/DS-Bot layers use the Navigation API stack in [back-gesture.md](back-gesture.md): back closes an open dialog or
  menu through its own Escape ownership, then the right panel, then the tab
  page, then the selected panel, then the open Session (the sidebar registers
  `uiWorkspace.closeSession` as the app-level handler, so a conversation is
  left for the empty Chat rather than the page), re-arming after each unwind so
  the history length stays flat. From the home surface the same handler continues out of the
  page instead of stopping on the duplicate entry.

## 6. Verification protocol

`tools/mobile-audit.mjs` (repo-external harness) loads the running app in
Chromium at 360, 390, 430, 768, 834, 1024 and 1280 CSS px with touch emulation
for the mobile widths, then records:

- `html[data-dsh-shell]` (presentation actually selected),
- `scrollWidth` vs `innerWidth` (horizontal overflow),
- geometry of the frame, nav bar, sheet and composer,
- console/page errors.

`tools/mobile-flows.mjs` captures the interaction surfaces: a completed chat
turn, the sessions sheet, the settings sheet, the Servers destination and the
desktop reference.

Results on the 0.2.2-alpha.3 build: seven widths, `mode=mobile` at 360/390/430/
768/834/1024 and `mode=desktop` at 1280, `overflowX=false` at every width, no
console errors, bottom navigation present at every mobile width.

## 7. Local DS Bot customisations

The verification instance's DS Bot (`.local-dsbot`) carries two local changes
that are not part of the hub product:

- **Classic agent disabled.** `ds-bot/client.js` forces the bot surface
  (`readMode` always returns `bot`) and drops the "Switch to classic Agent mode"
  menu row and Settings section. Backup next to it:
  `client.js.bak-classic-agent-*`. A plugin update replaces this file.
- **Model.** Provider `opencode-go` (API key entered through the app's own
  Models → Add a provider flow) and Chief set to `DeepSeek V4.1 Flash`. Stored in
  `home/bot/state.json` as `model: "opencode-go/deepseek-v4.1-flash"`; no profile
  edit was needed.

## 8. Deployment status

The supported frontend is **DSH 0.2.2-alpha.3+** from source. The 0.2.1-rc.2
global install has no mobile navigation shell. Do not mix a 0.2.2 source CLI
with 0.2.1 profile plugins: the core services are pinned to exact versions and
will not activate. The reference deployment uses a source-compatible profile
and a clean `DSH_HOME`.

## 9. Limitations

- `shell.bottom` is a desktop band; the mobile shell does not render it.
- The mobile shell has no landscape-specific layout: a phone in landscape gets
  the same stack, which leaves little vertical room for chat.
- The DS Bot iframe is a remote frontend; its mobile behaviour is CSS plus the
  remote product's own responsiveness, not a shell built here.
- Tablet sheets are 420px, not a persistent rail; wide tablets could carry a
  rail in a later iteration.
