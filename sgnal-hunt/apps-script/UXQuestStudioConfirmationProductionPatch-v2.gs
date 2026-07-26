/* =========================================================
 * CSAI2601 UX Quest • Studio Confirmation Production Patch v2
 * VERSION: 20260726-STUDIO-CONFIRMATION-PRODUCTION-V2
 *
 * PURPOSE
 * - Route action=uxq_student_studio_progress from the deployed doGet.
 * - Return JSONP diagnostics when Studio/Reflection cannot be confirmed.
 * - Read artifact_submitted rows from UXQuest_Attempts using tolerant headers.
 *
 * IMPORTANT
 * - This file intentionally does NOT declare doGet/doPost because the project
 *   may already have them. Add ONE call in the existing doGet as shown below.
 * - UXQuestStudentReceiver-v4-Artifacts.gs must remain the POST receiver.
 * ========================================================= */

var UXQ_STUDIO_CONFIRM_V2 = UXQ_STUDIO_CONFIRM_V2 || {};
UXQ_STUDIO_CONFIRM_V2.VERSION = '20260726-STUDIO-CONFIRMATION-PRODUCTION-V2';
UXQ_STUDIO_CONFIRM_V2.NODES = [
  'w1','w2','w3','b1','w4','w5','w6','w7','b2',
  'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'
];

/*
 * Add near the TOP of the deployed doGet(e):
 *
 *   var studioResponse = UXQ_routeStudioConfirmationV2_(e);
 *   if (studioResponse) return studioResponse;
 */
function UXQ_routeStudioConfirmationV2_(e) {
  var p = (e && e.parameter) || {};
  var action = UXQ_SC2_text_(p.action, 100).toLowerCase();
  if (action !== 'uxq_student_studio_progress') return null;

  var result;
  try {
    result = UXQ_getStudentStudioProgressV2_(e);
  } catch (error) {
    result = {
      ok: false,
      version: UXQ_STUDIO_CONFIRM_V2.VERSION,
      error: String(error && error.message ? error.message : error),
      diagnostic: 'studio_progress_exception'
    };
  }
  return UXQ_SC2_jsonp_(result, p.callback);
}

function UXQ_getStudentStudioProgressV2_(e) {
  var p = (e && e.parameter) || e || {};
  var studentId = UXQ_SC2_text_(p.studentId, 80);
  var section = UXQ_SC2_text_(p.section, 80);
  var courseId = UXQ_SC2_text_(p.courseId || 'UXQ-ACT1-2026', 120);

  if (!studentId || !section) {
    return {
      ok: false,
      version: UXQ_STUDIO_CONFIRM_V2.VERSION,
      error: 'missing_identity',
      diagnostic: 'studentId_and_section_required',
      received: { studentId: studentId, section: section, courseId: courseId }
    };
  }

  var sheet = UXQ_SC2_attemptsSheet_();
  if (!sheet) {
    return {
      ok: false,
      version: UXQ_STUDIO_CONFIRM_V2.VERSION,
      error: 'attempts_sheet_not_found',
      diagnostic: 'UXQuest_Attempts_missing'
    };
  }

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return {
      ok: true,
      version: UXQ_STUDIO_CONFIRM_V2.VERSION,
      studentId: studentId,
      section: section,
      courseId: courseId,
      nodes: UXQ_SC2_emptyNodes_(),
      summary: { matchedRows: 0, artifactRows: 0, totalRows: Math.max(0, lastRow - 1) },
      diagnostic: 'attempts_sheet_empty',
      generatedAt: new Date().toISOString()
    };
  }

  var values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  var headers = values.shift();
  var index = UXQ_SC2_headerIndex_(headers);
  var required = ['studentid','section','missionid','eventtype'];
  var missingHeaders = required.filter(function(key) { return index[key] === undefined; });
  if (missingHeaders.length) {
    return {
      ok: false,
      version: UXQ_STUDIO_CONFIRM_V2.VERSION,
      error: 'missing_attempt_headers',
      diagnostic: 'required_headers_not_found',
      missingHeaders: missingHeaders,
      availableHeaders: headers
    };
  }

  var nodes = UXQ_SC2_emptyNodes_();
  var matchedRows = 0;
  var artifactRows = 0;
  var identityMismatches = { studentId: 0, section: 0, courseId: 0 };

  values.forEach(function(row) {
    var rowStudentId = UXQ_SC2_cell_(row, index, 'studentid');
    var rowSection = UXQ_SC2_cell_(row, index, 'section');
    var rowCourseId = UXQ_SC2_cell_(row, index, 'courseid');
    var eventType = UXQ_SC2_cell_(row, index, 'eventtype').toLowerCase();

    if (rowStudentId !== studentId) { identityMismatches.studentId += 1; return; }
    if (rowSection !== section) { identityMismatches.section += 1; return; }
    if (rowCourseId && rowCourseId !== courseId) { identityMismatches.courseId += 1; return; }
    matchedRows += 1;
    if (eventType !== 'artifact_submitted') return;
    artifactRows += 1;

    var missionId = UXQ_SC2_mission_(UXQ_SC2_cell_(row, index, 'missionid'));
    if (UXQ_STUDIO_CONFIRM_V2.NODES.indexOf(missionId) < 0) return;

    var raw = UXQ_SC2_parseJson_(UXQ_SC2_cell_(row, index, 'rawjson'));
    var fields = Array.isArray(raw.artifactFields) ? raw.artifactFields : [];
    var fieldMap = {};
    fields.forEach(function(field) {
      if (!field) return;
      fieldMap[String(field.key || '')] = String(field.value || '');
    });

    var submittedAt = UXQ_SC2_cell_(row, index, 'artifactsubmittedat') ||
      UXQ_SC2_cell_(row, index, 'receivedat') ||
      UXQ_SC2_cell_(row, index, 'completedat');
    var reflection = UXQ_SC2_cell_(row, index, 'reflection') ||
      String(raw.reflection || fieldMap.reflection || '');
    var node = nodes[missionId];
    node.submitted = true;
    node.artifactSubmitted = true;
    node.studioSubmitted = true;
    node.submissions += 1;
    node.reflection = reflection;
    node.reflectionSubmitted = Boolean(String(reflection || '').trim());
    node.hasReflection = node.reflectionSubmitted;
    node.reviewStatus = 'submitted';
    node.status = 'submitted';

    if (!node.latestSubmittedAt || String(submittedAt) >= String(node.latestSubmittedAt)) {
      node.latestSubmittedAt = submittedAt;
      node.projectId = String(raw.projectId || fieldMap.projectId || UXQ_SC2_cell_(row, index, 'projectid') || '');
      node.figmaUrl = String(raw.figmaUrl || fieldMap.figmaUrl || UXQ_SC2_cell_(row, index, 'figmaurl') || '');
      node.eventId = UXQ_SC2_cell_(row, index, 'eventid');
      node.linkedAttemptId = UXQ_SC2_cell_(row, index, 'linkedattemptid');
    }
  });

  var submittedCount = UXQ_STUDIO_CONFIRM_V2.NODES.filter(function(id) { return nodes[id].submitted; }).length;
  var reflectionCount = UXQ_STUDIO_CONFIRM_V2.NODES.filter(function(id) { return nodes[id].reflectionSubmitted; }).length;

  return {
    ok: true,
    version: UXQ_STUDIO_CONFIRM_V2.VERSION,
    studentId: studentId,
    section: section,
    courseId: courseId,
    nodes: nodes,
    summary: {
      matchedRows: matchedRows,
      artifactRows: artifactRows,
      submittedCount: submittedCount,
      reflectionCount: reflectionCount,
      totalNodes: UXQ_STUDIO_CONFIRM_V2.NODES.length,
      totalRows: values.length
    },
    diagnostic: artifactRows ? 'artifact_rows_found' : 'no_matching_artifact_rows',
    identityMismatches: identityMismatches,
    generatedAt: new Date().toISOString()
  };
}

function UXQ_SC2_attemptsSheet_() {
  var ss = null;
  try {
    if (typeof UXQ_getSpreadsheet_ === 'function') ss = UXQ_getSpreadsheet_();
  } catch (ignore1) {}
  if (!ss) {
    try {
      if (typeof UXQ_RECEIVER_SPREADSHEET_ID !== 'undefined' && String(UXQ_RECEIVER_SPREADSHEET_ID || '').trim()) {
        ss = SpreadsheetApp.openById(String(UXQ_RECEIVER_SPREADSHEET_ID).trim());
      }
    } catch (ignore2) {}
  }
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('spreadsheet_not_available');

  var names = [];
  try { if (typeof UXQ_ATTEMPTS_SHEET !== 'undefined') names.push(String(UXQ_ATTEMPTS_SHEET)); } catch (ignore3) {}
  names.push('UXQuest_Attempts', 'uxquest_attempts', 'attempts');

  for (var i = 0; i < names.length; i += 1) {
    var name = String(names[i] || '').trim();
    if (!name) continue;
    var sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
  }
  return null;
}

function UXQ_SC2_emptyNodes_() {
  var nodes = {};
  UXQ_STUDIO_CONFIRM_V2.NODES.forEach(function(id) {
    nodes[id] = {
      missionId: id,
      submitted: false,
      artifactSubmitted: false,
      studioSubmitted: false,
      submissions: 0,
      latestSubmittedAt: '',
      projectId: '',
      figmaUrl: '',
      reflection: '',
      reflectionSubmitted: false,
      hasReflection: false,
      reviewStatus: 'not_submitted',
      status: 'not_submitted'
    };
  });
  return nodes;
}

function UXQ_SC2_headerIndex_(headers) {
  var index = {};
  headers.forEach(function(header, i) {
    index[UXQ_SC2_key_(header)] = i;
  });
  return index;
}

function UXQ_SC2_key_(value) {
  return String(value == null ? '' : value)
    .trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '');
}

function UXQ_SC2_cell_(row, index, key) {
  var i = index[key];
  return i === undefined ? '' : String(row[i] == null ? '' : row[i]).trim();
}

function UXQ_SC2_mission_(value) {
  var id = String(value || '').trim().toLowerCase();
  var match = id.match(/(?:^|[^a-z0-9])(w(?:[1-9]|1[0-5])|b[1-4])(?:$|[^a-z0-9])/i);
  return match ? String(match[1]).toLowerCase() : id;
}

function UXQ_SC2_parseJson_(value) {
  try { return JSON.parse(String(value || '')); }
  catch (error) { return {}; }
}

function UXQ_SC2_text_(value, max) {
  var text = String(value == null ? '' : value).trim();
  return max && text.length > max ? text.slice(0, max) : text;
}

function UXQ_SC2_jsonp_(payload, callback) {
  var cb = UXQ_SC2_text_(callback, 120);
  var json = JSON.stringify(payload == null ? {} : payload);
  if (/^[A-Za-z_$][0-9A-Za-z_$\.]{0,100}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/* Optional one-click diagnostic from Apps Script editor. */
function UXQ_testStudioConfirmationV2() {
  return {
    ok: true,
    version: UXQ_STUDIO_CONFIRM_V2.VERSION,
    spreadsheet: UXQ_SC2_attemptsSheet_().getParent().getName(),
    sheet: UXQ_SC2_attemptsSheet_().getName(),
    rows: UXQ_SC2_attemptsSheet_().getLastRow(),
    columns: UXQ_SC2_attemptsSheet_().getLastColumn()
  };
}
