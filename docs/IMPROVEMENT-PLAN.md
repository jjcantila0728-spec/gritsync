# Processing & Workflow Improvement Plan

_Audit date: 2026-06-10. Three exploration passes (backend pipelines, dev/deploy workflow, background jobs/queues) produced ~45 findings; every high-impact claim below was re-verified against the code before inclusion._

## Verified non-issues (corrected during audit)

- **Stripe webhook is NOT missing.** `server/routes/payments.ts:217` has a full `/api/payments/webhook` handler: signature verification via `constructEvent`, idempotent handling of `payment_intent.succeeded`, refunds, and disputes, designed as a backstop to client-confirm. No action needed.
- **`api/_server.cjs` is NOT committed to git** (it's build output, untracked). No action needed.

---

## P0 — fix this week (cheap, high leverage)

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 1 | **User PII committed to git**: a real user's `diploma.jpg` and `picture.jpg` under `uploads/fa1832dd-…/` | `git ls-files uploads/` | Move to Supabase Storage, `git rm`, and purge from history (`git filter-repo`) — needs owner sign-off since it rewrites history. Repo pack is already 107 MB. |
| 2 | **Cron fires once daily** (`0 1 * * *`), so scheduled posts queued after 1 AM UTC wait up to ~23 h and autopilot barely ticks | `vercel.json:9` | If on Vercel Pro: `*/5 * * * *`. If on Hobby (daily-cron limit): add a GitHub Actions schedule (free, every 5–15 min) that curls `/api/cron/tick` with `CRON_SECRET`. |
| 3 | **Posts stuck in `publishing` forever** after a crash mid-publish — no recovery sweep | `server/routes/social.ts:2356` | At the top of the cron tick: `UPDATE social_posts SET status='queued' WHERE status='publishing' AND updated_at < NOW() - INTERVAL '10 min'`. |
| 4 | **No web CI at all** — only `mobile-build.yml` exists; lint/type-check/test/build scripts exist but never run automatically | `.github/workflows/` | Add `web-ci.yml` running `lint:strict`, `type-check`, `test:run`, `build` on PR + push to main. |
| 5 | **`lint:strict` is broken** — mobile-e2e files fail because no tsconfig covers them (blocks #4) | `.eslintrc.cjs`, `mobile-e2e/` | Add `mobile-e2e/**` to ESLint `ignorePatterns` (or give it its own tsconfig). |

## P1 — reliability of background processing (serverless mismatch)

The recurring root cause: **state held in process memory on Vercel serverless, where every invocation may be a fresh process.**

| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 6 | Expo push receipt tracking is an in-memory `Set` — lost on every cold start, so dead device tokens are never cleaned | `server/lib/push.ts:174-222` | Persist tickets to a `push_tickets` table; drain/poll from the cron tick. |
| 7 | Agent job state (NY/PV application, mandatory-courses) lives in an in-memory `Map`; a crash or 300 s timeout loses all progress with no resume | `server/agents/lib/jobs.ts` | Checkpoint job events/status to a table during the run, not just the final result. |
| 8 | Social-autopilot high-water marks / seen-comment caches are in-memory Maps — cold starts can cause duplicate replies and Meta rate-limit churn | `server/lib/social-autopilot.ts:93` | Persist cache state to a small table, load on tick start. |
| 9 | Meta webhook returns 200 **before** processing; a crash mid-processing silently drops customer messages | `server/routes/social.ts:288` | Persist the raw payload to a `webhook_queue` table before acking; process from the queue. |
| 10 | `email_queue` table exists in the schema but nothing enqueues or drains it — emails go straight to Resend with no retry on 5xx | only ref: `server/routes/query.ts` (table allowlist) | Decide: wire it (enqueue on Resend failure, drain in cron with backoff) or drop the table. Wiring it is recommended. |
| 11 | No timeouts on external `fetch` calls (Meta API, OAuth token exchange) — a hung call can burn the whole 300 s function budget | `server/routes/social.ts` fbGet/fbPost, OAuth | Wrap with `AbortController` (10–15 s) centrally in the fetch helpers. |
| 12 | Cron has zero observability: if `CRON_SECRET` is unset or the cron silently stops, nobody knows for a day | `server/index.ts:79-117` | Log each tick to a `cron_runs` table; surface "last tick" in admin settings; fail loudly at startup if `VERCEL` is set but `CRON_SECRET` isn't. |

## P2 — data integrity & idempotency

| # | Finding | Fix |
|---|---------|-----|
| 13 | Resend webhook replays insert duplicate `email_analytics` rows (no dedup on `svix-id`); timestamp freshness also unchecked | Store `svix-id` with a UNIQUE constraint + `ON CONFLICT DO NOTHING`; reject events older than 5 min. |
| 14 | Application status transitions are scattered across routes with no validation or audit trail — invalid transitions (e.g. approved → draft) are possible | Central `updateApplicationStatus()` helper that validates allowed transitions and writes an audit row. |
| 15 | Social OAuth tokens (≈60-day expiry) are never refreshed — accounts silently start failing after expiry | Before publish, refresh any token expiring within 7 days. |
| 16 | Posts that publish to some platforms but fail others end as `partial` with no retry | Re-queue failed accounts with a retry count. |
| 17 | `trigger-followup-tasks` can duplicate notifications if clicked twice after the first batch is read | Add a `tasks_triggered_at` column guard. |

## P3 — performance & throughput

| # | Finding | Fix |
|---|---------|-----|
| 18 | `trigger-followup-tasks` does N+1 SELECT-then-INSERT per recipient×task, all sequential | One batched existence query + multi-row `INSERT … VALUES`, `Promise.all` the pushes. |
| 19 | `processDuePosts` publishes accounts sequentially per post (5 accounts × 2 s = 10 s/post) | `Promise.all` per-account publishes; batch error updates. |
| 20 | Autopilot hits Meta sequentially per account with no 429 backoff handling | Parallelize per account; honor `retry-after` globally. |

## P4 — dev/deploy workflow hygiene

| # | Finding | Fix |
|---|---------|-----|
| 21 | Migrations have no tracking table — `run-all-migrations.cjs` re-applies by filename sort; environments can drift silently (already bitten by this: schema-cache-miss 500s) | Add a `schema_migrations(filename UNIQUE, applied_at)` table; skip applied files; make `check-migrations.cjs` read it. |
| 22 | 11 one-off `scripts/git-push-*.ps1` wrappers from past hotfixes | Delete them; they're dead weight and an operator-error trap. |
| 23 | `.env.example` (91 vars) vs `env.production.example` (40 vars) drift, incl. `ADMIN_EMAIL` vs `ADMIN_EMAILS` | Unify into one annotated `.env.example`; document prod-only overrides in DEPLOYMENT.md. |
| 24 | No pre-commit hooks — broken lint/types reach main (no CI either, see #4) | husky + lint-staged once #5 is fixed. |
| 25 | `tsconfig.server.json` has `strict: false` while frontend is strict | Turn on strict for server; suppress per-line where needed. |
| 26 | Dockerfile/docker-compose are unused by any deploy path | Remove, or document as the self-host path. |
| 27 | Playwright e2e (`mobile-e2e/`) and `scripts/e2e-test.ts` exist but aren't wired into CI | Add a scheduled/PR-labeled e2e workflow once web CI exists. |

---

## Suggested execution order

1. **Round 1 (P0):** #5 → #4 → #2 → #3 → #1 (PII purge last, needs sign-off).
2. **Round 2 (P1):** one migration adding `push_tickets`, `webhook_queue`, `cron_runs`, autopilot cache, agent checkpoints; then wire each consumer. Email queue decision (#10).
3. **Round 3 (P2/P3):** idempotency + batching fixes, token refresh.
4. **Round 4 (P4):** migrations table, script cleanup, env unification, husky, strict server TS.
