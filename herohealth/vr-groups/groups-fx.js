/* === /herohealth/vr-groups/groups.fx.js ===
Food Groups VR — FX Controller (ULTRA FX glue)
✅ Adds/removes body classes: fx-hit fx-good fx-bad fx-perfect fx-combo fx-storm fx-boss fx-end fx-miss
✅ Listens: hha:judge, groups:progress, hha:score, hha:end
✅ Rate-limited + safe in research/practice (softer)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC || !DOC.body) return;

  const BODY = DOC.body;

  // -------- helpers --------
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function runMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    // A ส่ง runMode เข้า engine แต่ฝั่ง FX ดู param ก็พอ
    return (r === 'research') ? 'research' : 'play';
  }
  function view(){
    return String(qs('view','mobile')||'mobile').toLowerCase();
  }

  function addCls(c){ try{ BODY.classList.add(c); }catch(_){} }
  function rmCls(c){ try{ BODY.classList.remove(c); }catch(_){} }
  function pulse(c, ms){
    addCls(c);
    clearTimeout(T[c]);
    T[c] = setTimeout(()=> rmCls(c), ms);
  }

  const T = Object.create(null);
  const RM = runMode();
  const VW = view();

  // research/practice: softer & shorter
  const SOFT = (RM === 'research');

  // tune durations
  const DUR = {
    hit:   SOFT ? 90  : 140,
    good:  SOFT ? 110 : 180,
    bad:   SOFT ? 130 : 220,
    miss:  SOFT ? 140 : 260,
    perfect: SOFT ? 120 : 220,
    combo: SOFT ? 300 : 600,
    storm: SOFT ? 520 : 900,
    boss:  SOFT ? 520 : 900,
    end:   SOFT ? 420 : 800
  };

  // global cooldown to avoid flicker spam
  let lastPulseAt = 0;
  function okPulse(minGapMs){
    const now = Date.now();
    if (now - lastPulseAt < minGapMs) return false;
    lastPulseAt = now;
    return true;
  }

  // -------- core reactions --------
  function onJudge(detail){
    detail = detail || {};
    const kind = String(detail.kind||'').toLowerCase();

    // allow more frequent hit pulses in cVR (because shooting is tap)
    const gap = (VW === 'cvr') ? 40 : 65;
    if (!okPulse(gap)) return;

    // Always: micro "hit"
    pulse('fx-hit', DUR.hit);

    if (kind === 'good'){
      pulse('fx-good', DUR.good);
      return;
    }
    if (kind === 'perfect'){
      pulse('fx-perfect', DUR.perfect);
      return;
    }
    if (kind === 'boss'){
      pulse('fx-boss', DUR.boss);
      return;
    }
    if (kind === 'bad'){
      pulse('fx-bad', DUR.bad);
      return;
    }
    if (kind === 'miss'){
      pulse('fx-miss', DUR.miss);
      pulse('fx-bad',  DUR.bad);
      return;
    }
    if (kind === 'storm'){
      pulse('fx-storm', DUR.storm);
      return;
    }
  }

  function onProgress(detail){
    detail = detail || {};
    const k = String(detail.kind||'').toLowerCase();

    if (k === 'storm_on'){
      addCls('fx-storm');
      clearTimeout(T.__stormOff);
      // keep storm glow for duration-ish; engine will send storm_off later but we also safety-timeout
      T.__stormOff = setTimeout(()=> rmCls('fx-storm'), SOFT ? 1800 : 2600);
      return;
    }
    if (k === 'storm_off'){
      rmCls('fx-storm');
      return;
    }

    if (k === 'boss_spawn'){
      addCls('fx-boss');
      clearTimeout(T.__bossOff);
      T.__bossOff = setTimeout(()=> rmCls('fx-boss'), SOFT ? 1600 : 2400);
      return;
    }
    if (k === 'boss_down'){
      pulse('fx-good', DUR.good);
      pulse('fx-hit',  DUR.hit);
      rmCls('fx-boss');
      return;
    }

    if (k === 'perfect_switch'){
      pulse('fx-perfect', DUR.perfect);
      pulse('fx-combo',   DUR.combo);
      return;
    }

    if (k === 'miss'){
      pulse('fx-miss', DUR.miss);
      pulse('fx-bad',  DUR.bad);
      return;
    }
  }

  let lastComboBucket = 0;
  function onScore(detail){
    detail = detail || {};
    const combo = Number(detail.combo||0);

    // bucket combo so it doesn't spam
    // bucket: 0-5 => 0, 6-9 => 1, 10-13 => 2, 14+ => 3
    let b = 0;
    if (combo >= 6 && combo <= 9) b = 1;
    else if (combo >= 10 && combo <= 13) b = 2;
    else if (combo >= 14) b = 3;

    if (b > 0 && b !== lastComboBucket){
      lastComboBucket = b;
      pulse('fx-combo', DUR.combo);
      // mild highlight for good streak
      pulse('fx-good', SOFT ? 90 : 120);
    }
    if (combo === 0){
      lastComboBucket = 0;
    }
  }

  function onEnd(){
    addCls('fx-end');
    clearTimeout(T.__endOff);
    T.__endOff = setTimeout(()=> rmCls('fx-end'), DUR.end);

    // clear long-running modes
    rmCls('fx-storm');
    rmCls('fx-boss');
  }

  // -------- attach listeners --------
  try{
    root.addEventListener('hha:judge', (ev)=> onJudge(ev.detail), {passive:true});
    root.addEventListener('groups:progress', (ev)=> onProgress(ev.detail), {passive:true});
    root.addEventListener('hha:score', (ev)=> onScore(ev.detail), {passive:true});
    root.addEventListener('hha:end', ()=> onEnd(), {passive:true});
  }catch(_){}
})(typeof window !== 'undefined' ? window : globalThis);