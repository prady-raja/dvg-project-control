# Import Works — CSV work lists

How to bring a reviewed work list onto the task register without inventing,
duplicating or overwriting anything.

The screen is at **Import Works** and is available to a **Project Manager** or an
application administrator on that project. Both the screen and the server check
that role — the server decides it from the signed-in session, so the page cannot
be used to write into a project you do not manage.

## 1. Prepare the file

Excel work lists are cleaned, consolidated and saved as **CSV UTF-8** outside the
app. One row per task. The first row must be the header row; a row that is
entirely blank is ignored.

Download the template from the screen (or from this column list) and keep the
header names — they are matched loosely, so `Villa Code`, `villa code` and
`VILLA-CODE` all work:

| # | Column | Required | Notes |
| --- | --- | --- | --- |
| 1 | Project | No | Must be the project the import was started for. Another project's name is refused rather than guessed. |
| 2 | Phase | No | `A`, `Phase A`, `B`. A villa's own phase always wins and a disagreement is reported as a caution. |
| 3 | Villa/location code | For villa work | The registered code: `A-01`, `B-05-06`, `B-14A`. Original plot references (`Plot 8`, `B-08`) are matched only when they identify one villa; `B-14` matches two villas and is flagged for you to choose. |
| 4 | Work category | No | `Villa Work` or `Site-Wide Work`. Blank is inferred from the location. |
| 5 | Discipline | Yes | Discipline code or name (`CIVIL`, `Finishes`). |
| 6 | Work package | No | Standard packages are matched by name; anything else is imported as written and flagged. |
| 7 | Task description | Yes | Becomes the task name. |
| 8 | Contractor | No | A named contractor, otherwise the project default for that discipline and phase. If neither exists the task is imported without one and listed under “still needs information” — nothing is invented. |
| 9 | Responsible engineer | No | |
| 10 | Priority | No | `Low`, `Medium`, `High`, `Critical`. Blank → Medium. |
| 11 | Status | No | Register statuses. Blank → Not Started. |
| 12 | Baseline start | No | A **proposed** baseline — it is never locked or marked approved. |
| 13 | Baseline finish | No | |
| 14 | Forecast finish | No | |
| 15 | Progress percentage | No | 0–100. Blank stays blank; it is never turned into 0%. |
| 16 | Estimated man-hours | No | |
| 17 | Blocker description | No | If a blocker is described but the status is not `Blocked`, a caution is shown. |
| 18 | Remarks | No | |
| 19 | Source reference | No | Your own reference (Excel row id, contract item). Kept on the task and used to spot a repeat import. |

Dates are read as `YYYY-MM-DD`, `DD-MMM-YY`/`DD-MMM-YYYY` (14-Oct-26) or, when
written with slashes or dashes, day-first `DD/MM/YYYY`. Anything else is reported
as unreadable and must be corrected — it is never guessed.

Example row:

```
Imagine,A,A-01,Villa Work,FIN,Painting,Repaint bedroom ceilings,Hariom,,High,In Progress,2026-10-10,2026-10-20,,40,120,,,IMG-EXCEL-14
```

## 2. Preview and correct

Choosing the project and the file runs a preview. Nothing is written yet. The
preview summarises:

- total rows
- valid tasks
- possible duplicates
- invalid records
- villas needing a choice (the file's reference matched more than one villa)
- unmatched villas
- unmatched contractors
- missing and unknown disciplines
- rows without a contractor
- rows with a caution
- rows needing attention

Each row shows what it resolved to — villa, phase, discipline, contractor (marked
`default` when it came from the project's contractor defaults), status — and
either its blocking problems or its cautions.

**Fix** on a row opens its corrections: villa, discipline, work package,
contractor, status, priority, dates, progress, man-hours, description, remarks.
Applying sends them to the server, which re-checks and re-reports the row. A row
that still has a blocking problem cannot be imported — it must be corrected or
marked **Skip**.

For each possible duplicate the row offers **Skip**, **Import as new**, and
**Link** where the match is confirmed (same villa, discipline and description, or
the same source reference, or the same row of the same file). Linking creates no
task and changes no field on the existing one: it records an `Import Link` row in
that task's history and reports it in the batch.

## 3. Confirm

The footer shows `X tasks will be created · Y skipped · Z need attention · N
linked`. **Review and import** opens the confirmation, which states the same
sentence in full, requires the “I have reviewed these tasks” tick, and is blocked
while any row still needs attention. The server re-checks the whole file on
import and refuses it if anything is unresolved — so a stale screen cannot write
unreviewed rows.

## 4. After the import

The result shows the batch reference, the file, who ran it and when, then:

- rows in the file, created, skipped, linked, failed, reference corrections
- **Tasks by villa** and **Tasks by contractor**
- **Tasks that still need information** (no contractor, missing baseline dates or
  blank progress)
- **Skipped rows**, and any row that failed with the reason
- a **reconciliation report (CSV)** with one line per row: row number, outcome,
  task reference, description, villa, discipline, contractor, what is missing,
  the issues found and the note

Every created task carries its permanent reference, its import batch, source file
and row number, and a `Task Created` row in its history. Those fields are
server-owned: no screen can set or change them.

Re-importing the same file is warned about before anything is written (the file's
fingerprint is remembered per project), and rows already on the register come
back as duplicates to decide on.

## 5. What an import never does

- It never overwrites, merges or renumbers an existing task.
- It never fills in a value the file left blank, and never turns a blank progress
  into 0%.
- It never reuses a task reference: a number consumed by an import, a deletion or
  a correction stays consumed.
- It never applies a partly corrected row: rows with blocking problems stop until
  they are fixed or skipped.

## Added columns (all optional — the original template still works)

| Column | Accepted headings | Effect |
| --- | --- | --- |
| Floor | `floor`, `floor name` | Matched against the villa's registered floors (name or code). |
| Area/Room | `area`, `room`, `area/room`, `room name` | Matched against the villa's room register by `normalized_name` and approved aliases. Several rooms may be listed, separated by `, ; / \|`. |
| Scope type | `scope type`, `task scope`, `extent`, `coverage` | Overrides the derived scope. One of Specific Room/Area, Multiple Rooms/Areas, Entire Floor, Entire Villa, Site-wide. |
| Quantity / Unit | `quantity`, `planned quantity` / `unit`, `measurement unit`, `uom` | Planned quantity and its unit. |
| Acceptance criterion | `acceptance criterion`, `acceptance` | What must be true for the work to be accepted. |
| Responsible DVG coordinator | `responsible engineer`, `engineer`, `site engineer`, `responsible dvg coordinator`, `dvg coordinator`, `coordinator` | Stored as written — never guessed from a similar name. |

## A room that is named but not registered

When the file names a floor or a room that the villa's register does not hold, the
row is **not** converted into confirmed whole-villa work:

- the imported task keeps the original words in `source_location_text`,
- it is marked `scope_unresolved`,
- it is listed in **Needs Attention** as an unresolved location, and
- it never takes part in a villa-wide completion read by the AI assistant.

Blank floor and room columns stay a different thing entirely: the work is
genuinely whole-villa or unspecified, it imports without a flag, and it is not
reported as unresolved. A named-but-unregistered room and a deliberately blank
one therefore never look the same afterwards.

The row can be corrected before import through the row editor (choose the right
room), or afterwards by registering the room on the villa page and importing the
row again — the file's own wording is preserved either way.

## Plot references and combined villas

Villa resolution goes through `base44/shared/villaResolve.ts` for every path.
Within a phase, a plot reference resolves to the physical villa that carries it:
plots 5 and 6 are villa B-05-06, plots 7, 8 and 9 are B-07-08-09, plots 15 and 16
are B-15-16, and 14A / 14B are B-14A and B-14B. Several references to one villa
collapse to one task — a combined villa never produces a task per plot. Where a
plot number exists in both Phase A and Phase B and the phase is not stated, the
row asks for the phase instead of guessing; set the phase on the import (or on
the screen) and the same reference resolves directly.