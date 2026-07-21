# CSAI2601 UX Quest — Studio Practice Phase 1

Version: `20260721-STUDIO-PRACTICE-PHASE1-V1`

Scope: **W1, W2, W3 and B1**

## Purpose

This phase replaces the generic post-game note with structured studio evidence that matches the canonical CSAI2601 content exactly.

It does **not** change the current official unlock contract. Google Sheet `mission_completed` rows and the contiguous canonical path remain the sole authority for Mission Control and next-node access.

## Canonical alignment

| Node | Canonical content | Studio artifact |
|---|---|---|
| W1 | UI vs UX, user goal, task, context, friction, impact, fix, test idea | UX First Impression Audit |
| W2 | HCD / Design Thinking, evidence vs assumption, research planning | UX Process Map / HCD Sprint Brief |
| W3 | Cognitive load, attention, recognition vs recall, feedback, mental model, error prevention | Cognitive Load Repair Note + Before–After Redesign |
| B1 | W1–W3 synthesis | Foundation UX Defense Sheet |

## Files

- `js/uxq-studio-practice-canonical-v1.js`
  - Data-first studio specification.
  - Required fields, practice steps, self-checks, rubric, evidence mappings.
- `js/uxq-studio-practice-ui-v1.js`
  - Replaces the generic artifact block after the mission result.
  - Validates required fields, minimum evidence length, URL and self-checks.
  - Uses localStorage only for a temporary draft.
- `js/uxq-studio-practice-submit-v1.js`
  - Sends `artifact_submitted` through the existing Student Receiver contract.
  - Adds structured `artifactFields`.
  - Links the studio event to the stable `mission_completed` event ID through `linkedAttemptId`.
  - Includes an offline retry queue.
- `csai2601-canonical-node-clean-v1.html`
  - Loads the three Phase 1 modules.

## Data contract

The structured studio submission continues to use:

```text
eventType = artifact_submitted
schema = uxq.studio-artifact.v1
```

Important fields:

```text
studentId
studentName
section
missionId
attemptId
linkedAttemptId
projectId
figmaUrl
canonicalArtifact
artifactFields[]
problemSeen
uxReason
fixAndTest
reflection
learnedPoint
studioVersion
```

The existing Receiver v4 can accept the submission because the event remains `artifact_submitted`. Structured fields are preserved in `artifactFields` and the raw JSON. `linkedAttemptId` uses the existing receiver column.

## Project continuity

Students must use the same `projectId` from W1 through W15.

Recommended pattern:

```text
UXQ-<SECTION>-<STUDENT_ID>-<PROJECT_SLUG>
```

Example:

```text
UXQ-201-6500123-StudentService
```

## Unlock policy

Phase 1 deliberately keeps the current production rule:

```text
Official unlock = Sheet-confirmed mission_completed on the contiguous canonical path
```

Studio submission is visible learning evidence, but it does not yet block or unlock the next node.

This avoids changing production progression until the following are complete:

1. Receiver deployment is confirmed.
2. Teacher Studio Progress dashboard is available.
3. Artifact receipt confirmation is implemented.
4. W1–W3+B1 acceptance tests pass.
5. The instructor explicitly approves migration to `mission + studio submitted`.

## Acceptance tests

### UI

1. Complete W1 and confirm the generic note becomes `UX First Impression Audit`.
2. Confirm W2 does not ask for Persona or HMW.
3. Confirm W3 asks for Cognitive Load diagnosis and Before–After evidence.
4. Confirm B1 synthesizes W1–W3.
5. Confirm required fields and self-checks prevent an incomplete submission.
6. Confirm responsive layout on Android and desktop Chrome.

### Data

7. Submit W1 and verify one `artifact_submitted` row.
8. Confirm `schema = uxq.studio-artifact.v1`.
9. Confirm `linkedAttemptId` matches the stable W1 `mission_completed` event ID.
10. Confirm `artifactFields` includes `projectId`, `figmaUrl` and the W-specific evidence keys.
11. Disable the network, submit, reconnect and confirm the retry queue sends.
12. Confirm the submission does not alter official Mission Control unlock.

### Regression

13. W4–W15 and B2–B4 retain the existing artifact UI.
14. Mission score, Reason Check, anti-guessing and Sheet-confirmed next-node behavior remain unchanged.
15. A new learner with no Sheet progress still starts at W1.

## Next phase

After Phase 1 passes acceptance tests:

- Phase 2: W4–W8 + B2
- Phase 3: W9–W15 + B3–B4
- Teacher Dashboard: Studio Progress, review queue, revision status and project continuity checks
- Optional later migration: unlock next node only after mission pass + studio submission
