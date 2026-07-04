/**
 * CSAI2102 AI Quest — Arena Telemetry Patch v6.3.0
 * ---------------------------------------------------
 * Add this file to the SAME Google Apps Script project as Code.gs.
 *
 * Required one-line change in Code.gs / doGet:
 *
 *   if (action === 'teacherConsole') {
 *     setupSheets();
 *     return jsonOutMaybe_(aq630PostProcessTeacherConsole_(buildTeacherConsole_(p), p), callback);
 *   }
 *
 * Then deploy a new Web App version. This patch keeps the existing teacherConsole
 * response and appends data.arenaTelemetry for S10–S15 / B4–B5.
 */

function aq630SafeJson_(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')); } catch (err) { return {}; }
}

function aq630Number_(value) {
  var number = Number(value);
  return isNaN(number) ? 0 : number;
}

function aq630Bool_(value) {
  if (value === true) return true;
  return ['true','1','yes','y'].indexOf(String(value || '').toLowerCase()) >= 0;
}

function aq630Session_(value) {
  var raw = String(value || '').toLowerCase().replace(/[\s_\-:]+/g, '');
  var map = {
    m10:'s10', s10:'s10', session10:'s10', mission10:'s10',
    m11:'s11', s11:'s11', session11:'s11', mission11:'s11',
    m12:'s12', s12:'s12', session12:'s12', mission12:'s12',
    b4:'b4', boss4:'b4',
    m13:'s13', s13:'s13', session13:'s13', mission13:'s13',
    m14:'s14', s14:'s14', session14:'s14', mission14:'s14',
    m15:'s15', s15:'s15', session15:'s15', mission15:'s15',
    b5:'b5', boss5:'b5'
  };
  return map[raw] || '';
}

function aq630Attempt_(row) {
  var extra = aq630SafeJson_(row.extraJson || row.extra || '{}');
  var raw = extra.raw && typeof extra.raw === 'object' ? extra.raw : {};
  var sessionId = aq630Session_(row.sessionId || row.missionId || raw.sessionId || raw.missionId);
  var runMode = String(extra.runMode || raw.runMode || '').toLowerCase();
  var isPractice = aq630Bool_(extra.isPractice) || aq630Bool_(raw.isPractice) || runMode === 'practice';
  var score = aq630Number_(row.score);
  var bossWin = aq630Bool_(row.bossWin) || aq630Bool_(raw.bossWin);
  var gateStatus = String(extra.gateStatus || raw.gateStatus || '').toLowerCase();
  var pass = false;
  if (sessionId === 'b4') pass = bossWin && score >= 70;
  else if (sessionId === 'b5') pass = bossWin && score >= 75;
  else pass = score >= 60 || ['passed','mastered'].indexOf(gateStatus) >= 0 || aq630Bool_(row.mastered);

  return {
    sessionId: sessionId,
    studentId: String(row.studentId || ''),
    attemptId: String(row.attemptId || ''),
    serverTs: String(row.serverTs || ''),
    clientTs: String(row.clientTs || ''),
    score: score,
    accuracy: row.accuracy === '' || row.accuracy === null || row.accuracy === undefined ? null : aq630Number_(row.accuracy),
    helpUsed: aq630Number_(row.helpUsed),
    maxCombo: aq630Number_(row.maxCombo || raw.maxCombo),
    bossWin: bossWin,
    isPractice: isPractice,
    isGraded: !isPractice,
    pass: pass,
    mechanicAccuracy: raw.mechanicAccuracy === undefined ? null : aq630Number_(raw.mechanicAccuracy),
    knowledgeAccuracy: raw.quizAccuracy === undefined ? null : aq630Number_(raw.quizAccuracy),
    boardAccuracy: raw.boardAccuracy === undefined ? null : aq630Number_(raw.boardAccuracy),
    bossHp: raw.bossHp === undefined ? null : aq630Number_(raw.bossHp),
    gameplayMode: String(raw.gameplayMode || ''),
    mechanic: String(raw.mechanic || ''),
    extra: raw
  };
}

function aq630Average_(rows, key) {
  var usable = rows.filter(function(row){ return row[key] !== null && row[key] !== undefined && row[key] !== ''; });
  if (!usable.length) return null;
  var total = usable.reduce(function(sum, row){ return sum + aq630Number_(row[key]); }, 0);
  return Math.round(total / usable.length * 10) / 10;
}

function aq630PostProcessTeacherConsole_(payload, params) {
  payload = payload || {};
  params = params || {};

  try {
    var section = String(params.section || '101');
    var rows = sheetObjects_('session_attempts')
      .filter(function(row){ return !section || String(row.section || '') === section; })
      .map(aq630Attempt_)
      .filter(function(row){ return !!row.sessionId; });

    var order = [
      ['s10','S10 • ML Foundations'], ['s11','S11 • Supervised Learning'],
      ['s12','S12 • Unsupervised Discovery'], ['b4','B4 • Machine Learning Boss'],
      ['s13','S13 • Neural Network Studio'], ['s14','S14 • Reinforcement Learning'],
      ['s15','S15 • NLP, GenAI & Applied AI'], ['b5','B5 • Final Applied AI Boss']
    ];

    var sessions = order.map(function(entry){
      var id = entry[0];
      var all = rows.filter(function(row){ return row.sessionId === id; });
      var graded = all.filter(function(row){ return row.isGraded; });
      var practice = all.filter(function(row){ return row.isPractice; });
      var students = {};
      graded.forEach(function(row){ if (row.studentId) students[row.studentId] = true; });
      var passes = graded.filter(function(row){ return row.pass; });
      var replayStudents = {};
      graded.forEach(function(row){
        if (!row.studentId) return;
        replayStudents[row.studentId] = (replayStudents[row.studentId] || 0) + 1;
      });
      var replayCount = Object.keys(replayStudents).filter(function(studentId){ return replayStudents[studentId] > 1; }).length;

      return {
        sessionId: id,
        label: entry[1],
        isBoss: id === 'b4' || id === 'b5',
        target: id === 'b4' ? '70% + Boss Win' : id === 'b5' ? '75% + Boss Win' : '60%',
        practiceAttempts: practice.length,
        gradedAttempts: graded.length,
        students: Object.keys(students).length,
        passAttempts: passes.length,
        replayStudents: replayCount,
        avgScore: aq630Average_(graded, 'score'),
        avgAccuracy: aq630Average_(graded, 'accuracy'),
        avgMechanicAccuracy: aq630Average_(graded, 'mechanicAccuracy'),
        avgKnowledgeAccuracy: aq630Average_(graded, 'knowledgeAccuracy'),
        avgBoardAccuracy: aq630Average_(graded, 'boardAccuracy'),
        avgBossHp: aq630Average_(graded, 'bossHp'),
        avgHelpUsed: aq630Average_(graded, 'helpUsed'),
        avgMaxCombo: aq630Average_(graded, 'maxCombo'),
        bossWins: graded.filter(function(row){ return row.bossWin; }).length,
        gameModes: Array.from(new Set(graded.map(function(row){ return row.gameplayMode; }).filter(Boolean))),
        telemetryReady: graded.some(function(row){ return row.mechanicAccuracy !== null || row.knowledgeAccuracy !== null || row.boardAccuracy !== null || row.bossHp !== null; })
      };
    });

    payload.data = payload.data || {};
    payload.data.arenaTelemetry = {
      version: 'v6.3.0',
      section: section,
      source: 'session_attempts.extraJson',
      updatedAt: bangkokIsoNow(),
      sessions: sessions,
      totalArenaAttempts: rows.length,
      telemetryRows: rows.filter(function(row){ return row.gameplayMode || row.mechanicAccuracy !== null || row.boardAccuracy !== null; }).length
    };
  } catch (err) {
    payload.data = payload.data || {};
    payload.data.arenaTelemetry = {version:'v6.3.0', error:String(err)};
  }

  return payload;
}
