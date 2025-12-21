// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Boot binder: HUD + QuestDirector + VR-look (drag + deviceorientation + inertia)
// + STUN overlay/body class + vortex + FX (Particles)
// + Logger (IIFE: window.HHACloudLogger)

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
  const safeStyleWidth = (el, w)=>{ try{ if (el) el.style.width = w; }catch(_){ } };

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

  const elVortex = $('stun-vortex');
  const elFire   = $('fire-overlay');

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

  // --------- Particles FX ----------
  function getParticles(){
    return (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
  }
  function fxBurst(x,y, good=true, count=14){
    const P = getParticles(); if (!P || !P.burstAt) return;
    try{ P.burstAt(x, y, { count, good: !!good }); }catch(_){}
  }
  function fxPop(x,y, label, plain=true){
    const P = getParticles(); if (!P || !P.scorePop) return;
    try{ P.scorePop(x, y, '', String(label||''), { plain: !!plain }); }catch(_){}
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

  /* =========================
     Aim point (ศูนย์กลาง STUN)
     ========================= */
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
    if (!window.__GJ_AIM_POINT__) defaultAim();

    // แตะพื้นที่ว่างเพื่อย้ายศูนย์กลาง (ถ้าแตะ target ไม่เปลี่ยน)
    layer.addEventListener('pointerdown', (e)=>{
      const t = e.target;
      if (t && t.closest && t.closest('.gj-target')) return;
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

  /* =========================
     VR-look: drag + inertia + deviceorientation
     - drag affects rig yaw + camera pitch
     - deviceorientation (if permission) adds gentle drift
     ========================= */
  function requestIOSMotionPermission(){
    try{
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function'){
        return D.requestPermission().then(res => res === 'granted').catch(()=>false);
      }
    }catch(_){}
    return Promise.resolve(true);
  }

  function bindLookControls(){
    const layer = document.getElementById('gj-layer');
    const rig = document.getElementById('gj-rig');
    const cam = document.getElementById('gj-camera');
    if (!layer || !rig || !cam) return ()=>{};

    // state
    let yaw = (rig.object3D?.rotation?.y || 0);
    let pitch = (cam.object3D?.rotation?.x || 0);

    let dragging = false;
    let moved = false;
    let startX=0, startY=0;
    let lastX=0, lastY=0;
    let vYaw=0, vPitch=0;

    const SENS = 0.0030;     // drag sensitivity
    const INERTIA = 0.90;    // velocity decay
    const PITCH_MIN = -1.15;
    const PITCH_MAX =  1.15;

    // deviceorientation blend (optional)
    let useDO = false;
    let doYaw = 0;
    let doPitch = 0;
    const DO_BLEND = 0.22;   // keep it subtle (drag still main)

    function apply(){
      if (rig && rig.object3D) rig.object3D.rotation.y = yaw;
      if (cam && cam.object3D) cam.object3D.rotation.x = pitch;
    }

    function onPointerDown(e){
      // ถ้ากดที่ target ให้ target จัดการ (ไม่บังคับ drag)
      const t = e.target;
      if (t && t.closest && t.closest('.gj-target')) return;

      dragging = true;
      moved = false;
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
    }
    function onPointerMove(e){
      if (!dragging) return;
      const dx = (e.clientX - lastX);
      const dy = (e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;

      if (!moved){
        const dd = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (dd > 6) moved = true;
      }

      if (moved){
        e.preventDefault?.();
        yaw   -= dx * SENS;
        pitch -= dy * SENS * 0.85;
        pitch = clamp(pitch, PITCH_MIN, PITCH_MAX);

        vYaw   = (-dx * SENS) * 0.75;
        vPitch = (-dy * SENS * 0.85) * 0.75;

        apply();
      }
    }
    function onPointerUp(){
      dragging = false;
    }

    layer.addEventListener('pointerdown', onPointerDown, { passive:true });
    layer.addEventListener('pointermove', onPointerMove, { passive:false });
    layer.addEventListener('pointerup', onPointerUp, { passive:true });
    layer.addEventListener('pointercancel', onPointerUp, { passive:true });

    // deviceorientation
    function onDO(e){
      // gamma: left/right, beta: front/back (rough)
      const g = Number(e.gamma || 0);
      const b = Number(e.beta || 0);
      // map to radians small
      doYaw = clamp(g / 60, -1, 1) * 0.35;
      doPitch = clamp((b-20) / 70, -1, 1) * 0.28;
    }

    let raf = 0;
    function tick(){
      // inertia
      if (!dragging){
        if (Math.abs(vYaw) > 0.00001 || Math.abs(vPitch) > 0.00001){
          yaw += vYaw;
          pitch += vPitch;
          pitch = clamp(pitch, PITCH_MIN, PITCH_MAX);
          vYaw *= INERTIA;
          vPitch *= INERTIA;
        }
      }

      // deviceorientation gentle blend
      if (useDO){
        yaw   = yaw * (1-DO_BLEND) + (yaw + doYaw) * DO_BLEND;
        pitch = pitch * (1-DO_BLEND) + (pitch + doPitch) * DO_BLEND;
        pitch = clamp(pitch, PITCH_MIN, PITCH_MAX);
      }

      apply();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    // enable DO after permission
    requestIOSMotionPermission().then(ok=>{
      if (!ok) return;
      useDO = true;
      window.addEventListener('deviceorientation', onDO, { passive:true });
    });

    // cleanup
    return ()=>{
      try{ cancelAnimationFrame(raf); }catch(_){}
      try{ layer.removeEventListener('pointerdown', onPointerDown); }catch(_){}
      try{ layer.removeEventListener('pointermove', onPointerMove); }catch(_){}
      try{ layer.removeEventListener('pointerup', onPointerUp); }catch(_){}
      try{ layer.removeEventListener('pointercancel', onPointerUp); }catch(_){}
      try{ window.removeEventListener('deviceorientation', onDO); }catch(_){}
    };
  }

  /* =========================
     Logger (IIFE) — FIX
     ========================= */
  function initLoggerIIFE(endpoint){
    try{
      if (window.HHACloudLogger && typeof window.HHACloudLogger.init === 'function'){
        window.HHACloudLogger.init({ endpoint, debug: true });
        try{ sessionStorage.setItem('HHA_LOGGER_ENDPOINT', String(endpoint || '')); }catch(_){}
        setLogBadge('ok', 'logger: ok ✓');
        return true;
      }
      setLogBadge('bad', 'logger: missing (skip)');
      return false;
    }catch(err){
      console.warn('[GoodJunkVR] logger init failed:', err);
      setLogBadge('bad', 'logger: failed (skip)');
      return false;
    }
  }

  /* =========================
     Quest shared state
     ========================= */
  const qState = {
    score:0, goodHits:0, miss:0, comboMax:0, timeLeft:0,
    streakGood:0,
    goldHitsThisMini:false,
    blocks:0,
    usedMagnet:false,   // kept for compatibility (we map magnet->stun)
    timePlus:0,
    safeNoJunkSeconds:0,
    bossCleared:false,
    challenge: CH_INIT,
    runMode: RUN_MODE,
    final8Good: 0
  };

  // Final Sprint แบบ 2: lock 1 วิถ้าโดน junk/miss ในช่วงท้าย
  let finalLockUntil = 0;
  let prevTimeLeft = 999;

  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    qState.final8Good = 0;
    finalLockUntil = 0;
  });

  let started = false;
  setInterval(()=>{
    if (!started) return;
    qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
  }, 1000);

  let Q = null;

  // FX hooks (from safe.js)
  window.addEventListener('quest:goodHit', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x ?? window.innerWidth*0.5);
    const y = Number(d.y ?? window.innerHeight*0.55);

    const isPerfect = String(d.judgment||'').toLowerCase().includes('perfect');
    fxBurst(x,y,true, isPerfect?20:14);
    fxPop(x,y, isPerfect?'PERFECT!':'GOOD!', true);

    // streak
    qState.streakGood = (qState.streakGood|0) + 1;

    // Final sprint count (only if not locked)
    if ((qState.timeLeft|0) <= 8){
      const tNow = Date.now();
      if (tNow >= finalLockUntil){
        qState.final8Good = (qState.final8Good|0) + 1;
      }else{
        // locked: show heavy feedback
        fxPop(window.innerWidth*0.5, window.innerHeight*0.42, '⛔ LOCK 1s', true);
      }
    }

    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:badHit', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x ?? window.innerWidth*0.5);
    const y = Number(d.y ?? window.innerHeight*0.55);

    fxBurst(x,y,false,14);
    fxPop(x,y,'JUNK!', true);

    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;

    // Final Sprint lock 1s when last 8s
    if ((qState.timeLeft|0) <= 8){
      finalLockUntil = Date.now() + 1000;
      fxPop(window.innerWidth*0.5, window.innerHeight*0.40, 'FINAL LOCK!', true);
    }

    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:block', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x ?? window.innerWidth*0.5);
    const y = Number(d.y ?? window.innerHeight*0.55);

    qState.blocks = (qState.blocks|0) + 1;
    fxBurst(x,y,true,10);
    fxPop(x,y,'BLOCK!', true);
    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:power', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x ?? window.innerWidth*0.5);
    const y = Number(d.y ?? window.innerHeight*0.55);
    const p = String(d.power||'').toLowerCase();

    // ✅ gold mini: use power:'gold'
    if (p === 'gold') qState.goldHitsThisMini = true;

    if (p === 'stun' || p === 'magnet') qState.usedMagnet = true; // compat flag
    if (p === 'time') qState.timePlus = (qState.timePlus|0) + 1;

    fxBurst(x,y,true,12);
    fxPop(x,y, (p||'power').toUpperCase()+'!', true);

    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:bossClear', ()=>{
    qState.bossCleared = true;
    fxPop(window.innerWidth*0.5, window.innerHeight*0.33, 'BOSS CLEAR!', true);
    fxBurst(window.innerWidth*0.5, window.innerHeight*0.33, true, 22);
    if (Q) Q.tick(qState);
  });

  // HUD update
  window.addEventListener('hha:judge', (e)=>{
    safeText(elJudge, (e.detail||{}).label || '\u00A0');
  });

  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      safeText(elTime, sec + 's');
      qState.timeLeft = sec|0;

      // enter final 8 window -> reset counter once
      if (prevTimeLeft > 8 && qState.timeLeft <= 8){
        qState.final8Good = 0;
        finalLockUntil = 0;
        fxPop(window.innerWidth*0.5, window.innerHeight*0.35, 'FINAL 8s!', true);
      }
      prevTimeLeft = qState.timeLeft;

      if (Q) Q.tick(qState);
    }
  });

  let lastMissSeen = 0;
  window.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if (typeof d.score === 'number'){ qState.score = d.score|0; safeText(elScore, String(qState.score)); }
    if (typeof d.misses === 'number'){
      qState.miss = d.misses|0;
      safeText(elMiss, String(qState.miss));
      if (qState.miss > lastMissSeen){
        qState.streakGood = 0;
        lastMissSeen = qState.miss;

        // Final Sprint lock if miss increments and last 8 seconds
        if ((qState.timeLeft|0) <= 8){
          finalLockUntil = Date.now() + 1000;
          fxPop(window.innerWidth*0.5, window.innerHeight*0.40, 'MISS LOCK!', true);
        }
      }
    }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; safeText(elCombo, String(qState.comboMax)); }
    if (Q) Q.tick(qState);
  });

  // Fever/Shield + STUN UI
  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const fever = Number(d.fever||0);
    const shield = Number(d.shield||0);
    const stunActive = !!d.stunActive;

    if (elFeverFill) elFeverFill.style.width = Math.max(0, Math.min(100, fever)) + '%';
    if (elFeverPct) safeText(elFeverPct, Math.round(Math.max(0, Math.min(100, fever))) + '%');
    if (elShield) safeText(elShield, String(shield|0));
    if (elStunBadge) elStunBadge.classList.toggle('show', stunActive);

    document.body.classList.toggle('stun-on', stunActive);
    if (elFire) elFire.style.opacity = stunActive ? '' : ''; // controlled by body class

    if (elVortex){
      elVortex.classList.toggle('show', stunActive);
      const ap = window.__GJ_AIM_POINT__;
      if (ap && stunActive){
        elVortex.style.left = (ap.x|0) + 'px';
        elVortex.style.top  = (ap.y|0) + 'px';
      }
    }
  });

  // quest:update bars
  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;
    const meta = d.meta || {};

    if (goal){
      const cur = (goal.cur|0), max = (goal.max|0);
      const pct = Math.max(0, Math.min(1, Number(goal.pct ?? (max>0?cur/max:0))));
      safeText(elQuestMain, goal.title || 'ภารกิจหลัก');
      safeStyleWidth(elQuestMainBar, Math.round(pct*100) + '%');
      safeText(elQuestMainCap, `${cur} / ${max}`);
    } else {
      safeText(elQuestMain, 'ภารกิจหลัก (ครบ) ✅');
      safeStyleWidth(elQuestMainBar, '100%');
      safeText(elQuestMainCap, '');
    }

    if (mini){
      const cur = (mini.cur|0), max = (mini.max|0);
      const pct = Math.max(0, Math.min(1, Number(mini.pct ?? (max>0?cur/max:0))));
      safeText(elQuestMini, 'Mini: ' + (mini.title || ''));
      safeStyleWidth(elQuestMiniBar, Math.round(pct*100) + '%');
      safeText(elQuestMiniCap, `${cur} / ${max}`);
    } else {
      safeText(elQuestMini, 'Mini quest (ครบ) ✅');
      safeStyleWidth(elQuestMiniBar, '100%');
      safeText(elQuestMiniCap, '');
    }

    const miniCount = (meta.miniCount|0);
    const minisCleared = (meta.minisCleared|0);
    safeText(elMiniCount, `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount+1}`);

    let hint = '';
    if (goal && String(goal.state||'').toLowerCase().includes('clear')) hint = 'GOAL CLEAR! 🎉';
    else if (mini && String(mini.state||'').toLowerCase().includes('clear')) hint = 'MINI CLEAR! ✨';
    else if (goal && Number(goal.pct||0) >= 0.8) hint = 'ใกล้แล้ว! 🔥';
    else if (mini && Number(mini.pct||0) >= 0.8) hint = 'อีกนิดเดียว! ⚡';
    safeText(elQuestHint, hint);
  });

  function applyRunPill(){
    safeText(elRunLabel, RUN_MODE.toUpperCase());
    if (elPill) elPill.classList.toggle('research', RUN_MODE === 'research');
    if (startSub){
      safeText(startSub, (RUN_MODE === 'research')
        ? 'โหมดวิจัย: ต้องมี Student ID หรือชื่อเล่นจาก Hub แล้วค่อยกดเริ่ม ✅'
        : 'เลือกความยาก + โหมดความมันส์ แล้วกดเริ่ม 1 ครั้ง (เพื่อเปิดสิทธิ์เสียง/VR) ✅'
      );
    }
  }

  function prefill(){
    try{ selDiff.value = DIFF_INIT; }catch(_){}
    try{ selChallenge.value = CH_INIT; }catch(_){}
    applyRunPill();
    safeText(elDiff, DIFF_INIT.toUpperCase());
    safeText(elChal, CH_INIT.toUpperCase());
    safeText(elTime, DUR_INIT + 's');
    setCoach('แตะของดี! หลบ junk! ⚡', 'neutral');
    setLogBadge(null, 'boot: ready');
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

    safeText(elDiff, diff.toUpperCase());
    safeText(elChal, chal.toUpperCase());
    safeText(elTime, durationSec + 's');

    // aim + look
    bindAimListeners();
    bindLookControls();
    initVRButton();

    // logger: use correct key for IIFE
    const endpoint =
      (sessionStorage.getItem('HHA_LOGGER_ENDPOINT') || '') ||
      'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';
    initLoggerIIFE(endpoint);

    // QuestDirector
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

        // particles sanity
        if (!getParticles()){
          console.warn('[GoodJunkVR] Particles not found. Did you load ./vr/particles.js ?');
        }
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefill();
}
