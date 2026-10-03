# Content packs

This is the preferred place to add new game content.

## Minimal pack

```js
registerNecroheimPack({
  id: 'my-supplement',
  name: 'My Supplement',
  type: 'supplement',
  compatibleFactions: ['undead'],
  apply(catalog) {
    // Add/extend catalog data here.
  }
});
```

Keep stable IDs once a pack is released. IDs are references in saved rosters and future cloud data.
