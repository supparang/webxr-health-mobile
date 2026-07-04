/* =========================================================
   EAP Hero Canonical Analytics Rows
   Use this helper from EAP_TeacherDashboard-v6.gs in place of the older
   eapHeroAnalyticsRows_(section) call when historical S1 / 1 duplicates
   must be collapsed in the teacher dashboard.
========================================================= */

function eapHeroAnalyticsRowsCanonical_(section) {
  const rows = sh_('summary')
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row) { return rowObject_(H.summary, row); })
    .filter(function(row) { return text_(row.section) === section; })
    .map(function(row) {
      const identity = eapResolveIdentity_(
        'hero', row.studentId, row.studentName, section
      );
      return {
        source: 'hero',
        studentId: identity.studentId,
        studentName: identity.studentName,
        section: section,
        sessionId: eapResumeSessionId_(row.sessionId),
        sessionTitle: text_(row.sessionTitle),
        skill: eapResumeSkill_(row.skill),
        bestScore: number_(row.bestScore, 0),
        bestAccuracy: number_(row.bestAccuracy, 0),
        passed: text_(row.passed).toUpperCase() === 'TRUE',
        legacyCompletion: text_(row.legacyCompletion).toUpperCase() === 'TRUE',
        attempts: number_(row.attempts, 0),
        updatedAt: text_(row.updatedAt),
        reviewFlag: text_(row.reviewFlag)
      };
    });

  const grouped = {};
  rows.forEach(function(row) {
    const key = [row.studentId, row.sessionId, String(row.skill).toLowerCase()].join('|');
    const old = grouped[key];
    if (!old) {
      grouped[key] = row;
      return;
    }

    const betterScore = row.bestScore > old.bestScore;
    const sameScoreLater = row.bestScore === old.bestScore &&
      eapResumeTimeMs_(row.updatedAt) > eapResumeTimeMs_(old.updatedAt);
    const betterTitle = !text_(old.sessionTitle) && !!text_(row.sessionTitle);

    if (betterScore || sameScoreLater || betterTitle) {
      const chosen = Object.assign({}, row);
      chosen.bestAccuracy = Math.max(old.bestAccuracy, row.bestAccuracy);
      chosen.passed = old.passed || row.passed;
      chosen.attempts = Math.max(old.attempts, row.attempts);
      chosen.legacyCompletion = old.legacyCompletion && row.legacyCompletion;
      if (!chosen.sessionTitle) chosen.sessionTitle = old.sessionTitle;
      grouped[key] = chosen;
      return;
    }

    old.bestAccuracy = Math.max(old.bestAccuracy, row.bestAccuracy);
    old.passed = old.passed || row.passed;
    old.attempts = Math.max(old.attempts, row.attempts);
    old.legacyCompletion = old.legacyCompletion && row.legacyCompletion;
    if (!old.sessionTitle && row.sessionTitle) old.sessionTitle = row.sessionTitle;
  });

  return Object.keys(grouped).map(function(key) { return grouped[key]; });
}
