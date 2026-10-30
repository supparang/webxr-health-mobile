# CSAI2401 Local Assessment — Trust Boundary and Teacher Acceptance

## Status
This module supports **practice progress only**. It does **not** establish trustworthy, official grades. Browser-side `localStorage`, curriculum, JavaScript functions, attempts, and Evidence Pack submissions are user-controllable. Even the newly introduced canonical answer regrading cannot prevent a learner from editing browser state or code.

## What the implementation checks
- The scenario and option IDs belong to the canonical 15-week curriculum.
- A submitted step score matches the curriculum-defined option score.
- Each step cites a valid, scenario-specific evidence ID and a limitation statement.
- W5, W10, W15 require 3, 4, 7 *distinct* structured claims respectively, each referencing a source from the current scenario; submission is rejected before consuming the last step if incomplete.
- The final score is recomputed from saved option IDs; completed attempts remain local and are explicitly marked `official:false` and `reviewStatus:'pending-instructor-review'`.
- Existing legacy completions remain visible for continuity; they are **not retrospectively certified**.

## What is NOT verified
- Semantic correctness of a written evidence claim, accuracy of the citation, authenticity of the actor, or personal identity.
- Tamper-proof history, anti-replay protection across browsers, or integrity of client-supplied timestamps.
- Official teacher approval, institutional grade ledger, multi-device synchronization, or a remote authority.
- Previously imported/legacy completion flags against today's stricter Evidence Pack requirements.

## Requirements before using results for official evaluation
1. Define a trusted backend and authenticated learner identity tied to the official class roster; the browser must never decide the final official outcome.
2. Implement an authenticated attempt API with an idempotency key, server-issued challenge and server-side curriculum scoring; never accept `score`, `official`, or `passed` directly from the client.
3. Persist immutable attempt events, evidence source IDs, claims, versioned rubric IDs, and a reviewer decision in the server ledger, with timestamps and an audit trail.
4. Require a teacher review before approving Boss Evidence Packs and expose `pending`, `approved`, `rejected` states separately from learner practice completion.
5. Test offline failure, retry, duplicate submissions, version migrations, identity binding, cross-device resume, and permissions before rollout.
6. Preserve historical local progress; migrate only with explicit provenance and avoid overwriting older evidence or scores.

## QA command
`node --test csai2104/tests/*.test.cjs`

**Release rule:** Green local/CI tests mean the *practice mechanics* meet their current deterministic checks. They are not evidence of official grade security or a complete browser/mobile acceptance test.
