# Balance Hold — Guardian of the Crystal v13

Canonical game: `/fitness/balance-hold-ar2.html`

Release: `20260716-BALANCE-HOLD-TWIN-POSE-V13-END-TO-END`

## Classroom flow

1. Fitness Hub profile and Safety Gate
2. Warm-up gate
3. Personal full-body calibration
4. Twin Pose game: Sky Shield + Star Reach
5. Safe randomized sequence and Crystal Wind Boss
6. Explainable result
7. Required RPE/Pain check for an official round
8. Cooldown, replay, or return to Fitness Hub/Planner
9. Result and recovery payloads sent to Apps Script
10. Teacher Dashboard shows Balance pose metrics

## Canonical files

- `hub.html`
- `balance-hold-ar2.html`
- `bh-twin-core-v11.js`
- `bh-twin-sequence-v13.js`
- `bh-twin-evaluator-v11.js`
- `bh-twin-game-v11.js`
- `bh-twin-results-v11.js`
- `bh-twin-recovery-v13.js`
- `bh-twin-base-v11.css`
- `bh-twin-ui-v11.css`
- `bh-twin-polish-v12.css`
- `fitness-postgame-recovery-bridge.js`

`balance-hold.html` and `balance-hold-ar.html` are legacy redirects to the canonical game and preserve query parameters. `fitness/balance-hold/run.html` is a separate legacy DOM/VR activity and is not an entry point for the current four-game AR Fitness Hub.

## Apps Script dashboard deployment

GitHub Pages deployment does not deploy Apps Script source automatically.

In the existing Fitness Apps Script project:

1. Keep `fitness-dashboard-canonical-identity-lock-v3-6.gs`.
2. Add the contents of `fitness-dashboard-balance-pose-v3-7.gs` as a new `.gs` file.
3. Replace the Apps Script HTML file named `dashboard-fitness` with the contents of `fitness-dashboard.html`.
4. Save the project.
5. Deploy a **new Web App version** using the same access settings as the current deployment.
6. Open `?page=fitness-dashboard` and confirm that the version badge includes `V3-7-BALANCE-TWIN-POSE`.

Until this deployment is completed, the dashboard page falls back to backend v3.6 and displays a warning instead of failing.

## Sheet fields expected from a v13 official round

- `attemptId`, `roundId`, `submissionKey`
- `studentId`, `studentName`, `classId`, `section`
- `score`, `assessmentScore`, `completionRate`
- `poseAccuracy`, `stabilityScore`, `transitionScore`, `safeZoneScore`
- `trackingCoverage`, `trackingConfidence`, `validHoldRatio`
- `lostPoseCount`, `assistUsed`, `assistLevelMax`
- `calibrationStatus`, `poseSequence`, `sequencePatternId`
- `releaseVersion`, `canonicalPath`

The RPE/Pain payload uses `action: fitnessPostSurvey` and carries the same round/student context.

## Device acceptance test

Test at least one Desktop Chrome device and one Android Chrome device.

### Start and calibration

- Camera permission can be granted.
- The front-camera image and skeleton use the same left/right orientation.
- Calibration requires visible head, shoulders, wrists, hips, knees, and ankles.
- Moving the camera and selecting recalibration starts a clean calibration.

### Gameplay

- Sky Shield accepts a centered arm-level pose.
- Star Reach LEFT and RIGHT are not reversed.
- Feet leaving the safe area pauses valid hold counting.
- A short tracking interruption uses the grace period rather than resetting the pose immediately.
- Pause stops the game timer and resume does not lose time.
- A new round normally receives a different pattern from the immediately previous round.
- Easy, Normal, and Hard patterns are feasible within the selected time.

### Result and recovery

- Result metrics are shown separately.
- Demo mode does not submit or update personal best.
- Official Back, Home, and Replay require RPE/Pain first.
- Planner entry requires cooldown before returning to the planner.
- Offline recovery submissions are queued and retried when the browser comes online.

### Sheet and dashboard

- One official game round creates one Balance summary record.
- Refresh/repeated button presses do not create a duplicate round.
- One recovery record has the same `roundId`.
- The teacher dashboard displays pose, stability, transition, safe-zone, tracking, lost-pose, and assist values.
- Legacy Head-Control records are excluded from Twin Pose averages and support flags.

## Release sign-off

Code completion does not equal device sign-off. Mark v13 as production-approved only after:

- Desktop acceptance passed
- Android acceptance passed
- Apps Script v3.7 deployed
- One-row game submission verified
- Recovery submission verified
- Teacher Dashboard pose metrics verified
