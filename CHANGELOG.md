# Changelog

## 0.11.13

- Add a shared hardware/edge back stack across the hub and DS-Bot iframe.
  Back closes the top layer (server sheet, settings screen, action sheet,
  quote, message reader, stock Back/Close screen) before DSH navigates, and
  keeps the hub and iframe alive.
- Hub settings now walks add/edit → list → parent instead of closing the whole
  overlay.
- Add left-edge swipe back parity for hub and iframe layers.
- Pair with DS Bot 0.2.6-hub.3: server-owned reactions, bot `react` tool,
  reaction-aware pre-step context, and the hub-safe back stack, plus the hub.3
  client fixes — the swipe-reply glyph now anchors to the thumb and the message
  edge (clear of the bot rail, bare symbol, no chip frame), the Select Text
  reader is a readonly textarea so a range selects reliably on touch, and the
  boot scene runs on the compositor so it no longer stalls while the panel
  iframe loads.
- Ship a verified install path: `preflight.sh`, `server/.env.example`, and a
  checksum manifest inside the release archive.
- Keep hub sessions across a restart: the grant/session signing key is persisted
  at `$DSH_HOME/dsbot-hub-session.key` (0600) instead of being regenerated per
  process, so restarting DSH no longer signs every open panel out.
- Mobile gate: stop hiding `dsh-better-sidebar` at small widths. Its CSS-module
  prefix covered the entire UI, so the old rule hid the whole plugin; now only
  the bottom workbench and its toggle are hidden up to 1024px. The sidebar
  itself works at every width because DSH opens the right sidebar fullscreen at
  or below 1024px.
- Add `scripts/check-secrets.mjs` and run it over the tree and git history in
  CI; extend `.gitignore` to env files, keys, cookie jars, and DSH state.
- Rewrite README and SETUP in English, Portuguese, and Chinese around the real
  install path, the login-token flow, and the bundled fork.
- Correct NOTICE and THIRD_PARTY to attribute the bundled DS Bot fork and its
  modifications.
- Document that DS Bot runs on any DSH-served model provider, not only OpenCode
  Go, and that the compose passes `server/.env` through instead of requiring one
  key name.
- Document running several local DS Bot servers behind one hub, including the
  reserved `13090`–`13199` browser-origin range.
- Build a portable release archive: normalized modes, `0/0` ownership, no
  symlinks or hardlinks, and no hardcoded container name, port or data paths.
  `DS_BOT_CONTAINER`, `DS_BOT_PORT`, `DS_BOT_DATA_DIR` and
  `DS_BOT_WORKSPACE_DIR` override the defaults in `server/.env`.

## 0.11.12

- Gate rail utility hover behind hover:hover/pointer:fine and add touch-active
  feedback, avoiding sticky hover after a tap.

## 0.11.11

- Quiet the last bright rail control: the account gear’s `.bt-you` chip
  background and inset ring are removed, leaving muted utility chrome.

## 0.11.10

- Fix the rail footer selector: plus/account are siblings of .bt-rail. They
  are now quiet transparent 44px controls, completing the mobile rail chrome
  cleanup.

## 0.11.9

- Unslop the mobile bot rail: quiet transparent collapse/plus/account chrome,
  reduce status badges to 8px semantic dots, and let the colored bot marks be
  the only bright elements. 44px targets remain.

## 0.11.8

- Settings forms: 4px field rhythm, 12px labels, 11.5px hints, 44px
  Advanced and Delete controls, 14px form buttons, plain “private browser
  address” copy instead of “proxy origin,” and clearer endpoint wording.

## 0.11.7

- Settings polish follow-up: mobile metadata is 11px and the reorder
  controls are 30px with a clearer default opacity.

## 0.11.6

- Unslop/Emil settings pass: labeled 44px host toggle, 44px back/edit
  controls, quiet reorder arrows, readable 11px server metadata, “Origin …”
  instead of the raw endpoint→origin arrow, and clearer settings copy.

## 0.11.5

- Unslop polish: 44px hub-bar hit areas, 36px chip with 44px hit area,
  sentence-case “DSBots Hub” subtitle with no tracking, 4px compact bot-list
  rhythm, and the open-in-tab secondary action hidden at phone widths.
  The dot grid remains as the boot-world signature.

## 0.11.4

- Fix the real bot-panel breakpoint bug: compact rail rules were global
  `.bt-row` selectors, so tablet/desktop widths also shrank the stock bot list
  rows. Every compact rule is now scoped to `.bt-rail`; the stock 701px+ bot
  list keeps its full names and descriptions.

## 0.11.3

- Explicit tablet bot rail: 190px with readable bot names at 701–1200px;
  compact 64px icon rail at ≤700px. No half-switched mobile/tablet rail and
  no clipped label remnants.

## 0.11.2

- Bot rail breakpoint: compact icon-only rail is now limited to phone/sidecard
  widths (≤700px). Tablet widths keep the stock rail instead of half-switching;
  compact mode hides clipped label remnants and prevents rail overflow.

## 0.11.1

- Add a localStorage boot-scene override for QA (`dsbot-hub:force-boot`),
  since the DSH login redirect strips query parameters.

## 0.11.0

- Port all five boot directors into the live overlay and choose one per
  server mount, with no immediate repeat. Scenes are 2.6–3.0s cycles so they
  settle inside the measured 3.4–6.0s first-message window; the overlay now
  waits for the first message instead of the shell.

## 0.10.7

- Bubble trail is now actually white: larger bubbles, full-opacity peak and
  a soft white halo, so it reads as bubbles rather than faint grey dots.

## 0.10.6

- Replace the mistaken gold star badges with the intended white bubble trail.
  Each porpoise now sheds four white bubbles during its leap, staggered with
  the wave; reduced motion keeps a static bubble cluster.

## 0.10.5

- Restore the avatar star signature that was dropped when extracting the
  whale SVG. Each porpoise now carries a gold star badge, with a leap-synced
  twinkle and a larger star on the lead whale.

## 0.10.4

- Boot overlay: replace the pod entrance with the Porpoise Wave. Five whales
  line up and porpoise left-to-right with 180ms phase offsets, arcing up and
  settling while the title lands. CSS-only and reduced-motion safe.

## 0.10.3

- Fix duplicate-key reconciliation that left the previous server iframe mounted
  beside the new one on mobile. The frame wrapper now carries the single key;
  only one server iframe is mounted at a time.

## 0.10.2

- Choreograph the whale pod: one lead whale rises first, four support
  whales enter as a non-uniform overlapping wave with an overshoot settle,
  the copy lands with the pod, then the pod shares a 3.6s breathing loop.
  The sequence replays on server switch and collapses under reduced motion.

## 0.10.1

- Whale pod now uses inline SVG masks instead of data-URI images, which the
  app CSP blocked; the colored whales render reliably.

## 0.10.0

- Boot animation: replace the pixel scene with a pod of the actual DS Bot
  whale avatar in five colors, gently bobbing and tilting at responsive
  positions; the ready/fade behavior is unchanged.

## 0.9.9

- Pixel DSBots Hub boot animation overlays the new server iframe, removing
  the white flash while DSH/DS Bot hydrates. The hub hides it on a ready
  postMessage from the iframe, with a load-event fallback.

## 0.9.8

- Restore the original horizontal tab strip for DS Bot Bot settings.
- Harness settings now uses the same horizontal tab language for its four
  sections instead of a native select/sheet, keeping the section content
  full-width below the tabs.

## 0.9.7

- Mobile-native settings audit: 44px section selectors and close controls,
  contained overscroll in the settings scrollers, safe-area bottom padding,
  and coarse-pointer cleanup of theme-tile hover transforms.

## 0.9.6

- Harness settings: move the Close control into the sheet header, remove the
  content lead-in gap, and keep the four-section picker full width.

## 0.9.5

- Harness settings on mobile: full-width sheet with a native four-section
  picker (General, Models, Built-in plugins, Agent presets) instead of the
  188px sidebar + 154px content desktop dialog. Content gets the full viewport
  and the close control moves to the header.
- Fix the 0.9.4 settings picker observer running before <body>; it now observes
  documentElement.

## 0.9.4

- Mobile settings: replace the 1,314px horizontal settings tab strip with a
  native section picker on screens up to 1024px. All 13 sections remain
  reachable, the close button no longer overlaps the tabs, and the control is
  theme-aware and 16px to avoid focus zoom.

## 0.9.3

- Mobile rail interaction polish: 120ms scale-on-press with a custom
  ease-out curve, visible focus rings, reduced-motion handling for avatar SVG
  animations, and 44px hit areas around the compact utility controls.
- Desktop rail remains at stock sizing.

## 0.9.2

- Gate fix: hide dskin by stable class suffixes after its build prefix changed;
  keep Context Insights/Plugin Market hidden on mobile.

- Compact the stock DS Bot mobile bot rail: 64px rail, 44px rows,
  32px object avatars, tighter list spacing and matching footer controls.
- Add release CSS regression assertion.

## 0.9.1

- Add the hub-bar **Toggle side panel** control for the native DSH right
  sidebar; the Session sidecard stays mounted beside global panels and collapses
  through its own controller on mobile Back.
- Keep the embedded chat header opaque on tablets and landscape phones
  (701–1024px), with a post-mount paint fallback.
- Raise the mobile server chip to a 44px touch target.
- Accessibility: focus trap/focus return for the switcher and settings, labels
  on icon controls, status in accessible names, status/alert roles, 24px reorder
  targets, reduced-motion handling, singular/plural bot counts.
- Add the distributable release profile, mobile desktop-UI gate, pinned desktop
  plugin versions, release check and CI.
- Harden the mobile back gesture (guarded history writes, reset of the leaving
  flag, commit-phase layer snapshot, no double-Escape unwind).

## 0.9.0

- Cross-origin per-server origins with grant-based iframe sessions and automatic
  origin allocation.
- Remove the path/host proxy and the WebSocket shim.
- Harden proxy auth, cookie stripping, headers, binding and endpoint prefixes.
- Restore and expand tests; rewrite docs and public package metadata.
