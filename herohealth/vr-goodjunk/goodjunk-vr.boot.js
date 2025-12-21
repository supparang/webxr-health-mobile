// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
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

  // Aim point
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

  window.__GJ_QUEST_META__ = { goalsCleared:0, minisCleared:0, miniCount:0, goalIndex:0 };

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
    if (typeof d.goodHits === 'number'){ qState.goodHits = d.goodHits|0; } // ✅ FIX goal g1
    if (typeof d.misses === 'number'){
      qState.miss = d.misses|0;
      safeText(elMiss, String(qState.miss));
      if (qState.miss > lastMissSeen){
        qState.streakGood = 0;
        lastMissSeen = qState.miss;
      }
    }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; safeText(elCombo, String(qState.comboMax)); }
    if (Q) Q.tick(qState);
  });

  window.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const fever = Number(d.fever||0);
    const shield = Number(d.shield||0);
    const stunActive = !!d.stunActive;

    if (elFeverFill) elFeverFill.style.width = Math.max(0, Math.min(100, fever)) + '%';
    if (elFeverPct) safeText(elFeverPct, Math.round(Math.max(0, Math.min(100, fever))) + '%');
    if (elShield) safeText(elShield, String(shield|0));
    if (elStunBadge) elStunBadge.classList.toggle('show', stunActive);
    const border = document.getElementById('stun-border');
    if (border) border.classList.toggle('show', stunActive);

    if (elVortex){
      elVortex.classList.toggle('show', stunActive);
      const ap = window.__GJ_AIM_POINT__;
      if (ap && stunActive){
        elVortex.style.left = (ap.x|0) + 'px';
        elVortex.style.top  = (ap.y|0) + 'px';
      }
    }
  });

  // ✅ Quest bars + “ขาดอีก …” hint
  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;
    const meta = d.meta || {};

    window.__GJ_QUEST_META__ = {
      goalsCleared: (meta.goalsCleared|0),
      minisCleared: (meta.minisCleared|0),
      miniCount: (meta.miniCount|0),
      goalIndex: (meta.goalIndex|0)
    };

    let hint = '';

    if (goal){
      const cur = (goal.cur|0), max = (goal.max|0);
      const pct = Math.max(0, Math.min(1, Number(goal.pct ?? (max>0?cur/max:0))));
      if (elQuestMain) elQuestMain.textContent = goal.title || 'ภารกิจหลัก';
      if (elQuestMainBar) elQuestMainBar.style.width = Math.round(pct*100) + '%';
      if (elQuestMainCap) elQuestMainCap.textContent = `${cur} / ${max}`;

      // reason text
      if (goal.id === 'g3'){ // miss <= max
        const remain = Math.max(0, max - cur);
        hint = `เหลือโควตา miss ${remain}`;
      } else {
        const need = Math.max(0, max - cur);
        hint = (need > 0) ? `ขาดอีก ${need}` : 'ใกล้แล้ว!';
      }
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

      // override hint with mini reason (ชัดกว่า)
      const need = Math.max(0, max - cur);
      hint = (need > 0) ? `Mini ขาดอีก ${need}` : 'Mini ใกล้แล้ว!';
    } else {
      if (elQuestMini) elQuestMini.textContent = 'Mini quest (ครบ) ✅';
      if (elQuestMiniBar) elQuestMiniBar.style.width = '100%';
      if (elQuestMiniCap) elQuestMiniCap.textContent = '';
    }

    const miniCount = (meta.miniCount|0);
    const minisCleared = (meta.minisCleared|0);
    if (elMiniCount) elMiniCount.textContent = `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount+1}`;

    if (elQuestHint) elQuestHint.textContent = hint || '';
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
    setLogBadge(null, 'boot: ready');
  }

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
      return false;
    }catch(err){
      setLogBadge('bad', 'logger: load failed (skip)');
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
    window.__GJ_QUEST__ = Q;
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
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefill();
}