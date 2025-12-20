// === /herohealth/vr/goodjunk-vr.boot.js ===
import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { initCloudLogger } from './hha-cloud-logger.js';

import { attachTouchLook } from '../vr-goodjunk/touch-look-goodjunk.js';
import { makeQuestDirector } from '../vr-goodjunk/quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from '../vr-goodjunk/quest-defs-goodjunk.js';

(function () {
  'use strict';

  window.addEventListener('pageshow', (e)=>{
    if (e.persisted) window.location.reload();
  });

  const $ = (id)=>document.getElementById(id);
  const safeText = (el, txt)=>{ try{ if (el) el.textContent = (txt ?? ''); }catch(_){} };
  const safeStyleWidth = (el, w)=>{ try{ if (el) el.style.width = w; }catch(_){} };

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

  // URL params
  const pageUrl = new window.URL(window.location.href);
  const URL_RUN = (pageUrl.searchParams.get('run') || 'play').toLowerCase();
  const URL_DIFF = (pageUrl.searchParams.get('diff') || 'normal').toLowerCase();
  const URL_CH = (pageUrl.searchParams.get('ch') || pageUrl.searchParams.get('challenge') || 'rush').toLowerCase();
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

  // Coach images (อยู่ใน /herohealth/img ตามที่คุณตั้งชื่อไว้)
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

  // ---------- FX (Particles from /vr/particles.js IIFE) ----------
  function getParticles(){
    return (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
  }
  function fxAt(detail, fallbackY=0.55){
    const x = (detail && typeof detail.x === 'number') ? detail.x : (window.innerWidth * 0.5);
    const y = (detail && typeof detail.y === 'number') ? detail.y : (window.innerHeight * fallbackY);
    return { x, y };
  }
  function fxGood(detail, label='GOOD!'){
    const P = getParticles(); if (!P) return;
    const { x, y } = fxAt(detail, 0.55);
    try{ P.burstAt && P.burstAt(x, y, { count: 14, good: true }); }catch(_){}
    try{ P.scorePop && P.scorePop(x, y, '', label, { plain:true }); }catch(_){}
  }
  function fxBad(detail, label='MISS!'){
    const P = getParticles(); if (!P) return;
    const { x, y } = fxAt(detail, 0.55);
    try{ P.burstAt && P.burstAt(x, y, { count: 12, good: false }); }catch(_){}
    try{ P.scorePop && P.scorePop(x, y, '', label, { plain:true }); }catch(_){}
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
      } else {
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

  // Logger badge
  const loggerState = { pending:true, ok:false, message:'' };
  function setLogBadge(state, text){
    if (!logDot || !logText) return;
    logDot.classList.remove('ok','bad');
    if (state === 'ok') logDot.classList.add('ok');
    else if (state === 'bad') logDot.classList.add('bad');
    safeText(logText, text || (state==='ok' ? 'logger: ok' : state==='bad' ? 'logger: error' : 'logger: pending…'));
  }
  window.addEventListener('hha:logger', (e)=>{
    const d = e.detail || {};
    loggerState.pending = false;
    loggerState.ok = !!d.ok;
    loggerState.message = d.msg || '';
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

  // Quest state
  const qState = {
    score:0, goodHits:0, miss:0, comboMax:0, timeLeft:0,
    streakGood:0, blocks:0, usedMagnet:false, timePlus:0,
    safeNoJunkSeconds:0, bossCleared:false,
    challenge: CH_INIT, runMode: RUN_MODE
  };

  let started = false;
  let Q = null;

  // HUD listeners
  window.addEventListener('hha:judge', (e)=>{
    const label = (e.detail||{}).label || '';
    safeText(elJudge, label || '\u00A0');
    if (String(label).toLowerCase().includes('perfect')) fxGood(e.detail, 'PERFECT!');
  });

  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      safeText(elTime, sec + 's');
      qState.timeLeft = sec|0;
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

  // ✅ FX from quest events
  window.addEventListener('quest:goodHit', (e)=>{
    const d = e.detail || {};
    const isPerfect = String(d.judgment||'').toLowerCase().includes('perfect');
    fxGood(d, isPerfect ? 'PERFECT!' : 'GOOD!');
    if (Q) Q.onEvent(isPerfect ? 'perfectHit' : 'goodHit', qState);
  });

  window.addEventListener('quest:badHit', (e)=>{
    const d = e.detail || {};
    fxBad(d, 'JUNK!');
    if (Q) Q.onEvent('junkHit', qState);
  });

  window.addEventListener('quest:block', (e)=>{
    const d = e.detail || {};
    qState.blocks = (qState.blocks|0) + 1;
    fxGood(d, 'BLOCK!');
    if (Q) Q.onEvent('shieldBlock', qState);
  });

  window.addEventListener('quest:power', (e)=>{
    const d = e.detail || {};
    const p = d.power;
    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time')   qState.timePlus = (qState.timePlus|0) + 1;
    fxGood(d, (p||'POWER').toUpperCase() + '!');
    if (Q) Q.onEvent('power', qState);
  });

  // quest:update (ของคุณเดิม)
  window.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;
    const meta = d.meta || {};

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

    const endpoint = sessionStorage.getItem('HHA_LOG_ENDPOINT');
    if (endpoint) setLogBadge(null, 'logger: endpoint set ✓');
    else setLogBadge(null, 'logger: endpoint missing (hub?)');
  }

  async function bootOnce({ wantVR }){
    if (started) return;

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

    safeText(elDiff, diff.toUpperCase());
    safeText(elChal, chal.toUpperCase());
    safeText(elTime, durationSec + 's');

    safeText(elScore, '0');
    safeText(elCombo, '0');
    safeText(elMiss,  '0');
    safeText(elJudge, '\u00A0');

    setCoach('แตะของดี! หลบ junk! ไปเลย! ⚡', 'neutral');

    const { studentProfile, studentKey } = getProfile();

    const endpoint =
      sessionStorage.getItem('HHA_LOG_ENDPOINT') ||
      'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';

    loggerState.pending = true;
    loggerState.ok = false;
    loggerState.message = '';
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

          const ENGINE = await goodjunkBoot({
            diff,
            run: RUN_MODE,
            challenge: chal,
            time: durationSec,
            layerEl: document.getElementById('gj-layer')
          });

          if (!ENGINE) throw new Error('ENGINE is null (goodjunkBoot failed)');
          window.__GJ_ENGINE__ = ENGINE;

          // kick quest UI
          try{ Q && Q.tick && Q.tick(qState); }catch(_){}
        }catch(err){
          console.error('[GoodJunkVR] boot failed:', err);
          alert('เข้าเกมไม่สำเร็จ: engine โหลดไม่ผ่าน\nดู Console เพื่อหา error บรรทัดแรก');
        }
      });
    });
  }

  btnStart2D && btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR && btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefillFromHub();
})();