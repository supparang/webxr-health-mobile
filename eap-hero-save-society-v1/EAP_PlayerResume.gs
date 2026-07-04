/* =========================================================
   EAP Hero Player Resume API v2
   - Reads verified summary data only for studentId + section.
   - Canonicalizes historical session variants such as 1 / S1 / Session 1.
   - Deduplicates one logical session + skill before the learner resumes.
   - Prefers higher best score, then later update, then non-empty title.
========================================================= */

function eapPlayerResume_(params) {
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

  const summaryRows = eapResumeCanonicalizeRows_(rawRows)
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
    source: 'verified_summary_canonical',
    student: {
      studentId: studentId,
      studentName: text_(latestProfile.studentName, requestedName || 'Student'),
      section: section
    },
    records: summaryRows,
    recordCount: summaryRows.length,
    rawRecordCount: rawRows.length,
    duplicatesCollapsed: Math.max(0, rawRows.length - summaryRows.length),
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
      : 'ยังไม่พบความคืบหน้าที่บันทึกไว้ใน Sheet'
  };
}

function eapResumeNormalizedRow_(row) {
  return {
    sessionId: eapResumeSessionId_(row.sessionId),
    sessionTitle: text_(row.sessionTitle),
    skill: eapResumeSkill_(row.skill),
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

function eapResumeSkill_(value) {
  const raw = text_(value).trim().toLowerCase();
  const map = {
    reading:'Reading', listening:'Listening', writing:'Writing',
    speaking:'Speaking', 'boss clash':'Boss Clash'
  };
  return map[raw] || text_(value);
}

function eapResumeSessionId_(value) {
  const raw = text_(value).toUpperCase().replace(/\s+/g, '');
  if (/^\d+$/.test(raw)) return 'S' + raw;
  const s = raw.match(/^S(?:ESSION)?(\d{1,2})$/);
  if (s) return 'S' + s[1];
  const b = raw.match(/^B(?:OSS)?(\d{1,2})$/);
  if (b) return 'B' + b[1];
  return raw;
}

function eapResumeSessionRank_(value) {
  const sid = eapResumeSessionId_(value);
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
