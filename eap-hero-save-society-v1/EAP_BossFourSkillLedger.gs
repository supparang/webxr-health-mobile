/* =========================================================
   EAP Hero Boss Four-Skill Ledger
   Reads B1–B5 evidence events and shows the distinct Boss Clash outcome.
   This is evidence visibility only; it does not recalculate scores.
========================================================= */

function eapBossFourSkillLedgerData(filters) {
  filters = filters || {};
  const section = text_(filters.section, EAP_CONFIG.DEFAULT_SECTION);
  const studentId = text_(filters.studentId || filters.id, '');
  const query = text_(filters.query || filters.q, '').toLowerCase();
  const skills = ['Reading', 'Listening', 'Writing', 'Speaking'];
  const sheet = eapEvidenceEventsSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0].map(String) : [];
  const grouped = {};

  values.slice(1).forEach(function(row) {
    const source = {};
    headers.forEach(function(header, index) { source[header] = row[index]; });
    const payload = eapEvidenceParseJson_(source.valueJson);
    const sessionId = text_(payload.sessionId || source.sessionId, '').toUpperCase();
    const skill = text_(payload.skill || source.skill, '');
    const skillKey = skill.toLowerCase();
    const eventType = text_(source.eventType, '');

    if (!/^B[1-5]$/.test(sessionId)) return;
    if (['reading','listening','writing','speaking'].indexOf(skillKey) < 0) return;
    if (eventType !== 'eap_boss_skill_evidence' && eventType !== EAP_EVIDENCE_EVENT_TYPE) return;
    if (section && text_(source.section) !== section) return;
    if (studentId && text_(source.studentId) !== studentId) return;

    const material = [source.studentId, source.studentName, sessionId, skill, payload.output].join(' ').toLowerCase();
    if (query && material.indexOf(query) < 0) return;

    const key = [text_(source.studentId), sessionId].join('|');
    if (!grouped[key]) {
      grouped[key] = {
        studentId: text_(source.studentId),
        studentName: text_(source.studentName),
        section: text_(source.section),
        sessionId: sessionId,
        sessionTitle: text_(payload.sessionTitle, ''),
        latestAt: '',
        evidence: {}
      };
    }

    const current = grouped[key].evidence[skill];
    const candidate = {
      eventId: text_(source.eventId || payload.evidenceId),
      createdAt: text_(source.createdAt || payload.occurredAt),
      score: number_(payload.score, 0),
      output: text_(payload.output, ''),
      durationSec: number_(payload.durationSec, 0),
      reviewStatus: text_(payload.teacherReviewStatus, ''),
      reviewRequired: payload.teacherReviewRequired === true
    };

    if (!current || eapEvidenceTimeMs_(candidate.createdAt) >= eapEvidenceTimeMs_(current.createdAt)) {
      grouped[key].evidence[skill] = candidate;
    }

    if (eapEvidenceTimeMs_(candidate.createdAt) >= eapEvidenceTimeMs_(grouped[key].latestAt)) {
      grouped[key].latestAt = candidate.createdAt;
    }
  });

  /* Boss Clash is a separate summary record, not a fifth skill. */
  const bossClashByKey = {};
  const summaryRows = sh_('summary').getDataRange().getValues().slice(1)
    .map(function(row) { return rowObject_(H.summary, row); })
    .filter(function(row) {
      return text_(row.section) === section &&
        /^B[1-5]$/.test(text_(row.sessionId).toUpperCase()) &&
        text_(row.skill).toLowerCase() === 'boss clash';
    });

  summaryRows.forEach(function(row) {
    if (studentId && text_(row.studentId) !== studentId) return;
    const key = [text_(row.studentId), text_(row.sessionId).toUpperCase()].join('|');
    bossClashByKey[key] = {
      passed: text_(row.passed).toUpperCase() === 'TRUE',
      bestScore: number_(row.bestScore, 0),
      updatedAt: text_(row.updatedAt),
      attempts: number_(row.attempts, 0)
    };
  });

  const records = Object.keys(grouped).map(function(key) {
    const item = grouped[key];
    const completedSkills = skills.filter(function(skill) { return !!item.evidence[skill]; });
    return {
      studentId: item.studentId,
      studentName: item.studentName,
      section: item.section,
      sessionId: item.sessionId,
      sessionTitle: item.sessionTitle,
      latestAt: item.latestAt,
      completedSkills: completedSkills,
      complete: completedSkills.length === skills.length,
      speakingReviewStatus: item.evidence.Speaking ? item.evidence.Speaking.reviewStatus || 'pending_teacher_review' : '',
      bossClash: bossClashByKey[key] || { passed:false, bestScore:0, updatedAt:'', attempts:0 },
      evidence: item.evidence
    };
  }).sort(function(a, b) {
    return eapEvidenceTimeMs_(b.latestAt) - eapEvidenceTimeMs_(a.latestAt) ||
      String(a.studentName).localeCompare(String(b.studentName));
  });

  return {
    ok:true,
    section:section,
    generatedAt:now_().iso,
    requiredSkills:skills,
    summary:{
      totalBossAttempts:records.length,
      completeFourSkill:records.filter(function(record){ return record.complete; }).length,
      incomplete:records.filter(function(record){ return !record.complete; }).length,
      bossClashPassed:records.filter(function(record){ return record.bossClash && record.bossClash.passed; }).length
    },
    records:records
  };
}
