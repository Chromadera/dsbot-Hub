# dsbot-mobile-desktop-gate

A DSH web client plugin that hides desktop-only third-party plugin UI when the
shell is at 1024px or narrower:

- `dskin` pets, paw and palette (`VUpDDW_*`)
- `dsh-better-sidebar` workbench/toggles (`nArs4W_*`)
- **Context Insights** and **Plugin Market** entries

At 1025px and wider it does nothing. This is a UI gate; server-side plugin code
remains active for the whole process.
