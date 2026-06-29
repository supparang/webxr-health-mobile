# UX Quest Teacher Dashboard v3.4 — Reason Check Review Queue

## Purpose

This patch adds a **teacher-facing review queue** for attempts that passed the game but still need attention to the learner's reasoning. It keeps the pedagogical distinction visible:

- **Game Readiness** = the learner can continue the Act I path.
- **Reason Check** = the learner can explain the decision with evidence.
- **Teacher review** = formative feedback only; it does not automatically deduct marks, revoke stars, or lock missions.

The queue identifies three situations:

1. `awaiting_retry` — Reason Check is below 70% and the learner has not yet sent an Explain Why Retry.
2. `pending_teacher_review` — the learner submitted a 1–2 sentence explanation and the teacher can now verify or guide it.
3. `rapidAttemptFlag` — a prompt to inspect evidence further, not an automatic penalty.

## Deployment boundary

UX Quest intentionally uses **two Apps Script web apps**:

1. **Public Student Receiver** — accepts write-only evidence from GitHub Pages.
2. **Private Teacher Dashboard** — reads learning evidence and shows the review queue.

Do not merge these deployments. The receiver remains public for student browsers; the dashboard remains restricted because it reads learner data.

## Step 1 — update the public Student Receiver

Add `UXQ_REASON_RETRY_RECEIVER_PATCH.gs` to the **public receiver** Apps Script project.

Then add its small integration block directly after the receiver parses `payload` and before it rejects or branches on `mission_completed`. Reuse the receiver's existing generic append routine so the complete event JSON is stored in the same payload/details column in `UXQuest_Attempts`.

The new event is:

```text
reason_retry_submitted
```

It carries `linkedAttemptId`, which connects the learner's short explanation back to the completed W1/W2/W3/B1 attempt.

Save and deploy a **new version of the public receiver** after this change.

## Step 2 — update the private Teacher Dashboard

1. Add `UXQ_REASON_CHECK_REVIEW_QUEUE_PATCH.gs` as a new `.gs` file.
2. Add `UXQ_REASON_CHECK_REVIEW_QUEUE_COMPONENT.html` as a new HTML file.
3. In the private dashboard HTML, insert this directly after the existing **Reasoning & Anti-Guess view**:

```html
<?!= include('UXQ_REASON_CHECK_REVIEW_QUEUE_COMPONENT'); ?>
```

The component calls these server functions itself:

```js
uxqGetReasonReviewQueue();
uxqSaveReasonReview(input);
```

Save and deploy a **new version of the teacher-only dashboard**.

## New review sheet

On the first teacher decision, the patch creates:

```text
UXQuest_ReasonReview
```

Columns:

```text
reviewKey | linkedAttemptId | studentId | missionId | reviewStatus |
feedbackCode | teacherNote | reviewer | updatedAt
```

`UXQuest_Attempts` remains the append-only raw evidence source. The new sheet stores only teacher decisions.

## Teacher decision codes

| Code | Meaning | Appropriate feedback focus |
|---|---|---|
| `CL` | Clarity | The explanation needs a clearer cause–effect chain. |
| `EV` | Evidence | The explanation should cite behaviour, observation, or user context. |
| `ST` | Scenario transfer | The learner should connect the principle to this particular case. |
| `QA` | Question prompt | Use a short follow-up question rather than supplying the answer. |

## Student-side companion

GitHub Pages now loads:

- `js/uxq-reason-retry-transport-v1.js`
- `js/uxq-explain-why-retry-v1.js`

They add **Explain Why Retry** only after a completed mission when the Reason Check is below the mastery threshold. The learner writes one or two sentences; this is sent as a separate `reason_retry_submitted` event and does not alter the completed mission result.

## Verification checklist

1. Complete W2, W3, or B1 with a Reason Check below 70%.
2. Confirm the result page displays **Explain Why Retry**.
3. Send one short explanation.
4. Confirm the public receiver appends a raw `reason_retry_submitted` row to `UXQuest_Attempts`.
5. Refresh the private Teacher Dashboard.
6. Confirm that the queue changes from `awaiting_retry` to `pending_teacher_review`.
7. Save `Verified`, `Prompt again`, or `Discuss in class` with an optional feedback code.
8. Confirm `UXQuest_ReasonReview` contains one row linked to the original `attemptId`.
