/* EAP Word Quest Group 122 — v254 restore from v252 quarantine.
   Facts confirmed by teacher: KK/12 owns one complete 20-mission route;
   KP/50 owns at most one additional attempt. Add as a new Apps Script file.
   Run inspectEapWordQuestRestoreV254(), then applyEapWordQuestRestoreV254(). */

var EAPWQ_R254_GROUP = '122';
var EAPWQ_R254_SOURCE = 'core-state-backfill-v243';
var EAPWQ_R254_Q = 'eap_word_quarantine';
var EAPWQ_R254_AUDIT = 'eap_word_restore_audit';
var EAPWQ_R254_FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];

function inspectEapWordQuestRestoreV254() {
  var p = eapwqR254Plan_();
  return {ok:p.ok,message:p.message,eligible:p.rows.length,kk:p.kk.length,kp:p.kp.length,missing:p.missing,details:p.details};
}

function applyEapWordQuestRestoreV254() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    setupEapWordQuest();
    var p = eapwqR254Plan_();
    if (!p.ok) throw new Error(p.message);
    var attempts = eapwqSheet_(EAPWQ.attempts);
    var h = EAPWQ_HEADERS[EAPWQ.attempts];
    var existing = attempts.getDataRange().getValues();
    var fp = h.indexOf('fingerprint'), seen = {};
    existing.slice(1).forEach(function(r){ seen[String(r[fp] || '')] = true; });
    var out = [], audit = [], stamp = eapwqNow_();
    function restore(item, id, name, source) {
      var r = item.data.slice();
      var oldFp = String(r[fp] || '');
      var newFp = ['v254-restore',EAPWQ_R254_GROUP,id,item.sessionId,oldFp].join('|');
      if (seen[newFp]) return;
      seen[newFp] = true;
      r[h.indexOf('studentId')] = id;
      r[h.indexOf('studentName')] = name;
      r[h.indexOf('group')] = EAPWQ_R254_GROUP;
      r[h.indexOf('section')] = EAPWQ_R254_GROUP;
      r[h.indexOf('source')] = source;
      r[fp] = newFp;
      var ei = h.indexOf('extraJson');
      if (ei >= 0) r[ei] = JSON.stringify({restoredBy:'v254',quarantineRow:item.row,owner:{studentId:id,studentName:name},oldFingerprint:oldFp});
      out.push(r);
      audit.push([stamp,item.row,item.sessionId,id,name,oldFp,newFp,source]);
    }
    p.kk.forEach(function(x){ restore(x,'12','KK','teacher-confirmed-kk-route-restore-v254'); });
    p.kp.forEach(function(x){ restore(x,'50','KP','teacher-confirmed-kp-one-session-restore-v254'); });
    if (out.length) attempts.getRange(attempts.getLastRow()+1,1,out.length,h.length).setValues(out);
    eapwqR254Audit_(audit);
    eapwqR254Summary_();
    SpreadsheetApp.flush();
    return {ok:true,restoredKK:p.kk.length,restoredKP:p.kp.length,appended:out.length};
  } finally { lock.releaseLock(); }
}

function eapwqR254Plan_() {
  var q = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EAPWQ_R254_Q);
  if (!q || q.getLastRow() < 2) return {ok:false,message:'No eap_word_quarantine data found.',rows:[],kk:[],kp:[],missing:EAPWQ_R254_FLOW.slice(),details:[]};
  var v = q.getDataRange().getValues(), h = v[0].map(String), ah = EAPWQ_HEADERS[EAPWQ.attempts];
  function cell(r,k){ var i=h.indexOf(k); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); }
  var rows = [];
  v.slice(1).forEach(function(r,n){
    var sid = cell(r,'sessionId').toUpperCase();
    var source = cell(r,'source').toLowerCase();
    var section = cell(r,'section') || cell(r,'group');
    if (source !== EAPWQ_R254_SOURCE || (section && section !== EAPWQ_R254_GROUP) || EAPWQ_R254_FLOW.indexOf(sid) < 0) return;
    var data = ah.map(function(k){ var i=h.indexOf(k); return i < 0 ? '' : r[i]; });
    var dt = new Date(cell(r,'playedAt') || 0).getTime();
    rows.push({row:n+2,sessionId:sid,time:isFinite(dt)?dt:0,data:data});
  });
  var by = {};
  rows.forEach(function(x){ (by[x.sessionId] = by[x.sessionId] || []).push(x); });
  Object.keys(by).forEach(function(k){ by[k].sort(function(a,b){ return a.time-b.time || a.row-b.row; }); });
  var kk = [], used = {}, missing = [];
  EAPWQ_R254_FLOW.forEach(function(s){ if (!by[s] || !by[s].length) missing.push(s); else { kk.push(by[s][0]); used[by[s][0].row] = true; } });
  var kp = rows.filter(function(x){ return !used[x.row]; });
  var ok = !missing.length && kp.length <= 1;
  return {ok:ok,message:ok?'Plan ready: KK 20 route; KP '+kp.length+' extra row.':(missing.length?'Missing sessions: '+missing.join(', '):'Expected at most one extra KP row, found '+kp.length+'.'),rows:rows,kk:kk,kp:kp,missing:missing,details:rows.map(function(x){return {row:x.row,sessionId:x.sessionId,owner:used[x.row]?'KK/12':'KP/50'};})};
}

function eapwqR254Summary_() {
  var a = eapwqSheet_(EAPWQ.attempts), s = eapwqSheet_(EAPWQ.summary), ah = EAPWQ_HEADERS[EAPWQ.attempts], sh = EAPWQ_HEADERS[EAPWQ.summary], v = a.getDataRange().getValues();
  if (s.getLastRow() > 1) s.getRange(2,1,s.getLastRow()-1,sh.length).clearContent();
  v.slice(1).forEach(function(r){
    var raw = {}; ah.forEach(function(k,i){raw[k]=r[i];});
    if (!raw.studentId || !raw.sessionId || String(raw.sessionId).toUpperCase()==='PROFILE') return;
    eapwqUpsertSummary_(eapwqNormalizeAttempt_(raw,{clientTs:raw.clientTs,pageUrl:raw.pageUrl,userAgent:raw.userAgent,schemaVersion:raw.schemaVersion}));
  });
}

function eapwqR254Audit_(rows) {
  if (!rows.length) return;
  var ss=SpreadsheetApp.getActiveSpreadsheet(), h=['restoredAt','quarantineRow','sessionId','studentId','studentName','oldFingerprint','newFingerprint','source'], sh=ss.getSheetByName(EAPWQ_R254_AUDIT);
  if (!sh) sh=ss.insertSheet(EAPWQ_R254_AUDIT);
  if (sh.getLastRow()===0) sh.getRange(1,1,1,h.length).setValues([h]);
  sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}
