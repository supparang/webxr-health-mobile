// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Page Boot (PRODUCTION)
// ✅ Fix: start works, no black-screen
// ✅ VR-look: drag-to-look + deviceorientation-to-look + inertia
// ✅ Tap-anywhere sets STUN aim point (vortex center not always screen center)
// ✅ Fix: goodHits/miss/goldHitsThisMini update → Goal/Mini can pass
// ✅ End summary overlay shows on hha:end

import { boot as goodjunkBoot } from './goodjunk.safe.js';
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
  const safeClass = (el, cls, on)=>{ try{ el && el.classList && el.classList.toggle(cls, !!on); }catch(_){ } };

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

  // vortex
  const elVortex = $('stun-vortex');

  // end summary
  const endOverlay = $('end-overlay');
  const endScore = $('end-score');
  const endGood  = $('end-good');
  const endMiss  = $('end-miss');
  const endCombo = $('end-combo');
  const endGoals = $('end-goals');
  const endMinis = $('end-minis');
  const endGrade = $('end-grade');
  const btnEndClose = $('end-close');
  const btnEndRestart = $('end-restart');

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

  // ✅ Correct paths (boot.js is inside /vr-goodjunk)
  const COACH_IMG = {
    neutral: '../img/coach-neutral.png',
    happy:   '../img/coach-happy.png',
    sad:     '../img/coach-sad.png',
    fever:   '../img/coach-fever.png'
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

  /* -------------------- ✅ VR-LOOK (drag + gyro + inertia) -------------------- */
  function enableVRLook(cameraEl){
    if (!cameraEl || !cameraEl.object3D) return;

    const areaEl = document.getElementById('gj-layer') || document.body;

    const DEG = Math.PI / 180;
    const clampPitch = (p)=> Math.max(-1.2, Math.min(1.2, p));

    // base from gyro, plus drag offset
    let gyroYaw = 0, gyroPitch = 0;
    let offYaw = 0, offPitch = 0;

    // inertia velocity from drag
    let vYaw = 0, vPitch = 0;
    let lastDown = 0;

    // drag state
    let dragging = false;
    let lastX = 0, lastY = 0;

    // tune
    const sens = 0.0031;          // drag sensitivity
    const inert = 0.92;           // inertia decay
    const vMax = 0.08;

    function apply(){
      const yaw = gyroYaw + offYaw;
      const pitch = clampPitch(gyroPitch + offPitch);

      // write to A-Frame camera rotation (x=pitch, y=yaw)
      cameraEl.object3D.rotation.x = pitch;
      cameraEl.object3D.rotation.y = yaw;
      cameraEl.object3D.rotation.z = 0;
    }

    function raf(){
      // inertia only when not dragging
      if (!dragging){
        offYaw  += vYaw;
        offPitch += vPitch;
        vYaw *= inert;
        vPitch *= inert;
        if (Math.abs(vYaw) < 0.00015) vYaw = 0;
        if (Math.abs(vPitch) < 0.00015) vPitch = 0;
      }
      apply();
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    function isInteractiveTarget(t){
      // don't rotate view when pressing on target/button/select
      const el = t?.target;
      if (!el) return false;
      if (el.closest && (el.closest('.gj-target') || el.closest('button') || el.closest('select') || el.closest('#start-overlay') || el.closest('#end-overlay'))) return true;
      return false;
    }

    areaEl.addEventListener('pointerdown', (e)=>{
      if (isInteractiveTarget(e)) return;
      dragging = true;
      lastDown = Date.now();
      lastX = e.clientX;
      lastY = e.clientY;
      vYaw = 0; vPitch = 0;
    }, { passive:true });

    areaEl.addEventListener('pointermove', (e)=>{
      if (!dragging) return;
      const dx = (e.clientX - lastX);
      const dy = (e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;

      offYaw  -= dx * sens;
      offPitch -= dy * sens;

      // update inertia velocity
      vYaw  = Math.max(-vMax, Math.min(vMax, (-dx * sens) * 0.65));
      vPitch= Math.max(-vMax, Math.min(vMax, (-dy * sens) * 0.65));
    }, { passive:true });

    areaEl.addEventListener('pointerup', ()=>{ dragging = false; }, { passive:true });
    areaEl.addEventListener('pointercancel', ()=>{ dragging = false; }, { passive:true });

    // ✅ device orientation (Android ok; iOS may require permission)
    window.addEventListener('deviceorientation', (ev)=>{
      // alpha: compass (0..360), beta: front-back (-180..180)
      if (typeof ev.alpha !== 'number' || typeof ev.beta !== 'number') return;

      // portrait mapping
      const a = ev.alpha * DEG;
      const b = ev.beta * DEG;

      // smooth a bit (low-pass)
      gyroYaw = gyroYaw * 0.90 + a * 0.10;

      // pitch center around ~0 when phone upright
      const p = (b - 0.85); // small offset so "upright" feels centered
      gyroPitch = gyroPitch * 0.90 + p * 0.10;

      // if user just dragged, don't fight gyro too hard for ~700ms
      if (Date.now() - lastDown < 700) return;
    }, { passive:true });
  }

  /* -------------------- ✅ Aim point (STUN center) -------------------- */
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

    // tap-anywhere sets STUN center (but if tapping target, target handler will stopPropagation)
    layer.addEventListener('pointerdown', (e)=>{
      if (typeof e.clientX === 'number' && typeof e.clientY === 'number'){
        setAimPoint(e.clientX, e.clientY);
      }
    }, { passive:true });

    window.addEventListener('resize', ()=>{
      const ap = window.__GJ_AIM_POINT__;
      if (!ap) return defaultAim();
      const x = Math.max(20, Math.min(window.innerWidth-20, ap.x|0));
      const y = Math.max(20, Math.min(window.innerHeight-20, ap.y|0));
      setAimPoint(x, y);
    });
  }

  /* -------------------- ✅ Particles helper -------------------- */
  function getParticles(){
    return (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
  }
  function fxBurst(x,y,good=true,count=14){
    const P = getParticles(); if (!P || !P.burstAt) return;
    try{ P.burstAt(x, y, { count, good: !!good }); }catch(_){}
  }
  function fxPop(x,y,label,plain=true){
    const P = getParticles(); if (!P || !P.scorePop) return;
    try{ P.scorePop(x, y, '', String(label||''), { plain: !!plain }); }catch(_){}
  }
  function fxCelebrate(kind){
    const P = getParticles(); if (!P || !P.celebrate) return;
    try{
      P.celebrate(kind, {
        title: kind === 'goal' ? '🎉 GOAL CLEARED!' : '✨ MINI CLEARED!',
        sub: 'ไปต่อเลย! 🌟'
      });
    }catch(_){}
  }

  /* -------------------- Quest shared state -------------------- */
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
    final8Good: 0
  };
  window.__GJ_QSTATE__ = qState;

  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    qState.final8Good = 0;
  });

  let started = false;
  setInterval(()=>{
    if (!started) return;
    qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
  }, 1000);

  let Q = null;

  /* -------------------- Quest/FX hooks from safe.js -------------------- */
  window.addEventListener('quest:goodHit', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x||0), y = Number(d.y||0);
    const j = String(d.judgment||'good').toLowerCase();
    const isPerfect = j.includes('perfect');

    // streak & final sprint count
    qState.streakGood = (qState.streakGood|0) + 1;
    if ((qState.timeLeft|0) <= 8) qState.final8Good = (qState.final8Good|0) + 1;

    fxBurst(x,y,true,isPerfect ? 18 : 14);
    fxPop(x,y,isPerfect ? 'PERFECT!' : 'GOOD!');

    // gold mini fix: if safe.js tags kind='gold' we set flag
    if (String(d.kind||'') === 'gold') qState.goldHitsThisMini = true;

    Q && Q.tick(qState);
  });

  window.addEventListener('quest:badHit', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x||0), y = Number(d.y||0);

    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;

    fxBurst(x,y,false,14);
    fxPop(x,y,'JUNK!');

    Q && Q.tick(qState);
  });

  window.addEventListener('quest:block', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x||0), y = Number(d.y||0);

    qState.blocks = (qState.blocks|0) + 1;

    fxBurst(x,y,true,10);
    fxPop(x,y,'BLOCK!');

    Q && Q.tick(qState);
  });

  window.addEventListener('quest:power', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x||0), y = Number(d.y||0);
    const p = String(d.power||'').toLowerCase();

    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time')   qState.timePlus = (qState.timePlus|0) + 1;
    if (p === 'gold')   qState.goldHitsThisMini = true;

    fxBurst(x,y,true,12);
    fxPop(x,y,(p||'POWER').toUpperCase() + '!');

    Q && Q.tick(qState);
  });

  window.addEventListener('quest:bossClear', ()=>{
    qState.bossCleared = true;
    Q && Q.tick(qState);
  });

  window.addEventListener('quest:cleared', (e)=>{
    const d = e.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    fxCelebrate(kind.includes('goal') ? 'goal' : 'mini');
    setCoach('เยี่ยม! ผ่านภารกิจแล้ว ไปต่อเลย! 🌟', 'happy');
  });

  /* -------------------- HUD listeners -------------------- */
  window.addEventListener('hha:judge', (e)=>{
    safeText(elJudge, (e.detail||{}).label || '\u00A0');
  });

  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      safeText(elTime, sec + 's');
      qState.timeLeft = sec|0;
      Q && Q.tick(qState);
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
    Q && Q.tick(qState);
  });

  // ✅ Fever/Shield + STUN badge + vortex
  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const fever = Number(d.fever||0);
    const shield = Number(d.shield||0);
    const stunActive = !!d.stunActive;

    if (elFeverFill) elFeverFill.style.width = Math.max(0, Math.min(100, fever)) + '%';
    if (elFeverPct) safeText(elFeverPct, Math.round(Math.max(0, Math.min(100, fever))) + '%');
    if (elShield) safeText(elShield, String(shield|0));
    if (elStunBadge) safeClass(elStunBadge, 'show', stunActive);

    // vortex follows aim point while stun
    if (elVortex){
      safeClass(elVortex, 'show', stunActive);
      const ap = window.__GJ_AIM_POINT__;
      if (ap && stunActive){
        elVortex.style.left = (ap.x|0) + 'px';
        elVortex.style.top  = (ap.y|0) + 'px';
      }
    }
  });

  // quest:update (bars)
  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;
    const meta = d.meta || {};

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
    if (elMiniCount) elMiniCount.textContent = `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount+1}`;

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
    setCoach('แตะของดี! หลบ junk! ⚡', 'neutral');
    setLogBadge('ok', 'boot: ready');
  }

  // ✅ logger safe: use IIFE global if present; otherwise dynamically import and use window.HHACloudLogger
  async function initLoggerSafe(opts){
    try{
      // prefer already-loaded global
      if (window.HHACloudLogger && typeof window.HHACloudLogger.init === 'function'){
        window.HHACloudLogger.init(opts || {});
        return true;
      }
      // else load script as module (it still runs and sets window.HHACloudLogger)
      await import('../vr/hha-cloud-logger.js');
      if (window.HHACloudLogger && typeof window.HHACloudLogger.init === 'function'){
        window.HHACloudLogger.init(opts || {});
        return true;
      }
      return false;
    }catch(_){
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

  function gradeFromStats({score, miss, comboMax, goalsCleared, minisCleared}){
    // สเกลง่าย ๆ ให้ “ดูเป็นเกมจริง”
    const s = Number(score||0);
    const m = Number(miss||0);
    const c = Number(comboMax||0);
    const g = Number(goalsCleared||0);
    const n = Number(minisCleared||0);

    const value = (s * 1.0) + (c * 18) + (g * 260) + (n * 55) - (m * 120);

    if (value >= 1800) return 'SSS';
    if (value >= 1450) return 'SS';
    if (value >= 1180) return 'S';
    if (value >= 900)  return 'A';
    if (value >= 620)  return 'B';
    return 'C';
  }

  function showEndSummary(stats){
    if (!endOverlay) return;
    const qMeta = (Q && Q.getState) ? Q.getState() : { goalsCleared:0, minisCleared:0 };

    const final = {
      score: qState.score|0,
      goodHits: qState.goodHits|0,
      miss: qState.miss|0,
      comboMax: qState.comboMax|0,
      goalsCleared: qMeta.goalsCleared|0,
      minisCleared: qMeta.minisCleared|0,
      ...(stats||{})
    };

    const gr = gradeFromStats(final);

    safeText(endScore, String(final.score|0));
    safeText(endGood,  String(final.goodHits|0));
    safeText(endMiss,  String(final.miss|0));
    safeText(endCombo, String(final.comboMax|0));
    safeText(endGoals, String(final.goalsCleared|0));
    safeText(endMinis, String(final.minisCleared|0));
    safeText(endGrade, 'GRADE: ' + gr);

    endOverlay.classList.add('show');
  }

  btnEndClose && btnEndClose.addEventListener('click', ()=>{
    endOverlay && endOverlay.classList.remove('show');
  });
  btnEndRestart && btnEndRestart.addEventListener('click', ()=>{
    // restart with new ts to bypass cache
    const u = new URL(location.href);
    u.searchParams.set('ts', String(Date.now()));
    location.href = u.toString();
  });

  // ✅ End event from safe.js
  window.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};
    showEndSummary(d);
  });

  async function bootOnce({ wantVR }){
    if (started) return;
    started = true;

    if (startOverlay) startOverlay.style.display = 'none';

    const diff = normDiff(selDiff?.value || DIFF_INIT);
    const chal = normCh(selChallenge?.value || CH_INIT);
    const durationSec = clamp(DUR_INIT, 20, 180);

    qState.challenge = chal;
    qState.runMode = RUN_MODE;

    if (elDiff) elDiff.textContent = diff.toUpperCase();
    if (elChal) elChal.textContent = chal.toUpperCase();
    if (elTime) elTime.textContent = durationSec + 's';

    // aim system
    bindAimListeners();

    // logger (optional)
    const endpoint =
      (sessionStorage.getItem('HHA_LOGGER_ENDPOINT') || '') ||
      (sessionStorage.getItem('HHA_LOG_ENDPOINT') || '') ||
      '';

    const okLogger = await initLoggerSafe({
      endpoint,
      debug: false
    });
    setLogBadge(okLogger ? 'ok' : 'bad', okLogger ? 'logger: ok ✓' : 'logger: skip');

    // camera look
    const cam = document.querySelector('#gj-camera');
    enableVRLook(cam);
    initVRButton();

    // Quest
    Q = makeQuestDirector({
      diff,
      goalDefs: GOODJUNK_GOALS,
      miniDefs: GOODJUNK_MINIS,
      maxGoals: 2,
      maxMini: 999,
      challenge: chal
    });
    Q.start(qState);

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
        setCoach('เริ่มแล้ว! ลากเพื่อเลื่อนมุมมอง • แตะเพื่อย้ายศูนย์กลาง STUN ⚡', 'neutral');
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefill();
}

export default boot;
