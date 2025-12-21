// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot (ROOT) — VR-look (drag + deviceorientation + inertia) + fever/shield bind + tap-anywhere
import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { initCloudLogger } from '../vr/hha-cloud-logger.js';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

(function () {
  'use strict';

  // bfcache fix
  window.addEventListener('pageshow', (e)=>{
    if (e.persisted) window.location.reload();
  });

  const $ = (id)=>document.getElementById(id);
  const safeText = (el, txt)=>{ try{ if (el) el.textContent = (txt ?? ''); }catch(_){} };
  const safeStyleWidth = (el, w)=>{ try{ if (el) el.style.width = w; }catch(_){} };
  const clamp = (v,min,max)=>{ v=Number(v)||0; return v<min?min:(v>max?max:v); };

  // HUD elements
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

  const elTouchHint = $('touch-hint');
  const btnVR      = $('btn-vr');
  const elCountdown = $('start-countdown');
  const elBigCelebrate = $('big-celebrate');

  const startOverlay = $('start-overlay');
  const btnStart2D = $('btn-start-2d');
  const btnStartVR = $('btn-start-vr');
  const selDiff = $('sel-diff');
  const selChallenge = $('sel-challenge');

  const logDot  = $('logdot');
  const logText = $('logtext');

  // Fever UI
  const elFeverFill = $('fever-fill');
  const elFeverPct  = $('fever-pct');
  const elShield    = $('shield-count');

  // URL params from hub
  const pageUrl = new window.URL(window.location.href);
  const URL_RUN = (pageUrl.searchParams.get('run') || 'play').toLowerCase();                 // play | research
  const URL_DIFF = (pageUrl.searchParams.get('diff') || 'normal').toLowerCase();            // easy | normal | hard
  const URL_CH = (pageUrl.searchParams.get('ch') || pageUrl.searchParams.get('challenge') || 'rush').toLowerCase(); // rush|boss|survival
  const URL_TIME_RAW = parseInt(pageUrl.searchParams.get('time') || '', 10);

  const DEFAULT_TIME = { easy:80, normal:60, hard:50 };
  function normDiff(v){ v=String(v||'normal').toLowerCase(); return (v==='easy'||v==='hard'||v==='normal') ? v : 'normal'; }
  function normCh(v){ v=String(v||'rush').toLowerCase(); return (v==='rush'||v==='boss'||v==='survival') ? v : 'rush'; }
  function normRun(v){ v=String(v||'play').toLowerCase(); return (v==='research') ? 'research' : 'play'; }

  const RUN_MODE = normRun(URL_RUN);
  const DIFF_INIT = normDiff(URL_DIFF);
  const CH_INIT = normCh(URL_CH);
  const DUR_INIT = clamp(
    (Number.isFinite(URL_TIME_RAW) ? URL_TIME_RAW : (DEFAULT_TIME[DIFF_INIT] || 60)),
    20, 180
  );

  // Coach images (ROOT)
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

  // ---------- FX helper ----------
  function getParticles(){
    return (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
  }
  function posFromDetail(detail){
    const x = (detail && typeof detail.x === 'number') ? detail.x : (window.innerWidth * 0.5);
    const y = (detail && typeof detail.y === 'number') ? detail.y : (window.innerHeight * 0.55);
    return { x, y };
  }
  function fxBurst(detail, good=true, count=14){
    const P = getParticles(); if (!P || !P.burstAt) return;
    const { x, y } = posFromDetail(detail);
    try{ P.burstAt(x, y, { count, good: !!good }); }catch(_){}
  }
  function fxPop(detail, label, plain=true){
    const P = getParticles(); if (!P || !P.scorePop) return;
    const { x, y } = posFromDetail(detail);
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

  async function tryEnterVR(){
    const scene = document.querySelector('a-scene');
    if (!scene) return false;
    try{ await scene.enterVR(); return true; }
    catch(err){ console.warn('[GoodJunkVR] enterVR blocked:', err); return false; }
  }

  function initVRButton(){
    if (!btnVR) return;
    btnVR.addEventListener('click', async ()=>{
      const cam = document.querySelector('#gj-camera');
      if (cam) cam.setAttribute('look-controls', 'enabled', true);
      try{ await document.querySelector('a-scene')?.enterVR(); }
      catch(err){ console.warn('[GoodJunkVR] enterVR error:', err); }
    });
  }

  // ---------- Logger badge ----------
  function setLogBadge(state, text){
    if (!logDot || !logText) return;
    logDot.classList.remove('ok','bad');
    if (state === 'ok') logDot.classList.add('ok');
    else if (state === 'bad') logDot.classList.add('bad');
    safeText(logText, text || (state==='ok' ? 'logger: ok' : state==='bad' ? 'logger: error' : 'logger: pending…'));
  }
  window.addEventListener('hha:logger', (e)=>{
    const d = e.detail || {};
    setLogBadge(d.ok ? 'ok' : 'bad', d.msg || '');
  });

  function getProfile(){
    let studentProfile = null;
    let studentKey = null;
    try{
      const raw = sessionStorage.getItem('HHA_STUDENT_PROFILE');
      if (raw){
        studentProfile = JSON.parse(raw);
        studentKey = studentProfile.studentKey || null;
      }
    }catch(_){}
    return { studentProfile, studentKey };
  }
  function hasProfile(p){
    if (!p || typeof p !== 'object') return false;
    return !!(p.studentId || p.name || p.nickName || p.studentNo);
  }

  // ---------- Quest state (shared) ----------
  const qState = {
    score:0, goodHits:0, miss:0, comboMax:0, timeLeft:0,
    streakGood:0,
    goldHits:0,
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

  // mini reset
  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    qState.final8Good = 0;
  });

  // safeNoJunkSeconds tick (นับ “เวลาปลอด junk”)
  let started = false;
  setInterval(()=>{
    if (!started) return;
    qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
  }, 1000);

  let Q = null;
  let ENGINE = null;

  // --------- เอฟเฟกต์: ฟัง event แล้วยิง FX ---------
  window.addEventListener('quest:goodHit', (e)=>{
    const d = e.detail || {};
    const isPerfect = String(d.judgment||'').toLowerCase().includes('perfect');
    fxBurst(d, true, isPerfect ? 18 : 14);
    fxPop(d, isPerfect ? 'PERFECT!' : 'GOOD!');
    if (Q) Q.onEvent(isPerfect ? 'perfectHit' : 'goodHit', qState);
  });

  window.addEventListener('quest:badHit', (e)=>{
    const d = e.detail || {};
    fxBurst(d, false, 14);
    fxPop(d, 'JUNK!');
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    if (Q) Q.onEvent('junkHit', qState);
  });

  window.addEventListener('quest:block', (e)=>{
    const d = e.detail || {};
    qState.blocks = (qState.blocks|0) + 1;
    fxBurst(d, true, 10);
    fxPop(d, 'BLOCK!');
    if (Q) Q.onEvent('shieldBlock', qState);
  });

  window.addEventListener('quest:power', (e)=>{
    const d = e.detail || {};
    const p = (d.power||'');
    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time')   qState.timePlus = (qState.timePlus|0) + 1;
    if (p === 'gold')   qState.goldHitsThisMini = true;
    fxBurst(d, true, 12);
    fxPop(d, String(p||'POWER').toUpperCase() + '!');
    if (Q) Q.onEvent('power', qState);
  });

  window.addEventListener('quest:bossClear', ()=>{
    qState.bossCleared = true;
    fxPop({ x: window.innerWidth*0.5, y: window.innerHeight*0.35 }, 'BOSS CLEAR!');
    fxBurst({ x: window.innerWidth*0.5, y: window.innerHeight*0.35 }, true, 22);
    if (Q) Q.onEvent('bossClear', qState);
  });

  window.addEventListener('quest:cleared', (e)=>{
    const d = e.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    if (kind.includes('goal')) fxCelebrate('goal');
    else fxCelebrate('mini');
    setCoach('เยี่ยม! ผ่านภารกิจแล้ว ไปต่อเลย! 🌟', 'happy');
  });

  // HUD listeners
  window.addEventListener('hha:judge', (e)=>{
    const label = (e.detail||{}).label || '';
    safeText(elJudge, label || '\u00A0');
  });

  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      safeText(elTime, sec + 's');
      qState.timeLeft = sec|0;

      // final 8 seconds trigger: ENGINE จะส่ง event เพิ่มเอง (ถ้ามี)
      if (Q) Q.tick(qState);
    }
  });

  window.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if (typeof d.score === 'number'){ qState.score = d.score|0; safeText(elScore, String(qState.score)); }
    if (typeof d.goodHits === 'number'){ qState.goodHits = d.goodHits|0; }
    if (typeof d.misses === 'number'){ qState.miss = d.misses|0; safeText(elMiss, String(qState.miss)); }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; safeText(elCombo, String(qState.comboMax)); }
    if (typeof d.challenge === 'string'){ qState.challenge = normCh(d.challenge); }
    if (Q) Q.tick(qState);
  });

  // ✅ bind fever/shield ให้แน่น (ไม่พึ่งไฟล์อื่น)
  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const fever = clamp(d.fever ?? 0, 0, 100);
    const shield = Math.max(0, (d.shield|0));
    if (elFeverFill) elFeverFill.style.width = fever + '%';
    if (elFeverPct) safeText(elFeverPct, Math.round(fever) + '%');
    if (elShield) safeText(elShield, String(shield));
  });

  // quest:update (schema ใหม่)
  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;
    const meta = d.meta || {};

    // goal
    if (goal){
      const cur = (goal.cur|0);
      const max = (goal.max|0);
      const pct = Math.max(0, Math.min(1, Number(goal.pct ?? (max>0?cur/max:0))));
      safeText(elQuestMain, goal.title || 'ภารกิจหลัก');
      safeStyleWidth(elQuestMainBar, Math.round(pct*100) + '%');
      safeText(elQuestMainCap, `${cur} / ${max}`);
    } else {
      safeText(elQuestMain, 'ภารกิจหลัก (ครบ) ✅');
      safeStyleWidth(elQuestMainBar, '100%');
      safeText(elQuestMainCap, '');
    }

    // mini
    if (mini){
      const cur = (mini.cur|0);
      const max = (mini.max|0);
      const pct = Math.max(0, Math.min(1, Number(mini.pct ?? (max>0?cur/max:0))));
      safeText(elQuestMini, 'Mini: ' + (mini.title || ''));
      safeStyleWidth(elQuestMiniBar, Math.round(pct*100) + '%');

      if (typeof mini.timeLeft === 'number' && typeof mini.timeTotal === 'number' && mini.timeTotal > 0){
        const secLeft = Math.max(0, mini.timeLeft/1000);
        safeText(elQuestMiniCap, `เหลือ ${secLeft >= 10 ? Math.round(secLeft) : (Math.round(secLeft*10)/10)}s`);
      } else {
        safeText(elQuestMiniCap, `${cur} / ${max}`);
      }
    } else {
      safeText(elQuestMini, 'Mini quest (ครบ) ✅');
      safeStyleWidth(elQuestMiniBar, '100%');
      safeText(elQuestMiniCap, '');
    }

    // hint
    let hint = '';
    if (goal && String(goal.state||'').toLowerCase().includes('clear')) hint = 'GOAL CLEAR! 🎉';
    else if (mini && String(mini.state||'').toLowerCase().includes('clear')) hint = 'MINI CLEAR! ✨';
    else if (goal && Number(goal.pct||0) >= 0.8) hint = 'ใกล้แล้ว! 🔥';
    else if (mini && Number(mini.pct||0) >= 0.8) hint = 'อีกนิดเดียว! ⚡';
    safeText(elQuestHint, hint);

    const miniCount = (meta.miniCount|0);
    const minisCleared = (Q && Q.getState) ? (Q.getState().minisCleared|0) : 0;
    safeText(elMiniCount, `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount+1}`);
  });

  // ---------- VR-look: drag + deviceorientation + inertia ----------
  function makeVRLookController(){
    const rig = document.querySelector('#gj-rig');
    const cam = document.querySelector('#gj-camera');
    const layer = document.getElementById('gj-layer');
    if (!rig || !layer) return null;

    const rot = rig.object3D.rotation;

    // drag offsets
    let dragging = false;
    let lastX = 0, lastY = 0;

    // inertia (จาก drag)
    let yawVel = 0;
    let pitchVel = 0;

    // device orientation
    let useDO = false;
    let doCalibrated = false;
    let doBaseYaw = 0;
    let doBasePitch = 0;
    let doYaw = 0;
    let doPitch = 0;

    // smoothing targets
    let targetYaw = rot.y;
    let targetPitch = rot.x;

    // tuning
    const SENS_YAW = 0.0036;
    const SENS_PITCH = 0.0031;
    const INERTIA = 0.92;          // ลดความเร็วต่อเฟรม
    const VEL_CLAMP = 0.08;
    const SMOOTH = 0.18;           // ลื่นจาก target -> current
    const PITCH_MIN = -1.15;
    const PITCH_MAX = 1.15;

    function normRad(a){
      a = Number(a)||0;
      const TWO = Math.PI*2;
      a = a % TWO;
      if (a < 0) a += TWO;
      return a;
    }

    function onPointerDown(ev){
      dragging = true;
      lastX = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
      lastY = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
      try{ layer.setPointerCapture?.(ev.pointerId); }catch(_){}
      ev.preventDefault?.();
      if (elTouchHint){
        elTouchHint.classList.add('show');
        setTimeout(()=> elTouchHint && elTouchHint.classList.remove('show'), 1200);
      }
    }

    function onPointerMove(ev){
      if (!dragging) return;
      const x = ev.clientX ?? ev.touches?.[0]?.clientX ?? lastX;
      const y = ev.clientY ?? ev.touches?.[0]?.clientY ?? lastY;

      const dx = x - lastX;
      const dy = y - lastY;

      lastX = x; lastY = y;

      // update target by drag
      targetYaw   -= dx * SENS_YAW;
      targetPitch -= dy * SENS_PITCH;
      targetPitch = clamp(targetPitch, PITCH_MIN, PITCH_MAX);

      // velocity for inertia
      yawVel   = clamp(yawVel   + (-dx * SENS_YAW)*0.55, -VEL_CLAMP, VEL_CLAMP);
      pitchVel = clamp(pitchVel + (-dy * SENS_PITCH)*0.55, -VEL_CLAMP, VEL_CLAMP);

      ev.preventDefault?.();
    }

    function onPointerUp(){
      dragging = false;
    }

    // ✅ capture:true = ลากบนเป้าก็หมุนได้
    layer.style.touchAction = 'none';
    layer.addEventListener('pointerdown', onPointerDown, { passive:false, capture:true });
    layer.addEventListener('pointermove', onPointerMove, { passive:false, capture:true });
    window.addEventListener('pointerup', onPointerUp, { passive:true });

    layer.addEventListener('touchstart', onPointerDown, { passive:false, capture:true });
    layer.addEventListener('touchmove', onPointerMove, { passive:false, capture:true });
    window.addEventListener('touchend', onPointerUp, { passive:true });

    function handleDeviceOrientation(ev){
      // alpha: 0..360 (yaw), beta: -180..180 (pitch-ish), gamma: -90..90 (roll)
      if (ev == null) return;

      const alpha = Number(ev.alpha);
      const beta  = Number(ev.beta);

      if (!Number.isFinite(alpha) || !Number.isFinite(beta)) return;

      // map
      const yaw = normRad(alpha * Math.PI / 180);
      // beta: front-back tilt (เอามาทำ pitch แบบเบา ๆ)
      let pitch = (beta * Math.PI / 180);
      pitch = clamp(pitch * 0.55, PITCH_MIN, PITCH_MAX);

      if (!doCalibrated){
        doCalibrated = true;
        doBaseYaw = yaw;
        doBasePitch = pitch;
      }

      // relative to base (calibration)
      let relYaw = yaw - doBaseYaw;
      // wrap to [-pi,pi]
      if (relYaw > Math.PI) relYaw -= Math.PI*2;
      if (relYaw < -Math.PI) relYaw += Math.PI*2;

      const relPitch = clamp(pitch - doBasePitch, PITCH_MIN, PITCH_MAX);

      doYaw = relYaw;
      doPitch = relPitch;
    }

    async function enableDeviceOrientation(){
      // iOS needs permission
      try{
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
          const res = await DeviceOrientationEvent.requestPermission();
          if (String(res).toLowerCase() !== 'granted'){
            useDO = false;
            return false;
          }
        }
      }catch(_){
        // permission denied or not supported
      }

      // attach listener
      try{
        window.addEventListener('deviceorientation', handleDeviceOrientation, { passive:true });
        useDO = true;
        doCalibrated = false;
        return true;
      }catch(_){
        useDO = false;
        return false;
      }
    }

    function recalibrate(){
      doCalibrated = false;
    }

    function tick(){
      // inertia decay
      yawVel *= INERTIA;
      pitchVel *= INERTIA;

      // deviceorientation adds to target (ถ้าเปิด)
      const doAddYaw = (useDO ? doYaw : 0);
      const doAddPitch = (useDO ? doPitch : 0);

      // final targets
      const wantYaw = targetYaw + doAddYaw;
      const wantPitch = clamp(targetPitch + doAddPitch, PITCH_MIN, PITCH_MAX);

      // smooth follow + inertia
      rot.y = rot.y + (wantYaw - rot.y) * SMOOTH + yawVel;
      rot.x = clamp(rot.x + (wantPitch - rot.x) * SMOOTH + pitchVel, PITCH_MIN, PITCH_MAX);

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    return {
      enableDeviceOrientation,
      recalibrate,
      setVRMode(isVR){
        // VR mode: เปิด look-controls เพื่อใช้ head tracking (ถ้ามี)
        if (cam) cam.setAttribute('look-controls', 'enabled', !!isVR);
      }
    };
  }

  let LOOK = null;

  // ---------- tap-anywhere assist ----------
  function bindTapAnywhere(){
    const layer = document.getElementById('gj-layer');
    if (!layer) return;

    let downX=0, downY=0, moved=false, downAt=0;
    const TAP_MS=260, TAP_PX=10;

    function getXY(ev){
      const x = ev?.clientX ?? ev?.touches?.[0]?.clientX ?? ev?.changedTouches?.[0]?.clientX;
      const y = ev?.clientY ?? ev?.touches?.[0]?.clientY ?? ev?.changedTouches?.[0]?.clientY;
      return { x: Number.isFinite(x)?x:0, y: Number.isFinite(y)?y:0 };
    }

    layer.addEventListener('pointerdown', (ev)=>{
      const p=getXY(ev);
      downX=p.x; downY=p.y; moved=false; downAt=performance.now();
    }, { passive:true });

    layer.addEventListener('pointermove', (ev)=>{
      const p=getXY(ev);
      const dx=p.x-downX, dy=p.y-downY;
      if ((dx*dx+dy*dy)>(TAP_PX*TAP_PX)) moved=true;
    }, { passive:true });

    layer.addEventListener('pointerup', (ev)=>{
      if (!ENGINE || typeof ENGINE.tapAt !== 'function') return;
      const dt = performance.now()-downAt;
      if (moved || dt > TAP_MS) return;

      const p=getXY(ev);
      // ✅ tap-anywhere: ถ้าไม่ได้แตะโดน target โดยตรง engine จะเลือกเป้าใกล้สุด
      try{ ENGINE.tapAt(p.x, p.y); }catch(_){}
    }, { passive:true });
  }

  function applyRunPill(){
    const runTxt = RUN_MODE.toUpperCase();
    safeText(elRunLabel, runTxt);
    if (elPill) elPill.classList.toggle('research', RUN_MODE === 'research');

    if (startSub){
      safeText(startSub, (RUN_MODE === 'research')
        ? 'โหมดวิจัย: ต้องมี Student ID หรือชื่อเล่นจาก Hub แล้วค่อยกดเริ่ม ✅'
        : 'เลือกความยาก + โหมดความมันส์ แล้วกดเริ่ม 1 ครั้ง (เพื่อเปิดสิทธิ์เสียง/VR) ✅'
      );
    }
  }

  function prefillFromHub(){
    try{ selDiff.value = DIFF_INIT; }catch(_){}
    try{ selChallenge.value = CH_INIT; }catch(_){}

    applyRunPill();

    safeText(elDiff, DIFF_INIT.toUpperCase());
    safeText(elChal, CH_INIT.toUpperCase());
    safeText(elTime, DUR_INIT + 's');

    setCoachFace('neutral');

    const endpoint = sessionStorage.getItem('HHA_LOG_ENDPOINT');
    if (endpoint) setLogBadge(null, 'logger: endpoint set ✓');
    else setLogBadge(null, 'logger: endpoint missing (hub?)');
  }

  async function bootOnce({ wantVR }){
    if (started) return;

    // research gate
    if (RUN_MODE === 'research'){
      const { studentProfile } = getProfile();
      if (!hasProfile(studentProfile)){
        alert('โหมดวิจัย: กรุณากรอก "รหัสนักเรียน" หรือ "ชื่อเล่น" ที่ Hub ก่อน แล้วกลับมาเริ่มใหม่');
        window.location.href = './hub.html';
        return;
      }
    }

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

    safeText(elScore, '0');
    safeText(elCombo, '0');
    safeText(elMiss,  '0');
    safeText(elJudge, '\u00A0');

    setCoach('แตะของดี! หลบ junk! ไปเลย! ⚡', 'neutral');

    // profile from hub
    const { studentProfile, studentKey } = getProfile();

    // logger endpoint + fallback
    const endpoint =
      sessionStorage.getItem('HHA_LOG_ENDPOINT') ||
      'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';

    setLogBadge(null, 'logger: init…');

    initCloudLogger({
      endpoint,
      projectTag: 'HeroHealth-GoodJunkVR',
      mode: 'GoodJunkVR',
      runMode: RUN_MODE,
      diff,
      challenge: chal,
      durationPlannedSec: durationSec,
      studentKey,
      profile: studentProfile,
      debug: true
    });

    // init look controller
    LOOK = makeVRLookController();
    initVRButton();

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
        try{
          // start engine first so tap-anywhere works even if VR fails
          ENGINE = goodjunkBoot({
            diff,
            run: RUN_MODE,
            challenge: chal,
            time: durationSec,
            layerEl: document.getElementById('gj-layer'),
            rigEl: document.getElementById('gj-rig')
          });
          if (!ENGINE) throw new Error('ENGINE is null (goodjunkBoot failed)');
          window.__GJ_ENGINE__ = ENGINE;

          // bind tap-anywhere assist
          bindTapAnywhere();

          // enable device orientation on mobile (permission requires user gesture — we are inside Start click flow)
          try{
            await LOOK?.enableDeviceOrientation?.();
          }catch(_){}

          // VR?
          if (wantVR){
            LOOK?.setVRMode?.(true);
            await tryEnterVR();
          }else{
            LOOK?.setVRMode?.(false);
          }

          // sanity: particles
          if (!getParticles()) {
            console.warn('[GoodJunkVR] Particles not found (did you load ./vr/particles.js before this module?)');
          }

          // initial tick to paint quest
          try{ Q && Q.tick && Q.tick(qState); }catch(_){}
        }catch(err){
          console.error('[GoodJunkVR] boot failed:', err);
          alert('กด Start แล้วเข้าเกมไม่สำเร็จ\nดู Console: error บรรทัดแรก');
        }
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  // “tap-anywhere to start” (แตะพื้นหลัง overlay เริ่ม 2D)
  startOverlay?.addEventListener('click', (ev)=>{
    const t = ev.target;
    // อย่ากิน event ของ select/button
    if (t && (t.closest?.('button') || t.closest?.('select'))) return;
    if (!started) bootOnce({ wantVR:false });
  });

  prefillFromHub();
})();
