/**
 * HeroHealth Assessment Analytics Receiver v3.1
 * Pre-test / Post-test • 90-item parallel bank • Research-ready Google Sheet
 *
 * Deploy as a standalone Google Apps Script Web App:
 * 1. Create/open the destination Google Sheet.
 * 2. Extensions > Apps Script > paste this whole file.
 * 3. Run HHAS_setup() once and authorize.
 * 4. Deploy > New deployment > Web app > Execute as Me > Anyone.
 * 5. Put the /exec URL in HH_CONFIG.assessmentApiUrl.
 */

var HHAS = HHAS || {};
HHAS.VERSION = '20260726-HHAS-V3.1-RESEARCH-ANALYTICS';
HHAS.TZ = 'Asia/Bangkok';
HHAS.SHEETS = {
  attempts: 'Assessment_Attempts',
  responses: 'Assessment_Responses',
  gain: 'Learning_Gain',
  items: 'Item_Analysis',
  domains: 'Domain_Analysis',
  indicators: 'Indicator_Analysis',
  audit: 'Assessment_Audit',
  errors: 'Assessment_Errors'
};

HHAS.HEADERS = {};
HHAS.HEADERS.attempts = [
  'submission_id','submitted_at_utc','submitted_at_th','assessment_version','student_id','student_name','section','group_code',
  'mode','form_code','score','total','percent','selection_seed','order_seed','bank_size','pair_ids','domain_blueprint','difficulty_blueprint',
  'device','user_agent','source_url','receiver_version'
];
HHAS.HEADERS.responses = [
  'submission_id','submitted_at_utc','submitted_at_th','student_id','student_name','section','group_code','mode','form_code',
  'question_order','question_id','pair_id','domain','indicator','difficulty','bloom','selected_display_index','selected_option_index',
  'option_order','correct','item_score','response_time_ms','assessment_version'
];
HHAS.HEADERS.gain = [
  'student_id','student_name','section','group_code','pre_submission_id','post_submission_id','pre_score','post_score','total',
  'pre_percent','post_percent','raw_gain','percentage_point_gain','normalized_gain','gain_category','paired_at_th'
];
HHAS.HEADERS.items = [
  'mode','question_id','pair_id','domain','indicator','difficulty','bloom','n','correct_n','difficulty_index_p','incorrect_n',
  'top27_n','bottom27_n','top27_p','bottom27_p','discrimination_index_d','option_0_n','option_1_n','option_2_n','option_3_n',
  'missing_n','last_rebuilt_th'
];
HHAS.HEADERS.domains = [
  'mode','domain','n_students','n_responses','correct_n','accuracy','mean_item_score','last_rebuilt_th'
];
HHAS.HEADERS.indicators = [
  'mode','domain','indicator','difficulty','bloom','n_students','n_responses','correct_n','accuracy','last_rebuilt_th'
];
HHAS.HEADERS.audit = ['timestamp_th','event','submission_id','student_id','mode','detail','receiver_version'];
HHAS.HEADERS.errors = ['timestamp_th','action','student_id','message','stack','raw_payload'];

function HHAS_setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HHAS.SHEETS).forEach(function(key) {
    HHAS.ensureSheet_(ss, HHAS.SHEETS[key], HHAS.HEADERS[key]);
  });
  HHAS.styleAll_(ss);
  HHAS.rebuildAnalytics_();
  return 'HeroHealth Assessment Analytics setup complete: ' + HHAS.VERSION;
}

function doGet(e) {
  var action = String((e && e.parameter && e.parameter.action) || 'health').toLowerCase();
  if (action === 'rebuild') {
    HHAS.rebuildAnalytics_();
    return HHAS.json_({ok:true, action:'rebuild', version:HHAS.VERSION});
  }
  return HHAS.json_({ok:true, service:'HeroHealth Assessment Analytics', version:HHAS.VERSION, timestamp:new Date().toISOString()});
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var raw = e && e.postData ? e.postData.contents : '';
    var data = raw ? JSON.parse(raw) : {};
    var action = String(data.action || 'assessment_submit').toLowerCase();
    if (action !== 'assessment_submit') throw new Error('Unsupported action: ' + action);
    var result = HHAS.submitAssessment_(data.payload || data);
    return HHAS.json_(result);
  } catch (err) {
    HHAS.logError_('doPost', '', err, e && e.postData ? e.postData.contents : '');
    return HHAS.json_({ok:false, error:String(err && err.message || err), version:HHAS.VERSION});
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

HHAS.submitAssessment_ = function(p) {
  HHAS.validate_(p);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var attempts = HHAS.ensureSheet_(ss, HHAS.SHEETS.attempts, HHAS.HEADERS.attempts);
  var responses = HHAS.ensureSheet_(ss, HHAS.SHEETS.responses, HHAS.HEADERS.responses);
  var submissionId = HHAS.submissionId_(p);

  if (HHAS.findSubmission_(attempts, submissionId)) {
    HHAS.audit_('duplicate_ignored', submissionId, p.studentId, p.mode, 'Duplicate submission ignored');
    return {ok:true, duplicate:true, submissionId:submissionId, version:HHAS.VERSION};
  }

  var now = new Date();
  var submittedUtc = String(p.submittedAt || now.toISOString());
  var submittedTh = Utilities.formatDate(new Date(submittedUtc), HHAS.TZ, 'yyyy-MM-dd HH:mm:ss');
  var meta = p.meta || {};
  var score = Number(p.score || 0);
  var total = Number(p.total || 0);
  var percent = total ? score / total : 0;
  var blueprint = p.blueprint || {};

  attempts.appendRow([
    submissionId, submittedUtc, submittedTh, HHAS.text_(p.assessmentVersion), HHAS.text_(p.studentId), HHAS.text_(p.studentName || meta.studentName),
    HHAS.text_(p.section || meta.section), HHAS.text_(p.groupCode || meta.groupCode), HHAS.text_(p.mode), HHAS.text_(p.form), score, total, percent,
    HHAS.text_(p.seed), HHAS.text_(p.orderSeed), Number(p.bankSize || 0), JSON.stringify(p.pairIds || []),
    JSON.stringify(blueprint.domains || {}), JSON.stringify(blueprint.difficulty || {}), HHAS.text_(meta.device), HHAS.text_(meta.userAgent),
    HHAS.text_(meta.sourceUrl), HHAS.VERSION
  ]);

  var rows = (p.responses || []).map(function(r, index) {
    return [
      submissionId, submittedUtc, submittedTh, HHAS.text_(p.studentId), HHAS.text_(p.studentName || meta.studentName),
      HHAS.text_(p.section || meta.section), HHAS.text_(p.groupCode || meta.groupCode), HHAS.text_(p.mode), HHAS.text_(p.form), index + 1,
      HHAS.text_(r.questionId), HHAS.text_(r.pairId), HHAS.text_(r.domain), HHAS.text_(r.indicator), HHAS.text_(r.difficulty), HHAS.text_(r.bloom),
      HHAS.numberOrBlank_(r.selectedDisplayIndex), HHAS.numberOrBlank_(r.selectedOptionIndex), JSON.stringify(r.optionOrder || []),
      r.correct === true, r.correct === true ? 1 : 0, HHAS.numberOrBlank_(r.responseTimeMs), HHAS.text_(p.assessmentVersion)
    ];
  });
  if (rows.length) responses.getRange(responses.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  HHAS.audit_('assessment_saved', submissionId, p.studentId, p.mode, 'score=' + score + '/' + total + '; responses=' + rows.length);
  HHAS.rebuildAnalytics_();
  SpreadsheetApp.flush();
  return {ok:true, duplicate:false, submissionId:submissionId, score:score, total:total, responseRows:rows.length, version:HHAS.VERSION};
};

HHAS.validate_ = function(p) {
  if (!p || typeof p !== 'object') throw new Error('Payload is required');
  if (!HHAS.text_(p.studentId)) throw new Error('studentId is required');
  if (['pre','post'].indexOf(HHAS.text_(p.mode).toLowerCase()) < 0) throw new Error('mode must be pre or post');
  if (!Array.isArray(p.responses) || !p.responses.length) throw new Error('responses are required');
  if (Number(p.total) !== p.responses.length) throw new Error('total must equal responses.length');
};

HHAS.rebuildAnalytics_ = function() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var attemptsSh = HHAS.ensureSheet_(ss, HHAS.SHEETS.attempts, HHAS.HEADERS.attempts);
  var responsesSh = HHAS.ensureSheet_(ss, HHAS.SHEETS.responses, HHAS.HEADERS.responses);
  var attemptRows = HHAS.objects_(attemptsSh);
  var responseRows = HHAS.objects_(responsesSh);
  HHAS.buildLearningGain_(ss, attemptRows);
  HHAS.buildItemAnalysis_(ss, attemptRows, responseRows);
  HHAS.buildDomainAnalysis_(ss, responseRows);
  HHAS.buildIndicatorAnalysis_(ss, responseRows);
};

HHAS.buildLearningGain_ = function(ss, attempts) {
  var sh = HHAS.ensureSheet_(ss, HHAS.SHEETS.gain, HHAS.HEADERS.gain);
  HHAS.clearData_(sh);
  var byStudent = {};
  attempts.forEach(function(a) {
    var sid = HHAS.text_(a.student_id); if (!sid) return;
    byStudent[sid] = byStudent[sid] || {pre:[],post:[]};
    var mode = HHAS.text_(a.mode).toLowerCase();
    if (mode === 'pre' || mode === 'post') byStudent[sid][mode].push(a);
  });
  var out = [];
  Object.keys(byStudent).sort().forEach(function(sid) {
    var g = byStudent[sid];
    if (!g.pre.length || !g.post.length) return;
    g.pre.sort(HHAS.dateSort_); g.post.sort(HHAS.dateSort_);
    var pre = g.pre[g.pre.length - 1], post = g.post[g.post.length - 1];
    var preScore = Number(pre.score || 0), postScore = Number(post.score || 0), total = Number(post.total || pre.total || 0);
    var prePct = total ? preScore / total : 0, postPct = total ? postScore / total : 0;
    var raw = postScore - preScore, pp = (postPct - prePct) * 100;
    var ng = total > preScore ? raw / (total - preScore) : '';
    var category = ng === '' ? 'ceiling' : ng >= 0.7 ? 'high' : ng >= 0.3 ? 'medium' : ng >= 0 ? 'low' : 'negative';
    out.push([sid, post.student_name || pre.student_name || '', post.section || pre.section || '', post.group_code || pre.group_code || '',
      pre.submission_id, post.submission_id, preScore, postScore, total, prePct, postPct, raw, pp, ng, category,
      Utilities.formatDate(new Date(), HHAS.TZ, 'yyyy-MM-dd HH:mm:ss')]);
  });
  if (out.length) sh.getRange(2,1,out.length,out[0].length).setValues(out);
  HHAS.formatPercent_(sh, [10,11,14]);
};

HHAS.buildItemAnalysis_ = function(ss, attempts, responses) {
  var sh = HHAS.ensureSheet_(ss, HHAS.SHEETS.items, HHAS.HEADERS.items);
  HHAS.clearData_(sh);
  var scoreBySubmission = {};
  attempts.forEach(function(a){ scoreBySubmission[a.submission_id] = Number(a.score || 0); });
  var groups = {};
  responses.forEach(function(r) {
    var key = r.mode + '|' + r.question_id;
    groups[key] = groups[key] || [];
    r._totalScore = scoreBySubmission[r.submission_id] || 0;
    groups[key].push(r);
  });
  var now = Utilities.formatDate(new Date(), HHAS.TZ, 'yyyy-MM-dd HH:mm:ss');
  var out = [];
  Object.keys(groups).sort().forEach(function(key) {
    var rows = groups[key], first = rows[0], n = rows.length;
    var correctN = rows.reduce(function(s,r){return s + Number(r.item_score || 0);},0);
    var sorted = rows.slice().sort(function(a,b){return b._totalScore-a._totalScore;});
    var k = Math.max(1, Math.floor(n * 0.27));
    var top = sorted.slice(0,k), bottom = sorted.slice(Math.max(0,n-k));
    var topP = top.reduce(function(s,r){return s+Number(r.item_score||0);},0)/top.length;
    var bottomP = bottom.reduce(function(s,r){return s+Number(r.item_score||0);},0)/bottom.length;
    var options = [0,0,0,0], missing = 0;
    rows.forEach(function(r){var x=Number(r.selected_option_index); if (x>=0 && x<=3) options[x]++; else missing++;});
    out.push([first.mode,first.question_id,first.pair_id,first.domain,first.indicator,first.difficulty,first.bloom,n,correctN,
      n?correctN/n:0,n-correctN,top.length,bottom.length,topP,bottomP,topP-bottomP,options[0],options[1],options[2],options[3],missing,now]);
  });
  if (out.length) sh.getRange(2,1,out.length,out[0].length).setValues(out);
  HHAS.formatPercent_(sh,[10,14,15,16]);
};

HHAS.buildDomainAnalysis_ = function(ss, responses) {
  var sh = HHAS.ensureSheet_(ss, HHAS.SHEETS.domains, HHAS.HEADERS.domains); HHAS.clearData_(sh);
  var g = {};
  responses.forEach(function(r){var k=r.mode+'|'+r.domain;g[k]=g[k]||{mode:r.mode,domain:r.domain,students:{},n:0,c:0};g[k].students[r.student_id]=1;g[k].n++;g[k].c+=Number(r.item_score||0);});
  var now=Utilities.formatDate(new Date(),HHAS.TZ,'yyyy-MM-dd HH:mm:ss');
  var out=Object.keys(g).sort().map(function(k){var x=g[k];return[x.mode,x.domain,Object.keys(x.students).length,x.n,x.c,x.n?x.c/x.n:0,x.n?x.c/x.n:0,now];});
  if(out.length)sh.getRange(2,1,out.length,out[0].length).setValues(out); HHAS.formatPercent_(sh,[6,7]);
};

HHAS.buildIndicatorAnalysis_ = function(ss, responses) {
  var sh = HHAS.ensureSheet_(ss, HHAS.SHEETS.indicators, HHAS.HEADERS.indicators); HHAS.clearData_(sh);
  var g={};responses.forEach(function(r){var k=[r.mode,r.domain,r.indicator,r.difficulty,r.bloom].join('|');g[k]=g[k]||{r:r,students:{},n:0,c:0};g[k].students[r.student_id]=1;g[k].n++;g[k].c+=Number(r.item_score||0);});
  var now=Utilities.formatDate(new Date(),HHAS.TZ,'yyyy-MM-dd HH:mm:ss');
  var out=Object.keys(g).sort().map(function(k){var x=g[k],r=x.r;return[r.mode,r.domain,r.indicator,r.difficulty,r.bloom,Object.keys(x.students).length,x.n,x.c,x.n?x.c/x.n:0,now];});
  if(out.length)sh.getRange(2,1,out.length,out[0].length).setValues(out); HHAS.formatPercent_(sh,[9]);
};

HHAS.ensureSheet_ = function(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0 || sh.getRange(1,1,1,headers.length).getValues()[0].join('|') !== headers.join('|')) {
    sh.clear(); sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  sh.setFrozenRows(1); sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  return sh;
};
HHAS.objects_ = function(sh) {var v=sh.getDataRange().getValues();if(v.length<2)return[];var h=v[0];return v.slice(1).filter(function(r){return r.join('')!=='';}).map(function(r){var o={};h.forEach(function(k,i){o[k]=r[i];});return o;});};
HHAS.clearData_ = function(sh){if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,sh.getMaxColumns()).clearContent();};
HHAS.styleAll_ = function(ss){Object.keys(HHAS.SHEETS).forEach(function(k){var sh=ss.getSheetByName(HHAS.SHEETS[k]);if(sh){sh.autoResizeColumns(1,Math.min(sh.getLastColumn(),24));sh.setFrozenRows(1);}});};
HHAS.formatPercent_ = function(sh, cols){cols.forEach(function(c){if(sh.getMaxRows()>1)sh.getRange(2,c,sh.getMaxRows()-1,1).setNumberFormat('0.00%');});};
HHAS.findSubmission_ = function(sh,id){if(sh.getLastRow()<2)return false;return !!sh.getRange(2,1,sh.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();};
HHAS.submissionId_ = function(p){var raw=[p.studentId,p.mode,p.form,p.submittedAt,p.seed,p.orderSeed].join('|');var bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw,Utilities.Charset.UTF_8);return bytes.slice(0,12).map(function(b){var x=(b+256)%256;return('0'+x.toString(16)).slice(-2);}).join('');};
HHAS.audit_ = function(event,id,sid,mode,detail){var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=HHAS.ensureSheet_(ss,HHAS.SHEETS.audit,HHAS.HEADERS.audit);sh.appendRow([Utilities.formatDate(new Date(),HHAS.TZ,'yyyy-MM-dd HH:mm:ss'),event,id,HHAS.text_(sid),HHAS.text_(mode),detail,HHAS.VERSION]);};
HHAS.logError_ = function(action,sid,err,raw){try{var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=HHAS.ensureSheet_(ss,HHAS.SHEETS.errors,HHAS.HEADERS.errors);sh.appendRow([Utilities.formatDate(new Date(),HHAS.TZ,'yyyy-MM-dd HH:mm:ss'),action,HHAS.text_(sid),String(err&&err.message||err),String(err&&err.stack||''),String(raw||'').slice(0,45000)]);}catch(_){}};
HHAS.dateSort_ = function(a,b){return new Date(a.submitted_at_utc)-new Date(b.submitted_at_utc);};
HHAS.text_ = function(v){return String(v==null?'':v).trim();};
HHAS.numberOrBlank_ = function(v){return v==null||v===''?'':Number(v);};
HHAS.json_ = function(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);};
