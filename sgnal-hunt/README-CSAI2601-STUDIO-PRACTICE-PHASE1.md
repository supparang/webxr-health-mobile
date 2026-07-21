# CSAI2601 UX Quest — Studio Practice, Reflection, Review and Portfolio

Version: `20260721-STUDIO-WORKFLOW-V1`

Scope: **W1–W15 + B1–B4**

## Purpose

This package extends CSAI2601 from a mission-only game into the same learning-platform pattern used by CSAI2102:

```text
Mission → Studio Practice → Weekly Reflection → Teacher Review → Revision → Portfolio
```

Google Sheet remains the sole source of truth for official progress, studio submissions, reviews and portfolio readiness. `localStorage` is used only for temporary drafts and an unsent queue.

## Canonical Studio artifacts

| Node | Studio artifact |
|---|---|
| W1 | UX First Impression Audit |
| W2 | UX Process Map / HCD Sprint Brief |
| W3 | Cognitive Load Repair Note + Before–After |
| B1 | Foundation UX Defense Sheet |
| W4 | Interview Note + Persona Lite |
| W5 | Problem Statement + HMW + Concept Storyboard |
| W6 | Sitemap + Main User Flow + Error Path |
| W7 | Low-fi Wireframe 5 Screens |
| B2 | Flow/Wireframe Defense Sheet |
| W8 | Midterm UX Blueprint |
| W9 | UI Kit Charter |
| W10 | Responsive + Accessibility Plan |
| W11 | Visual Style Guide |
| B3 | Interface System Defense Sheet |
| W12 | Component State Specification |
| W13 | Clickable Hi-fi Prototype |
| W14 | Usability Iteration Log |
| B4 | Prototype Validation Defense Sheet |
| W15 | Final UX/UI Case Study Portfolio |

## Files

### Student

- `js/uxq-studio-practice-canonical-v1.js`
- `js/uxq-studio-practice-canonical-all-v2.js`
- `js/uxq-studio-practice-ui-v1.js`
- `js/uxq-studio-practice-submit-v1.js`
- `js/uxq-studio-status-v1.js`
- `csai2601-canonical-node-clean-v1.html`
- `csai2601-mission-control.html`

### Apps Script

- `UXQuestStudioWorkflow-v1.gs`
- `UXQuestStudioRouterPatch-v1.gs`
- `UXQuestStudioDashboard-v1.html`
- `UXQuestPortfolioBuilder-v1.html`

### Tests

- `test_csai2601_studio_phase1.js`
- `test_csai2601_studio_all19.js`

## Data contracts

Mission completion remains:

```text
mission_completed
```

Student Studio submission remains backward compatible with Receiver v4:

```text
eventType = artifact_submitted
schema = uxq.studio-artifact.v1
```

Teacher review is stored in `UXQuest_Studio_Reviews` and audit events in `UXQuest_Studio_Audit`.

Review statuses:

```text
submitted
reviewing
need_revision
approved
```

## Project continuity

Every node requires the same `projectId` from W1 through W15.

Recommended format:

```text
UXQ-<SECTION>-<STUDENT_ID>-<PROJECT_SLUG>
```

The Student Studio Status and Teacher Dashboard flag multiple Project IDs for the same student.

## Teacher review rubric

Five dimensions use 0–4 points:

- Evidence — 25%
- UX Reasoning — 25%
- Artifact Quality — 25%
- Validation — 15%
- Reflection & Revision — 10%

The backend converts the weighted rubric to a 0–100 score.

## Deployment

### Student Receiver / Progress Web App

Copy `UXQuestStudioWorkflow-v1.gs` and `UXQuestStudioRouterPatch-v1.gs` into the Apps Script project that already contains the Student Receiver and Progress Restore.

Add before the unknown-action fallback in the existing `doGet(e)`:

```javascript
const studio = UXQ_routeStudioGet_(e);
if (studio) return studio;
```

Run once:

```javascript
UXQ_setupStudioWorkflow()
```

Redeploy the Web App.

### Private Teacher Dashboard Web App

Copy the two `.gs` files plus `UXQuestStudioDashboard-v1.html` and `UXQuestPortfolioBuilder-v1.html`.

Add before the current default Teacher Dashboard output:

```javascript
const studio = UXQ_routeStudioTeacherGet_(e);
if (studio) return studio;
```

Teacher URLs:

```text
/exec?view=studio
/exec?view=portfolio
```

The Teacher Web App must remain private and execute as the teacher.

## Unlock policy

This package deliberately does not change the production unlock rule:

```text
Official unlock = contiguous Sheet-confirmed mission_completed rows
```

Studio and Reflection are displayed and reviewed, but they do not yet block the next node. Teacher approval should never block the next node because delayed review could stop the entire class.

## Acceptance tests

1. All 19 nodes show the correct Studio Artifact and a node-specific Reflection.
2. Every node has exactly eight Receiver-safe fields.
3. Required fields, URL validation and five self-checks block incomplete submissions.
4. Network failure queues the submission and reconnect retries it.
5. Mission Control shows Sheet-backed Studio and review status.
6. Studio status never changes mission unlock.
7. Sheet rows contain `schema = uxq.studio-artifact.v1`, all eight fields and a correct `linkedAttemptId`.
8. Teacher Dashboard filters by Section and Student/Project.
9. Teacher can open Figma evidence and set Reviewing, Need Revision or Approved.
10. Weighted rubric score is correct and an audit row is written.
11. Portfolio Builder renders all 19 nodes and can Print/Save PDF.
12. A student with no Sheet record still starts at W1 and cross-device resume remains Sheet-authoritative.

## Production blockers

Before merge/deployment:

- Rebase the branch onto current `main`.
- Resolve conflicts in the canonical node and Mission Control files.
- Run browser QA on desktop and mobile.
- Deploy Receiver v4 Artifacts and the Studio GET route.
- Test one complete student flow against the real Sheet.
- Confirm the private Teacher Dashboard cannot be opened anonymously.
