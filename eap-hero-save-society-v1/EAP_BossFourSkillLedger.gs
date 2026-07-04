/* =========================================================
   EAP Hero Boss Four-Skill Ledger
   Reads B1–B5 evidence events and groups them by learner + Boss Gate.
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
  if (values.length < 2) {
    return {ok:true, section:section, generatedAt:now_().iso, records:[]};
  }

  const headers = values[0].map(String);
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
      incomplete:records.filter(function(record){ return !record.complete; }).length
    },
    records:records
  };
}
