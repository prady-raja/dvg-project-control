# Location hierarchy, rooms and drawings

## The chain

Project → Phase → Physical Villa (Location) → Floor (VillaFloor) → Room/Area
(VillaArea) → Work Package → Task.

Site-wide and common-infrastructure work sits outside the chain: the task carries
no villa and `scope_type` is `Site-wide`.

## Physical villa

`Location.villa_code` is the permanent physical villa identifier — `A-10`,
`B-05-06`, `B-14A`. `Location.plot_numbers` keeps the original sales reference
separately, which is what makes a combined villa possible:

| Input written | Physical villa |
| --- | --- |
| Plot 5 / Plot 6 · Villas 5 and 6 | B-05-06 (one villa, one task) |
| Plot 7 / 8 / 9 · Villas 7, 8 and 9 | B-07-08-09 (one villa) |
| Plot 15 / Plot 16 | B-15-16 (one villa) |
| Plot 14A · Villa 14A | B-14A |
| Plot 14B | B-14B |
| Plot 14 (no letter) | asks whether 14A or 14B |

Resolution happens in one place, `base44/shared/villaResolve.ts`, and every path
uses it: manual tasks, the assistant, CSV import, multi-villa assignments, daily
reports and snags. A villa is never invented from a message, several references to
one villa collapse to one villa id, and where a plot number exists in both phases
the phase is asked for rather than assumed.

## Floors and rooms

`VillaFloor` holds `floor_code` (F1), `floor_name` (First Floor) and
`level_order`, left blank when unknown rather than guessed. `VillaArea` holds
`area_code`, `area_name`, `normalized_name` (the matching key), `aliases` (only
what has been approved, e.g. Main Bedroom for Master Bedroom), `source_name` (the
wording used in the uploaded document) and `area_type`.

Both carry stable internal ids. A task points at exactly one floor and any number
of rooms, so scope is stored, never inferred from a label:

| Scope | Stored as |
| --- | --- |
| Specific Room/Area | one room id |
| Multiple Rooms/Areas | several room ids on one task |
| Entire Floor | the floor id |
| Entire Villa | the villa only |
| Site-wide | no villa |

Two rooms with the same name in one villa are reported as ambiguous and asked
about — a similar name is never substituted for the right one.

A registered room that later disappears from a work list is not evidence that it
was not built: unresolved imported scope is flagged, never quietly widened.

## Drawings

`Drawing` is the register, one row per revision: title, type, revision, revision
date, the private `file_uri`, and the `supersedes_id` / `superseded_by_id` chain
with status Current or Superseded. Files are stored **privately** — no public URL,
so access follows project membership — and are retrieved through a short-lived
signed link. A drawing can be filed against a villa and a floor, which is how a
task is later traced back to the plan it was read from.

Uploading the actual Imagine plans, and any interactive plan reading, are
deliberately not part of Phase 1.