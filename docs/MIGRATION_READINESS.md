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
| Backend functions `taskWrite`, `dailyUpdate`, `saveRecord`, `villaWorkCreate`, `baselineAction`, `nextTaskRef`, `getMyAccess`, `dataExport` | `base44/functions/` | Supabase Edge Functions |
| Shared server modules `access.ts`, `history.ts`, `taskWriteRules.ts`, `taskRef.ts`, `records.ts` | `base44/shared/` | plain TypeScript modules, portable as-is |
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
`baselineAction` (baseline lifecycle), `src/lib/accessRules.js` and
`src/lib/constants.js` (shared labels, statuses, capability ranks).

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
   defaults → memberships → tasks → daily updates → dependencies → baselines →
   ref allocations → history), then set each reference counter from the ledger
   (`setval`), then
   re-point membership `user_id`s by email after inviting users into Supabase Auth.
9. **Screens are not portable** — pages use shadcn/ui + Tailwind and are the
   cheapest part to keep; the SDK calls, RLS and the auth pages are what change.