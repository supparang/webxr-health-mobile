// === /herohealth/plate/plate-hud.js ===
// Plate HUD Binder — PRODUCTION
// ✅ Listens: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:celebrate, hha:end
// ✅ Safe: if element missing -> ignore
// ✅ Adds judge toast UI (non-blocking)

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc) return;

  const $ = (id)=>doc.getElementById(id);

  // UI refs (optional)
  const ui = {
    score: $('uiScore'),
    combo: $('uiCombo'),
    comboMax: $('uiComboMax'),
    miss: $('uiMiss'),
    plateHave: $('uiPlateHave'),
    g1: $('uiG1'), g2: $('uiG2'), g3: $('uiG3'), g4: $('uiG4'), g5: $('uiG5'),
    acc: $('uiAcc'),
    grade: $('uiGrade'),
    time: $('uiTime'),
    feverFill: $('uiFeverFill'),
    shieldN: $('uiShieldN'),

    goalTitle: $('uiGoalTitle'),
    goalCount: $('uiGoalCount'),
    goalFill: $('uiGoalFill'),

    miniTitle: $('uiMiniTitle'),
    miniCount: $('uiMiniCount'),
    miniTime: $('uiMiniTime'),
    miniFill: $('uiMiniFill'),
    hint: $('uiHint'),

    coachMsg: $('coachMsg'),
    coachImg: $('coachImg'),

    resultBackdrop: $('resultBackdrop'),
    rMode: $('rMode'),
    rGrade: $('rGrade'),
    rScore: $('rScore'),
    rMaxCombo: $('rMaxCombo'),
    rMiss: $('rMiss'),
    rPerfect: $('rPerfect'),
    rGoals: $('rGoals'),
    rMinis: $('rMinis'),
    rG1: $('rG1'), rG2: $('rG2'), rG3: $('rG3'), rG4: $('rG4'), rG5: $('rG5'), rGTotal: $('rGTotal'),
  };

  function setText(el, v){
    if(!el) return;
    el.textContent = String(v);
  }
  function setWidth(el, pct){
    if(!el) return;
    el.style.width = String(pct) + '%';
  }

  // ---------- Judge toast ----------
  let toastT = null;
  function toast(msg, kind){
    try{
      const el = doc.createElement('div');
      el.className = 'hha-judge-toast ' + (kind || 'good');
      el.textContent = msg || '';
      doc.body.appendChild(el);
      clearTimeout(toastT);
      toastT = setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 1400);
    }catch(e){}
  }

  // ---------- Particles hook ----------
  function celebrate(kind){
    try{
      // if particles.js exists
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles) || null;
      if(P && typeof P.celebrate === 'function'){
        P.celebrate({ kind: kind || 'end' });
      } else {
        // fallback: quick toast
        toast(kind === 'mini' ? '✨ MINI COMPLETE!' : kind === 'goal' ? '🎯 GOAL COMPLETE!' : '🏁 FINISH!', 'good');
      }
    }catch(e){}
  }

  // ---------- Event handlers ----------
  root.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) || {};
    if(d.game && d.game !== 'plate') return;

    setText(ui.score, d.score ?? 0);
    setText(ui.combo, d.combo ?? 0);
    setText(ui.comboMax, d.comboMax ?? 0);
    setText(ui.miss, d.miss ?? 0);

    if(ui.plateHave) setText(ui.plateHave, d.plateHave ?? 0);

    const g = Array.isArray(d.gCount) ? d.gCount : null;
    if(g){
      setText(ui.g1, g[0] ?? 0); setText(ui.g2, g[1] ?? 0); setText(ui.g3, g[2] ?? 0);
      setText(ui.g4, g[3] ?? 0); setText(ui.g5, g[4] ?? 0);
    }

    if(ui.acc) setText(ui.acc, Math.round(Number(d.accuracyGoodPct)||0) + '%');
    if(ui.grade) setText(ui.grade, d.grade || 'C');

    if(ui.time && d.timeLeftSec != null) setText(ui.time, Math.ceil(Number(d.timeLeftSec)||0));

    if(ui.feverFill){
      const f = Math.max(0, Math.min(100, Number(d.fever)||0));
      ui.feverFill.style.width = f + '%';
    }
    if(ui.shieldN) setText(ui.shieldN, d.shield ?? 0);
  });

  root.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) || {};
    if(d.game && d.game !== 'plate') return;
    if(ui.time && d.timeLeftSec != null) setText(ui.time, Math.ceil(Number(d.timeLeftSec)||0));
  });

  root.addEventListener('quest:update', (ev)=>{
    const d = (ev && ev.detail) || {};
    if(d.game && d.game !== 'plate') return;

    // Goal
    if(d.goal){
      setText(ui.goalTitle, d.goal.title || '—');
      setText(ui.goalCount, `${d.goal.cur ?? 0}/${d.goal.target ?? 0}`);
      const pct = (d.goal.target && d.goal.target > 0) ? ((Number(d.goal.cur)||0) / Number(d.goal.target) * 100) : 0;
      setWidth(ui.goalFill, Math.max(0, Math.min(100, pct)));
    }else{
      setText(ui.goalTitle, '—');
      setText(ui.goalCount, '0/0');
      setWidth(ui.goalFill, 0);
    }

    // Mini
    if(d.mini){
      setText(ui.miniTitle, d.mini.title || '—');
      // miniCount is managed in plate.safe.js; keep safe fallback
      if(d.mini.timeLeft != null) setText(ui.miniTime, Math.ceil(Number(d.mini.timeLeft)||0) + 's');
      const tgt = Number(d.mini.target)||0;
      const tl = (d.mini.timeLeft != null) ? Number(d.mini.timeLeft) : null;
      const pct = (tgt > 0 && tl != null) ? ((tgt - tl) / tgt * 100) : 0;
      setWidth(ui.miniFill, Math.max(0, Math.min(100, pct)));
    }else{
      setText(ui.miniTitle, '—');
      setText(ui.miniTime, '--');
      setWidth(ui.miniFill, 0);
    }
  });

  root.addEventListener('hha:coach', (ev)=>{
    const d = (ev && ev.detail) || {};
    if(d.game && d.game !== 'plate') return;
    if(ui.coachMsg && d.msg) ui.coachMsg.textContent = String(d.msg);

    // image is primarily controlled in plate.safe.js (unique fallback)
    // but keep safe if other module emits only mood
    if(ui.coachImg && d.mood && !ui.coachImg.__hhaTouched){
      ui.coachImg.__hhaTouched = true;
      // prefer plate-* then fallback coach-*
      const m = String(d.mood || 'neutral');
      const primary = `./img/plate-${m}.png`;
      const fallback = `./img/coach-${m}.png`;
      ui.coachImg.onerror = function(){
        if(ui.coachImg.__hhaFellBack) return;
        ui.coachImg.__hhaFellBack = true;
        ui.coachImg.src = fallback;
      };
      ui.coachImg.__hhaFellBack = false;
      ui.coachImg.src = primary;
    }
  });

  root.addEventListener('hha:judge', (ev)=>{
    const d = (ev && ev.detail) || {};
    if(d.game && d.game !== 'plate') return;
    const text = d.text || '';
    const kind = d.kind || 'good';
    if(text) toast(text, kind);
  });

  root.addEventListener('hha:celebrate', (ev)=>{
    const d = (ev && ev.detail) || {};
    if(d.game && d.game !== 'plate') return;
    celebrate(d.kind || 'end');
  });

  root.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) || {};
    if(d.game && d.game !== 'plate') return;
    // plate.safe.js is responsible for showing result overlay.
    // Here we just ensure any fields are in sync if present.
    const s = d.summary || null;
    if(!s) return;

    setText(ui.rMode, s.runMode || 'play');
    setText(ui.rGrade, s.grade || 'C');
    setText(ui.rScore, s.scoreFinal ?? 0);
    setText(ui.rMaxCombo, s.comboMax ?? 0);
    setText(ui.rMiss, s.misses ?? 0);
    setText(ui.rPerfect, Math.round(Number(s.fastHitRatePct)||0) + '%');
    setText(ui.rGoals, `${s.goalsCleared ?? 0}/${s.goalsTotal ?? 0}`);
    setText(ui.rMinis, `${s.miniCleared ?? 0}/${s.miniTotal ?? 0}`);

    if(s.plate && Array.isArray(s.plate.counts)){
      const c = s.plate.counts;
      setText(ui.rG1, c[0] ?? 0); setText(ui.rG2, c[1] ?? 0); setText(ui.rG3, c[2] ?? 0);
      setText(ui.rG4, c[3] ?? 0); setText(ui.rG5, c[4] ?? 0);
      setText(ui.rGTotal, s.plate.total ?? 0);
    }
  });

})(window);