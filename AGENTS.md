# Repository Agent Rules

This file is the authoritative operating guide for agents. `PROJECT.md` defines the product, `ARCHITECTURE.md` describes the current system, and `ROADMAP.md` tracks direction and status.

## Authority and freshness

- The Product/Project Lead owns scope, product decisions, and release authority.
- Current repository code, configuration, tests, schema, and verified Git/worktree state are factual authority. Verify them before relying on a UI label, branch name in a prompt, session summary, or document.
- `.geminirules` may add tool-specific rules only where it does not conflict with this file. `.agents/SESSION_STATE.md` is historical and non-authoritative until explicitly reconciled. `Artifacts.MD/*` and similar discovery material never override current repository evidence.
- Update `PROJECT.md`, `ARCHITECTURE.md`, or `ROADMAP.md` when an approved change alters their facts or status. Do not update status without evidence.

## Canonical states

Use these exact states in plans, Orca comments, handoffs, and reports:

| State         | Meaning                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `proposed`    | Scoped idea awaiting Product Lead approval.                                                          |
| `approved`    | Scope and acceptance criteria authorized; implementation may proceed.                                |
| `in_progress` | Active work in the assigned worktree.                                                                |
| `in_review`   | Implementation is ready for review but is not yet verified or integrated.                            |
| `verified`    | Acceptance criteria and required checks pass in that worktree; not necessarily merged or deployed.   |
| `blocked`     | Work stopped because a stated condition requires input, authority, or external change.               |
| `merged`      | Reviewed work is integrated into a named target branch and verified there; not necessarily deployed. |
| `deployed`    | The named environment is confirmed running the change with evidence.                                 |

Orca may display `in-progress` and `in-review`; these map to `in_progress` and `in_review` above.

## Approval boundary

- An agent may implement and validate autonomously within an `approved` scope.
- Product Lead approval is required before scope expansion, architecture or data-model changes, destructive/irreversible actions, production-impacting changes, or major UX/product decisions.
- Production-impacting actions include deployment, production migrations/seeds, credential rotation, hosted-service mutation, public artifact publication, external messaging, and merging or pushing to the protected default branch.
- Diagnosis, implementation, verification, integration, merge, and deployment are distinct. Never claim a later state without evidence for it.

## Worktree and branch boundaries

- Every agent works only inside its assigned Orca worktree. The worktree is its isolated execution boundary: never edit another agent's worktree or assume another worktree's uncommitted changes are present.
- Verify the worktree path, `git status`, current branch, HEAD, upstream, and intended base before edits. A UI/session label alone is not authority.
- `main` is the protected default branch. Agents may inspect it, but must not commit, merge, rebase, reset, or push it directly.
- `agent/v3-foundation-core` is the current V3 integration branch, not production. A designated coordinator may integrate reviewed work there within approved scope.
- Concurrent V3 writers use unique task branches in separate Orca worktrees. Explicitly parent the task worktree from verified V3 state and confirm its Git merge-base is the intended `agent/v3-foundation-core` HEAD, or explicitly select that verified HEAD as the Git base. Do not create an independent/default-based V3 worktree that may start from `main`.
- A task branch is a delivery branch, not a replacement V3 branch. Agents may edit, test, and—when implementation is assigned—commit verified scoped work there. They do not push, open reviews, or integrate unless the task brief grants that authority.
- Preserve existing uncommitted work. Never reset, discard, delete, or rewrite history to obtain a clean state.

## Execution

1. Confirm the task is `approved`; record scope, acceptance criteria, owned files, dependencies, validation, and delivery mode.
2. Inspect relevant routes, services, schema, tests, configuration, history, and established patterns.
3. Make the smallest coherent change. Preserve behavior, interfaces, and data unless the approved task requires otherwise.
4. Add meaningful tests for success, failure, authorization, privacy, and integrity as applicable.
5. Run narrow checks first, then applicable project checks: `pnpm lint`, `pnpm check`, `pnpm test:unit -- --run`, `pnpm test:e2e`, worker tests, and `pnpm build`. Report baseline failures separately from regressions.
6. For UI work, inspect loading, empty, error, keyboard, reduced-motion, and responsive behavior from 320px upward in a real browser when possible.
7. Mark `verified` only with exact evidence. Record skipped or blocked validation.

## Parallel work and integration

- Each writable task has one worktree, one agent owner, and non-overlapping file/subsystem ownership. Read-only investigations may run in parallel without branch changes.
- Keep the Orca worktree comment current at meaningful checkpoints. Use Orca's nearest workspace status and record the canonical state in the comment when Orca has no exact equivalent.
- Delivery is either read-only findings or a verified commit SHA, as declared in the task brief. Do not hand off ambiguous uncommitted edits between worktrees.
- The coordinating agent reviews the complete commit/diff, checks dependencies and conflicts, integrates in dependency order, and re-runs relevant verification on the target branch.
- Only the designated coordinator may mark work `merged`. Only verified environment evidence may mark it `deployed`. Do not remove a task worktree before integration is accepted.

## Stop conditions

Stop, mark `blocked`, preserve the worktree, and report the safest next action when:

- conflicting uncommitted changes are present;
- Git, branch, upstream, base, or Orca worktree state is unclear or stale;
- a destructive or irreversible action is required;
- credentials, permissions, or additional authority are required;
- acceptance criteria conflict or materially change;
- production safety, data integrity, privacy, or security would materially change.

Do not guess through a stop condition.

## Product and data safety

- Reuse existing SvelteKit, Svelte 5, Drizzle, component, and test patterns; avoid speculative rewrites, dependencies, and unrelated cleanup.
- Keep GET, search, preload, and hover paths side-effect free and bounded.
- Enforce authentication and authorization on the server; UI visibility is not authorization.
- Adult/custom content fails closed and remains isolated from standard browse, search, detail, artwork, cache, recommendations, and sources.
- Never add hard-coded or logged secrets, arbitrary iframe playback, or unreviewed streaming mirrors.
- Schema changes require deployed-state evidence, additive migrations, backup/rollback, and explicit approval. Never seed or migrate production implicitly.

## Handoff

Report the canonical state, worktree/branch and commit if any, scope completed, files/boundaries changed, validation and exact results, remaining issues, risks, blockers, rollback path, and safest next step.
