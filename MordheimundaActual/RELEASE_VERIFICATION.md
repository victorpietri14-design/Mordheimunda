Mordheimunda 26 — final cumulative release verification

Base: MordheimundaActual.zip original

Verified in this archive:
- Separate browser routes for Home, My Warbands, Create Warband, Rules, Reference, Custom, Account.
- Separate route for each warband: /warbands/<id>.
- Separate route for each fighter: /warbands/<id>/fighter/<instance>.
- Navigation uses real <a href> links with data-app-route, enabling browser new-tab/open-link actions.
- Deep-route fallback configured in vercel.json.
- PWA manifest + standalone display + service worker cache v102.
- Automatic cloud save (500ms debounce) and polling every 3 seconds while signed in, plus focus/online/pagehide handling.
- Manual account button is explicitly labelled as an emergency/force sync action.
- Purchase confirmation primary action is 305px minimum on desktop/tablet and full-width on small screens.
- On mobile, the right-side fighter list is replaced by a single select; the desktop chosen list is hidden.
- On mobile, fighter profile stats use a 7-column wrapped layout with larger cells and values for readability.
- On a warband/fighter route, the My Warbands navigation item stays highlighted.

## Mobile/sync patch 2026-09-17
- Mobile roster selector moved below gang tabs; desktop right rail remains.
- Mobile selector uses themed dark native styling with custom chevron; no white browser select.
- Mobile fighter profile uses 4-column stat grid for readable cards.
- Touch rule previews close when tapping outside and avoid hover auto-hide on coarse pointers.
- Cloud sync bootstraps from the session cookie even when local session metadata is missing.
- Local edits are marked cloudDirty and automatically retried with exponential backoff after transient sync failures.
- Successful sync clears cloudDirty and updates cloudRevision.
