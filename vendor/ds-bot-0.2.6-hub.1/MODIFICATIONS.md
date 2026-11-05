# DS-Bot 0.2.6 — DSBots Hub fork

Based on DS-Bot 0.2.6, Apache-2.0. This is a maintained fork for DSBots Hub;
it is not an upstream release.

## Preserved local patch

- Classic Agent surface is disabled; the DS Bot team is the only mode.
- A stored `agent` surface selection is ignored.

## UX changes

- Five quick reactions plus a blank + button that focuses a native emoji
  input; the OS keyboard controls whether it opens on the emoji tab.

- Touch long-press on any message, including your own, opens a bottom action sheet.
- Swipe a message to the right to start a reply.
- Sheet: 12 reactions, Reply, Mark as unread, Copy, Select Text,
  Copy Request ID. No Report action.
- Tapping a message no longer opens the three icon toolbar on touch.
- Desktop hover toolbar remains. Right-click opens the sheet.
- Reply shows a quote bar above the composer and sends the quote above
  the typed message using the DSH `setDraft` API. The bar is mounted in the
  composer flow and works on the live DSH composer without its overlay node.
- Tablet touch uses the same long-press path as phone.

## Maintenance

- Base: DS-Bot 0.2.6 package (`client.js` patched).
- No upstream rebase required for this fork.
- Keep LICENSE and NOTICE with any distributed build.

## Host reactions

- Host patch in `host-patch/` adds server-owned reactions, the bot `react` tool,
  and a pre-step reaction note so bots can see user reactions to their messages.
- Reaction keys are `<sessionId>:<message timestamp>`; user reactions cap at
  two, bot reactions at one per message.
