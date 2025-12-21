// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Final Sprint v2 binder: STUN bar + coach event + input lock class

import { boot as goodjunkBoot } from './goodjunk.safe.js';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

export function boot(){
  'use strict';
  if (window.__GJ_PAGE_BOOTED__) return;
  window.__GJ_PAGE_BOOTED__ = true;

  window.addEventListener('pageshow', (e)=>{ if (e.persisted) window.location.reload(); });

  const $ = (id)=>document.getElementById(id);
  const safeText = (el, txt)=>{ try{ if (el) el.textContent = (txt ?? ''); }catch(_){ } };

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
  const elFlame  = $('fever-flame');
  const elTouchHint = $('touch-hint');

  // ✅ STUN bar
  const elStunRow  = $('stun-row');
  const elStunFill = $('stun-fill');
  const elStunTime = $('stun-time');

  const layerEl = document.getElementById('gj-layer');

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
  function setCoach(text, mood='neutral', holdMs=4200){
    if (elCoachBubble) elCoachBubble.classList.add('show');
    safeText(elCoachText, text || '');
    setCoachFace(mood);
    if (lastCoachTimeout) clearTimeout(lastCoachTimeout);
    lastCoachTimeout = setTimeout(()=> elCoachBubble && elCoachBubble.classList.remove('show'), holdMs);
  }

  // ✅ listen coach event from engine
  window.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if (d.text) setCoach(String(d.text), String(d.mood||'neutral'), Number(d.holdMs||4200));
  });

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

  // --------- Aim Point (center of STUN) ----------
  function setAimPoint(x, y){
    window.__GJ_AIM_POINT__ = { x: x|0, y: y|0, t: Date.now() };
    if (elVortex){
      elVortex.style.left = (x|0) + 'px';
      elVortex.style.top  = (y|0) + 'px';
    }
  }
  function defaultAim(){ setAimPoint(window.innerWidth*0.5, window.innerHeight*0.62); }
  function bindAimListeners(){
    if (!layerEl) return;
    defaultAim();

    layerEl.addEventListener('pointerdown', (e)=>{
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

  // --------- VR LOOK: drag + gyro + inertia ----------
  function attachVRLook(cameraEl, opts = {}){
    if (!cameraEl || !cameraEl.object3D) return { enableGyro: async()=>false, destroy: ()=>{} };

    const layer = opts.layerEl || document.getElementById('gj-layer') || document.body;
    const hint  = opts.hintEl || elTouchHint;
    const sensitivity = Number(opts.sensitivity ?? 0.0034);
    const pitchMin = Number(opts.pitchMin ?? -1.18);
    const pitchMax = Number(opts.pitchMax ??  1.18);

    let yaw = 0, pitch = 0;
    let vy = 0, vp = 0;
    let dragging = false;
    let lastX = 0, lastY = 0;
    let raf = 0;

    // gyro
    let gyroOn = false;
    let gBaseA = null, gBaseB = null;
    let gYaw = 0, gPitch = 0;

    function clampRad(v, a, b){ return (v < a) ? a : (v > b) ? b : v; }
    function wrapPI(v){
      v = Number(v)||0;
      const TWO = Math.PI*2;
      v = v % TWO; if (v < 0) v += TWO;
      return v;
    }
    function apply(){
      cameraEl.object3D.rotation.y = wrapPI(yaw);
      cameraEl.object3D.rotation.x = clampRad(pitch, pitchMin, pitchMax);
    }
    function showHint(){
      if (!hint) return;
      hint.classList.add('show');
      setTimeout(()=> hint.classList.remove('show'), 1800);
    }
    showHint();

    function onDown(e){
      dragging = true;
      lastX = e.clientX || 0; lastY = e.clientY || 0;
      try{ layer.setPointerCapture(e.pointerId); }catch(_){}
      try{ layer.classList.add('dragging'); }catch(_){}
      e.preventDefault?.();
    }
    function onMove(e){
      if (!dragging) return;
      const x = e.clientX || 0, y = e.clientY || 0;
      const dx = x - lastX, dy = y - lastY;
      lastX = x; lastY = y;

      yaw   -= dx * sensitivity;
      pitch -= dy * sensitivity;

      vy = (-dx * sensitivity) * 0.55;
      vp = (-dy * sensitivity) * 0.55;

      apply();
      e.preventDefault?.();
    }
    function onUp(e){
      dragging = false;
      try{ layer.classList.remove('dragging'); }catch(_){}
      e.preventDefault?.();
    }

    layer.addEventListener('pointerdown', onDown, { passive:false });
    layer.addEventListener('pointermove', onMove, { passive:false });
    layer.addEventListener('pointerup', onUp, { passive:false });
    layer.addEventListener('pointercancel', onUp, { passive:false });

    function tick(){
      if (!dragging){
        const damp = 0.88;
        vy *= damp; vp *= damp;
        if (Math.abs(vy) > 0.00002 || Math.abs(vp) > 0.00002){
          yaw += vy; pitch += vp;
        }
      }
      if (gyroOn){
        const blend = 0.12;
        yaw   = yaw   + (gYaw   - yaw)   * blend;
        pitch = pitch + (gPitch - pitch) * blend;
      }
      apply();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    function onDeviceOri(ev){
      if (!gyroOn) return;
      const a = Number(ev.alpha || 0);
      const b = Number(ev.beta  || 0);
      const aRad = (a * Math.PI) / 180;
      const bRad = (b * Math.PI) / 180;
      if (gBaseA == null){ gBaseA = aRad; gBaseB = bRad; }
      let ry = aRad - gBaseA;
      let rp = (bRad - gBaseB) * 0.85;
      gYaw = wrapPI(yaw + ry);
      gPitch = clampRad(pitch + rp, pitchMin, pitchMax);
    }

    async function enableGyro(){
      if (!('DeviceOrientationEvent' in window)) return false;
      try{
        if (typeof window.DeviceOrientationEvent.requestPermission === 'function'){
          const res = await window.DeviceOrientationEvent.requestPermission();
          if (String(res) !== 'granted') return false;
        }
        gyroOn = true; gBaseA = null; gBaseB = null;
        window.addEventListener('deviceorientation', onDeviceOri, true);
        return true;
      }catch(_){ return false; }
    }

    function destroy(){
      try{ cancelAnimationFrame(raf); }catch(_){}
      try{
        layer.removeEventListener('pointerdown', onDown);
        layer.removeEventListener('pointermove', onMove);
        layer.removeEventListener('pointerup', onUp);
        layer.removeEventListener('pointercancel', onUp);
      }catch(_){}
      try{ window.removeEventListener('deviceorientation', onDeviceOri, true); }catch(_){}
    }

    return { enableGyro, destroy };
  }

  // Quest shared state
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
  setInterval(()=>{ if (started) qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1; }, 1000);

  let Q = null;

  window.addEventListener('quest:goodHit', ()=>{
    qState.streakGood = (qState.streakGood|0) + 1;
    if ((qState.timeLeft|0) <= 8) qState.final8Good = (qState.final8Good|0) + 1;
    if (Q) Q.tick(qState);
  });
  window.addEventListener('quest:badHit', ()=>{
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    if (Q) Q.tick(qState);
  });
  window.addEventListener('quest:block', ()=>{
    qState.blocks = (qState.blocks|0) + 1;
    if (Q) Q.tick(qState);
  });
  window.addEventListener('quest:power', (e)=>{
    const d = e.detail || {};
    const p = (d.power||'');
    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time') qState.timePlus = (qState.timePlus|0) + 1;
    if (p === 'gold') qState.goldHitsThisMini = true;
    if (Q) Q.tick(qState);
  });
  window.addEventListener('quest:bossClear', ()=>{
    qState.bossCleared = true;
    if (Q) Q.tick(qState);
  });

  window.addEventListener('hha:judge', (e)=>{ safeText(elJudge, (e.detail||{}).label || '\u00A0'); });
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
    if (typeof d.goodHits === 'number'){ qState.goodHits = d.goodHits|0; } // ✅ important
    if (typeof d.misses === 'number'){
      qState.miss = d.misses|0;
      safeText(elMiss, String(qState.miss));
      if (qState.miss > lastMissSeen){ qState.streakGood = 0; lastMissSeen = qState.miss; }
    }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; safeText(elCombo, String(qState.comboMax)); }
    if (Q) Q.tick(qState);
  });

  // Fever + STUN badge + vortex + flame + STUN bar + input lock
  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const fever = Number(d.fever||0);
    const shield = Number(d.shield||0);
    const stunActive = !!d.stunActive;

    if (elFeverFill) elFeverFill.style.width = Math.max(0, Math.min(100, fever)) + '%';
    if (elFeverPct) safeText(elFeverPct, Math.round(Math.max(0, Math.min(100, fever))) + '%');
    if (elShield) safeText(elShield, String(shield|0));
    if (elStunBadge) elStunBadge.classList.toggle('show', stunActive);
    if (elFlame) elFlame.classList.toggle('show', stunActive || fever >= 85);

    // ✅ STUN bar bind
    const leftMs = Number(d.stunLeftMs || 0);
    const durMs  = Number(d.stunDurMs  || 0);
    if (elStunRow) elStunRow.classList.toggle('show', stunActive && durMs > 0);
    if (elStunFill && stunActive && durMs > 0){
      const pct = Math.max(0, Math.min(1, leftMs / durMs));
      elStunFill.style.width = Math.round(pct * 100) + '%';
    } else if (elStunFill){
      elStunFill.style.width = '0%';
    }
    if (elStunTime){
      elStunTime.textContent = stunActive ? (Math.max(0, leftMs)/1000).toFixed(1)+'s' : '0.0s';
    }

    // ✅ input lock class (1s) from engine
    const lockMs = Number(d.lockMs || 0);
    if (layerEl && lockMs > 0){
      layerEl.classList.add('input-locked');
      setTimeout(()=> layerEl.classList.remove('input-locked'), lockMs);
    }

    if (elVortex){
      elVortex.classList.toggle('show', stunActive);
      const ap = window.__GJ_AIM_POINT__;
      if (ap && stunActive){
        elVortex.style.left = (ap.x|0) + 'px';
        elVortex.style.top  = (ap.y|0) + 'px';
      }
    }
  });

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
        : 'เลือกความยาก + โหมดความมันส์ แล้วกดเริ่ม 1 ครั้ง ✅';
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
    setLogBadge(null, 'boot: ready');
  }

  function initLogger(payload){
    try{
      const L = window.HHACloudLogger;
      if (L && typeof L.init === 'function'){
        L.init({ endpoint: payload.endpoint, debug: !!payload.debug });
        setLogBadge('ok', 'logger: ok ✓');
        return true;
      }
      setLogBadge('bad', 'logger: not found (skip)');
      return false;
    }catch(err){
      setLogBadge('bad', 'logger: init failed (skip)');
      console.warn('[GoodJunkVR] logger init failed:', err);
      return false;
    }
  }

  function waitSceneReady(cb){
    const scene = document.querySelector('a-scene');
    if (!scene) { cb(); return; }
    const tryReady = ()=> (scene.hasLoaded && scene.camera);
    if (tryReady()) { cb(); return; }
    scene.addEventListener('loaded', ()=>{
      let tries=0;
      const it = setInterval(()=>{
        tries++;
        if (tryReady() || tries>80){ clearInterval(it); cb(); }
      }, 50);
    }, { once:true });
  }

  let LOOK = null;

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

    bindAimListeners();
    initVRButton();

    const endpoint =
      sessionStorage.getItem('HHA_LOG_ENDPOINT') ||
      sessionStorage.getItem('HHA_LOGGER_ENDPOINT') ||
      'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';

    initLogger({ endpoint, debug:true });

    // look controls (drag + gyro)
    const cam = document.querySelector('#gj-camera');
    LOOK = attachVRLook(cam, { layerEl, hintEl: elTouchHint, sensitivity: 0.0034 });
    try{
      const ok = await LOOK.enableGyro();
      if (ok) setCoach('Gyro พร้อม! หมุนมือถือ = หมุนมุมมอง 🥽', 'happy');
    }catch(_){}

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
          layerEl
        });

        window.__GJ_ENGINE__ = ENGINE;
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefill();
}
