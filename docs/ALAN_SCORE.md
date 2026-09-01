# Alan Score

Alan Score is the owner-only personal film scoring model for Alan Database V3.
This document records the approved calculation contract, persistence boundary,
operational procedure, and rollback path. It does not authorize production
migration or deployment.

## Calculation contract

| Dimension                    | Weight |
| ---------------------------- | -----: |
| Realism                      |    20% |
| Cinematography               |    15% |
| Original-language experience |    10% |
| Tension                      |    15% |
| Cast                         |    10% |
| Atmosphere                   |    15% |
| Rewatchability               |    15% |

Each dimension is optional and accepts `0` through `10` in `0.5` increments.
The score is the weighted sum divided by the sum of weights for rated dimensions,
rounded to one decimal. Coverage is that included weight as a percentage.
No rated dimensions is `unrated`, some is `partial`, and all is `complete`.

Tags are trimmed, case-folded, whitespace-normalized, de-duplicated, limited to
10 values, and limited to 32 characters each. Notes are trimmed and limited to
2,000 characters.

## Data and authorization

Migration `0004_optimal_karma.sql` adds `movie_personal_scores` without changing
existing tables or values. The unique `(user_id, movie_id)` key makes repeated
and concurrent saves conflict-safe. Dimension ranges and half steps, computed
result ranges, status consistency, foreign keys, and cascade cleanup are enforced
in PostgreSQL.

The canonical movie page exposes the score only to the persistent owner. Named
server actions authorize before parsing input, take the user identity only from
the authenticated session, resolve the film through standard-content policy, and
recalculate score, coverage, and status on every upsert. Reset deletes only that
owner/movie row.

The legacy `user_movie_interactions.rating` column remains unchanged. Existing
values may appear as `Legacy rating`; the application never converts them into an
Alan Score.

## Preview execution

1. Create a fresh isolated PostgreSQL preview branch from the reviewed baseline.
2. Apply the complete Drizzle chain, then execute `0004_optimal_karma.sql` again.
3. Configure only branch-scoped Vercel Preview values, including `DATABASE_URL`
   and the existing preview owner setup requirements.
4. Provision the preview owner through the gated setup flow, disable
   `ALLOW_OWNER_SETUP`, and redeploy before sharing the preview.
5. Exercise authenticated and anonymous detail flows at 320 px, tablet, and
   desktop, including keyboard, touch, reduced motion, and failure feedback.

Never use production data or copy a production database URL into Preview.

## Rollback

Before production release, rollback is to revert the feature commit, discard the
isolated preview database branch, and redeploy the preceding preview artifact.
No production rollback applies because production migration and deployment are
outside this change.
