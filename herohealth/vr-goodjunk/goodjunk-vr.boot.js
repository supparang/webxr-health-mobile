// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR — VR/DOM BOOT (PRODUCTION) ✅ (Quest FIX: always shows)
// - Correct paths for /herohealth/*.html + /herohealth/vr-goodjunk/*.js
// - Quest Director compat: accepts goalDefs/miniDefs OR goals/minis
// - Forces quest:update early via Q.getActive() pump + Q.start(qState)
// - Provides window.__GJ_QSTATE__ for director getActive()
// - Keeps all FX/Coach/Boss hooks

import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';

import { makeQuestDirector } from './quest-director-goodjunk.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

export function boot(){
  'use strict';
  if (window.__GJ_PAGE_BOOTED__) return;
  window.__GJ_PAGE_BOOTED__ = true;

  window.addEventListener('pageshow', (e)=>{ if (e.persisted) window.location.reload(); });

  const $ = (id)=>document.getElementById(id);
  const safeText = (el, txt)=>{ try{ if (el) el.textContent = (txt ?? ''); }catch(_){ } };

  // ---- HUD ----
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

  // ---- QUEST HUD ----
  const elQuestMain = $('hud-quest-main');
  const elQuestMini = $('hud-quest-mini');
  const elQuestMainBar = $('hud-quest-main-bar');
  const elQuestMiniBar = $('hud-quest-mini-bar');
  const elQuestMainCap = $('hud-quest-main-caption');
  const elQuestMiniCap = $('hud-quest-mini-caption');
  const elQuestHint = $('hud-quest-hint');
  const elMiniCount = $('hud-mini-count');

  // ---- COACH ----
  const elCoachBubble = $('coach-bubble');
  const elCoachText   = $('coach-text');
  const elCoachEmoji  = $('coach-emoji');

  // ---- START / VR ----
  const elCountdown = $('start-countdown');
  const btnVR      = $('btn-vr');

  const startOverlay = $('start-overlay');
  const btnStart2D = $('btn-start-2d');
  const btnStartVR = $('btn-start-vr');
  const selDiff = $('sel-diff');
  const selChallenge = $('sel-challenge');

  // ---- LOGGER BADGE ----
  const logDot  = $('logdot');
  const logText = $('logtext');

  // ---- FEVER ----
  const elFeverFill = $('fever-fill');
  const elFeverPct  = $('fever-pct');
  const elShield    = $('shield-count');
  const elStunBadge = $('hud-stun');

  const elVortex = $('stun-vortex');
  const elBeacon = $('boss-beacon');

  // ---- FX ----
  const gameCam = $('game-cam');
  const fxChroma = $('fx-chroma');

  // ---- BOSS HUD ----
  const elBossWrap = $('boss-wrap');
  const elBossFill = $('boss-fill');
  const elBossPhase= $('boss-phase');

  // ---- SUMMARY ----
  const sumOverlay = $('sum-overlay');
  const sumScore = $('sum-score');
  const sumGood  = $('sum-good');
  const sumMiss  = $('sum-miss');
  const sumCombo = $('sum-combo');
  const btnReplay = $('btn-replay');
  const btnExit = $('btn-exit');

  // ---- URL PARAMS ----
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
  const DUR_INIT = clamp((Number.isFinite(URL_TIME_RAW) ? URL_TIME_RAW : (DEFAULT_TIME[DIFF_INIT] || 60)), 20, 180);

  // ---- COACH IMG ----
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

  function setLogBadge(state, text){
    if (!logDot || !logText) return;
    logDot.style.background = '#9ca3af';
    if (state === 'ok') logDot.style.background = '#22c55e';
    else if (state === 'bad') logDot.style.background = '#ef4444';
    safeText(logText, text || '');
  }

  // ---- tiny beep ----
  let __audioCtx = null;
  function beep(freq=880, ms=70, gain=0.035){
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      __audioCtx = __audioCtx || new AC();
      const t0 = __audioCtx.currentTime;
      const osc = __audioCtx.createOscillator();
      const g = __audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g); g.connect(__audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + ms/1000);
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
    try{ attachTouchLook(cameraEl, { sensitivity: 0.26, areaEl: document.body }); }catch(_){}
  }

  // ---- AIM POINT bridge -> safe.js ----
  function setAimPoint(x, y){
    window.__GJ_AIM_POINT__ = { x: x|0, y: y|0, t: Date.now() };
    if (elVortex){
      elVortex.style.left = (x|0) + 'px';
      elVortex.style.top  = (y|0) + 'px';
    }
  }
  function defaultAim(){ setAimPoint(window.innerWidth*0.5, window.innerHeight*0.62); }
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

  // ---- safeMargins compute (avoid HUD overlap) ----
  function computeSafeMargins(){
    const base = { top:130, bottom:170, left:26, right:26 };
    try{
      const hudTop = document.querySelector('.hud-top');
      const hudBottom = document.querySelector('.hud-bottom');
      const hudLeft = document.querySelector('.hud-left');
      const hudRight = document.querySelector('.hud-right');

      if (hudTop){
        const r = hudTop.getBoundingClientRect();
        base.top = Math.max(base.top, Math.ceil(r.bottom) + 10);
      }
      if (hudBottom){
        const r = hudBottom.getBoundingClientRect();
        base.bottom = Math.max(base.bottom, Math.ceil(window.innerHeight - r.top) + 10);
      }
      if (hudLeft){
        const r = hudLeft.getBoundingClientRect();
        base.left = Math.max(base.left, Math.ceil(r.right) + 10);
      }
      if (hudRight){
        const r = hudRight.getBoundingClientRect();
        base.right = Math.max(base.right, Math.ceil(window.innerWidth - r.left) + 10);
      }
    }catch(_){}
    return base;
  }

  // ---- Quest shared state (matches your quest-defs eval fields) ----
  const qState = {
    score:0, goodHits:0, miss:0, comboMax:0, timeLeft:0,
    streakGood:0, goldHitsThisMini:false, blocks:0, usedMagnet:false,
    timePlus:0, safeNoJunkSeconds:0, bossCleared:false,
    challenge: CH_INIT, runMode: RUN_MODE, final8Good: 0
  };

  // ✅ expose for director getActive()
  window.__GJ_QSTATE__ = qState;

  let started = false;
  setInterval(()=>{ if (started) qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1; }, 1000);

  let Q = null;

  // Reset per mini
  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    qState.final8Good = 0;

    // ✅ force HUD refresh even if no gameplay events yet
    if (Q) Q.tick(qState);
  });

  // Game events -> quest tick
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

  // HUD judge
  window.addEventListener('hha:judge', (e)=>{ safeText(elJudge, (e.detail||{}).label || '\u00A0'); });

  // time
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      safeText(elTime, sec + 's');
      qState.timeLeft = sec|0;
      if (Q) Q.tick(qState);
    }
  });

  // score + boss hud
  let lastMissSeen = 0;
  window.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if (typeof d.score === 'number'){ qState.score = d.score|0; safeText(elScore, String(qState.score)); }
    if (typeof d.misses === 'number'){
      qState.miss = d.misses|0;
      safeText(elMiss, String(qState.miss));
      if (qState.miss > lastMissSeen){ qState.streakGood = 0; lastMissSeen = qState.miss; }
    }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; safeText(elCombo, String(qState.comboMax)); }
    if (Q) Q.tick(qState);

    const bossAlive = !!d.bossAlive;
    const hp = Number(d.bossHp||0);
    const hpMax = Math.max(1, Number(d.bossHpMax||1));
    const phase = Number(d.bossPhase||1);

    if (elBossWrap) elBossWrap.classList.toggle('show', bossAlive);
    if (elBossFill) elBossFill.style.width = bossAlive ? (Math.max(0, Math.min(1, hp/hpMax))*100).toFixed(0)+'%' : '0%';
    if (elBossPhase) elBossPhase.textContent = bossAlive ? ('P' + (phase|0)) : 'P1';
  });

  // fever/shield + shake
  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const fever = Math.max(0, Math.min(100, Number(d.fever||0)));
    const shield = Number(d.shield||0);
    const stunActive = !!d.stunActive;

    if (elFeverFill) elFeverFill.style.width = fever + '%';
    if (elFeverPct) safeText(elFeverPct, Math.round(fever) + '%');
    if (elShield) safeText(elShield, String(shield|0));
    if (elStunBadge) elStunBadge.classList.toggle('show', stunActive);

    if (elVortex){
      elVortex.classList.toggle('show', stunActive);
      const ap = window.__GJ_AIM_POINT__;
      if (ap && stunActive){
        elVortex.style.left = (ap.x|0) + 'px';
        elVortex.style.top  = (ap.y|0) + 'px';
      }
    }

    if (gameCam){
      const amp = (fever/100);
      const px = (amp < 0.18) ? 0 : (0.6 + amp*2.8);
      document.documentElement.style.setProperty('--shakeAmp', px.toFixed(2)+'px');
      document.documentElement.style.setProperty('--shakeDur', (0.30 - amp*0.10).toFixed(2)+'s');
      gameCam.classList.toggle('shake', fever >= 18);
      gameCam.classList.toggle('stun-fire', stunActive);
    }

    if (fever >= 92 && !stunActive) beep(980, 40, 0.025);
    if (stunActive) beep(220, 30, 0.02);
  });

  // final lock pulse
  window.addEventListener('hha:finalPulse', (e)=>{
    const sec = (e.detail||{}).secLeft|0;
    if (elVortex){
      elVortex.classList.add('lock');
      setTimeout(()=>{ try{ elVortex.classList.remove('lock'); }catch(_){ } }, 980);
    }
    try{ navigator.vibrate && navigator.vibrate(20); }catch(_){}
    beep(760, 60, 0.03);
    if (sec > 0) setCoach(`🏁 FINAL LOCK! เหลือ ${sec}s — อย่าพลาด!`, 'fever', 1400);
  });

  // boss beacon
  let beaconTimer = null;
  window.addEventListener('hha:bossPulse', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x||0), y = Number(d.y||0);
    const ttl = Number(d.ttlMs||1200);

    if (elBeacon){
      elBeacon.classList.add('show');
      elBeacon.style.left = (x|0)+'px';
      elBeacon.style.top  = (y|0)+'px';
      if (beaconTimer) clearTimeout(beaconTimer);
      beaconTimer = setTimeout(()=>{ try{ elBeacon.classList.remove('show'); }catch(_){ } }, Math.max(300, ttl|0));
    }

    beep(1040, 70, 0.035);
    try{ navigator.vibrate && navigator.vibrate([25,40,25]); }catch(_){}
    setCoach('⚠️ BOSS PULSE! แตะย้าย “ศูนย์กลาง” ไปที่วงสีทองเร็ว!', 'fever', 1800);
  });

  // FX hooks
  let kickTimer = null;
  let chromaTimer = null;

  function doKick(intensity=1){
    if (!gameCam) return;
    const amp = Math.max(6, Math.min(18, 10 * intensity));
    const rot = Math.max(2, Math.min(8, 4 * intensity));
    document.documentElement.style.setProperty('--kickAmp', amp.toFixed(0)+'px');
    document.documentElement.style.setProperty('--kickRot', rot.toFixed(0)+'deg');

    gameCam.classList.add('kick');
    if (kickTimer) clearTimeout(kickTimer);
    kickTimer = setTimeout(()=>{ try{ gameCam.classList.remove('kick'); }catch(_){ } }, 260);
  }

  function doChroma(ms=180, hero=false){
    if (!fxChroma) return;
    fxChroma.classList.toggle('hero', !!hero);
    fxChroma.classList.add('show');
    if (chromaTimer) clearTimeout(chromaTimer);
    chromaTimer = setTimeout(()=>{ try{ fxChroma.classList.remove('show'); fxChroma.classList.remove('hero'); }catch(_){ } }, Math.max(120, ms|0));
  }

  window.addEventListener('hha:fx', (e)=>{
    const d = e.detail || {};
    const type = String(d.type||'');
    if (type === 'kick'){
      doKick(Number(d.intensity||1));
      beep(160, 70, 0.03);
      try{ navigator.vibrate && navigator.vibrate(25); }catch(_){}
    } else if (type === 'chroma'){
      doChroma(Number(d.ms||180), false);
      beep(220, 40, 0.02);
    } else if (type === 'hero'){
      doChroma(Number(d.ms||180), true);
      beep(740, 60, 0.03);
      try{ navigator.vibrate && navigator.vibrate([10,20,10]); }catch(_){}
    }
  });

  // Boss attack coach cue
  window.addEventListener('hha:bossAtk', (e)=>{
    const d = e.detail || {};
    const name = String(d.name||'');
    if (name === 'ring') setCoach('🟠 RING! ช่องปลอดภัยมีช่องเดียว — แตะย้ายศูนย์กลางไป “ช่องว่าง”!', 'fever', 1700);
    else if (name === 'laser') setCoach('🔵 LASER! หลบแนวแสงให้ทัน — ถ้ายืนทับ = โดน!', 'fever', 1700);
    else if (name === 'storm') setCoach('🌪️ STORM! ระวัง “ของดีปลอม” 👀', 'fever', 1700);
  });

  // ✅ quest:update -> HUD render
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

    const minisCleared = (meta.minisCleared|0);
    const miniCount = (meta.miniCount|0);
    if (elMiniCount) elMiniCount.textContent = `mini ผ่าน ${minisCleared} • เล่นอยู่ ${Math.max(1, miniCount)}`;

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

  // End summary
  window.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};
    safeText(sumScore, String(d.score|0));
    safeText(sumGood,  String(d.goodHits|0));
    safeText(sumMiss,  String(d.misses|0));
    safeText(sumCombo, String(d.comboMax|0));
    if (sumOverlay) sumOverlay.classList.add('show');

    setCoach('จบเกมแล้ว! 🎉 ดูสรุปผลได้เลย', 'happy', 2400);
    beep(660, 120, 0.03);
  });

  btnReplay && btnReplay.addEventListener('click', ()=>{ location.reload(); });
  btnExit && btnExit.addEventListener('click', ()=>{ location.href = './hub.html'; });

  function initLogger(){
    try{
      const endpoint =
        sessionStorage.getItem('HHA_LOG_ENDPOINT') ||
        sessionStorage.getItem('HHA_LOGGER_ENDPOINT') ||
        (new URL(location.href)).searchParams.get('log') ||
        '';
      if (window.HHACloudLogger && typeof window.HHACloudLogger.init === 'function'){
        window.HHACloudLogger.init({ endpoint, debug: true });
        setLogBadge('ok', endpoint ? 'logger: ok ✓' : 'logger: no endpoint (ok)');
        return true;
      }
      setLogBadge('bad', 'logger: missing (skip)');
    }catch(_){}
    return false;
  }

  // ✅ Quest pump (force UI show even before gameplay)
  function pumpQuestUI(){
    try{
      if (!Q) return;
      if (typeof Q.getActive === 'function'){
        const a = Q.getActive();
        window.dispatchEvent(new CustomEvent('quest:update', { detail: a || {} }));
      } else {
        Q.tick(qState);
      }
    }catch(_){}
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

    if (elDiff) elDiff.textContent = diff.toUpperCase();
    if (elChal) elChal.textContent = chal.toUpperCase();
    if (elTime) elTime.textContent = durationSec + 's';

    bindAimListeners();
    initLogger();

    const cam = document.querySelector('#gj-camera');
    attachTouch(cam);
    initVRButton();

    // ✅ Create quest director using compat signature (accepts goalDefs/miniDefs)
    Q = makeQuestDirector({
      diff,
      goalDefs: GOODJUNK_GOALS,
      miniDefs: GOODJUNK_MINIS
    });

    // ✅ ensure director can read current qState (for getActive fallback)
    window.__GJ_QSTATE__ = qState;

    // ✅ fire UI immediately (before countdown)
    if (Q && typeof Q.start === 'function') Q.start(qState);
    pumpQuestUI();

    runCountdown(()=>{
      waitSceneReady(async ()=>{
        if (wantVR) await tryEnterVR();

        const safeMargins = computeSafeMargins();

        const ENGINE = goodjunkBoot({
          diff,
          run: RUN_MODE,
          challenge: chal,
          time: durationSec,
          layerEl: document.getElementById('gj-layer'),
          safeMargins
        });

        window.__GJ_ENGINE__ = ENGINE;

        // ✅ one more pump after engine starts (order-proof)
        pumpQuestUI();
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefill();

  // ✅ even before start, show placeholder quest once director exists
  // (keeps HUD not empty while on overlay)
}