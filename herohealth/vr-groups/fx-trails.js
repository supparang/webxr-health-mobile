/* === /herohealth/vr-groups/fx-trails.js ===
PACK 22: Target Trail + Afterimage — PRODUCTION
✅ Afterimage on spawn/hit (light)
✅ Storm trail aura (very light)
✅ Boss afterimage on hurt
Requires: targets are .fg-target with CSS vars --x --y --s
Respects: GroupsVR.FXPerf level (PACK21) via body[data-fx-level]
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function ensureLayer(){
    let el = DOC.querySelector('.groups-trail-layer');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'groups-trail-layer';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden;';
    DOC.body.appendChild(el);
    return el;
  }

  function afterimageFromTarget(tgEl, kind='normal'){
    if (!tgEl || !allow(2)) return;      // only >=2
    const layer = ensureLayer();
    const clone = tgEl.cloneNode(true);
    clone.classList.add('fg-ghost');
    clone.classList.add(kind==='boss' ? 'fg-ghost-boss' : 'fg-ghost-normal');
    clone.style.pointerEvents = 'none';
    layer.appendChild(clone);
    setTimeout(()=>{ try{ clone.remove(); }catch{} }, kind==='boss' ? 420 : 280);
  }

  // spawn observer: when new targets added, create a faint ghost
  const playLayer = DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;

  const mo = new MutationObserver((muts)=>{
    if (!allow(2)) return;
    for (const m of muts){
      if (!m.addedNodes) continue;
      m.addedNodes.forEach((n)=>{
        if (!(n instanceof HTMLElement)) return;
        if (n.classList && n.classList.contains('fg-target')){
          // only sometimes (keep light)
          const L = fxLevel();
          const r = Math.random();
          if (L>=3 || r < 0.45){
            afterimageFromTarget(n, n.classList.contains('fg-boss') ? 'boss' : 'normal');
          }
        }
      });
    }
  });
  try{ mo.observe(playLayer, { childList:true, subtree:false }); }catch{}

  // boss hurt: engine toggles .fg-boss-hurt briefly
  const mo2 = new MutationObserver((muts)=>{
    if (!allow(2)) return;
    for (const m of muts){
      if (m.type==='attributes' && m.attributeName==='class'){
        const el = m.target;
        if (!(el instanceof HTMLElement)) continue;
        if (!el.classList.contains('fg-target')) continue;
        if (el.classList.contains('fg-boss-hurt')){
          afterimageFromTarget(el, 'boss');
        }
      }
    }
  });
  try{ mo2.observe(playLayer, { attributes:true, subtree:true, attributeFilter:['class'] }); }catch{}

  // storm aura (very light): toggle class on body, CSS handles
  root.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='storm_on' && allow(1)) DOC.body.classList.add('fx-storm-aura');
    if (k==='storm_off') DOC.body.classList.remove('fx-storm-aura');
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);