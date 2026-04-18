import { VOCAB_BANKS } from './vocab-data.js';
import { installVocabGuards } from './vocab-guard.js';

(() => {
  installVocabGuards({ engineName: 'vocab-engine.js' });

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const els = {
    menu: document.getElementById('menu'),
    endWrap: document.getElementById('endWrap'),
    leaderboardWrap: document.getElementById('leaderboardWrap'),
    teacherWrap: document.getElementById('teacherWrap'),
    teacherLinkWrap: document.getElementById('teacherLinkWrap'),
    teacherPassInput: document.getElementById('teacherPassInput'),
    teacherLinkOutput: document.getElementById('teacherLinkOutput'),
    questionBox: document.getElementById('questionBox'),
    feedbackBox: document.getElementById('feedbackBox'),
    hudPrompt: document.getElementById('hudPrompt'),
    hudScore: document.getElementById('hudScore'),
    hudRound: document.getElementById('hudRound'),
    hudCombo: document.getElementById('hudCombo'),
    hudMode: document.getElementById('hudMode'),
    hudHp: document.getElementById('hudHp'),
    hudState: document.getElementById('hudState'),
    timeFill: document.getElementById('timeFill'),
    displayNameInput: document.getElementById('displayNameInput'),
    studentIdInput: document.getElementById('studentIdInput'),
    sectionInput: document.getElementById('sectionInput'),
    sessionCodeInput: document.getElementById('sessionCodeInput'),
    menuTop3Board: document.getElementById('menuTop3Board'),
    leaderboardList: document.getElementById('leaderboardList'),
    teacherTable: document.getElementById('teacherTable'),
    weakList: document.getElementById('weakList'),
    endSummaryText: document.getElementById('endSummaryText')
  };

  const TEACHER_KEY = 'VOCAB_V9_TEACHER_LAST';
  const PROFILE_KEY = 'VOCAB_V9_PROFILE';
  const SESSION_KEY = 'VOCAB_V9_SESSIONS';
  const TEACHER_PASS_KEY = 'VOCAB_V9_TEACHER_PASS_HASH';
  const GLOBAL_LB_CACHE_KEY = 'VOCAB_V9_GLOBAL_LB_CACHE';

  const VOCAB_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwe1R6e_771rxLsBct6nypvOvHn6vZhdBeCf0p3Kr2v_9phhMFbwBqLnV5Ug2ZAnBG2/exec';
  const VOCAB_SHEET_SOURCE = 'vocab.html';
  const VOCAB_SHEET_SCHEMA = 'vocab-v3';

  function bangkokIsoNow(){
    try{
      const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).formatToParts(new Date());
      const map = {};
      for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
      return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+07:00`;
    }catch(_){
      return new Date().toISOString();
    }
  }

  function fireAndForget(promise, label='async'){
    Promise.resolve(promise).catch(err => {
      console.warn(label + ' failed:', err);
    });
  }

  function setText(el, value){
    if (el) el.textContent = value;
  }

  function now(){
    return performance.now();
  }

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function weightedPick(items, weightGetter){
    const expanded = [];
    items.forEach(item => {
      const w = Math.max(0, Number(weightGetter(item) || 0));
      for(let i=0;i<w;i++) expanded.push(item);
    });
    if (!expanded.length) return items[Math.floor(Math.random() * items.length)] || null;
    return expanded[Math.floor(Math.random() * expanded.length)] || null;
  }

  function center(){
    return { x: width * 0.5, y: height * 0.60 };
  }

  function postSheetAction(action, payload, timeoutMs = 2500){
    const envelope = {
      source: VOCAB_SHEET_SOURCE,
      schema: VOCAB_SHEET_SCHEMA,
      action,
      timestamp: bangkokIsoNow(),
      payload
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(VOCAB_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(envelope),
      keepalive: true,
      signal: controller.signal
    })
      .then(async res => {
        clearTimeout(timer);
        let data = null;
        try{
          data = await res.json();
        }catch(_){}
        return { ok: res.ok, status: res.status, data };
      })
      .catch(err => {
        clearTimeout(timer);
        throw err;
      });
  }

  function compactMastery(){
    return Object.fromEntries(
      Object.entries(V9.mastery || {}).map(([k, v]) => [k, {
        level: v.level || 'easy',
        highestLevel: v.highestLevel || 'easy',
        seen: Number(v.seen || 0),
        correct: Number(v.correct || 0),
        wrong: Number(v.wrong || 0)
      }])
    );
  }

  function compactWordSkill(){
    return Object.fromEntries(
      Object.entries(V9.wordSkill || {}).map(([k, v]) => [k, {
        score: Number((Number(v.score || 0)).toFixed(3)),
        seen: Number(v.seen || 0),
        correct: Number(v.correct || 0),
        wrong: Number(v.wrong || 0),
        avgRtMs: Number(v.avgRtMs || 0)
      }])
    );
  }

  function weakestTermsForSheet(limit = 5){
    return Object.entries(V9.mastery || {})
      .map(([termId, m]) => ({
        termId,
        seen: Number(m.seen || 0),
        correct: Number(m.correct || 0),
        wrong: Number(m.wrong || 0),
        level: m.level || 'easy',
        highestLevel: m.highestLevel || 'easy',
        accuracy: m.seen ? Number((((m.correct || 0) * 100) / m.seen).toFixed(2)) : 0
      }))
      .filter(x => x.seen > 0)
      .sort((a,b) => (b.wrong - a.wrong) || (a.accuracy - b.accuracy))
      .slice(0, limit);
  }

  function buildAiRecommendation(accuracy){
    const weak = weakestTermsForSheet(5);
    const wrongSum = weak.reduce((s, x) => s + Number(x.wrong || 0), 0);

    if (accuracy < 60 || wrongSum >= 6){
      return {
        recommendedMode: 'debug_mission',
        recommendedDifficulty: 'easy',
        aiReason: 'ยังมีคำอ่อนหลายคำ ควรทบทวนแบบช้าชัดและซ่อม usage ก่อน'
      };
    }
    if (accuracy < 80){
      return {
        recommendedMode: 'ai_training',
        recommendedDifficulty: 'normal',
        aiReason: 'เริ่มดีขึ้นแล้ว ควรฝึกบริบทการใช้งานจริงเพิ่ม'
      };
    }
    return {
      recommendedMode: 'code_battle',
      recommendedDifficulty: 'hard',
      aiReason: 'ทำได้ดีแล้ว เพิ่มความท้าทายได้'
    };
  }

  function readTrimmed(el){
    return (el?.value || '').trim();
  }

  function getContextMeta(){
    const q = new URLSearchParams(location.search);
    const sectionDom = readTrimmed(els.sectionInput);
    const sessionCodeDom = readTrimmed(els.sessionCodeInput);

    return {
      timestamp: bangkokIsoNow(),
      session_id: currentSessionId || '',
      display_name: profile.displayName || 'Player',
      student_id: profile.studentId || '',
      section: sectionDom || q.get('section') || localStorage.getItem('VOCAB_SECTION') || '',
      session_code: sessionCodeDom || q.get('session_code') || q.get('sessionCode') || localStorage.getItem('VOCAB_SESSION_CODE') || '',
      bank: V9.bank || '',
      mode: V9.mode || ''
    };
  }

  function getAccuracyAndMistakes(){
    const rows = Object.values(V9.mastery || {});
    const totalSeen = rows.reduce((s,m) => s + Number(m.seen || 0), 0);
    const totalCorrect = rows.reduce((s,m) => s + Number(m.correct || 0), 0);
    const totalWrong = rows.reduce((s,m) => s + Number(m.wrong || 0), 0);
    return {
      total_seen: totalSeen,
      total_correct: totalCorrect,
      mistakes: totalWrong,
      accuracy: totalSeen ? Number(((totalCorrect / totalSeen) * 100).toFixed(2)) : 0
    };
  }

  function getWeakestTerm(){
    const first = Object.entries(V9.mastery || {})
      .sort((a,b) => (b[1].wrong - a[1].wrong) || (a[1].correct - b[1].correct))[0];
    return first ? first[0] : '';
  }

  function getWeakTermsJson(limit = 5){
    return JSON.stringify(weakestTermsForSheet(limit));
  }

  function loadProfile(){
    try{
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      profile.displayName = raw.displayName || 'Player';
      profile.studentId = raw.studentId || '';
      if (els.displayNameInput) els.displayNameInput.value = profile.displayName === 'Player' ? '' : profile.displayName;
      if (els.studentIdInput) els.studentIdInput.value = profile.studentId;
    }catch(_){}
  }

  function saveProfile(){
    profile.displayName = readTrimmed(els.displayNameInput) || 'Player';
    profile.studentId = readTrimmed(els.studentIdInput);

    try{
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      if (els.sectionInput) localStorage.setItem('VOCAB_SECTION', readTrimmed(els.sectionInput));
      if (els.sessionCodeInput) localStorage.setItem('VOCAB_SESSION_CODE', readTrimmed(els.sessionCodeInput));
    }catch(err){
      console.warn('saveProfile failed:', err);
    }
  }

  function saveSessionLocal(payload){
    try{
      const rows = JSON.parse(localStorage.getItem(SESSION_KEY) || '[]');
      rows.push(payload);

      const slim = rows.slice(-120).map(r => ({
        action: r.action || r.type || '',
        timestamp: r.timestamp || r.ts || '',
        session_id: r.session_id || r.sessionId || '',
        display_name: r.display_name || r.displayName || '',
        student_id: r.student_id || r.studentId || '',
        bank: r.bank || '',
        mode: r.mode || '',
        term_id: r.term_id || r.termId || '',
        is_correct: r.is_correct,
        score: r.score || 0,
        combo: r.combo || 0,
        stage_index: r.stage_index || r.stage || 0
      }));

      localStorage.setItem(SESSION_KEY, JSON.stringify(slim));
    }catch(err){
      console.warn('saveSessionLocal skipped:', err);
      try{ localStorage.removeItem(SESSION_KEY); }catch(_){}
    }
  }

  async function saveSessionRealtime(action, payload){
    saveSessionLocal({ action, ...payload });

    try{
      return await postSheetAction(action, payload, 2500);
    }catch(err){
      console.warn('Sheet upload failed; kept local only', err);
      return { ok: false, error: String(err), payload };
    }
  }

  async function logEvent(type, data = {}){
    const payload = {
      type,
      sessionId: currentSessionId,
      displayName: profile.displayName || 'Player',
      studentId: profile.studentId || '',
      bank: V9.bank,
      mode: V9.mode,
      ts: bangkokIsoNow(),
      ...data
    };
    return saveSessionRealtime(type, payload);
  }

  async function sendTermAnswerRow({
    item,
    isCorrect,
    levelBefore,
    levelAfter,
    responseMs
  }){
    if (!item) return;

    const meta = getContextMeta();

    return saveSessionRealtime('term_answer', {
      timestamp: bangkokIsoNow(),
      session_id: meta.session_id,
      display_name: meta.display_name,
      student_id: meta.student_id,
      section: meta.section,
      session_code: meta.session_code,
      bank: meta.bank,
      mode: meta.mode,
      term_id: item.termId || '',
      term: item.term || '',
      variant_type: item.type || '',
      is_correct: !!isCorrect,
      level_before: levelBefore || '',
      level_after: levelAfter || '',
      from_review: !!item.fromReview,
      response_ms: Number(responseMs || 0),
      score: Number(V9.score || 0),
      combo: Number(V9.combo || 0),
      stage_index: Number((V9.stageIndex || 0) + 1)
    });
  }

  async function logGameEntry(){
    currentSessionId = createSessionId();
    sessionStartedAt = bangkokIsoNow();

    const meta = getContextMeta();

    return saveSessionRealtime('session_start', {
      timestamp: bangkokIsoNow(),
      session_id: currentSessionId,
      display_name: meta.display_name,
      student_id: meta.student_id,
      section: meta.section,
      session_code: meta.session_code,
      bank: meta.bank,
      mode: meta.mode,
      started_at: sessionStartedAt,
      ended_at: '',
      duration_sec: '',
      score: '',
      accuracy: '',
      mistakes: '',
      weakest_term: '',
      ai_recommended_mode: '',
      ai_recommended_difficulty: '',
      ai_reason: '',
      page_url: location.href,
      user_agent: navigator.userAgent
    });
  }

  async function logGameEnd(summary){
    const endedAt = bangkokIsoNow();
    const durationSec = sessionStartedAt
      ? Math.max(0, Math.round((new Date(endedAt) - new Date(sessionStartedAt)) / 1000))
      : 0;

    const meta = getContextMeta();
    const stats = getAccuracyAndMistakes();
    const weakestTerm = getWeakestTerm();
    const weakTermsJson = getWeakTermsJson(5);
    const masteryJson = JSON.stringify(compactMastery());
    const ai = buildAiRecommendation(stats.accuracy);

    await saveSessionRealtime('session_end', {
      timestamp: bangkokIsoNow(),
      session_id: currentSessionId,
      display_name: meta.display_name,
      student_id: meta.student_id,
      section: meta.section,
      session_code: meta.session_code,
      bank: meta.bank,
      mode: meta.mode,
      started_at: sessionStartedAt,
      ended_at: endedAt,
      duration_sec: durationSec,
      score: Number(summary.score || 0),
      accuracy: Number(stats.accuracy || 0),
      mistakes: Number(stats.mistakes || 0),
      weakest_term: weakestTerm,
      ai_recommended_mode: ai.recommendedMode,
      ai_recommended_difficulty: ai.recommendedDifficulty,
      ai_reason: ai.aiReason,
      page_url: location.href,
      user_agent: navigator.userAgent
    });

    await saveSessionRealtime('student_profile_upsert', {
      timestamp: bangkokIsoNow(),
      student_id: meta.student_id,
      display_name: meta.display_name,
      section: meta.section,
      last_session_id: currentSessionId,
      last_bank: meta.bank,
      last_mode: meta.mode,
      last_score: Number(summary.score || 0),
      last_accuracy: Number(stats.accuracy || 0),
      recommended_mode: ai.recommendedMode,
      recommended_difficulty: ai.recommendedDifficulty,
      weak_terms_json: weakTermsJson,
      mastery_json: masteryJson
    });
  }

  function saveLeaderboardCache(rows){
    try{
      const slim = (rows || []).slice(0, 50).map(r => ({
        timestamp: r.timestamp || '',
        player_key: r.player_key || '',
        display_name: r.display_name || '',
        student_id: r.student_id || '',
        section: r.section || '',
        session_code: r.session_code || '',
        bank: r.bank || '',
        mode: r.mode || '',
        best_score: Number(r.best_score || 0),
        best_accuracy: Number(r.best_accuracy || 0),
        last_when: r.last_when || '',
        best_session_id: r.best_session_id || ''
      }));
      localStorage.setItem(GLOBAL_LB_CACHE_KEY, JSON.stringify(slim));
    }catch(err){
      console.warn('saveLeaderboardCache failed:', err);
    }
  }

  function loadLeaderboardCache(){
    try{
      const rows = JSON.parse(localStorage.getItem(GLOBAL_LB_CACHE_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    }catch(_){
      return [];
    }
  }

  async function fetchGlobalLeaderboard(){
    try{
      const result = await postSheetAction('leaderboard_get', {}, 3500);
      const rows = Array.isArray(result?.data?.rows) ? result.data.rows : [];
      globalLeaderboardRows = rows;
      saveLeaderboardCache(rows);
      return rows;
    }catch(err){
      console.warn('fetchGlobalLeaderboard failed:', err);
      return globalLeaderboardRows || [];
    }
  }

  async function upsertGlobalLeaderboard(entry){
    try{
      return await postSheetAction('leaderboard_upsert', entry, 3500);
    }catch(err){
      console.warn('upsertGlobalLeaderboard failed:', err);
      return { ok: false, error: String(err) };
    }
  }

  function buildGlobalLeaderboardEntry(summary){
    const totalSeen = Object.values(summary.mastery || {}).reduce((s,m) => s + Number(m.seen || 0), 0);
    const totalCorrect = Object.values(summary.mastery || {}).reduce((s,m) => s + Number(m.correct || 0), 0);
    const accuracy = totalSeen ? Math.round((totalCorrect / totalSeen) * 100) : 0;
    const meta = getContextMeta();
    const playerKey = String(meta.student_id || meta.display_name || 'anonymous').trim();

    return {
      timestamp: bangkokIsoNow(),
      player_key: playerKey,
      display_name: meta.display_name,
      student_id: meta.student_id,
      section: meta.section,
      session_code: meta.session_code,
      bank: meta.bank,
      mode: meta.mode,
      best_score: Number(summary.score || 0),
      best_accuracy: Number(accuracy || 0),
      last_when: bangkokIsoNow(),
      best_session_id: currentSessionId || ''
    };
  }

  function renderMenuTop3(){
    const rows = (globalLeaderboardRows || []).slice(0, 3);
    els.menuTop3Board.innerHTML = '';

    if (!rows.length){
      els.menuTop3Board.innerHTML = '<div class="top3Card"><div class="rank">—</div><div class="name">ยังไม่มีคะแนน</div><div class="meta">เริ่มเล่นเพื่อขึ้นอันดับ</div></div>';
      return;
    }

    rows.forEach((r,i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      const div = document.createElement('div');
      div.className = 'top3Card';
      div.innerHTML =
        '<div class="rank">' + medal + '</div>' +
        '<div class="name">' + (r.display_name || 'Player') + '</div>' +
        '<div class="meta">Best Score ' + (r.best_score || 0) + '</div>' +
        '<div class="meta">Accuracy ' + (r.best_accuracy || 0) + '%</div>';
      els.menuTop3Board.appendChild(div);
    });
  }

  function renderLeaderboard(){
    const rows = globalLeaderboardRows || [];
    els.leaderboardList.innerHTML = '';

    if (!rows.length){
      const li = document.createElement('li');
      li.textContent = 'ยังไม่มี leaderboard';
      els.leaderboardList.appendChild(li);
      return;
    }

    rows.slice(0,10).forEach((r,i) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<strong>#' + (i + 1) + ' ' + (r.display_name || 'Player') + '</strong>' +
        '<div class="small mono">Best Score ' + (r.best_score || 0) +
        ' • Accuracy ' + (r.best_accuracy || 0) +
        '% • Bank ' + (r.bank || '-') +
        ' • Mode ' + (r.mode || '-') +
        ' • ' + (r.last_when || '-') + '</div>';
      els.leaderboardList.appendChild(li);
    });
  }

  function renderTeacherDashboard(summary){
    try{
      localStorage.setItem(TEACHER_KEY, JSON.stringify(summary));
    }catch(_){}

    els.teacherTable.innerHTML = '';

    const rows = Object.entries(summary.mastery).sort((a,b) => {
      const wrongDiff = b[1].wrong - a[1].wrong;
      if (wrongDiff !== 0) return wrongDiff;
      return a[0].localeCompare(b[0]);
    });

    if (!rows.length){
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6">No data yet</td>';
      els.teacherTable.appendChild(tr);
    } else {
      rows.forEach(([term, m]) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + term.toUpperCase() + '</td>' +
          '<td>' + m.seen + '</td>' +
          '<td>' + m.correct + '</td>' +
          '<td>' + m.wrong + '</td>' +
          '<td>' + m.level + '</td>' +
          '<td>' + m.highestLevel + '</td>';
        els.teacherTable.appendChild(tr);
      });
    }

    els.weakList.innerHTML = '';
    summary.weakestTerms.forEach(([term, m]) => {
      const li = document.createElement('li');
      li.innerHTML =
        '<strong>' + term.toUpperCase() + '</strong> • wrong ' + m.wrong +
        ' • correct ' + m.correct +
        ' • highest ' + m.highestLevel;
      els.weakList.appendChild(li);
    });
  }

  function updateWordSkill(termId, isCorrect, rtMs){
    const s = ensureWordSkill(termId);
    s.seen += 1;
    if (isCorrect){
      s.correct += 1;
      s.score = Math.min(1, s.score + 0.08);
    } else {
      s.wrong += 1;
      s.score = Math.max(0, s.score - 0.12);
    }
    if (rtMs > 0){
      s.avgRtMs = s.avgRtMs === 0 ? rtMs : Math.round((s.avgRtMs * 0.7) + (rtMs * 0.3));
    }
  }

  function updateMasteryAfterAnswer(termId, isCorrect, variantType){
    const m = ensureMastery(termId);
    m.seen += 1;
    if (isCorrect){
      m.correct += 1;
      m.streak += 1;
      if (m.streak >= 2){
        m.level = promoteLevel(m.level);
        m.streak = 0;
      }
    } else {
      m.wrong += 1;
      m.streak = 0;
      m.level = demoteLevel(m.level);
    }
    if (levelRank(m.level) > levelRank(m.highestLevel)) m.highestLevel = m.level;
    m.lastTypes.push(variantType);
    if (m.lastTypes.length > 5) m.lastTypes.shift();
  }

  function checkModeWinLose(){
    const cfg = modeConfig();

    if (cfg.useBoss){
      if (V9.bossHp <= 0) return 'win';
      if (V9.hp <= 0 || V9.stageIndex >= V9.maxStages) return 'lose';
      return 'continue';
    }

    if (cfg.useBugMeter){
      if (V9.bugFixed >= 10) return 'win';
      if (V9.bugEscaped >= V9.maxBugEscaped || V9.hp <= 0 || V9.stageIndex >= V9.maxStages) return 'lose';
      return 'continue';
    }

    if (cfg.useModelMeter){
      if (V9.modelScore >= V9.modelTarget) return 'win';
      if (V9.modelStability <= 0 || V9.hp <= 0 || V9.stageIndex >= V9.maxStages) return 'lose';
      return 'continue';
    }

    if (cfg.useSpeedTimer){
      if (V9.speedRunTimeLeft <= 0) return 'win';
      if (V9.hp <= 0) return 'lose';
      return 'continue';
    }

    return 'continue';
  }

  function createSessionId(){
    return 'SES-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
  }

  function endRun(){
    if (phase === 'ended') return;

    phase = 'ended';
    targets = [];
    V9.currentItem = null;
    hoveredId = null;
    timeLeft = 0;

    const weakest = getWeakestTerms(5);
    const cfg = modeConfig();

    const totalSeen = Object.values(V9.mastery || {}).reduce((s,m) => s + Number(m.seen || 0), 0);
    const totalCorrect = Object.values(V9.mastery || {}).reduce((s,m) => s + Number(m.correct || 0), 0);

    const summary = {
      score: V9.score,
      hp: V9.hp,
      bossHp: V9.bossHp,
      bossMaxHp: V9.bossMaxHp,
      bossPhase: V9.bossPhase,
      win: checkModeWinLose() === 'win',
      stagesPlayed: Math.min(V9.stageIndex, V9.maxStages),
      weakestTerms: weakest,
      mastery: V9.mastery,
      accuracy: totalSeen ? Number(((totalCorrect / totalSeen) * 100).toFixed(2)) : 0
    };

    lastSummary = summary;
    renderTeacherDashboard(summary);

    const weakestText = weakest.length
      ? weakest.map(([term, m]) => term + ' (' + m.wrong + ' wrong)').join(', ')
      : '-';

    if (cfg.useBoss){
      els.endSummaryText.innerHTML =
        '<strong>' + profile.displayName + '</strong><br>' +
        'Mode: ⚔️ Code Battle<br>' +
        'Score: ' + summary.score + '<br>' +
        'Accuracy: ' + summary.accuracy + '%<br>' +
        'Stages: ' + summary.stagesPlayed + ' / ' + V9.maxStages + '<br>' +
        'HP Left: ' + summary.hp + '<br>' +
        (summary.win ? 'Result: BOSS DEFEATED<br>' : 'Result: BOSS SURVIVED<br>') +
        'Boss HP Left: ' + summary.bossHp + ' / ' + summary.bossMaxHp + '<br>' +
        'Weakest Terms: ' + weakestText + '<br><br>' + modeSummaryHint();
    } else if (cfg.useBugMeter){
      els.endSummaryText.innerHTML =
        '<strong>' + profile.displayName + '</strong><br>' +
        'Mode: 🧪 Debug Mission<br>' +
        'Score: ' + summary.score + '<br>' +
        'Accuracy: ' + summary.accuracy + '%<br>' +
        'Fixed Bugs: ' + V9.bugFixed + '<br>' +
        'Escaped Bugs: ' + V9.bugEscaped + '/' + V9.maxBugEscaped + '<br>' +
        'Weakest Terms: ' + weakestText + '<br><br>' + modeSummaryHint();
    } else if (cfg.useModelMeter){
      els.endSummaryText.innerHTML =
        '<strong>' + profile.displayName + '</strong><br>' +
        'Mode: 🤖 AI Training Sim<br>' +
        'Score: ' + summary.score + '<br>' +
        'Accuracy: ' + summary.accuracy + '%<br>' +
        'Model Score: ' + V9.modelScore + '/' + V9.modelTarget + '<br>' +
        'Stability: ' + V9.modelStability + '%<br>' +
        'Weakest Terms: ' + weakestText + '<br><br>' + modeSummaryHint();
    } else if (cfg.useSpeedTimer){
      els.endSummaryText.innerHTML =
        '<strong>' + profile.displayName + '</strong><br>' +
        'Mode: ⚡ Speed Run<br>' +
        'Score: ' + summary.score + '<br>' +
        'Accuracy: ' + summary.accuracy + '%<br>' +
        'Multiplier Final: x' + V9.multiplier + '<br>' +
        'HP Left: ' + summary.hp + '<br>' +
        'Weakest Terms: ' + weakestText + '<br><br>' + modeSummaryHint();
    }

    els.endWrap.classList.remove('hidden');
    els.menu.classList.add('hidden');
    els.questionBox.classList.add('hidden');

    renderLeaderboard();
    renderHud();

    const lbEntry = buildGlobalLeaderboardEntry(summary);
    fireAndForget(
      upsertGlobalLeaderboard(lbEntry)
        .then(() => fetchGlobalLeaderboard())
        .then(() => {
          renderLeaderboard();
          renderMenuTop3();
        }),
      'leaderboard_upsert'
    );

    fireAndForget(logGameEnd(summary), 'session_end');
  }

  function handleAnswerV9(selectedText){
    const item = V9.currentItem;
    if (!item || phase !== 'battle') return;

    const isCorrect = selectedText === String(item.answer).toLowerCase();
    const rt = V9._qStartTime ? (Date.now() - V9._qStartTime) : 0;
    const cfg = modeConfig();
    const levelBefore = ensureMastery(item.termId).level;

    updateMasteryAfterAnswer(item.termId, isCorrect, item.type);
    updateWordSkill(item.termId, isCorrect, rt);
    const levelAfter = ensureMastery(item.termId).level;

    if (cfg.useBoss){
      if (isCorrect){
        const damage = bossDamageFromCorrect();
        V9.score += 12 + Math.min(V9.combo * 3, 24);
        V9.combo += 1;
        V9.bossHp = Math.max(0, V9.bossHp - damage);
        updateBossPhase();
        showFeedback(modeFeedbackText('correct', damage), 'ok');
      } else {
        const penalty = bossPenaltyOnWrong();
        V9.hp -= penalty;
        V9.combo = 0;
        enqueueReview(item.termId);
        showFeedback(modeFeedbackText('wrong', penalty), 'bad');
      }
    } else if (cfg.useBugMeter){
      if (isCorrect){
        V9.bugFixed += 1;
        V9.score += 15;
        V9.combo += 1;
        showFeedback(modeFeedbackText('correct'), 'ok');
      } else {
        V9.bugEscaped += 1;
        V9.hp -= 1;
        V9.combo = 0;
        enqueueReview(item.termId);
        showFeedback(modeFeedbackText('wrong'), 'bad');
      }
    } else if (cfg.useModelMeter){
      if (isCorrect){
        const gain = item.level === 'hard' ? 20 : item.level === 'normal' ? 14 : 10;
        V9.modelScore = Math.min(V9.modelTarget, V9.modelScore + gain);
        V9.score += gain;
        V9.combo += 1;
        showFeedback(modeFeedbackText('correct', gain), 'ok');
      } else {
        V9.modelStability = Math.max(0, V9.modelStability - 18);
        V9.hp -= 1;
        V9.combo = 0;
        enqueueReview(item.termId);
        showFeedback(modeFeedbackText('wrong'), 'bad');
      }
    } else if (cfg.useSpeedTimer){
      if (isCorrect){
        V9.combo += 1;
        if (V9.combo >= 3) V9.multiplier = Math.min(5, V9.multiplier + 1);
        V9.score += 8 * V9.multiplier;
        showFeedback(modeFeedbackText('correct', V9.multiplier), 'ok');
      } else {
        V9.multiplier = 1;
        V9.combo = 0;
        V9.hp -= 1;
        enqueueReview(item.termId);
        showFeedback(modeFeedbackText('wrong'), 'bad');
      }
    }

    fireAndForget(sendTermAnswerRow({
      item,
      isCorrect,
      levelBefore,
      levelAfter,
      responseMs: rt
    }), 'term_answer');

    fireAndForget(logEvent(isCorrect ? 'answer_correct' : 'answer_wrong', {
      questionId: item.id || '',
      termId: item.termId,
      word: item.term,
      questionType: item.type,
      selected: selectedText,
      correct: item.answer,
      responseTimeMs: rt,
      hp: V9.hp,
      stage: V9.stageIndex + 1,
      level: item.level,
      fromReview: item.fromReview,
      mode: V9.mode
    }), 'answer_event');

    V9.stageIndex += 1;

    const state = checkModeWinLose();
    if (state === 'win' || state === 'lose'){
      endRun();
      return;
    }

    phase = 'feedback';
    phaseUntil = now() + 800;
  }

  function nextQuestionV9(){
    updateRunDifficulty();

    const state = checkModeWinLose();
    if (state === 'win' || state === 'lose'){
      endRun();
      return;
    }

    const item = buildQuestionItem();
    if (!item){
      endRun();
      return;
    }

    V9.currentItem = item;
    V9._qStartTime = Date.now();
    renderQuestionBox(item);
    spawnTargetsFromChoices(item.choices);

    fireAndForget(logEvent('question_shown', {
      questionId: item.id || '',
      termId: item.termId,
      word: item.term,
      questionType: item.type,
      choices: item.choices,
      level: item.level,
      fromReview: item.fromReview,
      stage: V9.stageIndex + 1,
      modeWeight: (modeConfig().questionWeights || {})[item.type] || 0
    }), 'question_shown');

    phase = 'countdown';
    V9.countdown = 3;
    V9.bossAttackAt = now() + bossAttackInterval();
    phaseUntil = now() + 650;
  }

  function resetRun(bank, mode){
    V9.bank = bank;
    V9.mode = mode;
    V9.score = 0;
    V9.combo = 0;
    V9.hp = 5;
    V9.bossMaxHp = bossBaseHp();
    V9.bossHp = V9.bossMaxHp;
    V9.bossPhase = 1;
    V9.bossAttackAt = 0;
    V9.runDifficulty = 'easy';
    V9.currentItem = null;
    V9.usedVariantIds = new Set();
    V9.usedTermIds = [];
    V9.reviewQueue = [];
    V9.mastery = {};
    V9.wordSkill = {};
    V9.recentWords = [];
    V9.recentQuestionTypes = [];
    V9.bugEscaped = 0;
    V9.bugFixed = 0;
    V9.maxBugEscaped = 5;
    V9.modelScore = 0;
    V9.modelTarget = 100;
    V9.modelStability = 100;
    V9.speedRunTimeLeft = 60;
    V9.multiplier = 1;
    V9.stageIndex = 0;
    V9.countdown = 3;
    V9._qStartTime = 0;
    targets = [];
    phase = 'idle';
    timeLeft = 1;
    renderHud();
  }

  function startProductionRun(){
    document.querySelector('.hud')?.classList.remove('hidden');
    els.questionBox.classList.remove('hidden');
    saveProfile();
    els.menu.classList.add('hidden');
    els.endWrap.classList.add('hidden');

    fireAndForget(logGameEntry(), 'session_start');

    resetRun(V9.bank, V9.mode);
    nextQuestionV9();
  }

  function renderBackground(t){
    const theme = modeTheme();
    const cfg = modeConfig();

    const g = ctx.createLinearGradient(0,0,0,height);
    g.addColorStop(0, theme.bgTop);
    g.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,width,height);

    ctx.fillStyle = theme.floor;
    ctx.fillRect(0,height*0.58,width,height*0.42);

    const c = center();

    ctx.save();
    ctx.translate(c.x, c.y + 72);
    ctx.rotate(-0.06);
    for(let i=0;i<2;i++){
      ctx.beginPath();
      ctx.ellipse(0,0,280+i*72,72+i*20,0,0,Math.PI*2);
      ctx.globalAlpha = i === 0 ? .95 : .75;
      ctx.lineWidth = 14;
      ctx.strokeStyle = i === 0 ? theme.accent2 : theme.accent;
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(c.x, c.y - 20);
    const pulse = 1 + Math.sin(t * 0.003) * 0.08;
    ctx.scale(pulse, pulse);

    if (cfg.useBoss){
      ctx.beginPath();
      ctx.arc(0,0,52,0,Math.PI*2);
      ctx.fillStyle = theme.accent + '55';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0,0,30,0,Math.PI*2);
      ctx.fillStyle = theme.accent;
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '900 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BOSS P' + V9.bossPhase, 0, 1);
    } else if (cfg.useBugMeter){
      drawRoundRect(-70,-34,140,68,18);
      ctx.fillStyle = theme.accent + '55';
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '900 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BUG CORE', 0, -8);
      ctx.font = '900 13px Arial';
      ctx.fillText('FIX ' + V9.bugFixed + ' • ESC ' + V9.bugEscaped, 0, 14);
    } else if (cfg.useModelMeter){
      ctx.beginPath();
      ctx.arc(0,0,58,0,Math.PI*2);
      ctx.fillStyle = theme.accent + '44';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0,0,36,0,Math.PI*2);
      ctx.fillStyle = theme.accent;
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '900 13px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MODEL', 0, -8);
      ctx.font = '900 12px Arial';
      ctx.fillText(V9.modelScore + '/' + V9.modelTarget, 0, 12);
    } else if (cfg.useSpeedTimer){
      drawRoundRect(-82,-34,164,68,20);
      ctx.fillStyle = theme.accent + '55';
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '900 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SPEED', 0, -8);
      ctx.font = '900 13px Arial';
      ctx.fillText(V9.speedRunTimeLeft + 's • x' + V9.multiplier, 0, 14);
    }

    ctx.restore();
  }

  function teacherPassHash(pass){
    try{ return btoa(unescape(encodeURIComponent(pass || ''))); }
    catch(_){ return ''; }
  }

  function buildTeacherLink(){
    const url = new URL(window.location.href);
    const pass = readTrimmed(els.teacherPassInput);
    if (pass){
      localStorage.setItem(TEACHER_PASS_KEY, teacherPassHash(pass));
      url.searchParams.set('teacherKey', teacherPassHash(pass));
    }
    url.searchParams.set('teacher', '1');
    return url.toString();
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(_){
      return false;
    }
  }

  function openLeaderboard(){
    els.leaderboardWrap.classList.remove('hidden');
    fireAndForget(
      fetchGlobalLeaderboard().then(() => {
        renderLeaderboard();
        renderMenuTop3();
      }),
      'leaderboard_get'
    );
  }

  function openTeacher(){
    document.querySelector('.hud')?.classList.add('hidden');
    els.questionBox.classList.add('hidden');
    if (!lastSummary){
      try{
        const raw = JSON.parse(localStorage.getItem(TEACHER_KEY) || 'null');
        if (raw) renderTeacherDashboard(raw);
      }catch(_){}
    }
    els.teacherWrap.classList.remove('hidden');
  }

  function bootTeacherMode(){
    const q = new URLSearchParams(window.location.search);
    if (q.get('teacher') === '1'){
      const expected = localStorage.getItem(TEACHER_PASS_KEY) || '';
      const got = q.get('teacherKey') || '';
      if (expected && got !== expected){
        alert('Teacher passcode ไม่ถูกต้อง');
        return;
      }
      els.menu.classList.add('hidden');
      openTeacher();
    }
  }

  function renderLoopBattle(t){
    if (phase === 'countdown'){
      timeLeft = 1;
      els.questionBox.innerHTML =
        '<div class="q-meta">' + modeTheme().badge + '</div>' +
        '<div class="q-prompt">GET READY • ' + V9.countdown + '</div>';

      if (now() >= phaseUntil){
        V9.countdown -= 1;
        phaseUntil = now() + 650;
        if (V9.countdown <= 0){
          phase = 'battle';
          roundStart = now();
          const base = modeMeta().baseTime;
          const diffDuration =
            V9.runDifficulty === 'hard' ? Math.max(2800, base - 1600) :
            V9.runDifficulty === 'normal' ? Math.max(3600, base - 800) :
            base;
          const phasePenalty = V9.bossPhase === 3 ? 900 : V9.bossPhase === 2 ? 450 : 0;
          roundDuration = Math.max(2400, diffDuration - phasePenalty);
          renderQuestionBox(V9.currentItem);
        }
      }
    } else if (phase === 'battle'){
      const elapsed = now() - roundStart;
      timeLeft = clamp(1 - elapsed / roundDuration, 0, 1);

      if (modeConfig().useSpeedTimer){
        const elapsedSec = (now() - roundStart) / 1000;
        V9.speedRunTimeLeft = Math.max(0, 60 - Math.floor(elapsedSec + (V9.stageIndex * 0.2)));
      }

      if (modeConfig().useBoss && now() >= V9.bossAttackAt){
        const dmg = V9.bossPhase === 3 ? 2 : 1;
        V9.hp -= dmg;
        V9.combo = 0;
        V9.bossAttackAt = now() + bossAttackInterval();
        showFeedback('BOSS HIT -' + dmg + ' HP', 'warn');
        if (V9.hp <= 0){
          endRun();
          return;
        }
      }

      if (timeLeft <= 0){
        const cfg = modeConfig();
        let timeoutBefore = '';
        let timeoutAfter = '';

        if (V9.currentItem){
          timeoutBefore = ensureMastery(V9.currentItem.termId).level;
          updateMasteryAfterAnswer(V9.currentItem.termId, false, V9.currentItem.type);
          updateWordSkill(V9.currentItem.termId, false, roundDuration);
          timeoutAfter = ensureMastery(V9.currentItem.termId).level;
        }

        if (cfg.useBoss){
          const timeoutDmg = V9.bossPhase === 3 ? 2 : 1;
          V9.hp -= timeoutDmg;
          V9.combo = 0;
          enqueueReview(V9.currentItem.termId);
          showFeedback(modeFeedbackText('timeout'), 'warn');
        } else if (cfg.useBugMeter){
          V9.bugEscaped += 1;
          V9.hp -= 1;
          V9.combo = 0;
          enqueueReview(V9.currentItem.termId);
          showFeedback(modeFeedbackText('timeout'), 'warn');
        } else if (cfg.useModelMeter){
          V9.modelStability = Math.max(0, V9.modelStability - 15);
          V9.hp -= 1;
          V9.combo = 0;
          enqueueReview(V9.currentItem.termId);
          showFeedback(modeFeedbackText('timeout'), 'warn');
        } else if (cfg.useSpeedTimer){
          V9.multiplier = 1;
          V9.combo = 0;
          V9.hp -= 1;
          enqueueReview(V9.currentItem.termId);
          showFeedback(modeFeedbackText('timeout'), 'warn');
        }

        fireAndForget(sendTermAnswerRow({
          item: V9.currentItem,
          isCorrect: false,
          levelBefore: timeoutBefore,
          levelAfter: timeoutAfter,
          responseMs: roundDuration
        }), 'timeout_term_answer');

        fireAndForget(logEvent('timeout', {
          questionId: V9.currentItem?.id || '',
          termId: V9.currentItem?.termId || '',
          word: V9.currentItem?.term || '',
          questionType: V9.currentItem?.type || '',
          hp: V9.hp,
          stage: V9.stageIndex + 1,
          level: V9.currentItem?.level || '',
          mode: V9.mode,
          responseTimeMs: roundDuration,
          fromReview: !!V9.currentItem?.fromReview
        }), 'timeout_event');

        V9.stageIndex += 1;

        const state = checkModeWinLose();
        if (state === 'win' || state === 'lose'){
          endRun();
        } else {
          phase = 'feedback';
          phaseUntil = now() + 700;
        }
      }
    } else if (phase === 'feedback'){
      timeLeft = 0;
      if (now() >= phaseUntil) nextQuestionV9();
    } else {
      timeLeft = 1;
    }
  }

  const V9 = {
    bank: 'A',
    mode: 'code_battle',
    score: 0,
    combo: 0,
    hp: 5,
    bossHp: 320,
    bossMaxHp: 320,
    bossPhase: 1,
    bossAttackAt: 0,
    runDifficulty: 'easy',
    currentItem: null,
    usedVariantIds: new Set(),
    usedTermIds: [],
    reviewQueue: [],
    mastery: {},
    wordSkill: {},
    recentWords: [],
    recentQuestionTypes: [],
    bugEscaped: 0,
    bugFixed: 0,
    maxBugEscaped: 5,
    modelScore: 0,
    modelTarget: 100,
    modelStability: 100,
    speedRunTimeLeft: 60,
    multiplier: 1,
    stageIndex: 0,
    maxStages: 18,
    countdown: 3,
    _qStartTime: 0
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let mouseX = 0;
  let mouseY = 0;
  let hoveredId = null;
  let targets = [];
  let phase = 'idle';
  let phaseUntil = 0;
  let roundStart = 0;
  let roundDuration = 6000;
  let timeLeft = 1;
  let profile = { displayName: 'Player', studentId: '' };
  let lastSummary = null;
  let leaderboardOpenedFromEnd = false;
  let currentSessionId = null;
  let sessionStartedAt = null;
  let globalLeaderboardRows = loadLeaderboardCache();

  function resize(){
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop(t){
    requestAnimationFrame(loop);
    renderBackground(t);
    renderLoopBattle(t);
    updateTargets(t);
    renderTargets();
    renderHud();
  }

  document.querySelectorAll('.bankBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      V9.bank = btn.dataset.bank || 'A';
      document.querySelectorAll('.bankBtn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.querySelectorAll('.modeBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      V9.mode = btn.dataset.mode || 'code_battle';
      document.querySelectorAll('.modeBtn').forEach(b => b.classList.toggle('active', b === btn));
      renderHud();
    });
  });

  canvas.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  canvas.addEventListener('mousedown', e => {
    const hit = getTargetAtPoint(e.clientX, e.clientY);
    if (hit){
      hit.hitFlash = 1;
      handleAnswerV9(hit.rawText);
    }
  });

  canvas.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    if (!t) return;
    mouseX = t.clientX;
    mouseY = t.clientY;
    const hit = getTargetAtPoint(t.clientX, t.clientY);
    if (hit){
      hit.hitFlash = 1;
      handleAnswerV9(hit.rawText);
    }
  }, { passive:true });

  document.getElementById('startBtn').addEventListener('click', startProductionRun);
  document.getElementById('leaderboardBtn').addEventListener('click', () => {
    leaderboardOpenedFromEnd = false;
    openLeaderboard();
  });

  document.getElementById('generateTeacherLinkBtn').addEventListener('click', () => {
    els.teacherLinkOutput.value = buildTeacherLink();
  });

  document.getElementById('copyTeacherLinkBtn').addEventListener('click', async () => {
    if (!els.teacherLinkOutput.value) els.teacherLinkOutput.value = buildTeacherLink();
    const ok = await copyText(els.teacherLinkOutput.value);
    document.getElementById('copyTeacherLinkBtn').textContent = ok ? 'COPIED' : 'COPY FAILED';
    setTimeout(() => document.getElementById('copyTeacherLinkBtn').textContent = 'COPY LINK', 1200);
  });

  document.getElementById('closeTeacherLinkBtn').addEventListener('click', () => {
    els.teacherLinkWrap.classList.add('hidden');
  });

  document.getElementById('endPlayAgainBtn').addEventListener('click', () => {
    els.endWrap.classList.add('hidden');
    els.questionBox.classList.remove('hidden');
    startProductionRun();
  });

  document.getElementById('endLeaderboardBtn').addEventListener('click', () => {
    leaderboardOpenedFromEnd = true;
    els.endWrap.classList.add('hidden');
    openLeaderboard();
  });

  document.getElementById('endMenuBtn').addEventListener('click', () => {
    els.endWrap.classList.add('hidden');
    els.questionBox.classList.remove('hidden');
    els.menu.classList.remove('hidden');
  });

  document.getElementById('closeLeaderboardBtn').addEventListener('click', () => {
    els.leaderboardWrap.classList.add('hidden');
    if (leaderboardOpenedFromEnd || phase === 'ended'){
      els.endWrap.classList.remove('hidden');
      return;
    }
    els.menu.classList.remove('hidden');
  });

  document.getElementById('clearLeaderboardBtn').addEventListener('click', () => {
    globalLeaderboardRows = [];
    try{ localStorage.removeItem(GLOBAL_LB_CACHE_KEY); }catch(_){}
    renderLeaderboard();
    renderMenuTop3();
    alert('Global leaderboard ใช้ข้อมูลจาก Google Sheet ถ้าต้องการลบจริง ให้ลบที่ชีตหรือเพิ่ม action ลบใน Apps Script');
  });

  document.getElementById('closeTeacherBtn').addEventListener('click', () => {
    els.teacherWrap.classList.add('hidden');
    const q = new URLSearchParams(window.location.search);
    if (q.get('teacher') === '1'){
      const clean = new URL(window.location.href);
      clean.searchParams.delete('teacher');
      clean.searchParams.delete('teacherKey');
      window.location.href = clean.toString();
    }
  });

  document.getElementById('clearTeacherBtn').addEventListener('click', () => {
    try{ localStorage.removeItem(TEACHER_KEY); }catch(_){}
    els.teacherTable.innerHTML = '';
    els.weakList.innerHTML = '';
  });

  resize();
  loadProfile();
  renderLeaderboard();
  renderMenuTop3();
  renderHud();
  bootTeacherMode();

  fireAndForget(
    fetchGlobalLeaderboard().then(() => {
      renderLeaderboard();
      renderMenuTop3();
    }),
    'leaderboard_bootstrap'
  );

  requestAnimationFrame(loop);
  addEventListener('resize', resize);
})();
