/**
 * CSAI2102 • S12 legacy Coding receipt recovery • v1
 * Source evidence: original rows 319 and 320 in coding_attempts.
 *
 * DRY RUN by default. It does not write anything.
 * Only AIQ_RECOVERY_S12_APPLY_EXPLICITLY may append ONE official Coding row,
 * and it requires three explicit Script Properties plus a saved Sheet backup:
 *
 *  AIQ_RECOVERY_BACKUP_CONFIRMED = YES
 *  AIQ_RECOVERY_SOURCE_ROW      = 319  (or 320 after human inspection)
 *  AIQ_RECOVERY_REVIEW_HASH     = hash from current DRY RUN
 *  AIQ_RECOVERY_ALLOW_WRITE     = S12_ONE_ROW_APPROVED
 *
 * Reuses existing QA Script Properties:
 *  AIQ_QA_STUDENT_ID, AIQ_QA_SECTION=101, AIQ_QA_SESSION=S12
 *
 * Does not delete/move/alter source rows. No doGet/doPost. No automatic
 * unlock or grade edits. Preserves the legacy original 27 evidence values.
 * Manual review MUST confirm original evidence, roster and backup first.
 */
var AIQ_S12_RECOVERY = AIQ_S12_RECOVERY || {};

AIQ_S12_RECOVERY.KEYS = ['submitted_at','coding_attempt_id','student_id',
  'student_name','section','session_id','attempt_number','prediction_answer',
  'prediction_reason','prediction_correct','run_score','modify_score',
  'challenge_score','quiz_score','coding_score','completed','run_count',
  'error_count','error_types_json','output','completed_code','modified_code',
  'challenge_code','challenge_level','validation_mode','used_time_sec','version'];

AIQ_S12_RECOVERY.config_ = function(){
  var p=PropertiesService.getScriptProperties();
  return {
    id:String(p.getProperty('AIQ_QA_STUDENT_ID')||'').trim(),
    section:String(p.getProperty('AIQ_QA_SECTION')||'101').trim(),
    stage:String(p.getProperty('AIQ_QA_SESSION')||'S12').trim().toUpperCase(),
    backup:p.getProperty('AIQ_RECOVERY_BACKUP_CONFIRMED'),
    sourceRow:Number(p.getProperty('AIQ_RECOVERY_SOURCE_ROW')||319),
    reviewHash:String(p.getProperty('AIQ_RECOVERY_REVIEW_HASH')||'').trim(),
    approval:String(p.getProperty('AIQ_RECOVERY_ALLOW_WRITE')||'').trim()
  };
};

AIQ_S12_RECOVERY.hash_ = function(s){
  var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    String(s),Utilities.Charset.UTF_8);
  return bytes.map(function(b){var h=(b+256)%256;return (h<16?'0':'')+h.toString(16);}).join('');
};

AIQ_S12_RECOVERY.plan_ = function(){
  var cfg=AIQ_S12_RECOVERY.config_();
  var result={audit:'AIQ_S12_LEGACY_RECOVERY_V1',
    mode:'DRY_RUN_NO_WRITE',result:'NOT_RUN',
    studentConfigured:!!cfg.id,section:cfg.section,sessionId:cfg.stage,
    sourceRows:[],sourceAttemptIdsSame:null,sourceRowsValid:false,
    headerOrderAligned:null,headerCount:0,expectedHeaderCount:27,
    missingHeaders:[],duplicateHeaders:[],officialMatchingRows:[],
    idCollisionRows:[],recommendedRow:319,reviewHash:'',
    spreadsheetIdSuffix:'',codingVersion:'MISSING',
    blockers:[],readyForHumanReview:false};
  if(!cfg.id){result.blockers.push('QA_STUDENT_ID_MISSING');return {cfg:cfg,result:result};}
  if(cfg.section!=='101'||cfg.stage!=='S12'){
    result.blockers.push('ONLY_SECTION_101_S12_SUPPORTED');return {cfg:cfg,result:result};
  }
  if(typeof AIQCODING==='undefined'||
     !Array.isArray(AIQCODING.HEADERS)||
     typeof AIQCODING.key_!=='function'||
     typeof AIQCODING.session_!=='function'){
    result.blockers.push('CODING_RECEIVER_MISSING');return {cfg:cfg,result:result};
  }
  var coding=AIQCODING,ss=SpreadsheetApp.getActiveSpreadsheet();
  result.codingVersion=String(coding.VERSION||'UNKNOWN');
  if(!ss){result.blockers.push('ACTIVE_SPREADSHEET_MISSING');return {cfg:cfg,result:result};}
  result.spreadsheetIdSuffix=String(ss.getId()).slice(-6);
  var roster=ss.getSheetByName('students_roster');
  if(!roster||roster.getLastRow()<2){
    result.blockers.push('STUDENTS_ROSTER_MISSING');return {cfg:cfg,result:result};
  }
  var key=function(x){return coding.key_(x);};
  var normalId=function(x){return String(x==null?'':x).trim().toLowerCase();};
  var normalSec=function(x){return coding.section_(x||'101');};
  var normalStage=function(x){return coding.session_(x);};
  var rh=roster.getRange(1,1,1,roster.getLastColumn()).getDisplayValues()[0];
  function col(headers,names){
    var opts=names.map(key);
    for(var i=0;i<headers.length;i++)
      if(opts.indexOf(key(headers[i]))>=0)return i;
    return -1;
  }
  var ri=col(rh,['student_id','studentId','id']),
      rs=col(rh,['section','class_section','classSection']),
      rst=col(rh,['status','active_status']),
      rr=col(rh,['role','user_role']);
  if(ri<0){result.blockers.push('ROSTER_ID_HEADER_MISSING');return {cfg:cfg,result:result};}
  var authorized=false, rosterRows=roster.getDataRange().getDisplayValues();
  for(var i=rosterRows.length-1;i>=1;i--){
    var r=rosterRows[i];
    if(normalId(r[ri])!==normalId(cfg.id))continue;
    if(rs>=0&&normalSec(r[rs])!==normalSec(cfg.section))continue;
    var status=rst>=0?String(r[rst]).trim().toLowerCase():'active';
    var role=rr>=0?String(r[rr]).trim().toLowerCase():'student';
    authorized=(!status||status==='active')&&(role==='student'||role==='test');
    break;
  }
  if(!authorized){result.blockers.push('ROSTER_NOT_AUTHORIZED');return {cfg:cfg,result:result};}

  var sh=ss.getSheetByName('coding_attempts');
  if(!sh||sh.getLastRow()<320){result.blockers.push('SOURCE_SHEET_OR_ROWS_MISSING');return {cfg:cfg,result:result};}
  var values=sh.getDataRange().getDisplayValues();
  var actual=values[0].map(key),canonical=AIQ_S12_RECOVERY.KEYS.map(key);
  result.headerCount=actual.length;
  if(canonical.length!==coding.HEADERS.length ||
     !canonical.every(function(k,i){return k===key(coding.HEADERS[i]);})){
    result.blockers.push('CANONICAL_HEADERS_CHANGED');return {cfg:cfg,result:result};
  }
  result.headerOrderAligned=actual.length===canonical.length&&
    canonical.every(function(k,i){return actual[i]===k;});
  canonical.forEach(function(k){
    var count=actual.filter(function(h){return h===k;}).length;
    if(!count)result.missingHeaders.push(k);
    if(count>1)result.duplicateHeaders.push(k);
  });
  if(result.missingHeaders.length||result.duplicateHeaders.length)
    result.blockers.push('HEADERS_MISSING_OR_DUPLICATED');

  var idPos=actual.indexOf(key('student_id')),
      secPos=actual.indexOf(key('section')),
      stagePos=actual.indexOf(key('session_id')),
      attemptPos=actual.indexOf(key('coding_attempt_id'));

  var sources=[];
  [319,320].forEach(function(line){
    var raw=values[line-1]||[];
    var vals=AIQ_S12_RECOVERY.KEYS.map(function(_,i){return String(raw[i]==null?'':raw[i]);});
    var obj={};
    AIQ_S12_RECOVERY.KEYS.forEach(function(h,i){obj[h]=vals[i];});
    var issues=[];
    if(normalId(obj.student_id)!==normalId(cfg.id)||
       normalSec(obj.section)!==normalSec(cfg.section)||
       normalStage(obj.session_id)!==normalStage(cfg.stage))issues.push('IDENTITY_MISMATCH');
    if(!obj.coding_attempt_id||!obj.submitted_at)issues.push('MISSING_RECEIPT');
    if(Number(obj.coding_score)!==100||
       !coding.bool_(obj.completed)||
       !coding.bool_(obj.prediction_correct)||
       Number(obj.quiz_score)!==5)issues.push('EVIDENCE_SCORE_OR_FLAGS_MISMATCH');
    if(Number(obj.run_score)!==25||Number(obj.modify_score)!==35||
       Number(obj.challenge_score)!==20)issues.push('COMPONENT_SCORE_MISMATCH');
    if(!obj.completed_code||!obj.modified_code||!obj.output)
       issues.push('MISSING_CODING_EVIDENCE');
    if(obj.version!=='20260727-AIQ-CODING-RECEIVER-V3.2.1-CURRICULUM-SEMANTIC')
       issues.push('LEGACY_VERSION_UNEXPECTED');
    sources.push({line:line,values:vals,obj:obj,issues:issues});
    result.sourceRows.push({row:line,valid:issues.length===0,issues:issues,
      legacyScore:Number(obj.coding_score)||0,quizScore:Number(obj.quiz_score)||0,
      completed:coding.bool_(obj.completed),attemptIdPresent:!!obj.coding_attempt_id,
      timestampPresent:!!obj.submitted_at,savedVersion:obj.version,
      canonicalIdentityAlreadyMatches: idPos>=0&&secPos>=0&&stagePos>=0 &&
        normalId(raw[idPos])===normalId(cfg.id)&&
        normalSec(raw[secPos])===normalSec(cfg.section)&&
        normalStage(raw[stagePos])===normalStage(cfg.stage)});
  });
  result.sourceAttemptIdsSame=sources[0].obj.coding_attempt_id===
    sources[1].obj.coding_attempt_id;
  result.sourceRowsValid=sources.every(function(s){return s.issues.length===0;});
  if(!result.sourceRowsValid)result.blockers.push('SOURCE_VALIDATION_FAILED');
  if(result.sourceRows.some(function(r){return r.canonicalIdentityAlreadyMatches;}))
    result.blockers.push('SOURCE_ALREADY_CANONICALLY_MAPPED');

  var attempts=sources.map(function(s){return s.obj.coding_attempt_id;});
  for(var n=1;n<values.length;n++){
    var row=values[n];
    var isTarget=idPos>=0&&secPos>=0&&stagePos>=0&&
      normalId(row[idPos])===normalId(cfg.id)&&
      normalSec(row[secPos])===normalSec(cfg.section)&&
      normalStage(row[stagePos])===normalStage(cfg.stage);
    if(isTarget&&result.officialMatchingRows.length<20)
      result.officialMatchingRows.push(n+1);
    if(attemptPos>=0&&attempts.indexOf(String(row[attemptPos]||''))>=0&&
       result.idCollisionRows.length<20)result.idCollisionRows.push(n+1);
  }
  if(result.officialMatchingRows.length)result.blockers.push('OFFICIAL_S12_ALREADY_EXISTS');
  if(result.idCollisionRows.length)result.blockers.push('ATTEMPT_ID_ALREADY_PRESENT');
  result.reviewHash=AIQ_S12_RECOVERY.hash_(JSON.stringify({
    actual:actual,sources:sources.map(function(s){return s.values;}),
    target:cfg.section+':'+cfg.stage,selected:cfg.sourceRow
  }));
  result.recommendedRow=319;
  result.readyForHumanReview=result.blockers.length===0;
  result.result=result.readyForHumanReview?
    'READY_FOR_MANUAL_REVIEW_NO_WRITE':'BLOCKED_REVIEW_EVIDENCE';
  return {cfg:cfg,result:result,sources:sources,sh:sh,actual:actual};
};

function AIQ_RECOVERY_S12_DRY_RUN() {
  var plan=AIQ_S12_RECOVERY.plan_();
  Logger.log(JSON.stringify(plan.result));
  return plan.result;
}

/**
 * Explicitly gated WRITE operation. Do NOT run until DRY RUN reviewed,
 * original spreadsheet backed up, and approval props set by the owner.
 * Appends a single canonical copy, preserving both legacy source rows.
 */
function AIQ_RECOVERY_S12_APPLY_EXPLICITLY() {
  var cfg=AIQ_S12_RECOVERY.config_();
  if(cfg.backup!=='YES'||cfg.approval!=='S12_ONE_ROW_APPROVED'||
     [319,320].indexOf(cfg.sourceRow)<0||!cfg.reviewHash)
    throw new Error('RECOVERY_NOT_APPROVED_OR_BACKUP_NOT_CONFIRMED');
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('RECOVERY_LOCK_BUSY');
  try{
    var plan=AIQ_S12_RECOVERY.plan_(),summary=plan.result;
    if(!summary.readyForHumanReview||summary.reviewHash!==cfg.reviewHash)
      throw new Error('RECOVERY_REVIEW_CHANGED_OR_BLOCKED');
    var selected=plan.sources.filter(function(s){return s.line===cfg.sourceRow;})[0];
    if(!selected||selected.issues.length)throw new Error('SELECTED_ROW_FAILED_REVIEW');
    var vals={};
    AIQ_S12_RECOVERY.KEYS.forEach(function(h,i){vals[AIQCODING.key_(h)]=selected.values[i];});
    // Append values by ACTUAL header order. Extra columns not in the legacy
    // 27-field source are deliberately blank, never fabricated.
    var mapped=plan.actual.map(function(h){
      return Object.prototype.hasOwnProperty.call(vals,h)?vals[h]:'';
    });
    plan.sh.appendRow(mapped);
    SpreadsheetApp.flush();
    var newly=plan.sh.getLastRow();
    var h=plan.sh.getRange(1,1,1,plan.sh.getLastColumn()).getDisplayValues()[0];
    var r=plan.sh.getRange(newly,1,1,plan.sh.getLastColumn()).getDisplayValues()[0];
    var obj={};
    h.forEach(function(label,i){obj[AIQCODING.key_(label)]=r[i];});
    var valid=AIQCODING.matches_(obj,cfg.id,cfg.section,cfg.stage) &&
      AIQCODING.text_(AIQCODING.pick_(obj,['coding_attempt_id']))===
        selected.obj.coding_attempt_id &&
      AIQCODING.rowCompleted_(obj) &&
      Number(AIQCODING.pick_(obj,['coding_score']))===
        Number(selected.obj.coding_score);
    if(!valid)throw new Error('RESTORE_WRITE_OCCURRED_BUT_READBACK_NOT_VALID_REVIEW_NEW_ROW');
    var status=AIQCODING.getStatus_({studentId:cfg.id,section:cfg.section,sessionId:cfg.stage});
    var report={audit:'AIQ_S12_LEGACY_RECOVERY_V1',
      mode:'ONE_ROW_WRITTEN_FROM_LEGACY_EVIDENCE',
      restoredSourceRow:cfg.sourceRow,appendedRow:newly,
      originalSourceRowsPreserved:[319,320],
      originalScore:Number(selected.obj.coding_score),
      codingStatusFound:status.found===true,codingStatusCompleted:status.completed===true,
      codingBestScore:Number(status.bestScore||0),
      codingVersion:String(status.version||''),
      reviewHash:summary.reviewHash};
    Logger.log(JSON.stringify(report));
    return report;
  }finally{lock.releaseLock();}
}
