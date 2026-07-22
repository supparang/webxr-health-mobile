/**
 * CSAI2102 AI Quest Coding Receiver v2.2
 * Direct Google Sheet implementation for S1-S15 and B1-B5.
 * Server-side evidence validation + official coding status lookup.
 * Does NOT declare doGet(e) / doPost(e).
 */
var AIQCODING = AIQCODING || {};

AIQCODING.VERSION = '20260722-AIQ-CODING-RECEIVER-V2.2.0-DIRECT-SHEET-20';
AIQCODING.SHEET = 'coding_attempts';
AIQCODING.HEADERS = [
  'submitted_at','coding_attempt_id','student_id','student_name','section','session_id',
  'attempt_number','prediction_answer','prediction_correct','run_score','modify_score',
  'challenge_score','coding_score','completed','run_count','error_count','error_types_json',
  'output','used_time_sec','version'
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

AIQCODING.validateEvidence_ = function(sessionId,payload){
  var rule = AIQCODING.RULES[sessionId];
  if (!rule) return {predictionCorrect:false,outputPassed:false,modifyPassed:false,challengePassed:false,runScore:0,modifyScore:0,challengeScore:0};
  var output = AIQCODING.norm_(payload.output);
  var prediction = AIQCODING.norm_(payload.predictionAnswer);
  var modified = AIQCODING.text_(payload.modifiedCode).toLowerCase();
  var challenge = AIQCODING.text_(payload.challengeCode).toLowerCase();
  var expected = AIQCODING.norm_(rule.expected);
  var modifyPassed = AIQCODING.hasAll_(modified,rule.m) && AIQCODING.hasAny_(modified,rule.ma) && AIQCODING.minCounts_(modified,rule.mc);
  var challengePassed = AIQCODING.hasAll_(challenge,rule.c) && AIQCODING.hasAny_(challenge,rule.ca) && AIQCODING.minCounts_(challenge,rule.cc);
  var outputPassed = !!expected && output.indexOf(expected)>=0;
  var predictionCorrect = !!expected && prediction===expected;
  return {predictionCorrect:predictionCorrect,outputPassed:outputPassed,modifyPassed:modifyPassed,challengePassed:challengePassed,runScore:outputPassed?30:0,modifyScore:modifyPassed?50:0,challengeScore:challengePassed?20:0};
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
  if (!evidence.outputPassed) return {ok:false,code:'OUTPUT_EVIDENCE_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  if (!evidence.modifyPassed) return {ok:false,code:'MODIFY_EVIDENCE_FAILED',evidence:evidence,version:AIQCODING.VERSION};
  var rows = AIQCODING.rows_().filter(function(r){return AIQCODING.text_(r.student_id)===studentId&&AIQCODING.text_(r.section)===section&&AIQCODING.text_(r.session_id).toUpperCase()===sessionId;});
  var attemptNumber = rows.length + 1;
  var score = evidence.runScore + evidence.modifyScore + evidence.challengeScore;
  var now = Utilities.formatDate(new Date(),'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX");
  var attemptId = AIQCODING.text_(payload.codingAttemptId || Utilities.getUuid());
  var duplicate = AIQCODING.rows_().some(function(r){return AIQCODING.text_(r.coding_attempt_id)===attemptId;});
  if (!duplicate) {
    var sh = AIQCODING.ensureSheet_();
    var obj = {
      submitted_at:now,coding_attempt_id:attemptId,student_id:studentId,student_name:studentName,section:section,session_id:sessionId,
      attempt_number:attemptNumber,prediction_answer:AIQCODING.text_(payload.predictionAnswer),prediction_correct:evidence.predictionCorrect,
      run_score:evidence.runScore,modify_score:evidence.modifyScore,challenge_score:evidence.challengeScore,coding_score:score,completed:score>=60,
      run_count:Number(payload.runCount||0),error_count:Number(payload.errorCount||0),error_types_json:JSON.stringify(payload.errorTypes||[]),
      output:AIQCODING.text_(payload.output).slice(0,5000),used_time_sec:Number(payload.usedTimeSec||0),version:AIQCODING.VERSION
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
    return {ok:true,version:AIQCODING.VERSION,sessionId:sessionId,config:AIQCODING.LABS[sessionId]};
  }
  return {ok:false,code:'UNKNOWN_CODING_ACTION',action:action,version:AIQCODING.VERSION};
};