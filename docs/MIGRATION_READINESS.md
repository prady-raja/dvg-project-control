# DVG Project Control — migration readiness

Living document for the planned move off Base44 to an independent DVG platform
(GitHub + Codex, Supabase PostgreSQL, Supabase Auth and Storage).

Nothing here changes how the app runs. It records what exists, what is
platform-specific, and how the data maps across.

## A. Entity inventory

| Base44 entity | Purpose | Scope |
| --- | --- | --- |
| Project | A development (Imagine, Birdie) | Company |
| Phase | A phase inside a project (A, B) | Project |
| Location | A villa or common location; `villa_code` is the permanent id, `plot_numbers` the original plot reference | Project |
| Contractor | Execution teams, internal and external | Company |
| ContractorDefault | Default contractor per project / phase / discipline | Project |
| WorkPackage | Standard work packages per discipline | Project |
| Discipline | Company discipline list (CIVIL, ELEC, …) | Company |
| ProjectMembership | Who holds which role on which project | Project |
| Task | Every work item; permanent `task_ref` | Project |
| TaskDependency | Structure only, logic is a later step | Project |
| TaskHistory | Append-only change trail | Project |
| RefAllocation | Append-only ledger of every task reference ever issued — the counter behind `task_ref` | Project |
| ImportBatch | One work import (Excel workbook or CSV): the file, the worksheet, who ran it, what it created and every row's outcome | Project |
| DailyUpdate | One site report per save: progress, work done, manpower, plan, blocker, photos | Project |
| BaselineVersion | Frozen baseline snapshots per phase | Project |
| User | Built-in profile (id, email, full_name, role) | Platform |

Field-by-field export order: `src/lib/exportSchema.js`. Live export: **Administration → Export**.

## B. Stable ids and relationships

- Every record keeps its internal `id`; the app references relations by id only.
  Display names are never used as keys.
- Task references (`IMG-A-0001`) are allocated by the server and never reused.
  The counter is the append-only `RefAllocation` ledger plus any reference
  already on a task or in the change trail — never the highest task that happens
  to exist, so deleting, archiving or correcting a task leaves its number spent
  (`base44/shared/taskRef.ts`; full description in `docs/REFERENCE_ALLOCATION.md`).
- Villa work: a container task (`is_villa_work_parent = true`) plus one child per
  villa (`parent_task_id`). Children carry the work; the container is excluded
  from the register and its totals so nothing is double counted.
- Combined plots and split villas are explicit: `Location.villa_code` holds the
  physical id (`B-05-06`, `B-14A`) while `plot_numbers` keeps the original plot
  reference (`Plots 5 & 6`, `Plot 14 — Villa A`).
- Full relation list: `RELATIONSHIPS` in `src/lib/exportSchema.js`.

## C. Exports

Administration → Export (application administrators only):

- **JSON bundle** — every entity in one file with `_meta`: export time, row
  counts, relationship list, and what is deliberately excluded. Nested data
  (`BaselineVersion.snapshot`, `.changes`) travels in full.
- **CSV per entity** — fixed column order from `exportSchema.js`, arrays joined
  as JSON text.

The export function pages through records (500 at a time) so it keeps working as
the register grows. Excluded: passwords, tokens, sessions, verification codes.
Daily updates export in full, including the photo references in
`DailyUpdate.photo_uris` — the image files themselves stay in platform storage
and are copied separately (see G7). Inspections are not built yet.

## D. Base44-specific dependencies

| Dependency | Where | Replacement |
| --- | --- | --- |
| `@/api/base44Client` SDK (entities, functions, auth) | every page | Supabase JS client + REST |
| RLS via `rls` blocks in `base44/entities/*.jsonc` | all project data | Postgres RLS policies (see E) |
| Backend functions `taskWrite`, `dailyUpdate`, `saveRecord`, `villaWorkCreate`, `baselineAction`, `nextTaskRef`, `getMyAccess`, `dataExport`, `workImport` | `base44/functions/` | Supabase Edge Functions |
| Shared server modules `access.ts`, `history.ts`, `taskWriteRules.ts`, `taskRef.ts`, `records.ts`, `workImport.ts` | `base44/shared/` | plain TypeScript modules, portable as-is |
| Private file storage (`UploadPrivateFile`) and signed links (`CreateFileSignedUrl`) | daily update site photos | Supabase Storage, private bucket + signed URLs |
| Built-in User entity | Auth | `auth.users` + `profiles` |
| `created_by_id`, `created_date`, `updated_date`, `member_ids` system fields | every record | explicit columns; `member_ids` becomes a join table |
| Platform auth pages (login, register, reset) | `src/pages/` | Supabase Auth UI |
| `member_ids` mirror on records | all project entities | remove after migration (the join replaces it) |

Business rules live in single places, not in components:
`base44/shared/access.ts` (roles and ranks), `history.ts` (what is audited and
how values are compared), `taskWriteRules.ts` (which change sets a task accepts,
and the stamps that travel with them — the one gate both the task editor and the
daily report pass through), `taskRef.ts` (reference allocation),
`base44/functions/taskWrite` (task validation), `dailyUpdate` (site reports:
permission, the report row, the task fields it moves and the trail row),
`baselineAction` (baseline lifecycle), `workImport.ts` (a CSV row: matching,
validation, duplicate detection and the task records an import writes — see H),
`src/lib/accessRules.js` and `src/lib/constants.js` (shared labels, statuses,
capability ranks).

## E. Authentication and permissions

Today: sessions and password/OTP flows belong to the platform; the app stores
only `ProjectMembership` (role per project) and reads its own access through
`getMyAccess`. Every write re-derives the role on the server — no client claim
is trusted.

Role ranks: Viewer 0, Supervisor 1, Site Engineer 1, Project Manager 2,
Project Admin 3, application administrator 4.

Mapping to Supabase:

1. `auth.users` holds credentials (never exported).
2. `profiles` = `User.id, email, full_name, role` (app role: admin / user).
3. `project_memberships` = `ProjectMembership` with `user_id` as the foreign key
   to `auth.users.id`, plus `role`.
4. RLS pattern per project table:
   `exists (select 1 from project_memberships m where m.project_id = tasks.project_id and m.user_id = auth.uid() and m.active)`.
5. Write rules: `edit_tasks` needs rank ≥ 1, approvals/baselines/membership/
   archiving need rank ≥ 2, project creation needs the application
   administrator — reimplement these as `security definer` functions returning
   the caller's rank, called from the policies, so the rule stays in one place.
6. `TaskHistory` and `BaselineVersion` must be read-only for everyone after
   migration: revoke insert/update/delete and let only the Edge Functions write.
7. Until a member signs in, their membership is matched by email; after
   migration, invite through Supabase Auth so `user_id` is known immediately.

## F. Suggested Supabase schema

| Base44 entity | Supabase table | Notes |
| --- | --- | --- |
| Project | `projects` | `id uuid pk`, `code text unique not null` |
| Phase | `phases` | `project_id` fk → projects, `unique (project_id, code)` |
| Location | `locations` | `project_id`, `phase_id` fk; `villa_code text` with `unique (project_id, villa_code)` |
| Contractor | `contractors` | company-wide, no project fk |
| Discipline | `disciplines` | `code text unique` |
| ContractorDefault | `contractor_defaults` | `discipline` references `disciplines.code` |
| WorkPackage | `work_packages` | `project_id`, `discipline` |
| ProjectMembership | `project_memberships` | `user_id` fk → `auth.users`, `unique (project_id, user_id)` |
| Task | `tasks` | all fields as columns; `task_ref text unique`; self fk `parent_task_id`; `dates date`; enums as `text` + check constraint |
| TaskDependency | `task_dependencies` | two fks to `tasks` |
| DailyUpdate | `daily_updates` | `task_id` fk → tasks, `project_id`/`phase_id`/`location_id` fks (`location_id` nullable for site-wide), `reported_by uuid` → `auth.users`, `update_date date`, `photo_uris text[]` holds storage paths |
| TaskHistory | `task_history` | `changed_at timestamptz`, `old_value/new_value text` |
| RefAllocation | `ref_allocations` | `unique (task_ref)`, `unique (prefix, sequence)`; imported after `tasks`, then each prefix counter is set from `max(sequence)` |
| ImportBatch | `import_batches` | `batch_ref text unique`, `report jsonb`, `source_checksum text` (index it — that is how a repeated file is recognised) |
| BaselineVersion | `baseline_versions` | `snapshot jsonb`, `changes jsonb`, `version_number int` |
| User | `profiles` | `id` = `auth.users.id` |
| `member_ids` (system field) | *(none)* | replaced by `project_memberships` |
| `created_by_id` | `created_by uuid` | → `auth.users.id` |

Portable conventions already in the data: ISO `YYYY-MM-DD` dates, ISO 8601
timestamps, status values as fixed strings from `src/lib/constants.js` (safe as
Postgres `text` + check, or as enums created in the same order). Quantities and
percentages are numbers, blank allowed — an unknown progress is `null`, never 0.
All date logic uses Asia/Kolkata.

## G. Migration risks and blockers

1. **`member_ids` mirror** — a denormalised convenience that must not survive as
   the source of truth. The join table is the truth; drop the mirror after RLS is
   proven equivalent.
2. **Server-side write path is the real control** — the rules live in Edge
   Functions today. If they are ported without their policies, the app still
   "works" but nothing is protected. Port RLS and functions together.
3. **Reference allocation** — this is the one place where the platform's limits
   are real. Base44 has no compare-and-swap and no unique index on a field
   (measured, see `docs/REFERENCE_ALLOCATION.md`), so simultaneous writers can
   both claim a number. The allocator arbitrates instead: the earliest claim
   keeps the number, a loser is re-issued, and a created task that lost a shared
   number is corrected immediately and recorded as `Reference Correction`.
   Postgres deletes the problem outright — one sequence per prefix, or
   `insert ... on conflict (task_ref) do nothing returning`, plus
   `unique (task_ref)`. Do this early in the migration and the arbitration code
   goes with it.
4. **Audit trail integrity** — `TaskHistory` is written from trusted before/after
   values. Keep it append-only; never recompute history from the tasks table,
   because history records what was true at a point in time.
5. **Approval identity** — `execution_completed_by_id` and `approved_by_id` are
   set by the server from the session. Any reimplementation that accepts these
   from the client silently removes the separation of duties.
6. **Baseline freeze semantics** — an approved baseline is immutable and later
   changes are new versions. A naive "just update the task dates" port loses the
   audit of what moved.
7. **Files** — site photos are private storage references in
   `DailyUpdate.photo_uris`, never public URLs. After migration use a private
   Supabase Storage bucket and keep the path list on the row; signed links are
   generated on demand. Copying the actual files is a separate step from the
   database import.
8. **No one-click migration** — Base44 exports data and code, not an equivalent
   database. Expect a scripted import: entities in dependency order (projects →
   phases → locations → contractors → disciplines → work packages → contractor
   defaults → memberships → import batches → tasks → daily updates →
   dependencies → baselines → ref allocations → history), then set each reference
   counter from the ledger (`setval`), then re-point membership `user_id`s by
   email after inviting users into Supabase Auth. Tasks carry `import_batch_id`,
   so `import_batches` must be loaded before `tasks`.
9. **Screens are not portable** — pages use shadcn/ui + Tailwind and are the
   cheapest part to keep; the SDK calls, RLS and the auth pages are what change.

## H. Excel and CSV work import (Import Works)

Run from **Import Works**, restricted on the server to a Project Manager or an
application administrator on that project. The file is parsed, matched,
validated and written by `base44/functions/workImport` together with
`base44/shared/workImport.ts`. The browser only displays what the server
reports and sends back the corrections the user makes; preview and import run
the *same* validation, so a confirmed import creates exactly what the preview
showed. Full operating notes for the screen: `docs/CSV_IMPORT.md`.

An **.xlsx** workbook is accepted as well as a CSV. The browser reads the `Works`
worksheet and turns it into the same CSV text the server has always validated
(`src/lib/xlsxImport.js`), so there is exactly one validation path and no second
set of rules to port. Only saved cell values are read — no formula is evaluated and
no macro can run — and dates are converted from Excel's own date value, so no time
zone can shift them. The worksheet name and each row's worksheet row travel with
the request (`source_sheet`, `row_numbers`) and are re-validated server-side; a row
number list that does not line up is ignored and the position in the file decides.
In Supabase, the workbook can be parsed server-side instead with the same column
list; nothing else about the import changes.

Column → field mapping (headers are matched loosely: case, spaces and
punctuation ignored):

| CSV column | Task field | Rule |
| --- | --- | --- |
| Project | `project_id` | Must be the project the import was started for; another project's name is refused |
| Phase | `phase_id` | `A` / `Phase A`; the villa's own phase wins and a disagreement is reported |
| Villa/location code | `location_id` | `villa_code` as registered; a plot reference is matched only when it names one villa, otherwise the row is flagged ambiguous |
| Work category | *(site-wide has `location_id` null)* | `Villa Work` or `Site-Wide Work`; blank is inferred from the location |
| Discipline | `discipline` | Discipline code — required |
| Work package | `work_package` | Standard name preferred; a non-standard value is imported as written and flagged |
| Task description | `name` | Required |
| Contractor | `contractor_id` | Named contractor, else the project default for discipline + phase; never invented |
| Responsible engineer | `responsible_engineer` | |
| Priority | `priority` | `Low`/`Medium`/`High`/`Critical`; blank → Medium |
| Status | `status` | Register statuses; blank → Not Started |
| Baseline start / finish | `baseline_start` / `baseline_finish` | A *proposed* baseline (`baseline_approval_status = Not Submitted`, never locked) |
| Forecast finish | `current_forecast_finish` | |
| Progress percentage | `progress_percent` | 0–100; blank stays blank (never 0) |
| Estimated man-hours | `estimated_manhours` | |
| Blocker description | `blocker_description` | |
| Remarks | `remarks` | |
| Source reference | `source_reference` | The work list's own reference, kept with the task |

Import metadata on every imported task (server-owned; a screen can never set
it): `import_batch_id`, `import_source_file`, `import_source_sheet`,
`import_row_number`, plus `source_reference`. The `ImportBatch` row holds
`batch_ref`, the file name, the worksheet it was read from (`source_sheet`), its
fingerprint, who ran it and when, the row counts, the status, and the per-row
report — row number, worksheet, outcome, task reference, villa, contractor and the
information still missing.

What an import never does:

- **Never overwrites or merges.** A likely duplicate is offered as *Skip*,
  *Import as new*, or *Link*; linking writes one `Import Link` row to that
  task's history and leaves its fields untouched.
- **Never renumbers a published reference.** References are allocated per phase
  in blocks and checked afterwards; a simultaneous claim is re-issued the next
  free number, and the correction is both reported in the batch and recorded in
  the task's history.
- **Never guesses.** A blank cell stays blank; an unreadable date, an unmatched
  villa or an unmatched contractor is an error on that row.

Limitations carried into the migration:

1. **Bounds.** One import holds up to 500 rows, and duplicate detection reads the
   project's most recent 2,000 tasks. Postgres removes both (a unique index on
   `(project_id, normalised description, location_id, discipline)`).
2. **A number consumed by a deleted or test task stays consumed.** That is the
   ledger's purpose, and `ref_allocations` carries it across the migration.
3. **Dates are read day-first** when the form is ambiguous (`DD/MM/YYYY`). The
   template's `YYYY-MM-DD` / `DD-MMM-YY` forms avoid the ambiguity entirely.
4. **A file is not a database transaction.** A failing block is reported per row
   and the rest of the file continues, so a partly applied file is always
   visible in the batch report. Supabase can wrap the whole file in one
   transaction.
5. **Excel is read in the browser.** The workbook is parsed client-side into the
   same CSV text the server validates, so there is one validation path; only saved
   cell values are read (no formula evaluation, no macro). Supabase can move this
   server-side with the same column list, and the stored provenance
   (`import_source_file`, `import_source_sheet`, `import_row_number`) is unchanged
   either way.

---

## Management dashboards and AI (development batch 2)

The full detail lives in `docs/DASHBOARDS_AND_AI.md`. In summary, for migration:

1. **Every management figure is computed on the server** by
   `base44/shared/dashboardCore.ts`, `dashboardViews.ts` and `dashboardBoards.ts`,
   and read through `base44/functions/dashboardData`. No screen and no AI model
   calculates a number of its own, so moving the engine moves every figure with it.
2. **Calculation rules that must survive the migration**: the scheduled date is the
   forecast finish falling back to the baseline; overdue applies only to work still
   to be executed; on-hold villas stay in inventory but out of active execution
   figures; villa-work parent rows are never counted, only their children;
   site-wide work counts at project level and is reported separately; demo records
   are excluded from operational figures unless an administrator switches them on;
   a completion percentage appears only when every outstanding task in the set is
   measured, weighted by estimated man-hours.
3. **New entities**: `Snag` (defects, separate from tasks, `SN-` references from the
   same ledger), `MeetingCommitment` (one promise per record against an existing
   task), `AiSettings` (single settings row), `AiUsage` (one row per AI request).
   All four are in `base44/functions/dataExport` and in `src/lib/exportSchema.js`.
4. **Meeting commitments** never create tasks and are never overwritten: a later
   meeting adds rows. Status moves between `Open`, `Fulfilled`, `Missed` and
   `Cancelled`; the promise text is not rewritten.
5. **AI retrieval** runs through `base44/functions/aiAction`, which builds the
   permitted scope from `ProjectMembership` on the server, computes the digest with
   the dashboard engine, and sends only that bounded digest to OpenAI. Owner,
   contact and file data are never sent; a browser-supplied filter can never widen
   the scope.
6. **AI configuration**: `OPENAI_API_KEY` as an app secret (server-side only), plus
   an `AiSettings` row for enabled, allowed roles, model, daily request limit and
   context limit. With no key, the AI screens show *AI Setup Required* and the rest
   of the application is unaffected.
7. **API provider dependency**: OpenAI chat completions over plain `fetch` with a
   timeout — no SDK, so the call ports to any runtime. Provider failures reach the
   user and are logged to `AiUsage`; they are never replaced with invented answers.
8. **Permissions**: dashboards need an active project membership; the demo view and
   the AI controls are application-administrator only; AI use needs the caller's
   project role in `allowed_roles` and stays inside the daily limit; snags may be
   raised by a Site Engineer and above; meeting commitments by a Project Manager and
   above. The AI cannot approve, close, move a baseline, change permissions or write
   to a record — a proposed site update is confirmed by a human and written through
   `base44/functions/dailyUpdate`.
9. **Supabase equivalents**: RLS policies on `member_ids` for the new entities,
   `nextval` sequences per reference prefix, a single-row `ai_settings` table, an
   `ai_usage` insert log with a `(user_id, day)` index, and SQL views
   (`v_task_facts`, `v_contractor_summary`, `v_villa_attention`) that keep the
   digest SQL-side. The prompt scaffolding and deterministic task matching in
   `base44/shared/ai.ts` carry across unchanged.

## Phase 1 final additions (location, drawings, AI proposals, designations)

Four entity tables were added after this document was first written, and are part
of the full export (`base44/functions/dataExport` → entity list, and the column
order in `src/lib/exportSchema.js`):

| Entity | Purpose | Key relationships |
| --- | --- | --- |
| `VillaFloor` | One floor of one villa | `location_id → Location.id`, `phase_id → Phase.id` |
| `VillaArea` | The room register (names, aliases, `normalized_name`) | `location_id → Location.id`, `floor_id → VillaFloor.id` |
| `Drawing` | Drawing register, one row per revision, private files | `location_id → Location.id`, `floor_id → VillaFloor.id`, `supersedes_id` / `superseded_by_id` chain |
| `AiProposal` | Assistant proposals with their idempotency key and per-action results | `project_id`, `phase_id`, `user_id` |

Changes to existing tables:

- `Task` gains `floor_id`, `area_ids[]`, `area_label`, `scope_type`,
  `acceptance_criterion`, `source_location_text` and `scope_unresolved`. The last
  two are what make imported work honest: the floor/room words are preserved as
  written, and a row whose room was named but never registered is flagged instead
  of passing as confirmed whole-villa work.
- `Snag` gains `floor_id`, `area_ids[]`, `area_label`.
- `User` gains `designation` — a descriptive job label only (Site Engineer, MEP
  Engineer, Procurement, Planning, Management). It never grants a capability.
- `ProjectMembership.role` gains **Project Editor**, the single operational level
  used by the five staff users. `Project Admin`, `Project Manager`, `Site
  Engineer`, `Supervisor` and `Viewer` remain valid so older rows still resolve.

In Supabase terms: `project_editor` maps to the same operational rights that
`project_manager` had, except that membership management now requires the
application administrator — the `members` capability is no longer satisfied by any
project role.