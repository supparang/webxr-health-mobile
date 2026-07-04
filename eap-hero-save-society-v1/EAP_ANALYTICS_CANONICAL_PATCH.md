# Duplicate-Safe EAP Analytics Patch

The current dashboard can display two logical `S1 | Speaking` records when old data contains variants such as `1` and `S1`. This inflates Hero record counts and makes the teacher view confusing.

1. Add `EAP_HeroCanonicalAnalytics.gs` to the same Apps Script project.
2. In `EAP_TeacherDashboard-v6.gs`, change this line inside `eapTeacherDashboardData(filters)`:

```javascript
const heroRecords = eapHeroAnalyticsRows_(section);
```

to:

```javascript
const heroRecords = eapHeroAnalyticsRowsCanonical_(section);
```

The patch canonicalizes session IDs and merges duplicate records by:

`studentId + canonical sessionId + skill`

Priority is higher best score, then later timestamp, then a non-empty session title. It does not delete or alter the historical raw `summary` rows.
