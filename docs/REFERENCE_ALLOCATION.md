# Task references — how a number is issued, and what is guaranteed

A task reference (`IMG-A-0001`) is a permanent identifier. It is never reused:
not when a task is deleted, not when one is archived, and not when a test record
is cleaned up. This note records how that is done on Base44, what the platform
does and does not guarantee, and what changes at migration.

Code: `base44/shared/taskRef.ts` (the allocator), `base44/entities/RefAllocation.jsonc`
(the ledger), used by `taskWrite`, `villaWorkCreate` and `nextTaskRef`.

## 1. The ledger

`RefAllocation` is append-only. One row per reference ever issued:

| field | meaning |
| --- | --- |
| `task_ref` / `external_id` | the reference itself, e.g. `IMG-A-0004` |
| `prefix` | `IMG-A-`, `IMG-B-`, `IMG-GEN-` — each prefix keeps its own counter |
| `sequence` | the number inside that prefix |
| `task_id` | the task that consumed it, filled in once the task is written; empty while a claim was not used |
| `claim_id` | which allocation claimed the number, so a lost claim can be traced |
| `source` | `allocation` (issued by the allocator) or `backfill` (recovered from an existing task or the change trail) |

Rows are never deleted and no application user can write, change or delete them
(`create`/`update` are server-only, `delete` is refused). Removing a task does
not touch its row, which is what makes the number stay consumed.

## 2. Where the next number comes from

`max(sequence)` across three readings, plus one:

1. the ledger (authoritative, monotonic),
2. task references that already exist on any task, archived included,
3. references recorded in the change trail (`TaskHistory`), which is how a
   reference issued before the ledger existed is still honoured after its task
   was deleted.

Readings 2 and 3 are a floor, used once to bootstrap a prefix — they are what
made the existing `IMG-A-0001..0003`, `IMG-B-0001..0002` and `IMG-GEN-0001`
continue correctly at `0004`, `0003` and `0002`. From then on the ledger alone
decides, so the count can never go backwards when task records disappear.

## 3. What the platform guarantees — measured, not assumed

An entity on Base44 has **no compare-and-swap and no unique index on a field**.
This was measured directly on `RefAllocation`:

| probe | result |
| --- | --- |
| same key upserted twice, one after the other | `created: 1` then `updated: 1` — ownership is reported correctly |
| same key upserted by 3 simultaneous writers | 2 reported `created: 1`, and **two rows existed for the one key** |
| same key upserted by 4 simultaneous writers | 2 reported `created: 1`, again two rows for one key |

So the platform cannot provide an atomic claim. **Reference allocation is
therefore arbitrated, not locked:**

1. every writer writes its claim row for the number it computed;
2. it reads the number back and keeps it only if its own row is the earliest for
   that number (ordered by `created_date`, then `id` — the same rule for every
   writer, so they cannot disagree about who won);
3. a claim that lost moves to the next free number and claims again;
4. after the task exists, its reference is checked once more, and a task that
   lost a shared number is re-issued the next free one immediately. That
   correction is written to the task's change trail as `Reference Correction`.

Observed live: four tasks created simultaneously returned `ZZT-GEN-0003`,
`0004`, `0005`, `0006` — all distinct. The ledger kept the losing row for
`ZZT-GEN-0003` (empty `task_id`), which is exactly the evidence that the
arbitration ran.

**The honest limitation.** This converges on uniqueness from any interleaving,
but it is not an atomic allocator. If the verification read misses a simultaneous
row (Base44 reads can lag a write by a moment), a shared number can survive until
the next check and is then corrected. Two references can therefore never be left
duplicating in place for long, but issuance is not formally collision-free the
way a database sequence is. It is adequate for a small site team; it would not be
adequate for hundreds of simultaneous creations, which is a reason to move this
one function early in the migration.

## 4. Duplicate references cannot be assigned by hand

`task_ref` is a server-owned field: the editor never shows it, and `taskWrite`
refuses any payload that carries it —
`"A task reference is issued by the system and cannot be set by hand."` on create
and `"…cannot be changed."` on update (verified).

## 5. Bulk work

Villa Work claims its whole block (container plus one reference per villa) in
one call — three requests regardless of villa count — so a 40-villa assignment
is still issued and attached quickly.

## 6. Migration to Supabase

Do this first; it removes the limitation entirely.

1. `tasks.task_ref text unique` (already planned).
2. `ref_allocations` table, `unique (task_ref)` and `unique (prefix, sequence)`
   — keep it, it is the audit of what was issued.
3. Replace the allocator with, per prefix, either a Postgres sequence
   (`nextval`) or `insert ... on conflict (task_ref) do nothing returning *` and
   retry. Both are genuinely atomic, so `claimOne`, `claimBlock`,
   `resolveRefCollisions` and the arbitration note above can be deleted; only
   the row write remains.
4. Import `ref_allocations` after `tasks`, then set each prefix counter from
   `max(sequence)` (`setval`), so no number is issued twice after the move.
5. Keep `task_ref` out of every client-facing write path in the new API, exactly
   as it is here.

## 7. Checking it

- Administration → Export includes `RefAllocation` in column order; compare
  `task_ref` values against the `tasks` export — every reference must appear in
  the ledger, and no reference may appear against two different tasks.
- A row with an empty `task_id` is a claim that was not used, or a reference
  whose task was deleted. Both mean the number is spent, which is intended.