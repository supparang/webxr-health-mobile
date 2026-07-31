/**
 * HeroHealth Assessment Authority V10
 * Version: 2026-07-31-PRODUCTION-V10-ASSESSMENT-PAIR-REGISTRY
 *
 * PURPOSE
 * - Keep Google Sheet as the sole research authority.
 * - Save one stable Pre-test pair registry per student and study.
 * - Expose the registry to Post-test on any device.
 * - Save long-format item telemetry for Item Analysis, KR-20 and Learning Gain.
 *
 * INSTALLATION IN THE SAME APPS SCRIPT PROJECT
 * 1) Keep HeroHealthClassroomReceiver.gs for common sheets/helpers/routes.
 * 2) Keep HeroHealthAuthorityV9.gs for its header-resilient helper functions.
 * 3) Keep only ONE doGet(e) and ONE doPost(e): comment/remove the older
 *    doGet/doPost declarations in the base/V9 files, then use the declarations here.
 * 4) Deploy as a NEW VERSION.
 */

const HH_AUTHORITY_V10 = '2026-07-31-PRODUCTION-V10-ASSESSMENT-PAIR-REGISTRY';
const HH_V10_ASSIGNMENTS = 'HH_Assessment_Assignments';
const HH_V10_ITEMS = 'HH_Assessment_Item_Analytics';

const HH_V10_ASSIGNMENT_HEADERS = [
  'studentId','studyId','preAttemptId','form','assessmentVersion','engineVersion',
  'selectionSeed','assignmentMethod','assignmentSource','assignmentFingerprint',
  'pairIdsJson','questionOrderJson','optionOrdersJson','correctPositionDistributionJson',
  'createdAt','updatedAt','sourceEventId'
];
const HH_V10_ITEM_HEADERS = [
  'serverTs','eventId','studentId','fullName','section','group','assessment','studyId',
  'attemptId','preAttemptId','form','assessmentVersion','engineVersion','assignmentFingerprint',
  'itemIndex','questionId','pairId','domain','indicator','difficulty','bloom',
  'selectedDisplayIndex','selectedOptionIndex','optionOrderJson','correctPosition','correct',
  'responseTimeMs','answerChangeCount','clientTs'
];

function doGet(e) {
  const action = text_(e && e.parameter && e.parameter.action || 'ping');
  try {
    if (action === 'submit') return output_(HHV10_accept_(parsePayload_(e)),e);
    const ss = getHHSpreadsheet_();
    const sid = cleanStudentId_(e && e.parameter && (e.parameter.studentId || e.parameter.sid || e.parameter.pid));
    if (action === 'student') {
      const base = HHV9_buildStudentAuthority_(ss,sid);
      return output_(HHV10_attachAssignment_(ss,sid,base),e);
    }
    if (action === 'assessmentAssignment') {
      const assignment = HHV10_getAssignment_(ss,sid);
      return output_({ok:true,found:!!assignment,studentId:sid,assessmentAssignment:assignment,version:HH_AUTHORITY_V10,authority:'google_sheet'},e);
    }
    if (action === 'studentDebug') {
      const debug = HHV9_studentDebug_(ss,sid);
      debug.assessmentAssignment = HHV10_getAssignment_(ss,sid);
      debug.version = HH_AUTHORITY_V10;
      return output_(debug,e);
    }
    if (action === 'event') return output_(buildEventPayload_(ss,e),e);
    if (action === 'live') return output_(buildLivePayload_(ss,e),e);
    if (action === 'reconcileStudent') return output_(HHV9_rebuildStudentLive_(sid),e);
    if (action === 'reconcileAll') return output_(HHV9_rebuildAllLive_(),e);
    if (action === 'setup') return output_(HHV10_setup_(),e);
    return output_({
      ok:true,
      service:'HeroHealth Classroom Receiver',
      version:HH_AUTHORITY_V10,
      baseVersion:typeof HH_VERSION==='undefined'?'':HH_VERSION,
      authority:'google_sheet',
      assessmentAuthority:'student-stable-pair-registry-v10',
      assignmentEndpoint:true,
      itemAnalytics:'long-format-v10',
      ts:new Date().toISOString()
    },e);
  } catch (err) {
    logErrorSafe_('',e && e.parameter && e.parameter.studentId,err,{action:action,parameters:e && e.parameter || {}});
    return output_({ok:false,error:String(err && err.message || err),version:HH_AUTHORITY_V10},e);
  }
}

function doPost(e) {
  return json_(HHV10_accept_(parsePayload_(e)));
}

function HHV10_setup_() {
  const ss = getHHSpreadsheet_();
  HH_setupSheets();
  HHV10_ensureSheet_(ss,HH_V10_ASSIGNMENTS,HH_V10_ASSIGNMENT_HEADERS);
  HHV10_ensureSheet_(ss,HH_V10_ITEMS,HH_V10_ITEM_HEADERS);
  return {ok:true,version:HH_AUTHORITY_V10,spreadsheetId:ss.getId(),assignmentSheet:HH_V10_ASSIGNMENTS,itemSheet:HH_V10_ITEMS};
}

function HHV10_accept_(raw) {
  const p = HHV10_unwrapEvent_(raw);
  const result = acceptPayload_(p);
  if (result && result.ok === true && p && p.eventType === 'assessment') {
    try { HHV10_saveAssessmentResearch_(getHHSpreadsheet_(),p); }
    catch (err) { logErrorSafe_(p.eventId,p.studentId,err,{stage:'assessment_v10_research_save',payload:p}); }
  }
  if (result && typeof result === 'object') {
    result.version = HH_AUTHORITY_V10;
    result.assessmentRegistrySaved = p && p.eventType === 'assessment';
  }
  return result;
}

function HHV10_unwrapEvent_(raw) {
  let p = raw || {};
  if (p.payload && typeof p.payload === 'string') {
    try { p = JSON.parse(p.payload); } catch (_) {}
  } else if (!p.eventType && p.payload && typeof p.payload === 'object') {
    p = p.payload;
  }
  if (!p.assessment && p.data && p.data.assessment) p.assessment = p.data.assessment;
  return p;
}

function HHV10_ensureSheet_(ss,name,headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const current = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getDisplayValues()[0];
    headers.forEach((h,i)=>{ if (!current[i]) sh.getRange(1,i+1).setValue(h); });
  }
  return sh;
}

function HHV10_assessment_(p) {
  return p && p.assessment && typeof p.assessment === 'object' ? p.assessment : {};
}

function HHV10_saveAssessmentResearch_(ss,p) {
  HHV10_setup_();
  const a = HHV10_assessment_(p);
  const type = HHV9_normalizeAssessment_(a.type || a.mode || '');
  if (type === 'pretest') HHV10_upsertAssignment_(ss,p,a);
  HHV10_saveItems_(ss,p,a,type);
  SpreadsheetApp.flush();
}

function HHV10_array_(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const parsed=JSON.parse(value); return Array.isArray(parsed)?parsed:[]; }
    catch (_) { return value.split(',').map(x=>String(x).trim()).filter(Boolean); }
  }
  return [];
}

function HHV10_upsertAssignment_(ss,p,a) {
  const pairIds = HHV10_array_(a.pairIds);
  if (pairIds.length !== 15 || new Set(pairIds).size !== 15) throw new Error('invalid_pretest_pair_registry');
  const sh = HHV10_ensureSheet_(ss,HH_V10_ASSIGNMENTS,HH_V10_ASSIGNMENT_HEADERS);
  const sid = cleanStudentId_(p.studentId);
  const studyId = text_(a.studyId || 'HEROHEALTH-P5-2026');
  const rows = sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,HH_V10_ASSIGNMENT_HEADERS.length).getValues() : [];
  let rowNumber = 0,createdAt = new Date();
  for (let i=0;i<rows.length;i++) {
    if (cleanStudentId_(rows[i][0])===sid && text_(rows[i][1])===studyId) {
      rowNumber=i+2;
      createdAt=rows[i][14]||createdAt;
      break;
    }
  }
  const values = [
    sid,studyId,text_(a.preAttemptId||a.attemptId),text_(a.form),text_(a.assessmentVersion),text_(a.engineVersion),
    a.selectionSeed==null?'':a.selectionSeed,text_(a.assignmentMethod),text_(a.assignmentSource),text_(a.assignmentFingerprint),
    JSON.stringify(pairIds),JSON.stringify(HHV10_array_(a.questionOrder)),JSON.stringify(HHV10_array_(a.optionOrders)),JSON.stringify(a.correctPositionDistribution||{}),
    createdAt,new Date(),text_(p.eventId)
  ];
  if (rowNumber) sh.getRange(rowNumber,1,1,values.length).setValues([values]);
  else sh.appendRow(values);
}

function HHV10_saveItems_(ss,p,a,type) {
  const responses = Array.isArray(a.responses)?a.responses:[];
  if (!responses.length) return;
  const sh = HHV10_ensureSheet_(ss,HH_V10_ITEMS,HH_V10_ITEM_HEADERS);
  const existing = new Set();
  if (sh.getLastRow()>1) {
    const rows=sh.getRange(2,1,sh.getLastRow()-1,HH_V10_ITEM_HEADERS.length).getDisplayValues();
    rows.forEach(r=>existing.add(String(r[1])+'|'+String(r[15])));
  }
  const pr=p.profile||{},rows=[];
  responses.forEach((r,index)=>{
    const key=String(p.eventId)+'|'+String(r.questionId||'');
    if(existing.has(key))return;
    rows.push([
      new Date(),p.eventId,p.studentId,pr.fullName||p.fullName||'',pr.section||p.section||'',pr.group||p.group||'',type,text_(a.studyId),
      text_(a.attemptId),text_(a.preAttemptId),text_(a.form),text_(a.assessmentVersion),text_(a.engineVersion),text_(a.assignmentFingerprint),
      index+1,text_(r.questionId),text_(r.pairId),text_(r.domain),text_(r.indicator),text_(r.difficulty),text_(r.bloom),
      r.selectedDisplayIndex==null?'':r.selectedDisplayIndex,r.selectedOptionIndex==null?'':r.selectedOptionIndex,JSON.stringify(r.optionOrder||[]),text_(r.correctPosition),r.correct===true,
      number_(r.responseTimeMs),number_(r.answerChangeCount),p.clientTs||''
    ]);
  });
  if(rows.length)sh.getRange(sh.getLastRow()+1,1,rows.length,HH_V10_ITEM_HEADERS.length).setValues(rows);
}

function HHV10_assignmentFromRow_(row) {
  if (!row) return null;
  const payloadRaw = HHV9_pick_(row,['payloadJson','payload','json']);
  let p=null;
  try { p=typeof payloadRaw==='string'?JSON.parse(payloadRaw):payloadRaw; } catch (_) {}
  const a=p&&p.assessment||p&&p.payload&&p.payload.assessment||null;
  if(!a)return null;
  const pairIds=HHV10_array_(a.pairIds);
  if(pairIds.length!==15||new Set(pairIds).size!==15)return null;
  return {
    studentId:cleanStudentId_(p.studentId),studyId:text_(a.studyId),preAttemptId:text_(a.preAttemptId||a.attemptId),attemptId:text_(a.attemptId),
    form:text_(a.form),assessmentVersion:text_(a.assessmentVersion),engineVersion:text_(a.engineVersion),selectionSeed:a.selectionSeed==null?null:a.selectionSeed,
    assignmentMethod:text_(a.assignmentMethod),assignmentSource:text_(a.assignmentSource||'assessment-payload-fallback'),assignmentFingerprint:text_(a.assignmentFingerprint),
    pairIds:pairIds,questionOrder:HHV10_array_(a.questionOrder),optionOrders:HHV10_array_(a.optionOrders),correctPositionDistribution:a.correctPositionDistribution||{},
    createdAt:p.clientTs||HHV9_dateValue_(row)||'',source:'HH_Assessments.payloadJson'
  };
}

function HHV10_assignmentFromRegistry_(ss,sid) {
  const sh=HHV10_ensureSheet_(ss,HH_V10_ASSIGNMENTS,HH_V10_ASSIGNMENT_HEADERS);
  if(sh.getLastRow()<2)return null;
  const values=sh.getRange(2,1,sh.getLastRow()-1,HH_V10_ASSIGNMENT_HEADERS.length).getValues();
  const matches=values.filter(r=>cleanStudentId_(r[0])===cleanStudentId_(sid));
  if(!matches.length)return null;
  matches.sort((a,b)=>dateMs_(b[15])-dateMs_(a[15]));
  const r=matches[0],pairIds=HHV10_array_(r[10]);
  if(pairIds.length!==15||new Set(pairIds).size!==15)return null;
  return {
    studentId:cleanStudentId_(r[0]),studyId:text_(r[1]),preAttemptId:text_(r[2]),attemptId:text_(r[2]),form:text_(r[3]),assessmentVersion:text_(r[4]),engineVersion:text_(r[5]),
    selectionSeed:r[6],assignmentMethod:text_(r[7]),assignmentSource:text_(r[8]||'HH_Assessment_Assignments'),assignmentFingerprint:text_(r[9]),
    pairIds:pairIds,questionOrder:HHV10_array_(r[11]),optionOrders:HHV10_array_(r[12]),correctPositionDistribution:(()=>{try{return typeof r[13]==='string'?JSON.parse(r[13]):r[13]||{}}catch(_){return{}}})(),
    createdAt:iso_(r[14]),updatedAt:iso_(r[15]),sourceEventId:text_(r[16]),source:'HH_Assessment_Assignments'
  };
}

function HHV10_getAssignment_(ss,sid) {
  const registry=HHV10_assignmentFromRegistry_(ss,sid);
  if(registry)return registry;
  const assessments=HHV9_rowsForStudent_(ss.getSheetByName(HH_SHEETS.assessments),sid).filter(r=>HHV9_assessmentType_(r)==='pretest');
  const latest=HHV9_latest_(assessments);
  return HHV10_assignmentFromRow_(latest);
}

function HHV10_attachAssignment_(ss,sid,out) {
  const assignment=HHV10_getAssignment_(ss,sid);
  out=out||{};
  out.version=HH_AUTHORITY_V10;
  out.assessmentAssignment=assignment;
  out.pretestAssignment=assignment;
  out.assessmentRegistry={pretest:assignment};
  if(out.authoritativeState){
    out.authoritativeState.assessmentAssignment=assignment;
    out.authoritativeState.pretestAssignment=assignment;
    out.authoritativeState.authorityVersion=HH_AUTHORITY_V10;
  }
  out.assessmentRegistryReady=!!assignment;
  return out;
}
