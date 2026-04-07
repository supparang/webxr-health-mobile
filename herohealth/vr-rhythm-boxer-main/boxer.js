(() => {
  'use strict';

  const qs = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtTime = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;

  const qbool = (name, d = false) => {
    const v = String(qs.get(name, d ? '1' : '0')).toLowerCase();
    return ['1','true','yes','on','y'].includes(v);
  };

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const params = {
    pid: qs.get('pid') || 'anon',
    nick: qs.get('nick') || '',
    mode: (qs.get('mode') || 'active').toLowerCase(),
    diff: (qs.get('diff') || 'normal').toLowerCase(),
    durSec: clamp(Number(qs.get('dur') || 120), 30, 600),
    bpm: clamp(Number(qs.get('bpm') || 112), 72, 180),
    view: (qs.get('view') || 'mobile').toLowerCase(),
    seed: qs.get('seed') || String(Date.now()),
    hub: qs.get('hub') || '../hub.html'
  };

  const PLAN_DAY = qs.get('planDay') || '';
  const PLAN_SLOT = qs.get('planSlot') || '';
  const STUDY_ID = qs.get('studyId') || '';
  const CLASSROOM = qs.get('classRoom') || qs.get('classroom') || '';
  const STUDENT_NO = qs.get('studentNo') || '';
  const SCHOOL_CODE = qs.get('schoolCode') || '';
  const NICK_NAME = qs.get('nickName') || params.nick || '';
  const TEACHER_MODE = qbool('teacher', false) || qbool('teacherMode', false);
  const EXPORT_MODE = qbool('export', false) || qbool('exportMode', false);
  const AUTO_NEXT = qbool('autoNext', false);

  document.body.setAttribute('data-view', params.view);

  const ACTIONS = {
    jab:   { lane: 0, label: 'Jab',   icon: '👊', key: 'KeyA', alt: 'ArrowLeft'  },
    cross: { lane: 1, label: 'Cross', icon: '💥', key: 'KeyL', alt: 'ArrowRight' },
    block: { lane: 2, label: 'Block', icon: '🛡', key: 'KeyW', alt: 'ArrowUp'    },
    duck:  { lane: 3, label: 'Duck',  icon: '⬇', key: 'KeyS', alt: 'ArrowDown'  }
  };

  const WINDOWS = {
    perfect: 80,
    great: 140,
    good: 220
  };

  const beatMs = 60000 / params.bpm;
  const totalMs = params.durSec * 1000;
  const travelMs = params.view === 'pc' ? 1500 : (params.view === 'cvr' ? 1700 : 1600);
  const startDelayMs = 3000;
  const rng = mulberry32(xmur3(`${params.seed}|${params.pid}|${params.mode}|${params.diff}`)());

  const els = {
    subline: $('subline'),
    btnBackHubTop: $('btnBackHubTop'),
    btnBackHubBottom: $('btnBackHubBottom'),

    bridgePid: $('bridgePid'),
    bridgePlanDay: $('bridgePlanDay'),
    bridgePlanSlot: $('bridgePlanSlot'),
    bridgeStudyId: $('bridgeStudyId'),

    scoreValue: $('scoreValue'),
    comboValue: $('comboValue'),
    accValue: $('accValue'),
    timeValue: $('timeValue'),

    coachText: $('coachText'),

    aiFatigue: $('aiFatigue'),
    aiSkill: $('aiSkill'),
    aiSuggest: $('aiSuggest'),
    aiTip: $('aiTip'),
    aiTipWrap: $('aiTipWrap'),

    playMissionScore: $('playMissionScore'),
    playMissionCombo: $('playMissionCombo'),
    playMissionAcc: $('playMissionAcc'),
    playMissionNoMiss: $('playMissionNoMiss'),
    playMissionBoss: $('playMissionBoss'),

    feverFill: $('feverFill'),
    feverText: $('feverText'),
    shieldText: $('shieldText'),
    bossStat: $('bossStat'),
    bossFill: $('bossFill'),
    bossText: $('bossText'),

    arena: $('arena'),
    hitLine: $('hitLine'),
    laneHitRow: $('laneHitRow'),
    noteLayer: $('noteLayer'),
    countdownLayer: $('countdownLayer'),
    countdownNum: $('countdownNum'),
    phaseBanner: $('phaseBanner'),
    feedbackPop: $('feedbackPop'),
    pcHint: $('pcHint'),

    cvrStage: $('cvrStage'),
    cvrEyeL: $('cvrEyeL'),
    cvrEyeR: $('cvrEyeR'),
    cvrHitLineL: $('cvrHitLineL'),
    cvrHitLineR: $('cvrHitLineR'),
    cvrNoteLayerL: $('cvrNoteLayerL'),
    cvrNoteLayerR: $('cvrNoteLayerR'),
    cvrCountdownLayer: $('cvrCountdownLayer'),
    cvrCountdownNum: $('cvrCountdownNum'),
    cvrFeedbackPop: $('cvrFeedbackPop'),
    cvrCrosshair: $('cvrCrosshair'),
    cvrFocusLabel: $('cvrFocusLabel'),
    cvrPermissionOverlay: $('cvrPermissionOverlay'),
    btnCvrAllowMotion: $('btnCvrAllowMotion'),
    btnCvrDemoMode: $('btnCvrDemoMode'),
    cvrCalibOverlay: $('cvrCalibOverlay'),
    cvrCalibText: $('cvrCalibText'),
    cvrCalibGaugeFill: $('cvrCalibGaugeFill'),
    btnCvrCalibStart: $('btnCvrCalibStart'),
    btnCvrRecenterNow: $('btnCvrRecenterNow'),

    summaryOverlay: $('summaryOverlay'),
    sumScore: $('sumScore'),
    sumAcc: $('sumAcc'),
    sumCombo: $('sumCombo'),
    summaryGrade: $('summaryGrade'),
    sumStars: $('sumStars'),
    sumMedal: $('sumMedal'),
    sumBadge: $('sumBadge'),
    sumMissionScore: $('sumMissionScore'),
    sumMissionCombo: $('sumMissionCombo'),
    sumMissionAcc: $('sumMissionAcc'),
    sumMissionNoMiss: $('sumMissionNoMiss'),
    sumBossClear: $('sumBossClear'),
    teacherPanel: $('teacherPanel'),
    teacherQuality: $('teacherQuality'),
    teacherBlankRate: $('teacherBlankRate'),
    teacherOffsetMean: $('teacherOffsetMean'),
    teacherOffsetStd: $('teacherOffsetStd'),
    teacherNote: $('teacherNote'),
    btnReplay: $('btnReplay'),
    btnCooldown: $('btnCooldown'),
    btnDlEvents: $('btnDlEvents'),
    btnDlSessions: $('btnDlSessions'),
    btnDlJson: $('btnDlJson')
  };

  const laneEls = [...document.querySelectorAll('.lane')];
  const laneHitButtons = [...document.querySelectorAll('.lane-hit')];

  const state = {
    started: false,
    ended: false,
    startAt: performance.now() + startDelayMs,
    totalNotes: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    blankTap: 0,
    offsets: [],

    notes: [],
    currentPhase: 'warmup',

    fever: 0,
    feverOn: false,
    shield: 0,
    lastComboBurstAt: 0,

    boss: {
      active: false,
      hp: 0,
      hpMax: 24,
      clear: false
    },

    mission: {
      score1:false,
      combo1:false,
      acc1:false,
      noMiss:false,
      bossClear:false,
      stars:0
    },

    ai: {
      fatigue: 0,
      skill: 0.5,
      suggest: 'normal',
      tip: ''
    },

    aiLastTipAt: 0,
    events: [],
    lastSummaryPayload: null,

    currentCvrLane: 0,
    lastFeedbackHideAt: 0,

    _lastTickAt: 0,
    _runCountdownArmed: params.view !== 'cvr',
    _cvrPermissionResolved: false,
    _cvrPermissionGranted: false,
    _cvrDemoMode: false,
    _cvrCalibrationState: 'idle',
    _cvrCalibrationSamples: [],
    _cvrCalibrationEndAt: 0,
    _cvrGamma: 0,
    _cvrGammaOffset: 0,
    _cvrGammaSmoothed: 0,
    _cvrLaneLockUntil: 0,
    _cvrLastCueAt: 0
  };

  const isTouchPrimary =
    params.view === 'mobile' ||
    ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) && params.view !== 'pc');

  els.subline.textContent = `${params.view.toUpperCase()} • ${params.mode.toUpperCase()} • ${params.diff.toUpperCase()} • ${params.bpm} BPM`;
  els.btnBackHubTop.href = params.hub;
  els.btnBackHubBottom.href = params.hub;

  function sessionMeta(){
    return {
      tsIso: new Date().toISOString(),
      pid: params.pid,
      nickName: NICK_NAME,
      studyId: STUDY_ID,
      classRoom: CLASSROOM,
      studentNo: STUDENT_NO,
      schoolCode: SCHOOL_CODE,
      planDay: PLAN_DAY,
      planSlot: PLAN_SLOT,
      diff: params.diff,
      mode: params.mode,
      run: qs.get('run') || 'play',
      seed: params.seed,
      bpm: params.bpm,
      durationSec: params.durSec,
      view: params.view,
      zone: qs.get('zone') || 'fitness',
      cat: qs.get('cat') || 'fitness',
      game: 'rhythmboxer',
      teacherMode: TEACHER_MODE ? 1 : 0,
      exportMode: EXPORT_MODE ? 1 : 0
    };
  }

  function setCoach(text){
    if(els.coachText) els.coachText.textContent = text || '';
  }

  function currentFeedbackEl(){
    return params.view === 'cvr' ? els.cvrFeedbackPop : els.feedbackPop;
  }

  function showFeedback(text){
    const el = currentFeedbackEl();
    if(!el) return;
    el.textContent = text;
    el.className = `${el.id === 'cvrFeedbackPop' ? 'cvr-feedback-pop' : 'feedback-pop'} show`;
    state.lastFeedbackHideAt = performance.now() + 360;
  }

  function clearFeedback(now){
    if(state.lastFeedbackHideAt && now >= state.lastFeedbackHideAt){
      state.lastFeedbackHideAt = 0;

      if(els.feedbackPop){
        els.feedbackPop.className = 'feedback-pop';
        els.feedbackPop.textContent = '';
      }
      if(els.cvrFeedbackPop){
        els.cvrFeedbackPop.className = 'cvr-feedback-pop';
        els.cvrFeedbackPop.textContent = '';
      }
    }
  }

  function updateBridgeStrip(){
    if(els.bridgePid) els.bridgePid.textContent = params.pid || 'anon';
    if(els.bridgePlanDay) els.bridgePlanDay.textContent = PLAN_DAY || '—';
    if(els.bridgePlanSlot) els.bridgePlanSlot.textContent = PLAN_SLOT || '—';
    if(els.bridgeStudyId) els.bridgeStudyId.textContent = STUDY_ID || '—';
  }

  function logEvent(ev){
    state.events.push({
      ...sessionMeta(),
      ...ev
    });
  }

  function mean(arr){
    if(!arr || !arr.length) return null;
    let s = 0;
    for(const x of arr) s += x;
    return s / arr.length;
  }

  function median(arr){
    if(!arr || !arr.length) return null;
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function std(arr){
    if(!arr || arr.length < 2) return null;
    const m = mean(arr);
    let s = 0;
    for(const x of arr){
      const d = x - m;
      s += d * d;
    }
    return Math.sqrt(s / (arr.length - 1));
  }

  function scoreFor(result, combo){
    const base = { perfect: 100, great: 72, good: 44, miss: 0 }[result] || 0;
    const comboBonus = Math.min(60, Math.floor(combo / 5) * 6);
    return base + comboBonus;
  }

  function judgeFromOffset(offsetMs){
    const a = Math.abs(offsetMs);
    if(a <= WINDOWS.perfect) return 'perfect';
    if(a <= WINDOWS.great) return 'great';
    if(a <= WINDOWS.good) return 'good';
    return 'miss';
  }

  function computeAccuracyPercent(){
    if(state.totalNotes <= 0) return 0;
    const weighted = (state.perfect * 1.0) + (state.great * 0.8) + (state.good * 0.55);
    return Math.round((weighted / state.totalNotes) * 100);
  }

  function computeGrade(acc){
    const perfectRate = state.totalNotes > 0 ? (state.perfect / state.totalNotes) * 100 : 0;
    const comboScore = Math.min(100, state.maxCombo * 2.2);
    const weighted = (acc * 0.74) + (perfectRate * 0.16) + (comboScore * 0.10);
    if(weighted >= 90) return 'S';
    if(weighted >= 80) return 'A';
    if(weighted >= 70) return 'B';
    if(weighted >= 58) return 'C';
    return 'D';
  }

  function comboBurst(text){
    const mount = params.view === 'cvr' ? els.cvrStage : els.arena;
    if(!mount) return;
    const el = document.createElement('div');
    el.className = 'combo-burst';
    el.textContent = text;
    mount.appendChild(el);
    setTimeout(() => el.remove(), 620);
  }

  function addFever(result){
    let inc = 0;
    if(result === 'perfect') inc = 9;
    else if(result === 'great') inc = 6;
    else if(result === 'good') inc = 3;

    state.fever = clamp(state.fever + inc, 0, 100);
    if(state.fever >= 100){
      state.feverOn = true;
      state.fever = 100;
    }
  }

  function drainFever(dt){
    if(!state.feverOn) return;
    state.fever = clamp(state.fever - dt * 0.022, 0, 100);
    if(state.fever <= 0){
      state.feverOn = false;
      state.fever = 0;
    }
  }

  function maybeGainShield(){
    if(state.combo > 0 && state.combo % 15 === 0){
      const prev = state.shield;
      state.shield = clamp(state.shield + 1, 0, 3);
      if(state.shield > prev){
        comboBurst('Shield +1');
      }
    }
  }

  function updateCombatHud(){
    if(els.feverFill) els.feverFill.style.width = `${clamp(state.fever, 0, 100)}%`;
    if(els.feverText) els.feverText.textContent = state.feverOn ? 'ON' : `${Math.round(state.fever)}%`;
    if(els.shieldText) els.shieldText.textContent = String(state.shield);

    if(params.view === 'cvr'){
      if(els.cvrStage) els.cvrStage.classList.toggle('fever-mode', !!state.feverOn);
    } else {
      if(els.arena) els.arena.classList.toggle('fever-mode', !!state.feverOn);
    }

    if(els.bossStat){
      els.bossStat.classList.toggle('hidden', !state.boss.active);
    }

    if(els.bossFill){
      const pct = state.boss.hpMax > 0 ? clamp((state.boss.hp / state.boss.hpMax) * 100, 0, 100) : 0;
      els.bossFill.style.width = `${pct}%`;
    }

    if(els.bossText){
      els.bossText.textContent = state.boss.active ? `${Math.max(0, state.boss.hp)}/${state.boss.hpMax}` : '—';
    }
  }

  function updateMissionState(){
    const acc = computeAccuracyPercent();

    const scoreTarget =
      params.mode === 'cardio' ? 5000 :
      params.mode === 'active' ? 4000 : 2800;

    const comboTarget =
      params.diff === 'challenge' ? 24 :
      params.diff === 'normal' ? 18 : 14;

    const accTarget =
      params.diff === 'easy' ? 78 :
      params.diff === 'challenge' ? 84 : 82;

    state.mission.score1 = state.score >= scoreTarget;
    state.mission.combo1 = state.maxCombo >= comboTarget;
    state.mission.acc1 = acc >= accTarget;
    state.mission.noMiss = state.miss === 0 && (state.perfect + state.great + state.good) > 0;
    state.mission.bossClear = !!state.boss.clear;

    state.mission.stars =
      (state.mission.score1 ? 1 : 0) +
      (state.mission.combo1 ? 1 : 0) +
      (state.mission.acc1 ? 1 : 0);
  }

  function updateMissionStrip(){
    const setChip = (el, done, doneText, todoText = '⭐') => {
      if(!el) return;
      el.classList.toggle('done', !!done);
      const strong = el.querySelector('strong');
      if(strong) strong.textContent = done ? doneText : todoText;
    };

    setChip(els.playMissionScore, state.mission.score1, '✅');
    setChip(els.playMissionCombo, state.mission.combo1, '✅');
    setChip(els.playMissionAcc, state.mission.acc1, '✅');
    setChip(els.playMissionNoMiss, state.mission.noMiss, '✅', '—');
    setChip(els.playMissionBoss, state.mission.bossClear, '✅', '—');
  }

  function computeReward(){
    updateMissionState();

    let medal = 'Bronze';
    if(state.mission.stars >= 3) medal = 'Gold';
    else if(state.mission.stars === 2) medal = 'Silver';

    let badge = '-';
    if(state.mission.bossClear && state.mission.noMiss) badge = 'Boss No-Miss';
    else if(state.mission.bossClear) badge = 'Boss Clear';
    else if(state.mission.noMiss) badge = 'No-Miss';
    else if(state.maxCombo >= 30) badge = 'Combo Hero';
    else if(computeAccuracyPercent() >= 90) badge = 'Timing Star';
    else if(state.ai.skill >= 0.8) badge = 'Rhythm Kid';

    return {
      stars: Math.max(1, state.mission.stars || 1),
      medal,
      badge
    };
  }

  function updateAiHud(){
    if(els.aiFatigue) els.aiFatigue.textContent = `${Math.round((state.ai.fatigue || 0) * 100)}%`;
    if(els.aiSkill) els.aiSkill.textContent = `${Math.round((state.ai.skill || 0.5) * 100)}%`;
    if(els.aiSuggest) els.aiSuggest.textContent = state.ai.suggest || 'normal';

    if(els.aiTip && els.aiTipWrap){
      if(state.ai.tip){
        els.aiTip.textContent = state.ai.tip;
        els.aiTipWrap.classList.remove('hidden');
      } else {
        els.aiTip.textContent = '';
        els.aiTipWrap.classList.add('hidden');
      }
    }
  }

  function updateAI(){
    const judged = state.perfect + state.great + state.good + state.miss;
    const missRate = judged > 0 ? state.miss / judged : 0;
    const blankRate = (judged + state.blankTap) > 0 ? state.blankTap / (judged + state.blankTap) : 0;

    const offAbs = state.offsets.slice(-24).map(x => Math.abs(x));
    const offMed = median(offAbs);
    const timingScore = offMed == null ? 0.5 : clamp(1 - (offMed / 160), 0, 1);

    const acc = computeAccuracyPercent() / 100;
    const skill = clamp((acc * 0.58) + (timingScore * 0.42), 0, 1);

    const fatigueBase =
      (missRate * 0.52) +
      (blankRate * 0.23) +
      ((params.mode === 'cardio' ? 0.08 : 0.0)) +
      ((state.currentPhase === 'boss' && missRate > 0.18) ? 0.08 : 0.0);

    const fatigue = clamp(fatigueBase, 0, 1);

    let suggest = 'normal';
    if(fatigue > 0.72) suggest = 'easy';
    else if(skill > 0.78 && fatigue < 0.42) suggest = 'hard';

    const now = performance.now();
    let tip = state.ai.tip || '';

    if(now - state.aiLastTipAt > 6200){
      if(blankRate > 0.18){
        tip = params.view === 'cvr'
          ? 'อย่ารีบยิง รอจังหวะให้เข้าเส้นก่อน'
          : 'รอให้โน้ตแตะเส้นก่อนค่อยกด จะช่วยให้แม่นขึ้น';
      } else if(offMed != null && offMed > 95){
        tip = 'จังหวะยังแกว่งนิดหน่อย ลองคุมจังหวะให้ช้าลงนิด';
      } else if(state.currentPhase === 'boss'){
        tip = 'ช่วงบอส ไม่ต้องรีบ เลือกจังหวะที่ชัวร์';
      } else if(state.maxCombo >= 18){
        tip = 'คอมโบเริ่มสวยแล้ว รักษาจังหวะนี้ไว้';
      } else if(fatigue > 0.7){
        tip = 'ถ้าเริ่มล้า ให้ผ่อนก่อนนิดหนึ่ง';
      } else {
        tip = '';
      }

      state.ai.tip = tip;
      state.aiLastTipAt = now;
    }

    state.ai.fatigue = fatigue;
    state.ai.skill = skill;
    state.ai.suggest = suggest;

    updateAiHud();
  }

  function startBossBattle(){
    if(state.boss.active) return;

    state.boss.active = true;
    state.boss.clear = false;
    state.boss.hpMax =
      params.diff === 'challenge' ? 28 :
      params.diff === 'easy' ? 20 : 24;

    state.boss.hp = state.boss.hpMax;
    comboBurst('BOSS ROUND!');
    updateCombatHud();
  }

  function endBossBattle(clear){
    if(!state.boss.active && !clear) return;
    state.boss.active = false;
    state.boss.clear = !!clear;
    if(clear){
      comboBurst('BOSS CLEAR!');
    }
    updateMissionState();
    updateMissionStrip();
    updateCombatHud();
  }

  function hitBossByJudge(result, note){
    if(!note || note.phase !== 'boss') return;
    if(!state.boss.active) return;

    let dmg = 0;
    if(result === 'perfect') dmg = 4;
    else if(result === 'great') dmg = 3;
    else if(result === 'good') dmg = 2;
    if(dmg <= 0) return;

    state.boss.hp = Math.max(0, state.boss.hp - dmg);
    comboBurst(`Boss -${dmg}`);

    if(state.boss.hp <= 0){
      endBossBattle(true);
    } else {
      updateCombatHud();
    }
  }

  function phaseOfElapsed(elapsed){
    if(elapsed < totalMs * 0.18) return 'warmup';
    if(elapsed < totalMs * 0.78) return 'main';
    return 'boss';
  }

  function applyPhase(phase){
    if(state.currentPhase === phase) return;
    state.currentPhase = phase;

    if(phase === 'warmup'){
      els.phaseBanner.textContent = 'Warmup';
      setCoach(params.view === 'cvr' ? 'ค่อย ๆ ล็อกเป้าก่อน' : 'เริ่มจับจังหวะก่อน');
    } else if(phase === 'main'){
      els.phaseBanner.textContent = 'Main';
      setCoach(params.view === 'cvr' ? 'เล็ง lane แล้วค่อยยิง' : 'ดู pattern แล้วเล่นต่อเนื่อง');
    } else {
      els.phaseBanner.textContent = 'Boss';
      startBossBattle();
      setCoach(params.view === 'cvr' ? 'รอบบอสแล้ว! เล็งให้ชัวร์' : 'รอบบอสแล้ว! กดให้แม่น');
    }
  }

  function buildTeacherQualityMetrics(){
    const judged = state.perfect + state.great + state.good + state.miss;
    const blankRate = (judged + state.blankTap) > 0
      ? (state.blankTap / (judged + state.blankTap)) * 100
      : 0;

    const offAbs = state.offsets.filter(Number.isFinite).map(v => Math.abs(v));
    const offMean = mean(offAbs);
    const offStd = std(offAbs);

    let quality = 'Good';
    if(blankRate > 18 || (offMean != null && offMean > 95)) quality = 'Fair';
    if(blankRate > 28 || (offMean != null && offMean > 120)) quality = 'Needs Review';

    return {
      blankRate,
      offMean,
      offStd,
      quality
    };
  }

  function buildTeacherNote(metrics){
    const notes = [];

    if(metrics.quality === 'Needs Review'){
      notes.push('ข้อมูลมีความเสี่ยงต่อการกดมั่วหรือจังหวะแกว่งสูง');
    } else if(metrics.quality === 'Fair'){
      notes.push('ข้อมูลใช้ได้ แต่ยังมี blank tap หรือ timing แกว่งพอสมควร');
    } else {
      notes.push('ข้อมูลค่อนข้างนิ่งและเหมาะกับการใช้สรุปผล');
    }

    if(state.mission.noMiss) notes.push('ผู้เล่นจบรอบโดยไม่ miss');
    if(state.mission.bossClear) notes.push('ผ่าน boss phase');
    if(state.ai.fatigue > 0.7) notes.push('มีสัญญาณล้าค่อนข้างสูงระหว่างเล่น');
    if(state.maxCombo >= 20) notes.push('รักษาคอมโบได้ดี');
    if(computeAccuracyPercent() >= 90) notes.push('ความแม่นโดยรวมสูง');

    return notes.join(' • ');
  }

  function downloadText(filename, text, mime = 'text/plain;charset=utf-8'){
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  function toCSV(rows, cols){
    const esc = (v) => {
      v = (v == null) ? '' : String(v);
      if(/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };

    return [
      cols.join(','),
      ...rows.map(r => cols.map(c => esc(r[c])).join(','))
    ].join('\n') + '\n';
  }

  function downloadEventsCSV(){
    const cols = [
      'tsIso','pid','nickName','studyId','classRoom','studentNo','schoolCode',
      'planDay','planSlot','diff','mode','run','seed','bpm','durationSec','view','zone','cat','game',
      'eventType','noteId','action','phase','hitTimeMs','inputElapsedMs','offsetMs','result','combo','score'
    ];
    downloadText(
      `rb_main_events_${params.pid}_${Date.now()}.csv`,
      toCSV(state.events, cols),
      'text/csv;charset=utf-8'
    );
  }

  function downloadSessionsCSV(){
    const summary = state.lastSummaryPayload?.summary;
    if(!summary) return;

    const cols = [
      'tsIso','pid','nickName','studyId','classRoom','studentNo','schoolCode',
      'planDay','planSlot','diff','mode','run','seed','bpm','durationSec','view','zone','cat','game',
      'score','accuracy','maxCombo','perfect','great','good','miss','blankTap',
      'grade','stars','medal','badge',
      'missionScore','missionCombo','missionAcc','missionNoMiss','bossClear',
      'blankTapRate','offsetAbsMeanMs','offsetAbsStdMs','dataQuality','teacherNote'
    ];

    const row = { ...sessionMeta(), ...summary };

    downloadText(
      `rb_main_sessions_${params.pid}_${Date.now()}.csv`,
      toCSV([row], cols),
      'text/csv;charset=utf-8'
    );
  }

  function downloadSummaryJSON(){
    if(!state.lastSummaryPayload) return;
    downloadText(
      `rb_main_summary_${params.pid}_${Date.now()}.json`,
      JSON.stringify(state.lastSummaryPayload, null, 2),
      'application/json;charset=utf-8'
    );
  }

  function buildCooldownUrl(){
    const url = new URL('../warmup-gate.html', location.href);
    url.searchParams.set('phase', 'cooldown');
    url.searchParams.set('gatePhase', 'cooldown');
    url.searchParams.set('zone', qs.get('zone') || 'fitness');
    url.searchParams.set('cat', qs.get('cat') || 'fitness');
    url.searchParams.set('game', 'rhythmboxer');
    url.searchParams.set('gameId', 'rhythmboxer');
    url.searchParams.set('theme', 'rhythmboxer');
    url.searchParams.set('pid', params.pid || 'anon');
    url.searchParams.set('run', qs.get('run') || 'play');
    url.searchParams.set('diff', params.diff || 'normal');
    url.searchParams.set('time', String(params.durSec || 120));
    url.searchParams.set('seed', String(params.seed || Date.now()));
    url.searchParams.set('view', params.view || 'mobile');
    url.searchParams.set('hub', params.hub || '../hub.html');
    url.searchParams.set('cdur', String(qs.get('cdur') || '20'));

    if(PLAN_DAY) url.searchParams.set('planDay', PLAN_DAY);
    if(PLAN_SLOT) url.searchParams.set('planSlot', PLAN_SLOT);
    if(STUDY_ID) url.searchParams.set('studyId', STUDY_ID);
    if(CLASSROOM) url.searchParams.set('classRoom', CLASSROOM);
    if(STUDENT_NO) url.searchParams.set('studentNo', STUDENT_NO);
    if(SCHOOL_CODE) url.searchParams.set('schoolCode', SCHOOL_CODE);

    return url.toString();
  }

  function makePattern(label, steps){
    const maxBeat = Math.max(...steps.map(s => s.beat));
    return { label, steps, len: maxBeat + 1 };
  }

  const POOLS = {
    warmup: [
      makePattern('Jab', [{ action:'jab', beat:0 }]),
      makePattern('Cross', [{ action:'cross', beat:0 }]),
      makePattern('Block', [{ action:'block', beat:0 }]),
      makePattern('Duck', [{ action:'duck', beat:0 }]),
      makePattern('Jab → Cross', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }])
    ],
    main: [
      makePattern('Jab → Cross', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }]),
      makePattern('Block → Cross', [{ action:'block', beat:0 }, { action:'cross', beat:1 }]),
      makePattern('Jab → Duck → Cross', [{ action:'jab', beat:0 }, { action:'duck', beat:1 }, { action:'cross', beat:2 }]),
      makePattern('Jab → Cross → Block', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }, { action:'block', beat:2 }]),
      makePattern('Duck → Jab → Cross', [{ action:'duck', beat:0 }, { action:'jab', beat:1 }, { action:'cross', beat:2 }])
    ],
    boss: [
      makePattern('Jab → Cross → Block', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }, { action:'block', beat:2 }]),
      makePattern('Jab → Duck → Cross → Block', [{ action:'jab', beat:0 }, { action:'duck', beat:1 }, { action:'cross', beat:2 }, { action:'block', beat:3 }]),
      makePattern('Block → Jab → Cross → Duck', [{ action:'block', beat:0 }, { action:'jab', beat:1 }, { action:'cross', beat:2 }, { action:'duck', beat:3 }]),
      makePattern('Jab → Cross → Duck → Cross', [{ action:'jab', beat:0 }, { action:'cross', beat:1 }, { action:'duck', beat:2 }, { action:'cross', beat:3 }])
    ]
  };

  function choosePattern(phase){
    const pool = phase === 'warmup' ? POOLS.warmup : (phase === 'boss' ? POOLS.boss : POOLS.main);

    if(params.diff === 'easy' && phase !== 'boss'){
      return pool[Math.floor(rng() * Math.min(pool.length, 3))];
    }

    if(params.diff === 'challenge' && phase === 'boss'){
      return pool[Math.floor(rng() * pool.length)];
    }

    return pool[Math.floor(rng() * pool.length)];
  }

  function generateSchedule(){
    const notes = [];
    let t = 1500;
    let id = 1;

    while(t < totalMs - 800){
      const phase = t < totalMs * 0.18 ? 'warmup' : (t < totalMs * 0.78 ? 'main' : 'boss');
      const pattern = choosePattern(phase);

      for(const step of pattern.steps){
        const hitTime = t + (step.beat * beatMs);
        if(hitTime >= totalMs - 240) continue;

        notes.push({
          id:`n${id++}`,
          action: step.action,
          lane: ACTIONS[step.action].lane,
          hitTime,
          spawnTime: hitTime - travelMs,
          judged:false,
          result:'',
          phase
        });
      }

      t += (pattern.len + (phase === 'boss' ? 0.45 : 0.72) + rng() * 0.2) * beatMs;
    }

    state.totalNotes = notes.length;
    return notes.sort((a,b) => a.hitTime - b.hitTime);
  }

  function currentCountdownEls(){
    if(params.view === 'cvr'){
      return {
        layer: els.cvrCountdownLayer,
        num: els.cvrCountdownNum
      };
    }
    return {
      layer: els.countdownLayer,
      num: els.countdownNum
    };
  }

  function removeNoteEl(note){
    if(note.el && note.el.parentNode) note.el.parentNode.removeChild(note.el);
    if(note.elL && note.elL.parentNode) note.elL.parentNode.removeChild(note.elL);
    if(note.elR && note.elR.parentNode) note.elR.parentNode.removeChild(note.elR);
    note.el = null;
    note.elL = null;
    note.elR = null;
  }

  function makeNoteNode(action){
    const el = document.createElement('div');
    el.className = `note note--${action}`;
    el.innerHTML = `<div class="note-icon">${ACTIONS[action].icon}</div>`;
    return el;
  }

  function buildNoteEl(note){
    if(params.view === 'cvr'){
      note.elL = makeNoteNode(note.action);
      note.elR = makeNoteNode(note.action);
      els.cvrNoteLayerL.appendChild(note.elL);
      els.cvrNoteLayerR.appendChild(note.elR);
      return;
    }

    note.el = makeNoteNode(note.action);
    els.noteLayer.appendChild(note.el);
  }

  function layoutNoteInViewport(noteEl, lane, elapsed, spawnTime, hitTime, viewportRect, hitLineRect){
    const lineY = hitLineRect.top - viewportRect.top + (hitLineRect.height / 2);
    const laneWidth = viewportRect.width / 4;
    const laneCenterX = (laneWidth * lane) + (laneWidth / 2);

    const progress = (elapsed - spawnTime) / (hitTime - spawnTime);
    const clamped = clamp(progress, -0.35, 1.18);
    const easedCore = clamp(progress, 0, 1);
    const eased = 1 - Math.pow(1 - easedCore, 2.1);

    const startY = 28;
    const y = progress < 0
      ? startY + (lineY - startY) * clamped
      : startY + (lineY - startY) * eased;

    noteEl.style.left = `${laneCenterX}px`;
    noteEl.style.transform = `translate(-50%, ${y}px) scale(${0.86 + eased * 0.18})`;

    if(elapsed < spawnTime - 120) noteEl.style.display = 'none';
    else noteEl.style.display = '';
  }

  function layoutNote(note, elapsed){
    if(params.view === 'cvr'){
      if(note.elL){
        layoutNoteInViewport(
          note.elL,
          note.lane,
          elapsed,
          note.spawnTime,
          note.hitTime,
          els.cvrEyeL.getBoundingClientRect(),
          els.cvrHitLineL.getBoundingClientRect()
        );
      }

      if(note.elR){
        layoutNoteInViewport(
          note.elR,
          note.lane,
          elapsed,
          note.spawnTime,
          note.hitTime,
          els.cvrEyeR.getBoundingClientRect(),
          els.cvrHitLineR.getBoundingClientRect()
        );
      }
      return;
    }

    if(note.el){
      layoutNoteInViewport(
        note.el,
        note.lane,
        elapsed,
        note.spawnTime,
        note.hitTime,
        els.arena.getBoundingClientRect(),
        els.hitLine.getBoundingClientRect()
      );
    }
  }

  function nearestNote(action, elapsed){
    let best = null;
    let bestAbs = Infinity;

    for(const n of state.notes){
      if(n.action !== action || n.judged) continue;
      const abs = Math.abs(elapsed - n.hitTime);
      if(abs <= WINDOWS.good && abs < bestAbs){
        best = n;
        bestAbs = abs;
      }
    }
    return best;
  }

  function pressAction(action){
    if(state.ended || !state.started) return;

    const elapsed = performance.now() - state.startAt;
    const note = nearestNote(action, elapsed);

    if(note){
      const offset = elapsed - note.hitTime;
      const result = judgeFromOffset(offset);

      if(result !== 'miss'){
        note.judged = true;
        note.result = result;
        removeNoteEl(note);

        state.offsets.push(offset);
        state.combo += 1;
        state.maxCombo = Math.max(state.maxCombo, state.combo);

        if(result === 'perfect') state.perfect += 1;
        else if(result === 'great') state.great += 1;
        else state.good += 1;

        const mult = state.feverOn ? 1.25 : 1.0;
        state.score += Math.round(scoreFor(result, state.combo) * mult);

        addFever(result);
        maybeGainShield();
        hitBossByJudge(result, note);

        showFeedback(state.feverOn ? `${result.toUpperCase()} x1.25` : result.toUpperCase());

        if(state.combo > 0 && state.combo % 10 === 0 && (performance.now() - state.lastComboBurstAt > 800)){
          state.lastComboBurstAt = performance.now();
          comboBurst(`${state.combo} COMBO!`);
        }

        logEvent({
          eventType: 'hit',
          noteId: note.id,
          action,
          phase: note.phase,
          hitTimeMs: Math.round(note.hitTime),
          inputElapsedMs: Math.round(elapsed),
          offsetMs: Math.round(offset),
          result,
          combo: state.combo,
          score: Math.round(state.score)
        });

        updateMissionState();
        updateMissionStrip();
        updateCombatHud();
        updateAI();
        return;
      }
    }

    state.blankTap += 1;

    if(state.shield > 0){
      state.shield -= 1;
      comboBurst('Shield Save!');
      showFeedback('SHIELD');
    } else {
      state.miss += 1;
      state.combo = 0;
      showFeedback('MISS');
    }

    logEvent({
      eventType: 'blank_tap',
      noteId: '',
      action,
      phase: state.currentPhase,
      hitTimeMs: '',
      inputElapsedMs: Math.round(elapsed),
      offsetMs: '',
      result: 'miss',
      combo: state.combo,
      score: Math.round(state.score)
    });

    updateMissionState();
    updateMissionStrip();
    updateCombatHud();
    updateAI();
  }

  function updateHUD(elapsed){
    if(els.scoreValue) els.scoreValue.textContent = String(Math.round(state.score));
    if(els.comboValue) els.comboValue.textContent = String(state.combo);
    if(els.accValue) els.accValue.textContent = `${computeAccuracyPercent()}%`;

    const secLeft = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
    if(els.timeValue) els.timeValue.textContent = fmtTime(secLeft);
  }

  function cvrActions(){
    return ['jab', 'cross', 'block', 'duck'];
  }

  function cvrLaneFromGamma(gamma){
    const g = clamp(gamma, -40, 40);
    if(g < -20) return 0;
    if(g < 0) return 1;
    if(g < 20) return 2;
    return 3;
  }

  function setCvrAimSide(lane){
    const side = lane <= 1 ? 'left' : 'right';
    if(els.cvrEyeL) els.cvrEyeL.classList.toggle('aim-left', side === 'left');
    if(els.cvrEyeR) els.cvrEyeR.classList.toggle('aim-right', side === 'right');
    if(els.cvrEyeL) els.cvrEyeL.classList.toggle('focus-boost', side === 'left');
    if(els.cvrEyeR) els.cvrEyeR.classList.toggle('focus-boost', side === 'right');
  }

  function cueCvrUpcomingNotes(elapsed){
    if(params.view !== 'cvr') return;
    const cueWindowStart = 120;
    const cueWindowEnd = 300;
    const now = performance.now();

    if(now - state._cvrLastCueAt < 90) return;

    const upcoming = state.notes.find((n) =>
      !n.judged &&
      (n.hitTime - elapsed) >= cueWindowStart &&
      (n.hitTime - elapsed) <= cueWindowEnd
    );

    if(!upcoming) return;

    const action = upcoming.action;
    const laneAction = cvrActions()[state.currentCvrLane] || 'jab';

    document.querySelectorAll('.cvr-lane').forEach((el) => {
      if(el.dataset.action === action){
        el.classList.add('is-cue');
        setTimeout(() => el.classList.remove('is-cue'), 140);
      }
    });

    if(laneAction === action && els.cvrCrosshair){
      els.cvrCrosshair.animate(
        [
          { transform:'translate(-50%,-50%) scale(.92)', opacity:.72 },
          { transform:'translate(-50%,-50%) scale(1.08)', opacity:1 },
          { transform:'translate(-50%,-50%) scale(1)', opacity:1 }
        ],
        { duration:160, easing:'ease-out' }
      );
    }

    state._cvrLastCueAt = now;
  }

  function updateCvrFocus(){
    if(params.view !== 'cvr') return;

    const labelByLane = ['JAB', 'CROSS', 'BLOCK', 'DUCK'];
    if(els.cvrFocusLabel){
      els.cvrFocusLabel.textContent = labelByLane[state.currentCvrLane] || 'JAB';
      els.cvrFocusLabel.classList.toggle('is-boss', state.currentPhase === 'boss');
    }

    const actions = cvrActions();
    const currentAction = actions[state.currentCvrLane] || 'jab';

    document.querySelectorAll('.cvr-lane').forEach((el) => {
      el.classList.toggle('is-focus', el.dataset.action === currentAction);
    });

    setCvrAimSide(state.currentCvrLane);
  }

  function recenterCvr(){
    if(params.view !== 'cvr') return;
    state._cvrGammaOffset = state._cvrGammaSmoothed || state._cvrGamma || 0;
    showFeedback('RECENTER');
  }

  function hideCvrOverlays(){
    if(els.cvrPermissionOverlay) els.cvrPermissionOverlay.classList.add('hidden');
    if(els.cvrCalibOverlay) els.cvrCalibOverlay.classList.add('hidden');
  }

  function showCvrPermissionOverlay(){
    hideCvrOverlays();
    if(els.cvrPermissionOverlay) els.cvrPermissionOverlay.classList.remove('hidden');
  }

  function showCvrCalibrationOverlay(){
    hideCvrOverlays();
    if(els.cvrCalibOverlay) els.cvrCalibOverlay.classList.remove('hidden');
    if(els.cvrCalibText) els.cvrCalibText.textContent = 'มองตรงกลางให้สบาย แล้วกดเริ่ม calibration';
    if(els.cvrCalibGaugeFill) els.cvrCalibGaugeFill.style.width = '0%';
    state._cvrCalibrationState = 'idle';
  }

  function armRunCountdown(){
    state._runCountdownArmed = true;
    state.startAt = performance.now() + startDelayMs;
    hideCvrOverlays();
    showFeedback('READY');
  }

  function beginCvrCalibration(){
    state._cvrCalibrationSamples = [];
    state._cvrCalibrationEndAt = performance.now() + 1200;
    state._cvrCalibrationState = 'sampling';
    if(els.cvrCalibText) els.cvrCalibText.textContent = 'ค้างศีรษะให้นิ่งไว้สักครู่...';
    if(els.cvrCalibGaugeFill) els.cvrCalibGaugeFill.style.width = '0%';
  }

  function avg(arr){
    if(!arr || !arr.length) return 0;
    let s = 0;
    for(const v of arr) s += v;
    return s / arr.length;
  }

  function updateCvrCalibration(now){
    if(params.view !== 'cvr') return;
    if(state._cvrCalibrationState !== 'sampling') return;

    state._cvrCalibrationSamples.push(state._cvrGammaSmoothed || state._cvrGamma || 0);

    const total = 1200;
    const done = clamp((now - (state._cvrCalibrationEndAt - total)) / total, 0, 1);
    if(els.cvrCalibGaugeFill) els.cvrCalibGaugeFill.style.width = `${Math.round(done * 100)}%`;

    if(now >= state._cvrCalibrationEndAt){
      state._cvrGammaOffset = avg(state._cvrCalibrationSamples);
      state._cvrCalibrationState = 'done';
      if(els.cvrCalibText) els.cvrCalibText.textContent = 'Calibration สำเร็จแล้ว กำลังเริ่มเกม...';
      if(els.cvrCalibGaugeFill) els.cvrCalibGaugeFill.style.width = '100%';

      setTimeout(() => {
        armRunCountdown();
      }, 260);
    }
  }

  async function requestCvrMotionPermission(){
    if(params.view !== 'cvr') return;

    const needsPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';

    if(!needsPermission){
      state._cvrPermissionResolved = true;
      state._cvrPermissionGranted = true;
      showCvrCalibrationOverlay();
      return;
    }

    try{
      const result = await DeviceOrientationEvent.requestPermission();
      state._cvrPermissionResolved = true;
      state._cvrPermissionGranted = (result === 'granted');

      if(state._cvrPermissionGranted){
        showCvrCalibrationOverlay();
      } else {
        state._cvrDemoMode = true;
        showCvrCalibrationOverlay();
      }
    }catch(_){
      state._cvrPermissionResolved = true;
      state._cvrDemoMode = true;
      showCvrCalibrationOverlay();
    }
  }

  function initCvrFlow(){
    state._runCountdownArmed = false;

    const needsPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';

    if(needsPermission){
      showCvrPermissionOverlay();
    } else {
      state._cvrPermissionResolved = true;
      state._cvrPermissionGranted = true;
      showCvrCalibrationOverlay();
    }
  }

  function applyViewMode(){
    const isPc = params.view === 'pc';
    const isMobile = params.view === 'mobile';
    const isCvr = params.view === 'cvr';

    if(els.laneHitRow) els.laneHitRow.classList.toggle('hidden', !isMobile);
    if(els.cvrStage) els.cvrStage.classList.toggle('hidden', !isCvr);
    if(els.cvrCrosshair) els.cvrCrosshair.classList.toggle('hidden', !isCvr);
    if(els.cvrFocusLabel) els.cvrFocusLabel.classList.toggle('hidden', !isCvr);
    if(els.pcHint) els.pcHint.classList.toggle('hidden', !isPc);
    if(els.arena) els.arena.classList.toggle('hidden', isCvr);

    if(isPc){
      setCoach('กด A / L / W / S ตามจังหวะ');
    } else if(isMobile){
      setCoach('แตะในช่องตอนโน้ตถึงเส้น');
    } else {
      setCoach('หันเล็งช่องด้วยหัว แล้วแตะหรือกด trigger');
    }

    if(els.btnCooldown){
      const showCooldown = qbool('cooldown', true) || isCvr;
      els.btnCooldown.classList.toggle('hidden', !showCooldown);
      if(showCooldown) els.btnCooldown.href = buildCooldownUrl();
    }
  }

  function bindPcInput(){
    window.addEventListener('keydown', (ev) => {
      if(ev.repeat) return;
      const action = Object.keys(ACTIONS).find((k) => ACTIONS[k].key === ev.code || ACTIONS[k].alt === ev.code);
      if(action){
        ev.preventDefault();
        pressAction(action);
      }
    });
  }

  function bindMobileInput(){
    laneHitButtons.forEach((btn) => {
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        pressAction(action);
      });
      btn.addEventListener('touchstart', (ev) => {
        ev.preventDefault();
        pressAction(action);
      }, { passive:false });
    });
  }

  function bindCvrInput(){
    let lastTriggerAt = 0;

    state._cvrGamma = 0;
    state._cvrGammaOffset = 0;
    state._cvrGammaSmoothed = 0;
    state._cvrLaneLockUntil = 0;

    if(window.DeviceOrientationEvent){
      window.addEventListener('deviceorientation', (ev) => {
        if(typeof ev.gamma === 'number') state._cvrGamma = ev.gamma;
      });
    }

    window.addEventListener('mousemove', (ev) => {
      if(params.view !== 'cvr') return;
      const ratio = ev.clientX / Math.max(1, window.innerWidth);
      state._cvrGamma = (ratio * 80) - 40;
    });

    function updateLaneFromGamma(){
      const raw = state._cvrGamma || 0;
      state._cvrGammaSmoothed += (raw - state._cvrGammaSmoothed) * 0.14;

      const g = clamp(state._cvrGammaSmoothed - (state._cvrGammaOffset || 0), -40, 40);
      const nextLane = cvrLaneFromGamma(g);
      const now = performance.now();

      if(now >= state._cvrLaneLockUntil && nextLane !== state.currentCvrLane){
        state.currentCvrLane = nextLane;
        state._cvrLaneLockUntil = now + 90;
        updateCvrFocus();
      } else if(now >= state._cvrLaneLockUntil){
        updateCvrFocus();
      }

      requestAnimationFrame(updateLaneFromGamma);
    }
    updateLaneFromGamma();

    function trigger(ev){
      if(ev) ev.preventDefault();
      const now = performance.now();
      if(now - lastTriggerAt < 220) return;
      lastTriggerAt = now;

      const actions = cvrActions();
      pressAction(actions[state.currentCvrLane] || 'jab');
    }

    window.addEventListener('hha:shoot', trigger);
    window.addEventListener('pointerdown', trigger, { passive:false });

    window.addEventListener('keydown', (ev) => {
      if(ev.code === 'Space' || ev.code === 'Enter'){
        ev.preventDefault();
        trigger();
      }
      if(ev.code === 'KeyR'){
        ev.preventDefault();
        recenterCvr();
      }
    });

    window.addEventListener('hha:recenter', () => {
      recenterCvr();
    });
  }

  function attachInputs(){
    if(params.view === 'pc'){
      bindPcInput();
      return;
    }
    if(params.view === 'mobile'){
      bindMobileInput();
      return;
    }
    bindCvrInput();
  }

  function updateCountdown(now){
    if(params.view === 'cvr' && !state._runCountdownArmed){
      if(els.countdownLayer) els.countdownLayer.classList.add('hidden');
      if(els.cvrCountdownLayer) els.cvrCountdownLayer.classList.add('hidden');
      return;
    }

    const elsCd = currentCountdownEls();
    const remain = state.startAt - now;

    if(remain <= 0){
      if(els.countdownLayer) els.countdownLayer.classList.add('hidden');
      if(els.cvrCountdownLayer) els.cvrCountdownLayer.classList.add('hidden');

      if(!state.started){
        state.started = true;
        setCoach(
          params.view === 'pc' ? 'กด A / L / W / S ตามจังหวะ'
          : params.view === 'mobile' ? 'แตะในช่องตอนโน้ตถึงเส้น'
          : 'หันเล็งช่องด้วยหัว แล้วแตะหรือกด trigger'
        );
      }
      return;
    }

    if(elsCd.layer) elsCd.layer.classList.remove('hidden');
    if(elsCd.num) elsCd.num.textContent = String(Math.ceil(remain / 1000));
  }

  function buildTeacherPanel(summary){
    const showTeacher = TEACHER_MODE || EXPORT_MODE || !!STUDY_ID;
    if(!els.teacherPanel) return;

    els.teacherPanel.classList.toggle('hidden', !showTeacher);

    if(showTeacher){
      if(els.teacherQuality) els.teacherQuality.textContent = summary.dataQuality || 'Good';
      if(els.teacherBlankRate) els.teacherBlankRate.textContent = `${summary.blankTapRate}%`;
      if(els.teacherOffsetMean) els.teacherOffsetMean.textContent =
        summary.offsetAbsMeanMs == null ? '-' : `${summary.offsetAbsMeanMs} ms`;
      if(els.teacherOffsetStd) els.teacherOffsetStd.textContent =
        summary.offsetAbsStdMs == null ? '-' : `${summary.offsetAbsStdMs} ms`;
      if(els.teacherNote) els.teacherNote.textContent = summary.teacherNote || '—';
    }
  }

  function nearestPhaseLabel(phase){
    if(phase === 'warmup') return 'Warmup';
    if(phase === 'main') return 'Main';
    return 'Boss';
  }

  function tick(now){
    if(params.view === 'cvr'){
      updateCvrCalibration(now);
    }

    updateCountdown(now);
    clearFeedback(now);

    if(!state.started){
      updateHUD(0);
      requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - state.startAt;
    const dt = Math.max(0, now - (state._lastTickAt || now));
    state._lastTickAt = now;

    drainFever(dt);
    applyPhase(phaseOfElapsed(elapsed));
    updateHUD(elapsed);

    for(const note of state.notes){
      if(note.judged) continue;

      if(elapsed > note.hitTime + WINDOWS.good){
        note.judged = true;
        note.result = 'miss';

        if(state.shield > 0){
          state.shield -= 1;
          comboBurst('Shield Save!');
        } else {
          state.miss += 1;
          state.combo = 0;
        }

        logEvent({
          eventType: 'auto_miss',
          noteId: note.id,
          action: note.action,
          phase: nearestPhaseLabel(note.phase),
          hitTimeMs: Math.round(note.hitTime),
          inputElapsedMs: '',
          offsetMs: '',
          result: 'miss',
          combo: state.combo,
          score: Math.round(state.score)
        });

        removeNoteEl(note);
        continue;
      }

      layoutNote(note, elapsed);
    }

    if(params.view === 'cvr'){
      cueCvrUpcomingNotes(elapsed);
      updateCvrFocus();
    }

    updateMissionState();
    updateMissionStrip();
    updateCombatHud();
    updateAI();

    if(elapsed >= totalMs){
      if(state.boss.active && state.boss.hp <= 0){
        endBossBattle(true);
      }
      endGame();
      return;
    }

    requestAnimationFrame(tick);
  }

  function endGame(){
    if(state.ended) return;
    state.ended = true;

    state.notes.forEach(removeNoteEl);
    updateMissionState();

    const acc = computeAccuracyPercent();
    const grade = computeGrade(acc);
    const reward = computeReward();
    const teacherMetrics = buildTeacherQualityMetrics();
    const teacherNote = buildTeacherNote(teacherMetrics);

    const summary = {
      ...sessionMeta(),
      score: Math.round(state.score),
      accuracy: acc,
      maxCombo: state.maxCombo,
      perfect: state.perfect,
      great: state.great,
      good: state.good,
      miss: state.miss,
      blankTap: state.blankTap,
      grade,
      stars: reward.stars,
      medal: reward.medal,
      badge: reward.badge,
      missionScore: state.mission.score1 ? 1 : 0,
      missionCombo: state.mission.combo1 ? 1 : 0,
      missionAcc: state.mission.acc1 ? 1 : 0,
      missionNoMiss: state.mission.noMiss ? 1 : 0,
      bossClear: state.mission.bossClear ? 1 : 0,
      blankTapRate: Number(teacherMetrics.blankRate.toFixed(2)),
      offsetAbsMeanMs: teacherMetrics.offMean == null ? null : Number(teacherMetrics.offMean.toFixed(2)),
      offsetAbsStdMs: teacherMetrics.offStd == null ? null : Number(teacherMetrics.offStd.toFixed(2)),
      dataQuality: teacherMetrics.quality,
      teacherNote
    };

    state.lastSummaryPayload = {
      meta: sessionMeta(),
      summary,
      events: state.events.slice()
    };

    if(els.sumScore) els.sumScore.textContent = String(summary.score);
    if(els.sumAcc) els.sumAcc.textContent = `${summary.accuracy}%`;
    if(els.sumCombo) els.sumCombo.textContent = String(summary.maxCombo);
    if(els.summaryGrade) els.summaryGrade.textContent = summary.grade;

    if(els.sumStars) els.sumStars.textContent = '⭐'.repeat(Math.max(1, reward.stars));
    if(els.sumMedal) els.sumMedal.textContent = reward.medal;
    if(els.sumBadge) els.sumBadge.textContent = reward.badge;

    if(els.sumMissionScore) els.sumMissionScore.textContent = state.mission.score1 ? '✅' : '—';
    if(els.sumMissionCombo) els.sumMissionCombo.textContent = state.mission.combo1 ? '✅' : '—';
    if(els.sumMissionAcc) els.sumMissionAcc.textContent = state.mission.acc1 ? '✅' : '—';
    if(els.sumMissionNoMiss) els.sumMissionNoMiss.textContent = state.mission.noMiss ? '✅' : '—';
    if(els.sumBossClear) els.sumBossClear.textContent = state.mission.bossClear ? '✅' : '—';

    buildTeacherPanel(summary);

    if(els.btnCooldown){
      const showCooldown = qbool('cooldown', true) || params.view === 'cvr';
      els.btnCooldown.classList.toggle('hidden', !showCooldown);
      if(showCooldown) els.btnCooldown.href = buildCooldownUrl();
    }

    const showExport = EXPORT_MODE || TEACHER_MODE || !!STUDY_ID;
    if(els.btnDlEvents) els.btnDlEvents.classList.toggle('hidden', !showExport);
    if(els.btnDlSessions) els.btnDlSessions.classList.toggle('hidden', !showExport);
    if(els.btnDlJson) els.btnDlJson.classList.toggle('hidden', !showExport);

    els.btnReplay.href = (() => {
      const url = new URL(location.href);
      url.searchParams.set('seed', String(Date.now()));
      return url.toString();
    })();

    try{
      const hubSummary = {
        pid: params.pid,
        game: 'rhythmboxer',
        runMode: params.mode,
        diff: params.diff,
        scoreFinal: summary.score,
        accPct: summary.accuracy,
        comboMax: summary.maxCombo,
        misses: summary.miss,
        rank: summary.grade,
        stars: summary.stars,
        badge: summary.badge,
        durationSec: params.durSec,
        planDay: PLAN_DAY,
        planSlot: PLAN_SLOT,
        studyId: STUDY_ID,
        timestampIso: new Date().toISOString()
      };

      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(hubSummary));
      localStorage.setItem(`HHA_LAST_SUMMARY:rhythmboxer:${params.pid}`, JSON.stringify(hubSummary));
      localStorage.setItem(`HHA_PLAN_RESULT:rhythmboxer:${params.pid}`, JSON.stringify(hubSummary));
    } catch(_){}

    logEvent({
      eventType: 'session_end',
      noteId: '',
      action: '',
      phase: state.currentPhase,
      hitTimeMs: '',
      inputElapsedMs: Math.round(params.durSec * 1000),
      offsetMs: '',
      result: summary.grade,
      combo: state.maxCombo,
      score: Math.round(state.score)
    });

    if(els.summaryOverlay) els.summaryOverlay.classList.remove('hidden');

    if(AUTO_NEXT && els.btnCooldown && !els.btnCooldown.classList.contains('hidden')){
      setTimeout(() => {
        location.href = els.btnCooldown.href;
      }, 900);
    }
  }

  function boot(){
    updateBridgeStrip();
    applyViewMode();

    state.notes = generateSchedule();
    state.notes.forEach(buildNoteEl);

    attachInputs();
    updateCvrFocus();
    updateMissionState();
    updateMissionStrip();
    updateCombatHud();
    updateAI();

    if(els.btnCooldown){
      els.btnCooldown.addEventListener('click', (ev) => {
        const href = buildCooldownUrl();
        if(href){
          ev.preventDefault();
          location.href = href;
        }
      });
    }

    if(els.btnDlEvents){
      els.btnDlEvents.addEventListener('click', downloadEventsCSV);
    }
    if(els.btnDlSessions){
      els.btnDlSessions.addEventListener('click', downloadSessionsCSV);
    }
    if(els.btnDlJson){
      els.btnDlJson.addEventListener('click', downloadSummaryJSON);
    }

    if(els.btnCvrAllowMotion){
      els.btnCvrAllowMotion.addEventListener('click', async () => {
        await requestCvrMotionPermission();
      });
    }

    if(els.btnCvrDemoMode){
      els.btnCvrDemoMode.addEventListener('click', () => {
        state._cvrPermissionResolved = true;
        state._cvrDemoMode = true;
        showCvrCalibrationOverlay();
      });
    }

    if(els.btnCvrCalibStart){
      els.btnCvrCalibStart.addEventListener('click', () => {
        beginCvrCalibration();
      });
    }

    if(els.btnCvrRecenterNow){
      els.btnCvrRecenterNow.addEventListener('click', () => {
        recenterCvr();
        showCvrCalibrationOverlay();
      });
    }

    if(params.view === 'cvr'){
      initCvrFlow();
      setCoach('หันเล็งช่องด้วยหัว แล้วแตะหรือกด trigger');
    }

    logEvent({
      eventType: 'session_boot',
      noteId: '',
      action: '',
      phase: 'boot',
      hitTimeMs: '',
      inputElapsedMs: '',
      offsetMs: '',
      result: '',
      combo: 0,
      score: 0
    });

    requestAnimationFrame(tick);
  }

  boot();
})();