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
    menuTop3Board: document.getElementById('menuTop3Board'),
    leaderboardList: document.getElementById('leaderboardList'),
    teacherTable: document.getElementById('teacherTable'),
    weakList: document.getElementById('weakList'),
    endSummaryText: document.getElementById('endSummaryText')
  };

  const LEADERBOARD_KEY = 'VOCAB_V9_LEADERBOARD';
  const TEACHER_KEY = 'VOCAB_V9_TEACHER_LAST';
  const PROFILE_KEY = 'VOCAB_V9_PROFILE';
  const SESSION_KEY = 'VOCAB_V9_SESSIONS';
  const TEACHER_PASS_KEY = 'VOCAB_V9_TEACHER_PASS_HASH';

  const VOCAB_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxSeCT2HSS5nEtG1n0NCVsOMQwtA6LAuVlhSKLMNkLYYr5IT0qWOGmQa_Wc-fCPYDqF/exec';
  const VOCAB_SHEET_SOURCE = 'vocab.html';
  const VOCAB_SHEET_SCHEMA = 'vocab-v2';

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

  function getContextMeta(){
    const q = new URLSearchParams(location.search);
    return {
      timestamp: bangkokIsoNow(),
      session_id: currentSessionId || '',
      display_name: profile.displayName || 'Player',
      student_id: profile.studentId || '',
      section: q.get('section') || localStorage.getItem('VOCAB_SECTION') || '',
      session_code: q.get('session_code') || q.get('sessionCode') || localStorage.getItem('VOCAB_SESSION_CODE') || '',
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

  function resize(){
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function now(){ return performance.now(); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function setText(el, value){ if (el) el.textContent = value; }

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random() * (i+1));
      [a[i],a[j]] = [a[j],a[i]];
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

  function loadProfile(){
    try{
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      profile.displayName = raw.displayName || 'Player';
      profile.studentId = raw.studentId || '';
      els.displayNameInput.value = profile.displayName === 'Player' ? '' : profile.displayName;
      els.studentIdInput.value = profile.studentId;
    }catch(e){}
  }

  function saveProfile(){
    profile.displayName = (els.displayNameInput.value || '').trim() || 'Player';
    profile.studentId = (els.studentIdInput.value || '').trim();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function ensureMastery(termId){
    if (!V9.mastery[termId]){
      V9.mastery[termId] = {
        level:'easy',
        streak:0,
        seen:0,
        correct:0,
        wrong:0,
        highestLevel:'easy',
        lastTypes:[]
      };
    }
    return V9.mastery[termId];
  }

  function ensureWordSkill(termId){
    if (!V9.wordSkill[termId]){
      V9.wordSkill[termId] = { score:0.5, seen:0, correct:0, wrong:0, avgRtMs:0 };
    }
    return V9.wordSkill[termId];
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

  function levelRank(level){ return level === 'easy' ? 1 : level === 'normal' ? 2 : 3; }
  function promoteLevel(level){ return level === 'easy' ? 'normal' : level === 'normal' ? 'hard' : 'hard'; }
  function demoteLevel(level){ return level === 'hard' ? 'normal' : level === 'normal' ? 'easy' : 'easy'; }

  function modeMeta(){
    return {
      code_battle: { damage:20, baseTime:6200, title:'CODE BATTLE' },
      debug_mission: { damage:16, baseTime:7000, title:'DEBUG MISSION' },
      ai_training: { damage:18, baseTime:6800, title:'AI TRAINING SIM' },
      speed_run: { damage:14, baseTime:4200, title:'SPEED RUN' }
    }[V9.mode];
  }

  function modeConfig(){
    return {
      code_battle: {
        useBoss:true, useBugMeter:false, useModelMeter:false, useSpeedTimer:false,
        questionWeights:{
          definition_mcq:3,sentence_cloze:3,context_mcq:2,scenario:2,correct_usage:2,th_to_en:1,en_to_th:1,confusion_pair:1
        }
      },
      debug_mission: {
        useBoss:false, useBugMeter:true, useModelMeter:false, useSpeedTimer:false,
        questionWeights:{
          correct_usage:5,confusion_pair:4,sentence_cloze:3,context_mcq:2,definition_mcq:1,th_to_en:1,en_to_th:0,scenario:1
        }
      },
      ai_training: {
        useBoss:false, useBugMeter:false, useModelMeter:true, useSpeedTimer:false,
        questionWeights:{
          scenario:5,context_mcq:4,definition_mcq:3,sentence_cloze:2,correct_usage:2,confusion_pair:1,th_to_en:1,en_to_th:1
        }
      },
      speed_run: {
        useBoss:false, useBugMeter:false, useModelMeter:false, useSpeedTimer:true,
        questionWeights:{
          th_to_en:4,en_to_th:4,definition_mcq:3,context_mcq:2,sentence_cloze:1,correct_usage:1,confusion_pair:0,scenario:0
        }
      }
    }[V9.mode];
  }

  function modeTheme(){
    return {
      code_battle: { accent:'#f472b6', accent2:'#67e8f9', badge:'⚔️ CODE BATTLE', bgTop:'#67d8ff', bgBottom:'#dbeafe', floor:'#dbeafe' },
      debug_mission: { accent:'#fb923c', accent2:'#fde047', badge:'🧪 DEBUG MISSION', bgTop:'#93c5fd', bgBottom:'#e0f2fe', floor:'#e2e8f0' },
      ai_training: { accent:'#a78bfa', accent2:'#67e8f9', badge:'🤖 AI TRAINING', bgTop:'#8b5cf6', bgBottom:'#dbeafe', floor:'#e9d5ff' },
      speed_run: { accent:'#22d3ee', accent2:'#f43f5e', badge:'⚡ SPEED RUN', bgTop:'#38bdf8', bgBottom:'#e0f2fe', floor:'#cffafe' }
    }[V9.mode];
  }

  function modeSummaryHint(){
    if (V9.mode === 'code_battle') return 'ฝึกใช้คำศัพท์แบบผสมในสถานการณ์ต่อสู้กับบอส';
    if (V9.mode === 'debug_mission') return 'ฝึกจับคำผิด การใช้คำให้ถูก และการแก้ bug เชิงภาษา';
    if (V9.mode === 'ai_training') return 'ฝึกศัพท์และบริบทด้าน AI/ML แบบใช้งานจริง';
    if (V9.mode === 'speed_run') return 'ฝึกตอบไว ทบทวนเร็ว และดึงคำศัพท์ออกมาใช้ทันที';
    return '';
  }

  function applyModeHudTheme(){
    const theme = modeTheme();
    document.querySelectorAll('.hud .card').forEach(card => {
      card.style.borderColor = theme.accent + '66';
      card.style.boxShadow = '0 10px 32px rgba(0,0,0,.26), 0 0 0 1px ' + theme.accent + '22';
    });
  }

  function modeFeedbackText(kind, value=''){
    if (V9.mode === 'code_battle'){
      if (kind === 'correct') return 'HIT +' + value;
      if (kind === 'wrong') return 'WRONG -' + value + ' HP';
      if (kind === 'timeout') return 'TIME OUT';
    }
    if (V9.mode === 'debug_mission'){
      if (kind === 'correct') return 'BUG FIXED';
      if (kind === 'wrong') return 'BUG ESCAPED';
      if (kind === 'timeout') return 'SYSTEM WARNING';
    }
    if (V9.mode === 'ai_training'){
      if (kind === 'correct') return 'MODEL IMPROVED +' + value;
      if (kind === 'wrong') return 'MODEL DRIFT';
      if (kind === 'timeout') return 'MODEL UNSTABLE';
    }
    if (V9.mode === 'speed_run'){
      if (kind === 'correct') return 'PERFECT x' + value;
      if (kind === 'wrong') return 'MISS';
      if (kind === 'timeout') return 'TOO SLOW';
    }
    return '';
  }

  function bossBaseHp(){
    const byMode = { code_battle:360, debug_mission:320, ai_training:340, speed_run:260 };
    return byMode[V9.mode] || 320;
  }

  function updateBossPhase(){
    if (!modeConfig().useBoss) return;
    const ratio = V9.bossMaxHp > 0 ? V9.bossHp / V9.bossMaxHp : 0;
    let nextPhase = 1;
    if (ratio <= 0.40) nextPhase = 3;
    else if (ratio <= 0.70) nextPhase = 2;

    if (nextPhase !== V9.bossPhase){
      V9.bossPhase = nextPhase;
      logEvent('phase_change', {
        phase: V9.bossPhase,
        bossHp: V9.bossHp,
        bossMaxHp: V9.bossMaxHp,
        stage: V9.stageIndex + 1
      });
      if (nextPhase === 2) showFeedback('BOSS PHASE 2', 'warn');
      if (nextPhase === 3) showFeedback('RAGE MODE', 'bad');
    }
  }

  function bossAttackInterval(){
    return V9.bossPhase === 1 ? 5200 : V9.bossPhase === 2 ? 4200 : 3200;
  }

  function bossPenaltyOnWrong(){
    return V9.bossPhase === 1 ? 1 : 2;
  }

  function bossDamageFromCorrect(){
    const base = modeMeta().damage;
    const comboBonus = Math.min(V9.combo * 2, 14);
    const phaseMod = V9.bossPhase === 3 ? -4 : V9.bossPhase === 2 ? -2 : 0;
    return Math.max(8, base - 6 + comboBonus + phaseMod);
  }

  function updateRunDifficulty(){
    if (V9.combo >= 8) V9.runDifficulty = 'hard';
    else if (V9.combo >= 4) V9.runDifficulty = 'normal';
    else V9.runDifficulty = 'easy';
    if (V9.hp <= 2 && V9.runDifficulty === 'hard') V9.runDifficulty = 'normal';
    if (V9.hp <= 1) V9.runDifficulty = 'easy';
  }

  function getAdaptiveDifficultyForWord(termId){
    const s = ensureWordSkill(termId);
    if (s.score < 0.35) return 'easy';
    if (s.score < 0.7) return 'normal';
    return 'hard';
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

  function enqueueReview(termId){
    if (!V9.reviewQueue.includes(termId)) V9.reviewQueue.push(termId);
  }

  function takeReviewTermId(){
    return V9.reviewQueue.length ? V9.reviewQueue.shift() : null;
  }

  function pushRecentWord(termId){
    V9.recentWords.push(termId);
    if (V9.recentWords.length > 5) V9.recentWords.shift();
  }

  function pushRecentQuestionType(type){
    V9.recentQuestionTypes.push(type);
    if (V9.recentQuestionTypes.length > 6) V9.recentQuestionTypes.shift();
  }

  function getWeakWordIds(limit=5){
    return Object.keys(V9.wordSkill)
      .sort((a,b) => ensureWordSkill(a).score - ensureWordSkill(b).score)
      .slice(0,limit);
  }

  function getCurrentBankTerms(){
    return VOCAB_BANKS[V9.bank] || [];
  }

  function pickNextTermObject(){
    const terms = getCurrentBankTerms();
    if (!terms.length) return null;

    const shouldUseReview = V9.stageIndex > 0 && V9.stageIndex % 4 === 0;
    if (shouldUseReview){
      const reviewId = takeReviewTermId();
      if (reviewId){
        const found = terms.find(t => t.id === reviewId);
        if (found) return { termObj: found, fromReview: true };
      }
    }

    if (V9.stageIndex > 0 && V9.stageIndex % 5 === 0){
      const weakIds = getWeakWordIds(5).filter(id => !V9.recentWords.includes(id));
      if (weakIds.length){
        const pickedWeak = terms.find(t => t.id === weakIds[0]);
        if (pickedWeak) return { termObj: pickedWeak, fromReview: false };
      }
    }

    let candidates = terms.filter(t => !V9.recentWords.includes(t.id));
    if (!candidates.length) candidates = terms.slice();

    candidates.sort((a,b) => ensureWordSkill(a.id).score - ensureWordSkill(b.id).score);
    const topPool = candidates.slice(0, Math.max(3, Math.ceil(candidates.length * 0.6)));
    const chosen = topPool[Math.floor(Math.random() * topPool.length)];
    return { termObj: chosen, fromReview: false };
  }

  function getModeWeightedVariants(pool){
    const weights = modeConfig().questionWeights || {};
    const filtered = pool.filter(v => (weights[v.type] || 0) > 0);
    return filtered.length ? filtered : pool;
  }

  function shouldSkipByMode(item){
    if (V9.mode === 'debug_mission') return item.type === 'en_to_th';
    if (V9.mode === 'speed_run') return item.type === 'scenario' || item.type === 'confusion_pair';
    return false;
  }

  function pickVariantForTerm(termObj){
    const adaptiveLevel = getAdaptiveDifficultyForWord(termObj.id);
    const pool = termObj.variants[adaptiveLevel] || [];
    const weights = modeConfig().questionWeights || {};

    let candidates = pool.filter(v => !V9.usedVariantIds.has(v.id));
    candidates = candidates.filter(v => !V9.recentQuestionTypes.includes(v.type));
    candidates = candidates.filter(v => !shouldSkipByMode(v));

    if (!candidates.length) candidates = pool.filter(v => !V9.usedVariantIds.has(v.id));
    if (!candidates.length) candidates = pool.slice();

    candidates = getModeWeightedVariants(candidates);

    const chosen = weightedPick(candidates, v => weights[v.type] || 0) || candidates[0];

    return Object.assign({}, chosen, {
      level: adaptiveLevel,
      termId: termObj.id,
      term: termObj.term,
      th: termObj.th,
      definition: termObj.definition,
      distractorPool: termObj.distractorPool
    });
  }

  function buildChoices(item){
    const bankTerms = getCurrentBankTerms();

    if (item.type === 'en_to_th'){
      const thaiPool = bankTerms.filter(t => t.id !== item.termId).map(t => t.th);
      return shuffle([item.answer].concat(thaiPool.slice(0,3)));
    }

    let distractors = (item.distractorPool || []).filter(d => d !== item.answer);
    distractors = distractors.slice(0,3);
    return shuffle([item.answer].concat(distractors));
  }

  function normalizeItemForMode(item){
    if (V9.mode !== 'speed_run') return item;
    const shortPromptMap = {
      th_to_en: `“${item.th}” คือคำว่าอะไร?`,
      en_to_th: `${item.term} แปลว่าอะไร?`,
      definition_mcq: item.definition,
      context_mcq: item.prompt,
      sentence_cloze: item.prompt
    };
    if (shortPromptMap[item.type]) item.prompt = shortPromptMap[item.type];
    return item;
  }

  function buildQuestionItem(){
    const picked = pickNextTermObject();
    if (!picked) return null;

    const termObj = picked.termObj;
    const fromReview = picked.fromReview;
    const variant = pickVariantForTerm(termObj);

    V9.usedVariantIds.add(variant.id);
    V9.usedTermIds.push(termObj.id);
    pushRecentWord(termObj.id);
    pushRecentQuestionType(variant.type);

    const item = Object.assign({}, variant, {
      fromReview,
      choices: buildChoices(variant)
    });

    return normalizeItemForMode(item);
  }

  function renderQuestionBox(item){
    const theme = modeTheme();
    const meta = theme.badge + ' • ' + item.type.toUpperCase() + ' • ' + item.level.toUpperCase() + (item.fromReview ? ' • REVIEW' : '');
    els.questionBox.innerHTML =
      '<div class="q-meta">' + meta + '</div>' +
      '<div class="q-prompt">' + item.prompt + '</div>';
    els.questionBox.style.borderColor = theme.accent;
    els.questionBox.style.boxShadow = '0 14px 30px rgba(0,0,0,.22), 0 0 0 2px ' + theme.accent + '22';
  }

  function showFeedback(text, kind){
    els.feedbackBox.textContent = text;
    els.feedbackBox.className = '';
    els.feedbackBox.id = 'feedbackBox';
    els.feedbackBox.classList.add('show', kind);
    setTimeout(() => { els.feedbackBox.classList.remove('show'); }, 650);
  }

  function renderHud(){
    const shownStage = Math.min(V9.stageIndex + 1, V9.maxStages);
    const cfg = modeConfig();

    setText(els.hudScore, 'Score ' + V9.score);
    setText(els.hudRound, 'Stage ' + shownStage + ' / ' + V9.maxStages);

    if (cfg.useBoss){
      setText(els.hudCombo, 'Combo x' + V9.combo);
      setText(els.hudMode, 'Difficulty ' + V9.runDifficulty.toUpperCase());
      setText(els.hudHp, 'HP ' + V9.hp + ' • Boss ' + Math.max(0, V9.bossHp) + '/' + V9.bossMaxHp);
      setText(els.hudState, 'BOSS • P' + V9.bossPhase);
    } else if (cfg.useBugMeter){
      setText(els.hudCombo, 'Fixed ' + V9.bugFixed);
      setText(els.hudMode, 'Escaped ' + V9.bugEscaped + '/' + V9.maxBugEscaped);
      setText(els.hudHp, 'HP ' + V9.hp);
      setText(els.hudState, 'DEBUG MISSION');
    } else if (cfg.useModelMeter){
      setText(els.hudCombo, 'Model ' + V9.modelScore + '/' + V9.modelTarget);
      setText(els.hudMode, 'Stability ' + V9.modelStability + '%');
      setText(els.hudHp, 'HP ' + V9.hp);
      setText(els.hudState, 'AI TRAINING');
    } else if (cfg.useSpeedTimer){
      setText(els.hudCombo, 'x' + V9.multiplier + ' MULTI');
      setText(els.hudMode, 'Time ' + V9.speedRunTimeLeft + 's');
      setText(els.hudHp, 'HP ' + V9.hp);
      setText(els.hudState, 'SPEED RUN');
    }

    setText(
      els.hudPrompt,
      V9.currentItem ? (V9.currentItem.term.toUpperCase() + ' • ' + modeMeta().title) : 'Contextual learning • adaptive difficulty • review queue'
    );

    els.timeFill.style.transform = 'scaleX(' + timeLeft + ')';
    applyModeHudTheme();
  }

  function spawnTargetsFromChoices(choices){
    const c = center();
    const mobile = width < 860;
    const theme = modeTheme();

    if (mobile){
      const ys = [height * 0.40, height * 0.54, height * 0.68, height * 0.82];
      targets = choices.map((choice, i) => ({
        id: 'target_' + i + '_' + Date.now(),
        text: String(choice).toUpperCase(),
        rawText: String(choice).toLowerCase(),
        x: c.x,
        y: ys[i] || (height * 0.4 + i * 90),
        angle: 0,
        radiusBase: 0,
        radiusPulse: 0,
        speed: 0,
        w: Math.min(320, width * 0.76),
        h: 74,
        scale: 1,
        z: 1,
        color: [theme.accent2, theme.accent, '#fde047', '#ffffff'][i % 4],
        hitFlash: 0,
        mobile: true
      }));
      return;
    }

    targets = choices.map((choice, i) => {
      const angle = (Math.PI * 2 / choices.length) * i;
      return {
        id: 'target_' + i + '_' + Date.now(),
        text: String(choice).toUpperCase(),
        rawText: String(choice).toLowerCase(),
        x: c.x + Math.cos(angle) * 180,
        y: c.y + Math.sin(angle) * 50,
        angle,
        radiusBase: 180,
        radiusPulse: 20,
        speed: 0.012 + i * 0.002,
        w: 250,
        h: 84,
        scale: 1,
        z: 0.8,
        color: [theme.accent2, theme.accent, '#fde047', '#ffffff'][i % 4],
        hitFlash: 0,
        mobile: false
      };
    });
  }

  function updateTargets(time){
    const c = center();
    hoveredId = null;

    targets.forEach((t, i) => {
      if (!t.mobile){
        t.angle += t.speed;
        const radius = t.radiusBase + Math.sin(time * 0.002 + i) * t.radiusPulse;
        t.x = c.x + Math.cos(t.angle) * radius;
        t.y = c.y + Math.sin(t.angle * 1.8 + time * 0.0013) * 44;
        t.z = 0.75 + (Math.sin(t.angle * 1.3 + time * 0.001) + 1) * 0.15;
        t.scale = 1 + (t.z - 0.75) * 0.7;
      }
      t.hitFlash = Math.max(0, t.hitFlash - 0.05);
      if (pointInTarget(mouseX, mouseY, t)) hoveredId = t.id;
    });
  }

  function drawRoundRect(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  function wrapText(text, cx, cy, maxW, maxLines, fs){
    ctx.font = '800 ' + fs + 'px Arial';
    const words = String(text).split(' ');
    const lines = [];
    let line = '';

    for (const word of words){
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);

    const use = lines.slice(0, maxLines);
    const lh = fs * 1.16;
    const sy = cy - ((use.length - 1) * lh) / 2;
    use.forEach((ln, i) => ctx.fillText(ln, cx, sy + i * lh));
  }

  function renderTargets(){
    const sorted = targets.slice().sort((a,b) => a.z - b.z);

    sorted.forEach(t => {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);

      ctx.globalAlpha = 0.28 + t.hitFlash * 0.4;
      ctx.beginPath();
      ctx.arc(0,0,68,0,Math.PI*2);
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.lineWidth = hoveredId === t.id ? 8 : 6;
      ctx.strokeStyle = t.color;

      const w = t.mobile ? t.w : 250;
      const h = t.mobile ? t.h : 84;

      drawRoundRect(-w/2, -h/2, w, h, 20);
      ctx.stroke();

      drawRoundRect(-w/2 + 10, -h/2 + 8, w - 20, h - 16, 16);
      ctx.fillStyle = hoveredId === t.id ? '#fff7ed' : '#fff';
      ctx.fill();

      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 ' + (t.mobile ? 20 : (hoveredId === t.id ? 28 : 26)) + 'px Arial';
      wrapText(t.text, 0, 0, w - 40, 2, t.mobile ? 20 : 26);
      ctx.restore();
    });
  }

  function pointInTarget(x, y, t){
    const w = t.w * t.scale;
    const h = t.h * t.scale;
    return x >= t.x - w/2 && x <= t.x + w/2 && y >= t.y - h/2 && y <= t.y + h/2;
  }

  function getTargetAtPoint(x, y){
    const sorted = targets.slice().sort((a,b) => b.z - a.z);
    return sorted.find(t => pointInTarget(x, y, t)) || null;
  }

  function getWeakestTerms(limit){
    return Object.entries(V9.mastery)
      .sort((a,b) => {
        const wrongDiff = b[1].wrong - a[1].wrong;
        if (wrongDiff !== 0) return wrongDiff;
        return a[1].correct - b[1].correct;
      })
      .slice(0, limit);
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

  function saveSessionLocal(payload){
    const rows = JSON.parse(localStorage.getItem(SESSION_KEY) || '[]');
    rows.push(payload);
    localStorage.setItem(SESSION_KEY, JSON.stringify(rows.slice(-1000)));
  }

  async function saveSessionRealtime(action, payload){
    saveSessionLocal({ action, ...payload });

    const envelope = {
      source: VOCAB_SHEET_SOURCE,
      schema: VOCAB_SHEET_SCHEMA,
      action,
      timestamp: bangkokIsoNow(),
      payload
    };

    try{
      const res = await fetch(VOCAB_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(envelope),
        keepalive: true
      });

      return {
        ok: res.ok,
        status: res.status,
        payload
      };
    }catch(err){
      console.warn('Sheet upload failed; kept local only', err);
      return {
        ok: false,
        error: String(err),
        payload
      };
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
    try{
      await saveSessionRealtime(type, payload);
    }catch(err){
      console.error('logEvent failed', err);
    }
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

    try{
      await saveSessionRealtime('term_answer', {
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
    }catch(err){
      console.error('sendTermAnswerRow failed', err);
    }
  }

  async function logGameEntry(){
    currentSessionId = createSessionId();
    sessionStartedAt = bangkokIsoNow();

    const meta = getContextMeta();

    try{
      await saveSessionRealtime('session_start', {
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
    }catch(err){
      console.error('saveSessionRealtime start failed', err);
    }
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

    try{
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
    }catch(err){
      console.error('saveSessionRealtime end failed', err);
    }
  }

  function loadLeaderboard(){
    try{ return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]'); }
    catch(e){ return []; }
  }

  function saveLeaderboard(rows){
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(rows.slice(0,200)));
  }

  function leaderboardKeyOf(entry){
    const sid = String(entry.studentId || '').trim();
    const name = String(entry.displayName || '').trim();
    return sid || name || 'anonymous';
  }

  function bestUniqueLeaderboard(rows){
    const bestMap = new Map();

    rows.forEach(entry => {
      const key = leaderboardKeyOf(entry);
      const prev = bestMap.get(key);
      if (!prev){
        bestMap.set(key, entry);
        return;
      }
      const prevScore = Number(prev.score || 0);
      const nextScore = Number(entry.score || 0);
      const prevAcc = Number(prev.accuracy || 0);
      const nextAcc = Number(entry.accuracy || 0);
      if (nextScore > prevScore || (nextScore === prevScore && nextAcc > prevAcc)){
        bestMap.set(key, entry);
      }
    });

    return Array.from(bestMap.values()).sort((a,b) => {
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const accDiff = Number(b.accuracy || 0) - Number(a.accuracy || 0);
      if (accDiff !== 0) return accDiff;
      return String(a.displayName || '').localeCompare(String(b.displayName || ''));
    });
  }

  function buildRealtimeEntryFromSummary(summary){
    const totalSeen = Object.values(summary.mastery).reduce((s,m) => s + m.seen, 0);
    const totalCorrect = Object.values(summary.mastery).reduce((s,m) => s + m.correct, 0);
    const accuracy = totalSeen ? Math.round((totalCorrect / totalSeen) * 100) : 0;
    const weakest = summary.weakestTerms.map(([term]) => term).join('|');

    return {
      uid: 'anon-' + Math.random().toString(36).slice(2,10),
      displayName: profile.displayName || 'Player',
      studentId: profile.studentId || '',
      bank: V9.bank,
      mode: V9.mode,
      score: summary.score,
      accuracy,
      weakestTerm: weakest,
      when: new Date().toISOString()
    };
  }

  function pushLeaderboardEntry(entry){
    const rows = loadLeaderboard();
    rows.push(entry);
    saveLeaderboard(rows);
    renderMenuTop3();
  }

  function renderMenuTop3(){
    const rows = bestUniqueLeaderboard(loadLeaderboard()).slice(0,3);
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
        '<div class="name">' + (r.displayName || 'Player') + '</div>' +
        '<div class="meta">Best Score ' + (r.score || 0) + '</div>' +
        '<div class="meta">Accuracy ' + (r.accuracy || 0) + '%</div>';
      els.menuTop3Board.appendChild(div);
    });
  }

  function renderLeaderboard(){
    const rows = bestUniqueLeaderboard(loadLeaderboard());
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
        '<strong>#' + (i+1) + ' ' + (r.displayName || 'Player') + '</strong>' +
        '<div class="small mono">Best Score ' + (r.score || 0) +
        ' • Accuracy ' + (r.accuracy || 0) +
        '% • Bank ' + (r.bank || '-') +
        ' • Mode ' + (r.mode || '-') +
        ' • ' + (r.when || '-') + '</div>';
      els.leaderboardList.appendChild(li);
    });
  }

  function renderTeacherDashboard(summary){
    localStorage.setItem(TEACHER_KEY, JSON.stringify(summary));
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

  async function endRun(){
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
    await logGameEnd(summary);

    const entry = buildRealtimeEntryFromSummary(summary);
    pushLeaderboardEntry(entry);

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
  }

  async function handleAnswerV9(selectedText){
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

    await sendTermAnswerRow({
      item,
      isCorrect,
      levelBefore,
      levelAfter,
      responseMs: rt
    });

    await logEvent(isCorrect ? 'answer_correct' : 'answer_wrong', {
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
    });

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

    logEvent('question_shown', {
      questionId: item.id || '',
      termId: item.termId,
      word: item.term,
      questionType: item.type,
      choices: item.choices,
      level: item.level,
      fromReview: item.fromReview,
      stage: V9.stageIndex + 1,
      modeWeight: (modeConfig().questionWeights || {})[item.type] || 0
    });

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

  async function startProductionRun(){
    document.querySelector('.hud')?.classList.remove('hidden');
    els.questionBox.classList.remove('hidden');
    saveProfile();
    els.menu.classList.add('hidden');
    els.endWrap.classList.add('hidden');
    await logGameEntry();
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
    catch(e){ return ''; }
  }

  function buildTeacherLink(){
    const url = new URL(window.location.href);
    const pass = (els.teacherPassInput.value || '').trim();
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
    }catch(e){
      return false;
    }
  }

  function openLeaderboard(){
    renderLeaderboard();
    els.leaderboardWrap.classList.remove('hidden');
  }

  function openTeacher(){
    document.querySelector('.hud')?.classList.add('hidden');
    els.questionBox.classList.add('hidden');
    if (!lastSummary){
      try{
        const raw = JSON.parse(localStorage.getItem(TEACHER_KEY) || 'null');
        if (raw) renderTeacherDashboard(raw);
      }catch(e){}
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

        sendTermAnswerRow({
          item: V9.currentItem,
          isCorrect: false,
          levelBefore: timeoutBefore,
          levelAfter: timeoutAfter,
          responseMs: roundDuration
        });

        logEvent('timeout', {
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
        });

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
    localStorage.removeItem(LEADERBOARD_KEY);
    renderLeaderboard();
    renderMenuTop3();
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
    localStorage.removeItem(TEACHER_KEY);
    els.teacherTable.innerHTML = '';
    els.weakList.innerHTML = '';
  });

  resize();
  loadProfile();
  renderLeaderboard();
  renderMenuTop3();
  renderHud();
  bootTeacherMode();
  requestAnimationFrame(loop);
  addEventListener('resize', resize);
})();
