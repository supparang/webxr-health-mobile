/* =========================================================
 * UX Quest • Reason Check Review Queue v1
 *
 * Add this file to the private Teacher Dashboard Apps Script project.
 * It reads UXQuest_Attempts and writes teacher decisions only to a new
 * UXQuest_ReasonReview sheet. It does not change scores, unlocks, or the
 * public student receiver.
 * ========================================================= */

const UXQ_RQ_ATTEMPTS_SHEET = 'UXQuest_Attempts';
const UXQ_RQ_REVIEW_SHEET = 'UXQuest_ReasonReview';
const UXQ_RQ_HEADERS = [
  'reviewKey', 'linkedAttemptId', 'studentId', 'missionId', 'reviewStatus',
  'feedbackCode', 'teacherNote', 'reviewer', 'updatedAt'
];

function uxqGetReasonReviewQueue() {
  const attempts = uxqRQReadAttempts_();
  const reviews = uxqRQReadReviews_();
  const reviewByAttempt = {};
  reviews.forEach(function(row) { reviewByAttempt[row.linkedAttemptId] = row; });

  const retries = {};
  attempts.filter(function(item) { return item.eventType === 'reason_retry_submitted'; })
    .forEach(function(item) {
      const key = item.linkedAttemptId;
      if (!key) return;
      if (!retries[key] || String(retries[key].occurredAt) < String(item.occurredAt)) retries[key] = item;
    });

  const items = attempts.filter(function(item) {
    return item.eventType === 'mission_completed' && (item.verifiedAccuracy < 70 || item.rapidAttemptFlag);
  }).map(function(item) {
    const retry = retries[item.attemptId] || null;
    const review = reviewByAttempt[item.attemptId] || null;
    const status = review ? review.reviewStatus : (retry ? 'pending_teacher_review' : 'awaiting_retry');
    return {
      queueKey: item.attemptId,
      occurredAt: item.occurredAt,
      studentId: item.studentId,
      studentName: item.studentName,
      section: item.section,
      missionId: item.missionId,
      missionTitle: item.missionTitle,
      score: item.score,
      accuracy: item.accuracy,
      verifiedAccuracy: item.verifiedAccuracy,
      verifiedCorrect: item.verifiedCorrect,
      verifiedTotal: item.verifiedTotal,
      durationSec: item.durationSec,
      rapidAttemptFlag: item.rapidAttemptFlag,
      focus: item.focus,
      answers: item.answers,
      retry: retry ? retry.reasonRetry : null,
      retryOccurredAt: retry ? retry.occurredAt : '',
      review: review,
      status: status
    };
  }).sort(function(a, b) { return String(b.occurredAt).localeCompare(String(a.occurredAt)); });

  return {
    generatedAt: new Date().toISOString(),
    items: items,
    summary: {
      total: items.length,
      awaitingRetry: items.filter(function(item) { return item.status === 'awaiting_retry'; }).length,
      pendingTeacherReview: items.filter(function(item) { return item.status === 'pending_teacher_review'; }).length,
      verified: items.filter(function(item) { return item.status === 'verified'; }).length,
      discuss: items.filter(function(item) { return item.status === 'discuss_in_class'; }).length
    }
  };
}

function uxqSaveReasonReview(input) {
  input = input || {};
  const linkedAttemptId = String(input.linkedAttemptId || '').trim();
  const reviewStatus = String(input.reviewStatus || '').trim();
  const feedbackCode = String(input.feedbackCode || '').trim();
  const teacherNote = String(input.teacherNote || '').trim().slice(0, 1200);
  const allowedStatus = ['verified', 'prompt_again', 'discuss_in_class'];
  const allowedCodes = ['', 'CL', 'EV', 'ST', 'QA'];

  if (!linkedAttemptId) throw new Error('ไม่พบ linkedAttemptId สำหรับบันทึกผลการทบทวน');
  if (allowedStatus.indexOf(reviewStatus) < 0) throw new Error('reviewStatus ไม่ถูกต้อง');
  if (allowedCodes.indexOf(feedbackCode) < 0) throw new Error('feedbackCode ไม่ถูกต้อง');

  const sheet = uxqRQEnsureReviewSheet_();
  const values = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  const reviewer = Session.getActiveUser().getEmail() || 'teacher';
  const row = [
    'uxq-review-' + new Date().getTime(), linkedAttemptId,
    String(input.studentId || ''), String(input.missionId || ''), reviewStatus,
    feedbackCode, teacherNote, reviewer, now
  ];

  let target = -1;
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][1] || '') === linkedAttemptId) { target = i + 1; break; }
  }
  if (target > 0) sheet.getRange(target, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);

  return { ok: true, linkedAttemptId: linkedAttemptId, reviewStatus: reviewStatus, updatedAt: now };
}

function uxqRQReadAttempts_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UXQ_RQ_ATTEMPTS_SHEET);
  if (!sheet) throw new Error('ไม่พบชีต ' + UXQ_RQ_ATTEMPTS_SHEET);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9ก-๙]+/g, ''); });
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell || '').trim() !== ''; });
  }).map(function(row) {
    const raw = {};
    headers.forEach(function(header, index) { raw[header || ('col' + index)] = row[index]; });
    const payload = uxqRQPayload_(row, raw);
    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    const verifiedTotal = uxqRQNumber_(payload.verifiedTotal || payload.total || answers.length);
    const verifiedCorrect = uxqRQNumber_(payload.verifiedCorrect || answers.filter(function(item) { return item && item.verified; }).length);
    const verifiedAccuracy = uxqRQNumber_(payload.verifiedAccuracy || (verifiedTotal ? Math.round(verifiedCorrect * 100 / verifiedTotal) : 0));
    return {
      eventType: String(payload.eventType || raw.eventtype || 'mission_completed'),
      occurredAt: String(payload.occurredAt || raw.occurredat || raw.timestamp || ''),
      attemptId: String(payload.attemptId || raw.attemptid || ''),
      linkedAttemptId: String(payload.linkedAttemptId || ''),
      studentId: String(payload.studentId || raw.studentid || ''),
      studentName: String(payload.studentName || raw.studentname || ''),
      section: String(payload.section || raw.section || ''),
      missionId: String(payload.missionId || raw.missionid || ''),
      missionTitle: String(payload.missionTitle || raw.missiontitle || ''),
      score: uxqRQNumber_(payload.score || raw.score),
      accuracy: uxqRQNumber_(payload.accuracy || raw.accuracy),
      verifiedAccuracy: verifiedAccuracy,
      verifiedCorrect: verifiedCorrect,
      verifiedTotal: verifiedTotal,
      durationSec: uxqRQNumber_(payload.durationSec || raw.durationsec),
      rapidAttemptFlag: payload.rapidAttemptFlag === true,
      focus: uxqRQFocus_(answers),
      answers: answers.filter(function(item) { return item && item.verified !== true; }).slice(0, 8).map(function(item) {
        return { stageKey: item.stageKey || 'reasoning', selected: item.selected || '', reasonSelected: item.reasonSelected || '', correct: Boolean(item.correct), verified: Boolean(item.verified) };
      }),
      reasonRetry: payload.reasonRetry || null
    };
  }).filter(function(item) { return item.attemptId || item.eventType === 'reason_retry_submitted'; });
}

function uxqRQReadReviews_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UXQ_RQ_REVIEW_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map(function(row) {
    return {
      reviewKey: row[0], linkedAttemptId: String(row[1] || ''), studentId: row[2], missionId: row[3],
      reviewStatus: row[4], feedbackCode: row[5], teacherNote: row[6], reviewer: row[7], updatedAt: row[8]
    };
  }).filter(function(row) { return row.linkedAttemptId; });
}

function uxqRQEnsureReviewSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(UXQ_RQ_REVIEW_SHEET);
  if (!sheet) sheet = book.insertSheet(UXQ_RQ_REVIEW_SHEET);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, UXQ_RQ_HEADERS.length).setValues([UXQ_RQ_HEADERS]);
  return sheet;
}

function uxqRQPayload_(row, raw) {
  const candidates = [raw.payload, raw.payloadjson, raw.rawpayload, raw.data, raw.details].concat(row || []);
  for (let i = 0; i < candidates.length; i += 1) {
    const value = candidates[i];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (!text || text.charAt(0) !== '{') continue;
    try {
      const parsed = JSON.parse(text);
      if (parsed && (parsed.eventType || parsed.attemptId || parsed.linkedAttemptId)) return parsed;
    } catch (error) {}
  }
  return {};
}

function uxqRQNumber_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uxqRQFocus_(answers) {
  const counts = {};
  (answers || []).filter(function(item) { return item && item.verified !== true; }).forEach(function(item) {
    const key = String(item.stageKey || 'reasoning');
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; }).slice(0, 3).map(function(key) {
    return { stageKey: key, count: counts[key] };
  });
}
