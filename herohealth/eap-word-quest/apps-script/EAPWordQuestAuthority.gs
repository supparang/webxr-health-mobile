/* =========================================================
   EAP Word Quest • Official Roster + Player Resume Authority
   File: EAPWordQuestAuthority.gs
   Version: 20260728-EAPWQ-AUTHORITY-PHASE12-V1

   Install in the SAME Apps Script project as:
   - SharedWebAppRouter.gs
   - EAPWordQuest.gs

   Run EAPWQ_AUTHORITY_setup() once, then populate eap_word_roster.
   Google Sheet is the official authority. Browser storage is cache only.
========================================================= */

const EAPWQA_VERSION = '20260728-EAPWQ-AUTHORITY-PHASE12-V1';
const EAPWQA_GROUP = '122';
const EAPWQA_TZ = 'Asia/Bangkok';
const EAPWQA_ROSTER_SHEET = 'eap_word_roster';
const EAPWQA_ROSTER_CANDIDATES = ['eap_word_roster','EAP_Roster','eap_roster','Student_Roster','students'];
const EAPWQA_FLOW = [
  'S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3',
  'S10','S11','S12','BG4','S13','S14','S15','BG5'
];
const EAPWQA_ROSTER_HEADERS = ['studentId','studentName','section','status','email','updatedAt','note'];

function EAPWQ_AUTHORITY_setup() {
  const ss = eapwqaSpreadsheet_();
  const roster = eapwqaEnsureSheet_(ss, EAPWQA_ROSTER_SHEET, EAPWQA_ROSTER_HEADERS);
  return {
    ok:true,
    version:EAPWQA_VERSION,
    spreadsheetId:ss.getId(),
    rosterSheet:roster.getName(),
    instructions:'Populate studentId, studentName, section=122, status=active, then redeploy the Web App.'
  };
}

function eapWordAuthorityDoGet_(params) {
  const p = params || {};
  const action = eapwqaText_(p.action || p.api).toLowerCase();
  try {
    if (action === 'eap_word_authority_health') return eapwqaHealth_();
    if (action === 'eap_word_roster_setup') return EAPWQ_AUTHORITY_setup();
    if (action === 'eap_word_profile_lookup') return eapwqaProfileLookup_(p);
    if (action === 'eap_word_player_resume') return eapwqaPlayerResume_(p);
    return {ok:false,error:'unknown_authority_action',action:action,version:EAPWQA_VERSION};
  } catch (error) {
    return {ok:false,error:'authority_exception',message:String(error && error.message || error),version:EAPWQA_VERSION};
  }
}

function eapwqaHealth_() {
  const ss = eapwqaSpreadsheet_();
  const roster = eapwqaFindRosterSheet_(ss);
  const count = roster ? Math.max(0, roster.getLastRow() - 1) : 0;
  return {
    ok:true,
    action:'eap_word_authority_health',
    version:EAPWQA_VERSION,
    group:EAPWQA_GROUP,
    rosterSheet:roster ? roster.getName() : '',
    rosterRows:count,
    rosterReady:count > 0,
    generatedAt:eapwqaNow_()
  };
}

function eapwqaProfileLookup_(params) {
  const studentId = eapwqaStudentId_(params.studentId || params.id);
  const section = eapwqaSection_(params.section || params.group);
  if (!studentId) return eapwqaFail_('student_id_required');
  if (section !== EAPWQA_GROUP) return eapwqaFail_('section_not_allowed');

  const ss = eapwqaSpreadsheet_();
  const rosterSheet = eapwqaFindRosterSheet_(ss);
  if (!rosterSheet) {
    return eapwqaFail_('roster_not_ready', {
      setupFunction:'EAPWQ_AUTHORITY_setup',
      expectedSheet:EAPWQA_ROSTER_SHEET
    });
  }

  const rows = eapwqaObjects_(rosterSheet);
  if (!rows.length) return eapwqaFail_('roster_empty', {rosterSheet:rosterSheet.getName()});

  const matched = rows.find(function(row) {
    const id = eapwqaStudentId_(eapwqaPick_(row, ['studentId','student_id','id','รหัสนักศึกษา','รหัส']));
    const sec = eapwqaSection_(eapwqaPick_(row, ['section','group','class','กลุ่ม','หมู่เรียน']));
    return id === studentId && sec === EAPWQA_GROUP;
  });
  if (!matched) return eapwqaFail_('student_not_found', {studentId:studentId,section:EAPWQA_GROUP});

  const status = eapwqaText_(eapwqaPick_(matched, ['status','active','สถานะ']) || 'active').toLowerCase();
  if (['inactive','disabled','withdrawn','drop','0','false'].indexOf(status) >= 0) {
    return eapwqaFail_('student_inactive', {studentId:studentId,section:EAPWQA_GROUP});
  }

  const studentName = eapwqaText_(eapwqaPick_(matched, ['studentName','student_name','name','ชื่อ','ชื่อ-สกุล','ชื่อ นามสกุล']));
  if (!studentName) return eapwqaFail_('student_name_missing', {studentId:studentId});

  return {
    ok:true,
    action:'eap_word_profile_lookup',
    official:true,
    authority:'google_sheet_roster',
    version:EAPWQA_VERSION,
    profile:{
      studentId:studentId,
      studentName:studentName,
      section:EAPWQA_GROUP,
      status:status || 'active',
      rosterSheet:rosterSheet.getName()
    },
    generatedAt:eapwqaNow_()
  };
}

function eapwqaPlayerResume_(params) {
  const lookup = eapwqaProfileLookup_(params);
  if (!lookup.ok) return lookup;

  const studentId = lookup.profile.studentId;
  const ss = eapwqaSpreadsheet_();
  const attempts = eapwqaReadSheetObjects_(ss, 'eap_word_attempts').filter(function(row) {
    return eapwqaStudentId_(eapwqaPick_(row, ['studentId','student_id','id'])) === studentId &&
      eapwqaSection_(eapwqaPick_(row, ['section','group'])) === EAPWQA_GROUP;
  });
  const summaries = eapwqaReadSheetObjects_(ss, 'eap_word_summary').filter(function(row) {
    return eapwqaStudentId_(eapwqaPick_(row, ['studentId','student_id','id'])) === studentId &&
      eapwqaSection_(eapwqaPick_(row, ['section','group'])) === EAPWQA_GROUP;
  });

  const sessions = {};
  EAPWQA_FLOW.forEach(function(sessionId) {
    const aRows = attempts.filter(function(row) {
      return eapwqaSessionId_(eapwqaPick_(row, ['sessionId','session'])) === sessionId;
    });
    const sRows = summaries.filter(function(row) {
      return eapwqaSessionId_(eapwqaPick_(row, ['sessionId','session'])) === sessionId;
    });
    const latestAttempt = eapwqaLatest_(aRows);
    const latestSummary = eapwqaLatest_(sRows);
    const latest = latestAttempt || latestSummary;
    const bestAccuracy = Math.max(0,eapwqaMax_(aRows,['accuracy']),eapwqaMax_(sRows,['bestAccuracy','accuracy']));
    const bestScore = Math.max(0,eapwqaMax_(aRows,['score','xp']),eapwqaMax_(sRows,['bestScore','score']));
    const latestAccuracy = eapwqaNum_(eapwqaPick_(latest || {}, ['accuracy','lastAccuracy','bestAccuracy']),0);
    const latestScore = eapwqaNum_(eapwqaPick_(latest || {}, ['score','lastScore','xp','bestScore']),0);
    const attemptCount = Math.max(aRows.length,eapwqaNum_(eapwqaPick_(latestSummary || {}, ['attempts']),0));
    const threshold = eapwqaThreshold_(sessionId);
    const passed = aRows.concat(sRows).some(function(row) {
      return eapwqaBool_(eapwqaPick_(row, ['passed'])) ||
        eapwqaNum_(eapwqaPick_(row, ['accuracy','bestAccuracy']),0) >= threshold;
    });
    const weakWords = eapwqaTopWords_(aRows.concat(sRows),12);
    const lastPlayed = eapwqaText_(eapwqaPick_(latest || {}, ['playedAt','lastPlayed','serverTs','updatedAt']));
    sessions[sessionId] = {
      sessionId:sessionId,
      played:attemptCount > 0 || Boolean(latest),
      passed:passed,
      attempts:attemptCount,
      bestAccuracy:Math.round(bestAccuracy),
      latestAccuracy:Math.round(latestAccuracy),
      bestScore:Math.round(bestScore),
      latestScore:Math.round(latestScore),
      lastPlayed:lastPlayed || '',
      weakWords:weakWords
    };
  });

  const unlockedSessions = eapwqaUnlocked_(sessions);
  const currentSession = EAPWQA_FLOW.find(function(id) {
    return unlockedSessions.indexOf(id) >= 0 && !sessions[id].passed;
  }) || 'DONE';
  const passedSessions = EAPWQA_FLOW.filter(function(id) { return sessions[id].passed; });

  return {
    ok:true,
    action:'eap_word_player_resume',
    official:true,
    authority:'google_sheet',
    version:EAPWQA_VERSION,
    profile:lookup.profile,
    flow:EAPWQA_FLOW.slice(),
    sessions:sessions,
    unlockedSessions:unlockedSessions,
    passedSessions:passedSessions,
    currentSession:currentSession,
    nextMission:currentSession,
    progressPercent:Math.round((passedSessions.length / EAPWQA_FLOW.length) * 100),
    totalAttempts:attempts.length,
    weakWords:eapwqaAggregateWeak_(sessions,20),
    generatedAt:eapwqaNow_()
  };
}

function eapwqaUnlocked_(sessions) {
  const unlocked = ['S1','S2','S3'];
  const pass = function(id) { return Boolean(sessions[id] && sessions[id].passed); };
  const add = function(ids) { ids.forEach(function(id) { if (unlocked.indexOf(id) < 0) unlocked.push(id); }); };
  if (pass('S1') && pass('S2') && pass('S3')) add(['BG1']);
  if (pass('BG1')) add(['S4','S5','S6']);
  if (pass('S4') && pass('S5') && pass('S6')) add(['BG2']);
  if (pass('BG2')) add(['S7','S8','S9']);
  if (pass('S7') && pass('S8') && pass('S9')) add(['BG3']);
  if (pass('BG3')) add(['S10','S11','S12']);
  if (pass('S10') && pass('S11') && pass('S12')) add(['BG4']);
  if (pass('BG4')) add(['S13','S14','S15']);
  if (pass('S13') && pass('S14') && pass('S15')) add(['BG5']);
  return EAPWQA_FLOW.filter(function(id) { return unlocked.indexOf(id) >= 0; });
}

function eapwqaThreshold_(sessionId) {
  if (sessionId === 'BG5') return 75;
  if (/^BG/.test(sessionId)) return 70;
  return 60;
}

function eapwqaSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = eapwqaText_(props.getProperty('EAPWQ_SPREADSHEET_ID'));
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('EAP Word Quest spreadsheet is unavailable. Run EAPWQ_AUTHORITY_setup() from the target Sheet.');
  if (!id) props.setProperty('EAPWQ_SPREADSHEET_ID', ss.getId());
  return ss;
}

function eapwqaFindRosterSheet_(ss) {
  for (let i = 0; i < EAPWQA_ROSTER_CANDIDATES.length; i += 1) {
    const sh = ss.getSheetByName(EAPWQA_ROSTER_CANDIDATES[i]);
    if (sh) return sh;
  }
  return null;
}

function eapwqaEnsureSheet_(ss,name,headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const width = Math.max(sh.getLastColumn(),1);
    const current = sh.getRange(1,1,1,width).getValues()[0].map(eapwqaText_);
    const next = current.slice();
    headers.forEach(function(header) { if (next.indexOf(header) < 0) next.push(header); });
    if (next.length !== current.length) sh.getRange(1,1,1,next.length).setValues([next]);
  }
  return sh;
}

function eapwqaReadSheetObjects_(ss,name) {
  const sh = ss.getSheetByName(name);
  return sh ? eapwqaObjects_(sh) : [];
}

function eapwqaObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(eapwqaText_);
  return values.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(header,index) { if (header) obj[header] = row[index]; });
    return obj;
  }).filter(function(row) {
    return Object.keys(row).some(function(key) { return eapwqaText_(row[key]); });
  });
}

function eapwqaPick_(row,keys) {
  const source = row || {};
  const lookup = {};
  Object.keys(source).forEach(function(key) { lookup[eapwqaKey_(key)] = source[key]; });
  for (let i = 0; i < keys.length; i += 1) {
    const value = lookup[eapwqaKey_(keys[i])];
    if (value !== undefined && value !== null && eapwqaText_(value) !== '') return value;
  }
  return '';
}

function eapwqaKey_(value) { return eapwqaText_(value).toLowerCase().replace(/[\s_\-]+/g,''); }
function eapwqaStudentId_(value) { return eapwqaText_(value).replace(/\.0$/,'').replace(/\s+/g,''); }
function eapwqaSection_(value) {
  const raw = eapwqaText_(value || EAPWQA_GROUP).toUpperCase();
  return raw.replace(/^SECTION\s*/i,'').replace(/^SEC\s*/i,'') || EAPWQA_GROUP;
}
function eapwqaSessionId_(value) {
  const raw = eapwqaText_(value).toUpperCase();
  if (/^B[1-5]$/.test(raw)) return 'BG' + raw.slice(1);
  if (/^BOSS\s*GATE\s*[1-5]$/.test(raw)) return 'BG' + raw.match(/[1-5]/)[0];
  return raw;
}
function eapwqaLatest_(rows) {
  return (rows || []).slice().sort(function(a,b) { return eapwqaTime_(b) - eapwqaTime_(a); })[0] || null;
}
function eapwqaTime_(row) {
  const value = eapwqaPick_(row || {}, ['playedAt','lastPlayed','serverTs','updatedAt']);
  const time = new Date(value || 0).getTime();
  return isFinite(time) ? time : 0;
}
function eapwqaMax_(rows,keys) {
  return (rows || []).reduce(function(max,row) { return Math.max(max,eapwqaNum_(eapwqaPick_(row,keys),0)); },0);
}
function eapwqaTopWords_(rows,limit) {
  const counts = {};
  (rows || []).forEach(function(row) {
    const value = eapwqaPick_(row, ['weakWords','weakWordsJson','weak_words','weak']);
    eapwqaArray_(value).forEach(function(word) {
      const label = eapwqaText_(word);
      const key = label.toLowerCase();
      if (!key) return;
      if (!counts[key]) counts[key] = {word:label,count:0};
      counts[key].count += 1;
    });
  });
  return Object.keys(counts).map(function(key) { return counts[key]; })
    .sort(function(a,b) { return b.count - a.count || a.word.localeCompare(b.word); })
    .slice(0,limit || 10).map(function(item) { return item.word; });
}
function eapwqaAggregateWeak_(sessions,limit) {
  const counts = {};
  Object.keys(sessions || {}).forEach(function(id) {
    (sessions[id].weakWords || []).forEach(function(word) {
      const key = eapwqaText_(word).toLowerCase();
      if (!key) return;
      counts[key] = counts[key] || {word:eapwqaText_(word),count:0};
      counts[key].count += 1;
    });
  });
  return Object.keys(counts).map(function(key) { return counts[key]; })
    .sort(function(a,b) { return b.count - a.count || a.word.localeCompare(b.word); })
    .slice(0,limit || 20).map(function(item) { return item.word; });
}
function eapwqaArray_(value) {
  if (Array.isArray(value)) return value.map(eapwqaText_).filter(Boolean);
  const text = eapwqaText_(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(eapwqaText_).filter(Boolean);
  } catch (ignore) {}
  return text.split(/[|,;]/).map(eapwqaText_).filter(Boolean);
}
function eapwqaFail_(error,extra) {
  const out = {ok:false,official:false,error:error,version:EAPWQA_VERSION,generatedAt:eapwqaNow_()};
  Object.keys(extra || {}).forEach(function(key) { out[key] = extra[key]; });
  return out;
}
function eapwqaBool_(value) { return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1'; }
function eapwqaNum_(value,fallback) {
  const num = Number(value);
  return isFinite(num) ? num : (fallback == null ? 0 : fallback);
}
function eapwqaText_(value) { return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
function eapwqaNow_() { return Utilities.formatDate(new Date(),EAPWQA_TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"); }
