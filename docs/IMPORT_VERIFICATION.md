# Import and reconciliation — verified behaviour, limits

This records what was actually exercised in the running application, so the
readiness statements in it can be trusted and the gaps are visible.

## What the importer does

1. A upload writes nothing. The file is read, every value resolved against the
   project's own registers, each row compared with the work already recorded, and
   the comparison is shown for review.
2. Only the rows a person decides on are written. An "import" decision creates a
   task; an "update" decision applies an agreed change through the same rules the
   task editor uses (permission, baseline lock, approval separation, a reason for
   every forecast revision, task history).
3. A missing task is never deleted, archived or completed because it is absent
   from a later file.

### Outcomes

CREATE NEW · UPDATE EXISTING · UNCHANGED · POSSIBLE DUPLICATE · CLARIFICATION REQUIRED.

Matching priority: the file's stated task reference, then the same row of the
same file imported before, then source reference, then same villa/floor/room with
discipline and wording, then a looser similarity offered as a candidate only.
Similarity alone never authorises an update.

### Provenance

Every created task carries the batch, source file, worksheet (`Works` for an
Excel workbook) and row number. The batch record carries the same plus the
per-row report. `Payments`, `Instructions` and other worksheets are ignored —
construction imports never carry payment milestones or invoice amounts.

### Never overwritten

- A blank cell proposes nothing, so a revised file cannot erase a recorded value.
- A task that has changed since the comparison was produced is refused, not written
  over: the review screen states the record version it compared, and the confirmed
  write checks it.
- A repeated confirmation of a file already applied writes nothing: rows that the
  register now reads as existing work are refused and asked for again rather than
  created a second time.

## Area labels

`base44/shared/areaLabels.ts` holds the standard labels (bedrooms, living and
entertainment, kitchen and dining, other interior, external and service) and the
site aliases for them (MBR → Master Bedroom, Sunken Lounge → Sunken Living,
Kids Room → Kids Bedroom, Staff Quarters → Servant Quarters, and so on).

The labels are vocabulary, not inventory. An import that names an unregistered
room keeps the original wording, imports the work with an unresolved scope, lists
it under Needs Attention, and is offered the standard label it reads as. No room
is created, no two rooms are merged, and a villa without that room is unaffected.

## Verified in the running application

Screen: Excel workbook read as worksheet `Works`, classification counts, review
table, confirmation gate, cancel writing nothing, Import Now completing, result
panel with batch, counts and per-row outcomes.

| Behaviour | Result |
|---|---|
| New tasks created from a workbook, correct records | pass |
| Tasks and batch stamped with worksheet, file and row | pass |
| Unregistered room: wording kept, scope unresolved, not widened to entire villa | pass |
| Plots 5 & 6 → one physical villa (B-05-06) | pass |
| Agreed change applied; task history written | pass |
| Forecast revision refused without a reason; accepted with one | pass |
| Approved baseline dates unchanged by an import | pass |
| Identical file again: nothing written, no new audit event | pass |
| Blank cells in a revised file erase nothing | pass |
| Cancel at the confirmation gate: no write | pass |
| Repeated confirmation: no duplicate task | pass |
| Comparison overtaken by a newer edit: refused, newer value kept | pass |

## Known limits

- Rows are written one at a time; there is no cross-row transaction. A failure
  part-way leaves the rows already written in place and reports them by row, so
  the outcome is always attributable and re-runnable without duplicating.
- OpenAI interpretation needs a funded account. With no credits the deterministic
  reading runs unchanged, the batch records that interpretation was unavailable,
  and nothing is retried.
- The preview can stop on a slow network; the uploaded file is re-readable and a
  repeated confirmation writes nothing twice.