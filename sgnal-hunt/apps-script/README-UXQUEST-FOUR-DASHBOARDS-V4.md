# CSAI2601 UX Quest — Four Analytics Dashboards V4

Version: `20260718-UXQ-ANALYTICS-V4`

## Delivered components

1. `UXQuestAnalyticsEngine-v4.gs` — shared calculations for Question Analytics, Learning Prediction, Section Comparison, Research Dashboard, CSV exports, effect sizes and data-quality checks.
2. `UXQuestAnalyticsDashboard-v4.html` — responsive four-tab private Teacher Dashboard UI.
3. `UXQuestAnalyticsReceiverPatch-v4.gs` — public write-only receiver handlers for item responses and reflections. It intentionally declares no `doPost` or `doGet`.
4. `../js/uxq-item-analytics-v4.js` — browser logger with offline queue and retry.

## Security boundary

Keep the existing two-project deployment:

- Public Student Receiver: accepts writes only.
- Private Teacher Dashboard: reads the spreadsheet and performs analytics.

Do not put the private dashboard in the public receiver project.

## Teacher Dashboard installation

1. Open the private Teacher Dashboard Apps Script project.
2. Add `UXQuestAnalyticsEngine-v4.gs`.
3. Add an HTML file named `UXQuestAnalyticsDashboard-v4` and paste the HTML content.
4. In the existing teacher `doGet(e)` router, add:

```javascript
if (String(e.parameter.page || '') === 'analytics_v4') {
  return HtmlService
    .createTemplateFromFile('UXQuestAnalyticsDashboard-v4')
    .evaluate()
    .setTitle('CSAI2601 Analytics Suite')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

5. Run `UXQA_setupAnalyticsSheets()` once from the editor and grant permissions.
6. Open the private dashboard URL with `?page=analytics_v4`.

If the teacher project is standalone, set Script Property `SPREADSHEET_ID`. If it is bound to the data spreadsheet, the engine will use the active spreadsheet.

## Public Receiver installation

1. Add `UXQuestAnalyticsReceiverPatch-v4.gs` to the existing public receiver project.
2. In the existing `doPost(e)`, parse the JSON payload once.
3. Call `UXQAR_tryHandle(payload)` before the normal `mission_completed` handler.
4. If the function returns a result, return that response immediately.
5. Deploy a new receiver version without changing the public URL.

Example:

```javascript
function doPost(e) {
  var payload = JSON.parse((e.postData && e.postData.contents) || '{}');
  var analyticsResult = UXQAR_tryHandle(payload);
  if (analyticsResult) {
    return ContentService
      .createTextOutput(JSON.stringify(analyticsResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return EXISTING_RECEIVER_HANDLER(payload);
}
```

## Student page installation

Add after the classroom configuration script and before each mission script:

```html
<script src="js/uxq-item-analytics-v4.js"></script>
```

When an answer is confirmed:

```javascript
UXQItemAnalytics.logItem({
  attemptId: currentAttemptId,
  missionId: 'W2',
  questionId: item.id,
  questionVersion: item.version || '1',
  concept: item.concept,
  optionOrder: displayedOptions.map(function(o){ return o.id; }),
  selectedOption: selected.id,
  correctOption: item.correctOption,
  isCorrect: selected.id === item.correctOption,
  questionStartedAt: questionStartedAt,
  selectedReason: selectedReason,
  correctReason: item.correctReason,
  reasonCorrect: selectedReason === item.correctReason,
  hintUsed: hintCount,
  retryNumber: retryNumber
});
```

When reflection is submitted:

```javascript
UXQItemAnalytics.logReflection({
  attemptId: currentAttemptId,
  missionId: 'W2',
  problemSeen: form.problemSeen,
  uxReason: form.uxReason,
  fixAndTest: form.fixAndTest,
  reflectionText: form.reflectionText
});
```

## Sheets created

- `UXQuest_Item_Responses`
- `UXQuest_Reflections`
- `UXQuest_Interventions`
- `UXQuest_Analytics_Snapshots`

The existing `UXQuest_Attempts` remains the source for official mission results. New sheets add analytical evidence; they do not unlock missions or alter pass/fail.

## Dashboard definitions

### Question Analytics

- Difficulty: correct responses / responses.
- Discrimination: upper 27% correct rate minus lower 27% correct rate.
- Reason Gap: answer accuracy minus verified reason accuracy.
- Flags: small N, too easy/hard, negative/low discrimination, high Reason Gap, rapid guessing and dead distractors.

### Learning Prediction

The first release is an explainable rule-based early-warning model. Risk reasons are always displayed. It is instructional support, not an automated grade or disciplinary decision.

### Section Comparison

Reports learner count, attempts, mean/median/SD, pass rate, Reason Gap, median time, reflection quality, completeness, 95% confidence interval and Hedges' g. Small groups are flagged.

### Research Dashboard

Provides first/latest/best score, raw and normalized gain, retry pattern, reflection quality, time-on-task, hint rate, paired-sample effect size and pseudonymous participant keys. Export formats:

- student-level wide
- attempt-level long
- item-response long
- reflection-coded
- question analysis
- prediction
- section comparison

## Acceptance tests

1. Complete one question and verify one row in `UXQuest_Item_Responses`.
2. Submit one reflection and verify one row in `UXQuest_Reflections`.
3. Confirm the dashboard can switch all four tabs without another Sheet read.
4. Confirm question N and response counts match the sheet.
5. Confirm each non-low risk learner has at least one displayed reason.
6. Confirm section totals match the same filtered attempts.
7. Export every CSV and open it in Excel or import it into SPSS/R/Python.
8. Confirm research export uses `participantKey`; names are not included in the research-wide dataset.
9. Confirm missing data displays as `—` or `INSUFFICIENT`, not zero.
10. Confirm the existing student game, progress and Boss unlock behavior remain unchanged.

## Known analytical limitations

- Difficulty and discrimination are unstable with small samples; rows with fewer than 10 responses are flagged.
- Prediction quality depends on complete timestamps, item logs and reflection evidence.
- Reflection auto-quality is preliminary coding and should be teacher-reviewed for formal research.
- Time-on-task is only as accurate as the active-duration fields supplied by mission scripts.
