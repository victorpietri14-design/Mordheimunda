# Race (X) audit — V77

The built-in warrior races were cross-checked against the source-PDF text embedded in `data/catalog.js` (`sourceFile: Necroheim_M26 alt1.pdf`) and spot-checked against public Mordheim references.

## Corrected entries
- Averland: Halfling Scout → Race (Halfling)
- Ostland: Ogre → Race (Ogre)
- Cult of the Possessed: The Possessed → Race (Possessed); Beastmen → Race (Beastman)
- Undead: Vampire → Race (Vampire); Grave Guard/Zombies/Skeleton Warriors/Dire Wolves → Race (Undead); Crypt Ghouls → Race (Ghoul); Necromancer/Dregs remain Human.
- Skaven: Assassin Adept, Apprentice Greyseer, Black Skaven, Night Runners, Clan Rats → Race (Skaven); Rat Ogre → Race (Rat Ogre).
- Orcs: Orc Boss, Shaman, Big Uns, Orc Yoofs, Orc Boyz → Race (Orc); Nasty Skulkers/Goblin Warriors → Race (Goblin); Troll → Race (Troll).
- Dwarf Clansmen: all listed warriors → Race (Dwarf).

The fighter race resolver now prefers the built-in catalog race over stale saved `race` values, so existing rosters are corrected automatically. `maxProfileFor()` also uses the corrected resolved race.
