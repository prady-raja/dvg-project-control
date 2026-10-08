# Phase 1 finalisation — verification, cleanup and handover

Date of record: 2026-10-08 (Asia/Kolkata). Reporting date used for every figure below: 2026-10-08.

This batch did not add modules. It verified the dashboards, planning engine, contractor
meeting tools, snagging register and AI framework already built, removed the test records
that batch created, and synchronised the repository.

---

## 1. Defects found and fixed

| Defect | Effect | Fix |
| --- | --- | --- |
| A dropdown option carried an empty value | The whole application crashed to a blank page — the executive dashboard, planning, the snag dialog and the AI update panel all stopped rendering | The no-selection option ("All phases", "Not assigned", "No blocker") now travels under an internal placeholder and is mapped back to an empty value, so every caller keeps its existing behaviour (`src/components/common/EnumSelect.jsx`) |
| Every dashboard opened on the first project alphabetically | All screens opened on "Birdie Residences — Vooty Golf County", a planning-stage project with no villas and no work, so every figure read zero | The project list is ordered with the project under execution first, which is then the default scope of every dashboard (`src/lib/CatalogContext.jsx`) |

## 2. How each figure is defined

One engine (`base44/shared/dashboardCore.ts`) defines these for every dashboard, planning
view and exported report:

* **Outstanding** — every task that is not Closed. Closed work is never outstanding.
* **Scheduled finish** — the current forecast finish, falling back to the approved baseline
  finish. Nothing else is treated as a date.
* **Overdue** — still to be executed (Not Started, In Progress, Blocked) with the finish date
  already passed. Work that is executed or under inspection is *awaiting verification*, never
  overdue.
* **Due today / tomorrow** — finish date equal to the reporting date / the following day.
* **7-day look-ahead** — finishes falling tomorrow through day 7 inclusive.
* **14-day look-ahead** — **finishes falling after day 7 through day 14 inclusive, so days
  8–14 only.** It sits beside the 7-day window and the two do not overlap; the tile, the
  planning tab and the exported report all use this one definition. A task finishing on day
  10 appears in the 14-day look-ahead and nowhere else.
* **Unscheduled** — outstanding work with neither a baseline nor a forecast finish.
* **Villa-work parent** — an assignment holder, never work. It is excluded from every count and
  only its children are counted, so parent and children are never double counted.
* **On-hold villa** — stays in inventory, but its work is held out of active execution figures
  and reported separately rather than hidden.
* **Site-wide work** — no villa attached; counted at project level and shown on its own screen.
* **Completion percentage** — produced only when *every* outstanding task in the set carries a
  measured progress value, weighted by estimated man-hours. Otherwise the answer is null and the
  screen shows status counts plus the measured coverage. No percentage is ever invented.

## 3. Verification results

| Check | Result |
| --- | --- |
| Executive dashboard, villa execution, contractor dashboard, planning, blockers, meetings, handover & snagging, site-wide, AI, administration and daily activity routes | Pass — every route rendered; the administration screen shows the AI assistant tab and the daily activity screen the natural-language panel |
| Project filter | Pass — Imagine Villas drives every screen |
| Phase filter, including clearing back to "All phases" | Pass |
| Summary figures open the records behind them | Pass — the overdue tile opened its task list |
| Task links open the task record | Pass — a row opened `/tasks/<id>` with the correct reference |
| Empty states | Pass — a villa with no outstanding work states it; the meeting screen asks for a contractor |
| Demo records held out by default | Pass — 15 records held out, stated on screen, and a labelled demo view for administrators |
| Phone width | Pass — no horizontal overflow on the dashboard at phone width |
| Console errors | Pass — none material; the remaining message is the preview tool's own inspector attribute on a React Fragment, not application code |
| Snag raised from the handover board against a villa | Pass — recorded with the next reference, linked to the villa and phase, raised-by stamped, and visible in the register and on the villa |
| Snag linked to a contractor | Not verified — the test snag was raised without a contractor because the field is optional and the automated run left it at its default |
| Site report reaching the villa dashboard | Pass — the report, its reporter and the measured progress appeared on the villa, and the villa completion stayed "Insufficient data" |
| Recorded dependency links on a villa | Pass — shown as recorded links on the villa holding the blocked task |
| Contractor meeting report generation | Not automatically verified — the run timed out while the report was loading; the payload itself was verified against records in the previous batch (scope, counts, outstanding by villa, blockers, pending decisions) |
| Recording and viewing a meeting commitment | Not automatically verified — the run timed out before the save; no commitment record was written |
| Revising a forecast date with a reason | Not automatically verified — the run timed out before the save; neither a new forecast date nor a reason was persisted |

## 4. Dashboard reconciliation

The server's figures were reconciled against the stored tasks for Imagine Villas with the
demo view on: open 14, overdue 2, blocked 2, awaiting verification 1, unscheduled 9, due within
7 days 1, due within 14 days 2, site-wide open 1, work on held villas 1, one villa-work
assignment holding 2 children. Every count equalled the value recomputed from the records.
Villa inventory: 26 registered villas, 25 active, 1 on hold, 9 handed over, 3 of them handed
over with open works (equal to the villas carrying outstanding work). Villa A-01 reported
completion "Insufficient data — measured progress exists for 1 of 4 outstanding tasks", with
per-task quantity progress (40/100 Sqm = 40%) shown instead of a headline percentage.

## 5. AI (OpenAI) status

The key is present and the configuration screen works: enable/disable, permitted roles, model,
daily request limit, records per request and standing instructions. Guardrails verified: an
inaccessible project is refused before any provider call; a failed request is logged and shown
to the user and does not consume the day's quota.

**The OpenAI account behind the key has no remaining credits**, so every provider call fails.
The application never fabricates an answer in that case: the question screen states the
provider error, and the natural-language update panel falls back to a clearly labelled
non-AI reading of the engineer's own words for the engineer to confirm. Any successful
provider-generated answer is **NOT TESTED** until billing is active.

## 6. Demonstration-data cleanup

Backup taken before any removal: `backups/phase1-backup-2026-10-08.json` (19 entities,
152 KB, taken 2026-10-08).

Removed (all labelled `DEMO-` or `TEST`, created by the verification batches only):
10 demonstration tasks, 3 snags (2 demonstration + 1 test snag), 2 demonstration dependency
links, 1 site report.

| Entity | Before | After |
| --- | --- | --- |
| Project | 2 | 2 |
| Phase | 2 | 2 |
| Location | 28 | 28 |
| Contractor | 8 | 8 |
| ContractorDefault | 9 | 9 |
| WorkPackage | 70 | 70 |
| Discipline | 12 | 12 |
| Task | 16 | 6 |
| TaskDependency | 2 | 0 |
| TaskHistory | 18 | 18 |
| ProjectMembership | 2 | 2 |
| DailyUpdate | 1 | 0 |
| Snag | 2 | 0 |
| MeetingCommitment | 0 | 0 |
| BaselineVersion | 0 | 0 |
| RefAllocation | 30 | 31 |
| ImportBatch | 2 | 2 |
| AiSettings | 0 | 0 |
| AiUsage | 2 | 2 |

Preserved: the six original demonstration fixtures (`IMG-A-0001`, `IMG-A-0002`, `IMG-A-0003`,
`IMG-B-0001`, `IMG-B-0002`, `IMG-GEN-0001`), left exactly as they were; every real project,
villa, plot relationship, contractor default and reference data; and all baseline versions.

Protected entries that must remain and are therefore excluded from operational reporting:

* **Ledger** — three snag references (`SN-A-0001`, `SN-A-0002`, `SN-A-0003`) stay consumed in
  the append-only allocation ledger even though the snags are gone. Their ledger rows are
  marked `TEST-ONLY` in the notes field.
* **Audit trail** — the change rows written for the deleted demonstration tasks remain in
  `TaskHistory` (append-only, deletion is refused by design). Their task references no longer
  exist, so they are orphaned test relationships: they are not shown on any dashboard, which
  reads live tasks only.
* **AI usage** — two rows recording the failed provider calls, audit only.

No orphaned commitment or forecast revision exists: the interrupted run did not persist either.

## 7. Security

Server-side permissions and audit protection were not weakened. Project scope comes from the
signed-in user's membership, mirrored onto records and enforced by row-level security; the AI
digest is built from the same engine as the dashboards and only for the permitted project; the
audit trail refuses all application writes.

Role-based checks still requiring a second authenticated user: a Site Engineer restricted to
their own project (figures, reports, AI briefs, snag raising), a Project Manager permitted to
revise forecasts and use AI only if their role is allowed, a Viewer refused every write, and
group access. These are listed with steps in `docs/PERMISSION_TEST_CHECKLIST.md`.

## 8. Observations for the next batch

1. **No production construction work is registered yet** — every task on Imagine Villas is a
   labelled demonstration record, so the operational views correctly read zero and state that
   the demonstration records are held out. That is the honest state before the real work list
   is imported, not a fault.
2. **The villa execution page lists the villa's own tasks, including labelled demonstration
   rows**, while project-level totals hold them out. The rows carry a DEMO marker, and the
   villa page is a record view rather than a management total — flag if they should be hidden
   there as well.
3. The AI assistant stays usable for configuration and role control with the provider
   unavailable; only answer generation is blocked.