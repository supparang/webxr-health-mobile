/**
 * HeroHealth Reflection Pending Queue R56
 * Server-side durable queue for cross-device Reflection recovery.
 *
 * IMPORTANT:
 * - Do not declare doGet/doPost in this file.
 * - Add the routing calls documented at the bottom to the current Receiver.
 */
var HH_RPQ56 = HH_RPQ56 || {};
HH_RPQ56.VERSION = '2026-08-01-REFLECTION-PENDING-QUEUE-R56';
HH_RPQ56.SHEET = 'HH_Reflection_Pending';
HH_RPQ56.HEADERS = [
  'serverTs','pendingId','studentId','fullName','section','group','status',
  'understand','best','action','submittedAt','sourceDeviceId','updatedAt',
  'commitEventId','committedAt','attemptCount','lastError','payloadJson'
];

HH_RPQ56.text_ = function(v){ return String(v == null ? '' : v).trim(); };
HH_RPQ56.number_ = function(v){ var n = Number(v); return isFinite(n) ? n : 0; };
HH_RPQ56.sid_ = function(v){
  return typeof cleanStudentId_ === 'function' ? cleanStudentId_(v) : HH_RPQ56.text_(v);
};
HH_RPQ56.ss_ = function(){
  if (typeof getHHSpreadsheet_ === 'function') return getHHSpreadsheet_();
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('spreadsheet_not_configured');
  return active;
};
HH_RPQ56.sheet_ = function(){
  var ss = HH_RPQ56.ss_();
  var sh = ss.getSheetByName(HH_RPQ56.SHEET);
  if (!sh) sh = ss.insertSheet(HH_RPQ56.SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(HH_RPQ56.HEADERS);
  var actual = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),HH_RPQ56.HEADERS.length)).getValues()[0];
  var mismatch = HH_RPQ56.HEADERS.some(function(h,i){ return HH_RPQ56.text_(actual[i]) !== h; });
  if (mismatch) sh.getRange(1,1,1,HH_RPQ56.HEADERS.length).setValues([HH_RPQ56.HEADERS]);
  sh.setFrozenRows(1);
  return sh;
};
HH_RPQ56.rows_ = function(sh){
  if (sh.getLastRow() < 2) return [];
  var values = sh.getRange(2,1,sh.getLastRow()-1,HH_RPQ56.HEADERS.length).getValues();
  return values.map(function(r,index){
    var o = {_row:index+2};
    HH_RPQ56.HEADERS.forEach(function(h,i){ o[h]=r[i]; });
    return o;
  });
};
HH_RPQ56.latest_ = function(studentId, includeClosed){
  var sid = HH_RPQ56.sid_(studentId), rows = HH_RPQ56.rows_(HH_RPQ56.sheet_());
  return rows.filter(function(r){
    if (HH_RPQ56.sid_(r.studentId) !== sid) return false;
    return includeClosed || ['PENDING','RETRY'].indexOf(HH_RPQ56.text_(r.status).toUpperCase()) >= 0;
  }).sort(function(a,b){ return new Date(b.updatedAt||b.serverTs||0)-new Date(a.updatedAt||a.serverTs||0); })[0] || null;
};
HH_RPQ56.validReflection_ = function(r){
  return r && HH_RPQ56.number_(r.understand) > 0 && HH_RPQ56.text_(r.best) && HH_RPQ56.text_(r.action);
};

function HH_RPQ56_setup(){
  var sh = HH_RPQ56.sheet_();
  return {ok:true,version:HH_RPQ56.VERSION,sheet:sh.getName(),headers:HH_RPQ56.HEADERS.length};
}

function HH_RPQ56_savePending(payload){
  payload = payload || {};
  var sid = HH_RPQ56.sid_(payload.studentId), reflection = payload.reflection || {}, profile = payload.profile || {};
  if (!sid) return {ok:false,error:'missing_studentId',version:HH_RPQ56.VERSION};
  if (!HH_RPQ56.validReflection_(reflection)) return {ok:false,error:'reflection_incomplete',version:HH_RPQ56.VERSION};
  var sh = HH_RPQ56.sheet_(), now = new Date(), existing = HH_RPQ56.latest_(sid,false);
  var pendingId = HH_RPQ56.text_(payload.pendingId) || ('RPQ-'+sid+'-'+Utilities.getUuid());
  var row = [
    now,pendingId,sid,HH_RPQ56.text_(profile.fullName),HH_RPQ56.text_(profile.section),HH_RPQ56.text_(profile.group),
    'PENDING',HH_RPQ56.number_(reflection.understand),HH_RPQ56.text_(reflection.best),HH_RPQ56.text_(reflection.action),
    reflection.submittedAt || payload.clientTs || now.toISOString(),HH_RPQ56.text_(payload.sourceDeviceId),now,
    '', '', existing ? HH_RPQ56.number_(existing.attemptCount)+1 : 1, '', JSON.stringify(payload)
  ];
  if (existing) {
    pendingId = HH_RPQ56.text_(existing.pendingId) || pendingId;
    row[1] = pendingId;
    sh.getRange(existing._row,1,1,row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  SpreadsheetApp.flush();
  return {ok:true,pending:true,pendingId:pendingId,studentId:sid,status:'PENDING',version:HH_RPQ56.VERSION,authority:'google_sheet'};
}

function HH_RPQ56_getPending(studentId){
  var sid = HH_RPQ56.sid_(studentId), row = HH_RPQ56.latest_(sid,false);
  if (!row) return {ok:true,found:false,studentId:sid,version:HH_RPQ56.VERSION,authority:'google_sheet'};
  return {ok:true,found:true,studentId:sid,pendingId:row.pendingId,status:row.status,reflection:{
    understand:HH_RPQ56.number_(row.understand),best:HH_RPQ56.text_(row.best),action:HH_RPQ56.text_(row.action),submittedAt:row.submittedAt
  },profile:{fullName:row.fullName,section:row.section,group:row.group},updatedAt:row.updatedAt,version:HH_RPQ56.VERSION,authority:'google_sheet'};
}

function HH_RPQ56_commit(studentId, pendingId){
  var sid = HH_RPQ56.sid_(studentId), row = HH_RPQ56.latest_(sid,false);
  if (!row) return {ok:false,error:'pending_not_found',studentId:sid,version:HH_RPQ56.VERSION};
  if (pendingId && HH_RPQ56.text_(row.pendingId) !== HH_RPQ56.text_(pendingId)) return {ok:false,error:'pending_id_mismatch',version:HH_RPQ56.VERSION};
  var reflection = {understand:HH_RPQ56.number_(row.understand),best:HH_RPQ56.text_(row.best),action:HH_RPQ56.text_(row.action),submittedAt:row.submittedAt};
  if (!HH_RPQ56.validReflection_(reflection)) return {ok:false,error:'pending_reflection_incomplete',version:HH_RPQ56.VERSION};
  if (typeof acceptPayload_ !== 'function') return {ok:false,error:'acceptPayload_not_available',version:HH_RPQ56.VERSION};
  var eventId = 'HH-reflection-'+sid+'-'+HH_RPQ56.text_(row.pendingId).replace(/[^0-9A-Za-z_-]/g,'').slice(-48);
  var payload = {eventId:eventId,eventType:'reflection',studentId:sid,clientTs:new Date().toISOString(),profile:{fullName:row.fullName||'',section:row.section||'',group:row.group||''},reflection:reflection,sourcePendingId:row.pendingId,recovery:{type:'server_pending_queue_commit',version:HH_RPQ56.VERSION}};
  var result = acceptPayload_(payload);
  if (!result || result.ok !== true) {
    HH_RPQ56.sheet_().getRange(row._row,7).setValue('RETRY');
    HH_RPQ56.sheet_().getRange(row._row,17).setValue(HH_RPQ56.text_(result && result.error || 'commit_failed'));
    return {ok:false,error:HH_RPQ56.text_(result && result.error || 'commit_failed'),pendingId:row.pendingId,version:HH_RPQ56.VERSION};
  }
  var sh = HH_RPQ56.sheet_(), now = new Date();
  sh.getRange(row._row,7).setValue('COMMITTED');
  sh.getRange(row._row,13).setValue(now);
  sh.getRange(row._row,14).setValue(eventId);
  sh.getRange(row._row,15).setValue(now);
  sh.getRange(row._row,17).setValue('');
  SpreadsheetApp.flush();
  try { if (typeof HH_rebuildStudentLive === 'function') HH_rebuildStudentLive(sid); } catch (_) {}
  return {ok:true,committed:true,pendingId:row.pendingId,eventId:eventId,studentId:sid,receiverResult:result,version:HH_RPQ56.VERSION,authority:'google_sheet'};
}

function HH_RPQ56_routeGet(e){
  var p = e && e.parameter || {}, action = HH_RPQ56.text_(p.action);
  if (action === 'reflectionPendingGet') return HH_RPQ56_getPending(p.studentId);
  if (action === 'reflectionPendingCommit') return HH_RPQ56_commit(p.studentId,p.pendingId);
  if (action === 'reflectionPendingSetup') return HH_RPQ56_setup();
  return null;
}

function HH_RPQ56_routeSubmit(payload){
  if (!payload) return null;
  if (payload.eventType === 'reflection_pending') return HH_RPQ56_savePending(payload);
  return null;
}

/* RECEIVER INTEGRATION — add before normal routes:

Inside doGet(e), after action is read:
  var rpqGet = HH_RPQ56_routeGet(e);
  if (rpqGet) return output_(rpqGet,e);

Inside acceptPayload_(p), before duplicate/route_ processing:
  var rpqSubmit = HH_RPQ56_routeSubmit(p);
  if (rpqSubmit) return rpqSubmit;

Run HH_RPQ56_setup() once, then deploy a NEW Web App version.
*/
