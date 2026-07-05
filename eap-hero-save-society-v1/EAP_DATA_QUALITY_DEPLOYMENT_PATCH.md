# EAP Hero Data-Quality Deployment Patch

## What the evidence showed

Historical `summary` rows may contain impossible pairings such as:

- S1 + Writing (S1 accepts Reading + Speaking)
- S2 + Speaking (S2 accepts Reading + Writing)

They must remain in raw history for audit, but must not affect learner maps, unlocks, averages, or normal teacher records.

## Add these Apps Script files

1. `EAP_HeroSkillContract.gs`
2. Updated `EAP_PlayerResume.gs` v3
3. Updated `EAP_HeroCanonicalAnalytics.gs`

## One required dashboard change

In the currently deployed `EAP_TeacherDashboard.gs`, inside `eapTeacherDashboardData(filters)`, replace:

```javascript
const heroRecords = eapHeroAnalyticsRows_(section);
```

with:

```javascript
const heroRecords = eapHeroAnalyticsRowsCanonical_(section);
```

This preserves raw rows in `summary` but makes the normal dashboard and learner record use only allowed Session–Skill pairs, with duplicates collapsed by `studentId + sessionId + skill`.

## Optional audit command

Run this in Apps Script after saving:

```javascript
Logger.log(JSON.stringify(eapHeroAnalyticsDataQuality_('122'), null, 2));
```

The log identifies quarantined historic rows without deleting them.

## Deployment

Save all files, then **Deploy → Manage deployments → Edit → New version → Deploy**.
