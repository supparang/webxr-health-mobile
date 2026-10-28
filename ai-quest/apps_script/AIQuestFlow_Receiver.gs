/**
 * =========================================================
 * CSAI2102 AI Quest Integrated Flow Receiver v1.3.8
 * =========================================================
 *
 * Google Sheet is the sole authority.
 * No doGet(e) / doPost(e) in this file.
 *
 * Identity authority:
 * - students_roster is the canonical roster when it exists.
 * - Only status=active may enter.
 * - role may be student or test.
 * - When students_roster exists, legacy profile sheets DO NOT
 *   grant access to identities absent from the roster.
 *
 * Official progression rules:
 * - Mission: Graded evidence only; Practice never passes/unlocks
 * - Coding Lab: server-validated coding evidence
 * - Reflection: >=20 chars each, three distinct answers
 * - Reflection relevance is audited, but Thai answers are never
 *   blocked only because keyword matching missed the wording
 * - Session complete = Mission + Coding + Reflection
 *
 * IMPORTANT:
 * - Do not add doGet/doPost here.
 * - Main Code.gs router calls AIQFLOW.handle(...)
 * =========================================================
 */

var AIQFLOW = AIQFLOW || {};

AIQFLOW.VERSION =
  '20261028-AIQ-FLOW-V1.3.8-CODING-SCORE-ALIGN';

AIQFLOW.SECTION = '101';

AIQFLOW.ROSTER_SHEET = 'students_roster';
AIQFLOW.REFLECTION_SHEET = 'aiquest_reflections';
AIQFLOW.COMPLETION_SHEET = 'aiquest_session_completion';

AIQFLOW.ORDER = [
  'S1','S2','S3','B1',
  'S4','S5','S6','B2',
  'S7','S8','S9','B3',
  'S10','S11','S12','B4',
  'S13','S14','S15','B5'
];


/* =========================================================
 * HEADERS
 * ========================================================= */

AIQFLOW.REFLECTION_HEADERS = [
  'submitted_at',
  'student_id',
  'student_name',
  'section',
  'session_id',
  'reflection_prompt_1',
  'reflection_1',
  'reflection_prompt_2',
  'reflection_2',
  'reflection_prompt_3',
  'reflection_3',
  'quality_score',
  'quality_status',
  'quality_json',
  'content_version',
  'request_id',
  'passed',
  'version'
];

AIQFLOW.COMPLETION_HEADERS = [
  'updated_at',
  'student_id',
  'student_name',
  'section',
  'session_id',
  'mission_completed',
  'mission_score',
  'coding_completed',
  'coding_score',
  'reflection_completed',
  'reflection_quality_score',
  'reflection_quality_status',
  'session_completed',
  'next_session',
  'content_version',
  'version'
];


/* =========================================================
 * REFLECTION RELEVANCE TERMS
 * ========================================================= */

AIQFLOW.REFLECTION_TERMS = {

  S1:[
    'ai','automation','rule','threshold','model',
    'ข้อมูล','ระบบอัตโนมัติ','ปัญญาประดิษฐ์','เกณฑ์'
  ],

  S2:[
    'peas','agent','sensor','actuator','environment',
    'state','goal','utility',
    'ตัวแทน','เซนเซอร์','สภาพแวดล้อม','เป้าหมาย'
  ],

  S3:[
    'state','goal','action','frontier','bfs','dfs',
    'visited','path',
    'สถานะ','เป้าหมาย','เส้นทาง','คิว','สแตก'
  ],

  B1:[
    'ai','peas','agent','bfs','dfs','search','fallback',
    'ตัวแทน','การค้นหา','ทางเลือกปลอดภัย'
  ],

  S4:[
    'ucs','cost','priority','frontier','g(n)','path','optimal',
    'ต้นทุน','คิวลำดับความสำคัญ','เส้นทาง'
  ],

  S5:[
    'heuristic','astar','a*','g(n)','h(n)','f(n)',
    'admissible','consistent',
    'ค่าประมาณ','เหมาะสม','สอดคล้อง'
  ],

  S6:[
    'minimax','max','min','alpha','beta',
    'utility','evaluation',
    'คู่แข่ง','ประเมิน','ตัดกิ่ง'
  ],

  B2:[
    'ucs','a*','minimax','cost','heuristic','opponent','trade',
    'ต้นทุน','คู่แข่ง','กลยุทธ์'
  ],

  S7:[
    'fact','rule','relation','knowledge','forward',
    'backward','conflict',
    'ข้อเท็จจริง','กฎ','ความรู้','ความขัดแย้ง'
  ],

  S8:[
    'prior','likelihood','evidence','posterior','bayes',
    'probability','uncertainty',
    'ความน่าจะเป็น','หลักฐาน','ความไม่แน่นอน'
  ],

  S9:[
    'logic','rule','inference','expert','explanation',
    'conflict','referral',
    'ตรรกะ','กฎ','อนุมาน','คำอธิบาย','ผู้เชี่ยวชาญ'
  ],

  B3:[
    'knowledge','logic','bayes','confidence',
    'evidence','explanation','uncertainty',
    'ความรู้','ตรรกะ','ความมั่นใจ','หลักฐาน'
  ],

  S10:[
    'feature','label','train','validation','test',
    'leakage','seed',
    'ข้อมูลฝึก','ข้อมูลทดสอบ','ข้อมูลรั่ว','ทำซ้ำ'
  ],

  S11:[
    'classification','regression','threshold',
    'precision','recall','false','metric',
    'จำแนก','ถดถอย','ตัวชี้วัด',
    'ผลบวกเท็จ','ผลลบเท็จ'
  ],

  S12:[
    'cluster','kmeans','k-means','centroid',
    'pca','outlier','silhouette',
    'จัดกลุ่ม','จุดศูนย์กลาง',
    'ค่าผิดปกติ','ลดมิติ'
  ],

  B4:[
    'pipeline','metric','overfitting','underfitting',
    'leakage','deploy','monitor',
    'กระบวนการ','ตัวชี้วัด',
    'เรียนเกิน','นำไปใช้','ติดตาม'
  ],

  S13:[
    'weight','bias','activation','loss','gradient',
    'backprop','cnn','rnn','transformer',
    'น้ำหนัก','ความเอนเอียง',
    'ฟังก์ชันกระตุ้น','ความสูญเสีย'
  ],

  S14:[
    'mdp','state','action','reward','policy',
    'q-learning','gamma','epsilon','reward hacking',
    'รางวัล','นโยบาย','การสำรวจ','การใช้ประโยชน์'
  ],

  S15:[
    'llm','rag','retrieval','context','generation',
    'citation','grounding','hallucination','fallback',
    'ค้นคืน','บริบท','อ้างอิง','หลอน','หลักฐาน'
  ],

  B5:[
    'fairness','privacy','explanation','safety',
    'human','audit','monitoring','appeal','accountability',
    'ความเป็นธรรม','ความเป็นส่วนตัว',
    'ความปลอดภัย','ตรวจสอบ','อุทธรณ์','รับผิดชอบ'
  ]
};


/* =========================================================
 * BASIC HELPERS
 * ========================================================= */

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

  return /^\d+(?:\.0+)?$/.test(s)
    ? String(parseInt(s, 10))
    : s.toLowerCase();
};


AIQFLOW.sectionKey_ = function(v) {
  return AIQFLOW.idKey_(v);
};


AIQFLOW.sessionKey_ = function(v) {

  var s = AIQFLOW.text_(v)
    .toUpperCase()
    .replace(/[\s_:\-]+/g, '');

  var m = s.match(
    /^(?:SESSION|MISSION|M)?(S?(?:1[0-5]|[1-9])|B[1-5])$/
  );

  if (!m) return '';

  var x = m[1];

  return /^\d+$/.test(x)
    ? 'S' + x
    : x;
};


AIQFLOW.bool_ = function(v) {

  return v === true ||
    [
      'true',
      '1',
      'yes',
      'passed',
      'pass',
      'completed',
      'mastered',
      'submitted',
      'win',
      'won'
    ].indexOf(
      AIQFLOW.text_(v).toLowerCase()
    ) >= 0;
};


AIQFLOW.num_ = function(v) {

  var s = AIQFLOW.text_(v)
    .replace(/,/g, '')
    .replace(/%$/, '');

  var n = Number(s);

  return s && isFinite(n)
    ? n
    : 0;
};


AIQFLOW.now_ = function() {

  return Utilities.formatDate(
    new Date(),
    'Asia/Bangkok',
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  );
};


AIQFLOW.safeJson_ = function(v) {

  if (
    v &&
    typeof v === 'object' &&
    !Array.isArray(v)
  ) {
    return v;
  }

  try {

    var parsed =
      JSON.parse(String(v || '{}'));

    return (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    )
      ? parsed
      : {};

  } catch (e) {

    return {};
  }
};


/* =========================================================
 * SPREADSHEET HELPERS
 * ========================================================= */

AIQFLOW.ss_ = function() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      'SPREADSHEET_NOT_FOUND'
    );
  }

  return ss;
};


AIQFLOW.headerIndex_ = function(headers, names) {

  for (var i = 0; i < names.length; i++) {

    var target =
      AIQFLOW.norm_(names[i]);

    for (var j = 0; j < headers.length; j++) {

      if (
        AIQFLOW.norm_(headers[j]) === target
      ) {
        return j;
      }
    }
  }

  return -1;
};


AIQFLOW.rows_ = function(sh, requestCache) {
  if (!sh) return { headers: [], rows: [] };
  // Request-local cache only. No cross-student global storage.
  var key = requestCache ? 'sheet:' + String(sh.getSheetId()) : '';
  if (requestCache && Object.prototype.hasOwnProperty.call(requestCache, key)) return requestCache[key];
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var result = { headers: [], rows: [] };
  if (lastRow >= 2 && lastCol >= 1) {
    var values = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
    result = { headers: values[0], rows: values.slice(1) };
  }
  if (requestCache) requestCache[key] = result;
  return result;
};

AIQFLOW.ensureSheet_ = function(name, headers) {

  var ss = AIQFLOW.ss_();
  var sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
  }

  if (sh.getLastRow() === 0) {

    sh.getRange(
      1,
      1,
      1,
      headers.length
    ).setValues([headers]);

    sh.setFrozenRows(1);

    return sh;
  }

  var lastCol =
    Math.max(
      1,
      sh.getLastColumn()
    );

  var existing =
    sh.getRange(
      1,
      1,
      1,
      lastCol
    )
    .getDisplayValues()[0]
    .map(AIQFLOW.text_);

  var known = {};

  existing.forEach(function(h) {

    if (h) {
      known[
        AIQFLOW.norm_(h)
      ] = true;
    }
  });

  var missing =
    headers.filter(function(h) {

      return !known[
        AIQFLOW.norm_(h)
      ];
    });

  if (missing.length) {

    sh.getRange(
      1,
      lastCol + 1,
      1,
      missing.length
    ).setValues([missing]);
  }

  sh.setFrozenRows(1);

  return sh;
};


AIQFLOW.objectRow_ = function(
  actualHeaders,
  obj
) {

  var lookup = {};

  Object.keys(obj || {})
    .forEach(function(k) {

      lookup[
        AIQFLOW.norm_(k)
      ] = obj[k];
    });

  return actualHeaders.map(
    function(h) {

      var value =
        lookup[
          AIQFLOW.norm_(h)
        ];

      return (
        value &&
        typeof value === 'object'
      )
        ? JSON.stringify(value)
        : (
            value == null
              ? ''
              : value
          );
    }
  );
};


AIQFLOW.appendObject_ = function(
  name,
  headers,
  obj
) {

  var sh =
    AIQFLOW.ensureSheet_(
      name,
      headers
    );

  var actual =
    sh.getRange(
      1,
      1,
      1,
      Math.max(
        1,
        sh.getLastColumn()
      )
    ).getDisplayValues()[0];

  sh.appendRow(
    AIQFLOW.objectRow_(
      actual,
      obj
    )
  );
};


AIQFLOW.sheetCandidates_ = function(names, requestCache) {
  var key = 'candidates:' + (names || []).join('|');
  if (requestCache && Object.prototype.hasOwnProperty.call(requestCache, key)) return requestCache[key];
  var ss = AIQFLOW.ss_(), out = [];
  (names || []).forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh) out.push(sh);
  });
  if (requestCache) requestCache[key] = out;
  return out;
};

AIQFLOW.extraCodingSheets_ = function(requestCache) {
  // Read-only discovery of Coding-specific historical tabs. Only invoked if
  // the known Coding sheets do not already prove completion.
  var key = 'extraCodingSheets';
  if (requestCache && Object.prototype.hasOwnProperty.call(requestCache, key)) return requestCache[key];
  var known = { codingattempts: true, aiquestcodingattempts: true, codingattempt: true };
  var out = [], ss = AIQFLOW.ss_();
  ss.getSheets().forEach(function(sh) {
    if (!sh || known[AIQFLOW.norm_(sh.getName())]) return;
    if (sh.getLastRow() < 2 || sh.getLastColumn() < 3) return;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    var hasId = AIQFLOW.headerIndex_(headers, [
      'student_id','studentId','student','student_no','studentNo','pid'
    ]) >= 0;
    var hasSession = AIQFLOW.headerIndex_(headers, [
      'session_id','sessionId','mission_id','missionId','session','mission'
    ]) >= 0;
    if (!hasId || !hasSession) return;
    var codingEvidence = AIQFLOW.headerIndex_(headers, [
      'coding_score','codingScore','completed_code','completedCode',
      'modified_code','modifiedCode','prediction_answer','predictionAnswer',
      'validation_mode','validationMode','quiz_score','quizScore',
      'run_score','runScore','modify_score','modifyScore',
      'challenge_score','challengeScore','coding_completed','codingCompleted'
    ]) >= 0;
    var namedCoding = /coding/i.test(sh.getName()) &&
      AIQFLOW.headerIndex_(headers, [
        'score','best_score','bestScore','total_score','totalScore',
        'completed','passed','status','mastered'
      ]) >= 0;
    if (codingEvidence || namedCoding) out.push(sh);
  });
  if (requestCache) requestCache[key] = out;
  return out;
};

/* =========================================================
 * IDENTITY / ROSTER AUTHORITY
 * ========================================================= */

/**
 * Read one identity from students_roster.
 *
 * Roster columns:
 * studentId | studentName | program | section | status | role
 */
AIQFLOW.findRosterProfile_ = function(
  studentId,
  section
) {

  var sh =
    AIQFLOW.ss_()
      .getSheetByName(
        AIQFLOW.ROSTER_SHEET
      );

  if (!sh) {
    return {
      rosterExists: false,
      profile: null,
      reason: 'ROSTER_SHEET_NOT_FOUND'
    };
  }

  var data =
    AIQFLOW.rows_(sh);

  var h =
    data.headers;

  var iId =
    AIQFLOW.headerIndex_(
      h,
      [
        'student_id',
        'studentId',
        'id'
      ]
    );

  var iName =
    AIQFLOW.headerIndex_(
      h,
      [
        'student_name',
        'studentName',
        'name',
        'full_name'
      ]
    );

  var iProgram =
    AIQFLOW.headerIndex_(
      h,
      [
        'program',
        'major',
        'department'
      ]
    );

  var iSec =
    AIQFLOW.headerIndex_(
      h,
      [
        'section',
        'class_section',
        'classSection'
      ]
    );

  var iStatus =
    AIQFLOW.headerIndex_(
      h,
      [
        'status',
        'active_status'
      ]
    );

  var iRole =
    AIQFLOW.headerIndex_(
      h,
      [
        'role',
        'user_role'
      ]
    );

  if (iId < 0) {

    return {
      rosterExists: true,
      profile: null,
      reason: 'ROSTER_STUDENT_ID_HEADER_MISSING'
    };
  }

  for (
    var r = data.rows.length - 1;
    r >= 0;
    r--
  ) {

    var row =
      data.rows[r];

    if (
      AIQFLOW.idKey_(row[iId]) !==
      AIQFLOW.idKey_(studentId)
    ) {
      continue;
    }

    if (
      iSec >= 0 &&
      AIQFLOW.sectionKey_(row[iSec]) !==
      AIQFLOW.sectionKey_(section)
    ) {
      continue;
    }

    var status =
      iStatus >= 0
        ? AIQFLOW.text_(row[iStatus]).toLowerCase()
        : 'active';

    if (
      status &&
      status !== 'active'
    ) {

      return {
        rosterExists: true,
        profile: null,
        reason: 'ROSTER_NOT_ACTIVE',
        status: status
      };
    }

    var role =
      iRole >= 0
        ? AIQFLOW.text_(row[iRole]).toLowerCase()
        : 'student';

    if (
      role !== 'student' &&
      role !== 'test'
    ) {

      return {
        rosterExists: true,
        profile: null,
        reason: 'ROSTER_ROLE_NOT_ALLOWED',
        role: role
      };
    }

    return {
      rosterExists: true,

      profile: {
        studentId:
          AIQFLOW.text_(
            row[iId]
          ),

        studentName:
          iName >= 0
            ? AIQFLOW.text_(
                row[iName]
              )
            : '',

        program:
          iProgram >= 0
            ? AIQFLOW.text_(
                row[iProgram]
              )
            : '',

        section:
          iSec >= 0
            ? AIQFLOW.text_(
                row[iSec]
              )
            : AIQFLOW.text_(section),

        status:
          status || 'active',

        role:
          role || 'student',

        sourceSheet:
          AIQFLOW.ROSTER_SHEET,

        rosterAuthority:
          true
      },

      reason:
        'ROSTER_MATCH'
    };
  }

  return {
    rosterExists: true,
    profile: null,
    reason: 'ROSTER_NOT_FOUND'
  };
};


/**
 * Legacy identity lookup.
 *
 * Used ONLY if students_roster does not exist yet.
 * Once roster exists, identities absent from roster
 * must not gain access through students_profile.
 */
AIQFLOW.findLegacyProfile_ = function(
  studentId,
  section
) {

  var names = [
    'students_profile',
    'student_profiles',
    'students-profile',
    'profiles',
    'student_profile'
  ];

  for (
    var n = 0;
    n < names.length;
    n++
  ) {

    var sh =
      AIQFLOW.ss_()
        .getSheetByName(
          names[n]
        );

    if (!sh) {
      continue;
    }

    var data =
      AIQFLOW.rows_(sh);

    var h =
      data.headers;

    var iId =
      AIQFLOW.headerIndex_(
        h,
        [
          'student_id',
          'studentId',
          'id'
        ]
      );

    var iSec =
      AIQFLOW.headerIndex_(
        h,
        [
          'section',
          'class_section'
        ]
      );

    var iName =
      AIQFLOW.headerIndex_(
        h,
        [
          'student_name',
          'studentName',
          'name',
          'full_name'
        ]
      );

    if (iId < 0) {
      continue;
    }

    for (
      var r = data.rows.length - 1;
      r >= 0;
      r--
    ) {

      var row =
        data.rows[r];

      if (
        AIQFLOW.idKey_(row[iId]) ===
          AIQFLOW.idKey_(studentId) &&

        (
          iSec < 0 ||

          AIQFLOW.sectionKey_(
            row[iSec]
          ) ===
          AIQFLOW.sectionKey_(
            section
          )
        )
      ) {

        return {
          studentId:
            AIQFLOW.text_(
              row[iId]
            ),

          studentName:
            iName >= 0
              ? AIQFLOW.text_(
                  row[iName]
                )
              : '',

          program: '',

          section:
            iSec >= 0
              ? AIQFLOW.text_(
                  row[iSec]
                )
              : AIQFLOW.text_(section),

          status:
            'active',

          role:
            'student',

          sourceSheet:
            names[n],

          rosterAuthority:
            false,

          legacyFallback:
            true
        };
      }
    }
  }

  return null;
};


/**
 * Canonical identity lookup.
 *
 * Rule:
 * 1. If students_roster exists -> roster ONLY.
 * 2. If roster sheet does not exist -> legacy fallback allowed.
 */
AIQFLOW.findProfile_ = function(
  studentId,
  section
) {

  var roster =
    AIQFLOW.findRosterProfile_(
      studentId,
      section
    );

  if (roster.rosterExists) {
    return roster.profile;
  }

  return AIQFLOW.findLegacyProfile_(
    studentId,
    section
  );
};


AIQFLOW.lookupProfile_ = function(p) {

  p = p || {};

  var studentId =
    AIQFLOW.text_(
      p.studentId
    );

  var section =
    AIQFLOW.text_(
      p.section ||
      AIQFLOW.SECTION
    );

  if (!studentId) {

    return {
      ok: false,
      code: 'MISSING_STUDENT_ID',
      version: AIQFLOW.VERSION
    };
  }

  var roster =
    AIQFLOW.findRosterProfile_(
      studentId,
      section
    );

  if (roster.rosterExists) {

    return {
      ok: true,

      found:
        !!roster.profile,

      profile:
        roster.profile,

      identityAuthority:
        AIQFLOW.ROSTER_SHEET,

      rosterAuthority:
        true,

      reason:
        roster.reason,

      version:
        AIQFLOW.VERSION
    };
  }

  var profile =
    AIQFLOW.findLegacyProfile_(
      studentId,
      section
    );

  return {
    ok: true,

    found:
      !!profile,

    profile:
      profile,

    identityAuthority:
      profile
        ? profile.sourceSheet
        : '',

    rosterAuthority:
      false,

    legacyFallback:
      true,

    reason:
      profile
        ? 'LEGACY_PROFILE_MATCH'
        : 'PROFILE_NOT_FOUND',

    version:
      AIQFLOW.VERSION
  };
};


/* =========================================================
 * EVIDENCE IDENTITY MATCHING
 * ========================================================= */

AIQFLOW.sameIdentity_ = function(
  row,
  h,
  studentId,
  section,
  sessionId
) {

  var iId =
    AIQFLOW.headerIndex_(
      h,
      [
        'student_id',
        'studentId',
        'id',
        'student_no',
        'studentNo'
      ]
    );

  var iSec =
    AIQFLOW.headerIndex_(
      h,
      [
        'section',
        'class_section',
        'classSection'
      ]
    );

  var iSession =
    AIQFLOW.headerIndex_(
      h,
      [
        'session_id',
        'sessionId',
        'mission_id',
        'missionId',
        'session',
        'mission'
      ]
    );

  if (
    iId < 0 ||
    iSession < 0
  ) {
    return false;
  }

  return (
    AIQFLOW.idKey_(
      row[iId]
    ) ===
      AIQFLOW.idKey_(
        studentId
      ) &&

    (
      iSec < 0 ||

      AIQFLOW.sectionKey_(
        row[iSec]
      ) ===
      AIQFLOW.sectionKey_(
        section
      )
    ) &&

    AIQFLOW.sessionKey_(
      row[iSession]
    ) ===
      AIQFLOW.sessionKey_(
        sessionId
      )
  );
};


/* =========================================================
 * PRACTICE / GRADED AUTHORITY
 * ========================================================= */

AIQFLOW.rowIsPractice_ = function(
  row,
  h
) {

  var iPractice =
    AIQFLOW.headerIndex_(
      h,
      [
        'isPractice',
        'is_practice',
        'practice'
      ]
    );

  var iGraded =
    AIQFLOW.headerIndex_(
      h,
      [
        'isGraded',
        'is_graded',
        'graded'
      ]
    );

  var iMode =
    AIQFLOW.headerIndex_(
      h,
      [
        'runMode',
        'run_mode',
        'mode',
        'difficulty'
      ]
    );

  var iExtra =
    AIQFLOW.headerIndex_(
      h,
      [
        'extraJson',
        'extra_json',
        'extra'
      ]
    );

  if (
    iGraded >= 0 &&
    AIQFLOW.bool_(
      row[iGraded]
    )
  ) {
    return false;
  }

  if (
    iPractice >= 0 &&
    AIQFLOW.bool_(
      row[iPractice]
    )
  ) {
    return true;
  }

  var directMode =
    iMode >= 0
      ? AIQFLOW.text_(
          row[iMode]
        ).toLowerCase()
      : '';

  if (
    directMode === 'practice' ||
    directMode.indexOf(
      'practice'
    ) >= 0
  ) {
    return true;
  }

  if (
    directMode === 'graded' ||
    directMode.indexOf(
      'graded'
    ) >= 0
  ) {
    return false;
  }

  var extra =
    iExtra >= 0
      ? AIQFLOW.safeJson_(
          row[iExtra]
        )
      : {};

  var raw =
    extra.raw &&
    typeof extra.raw === 'object'
      ? extra.raw
      : {};

  var detail =
    AIQFLOW.safeJson_(
      raw.extraJson || {}
    );

  var isGraded =
    AIQFLOW.bool_(
      extra.isGraded
    ) ||
    AIQFLOW.bool_(
      raw.isGraded
    ) ||
    AIQFLOW.bool_(
      detail.isGraded
    );

  var isPractice =
    AIQFLOW.bool_(
      extra.isPractice
    ) ||
    AIQFLOW.bool_(
      raw.isPractice
    ) ||
    AIQFLOW.bool_(
      detail.isPractice
    );

  if (isGraded) {
    return false;
  }

  if (isPractice) {
    return true;
  }

  var mode =
    AIQFLOW.text_(
      extra.runMode ||
      raw.runMode ||
      detail.runMode ||
      ''
    ).toLowerCase();

  return (
    mode === 'practice' ||
    mode.indexOf(
      'practice'
    ) >= 0
  );
};


/* =========================================================
 * REQUEST IDEMPOTENCY
 * ========================================================= */

AIQFLOW.requestExists_ = function(
  requestId
) {

  requestId =
    AIQFLOW.text_(
      requestId
    );

  if (!requestId) {
    return false;
  }

  var sh =
    AIQFLOW.ss_()
      .getSheetByName(
        AIQFLOW.REFLECTION_SHEET
      );

  if (
    !sh ||
    sh.getLastRow() < 2
  ) {
    return false;
  }

  var h =
    sh.getRange(
      1,
      1,
      1,
      sh.getLastColumn()
    ).getDisplayValues()[0];

  var i =
    AIQFLOW.headerIndex_(
      h,
      [
        'request_id',
        'requestId'
      ]
    );

  if (i < 0) {
    return false;
  }

  return !!sh
    .getRange(
      2,
      i + 1,
      sh.getLastRow() - 1,
      1
    )
    .createTextFinder(
      requestId
    )
    .matchEntireCell(true)
    .findNext();
};


/* =========================================================
 * CODING STATUS
 * ========================================================= */

AIQFLOW.codingIdentityMatch_ = function(row, headers, studentId, section, sessionId) {
  // Match the exact student/section/stage used by Coding Status Repair.
  // A missing section in legacy Coding evidence defaults to 101, as in AIQCODING.
  var iId = AIQFLOW.headerIndex_(headers, [
    'student_id','studentId','student','student_no','studentNo','id','pid'
  ]);
  var iSec = AIQFLOW.headerIndex_(headers, [
    'section','section_id','sectionId','class_section','classSection'
  ]);
  var iSession = AIQFLOW.headerIndex_(headers, [
    'session_id','sessionId','session','mission_id','missionId','mission'
  ]);
  if (iId < 0 || iSession < 0) return false;
  var rowSection = iSec < 0 || !AIQFLOW.text_(row[iSec]) ? '101' : row[iSec];
  return AIQFLOW.idKey_(row[iId]) === AIQFLOW.idKey_(studentId) &&
    AIQFLOW.sectionKey_(rowSection) === AIQFLOW.sectionKey_(section) &&
    AIQFLOW.sessionKey_(row[iSession]) === AIQFLOW.sessionKey_(sessionId);
};

AIQFLOW.codingScore_ = function(row, headers) {
  // Same score precedence as AIQCODING Status Repair: an explicit saved
  // Coding score wins; otherwise reconstruct only from Coding component columns.
  var direct = AIQFLOW.headerIndex_(headers, [
    'coding_score','codingScore','best_score','bestScore','score',
    'total_score','totalScore'
  ]);
  if (direct >= 0 && AIQFLOW.text_(row[direct]) !== '') {
    return AIQFLOW.num_(row[direct]);
  }
  function part(names) {
    var i = AIQFLOW.headerIndex_(headers, names);
    return i < 0 ? 0 : AIQFLOW.num_(row[i]);
  }
  return part(['run_score','runScore']) +
    part(['modify_score','modifyScore']) +
    part(['challenge_score','challengeScore']) +
    Math.min(20, part(['quiz_score','quizScore']) * 4);
};

AIQFLOW.codingStatus_ = function(studentId, section, sessionId, requestCache) {
  var sheets = AIQFLOW.sheetCandidates_([
    'coding_attempts','aiquest_coding_attempts','AIQuest_Coding_Attempts',
    'coding_attempt','Coding_Attempts'
  ], requestCache);
  var best = 0, count = 0, completed = false, sources = [], matched = [];
  function inspect(sh) {
    var data = AIQFLOW.rows_(sh, requestCache), h = data.headers;
    var iDone = AIQFLOW.headerIndex_(h, [
      'completed','passed','mastered','coding_completed','codingCompleted','status'
    ]);
    var before = count;
    for (var r = 0; r < data.rows.length; r++) {
      var row = data.rows[r];
      if (!AIQFLOW.codingIdentityMatch_(row, h, studentId, section, sessionId)) continue;
      count++;
      var score = AIQFLOW.codingScore_(row, h);
      var done = iDone >= 0 ? AIQFLOW.bool_(row[iDone]) : false;
      best = Math.max(best, score);
      if (score >= 60 || done) completed = true;
      matched.push({sheet:sh.getName(),row:r+2,score:score,done:done});
    }
    if (count > before) sources.push(sh.getName());
  }
  sheets.forEach(inspect);
  // Historical Coding tabs may have generic score/status headers but still
  // contain exact Coding evidence. Never infer completion from Mission score.
  if (!completed) AIQFLOW.extraCodingSheets_(requestCache).forEach(inspect);
  return {
    found: count > 0,
    completed: completed || best >= 60,
    bestScore: best,
    attemptCount: count,
    sourceSheets: sources,
    matched: matched.slice(-5)
  };
};


/* =========================================================
 * MISSION STATUS
 * ========================================================= */

AIQFLOW.missionPass_ = function(
  sessionId,
  score,
  done,
  bossWin
) {

  var id =
    AIQFLOW.sessionKey_(
      sessionId
    );

  if (done) {
    return true;
  }

  if (
    !/^B[1-5]$/.test(id)
  ) {
    return score >= 60;
  }

  if (id === 'B4') {
    return (
      bossWin &&
      score >= 70
    );
  }

  if (id === 'B5') {
    return (
      bossWin &&
      score >= 75
    );
  }

  return bossWin;
};


AIQFLOW.missionStatus_ = function(
  studentId,
  section,
  sessionId,
  requestCache
) {

  var sheets =
    AIQFLOW.sheetCandidates_([
      'session_attempts',
      'aiquest_session_attempts',
      'mission_attempts',
      'attempts'
    ], requestCache);

  var best = 0;
  var found = false;
  var passed = false;
  var source = '';
  var matched = [];
  var ignoredPractice = 0;
  var gradedRows = 0;

  for (
    var s = 0;
    s < sheets.length;
    s++
  ) {

    var sh =
      sheets[s];

    var data =
      AIQFLOW.rows_(sh, requestCache);

    var h =
      data.headers;

    var iScore =
      AIQFLOW.headerIndex_(
        h,
        [
          'score',
          'best_score',
          'bestScore',
          'accuracy',
          'percent',
          'percentage'
        ]
      );

    var iPassed =
      AIQFLOW.headerIndex_(
        h,
        [
          'passed',
          'mastered',
          'mission_completed',
          'missionCompleted',
          'gate_status',
          'status',
          'completed'
        ]
      );

    var iBoss =
      AIQFLOW.headerIndex_(
        h,
        [
          'bossWin',
          'boss_win',
          'bossWon',
          'boss_won'
        ]
      );

    for (
      var r = 0;
      r < data.rows.length;
      r++
    ) {

      var row =
        data.rows[r];

      if (
        !AIQFLOW.sameIdentity_(
          row,
          h,
          studentId,
          section,
          sessionId
        )
      ) {
        continue;
      }

      found = true;

      if (
        AIQFLOW.rowIsPractice_(
          row,
          h
        )
      ) {

        ignoredPractice++;

        matched.push({
          sheet:
            sh.getName(),

          row:
            r + 2,

          practice:
            true,

          ignoredForUnlock:
            true
        });

        continue;
      }

      gradedRows++;

      source =
        sh.getName();

      var score =
        iScore >= 0
          ? AIQFLOW.num_(
              row[iScore]
            )
          : 0;

      var done =
        iPassed >= 0
          ? AIQFLOW.bool_(
              row[iPassed]
            )
          : false;

      var bossWin =
        iBoss >= 0
          ? AIQFLOW.bool_(
              row[iBoss]
            )
          : false;

      best =
        Math.max(
          best,
          score
        );

      if (
        AIQFLOW.missionPass_(
          sessionId,
          score,
          done,
          bossWin
        )
      ) {
        passed = true;
      }

      matched.push({
        sheet:
          sh.getName(),

        row:
          r + 2,

        score:
          score,

        done:
          done,

        bossWin:
          bossWin,

        practice:
          false
      });
    }
  }

  return {
    found:
      found,

    completed:
      passed,

    bestScore:
      best,

    sourceSheet:
      source,

    gradedRows:
      gradedRows,

    ignoredPracticeRows:
      ignoredPractice,

    authority:
      'graded-only-sheet-evidence',

    matched:
      matched.slice(-8)
  };
};


/* =========================================================
 * REFLECTION STATUS
 * ========================================================= */

AIQFLOW.reflectionStatus_ = function(
  studentId,
  section,
  sessionId,
  requestCache
) {

  var sheets =
    AIQFLOW.sheetCandidates_([
      AIQFLOW.REFLECTION_SHEET,
      'reflections',
      'aiquest_reflection'
    ], requestCache);

  for (
    var s = 0;
    s < sheets.length;
    s++
  ) {

    var sh =
      sheets[s];

    var data =
      AIQFLOW.rows_(sh, requestCache);

    var h =
      data.headers;

    var iPassed =
      AIQFLOW.headerIndex_(
        h,
        [
          'passed',
          'completed',
          'reflection_completed',
          'reflectionCompleted',
          'status'
        ]
      );

    var iQuality =
      AIQFLOW.headerIndex_(
        h,
        [
          'quality_score',
          'qualityScore'
        ]
      );

    var iQualityStatus =
      AIQFLOW.headerIndex_(
        h,
        [
          'quality_status',
          'qualityStatus'
        ]
      );

    for (
      var r = data.rows.length - 1;
      r >= 0;
      r--
    ) {

      var row =
        data.rows[r];

      if (
        !AIQFLOW.sameIdentity_(
          row,
          h,
          studentId,
          section,
          sessionId
        )
      ) {
        continue;
      }

      return {
        found:
          true,

        completed:
          iPassed < 0
            ? true
            : AIQFLOW.bool_(
                row[iPassed]
              ),

        qualityScore:
          iQuality >= 0
            ? AIQFLOW.num_(
                row[iQuality]
              )
            : null,

        qualityStatus:
          iQualityStatus >= 0
            ? AIQFLOW.text_(
                row[iQualityStatus]
              )
            : '',

        sourceSheet:
          sh.getName(),

        row:
          r + 2
      };
    }
  }

  return {
    found:
      false,

    completed:
      false,

    qualityScore:
      null,

    qualityStatus:
      ''
  };
};


/* =========================================================
 * REFLECTION QUALITY
 * ========================================================= */

AIQFLOW.reflectionQuality_ = function(
  sessionId,
  answers
) {

  var terms =
    AIQFLOW.REFLECTION_TERMS[
      sessionId
    ] || [];

  var combined =
    AIQFLOW.norm_(
      answers.join(' ')
    );

  var matched =
    terms.filter(
      function(term) {

        return (
          combined.indexOf(
            AIQFLOW.norm_(term)
          ) >= 0
        );
      }
    );

  var unique = {};

  answers
    .map(AIQFLOW.norm_)
    .forEach(function(a) {

      if (a) {
        unique[a] = true;
      }
    });

  var distinctCount =
    Object.keys(
      unique
    ).length;

  var allLongEnough =
    answers.every(
      function(a) {

        return a.length >= 20;
      }
    );

  var lengthScore =
    answers.reduce(
      function(sum, a) {

        return sum +
          Math.min(
            15,
            Math.floor(
              a.length / 5
            )
          );
      },
      0
    );

  var relevanceScore =
    terms.length
      ? Math.min(
          35,
          Math.round(
            matched.length /
            Math.min(
              5,
              terms.length
            ) *
            35
          )
        )
      : 20;

  var distinctScore =
    distinctCount === 3
      ? 20
      : (
          distinctCount === 2
            ? 10
            : 0
        );

  var relevant =
    matched.length >= 1;

  var structurallyPassed =
    allLongEnough &&
    distinctCount === 3;

  return {

    score:
      Math.min(
        100,
        lengthScore +
        relevanceScore +
        distinctScore
      ),

    passed:
      structurallyPassed,

    structurallyPassed:
      structurallyPassed,

    relevant:
      relevant,

    distinct:
      distinctCount === 3,

    qualityStatus:
      relevant
        ? 'passed'
        : 'needs-review',

    matchedTerms:
      matched,

    expectedTerms:
      terms,

    answerLengths:
      answers.map(
        function(a) {
          return a.length;
        }
      )
  };
};


/* =========================================================
 * COMPLETION UPSERT
 * ========================================================= */

AIQFLOW.upsertCompletion_ = function(obj) {

  var sh =
    AIQFLOW.ensureSheet_(
      AIQFLOW.COMPLETION_SHEET,
      AIQFLOW.COMPLETION_HEADERS
    );

  var actual =
    sh.getRange(
      1,
      1,
      1,
      Math.max(
        1,
        sh.getLastColumn()
      )
    ).getDisplayValues()[0];

  var data =
    AIQFLOW.rows_(sh);

  var rowNumber =
    -1;

  for (
    var r = data.rows.length - 1;
    r >= 0;
    r--
  ) {

    if (
      AIQFLOW.sameIdentity_(
        data.rows[r],
        data.headers,
        obj.student_id,
        obj.section,
        obj.session_id
      )
    ) {

      rowNumber =
        r + 2;

      break;
    }
  }

  var newRow =
    AIQFLOW.objectRow_(
      actual,
      obj
    );

  if (rowNumber > 0) {

    var current =
      sh.getRange(
        rowNumber,
        1,
        1,
        newRow.length
      ).getValues()[0];

    newRow =
      newRow.map(
        function(v, i) {

          return (
            v === '' &&
            current[i] !== ''
          )
            ? current[i]
            : v;
        }
      );

    sh.getRange(
      rowNumber,
      1,
      1,
      newRow.length
    ).setValues([newRow]);

  } else {

    sh.appendRow(
      newRow
    );
  }
};


/* =========================================================
 * SUBMIT REFLECTION
 * ========================================================= */

AIQFLOW.submitReflection_ = function(p) {

  p = p || {};

  var studentId =
    AIQFLOW.text_(
      p.studentId
    );

  var studentName =
    AIQFLOW.text_(
      p.studentName
    );

  var section =
    AIQFLOW.text_(
      p.section ||
      AIQFLOW.SECTION
    );

  var sessionId =
    AIQFLOW.sessionKey_(
      p.sessionId
    );

  var answers = [
    AIQFLOW.text_(
      p.reflection1
    ),
    AIQFLOW.text_(
      p.reflection2
    ),
    AIQFLOW.text_(
      p.reflection3
    )
  ];

  var prompts = [
    AIQFLOW.text_(
      p.reflectionPrompt1
    ),
    AIQFLOW.text_(
      p.reflectionPrompt2
    ),
    AIQFLOW.text_(
      p.reflectionPrompt3
    )
  ];

  var contentVersion =
    AIQFLOW.text_(
      p.contentVersion ||
      'unknown-client'
    );

  var requestId =
    AIQFLOW.text_(
      p.requestId ||
      Utilities.getUuid()
    );

  if (
    !studentId ||
    !sessionId ||
    AIQFLOW.ORDER.indexOf(
      sessionId
    ) < 0
  ) {

    return {
      ok: false,

      code:
        'MISSING_OR_INVALID_IDENTITY',

      version:
        AIQFLOW.VERSION
    };
  }

  var profile =
    AIQFLOW.findProfile_(
      studentId,
      section
    );

  if (!profile) {

    return {
      ok: false,

      code:
        'IDENTITY_NOT_AUTHORIZED',

      message:
        'ไม่พบรหัสผู้เรียนที่ active ใน students_roster',

      version:
        AIQFLOW.VERSION
    };
  }

  if (profile.studentName) {
    studentName =
      profile.studentName;
  }

  if (
    answers.some(
      function(a) {
        return a.length < 20;
      }
    )
  ) {

    return {
      ok: false,

      code:
        'REFLECTION_TOO_SHORT',

      message:
        'แต่ละคำตอบต้องมีอย่างน้อย 20 ตัวอักษร',

      version:
        AIQFLOW.VERSION
    };
  }

  var quality =
    AIQFLOW.reflectionQuality_(
      sessionId,
      answers
    );

  if (!quality.distinct) {

    return {
      ok: false,

      code:
        'REFLECTION_DUPLICATE_ANSWERS',

      message:
        'คำตอบทั้ง 3 ข้อต้องอธิบายคนละประเด็น ไม่ควรคัดลอกข้อความเดียวกัน',

      quality:
        quality,

      version:
        AIQFLOW.VERSION
    };
  }

  var coding =
    AIQFLOW.codingStatus_(
      studentId,
      section,
      sessionId
    );

  if (!coding.completed) {

    return {
      ok: false,

      code:
        'CODING_NOT_COMPLETED',

      coding:
        coding,

      version:
        AIQFLOW.VERSION
    };
  }

  var mission =
    AIQFLOW.missionStatus_(
      studentId,
      section,
      sessionId
    );

  if (!mission.completed) {

    return {
      ok: false,

      code:
        'MISSION_NOT_COMPLETED_OR_PRACTICE_ONLY',

      message:
        'ต้องผ่าน Mission แบบ Graded ก่อนส่ง Reflection; Practice ไม่ปลดล็อก',

      mission:
        mission,

      version:
        AIQFLOW.VERSION
    };
  }

  if (
    AIQFLOW.requestExists_(
      requestId
    )
  ) {

    var existing =
      AIQFLOW.reflectionStatus_(
        studentId,
        section,
        sessionId
      );

    return {
      ok: true,

      duplicate:
        true,

      completed:
        !!existing.completed,

      sessionId:
        sessionId,

      reflectionQuality:
        quality,

      version:
        AIQFLOW.VERSION
    };
  }

  var now =
    AIQFLOW.now_();

  var qualityStatus =
    quality.relevant
      ? 'passed'
      : 'needs-review';

  AIQFLOW.appendObject_(
    AIQFLOW.REFLECTION_SHEET,
    AIQFLOW.REFLECTION_HEADERS,
    {

      submitted_at:
        now,

      student_id:
        studentId,

      student_name:
        studentName,

      section:
        section,

      session_id:
        sessionId,

      reflection_prompt_1:
        prompts[0],

      reflection_1:
        answers[0],

      reflection_prompt_2:
        prompts[1],

      reflection_2:
        answers[1],

      reflection_prompt_3:
        prompts[2],

      reflection_3:
        answers[2],

      quality_score:
        quality.score,

      quality_status:
        qualityStatus,

      quality_json:
        quality,

      content_version:
        contentVersion,

      request_id:
        requestId,

      passed:
        true,

      version:
        AIQFLOW.VERSION
    }
  );

  var index =
    AIQFLOW.ORDER.indexOf(
      sessionId
    );

  var next =
    (
      index >= 0 &&
      index <
        AIQFLOW.ORDER.length - 1
    )
      ? AIQFLOW.ORDER[
          index + 1
        ]
      : '';

  AIQFLOW.upsertCompletion_({

    updated_at:
      now,

    student_id:
      studentId,

    student_name:
      studentName,

    section:
      section,

    session_id:
      sessionId,

    mission_completed:
      true,

    mission_score:
      mission.bestScore || 0,

    coding_completed:
      true,

    coding_score:
      coding.bestScore || 0,

    reflection_completed:
      true,

    reflection_quality_score:
      quality.score,

    reflection_quality_status:
      qualityStatus,

    session_completed:
      true,

    next_session:
      next,

    content_version:
      contentVersion,

    version:
      AIQFLOW.VERSION
  });

  return {

    ok:
      true,

    duplicate:
      false,

    completed:
      true,

    sessionId:
      sessionId,

    nextSession:
      next,

    codingScore:
      coding.bestScore || 0,

    missionScore:
      mission.bestScore || 0,

    reflectionQuality:
      quality,

    reflectionQualityStatus:
      qualityStatus,

    teacherReviewRecommended:
      qualityStatus ===
      'needs-review',

    progressionAuthority:
      'graded Mission + validated Coding + submitted Reflection',

    identityAuthority:
      profile.sourceSheet,

    version:
      AIQFLOW.VERSION
  };
};


/* =========================================================
 * GET SESSION STATUS
 * ========================================================= */

AIQFLOW.getSessionStatus_ = function(p) {

  p = p || {};

  var studentId =
    AIQFLOW.text_(
      p.studentId
    );

  var section =
    AIQFLOW.text_(
      p.section ||
      AIQFLOW.SECTION
    );

  var sessionId =
    AIQFLOW.sessionKey_(
      p.sessionId
    );

  if (
    !studentId ||
    !sessionId
  ) {

    return {
      ok: false,

      code:
        'MISSING_STATUS_IDENTITY',

      version:
        AIQFLOW.VERSION
    };
  }

  var profile =
    AIQFLOW.findProfile_(
      studentId,
      section
    );

  if (!profile) {

    return {
      ok: false,

      code:
        'IDENTITY_NOT_AUTHORIZED',

      message:
        'ไม่พบรหัสผู้เรียนที่ active ใน students_roster',

      version:
        AIQFLOW.VERSION
    };
  }

  var mission =
    AIQFLOW.missionStatus_(
      studentId,
      section,
      sessionId
    );

  var coding =
    AIQFLOW.codingStatus_(
      studentId,
      section,
      sessionId
    );

  var reflection =
    AIQFLOW.reflectionStatus_(
      studentId,
      section,
      sessionId
    );

  return {

    ok:
      true,

    studentId:
      studentId,

    studentName:
      profile.studentName || '',

    program:
      profile.program || '',

    role:
      profile.role || 'student',

    section:
      section,

    sessionId:
      sessionId,

    mission:
      mission,

    coding:
      coding,

    reflection:
      reflection,

    completed:
      !!(
        mission.completed &&
        coding.completed &&
        reflection.completed
      ),

    identityAuthority:
      profile.sourceSheet,

    progressionAuthority:
      'graded-only-three-part-sheet',

    version:
      AIQFLOW.VERSION
  };
};


/* =========================================================
 * GET FULL PROGRESS
 * ========================================================= */

AIQFLOW.getProgress_ = function(p) {

  p = p || {};

  var studentId =
    AIQFLOW.text_(
      p.studentId
    );

  var section =
    AIQFLOW.text_(
      p.section ||
      AIQFLOW.SECTION
    );

  var progress = {};
  var requestCache = {};

  if (!studentId) {

    return {
      ok: false,

      code:
        'MISSING_STUDENT_ID',

      version:
        AIQFLOW.VERSION
    };
  }

  var profile =
    AIQFLOW.findProfile_(
      studentId,
      section
    );

  if (!profile) {

    return {
      ok: false,

      code:
        'IDENTITY_NOT_AUTHORIZED',

      message:
        'ไม่พบรหัสผู้เรียนที่ active ใน students_roster',

      version:
        AIQFLOW.VERSION
    };
  }

  AIQFLOW.ORDER.forEach(
    function(
      sessionId,
      index
    ) {

      var mission =
        AIQFLOW.missionStatus_(
          studentId,
          section,
          sessionId,
          requestCache
        );

      var coding =
        AIQFLOW.codingStatus_(
          studentId,
          section,
          sessionId,
          requestCache
        );

      var reflection =
        AIQFLOW.reflectionStatus_(
          studentId,
          section,
          sessionId,
          requestCache
        );

      var completed =
        !!(
          mission.completed &&
          coding.completed &&
          reflection.completed
        );

      progress[
        sessionId.toLowerCase()
      ] = {

        sessionId:
          sessionId,

        mission:
          mission,

        coding:
          coding,

        reflection:
          reflection,

        missionPassed:
          !!mission.completed,

        missionScore:
          mission.gradedRows
            ? Number(
                mission.bestScore || 0
              )
            : null,

        codingPassed:
          !!coding.completed,

        codingScore:
          coding.found
            ? Number(
                coding.bestScore || 0
              )
            : null,

        reflectionSubmitted:
          !!reflection.completed,

        reflectionQualityScore:
          reflection.qualityScore,

        reflectionQualityStatus:
          reflection.qualityStatus,

        completed:
          completed,

        unlocked:
          index === 0
      };
    }
  );

  /*
   * Strict canonical progression:
   * next session unlocks only when previous session
   * has all three official components.
   *
   * Legacy-safe UI handling is performed by Map v733.
   * Backend progression remains strict.
   */
  for (
    var i = 1;
    i < AIQFLOW.ORDER.length;
    i++
  ) {

    var current =
      AIQFLOW.ORDER[i]
        .toLowerCase();

    var previous =
      AIQFLOW.ORDER[
        i - 1
      ].toLowerCase();

    progress[
      current
    ].unlocked =
      !!progress[
        previous
      ].completed;
  }

  var found =
    AIQFLOW.ORDER.some(
      function(id) {

        var row =
          progress[
            id.toLowerCase()
          ];

        return (
          row.mission.found ||
          row.coding.found ||
          row.reflection.found
        );
      }
    );

  return {

    ok:
      true,

    found:
      found,

    studentId:
      studentId,

    studentName:
      profile.studentName || '',

    program:
      profile.program || '',

    role:
      profile.role || 'student',

    section:
      section,

    identityAuthority:
      profile.sourceSheet,

    rosterAuthority:
      !!profile.rosterAuthority,

    progress:
      progress,

    source:
      'graded-only-strict-three-part-thai-safe-reflection',

    version:
      AIQFLOW.VERSION
  };
};


/* =========================================================
 * ROUTER ENTRY
 * ========================================================= */

AIQFLOW.handle = function(p) {

  p = p || {};

  var action =
    AIQFLOW.text_(
      p.action
    ).toUpperCase();

  if (
    action ===
    'LOOKUP_PROFILE'
  ) {

    return AIQFLOW.lookupProfile_(
      p
    );
  }

  if (
    action ===
    'SUBMIT_REFLECTION'
  ) {

    return AIQFLOW.submitReflection_(
      p
    );
  }

  if (
    action ===
    'GET_SESSION_STATUS'
  ) {

    return AIQFLOW.getSessionStatus_(
      p
    );
  }

  if (
    action ===
    'GET_FLOW_PROGRESS'
  ) {

    return AIQFLOW.getProgress_(
      p
    );
  }

  return {

    ok:
      false,

    code:
      'UNKNOWN_FLOW_ACTION',

    action:
      action,

    version:
      AIQFLOW.VERSION
  };
};