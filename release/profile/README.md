# Reference DSH profile

This directory is a template, not a replacement for an existing profile.

- `dsh-better-sidebar`, `dsh-context` and `dshmarket` are the desktop plugin set.
- `dsbot-mobile-desktop-gate` hides their desktop-only UI at 1024px and below.
- `dskin` is intentionally **not** included; install it separately if you want
  the pixel-cat skin.
- The hub is the only required bundle; the desktop plugins are optional.

Install from the release directory with `../install.sh`, or merge the
`dependencies` and `dsh.profile.bundles` entries into the profile you already
use. Do not copy the profile's `cordis.patch.yml` over an existing one; merge
the hub `proxy.bind` value into it.
