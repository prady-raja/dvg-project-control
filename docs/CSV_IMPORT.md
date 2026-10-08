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