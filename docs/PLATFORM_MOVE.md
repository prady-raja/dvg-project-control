# Move to Vercel + Supabase: what is done and what comes next

Start this only after the Import Works fix has been verified on real data (run the same file twice: the second run must create 0 tasks).

## Done on Base44 (this branch)
- Import writes retry rate limits with backoff (1.5s, 3s, 6s, 12s). A retried bulk create first looks up rows already stored under the batch, so nothing is written twice (`base44/shared/writeRetry.ts`).
- A batch left in "Importing" has a **Resume this import** button on Import History. Choose the same file; rows already written are recognised and skipped, and the run finishes the same batch.
- `npm run typecheck` runs in CI (0 errors; `checkJs` is off, so it checks the TypeScript shared modules only).
- `npm run check:phone` runs in CI.

## Not done yet (needs the new platform)
1. **Background import job with progress.** Vercel function: enqueue the file, process chunks, store progress on `import_batch`, poll from the page. Needs a queue or a cron-driven worker; do it once on Supabase rather than twice.
2. **One data interface.** All reads and writes go through `src/api/data.js` and `base44/shared/records.ts`. Define one `Repository` interface (get, list, readAll, create, bulkCreate, update, delete, filter) with a Base44 adapter and a Supabase adapter; move business rules only through it. The shared rule modules already hold no SDK calls, so they carry over unchanged.
3. **Row-level security.** Each policy must mirror `base44/shared/access.ts` (`resolveRank`, `canManageProject`, `member_ids` on records): read if the user is an active member of the record's project; write only at Project Editor or above; admin everywhere; baselines write-protected after approval. Write one policy per table plus a test that replays the existing access tests against Postgres.
4. **Rate limits disappear** with direct Postgres inserts (one transaction per chunk), so the retry code becomes a no-op rather than a dependency.

## Message to send Base44 (while still on the platform)
> Our app (DVG Project Control) hits 429 / rate-limit errors on Task.bulkCreate and per-record writes during a 500-row import, and on repeated Floor/Room creates. Please tell us the current per-app request and write limits, and raise them for the next 4 weeks while we migrate. A burst of about 250 creates plus 250 history rows per chunk is what we need to run reliably.
