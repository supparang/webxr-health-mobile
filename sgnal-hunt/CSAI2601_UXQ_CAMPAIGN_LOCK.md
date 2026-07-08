# CSAI2601 UX Quest — Campaign Lock

> This document is the single game-map reference for CSAI2601. The course description defines the sequence; UX Quest is the practice, replay, evidence and teacher-dashboard layer.

## Canonical decision

- Course path uses **W1–W15 + B1–B4** only.
- **No B5**. Week 15 is the Final Studio / Portfolio Presentation node.
- Boss cadence is locked as:
  - **B1 after W3**: UI/UX foundation, HCD and psychology.
  - **B2 after W7**: user research, problem framing, IA, flow and wireframe.
  - **B3 after W11**: pattern library, responsive design, accessibility, color and typography.
  - **B4 after W14**: high-fidelity prototype, evaluation, iteration and validation.
- W8 is **Midterm Studio / Design Review**, not a boss gate.
- W15 is **Final Studio / UX/UI Portfolio**, not a boss gate.

## Campaign arc

| Week / Gate | Curriculum focus | Playable mission | Core playable challenge | Evidence / studio transfer |
|---|---|---|---|---|
| W1 | UI/UX and Front-end Design | **UX First Responder** | Task → friction → UI/UX impact → fix → test | UX First Impression Audit |
| W2 | UX/UI Process and Human-Centered Design | **Evidence Before Design** | Evidence vs assumption, HCD process order | UX Process Map / HCD sprint brief |
| W3 | Psychology for Interface Design | **Mind Load Rescue** | Cognitive load, feedback, affordance, mental model | Cognitive Load Repair Note |
| B1 | W1–W3 synthesis | **Foundation Boss: Cognitive Storm** | UI/UX + HCD + psychology evidence defense | Foundation UX Defense Sheet |
| W4 | User empathy, interview, persona and empathy map | **Empathy Detective** | Fact / opinion / pain point / design opportunity | Interview Note + Persona Lite |
| W5 | Problem statement, HMW, ideation and storyboard | **Problem Alchemist** | Insight → problem statement → HMW → concept | Problem Statement + HMW + Concept Storyboard |
| W6 | Information architecture, sitemap and user flow | **Flow Architect** | Navigation, IA, happy path and error path | Sitemap + Main User Flow + Error Path |
| W7 | Wireframe, grid, layout and visual hierarchy | **Wireframe Rescue** | Content priority, CTA placement, mobile-first layout | Low-fi Wireframe 5 screens |
| B2 | W4–W7 synthesis | **Flow & Wireframe Boss** | User insight → problem → flow → wireframe defense | Flow/Wireframe Defense Sheet |
| W8 | Midterm Studio / Design Review | **Midterm Studio Checkpoint** | Evidence-to-wireframe blueprint critique | Midterm UX Blueprint |
| W9 | Pattern Library, Design System and UI Kit | **Pattern Keeper** | Component, state, variant and consistency | UI Kit Charter |
| W10 | Responsive Website Design and Accessibility | **Responsive Guardian** | Breakpoints, mobile layout, touch target, a11y | Responsive + Accessibility Plan |
| W11 | Color, Typography and Visual Accessibility | **Visual Signal Control** | Color meaning, type hierarchy, contrast and readability | Visual Style Guide |
| B3 | W9–W11 synthesis | **Interface System Boss** | Design system + responsive + visual accessibility defense | Interface System Defense Sheet |
| W12 | Interaction Design and Component States | **Interaction Signal** | Loading, empty, error, success, feedback states | Component State Spec |
| W13 | High-fidelity Prototype and Interactive Flow | **Prototype Builder** | Testable prototype, links, flow and rationale | Clickable Hi-fi Prototype |
| W14 | Heuristic, Cognitive Walkthrough, Usability Test and Iteration | **Evidence Lab** | Findings, severity, evidence-based fix and retest | Usability Iteration Log |
| B4 | W12–W14 synthesis | **Validation Boss** | Prototype evidence, severity ranking, iteration defense | Prototype Validation Defense Sheet |
| W15 | Final Studio and UX/UI Portfolio Presentation | **Portfolio Finalizer** | Case study narrative, evidence, prototype, testing and reflection | Final UX/UI Case Study Portfolio |

## Mandatory learning layer for every W node

Every weekly node must include all six layers below.

1. **Concept** — the weekly principle or method.
2. **Case** — a realistic UX/UI situation that requires judgment.
3. **Mission** — playable decision-making, not recall-only quiz.
4. **Reason Check** — required explanation for core decisions.
5. **Artifact** — studio output that transfers into the final portfolio.
6. **Evidence** — data fields visible to Teacher Dashboard.

## Mandatory learning layer for every Boss Gate

Every Boss Gate must synthesize earlier weeks and must include:

- New transfer scenario, not a copied weekly question.
- Multi-round challenge.
- Evidence matching.
- Reason defense.
- Retry improvement.
- Reflection.
- Clear pass criteria.
- Teacher Dashboard event / attempt evidence.

## Replay and anti-guessing rules

1. Draw cases from rotating banks and retain recent-case history.
2. Shuffle answer positions every round.
3. Never make the longest answer consistently correct.
4. Use plausible distractors with explicit misconception tags.
5. Require Reason Check for high mastery.
6. Speed alone cannot earn 3 stars.
7. Replays must surface new variants before repeating recent ones.
8. Boss Gates must mix concepts from multiple weeks.
9. Retry must record what improved, not merely replace the score.
10. Teacher Dashboard must show reasoning evidence, not only score.

## Required Teacher Dashboard fields

- studentId
- studentName
- section
- courseId = `CSAI2601`
- nodeId, caseId, missionId
- score, stars, accuracy, correct, wrong, timeUsed
- retryCount, hintUsed
- selectedAnswer, selectedReason
- reasonCheckPassed
- artifactSubmitted
- reflection
- learnedPoint
- misconception
- bossGatePassed
- timestamp

## Current playable state

- `sgnal-hunt/csai2601-mission-control.html` is the canonical Mission Control entry.
- Mission Control renders from `sgnal-hunt/js/uxq-csai2601-canonical-content-v1.js`.
- Every W/B node launches through `sgnal-hunt/csai2601-canonical-node.html?node=<NODE_ID>`.
- The canonical node player records progress through `uxq-progress-v4.js` and keeps the 2★ unlock rule.
- All W1–W15 and B1–B4 now have a safe playable canonical layer with case rotation, shuffled options, Reason Check, artifact prompts and dashboard-ready evidence fields.
- Legacy rich pages may still exist, but the canonical Mission Control no longer depends on old B5-era labels or old hard-coded paths.
