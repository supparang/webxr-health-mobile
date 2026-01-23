// === /herohealth/hygiene-vr/hygiene.ghost.js ===
// Simple replay ghost (last run)
// Stores: HHA_GHOST_HYGIENE (compressed points)
// Exposes: window.HHA_GHOST = { save(points), load(), mount(stage), clearStage() }

'use strict';

(function(){
  const WIN = window;
  const DOC = document;
  const KEY = 'HHA_GHOST_HYGIENE';

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function save(points){
    try{
      const arr = Array.isArray(points) ? points : [];
      // keep last 240 points
      const slim = arr.slice(-240);
      localStorage.setItem(KEY, JSON.stringify(slim));
    }catch{}
  }

  function load(){
    try{
      const s = localStorage.getItem(KEY);
      const arr = s ? JSON.parse(s) : [];
      return Array.isArray(arr) ? arr : [];
    }catch{ return []; }
  }

  let ghostLayer = null;

  function clearStage(){
    try{ ghostLayer?.remove(); }catch{}
    ghostLayer = null;
  }

  function mount(stage){
    if(!stage) return;
    clearStage();

    ghostLayer = DOC.createElement('div');
    ghostLayer.className = 'hw-ghost-layer';
    stage.appendChild(ghostLayer);

    const points = load();
    if(!points.length){
      ghostLayer.innerHTML = `<div class="hw-ghost-empty">👻 ไม่มี Ghost (ยังไม่เคยเล่น)</div>`;
      return;
    }

    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;

    for(const p of points){
      const dot = DOC.createElement('div');
      const kind = (p.k||'').toLowerCase();
      dot.className = 'hw-ghost-dot ' + (kind==='good'?'g':(kind==='wrong'?'w':(kind==='haz'?'h':'g')));
      const x = clamp(Number(p.x||0), 0, w);
      const y = clamp(Number(p.y||0), 0, h);
      dot.style.left = (x / w * 100).toFixed(3) + '%';
      dot.style.top  = (y / h * 100).toFixed(3) + '%';
      dot.title = `${kind} @${Math.round(p.t||0)}ms`;
      ghostLayer.appendChild(dot);
    }
  }

  WIN.HHA_GHOST = { save, load, mount, clearStage };
})();