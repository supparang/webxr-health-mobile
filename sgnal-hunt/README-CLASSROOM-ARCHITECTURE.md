# UX Quest Act I — Classroom Architecture

## Current deployment model

UX Quest uses two separate Google Apps Script web apps.

| Component | Purpose | Access policy |
|---|---|---|
| **Student Receiver** | Accepts `mission_completed` events from GitHub Pages and appends them to `UXQuest_Attempts`. | `Anyone` — write-only endpoint required for student browsers. |
| **Teacher Dashboard** | Reads the same spreadsheet and presents readiness, individual learning evidence, attempt logs, misconceptions, CSV export, and printable reports. | Teacher-only or authorised university users. |

Do **not** deploy the Teacher Dashboard from the same Apps Script project or deployment as the Student Receiver. The receiver is intentionally public so a browser running the game can post a result; the dashboard must remain restricted because it reads learner data.

## Student-side files in this repository

The deployed game code is in `/sgnal-hunt/`.

- `index.html` — Mission Control
- `w1-ux-crisis-casefile.html` — W1 UX Detective
- `w2-design-thinking-sprint.html` — W2 Design Thinking Sprint
- `w3-cognitive-load-escape.html` — W3 Cognitive Load Escape
- `b1-cognitive-storm.html` — B1 Cognitive Storm
- `js/uxq-classroom-config-v2.js` — public, write-only receiver configuration
- `js/uxq-analytics-v2.js` — completion payload and queue handling
- `js/uxq-identity-v1.js` — local student profile
- `js/uxq-mission-engine-v3.js` — reusable game engine
- `js/uxq-progress-v2.js` — storage-safe progression

## Teacher Dashboard checks

Before a teaching session, confirm that the private dashboard shows:

1. the expected section and learner profile;
2. a new attempt after a completed mission;
3. Bangkok time labels in the Student learning view and Attempt log;
4. a complete row in `UXQuest_Attempts` with mission, score, stars, accuracy, hints, duration, and case ID.

## Data-handling boundary

The game stores only learning-operational fields needed for feedback and teaching decisions: learner ID/name/section, mission result, aggregate performance, case ID, selected answer evidence, and timestamps. The Teacher Dashboard is intended for formative instruction and should not be treated as an automated high-stakes grading system.

## Change control

When changing game content or scripts:

1. update the public student files in this repository;
2. deploy GitHub Pages and test one complete mission;
3. validate that one row is written to the receiver sheet;
4. update the private Teacher Dashboard Apps Script separately only when its data model or display logic changes.
