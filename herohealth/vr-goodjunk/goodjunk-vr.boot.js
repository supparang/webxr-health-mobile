// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// ✅ FINAL PATCH (Production Start Flow)
// - export boot() ให้ loader เรียก
// - dynamic import goodjunk.safe.js AFTER Start only
// - guards: no FX/HUD before started
// - pre-start lock: disable target layer until Start
// - COACH paths fixed for document at /herohealth/ (use ./img/...)

// imports (NO goodjunk.safe.js static import!)
import { attachTouchLook } from './touch-look-goodjunk.js';
import { initCloudLogger } from '../vr/hha-cloud-logger.js';
import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

export function boot(){
  'use strict';

  // bfcache fix
  window.addEventListener('pageshow', (e)=>{
    if (e.persisted) window.location.reload();
  });

  const $ = (id)=>document.getElementById(id);
  const safeText = (el, txt)=>{ try{ if (el) el.textContent = (txt ?? ''); }catch(_){} };
  const safeStyleWidth = (el, w)=>{ try{ if (el) el.style.width = w; }catch(_){} };

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

  const layerEl = $('gj-layer');

  // URL params from hub
  const pageUrl = new window.URL(window.location.href);
  const URL_RUN = (pageUrl.searchParams.get('run') || 'play').toLowerCase();                 // play | research
  const URL_DIFF = (pageUrl.searchParams.get('diff') || 'normal').toLowerCase();            // easy | normal | hard
  const URL_CH = (pageUrl.searchParams.get('ch') || pageUrl.searchParams.get('challenge') || 'rush').toLowerCase(); // rush|boss|survival
  const URL_TIME_RAW = parseInt(pageUrl.searchParams.get('time') || '', 10);

  const DEFAULT_TIME = { easy:80, normal:60, hard:50 };
  function clamp(v,min,max){ v=Number(v)||0; if(v<min) return min; if(v>max) return max; return v; }
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

  // ✅ Coach images path for document at /herohealth/
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
    const scene = document.querySelector('a-scene');
    if (!scene) return;
    btnVR.addEventListener('click', async ()=>{
      try{ await scene.enterVR(); }
      catch(err){ console.warn('[GoodJunkVR] enterVR error:', err); }
    });
  }

  function attachTouch(cameraEl){
    if (!cameraEl) return;
    attachTouchLook(cameraEl, {
      sensitivity: 0.26,
      areaEl: document.body,
      onActiveChange(active){
        if (active){
          elTouchHint && elTouchHint.classList.add('show');
          setTimeout(()=> elTouchHint && elTouchHint.classList.remove('show'), 2400);
        }
      }
    });
  }

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

  // Quest state
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

  let started = false;
  let Q = null;

  function setPreStartLock(){
    started = false;
    try{ document.body.classList.remove('game-started'); }catch(_){}
    if (layerEl) layerEl.style.pointerEvents = 'none';
    if (elBigCelebrate) elBigCelebrate.classList.remove('show');
  }
  function setStartedUnlock(){
    try{ document.body.classList.add('game-started'); }catch(_){}
    if (layerEl) layerEl.style.pointerEvents = 'auto';
  }

  // safeNoJunkSeconds tick
  setInterval(()=>{
    if (!started) return;
    qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
  }, 1000);

  // mini reset
  window.addEventListener('quest:miniStart', ()=>{
    if (!started) return;
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
  });

  // --------- FX event guards ---------
  window.addEventListener('quest:goodHit', (e)=>{
    if (!started) return;
    const d = e.detail || {};
    const isPerfect = String(d.judgment||'').toLowerCase().includes('perfect');
    fxBurst(d, true, isPerfect ? 18 : 14);
    fxPop(d, isPerfect ? 'PERFECT!' : 'GOOD!');
    if (Q) Q.onEvent(isPerfect ? 'perfectHit' : 'goodHit', qState);
  });

  window.addEventListener('quest:badHit', (e)=>{
    if (!started) return;
    const d = e.detail || {};
    fxBurst(d, false, 14);
    fxPop(d, 'JUNK!');
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    if (Q) Q.onEvent('junkHit', qState);
  });

  window.addEventListener('quest:block', (e)=>{
    if (!started) return;
    const d = e.detail || {};
    qState.blocks = (qState.blocks|0) + 1;
    fxBurst(d, true, 10);
    fxPop(d, 'BLOCK!');
    if (Q) Q.onEvent('shieldBlock', qState);
  });

  window.addEventListener('quest:power', (e)=>{
    if (!started) return;
    const d = e.detail || {};
    const p = (d.power||'');
    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time')   qState.timePlus = (qState.timePlus|0) + 1;
    fxBurst(d, true, 12);
    fxPop(d, String(p||'POWER').toUpperCase() + '!');
    if (Q) Q.onEvent('power', qState);
  });

  window.addEventListener('quest:bossClear', ()=>{
    if (!started) return;
    qState.bossCleared = true;
    fxPop({ x: window.innerWidth*0.5, y: window.innerHeight*0.35 }, 'BOSS CLEAR!');
    fxBurst({ x: window.innerWidth*0.5, y: window.innerHeight*0.35 }, true, 22);
    if (Q) Q.onEvent('bossClear', qState);
  });

  window.addEventListener('quest:cleared', (e)=>{
    if (!started) return;
    const d = e.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    if (kind.includes('goal')) fxCelebrate('goal');
    else fxCelebrate('mini');
    setCoach('เยี่ยม! ผ่านภารกิจแล้ว ไปต่อเลย! 🌟', 'happy');
  });

  // HUD listeners (ignore before started)
  window.addEventListener('hha:judge', (e)=>{
    if (!started) return;
    const label = (e.detail||{}).label || '';
    safeText(elJudge, label || '\u00A0');
  });

  window.addEventListener('hha:time', (e)=>{
    if (!started) return;
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      safeText(elTime, sec + 's');
      qState.timeLeft = sec|0;
      if (Q) Q.tick(qState);
    }
  });

  window.addEventListener('hha:score', (e)=>{
    if (!started) return;
    const d = e.detail || {};
    if (typeof d.score === 'number'){ qState.score = d.score|0; safeText(elScore, String(qState.score)); }
    if (typeof d.goodHits === 'number'){ qState.goodHits = d.goodHits|0; }
    if (typeof d.misses === 'number'){ qState.miss = d.misses|0; safeText(elMiss, String(qState.miss)); }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; safeText(elCombo, String(qState.comboMax)); }
    if (typeof d.challenge === 'string'){ qState.challenge = normCh(d.challenge); }
    if (Q) Q.tick(qState);
  });

  window.addEventListener('quest:update', (e)=>{
    if (!started) return;
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

    // start now
    started = true;
    setStartedUnlock();

    if (startOverlay) startOverlay.style.display = 'none';
    if (elBigCelebrate) elBigCelebrate.classList.remove('show');

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

    const endpoint =
      sessionStorage.getItem('HHA_LOG_ENDPOINT') ||
      'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';

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

    // touch + VR button
    const cam = document.querySelector('#gj-camera');
    attachTouch(cam);
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
          if (wantVR) await tryEnterVR();

          // ✅ dynamic import engine AFTER Start only
          const mod = await import('./goodjunk.safe.js');
          const goodjunkBoot = mod && mod.boot;
          if (typeof goodjunkBoot !== 'function'){
            throw new Error('goodjunk.safe.js has no export boot()');
          }

          const ENGINE = goodjunkBoot({
            diff,
            run: RUN_MODE,
            challenge: chal,
            time: durationSec,
            layerEl: layerEl
          });

          if (!ENGINE) throw new Error('ENGINE is null (goodjunkBoot failed)');
          window.__GJ_ENGINE__ = ENGINE;

          try{ Q && Q.tick && Q.tick(qState); }catch(_){}
        }catch(err){
          console.error('[GoodJunkVR] start failed:', err);
          alert('กด Start แล้วเข้าเกมไม่สำเร็จ\nดู Console: error บรรทัดแรก');

          // rollback
          setPreStartLock();
          if (startOverlay) startOverlay.style.display = '';
        }
      });
    });
  }

  // ---- helpers used above ----
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
    attachTouchLook(cameraEl, {
      sensitivity: 0.26,
      areaEl: document.body,
      onActiveChange(active){
        if (active){
          elTouchHint && elTouchHint.classList.add('show');
          setTimeout(()=> elTouchHint && elTouchHint.classList.remove('show'), 2400);
        }
      }
    });
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

  // bind start buttons
  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  // init state
  setPreStartLock();
  prefillFromHub();
}