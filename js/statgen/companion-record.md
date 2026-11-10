# Character sheet and Companion record (v1)

`StatGenUi.getSheetExport()` returns `{state, sheet}`. The download adds `fileType: "scheda"` and `siteVersion`. Keep this file type for compatibility with existing exports; it is not a `statgen` save file. `state` contains generator selections, and `sheet` contains name, species, background, class/subclass, ability scores, HP, AC, saves, proficient skills, and cantrips/1st-level spells.

`createCompanionRecord(exported, klass, id)` preserves all original fields and adds `companionVersion: 1` and `companion`. The 5etools class data provides saving throw proficiencies, which cannot reliably be inferred from the sheet's numeric bonuses. `companion` holds the ID, level, scores, proficiencies, current HP/AC, spells, notes, and log. The original `state` and `sheet` remain an initial snapshot; do not use them to overwrite an advanced character.

The Companion page loads unmodified PHB/TCE class data, the PHB multiclass slot table, and PHB/TCE spells. Character creation can generate a random level 1–20 single-class character; above level 1 it applies fixed HP, subclass, +2 ASIs, and spell slots. Features, resources, and higher-level spells remain manual.

`companion.html` imports `scheda` files, `companion-backup` files, and legacy `{version: 1, characters}` backups from `app/`. Export and keep a copy of the legacy backup before migrating. Incompatible characters are rejected without changing the original file. Do not remove `app/` until each real character has been checked in Companion and the PDF. The English 2014 PDF uses current Companion state, not the initial snapshot; text and checkboxes remain editable. Its `SlotsRemaining` fields are labeled “SLOTS EXPENDED” and receive spent slots. Excess spells and multiclass pact slots are reported when downloading.

Legacy backups with current HP above the computed maximum retain their original HP and display a warning. If browser storage contains unreadable data, download its raw copy before replacing it with an imported backup.
