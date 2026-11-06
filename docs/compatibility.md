# Compatibility

## Supported runtime

| Component | Version |
|---|---|
| DSH | **0.2.2-alpha.3+** (source checkout for the mobile shell) |
| Node | **>= 24.9.0** |
| ds-bot | 0.2.6-hub.3; routes `state`, `chat`, `send`, `earlier`, `react`, `reactions` |
| Browser | current Chromium/Safari/Firefox with ES2022 |

## Why 0.2.1 is desktop-only

The mobile shell (`MobileFrame`, bottom navigation, `shell.mobile.nav`) was
introduced in the 0.2.2 source line. The 0.2.1-rc.2 global install has no
mobile navigation shell. A 0.2.2 source CLI **cannot** compose the 0.2.1
profile's core plugins; the core packages are pinned to exact versions and the
`tools` service never activates. Use one runtime for the whole profile.

## Desktop plugin set

The release profile pins:

- `dsh-better-sidebar@0.28.0`
- `dsh-context@0.80.2`
- `dshmarket@1.73.10`
- optional `dskin` from `github:dancingmemory/dskin` (not on npm)

`dshmarket@1.66.14` cannot be installed cleanly on 0.2.2; its peer range rejects
the runtime. `1.73.10` is the tested release pin.

The desktop plugins are third-party projects with their own licenses and release
cadence. The versions above are the tested set. The mobile gate's selectors are
tied to these versions; re-test after upgrades.

## ds-bot

The hub consumes only the routes the stock DS Bot UI uses. It does not fork or
patch ds-bot, and it does not copy its data. A ds-bot version that changes those
routes is unsupported until the hub is updated.

The release archive also ships a separate fork, `ds-bot-0.2.6-hub.3`, which adds
server-owned reactions, the bot `react` tool and the shared back stack. It is a
server-side package baked into `dsbots/ds-bot:0.2.6-hub.3`, not a hub
dependency. The hub works with either the stock 0.2.6 package or the fork; the
reaction and back-gesture features need the fork.
