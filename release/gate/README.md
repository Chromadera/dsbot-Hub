# dsbot-mobile-desktop-gate

A DSH web client plugin that hides desktop-only third-party plugin UI when the
shell is at 1024px or narrower:

- `dskin` pets, paw and palette (`VUpDDW_*`)
- `dsh-better-sidebar`'s bottom workbench and its toggle (`bottomPanel`,
  `bottomResize`, `bottomClose`, `toggleButton`) up to 1024px. The sidebar itself
  is left alone at every width: DSH opens the right sidebar fullscreen at or
  below 1024px, so phones and tablets get the file tree, editor, git and previews
  in a full-width panel.
- **Context Insights** and **Plugin Market** entries

At 1025px and wider it does nothing. This is a UI gate; server-side plugin code
remains active for the whole process.
