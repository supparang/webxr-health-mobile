/* =========================================================
   EAP Hero Canonical Analytics Rows v2

   Dashboard contract
   - Summary is the source of BEST score, BEST accuracy, pass, and review.
   - Attempts is the source of LATEST score, LATEST accuracy, and time.
   - Impossible Session–Skill combinations are quarantined, never deleted.
   - Duplicate historical rows are collapsed by studentId + session + skill.
========================================================= */

const EAP_HERO_TITLE_FALLBACK = {
  S1: 'Academic Hero Awakening',
  S2: 'Vocabulary Lab',
  S3: 'Main Idea Hunter',
  S4: 'Keyword Scanner',
  S5: 'Critical Reading',
  S6: 'Summary Builder',
  S7: 'Academic Tone Battle',
  S8: 'Paragraph Structure Lab',
  S9: 'Paragraph Writing',
  S10: 'Data Description',
  S11: 'Academic Email',
  S12: 'Citation & Ethics',
  S13: 'Academic Listening',
  S14: 'Academic Presentation',
  S15: 'Final Integration'
};

function eapHeroAnalyticsRowsCanonical_(section) {
  const prepared = eapHeroAnalyticsPreparedRows_(section);
  return eapHeroBuildCanonicalRows_(prepared.summaryValid, prepared.attemptValid);
}

function eapHeroAnalyticsDataQuality_(section) {
  const prepared = eapHeroAnalyticsPreparedRows_(section);
  const valid = eapHeroBuildCanonicalRows_(prepared.summaryValid, prepared.attemptValid);

  return {
    ok: true,
    section: section,
    dashboardRecordCount: valid.length,
    rawSummaryCount: prepared.rawSummary.length,
    rawAttemptCount: prepared.rawAttempts.length,
    quarantinedCount: prepared.quarantined.length,
    quarantined: prepared.quarantined,
    generatedAt: now_().iso
  };
}

function eapHeroAnalyticsPreparedRows_(section) {
  const rawSummary = sh_('summary')
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row) { return rowObject_(H.summary, row); })
    .filter(function(row) { return text_(row.section) === section; });

  const rawAttempts = sh_('attempts')
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row) { return rowObject_(H.attempts, row); })
    .filter(function(row) { return text_(row.section) === section; });

  const summaryValid = [];
  const attemptValid = [];
  const quarantined = [];

  rawSummary.forEach(function(row) {
    const record = eapHeroAnalyticsSummaryRecord_(row, section);

    if (record.legacyCompletion || eapHeroSkillAllowed_(record.sessionId, record.skill)) {
      summaryValid.push(record);
      return;
    }

    record.quarantineReason = eapHeroContractReason_(record.sessionId, record.skill);
    record.sourceKind = 'summary';
    quarantined.push(record);
  });

  rawAttempts.forEach(function(row) {
    const record = eapHeroAnalyticsAttemptRecord_(row, section);

    if (record.legacyCompletion || eapHeroSkillAllowed_(record.sessionId, record.skill)) {
      attemptValid.push(record);
      return;
    }

    record.quarantineReason = eapHeroContractReason_(record.sessionId, record.skill);
    record.sourceKind = 'attempt';
    quarantined.push(record);
  });

  return {
    rawSummary: rawSummary,
    rawAttempts: rawAttempts,
    summaryValid: summaryValid,
    attemptValid: attemptValid,
    quarantined: quarantined
  };
}

function eapHeroAnalyticsSummaryRecord_(row, section) {
  const identity = eapResolveIdentity_(
    'hero', row.studentId, row.studentName, section
  );
  const sessionId = eapHeroCanonicalSession_(row.sessionId);

  return {
    source: 'hero',
    sourceKind: 'summary',
    studentId: identity.studentId,
    studentName: identity.studentName,
    section: section,
    sessionId: sessionId,
    sessionTitle: text_(row.sessionTitle) || eapHeroTitle_(sessionId),
    skill: eapHeroCanonicalSkill_(row.skill),
    bestScore: number_(row.bestScore, 0),
    bestAccuracy: eapHeroNullableNumber_(row.bestAccuracy),
    passed: text_(row.passed).toUpperCase() === 'TRUE',
    legacyCompletion: text_(row.legacyCompletion).toUpperCase() === 'TRUE',
    attempts: number_(row.attempts, 0),
    updatedAt: text_(row.updatedAt),
    reviewFlag: text_(row.reviewFlag)
  };
}

function eapHeroAnalyticsAttemptRecord_(row, section) {
  const identity = eapResolveIdentity_(
    'hero', row.studentId, row.studentName, section
  );
  const sessionId = eapHeroCanonicalSession_(row.sessionId);
  const submittedAt = text_(row.submittedAt || row.clientTimestamp);

  return {
    source: 'hero',
    sourceKind: 'attempt',
    studentId: identity.studentId,
    studentName: identity.studentName,
    section: section,
    sessionId: sessionId,
    sessionTitle: text_(row.sessionTitle) || eapHeroTitle_(sessionId),
    skill: eapHeroCanonicalSkill_(row.skill),
    score: number_(row.score, 0),
    accuracy: eapHeroNullableNumber_(row.accuracy),
    passed: bool_(row.passed),
    legacyCompletion: text_(row.legacyCompletion).toUpperCase() === 'TRUE',
    submittedAt: submittedAt,
    updatedAt: submittedAt,
    attemptId: text_(row.attemptId)
  };
}

function eapHeroBuildCanonicalRows_(summaryRows, attemptRows) {
  const grouped = {};

  function ensure(record) {
    const key = eapHeroAnalyticsKey_(record);
    if (!grouped[key]) {
      grouped[key] = {
        source: 'hero',
        studentId: record.studentId,
        studentName: record.studentName,
        section: record.section,
        sessionId: record.sessionId,
        sessionTitle: record.sessionTitle || eapHeroTitle_(record.sessionId),
        skill: record.skill,
        bestScore: null,
        bestAccuracy: null,
        latestScore: null,
        latestAccuracy: null,
        accuracy: null,
        latestAt: '',
        updatedAt: '',
        passed: false,
        attempts: 0,
        reviewFlag: '',
        legacyCompletion: false
      };
    }
    return grouped[key];
  }

  (summaryRows || []).forEach(function(record) {
    const out = ensure(record);
    const hasBetterScore = out.bestScore === null || record.bestScore > out.bestScore;
    const sameScoreLater = record.bestScore === out.bestScore &&
      eapHeroAnalyticsTimeMs_(record.updatedAt) > eapHeroAnalyticsTimeMs_(out.updatedAt);

    if (hasBetterScore || sameScoreLater) {
      out.bestScore = record.bestScore;
      out.bestAccuracy = record.bestAccuracy;
      out.updatedAt = record.updatedAt;
      out.reviewFlag = record.reviewFlag || out.reviewFlag;
      if (record.sessionTitle) out.sessionTitle = record.sessionTitle;
    } else if (out.bestAccuracy === null && record.bestAccuracy !== null) {
      out.bestAccuracy = record.bestAccuracy;
    }

    out.passed = out.passed || record.passed;
    out.attempts = Math.max(out.attempts, record.attempts);
    if (!out.sessionTitle && record.sessionTitle) out.sessionTitle = record.sessionTitle;
  });

  const attemptCounts = {};
  (attemptRows || []).forEach(function(record) {
    const key = eapHeroAnalyticsKey_(record);
    attemptCounts[key] = (attemptCounts[key] || 0) + 1;

    const out = ensure(record);
    const incomingTime = eapHeroAnalyticsTimeMs_(record.submittedAt);
    const currentTime = eapHeroAnalyticsTimeMs_(out.latestAt);
    const later = !out.latestAt || incomingTime >= currentTime;

    if (later) {
      out.latestScore = record.score;
      out.latestAccuracy = record.accuracy;
      out.accuracy = record.accuracy;
      out.latestAt = record.submittedAt;
      if (record.sessionTitle) out.sessionTitle = record.sessionTitle;
    }

    out.passed = out.passed || record.passed;
  });

  return Object.keys(grouped).map(function(key) {
    const out = grouped[key];
    out.attempts = Math.max(out.attempts, attemptCounts[key] || 0);

    /* Older summary-only rows do not have a raw attempt row. Preserve their
       confirmed best value as the only available latest value rather than
       showing a misleading blank. */
    if (out.latestScore === null && out.bestScore !== null) {
      out.latestScore = out.bestScore;
      out.latestAccuracy = out.bestAccuracy;
      out.accuracy = out.bestAccuracy;
      out.latestAt = out.updatedAt;
    }

    if (!out.sessionTitle) out.sessionTitle = eapHeroTitle_(out.sessionId);
    return out;
  }).sort(function(a, b) {
    return eapHeroAnalyticsTimeMs_(b.latestAt || b.updatedAt) -
      eapHeroAnalyticsTimeMs_(a.latestAt || a.updatedAt) ||
      String(a.studentName).localeCompare(String(b.studentName)) ||
      eapHeroAnalyticsSessionRank_(a.sessionId) - eapHeroAnalyticsSessionRank_(b.sessionId) ||
      String(a.skill).localeCompare(String(b.skill));
  });
}

function eapHeroAnalyticsKey_(record) {
  return [
    text_(record.studentId),
    eapHeroCanonicalSession_(record.sessionId),
    String(eapHeroCanonicalSkill_(record.skill)).toLowerCase()
  ].join('|');
}

function eapHeroAnalyticsTimeMs_(value) {
  const time = new Date(String(value || '')).getTime();
  return isFinite(time) ? time : 0;
}

function eapHeroAnalyticsSessionRank_(value) {
  const sid = eapHeroCanonicalSession_(value);
  const match = sid.match(/^S(\d{1,2})$/);
  return match ? Number(match[1]) : 999;
}

function eapHeroNullableNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return isFinite(number) ? number : null;
}

function eapHeroTitle_(sessionId) {
  return EAP_HERO_TITLE_FALLBACK[eapHeroCanonicalSession_(sessionId)] || '';
}
