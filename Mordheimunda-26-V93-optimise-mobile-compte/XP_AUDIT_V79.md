# XP / Advancement audit — V79

- Official Crypt Ghouls are catalogued as `Henchman` and `Race (Ghoul)`.
- All official profiles classified as `Henchman` use the Henchman advancement table.
- Advancement role resolution now uses the source profile type first, so a stale saved `type: "Veteran"` cannot make an unpromoted Henchman use the Veteran table.
- A Henchman becomes a Veteran only when the explicit `veteran` promotion flag is true (for example after a 2/12 Henchman advancement roll).
- Existing rosters are repaired when the fighter sheet is opened: an unpromoted catalog Henchman saved with `type: "Veteran"` is restored to `type: "Henchman"`.
- The official catalog contains 74 fighter profiles; all 31 Henchman profiles are classified as Henchmen.
