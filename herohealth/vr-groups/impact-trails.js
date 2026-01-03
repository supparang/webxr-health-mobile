/* === /herohealth/vr-groups/impact-trails.js ===
PACK 43: Impact Trails + Hit Marker — PRODUCTION
✅ Trail from crosshair(center) -> hit point
✅ Uses DOM only (fast), FXPerf gate
✅ Optional Particles burst on FX=3
Requires: (optional) ../vr/particles.js
*/

(function(root){
  'use strict';
  const DOC = root.document; if(!DOC) return;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function fxLevel(){
    try{ return (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||2); }
    catch{ return 2; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function ensureLayer(){
    let layer = DOC.querySelector('.groups-impact-layer');
    if (layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'groups-impact-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:160;overflow:hidden;';
    DOC.body.appendChild(layer);
    return layer;
  }

  function hasParticles(){
    const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
    return !!P;
  }
  function burst(x,y,n=12){
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.burst==='function') P.burst(x,y,n);
    }catch(_){}
  }

  function xyFrom(ev){
    const cx = innerWidth*0.5, cy = innerHeight*0.5;
    if (!ev) return {x:cx,y:cy};
    if (typeof ev.clientX === 'number') return {x:ev.clientX, y:ev.clientY};
    // custom detail might pass x/y
    if (typeof ev.x === 'number' && typeof ev.y === 'number') return {x:ev.x, y:ev.y};
    return {x:cx,y:cy};
  }

  function mkMarker(x,y, kind){
    const layer = ensureLayer();
    const m = DOC.createElement('div');
    m.className = 'impact-marker impact-' + kind;
    m.style.left = x + 'px';
    m.style.top  = y + 'px';
    layer.appendChild(m);
    setTimeout(()=>{ try{ m.remove(); }catch{} }, 260);
  }

  function mkTrail(x0,y0,x1,y1, kind){
    const layer = ensureLayer();
    const dx = x1-x0, dy = y1-y0;
    const len = Math.max(10, Math.hypot(dx,dy));
    const ang = Math.atan2(dy,dx) * 180 / Math.PI;

    const t = DOC.createElement('div');
    t.className = 'impact-trail impact-' + kind;
    t.style.left = x0 + 'px';
    t.style.top  = y0 + 'px';
    t.style.width = len + 'px';
    t.style.transform = `translate(0,-50%) rotate(${ang}deg)`;
    layer.appendChild(t);

    // animate "wipe"
    requestAnimationFrame(()=> t.classList.add('go'));
    setTimeout(()=>{ try{ t.remove(); }catch{} }, allow(3)? 260 : 220);
  }

  function impact(kind, hit){
    if (!allow(2)) return;

    const cx = innerWidth*0.5, cy = innerHeight*0.5;
    const {x,y} = hit;

    mkTrail(cx,cy,x,y,kind);
    mkMarker(x,y,kind);

    if (allow(3) && hasParticles()){
      burst(x,y, kind==='boss' ? 18 : 12);
    }
  }

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    if (!(k==='good' || k==='bad' || k==='boss')) return;

    // prefer d.ev (pointer), else use d.x/d.y, else center
    const hit = xyFrom(d.ev || d);
    impact(k, hit);
  }, {passive:true});

})(typeof window!=='undefined'?window:globalThis);