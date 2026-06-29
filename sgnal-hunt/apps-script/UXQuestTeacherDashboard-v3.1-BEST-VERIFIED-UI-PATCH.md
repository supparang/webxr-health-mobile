# UX Quest Teacher Dashboard v3.2 — Live blank-screen + Best Verified hotfix

## Root cause

The v3.1 patch added `bestReasoningMissions`, but its fragment did not initialize `person.latest` when creating a learner object. The live dashboard then calls `dateValue(person.latest)`, causing a JavaScript runtime error and stopping the full render. This is why filters appeared while all dashboard data stayed blank.

## Apply these two replacements in `UXQuestTeacherDashboard.html`

### 1) Replace the existing `dateValue` function

```javascript
const dateValue = (row) => {
  const raw =
    row?.completedAt ||
    row?.occurredAt ||
    row?.receivedAt ||
    '';

  const value = new Date(raw).getTime();
  return Number.isFinite(value) ? value : 0;
};
```

### 2) Replace the entire `studentSummaries(rows)` function

```javascript
function studentSummaries(rows) {
  const latestMission = latestByStudentMission(rows);
  const bestMission = bestByStudentMission(rows); // clearance / stars only
  const bestReasoningMission = bestReasoningByStudentMission(rows);
  const people = new Map();

  rows.forEach((row) => {
    const key = row.studentId || `${row.studentName}__${row.section}`;

    if (!people.has(key)) {
      people.set(key, {
        key,
        id: row.studentId,
        name: row.studentName,
        section: row.section,
        latest: row,
        latestMissions: {},
        bestMissions: {},
        bestReasoningMissions: {}
      });
      return;
    }

    const person = people.get(key);

    if (dateValue(row) > dateValue(person.latest)) {
      person.latest = row;
    }
  });

  latestMission.forEach((row) => {
    const key = row.studentId || `${row.studentName}__${row.section}`;
    if (people.has(key)) {
      people.get(key).latestMissions[row.missionId] = row;
    }
  });

  bestMission.forEach((row) => {
    const key = row.studentId || `${row.studentName}__${row.section}`;
    if (people.has(key)) {
      people.get(key).bestMissions[row.missionId] = row;
    }
  });

  bestReasoningMission.forEach((row) => {
    const key = row.studentId || `${row.studentName}__${row.section}`;
    if (people.has(key)) {
      people.get(key).bestReasoningMissions[row.missionId] = row;
    }
  });

  return [...people.values()].sort((a, b) =>
    (a.section + a.name + a.id).localeCompare(b.section + b.name + b.id)
  );
}
```

## Result after deployment

- The dashboard renders all cards/tables again.
- **KK** Best Verified shows the strongest evidence-bearing result: **50% B1**.
- **KP** Best Verified remains **91% W1**.
- `4/4 cleared` still uses the original star-first `bestMissions` logic.
- Older attempts without Reason Check remain `N/A`, never high-risk by default.

## Deploy

Save the HTML file, then in the teacher Apps Script project: **Deploy → Manage deployments → Edit → New version → Deploy**. Refresh the dashboard page afterward.
