/**
 * CSAI2102 AI Quest Coding Receiver v3.1.1
 * Sheet-authority + historical reconciliation for S1-S15 / B1-B5.
 * Does NOT declare doGet(e) / doPost(e).
 */
var AIQCODING = AIQCODING || {};

AIQCODING.VERSION = '20260727-AIQ-CODING-RECEIVER-V3.1.1-AUTHORITY-RECONCILE';
AIQCODING.SHEET = 'coding_attempts';
AIQCODING.SHEET_CANDIDATES = [
  'coding_attempts',
  'aiquest_coding_attempts',
  'AIQuest_Coding_Attempts',
  'Coding_Attempts'
];
AIQCODING.HEADERS = [
  'submitted_at','coding_attempt_id','student_id','student_name','section','session_id',
  'attempt_number','prediction_answer','prediction_reason','prediction_correct',
  'run_score','modify_score','challenge_score','quiz_score','coding_score','completed',
  'run_count','error_count','error_types_json','output','completed_code','modified_code',
  'challenge_code','challenge_level','validation_mode','used_time_sec','version'
];

AIQCODING.text_ = function(v){ return String(v == null ? '' : v).trim(); };
AIQCODING.key_ = function(v){ return AIQCODING.text_(v).toLowerCase().replace(/[^a-z0-9]/g,''); };
AIQCODING.norm_ = function(v){ return AIQCODING.text_(v).toLowerCase().replace(/\s+/g,''); };
AIQCODING.num_ = function(v){ var n=Number(v); return isFinite(n)?n:0; };
AIQCODING.bool_ = function(v){
  return v === true || ['true','1','yes','y','pass','passed','complete','completed','mastered','submitted'].indexOf(AIQCODING.text_(v).toLowerCase()) >= 0;
};
AIQCODING.section_ = function(v){ return AIQCODING.text_(v || '101').replace(/^0+/,'') || '0'; };
AIQCODING.session_ = function(v){
  var s=AIQCODING.text_(v).toUpperCase().replace(/[\s_:\-]+/g,'');
  var m=s.match(/^(?:MISSION|SESSION|M)?(S?(?:[1-9]|1[0-5])|B[1-5])$/);
  if (!m) return '';
  var x=m[1];
  if (/^\d+$/.test(x)) x='S'+x;
  return x;
};
AIQCODING.allowedLab_ = function(sessionId){ return /^(S(?:[1-9]|1[0-5])|B[1-5])$/.test(AIQCODING.session_(sessionId)); };
AIQCODING.hasAll_ = function(text,items){ return (items||[]).every(function(k){return text.indexOf(String(k).toLowerCase())>=0;}); };
AIQCODING.hasAny_ = function(text,items){ return !items||!items.length||items.some(function(k){return text.indexOf(String(k).toLowerCase())>=0;}); };
AIQCODING.minCounts_ = function(text,counts){
  counts=counts||{};
  return Object.keys(counts).every(function(k){
    var escaped=String(k).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return (text.match(new RegExp(escaped,'g'))||[]).length>=Number(counts[k]||1);
  });
};

AIQCODING.RULES = Object.freeze({
  S1:{expected:'High temperature alert',m:['38.5','38','39'],c:['if','elif','else','low','normal','high']},
  S2:{expected:'clean',m:['obstacle','turn'],c:['battery_low','goal_found','return']},
  S3:{expected:"['A', 'B', 'C', 'D', 'E']",m:["'f'","'d'"],c:['goal','path'],ca:['break','return']},
  B1:{expected:'search_new_route',m:['percept','return'],mc:{percept:3,return:3},c:['deque','blocked'],ca:['path','route']},
  S4:{expected:'D 6',m:["'b'","'c'",'1'],c:['parent','path','cost']},
  S5:{expected:'B 4',m:["'d'",'3','1'],c:['astar','heapq','path'],ca:['heuristic','h[']},
  S6:{expected:'3',m:['8','1','6','4'],c:['minimax','max','min'],ca:['maximizing','maximizing_player']},
  B2:{expected:'A*',m:['false','weighted','ucs'],c:['choose_strategy','bfs','ucs','a*','minimax']},
  S7:{expected:'can_fly',m:['penguin','cannot_fly'],c:['forward_chaining','facts','rules']},
  S8:{expected:'0.154',m:['0.10'],c:['bayes','prior','likelihood','posterior']},
  S9:{expected:'recommend_checkup',m:['rest_and_monitor','not','cough'],c:['inference_engine','rules','reason']},
  B3:{expected:'high_risk_with_evidence',m:['medium_risk','0.5','0.8'],c:['decision','confidence','explanation']},
  S10:{expected:'8 2',m:['0.7','train','test'],c:['split_data','ratio','seed'],ca:['leakage','overlap','set(']},
  S11:{expected:'[0, 1, 1]',m:['0.8'],c:['confusion_matrix','y_true','y_pred','accuracy']},
  S12:{expected:'[0, 0, 1, 1]',m:['5'],ma:['tie','equal','<=','>='],c:['kmeans','clusters','centroids'],ca:['iteration','range(2']},
  B4:{expected:'overfitting',m:['underfitting','0.6'],c:['evaluate_model','diagnosis','recommendation']},
  S13:{expected:'0.1',m:['sigmoid','exp','z'],c:['dense_layer','weights','bias','outputs']},
  S14:{expected:'0.55',m:['gamma','next_max_q'],c:['epsilon_greedy','explore','exploit','random']},
  S15:{expected:'RAG retrieves evidence',m:['lower'],c:['simple_rag','answer','sources','fallback']},
  B5:{expected:'review_with_evidence',m:['human_review','0.75'],c:['trustworthy_ai_decision','decision','confidence','evidence','fairness_check','audit_log']}
});

AIQCODING.ss_ = function(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss) throw new Error('SPREADSHEET_NOT_FOUND');
  return ss;
};
AIQCODING.ensureSheet_ = function(){
  var ss=AIQCODING.ss_(),sh=ss.getSheetByName(AIQCODING.SHEET);
  if(!sh) sh=ss.insertSheet(AIQCODING.SHEET);
  if(sh.getLastRow()===0){
    sh.getRange(1,1,1,AIQCODING.HEADERS.length).setValues([AIQCODING.HEADERS]);
    sh.setFrozenRows(1);
  }else{
    var lastCol=Math.max(1,sh.getLastColumn());
    var existing=sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(function(x){return AIQCODING.text_(x);});
    var keys={};existing.forEach(function(h){keys[AIQCODING.key_(h)]=true;});
    var missing=AIQCODING.HEADERS.filter(function(h){return !keys[AIQCODING.key_(h)];});
    if(missing.length) sh.getRange(1,lastCol+1,1,missing.length).setValues([missing]);
    sh.setFrozenRows(1);
  }
  return sh;
};
AIQCODING.objectRows_ = function(sh){
  if(!sh||sh.getLastRow()<2||sh.getLastColumn()<1) return [];
  var values=sh.getDataRange().getDisplayValues();
  var headers=values[0].map(function(h){return AIQCODING.text_(h);});
  return values.slice(1).filter(function(row){return row.some(function(v){return AIQCODING.text_(v)!=='';});}).map(function(row){
    var o={_sheet:sh.getName(),_row:0};
    headers.forEach(function(h,i){if(h){o[h]=row[i];o[AIQCODING.key_(h)]=row[i];}});
    return o;
  });
};
AIQCODING.rows_ = function(){ return AIQCODING.objectRows_(AIQCODING.ensureSheet_()); };
AIQCODING.allHistoricalRows_ = function(){
  var ss=AIQCODING.ss_(),seen={},rows=[];
  AIQCODING.SHEET_CANDIDATES.forEach(function(name){
    var sh=ss.getSheetByName(name);
    if(!sh||seen[sh.getSheetId()]) return;
    seen[sh.getSheetId()]=true;
    rows=rows.concat(AIQCODING.objectRows_(sh));
  });
  return rows;
};
AIQCODING.pick_ = function(row,names){
  row=row||{};
  for(var i=0;i<names.length;i++){
    var n=names[i],v=row[n];
    if(v===undefined) v=row[AIQCODING.key_(n)];
    if(v!==undefined&&v!==null&&AIQCODING.text_(v)!=='') return v;
  }
  return '';
};
AIQCODING.rowIdentity_ = function(row){
  return {
    studentId:AIQCODING.text_(AIQCODING.pick_(row,['student_id','studentId','studentid','id','pid'])),
    studentName:AIQCODING.text_(AIQCODING.pick_(row,['student_name','studentName','studentname','name'])),
    section:AIQCODING.section_(AIQCODING.pick_(row,['section','section_id','sectionId'])||'101'),
    sessionId:AIQCODING.session_(AIQCODING.pick_(row,['session_id','sessionId','session','mission_id','missionId','mission']))
  };
};
AIQCODING.rowScore_ = function(row){
  var direct=AIQCODING.pick_(row,['coding_score','codingScore','best_score','bestScore','score','total_score','totalScore']);
  if(AIQCODING.text_(direct)!=='') return AIQCODING.num_(direct);
  return AIQCODING.num_(AIQCODING.pick_(row,['run_score','runScore']))+
    AIQCODING.num_(AIQCODING.pick_(row,['modify_score','modifyScore']))+
    AIQCODING.num_(AIQCODING.pick_(row,['challenge_score','challengeScore']))+
    Math.min(20,AIQCODING.num_(AIQCODING.pick_(row,['quiz_score','quizScore']))*4);
};
AIQCODING.rowCompleted_ = function(row){
  var score=AIQCODING.rowScore_(row);
  return score>=60 || AIQCODING.bool_(AIQCODING.pick_(row,['completed','passed','mastered','status','coding_completed','codingCompleted']));
};
AIQCODING.rowSubmittedAt_ = function(row){return AIQCODING.text_(AIQCODING.pick_(row,['submitted_at','submittedAt','serverTs','clientTs','timestamp','created_at','createdAt']));};
AIQCODING.matches_ = function(row,studentId,section,sessionId){
  var x=AIQCODING.rowIdentity_(row);
  return x.studentId===studentId && x.section===AIQCODING.section_(section) && x.sessionId===AIQCODING.session_(sessionId);
};

AIQCODING.parseV31_ = function(payload){
  var predictionRaw=AIQCODING.text_(payload.predictionAnswer),marker=' | Reason: ',at=predictionRaw.indexOf(marker);
  var modifiedRaw=AIQCODING.text_(payload.modifiedCode),scenarioMarker='# Scenario Modification',scenarioAt=modifiedRaw.indexOf(scenarioMarker);
  var challengeRaw=AIQCODING.text_(payload.challengeCode),quizMatch=challengeRaw.match(/#\s*QuizScore\s+(\d+)\s*\/\s*5/i),levelMatch=challengeRaw.match(/#\s*Level\s+([^\r\n]+)/i);
  return {
    predictionAnswer:at>=0?predictionRaw.slice(0,at).trim():predictionRaw,
    predictionReason:at>=0?predictionRaw.slice(at+marker.length).trim():AIQCODING.text_(payload.predictionReason),
    completedCode:scenarioAt>=0?modifiedRaw.slice(0,scenarioAt).trim():AIQCODING.text_(payload.completedCode),
    scenarioCode:scenarioAt>=0?modifiedRaw.slice(scenarioAt+scenarioMarker.length).trim():modifiedRaw,
    challengeCode:challengeRaw,
    quizScore:quizMatch?Math.max(0,Math.min(5,Number(quizMatch[1]))):Number(payload.quizScore||0),
    challengeLevel:levelMatch?AIQCODING.text_(levelMatch[1]):AIQCODING.text_(payload.challengeLevel)
  };
};
AIQCODING.validateEvidenceV31_ = function(sessionId,payload){
  var x=AIQCODING.parseV31_(payload),output=AIQCODING.text_(payload.output);
  var predictionPassed=x.predictionAnswer.length>=2&&x.predictionReason.length>=20;
  var completedCodePassed=x.completedCode.length>=40&&!/\bTODO\b/i.test(x.completedCode);
  var outputPassed=output.length>=2,modifyPassed=x.scenarioCode.length>=30,quizPassed=x.quizScore>=4;
  var challengePassed=x.challengeCode.replace(/#\s*(Level|QuizScore)[^\r\n]*/gi,'').trim().length>=20;
  return {mode:'TEACHING_V3_1',predictionCorrect:predictionPassed,completedCodePassed:completedCodePassed,outputPassed:outputPassed,modifyPassed:modifyPassed,challengePassed:challengePassed,quizPassed:quizPassed,quizScore:x.quizScore,runScore:(completedCodePassed&&outputPassed)?25:0,modifyScore:modifyPassed?35:0,challengeScore:challengePassed?20:0,quizPoint:quizPassed?20:x.quizScore*4,parsed:x};
};
AIQCODING.validateEvidenceLegacy_ = function(sessionId,payload){
  var rule=AIQCODING.RULES[sessionId];
  if(!rule) return {mode:'LEGACY_V2',predictionCorrect:false,completedCodePassed:false,outputPassed:false,modifyPassed:false,challengePassed:false,quizPassed:false,quizScore:0,runScore:0,modifyScore:0,challengeScore:0,quizPoint:0,parsed:{}};
  var output=AIQCODING.norm_(payload.output),prediction=AIQCODING.norm_(payload.predictionAnswer),modified=AIQCODING.text_(payload.modifiedCode).toLowerCase(),challenge=AIQCODING.text_(payload.challengeCode).toLowerCase(),expected=AIQCODING.norm_(rule.expected);
  var modifyPassed=AIQCODING.hasAll_(modified,rule.m)&&AIQCODING.hasAny_(modified,rule.ma)&&AIQCODING.minCounts_(modified,rule.mc);
  var challengePassed=AIQCODING.hasAll_(challenge,rule.c)&&AIQCODING.hasAny_(challenge,rule.ca)&&AIQCODING.minCounts_(challenge,rule.cc);
  var outputPassed=!!expected&&output.indexOf(expected)>=0,predictionCorrect=!!expected&&prediction===expected;
  return {mode:'LEGACY_V2',predictionCorrect:predictionCorrect,completedCodePassed:true,outputPassed:outputPassed,modifyPassed:modifyPassed,challengePassed:challengePassed,quizPassed:true,quizScore:0,runScore:outputPassed?30:0,modifyScore:modifyPassed?50:0,challengeScore:challengePassed?20:0,quizPoint:0,parsed:{predictionAnswer:AIQCODING.text_(payload.predictionAnswer),predictionReason:'',completedCode:'',scenarioCode:AIQCODING.text_(payload.modifiedCode),challengeCode:AIQCODING.text_(payload.challengeCode),challengeLevel:''}};
};
AIQCODING.validateEvidence_ = function(sessionId,payload){
  var modified=AIQCODING.text_(payload.modifiedCode),challenge=AIQCODING.text_(payload.challengeCode);
  var isV31=modified.indexOf('# Scenario Modification')>=0||/#\s*QuizScore\s+\d+\s*\/\s*5/i.test(challenge)||AIQCODING.text_(payload.completedCode);
  return isV31?AIQCODING.validateEvidenceV31_(sessionId,payload):AIQCODING.validateEvidenceLegacy_(sessionId,payload);
};

AIQCODING.submit_ = function(payload){
  payload=payload||{};
  var sessionId=AIQCODING.session_(payload.sessionId),studentId=AIQCODING.text_(payload.studentId),studentName=AIQCODING.text_(payload.studentName),section=AIQCODING.section_(payload.section||'101');
  if(!AIQCODING.allowedLab_(sessionId)||!AIQCODING.RULES[sessionId]) return {ok:false,code:'LAB_NOT_AVAILABLE',sessionId:sessionId,version:AIQCODING.VERSION};
  if(!studentId||!studentName||!section) return {ok:false,code:'MISSING_IDENTITY',version:AIQCODING.VERSION};
  var evidence=AIQCODING.validateEvidence_(sessionId,payload);
  if(!evidence.predictionCorrect) return {ok:false,code:'PREDICTION_REASON_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.completedCodePassed) return {ok:false,code:'COMPLETED_CODE_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.outputPassed) return {ok:false,code:'OUTPUT_EVIDENCE_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.modifyPassed) return {ok:false,code:'MODIFY_EVIDENCE_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.quizPassed) return {ok:false,code:'QUIZ_NOT_PASSED',evidence:evidence,version:AIQCODING.VERSION};
  var historical=AIQCODING.allHistoricalRows_().filter(function(r){return AIQCODING.matches_(r,studentId,section,sessionId);});
  var attemptNumber=historical.length+1,score=evidence.runScore+evidence.modifyScore+evidence.challengeScore+evidence.quizPoint;
  var now=Utilities.formatDate(new Date(),'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX"),attemptId=AIQCODING.text_(payload.codingAttemptId||Utilities.getUuid());
  var duplicate=AIQCODING.allHistoricalRows_().some(function(r){return AIQCODING.text_(AIQCODING.pick_(r,['coding_attempt_id','codingAttemptId','attemptId']))===attemptId;});
  if(!duplicate){
    var sh=AIQCODING.ensureSheet_(),x=evidence.parsed||{},obj={submitted_at:now,coding_attempt_id:attemptId,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,attempt_number:attemptNumber,prediction_answer:x.predictionAnswer||AIQCODING.text_(payload.predictionAnswer),prediction_reason:x.predictionReason||'',prediction_correct:evidence.predictionCorrect,run_score:evidence.runScore,modify_score:evidence.modifyScore,challenge_score:evidence.challengeScore,quiz_score:evidence.quizScore,coding_score:score,completed:score>=60,run_count:Number(payload.runCount||0),error_count:Number(payload.errorCount||0),error_types_json:JSON.stringify(payload.errorTypes||[]),output:AIQCODING.text_(payload.output).slice(0,5000),completed_code:AIQCODING.text_(x.completedCode).slice(0,20000),modified_code:AIQCODING.text_(x.scenarioCode).slice(0,20000),challenge_code:AIQCODING.text_(x.challengeCode).slice(0,20000),challenge_level:x.challengeLevel||'',validation_mode:evidence.mode,used_time_sec:Number(payload.usedTimeSec||0),version:AIQCODING.VERSION};
    sh.appendRow(AIQCODING.HEADERS.map(function(h){return obj[h]==null?'':obj[h];}));
    SpreadsheetApp.flush();
  }
  return {ok:true,duplicate:duplicate,studentId:studentId,section:section,sessionId:sessionId,attemptNumber:attemptNumber,codingScore:score,bestScore:Math.max(score,historical.reduce(function(m,r){return Math.max(m,AIQCODING.rowScore_(r));},0)),completed:score>=60,evidence:evidence,serverValidated:true,version:AIQCODING.VERSION};
};

AIQCODING.getStatus_ = function(payload){
  payload=payload||{};
  var studentId=AIQCODING.text_(payload.studentId),section=AIQCODING.section_(payload.section||'101'),sessionId=AIQCODING.session_(payload.sessionId||payload.missionId);
  if(!studentId||!section||!sessionId) return {ok:false,code:'MISSING_STATUS_IDENTITY',studentId:studentId,section:section,sessionId:sessionId,version:AIQCODING.VERSION};
  if(!AIQCODING.allowedLab_(sessionId)) return {ok:false,code:'LAB_NOT_AVAILABLE',sessionId:sessionId,version:AIQCODING.VERSION};
  var rows=AIQCODING.allHistoricalRows_().filter(function(r){return AIQCODING.matches_(r,studentId,section,sessionId);});
  rows.sort(function(a,b){return String(AIQCODING.rowSubmittedAt_(a)).localeCompare(String(AIQCODING.rowSubmittedAt_(b)));});
  var latest=rows.length?rows[rows.length-1]:null,bestScore=0,completed=false,sources={};
  rows.forEach(function(r){bestScore=Math.max(bestScore,AIQCODING.rowScore_(r));completed=completed||AIQCODING.rowCompleted_(r);sources[r._sheet||AIQCODING.SHEET]=true;});
  var latestScore=latest?AIQCODING.rowScore_(latest):0;
  return {ok:true,action:'GET_CODING_STATUS',studentId:studentId,section:section,sessionId:sessionId,found:rows.length>0,completed:completed||bestScore>=60,latestScore:latestScore,bestScore:bestScore,attemptCount:rows.length,latestAttempt:rows.length,submittedAt:latest?AIQCODING.rowSubmittedAt_(latest):'',sourceSheets:Object.keys(sources),authority:'Google Sheet historical max preserve',version:AIQCODING.VERSION};
};

AIQCODING.auditStatus_ = function(payload){
  var result=AIQCODING.getStatus_(payload);
  result.debug={sheetCandidates:AIQCODING.SHEET_CANDIDATES,totalHistoricalRows:AIQCODING.allHistoricalRows_().length,normalizedSection:AIQCODING.section_(payload&&payload.section||'101'),normalizedSession:AIQCODING.session_(payload&&(payload.sessionId||payload.missionId))};
  return result;
};
AIQCODING.handle = function(payload){
  var action=AIQCODING.text_((payload||{}).action).toUpperCase();
  if(action==='SUBMIT_CODING_LAB') return AIQCODING.submit_(payload);
  if(action==='GET_CODING_STATUS') return AIQCODING.getStatus_(payload);
  if(action==='AUDIT_CODING_STATUS') return AIQCODING.auditStatus_(payload);
  if(action==='GET_LAB_CONFIG'){
    var sessionId=AIQCODING.session_(payload.sessionId);
    if(!AIQCODING.allowedLab_(sessionId)) return {ok:false,code:'LAB_NOT_AVAILABLE',version:AIQCODING.VERSION};
    return {ok:true,version:AIQCODING.VERSION,sessionId:sessionId,config:AIQCODING.RULES[sessionId]};
  }
  return {ok:false,code:'UNKNOWN_CODING_ACTION',action:action,version:AIQCODING.VERSION};
};

function TEST_AIQCODING_S2_KK_V311(){
  var result=AIQCODING.auditStatus_({studentId:'12',studentName:'KK',section:'101',sessionId:'S2'});
  Logger.log(JSON.stringify(result));
  return result;
}
