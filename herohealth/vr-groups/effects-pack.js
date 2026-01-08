/* === /herohealth/vr-groups/effects-pack.js ===
GroupsVR FX Pack — PRODUCTION (PACK 37)
✅ Listen to: hha:judge / groups:progress / hha:score / hha:end
✅ Adds body classes: fx-hit fx-good fx-bad fx-miss fx-perfect fx-combo fx-storm fx-boss fx-end
✅ Auto-clear with timeout (no sticky)
✅ Safe: rate-limited + won't block input
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const BODY = DOC.body;

  // prevent double load
  if (root.__HHA_GROUPS_FX_LOADED__) return;
  root.__HHA_GROUPS_FX_LOADED__ = true;

  function addFx(cls, ms){
    ms = Math.max(60, Number(ms)||160);
    try{
      BODY.classList.add(cls);
      clearTimeout(addFx._tmr?.[cls]);
      addFx._tmr = addFx._tmr || Object.create(null);
      addFx._tmr[cls] = setTimeout(()=>{ 
        try{ BODY.classList.remove(cls); }catch(_){}
      }, ms);
    }catch(_){}
  }

  function setFx(cls, on){
    try{ BODY.classList.toggle(cls, !!on); }catch(_){}
  }

  // combo glow threshold
  let lastCombo = 0;
  let comboOn = false;

  // soft rate limit
  let lastJudgeAt = 0;
  function canJudge(){
    const t = (root.performance && performance.now) ? performance.now() : Date.now();
    if (t - lastJudgeAt < 55) return false;
    lastJudgeAt = t;
    return true;
  }

  // ---------- hha:judge => hit/good/bad/perfect/miss ----------
  root.addEventListener('hha:judge', (ev)=>{
    if (!canJudge()) return;
    const d = ev.detail || {};
    const k = String(d.kind||'').toLowerCase();

    // common hit kick
    addFx('fx-hit', 140);

    if (k === 'good'){
      addFx('fx-good', 170);
      return;
    }
    if (k === 'bad'){
      addFx('fx-bad', 190);
      return;
    }
    if (k === 'miss'){
      addFx('fx-miss', 190);
      addFx('fx-bad', 190);
      return;
    }
    if (k === 'perfect'){
      addFx('fx-perfect', 210);
      addFx('fx-good', 170);
      return;
    }
    if (k === 'storm'){
      // some engines may emit storm here too
      addFx('fx-storm', 380);
      return;
    }
    if (k === 'boss'){
      addFx('fx-boss', 320);
      return;
    }
  }, { passive:true });

  // ---------- groups:progress => storm/boss states ----------
  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail || {};
    const kind = String(d.kind||'').toLowerCase();

    if (kind === 'storm_on'){
      setFx('fx-storm', true);
      addFx('fx-storm', 420);
      return;
    }
    if (kind === 'storm_off'){
      setFx('fx-storm', false);
      return;
    }

    if (kind === 'boss_spawn'){
      setFx('fx-boss', true);
      addFx('fx-boss', 420);
      return;
    }
    if (kind === 'boss_down'){
      addFx('fx-perfect', 260);
      addFx('fx-good', 180);
      // keep boss fx off after down
      setFx('fx-boss', false);
      return;
    }
    if (kind === 'perfect_switch'){
      addFx('fx-perfect', 260);
      addFx('fx-good', 160);
      return;
    }
    if (kind === 'miss'){
      addFx('fx-miss', 190);
      addFx('fx-bad', 190);
      return;
    }
  }, { passive:true });

  // ---------- hha:score => combo highlight ----------
  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    const combo = Number(d.combo || 0) || 0;

    // combo glow after 6
    const should = (combo >= 6);
    if (should !== comboOn){
      comboOn = should;
      setFx('fx-combo', comboOn);
    }

    // little burst at new high combo jump
    if (combo > lastCombo && combo >= 8){
      addFx('fx-perfect', 160);
    }
    lastCombo = combo;
  }, { passive:true });

  // ---------- hha:end => end vignette ----------
  root.addEventListener('hha:end', ()=>{
    setFx('fx-end', true);
    // keep end until user closes overlay or restarts
  }, { passive:true });

})(typeof window !== 'undefined' ? window : globalThis);