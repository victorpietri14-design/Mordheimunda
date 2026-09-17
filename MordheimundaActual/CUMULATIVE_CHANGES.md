# Mordheimunda 26 — cumulative correction build

This build is based directly on MordheimundaActual.zip and explicitly includes:
- PWA manifest, icons, standalone mobile display, service worker.
- Mobile right-side warrior list converted to a dropdown; Band/Recrutement/Reserve/Post-battle tabs remain tabs.
- Mobile fighter stats use the available main column width more effectively.
- Equipment purchase primary CTA enlarged horizontally on desktop/tablet and full-width on phones.
- Cloud sync remains automatic through save queue, polling, focus/online/pagehide hooks; the Account button is manual recovery only.
- Stable browser URLs for Home, My Warbands, Create Warband, Rules, Reference, Custom, Account, and each Warband.
- Warband cards are real links, supporting normal right-click/Ctrl-click/Cmd-click and refresh persistence.
- Vercel deep-link rewrite added.


## FINAL MOBILE PASS
- Fighter stats kept on one compact single line on phones.
- Automatic cloud queue also flushes during polling while dirty.
- Asset/cache version bumped to v104.
