/**
 * CSAI2102 AI Quest Integrated Flow Receiver v1.3.1
 * Profile -> Mission -> Coding -> Reflection -> Session completion
 * Google Sheet is the sole authority. No doGet(e) / doPost(e).
 *
 * Reflection policy:
 * - each answer must contain at least 20 characters
 * - the three answers must be distinct
 * - curriculum relevance is scored and stored for Teacher Review
 * - a low keyword match never blocks a valid Thai-language answer
 */
var AIQFLOW = AIQFLOW || {};

AIQFLOW.VERSION = '20260728-AIQ-FLOW-V1.3.1-THAI-SAFE-REFLECTION-AUDIT';
AIQFLOW.SECTION = '101';
AIQFLOW.REFLECTION_SHEET = 'aiquest_reflections';
AIQFLOW.COMPLETION_SHEET = 'aiquest_session_completion';
AIQFLOW.ORDER = [
  'S1','S2','S3','B1',
  'S4','S5','S6','B2',
  'S7','S8','S9','B3',
  'S10','S11','S12','B4',
  'S13','S14','S15','B5'
];

AIQFLOW.REFLECTION_HEADERS = [
  'submitted_at','student_id','student_name','section','session_id',
  'reflection_prompt_1','reflection_1',
  'reflection_prompt_2','reflection_2',
  'reflection_prompt_3','reflection_3',
  'quality_score','quality_status','quality_json',
  'content_version','request_id','passed','version'
];

AIQFLOW.COMPLETION_HEADERS = [
  'updated_at','student_id','student_name','section','session_id',
  'mission_completed','mission_score',
  'coding_completed','coding_score',
  'reflection_completed','reflection_quality_score','reflection_quality_status',
  'session_completed','next_session','content_version','version'
];

AIQFLOW.REFLECTION_TERMS = {
  S1:['ai','automation','rule','threshold','model','ข้อมูล','ระบบอัตโนมัติ','ปัญญาประดิษฐ์','เกณฑ์'],
  S2:['peas','agent','sensor','actuator','environment','state','goal','utility','ตัวแทน','เซนเซอร์','สภาพแวดล้อม','เป้าหมาย'],
  S3:['state','goal','action','frontier','bfs','dfs','visited','path','สถานะ','เป้าหมาย','เส้นทาง','คิว','สแตก'],
  B1:['ai','peas','agent','bfs','dfs','search','fallback','ตัวแทน','การค้นหา','ทางเลือกปลอดภัย'],
  S4:['ucs','cost','priority','frontier','g(n)','path','optimal','ต้นทุน','คิวลำดับความสำคัญ','เส้นทาง'],
  S5:['heuristic','astar','a*','g(n)','h(n)','f(n)','admissible','consistent','ค่าประมาณ','เหมาะสม','สอดคล้อง'],
  S6:['minimax','max','min','alpha','beta','utility','evaluation','คู่แข่ง','ประเมิน','ตัดกิ่ง'],
  B2:['ucs','a*','minimax','cost','heuristic','opponent','trade','ต้นทุน','คู่แข่ง','กลยุทธ์'],
  S7:['fact','rule','relation','knowledge','forward','backward','conflict','ข้อเท็จจริง','กฎ','ความรู้','ความขัดแย้ง'],
  S8:['prior','likelihood','evidence','posterior','bayes','probability','uncertainty','ความน่าจะเป็น','หลักฐาน','ความไม่แน่นอน'],
  S9:['logic','rule','inference','expert','explanation','conflict','referral','ตรรกะ','กฎ','อนุมาน','คำอธิบาย','ผู้เชี่ยวชาญ'],
  B3:['knowledge','logic','bayes','confidence','evidence','explanation','uncertainty','ความรู้','ตรรกะ','ความมั่นใจ','หลักฐาน'],
  S10:['feature','label','train','validation','test','leakage','seed','ข้อมูลฝึก','ข้อมูลทดสอบ','ข้อมูลรั่ว','ทำซ้ำ'],
  S11:['classification','regression','threshold','precision','recall','false','metric','จำแนก','ถดถอย','ตัวชี้วัด','ผลบวกเท็จ','ผลลบเท็จ'],
  S12:['cluster','kmeans','k-means','centroid','pca','outlier','silhouette','จัดกลุ่ม','จุดศูนย์กลาง','ค่าผิดปกติ','ลดมิติ'],
  B4:['pipeline','metric','overfitting','underfitting','leakage','deploy','monitor','กระบวนการ','ตัวชี้วัด','เรียนเกิน','นำไปใช้','ติดตาม'],
  S13:['weight','bias','activation','loss','gradient','backprop','cnn','rnn','transformer','น้ำหนัก','ความเอนเอียง','ฟังก์ชันกระตุ้น','ความสูญเสีย'],
  S14:['mdp','state','action','reward','policy','q-learning','gamma','epsilon','reward hacking','รางวัล','นโยบาย','การสำรวจ','การใช้ประโยชน์'],
  S15:['llm','rag','retrieval','context','generation','citation','grounding','hallucination','fallback','ค้นคืน','บริบท','อ้างอิง','หลอน','หลักฐาน'],
  B5:['fairness','privacy','explanation','safety','human','audit','monitoring','appeal','accountability','ความเป็นธรรม','ความเป็นส่วนตัว','ความปลอดภัย','ตรวจสอบ','อุทธรณ์','รับผิดชอบ']
};

AIQFLOW.text_ = function(v) {
  return String(v == null ? '' : v).trim();
};

AIQFLOW.norm_ = function(v) {
  return AIQFLOW.text_(v)
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙*+]+/g, '');
};

AIQFLOW.idKey_ = function(v) {
  var s = AIQFLOW.text_(v);
  if (/^\d+(?:\.0+)?$/.test(s)) return String(parseInt(s, 10));
  return s.toLowerCase();
};

AIQFLOW.sectionKey_ = function(v) {
  return AIQFLOW.idKey_(v);
};

AIQFLOW.sessionKey_ = function(v) {
  var s = AIQFLOW.text_(v)
    .toUpperCase()
    .replace(/[\s_:\-]+/g, '');

  var m = s.match(/^(?:SESSION|MISSION|M)?(S?(?:1[0-5]|[1-9])|B[1-5])$/);
  if (!m) return '';

  var x = m[1];
  if (/^\d+$/.test(x)) x = 'S' + x;
  return x;
};

AIQFLOW.bool_ = function(v) {
  var s = AIQFLOW.text_(v).toLowerCase();
  return v === true || [
    'true','1','yes','passed','pass','completed','mastered',
    'submitted','win','won'
  ].indexOf(s) >= 0;
};

AIQFLOW.num_ = function(v) {
  var s = AIQFLOW.text_(v)
    .replace(/,/g, '')
    .replace(/%$/, '');
  if (!s) return 0;
  var n = Number(s);
  return isFinite(n) ? n : 0;
};

AIQFLOW.now_ = function() {
  return Utilities.formatDate(
    new Date(),
    'Asia/Bangkok',
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  );
};

AIQFLOW.ss_ = function() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('SPREADSHEET_NOT_FOUND');
  return ss;
};

AIQFLOW.headerIndex_ = function(headers, names) {
  for (var i = 0; i < names.length; i++) {
    var target = AIQFLOW.norm_(names[i]);
    for (var j = 0; j < headers.length; j++) {
      if (AIQFLOW.norm_(headers[j]) === target) return j;
    }
  }
  return -1;
};

AIQFLOW.rows_ = function(sheet) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return {headers: [], rows: []};
  }

  var values = sheet
    .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
    .getDisplayValues();

  return {
    headers: values[0],
    rows: values.slice(1)
  };
};

AIQFLOW.ensureSheet_ = function(name, headers) {
  var ss = AIQFLOW.ss_();
  var sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }

  var lastCol = Math.max(1, sh.getLastColumn());
  var existing = sh
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(AIQFLOW.text_);

  var known = {};
  existing.forEach(function(h) {
    if (h) known[AIQFLOW.norm_(h)] = true;
  });

  var missing = headers.filter(function(h) {
    return !known[AIQFLOW.norm_(h)];
  });

  if (missing.length) {
    sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }

  sh.setFrozenRows(1);
  return sh;
};

AIQFLOW.objectRowForHeaders_ = function(actualHeaders, obj) {
  var lookup = {};

  Object.keys(obj || {}).forEach(function(key) {
    lookup[AIQFLOW.norm_(key)] = obj[key];
  });

  return actualHeaders.map(function(header) {
    var value = lookup[AIQFLOW.norm_(header)];
    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value == null ? '' : value;
  });
};

AIQFLOW.appendObject_ = function(name, headers, obj) {
  var sh = AIQFLOW.ensureSheet_(name, headers);
  var actualHeaders = sh
    .getRange(1, 1, 1, Math.max(1, sh.getLastColumn()))
    .getDisplayValues()[0];

  sh.appendRow(AIQFLOW.objectRowForHeaders_(actualHeaders, obj));
};

AIQFLOW.sheetCandidates_ = function(names) {
  var ss = AIQFLOW.ss_();
  var out = [];

  (names || []).forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh) out.push(sh);
  });

  return out;
};

AIQFLOW.sameIdentity_ = function(row, headers, studentId, section, sessionId) {
  var iId = AIQFLOW.headerIndex_(headers, [
    'student_id','studentId','id','student_no','studentNo'
  ]);
  var iSection = AIQFLOW.headerIndex_(headers, [
    'section','class_section','classSection'
  ]);
  var iSession = AIQFLOW.headerIndex_(headers, [
    'session_id','sessionId','mission_id','missionId','session','mission'
  ]);

  if (iId < 0 || iSession < 0) return false;

  return AIQFLOW.idKey_(row[iId]) === AIQFLOW.idKey_(studentId) &&
    (iSection < 0 ||
      AIQFLOW.sectionKey_(row[iSection]) === AIQFLOW.sectionKey_(section)) &&
    AIQFLOW.sessionKey_(row[iSession]) === AIQFLOW.sessionKey_(sessionId);
};

AIQFLOW.requestExists_ = function(requestId) {
  requestId = AIQFLOW.text_(requestId);
  if (!requestId) return false;

  var sh = AIQFLOW.ss_().getSheetByName(AIQFLOW.REFLECTION_SHEET);
  if (!sh || sh.getLastRow() < 2) return false;

  var headers = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0];
  var index = AIQFLOW.headerIndex_(headers, ['request_id','requestId']);
  if (index < 0) return false;

  var finder = sh
    .getRange(2, index + 1, sh.getLastRow() - 1, 1)
    .createTextFinder(requestId)
    .matchEntireCell(true);

  return !!finder.findNext();
};

AIQFLOW.findProfile_ = function(studentId, section) {
  var names = [
    'students_profile','student_profiles','students-profile',
    'profiles','student_profile'
  ];

  for (var n = 0; n < names.length; n++) {
    var sh = AIQFLOW.ss_().getSheetByName(names[n]);
    if (!sh) continue;

    var data = AIQFLOW.rows_(sh);
    var headers = data.headers;
    var iId = AIQFLOW.headerIndex_(headers, ['student_id','studentId','id']);
    var iSection = AIQFLOW.headerIndex_(headers, ['section','class_section']);
    var iName = AIQFLOW.headerIndex_(headers, [
      'student_name','studentName','name','full_name'
    ]);

    if (iId < 0) continue;

    for (var r = data.rows.length - 1; r >= 0; r--) {
      var row = data.rows[r];
      var idMatch = AIQFLOW.idKey_(row[iId]) === AIQFLOW.idKey_(studentId);
      var sectionMatch = iSection < 0 ||
        AIQFLOW.sectionKey_(row[iSection]) === AIQFLOW.sectionKey_(section);

      if (idMatch && sectionMatch) {
        return {
          studentId: studentId,
          studentName: iName >= 0 ? AIQFLOW.text_(row[iName]) : '',
          section: section,
          sourceSheet: names[n]
        };
      }
    }
  }

  return null;
};

AIQFLOW.lookupProfile_ = function(payload) {
  var studentId = AIQFLOW.text_(payload.studentId);
  var section = AIQFLOW.text_(payload.section || AIQFLOW.SECTION);

  if (!studentId) {
    return {
      ok: false,
      code: 'MISSING_STUDENT_ID',
      version: AIQFLOW.VERSION
    };
  }

  var profile = AIQFLOW.findProfile_(studentId, section);

  return {
    ok: true,
    found: !!profile,
    profile: profile,
    version: AIQFLOW.VERSION
  };
};

AIQFLOW.codingStatus_ = function(studentId, section, sessionId) {
  var sheets = AIQFLOW.sheetCandidates_([
    'coding_attempts','aiquest_coding_attempts',
    'AIQuest_Coding_Attempts','coding_attempt','Coding_Attempts'
  ]);

  var best = 0;
  var count = 0;
  var completed = false;
  var sources = [];
  var matched = [];

  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var data = AIQFLOW.rows_(sh);
    var headers = data.headers;
    var iScore = AIQFLOW.headerIndex_(headers, [
      'coding_score','codingScore','score','total_score','totalScore'
    ]);
    var iDone = AIQFLOW.headerIndex_(headers, [
      'completed','passed','coding_completed','codingCompleted','status'
    ]);
    var before = count;

    for (var r = 0; r < data.rows.length; r++) {
      var row = data.rows[r];
      if (!AIQFLOW.sameIdentity_(
        row, headers, studentId, section, sessionId
      )) continue;

      count++;
      var score = iScore >= 0 ? AIQFLOW.num_(row[iScore]) : 0;
      var done = iDone >= 0 ? AIQFLOW.bool_(row[iDone]) : false;

      best = Math.max(best, score);
      if (score >= 60 || done) completed = true;

      matched.push({
        sheet: sh.getName(),
        row: r + 2,
        score: score,
        done: done
      });
    }

    if (count > before) sources.push(sh.getName());
  }

  return {
    found: count > 0,
    completed: completed || best >= 60,
    bestScore: best,
    attemptCount: count,
    sourceSheets: sources,
    matched: matched.slice(-5)
  };
};

AIQFLOW.missionPass_ = function(sessionId, score, done, bossWin) {
  var id = AIQFLOW.sessionKey_(sessionId);

  if (done) return true;
  if (!/^B[1-5]$/.test(id)) return score >= 60;
  if (id === 'B4') return bossWin && score >= 70;
  if (id === 'B5') return bossWin && score >= 75;
  return bossWin;
};

AIQFLOW.missionStatus_ = function(studentId, section, sessionId) {
  var sheets = AIQFLOW.sheetCandidates_([
    'session_attempts','aiquest_session_attempts',
    'mission_attempts','attempts'
  ]);

  var best = 0;
  var found = false;
  var passed = false;
  var source = '';
  var matched = [];

  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var data = AIQFLOW.rows_(sh);
    var headers = data.headers;
    var iScore = AIQFLOW.headerIndex_(headers, [
      'score','best_score','bestScore','accuracy','percent','percentage'
    ]);
    var iPassed = AIQFLOW.headerIndex_(headers, [
      'passed','mastered','mission_completed','missionCompleted',
      'gate_status','status','completed'
    ]);
    var iBoss = AIQFLOW.headerIndex_(headers, [
      'bossWin','boss_win','bossWon','boss_won'
    ]);

    for (var r = 0; r < data.rows.length; r++) {
      var row = data.rows[r];
      if (!AIQFLOW.sameIdentity_(
        row, headers, studentId, section, sessionId
      )) continue;

      found = true;
      source = sh.getName();

      var score = iScore >= 0 ? AIQFLOW.num_(row[iScore]) : 0;
      var done = iPassed >= 0 ? AIQFLOW.bool_(row[iPassed]) : false;
      var bossWin = iBoss >= 0 ? AIQFLOW.bool_(row[iBoss]) : false;

      best = Math.max(best, score);
      if (AIQFLOW.missionPass_(sessionId, score, done, bossWin)) {
        passed = true;
      }

      matched.push({
        sheet: sh.getName(),
        row: r + 2,
        score: score,
        done: done,
        bossWin: bossWin
      });
    }
  }

  return {
    found: found,
    completed: passed,
    bestScore: best,
    sourceSheet: source,
    matched: matched.slice(-5)
  };
};

AIQFLOW.reflectionStatus_ = function(studentId, section, sessionId) {
  var sheets = AIQFLOW.sheetCandidates_([
    AIQFLOW.REFLECTION_SHEET,'reflections','aiquest_reflection'
  ]);

  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var data = AIQFLOW.rows_(sh);
    var headers = data.headers;
    var iPassed = AIQFLOW.headerIndex_(headers, [
      'passed','completed','reflection_completed',
      'reflectionCompleted','status'
    ]);
    var iQuality = AIQFLOW.headerIndex_(headers, [
      'quality_score','qualityScore'
    ]);
    var iQualityStatus = AIQFLOW.headerIndex_(headers, [
      'quality_status','qualityStatus'
    ]);

    for (var r = data.rows.length - 1; r >= 0; r--) {
      var row = data.rows[r];
      if (!AIQFLOW.sameIdentity_(
        row, headers, studentId, section, sessionId
      )) continue;

      return {
        found: true,
        completed: iPassed < 0 ? true : AIQFLOW.bool_(row[iPassed]),
        qualityScore: iQuality >= 0 ? AIQFLOW.num_(row[iQuality]) : null,
        qualityStatus: iQualityStatus >= 0 ? AIQFLOW.text_(row[iQualityStatus]) : '',
        sourceSheet: sh.getName(),
        row: r + 2
      };
    }
  }

  return {
    found: false,
    completed: false,
    qualityScore: null,
    qualityStatus: ''
  };
};

AIQFLOW.reflectionQuality_ = function(sessionId, answers) {
  var terms = AIQFLOW.REFLECTION_TERMS[sessionId] || [];
  var combined = AIQFLOW.norm_(answers.join(' '));
  var matched = terms.filter(function(term) {
    return combined.indexOf(AIQFLOW.norm_(term)) >= 0;
  });

  var normalized = answers.map(AIQFLOW.norm_);
  var unique = {};
  normalized.forEach(function(answer) {
    if (answer) unique[answer] = true;
  });

  var distinctCount = Object.keys(unique).length;
  var allLongEnough = answers.every(function(answer) {
    return answer.length >= 20;
  });

  var lengthScore = answers.reduce(function(sum, answer) {
    return sum + Math.min(15, Math.floor(answer.length / 5));
  }, 0);
  var relevanceScore = terms.length
    ? Math.min(35, Math.round(matched.length / Math.min(5, terms.length) * 35))
    : 20;
  var distinctScore = distinctCount === 3 ? 20 : distinctCount === 2 ? 10 : 0;
  var score = Math.min(100, lengthScore + relevanceScore + distinctScore);
  var relevant = matched.length >= 1;
  var structurallyPassed = allLongEnough && distinctCount === 3;

  return {
    score: score,
    passed: structurallyPassed,
    structurallyPassed: structurallyPassed,
    relevant: relevant,
    distinct: distinctCount === 3,
    qualityStatus: relevant ? 'passed' : 'needs-review',
    matchedTerms: matched,
    expectedTerms: terms,
    answerLengths: answers.map(function(answer) {
      return answer.length;
    })
  };
};

AIQFLOW.upsertCompletion_ = function(obj) {
  var sh = AIQFLOW.ensureSheet_(
    AIQFLOW.COMPLETION_SHEET,
    AIQFLOW.COMPLETION_HEADERS
  );
  var actualHeaders = sh
    .getRange(1, 1, 1, Math.max(1, sh.getLastColumn()))
    .getDisplayValues()[0];

  var data = AIQFLOW.rows_(sh);
  var rowNumber = -1;

  for (var r = data.rows.length - 1; r >= 0; r--) {
    if (AIQFLOW.sameIdentity_(
      data.rows[r],
      data.headers,
      obj.student_id,
      obj.section,
      obj.session_id
    )) {
      rowNumber = r + 2;
      break;
    }
  }

  var row = AIQFLOW.objectRowForHeaders_(actualHeaders, obj);

  if (rowNumber > 0) {
    sh.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
};

AIQFLOW.submitReflection_ = function(payload) {
  payload = payload || {};

  var studentId = AIQFLOW.text_(payload.studentId);
  var studentName = AIQFLOW.text_(payload.studentName);
  var section = AIQFLOW.text_(payload.section || AIQFLOW.SECTION);
  var sessionId = AIQFLOW.sessionKey_(payload.sessionId);
  var answers = [
    AIQFLOW.text_(payload.reflection1),
    AIQFLOW.text_(payload.reflection2),
    AIQFLOW.text_(payload.reflection3)
  ];
  var prompts = [
    AIQFLOW.text_(payload.reflectionPrompt1),
    AIQFLOW.text_(payload.reflectionPrompt2),
    AIQFLOW.text_(payload.reflectionPrompt3)
  ];
  var contentVersion = AIQFLOW.text_(
    payload.contentVersion || 'unknown-client'
  );
  var requestId = AIQFLOW.text_(
    payload.requestId || Utilities.getUuid()
  );

  if (!studentId || !sessionId || AIQFLOW.ORDER.indexOf(sessionId) < 0) {
    return {
      ok: false,
      code: 'MISSING_OR_INVALID_IDENTITY',
      version: AIQFLOW.VERSION
    };
  }

  if (answers.some(function(answer) { return answer.length < 20; })) {
    return {
      ok: false,
      code: 'REFLECTION_TOO_SHORT',
      message: 'แต่ละคำตอบต้องมีอย่างน้อย 20 ตัวอักษร',
      version: AIQFLOW.VERSION
    };
  }

  var quality = AIQFLOW.reflectionQuality_(sessionId, answers);

  if (!quality.distinct) {
    return {
      ok: false,
      code: 'REFLECTION_DUPLICATE_ANSWERS',
      message: 'คำตอบทั้ง 3 ข้อต้องอธิบายคนละประเด็น ไม่ควรคัดลอกข้อความเดียวกัน',
      quality: quality,
      version: AIQFLOW.VERSION
    };
  }

  var coding = AIQFLOW.codingStatus_(studentId, section, sessionId);
  if (!coding.completed) {
    return {
      ok: false,
      code: 'CODING_NOT_COMPLETED',
      coding: coding,
      version: AIQFLOW.VERSION
    };
  }

  var mission = AIQFLOW.missionStatus_(studentId, section, sessionId);
  if (!mission.completed) {
    return {
      ok: false,
      code: 'MISSION_NOT_COMPLETED',
      mission: mission,
      version: AIQFLOW.VERSION
    };
  }

  if (AIQFLOW.requestExists_(requestId)) {
    var existing = AIQFLOW.reflectionStatus_(
      studentId,
      section,
      sessionId
    );

    return {
      ok: true,
      duplicate: true,
      completed: !!existing.completed,
      sessionId: sessionId,
      reflectionQuality: quality,
      version: AIQFLOW.VERSION
    };
  }

  var now = AIQFLOW.now_();
  var qualityStatus = quality.relevant ? 'passed' : 'needs-review';

  AIQFLOW.appendObject_(
    AIQFLOW.REFLECTION_SHEET,
    AIQFLOW.REFLECTION_HEADERS,
    {
      submitted_at: now,
      student_id: studentId,
      student_name: studentName,
      section: section,
      session_id: sessionId,
      reflection_prompt_1: prompts[0],
      reflection_1: answers[0],
      reflection_prompt_2: prompts[1],
      reflection_2: answers[1],
      reflection_prompt_3: prompts[2],
      reflection_3: answers[2],
      quality_score: quality.score,
      quality_status: qualityStatus,
      quality_json: quality,
      content_version: contentVersion,
      request_id: requestId,
      passed: true,
      version: AIQFLOW.VERSION
    }
  );

  var index = AIQFLOW.ORDER.indexOf(sessionId);
  var next = index >= 0 && index < AIQFLOW.ORDER.length - 1
    ? AIQFLOW.ORDER[index + 1]
    : '';

  AIQFLOW.upsertCompletion_({
    updated_at: now,
    student_id: studentId,
    student_name: studentName,
    section: section,
    session_id: sessionId,
    mission_completed: true,
    mission_score: mission.bestScore || 0,
    coding_completed: true,
    coding_score: coding.bestScore || 0,
    reflection_completed: true,
    reflection_quality_score: quality.score,
    reflection_quality_status: qualityStatus,
    session_completed: true,
    next_session: next,
    content_version: contentVersion,
    version: AIQFLOW.VERSION
  });

  return {
    ok: true,
    duplicate: false,
    completed: true,
    sessionId: sessionId,
    nextSession: next,
    codingScore: coding.bestScore || 0,
    missionScore: mission.bestScore || 0,
    reflectionQuality: quality,
    reflectionQualityStatus: qualityStatus,
    teacherReviewRecommended: qualityStatus === 'needs-review',
    version: AIQFLOW.VERSION
  };
};

AIQFLOW.getSessionStatus_ = function(payload) {
  payload = payload || {};

  var studentId = AIQFLOW.text_(payload.studentId);
  var section = AIQFLOW.text_(payload.section || AIQFLOW.SECTION);
  var sessionId = AIQFLOW.sessionKey_(payload.sessionId);

  if (!studentId || !sessionId) {
    return {
      ok: false,
      code: 'MISSING_STATUS_IDENTITY',
      version: AIQFLOW.VERSION
    };
  }

  var mission = AIQFLOW.missionStatus_(studentId, section, sessionId);
  var coding = AIQFLOW.codingStatus_(studentId, section, sessionId);
  var reflection = AIQFLOW.reflectionStatus_(
    studentId,
    section,
    sessionId
  );

  return {
    ok: true,
    studentId: studentId,
    section: section,
    sessionId: sessionId,
    mission: mission,
    coding: coding,
    reflection: reflection,
    completed: !!(
      mission.completed && coding.completed && reflection.completed
    ),
    version: AIQFLOW.VERSION
  };
};

AIQFLOW.getProgress_ = function(payload) {
  payload = payload || {};

  var studentId = AIQFLOW.text_(payload.studentId);
  var section = AIQFLOW.text_(payload.section || AIQFLOW.SECTION);
  var progress = {};

  if (!studentId) {
    return {
      ok: false,
      code: 'MISSING_STUDENT_ID',
      version: AIQFLOW.VERSION
    };
  }

  AIQFLOW.ORDER.forEach(function(sessionId, index) {
    var mission = AIQFLOW.missionStatus_(studentId, section, sessionId);
    var coding = AIQFLOW.codingStatus_(studentId, section, sessionId);
    var reflection = AIQFLOW.reflectionStatus_(
      studentId,
      section,
      sessionId
    );
    var completed = !!(
      mission.completed && coding.completed && reflection.completed
    );

    progress[sessionId.toLowerCase()] = {
      sessionId: sessionId,
      mission: mission,
      coding: coding,
      reflection: reflection,
      missionPassed: !!mission.completed,
      missionScore: mission.found ? Number(mission.bestScore || 0) : null,
      codingPassed: !!coding.completed,
      codingScore: coding.found ? Number(coding.bestScore || 0) : null,
      reflectionSubmitted: !!reflection.completed,
      reflectionQualityScore: reflection.qualityScore,
      reflectionQualityStatus: reflection.qualityStatus,
      completed: completed,
      unlocked: index === 0
    };
  });

  for (var i = 1; i < AIQFLOW.ORDER.length; i++) {
    var current = AIQFLOW.ORDER[i].toLowerCase();
    var previous = AIQFLOW.ORDER[i - 1].toLowerCase();
    progress[current].unlocked = !!progress[previous].completed;
  }

  var found = AIQFLOW.ORDER.some(function(id) {
    var row = progress[id.toLowerCase()];
    return row.mission.found || row.coding.found || row.reflection.found;
  });

  return {
    ok: true,
    found: found,
    studentId: studentId,
    section: section,
    progress: progress,
    source: 'strict-live-three-part-thai-safe-reflection-audit',
    version: AIQFLOW.VERSION
  };
};

AIQFLOW.handle = function(payload) {
  payload = payload || {};
  var action = AIQFLOW.text_(payload.action).toUpperCase();

  if (action === 'LOOKUP_PROFILE') {
    return AIQFLOW.lookupProfile_(payload);
  }
  if (action === 'SUBMIT_REFLECTION') {
    return AIQFLOW.submitReflection_(payload);
  }
  if (action === 'GET_SESSION_STATUS') {
    return AIQFLOW.getSessionStatus_(payload);
  }
  if (action === 'GET_FLOW_PROGRESS') {
    return AIQFLOW.getProgress_(payload);
  }

  return {
    ok: false,
    code: 'UNKNOWN_FLOW_ACTION',
    action: action,
    version: AIQFLOW.VERSION
  };
};