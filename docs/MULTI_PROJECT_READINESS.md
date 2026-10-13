# Multi-project readiness (report only)

Written for the MVP Gap Upgrade, step 5. Nothing in this report has been changed in the code. It answers: **can Birdie Residences or Vooty Golf County be added as a second project from Settings without code changes?**

**Short answer:** a second project **that is also made of villas** can be added today from Settings, with only cosmetic issues. A project with a **different unit structure** (towers, floors and apartments; a golf course with holes and plots) cannot be modelled properly without code changes, because "villa" is built into the location model, the dashboards and the screens.

## 1. What is hard-coded to Imagine, Phase A or Phase B

| Where | What | Effect on a new project |
|---|---|---|
| `src/lib/constants.js` | `SEED_PHASE_A_VILLAS`, `SEED_PHASE_B_VILLAS` (A-01…, B-01…, B-05-06), `SEED_COMMON_LOCATIONS` ("Imagine Common Area", "Imagine Infrastructure"), `SEED_CONTRACTORS`, `SEED_CONTRACTOR_DEFAULTS`, `SEED_WORK_PACKAGES` | **None today.** No screen or function imports them (only `SEED_DISCIPLINES` is a plain list). They are dead data and a trap if someone later builds "Load standard lists" and loads Imagine's villas into another project. |
| `src/components/access/UsersPanel.jsx:116` | The invite dialog defaults to the project whose name matches `/imagine/i` | Cosmetic. Falls back to the first project. |
| `src/lib/workImportService.js:69-71` | The sample rows in the import template read "Imagine / B / B-01 / Plots 5 & 6" | Cosmetic, but a new project's staff will see Imagine's rows in their template. |
| `src/components/projects/ProjectDetail.jsx`, `PhaseDialog.jsx`, `ProjectDialog.jsx` | Placeholder text ("Add Phase A, Phase B", "e.g. Imagine Villas") | Cosmetic. |
| `src/components/admin/ExportPanel.jsx:130` | "Imagine records can be loaded…" | Cosmetic. |
| `base44/shared/villaResolve.ts:235` | A bare number ("Villa 7") is tried as `<phase code>-7` | Works for any project whose phases have a code and whose villas are written `<phase code>-<number>`. A project that writes villas differently falls through to "not found" (it reports, it never guesses). |
| Reference numbers (`base44/shared/taskRef.ts`) | `<project code>-<phase code>-0001` | Generic. A project without phases gets the prefix `<code>-GEN-`. |

No planned villa counts (60, 120…) are written into rules or screens; they are plain fields on Project and Phase.

## 2. Can a project with a different structure be added from Settings?

**Works without code (all configurable in Settings / Administration):**
- A new Project, its Phases, working calendar, holidays, stale thresholds and site location (S-01).
- Project members and roles.
- Disciplines. They are a company-wide list: a golf course can add "Greens", "Bunkers", "Cart paths" under Administration, and a project switches on the ones it uses. (Inspection checklists fall back to a generic list for a new code until an administrator writes one.)
- Contractors, default contractors per discipline and phase, work packages.
- Locations of the four existing types, and importing work lists against them.

**Does not work without code:**
- **Unit types.** `Location.location_type` is a fixed list (`Villa`, `Common Area`, `Infrastructure`, `Project-wide`) in the entity schema and `constants.js`. About 15 shared rule files and 54 places test `=== 'Villa'`. The villa matrix, the villa list, coverage, the pending-works statement, owner access, owner sign-off, floors/rooms, drawings, snags and the Today screen all treat "villa" as the only kind of unit.
- **Hierarchy deeper than Phase → Villa → Floor → Room.** There is no Tower or Block, no Hole or Plot grouping. Floors and rooms exist only under a Villa.
- **Words.** "Villa" appears about 735 times in screen text and in every message the server sends back.
- **Possession and handover.** Two states (`Handed Over` / `Not Handed Over`) and a single works-stage list. Apartment sales or golf memberships would need their own stages.
- **Phase B-style codes.** Villa codes are matched as `<letter>-<number>[-<number>]`. A numbering scheme such as `T2-1204` (tower 2, flat 1204) would be matched only by exact code, not by plot or by number.

## 3. Changes needed, ranked

**Small (hours each)**
1. Delete the unused `SEED_PHASE_*`, `SEED_COMMON_LOCATIONS`, `SEED_CONTRACTORS` and `SEED_CONTRACTOR_DEFAULTS` from the build, or move them to `docs/` as sample data. Avoids a wrong-project load.
2. Make the invite dialog default to the project the user is currently working in (the shared scope), not a name match.
3. Make the template sample rows and every "Imagine" / "Phase A" placeholder come from the chosen project (or be neutral).
4. Give a project without phases a clear message on import and on new-task screens, since the reference prefix expects one.

**Medium (days)**
5. A per-project **unit label**: a `unit_label` ("villa", "apartment", "plot") on Project, used in screen text, so the same screens read correctly. About 735 string sites; mostly mechanical, but they touch most pages and the server's messages.
6. Extend `location_type` to a configurable list (Villa, Apartment, Plot, Tower, Hole, Common Area…) and make each rule ask "is this a unit?" through one helper instead of `=== 'Villa'`. Changes the entity enum, the schema test, about 15 shared files and the villa-specific screens.
7. Per-project possession and works-stage vocabularies (for example Handed Over / Occupied / Sold), still mapped onto the two states the dashboards count.
8. A "Load starting lists" step in Settings (Disciplines, work packages, contractor defaults) that copies from a chosen project instead of from constants (S-02 / S-06 on the roadmap).

**Large (weeks)**
9. A real **location hierarchy** (parent location → child location, any depth) replacing Phase → Villa → Floor → Room. It changes the data model, the import resolver, the matrix, coverage, statements and every screen that groups by villa.
10. Cross-project views for a portfolio owner (today the scope is one project at a time; the Overview already accepts several, but the matrix, coverage and Today are per project).
11. Project templates (copy a whole setup) — S-06 on the roadmap.

## 4. Recommendation

- **Birdie Residences, if it is villas again:** go ahead after the small items 1–4. Nothing else blocks it.
- **Any project with towers, apartments or a golf layout:** do item 5 and 6 first (a few days), then decide on 9 only if the structure really is deeper than one level of units. Adding such a project before then will look wrong on most screens and will mislead the dashboards.
- Do none of this before the Imagine go-live is stable and the Supabase move is decided: items 6 and 9 change the data model, so they are cheaper to do once, after the cutover.
