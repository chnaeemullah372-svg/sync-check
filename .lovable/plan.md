# Designer & Member Generator Fixes

I'll fix each issue in this order so we can verify them one at a time instead of stacking changes.

## 1. Per-member photo upload — RLS error
**Symptom:** "new row violates row-level security policy" toast when uploading a photo for any member in a generated entry.

**Fix:** Inspect the table used for per-member uploads (likely `entry_member_assets` or a storage bucket policy) and add the missing `INSERT/UPDATE` policy + `GRANT` scoped to the entry owner (`auth.uid()`). This is a database migration — needs your approval before it runs.

## 2. PSD import — layers come in hidden / disabled
**Symptom:** After importing a PSD, every layer in the panel is hidden; you have to un-hide them one by one. Used to come in visible.

**Fix:** In `NewTemplateModal.tsx` the PSD walker pushes layers without a `visible` flag, and the designer route then defaults them to `visible: false`. Set `visible: true` on every imported layer (text + image). Background JPG layer stays as the page background.

## 3. Missing-font indicator on layer
**Symptom:** When a PSD font is missing, text silently swaps to a fallback and size sometimes shifts.

**Fix:**
- Persist `fontMissing` + `originalFontFamily` on the `TextLayer` (already captured during PSD parse, just needs to flow into the store).
- In `LayerPanel`, render a small ⚠ icon next to the layer name when `fontMissing === true`, with a tooltip "Font {originalFontFamily} not installed — using {fontFamily}". Same as Photoshop's missing-font indicator.
- Lock `fontSize` to the value parsed from the PSD transform (already done — verify it isn't being re-scaled by the substituted font's metrics by setting an explicit `line-height: 1` on the substituted run).

## 4. Member generator fields & layout
**Symptom:** Each member gets its own form/page; Father Name field is unwanted; 6 members rendered as 6 separate forms instead of one paginated table.

**Fix:** In the auto-generated member template (member-template.ts / FRC fallback layout):
- Field set per row: **Name, NIC, Birth Date, Relation** (drop Father Name).
- Pack up to 10 members per page in a single tabular block (already partially done — verify with 6-member entry that it stays on one page).
- Fix the stray "989 / Brother" overlap shown in your screenshot (a duplicated layer from `expandSingleSlotMemberLayers` shifting onto an existing row).

## 5. Background click-through (re-verify)
**Symptom:** With a full-page background selected, clicking text layers re-selects the background.

**Fix:** Already attempted previously. Re-test on the live preview after #2 lands; if still broken, mark the background layer as `locked: true` by default on PSD import so it can never become the click target.

## 6. Photoshop fonts coverage
The Google Fonts link already includes Inter, Roboto, Poppins, Montserrat, Playfair, Lora, Merriweather, Raleway, Nunito, Bebas Neue, Oswald, Anton, Pacifico, Caveat, Dancing Script, Noto Nastaliq Urdu, Noto Naskh Arabic, Amiri, Scheherazade New, Gulzar, Mirza, Aref Ruqaa, Reem Kufi, Markazi, Lateef, Vibes, Cairo, Tajawal, etc. Adding *every* Photoshop font isn't possible (most desktop fonts are licensed and not on Google Fonts — e.g. Jameel Noori Nastaleeq, Alvi Nastaleeq, Faiz Lahori). For those the missing-font icon from #3 is the correct behaviour.

If you have specific PSD font names you keep hitting, share 4–5 of them and I'll add the closest web-licensed match to the alias table.

## Order of work
1. Migration for #1 (needs your approval)
2. Code changes for #2, #3, #4, #5 in one batch
3. You retest each on mobile preview

Confirm and I'll start with the migration.
