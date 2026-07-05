/* =========================================================
   EAP Hero Canonical Analytics Rows

   Produces the dashboard-ready Hero ledger from raw summary rows.
   Historical raw rows are never deleted. Impossible Session–Skill pairs
   are quarantined for audit and excluded from averages, status, and the
   normal student detail view.
========================================================= */

function eapHeroAnalyticsRowsCanonical_(section) {
  const prepared = eapHeroAnalyticsPreparedRows_(section);
  return eapHeroCanonicalizeAnalyticsRows_(prepared.valid);
}

function eapHeroAnalyticsDataQuality_(section) {
  const prepared = eapHeroAnalyticsPreparedRows_(section);
  const valid = eapHeroCanonicalizeAnalyticsRows_(prepared.valid);

  return {
    ok: true,
    section: section,
    validRecordCount: valid.length,
    rawRecordCount: prepared.raw.length,
    quarantinedCount: prepared.quarantined.length,
    quarantined: prepared.quarantined,
    duplicatesCollapsed: Math.max(0, prepared.valid.length - valid.length),
    generatedAt: now_().iso
  };
}

function eapHeroAnalyticsPreparedRows_(section) {
  const raw = sh_('summary')
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row) { return rowObject_(H.summary, row); })
    .filter(function(row) { return text_(row.section) === section; });

  const valid = [];
  const quarantined = [];

  raw.forEach(function(row) {
    const identity = eapResolveIdentity_(
      'hero', row.studentId, row.studentName, section
    );
    const record = {
      source: 'hero',
      studentId: identity.studentId,
      studentName: identity.studentName,
      section: section,
      sessionId: eapHeroCanonicalSession_(row.sessionId),
      sessionTitle: text_(row.sessionTitle),
      skill: eapHeroCanonicalSkill_(row.skill),
      bestScore: number_(row.bestScore, 0),
      bestAccuracy: number_(row.bestAccuracy, 0),
      passed: text_(row.passed).toUpperCase() === 'TRUE',
      legacyCompletion: text_(row.legacyCompletion).toUpperCase() === 'TRUE',
      attempts: number_(row.attempts, 0),
      updatedAt: text_(row.updatedAt),
      reviewFlag: text_(row.reviewFlag)
    };

    if (record.legacyCompletion || eapHeroSkillAllowed_(record.sessionId, record.skill)) {
      valid.push(record);
      return;
    }

    record.quarantineReason = eapHeroContractReason_(record.sessionId, record.skill);
    quarantined.push(record);
  });

  return {raw: raw, valid: valid, quarantined: quarantined};
}

function eapHeroCanonicalizeAnalyticsRows_(rows) {
  const grouped = {};

  (rows || []).forEach(function(row) {
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
