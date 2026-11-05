> **Historical note (0.9.0):** the hub no longer uses the same-origin path
> proxy or the DSH webserver host-scope patch. Each server is served on its own
> origin; treat proxy/path references below as superseded. The mobile-shell and
> layout sections remain the design of record. See the README and
> `docs/config.md`.

# Mobile and tablet layout

DSH 0.2.2-alpha.3 ships a real mobile presentation in `ui-layout`; the hub no
longer styles a desktop layout into place. Architecture, file map and host
changes: [mobile-architecture.md](mobile-architecture.md).

## Breakpoints

| Range | Presentation |
| --- | --- |
| `<= 700px` (phone) | Mobile shell. Bottom navigation 56px + safe area, full-width sessions sheet, full-viewport settings, full-frame panels. |
| `701–1024px` (tablet) | Mobile shell. Bounded nav cells centred in the bar, 420px sessions sheet, full-frame panels. |
| `>= 1025px` (desktop) | Unchanged three-column grid (sidebar 280px default, 56px rail when collapsed, right panel track). |

`MOBILE_MAX_WIDTH` and `MOBILE_PHONE_MAX_WIDTH` live in
`packages/client/ui-layout/src/client/mobile.ts`; the shell publishes
`html[data-dsh-shell="mobile"]` for surfaces that portal outside the frame.

## What gets the mobile presentation

- **DSH shell** — structural, not injected: `ShellFrame` selects `MobileFrame`
  at `<= 1024px`, which owns the bottom bar (`shell.mobile.nav`), the
  sessions/workspace sheet, the full-frame panel band and the compact chat
  header. Registrations: Chat and Sessions and More (`ui-sidebar`), Bots
  (`dsbot-hub`). Settings is reached from the More page's footer menu.
- **Hub panel** — registers `Servers` into the shell's bottom bar and drops its
  own Chat/Servers/Settings bar inside the mobile shell. The server chip opens
  the switcher sheet; settings and reload stay in the top bar.
- **DS Bot iframe** — the remote product's own UI under
  `/dsbot-hub/s/<id>/`; the path proxy injects its `bt-*` mobile rules (44px
  head, 36px pill, horizontal bot rail, 86% messages, 16px composer).
- **DS Bot pages served through the path proxy** — still receive the injected
  DSH-shell CSS: that surface runs the remote product's own frontend, so this
  is the only lever there.

The main DSH index is **not** patched with shell CSS any more
(`src/host/index.js`). The hub also no longer needs its per-server upgrade or
fallback routes to fight the gateway: the webserver scopes both by authority
again (`registerUpgrade({ host })`, `registerFallback(handler, { host })`).

## Clipboard on plain HTTP

DSH is served over plain HTTP on LAN/tailnet addresses, which is **not a secure
context**: `navigator.clipboard` is undefined there. The shell already falls
back to `execCommand('copy')`; the DS Bot (a separate DSH build) only uses the
async Clipboard API, so its message Copy buttons silently did nothing. The path
proxy now injects a `navigator.clipboard.writeText` fallback into the DS Bot
document when the API is missing (hidden textarea + `execCommand`, selection
restored). It needs the click's user activation, which is exactly when Copy
runs. On an HTTPS origin the real API is used instead.

## Safe areas and touch

- Bottom bar and sheets include `env(safe-area-inset-bottom)`; the hub top bar
  includes `env(safe-area-inset-top)`.
- The page is `100dvh` with no page scroll in the mobile shell, so the composer
  stays above the browser's collapsing chrome.
- Nav items keep a 44px minimum touch target; hover styling is gated on
  `(hover: hover)`.
- Text fields take a 16px floor under `(pointer: coarse)` so iOS Safari does
  not zoom on focus.

## Deployment status

The mobile shell is part of DSH **0.2.2-alpha.3+**. It is not present in the
0.2.1-rc.2 global frontend: a 0.2.1 install is desktop-only. The reference
deployment uses a source `0.2.2-alpha.3` checkout with a source-compatible
profile, so the phone gets the bottom navigation and the desktop gets the
three-column shell from the same server.

## Embedded bot rail

The stock DS Bot bot rail is an object-avatar rail. At phone widths the hub
compacts it to 64px with 44px rows and 32px marks; the SVG avatars and their
status badges are unchanged. Desktop widths keep the stock sizing.

Bot settings keeps the original horizontal tab strip. Harness settings uses the
same horizontal tab language for General, Models, Built-in plugins and Agent
presets; its content is full width below the tabs.

## Back gesture

DSH's shell uses a sentinel for its own shell-only layers and unwinds them on
`popstate`, innermost first. The hub and embedded DS-Bot use the shared
Navigation API stack in [back-gesture.md](back-gesture.md); do not add hub
layers to the shell sentinel: an open dialog or menu closes through its own
Escape ownership, then the right panel, then the tab page, then the selected
global panel, then the open Session (through the Session owner's
`closeSession`, back to the empty Chat). Each unwind re-arms the sentinel, so one back press consumes one
layer and the history length stays flat. With nothing open the handler continues
the traversal, so back from the home surface leaves the page like any browser
tab — without the sentinel a swipe from Bots went straight to `about:blank` and
looked like the app closing.

## Verifying a build

Start the source build (`pnpm dsh web --no-open --port <port>`), then:

```sh
node tools/mobile-audit.mjs "http://127.0.0.1:<port>/?token=..." shots \
  360,390,430,768,834,1024,1280 matrix
node tools/mobile-flows.mjs "http://127.0.0.1:<port>/?token=..." shots flow
```

Expected: `mode=mobile` through 1024, `mode=desktop` at 1280, `overflowX=false`
at every width, and screenshots for chat, sessions, settings, servers and the
desktop reference. Then the manual checks in
[views.md](views.md#checking-a-build): back gesture, copy, server re-pick, and
the Bots transcript loading rather than spinning.

A running DSH only serves the new frontend after a restart: the client graph
and the static `dist` are read at boot.
