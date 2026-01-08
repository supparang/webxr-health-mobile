/* === /herohealth/vr-groups/effects-pack.js ===
GroupsVR FX Driver — PACK 44 (ULTRA FX)
✅ Listens to: hha:judge, groups:progress, hha:end, hha:score
✅ Applies body classes: fx-hit/fx-good/fx-bad/fx-perfect/fx-combo/fx-storm/fx-boss/fx-end/fx-miss
✅ Rate-limit + auto clear timers (no flicker)
*/

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  const NS = WIN.GroupsVR = WIN.GroupsVR || {};
  if (NS.__FX_LOADED__) return;
  NS.__FX_LOADED__ = true;

  const body = DOC.body;

  // ----- helpers -----
  function on(cls){ body.classList.add(cls); }
  function off(cls){ body.classList.remove(cls); }
  function has(cls){ return body.classList.contains(cls); }

  const timers = Object.create(null);

  function pulse(cls, ms){
    ms = Math.max(60, Number(ms)||160);
    on(cls);
    clearTimeout(timers[cls]);
    timers[cls] = setTimeout(()=>off(cls), ms);
  }

  function hold(cls, onoff){
    if (onoff) on(cls);
    else off(cls);
  }

  // layered hit pulse (hit + good/bad/miss etc.)
  function hit(kind){
    pulse('fx-hit', 140);
    if (kind === 'good') pulse('fx-good', 170);
    else if (kind === 'bad') pulse('fx-bad', 190);
    else if (kind === 'miss') pulse('fx-miss', 190);
  }

  // combo driver
  let lastCombo = 0;
  function updateCombo(combo){
    combo = Number(combo)||0;
    lastCombo = combo;
    // เปิด fx-combo เมื่อ combo >= 6 (เด็กป.5 มันส์กำลังดี)
    hold('fx-combo', combo >= 6);
  }

  // storm/boss hold
  function setStorm(onoff){
    hold('fx-storm', !!onoff);
  }
  function setBoss(onoff){
    hold('fx-boss', !!onoff);
  }

  // ----- event wiring -----
  // 1) judge feedback (pop text) = best source for hit/bad/boss/perfect/miss
  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind||'').toLowerCase();

    // kinds used in groups.safe.js:
    // good, bad, boss, miss, perfect, storm (optional)
    if (k === 'good'){
      hit('good');
    } else if (k === 'bad'){
      hit('bad');
    } else if (k === 'miss'){
      hit('miss');
    } else if (k === 'boss'){
      // boss hit = strong pulse + hold boss briefly
      hit('bad'); // boss feels heavy
      pulse('fx-boss', 320);
    } else if (k === 'perfect'){
      pulse('fx-perfect', 420);
    } else if (k === 'storm'){
      pulse('fx-storm', 260);
    }
  }, { passive:true });

  // 2) progress events: storm_on/off, boss_spawn/down, perfect_switch, miss
  WIN.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail || {};
    const kind = String(d.kind||'').toLowerCase();

    if (kind === 'storm_on'){
      setStorm(true);
      pulse('fx-storm', 320);
    }
    if (kind === 'storm_off'){
      setStorm(false);
    }

    if (kind === 'boss_spawn'){
      setBoss(true);
      pulse('fx-boss', 420);
    }
    if (kind === 'boss_down'){
      // keep boss for a moment then release
      pulse('fx-boss', 380);
      clearTimeout(timers.__bossRelease);
      timers.__bossRelease = setTimeout(()=>setBoss(false), 520);
      pulse('fx-perfect', 360);
    }

    if (kind === 'perfect_switch'){
      pulse('fx-perfect', 520);
    }

    if (kind === 'miss'){
      hit('miss');
    }
  }, { passive:true });

  // 3) score updates (combo)
  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    updateCombo(d.combo);
  }, { passive:true });

  // 4) end
  WIN.addEventListener('hha:end', (ev)=>{
    // practice should NOT show big end FX overlay in A; but FX driver is safe anyway
    pulse('fx-end', 700);
    // clear holds so screen returns to normal after overlay
    clearTimeout(timers.__endClear);
    timers.__endClear = setTimeout(()=>{
      off('fx-storm'); off('fx-boss'); off('fx-combo');
    }, 900);
  }, { passive:true });

  // expose (optional)
  NS.FX = { pulse, hold, hit };

})();