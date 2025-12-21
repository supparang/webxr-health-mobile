// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Step E:
// ✅ Real-time Grade SSS/SS/S/A/B/C + grade-up FX
// ✅ Celebration on mini/goal cleared (no need to edit quest-director)
// ✅ Summary shows grade
// ✅ Still compatible with Step D safe.js

import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

export function boot(){
  'use strict';
  if (window.__GJ_PAGE_BOOTED__) return;
  window.__GJ_PAGE_BOOTED__ = true;

  window.addEventListener('pageshow', (e)=>{
    if (e.persisted) window.location.reload();
  });

  const $ = (id)=>document.getElementById(id);
  const safeText = (el, txt)=>{ try{ if (el) el.textContent = (txt ?? ''); }catch(_){ } };

  // HUD
  const elScore = $('hud-score');
  const elCombo = $('hud-combo');
  const elMiss  = $('hud-miss');
  const elDiff  = $('hud-diff-label');
  const elChal  = $('hud-challenge-label');
  const elTime  = $('hud-time-label');
  const elJudge = $('hud-judge');

  const elRunLabel = $('hud-run-label');
  const elPill = $('hud-pill');
  const startSub = $('start-sub');

  const elQuestMain = $('hud-quest-main');
  const elQuestMini = $('hud-quest-mini');
  const elQuestMainBar = $('hud-quest-main-bar');
  const elQuestMiniBar = $('hud-quest-mini-bar');
  const elQuestMainCap = $('hud-quest-main-caption');
  const elQuestMiniCap = $('hud-quest-mini-caption');
  const elQuestHint = $('hud-quest-hint');
  const elMiniCount = $('hud-mini-count');

  const elCoachBubble = $('coach-bubble');
  const elCoachText   = $('coach-text');
  const elCoachEmoji  = $('coach-emoji');

  const elCountdown = $('start-countdown');
  const btnVR      = $('btn-vr');

  const startOverlay = $('start-overlay');
  const btnStart2D = $('btn-start-2d');
  const btnStartVR = $('btn-start-vr');
  const selDiff = $('sel-diff');
  const selChallenge = $('sel-challenge');

  const logDot  = $('logdot');
  const logText = $('logtext');

  const elFeverFill = $('fever-fill');
  const elFeverPct  = $('fever-pct');
  const elShield    = $('shield-count');

  const elStunBadge = $('hud-stun');
  const elVortex    = $('stun-vortex');
  const elBorder    = $('stun-border');
  const elFire      = $('fever-fire');

  // ✅ Grade badge
  const elGradeWrap = $('hud-grade');
  const elGradeVal  = $('hud-grade-val');

  // Summary
  const sumOverlay = $('summary-overlay');
  const sumScore = $('sum-score');
  const sumGood  = $('sum-good');
  const sumMiss  = $('sum-miss');
  const sumCombo = $('sum-combo');
  const sumGoals = $('sum-goals');
  const sumMinis = $('sum-minis');
  const sumDiff  = $('sum-diff');
  const sumChal  = $('sum-chal');
  const sumRun   = $('sum-run');
  const sumTime  = $('sum-time');
  const sumGrade = $('sum-grade');
  const btnSumClose = $('btn-sum-close');
  const btnSumRetry = $('btn-sum-retry');

  // Particles (optional, safe)
  const Particles =
    (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
    window.Particles ||
    { celebrate(){}, burstAt(){}, scorePop(){}, toast(){} };

  const pageUrl = new window.URL(window.location.href);
  const URL_RUN = (pageUrl.searchParams.get('run') || 'play').toLowerCase();
  const URL_DIFF = (pageUrl.searchParams.get('diff') || 'normal').toLowerCase();
  const URL_CH = (pageUrl.searchParams.get('ch') || pageUrl.searchParams.get('challenge') || 'rush').toLowerCase();
  const URL_TIME_RAW = parseInt(pageUrl.searchParams.get('time') || '', 10);

  function clamp(v,min,max){ v=Number(v)||0; if(v<min) return min; if(v>max) return max; return v; }
  function normDiff(v){ v=String(v||'normal').toLowerCase(); return (v==='easy'||v==='hard'||v==='normal') ? v : 'normal'; }
  function normCh(v){ v=String(v||'rush').toLowerCase(); return (v==='rush'||v==='boss'||v==='survival') ? v : 'rush'; }
  function normRun(v){ v=String(v||'play').toLowerCase(); return (v==='research') ? 'research' : 'play'; }

  const RUN_MODE = normRun(URL_RUN);
  const DIFF_INIT = normDiff(URL_DIFF);
  const CH_INIT = normCh(URL_CH);

  const DEFAULT_TIME = { easy:80, normal:60, hard:50 };
  const DUR_INIT = clamp(
    (Number.isFinite(URL_TIME_RAW) ? URL_TIME_RAW : (DEFAULT_TIME[DIFF_INIT] || 60)),
    20, 180
  );

  // --- audio/haptic helpers ---
  function vibrate(ms){
    try{ if (navigator.vibrate) navigator.vibrate(ms|0); }catch(_){}
  }
  function beep(freq=880, ms=60, gain=0.035){
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(()=>{ try{o.stop();}catch(_){} try{ctx.close();}catch(_){} }, ms);
    }catch(_){}
  }

  const COACH_IMG = {
    neutral: './img/coach-neutral.png',
    happy:   './img/coach-happy.png',
    sad:     './img/coach-sad.png',
    fever:   './img/coach-fever.png'
  };

  let lastCoachTimeout = null;
  function setCoachFace(mood){
    const m = COACH_IMG[mood] ? mood : 'neutral';
    if (elCoachEmoji) elCoachEmoji.style.backgroundImage = `url('${COACH_IMG[m]}')`;
  }
  function setCoach(text, mood='neutral'){
    if (elCoachBubble) elCoachBubble.classList.add('show');
    safeText(elCoachText, text || '');
    setCoachFace(mood);
    if (lastCoachTimeout) clearTimeout(lastCoachTimeout);
    lastCoachTimeout = setTimeout(()=> elCoachBubble && elCoachBubble.classList.remove('show'), 4200);
  }

  function setLogBadge(state, text){
    if (!logDot || !logText) return;
    logDot.classList.remove('ok','bad');
    if (state === 'ok') logDot.classList.add('ok');
    else if (state === 'bad') logDot.classList.add('bad');
    safeText(logText, text || '');
  }

  function runCountdown(onDone){
    if (!elCountdown){ onDone && onDone(); return; }
    const steps = ['3','2','1','Go!'];
    let idx = 0;
    elCountdown.classList.remove('countdown-hidden');
    safeText(elCountdown, steps[0]);
    const t = setInterval(()=>{
      idx++;
      if (idx >= steps.length){
        clearInterval(t);
        elCountdown.classList.add('countdown-hidden');
        onDone && onDone();
      }else{
        safeText(elCountdown, steps[idx]);
      }
    }, 650);
  }

  async function tryEnterVR(){
    const scene = document.querySelector('a-scene');
    if (!scene) return false;
    try{ await scene.enterVR(); return true; }
    catch(err){ console.warn('[GoodJunkVR] enterVR blocked:', err); return false; }
  }

  function initVRButton(){
    if (!btnVR) return;
    const scene = document.querySelector('a-scene');
    if (!scene) return;
    btnVR.addEventListener('click', async ()=>{
      try{ await scene.enterVR(); }
      catch(err){ console.warn('[GoodJunkVR] enterVR error:', err); }
    });
  }

  function attachTouch(cameraEl){
    if (!cameraEl) return;
    try{
      attachTouchLook(cameraEl, { sensitivity: 0.26, areaEl: document.body });
    }catch(_){}
  }

  // ---- Aim point (tap anywhere) ----
  function setAimPoint(x, y){
    window.__GJ_AIM_POINT__ = { x: x|0, y: y|0, t: Date.now() };
    if (elVortex){
      elVortex.style.left = (x|0) + 'px';
      elVortex.style.top  = (y|0) + 'px';
    }
  }
  function defaultAim(){
    setAimPoint(window.innerWidth*0.5, window.innerHeight*0.62);
  }
  function bindAimListeners(){
    const layer = document.getElementById('gj-layer');
    if (!layer) return;
    defaultAim();

    layer.addEventListener('pointerdown', (e)=>{
      if (typeof e.clientX === 'number' && typeof e.clientY === 'number'){
        setAimPoint(e.clientX, e.clientY);
      }
    }, { passive:true });

    window.addEventListener('resize', ()=>{
      const ap = window.__GJ_AIM_POINT__;
      if (!ap) defaultAim();
      else{
        const x = Math.max(20, Math.min(window.innerWidth-20, ap.x|0));
        const y = Math.max(20, Math.min(window.innerHeight-20, ap.y|0));
        setAimPoint(x, y);
      }
    });
  }

  // ---- Grade system ----
  function diffMul(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'hard') return 1.10;
    if (diff === 'easy') return 0.95;
    return 1.0;
  }

  function computeGrade(s){
    // s: {score, goodHits, miss, comboMax, goalsCleared, minisCleared, diff}
    const score = s.score|0;
    const miss = s.miss|0;
    const combo = s.comboMax|0;
    const goals = s.goalsCleared|0;
    const minis = s.minisCleared|0;
    const good  = s.goodHits|0;

    const total = Math.max(1, good + miss);
    const acc = good / total;                 // 0..1

    // Core index: reward score + combo + quest clears + accuracy; punish misses hard
    const base = score + combo*15 + goals*160 + minis*38 + Math.round(acc*140);
    const penalty = miss*85;

    let idx = (base - penalty) * diffMul(s.diff);

    // safety clamps / special rules
    if (miss >= 12) idx = Math.min(idx, 520); // miss เยอะไม่ให้บินไป S ง่ายๆ
    if (goals >= 2 && minis >= 6 && miss === 0) idx = Math.max(idx, 940); // flawless quest = SSS

    if (idx >= 920) return 'SSS';
    if (idx >= 780) return 'SS';
    if (idx >= 650) return 'S';
    if (idx >= 520) return 'A';
    if (idx >= 400) return 'B';
    return 'C';
  }

  function gradeClass(g){
    if (g === 'SSS') return 'g-SSS';
    if (g === 'SS') return 'g-SS';
    if (g === 'S') return 'g-S';
    if (g === 'A') return 'g-A';
    if (g === 'B') return 'g-B';
    return 'g-C';
  }

  let lastGrade = 'C';
  function setGradeUI(g, { isUp=false } = {}){
    if (!elGradeWrap || !elGradeVal) return;

    elGradeVal.textContent = g;
    elGradeWrap.classList.remove('g-SSS','g-SS','g-S','g-A','g-B','g-C');
    elGradeWrap.classList.add(gradeClass(g));

    if (isUp){
      elGradeWrap.classList.remove('grade-up');
      void elGradeWrap.offsetWidth;
      elGradeWrap.classList.add('grade-up');
    }
  }

  function rankValue(g){
    // bigger = better
    if (g === 'SSS') return 6;
    if (g === 'SS')  return 5;
    if (g === 'S')   return 4;
    if (g === 'A')   return 3;
    if (g === 'B')   return 2;
    return 1;
  }

  function maybeGradeUp(newG){
    if (rankValue(newG) > rankValue(lastGrade)){
      // grade-up feedback
      setGradeUI(newG, { isUp:true });
      beep(980, 60, 0.04);
      beep(1240, 70, 0.035);
      vibrate(60);
      try{
        Particles.celebrate && Particles.celebrate({ kind:'GRADE_UP', intensity: 1 });
      }catch(_){}
      setCoach(`เกรดขึ้น! ➜ ${newG} ✨`, 'happy');
      lastGrade = newG;
      return;
    }
    // normal set (no spam)
    setGradeUI(newG, { isUp:false });
    lastGrade = newG;
  }

  // ---- Quest state ----
  const qState = {
    score:0, goodHits:0, miss:0, comboMax:0, timeLeft:0,
    streakGood:0,
    goldHitsThisMini:false,
    blocks:0,
    usedMagnet:false,
    timePlus:0,
    safeNoJunkSeconds:0,
    bossCleared:false,
    challenge: CH_INIT,
    runMode: RUN_MODE,
    final8Good: 0,

    stunBreaks: 0,
    goalsCleared: 0,
    minisCleared: 0,
    diff: DIFF_INIT
  };

  // reset per mini
  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    qState.final8Good = 0;
    qState.stunBreaks = 0;
  });

  let started = false;
  setInterval(()=>{
    if (!started) return;
    qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
  }, 1000);

  let Q = null;

  // track meta changes for celebration
  let lastQuestMeta = { goalsCleared:0, minisCleared:0, miniCount:0 };

  function celebrateMini(){
    const x = window.innerWidth*0.5;
    const y = window.innerHeight*0.38;
    try{
      Particles.burstAt && Particles.burstAt(x, y, 'gold');
      Particles.celebrate && Particles.celebrate({ kind:'MINI', intensity: 0.8 });
    }catch(_){}
    vibrate(45);
    beep(980, 55, 0.03);
    setCoach('MINI สำเร็จ! ต่อไปมาเลย! ⚡', 'happy');
  }

  function celebrateGoal(){
    const x = window.innerWidth*0.5;
    const y = window.innerHeight*0.30;
    try{
      Particles.celebrate && Particles.celebrate({ kind:'GOAL', intensity: 1.2 });
      Particles.burstAt && Particles.burstAt(x, y, 'gold');
      Particles.burstAt && Particles.burstAt(x-80, y+40, 'good');
      Particles.burstAt && Particles.burstAt(x+80, y+40, 'good');
    }catch(_){}
    vibrate([40,30,40]);
    beep(880, 70, 0.035);
    beep(1180, 80, 0.03);
    setCoach('GOAL ผ่านแล้ว! โหดขึ้นอีกนิดนะ! 🔥', 'happy');
  }

  function celebrateAll(){
    const x = window.innerWidth*0.5;
    const y = window.innerHeight*0.26;
    try{
      Particles.celebrate && Particles.celebrate({ kind:'ALL_CLEAR', intensity: 1.8 });
      Particles.burstAt && Particles.burstAt(x, y, 'gold');
      Particles.burstAt && Particles.burstAt(x-140, y+70, 'gold');
      Particles.burstAt && Particles.burstAt(x+140, y+70, 'gold');
    }catch(_){}
    vibrate([55,35,55,35,55]);
    beep(920, 80, 0.04);
    beep(1240, 90, 0.035);
    beep(1560, 110, 0.03);
    setCoach('ALL CLEAR! 🏆', 'fever');
  }

  function updateGradeNow(){
    const g = computeGrade(qState);
    maybeGradeUp(g);
  }

  // events from safe.js
  window.addEventListener('quest:goodHit', (e)=>{
    const d = e.detail || {};
    qState.streakGood = (qState.streakGood|0) + 1;
    if ((qState.timeLeft|0) <= 8) qState.final8Good = (qState.final8Good|0) + 1;
    if (d.kind === 'gold') qState.goldHitsThisMini = true;
    updateGradeNow();
    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:gold', ()=>{
    qState.goldHitsThisMini = true;
    updateGradeNow();
    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:badHit', ()=>{
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    updateGradeNow();
    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:block', ()=>{
    qState.blocks = (qState.blocks|0) + 1;
    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:stunBreak', ()=>{
    qState.stunBreaks = (qState.stunBreaks|0) + 1;
    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:power', (e)=>{
    const d = e.detail || {};
    const p = String(d.power||'');
    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time') qState.timePlus = (qState.timePlus|0) + 1;
    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:bossClear', ()=>{
    qState.bossCleared = true;
    updateGradeNow();
    if (Q) Q.tick(qState);
  });

  // HUD updates
  window.addEventListener('hha:judge', (e)=>{
    safeText(elJudge, (e.detail||{}).label || '\u00A0');
  });

  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      safeText(elTime, sec + 's');
      qState.timeLeft = sec|0;
      if (Q) Q.tick(qState);
    }
  });

  let lastMissSeen = 0;
  window.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if (typeof d.score === 'number'){ qState.score = d.score|0; safeText(elScore, String(qState.score)); }
    if (typeof d.goodHits === 'number'){ qState.goodHits = d.goodHits|0; }
    if (typeof d.misses === 'number'){
      qState.miss = d.misses|0;
      safeText(elMiss, String(qState.miss));
      if (qState.miss > lastMissSeen){
        qState.streakGood = 0;
        lastMissSeen = qState.miss;
      }
    }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; safeText(elCombo, String(qState.comboMax)); }
    updateGradeNow();
    if (Q) Q.tick(qState);
  });

  // Fever/Shield + STUN UI
  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const fever = Number(d.fever||0);
    const shield = Number(d.shield||0);
    const stunActive = !!d.stunActive;
    const slow = Number(d.slow||0);

    if (elFeverFill) elFeverFill.style.width = Math.max(0, Math.min(100, fever)) + '%';
    if (elFeverPct) safeText(elFeverPct, Math.round(Math.max(0, Math.min(100, fever))) + '%');
    if (elShield) safeText(elShield, String(shield|0));

    if (elStunBadge){
      elStunBadge.classList.toggle('show', stunActive);
      if (stunActive){
        elStunBadge.innerHTML = `⚡ STUN <b>${slow ? ('SLOW x' + slow.toFixed(2)) : 'SLOW'}</b>`;
      }
    }

    if (elBorder) elBorder.classList.toggle('show', stunActive);
    if (elFire) elFire.classList.toggle('show', stunActive);

    if (elVortex){
      elVortex.classList.toggle('show', stunActive);
      const ap = window.__GJ_AIM_POINT__;
      if (ap){
        elVortex.style.left = (ap.x|0) + 'px';
        elVortex.style.top  = (ap.y|0) + 'px';
      }
    }
  });

  // Final sprint pulse (lock 1s)
  window.addEventListener('hha:finalPulse', (e)=>{
    const sec = (e.detail||{}).secLeft|0;
    if (sec > 0){
      setCoach(`🏁 FINAL LOCK! เหลือ ${sec}s — อย่าพลาด!`, 'fever');
    }
  });

  // quest:update (bars + meta) + ✅ celebration detection
  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;
    const meta = d.meta || {};

    const prevGoals = lastQuestMeta.goalsCleared|0;
    const prevMinis = lastQuestMeta.minisCleared|0;

    lastQuestMeta = {
      goalsCleared: meta.goalsCleared|0,
      minisCleared: meta.minisCleared|0,
      miniCount: meta.miniCount|0
    };
    qState.goalsCleared = lastQuestMeta.goalsCleared|0;
    qState.minisCleared = lastQuestMeta.minisCleared|0;

    // 🎉 detect clears
    if ((lastQuestMeta.minisCleared|0) > prevMinis) celebrateMini();
    if ((lastQuestMeta.goalsCleared|0) > prevGoals) celebrateGoal();
    if ((lastQuestMeta.goalsCleared|0) >= 2 && prevGoals < 2) celebrateAll();

    // update grade from quest clears
    updateGradeNow();

    if (goal){
      const cur = (goal.cur|0), max = (goal.max|0);
      const pct = Math.max(0, Math.min(1, Number(goal.pct ?? (max>0?cur/max:0))));
      if (elQuestMain) elQuestMain.textContent = goal.title || 'ภารกิจหลัก';
      if (elQuestMainBar) elQuestMainBar.style.width = Math.round(pct*100) + '%';
      if (elQuestMainCap) elQuestMainCap.textContent = `${cur} / ${max}`;
    } else {
      if (elQuestMain) elQuestMain.textContent = 'ภารกิจหลัก (ครบ) ✅';
      if (elQuestMainBar) elQuestMainBar.style.width = '100%';
      if (elQuestMainCap) elQuestMainCap.textContent = '';
    }

    if (mini){
      const cur = (mini.cur|0), max = (mini.max|0);
      const pct = Math.max(0, Math.min(1, Number(mini.pct ?? (max>0?cur/max:0))));
      if (elQuestMini) elQuestMini.textContent = 'Mini: ' + (mini.title || '');
      if (elQuestMiniBar) elQuestMiniBar.style.width = Math.round(pct*100) + '%';
      if (elQuestMiniCap) elQuestMiniCap.textContent = `${cur} / ${max}`;
    } else {
      if (elQuestMini) elQuestMini.textContent = 'Mini quest (ครบ) ✅';
      if (elQuestMiniBar) elQuestMiniBar.style.width = '100%';
      if (elQuestMiniCap) elQuestMiniCap.textContent = '';
    }

    const miniCount = (meta.miniCount|0);
    const minisCleared = (meta.minisCleared|0);
    if (elMiniCount) elMiniCount.textContent = `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount}`;

    let hint = '';
    if (goal && Number(goal.pct||0) >= 0.8) hint = 'ใกล้แล้ว! 🔥';
    else if (mini && Number(mini.pct||0) >= 0.8) hint = 'อีกนิดเดียว! ⚡';
    if (elQuestHint) elQuestHint.textContent = hint;
  });

  function applyRunPill(){
    if (elRunLabel) elRunLabel.textContent = RUN_MODE.toUpperCase();
    if (elPill) elPill.classList.toggle('research', RUN_MODE === 'research');
    if (startSub){
      startSub.textContent = (RUN_MODE === 'research')
        ? 'โหมดวิจัย: ต้องมี Student ID หรือชื่อเล่นจาก Hub แล้วค่อยกดเริ่ม ✅'
        : 'เลือกความยาก + โหมดความมันส์ แล้วกดเริ่ม 1 ครั้ง (เพื่อเปิดสิทธิ์เสียง/VR) ✅';
    }
  }

  function prefill(){
    try{ selDiff.value = DIFF_INIT; }catch(_){}
    try{ selChallenge.value = CH_INIT; }catch(_){}
    applyRunPill();
    if (elDiff) elDiff.textContent = DIFF_INIT.toUpperCase();
    if (elChal) elChal.textContent = CH_INIT.toUpperCase();
    if (elTime) elTime.textContent = DUR_INIT + 's';
    qState.diff = DIFF_INIT;
    lastGrade = 'C';
    setGradeUI('C', { isUp:false });
    setCoach('แตะของดี! หลบ junk! ⚡', 'neutral');
    setLogBadge(null, 'boot: ready');
  }

  // logger safe init (works with IIFE too)
  async function initLoggerSafe(payload){
    try{
      const mod = await import('../vr/hha-cloud-logger.js');
      const fn =
        mod.initCloudLogger ||
        mod.initLogger ||
        mod.init ||
        mod.default ||
        window.initCloudLogger ||
        (window.HHACloudLogger && window.HHACloudLogger.init);

      if (typeof fn === 'function'){
        fn(payload);
        setLogBadge('ok', 'logger: ok ✓');
        return true;
      }
      setLogBadge('bad', 'logger: export not found (skip)');
      console.warn('[GoodJunkVR] Logger loaded but no init function.', Object.keys(mod||{}));
      return false;
    }catch(err){
      setLogBadge('bad', 'logger: load failed (skip)');
      console.warn('[GoodJunkVR] Logger load failed (skip):', err);
      return false;
    }
  }

  function waitSceneReady(cb){
    const scene = document.querySelector('a-scene');
    if (!scene) { cb(); return; }
    const tryReady = ()=>{
      if (scene.hasLoaded && scene.camera){ cb(); return true; }
      return false;
    };
    if (tryReady()) return;
    scene.addEventListener('loaded', ()=>{
      let tries=0;
      const it = setInterval(()=>{
        tries++;
        if (tryReady() || tries>80){ clearInterval(it); cb(); }
      }, 50);
    }, { once:true });
  }

  function showSummary(payload){
    if (!sumOverlay) return;
    sumOverlay.classList.add('show');

    safeText(sumScore, String(payload.score|0));
    safeText(sumGood,  String(payload.goodHits|0));
    safeText(sumMiss,  String(payload.misses|0));
    safeText(sumCombo, String(payload.comboMax|0));

    safeText(sumGoals, String(payload.goalsCleared|0));
    safeText(sumMinis, String(payload.minisCleared|0));

    safeText(sumDiff,  String(payload.diff||'').toUpperCase());
    safeText(sumChal,  String(payload.challenge||'').toUpperCase());
    safeText(sumRun,   String(payload.runMode||'').toUpperCase());
    safeText(sumTime,  `เล่น ${payload.durationSec|0}s`);

    const g = payload.grade || computeGrade(payload);
    safeText(sumGrade, g);
  }

  btnSumClose && btnSumClose.addEventListener('click', ()=>{
    sumOverlay && sumOverlay.classList.remove('show');
  });
  btnSumRetry && btnSumRetry.addEventListener('click', ()=>{
    window.location.reload();
  });

  // receive end from safe.js (guaranteed)
  window.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};

    // compute grade at end using freshest qState/meta
    const endPayload = {
      score: d.score|0,
      goodHits: d.goodHits|0,
      miss: d.misses|0,
      misses: d.misses|0,
      comboMax: d.comboMax|0,
      goalsCleared: (lastQuestMeta.goalsCleared|0),
      minisCleared: (lastQuestMeta.minisCleared|0),
      diff: d.diff || qState.diff || DIFF_INIT,
      challenge: d.challenge || CH_INIT,
      runMode: d.runMode || RUN_MODE,
      durationSec: d.durationSec || DUR_INIT
    };
    endPayload.grade = computeGrade(endPayload);

    showSummary(endPayload);

    try{
      Particles.celebrate && Particles.celebrate({ kind:'END', intensity: 1.2 });
    }catch(_){}
    setCoach(`จบเกม! เกรด ${endPayload.grade} 🎉`, (endPayload.grade==='SSS'||endPayload.grade==='SS') ? 'fever' : 'happy');
  });

  let startedOnce = false;

  async function bootOnce({ wantVR }){
    if (startedOnce) return;
    startedOnce = true;
    started = true;
    if (startOverlay) startOverlay.style.display = 'none';

    const diff = normDiff(selDiff?.value || DIFF_INIT);
    const chal = normCh(selChallenge?.value || CH_INIT);
    const durationSec = clamp(DUR_INIT, 20, 180);

    qState.challenge = chal;
    qState.runMode = RUN_MODE;
    qState.diff = diff;

    if (elDiff) elDiff.textContent = diff.toUpperCase();
    if (elChal) elChal.textContent = chal.toUpperCase();
    if (elTime) elTime.textContent = durationSec + 's';

    bindAimListeners();

    const endpoint =
      sessionStorage.getItem('HHA_LOG_ENDPOINT') ||
      'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';

    await initLoggerSafe({
      endpoint,
      projectTag: 'HeroHealth-GoodJunkVR',
      mode: 'GoodJunkVR',
      runMode: RUN_MODE,
      diff,
      challenge: chal,
      durationPlannedSec: durationSec,
      profile: null,
      debug: true
    });

    const cam = document.querySelector('#gj-camera');
    attachTouch(cam);
    initVRButton();

    Q = makeQuestDirector({
      diff,
      goalDefs: GOODJUNK_GOALS,
      miniDefs: GOODJUNK_MINIS,
      maxGoals: 2,
      maxMini: 999,
      challenge: chal
    });
    Q.start(qState);

    // initial grade baseline
    lastGrade = 'C';
    setGradeUI('C', { isUp:false });

    runCountdown(()=>{
      waitSceneReady(async ()=>{
        if (wantVR) await tryEnterVR();

        const ENGINE = goodjunkBoot({
          diff,
          run: RUN_MODE,
          challenge: chal,
          time: durationSec,
          layerEl: document.getElementById('gj-layer')
        });

        window.__GJ_ENGINE__ = ENGINE;

        setCoach('แตะพื้นที่ว่างเพื่อย้าย vortex ได้! ⚡ ทำเกรดให้สูงขึ้น! 🏆', 'neutral');
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefill();
}