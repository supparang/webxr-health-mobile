import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';
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

  // Coach images (ตาม memory ของคุณ)
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
    if (elCoachText) elCoachText.textContent = text || '';
    setCoachFace(mood);
    if (lastCoachTimeout) clearTimeout(lastCoachTimeout);
    lastCoachTimeout = setTimeout(()=> elCoachBubble && elCoachBubble.classList.remove('show'), 4200);
  }

  function runCountdown(onDone){
    if (!elCountdown){ onDone && onDone(); return; }
    const steps = ['3','2','1','Go!'];
    let idx = 0;
    elCountdown.classList.remove('countdown-hidden');
    elCountdown.textContent = steps[0];
    const t = setInterval(()=>{
      idx++;
      if (idx >= steps.length){
        clearInterval(t);
        elCountdown.classList.add('countdown-hidden');
        onDone && onDone();
      }else{
        elCountdown.textContent = steps[idx];
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
    logText.textContent = text || (state==='ok' ? 'logger: ok' : state==='bad' ? 'logger: error' : 'logger: pending…');
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

  // Quest state shared with QuestDirector
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
    runMode: RUN_MODE
  };

  // mini reset
  window.addEventListener('quest:miniStart', ()=>{
    qState.goldHitsThisMini = false;
    qState.usedMagnet = false;
    qState.timePlus = 0;
    qState.blocks = 0;
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
  });

  // safeNoJunkSeconds tick
  let started = false;
  setInterval(()=>{
    if (!started) return;
    qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
  }, 1000);

  let Q = null;

  function celebrateQuest(kind='mini'){
    const P = (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
    const cx = window.innerWidth/2;
    const y  = window.innerHeight*0.22;
    if (P && P.burstAt) P.burstAt(cx, y, { count: 18, good: true });
    if (P && P.scorePop) P.scorePop(cx, y, (kind==='goal'?'GOAL CLEAR!':'MINI CLEAR!'), { judgment:'GREAT!', good:true });
    setCoach('เยี่ยม! ผ่านภารกิจแล้ว ไปต่อเลย! 🌟', 'happy');
  }

  function bigCelebrateAll(callback){
    if (!elBigCelebrate){ callback && callback(); return; }
    const P = (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
    const cx = window.innerWidth/2;
    const cy = window.innerHeight*0.35;
    if (P && P.burstAt){
      for (let i=0;i<3;i++) setTimeout(()=>P.burstAt(cx,cy,{ count:26, good:true }), i*240);
    }
    if (P && P.scorePop) P.scorePop(cx,cy,'ALL QUESTS CLEAR!',{ judgment:'AMAZING', good:true });
    elBigCelebrate.classList.add('show');
    setTimeout(()=>{ elBigCelebrate.classList.remove('show'); callback && callback(); }, 1200);
  }

  // HUD listeners
  window.addEventListener('hha:judge', (e)=>{
    const label = (e.detail||{}).label || '';
    if (elJudge) elJudge.textContent = label || '\u00A0';
  });

  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail||{}).sec;
    if (typeof sec === 'number' && sec >= 0){
      elTime.textContent = sec + 's';
      qState.timeLeft = sec|0;
      if (Q) Q.tick(qState);
    }
  });

  window.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if (typeof d.score === 'number'){ qState.score = d.score|0; elScore.textContent = String(qState.score); }
    if (typeof d.goodHits === 'number'){ qState.goodHits = d.goodHits|0; }
    if (typeof d.misses === 'number'){ qState.miss = d.misses|0; elMiss.textContent = String(qState.miss); }
    if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; elCombo.textContent = String(qState.comboMax); }
    if (typeof d.challenge === 'string'){ qState.challenge = normCh(d.challenge); }
    if (Q) Q.tick(qState);
  });

  // QuestDirector event wiring
  window.addEventListener('quest:goodHit', (e)=>{
    const d = e.detail || {};
    if (d.type === 'gold'){
      qState.goldHits++;
      qState.goldHitsThisMini = true;
    }
    qState.streakGood = (qState.streakGood|0) + 1;

    if (Q){
      const isPerfect = String(d.judgment||'').toLowerCase().includes('perfect');
      Q.onEvent(isPerfect ? 'perfectHit' : 'goodHit', qState);
    }
  });

  window.addEventListener('quest:badHit', ()=>{
    qState.safeNoJunkSeconds = 0;
    qState.streakGood = 0;
    if (Q) Q.onEvent('junkHit', qState);
  });

  window.addEventListener('quest:block', ()=>{
    qState.blocks = (qState.blocks|0) + 1;
    if (Q) Q.onEvent('shieldBlock', qState);
  });

  window.addEventListener('quest:power', (e)=>{
    const p = (e.detail||{}).power;
    if (p === 'magnet') qState.usedMagnet = true;
    if (p === 'time')   qState.timePlus = (qState.timePlus|0) + 1;
    if (Q) Q.onEvent('power', qState);
  });

  window.addEventListener('quest:bossClear', ()=>{
    qState.bossCleared = true;
    if (Q) Q.onEvent('bossClear', qState);
  });

  // quest:update (Patch A schema)
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
      elQuestMain.textContent = goal.title || 'ภารกิจหลัก';
      elQuestMainBar.style.width = Math.round(pct*100) + '%';
      elQuestMainCap.textContent = `${cur} / ${max}`;
    } else {
      elQuestMain.textContent = 'ภารกิจหลัก (ครบ) ✅';
      elQuestMainBar.style.width = '100%';
      elQuestMainCap.textContent = '';
    }

    // mini
    if (mini){
      const cur = (mini.cur|0);
      const max = (mini.max|0);
      const pct = Math.max(0, Math.min(1, Number(mini.pct ?? (max>0?cur/max:0))));
      elQuestMini.textContent = 'Mini: ' + (mini.title || '');
      elQuestMiniBar.style.width = Math.round(pct*100) + '%';

      if (typeof mini.timeLeft === 'number' && typeof mini.timeTotal === 'number' && mini.timeTotal > 0){
        const secLeft = Math.max(0, mini.timeLeft/1000);
        elQuestMiniCap.textContent = `เหลือ ${secLeft >= 10 ? Math.round(secLeft) : (Math.round(secLeft*10)/10)}s`;
      } else {
        elQuestMiniCap.textContent = `${cur} / ${max}`;
      }
    } else {
      elQuestMini.textContent = 'Mini quest (ครบ) ✅';
      elQuestMiniBar.style.width = '100%';
      elQuestMiniCap.textContent = '';
    }

    // hint
    let hint = '';
    if (goal && String(goal.state||'').toLowerCase().includes('clear')) hint = 'GOAL CLEAR!';
    else if (mini && String(mini.state||'').toLowerCase().includes('clear')) hint = 'MINI CLEAR!';
    else if (goal && Number(goal.pct||0) >= 0.8) hint = 'ใกล้แล้ว! 🔥';
    else if (mini && Number(mini.pct||0) >= 0.8) hint = 'อีกนิดเดียว! ⚡';
    elQuestHint.textContent = hint;

    const miniCount = (meta.miniCount|0);
    const minisCleared = (Q && Q.getState) ? (Q.getState().minisCleared|0) : 0;
    elMiniCount.textContent = `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount+1}`;
  });

  window.addEventListener('quest:cleared', (e)=>{
    const d = e.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    if (kind.includes('goal')) celebrateQuest('goal');
    else celebrateQuest('mini');
  });

  function applyRunPill(){
    const runTxt = RUN_MODE.toUpperCase();
    if (elRunLabel) elRunLabel.textContent = runTxt;
    if (elPill) elPill.classList.toggle('research', RUN_MODE === 'research');

    if (startSub){
      startSub.textContent = (RUN_MODE === 'research')
        ? 'โหมดวิจัย: ต้องมี Student ID หรือชื่อเล่นจาก Hub แล้วค่อยกดเริ่ม ✅'
        : 'เลือกความยาก + โหมดความมันส์ แล้วกดเริ่ม 1 ครั้ง (เพื่อเปิดสิทธิ์เสียง/VR) ✅';
    }
  }

  function prefillFromHub(){
    try{ selDiff.value = DIFF_INIT; }catch(_){}
    try{ selChallenge.value = CH_INIT; }catch(_){}

    applyRunPill();

    elDiff.textContent = DIFF_INIT.toUpperCase();
    elChal.textContent = CH_INIT.toUpperCase();
    elTime.textContent = DUR_INIT + 's';

    setCoachFace('neutral');

    const endpoint = sessionStorage.getItem('HHA_LOG_ENDPOINT');
    if (endpoint) setLogBadge(null, 'logger: endpoint set ✓');
    else setLogBadge(null, 'logger: endpoint missing (hub?)');
  }

  function bootOnce({ wantVR }){
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
    startOverlay.style.display = 'none';

    const diff = normDiff(selDiff.value || DIFF_INIT);
    const chal = normCh(selChallenge.value || CH_INIT);
    const durationSec = clamp(DUR_INIT, 20, 180);

    qState.challenge = chal;
    qState.runMode = RUN_MODE;

    elDiff.textContent = diff.toUpperCase();
    elChal.textContent = chal.toUpperCase();
    elTime.textContent = durationSec + 's';

    elScore.textContent = '0';
    elCombo.textContent = '0';
    elMiss.textContent  = '0';
    elJudge.textContent = '\u00A0';

    setCoach('แตะของดี! หลบ junk! ไปเลย! ⚡', 'neutral');

    // profile from hub
    const { studentProfile, studentKey } = getProfile();

    // logger endpoint + fallback
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
        if (wantVR) await tryEnterVR();

        // ✅ สำคัญ: เรียก boot ด้วย object เดียวเท่านั้น
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

  // PATCH: รับ hha:end แล้ว show summary แบบ merge stats
  document.addEventListener('hha:end', (e)=>{
    // กัน listener อื่นรันซ้ำ
    try{
      e.stopImmediatePropagation();
      e.stopPropagation();
    }catch(_){}

    const final = (e && e.detail) ? e.detail : {};
    const qs = (Q && Q.getState) ? Q.getState() : {};

    const goalsCleared = qs.goalsCleared|0;
    const minisCleared = qs.minisCleared|0;
    const goalsTotal = 2;
    const allQuest = (goalsCleared >= goalsTotal);

    const merged = {
      projectTag: 'HeroHealth-GoodJunkVR',
      mode: 'GoodJunkVR',
      diff: final.diff || DIFF_INIT,
      durationSec: final.durationSec || DUR_INIT,

      score: final.scoreFinal ?? final.score ?? qState.score ?? 0,
      grade: final.grade || 'A',

      goalsCleared,
      goalsTotal,
      minisCleared,

      perfect: final.perfect ?? 0,
      good: final.good ?? qState.goodHits ?? 0,
      miss: final.misses ?? final.miss ?? qState.miss ?? 0,

      challenge: final.challenge || qState.challenge || CH_INIT,
      runMode: final.runMode || RUN_MODE,

      hubUrl: './hub.html',
      restartUrl: window.location.href.split('#')[0],

      logger: {
        pending: !!loggerState.pending,
        ok: !!loggerState.ok,
        message: loggerState.message || ''
      }
    };

    const show = ()=>{
      if (window.HHA_Summary && typeof window.HHA_Summary.show === 'function') {
        window.HHA_Summary.show(merged);
      } else {
        console.warn('[GoodJunkVR] HHA_Summary missing');
      }
      setCoach('จบเกมแล้ว! ดูสรุปคะแนนได้เลย 🎉', (merged.miss|0)<=3 ? 'happy' : 'neutral');
    };

    if (allQuest) bigCelebrateAll(show);
    else show();

  }, true);

  btnStart2D.addEventListener('click', ()=> bootOnce({ wantVR:false }));
  btnStartVR.addEventListener('click', ()=> bootOnce({ wantVR:true }));

  prefillFromHub();
})();
