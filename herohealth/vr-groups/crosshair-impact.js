/* === /herohealth/vr-groups/crosshair-impact.js ===
PACK 31: Crosshair Impact + Tap Ring — PRODUCTION
✅ Works best in view-cvr (shoot from crosshair)
✅ Shows tap ring at center when firing
✅ Shows impact ring + tiny kick when hit confirmed
✅ Hooks: hha:shoot (fire), fx:hit (hit/miss), hha:judge (fallback)
Respects FXPerf (>=2)
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

  function view(){
    const c = DOC.body.className || '';
    if (c.includes('view-cvr')) return 'cvr';
    if (c.includes('view-vr')) return 'vr';
    if (c.includes('view-pc')) return 'pc';
    return 'mobile';
  }

  function ensureLayer(){
    let el = DOC.querySelector('.fx-crosshair-layer');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-crosshair-layer';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:85;overflow:hidden;';
    DOC.body.appendChild(el);
    return el;
  }

  function ring(x,y, cls){
    const layer = ensureLayer();
    const r = DOC.createElement('div');
    r.className = 'fx-ring ' + (cls||'');
    r.style.left = x + 'px';
    r.style.top  = y + 'px';
    layer.appendChild(r);
    setTimeout(()=>{ try{ r.remove(); }catch{} }, 520);
  }

  function kick(ms){
    try{
      DOC.body.classList.add('fx-kick');
      setTimeout(()=>DOC.body.classList.remove('fx-kick'), ms||120);
    }catch(_){}
  }

  const CX = ()=> (root.innerWidth||360) * 0.5;
  const CY = ()=> (root.innerHeight||640) * 0.5;

  let lastFireAt = 0;

  // When user fires
  root.addEventListener('hha:shoot', ()=>{
    if (!allow(2)) return;
    if (view() !== 'cvr') return;
    const t = NOW();
    if (t - lastFireAt < 80) return;
    lastFireAt = t;

    ring(CX(), CY(), 'fx-ring-fire');
    // subtle haptic for fire (optional)
    try{ navigator.vibrate && navigator.vibrate(8); }catch(_){}
  }, {passive:true});

  // Preferred: fx:hit from fx-router
  root.addEventListener('fx:hit', (ev)=>{
    if (!allow(2)) return;
    if (view() !== 'cvr') return;
    const d = ev.detail||{};
    const kind = String(d.kind||'').toLowerCase();
    if (kind === 'good' || kind === 'boss' || kind === 'perfect'){
      ring(CX(), CY(), 'fx-ring-hit');
      kick(110);
    } else if (kind === 'bad' || kind === 'miss'){
      ring(CX(), CY(), 'fx-ring-miss');
    }
  }, {passive:true});

  // Fallback: judge (if fx-router not used)
  root.addEventListener('hha:judge', (ev)=>{
    if (!allow(2)) return;
    if (view() !== 'cvr') return;
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='good' || k==='boss' || k==='perfect'){
      ring(CX(), CY(), 'fx-ring-hit');
      kick(110);
    } else if (k==='bad' || k==='miss'){
      ring(CX(), CY(), 'fx-ring-miss');
    }
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);