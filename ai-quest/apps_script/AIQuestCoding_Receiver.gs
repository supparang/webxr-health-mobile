/**
 * CSAI2102 AI Quest Coding Receiver v3.1
 * Direct Google Sheet implementation for S1-S15 and B1-B5.
 * Supports Teaching Activity Engine v3.1 and legacy v2 evidence.
 * Does NOT declare doGet(e) / doPost(e).
 */
var AIQCODING = AIQCODING || {};

AIQCODING.VERSION = '20260722-AIQ-CODING-RECEIVER-V3.1.0-TEACHING-EVIDENCE';
AIQCODING.SHEET = 'coding_attempts';
AIQCODING.HEADERS = [
  'submitted_at','coding_attempt_id','student_id','student_name','section','session_id',
  'attempt_number','prediction_answer','prediction_reason','prediction_correct',
  'run_score','modify_score','challenge_score','quiz_score','coding_score','completed',
  'run_count','error_count','error_types_json','output','completed_code','modified_code',
  'challenge_code','challenge_level','validation_mode','used_time_sec','version'
];

AIQCODING.text_ = function(v){ return String(v == null ? '' : v).trim(); };
AIQCODING.norm_ = function(v){ return AIQCODING.text_(v).toLowerCase().replace(/\s+/g,''); };
AIQCODING.hasAll_ = function(text, items){
  return (items || []).every(function(k){ return text.indexOf(String(k).toLowerCase()) >= 0; });
};
AIQCODING.hasAny_ = function(text, items){
  return !items || !items.length || items.some(function(k){ return text.indexOf(String(k).toLowerCase()) >= 0; });
};
AIQCODING.minCounts_ = function(text, counts){
  counts = counts || {};
  return Object.keys(counts).every(function(k){
    var escaped = String(k).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return (text.match(new RegExp(escaped,'g')) || []).length >= Number(counts[k] || 1);
  });
};
AIQCODING.allowedLab_ = function(sessionId){
  return /^(S(?:[1-9]|1[0-5])|B[1-5])$/.test(AIQCODING.text_(sessionId).toUpperCase());
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

AIQCODING.ensureSheet_ = function(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('SPREADSHEET_NOT_FOUND');
  var sh = ss.getSheetByName(AIQCODING.SHEET);
  if (!sh) sh = ss.insertSheet(AIQCODING.SHEET);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,AIQCODING.HEADERS.length).setValues([AIQCODING.HEADERS]);
    sh.setFrozenRows(1);
  } else {
    var lastCol = Math.max(1,sh.getLastColumn());
    var existing = sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(function(x){return String(x||'').trim();});
    var missing = AIQCODING.HEADERS.filter(function(h){return existing.indexOf(h)<0;});
    if (missing.length) sh.getRange(1,lastCol+1,1,missing.length).setValues([missing]);
  }
  return sh;
};

AIQCODING.rows_ = function(){
  var sh = AIQCODING.ensureSheet_();
  if (sh.getLastRow()<2) return [];
  var values = sh.getDataRange().getDisplayValues();
  var headers = values[0];
  return values.slice(1).map(function(row){var o={};headers.forEach(function(h,i){if(h)o[h]=row[i];});return o;});
};

AIQCODING.parseV31_ = function(payload){
  var predictionRaw = AIQCODING.text_(payload.predictionAnswer);
  var reasonMarker = ' | Reason: ';
  var reasonAt = predictionRaw.indexOf(reasonMarker);
  var predictionAnswer = reasonAt >= 0 ? predictionRaw.slice(0,reasonAt).trim() : predictionRaw;
  var predictionReason = reasonAt >= 0 ? predictionRaw.slice(reasonAt + reasonMarker.length).trim() : AIQCODING.text_(payload.predictionReason);

  var modifiedRaw = AIQCODING.text_(payload.modifiedCode);
  var scenarioMarker = '# Scenario Modification';
  var scenarioAt = modifiedRaw.indexOf(scenarioMarker);
  var completedCode = scenarioAt >= 0 ? modifiedRaw.slice(0,scenarioAt).trim() : AIQCODING.text_(payload.completedCode);
  var scenarioCode = scenarioAt >= 0 ? modifiedRaw.slice(scenarioAt + scenarioMarker.length).trim() : modifiedRaw;

  var challengeRaw = AIQCODING.text_(payload.challengeCode);
  var quizMatch = challengeRaw.match(/#\s*QuizScore\s+(\d+)\s*\/\s*5/i);
  var levelMatch = challengeRaw.match(/#\s*Level\s+([^\r\n]+)/i);

  return {
    predictionAnswer:predictionAnswer,
    predictionReason:predictionReason,
    completedCode:completedCode,
    scenarioCode:scenarioCode,
    challengeCode:challengeRaw,
    quizScore:quizMatch ? Math.max(0,Math.min(5,Number(quizMatch[1]))) : Number(payload.quizScore||0),
    challengeLevel:levelMatch ? AIQCODING.text_(levelMatch[1]) : AIQCODING.text_(payload.challengeLevel)
  };
};

AIQCODING.validateEvidenceV31_ = function(sessionId,payload){
  var x = AIQCODING.parseV31_(payload);
  var output = AIQCODING.text_(payload.output);
  var predictionPassed = x.predictionAnswer.length >= 2 && x.predictionReason.length >= 20;
  var completedCodePassed = x.completedCode.length >= 40 && !/\bTODO\b/i.test(x.completedCode);
  var outputPassed = output.length >= 2;
  var modifyPassed = x.scenarioCode.length >= 30;
  var quizPassed = x.quizScore >= 4;
  var challengePassed = x.challengeCode.replace(/#\s*(Level|QuizScore)[^\r\n]*/gi,'').trim().length >= 20;

  return {
    mode:'TEACHING_V3_1',
    predictionCorrect:predictionPassed,
    completedCodePassed:completedCodePassed,
    outputPassed:outputPassed,
    modifyPassed:modifyPassed,
    challengePassed:challengePassed,
    quizPassed:quizPassed,
    quizScore:x.quizScore,
    runScore:(completedCodePassed && outputPassed) ? 25 : 0,
    modifyScore:modifyPassed ? 35 : 0,
    challengeScore:challengePassed ? 20 : 0,
    quizPoint:quizPassed ? 20 : x.quizScore * 4,
    parsed:x
  };
};

AIQCODING.validateEvidenceLegacy_ = function(sessionId,payload){
  var rule = AIQCODING.RULES[sessionId];
  if (!rule) return {mode:'LEGACY_V2',predictionCorrect:false,outputPassed:false,modifyPassed:false,challengePassed:false,quizScore:0,runScore:0,modifyScore:0,challengeScore:0,quizPoint:0,parsed:{}};
  var output = AIQCODING.norm_(payload.output);
  var prediction = AIQCODING.norm_(payload.predictionAnswer);
  var modified = AIQCODING.text_(payload.modifiedCode).toLowerCase();
  var challenge = AIQCODING.text_(payload.challengeCode).toLowerCase();
  var expected = AIQCODING.norm_(rule.expected);
  var modifyPassed = AIQCODING.hasAll_(modified,rule.m) && AIQCODING.hasAny_(modified,rule.ma) && AIQCODING.minCounts_(modified,rule.mc);
  var challengePassed = AIQCODING.hasAll_(challenge,rule.c) && AIQCODING.hasAny_(challenge,rule.ca) && AIQCODING.minCounts_(challenge,rule.cc);
  var outputPassed = !!expected && output.indexOf(expected)>=0;
  var predictionCorrect = !!expected && prediction===expected;
  return {mode:'LEGACY_V2',predictionCorrect:predictionCorrect,completedCodePassed:true,outputPassed:outputPassed,modifyPassed:modifyPassed,challengePassed:challengePassed,quizPassed:true,quizScore:0,runScore:outputPassed?30:0,modifyScore:modifyPassed?50:0,challengeScore:challengePassed?20:0,quizPoint:0,parsed:{predictionAnswer:AIQCODING.text_(payload.predictionAnswer),predictionReason:'',completedCode:'',scenarioCode:AIQCODING.text_(payload.modifiedCode),challengeCode:AIQCODING.text_(payload.challengeCode),challengeLevel:''}};
};

AIQCODING.validateEvidence_ = function(sessionId,payload){
  var modified = AIQCODING.text_(payload.modifiedCode);
  var challenge = AIQCODING.text_(payload.challengeCode);
  var isV31 = modified.indexOf('# Scenario Modification') >= 0 || /#\s*QuizScore\s+\d+\s*\/\s*5/i.test(challenge) || AIQCODING.text_(payload.completedCode);
  return isV31 ? AIQCODING.validateEvidenceV31_(sessionId,payload) : AIQCODING.validateEvidenceLegacy_(sessionId,payload);
};

AIQCODING.submit_ = function(payload){
  payload = payload || {};
  var sessionId = AIQCODING.text_(payload.sessionId).toUpperCase();
  if (!AIQCODING.allowedLab_(sessionId) || !AIQCODING.RULES[sessionId]) return {ok:false,code:'LAB_NOT_AVAILABLE',sessionId:sessionId,version:AIQCODING.VERSION};
  var studentId = AIQCODING.text_(payload.studentId);
  var studentName = AIQCODING.text_(payload.studentName);
  var section = AIQCODING.text_(payload.section || '101');
  if (!studentId || !studentName || !section) return {ok:false,code:'MISSING_IDENTITY',version:AIQCODING.VERSION};

  var evidence = AIQCODING.validateEvidence_(sessionId,payload);
  if (!evidence.predictionCorrect) return {ok:false,code:'PREDICTION_REASON_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if (!evidence.completedCodePassed) return {ok:false,code:'COMPLETED_CODE_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if (!evidence.outputPassed) return {ok:false,code:'OUTPUT_EVIDENCE_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if (!evidence.modifyPassed) return {ok:false,code:'MODIFY_EVIDENCE_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if (!evidence.quizPassed) return {ok:false,code:'QUIZ_NOT_PASSED',evidence:evidence,version:AIQCODING.VERSION};

  var rows = AIQCODING.rows_().filter(function(r){return AIQCODING.text_(r.student_id)===studentId&&AIQCODING.text_(r.section)===section&&AIQCODING.text_(r.session_id).toUpperCase()===sessionId;});
  var attemptNumber = rows.length + 1;
  var score = evidence.runScore + evidence.modifyScore + evidence.challengeScore + evidence.quizPoint;
  var now = Utilities.formatDate(new Date(),'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX");
  var attemptId = AIQCODING.text_(payload.codingAttemptId || Utilities.getUuid());
  var duplicate = AIQCODING.rows_().some(function(r){return AIQCODING.text_(r.coding_attempt_id)===attemptId;});

  if (!duplicate) {
    var sh = AIQCODING.ensureSheet_();
    var x = evidence.parsed || {};
    var obj = {
      submitted_at:now,coding_attempt_id:attemptId,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,
      attempt_number:attemptNumber,prediction_answer:x.predictionAnswer||AIQCODING.text_(payload.predictionAnswer),prediction_reason:x.predictionReason||'',prediction_correct:evidence.predictionCorrect,
      run_score:evidence.runScore,modify_score:evidence.modifyScore,challenge_score:evidence.challengeScore,quiz_score:evidence.quizScore,coding_score:score,completed:score>=60,
      run_count:Number(payload.runCount||0),error_count:Number(payload.errorCount||0),error_types_json:JSON.stringify(payload.errorTypes||[]),
      output:AIQCODING.text_(payload.output).slice(0,5000),completed_code:AIQCODING.text_(x.completedCode).slice(0,20000),modified_code:AIQCODING.text_(x.scenarioCode).slice(0,20000),
      challenge_code:AIQCODING.text_(x.challengeCode).slice(0,20000),challenge_level:x.challengeLevel||'',validation_mode:evidence.mode,
      used_time_sec:Number(payload.usedTimeSec||0),version:AIQCODING.VERSION
    };
    sh.appendRow(AIQCODING.HEADERS.map(function(h){return obj[h] == null ? '' : obj[h];}));
  }

  return {ok:true,duplicate:duplicate,studentId:studentId,section:section,sessionId:sessionId,attemptNumber:attemptNumber,codingScore:score,completed:score>=60,evidence:evidence,serverValidated:true,version:AIQCODING.VERSION};
};

AIQCODING.getStatus_ = function(payload){
  payload = payload || {};
  var studentId = AIQCODING.text_(payload.studentId), section = AIQCODING.text_(payload.section), sessionId = AIQCODING.text_(payload.sessionId).toUpperCase();
  if (!studentId || !section || !sessionId) return {ok:false,code:'MISSING_STATUS_IDENTITY',version:AIQCODING.VERSION};
  if (!AIQCODING.allowedLab_(sessionId)) return {ok:false,code:'LAB_NOT_AVAILABLE',sessionId:sessionId,version:AIQCODING.VERSION};
  var rows = AIQCODING.rows_().filter(function(r){return AIQCODING.text_(r.student_id)===studentId&&AIQCODING.text_(r.section)===section&&AIQCODING.text_(r.session_id).toUpperCase()===sessionId;});
  rows.sort(function(a,b){return Number(a.attempt_number||0)-Number(b.attempt_number||0);});
  var latest = rows.length ? rows[rows.length-1] : null;
  var best = rows.reduce(function(acc,row){return !acc||Number(row.coding_score||0)>Number(acc.coding_score||0)?row:acc;},null);
  var bestScore = best ? Number(best.coding_score||0) : 0;
  return {ok:true,studentId:studentId,section:section,sessionId:sessionId,found:rows.length>0,completed:bestScore>=60,latestScore:latest?Number(latest.coding_score||0):0,bestScore:bestScore,attemptCount:rows.length,latestAttempt:latest?Number(latest.attempt_number||0):0,submittedAt:latest?latest.submitted_at||'':'',version:AIQCODING.VERSION};
};

AIQCODING.handle = function(payload){
  var action = AIQCODING.text_((payload||{}).action).toUpperCase();
  if (action==='SUBMIT_CODING_LAB') return AIQCODING.submit_(payload);
  if (action==='GET_CODING_STATUS') return AIQCODING.getStatus_(payload);
  if (action==='GET_LAB_CONFIG') {
    var sessionId = AIQCODING.text_(payload.sessionId).toUpperCase();
    if (!AIQCODING.allowedLab_(sessionId)) return {ok:false,code:'LAB_NOT_AVAILABLE',version:AIQCODING.VERSION};
    return {ok:true,version:AIQCODING.VERSION,sessionId:sessionId,config:AIQCODING.RULES[sessionId]};
  }
  return {ok:false,code:'UNKNOWN_CODING_ACTION',action:action,version:AIQCODING.VERSION};
};