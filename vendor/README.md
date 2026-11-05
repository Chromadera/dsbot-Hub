# DS-Bot server fork

`ds-bot-0.2.6-hub.1/` and its tarball are the server-side DS-Bot package baked
into the DSBots Hub server image. This is not a hub client dependency and it is
not installed by the hub plugin itself.

- Base: DS-Bot 0.2.6, Apache-2.0.
- Preserves the local classic-Agent removal.
- Adds touch long-press message actions and quote reply.
- Keep `LICENSE` and `NOTICE` with any distributed image.

Rebuild the server image with this package; the hub remains the only
user-facing install.
