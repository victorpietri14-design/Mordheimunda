Mordheimunda final verification — V107

Verified final build points:
- Warband page fighter cards keep stats on one horizontal row; XP is the last cell on the right.
- +/- XP controls are not rendered for roster-page fighter cards (rosterCard=true); detailed Fighter page keeps its own XP controls.
- Rule-reference text uses .rule-ref/.rule-ref-info and opens the compact rule peek.
- On touch devices, pointerdown is stopped before it reaches the draggable fighter-card handler; touchend explicitly opens the rule peek.
- Tapping outside the rule peek closes it.
- Rule peek is compact on mobile and does not cover the full screen.
- Route navigation uses history state and scroll restoration is manual; new non-anchor routes reset to top.
- PWA cache is versioned as mordheimunda-v107-0 and app.js is loaded as v107.0.
