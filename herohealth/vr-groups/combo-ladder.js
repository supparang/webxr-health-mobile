/* === /herohealth/vr-groups/combo-ladder.js ===
PACK 28: Combo Ladder — PRODUCTION
✅ Tracks combo streak by reading hha:score
✅ Emits fx:combo-tier when reaching milestones
✅ Tiered celebration: S / SS / SSS style
✅ Safe: rate-limited, respects FXPerf level
Requires: fx-router.js (recommended) but can work without
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const NOW = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  // milestones -> tier label
  const MILE = [
    { n: 6,  tier: 'S',   text: 'S COMBO!'   },
    { n: 10, tier: 'SS',  text: 'SS COMBO!!' },
    { n: 14, tier: 'SSS', text: 'SSS COMBO!!!' }
  ];

  let curCombo = 0;
  let lastCombo = 0;
  let lastTierAt = 0;

  function tierFor(combo){
    for (let i = MILE.length - 1; i >= 0; i--){
      if (combo >= MILE[i].n) return MILE[i];
    }
    return null;
  }

  // listen score to know combo, misses
  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    curCombo = Number(d.combo||0) || 0;

    // reset detection (miss)
    if (curCombo === 0 && lastCombo > 0){
      emit('fx:combo-reset', { t: NOW(), prev:lastCombo });
    }

    // tier bump detection
    const t = NOW();
    const A = tierFor(curCombo);
    const B = tierFor(lastCombo);

    const newTier = A && (!B || A.n > B.n);
    if (newTier && allow(2)){
      if (t - lastTierAt > 500){
        lastTierAt = t;
        emit('fx:combo-tier', { t, combo:curCombo, tier:A.tier, text:A.text, milestone:A.n });
        // also map to generic combo event (for older effect packs)
        emit('fx:combo', { t, combo:curCombo, tier:A.tier, text:A.text });
      }
    }

    lastCombo = curCombo;
  }, {passive:true});

  // clutch: last 3 seconds -> stronger vibe (without strobing)
  root.addEventListener('hha:time', (ev)=>{
    const left = Number((ev.detail||{}).left ?? 0);
    DOC.body.classList.toggle('fx-clutch', left>0 && left<=3);
  }, {passive:true});

  NS.ComboLadder = { tierFor };

})(typeof window!=='undefined' ? window : globalThis);