# Host reaction patch

Apply these files over `ds-bot@0.2.6-hub.1` in the DS Bot container:

- `index.js` → package root
- `src/host/reactions.js` → new module
- `src/host/store.js` → state.reactions
- `src/host/channel.js` → `reactions` / `react` endpoints

Reaction keys are `<sessionId>:<message timestamp>`. User reactions are capped
at two and replace the most recent; bot reactions are one per message. The
`react` tool is offered to bots and a pre-step snapshot tells them which
reactions the user left on their messages.
