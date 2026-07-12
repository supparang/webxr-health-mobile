/* =========================================================
   EAP Hero Player Resume API v3 (LEGACY HELPER ONLY)

   IMPORTANT:
   - The live action=player_resume handler is now provided by
     apps-script/EAP_CloudResume_v132.gs.
   - This legacy summary-only implementation is intentionally renamed to
     eapPlayerResumeLegacy_ so it cannot override the cloud resume handler.
   - Cloud resume must scan eap-v132-events, attempts, evidence, summary,
     EAP_Attempts, EAP_Evidence, EAP_Summary and eap-v132-quality-audit.
========================================================= */

function eapPlayerResumeLegacy_(params) {
  params = params || {};

  const section = text_(params.section, EAP_CONFIG.DEFAULT_SECTION);
  const studentId = text_(params.studentId, '').trim();
  const requestedName = text_(params.studentName, '').trim();

  if (!studentId) {
    return { ok:false, error:'studentId is required' };
  }

  const rawRows = sh_('summary')
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row) { return rowObject_(H.summary, row); })
    .filter(function(row) {
      return text_(row.section) === section &&
        text_(row.studentId) === studentId &&
        text_(row.legacyCompletion).toUpperCase() !== 'TRUE';
    })
    .map(eapResumeNormalizedRow_);

  const quarantinedRecords = rawRows
    .filter(function(row) {
      return !eapHeroSkillAllowed_(row.sessionId, row.skill);
    })
    .map(function(row) {
      return {
        sessionId: row.sessionId,
        sessionTitle: row.sessionTitle,
        skill: row.skill,
        bestScore: row.bestScore,
        updatedAt: row.updatedAt,
        reason: eapHeroContractReason_(row.sessionId, row.skill)
      };
    });

  const validRows = rawRows.filter(function(row) {
    return eapHeroSkillAllowed_(row.sessionId, row.skill);
  });

  const summaryRows = eapResumeCanonicalizeRows_(validRows)
    .sort(function(a, b) {
      return eapResumeTimeMs_(b.updatedAt) - eapResumeTimeMs_(a.updatedAt) ||
        eapResumeSessionRank_(b.sessionId) - eapResumeSessionRank_(a.sessionId) ||
        String(a.skill).localeCompare(String(b.skill));
    });

  const profileRows = sh_('profiles')
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row) { return rowObject_(H.profiles, row); })
    .filter(function(row) {
      return text_(row.section) === section && text_(row.studentId) === studentId;
    });

  const latestProfile = profileRows.sort(function(a, b) {
    return eapResumeTimeMs_(b.lastSeenAt) - eapResumeTimeMs_(a.lastSeenAt);
  })[0] || {};

  const serverRevision = summaryRows.reduce(function(latest, row) {
    const candidate = text_(row.updatedAt);
    return eapResumeTimeMs_(candidate) > eapResumeTimeMs_(latest) ? candidate : latest;
  }, '');

  const latestActivity = summaryRows[0] || null;
  const furthest = summaryRows.reduce(function(best, row) {
    return eapResumeSessionRank_(row.sessionId) > eapResumeSessionRank_(best.sessionId)
      ? row
      : best;
  }, { sessionId:'', skill:'' });

  return {
    ok: true,
    source: 'verified_summary_contract_v3_legacy',
    student: {
      studentId: studentId,
      studentName: text_(latestProfile.studentName, requestedName || 'Student'),
      section: section
    },
    records: summaryRows,
    recordCount: summaryRows.length,
    rawRecordCount: rawRows.length,
    duplicatesCollapsed: Math.max(0, validRows.length - summaryRows.length),
    quarantinedRecords: quarantinedRecords,
    quarantinedCount: quarantinedRecords.length,
    serverRevision: serverRevision || now_().iso,
    generatedAt: now_().iso,
    latestActivity: latestActivity ? {
      sessionId: latestActivity.sessionId,
      skill: latestActivity.skill,
      updatedAt: latestActivity.updatedAt,
      score: latestActivity.bestScore
    } : null,
    continueLabel: summaryRows.length
      ? 'ยืนยันความคืบหน้าถึง ' + (furthest.sessionId || latestActivity.sessionId)
      : 'ยังไม่พบความคืบหน้าที่ใช้ได้ใน Sheet'
  };
}

function eapResumeNormalizedRow_(row) {
  return {
    sessionId: eapHeroCanonicalSession_(row.sessionId),
    sessionTitle: text_(row.sessionTitle),
    skill: eapHeroCanonicalSkill_(row.skill),
    bestScore: number_(row.bestScore, 0),
    bestAccuracy: number_(row.bestAccuracy, 0),
    passed: text_(row.passed).toUpperCase() === 'TRUE',
    attempts: number_(row.attempts, 0),
    updatedAt: text_(row.updatedAt),
    reviewFlag: text_(row.reviewFlag),
    legacyCompletion: false
  };
}

function eapResumeCanonicalizeRows_(rows) {
  const grouped = {};

  (rows || []).forEach(function(row) {
    const key = [row.sessionId, String(row.skill).toLowerCase()].join('|');
    const old = grouped[key];

    if (!old) {
      grouped[key] = row;
      return;
    }

    const isBetterScore = number_(row.bestScore, 0) > number_(old.bestScore, 0);
    const isSameScoreLater = number_(row.bestScore, 0) === number_(old.bestScore, 0) &&
      eapResumeTimeMs_(row.updatedAt) > eapResumeTimeMs_(old.updatedAt);
    const hasBetterTitle = !text_(old.sessionTitle) && !!text_(row.sessionTitle);

    if (isBetterScore || isSameScoreLater || hasBetterTitle) {
      const chosen = Object.assign({}, row);
      chosen.bestAccuracy = Math.max(number_(old.bestAccuracy, 0), number_(row.bestAccuracy, 0));
      chosen.passed = old.passed || row.passed;
      chosen.attempts = Math.max(number_(old.attempts, 0), number_(row.attempts, 0));
      if (!chosen.sessionTitle) chosen.sessionTitle = old.sessionTitle;
      grouped[key] = chosen;
      return;
    }

    old.bestAccuracy = Math.max(number_(old.bestAccuracy, 0), number_(row.bestAccuracy, 0));
    old.passed = old.passed || row.passed;
    old.attempts = Math.max(number_(old.attempts, 0), number_(row.attempts, 0));
    if (!old.sessionTitle && row.sessionTitle) old.sessionTitle = row.sessionTitle;
  });

  return Object.keys(grouped).map(function(key) { return grouped[key]; });
}

/* Kept as public aliases because existing dashboard helpers use these names. */
function eapResumeSkill_(value) {
  return eapHeroCanonicalSkill_(value);
}

function eapResumeSessionId_(value) {
  return eapHeroCanonicalSession_(value);
}

function eapResumeSessionRank_(value) {
  const sid = eapHeroCanonicalSession_(value);
  const s = sid.match(/^S(\d{1,2})$/);
  if (s) return Number(s[1]) * 10;
  const b = sid.match(/^B(\d{1,2})$/);
  if (b) return Number(b[1]) * 30 + 5;
  return 0;
}

function eapResumeTimeMs_(value) {
  const time = new Date(String(value || '')).getTime();
  return isFinite(time) ? time : 0;
}
