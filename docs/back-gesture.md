# Back gestures

The hub and the DS-Bot iframe share one back stack. Back peels exactly one layer
before DSH is allowed to navigate:

1. visible dialog/menu — its own close path
2. message reader
3. long-press action sheet
4. quote composer
5. hub server sheet / settings screen
6. DS-Bot details/settings screen with a stock Back or Close control
7. nothing left — the shell/browser may leave

## Implementation

- The hub owns the top-level `Navigation API` listener. On a `traverse`
  navigation with a layer present it calls `preventDefault()` and closes the top
  layer.
- DS-Bot posts `layer open/close` messages through `postMessage`; the hub keeps
  one layer per surface. Closing by UI removes the layer without a history walk.
- Stock DS-Bot Back/Close buttons register automatically as a screen layer.
- A left-edge right swipe invokes the same top-layer close in both the hub and
  the iframe.

This avoids the old sentinel-history behavior that could replace the hub with
the DSH landing page.

## Fallback

Browsers without the Navigation API use a `popstate` fallback. It closes the
top layer, but the browser may still commit the navigation; verify iOS Safari on
the target hardware. Android Chrome/Chromium is the primary path.

## Test matrix

- Android hardware back: sheet, reader, quote, hub settings, DS-Bot details.
- Left-edge swipe on the same layers.
- Add/edit server → list → hub.
- Two layers open: quote then sheet.
- No layer: back leaves the hub normally.
