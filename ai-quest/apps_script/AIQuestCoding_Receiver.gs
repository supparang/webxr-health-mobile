/**
 * CSAI2102 AI Quest Coding Receiver v3.2.1
 * Sheet authority + exact identity reconciliation + semantic evidence validation.
 * Challenge Ladder is validated bonus evidence, not a mandatory completion gate.
 * Supports S1-S15 and B1-B5. Does NOT declare doGet(e) / doPost(e).
 */
var AIQCODING = AIQCODING || {};

AIQCODING.VERSION = '20260727-AIQ-CODING-RECEIVER-V3.2.1-CURRICULUM-SEMANTIC';
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
AIQCODING.norm_ = function(v){ return AIQCODING.text_(v).toLowerCase().replace(/[^a-z0-9ก-๙.*<>=\[\]'"_-]+/g,''); };
AIQCODING.num_ = function(v){ var n=Number(v); return isFinite(n)?n:0; };
AIQCODING.bool_ = function(v){
  return v === true || ['true','1','yes','y','pass','passed','complete','completed','mastered','submitted'].indexOf(AIQCODING.text_(v).toLowerCase()) >= 0;
};
AIQCODING.section_ = function(v){ return AIQCODING.text_(v || '101').replace(/^0+/,'') || '0'; };
AIQCODING.session_ = function(v){
  var s=AIQCODING.text_(v).toUpperCase().replace(/[\s_:\-]+/g,'');
  var m=s.match(/^(?:MISSION|SESSION|M)?(S?(?:[1-9]|1[0-5])|B[1-5])$/);
  if(!m)return '';
  var x=m[1];
  if(/^\d+$/.test(x))x='S'+x;
  return x;
};
AIQCODING.allowedLab_ = function(v){ return /^(S(?:[1-9]|1[0-5])|B[1-5])$/.test(AIQCODING.session_(v)); };
AIQCODING.containsAll_ = function(text,items){
  var t=AIQCODING.norm_(text);
  return (items||[]).every(function(k){return t.indexOf(AIQCODING.norm_(k))>=0;});
};
AIQCODING.containsAny_ = function(text,items){
  if(!items||!items.length)return true;
  var t=AIQCODING.norm_(text);
  return items.some(function(k){return t.indexOf(AIQCODING.norm_(k))>=0;});
};
AIQCODING.missing_ = function(text,items){
  var t=AIQCODING.norm_(text);
  return (items||[]).filter(function(k){return t.indexOf(AIQCODING.norm_(k))<0;});
};
AIQCODING.minCounts_ = function(text,counts){
  var t=AIQCODING.text_(text).toLowerCase();
  counts=counts||{};
  return Object.keys(counts).every(function(k){
    var escaped=String(k).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return (t.match(new RegExp(escaped,'g'))||[]).length>=Number(counts[k]||1);
  });
};

/* b=Completed Code, ba=one-of base, m=Modification, ma=one-of modification,
 * c=Challenge, ca=one-of challenge. Challenge is bonus only.
 */
AIQCODING.RULES = Object.freeze({
 S1:{expected:'High temperature alert',b:['temperature','if','print'],m:['38.5','38','39'],c:['if','elif','else','low','normal','high'],ca:['confidence','explanation','fallback']},
 S2:{expected:'clean',b:['def','agent','percept','return'],m:['obstacle','turn'],c:['battery_low','goal_found','return'],ca:['state','goal','utility']},
 S3:{expected:"['A', 'B', 'C', 'D', 'E']",b:['deque','queue','visited'],m:["'f'","'d'"],ma:['stack','dfs','pop()'],c:['goal','path','visited'],ca:['break','return']},
 B1:{expected:'search_new_route',b:['choose_action','blocked','return'],m:['percept','return'],mc:{percept:3,return:3},c:['deque','blocked'],ca:['path','route','fallback']},
 S4:{expected:'D 6',b:['heapq','frontier','cost'],m:["'b'","'c'",'1'],c:['parent','path','cost'],ca:['best_cost','distance','visited']},
 S5:{expected:'B 4',b:['g','h','print'],m:["'d'",'3','1'],c:['astar','heapq','path'],ca:['heuristic','h[','g_score']},
 S6:{expected:'3',b:['scores','min','max'],m:['8','1','6','4'],c:['minimax','max','min','alpha','beta'],ca:['maximizing','maximizing_player']},
 B2:{expected:'A*',b:['weighted','heuristic','strategy'],m:['false','weighted','ucs'],c:['choose_strategy','bfs','ucs','a*','minimax'],ca:['reason','tradeoff','memory']},
 S7:{expected:'can_fly',b:['facts','bird','has_wings'],m:['penguin','cannot_fly'],c:['forward_chaining','facts','rules'],ca:['conflict','explanation','trace']},
 S8:{expected:'0.154',b:['prior','sensitivity','posterior'],m:['0.10'],c:['bayes','prior','likelihood','posterior'],ca:['evidence','normalize','network']},
 S9:{expected:'recommend_checkup',b:['symptoms','fever','cough'],m:['rest_and_monitor','not','cough'],c:['inference_engine','rules','reason'],ca:['conflict','explanation','referral']},
 B3:{expected:'high_risk_with_evidence',b:['facts','probability','0.8'],m:['medium_risk','0.5','0.8'],c:['decision','confidence','explanation'],ca:['evidence','review','conflict']},
 S10:{expected:'8 2',b:['data','train','test'],m:['0.7','train','test'],c:['split_data','ratio','seed'],ca:['leakage','overlap','set(']},
 S11:{expected:'[0, 1, 1]',b:['scores','predictions','0.5'],m:['0.8'],c:['confusion_matrix','y_true','y_pred','accuracy','precision','recall'],ca:['f1','false_positive','false_negative']},
 S12:{expected:'[0, 0, 1, 1]',b:['points','centers','clusters'],m:['5'],ma:['tie','equal','<=','>='],c:['kmeans','clusters','centroids'],ca:['iteration','range(2','inertia','silhouette']},
 B4:{expected:'overfitting',b:['train_accuracy','test_accuracy','0.2'],m:['underfitting','0.6'],c:['evaluate_model','diagnosis','recommendation'],ca:['metrics','evidence','deployment']},
 S13:{expected:'0.1',b:['x','w','b'],ba:['max(0','relu'],m:['sigmoid','exp','z'],c:['dense_layer','weights','bias','outputs'],ca:['loss','gradient','backprop']},
 S14:{expected:'0.55',b:['q','reward','alpha','new_q'],m:['gamma','next_max_q'],c:['epsilon_greedy','explore','exploit','random'],ca:['reward','episode','decay']},
 S15:{expected:'RAG retrieves evidence',b:['documents','query','selected'],m:['lower'],c:['simple_rag','answer','sources','fallback'],ca:['citation','grounding','evidence']},
 B5:{expected:'review_with_evidence',b:['prediction','confidence','evidence'],m:['human_review','0.75'],c:['trustworthy_ai_decision','decision','confidence','evidence','fairness_check','audit_log'],ca:['privacy','human_review','explanation']}
});

AIQCODING.ss_ = function(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('SPREADSHEET_NOT_FOUND');
  return ss;
};
AIQCODING.ensureSheet_ = function(){
  var ss=AIQCODING.ss_(),sh=ss.getSheetByName(AIQCODING.SHEET);
  if(!sh)sh=ss.insertSheet(AIQCODING.SHEET);
  if(sh.getLastRow()===0){
    sh.getRange(1,1,1,AIQCODING.HEADERS.length).setValues([AIQCODING.HEADERS]);
    sh.setFrozenRows(1);
    return sh;
  }
  var lastCol=Math.max(1,sh.getLastColumn());
  var existing=sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(AIQCODING.text_);
  var keys={};existing.forEach(function(h){keys[AIQCODING.key_(h)]=true;});
  var missing=AIQCODING.HEADERS.filter(function(h){return !keys[AIQCODING.key_(h)];});
  if(missing.length)sh.getRange(1,lastCol+1,1,missing.length).setValues([missing]);
  sh.setFrozenRows(1);
  return sh;
};
AIQCODING.objectRows_ = function(sh){
  if(!sh||sh.getLastRow()<2||sh.getLastColumn()<1)return [];
  var values=sh.getDataRange().getDisplayValues();
  var headers=values[0].map(AIQCODING.text_);
  return values.slice(1).map(function(row,idx){
    var o={_sheet:sh.getName(),_row:idx+2};
    headers.forEach(function(h,i){if(h){o[h]=row[i];o[AIQCODING.key_(h)]=row[i];}});
    return o;
  }).filter(function(o){return Object.keys(o).some(function(k){return k.charAt(0)!=='_'&&AIQCODING.text_(o[k])!=='';});});
};
AIQCODING.allHistoricalRows_ = function(){
  var ss=AIQCODING.ss_(),seen={},rows=[];
  AIQCODING.SHEET_CANDIDATES.forEach(function(name){
    var sh=ss.getSheetByName(name);
    if(!sh||seen[sh.getSheetId()])return;
    seen[sh.getSheetId()]=true;
    rows=rows.concat(AIQCODING.objectRows_(sh));
  });
  return rows;
};
AIQCODING.pick_ = function(row,names){
  row=row||{};
  for(var i=0;i<names.length;i++){
    var n=names[i],v=row[n];
    if(v===undefined)v=row[AIQCODING.key_(n)];
    if(v!==undefined&&v!==null&&AIQCODING.text_(v)!=='')return v;
  }
  return '';
};
AIQCODING.rowIdentity_ = function(row){return {
 studentId:AIQCODING.text_(AIQCODING.pick_(row,['student_id','studentId','studentid','id','pid'])),
 studentName:AIQCODING.text_(AIQCODING.pick_(row,['student_name','studentName','studentname','name'])),
 section:AIQCODING.section_(AIQCODING.pick_(row,['section','section_id','sectionId'])||'101'),
 sessionId:AIQCODING.session_(AIQCODING.pick_(row,['session_id','sessionId','session','mission_id','missionId','mission']))
};};
AIQCODING.rowScore_ = function(row){
  var direct=AIQCODING.pick_(row,['coding_score','codingScore','best_score','bestScore','score','total_score','totalScore']);
  if(AIQCODING.text_(direct)!=='')return AIQCODING.num_(direct);
  return AIQCODING.num_(AIQCODING.pick_(row,['run_score','runScore']))+
    AIQCODING.num_(AIQCODING.pick_(row,['modify_score','modifyScore']))+
    AIQCODING.num_(AIQCODING.pick_(row,['challenge_score','challengeScore']))+
    Math.min(20,AIQCODING.num_(AIQCODING.pick_(row,['quiz_score','quizScore']))*4);
};
AIQCODING.rowCompleted_ = function(row){
  return AIQCODING.rowScore_(row)>=60||AIQCODING.bool_(AIQCODING.pick_(row,['completed','passed','mastered','status','coding_completed','codingCompleted']));
};
AIQCODING.rowSubmittedAt_ = function(row){return AIQCODING.text_(AIQCODING.pick_(row,['submitted_at','submittedAt','serverTs','clientTs','timestamp','created_at','createdAt']));};
AIQCODING.matches_ = function(row,studentId,section,sessionId){
  var x=AIQCODING.rowIdentity_(row);
  return x.studentId===studentId&&x.section===AIQCODING.section_(section)&&x.sessionId===AIQCODING.session_(sessionId);
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
  var x=AIQCODING.parseV31_(payload),rule=AIQCODING.RULES[sessionId],output=AIQCODING.text_(payload.output);
  if(!rule)return {mode:'TEACHING_V3_2_1_SEMANTIC',predictionCorrect:false,completedCodePassed:false,outputPassed:false,modifyPassed:false,challengePassed:false,challengeAttempted:false,quizPassed:false,quizScore:0,runScore:0,modifyScore:0,challengeScore:0,quizPoint:0,parsed:x,diagnostics:{error:'RULE_NOT_FOUND'}};

  var expected=AIQCODING.norm_(rule.expected);
  var predictionCorrect=x.predictionAnswer.length>=2&&x.predictionReason.length>=20&&AIQCODING.norm_(x.predictionAnswer).indexOf(expected)>=0;
  var completedCodePassed=x.completedCode.length>=40&&!/\bTODO\b/i.test(x.completedCode)&&AIQCODING.containsAll_(x.completedCode,rule.b)&&AIQCODING.containsAny_(x.completedCode,rule.ba);
  var outputPassed=output.length>=2&&AIQCODING.norm_(output).indexOf(expected)>=0;
  var modifyPassed=x.scenarioCode.length>=30&&AIQCODING.containsAll_(x.scenarioCode,rule.m)&&AIQCODING.containsAny_(x.scenarioCode,rule.ma)&&AIQCODING.minCounts_(x.scenarioCode,rule.mc);
  var challengeBody=x.challengeCode.replace(/#\s*(Level|QuizScore)[^\r\n]*/gi,'').trim();
  var challengeAttempted=challengeBody.length>0;
  var challengePassed=challengeAttempted&&challengeBody.length>=20&&AIQCODING.containsAll_(challengeBody,rule.c)&&AIQCODING.containsAny_(challengeBody,rule.ca)&&AIQCODING.minCounts_(challengeBody,rule.cc);
  var quizPassed=x.quizScore>=4;

  return {
    mode:'TEACHING_V3_2_1_SEMANTIC',
    predictionCorrect:predictionCorrect,
    completedCodePassed:completedCodePassed,
    outputPassed:outputPassed,
    modifyPassed:modifyPassed,
    challengeAttempted:challengeAttempted,
    challengePassed:challengePassed,
    quizPassed:quizPassed,
    quizScore:x.quizScore,
    runScore:(completedCodePassed&&outputPassed)?25:0,
    modifyScore:modifyPassed?35:0,
    challengeScore:challengePassed?20:0,
    quizPoint:quizPassed?20:x.quizScore*4,
    parsed:x,
    diagnostics:{
      expectedOutput:rule.expected,
      predictionReasonLength:x.predictionReason.length,
      missingCompletedKeywords:AIQCODING.missing_(x.completedCode,rule.b),
      missingModifyKeywords:AIQCODING.missing_(x.scenarioCode,rule.m),
      missingChallengeKeywords:challengeAttempted?AIQCODING.missing_(challengeBody,rule.c):[],
      challengePolicy:'optional-bonus-20'
    }
  };
};
AIQCODING.validateEvidenceLegacy_ = function(sessionId,payload){
  var rule=AIQCODING.RULES[sessionId];
  if(!rule)return {mode:'LEGACY_V2',predictionCorrect:false,completedCodePassed:false,outputPassed:false,modifyPassed:false,challengePassed:false,challengeAttempted:false,quizPassed:false,quizScore:0,runScore:0,modifyScore:0,challengeScore:0,quizPoint:0,parsed:{}};
  var prediction=AIQCODING.norm_(payload.predictionAnswer),output=AIQCODING.norm_(payload.output),modified=AIQCODING.text_(payload.modifiedCode),challenge=AIQCODING.text_(payload.challengeCode),expected=AIQCODING.norm_(rule.expected);
  var predictionCorrect=prediction===expected;
  var outputPassed=output.indexOf(expected)>=0;
  var modifyPassed=AIQCODING.containsAll_(modified,rule.m)&&AIQCODING.containsAny_(modified,rule.ma)&&AIQCODING.minCounts_(modified,rule.mc);
  var challengeAttempted=challenge.length>0;
  var challengePassed=challengeAttempted&&AIQCODING.containsAll_(challenge,rule.c)&&AIQCODING.containsAny_(challenge,rule.ca)&&AIQCODING.minCounts_(challenge,rule.cc);
  return {mode:'LEGACY_V2',predictionCorrect:predictionCorrect,completedCodePassed:true,outputPassed:outputPassed,modifyPassed:modifyPassed,challengeAttempted:challengeAttempted,challengePassed:challengePassed,quizPassed:true,quizScore:0,runScore:outputPassed?30:0,modifyScore:modifyPassed?50:0,challengeScore:challengePassed?20:0,quizPoint:0,parsed:{predictionAnswer:AIQCODING.text_(payload.predictionAnswer),predictionReason:'legacy',completedCode:'legacy',scenarioCode:modified,challengeCode:challenge,challengeLevel:'legacy'}};
};
AIQCODING.validateEvidence_ = function(sessionId,payload){
  var modified=AIQCODING.text_(payload.modifiedCode),challenge=AIQCODING.text_(payload.challengeCode);
  var isV31=modified.indexOf('# Scenario Modification')>=0||/#\s*QuizScore\s+\d+\s*\/\s*5/i.test(challenge)||AIQCODING.text_(payload.completedCode)!=='';
  return isV31?AIQCODING.validateEvidenceV31_(sessionId,payload):AIQCODING.validateEvidenceLegacy_(sessionId,payload);
};

AIQCODING.submit_ = function(payload){
  payload=payload||{};
  var sessionId=AIQCODING.session_(payload.sessionId),studentId=AIQCODING.text_(payload.studentId),studentName=AIQCODING.text_(payload.studentName),section=AIQCODING.section_(payload.section||'101');
  if(!AIQCODING.allowedLab_(sessionId)||!AIQCODING.RULES[sessionId])return {ok:false,code:'LAB_NOT_AVAILABLE',sessionId:sessionId,version:AIQCODING.VERSION};
  if(!studentId||!studentName||!section)return {ok:false,code:'MISSING_IDENTITY',version:AIQCODING.VERSION};

  var evidence=AIQCODING.validateEvidence_(sessionId,payload);
  if(!evidence.predictionCorrect)return {ok:false,code:'PREDICTION_SEMANTIC_FAILED',message:'คำตอบ Predict ต้องตรงกับ output ที่คาดและมีเหตุผลอย่างน้อย 20 ตัวอักษร',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.completedCodePassed)return {ok:false,code:'COMPLETED_CODE_SEMANTIC_FAILED',message:'Completed Code ยังไม่ครบองค์ประกอบสำคัญของด่าน หรือยังมี TODO',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.outputPassed)return {ok:false,code:'OUTPUT_SEMANTIC_FAILED',message:'Output Evidence ไม่ตรงกับผลที่โจทย์กำหนด',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.modifyPassed)return {ok:false,code:'MODIFY_SEMANTIC_FAILED',message:'Scenario Modification ยังไม่มีเงื่อนไขสำคัญของด่าน',evidence:evidence,version:AIQCODING.VERSION};
  if(!evidence.quizPassed)return {ok:false,code:'QUIZ_NOT_PASSED',message:'Mini Quiz ต้องผ่านอย่างน้อย 4/5',evidence:evidence,version:AIQCODING.VERSION};

  var historical=AIQCODING.allHistoricalRows_().filter(function(r){return AIQCODING.matches_(r,studentId,section,sessionId);});
  var attemptNumber=historical.length+1;
  var score=evidence.runScore+evidence.modifyScore+evidence.challengeScore+evidence.quizPoint;
  var completed=evidence.predictionCorrect&&evidence.completedCodePassed&&evidence.outputPassed&&evidence.modifyPassed&&evidence.quizPassed;
  var now=Utilities.formatDate(new Date(),'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX");
  var attemptId=AIQCODING.text_(payload.codingAttemptId||Utilities.getUuid());
  var duplicate=AIQCODING.allHistoricalRows_().some(function(r){return AIQCODING.text_(AIQCODING.pick_(r,['coding_attempt_id','codingAttemptId','attemptId']))===attemptId;});

  if(!duplicate){
    var x=evidence.parsed||{};
    var obj={
      submitted_at:now,coding_attempt_id:attemptId,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,
      attempt_number:attemptNumber,prediction_answer:x.predictionAnswer||'',prediction_reason:x.predictionReason||'',prediction_correct:true,
      run_score:evidence.runScore,modify_score:evidence.modifyScore,challenge_score:evidence.challengeScore,quiz_score:evidence.quizScore,coding_score:score,completed:completed,
      run_count:Number(payload.runCount||0),error_count:Number(payload.errorCount||0),error_types_json:JSON.stringify(payload.errorTypes||[]),
      output:AIQCODING.text_(payload.output).slice(0,5000),completed_code:AIQCODING.text_(x.completedCode).slice(0,20000),modified_code:AIQCODING.text_(x.scenarioCode).slice(0,20000),
      challenge_code:AIQCODING.text_(x.challengeCode).slice(0,20000),challenge_level:x.challengeLevel||'',validation_mode:evidence.mode,
      used_time_sec:Number(payload.usedTimeSec||0),version:AIQCODING.VERSION
    };
    AIQCODING.ensureSheet_().appendRow(AIQCODING.HEADERS.map(function(h){return obj[h]==null?'':obj[h];}));
  }

  return {
    ok:true,duplicate:duplicate,studentId:studentId,studentName:studentName,section:section,sessionId:sessionId,
    attemptNumber:attemptNumber,codingScore:score,completed:completed,evidence:evidence,serverValidated:true,
    challengePolicy:'optional-bonus-20',authority:'Google Sheet coding evidence, exact normalized student ID',version:AIQCODING.VERSION
  };
};

AIQCODING.getStatus_ = function(payload){
  payload=payload||{};
  var studentId=AIQCODING.text_(payload.studentId),studentName=AIQCODING.text_(payload.studentName),section=AIQCODING.section_(payload.section||'101'),sessionId=AIQCODING.session_(payload.sessionId);
  if(!studentId||!section||!sessionId)return {ok:false,code:'MISSING_STATUS_IDENTITY',version:AIQCODING.VERSION};
  if(!AIQCODING.allowedLab_(sessionId))return {ok:false,code:'LAB_NOT_AVAILABLE',sessionId:sessionId,version:AIQCODING.VERSION};

  var all=AIQCODING.allHistoricalRows_();
  var rows=all.filter(function(r){return AIQCODING.matches_(r,studentId,section,sessionId);});
  rows.sort(function(a,b){
    var ta=Date.parse(AIQCODING.rowSubmittedAt_(a))||AIQCODING.num_(AIQCODING.pick_(a,['attempt_number','attemptNumber']));
    var tb=Date.parse(AIQCODING.rowSubmittedAt_(b))||AIQCODING.num_(AIQCODING.pick_(b,['attempt_number','attemptNumber']));
    return ta-tb;
  });
  var latest=rows.length?rows[rows.length-1]:null,best=null;
  rows.forEach(function(r){if(!best||AIQCODING.rowScore_(r)>AIQCODING.rowScore_(best))best=r;});
  var bestScore=best?AIQCODING.rowScore_(best):0,sourceSheets=[];
  rows.forEach(function(r){if(sourceSheets.indexOf(r._sheet)<0)sourceSheets.push(r._sheet);});

  return {
    ok:true,action:'GET_CODING_STATUS',studentId:studentId,studentName:studentName,section:section,sessionId:sessionId,
    found:rows.length>0,completed:rows.some(AIQCODING.rowCompleted_),latestScore:latest?AIQCODING.rowScore_(latest):0,bestScore:bestScore,
    attemptCount:rows.length,latestAttempt:latest?AIQCODING.num_(AIQCODING.pick_(latest,['attempt_number','attemptNumber'])):0,
    submittedAt:latest?AIQCODING.rowSubmittedAt_(latest):'',sourceSheets:sourceSheets,scannedCodingRows:all.length,
    authority:'Google Sheet coding evidence, exact normalized student ID',version:AIQCODING.VERSION
  };
};
AIQCODING.auditStatus_ = function(payload){
  payload=payload||{};
  var result=AIQCODING.getStatus_(payload);
  var target={studentId:AIQCODING.text_(payload.studentId),studentName:AIQCODING.text_(payload.studentName),section:AIQCODING.section_(payload.section||'101'),sessionId:AIQCODING.session_(payload.sessionId)};
  var rows=AIQCODING.allHistoricalRows_();
  var near=rows.filter(function(r){var x=AIQCODING.rowIdentity_(r);return x.studentId===target.studentId||x.studentName===target.studentName;}).slice(0,30).map(function(r){var x=AIQCODING.rowIdentity_(r);return {sheet:r._sheet,row:r._row,studentId:x.studentId,studentName:x.studentName,section:x.section,sessionId:x.sessionId,score:AIQCODING.rowScore_(r),completed:AIQCODING.rowCompleted_(r)};});
  result.debug={target:target,scannedSheets:AIQCODING.SHEET_CANDIDATES,totalCodingRows:rows.length,nearMatches:near};
  return result;
};
AIQCODING.handle = function(payload){
  var action=AIQCODING.text_((payload||{}).action).toUpperCase();
  if(action==='SUBMIT_CODING_LAB')return AIQCODING.submit_(payload);
  if(action==='GET_CODING_STATUS')return AIQCODING.getStatus_(payload);
  if(action==='AUDIT_CODING_STATUS')return AIQCODING.auditStatus_(payload);
  if(action==='GET_LAB_CONFIG'){
    var sessionId=AIQCODING.session_(payload.sessionId);
    if(!AIQCODING.allowedLab_(sessionId))return {ok:false,code:'LAB_NOT_AVAILABLE',version:AIQCODING.VERSION};
    return {ok:true,version:AIQCODING.VERSION,sessionId:sessionId,config:AIQCODING.RULES[sessionId],challengePolicy:'optional-bonus-20'};
  }
  return {ok:false,code:'UNKNOWN_CODING_ACTION',action:action,version:AIQCODING.VERSION};
};