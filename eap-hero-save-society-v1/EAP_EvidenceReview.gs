/* =========================================================
   EAP Hero Evidence Review Queue v1
   Add this file to the SAME Apps Script project as EAP_Code.gs.

   It uses the existing `events` sheet and action='submit_event' receiver,
   so it does NOT add a second doGet()/doPost().

   Read APIs exposed for the Teacher Dashboard:
   - eapEvidenceReviewData(filters)
   - eapTeacherEvidenceData(filters)
   - getEapEvidence(filters)
   - eapEvidenceQueueData(filters)

   Write API for teacher feedback:
   - eapSaveEvidenceReview(payload)

   Boss Speaking remains pending review until the teacher applies concise
   feedback codes: CL, PR, FL, ST, EV, QA. No automatic language score is
   created by this code.
========================================================= */

const EAP_EVIDENCE_EVENT_TYPE = 'eap_boss_speaking_evidence';
const EAP_EVIDENCE_CODES = ['CL', 'PR', 'FL', 'ST', 'EV', 'QA'];

function eapEvidenceEventHeaders_() {
  return [
    'eventId', 'createdAt', 'section', 'studentId', 'studentName',
    'eventType', 'sessionId', 'skill', 'valueJson'
  ];
}

function eapEvidenceEventsSheet_() {
  const ss = ss_();
  let sheet = ss.getSheetByName('events');

  if (!sheet) {
    sheet = ss.insertSheet('events');
    sheet.getRange(1, 1, 1, eapEvidenceEventHeaders_().length)
      .setValues([eapEvidenceEventHeaders_()]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, eapEvidenceEventHeaders_().length)
      .setFontWeight('bold');
  }

  return sheet;
}

function eapEvidenceParseJson_(value) {
  try {
    return JSON.parse(String(value || '{}'));
  } catch (error) {
    return {};
  }
}

function eapEvidenceText_(value, fallback) {
  return text_(value, fallback === undefined ? '' : fallback);
}

function eapEvidenceTimeMs_(value) {
  const time = new Date(String(value || '')).getTime();
  return isFinite(time) ? time : 0;
}

function eapEvidenceIsBossSpeaking_(row, payload) {
  const eventType = eapEvidenceText_(row.eventType).toLowerCase();
  const sessionId = eapEvidenceText_(payload.sessionId || row.sessionId).toUpperCase();
  const skill = eapEvidenceText_(payload.skill || row.skill).toLowerCase();
  return eventType === EAP_EVIDENCE_EVENT_TYPE ||
    (/^B[1-5]$/.test(sessionId) && skill === 'speaking' && payload.teacherReviewRequired === true);
}

function eapEvidenceRows_(filters) {
  filters = filters || {};
  const section = eapEvidenceText_(filters.section, EAP_CONFIG.DEFAULT_SECTION);
  const studentId = eapEvidenceText_(filters.studentId || filters.id, '');
  const status = eapEvidenceText_(filters.status, '');
  const query = eapEvidenceText_(filters.query || filters.q, '').toLowerCase();

  const sheet = eapEvidenceEventsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  const records = [];

  values.slice(1).forEach(function(row, index) {
    const record = {};
    headers.forEach(function(header, column) { record[header] = row[column]; });
    const payload = eapEvidenceParseJson_(record.valueJson);

    if (!eapEvidenceIsBossSpeaking_(record, payload)) return;
    if (section && eapEvidenceText_(record.section) !== section) return;
    if (studentId && eapEvidenceText_(record.studentId) !== studentId) return;

    const reviewStatus = eapEvidenceText_(payload.teacherReviewStatus, 'pending_teacher_review') || 'pending_teacher_review';
    if (status && reviewStatus !== status) return;

    const material = [
      record.studentId, record.studentName, record.sessionId, record.skill,
      payload.output, payload.prompt, reviewStatus
    ].join(' ').toLowerCase();
    if (query && material.indexOf(query) < 0) return;

    records.push({
      rowNumber: index + 2,
      eventId: eapEvidenceText_(record.eventId || payload.evidenceId),
      createdAt: eapEvidenceText_(record.createdAt || payload.occurredAt),
      section: eapEvidenceText_(record.section),
      studentId: eapEvidenceText_(record.studentId),
      studentName: eapEvidenceText_(record.studentName),
      sessionId: eapEvidenceText_(payload.sessionId || record.sessionId).toUpperCase(),
      sessionTitle: eapEvidenceText_(payload.sessionTitle),
      skill: eapEvidenceText_(payload.skill || record.skill),
      score: number_(payload.score, 0),
      passed: bool_(payload.passed),
      prompt: eapEvidenceText_(payload.prompt),
      output: eapEvidenceText_(payload.output),
      durationSec: number_(payload.durationSec, 0),
      targetRange: eapEvidenceText_(payload.targetRange),
      oralChecklist: payload.oralChecklist || {},
      consentAudio: payload.consentAudio === true,
      reviewRequired: payload.teacherReviewRequired !== false,
      reviewStatus: reviewStatus,
      feedbackCodes: Array.isArray(payload.teacherFeedbackCodes)
        ? payload.teacherFeedbackCodes
        : [],
      teacherComment: eapEvidenceText_(payload.teacherComment),
      teacherReviewedAt: eapEvidenceText_(payload.teacherReviewedAt),
      teacherReviewedBy: eapEvidenceText_(payload.teacherReviewedBy),
      eventType: eapEvidenceText_(record.eventType),
      raw: payload
    });
  });

  const latestByEvent = {};
  records.forEach(function(record) {
    const existing = latestByEvent[record.eventId];
    if (!existing || eapEvidenceTimeMs_(record.createdAt) >= eapEvidenceTimeMs_(existing.createdAt)) {
      latestByEvent[record.eventId] = record;
    }
  });

  return Object.keys(latestByEvent)
    .map(function(key) { return latestByEvent[key]; })
    .sort(function(a, b) {
      return eapEvidenceTimeMs_(b.createdAt) - eapEvidenceTimeMs_(a.createdAt) ||
        String(a.studentName).localeCompare(String(b.studentName));
    });
}

function eapEvidenceReviewData(filters) {
  const records = eapEvidenceRows_(filters || {});
  const pending = records.filter(function(record) {
    return record.reviewStatus === 'pending_teacher_review';
  });

  return {
    ok: true,
    generatedAt: now_().iso,
    section: eapEvidenceText_((filters || {}).section, EAP_CONFIG.DEFAULT_SECTION),
    reviewCodes: EAP_EVIDENCE_CODES.slice(),
    summary: {
      total: records.length,
      pending: pending.length,
      reviewed: records.filter(function(record) {
        return record.reviewStatus !== 'pending_teacher_review';
      }).length
    },
    records: records
  };
}

/* Aliases allow older/newer dashboard panels to call the same review data. */
function eapTeacherEvidenceData(filters) { return eapEvidenceReviewData(filters); }
function getEapEvidence(filters) { return eapEvidenceReviewData(filters); }
function eapEvidenceQueueData(filters) { return eapEvidenceReviewData(filters); }

function eapSaveEvidenceReview(payload) {
  payload = payload || {};
  const eventId = eapEvidenceText_(payload.eventId || payload.evidenceId, '');
  if (!eventId) return { ok:false, error:'eventId is required' };

  const allowed = (payload.feedbackCodes || [])
    .map(function(code) { return String(code || '').toUpperCase().trim(); })
    .filter(function(code) { return EAP_EVIDENCE_CODES.indexOf(code) >= 0; });

  const sheet = eapEvidenceEventsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok:false, error:'evidence not found' };

  const headers = values[0].map(String);
  const eventColumn = headers.indexOf('eventId');
  const jsonColumn = headers.indexOf('valueJson');
  let targetRow = -1;

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][eventColumn]) === eventId) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow < 0) return { ok:false, error:'evidence not found' };

  const current = eapEvidenceParseJson_(sheet.getRange(targetRow, jsonColumn + 1).getValue());
  current.teacherReviewStatus = eapEvidenceText_(payload.status, 'reviewed') || 'reviewed';
  current.teacherFeedbackCodes = allowed;
  current.teacherComment = eapEvidenceText_(payload.comment, '');
  current.teacherReviewedBy = eapEvidenceText_(payload.reviewedBy || payload.teacherName, 'Teacher');
  current.teacherReviewedAt = now_().iso;
  current.teacherReviewScore = ''; /* Feedback only: no duplicate grade. */

  sheet.getRange(targetRow, jsonColumn + 1).setValue(JSON.stringify(current));

  return {
    ok: true,
    eventId: eventId,
    teacherReviewStatus: current.teacherReviewStatus,
    feedbackCodes: current.teacherFeedbackCodes,
    reviewedAt: current.teacherReviewedAt
  };
}
