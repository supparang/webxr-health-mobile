/* === /herohealth/vr-groups/fx-signature.js ===
PACK 20: Signature FX — PRODUCTION
✅ Different feel for GOOD / WRONG / JUNK / BOSS
✅ Combo streak cinematic (rate-limited)
Requires: PACK19 fx-director.js (preferred), falls back to hha:judge
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function centerXY(){ return { x:(root.innerWidth||0)*0.5, y:(root.innerHeight||0)*0.55 }; }

  function fire(a){
    try{
      const D = root.GroupsVR && root.GroupsVR.FX;
      if (D && typeof D.fire === 'function'){ D.fire(a); return; }
    }catch(_){}
    // fallback: emit judge for PACK16
    try{
      root.dispatchEvent(new CustomEvent('hha:judge',{detail:{
        kind:a.kind, text:a.text||'', x:a.x, y:a.y, intensity:a.intensity
      }}));
    }catch(_){}
  }

  // --- combo streak detector ---
  let lastCombo = 0;
  let lastStreakAt = 0;
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    const combo = Number(d.combo||0);
    // streak milestones
    const t = now();
    if (combo >= 8 && combo !== lastCombo){
      // rate limit cinematic streak
      if (t - lastStreakAt > 800){
        lastStreakAt = t;
        const {x,y} = centerXY();
        fire({ kind:'combo', text:`STREAK x${combo}!`, x, y, intensity: 1.2 });
      }
    }
    lastCombo = combo;
  }, {passive:true});

  // judge signature
  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();
    const text = String(d.text||'');
    const xy = {
      x: (typeof d.x==='number') ? d.x : centerXY().x,
      y: (typeof d.y==='number') ? d.y : centerXY().y
    };

    // ✅ GOOD (hit correct group)
    if (kind === 'good'){
      fire({ kind:'good', text: text || '+', x:xy.x, y:xy.y, intensity: 1.0 });
      return;
    }

    // ✅ WRONG / JUNK are often both "bad" in engine → we tag by message text
    // If engine sends "-12" => WRONG, "-18" => JUNK (from your groups.safe.js)
    if (kind === 'bad'){
      const isJunk  = text.includes('-18') || text.toUpperCase().includes('JUNK');
      const isWrong = text.includes('-12') || text.toUpperCase().includes('WRONG');

      if (isJunk){
        fire({ kind:'bad', text:'JUNK!', x:xy.x, y:xy.y, intensity: 1.25 });
      }else if (isWrong){
        fire({ kind:'bad', text:'WRONG!', x:xy.x, y:xy.y, intensity: 1.05 });
      }else{
        fire({ kind:'bad', text: text || 'BAD', x:xy.x, y:xy.y, intensity: 1.1 });
      }
      return;
    }

    // ✅ BOSS (heavy, purple vibe)
    if (kind === 'boss'){
      fire({ kind:'boss', text: text || 'BOSS', x:xy.x, y:xy.y, intensity: 1.25 });
      return;
    }

    // ✅ MISS
    if (kind === 'miss'){
      fire({ kind:'miss', text:'MISS', x:xy.x, y:xy.y, intensity: 1.05 });
      return;
    }

    // ✅ PERFECT (boss down / perfect switch / goal clear)
    if (kind === 'perfect'){
      fire({ kind:'perfect', text: text || 'PERFECT', x:xy.x, y:xy.y, intensity: 1.35 });
      return;
    }
  }, {passive:true});

  // progress signature (storm/boss)
  root.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    const {x,y} = centerXY();
    if (k==='storm_on') fire({ kind:'storm', text:'STORM!', x, y, intensity: 1.35 });
    if (k==='boss_spawn') fire({ kind:'boss', text:'BOSS!', x, y, intensity: 1.45 });
    if (k==='boss_down') fire({ kind:'perfect', text:'BOSS DOWN!', x, y, intensity: 1.6 });
    if (k==='perfect_switch') fire({ kind:'perfect', text:'SWITCH!', x, y, intensity: 1.25 });
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);