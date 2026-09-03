/**
 * UXQuestAnalyticsEngine-v4.gs
 * CSAI2601 UX Quest — Unified Analytics Engine
 * Version: 20260718-UXQ-ANALYTICS-V4
 *
 * Teacher-side Apps Script only. Do not deploy with the public student receiver.
 * Google Sheet is the sole source of truth.
 */

var UXQA_VERSION = '20260718-UXQ-ANALYTICS-V4';
var UXQA_TZ = 'Asia/Bangkok';
var UXQA_SHEETS = {
  ATTEMPTS: 'UXQuest_Attempts',
  ITEMS: 'UXQuest_Item_Responses',
  REFLECTIONS: 'UXQuest_Reflections',
  EVENTS: 'UXQuest_Events',
  STUDENTS: 'UXQuest_Students',
  INTERVENTIONS: 'UXQuest_Interventions',
  SNAPSHOTS: 'UXQuest_Analytics_Snapshots'
};

var UXQA_ITEM_HEADERS = [
  'logged_at','attempt_id','event_id','participant_id','student_id','student_name',
  'section','instructor','mission_id','boss_id','question_id','question_version',
  'concept','difficulty_tag','option_order','selected_option','correct_option',
  'is_correct','response_time_ms','reason_id','selected_reason','correct_reason',
  'reason_correct','hint_used','retry_number','rapid_flag','source_url','game_version'
];

var UXQA_REFLECTION_HEADERS = [
  'logged_at','attempt_id','participant_id','student_id','student_name','section',
  'mission_id','problem_seen','ux_reason','fix_and_test','reflection_text',
  'quality_auto','quality_teacher','quality_final','coder_note','version'
];

var UXQA_INTERVENTION_HEADERS = [
  'created_at','participant_id','student_id','student_name','section','risk_level',
  'risk_score','risk_reasons','recommended_action','teacher_action','status',
  'follow_up_at','outcome','updated_at'
];

function UXQA_setupAnalyticsSheets() {
  var ss = UXQA_getSpreadsheet_();
  UXQA_ensureSheet_(ss, UXQA_SHEETS.ITEMS, UXQA_ITEM_HEADERS);
  UXQA_ensureSheet_(ss, UXQA_SHEETS.REFLECTIONS, UXQA_REFLECTION_HEADERS);
  UXQA_ensureSheet_(ss, UXQA_SHEETS.INTERVENTIONS, UXQA_INTERVENTION_HEADERS);
  UXQA_ensureSheet_(ss, UXQA_SHEETS.SNAPSHOTS, [
    'snapshot_at','snapshot_type','scope_key','metric_key','metric_value',
    'sample_size','metadata_json','engine_version'
  ]);
  return {ok:true, version:UXQA_VERSION, sheets:Object.keys(UXQA_SHEETS)};
}

function UXQA_getDashboardData(filters) {
  filters = filters || {};
  var attempts = UXQA_readObjects_(UXQA_SHEETS.ATTEMPTS);
  var items = UXQA_readObjects_(UXQA_SHEETS.ITEMS);
  var reflections = UXQA_readObjects_(UXQA_SHEETS.REFLECTIONS);
  var events = UXQA_readObjects_(UXQA_SHEETS.EVENTS);

  attempts = UXQA_filter_(attempts, filters);
  items = UXQA_filter_(items, filters);
  reflections = UXQA_filter_(reflections, filters);
  events = UXQA_filter_(events, filters);

  return {
    ok: true,
    version: UXQA_VERSION,
    generatedAt: UXQA_now_(),
    filters: filters,
    overview: UXQA_buildOverview_(attempts, items, reflections),
    questionAnalytics: UXQA_buildQuestionAnalytics_(attempts, items),
    learningPrediction: UXQA_buildLearningPrediction_(attempts, items, reflections, events),
    sectionComparison: UXQA_buildSectionComparison_(attempts, items, reflections),
    research: UXQA_buildResearch_(attempts, items, reflections, events),
    dataQuality: UXQA_buildDataQuality_(attempts, items, reflections, events)
  };
}

function UXQA_getQuestionAnalytics(filters) {
  filters = filters || {};
  return UXQA_buildQuestionAnalytics_(
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ATTEMPTS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ITEMS), filters)
  );
}

function UXQA_getLearningPrediction(filters) {
  filters = filters || {};
  return UXQA_buildLearningPrediction_(
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ATTEMPTS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ITEMS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.REFLECTIONS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.EVENTS), filters)
  );
}

function UXQA_getSectionComparison(filters) {
  filters = filters || {};
  return UXQA_buildSectionComparison_(
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ATTEMPTS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ITEMS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.REFLECTIONS), filters)
  );
}

function UXQA_getResearchDashboard(filters) {
  filters = filters || {};
  return UXQA_buildResearch_(
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ATTEMPTS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ITEMS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.REFLECTIONS), filters),
    UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.EVENTS), filters)
  );
}

function UXQA_buildOverview_(attempts, items, reflections) {
  var students = UXQA_unique_(attempts.map(UXQA_studentKey_).filter(Boolean));
  var sections = UXQA_unique_(attempts.map(function(r){ return UXQA_s_(r.section); }).filter(Boolean));
  var passed = attempts.filter(function(r){ return UXQA_bool_(UXQA_pick_(r,['passed','pass','mastered'])); }).length;
  return {
    students: students.length,
    sections: sections.length,
    attempts: attempts.length,
    itemResponses: items.length,
    reflections: reflections.length,
    passRate: UXQA_ratio_(passed, attempts.length),
    generatedAt: UXQA_now_()
  };
}

function UXQA_buildQuestionAnalytics_(attempts, items) {
  var totalByStudent = {};
  attempts.forEach(function(a){
    var k = UXQA_studentKey_(a);
    var score = UXQA_n_(UXQA_pick_(a,['score','accuracy','verifiedAccuracy','bestScore']));
    if (!totalByStudent[k] || score > totalByStudent[k]) totalByStudent[k] = score;
  });
  var ranked = Object.keys(totalByStudent).sort(function(a,b){return totalByStudent[b]-totalByStudent[a];});
  var cut = Math.max(1, Math.ceil(ranked.length * 0.27));
  var upper = {};
  var lower = {};
  ranked.slice(0,cut).forEach(function(k){upper[k]=true;});
  ranked.slice(Math.max(0,ranked.length-cut)).forEach(function(k){lower[k]=true;});

  var groups = UXQA_groupBy_(items, function(r){
    return [UXQA_s_(r.question_id)||'UNKNOWN', UXQA_s_(r.question_version)||'1'].join('::');
  });

  var rows = Object.keys(groups).map(function(key){
    var rs = groups[key];
    var n = rs.length;
    var correct = rs.filter(function(r){return UXQA_bool_(r.is_correct);}).length;
    var reasonValid = rs.filter(function(r){return UXQA_bool_(r.reason_correct);}).length;
    var upperRs = rs.filter(function(r){return upper[UXQA_studentKey_(r)];});
    var lowerRs = rs.filter(function(r){return lower[UXQA_studentKey_(r)];});
    var pUpper = UXQA_ratio_(upperRs.filter(function(r){return UXQA_bool_(r.is_correct);}).length, upperRs.length);
    var pLower = UXQA_ratio_(lowerRs.filter(function(r){return UXQA_bool_(r.is_correct);}).length, lowerRs.length);
    var distractors = UXQA_groupBy_(rs,function(r){return UXQA_s_(r.selected_option)||'BLANK';});
    var optionStats = Object.keys(distractors).sort().map(function(opt){
      var ors = distractors[opt];
      return {
        option: opt,
        count: ors.length,
        percent: UXQA_ratio_(ors.length,n),
        correctOption: UXQA_s_(rs[0].correct_option),
        upperPercent: UXQA_ratio_(ors.filter(function(r){return upper[UXQA_studentKey_(r)];}).length, upperRs.length),
        lowerPercent: UXQA_ratio_(ors.filter(function(r){return lower[UXQA_studentKey_(r)];}).length, lowerRs.length),
        avgTimeMs: UXQA_mean_(ors.map(function(r){return UXQA_n_(r.response_time_ms);})),
        nonFunctional: ors.length === 0
      };
    });
    var difficulty = UXQA_ratio_(correct,n);
    var discrimination = (pUpper == null || pLower == null) ? null : pUpper-pLower;
    var reasonAccuracy = UXQA_ratio_(reasonValid,n);
    var reasonGap = (difficulty == null || reasonAccuracy == null) ? null : difficulty-reasonAccuracy;
    var rapidRate = UXQA_ratio_(rs.filter(function(r){
      return UXQA_bool_(r.rapid_flag) || UXQA_n_(r.response_time_ms) > 0 && UXQA_n_(r.response_time_ms) < 2500;
    }).length,n);
    var flags = [];
    if (n < 10) flags.push('SMALL_N');
    if (difficulty != null && difficulty >= .90) flags.push('TOO_EASY');
    if (difficulty != null && difficulty < .20) flags.push('TOO_HARD');
    if (discrimination != null && discrimination < 0) flags.push('NEGATIVE_DISCRIMINATION');
    else if (discrimination != null && discrimination < .10) flags.push('LOW_DISCRIMINATION');
    if (reasonGap != null && reasonGap >= .20) flags.push('HIGH_REASON_GAP');
    if (rapidRate != null && rapidRate >= .25) flags.push('RAPID_GUESSING');
    if (optionStats.some(function(o){return o.count === 0 && o.option !== UXQA_s_(rs[0].correct_option);})) flags.push('DEAD_DISTRACTOR');
    return {
      questionId: UXQA_s_(rs[0].question_id)||'UNKNOWN',
      questionVersion: UXQA_s_(rs[0].question_version)||'1',
      missionId: UXQA_s_(rs[0].mission_id),
      concept: UXQA_s_(rs[0].concept),
      n: n,
      correct: correct,
      difficulty: difficulty,
      difficultyBand: UXQA_difficultyBand_(difficulty),
      discrimination: discrimination,
      discriminationBand: UXQA_discriminationBand_(discrimination),
      reasonAccuracy: reasonAccuracy,
      reasonGap: reasonGap,
      avgResponseTimeMs: UXQA_mean_(rs.map(function(r){return UXQA_n_(r.response_time_ms);})),
      rapidGuessRate: rapidRate,
      retryCorrectedRate: UXQA_ratio_(rs.filter(function(r){return UXQA_n_(r.retry_number)>0 && UXQA_bool_(r.is_correct);}).length, rs.filter(function(r){return UXQA_n_(r.retry_number)>0;}).length),
      distractors: optionStats,
      flags: flags
    };
  });
  rows.sort(function(a,b){return (b.flags.length-a.flags.length)||(b.n-a.n);});
  return {
    summary: {
      questions: rows.length,
      responses: items.length,
      flagged: rows.filter(function(r){return r.flags.length;}).length,
      meanDifficulty: UXQA_mean_(rows.map(function(r){return r.difficulty;})),
      meanDiscrimination: UXQA_mean_(rows.map(function(r){return r.discrimination;})),
      meanReasonGap: UXQA_mean_(rows.map(function(r){return r.reasonGap;}))
    },
    questions: rows
  };
}

function UXQA_buildLearningPrediction_(attempts, items, reflections, events) {
  var students = UXQA_groupBy_(attempts, UXQA_studentKey_);
  var itemByStudent = UXQA_groupBy_(items, UXQA_studentKey_);
  var refByStudent = UXQA_groupBy_(reflections, UXQA_studentKey_);
  var eventByStudent = UXQA_groupBy_(events, UXQA_studentKey_);
  var now = new Date();
  var rows = Object.keys(students).filter(Boolean).map(function(k){
    var as = students[k].slice().sort(function(a,b){return UXQA_date_(a)-UXQA_date_(b);});
    var is = itemByStudent[k] || [];
    var rs = refByStudent[k] || [];
    var es = eventByStudent[k] || [];
    var latest = as[as.length-1] || {};
    var scores = as.map(function(a){return UXQA_n_(UXQA_pick_(a,['score','accuracy','verifiedAccuracy']));}).filter(isFinite);
    var passCount = as.filter(function(a){return UXQA_bool_(UXQA_pick_(a,['passed','pass','mastered']));}).length;
    var missionCount = UXQA_unique_(as.map(function(a){return UXQA_s_(UXQA_pick_(a,['mission_id','missionId','mission']));}).filter(Boolean)).length;
    var itemAccuracy = UXQA_ratio_(is.filter(function(r){return UXQA_bool_(r.is_correct);}).length,is.length);
    var reasonAccuracy = UXQA_ratio_(is.filter(function(r){return UXQA_bool_(r.reason_correct);}).length,is.length);
    var reasonGap = itemAccuracy == null || reasonAccuracy == null ? null : itemAccuracy-reasonAccuracy;
    var hints = UXQA_ratio_(as.filter(function(a){return UXQA_n_(UXQA_pick_(a,['hintUsed','hints','helpUsed']))>0;}).length,as.length);
    var retries = Math.max(0,as.length-missionCount);
    var latestDate = UXQA_date_(latest);
    var inactiveDays = latestDate ? Math.floor((now-latestDate)/86400000) : 999;
    var scoreSlope = UXQA_slope_(scores);
    var reflectionQuality = UXQA_mean_(rs.map(function(r){return UXQA_reflectionQuality_(r);}));
    var abandoned = es.filter(function(e){
      var t=UXQA_s_(UXQA_pick_(e,['event','event_type','type'])).toLowerCase();
      return t.indexOf('start')>=0 || t.indexOf('abandon')>=0;
    }).length > as.length;

    var score = 0;
    var reasons = [];
    if (inactiveDays >= 14) {score += 25; reasons.push('ไม่มีกิจกรรมอย่างน้อย 14 วัน');}
    else if (inactiveDays >= 7) {score += 15; reasons.push('ไม่มีกิจกรรมอย่างน้อย 7 วัน');}
    if (scores.length && UXQA_mean_(scores) < 60) {score += 20; reasons.push('คะแนนเฉลี่ยต่ำกว่า 60');}
    if (reasonGap != null && reasonGap >= .20) {score += 18; reasons.push('Reason Gap สูง');}
    if (scoreSlope != null && scoreSlope < -2) {score += 12; reasons.push('แนวโน้มคะแนนลดลง');}
    if (retries >= 3 && (scoreSlope == null || scoreSlope <= 1)) {score += 12; reasons.push('Retry หลายครั้งแต่ไม่ดีขึ้น');}
    if (hints != null && hints >= .60) {score += 8; reasons.push('พึ่งพาคำใบ้สูง');}
    if (reflectionQuality != null && reflectionQuality < 2) {score += 8; reasons.push('Reflection ยังไม่เชื่อม Evidence/Reason');}
    if (abandoned) {score += 10; reasons.push('มีสัญญาณเริ่มแล้วไม่ส่งงาน');}
    if (missionCount < 3) {score += 5; reasons.push('ความก้าวหน้ายังไม่ถึงชุด Boss แรก');}
    score = Math.min(100,score);
    var level = score>=70?'CRITICAL':score>=50?'HIGH':score>=25?'WATCH':'LOW';
    var action = level==='CRITICAL'?'ติดต่อรายบุคคล ตรวจอุปสรรค และจัดกิจกรรมแก้ misconception ก่อน Boss':
      level==='HIGH'?'มอบหมายข้อคู่ขนานพร้อม Reason Check และนัดติดตามภายในสัปดาห์นี้':
      level==='WATCH'?'ติดตาม Mission ถัดไปและให้ feedback เฉพาะจุด':'ดำเนินการเรียนตามปกติ';
    return {
      participantId: UXQA_s_(UXQA_pick_(latest,['participant_id','participantId'])),
      studentId: UXQA_s_(UXQA_pick_(latest,['student_id','studentId'])),
      studentName: UXQA_s_(UXQA_pick_(latest,['student_name','studentName','name'])),
      section: UXQA_s_(latest.section),
      riskScore: score,
      riskLevel: level,
      riskReasons: reasons,
      recommendedAction: action,
      attempts: as.length,
      missions: missionCount,
      passes: passCount,
      meanScore: UXQA_mean_(scores),
      scoreSlope: scoreSlope,
      inactiveDays: inactiveDays,
      reasonGap: reasonGap,
      reflectionQuality: reflectionQuality,
      dropoutRisk: inactiveDays>=14 || abandoned,
      bossRisk: score>=50
    };
  });
  rows.sort(function(a,b){return b.riskScore-a.riskScore;});
  return {
    summary:{
      learners:rows.length,
      critical:rows.filter(function(r){return r.riskLevel==='CRITICAL';}).length,
      high:rows.filter(function(r){return r.riskLevel==='HIGH';}).length,
      watch:rows.filter(function(r){return r.riskLevel==='WATCH';}).length,
      bossRisk:rows.filter(function(r){return r.bossRisk;}).length,
      dropoutRisk:rows.filter(function(r){return r.dropoutRisk;}).length
    },
    learners:rows,
    disclaimer:'Prediction is an instructional support indicator, not a grade or disciplinary decision.'
  };
}

function UXQA_buildSectionComparison_(attempts, items, reflections) {
  var bySection = UXQA_groupBy_(attempts,function(r){return UXQA_s_(r.section)||'UNSPECIFIED';});
  var itemsBySection = UXQA_groupBy_(items,function(r){return UXQA_s_(r.section)||'UNSPECIFIED';});
  var refsBySection = UXQA_groupBy_(reflections,function(r){return UXQA_s_(r.section)||'UNSPECIFIED';});
  var rows = Object.keys(bySection).sort().map(function(section){
    var as = bySection[section];
    var is = itemsBySection[section]||[];
    var rs = refsBySection[section]||[];
    var students = UXQA_unique_(as.map(UXQA_studentKey_).filter(Boolean));
    var scores = as.map(function(a){return UXQA_n_(UXQA_pick_(a,['score','accuracy','verifiedAccuracy']));}).filter(isFinite);
    var durations = as.map(function(a){return UXQA_n_(UXQA_pick_(a,['durationSec','usedTimeSec','time_on_task_sec']));}).filter(function(v){return v>0;});
    var passes = as.filter(function(a){return UXQA_bool_(UXQA_pick_(a,['passed','pass','mastered']));}).length;
    var itemAcc = UXQA_ratio_(is.filter(function(r){return UXQA_bool_(r.is_correct);}).length,is.length);
    var reasonAcc = UXQA_ratio_(is.filter(function(r){return UXQA_bool_(r.reason_correct);}).length,is.length);
    return {
      section:section,
      learners:students.length,
      attempts:as.length,
      meanScore:UXQA_mean_(scores),
      medianScore:UXQA_median_(scores),
      sdScore:UXQA_sd_(scores),
      passRate:UXQA_ratio_(passes,as.length),
      itemAccuracy:itemAcc,
      reasonAccuracy:reasonAcc,
      reasonGap:itemAcc==null||reasonAcc==null?null:itemAcc-reasonAcc,
      medianTimeSec:UXQA_median_(durations),
      reflectionCompletion:UXQA_ratio_(rs.length,as.length),
      reflectionQuality:UXQA_mean_(rs.map(UXQA_reflectionQuality_)),
      ci95:UXQA_ci95_(scores),
      dataCompleteness:UXQA_ratio_(as.filter(function(a){
        return UXQA_studentKey_(a)&&UXQA_s_(UXQA_pick_(a,['mission_id','missionId','mission']))&&isFinite(UXQA_n_(UXQA_pick_(a,['score','accuracy','verifiedAccuracy'])));
      }).length,as.length)
    };
  });
  var comparisons=[];
  for(var i=0;i<rows.length;i++) for(var j=i+1;j<rows.length;j++) {
    var aScores=bySection[rows[i].section].map(function(r){return UXQA_n_(UXQA_pick_(r,['score','accuracy','verifiedAccuracy']));}).filter(isFinite);
    var bScores=bySection[rows[j].section].map(function(r){return UXQA_n_(UXQA_pick_(r,['score','accuracy','verifiedAccuracy']));}).filter(isFinite);
    comparisons.push({
      sectionA:rows[i].section, sectionB:rows[j].section,
      meanDifference:(rows[i].meanScore==null||rows[j].meanScore==null)?null:rows[i].meanScore-rows[j].meanScore,
      hedgesG:UXQA_hedgesG_(aScores,bScores),
      caution:(rows[i].learners<10||rows[j].learners<10)?'SMALL_GROUP':''
    });
  }
  return {sections:rows, pairwise:comparisons};
}

function UXQA_buildResearch_(attempts, items, reflections, events) {
  var byStudent = UXQA_groupBy_(attempts,UXQA_studentKey_);
  var itemByStudent = UXQA_groupBy_(items,UXQA_studentKey_);
  var refByStudent = UXQA_groupBy_(reflections,UXQA_studentKey_);
  var rows=Object.keys(byStudent).filter(Boolean).map(function(k){
    var as=byStudent[k].slice().sort(function(a,b){return UXQA_date_(a)-UXQA_date_(b);});
    var scores=as.map(function(a){return UXQA_n_(UXQA_pick_(a,['score','accuracy','verifiedAccuracy']));}).filter(isFinite);
    var first=scores.length?scores[0]:null;
    var latest=scores.length?scores[scores.length-1]:null;
    var best=scores.length?Math.max.apply(null,scores):null;
    var maxScore=100;
    var rawGain=first==null||latest==null?null:latest-first;
    var normalizedGain=first==null||latest==null||first>=maxScore?null:(latest-first)/(maxScore-first);
    var is=itemByStudent[k]||[];
    var rs=refByStudent[k]||[];
    var latestRow=as[as.length-1]||{};
    return {
      participantKey:UXQA_hash_(k),
      studentId:UXQA_s_(UXQA_pick_(latestRow,['student_id','studentId'])),
      section:UXQA_s_(latestRow.section),
      attempts:as.length,
      firstScore:first,
      latestScore:latest,
      bestScore:best,
      rawGain:rawGain,
      normalizedGain:normalizedGain,
      scoreSlope:UXQA_slope_(scores),
      retryPattern:UXQA_retryPattern_(scores),
      itemAccuracy:UXQA_ratio_(is.filter(function(r){return UXQA_bool_(r.is_correct);}).length,is.length),
      reasonAccuracy:UXQA_ratio_(is.filter(function(r){return UXQA_bool_(r.reason_correct);}).length,is.length),
      reflectionQuality:UXQA_mean_(rs.map(UXQA_reflectionQuality_)),
      timeOnTaskSec:UXQA_sum_(as.map(function(a){return Math.max(0,UXQA_n_(UXQA_pick_(a,['activeDurationSec','durationSec','usedTimeSec'])));})),
      hintRate:UXQA_ratio_(as.filter(function(a){return UXQA_n_(UXQA_pick_(a,['hintUsed','hints','helpUsed']))>0;}).length,as.length)
    };
  });
  var firstScores=rows.map(function(r){return r.firstScore;}).filter(isFinite);
  var latestScores=rows.map(function(r){return r.latestScore;}).filter(isFinite);
  var pairedDz=UXQA_pairedDz_(rows.map(function(r){return r.rawGain;}).filter(isFinite));
  return {
    summary:{
      participants:rows.length,
      meanFirst:UXQA_mean_(firstScores),
      meanLatest:UXQA_mean_(latestScores),
      meanRawGain:UXQA_mean_(rows.map(function(r){return r.rawGain;})),
      meanNormalizedGain:UXQA_mean_(rows.map(function(r){return r.normalizedGain;})),
      pairedEffectDz:pairedDz,
      totalAttempts:attempts.length,
      totalItemResponses:items.length,
      totalEvents:events.length
    },
    participants:rows,
    codebook:UXQA_codebook_()
  };
}

function UXQA_buildDataQuality_(attempts,items,reflections,events){
  function missing(rows,keys){
    var out={}; keys.forEach(function(k){out[k]=rows.filter(function(r){return !UXQA_s_(r[k]);}).length;}); return out;
  }
  return {
    attempts:{rows:attempts.length,missing:missing(attempts,['student_id','section'])},
    items:{rows:items.length,missing:missing(items,['attempt_id','question_id','selected_option','correct_option'])},
    reflections:{rows:reflections.length,missing:missing(reflections,['student_id','mission_id'])},
    events:{rows:events.length},
    warnings:[
      items.length===0?'NO_ITEM_RESPONSES':'',
      reflections.length===0?'NO_REFLECTION_ROWS':''
    ].filter(Boolean)
  };
}

function UXQA_exportDataset(kind,filters){
  filters=filters||{};
  var data=UXQA_getDashboardData(filters);
  var rows=[];
  if(kind==='research_wide') rows=data.research.participants;
  else if(kind==='question_analysis') rows=data.questionAnalytics.questions.map(function(r){var x={};Object.keys(r).forEach(function(k){if(k!=='distractors')x[k]=Array.isArray(r[k])?r[k].join('|'):r[k];});return x;});
  else if(kind==='prediction') rows=data.learningPrediction.learners.map(function(r){var x=JSON.parse(JSON.stringify(r));x.riskReasons=(x.riskReasons||[]).join('|');return x;});
  else if(kind==='section_comparison') rows=data.sectionComparison.sections;
  else if(kind==='item_long') rows=UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ITEMS),filters);
  else if(kind==='attempt_long') rows=UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.ATTEMPTS),filters);
  else if(kind==='reflection_coded') rows=UXQA_filter_(UXQA_readObjects_(UXQA_SHEETS.REFLECTIONS),filters);
  else throw new Error('Unknown export kind: '+kind);
  return {filename:'csai2601_'+kind+'_'+Utilities.formatDate(new Date(),UXQA_TZ,'yyyyMMdd_HHmm')+'.csv',mimeType:'text/csv',content:UXQA_toCsv_(rows)};
}

function UXQA_saveIntervention(row){
  row=row||{};
  var sh=UXQA_ensureSheet_(UXQA_getSpreadsheet_(),UXQA_SHEETS.INTERVENTIONS,UXQA_INTERVENTION_HEADERS);
  var now=UXQA_now_();
  var values=UXQA_INTERVENTION_HEADERS.map(function(h){
    if(h==='created_at'||h==='updated_at') return now;
    if(h==='risk_reasons'&&Array.isArray(row[h])) return row[h].join('|');
    return row[h]==null?'':row[h];
  });
  sh.appendRow(values);
  return {ok:true,createdAt:now};
}

function UXQA_getSpreadsheet_(){
  var id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(id) return SpreadsheetApp.openById(id);
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss) throw new Error('Set SPREADSHEET_ID in Script Properties or bind this project to the data spreadsheet.');
  return ss;
}
function UXQA_ensureSheet_(ss,name,headers){var sh=ss.getSheetByName(name)||ss.insertSheet(name);if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setFrozenRows(1);return sh;}
function UXQA_readObjects_(name){var sh=UXQA_getSpreadsheet_().getSheetByName(name);if(!sh||sh.getLastRow()<2)return[];var v=sh.getDataRange().getValues();var h=v.shift().map(function(x){return UXQA_s_(x);});return v.map(function(r){var o={};h.forEach(function(k,i){o[k]=r[i];});return o;});}
function UXQA_filter_(rows,f){return rows.filter(function(r){if(f.section&&UXQA_s_(r.section)!==UXQA_s_(f.section))return false;if(f.instructor&&UXQA_s_(r.instructor)!==UXQA_s_(f.instructor))return false;var m=UXQA_s_(UXQA_pick_(r,['mission_id','missionId','mission']));if(f.mission&&m!==UXQA_s_(f.mission))return false;var d=UXQA_date_(r);if(f.dateFrom&&d&&d<new Date(f.dateFrom))return false;if(f.dateTo&&d&&d>new Date(f.dateTo+'T23:59:59'))return false;return true;});}
function UXQA_studentKey_(r){return UXQA_s_(UXQA_pick_(r,['participant_id','participantId','student_id','studentId']));}
function UXQA_pick_(o,ks){for(var i=0;i<ks.length;i++)if(o&&o[ks[i]]!==undefined&&o[ks[i]]!=='')return o[ks[i]];return'';}
function UXQA_s_(v){return v==null?'':String(v).trim();}
function UXQA_n_(v){if(v===true)return 1;if(v===false)return 0;var n=Number(String(v==null?'':v).replace('%',''));return isFinite(n)?n:NaN;}
function UXQA_bool_(v){if(v===true||v===1)return true;var s=UXQA_s_(v).toLowerCase();return s==='true'||s==='1'||s==='yes'||s==='passed'||s==='pass';}
function UXQA_ratio_(a,b){return b?Number(a)/Number(b):null;}
function UXQA_mean_(a){a=(a||[]).filter(function(x){return x!=null&&isFinite(x);});return a.length?UXQA_sum_(a)/a.length:null;}
function UXQA_sum_(a){return(a||[]).reduce(function(s,x){return s+(isFinite(x)?Number(x):0);},0);}
function UXQA_median_(a){a=(a||[]).filter(isFinite).sort(function(x,y){return x-y;});if(!a.length)return null;var m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function UXQA_sd_(a){a=(a||[]).filter(isFinite);if(a.length<2)return null;var m=UXQA_mean_(a);return Math.sqrt(a.reduce(function(s,x){return s+Math.pow(x-m,2);},0)/(a.length-1));}
function UXQA_slope_(a){a=(a||[]).filter(isFinite);if(a.length<2)return null;var n=a.length,sx=0,sy=0,sxy=0,sxx=0;for(var i=0;i<n;i++){sx+=i;sy+=a[i];sxy+=i*a[i];sxx+=i*i;}var den=n*sxx-sx*sx;return den?(n*sxy-sx*sy)/den:null;}
function UXQA_unique_(a){var s={},o=[];(a||[]).forEach(function(x){var k=String(x);if(!s[k]){s[k]=1;o.push(x);}});return o;}
function UXQA_groupBy_(a,fn){return(a||[]).reduce(function(o,x){var k=fn(x);(o[k]=o[k]||[]).push(x);return o;},{});}
function UXQA_date_(r){var v=typeof r==='object'?UXQA_pick_(r,['logged_at','submittedAt','submitted_at','timestamp','clientTs','clientTimestamp']):r;if(!v)return null;var d=v instanceof Date?v:new Date(v);return isNaN(d.getTime())?null:d;}
function UXQA_now_(){return Utilities.formatDate(new Date(),UXQA_TZ,"yyyy-MM-dd'T'HH:mm:ssXXX");}
function UXQA_difficultyBand_(p){if(p==null)return'INSUFFICIENT';if(p<.2)return'VERY_HARD';if(p<.4)return'HARD';if(p<.8)return'OPTIMAL';if(p<.9)return'EASY';return'VERY_EASY';}
function UXQA_discriminationBand_(d){if(d==null)return'INSUFFICIENT';if(d<0)return'REVERSE';if(d<.1)return'POOR';if(d<.2)return'REVIEW';if(d<.3)return'ACCEPTABLE';return'STRONG';}
function UXQA_reflectionQuality_(r){var teacher=UXQA_n_(r.quality_teacher),finalQ=UXQA_n_(r.quality_final),auto=UXQA_n_(r.quality_auto);if(isFinite(finalQ))return finalQ;if(isFinite(teacher))return teacher;if(isFinite(auto))return auto;var score=0;if(UXQA_s_(r.problem_seen).length>=15)score++;if(UXQA_s_(r.ux_reason).length>=20)score++;if(UXQA_s_(r.fix_and_test).length>=20)score++;if((UXQA_s_(r.reflection_text).match(/เพราะ|evidence|ทดสอบ|เปลี่ยน|reason/gi)||[]).length>=2)score++;return Math.min(4,score);}
function UXQA_retryPattern_(s){if(!s||!s.length)return'NO_DATA';if(s.length===1&&s[0]>=70)return'ONE_SHOT_MASTERY';if(s.length===1)return'ONE_ATTEMPT_NOT_MASTERED';var sl=UXQA_slope_(s);if(s[s.length-1]>=70&&sl>2)return'PRODUCTIVE_RETRY';if(sl>0)return'SLOW_IMPROVEMENT';if(sl<0)return'DECLINING';return'PLATEAU';}
function UXQA_ci95_(a){a=(a||[]).filter(isFinite);if(a.length<2)return null;var m=UXQA_mean_(a),se=UXQA_sd_(a)/Math.sqrt(a.length),z=1.96;return{low:m-z*se,high:m+z*se};}
function UXQA_hedgesG_(a,b){a=(a||[]).filter(isFinite);b=(b||[]).filter(isFinite);if(a.length<2||b.length<2)return null;var s1=UXQA_sd_(a),s2=UXQA_sd_(b),df=a.length+b.length-2;var sp=Math.sqrt(((a.length-1)*s1*s1+(b.length-1)*s2*s2)/df);if(!sp)return null;var d=(UXQA_mean_(a)-UXQA_mean_(b))/sp;return d*(1-3/(4*df-1));}
function UXQA_pairedDz_(diffs){diffs=(diffs||[]).filter(isFinite);var sd=UXQA_sd_(diffs);return diffs.length>=2&&sd?UXQA_mean_(diffs)/sd:null;}
function UXQA_hash_(s){var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s)+'|UXQ|'+UXQA_VERSION);return bytes.slice(0,12).map(function(b){return('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function UXQA_toCsv_(rows){if(!rows.length)return'';var keys=UXQA_unique_([].concat.apply([],rows.map(function(r){return Object.keys(r);})));function q(v){if(v==null)return'';if(typeof v==='object')v=JSON.stringify(v);v=String(v);return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}return [keys.join(',')].concat(rows.map(function(r){return keys.map(function(k){return q(r[k]);}).join(',');})).join('\r\n');}
function UXQA_codebook_(){return[
 {variable:'participantKey',label:'Pseudonymous participant key',level:'nominal'},
 {variable:'firstScore',label:'First observed score',level:'scale'},
 {variable:'latestScore',label:'Latest observed score',level:'scale'},
 {variable:'bestScore',label:'Best observed score',level:'scale'},
 {variable:'rawGain',label:'Latest minus first score',level:'scale'},
 {variable:'normalizedGain',label:'(latest-first)/(100-first)',level:'scale'},
 {variable:'retryPattern',label:'Retry trajectory category',level:'nominal'},
 {variable:'reflectionQuality',label:'Reflection quality 0-4',level:'ordinal'},
 {variable:'timeOnTaskSec',label:'Accumulated active task time in seconds',level:'scale'}
];}
