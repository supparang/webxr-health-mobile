# UX Quest Teacher Dashboard v3.1 — Best Verified + compact learning view

## Why this patch exists

A learner can have an old pre-Reason-Check 3-star attempt and a newer 2-star attempt with real verified reasoning. The normal `bestMissions` map is intentionally star-first so Act I clearance remains correct, but it must **not** be reused for Best Verified.

Without a separate evidence-first map, the dashboard can show `Best Verified: N/A` even when the learner has a valid current Reason Check record.

This patch also places `Reasoning gaps` below the student table on wide screens so a short learner table does not leave a large empty area beside a tall gap list.

## 1) Add this function immediately after `bestByStudentMission(rows)`

```javascript
function bestReasoningByStudentMission(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const info = reasoning(row);
    if (!info.available) return;

    const key = `${row.studentId}__${row.missionId}`;
    const current = map.get(key);

    if (!current) {
      map.set(key, row);
      return;
    }

    const currentInfo = reasoning(current);

    if (
      info.verifiedAccuracy > currentInfo.verifiedAccuracy ||
      (
        info.verifiedAccuracy === currentInfo.verifiedAccuracy &&
        num(row.stars) > num(current.stars)
      ) ||
      (
        info.verifiedAccuracy === currentInfo.verifiedAccuracy &&
        num(row.stars) === num(current.stars) &&
        dateValue(row) > dateValue(current)
      )
    ) {
      map.set(key, row);
    }
  });

  return map;
}
```

## 2) Replace the opening lines of `studentSummaries(rows)`

Replace:

```javascript
const latestMission = latestByStudentMission(rows);
const bestMission = bestByStudentMission(rows);
const people = new Map();
```

With:

```javascript
const latestMission = latestByStudentMission(rows);
const bestMission = bestByStudentMission(rows); // keeps clearance / stars logic
const bestReasoningMission = bestReasoningByStudentMission(rows);
const people = new Map();
```

## 3) Add an evidence map to each person object

Inside the `if (!people.has(key))` object, add:

```javascript
bestReasoningMissions: {}
```

The object should contain these three maps:

```javascript
latestMissions: {},
bestMissions: {},
bestReasoningMissions: {}
```

## 4) Add this map assignment before the `return [...people.values()]` statement

```javascript
bestReasoningMission.forEach((row) => {
  const key = row.studentId || `${row.studentName}__${row.section}`;
  if (people.has(key)) {
    people.get(key).bestReasoningMissions[row.missionId] = row;
  }
});
```

## 5) Use the evidence-first map in `renderStudentRows(rows)`

Replace:

```javascript
missionCell(person.latestMissions[id], person.bestMissions[id])
```

With:

```javascript
missionCell(person.latestMissions[id], person.bestReasoningMissions[id])
```

Then replace:

```javascript
const bestVerified = Object.values(person.bestMissions)
  .filter((row) => reasoning(row).available)
```

With:

```javascript
const bestVerified = Object.values(person.bestReasoningMissions)
```

This keeps the existing `cleared` calculation based on `bestMissions`, while Best Verified now correctly selects the learner's strongest evidence-bearing result.

## 6) Compact the Student learning view layout

At the end of the dashboard `<style>` block, add:

```css
/* v3.1: avoid a large empty area when the gap list is taller than the student table */
.section.split { grid-template-columns: 1fr; }
.section.split > aside { margin-top: 2px; }
.section.split > aside .mis-list {
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  align-items: start;
}
```

## Expected result with the current classroom data

- **KK**: `Best Verified` must no longer be `N/A`; it should surface the newer B1 evidence result at **50%**.
- **KP**: `Best Verified` remains **91%** from W1.
- Act I clearance remains **4/4** for both learners because it still uses the best star record.
- Results before Reason Check remain `N/A`; they never influence Best Verified or anti-guess status.
