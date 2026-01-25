/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks bridge
✅ attach({runMode, seed, enabled})
✅ Applies DD suggestion to engine preset (safe + reversible)
✅ Disabled in research/practice by caller
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  let ATTACHED = false;
  let ENABLED = false;
  let runMode = 'play';

  let base = null; // store original preset snapshot
  let it = 0;
  let lastDD = null;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function getEngine(){
    return NS.GameEngine || (NS.GameEngine = null);
  }

  function snapshotPreset(E){
    try{
      const p = E && E.cfg && E.cfg.preset;
      if (!p) return null;
      return {
        baseSpawnMs: Number(p.baseSpawnMs),
        targetSize: Number(p.targetSize),
        wrongRate:  Number(p.wrongRate),
        junkRate:   Number(p.junkRate),
        stormEverySec: Number(p.stormEverySec),
        stormLenSec: Number(p.stormLenSec),
        bossHp: Number(p.bossHp),
        powerThreshold: Number(p.powerThreshold),
        goalTargets: Number(p.goalTargets),
        goalsTotal: Number(p.goalsTotal)
      };
    }catch(_){ return null; }
  }

  function restorePreset(E){
    if (!base) return;
    try{
      const p = E.cfg.preset;
      Object.keys(base).forEach(k=>{ p[k] = base[k]; });
    }catch(_){}
  }

  function applyDD(E, dd){
    if (!E || !E.cfg || !E.cfg.preset) return;
    const p = E.cfg.preset;

    if (!base) base = snapshotPreset(E);
    if (!base) return;

    // apply multipliers/deltas
    const spawnMul = clamp(dd.spawnMul, 0.78, 1.22);
    const sizeMul  = clamp(dd.sizeMul,  0.90, 1.15);
    const lifeMul  = clamp(dd.lifeMul,  0.88, 1.18);
    const wrongD   = clamp(dd.wrongDelta, -0.06, 0.06);
    const junkD    = clamp(dd.junkDelta,  -0.06, 0.06);

    p.baseSpawnMs = clamp(base.baseSpawnMs * spawnMul, 320, 980);
    p.targetSize  = clamp(base.targetSize  * sizeMul,  0.86, 1.12);
    p.wrongRate   = clamp(base.wrongRate + wrongD,     0.10, 0.55);
    p.junkRate    = clamp(base.junkRate  + junkD,      0.06, 0.45);

    // lifeMs อยู่ใน engine เป็นค่า runtime ต่อ spawn; เรา “ส่งนัย” ผ่านตัวคูณให้ engine ใช้ได้ในอนาคต
    // เก็บไว้เป็นค่า property เพื่ออนาคต (ไม่ทำพัง)
    p.__lifeMul = lifeMul;
  }

  function onDDSuggest(ev){
    if (!ENABLED) return;
    lastDD = ev.detail || null;
  }

  root.addEventListener('groups:dd_suggest', onDDSuggest, {passive:true});

  function tick(){
    if (!ENABLED) return;
    const E = getEngine();
    if (!E || !E.cfg || !E.cfg.preset) return;
    if (!lastDD) return;
    applyDD(E, lastDD);
  }

  function attach(opts){
    opts = opts || {};
    runMode = String(opts.runMode||'play');
    ENABLED = !!opts.enabled && (runMode==='play');
    ATTACHED = true;

    // start DDDirector if available
    try{ NS.DDDirector && NS.DDDirector.start && NS.DDDirector.start(); }catch(_){}

    clearInterval(it);
    it = setInterval(tick, 900);

    return true;
  }

  function detach(){
    const E = getEngine();
    if (E && base) restorePreset(E);

    ENABLED = false;
    ATTACHED = false;
    lastDD = null;

    clearInterval(it); it = 0;

    try{ NS.DDDirector && NS.DDDirector.stop && NS.DDDirector.stop(); }catch(_){}

    return true;
  }

  NS.AIHooks = { attach, detach, getLastDD: ()=>lastDD };
})(typeof window!=='undefined'?window:globalThis);