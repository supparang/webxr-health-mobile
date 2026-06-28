EAP Hero v1z87 — Boss Safe Array Fix

Replace index.html and eap-hero.js in:
eap-hero-save-society-v1/

Fix:
- Prevents Boss result crash when migrated/legacy state lacks fun.titles, fun.chests, cards, or badges arrays.
- Normalizes these structures before using .includes() or .push().
- Keeps the existing v1z86 content and version guard behavior.

Open:
index.html?x=v1z87
