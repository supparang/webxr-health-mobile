/* =========================================================
   EAP Hero Evidence Review Queue v2
   Add this file to the SAME Apps Script project as EAP_Code.gs.

   It does not define doGet()/doPost(). The shared router in EAP_Code.gs
   should delegate action='submit_evidence' and action='submit_speaking_audio'
   to the helpers at the end of this file.

   Teacher review rules
   - Only B1–B5 Speaking evidence enters the review queue.
   - Teacher feedback uses CL, PR, FL, ST, EV, QA plus an optional note.
   - No automatic grammar/pronunciation score and no duplicate grade.
========================================================= */

const EAP_EVIDENCE_EVENT_TYPE = 'eap_boss_speaking_evidence';
const EAP_EVIDENCE_CODES = ['CL', 'PR', 'FL', 'ST', 'EV', 'QA'];
const EAP_EVIDENCE_AUDIO_SHEET = 'evidence_audio';
const EAP_EVIDENCE_AUDIO_MAX_BYTES = 6 * 1024 * 1024;

function eapEvidenceEventHeaders_() {
  return [
    'eventId', 'createdAt', 'section', 'studentId', 'studentName',
    'eventType', 'sessionId', 'skill', 'valueJson'
  ];
}

function eapEvidenceAudioHeaders_() {
  return [
    'evidenceId', 'createdAt', 'section', 'studentId', 'studentName',
    'fileId', 'fileName', 'mimeType', 'fileUrl', 'sizeBytes', 'status'
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

function eapEvidenceAudioSheet_() {
  const ss = ss_();
  let sheet = ss.getSheetByName(EAP_EVIDENCE_AUDIO_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(EAP_EVIDENCE_AUDIO_SHEET);
    sheet.getRange(1, 1, 1, eapEvidenceAudioHeaders_().length)
      .setValues([eapEvidenceAudioHeaders_()]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, eapEvidenceAudioHeaders_().length)
      .setFontWeight('bold');
    sheet.autoResizeColumns(1, eapEvidenceAudioHeaders_().length);
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

function eapEvidenceAudioMap_() {
  const sheet = eapEvidenceAudioSheet_();
  const values = sheet.getDataRange().getValues();
  const map = {};
  if (values.length < 2) return map;

  const headers = values[0].map(String);
  values.slice(1).forEach(function(row) {
    const item = {};
    headers.forEach(function(header, index) { item[header] = row[index]; });
    const id = eapEvidenceText_(item.evidenceId);
    if (!id) return;
    map[id] = {
      available: eapEvidenceText_(item.status) === 'stored',
      fileId: eapEvidenceText_(item.fileId),
      fileName: eapEvidenceText_(item.fileName),
      mimeType: eapEvidenceText_(item.mimeType),
      fileUrl: eapEvidenceText_(item.fileUrl),
      sizeBytes: number_(item.sizeBytes, 0),
      createdAt: eapEvidenceText_(item.createdAt)
    };
  });
  return map;
}

function eapEvidenceRows_(filters) {
  filters = filters || {};
  const section = eapEvidenceText_(filters.section, EAP_CONFIG.DEFAULT_SECTION);
  const studentId = eapEvidenceText_(filters.studentId || filters.id, '');
  const status = eapEvidenceText_(filters.status, '');
  const query = eapEvidenceText_(filters.query || filters.q, '').toLowerCase();
  const audioMap = eapEvidenceAudioMap_();

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

    const evidenceId = eapEvidenceText_(record.eventId || payload.evidenceId);
    records.push({
      rowNumber: index + 2,
      eventId: evidenceId,
      evidenceId: evidenceId,
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
      audio: audioMap[evidenceId] || { available:false },
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
      }).length,
      withAudio: records.filter(function(record) {
        return record.audio && record.audio.available;
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

/* =========================================================
   POST handlers called by EAP_Code.gs. They are intentionally
   standalone helpers to preserve a single shared doPost() router.
========================================================= */

function submitEvidence_(payload) {
  payload = payload || {};
  const evidenceId = eapEvidenceText_(payload.evidenceId || payload.rawEvidenceId, '');
  const sessionId = eapEvidenceText_(payload.sessionId, '').toUpperCase();
  const skill = eapEvidenceText_(payload.skill, '');

  if (!evidenceId || !sessionId || !skill) {
    return { ok:false, error:'evidenceId, sessionId and skill are required' };
  }

  if (!(/^B[1-5]$/.test(sessionId) && skill.toLowerCase() === 'speaking')) {
    return { ok:true, ignored:true, reason:'only Boss Speaking evidence requires teacher review' };
  }

  const events = eapEvidenceEventsSheet_();
  const values = events.getDataRange().getValues();
  const eventIds = values.slice(1).map(function(row) { return String(row[0] || ''); });

  if (eventIds.indexOf(evidenceId) >= 0) {
    return { ok:true, duplicate:true, eventId:evidenceId };
  }

  const now = now_().iso;
  const normalized = {
    evidenceId: evidenceId,
    evidenceType: eapEvidenceText_(payload.evidenceType, 'boss_speaking_evidence'),
    submissionKind: eapEvidenceText_(payload.submissionKind, 'fresh_evidence_v118'),
    section: eapEvidenceText_(payload.section, EAP_CONFIG.DEFAULT_SECTION),
    studentId: eapEvidenceText_(payload.studentId),
    studentName: eapEvidenceText_(payload.studentName, 'Guest'),
    sessionId: sessionId,
    sessionTitle: eapEvidenceText_(payload.sessionTitle),
    skill: 'Speaking',
    score: number_(payload.score, 0),
    passed: bool_(payload.passed),
    prompt: eapEvidenceText_(payload.prompt),
    output: eapEvidenceText_(payload.output),
    durationSec: number_(payload.durationSec, 0),
    targetRange: eapEvidenceText_(payload.targetRange),
    oralChecklist: payload.oralChecklist || {},
    boss: payload.boss || {},
    teacherReviewRequired: true,
    teacherReviewStatus: eapEvidenceText_(payload.teacherReviewStatus, 'pending_teacher_review'),
    consentAudio: payload.consentAudio === true,
    occurredAt: eapEvidenceText_(payload.occurredAt, now),
    sourceUrl: eapEvidenceText_(payload.sourceUrl)
  };

  events.appendRow([
    evidenceId,
    now,
    normalized.section,
    normalized.studentId,
    normalized.studentName,
    EAP_EVIDENCE_EVENT_TYPE,
    sessionId,
    'Speaking',
    JSON.stringify(normalized)
  ]);

  return { ok:true, duplicate:false, eventId:evidenceId, teacherReviewStatus:normalized.teacherReviewStatus };
}

function eapEvidenceAudioFolder_() {
  const configured = EAP_CONFIG.EVIDENCE_AUDIO_FOLDER_ID ? String(EAP_CONFIG.EVIDENCE_AUDIO_FOLDER_ID).trim() : '';
  if (configured) return DriveApp.getFolderById(configured);

  const sourceFile = DriveApp.getFileById(ss_().getId());
  const parents = sourceFile.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const name = 'EAP Boss Speaking Audio';
  const existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}

function eapEvidenceAudioExists_(evidenceId) {
  const sheet = eapEvidenceAudioSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    .flat()
    .map(String)
    .indexOf(String(evidenceId)) >= 0;
}

function submitSpeakingAudio_(payload) {
  payload = payload || {};
  const evidenceId = eapEvidenceText_(payload.evidenceId, '');
  const studentId = eapEvidenceText_(payload.studentId, '');
  const base64 = eapEvidenceText_(payload.audioBase64, '');

  if (!payload.consentAudio) return { ok:false, error:'audio consent is required' };
  if (!evidenceId || !studentId || !base64) return { ok:false, error:'evidenceId, studentId and audioBase64 are required' };
  if (eapEvidenceAudioExists_(evidenceId)) return { ok:true, duplicate:true, evidenceId:evidenceId };

  let bytes;
  try {
    bytes = Utilities.base64Decode(base64);
  } catch (error) {
    return { ok:false, error:'invalid audioBase64' };
  }

  if (bytes.length > EAP_EVIDENCE_AUDIO_MAX_BYTES) {
    return { ok:false, error:'audio is larger than the 6 MB classroom limit' };
  }

  const mimeType = eapEvidenceText_(payload.mimeType, 'audio/webm');
  const name = eapEvidenceText_(payload.fileName, 'EAP-Boss-' + studentId + '-' + evidenceId + '.webm');
  const blob = Utilities.newBlob(bytes, mimeType, name);
  const file = eapEvidenceAudioFolder_().createFile(blob);
  const now = now_().iso;

  eapEvidenceAudioSheet_().appendRow([
    evidenceId,
    now,
    eapEvidenceText_(payload.section, EAP_CONFIG.DEFAULT_SECTION),
    studentId,
    eapEvidenceText_(payload.studentName, 'Guest'),
    file.getId(),
    file.getName(),
    mimeType,
    file.getUrl(),
    bytes.length,
    'stored'
  ]);

  return {
    ok:true,
    evidenceId:evidenceId,
    fileId:file.getId(),
    fileUrl:file.getUrl(),
    sizeBytes:bytes.length
  };
}
