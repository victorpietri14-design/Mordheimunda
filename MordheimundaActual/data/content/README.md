# Adding content

Prefer a new data pack in `data/packs/` for new factions, fighters, equipment, rules or supplements.

A pack should register itself through `registerNecroheimPack({ id, name, type, apply(catalog) { ... } })`.

Do not edit the application UI just to add data. Keep data in packs and UI logic in `assets/app.js`.

For larger future additions, split packs into one file per faction/supplement and load them from `index.html`.
