# Model providers

DS Bot does not require OpenCode Go. It runs on any model provider that DSH can
serve through its `@deepseek-ai/dsh-llm-pi-ai` adapter, plus hand-declared
OpenAI-compatible or Anthropic-Messages gateways. OpenCode Go is only the route
the bundled compose is written for.

This page covers the container that ships with the release. If you point the hub
at an existing DS Bot server, configure models there; the hub never touches them.

## How a route works

DSH's `llm-pi-ai` plugin has one `providers` map. Each key is a route name, and a
request selects one. A route has:

| Field | Meaning |
|---|---|
| `apiKeyEnv` | Name of the environment variable or DSH credential that holds the key. Omitting it defers to the provider's own ambient discovery |
| `baseURL` | Endpoint override; otherwise the provider catalog's |
| `api` | Wire protocol for a gateway the catalog does not describe (`openai-completions`, `openai-responses`, `anthropic-messages`) |
| `models` | Replaces the route's model list; a hand-declared gateway needs it |
| `modelOverrides` | Adjusts individual catalog models without replacing the list |
| `contextWindow` | Per-model capacity. DS Bot derives its context lines from it, so set it on custom models |

Installed catalog providers (OpenAI, Anthropic, Google, OpenRouter, DeepSeek and
others) supply endpoint, protocol and models automatically. A custom gateway
must declare `api`, `baseURL` and a non-empty `models` list.

## Where the container's profile lives

The compose file mounts `/opt/ds-bot/data` as `/data` (override with
`DS_BOT_DATA_DIR`). With the default, the profile is:

```text
host:      /opt/ds-bot/data/profiles/web/cordis.patch.yml
container: /data/profiles/web/cordis.patch.yml
```

Back it up before editing. The plugin row is usually named
`@deepseek-ai/dsh-llm-pi-ai`; use the id already present in your profile.
`docker exec ds-bot sh -lc 'cat /data/profiles/web/cordis.patch.yml'` shows it
without printing a key (the keys live in the environment, not this file).

## Add another provider

1. Put its key in `server/.env` under the name the route will reference:

   ```bash
   OPENAI_API_KEY=...
   ```

   Compose passes the whole file into the container; you do not edit the compose
   file to add a provider.

2. Add the route to the `providers` map of the `llm-pi-ai` row. For a catalog
   provider, `apiKeyEnv` is often the whole route:

   ```yaml
   providers:
     opencode-go:
       apiKeyEnv: OPENCODE_GO_API_KEY
     openai:
       apiKeyEnv: OPENAI_API_KEY
   ```

   The `opencode-go` entry above keeps the bundled default. **A `config:` block in
   a patch replaces the entry's whole config**, so if you set `providers:` you
   must restate every route you still want.

3. A gateway the catalog does not know needs its protocol, endpoint and models:

   ```yaml
   providers:
     acme-gateway:
       displayName: Acme Gateway
       api: openai-completions
       baseURL: https://gateway.acme.example/v1
       apiKeyEnv: ACME_GATEWAY_API_KEY
       models:
         - id: acme-think
           contextWindow: 262144
   ```

4. Restart the container and reopen the hub:

   ```bash
   docker restart ds-bot
   ```

5. In DS Bot, open a bot's details and pick one of the new models. A new team's
   first Main Bot opens on a model card until you pick one.

## Keep keys out of the profile

`apiKeyEnv` is a reference, not a value. Either export the variable (the bundled
compose does this from `server/.env`) or store the credential through DSH's
Models page; a stored credential for the same reference is enough, and then the
variable can stay unset.

Never write the key itself into `cordis.patch.yml` or a published profile.

## Common failures

| Symptom | Cause |
|---|---|
| `MISSING_CREDENTIAL` naming a route | No value for that route's `apiKeyEnv`; add it to `server/.env` and recreate the container |
| Model card is empty | The route's `models` list is empty, or the profile edit was not applied; restart and check the profile |
| `UNKNOWN_MODEL` | The bot still points at a model the route no longer serves; pick another |
| Images are rejected | Add `defaultInput: [ text, image ]` to the model, and use a provider that accepts images |
| Context feels short | Set `contextWindow` on the model; DS Bot's usable window is that value minus the reply reserve |

The authoritative field list is DSH's `packages/llm/llm-pi-ai/README.md`. DS Bot's
own "Models" section in its README explains how a bot picks and keeps a model.
