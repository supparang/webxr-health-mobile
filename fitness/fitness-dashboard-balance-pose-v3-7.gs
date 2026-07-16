/**
 * Fitness AR Teacher Dashboard — Balance Hold Pose Extension
 * File: fitness-dashboard-balance-pose-v3-7.gs
 * Version: v20260716-FITNESS-DASHBOARD-V3-7-BALANCE-TWIN-POSE
 *
 * Paste this file into the same Apps Script project as
 * fitness-dashboard-canonical-identity-lock-v3-6.gs.
 * The HTML calls FD_getDashboardDataV37 first and falls back to FD_getDashboardData.
 */
const FDBP_VERSION = 'v20260716-FITNESS-DASHBOARD-V3-7-BALANCE-TWIN-POSE';
const FDBP_SHEETS = ['BalanceHold_Summary','Balance_Hold_Summary','BalanceHold_Results','balancehold_summary'];

function FD_getDashboardDataV37(filters) {
  const data = FD_getDashboardData(filters || {});
  const ss = FDBP_getSpreadsheet_();
  const poseRows = FDBP_readRows_(ss);
  const index = FDBP_index_(poseRows);

  ['records','rawRecords','latest'].forEach(function(key) {
    data[key] = (data[key] || []).map(function(row) {
      if (String(row.game || '') !== 'balancehold') return row;
      return FDBP_enrich_(row, FDBP_match_(row, index));
    });
  });

  const matchedBalance = (data.records || []).filter(function(r) {
    return String(r.game || '') === 'balancehold';
  });

  data.balancePose = FDBP_buildPanel_(matchedBalance);
  data.version = String(data.version || '') + ' + ' + FDBP_VERSION;
  data.balancePoseVersion = FDBP_VERSION;
  data.needsSupport = FDBP_mergeSupport_(data.needsSupport || [], matchedBalance);
  return data;
}

function FDBP_getSpreadsheet_() {
  if (typeof FD_getSpreadsheet_ === 'function') return FD_getSpreadsheet_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet for Fitness Dashboard.');
  return ss;
}

function FDBP_norm_(v) {
  return String(v == null ? '' : v).toLowerCase().trim().replace(/[^a-z0-9ก-๙]+/g, '');
}

function FDBP_num_(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, '').replace(/%/g, ''));
  return Number.isFinite(n) ? n : null;
}

function FDBP_pick_(o, keys) {
  o = o || {};
  for (let i = 0; i < keys.length; i++) {
    const k = FDBP_norm_(keys[i]);
    if (o[k] !== undefined && o[k] !== null && String(o[k]) !== '') return o[k];
  }
  return '';
}

function FDBP_bool_(v) {
  const s = String(v || '').toLowerCase().trim();
  return s === 'true' || s === 'yes' || s === '1' || s === 'passed' || s === 'pass';
}

function FDBP_parseJson_(v) {
  if (!v || typeof v === 'object') return v && typeof v === 'object' ? v : {};
  try { return JSON.parse(String(v)); } catch (_) { return {}; }
}

function FDBP_flat_(obj, out) {
  out = out || {};
  Object.keys(obj || {}).forEach(function(k) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) FDBP_flat_(v, out);
    else out[FDBP_norm_(k)] = Array.isArray(v) ? JSON.stringify(v) : v;
  });
  return out;
}

function FDBP_readRows_(ss) {
  const rows = [];
  const seenSheets = {};
  FDBP_SHEETS.forEach(function(name) {
    const sh = ss.getSheetByName(name);
    if (!sh || seenSheets[sh.getSheetId()]) return;
    seenSheets[sh.getSheetId()] = true;
    FDBP_readSheet_(sh).forEach(function(r) { rows.push(r); });
  });

  ss.getSheets().forEach(function(sh) {
    if (seenSheets[sh.getSheetId()]) return;
    const compact = String(sh.getName() || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (compact.indexOf('balancehold') === -1 || compact.indexOf('event') !== -1 || compact.indexOf('raw') !== -1) return;
    FDBP_readSheet_(sh).forEach(function(r) { rows.push(r); });
  });
  return rows;
}

function FDBP_readSheet_(sh) {
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const headers = sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(FDBP_norm_);
  const values = sh.getRange(2,1,lastRow-1,lastCol).getDisplayValues();
  return values.map(function(row, idx) {
    const raw = {};
    headers.forEach(function(h, c) { if (h) raw[h] = row[c]; });
    const extra = FDBP_flat_(FDBP_parseJson_(FDBP_pick_(raw,['rawJson','__extraJson','payload','json'])));
    Object.keys(extra).forEach(function(k) { if (raw[k] === undefined || raw[k] === '') raw[k] = extra[k]; });
    raw.__sheet = sh.getName();
    raw.__row = idx + 2;
    return FDBP_normalizePose_(raw);
  }).filter(function(r) { return r.roundId || r.studentId || r.studentName; });
}

function FDBP_normalizePose_(raw) {
  const percent = function(keys) {
    const n = FDBP_num_(FDBP_pick_(raw, keys));
    if (n === null) return null;
    return n > 0 && n <= 1 ? Math.round(n * 1000) / 10 : Math.max(0, Math.min(100, n));
  };
  const attemptId = String(FDBP_pick_(raw,['attemptId','roundId','submissionKey']) || '');
  const roundId = String(FDBP_pick_(raw,['roundId','attemptId']) || '');
  const studentId = String(FDBP_pick_(raw,['studentId','student_id','sid','pid','playerId']) || '');
  const studentName = String(FDBP_pick_(raw,['studentName','student_name','player','name']) || '');
  const timestamp = String(FDBP_pick_(raw,['serverTimestamp','timestampLocal','timestamp','clientTimestamp','ts']) || '');
  return {
    attemptId: attemptId,
    roundId: roundId,
    sessionId: String(FDBP_pick_(raw,['sessionId','session']) || ''),
    studentId: studentId,
    studentName: studentName,
    classId: String(FDBP_pick_(raw,['classId','class','group']) || ''),
    section: String(FDBP_pick_(raw,['section','sec']) || ''),
    timestamp: timestamp,
    score: FDBP_num_(FDBP_pick_(raw,['score','finalScore'])) || 0,
    assessmentScore: percent(['assessmentScore','focusScore']),
    poseAccuracy: percent(['poseAccuracy','accuracy','accPct']),
    stabilityScore: percent(['stabilityScore','holdStability','stability']),
    transitionScore: percent(['transitionScore','transitionControl','controlScore']),
    safeZoneScore: percent(['safeZoneScore','safeZone','safetyScore']),
    trackingCoverage: percent(['trackingCoverage','trackingQualityScore']),
    trackingConfidence: percent(['trackingConfidence','confidence']),
    validHoldRatio: percent(['validHoldRatio','holdRatio']),
    completionRate: percent(['completionRate']),
    completedPoses: FDBP_num_(FDBP_pick_(raw,['completedPoses','passedPosts','hit'])) || 0,
    totalPoses: FDBP_num_(FDBP_pick_(raw,['totalPoses','totalPosts'])) || 0,
    lostPoseCount: FDBP_num_(FDBP_pick_(raw,['lostPoseCount','poseLostCount','lostCount','miss'])) || 0,
    assistLevelMax: FDBP_num_(FDBP_pick_(raw,['assistLevelMax','assistLevel'])) || 0,
    assistUsed: FDBP_bool_(FDBP_pick_(raw,['assistUsed'])) || (FDBP_num_(FDBP_pick_(raw,['assistLevelMax'])) || 0) > 0,
    calibrationStatus: String(FDBP_pick_(raw,['calibrationStatus']) || ''),
    poseSequence: String(FDBP_pick_(raw,['poseSequence']) || ''),
    passed: FDBP_bool_(FDBP_pick_(raw,['passed','pass','grade'])),
    sourceSheet: raw.__sheet,
    rowNumber: raw.__row
  };
}

function FDBP_keys_(r) {
  const out = [];
  ['roundId','attemptId','sessionId'].forEach(function(k) {
    const v = String(r[k] || '').trim(); if (v) out.push(k + ':' + v);
  });
  const sid = String(r.studentId || r.playerId || '').trim();
  const ts = String(r.serverTimestamp || r.clientTimestamp || r.timestamp || '').slice(0,16);
  if (sid && ts) out.push('studenttime:' + sid + ':' + ts);
  return out;
}

function FDBP_index_(rows) {
  const idx = {};
  rows.forEach(function(r) { FDBP_keys_(r).forEach(function(k) { if (!idx[k]) idx[k] = r; }); });
  return idx;
}

function FDBP_match_(r, idx) {
  const keys = FDBP_keys_(r);
  for (let i = 0; i < keys.length; i++) if (idx[keys[i]]) return idx[keys[i]];
  return null;
}

function FDBP_enrich_(row, pose) {
  if (!pose) return row;
  const out = Object.assign({}, row);
  ['assessmentScore','poseAccuracy','stabilityScore','transitionScore','safeZoneScore','trackingCoverage','trackingConfidence','validHoldRatio','completedPoses','totalPoses','lostPoseCount','assistLevelMax','assistUsed','calibrationStatus','poseSequence','passed'].forEach(function(k) {
    if (pose[k] !== null && pose[k] !== undefined && pose[k] !== '') out[k] = pose[k];
  });
  out.balancePoseAvailable = true;
  out.accuracy = pose.poseAccuracy !== null ? pose.poseAccuracy : out.accuracy;
  out.completionRate = pose.completionRate !== null ? pose.completionRate : out.completionRate;
  return out;
}

function FDBP_avg_(rows, key) {
  const vals = rows.map(function(r) { return FDBP_num_(r[key]); }).filter(function(v) { return v !== null; });
  if (!vals.length) return 0;
  return Math.round(vals.reduce(function(a,b){return a+b;},0) / vals.length * 10) / 10;
}

function FDBP_buildPanel_(rows) {
  const latest = rows.slice().sort(function(a,b) {
    return (new Date(b.serverTimestamp || b.clientTimestamp || 0).getTime() || b.rowNumber || 0) - (new Date(a.serverTimestamp || a.clientTimestamp || 0).getTime() || a.rowNumber || 0);
  }).slice(0,120);
  return {
    available: rows.some(function(r){return !!r.balancePoseAvailable;}),
    rounds: rows.length,
    avgPoseAccuracy: FDBP_avg_(rows,'poseAccuracy'),
    avgStability: FDBP_avg_(rows,'stabilityScore'),
    avgTransition: FDBP_avg_(rows,'transitionScore'),
    avgSafeZone: FDBP_avg_(rows,'safeZoneScore'),
    avgTracking: FDBP_avg_(rows,'trackingCoverage'),
    totalLostPose: rows.reduce(function(s,r){return s + Number(r.lostPoseCount || 0);},0),
    assistedRounds: rows.filter(function(r){return r.assistUsed || Number(r.assistLevelMax || 0)>0;}).length,
    rows: latest
  };
}

function FDBP_mergeSupport_(base, rows) {
  const out = (base || []).slice();
  const existing = {};
  out.forEach(function(r){existing[String(r.studentId||r.player||'') + ':' + String(r.game||r.gameLabel||'')] = true;});
  rows.forEach(function(r) {
    const weak = Number(r.stabilityScore || 0) < 60 || Number(r.transitionScore || 0) < 60 || Number(r.safeZoneScore || 0) < 65 || Number(r.trackingCoverage || 0) < 70;
    if (!weak) return;
    const id = String(r.studentId || r.playerId || r.player || '');
    const key = id + ':balancehold'; if (existing[key]) return; existing[key] = true;
    let advice = 'ฝึก Balance Hold เพิ่ม';
    if (Number(r.trackingCoverage || 0) < 70) advice = 'ปรับระยะกล้องและแสงให้เห็นทั้งตัวต่อเนื่อง';
    else if (Number(r.stabilityScore || 0) < 60) advice = 'ฝึก Sky Shield โดยหายใจช้าและลดการสั่นของลำตัว';
    else if (Number(r.transitionScore || 0) < 60) advice = 'ฝึกเปลี่ยนจาก Center ไป Star Reach ให้ช้าลง';
    else if (Number(r.safeZoneScore || 0) < 65) advice = 'รักษาเท้าทั้งสองใน Safe Zone และลดการโยกสะโพก';
    out.push({player:r.player||r.studentName||'Hero',studentId:id,game:'balancehold',gameLabel:'Balance Hold',accuracy:r.poseAccuracy||r.accuracy||0,advice:advice});
  });
  return out;
}