/**
 * English Week Passport • Balanced Rotation Authority V2
 * Module only: no doGet/doPost declarations.
 *
 * Router integration:
 *   const assignment = EW_getOrCreatePassportAssignment_(playerId, { arrivalBatch, source });
 *   authority.assignment = assignment;
 */

var EW_ROTATION_VERSION = '2026-08-03-PASSPORT-ROTATION-V2-INDEPENDENT';
var EW_ROTATION_SHEET = 'EW_Assignments';
var EW_ROTATION_HEADERS = [
  'playerId',
  'passportRotation',
  'assessmentRotation',
  'preForm',
  'postForm',
  'randomSeed',
  'randomSeedHex',
  'assignmentVersion',
  'assignedAt',
  'assignmentLocked',
  'arrivalBatch',
  'source'
];
var EW_ROTATION_COMBINATIONS = [
  { passportRotation:'P1', assessmentRotation:'R1' },
  { passportRotation:'P1', assessmentRotation:'R2' },
  { passportRotation:'P2', assessmentRotation:'R1' },
  { passportRotation:'P2', assessmentRotation:'R2' },
  { passportRotation:'P3', assessmentRotation:'R1' },
  { passportRotation:'P3', assessmentRotation:'R2' },
  { passportRotation:'P4', assessmentRotation:'R1' },
  { passportRotation:'P4', assessmentRotation:'R2' }
];

function EW_setupPassportRotation_() {
  var sheet = EW_rotationSheet_();
  EW_ensureRotationHeaders_(sheet);
  sheet.setFrozenRows(1);
  return {
    ok:true,
    sheetName:EW_ROTATION_SHEET,
    assignmentVersion:EW_ROTATION_VERSION,
    headers:EW_ROTATION_HEADERS.slice()
  };
}

function EW_getOrCreatePassportAssignment_(playerId, metadata) {
  var id = EW_rotationText_(playerId);
  if (!id) throw new Error('PLAYER_ID_REQUIRED');
  metadata = metadata || {};

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = EW_rotationSheet_();
    EW_ensureRotationHeaders_(sheet);
    var existing = EW_findPassportAssignment_(sheet, id);
    if (existing) return existing;

    var rows = EW_rotationRows_(sheet);
    var counts = {};
    EW_ROTATION_COMBINATIONS.forEach(function(combo) {
      counts[EW_rotationComboKey_(combo.passportRotation, combo.assessmentRotation)] = 0;
    });
    rows.forEach(function(row) {
      if (String(row.assignmentLocked).toUpperCase() !== 'TRUE' && row.assignmentLocked !== true) return;
      var key = EW_rotationComboKey_(row.passportRotation, row.assessmentRotation);
      if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    });

    var minimum = Math.min.apply(null, Object.keys(counts).map(function(key) { return counts[key]; }));
    var candidates = EW_ROTATION_COMBINATIONS.filter(function(combo) {
      return counts[EW_rotationComboKey_(combo.passportRotation, combo.assessmentRotation)] === minimum;
    });
    candidates.sort(function(a, b) {
      var ah = EW_rotationHash32_(id + '|' + EW_rotationComboKey_(a.passportRotation, a.assessmentRotation) + '|' + EW_ROTATION_VERSION);
      var bh = EW_rotationHash32_(id + '|' + EW_rotationComboKey_(b.passportRotation, b.assessmentRotation) + '|' + EW_ROTATION_VERSION);
      return ah - bh;
    });

    var chosen = candidates[0];
    var seed = EW_rotationMix32_(EW_rotationHash32_(EW_ROTATION_VERSION + '|seed|' + id));
    var assessmentRotation = chosen.assessmentRotation;
    var assignment = {
      playerId:id,
      passportRotation:chosen.passportRotation,
      assessmentRotation:assessmentRotation,
      preForm:assessmentRotation === 'R1' ? 'A' : 'B',
      postForm:assessmentRotation === 'R1' ? 'B' : 'A',
      randomSeed:seed,
      randomSeedHex:EW_rotationHex_(seed),
      assignmentVersion:EW_ROTATION_VERSION,
      assignedAt:new Date().toISOString(),
      assignmentLocked:true,
      arrivalBatch:EW_rotationText_(metadata.arrivalBatch || metadata.batch || ''),
      source:EW_rotationText_(metadata.source || 'server-balanced')
    };

    sheet.appendRow(EW_ROTATION_HEADERS.map(function(header) { return assignment[header]; }));
    SpreadsheetApp.flush();
    return assignment;
  } finally {
    lock.releaseLock();
  }
}

function EW_readPassportAssignment_(playerId) {
  var id = EW_rotationText_(playerId);
  if (!id) return null;
  var sheet = EW_rotationSheet_();
  EW_ensureRotationHeaders_(sheet);
  return EW_findPassportAssignment_(sheet, id);
}

function EW_attachPassportAssignment_(authority, playerId, metadata) {
  var output = authority && typeof authority === 'object' ? authority : {};
  output.assignment = EW_getOrCreatePassportAssignment_(playerId, metadata || {});
  return output;
}

function EW_handlePassportAssignmentAction_(params) {
  params = params || {};
  var playerId = EW_rotationText_(params.playerId || params.studentId || params.pid);
  if (!playerId) return { ok:false, error:'PLAYER_ID_REQUIRED' };
  try {
    return {
      ok:true,
      assignment:EW_getOrCreatePassportAssignment_(playerId, {
        arrivalBatch:params.arrivalBatch || params.batch,
        source:params.source || 'assignment-action'
      })
    };
  } catch (error) {
    return { ok:false, error:String(error && error.message || error) };
  }
}

function EW_passportRotationHealth_() {
  var sheet = EW_rotationSheet_();
  EW_ensureRotationHeaders_(sheet);
  var rows = EW_rotationRows_(sheet);
  var counts = {};
  EW_ROTATION_COMBINATIONS.forEach(function(combo) {
    counts[EW_rotationComboKey_(combo.passportRotation, combo.assessmentRotation)] = 0;
  });
  rows.forEach(function(row) {
    var key = EW_rotationComboKey_(row.passportRotation, row.assessmentRotation);
    if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
  });
  var values = Object.keys(counts).map(function(key) { return counts[key]; });
  return {
    ok:true,
    version:EW_ROTATION_VERSION,
    sheetName:EW_ROTATION_SHEET,
    totalAssignments:rows.length,
    counts:counts,
    spread:values.length ? Math.max.apply(null, values) - Math.min.apply(null, values) : 0
  };
}

function EW_rotationSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('ACTIVE_SPREADSHEET_REQUIRED');
  return spreadsheet.getSheetByName(EW_ROTATION_SHEET) || spreadsheet.insertSheet(EW_ROTATION_SHEET);
}

function EW_ensureRotationHeaders_(sheet) {
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, EW_ROTATION_HEADERS.length).setValues([EW_ROTATION_HEADERS]);
    return;
  }
  var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), EW_ROTATION_HEADERS.length)).getDisplayValues()[0];
  var exact = EW_ROTATION_HEADERS.every(function(header, index) { return current[index] === header; });
  if (!exact) sheet.getRange(1, 1, 1, EW_ROTATION_HEADERS.length).setValues([EW_ROTATION_HEADERS]);
}

function EW_rotationRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, EW_ROTATION_HEADERS.length).getValues();
  return values.map(function(row) {
    var object = {};
    EW_ROTATION_HEADERS.forEach(function(header, index) { object[header] = row[index]; });
    return object;
  }).filter(function(row) { return EW_rotationText_(row.playerId); });
}

function EW_findPassportAssignment_(sheet, playerId) {
  var id = EW_rotationText_(playerId);
  var rows = EW_rotationRows_(sheet);
  for (var index = 0; index < rows.length; index += 1) {
    if (EW_rotationText_(rows[index].playerId) !== id) continue;
    var row = rows[index];
    return {
      playerId:id,
      passportRotation:EW_rotationText_(row.passportRotation),
      assessmentRotation:EW_rotationText_(row.assessmentRotation),
      preForm:EW_rotationText_(row.preForm),
      postForm:EW_rotationText_(row.postForm),
      randomSeed:Number(row.randomSeed) >>> 0,
      randomSeedHex:EW_rotationText_(row.randomSeedHex),
      assignmentVersion:EW_rotationText_(row.assignmentVersion),
      assignedAt:row.assignedAt instanceof Date ? row.assignedAt.toISOString() : EW_rotationText_(row.assignedAt),
      assignmentLocked:String(row.assignmentLocked).toUpperCase() === 'TRUE' || row.assignmentLocked === true,
      arrivalBatch:EW_rotationText_(row.arrivalBatch),
      source:EW_rotationText_(row.source)
    };
  }
  return null;
}

function EW_rotationComboKey_(passportRotation, assessmentRotation) {
  return EW_rotationText_(passportRotation) + '|' + EW_rotationText_(assessmentRotation);
}

function EW_rotationText_(value) {
  return String(value == null ? '' : value).trim();
}

function EW_rotationHex_(value) {
  var hex = (Number(value) >>> 0).toString(16);
  return ('00000000' + hex).slice(-8);
}

function EW_rotationHash32_(value) {
  var input = EW_rotationText_(value);
  var hash = 2166136261;
  for (var index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function EW_rotationMix32_(value) {
  var x = Number(value) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2146121005);
  x ^= x >>> 15;
  x = Math.imul(x, 2221713035);
  x ^= x >>> 16;
  return x >>> 0;
}
