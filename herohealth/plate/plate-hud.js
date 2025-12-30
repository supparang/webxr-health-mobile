// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (PRODUCTION)
// ✅ Safe binding (element missing = skip)
// ✅ Listens:
//    - hha:score     {score, combo, comboMax, miss, accPct, grade, plateHave, g1..g5, shieldN, perfect, feverPct}
//    - quest:update  {goal:{title,cur,target,done}, mini:{title,cur,target,secLeft,secTotal,done}, hint}
//    - hha:coach     {msg, mood:'neutral'|'happy'|'sad'|'fever'}
//    - hha:fever     {pct, shieldN}
//    - hha:time      {secLeft}
//    - hha:end       {summary:{...}} or detail itself as summary
// ✅ UI buttons dispatch "hha:ui" requests (pause/restart/backhub/playagain)
//    so plate.safe.js can listen without tight-coupling

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  // ---------- helpers ----------
  const $ = (id)=> DOC.getElementById(id);

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function pct01(v){ v=Number(v)||0; return clamp(v,0,100); }
  function setText(el, v){
    if(!el) return;
    el.textContent = (v===undefined || v===null) ? '' : String(v);
  }
  function setWidth(el, pct){
    if(!el) return;
    el.style.width = clamp(pct,0,100).toFixed(1) + '%';
  }
  function parseHubUrl(){
    try{
      const u = new URL(root.location.href);
      return u.searchParams.get('hub') || '../hub.html';
    }catch(e){
      return '../hub.html';
    }
  }
  function emit(name, detail){
    try{
      root.dispatchEvent(new CustomEvent(name, { detail }));
    }catch(e){}
  }

  // ---------- cache UI ----------
  const ui = {
    score: $('uiScore'),
    combo: $('uiCombo'),
    comboMax: $('uiComboMax'),
    miss: $('uiMiss'),
    time: $('uiTime'),
    grade: $('uiGrade'),
    acc: $('uiAcc'),
    plateHave: $('uiPlateHave'),

    feverFill: $('uiFeverFill'),
    shieldN: $('uiShieldN'),

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

    // overlays
    startOverlay: $('startOverlay'),
    btnStart: $('btnStart'),

    paused: $('hudPaused'),
    btnPause: $('btnPause'),
    btnRestart: $('btnRestart'),
    btnEnterVR: $('btnEnterVR'),
    btnEnterVR2: $('btnEnterVR2'),

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
    btnBackHub: $('btnBackHub'),
    btnPlayAgain: $('btnPlayAgain')
  };

  // ---------- coach mood images (from your standard) ----------
  const COACH_IMG = {
    neutral: '../img/coach-neutral.png',
    happy:   '../img/coach-happy.png',
    sad:     '../img/coach-sad.png',
    fever:   '../img/coach-fever.png'
  };

  // ---------- local state ----------
  let paused = false;
  let lastPerfect = 0;
  let lastGoals = { cur:0, target:0 };
  let lastMinis = { cur:0, target:0 };

  // ---------- overlay controls ----------
  function showPaused(show){
    paused = !!show;
    if(ui.paused){
      ui.paused.style.display = paused ? 'grid' : 'none';
    }
    DOC.body.toggleAttribute('data-paused', paused);
  }

  function showStart(show){
    if(!ui.startOverlay) return;
    ui.startOverlay.style.display = show ? 'grid' : 'none';
  }

  function showResult(show){
    if(!ui.resultBackdrop) return;
    ui.resultBackdrop.style.display = show ? 'grid' : 'none';
  }

  // Start overlay: show by default (safe)
  // plate.safe.js can hide it when game starts
  showStart(true);
  showPaused(false);
  showResult(false);

  // ---------- buttons ----------
  function enterVR(){
    try{
      const scene = DOC.querySelector('a-scene');
      if(scene && scene.enterVR) scene.enterVR();
    }catch(e){}
  }

  if(ui.btnEnterVR)  ui.btnEnterVR.addEventListener('click', enterVR, {passive:true});
  if(ui.btnEnterVR2) ui.btnEnterVR2.addEventListener('click', enterVR, {passive:true});

  if(ui.btnPause){
    ui.btnPause.addEventListener('click', function(){
      showPaused(!paused);
      emit('hha:ui', { action:'pause', paused });
      emit('hha:ui:pause', { paused });
    }, {passive:true});
  }

  if(ui.btnRestart){
    ui.btnRestart.addEventListener('click', function(){
      showPaused(false);
      showResult(false);
      showStart(true);
      emit('hha:ui', { action:'restart' });
      emit('hha:ui:restart', {});
    }, {passive:true});
  }

  if(ui.btnStart){
    ui.btnStart.addEventListener('click', function(){
      showStart(false);
      showPaused(false);
      showResult(false);
      emit('hha:ui', { action:'start' });
      emit('hha:ui:start', {});
    }, {passive:true});
  }

  if(ui.btnPlayAgain){
    ui.btnPlayAgain.addEventListener('click', function(){
      showResult(false);
      showStart(true);
      showPaused(false);
      emit('hha:ui', { action:'playagain' });
      emit('hha:ui:playagain', {});
    }, {passive:true});
  }

  if(ui.btnBackHub){
    ui.btnBackHub.addEventListener('click', function(){
      // allow game to flush/harden if it provides a hook
      try{
        if(typeof root.HHA_flushNow === 'function') root.HHA_flushNow('backhub');
      }catch(e){}
      emit('hha:ui', { action:'backhub' });
      emit('hha:ui:backhub', {});
      const hub = parseHubUrl();
      try{ root.location.href = hub; }catch(e){}
    }, {passive:true});
  }

  // ---------- listeners ----------
  root.addEventListener('hha:time', function(ev){
    const d = (ev && ev.detail) || {};
    const sec = (d.secLeft!==undefined) ? d.secLeft : d.timeLeftSec;
    if(sec!==undefined) setText(ui.time, Math.max(0, Math.round(Number(sec)||0)));
  });

  root.addEventListener('hha:fever', function(ev){
    const d = (ev && ev.detail) || {};
    const pct = pct01(d.pct ?? d.feverPct ?? 0);
    setWidth(ui.feverFill, pct);
    if(d.shieldN!==undefined) setText(ui.shieldN, Math.max(0, Number(d.shieldN)||0));
  });

  root.addEventListener('hha:coach', function(ev){
    const d = (ev && ev.detail) || {};
    if(d.msg!==undefined) setText(ui.coachMsg, d.msg);
    const mood = String(d.mood || 'neutral').toLowerCase();
    const src = COACH_IMG[mood] || COACH_IMG.neutral;
    if(ui.coachImg) ui.coachImg.src = src;
  });

  root.addEventListener('quest:update', function(ev){
    const d = (ev && ev.detail) || {};

    // goal
    if(d.goal){
      const g = d.goal;
      const cur = Number(g.cur)||0;
      const target = Math.max(1, Number(g.target)||1);
      lastGoals = { cur, target };

      if(g.title!==undefined) setText(ui.goalTitle, g.title);
      setText(ui.goalCount, `${clamp(cur,0,target)}/${target}`);
      setWidth(ui.goalFill, (clamp(cur,0,target)/target)*100);
    }

    // mini
    if(d.mini){
      const m = d.mini;
      const cur = Number(m.cur)||0;
      const target = Math.max(1, Number(m.target)||1);
      lastMinis = { cur, target };

      if(m.title!==undefined) setText(ui.miniTitle, m.title);
      setText(ui.miniCount, `${clamp(cur,0,target)}/${target}`);
      setWidth(ui.miniFill, (clamp(cur,0,target)/target)*100);

      // time left (optional)
      let secLeft = (m.secLeft!==undefined) ? m.secLeft : m.timeLeftSec;
      if(secLeft===undefined && m.secTotal!==undefined && m.elapsed!==undefined){
        secLeft = Math.max(0, Number(m.secTotal)-Number(m.elapsed));
      }
      if(secLeft!==undefined){
        const s = Math.max(0, Math.round(Number(secLeft)||0));
        setText(ui.miniTime, `${s}s`);
      }
    }

    if(d.hint!==undefined) setText(ui.hint, d.hint);
  });

  root.addEventListener('hha:score', function(ev){
    const d = (ev && ev.detail) || {};

    if(d.score!==undefined) setText(ui.score, Math.round(Number(d.score)||0));
    if(d.combo!==undefined) setText(ui.combo, Math.round(Number(d.combo)||0));
    if(d.comboMax!==undefined) setText(ui.comboMax, Math.round(Number(d.comboMax)||0));
    if(d.miss!==undefined) setText(ui.miss, Math.round(Number(d.miss)||0));

    if(d.plateHave!==undefined) setText(ui.plateHave, Math.round(Number(d.plateHave)||0));

    // groups counts
    if(d.g1!==undefined) setText(ui.g1, Math.round(Number(d.g1)||0));
    if(d.g2!==undefined) setText(ui.g2, Math.round(Number(d.g2)||0));
    if(d.g3!==undefined) setText(ui.g3, Math.round(Number(d.g3)||0));
    if(d.g4!==undefined) setText(ui.g4, Math.round(Number(d.g4)||0));
    if(d.g5!==undefined) setText(ui.g5, Math.round(Number(d.g5)||0));

    // fever + shield
    if(d.feverPct!==undefined) setWidth(ui.feverFill, pct01(d.feverPct));
    if(d.shieldN!==undefined) setText(ui.shieldN, Math.max(0, Number(d.shieldN)||0));

    // acc + grade
    if(d.accPct!==undefined){
      const a = clamp(Number(d.accPct)||0, 0, 100);
      setText(ui.acc, `${Math.round(a)}%`);
    }else if(d.accuracyPct!==undefined){
      const a = clamp(Number(d.accuracyPct)||0, 0, 100);
      setText(ui.acc, `${Math.round(a)}%`);
    }

    if(d.grade!==undefined){
      setText(ui.grade, String(d.grade));
    }

    if(d.perfect!==undefined) lastPerfect = Math.round(Number(d.perfect)||0);
  });

  root.addEventListener('hha:end', function(ev){
    const d = (ev && ev.detail) || {};
    const s = d.summary || d;

    // show result overlay
    showPaused(false);
    showStart(false);
    showResult(true);

    // fill fields safely
    const mode  = s.gameMode || s.mode || s.runMode || 'play';
    const grade = s.grade || s.uiGrade || 'C';
    const score = s.scoreFinal ?? s.score ?? 0;
    const comboMax = s.comboMax ?? s.maxCombo ?? 0;
    const miss  = s.misses ?? s.miss ?? 0;
    const perfect = s.fastHit ?? s.perfect ?? s.perfectHits ?? lastPerfect;

    // goals/minis
    const goalsCleared = s.goalsCleared ?? (s.goals && s.goals.cleared);
    const goalsTotal   = s.goalsTotal   ?? (s.goals && s.goals.total);
    const miniCleared  = s.miniCleared  ?? (s.minis && s.minis.cleared);
    const miniTotal    = s.miniTotal    ?? (s.minis && s.minis.total);

    // plate groups
    const g1 = s.g1 ?? s.plateG1 ?? 0;
    const g2 = s.g2 ?? s.plateG2 ?? 0;
    const g3 = s.g3 ?? s.plateG3 ?? 0;
    const g4 = s.g4 ?? s.plateG4 ?? 0;
    const g5 = s.g5 ?? s.plateG5 ?? 0;
    const total = (Number(g1)||0)+(Number(g2)||0)+(Number(g3)||0)+(Number(g4)||0)+(Number(g5)||0);

    setText(ui.rMode, mode);
    setText(ui.rGrade, grade);
    setText(ui.rScore, Math.round(Number(score)||0));
    setText(ui.rMaxCombo, Math.round(Number(comboMax)||0));
    setText(ui.rMiss, Math.round(Number(miss)||0));
    setText(ui.rPerfect, Math.round(Number(perfect)||0));

    // fallback to last quest counters if missing
    const gC = (goalsCleared!==undefined) ? goalsCleared : lastGoals.cur;
    const gT = (goalsTotal!==undefined)   ? goalsTotal   : lastGoals.target;
    const mC = (miniCleared!==undefined)  ? miniCleared  : lastMinis.cur;
    const mT = (miniTotal!==undefined)    ? miniTotal    : lastMinis.target;

    setText(ui.rGoals, `${Math.round(Number(gC)||0)}/${Math.round(Number(gT)||0)}`);
    setText(ui.rMinis, `${Math.round(Number(mC)||0)}/${Math.round(Number(mT)||0)}`);

    setText(ui.rG1, Math.round(Number(g1)||0));
    setText(ui.rG2, Math.round(Number(g2)||0));
    setText(ui.rG3, Math.round(Number(g3)||0));
    setText(ui.rG4, Math.round(Number(g4)||0));
    setText(ui.rG5, Math.round(Number(g5)||0));
    setText(ui.rGTotal, Math.round(Number(total)||0));
  });

  // If game emits these, reflect UI immediately
  root.addEventListener('hha:pause', function(ev){
    const d = (ev && ev.detail) || {};
    if(d.paused!==undefined) showPaused(!!d.paused);
  });
  root.addEventListener('hha:start', function(){ showStart(false); showResult(false); showPaused(false); });

})(window);