# Management Dashboards and AI — calculation rules and dependencies

This document states exactly how every management figure in DVG Project Control is
produced, what the AI assistant is allowed to see, and what each of these needs in
order to move to another database. It is the companion to
`docs/MIGRATION_READINESS.md`.

Every rule below is implemented once, in `base44/shared/dashboardCore.ts`,
`dashboardViews.ts` and `dashboardBoards.ts`, and read by every screen and by the AI
through `base44/functions/dashboardData` and `base44/functions/aiAction`. No screen
and no model calculates a figure of its own.

---

## 1. Dashboard calculation rules

### Status model

| Term | Meaning |
| --- | --- |
| Executing | `Not Started`, `In Progress`, `Blocked` |
| Awaiting verification | `Execution Complete`, `Under Inspection` |
| Awaiting closure | `Approved` |
| Outstanding ("open") | any status other than `Closed` |
| Closed | excluded from every outstanding figure |

### Dates

- The one scheduled date is the **current forecast finish**, falling back to the
  **baseline finish**. Nothing else is treated as a schedule.
- **Overdue** = outstanding, still executing, and the scheduled date is before the
  reporting date. Work that is executed, under inspection or approved is never
  called overdue — it is counted as *awaiting verification* or *awaiting closure*.
- **Due within 7 / 14 days** = executing, scheduled on or after the reporting date,
  and within that many days. Overdue work is never counted as due.
- **Unscheduled** = outstanding with neither a baseline nor a forecast finish. Such
  tasks appear under *Unscheduled* in Planning instead of disappearing.
- All date arithmetic and display use **Asia/Kolkata**; the reporting date is the
  day the user chooses (default today, IST).

### Villas and units

- Registered = every `Location` of type `Villa`. Active = `active_status` not
  `On Hold`. Villas on hold stay in inventory.
- **On-hold villas are excluded from active execution figures** (open, overdue,
  blocked, due-within and completion denominators) and reported separately as
  `held_open_tasks`, `held_overdue_tasks`, `held_blocked_tasks`, so work is never
  hidden. Per-villa screens still show everything on that villa.
- Possession and works are independent. A **handed-over villa with open works stays
  first on the handover board** and inside the portfolio figure
  `handed_over_open_works`. Handing over never closes work.

### Double counting

- A **villa-work parent** row (`is_villa_work_parent = true`) is an assignment
  holder, never work: it is excluded from every count, and its children are counted
  individually. Parents and children are reported separately as
  `villa_work_assignments` and `villa_work_children`.
- **Site-wide work** (no location, or a location that is not a villa) is counted in
  project totals and reported separately on the Site-wide screen.
- Manpower is a **sum of reported task-level manpower**, never a count of unique
  people — one worker reported on three tasks appears three times. The screens say
  so wherever the figure appears.

### Completion percentages

A percentage is produced only when **every outstanding task in the set carries a
measured `progress_percent`**. Where that is not true the screens show
`Insufficient data` (or `Not yet measured`) together with status counts and the
measured coverage, e.g. "3 of 9 outstanding tasks measured".

- Weight = the task's `estimated_manhours`, falling back to 1 when unset. The basis
  is stated next to every figure.
- Percentages are never averaged across unrelated tasks or disciplines and are never
  derived from status.
- **Quantity progress** (`completed_quantity ÷ planned_quantity`) is shown per task
  where both numbers exist, never aggregated into a construction completion score.

### Priority scoring (management priorities)

Score = capped overdue days × 2, + 50 if marked Blocked, + 20 if a blocker is
recorded, + priority weight (Critical 30, High 15, Medium 5, Low 0), + 10 if
overdue. Only recorded facts are used. The list also states the single next action
(`actionFor`), derived from status, and never from a model.

### Demo records

`is_demo = true` records are **excluded from every operational figure by default**.
An application administrator can switch the Demo/Test view on for one screen at a
time; the payload then states `demo_view: true` and the screen shows a warning that
the figures include test data. No demo record can enter a live total silently.

---

## 2. New records added in this batch

| Entity | Purpose | RLS |
| --- | --- | --- |
| `Snag` | Defects against a villa or site-wide area, tracked separately from tasks. Permanent `SN-` reference from the same append-only ledger as tasks. | read: project members (mirrored `member_ids`) or app admin; write: through `snagWrite` only |
| `MeetingCommitment` | One promise per record, always linked to an existing task. Earlier commitments are preserved because each is its own row. | read: project members or app admin; write: through `saveRecord` (Project Manager and above) |
| `AiSettings` | Single record of the AI controls: enabled, allowed roles, model, daily request limit, context limit, standing instructions. | read: any signed-in user; write: application administrator only |
| `AiUsage` | One row per AI request: user, day, action, model, tokens, outcome. Enforces the daily limit and provides the audit trail. | read: app admin; write: server only |

All four are included in `base44/functions/dataExport`, so a migration exports them
with their internal ids and relationships intact.

### Supabase equivalents

- RLS policies on `member_ids` (array contains) replace the entity access rules.
- `Snag.snag_ref` uses the same allocation pattern as tasks; in Postgres it becomes
  a sequence per prefix (`nextval`) with a unique index, which removes the
  arbitration logic documented in `docs/REFERENCE_ALLOCATION.md`.
- `AiSettings` becomes a single-row settings table; `AiUsage` a plain insert log with
  a daily count index on `(user_id, day)`.

---

## 3. Meeting commitments

- A commitment **must** reference a task that already exists. No part of the meeting
  flow can create a construction task from notes.
- Each commitment is a separate record carrying the meeting date, task reference
  snapshot, responsible person, promised date, status (`Open`, `Fulfilled`,
  `Missed`, `Cancelled`) and remarks. Recording a later meeting **adds** rows; it
  never overwrites what was promised before.
- "Unresolved previous commitments" = still `Open` with a promised date before the
  meeting date.
- Fulfilment is recorded by changing status and `fulfilled_date` only; the text of
  the promise is not rewritten.

---

## 4. AI retrieval functions and configuration

### Functions

| Function | Role |
| --- | --- |
| `base44/functions/aiAction` | The only AI entry point. Actions: `status`, `ask`, `daily_brief`, `meeting_brief`, `parse_update`. |
| `base44/shared/projectData.ts` | Builds the permitted scope from the caller's own membership and loads the records. Used by both dashboards and AI. |
| `base44/shared/ai.ts` | Settings, role and limit checks, usage logging, the digest builder, prompt scaffolding, the provider call, and deterministic task matching. |
| `base44/shared/dashboard*.ts` | The calculation engine. The digest is built from these same functions, so an AI answer can never disagree with a screen. |

### What is sent, and what is not

- Only projects the caller is a member of (application administrators see all). The
  scope is derived from `ProjectMembership` server-side; a filter sent by the browser
  cannot widen it.
- A bounded digest: counts, the top priority rows, overdue, due-in-7, blockers and
  recorded chains, awaiting-verification, unscheduled, stale updates, villa
  attention list, contractor summaries, handover rows, commitments, and data-quality
  notes. Row counts are capped by `context_item_limit`.
- **Not sent:** owner or contact details, phone numbers, emails, addresses, private
  file URIs, or any project the user cannot access. Task, villa, contractor and
  engineer names are sent because they are the subject of the analysis.

### Configuration and environment variables

| Setting | Where | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | Base44 app secrets (server-side only; never sent to the browser) | none — AI shows **AI Setup Required** until set |
| Model | Administration → AI assistant (`AiSettings.model`) | `gpt-4o-mini` |
| Enabled | Administration → AI assistant (`AiSettings.enabled`) | on |
| Roles permitted | Administration → AI assistant (`AiSettings.allowed_roles`) | Project Admin, Project Manager |
| Daily requests per user | `AiSettings.daily_request_limit` | 40 (0 = unlimited) |
| Records per request | `AiSettings.context_item_limit` | 40 |

Behaviour when not configured: every AI screen shows a setup notice; the dashboards,
boards, planning, meetings, handover and site report flows keep working unchanged.
No AI response is fabricated.

### API provider dependency

- Provider: OpenAI (`https://api.openai.com/v1/chat/completions`), called with
  `fetch` and a 60-second abort timeout. No SDK dependency, so the call is portable.
- Errors are surfaced to the user and recorded in `AiUsage` with `ok: false`; a 429
  is passed through as such. Failed requests are never replaced with invented text.
- Cost control: bounded digest size, per-user daily limit, configurable model, and a
  usage row per request.

### Permissions

| Action | Requirement |
| --- | --- |
| Read a dashboard | Active membership of the project (any project role) |
| Enable the demo view | Application administrator |
| Change AI controls | Application administrator |
| Use AI | AI enabled, caller's project role in `allowed_roles` (app admin always), under the daily limit |
| Raise or progress a snag | Site Engineer and above on the project |
| Record a meeting commitment | Project Manager and above |
| Approve, close, move a baseline, change permissions | Unchanged — through the existing guarded task and baseline paths, never by AI |

The AI may not write to any record. A proposed site update is returned to the
browser, a human confirms the task and every field, and the write then goes through
`base44/functions/dailyUpdate`, which applies the same permission, baseline and
reason rules as a typed report.

---

## 5. Supabase equivalents for the AI layer

| Here | Supabase |
| --- | --- |
| `aiAction` function | Edge Function `ai-ask`; keep the same "compute first, then explain" split |
| `loadProjectData` + digest | SQL views (`v_task_facts`, `v_contractor_summary`, `v_villa_attention`) with RLS, selecting only the columns the digest needs |
| Scope from `ProjectMembership` | RLS policy on `project_members`; the Edge Function runs as the caller (`auth.uid()`), not as service role |
| `AiSettings` / `AiUsage` | `ai_settings` single row + `ai_usage` insert log |
| `OPENAI_API_KEY` | Supabase secret, read inside the Edge Function only |
| Daily limit | `count(*) where user_id = auth.uid() and day = current_date` |

The prompt scaffolding and the deterministic candidate matching in
`base44/shared/ai.ts` move across unchanged — neither touches the database.