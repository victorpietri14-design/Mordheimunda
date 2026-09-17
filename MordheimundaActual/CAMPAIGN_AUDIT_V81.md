# V81 — Campaign / progression audit

## Applied
- Maximum Characteristics are now displayed on every base profile stat, using the race maximum calculator values already defined by the ruleset.
- Hero/Juve/Veteran characteristic advancements use the PDF's base XP cost each time; the PDF editor's optional escalating-cost note is not enabled.
- Henchman 2D6 advancements automatically reroll when every characteristic available for the rolled result is already at maximum.
- Lasting Injury table checked against Necroheim_M26 alt1.pdf.
- Critical Injury (61–65) now places the warrior in CRITICAL condition rather than incorrectly sending them directly to Recovery.
- Medical Escort resolves the PDF sequence: 2D6×10 GC, then D6: 1 death; 2–5 apply 51–56; 6 Recovery with no lasting effect.
- Reputation now dynamically controls Champion capacity: 2 + one Champion per full 10 Reputation.
- Recruitment enforces the campaign composition rule requiring at least as many Henchmen as other warriors when adding non-Henchmen (after the first warrior).
- Recruitment screen displays current Reputation, Champion allowance, and Henchman/other composition.

## Verified
- PDF source: Necroheim_M26 alt1.pdf.
- JavaScript syntax check passes with `node --check assets/app.js`.
