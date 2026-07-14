/* =========================================================
 * UX Quest • Cross-device Progress Restore v1.3
 * Add this file to the SAME Apps Script project that owns UXQuest_Attempts.
 * Route from the project's existing doGet(e):
 *   if (String(e.parameter.action||'') === 'uxq_student_progress') return UXQ_getStudentProgress_(e);
 * Supports JSON and JSONP for GitHub Pages clients.
 *
 * v1.3
 * - Sheet is authoritative.
 * - Supports explicit per-student historical section aliases.
 * - Accepts historical rows whose courseId and/or eventType are blank.
 * - Requires only studentId, section and missionId columns.
 * - Normalizes numeric-looking IDs/sections and mission labels.
 * ========================================================= */

/*
 * Historical identity corrections.
 * Key format: studentId|canonicalSection
 * Value: old section values that may be read as evidence for that exact student.
 * This does NOT merge arbitrary sections or other students.
 */
const UXQ_PROGRESS_SECTION_ALIASES = {
  '3|201': ['101'],
  '50|201': ['101']
};

function UXQ_getStudentProgress_(e) {
  let callback = '';
  try {
    const p = (e && e.parameter) || {};
    const studentId = UXQ_restoreIdentity_(p.studentId, 80);
    const section = UXQ_restoreIdentity_(p.section, 80);
    const courseId = UXQ_restoreText_(p.courseId || 'UXQ-ACT1-2026', 120);
    callback = UXQ_restoreCallback_(p.callback);

    if (!studentId || !section || !courseId) {
      return UXQ_restoreOutput_({ ok:false, error:'missing_identity' }, callback);
    }

    const allowedSections = UXQ_restoreAllowedSections_(studentId, section);
    const sheet = UXQ_restoreAttemptsSheet_();
    if (!sheet || sheet.getLastRow() < 2) {
      return UXQ_restoreOutput_(UXQ_restoreEmpty_(studentId, section, courseId, {
        sheetName: sheet ? sheet.getName() : '',
        lastRow: sheet ? sheet.getLastRow() : 0,
        allowedSections: allowedSections
      }), callback);
    }

    const values = sheet.getDataRange().getDisplayValues();
    const headers = values.shift().map(UXQ_restoreKey_);
    const col = {};
    headers.forEach(function(key, index) {
      if (key && col[key] === undefined) col[key] = index;
    });

    const required = ['studentid','section','missionid'];
    for (let i = 0; i < required.length; i += 1) {
      if (col[required[i]] === undefined) {
        return UXQ_restoreOutput_({
          ok:false,
          error:'missing_sheet_column',
          column:required[i],
          sheetName:sheet.getName(),
          headers:headers
        }, callback);
      }
    }

    const missions = {};
    let matchingStudentRows = 0;
    let matchingIdentityRows = 0;
    let matchingCourseRows = 0;
    let matchingEventRows = 0;
    let acceptedRows = 0;
    let aliasRowsUsed = 0;
    const seenSections = {};
    const seenCourses = {};
    const seenEvents = {};

    values.forEach(function(row) {
      const rowStudentId = UXQ_restoreIdentity_(row[col.studentid], 80);
      const rowSection = UXQ_restoreIdentity_(row[col.section], 80);

      if (rowStudentId !== studentId) return;
      matchingStudentRows += 1;
      seenSections[rowSection || '(blank)'] = true;

      if (allowedSections.indexOf(rowSection) === -1) return;
      matchingIdentityRows += 1;
      if (rowSection !== section) aliasRowsUsed += 1;

      const rowCourseId = col.courseid === undefined
        ? ''
        : UXQ_restoreText_(row[col.courseid], 120);
      seenCourses[rowCourseId || '(blank)'] = true;
      if (rowCourseId && rowCourseId !== courseId) return;
      matchingCourseRows += 1;

      const eventType = col.eventtype === undefined
        ? ''
        : String(row[col.eventtype] || '').trim().toLowerCase();
      seenEvents[eventType || '(blank)'] = true;
      if (eventType && eventType !== 'mission_completed') return;
      matchingEventRows += 1;

      const id = UXQ_restoreMissionId_(row[col.missionid]);
      if (!id) return;
      acceptedRows += 1;

      const score = UXQ_restoreColNum_(row, col, 'score');
      const stars = UXQ_restoreColNum_(row, col, 'stars');
      const accuracy = UXQ_restoreColNum_(row, col, 'accuracy');
      const correct = UXQ_restoreColNum_(row, col, 'correct');
      const total = UXQ_restoreColNum_(row, col, 'total');
      const hints = UXQ_restoreColNum_(row, col, 'hints');
      const durationSec = UXQ_restoreColNum_(row, col, 'durationsec');
      const passedCell = col.passed === undefined ? '' : row[col.passed];
      const passed = UXQ_restoreBool_(passedCell) || stars >= 2;
      const completedAt = UXQ_restoreText_(
        (col.completedat === undefined ? '' : row[col.completedat]) ||
        (col.receivedat === undefined ? '' : row[col.receivedat]),
        80
      );
      const badge = UXQ_restoreText_(
        col.badge === undefined ? '' : row[col.badge],
        120
      );

      const previous = missions[id] || {
        id:id,
        attempts:0,
        completed:false,
        bestScore:0,
        bestStars:0,
        bestAccuracy:0,
        bestCorrect:0,
        total:0,
        hints:0,
        durationSec:0,
        lastCompletedAt:'',
        badge:''
      };

      previous.attempts += 1;
      previous.completed = previous.completed || passed;
      previous.bestScore = Math.max(previous.bestScore, score);
      previous.bestStars = Math.max(previous.bestStars, stars);
      previous.bestAccuracy = Math.max(previous.bestAccuracy, accuracy);
      previous.bestCorrect = Math.max(previous.bestCorrect, correct);
      previous.total = Math.max(previous.total, total);

      if (!previous.lastCompletedAt || completedAt >= previous.lastCompletedAt) {
        previous.lastCompletedAt = completedAt;
        previous.hints = hints;
        previous.durationSec = durationSec;
        previous.badge = badge;
      }
      missions[id] = previous;
    });

    const order = [
      'w1','w2','w3','b1','w4','w5','w6','w7','b2',
      'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'
    ];

    const completedNodes = order.filter(function(id) {
      return missions[id] && (
        missions[id].completed ||
        Number(missions[id].bestStars || 0) >= 2
      );
    }).length;

    const nextMission = order.find(function(id) {
      return !missions[id] || !(
        missions[id].completed ||
        Number(missions[id].bestStars || 0) >= 2
      );
    }) || '';

    return UXQ_restoreOutput_({
      ok:true,
      found:acceptedRows > 0,
      studentId:studentId,
      section:section,
      canonicalSection:section,
      courseId:courseId,
      matchingRows:acceptedRows,
      completedNodes:completedNodes,
      nextMission:nextMission,
      missions:missions,
      diagnostics:{
        version:'uxq-progress-restore-v1.3',
        sheetName:sheet.getName(),
        lastRow:sheet.getLastRow(),
        matchingStudentRows:matchingStudentRows,
        matchingIdentityRows:matchingIdentityRows,
        matchingCourseRows:matchingCourseRows,
        matchingEventRows:matchingEventRows,
        acceptedRows:acceptedRows,
        allowedSections:allowedSections,
        aliasRowsUsed:aliasRowsUsed,
        seenSections:Object.keys(seenSections),
        seenCourses:Object.keys(seenCourses),
        seenEvents:Object.keys(seenEvents)
      },
      restoredAt:new Date().toISOString()
    }, callback);
  } catch (error) {
    return UXQ_restoreOutput_({
      ok:false,
      error:String(error && error.message ? error.message : error)
    }, callback);
  }
}

function UXQ_restoreAllowedSections_(studentId, canonicalSection) {
  const key = studentId + '|' + canonicalSection;
  const aliases = UXQ_PROGRESS_SECTION_ALIASES[key] || [];
  const result = [canonicalSection];
  aliases.forEach(function(value) {
    const section = UXQ_restoreIdentity_(value, 80);
    if (section && result.indexOf(section) === -1) result.push(section);
  });
  return result;
}

function UXQ_restoreAttemptsSheet_() {
  const sheetName = (
    typeof UXQ_ATTEMPTS_SHEET !== 'undefined' && UXQ_ATTEMPTS_SHEET
  ) ? String(UXQ_ATTEMPTS_SHEET) : 'UXQuest_Attempts';

  let spreadsheetId = '';
  try {
    if (
      typeof UXQ_RECEIVER_SPREADSHEET_ID !== 'undefined' &&
      UXQ_RECEIVER_SPREADSHEET_ID
    ) {
      spreadsheetId = String(UXQ_RECEIVER_SPREADSHEET_ID).trim();
    }
  } catch (error) {}

  if (!spreadsheetId) {
    try {
      spreadsheetId = String(
        PropertiesService.getScriptProperties()
          .getProperty('UXQ_RECEIVER_SPREADSHEET_ID') || ''
      ).trim();
    } catch (error) {}
  }

  let ss = null;
  if (spreadsheetId) ss = SpreadsheetApp.openById(spreadsheetId);
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('ไม่พบ Spreadsheet: ตั้ง UXQ_RECEIVER_SPREADSHEET_ID ใน Script Properties');
  }

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('ไม่พบชีต ' + sheetName);
  return sheet;
}

function UXQ_restoreEmpty_(studentId, section, courseId, diagnostics) {
  return {
    ok:true,
    found:false,
    studentId:studentId,
    section:section,
    canonicalSection:section,
    courseId:courseId,
    matchingRows:0,
    completedNodes:0,
    nextMission:'w1',
    missions:{},
    diagnostics:Object.assign({ version:'uxq-progress-restore-v1.3' }, diagnostics || {}),
    restoredAt:new Date().toISOString()
  };
}

function UXQ_restoreMissionId_(value) {
  const text = String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const match = text.match(
    /(?:^|[^a-z0-9])(w(?:[1-9]|1[0-5])|b[1-4])(?:$|[^a-z0-9])/i
  ) || text.match(/^(w(?:[1-9]|1[0-5])|b[1-4])$/i);
  return match ? String(match[1]).toLowerCase() : '';
}

function UXQ_restoreColNum_(row, col, key) {
  return col[key] === undefined ? 0 : UXQ_restoreNum_(row[col[key]]);
}

function UXQ_restoreKey_(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, '');
}

function UXQ_restoreIdentity_(value, max) {
  let text = String(value == null ? '' : value).trim();
  if (/^\d+\.0+$/.test(text)) text = text.replace(/\.0+$/, '');
  if (max && text.length > max) text = text.slice(0, max);
  return text;
}

function UXQ_restoreText_(value, max) {
  let text = String(value == null ? '' : value).trim();
  if (max && text.length > max) text = text.slice(0, max);
  return text;
}

function UXQ_restoreNum_(value) {
  const number = Number(
    String(value == null ? '' : value).replace(/,/g, '').trim()
  );
  return Number.isFinite(number) ? number : 0;
}

function UXQ_restoreBool_(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return value === true || value === 1 || text === 'true' ||
    text === '1' || text === 'yes' || text === 'passed' || text === 'ผ่าน';
}

function UXQ_restoreCallback_(value) {
  const callback = String(value || '').trim();
  return /^[A-Za-z_$][0-9A-Za-z_$\.]{0,120}$/.test(callback) ? callback : '';
}

function UXQ_restoreOutput_(value, callback) {
  const json = JSON.stringify(value);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
