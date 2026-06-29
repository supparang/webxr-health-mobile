/*
 * UX Quest • Anti-Guess Dashboard Patch v1
 *
 * Safe server-side helpers for the existing Teacher Dashboard.
 * This file does NOT define doGet(), does NOT write to the sheet, and does NOT
 * alter the Student Receiver. Add it to the existing teacher Apps Script project,
 * then call uxqGetTeacherView() from the dashboard's current data route.
 */

const UXQ_ATTEMPT_SHEET_NAME = 'UXQuest_Attempts';

function uxqGetTeacherView() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UXQ_ATTEMPT_SHEET_NAME);
  if (!sheet) throw new Error('ไม่พบชีต ' + UXQ_ATTEMPT_SHEET_NAME);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { generatedAt: new Date().toISOString(), attempts: [], students: [] };

  const headers = values[0].map(uxqHeaderKey_);
  const attempts = values.slice(1)
    .filter(row => row.some(cell => String(cell || '').trim() !== ''))
    .map(row => uxqMapAttemptRow_(headers, row))
    .filter(item => item.attemptId || item.missionId);

  const students = uxqSummarizeStudents_(attempts);
  return {
    generatedAt: new Date().toISOString(),
    attempts,
    students,
    summary: uxqBuildSummary_(attempts)
  };
}

function uxqHeaderKey_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '');
}

function uxqMapAttemptRow_(headers, row) {
  const raw = {};
  headers.forEach((header, index) => { raw[header || ('col' + index)] = row[index]; });

  const payload = uxqFindPayload_(row, raw);
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const total = uxqNumber_(uxqPick_(raw, ['total', 'evidencecalls'])) || answers.length;
  const correct = uxqNumber_(uxqPick_(raw, ['correct'])) || answers.filter(item => item && item.correct).length;
  const verifiedCorrect = uxqNumber_(payload.verifiedCorrect) || answers.filter(item => item && item.verified).length;
  const verifiedTotal = uxqNumber_(payload.verifiedTotal) || total || answers.length;
  const verifiedAccuracy = uxqNumber_(payload.verifiedAccuracy) || (verifiedTotal ? Math.round((verifiedCorrect / verifiedTotal) * 100) : 0);
  const durationSec = uxqNumber_(uxqPick_(raw, ['durationsec', 'เวลาเล่น', 'timeplayed'])) || 0;
  const rapidAttemptFlag = payload.rapidAttemptFlag === true || durationSec < Math.max(18, Math.max(total, 1) * 5);
  const guessRisk = String(payload.guessRisk || uxqGuessRisk_(verifiedAccuracy, rapidAttemptFlag) || 'medium');
  const focus = uxqBuildFocus_(answers);

  const attempt = {
    occurredAt: uxqPick_(raw, ['occurredat', 'timestamp', 'เวลาบันทึก']) || '',
    studentId: uxqPick_(raw, ['studentid', 'รหัสนักศึกษา']) || '',
    studentName: uxqPick_(raw, ['studentname', 'ชื่อผู้เรียน', 'ผู้เรียน']) || '',
    section: uxqPick_(raw, ['section', 'กลุ่ม', 'sectiongroup']) || '',
    missionId: uxqPick_(raw, ['missionid', 'mission']) || '',
    missionTitle: uxqPick_(raw, ['missiontitle', 'missionname']) || '',
    attemptId: uxqPick_(raw, ['attemptid']) || '',
    score: uxqNumber_(uxqPick_(raw, ['score'])),
    stars: uxqNumber_(uxqPick_(raw, ['stars', 'ดาว'])),
    accuracy: uxqNumber_(uxqPick_(raw, ['accuracy'])),
    correct,
    total,
    hints: uxqNumber_(uxqPick_(raw, ['hints', 'hint'])),
    durationSec,
    passed: uxqBoolean_(uxqPick_(raw, ['passed', 'ผ่าน'])),
    badge: uxqPick_(raw, ['badge']) || '',
    caseIds: uxqPick_(raw, ['caseids', 'คดี']) || '',
    verifiedCorrect,
    verifiedTotal,
    verifiedAccuracy,
    guessRisk,
    rapidAttemptFlag,
    focus,
    teacherStatus: uxqTeacherStatus_(verifiedAccuracy, rapidAttemptFlag),
    answers
  };
  return attempt;
}

function uxqPick_(raw, aliases) {
  for (let i = 0; i < aliases.length; i += 1) {
    const key = uxqHeaderKey_(aliases[i]);
    if (raw[key] !== undefined && raw[key] !== '') return raw[key];
  }
  return '';
}

function uxqFindPayload_(row, raw) {
  const direct = [raw.payload, raw.payloadjson, raw.rawpayload, raw.data, raw.details];
  const candidates = direct.concat(row || []);
  for (let i = 0; i < candidates.length; i += 1) {
    const value = candidates[i];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (!text || text.charAt(0) !== '{' || text.indexOf('"answers"') < 0) continue;
    try { return JSON.parse(text); }
    catch (error) {}
  }
  return {};
}

function uxqNumber_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uxqBoolean_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
}

function uxqGuessRisk_(verifiedAccuracy, rapidAttemptFlag) {
  if (rapidAttemptFlag || verifiedAccuracy < 55) return 'high';
  if (verifiedAccuracy < 70) return 'medium';
  return 'low';
}

function uxqTeacherStatus_(verifiedAccuracy, rapidAttemptFlag) {
  if (rapidAttemptFlag) return 'Rapid attempt • ตรวจหลักฐานเพิ่ม';
  if (verifiedAccuracy >= 70) return 'Mastery verified';
  if (verifiedAccuracy >= 55) return 'ทบทวนเหตุผล';
  return 'ควรฝึก Reason Check';
}

function uxqBuildFocus_(answers) {
  const groups = {};
  (answers || []).filter(item => item && !item.verified).forEach(item => {
    const key = String(item.stageKey || 'reasoning');
    if (!groups[key]) groups[key] = { stageKey: key, count: 0, mainCorrect: true };
    groups[key].count += 1;
    groups[key].mainCorrect = groups[key].mainCorrect && Boolean(item.correct);
  });
  return Object.keys(groups).map(key => groups[key])
    .sort((a, b) => b.count - a.count || a.stageKey.localeCompare(b.stageKey))
    .slice(0, 3);
}

function uxqBuildSummary_(attempts) {
  const list = attempts || [];
  const count = list.length;
  const avg = key => count ? Math.round(list.reduce((sum, item) => sum + uxqNumber_(item[key]), 0) / count) : 0;
  return {
    attempts: count,
    students: new Set(list.map(item => item.studentId || item.studentName).filter(Boolean)).size,
    avgAccuracy: avg('accuracy'),
    avgVerifiedAccuracy: avg('verifiedAccuracy'),
    rapidAttempts: list.filter(item => item.rapidAttemptFlag).length,
    masteryVerified: list.filter(item => item.verifiedAccuracy >= 70).length
  };
}

function uxqSummarizeStudents_(attempts) {
  const byStudent = {};
  (attempts || []).forEach(item => {
    const key = item.studentId || item.studentName || 'unknown';
    if (!byStudent[key]) byStudent[key] = { studentId: item.studentId, studentName: item.studentName, section: item.section, attempts: [] };
    byStudent[key].attempts.push(item);
  });
  return Object.keys(byStudent).map(key => {
    const student = byStudent[key];
    const sorted = student.attempts.slice().sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
    const latest = sorted[0] || {};
    const best = student.attempts.slice().sort((a, b) => b.verifiedAccuracy - a.verifiedAccuracy || b.score - a.score)[0] || {};
    return {
      studentId: student.studentId,
      studentName: student.studentName,
      section: student.section,
      attempts: student.attempts.length,
      latest,
      best
    };
  }).sort((a, b) => String(a.studentName).localeCompare(String(b.studentName)));
}
