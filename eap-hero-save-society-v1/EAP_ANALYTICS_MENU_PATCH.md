# Optional EAP Analytics Menu Patch

In the existing `onOpen()` function in `EAP_TeacherDashboard.gs`, add these two menu items before `.addToUi()`:

```javascript
.addItem('Boss Four-Skill Ledger', 'showEapBossFourSkillLedger')
.addItem('Boss Speaking Review', 'showEapBossEvidenceReview')
```

The resulting menu gives the teacher three entry points:

- Learning Analytics Dashboard
- Boss Four-Skill Ledger
- Boss Speaking Review

This is optional because both review windows can also be opened by running their named functions from Apps Script.
