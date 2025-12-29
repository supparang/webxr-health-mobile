// === /herohealth/plate/plate-hud.js ===
// Plate HUD Binder — HHA Standard (SAFE)
// Listens: hha:score, hha:time, hha:fever, quest:update, hha:coach, hha:end, hha:paused
// Updates DOM ids used by /herohealth/plate-vr.html (root)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const ASSET_BASE = './img/'; // because plate-vr.html is at /herohealth (root)

  function $(id){ return doc.getElementById(id); }
  function num(v, d=0){ v = Number(v); return Number.isFinite(v) ? v : d; }
  function clamp(v, a, b){ v = num(v); return v < a ? a : (v > b ? b : v); }
  function pct(cur, max){
    cur = num(cur); max = Math.max(1, num(max, 1));
    return clamp((cur / max) * 100, 0, 100);
  }
  function setText(el, t){
    if (!el) return;
    el.textContent = (t === null || t === undefined) ? '' : String(t);
  }
  function setW(el, p){
    if (!el) return;
    el.style.width = clamp(p, 0, 100).toFixed(2) + '%';
  }

  // ----- Elements -----
  const UI = {
    score: $('uiScore'),
    combo: $('uiCombo'),
    comboMax: $('uiComboMax'),
    miss: $('uiMiss'),
    time: $('uiTime'),
    grade: $('uiGrade'),
    acc: $('uiAcc'),

    feverFill: $('uiFeverFill'),
    shieldWrap: $('uiShield'),
    shieldN: $('uiShieldN'),

    plateHave: $('uiPlateHave'),
    g1: $('uiG1'), g2: $('uiG2'), g3: $('uiG3'), g4: $('uiG4'), g5: $('uiG5'),

    goalTitle: $('uiGoalTitle'),
    goalCount: $('uiGoalCount'),
    goalFill: $('uiGoalFill'),

    miniTitle: $('uiMiniTitle'),
    miniCount: $('uiMiniCount'),
    miniTime: $('uiMiniTime'),
    miniFill: $('uiMiniFill'),
    hint: $('uiHint'),

    coachImg: $('coachImg'),
    coachMsg: $('coachMsg'),

    paused: $('hudPaused'),

    // Result
    resultBackdrop: $('resultBackdrop'),
    rMode: $('rMode'),
    rGrade: $('rGrade'),
    rScore: $('rScore'),
    rMaxCombo: $('rMaxCombo'),
    rMiss: $('rMiss'),
    rPerfect: $('rPerfect'),
    rGoals: $('rGoals'),
    rMinis: $('rMinis'),
    rG1: $('rG1'), rG2: $('rG2'), rG3: $('rG3'), rG4: $('rG4'), rG5: $('rG5'),
    rGTotal: $('rGTotal'),

    // Buttons
    btnStart: $('btnStart'),
    btnPause: $('btnPause'),
    btnRestart: $('btnRestart'),
    btnBackHub: $('btnBackHub'),
    btnPlayAgain: $('btnPlayAgain'),
    btnEnterVR: $('btnEnterVR'),
    btnEnterVR2: $('btnEnterVR2'),
  };

  // ----- Coach mood -> asset -----
  function coachSrcFromMood(mood){
    mood = String(mood || 'neutral').toLowerCase();
    if (mood.includes('fever') || mood.includes('danger')) return ASSET_BASE + 'coach-fever.png';
    if (mood.includes('happy') || mood.includes('win') || mood.includes('good')) return ASSET_BASE + 'coach-happy.png';
    if (mood.includes('sad') || mood.includes('fail') || mood.includes('bad')) return ASSET_BASE + 'coach-sad.png';
    return ASSET_BASE + 'coach-neutral.png';
  }

  // ----- Actions (safe bridge) -----
  function dispatchUI(action){
    try{
      root.dispatchEvent(new CustomEvent('hha:ui', { detail: { action } }));
    }catch(e){}
  }
  async function flushIfAny(reason){
    try{
      // compatible with your hha-cloud-logger.js if it exposes a flush or safeFlush
      if (root.HHACloudLogger && typeof root.HHACloudLogger.flush === 'function'){
        await root.HHACloudLogger.flush(reason);
      }
      if (root.HHA && typeof root.HHA.flush === 'function'){
        await root.HHA.flush(reason);
      }
    }catch(e){}
  }

  function getHubUrl(){
    try{
      const u = new URL(location.href);
      return u.searchParams.get('hub') || './hub.html';
    }catch(e){
      return './hub.html';
    }
  }

  // ----- Update handlers -----
  function onScore(detail){
    detail = detail || {};
    setText(UI.score, num(detail.score, 0));
    setText(UI.combo, num(detail.combo, 0));
    setText(UI.comboMax, num(detail.comboMax, detail.maxCombo || 0));
    setText(UI.miss, num(detail.miss, detail.misses || 0));

    // plate counts
    setText(UI.plateHave, num(detail.plateHave, detail.plate || detail.gTotal || 0));
    setText(UI.g1, num(detail.g1, 0));
    setText(UI.g2, num(detail.g2, 0));
    setText(UI.g3, num(detail.g3, 0));
    setText(UI.g4, num(detail.g4, 0));
    setText(UI.g5, num(detail.g5, 0));

    // grade + accuracy
    if (detail.grade !== undefined) setText(UI.grade, detail.grade);
    if (detail.accuracyPct !== undefined) setText(UI.acc, Math.round(num(detail.accuracyPct, 0)) + '%');
    else if (detail.accPct !== undefined) setText(UI.acc, Math.round(num(detail.accPct, 0)) + '%');

    // fever/shield
    if (detail.feverPct !== undefined) setW(UI.feverFill, num(detail.feverPct, 0));
    if (detail.shieldN !== undefined) setText(UI.shieldN, num(detail.shieldN, 0));
  }

  function onTime(detail){
    detail = detail || {};
    if (detail.timeLeftSec !== undefined) setText(UI.time, Math.max(0, Math.ceil(num(detail.timeLeftSec, 0))));
    else if (detail.left !== undefined) setText(UI.time, Math.max(0, Math.ceil(num(detail.left, 0))));
  }

  function onFever(detail){
    detail = detail || {};
    if (detail.feverPct !== undefined) setW(UI.feverFill, num(detail.feverPct, 0));
    if (detail.shieldN !== undefined) setText(UI.shieldN, num(detail.shieldN, 0));
  }

  function onQuest(detail){
    detail = detail || {};

    // Goal
    if (detail.goalTitle !== undefined) setText(UI.goalTitle, detail.goalTitle);
    const gCur = num(detail.goalCur, detail.goalNow || 0);
    const gTar = Math.max(1, num(detail.goalTarget, detail.goalMax || 1));
    if (detail.goalCur !== undefined || detail.goalTarget !== undefined || detail.goalNow !== undefined || detail.goalMax !== undefined){
      setText(UI.goalCount, `${Math.min(gCur,gTar)}/${gTar}`);
      setW(UI.goalFill, pct(gCur, gTar));
    }

    // Mini
    if (detail.miniTitle !== undefined) setText(UI.miniTitle, detail.miniTitle);
    const mCur = num(detail.miniCur, detail.miniNow || 0);
    const mTar = Math.max(1, num(detail.miniTarget, detail.miniMax || 1));
    if (detail.miniCur !== undefined || detail.miniTarget !== undefined || detail.miniNow !== undefined || detail.miniMax !== undefined){
      setText(UI.miniCount, `${Math.min(mCur,mTar)}/${mTar}`);
      setW(UI.miniFill, pct(mCur, mTar));
    }
    if (detail.miniTimeLeftSec !== undefined) setText(UI.miniTime, Math.max(0, Math.ceil(num(detail.miniTimeLeftSec, 0))) + 's');
    if (detail.hint !== undefined) setText(UI.hint, detail.hint);
  }

  function onCoach(detail){
    detail = detail || {};
    if (UI.coachImg && detail.mood !== undefined){
      UI.coachImg.src = coachSrcFromMood(detail.mood);
    }
    if (detail.msg !== undefined) setText(UI.coachMsg, detail.msg);
  }

  function onPaused(detail){
    detail = detail || {};
    const paused = !!detail.paused;
    if (!UI.paused) return;
    UI.paused.style.display = paused ? 'grid' : 'none';
  }

  function onEnd(detail){
    detail = detail || {};
    if (UI.resultBackdrop){
      UI.resultBackdrop.style.display = 'grid';
    }

    setText(UI.rMode, detail.mode ?? detail.runMode ?? 'play');
    setText(UI.rGrade, detail.grade ?? 'C');
    setText(UI.rScore, num(detail.scoreFinal, detail.score ?? 0));
    setText(UI.rMaxCombo, num(detail.comboMax, detail.maxCombo ?? 0));
    setText(UI.rMiss, num(detail.misses, detail.miss ?? 0));
    setText(UI.rPerfect, num(detail.perfectHits, detail.fastHit ?? detail.perfect ?? 0));

    const goalsC = num(detail.goalsCleared, detail.goalsDone ?? 0);
    const goalsT = num(detail.goalsTotal, detail.goalsAll ?? 0);
    setText(UI.rGoals, `${goalsC}/${goalsT}`);

    const minisC = num(detail.miniCleared, detail.minisCleared ?? 0);
    const minisT = num(detail.miniTotal, detail.minisTotal ?? 0);
    setText(UI.rMinis, `${minisC}/${minisT}`);

    const g1 = num(detail.g1, 0), g2 = num(detail.g2, 0), g3 = num(detail.g3, 0), g4 = num(detail.g4, 0), g5 = num(detail.g5, 0);
    setText(UI.rG1, g1); setText(UI.rG2, g2); setText(UI.rG3, g3); setText(UI.rG4, g4); setText(UI.rG5, g5);
    setText(UI.rGTotal, g1+g2+g3+g4+g5);
  }

  // ----- Wire buttons (safe) -----
  function bindButtons(){
    if (UI.btnPause){
      UI.btnPause.addEventListener('click', function(){
        dispatchUI('pause-toggle');
      });
    }
    if (UI.btnRestart){
      UI.btnRestart.addEventListener('click', function(){
        dispatchUI('restart');
        // fallback
        try{ location.reload(); }catch(e){}
      });
    }
    if (UI.btnPlayAgain){
      UI.btnPlayAgain.addEventListener('click', function(){
        dispatchUI('play-again');
        try{ location.reload(); }catch(e){}
      });
    }
    if (UI.btnBackHub){
      UI.btnBackHub.addEventListener('click', async function(){
        const hub = getHubUrl();
        await flushIfAny('backhub');
        try{ location.href = hub; }catch(e){}
      });
    }
    // Start button: often bound by plate.safe.js already — but safe to emit
    if (UI.btnStart){
      UI.btnStart.addEventListener('click', function(){
        dispatchUI('start');
      });
    }

    // VR button (top) — optional safe call
    if (UI.btnEnterVR){
      UI.btnEnterVR.addEventListener('click', function(){
        try{
          const scene = doc.querySelector('a-scene');
          if (scene && scene.enterVR) scene.enterVR();
        }catch(e){}
      }, { passive:true });
    }
  }

  // ----- Listen events -----
  function bindEvents(){
    root.addEventListener('hha:score', (e)=> onScore(e.detail||{}));
    root.addEventListener('hha:time',  (e)=> onTime(e.detail||{}));
    root.addEventListener('hha:fever', (e)=> onFever(e.detail||{}));
    root.addEventListener('quest:update', (e)=> onQuest(e.detail||{}));
    root.addEventListener('hha:coach', (e)=> onCoach(e.detail||{}));
    root.addEventListener('hha:paused', (e)=> onPaused(e.detail||{}));
    root.addEventListener('hha:end', (e)=> onEnd(e.detail||{}));
  }

  // ----- Init (once) -----
  if (root.__HHA_PLATE_HUD_BOUND__) return;
  root.__HHA_PLATE_HUD_BOUND__ = true;

  if (doc.readyState === 'loading'){
    doc.addEventListener('DOMContentLoaded', function(){
      bindButtons();
      bindEvents();
    }, { once:true });
  } else {
    bindButtons();
    bindEvents();
  }

})(window);