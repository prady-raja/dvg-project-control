# Phase 1 final batch — test report

Date: 8 October 2026 · Scope: integration, user management and production-data
readiness, before the real Imagine work lists and drawings are loaded.

## Verdict per area

| Area | Required verification | Status |
| --- | --- | --- |
| User provisioning | Six genuine user identities, or a clear Pending Setup status | **PARTIAL** — the existing admin account is Active; the five staff accounts are Pending Setup because the platform invites by real email address and no staff addresses were provided. The invitation workflow is built and ready (Administration → Users & access → Invite user). |
| Staff permissions | Five equal Project Editor levels | **PASS (design)** — one level, Project Editor, carries every operational right; no job designation is read by any permission check. **NOT TESTED** with five live accounts. |
| Admin isolation | Staff cannot manage users or configuration | **PASS (code)** — membership writes and company-wide lists/AI settings/project create-delete are administrator-only in `saveRecord`, and the membership entities refuse non-admin writes at the database level. **NOT TESTED** with a live staff account. |
| User login | Real authenticated sessions | **PARTIAL** — the administrator's own session is tested throughout. Staff sign-ins: **NOT TESTED** (accounts not yet invited). |
| Phase B mapping | All combined and split plot scenarios | **PASS** — verified through the live assistant: "Plots 5 and 6" → B-05-06 once; "Villas 7, 8 and 9" → B-07-08-09; "Plots 15 and 16" → B-15-16; "Villa 14A" → B-14A; "Plot 14B" → B-14B; "Plot 14" → asks 14A or 14B; "Villa 5" with no phase → asks A-05 or B-05-06. |
| Room-level scope | Specific, multiple, floor-wide, villa-wide | **PASS for specific-room scope** — a task created against floor + room stored "Specific Room/Area · First Floor · Kitchen"; a room-specific message updated only that task and did not touch the bedroom task; a villa message with no room named asked which area. Multiple-room / floor-wide / villa-wide derive from the same stored scope. |
| AI Site Assistant | Interpretation, correction, confirmation, saving | **PARTIAL** — the rule-based path is verified end to end (resolution, candidate tasks, questions, proposals, no writes before confirmation). A defect that made **every** assistant call fail (a value used before it was defined) was found and fixed, then re-verified. Genuine model interpretation: **NOT TESTED** (provider credits, below). |
| Confirmation recovery | Replays, stale proposals, partial failures | **PASS (code) + PARTIAL (run)** — a repeated confirmation returns the stored proposal instead of applying again (verified in an earlier batch), a proposal whose task changed after review is refused, and per-action results are recorded. Stale/partial paths in this batch: **NOT TESTED**. |
| CSV importer | Existing and extended templates | **PARTIAL** — earlier batches verified the existing template, refused unresolvable rows and warned on unregistered rooms. New columns (Floor, Area/Room, Scope type, Quantity, Unit, Acceptance criterion, Responsible DVG coordinator) and the unresolved-location flag are implemented and documented, but a CSV run using them: **NOT TESTED** this batch. |
| Needs Attention | Correct data-quality calculations | **PASS (earlier in this batch)** — 6 tasks reviewed, 1 invalid, 30 incomplete, 31 flags, each flag explained. |
| Daily reports | Progress, manpower, blockers, audit | **PASS (earlier in this batch)** — status, progress, manpower and blocker moved on the task; one report recorded; 10 audit rows; approval recorded with approver and time. |
| Contractor commitments | Save and retrieval | **NOT TESTED** this batch (unchanged since the batch that built them). |
| Forecast revisions | Mandatory reason and history | **NOT TESTED** this batch (mandatory reason is enforced in the existing protected workflow). |
| Drawing register | Upload, privacy, retrieval, revisions | **NOT TESTED** this batch (built earlier: private storage, revision chain, signed retrieval). |
| Management dashboards | Accurate counts and links | **PASS (earlier in this batch)** — executive and attention views returned calculated figures; no fabricated completion percentages. |
| OpenAI integration | Real provider test or documented limitation | **PASS (diagnosis)** — the key is configured and the request reaches OpenAI, which answers **HTTP 429 "You have no credits remaining"**. Genuine model interpretation is therefore **NOT TESTED**. Base44's own included AI was tested from this app and answered successfully; it has **not** been switched on. |
| Mobile interface | All main workflows | **PARTIAL** — Users & access, the AI assistant and the task register were opened at 420 px: all render, no sideways scroll. Remaining screens: **NOT TESTED** this batch. |
| Migration export | All entities and new relationships | **PASS** — VillaFloor, VillaArea, Drawing and AiProposal are exportable; VillaArea and AiProposal exports were run successfully, and the export refuses non-administrators. |
| GitHub | Final commit confirmed | **PARTIAL** — the repository `prady-raja/dvg-project-control` is connected and the platform commits and pushes file changes automatically; latest commit observed **6f5b27a "File changes"** (previous: 4122091). Shell-level git writes are blocked by the platform, so the final hash for this batch is the one produced when the batch is saved. |

## What was implemented in this batch

1. **Project Editor** — the single operational permission level, added to the
   membership roles, the server permission engine and the interface. All
   operational gates now pass for it; membership management no longer belongs to
   any project role.
2. **Administration → Users & access** — invite a user (email, name, designation,
   project, level), edit a designation in place, see status (Active / Pending
   Setup), request a password reset, and add or switch off project membership.
   Project Editors see it read-only; the server refuses their writes.
3. **Job designations** are labels on the user profile and never grant access.
4. **Phase B mapping hardened** — plural words are read ("Plots 5 and 6",
   "Villas 7, 8 and 9"), a letter settles a split villa ("Villa 14A" → B-14A),
   several references to one villa collapse to one villa, and a single-letter
   phase code can no longer be matched inside a word (which had silently pulled
   "Villa 5" into Phase A).
5. **Unstated phase** — where a plot exists in both phases and no phase is
   stated, the reference asks rather than assumes.
6. **Import location integrity** — the source floor/room words are preserved on
   the task, and a named-but-unregistered room is flagged `scope_unresolved`
   instead of passing as confirmed whole-villa work; such a task is never
   completed by a villa-wide message.
7. **Assistant villa-wide rule** — a message naming a room the register does not
   hold proposes nothing for that villa.
8. **Exports** — the four new registers are exported and the administrator gate
   returns 403 for everyone else.
9. **Documentation** — users and permissions, location and drawings, CSV import
   additions, migration-readiness additions, dashboard/AI rules, permission test
   checklist, and this report.

## Remaining technical limitations

- **No provider credits.** The OpenAI account returns "no credits remaining";
  every AI call that needs the model will fail until credits are added. The
  rule-based assistant keeps working.
- **Base44 has no administrator-set password.** Authentication is by invitation;
  the platform sends the mail and the person sets their own password. There is no
  supported temporary-password provisioning step.
- **Exactly-once writes** are achieved by the proposal idempotency key plus the
  task-change guard, not by a database transaction. A crash mid-way leaves a
  proposal in Applying with its per-action results, which is reconciled by
  re-opening the proposal and confirming the actions that were not written.
- **A console warning** (`data-source-location` on a fragment) comes from the
  platform-shipped image helper, not from this app's code.

## What would prevent the real Imagine upload

1. The five staff accounts cannot be created without the real invitation email
   addresses.
2. Model-based interpretation of site messages needs OpenAI credits (optional —
   the rule-based path imports and updates work today).