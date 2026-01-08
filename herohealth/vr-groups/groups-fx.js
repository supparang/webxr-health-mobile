/* === /herohealth/vr-groups/groups.fx.js ===
GroupsVR FX Hook — PRODUCTION (PACK 57)
✅ Adds short-lived body classes: fx-hit/fx-good/fx-bad/fx-miss/fx-storm/fx-boss/fx-end/fx-combo/fx-perfect
✅ Hooks events: hha:judge, hha:score, hha:time, groups:progress, hha:end
✅ Optional Particles.popText / celebrate if particles.js loaded (window.Particles)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;
  if(root.__HHA_GROUPS_FX__) return;
  root.__HHA_GROUPS_FX__ = true;

  const body = DOC.body;

  // ---------- helpers ----------
  const timers = new Map();
  function flash(cls, ms){
    try{
      body.classList.add(cls);
      if(timers.has(cls)) clearTimeout(timers.get(cls));
      timers.set(cls, setTimeout(()=> {
        try{ body.classList.remove(cls); }catch(_){}
        timers.delete(cls);
      }, ms || 160));
    }catch(_){}
  }

  function pop(x,y,text,kind){
    try{
      const P = root.Particles;
      if(P && typeof P.popText === 'function'){
        P.popText(x,y,text, kind || '');
      }
    }catch(_){}
  }

  function celebrate(){
    try{
      const P = root.Particles;
      if(P && typeof P.celebrate === 'function'){
        P.celebrate();
      }
    }catch(_){}
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // combo detector (soft)
  let lastCombo = 0;
  let lastScore = 0;

  // storm/boss states
  let stormOn = false;

  // ---------- event handlers ----------
  root.addEventListener('hha:judge', (ev)=>{
    const d = (ev && ev.detail) || {};
    const kind = String(d.kind||'');
    const text = String(d.text||'');
    const x = clamp(d.x, 0, root.innerWidth||0);
    const y = clamp(d.y, 0, root.innerHeight||0);

    // always a small "hit" flash
    if(kind) flash('fx-hit', 140);

    if(kind === 'good'){
      flash('fx-good', 170);
      pop(x,y, text || 'GOOD', 'good');
    } else if(kind === 'bad'){
      flash('fx-bad', 190);
      pop(x,y, text || 'BAD', 'bad');
    } else if(kind === 'miss'){
      flash('fx-miss', 210);
      flash('fx-bad', 170);
      pop(x,y, text || 'MISS', 'miss');
    } else if(kind === 'boss'){
      flash('fx-boss', 220);
      pop(x,y, text || 'BOSS', 'boss');
    } else if(kind === 'storm'){
      flash('fx-storm', 240);
      pop(x||((root.innerWidth||0)*0.5), y||((root.innerHeight||0)*0.25), text || 'STORM', 'storm');
    } else if(kind === 'perfect'){
      flash('fx-perfect', 240);
      pop(x,y, text || 'PERFECT', 'perfect');
    } else {
      // fallback
      if(text) pop(x||((root.innerWidth||0)*0.5), y||((root.innerHeight||0)*0.3), text, 'info');
    }
  }, { passive:true });

  root.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) || {};
    const score = Number(d.score)||0;
    const combo = Number(d.combo)||0;

    // combo pulse when rising
    if(combo >= 6 && combo > lastCombo){
      flash('fx-combo', 220);
      // show small hint sometimes
      if(combo === 6 || combo === 10 || combo === 15){
        pop((root.innerWidth||0)*0.5, (root.innerHeight||0)*0.18, `COMBO ${combo}!`, 'combo');
      }
    }

    // score jump (tiny good glow)
    if(score > lastScore && (score - lastScore) >= 40){
      flash('fx-good', 140);
    }

    lastCombo = combo;
    lastScore = score;
  }, { passive:true });

  root.addEventListener('groups:progress', (ev)=>{
    const d = (ev && ev.detail) || {};
    const k = String(d.kind||'');

    if(k === 'storm_on'){
      stormOn = true;
      flash('fx-storm', 520);
      try{ body.classList.add('fx-storm'); }catch(_){}
    }
    if(k === 'storm_off'){
      stormOn = false;
      try{ body.classList.remove('fx-storm'); }catch(_){}
      flash('fx-good', 180);
    }
    if(k === 'boss_spawn'){
      flash('fx-boss', 520);
      try{ body.classList.add('fx-boss'); }catch(_){}
    }
    if(k === 'boss_down'){
      flash('fx-good', 260);
      flash('fx-perfect', 260);
      try{ body.classList.remove('fx-boss'); }catch(_){}
      pop((root.innerWidth||0)*0.5, (root.innerHeight||0)*0.22, 'BOSS DOWN!', 'good');
    }
    if(k === 'perfect_switch'){
      flash('fx-perfect', 260);
    }
    if(k === 'miss'){
      flash('fx-miss', 240);
      flash('fx-bad', 180);
    }
  }, { passive:true });

  root.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) || {};
    const left = Number(d.left)||0;

    // clutch vibe
    if(left <= 10 && left > 0){
      flash('fx-end', 160);
    }
    // ensure storm class doesn’t get stuck if any edge case
    if(left === 0){
      try{ body.classList.remove('fx-storm'); }catch(_){}
      try{ body.classList.remove('fx-boss'); }catch(_){}
    }
  }, { passive:true });

  root.addEventListener('hha:end', (ev)=>{
    const s = (ev && ev.detail) || {};
    flash('fx-end', 650);
    try{ body.classList.remove('fx-storm'); }catch(_){}
    try{ body.classList.remove('fx-boss'); }catch(_){}

    const grade = String(s.grade||'');
    const score = Number(s.scoreFinal||0);
    const acc   = Number(s.accuracyGoodPct||0);

    // big pop
    pop((root.innerWidth||0)*0.5, (root.innerHeight||0)*0.22, `GRADE ${grade}`, 'end');
    pop((root.innerWidth||0)*0.5, (root.innerHeight||0)*0.30, `SCORE ${score} • ACC ${acc}%`, 'end');

    // fireworks
    celebrate();
  }, { passive:true });

})(typeof window !== 'undefined' ? window : globalThis);