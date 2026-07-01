/* =========================================================
 * UX Quest • Write-only Classroom Receiver v3
 * Sunday classroom release • mission evidence + Explain Why Retry
 *
 * Deploy this as the PUBLIC Student Receiver only.
 * No doGet() route is provided; this web app never exposes
 * classroom data to student browsers.
 *
 * v3 changes
 * - Preserves mission_completed submission and existing rows.
 * - Accepts reason_retry_submitted as append-only evidence.
 * - Links a retry to the original mission attempt via linkedAttemptId.
 * - Adds physical event/retry columns with safe header migration.
 * - Writes rows by actual header position, so existing custom columns
 *   cannot shift or corrupt the dataset.
 * ========================================================= */

const UXQ_RECEIVER_SPREADSHEET_ID = ''; // Set only inside the deployed Apps Script project.
const UXQ_ATTEMPTS_SHEET = 'UXQuest_Attempts';
const UXQ_TIMEZONE = 'Asia/Bangkok';

const UXQ_ALLOWED_SECTIONS = []; // Example: ['101', '102']; [] = allow all
const UXQ_ALLOWED_COURSE_IDS = ['UXQ-ACT1-2026'];

const UXQ_SUPPORTED_EVENT_TYPES = [
  'mission_completed',
  'reason_retry_submitted'
];

const UXQ_ATTEMPTS_HEADERS = [
  'receivedAt','receivedDate','receivedTime','eventId','attemptId','courseId','courseLabel',
  'studentId','studentName','section','missionId','missionTitle','passed','score','stars',
  'accuracy','correct','total','hints','durationSec','maxCombo','attemptNo','badge','caseIds',
  'startedAt','completedAt','clientTimezone','pageUrl','schema','rawJson',
  'verifiedCorrect','verifiedTotal','verifiedAccuracy','guessRisk','rapidAttemptFlag','learningFocus',
  'eventType','linkedAttemptId','reasonRetryResponse','reasonRetryVerifiedAccuracy',
  'reasonRetryFocus','reasonRetrySubmittedAt'
];

function doPost(e) { return UXQ_receivePost_(e); }

function UXQ_receivePost_(e) {
  try {
    const payload = UXQ_parsePayload_(e);
    if (!payload || payload.app !== 'ux-quest' || UXQ_SUPPORTED_EVENT_TYPES.indexOf(String(payload.eventType || '')) === -1) {
      return UXQ_json_({ ok: false, error: 'unsupported_payload' });
    }

    const row = UXQ_normalizeEvent_(payload);
    const missing = UXQ_validateRequired_(row);
    if (missing) return UXQ_json_({ ok: false, error: 'missing_required_fields', field: missing });

    if (UXQ_ALLOWED_COURSE_IDS.length && UXQ_ALLOWED_COURSE_IDS.indexOf(row.courseId) === -1) {
      return UXQ_json_({ ok: false, error: 'course_not_allowed' });
    }
    if (UXQ_ALLOWED_SECTIONS.length && UXQ_ALLOWED_SECTIONS.indexOf(row.section) === -1) {
      return UXQ_json_({ ok: false, error: 'section_not_allowed' });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const cache = CacheService.getScriptCache();
      const cacheKey = 'uxq-event-' + row.eventId;
      if (cache.get(cacheKey)) return UXQ_response_(row, true);

      const sheet = UXQ_getAttemptsSheet_();
      if (UXQ_hasEvent_(sheet, row.eventId)) return UXQ_response_(row, true);

      UXQ_appendRow_(sheet, row);
      cache.put(cacheKey, '1', 21600);
      return UXQ_response_(row, false);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return UXQ_json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function UXQ_response_(row, duplicate) {
  return UXQ_json_({
    ok: true,
    duplicate: Boolean(duplicate),
    eventType: row.eventType,
    eventId: row.eventId,
    attemptId: row.attemptId,
    linkedAttemptId: row.linkedAttemptId || ''
  });
}

function UXQ_validateRequired_(row) {
  const common = ['eventId','studentId','studentName','section','courseId','missionId'];
  for (let i = 0; i < common.length; i += 1) if (!row[common[i]]) return common[i];
  if (row.eventType === 'mission_completed') return row.attemptId ? '' : 'attemptId';
  if (row.eventType === 'reason_retry_submitted') {
    if (!row.attemptId) return 'attemptId';
    if (!row.linkedAttemptId) return 'linkedAttemptId';
    if (!row.reasonRetryResponse) return 'reasonRetry.response';
    return '';
  }
  return 'eventType';
}

function UXQ_parsePayload_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (error) { return null; }
}

function UXQ_getSpreadsheet_() {
  if (UXQ_RECEIVER_SPREADSHEET_ID) return SpreadsheetApp.openById(UXQ_RECEIVER_SPREADSHEET_ID);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Set UXQ_RECEIVER_SPREADSHEET_ID before deploying a standalone receiver.');
}

function UXQ_getAttemptsSheet_() {
  const ss = UXQ_getSpreadsheet_();
  let sheet = ss.getSheetByName(UXQ_ATTEMPTS_SHEET);
  if (!sheet) sheet = ss.insertSheet(UXQ_ATTEMPTS_SHEET);
  UXQ_ensureAttemptHeaders_(sheet);
  return sheet;
}

function UXQ_ensureAttemptHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, UXQ_ATTEMPTS_HEADERS.length).setValues([UXQ_ATTEMPTS_HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }
  const currentLastColumn = Math.max(1, sheet.getLastColumn());
  const existing = sheet.getRange(1, 1, 1, currentLastColumn).getDisplayValues()[0];
  const existingKeys = {};
  existing.forEach(function(header) { existingKeys[UXQ_headerKey_(header)] = true; });
  const missing = UXQ_ATTEMPTS_HEADERS.filter(function(header) { return !existingKeys[UXQ_headerKey_(header)]; });
  if (!missing.length) return;
  sheet.getRange(1, currentLastColumn + 1, 1, missing.length).setValues([missing]);
  sheet.setFrozenRows(1);
}

function UXQ_headerKey_(value) {
  return String(value == null ? '' : value).trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '');
}

function UXQ_hasEvent_(sheet, eventId) {
  if (sheet.getLastRow() < 2) return false;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const eventColumn = headers.map(UXQ_headerKey_).indexOf(UXQ_headerKey_('eventId')) + 1;
  if (eventColumn < 1) return false;
  const finder = sheet.getRange(2, eventColumn, sheet.getLastRow() - 1, 1).createTextFinder(String(eventId)).matchEntireCell(true).findNext();
  return Boolean(finder);
}

function UXQ_appendRow_(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const values = UXQ_rowValues_(row, headers);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]);
}

function UXQ_text_(value, max) {
  let text = String(value == null ? '' : value).trim();
  if (max && text.length > max) text = text.slice(0, max);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
function UXQ_plainText_(value, max) {
  let text = String(value == null ? '' : value).trim();
  if (max && text.length > max) text = text.slice(0, max);
  return text;
}
function UXQ_num_(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function UXQ_numOrNull_(value) { if (value === null || value === undefined || String(value).trim() === '') return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function UXQ_clamp_(value, min, max) { return Math.max(min, Math.min(max, value)); }
function UXQ_bool_(value) { return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1'; }

function UXQ_safeAnswers_(items) {
  const source = Array.isArray(items) ? items.slice(0, 32) : [];
  return source.map(function(item) {
    const answer = item || {};
    return {
      questionId: UXQ_plainText_(answer.questionId, 160), caseId: UXQ_plainText_(answer.caseId, 100),
      caseName: UXQ_plainText_(answer.caseName, 160), stageKey: UXQ_plainText_(answer.stageKey, 80),
      correct: UXQ_bool_(answer.correct), verified: UXQ_bool_(answer.verified), reasonCorrect: UXQ_bool_(answer.reasonCorrect),
      selected: UXQ_plainText_(answer.selected, 420), reasonSelected: UXQ_plainText_(answer.reasonSelected, 520), earned: UXQ_num_(answer.earned)
    };
  });
}

function UXQ_safeReasonFocus_(items) {
  const source = Array.isArray(items) ? items.slice(0, 6) : [];
  return source.map(function(item) {
    if (item && typeof item === 'object') return { stageKey: UXQ_plainText_(item.stageKey || item.stage || '', 80), count: UXQ_num_(item.count), mainCorrect: UXQ_bool_(item.mainCorrect) };
    return { stageKey: UXQ_plainText_(item, 80), count: 0, mainCorrect: false };
  });
}
function UXQ_reasonFocusText_(focus) {
  const items = Array.isArray(focus) ? focus : [];
  return items.map(function(item) { const stage = UXQ_plainText_(item.stageKey || item.stage || 'reasoning', 80); const count = UXQ_num_(item.count); return count ? stage + ' • ' + count : stage; }).join(', ');
}
function UXQ_guessRisk_(verifiedAccuracy, rapidAttemptFlag) { if (rapidAttemptFlag || verifiedAccuracy < 55) return 'high'; if (verifiedAccuracy < 70) return 'medium'; return 'low'; }

function UXQ_learningFocus_(answers) {
  const groups = {};
  answers.filter(function(answer) { return !answer.verified; }).forEach(function(answer) {
    const stage = answer.stageKey || 'reasoning';
    if (!groups[stage]) groups[stage] = { count: 0, mainCorrect: true };
    groups[stage].count += 1;
    groups[stage].mainCorrect = groups[stage].mainCorrect && Boolean(answer.correct);
  });
  const focus = Object.keys(groups).map(function(stage) { return { stage: stage, count: groups[stage].count, mainCorrect: groups[stage].mainCorrect }; }).sort(function(a, b) { return b.count - a.count || a.stage.localeCompare(b.stage); }).slice(0, 3);
  if (!focus.length) return 'Reason Check complete';
  return focus.map(function(item) { return item.stage + ' • ' + item.count + ' ' + (item.mainCorrect ? 'reason' : 'answer + reason'); }).join(', ');
}

function UXQ_normalizeEvent_(payload) { return String(payload.eventType || '') === 'reason_retry_submitted' ? UXQ_normalizeReasonRetry_(payload) : UXQ_normalizeMissionCompleted_(payload); }

function UXQ_baseRow_(payload, now) {
  return {
    receivedAt: Utilities.formatDate(now, UXQ_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"), receivedDate: Utilities.formatDate(now, UXQ_TIMEZONE, 'yyyy-MM-dd'), receivedTime: Utilities.formatDate(now, UXQ_TIMEZONE, 'HH:mm:ss'),
    eventId: UXQ_text_(payload.eventId, 160), attemptId: UXQ_text_(payload.attemptId, 160), courseId: UXQ_text_(payload.courseId, 120), courseLabel: UXQ_text_(payload.courseLabel, 160),
    studentId: UXQ_text_(payload.studentId, 80), studentName: UXQ_text_(payload.studentName, 120), section: UXQ_text_(payload.section, 80),
    missionId: UXQ_text_(payload.missionId, 24), missionTitle: UXQ_text_(payload.missionTitle, 180),
    startedAt: UXQ_text_(payload.startedAt, 80), completedAt: UXQ_text_(payload.completedAt, 80), clientTimezone: UXQ_text_(payload.timezone, 80), pageUrl: UXQ_text_(payload.pageUrl, 500), schema: UXQ_text_(payload.schema, 80),
    eventType: UXQ_text_(payload.eventType, 80), linkedAttemptId: UXQ_text_(payload.linkedAttemptId, 160),
    reasonRetryResponse: '', reasonRetryVerifiedAccuracy: '', reasonRetryFocus: '', reasonRetrySubmittedAt: ''
  };
}

function UXQ_normalizeMissionCompleted_(payload) {
  const now = new Date(); const answers = UXQ_safeAnswers_(payload.answers);
  const total = UXQ_num_(payload.total) || answers.length;
  const correct = UXQ_numOrNull_(payload.correct) === null ? answers.filter(function(answer) { return answer.correct; }).length : UXQ_num_(payload.correct);
  const payloadVerifiedCorrect = UXQ_numOrNull_(payload.verifiedCorrect); const payloadVerifiedTotal = UXQ_numOrNull_(payload.verifiedTotal); const payloadVerifiedAccuracy = UXQ_numOrNull_(payload.verifiedAccuracy);
  const verifiedCorrect = UXQ_clamp_(payloadVerifiedCorrect === null ? answers.filter(function(answer) { return answer.verified; }).length : payloadVerifiedCorrect, 0, Math.max(total, answers.length));
  const verifiedTotal = Math.max(0, payloadVerifiedTotal === null ? total || answers.length : payloadVerifiedTotal);
  const verifiedAccuracy = UXQ_clamp_(payloadVerifiedAccuracy === null ? (verifiedTotal ? Math.round((verifiedCorrect / verifiedTotal) * 100) : 0) : payloadVerifiedAccuracy, 0, 100);
  const durationSec = Math.max(0, UXQ_num_(payload.durationSec));
  const calculatedRapid = durationSec > 0 && durationSec < Math.max(18, Math.max(total, 1) * 5);
  const rapidAttemptFlag = UXQ_bool_(payload.rapidAttemptFlag) || calculatedRapid;
  const sentRisk = String(payload.guessRisk || '').trim().toLowerCase();
  const guessRisk = ['low','medium','high'].indexOf(sentRisk) >= 0 ? sentRisk : UXQ_guessRisk_(verifiedAccuracy, rapidAttemptFlag);
  const learningFocus = UXQ_learningFocus_(answers); const base = UXQ_baseRow_(payload, now);
  return Object.assign(base, {
    passed: UXQ_bool_(payload.passed), score: UXQ_num_(payload.score), stars: UXQ_clamp_(UXQ_num_(payload.stars), 0, 3), accuracy: UXQ_clamp_(UXQ_num_(payload.accuracy), 0, 100), correct: correct, total: total,
    hints: UXQ_num_(payload.hints), durationSec: durationSec, maxCombo: UXQ_num_(payload.maxCombo), attemptNo: UXQ_num_(payload.attemptNo), badge: UXQ_text_(payload.badge, 120), caseIds: JSON.stringify((Array.isArray(payload.caseIds) ? payload.caseIds : []).slice(0, 8)),
    rawJson: JSON.stringify({ eventType: 'mission_completed', answers: answers, verifiedCorrect: verifiedCorrect, verifiedTotal: verifiedTotal, verifiedAccuracy: verifiedAccuracy, guessRisk: guessRisk, rapidAttemptFlag: rapidAttemptFlag, learningFocus: learningFocus, version: UXQ_text_(payload.schema, 80), client: { pageUrl: UXQ_text_(payload.pageUrl, 500), timezone: UXQ_text_(payload.timezone, 80) } }),
    verifiedCorrect: verifiedCorrect, verifiedTotal: verifiedTotal, verifiedAccuracy: verifiedAccuracy, guessRisk: guessRisk, rapidAttemptFlag: rapidAttemptFlag, learningFocus: UXQ_text_(learningFocus, 240)
  });
}

function UXQ_normalizeReasonRetry_(payload) {
  const now = new Date(); const retry = payload.reasonRetry || {}; const focus = UXQ_safeReasonFocus_(retry.focus); const responsePlain = UXQ_plainText_(retry.response, 420);
  const retryAccuracy = UXQ_clamp_(UXQ_numOrNull_(retry.verifiedAccuracy) === null ? 0 : UXQ_num_(retry.verifiedAccuracy), 0, 100);
  const base = UXQ_baseRow_(payload, now); const submittedAt = UXQ_text_(retry.submittedAt || payload.occurredAt || new Date().toISOString(), 80);
  return Object.assign(base, {
    passed: '', score: '', stars: '', accuracy: '', correct: '', total: '', hints: '', durationSec: '', maxCombo: '', attemptNo: '', badge: '', caseIds: '[]', startedAt: '', completedAt: UXQ_text_(payload.occurredAt, 80),
    rawJson: JSON.stringify({ app: 'ux-quest', schema: UXQ_plainText_(payload.schema || 'uxq.reason-retry.v1', 80), eventType: 'reason_retry_submitted', eventId: UXQ_plainText_(payload.eventId, 160), attemptId: UXQ_plainText_(payload.attemptId, 160), linkedAttemptId: UXQ_plainText_(payload.linkedAttemptId, 160), occurredAt: UXQ_plainText_(payload.occurredAt, 80), timezone: UXQ_plainText_(payload.timezone, 80), pageUrl: UXQ_plainText_(payload.pageUrl, 500), courseId: UXQ_plainText_(payload.courseId, 120), courseLabel: UXQ_plainText_(payload.courseLabel, 160), studentId: UXQ_plainText_(payload.studentId, 80), studentName: UXQ_plainText_(payload.studentName, 120), section: UXQ_plainText_(payload.section, 80), missionId: UXQ_plainText_(payload.missionId, 24), missionTitle: UXQ_plainText_(payload.missionTitle, 180), reasonRetry: { response: responsePlain, verifiedAccuracy: retryAccuracy, focus: focus, submittedAt: UXQ_plainText_(retry.submittedAt || payload.occurredAt || '', 80) } }),
    verifiedCorrect: '', verifiedTotal: '', verifiedAccuracy: '', guessRisk: '', rapidAttemptFlag: '', learningFocus: '', linkedAttemptId: UXQ_text_(payload.linkedAttemptId, 160), reasonRetryResponse: UXQ_text_(responsePlain, 420), reasonRetryVerifiedAccuracy: retryAccuracy, reasonRetryFocus: UXQ_text_(UXQ_reasonFocusText_(focus), 240), reasonRetrySubmittedAt: submittedAt
  });
}

function UXQ_rowValues_(row, actualHeaders) {
  const canonicalByKey = {}; UXQ_ATTEMPTS_HEADERS.forEach(function(header) { canonicalByKey[UXQ_headerKey_(header)] = header; });
  return actualHeaders.map(function(actualHeader) { const canonical = canonicalByKey[UXQ_headerKey_(actualHeader)]; if (!canonical) return ''; const value = row[canonical]; return value === null || value === undefined ? '' : value; });
}

function UXQ_json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
