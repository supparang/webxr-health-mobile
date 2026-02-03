// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (Classic script)
// ✅ Single global FX layer: .hha-fx-layer (fixed/inset, pointer-events:none)
// ✅ Safe: never crash if Particles missing
// ✅ Listens: hha:judge / hha:coach / hha:shoot (optional)
// ✅ Provides: window.HHA_FX.* helpers (burst/popText/ring etc.)
// Notes:
// - If particles.js provides window.Particles.burst(x,y), we call it.
// - If not, we use DOM-only FX fallback.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  // ---------------- utils ----------------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function vpRect(){
    try{ return DOC.documentElement.getBoundingClientRect(); }
    catch{ return { left:0, top:0, width: (WIN.innerWidth||360), height:(WIN.innerHeight||640) }; }
  }

  function getXYFromEvent(ev){
    // Try explicit coords first
    const d = ev && ev.detail ? ev.detail : null;
    if (d && typeof d.x === 'number' && typeof d.y === 'number') return { x:d.x, y:d.y };

    // Pointer / Mouse events
    if (ev && typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
      return { x: ev.clientX, y: ev.clientY };
    }
    // Touch
    const t = ev && ev.touches && ev.touches[0] ? ev.touches[0] : null;
    if (t && typeof t.clientX === 'number' && typeof t.clientY === 'number') {
      return { x: t.clientX, y: t.clientY };
    }
    return null;
  }

  // ---------------- layer + style ----------------
  function ensureStyle(){
    if (DOC.getElementById('hha-fx-style')) return;

    const css = `
.hha-fx-layer{
  position:fixed;
  inset:0;
  z-index:260;
  pointer-events:none;
  overflow:hidden;
  contain: layout paint style;
}
.hha-fx{
  position:absolute;
  left:0; top:0;
  transform: translate(-50%, -50%);
  will-change: transform, opacity;
  pointer-events:none;
  user-select:none;
  -webkit-tap-highlight-color: transparent;
}
@keyframes hhaPop{
  0%{ transform:translate(-50%,-50%) scale(.65); opacity:.0; filter: blur(1px); }
  18%{ transform:translate(-50%,-50%) scale(1.02); opacity:1; filter: blur(0px); }
  100%{ transform:translate(-50%,-64%) scale(1.08); opacity:0; }
}
@keyframes hhaRing{
  0%{ transform:translate(-50%,-50%) scale(.82); opacity:.0; }
  12%{ opacity:.9; }
  100%{ transform:translate(-50%,-50%) scale(1.45); opacity:0; }
}
@keyframes hhaShard{
  0%{ transform:translate(-50%,-50%) translate(0,0) scale(1); opacity:1; }
  100%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.85); opacity:0; }
}
.hha-fx-text{
  font-weight:1000;
  letter-spacing:.2px;
  text-shadow: 0 14px 36px rgba(0,0,0,.45);
  animation: hhaPop 520ms ease-out forwards;
  white-space:nowrap;
}
.hha-fx-ring{
  width: 140px;
  height: 140px;
  border-radius:999px;
  border: 3px solid rgba(229,231,235,.30);
  box-shadow: 0 0 0 1px rgba(2,6,23,.30) inset;
  animation: hhaRing 520ms ease-out forwards;
}
.hha-fx-shard{
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(229,231,235,.92);
  box-shadow: 0 8px 18px rgba(0,0,0,.35);
  animation: hhaShard 420ms ease-out forwards;
}
    `.trim();

    const style = DOC.createElement('style');
    style.id = 'hha-fx-style';
    style.textContent = css;
    DOC.head.appendChild(style);
  }

  function ensureLayer(){
    ensureStyle();
    let layer = DOC.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = DOC.createElement('div');
      layer.className = 'hha-fx-layer';
      DOC.body.appendChild(layer);
    }
    return layer;
  }

  function el(tag, cls){
    const n = DOC.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function removeLater(node, ms){
    setTimeout(()=>{ try{ node.remove(); }catch(_){ } }, Math.max(0, ms|0));
  }

  // ---------------- Particles bridge (optional) ----------------
  function particlesBurst(x,y, opts){
    try{
      // common variants
      if (WIN.HHA_FX && WIN.HHA_FX.__particles_only__) return;
      const P = WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || null;
      if (P && typeof P.burst === 'function') {
        P.burst(x,y, opts||{});
        return true;
      }
    }catch(_){}
    return false;
  }

  // ---------------- DOM FX primitives ----------------
  function ring(x,y, tone){
    const layer = ensureLayer();
    const n = el('div', 'hha-fx hha-fx-ring');
    n.style.left = Math.round(x)+'px';
    n.style.top  = Math.round(y)+'px';

    // tone
    const c = toneColor(tone);
    n.style.borderColor = c.ring;
    layer.appendChild(n);
    removeLater(n, 560);
  }

  function shards(x,y, tone){
    const layer = ensureLayer();
    const c = toneColor(tone);

    const count = 10;
    for(let i=0;i<count;i++){
      const s = el('div', 'hha-fx hha-fx-shard');
      s.style.left = Math.round(x)+'px';
      s.style.top  = Math.round(y)+'px';

      // random spread
      const ang = (Math.PI*2) * (i / count) + (Math.random()*0.55);
      const dist = 26 + Math.random()*34;
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist;

      s.style.setProperty('--dx', Math.round(dx)+'px');
      s.style.setProperty('--dy', Math.round(dy)+'px');
      s.style.background = c.dot;

      layer.appendChild(s);
      removeLater(s, 460);
    }
  }

  function popText(x,y, text, tone){
    const layer = ensureLayer();
    const n = el('div', 'hha-fx hha-fx-text');
    n.textContent = String(text || '');
    n.style.left = Math.round(x)+'px';
    n.style.top  = Math.round(y)+'px';

    const c = toneColor(tone);
    n.style.color = c.text;

    layer.appendChild(n);
    removeLater(n, 620);
  }

  function burst(x,y, tone, label){
    // try particles first; still do ring/text for readability
    particlesBurst(x,y, { tone:String(tone||'good') });

    ring(x,y,tone);
    shards(x,y,tone);

    if (label) popText(x, y-10, label, tone);
  }

  function toneColor(tone){
    const t = String(tone||'good');
    if (t === 'bad' || t === 'junk') {
      return { text:'#fecaca', ring:'rgba(239,68,68,.38)', dot:'rgba(239,68,68,.92)' };
    }
    if (t === 'miss') {
      return { text:'#fde68a', ring:'rgba(251,191,36,.34)', dot:'rgba(251,191,36,.92)' };
    }
    if (t === 'bonus' || t === 'perfect') {
      return { text:'#bae6fd', ring:'rgba(56,189,248,.34)', dot:'rgba(56,189,248,.92)' };
    }
    if (t === 'boss') {
      return { text:'#fef3c7', ring:'rgba(245,158,11,.34)', dot:'rgba(245,158,11,.92)' };
    }
    // good/default
    return { text:'#bbf7d0', ring:'rgba(34,197,94,.32)', dot:'rgba(34,197,94,.92)' };
  }

  // ---------------- last aim point tracking ----------------
  let LAST = { x:null, y:null, t:0 };

  function setLastXY(x,y){
    LAST.x = x; LAST.y = y; LAST.t = nowMs();
  }

  function getLastXY(){
    const r = vpRect();
    const age = nowMs() - (LAST.t||0);
    if (typeof LAST.x === 'number' && typeof LAST.y === 'number' && age < 2500) {
      return { x:LAST.x, y:LAST.y };
    }
    // fallback = center screen
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }

  // capture pointer anywhere (helps when judge event has no coords)
  DOC.addEventListener('pointerdown', (ev)=>{
    const p = getXYFromEvent(ev);
    if (p) setLastXY(p.x,p.y);
  }, { passive:true, capture:true });

  // capture shoot (center / lockPx aim assist)
  WIN.addEventListener('hha:shoot', (ev)=>{
    const p = getXYFromEvent(ev);
    if (p) setLastXY(p.x,p.y);
    else {
      const r = vpRect();
      setLastXY(r.left + r.width/2, r.top + r.height/2);
    }
  }, { passive:true });

  // ---------------- event bindings ----------------
  function onJudge(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const type = String(d.type || '').toLowerCase();
    const label = d.label || d.text || null;

    // locate
    const xy = getXYFromEvent(ev) || getLastXY();
    if (xy) setLastXY(xy.x, xy.y);

    // map types
    // common: good/bad/miss/perfect + custom labels
    if (type === 'good' || type === 'hit' || type === 'ok') burst(xy.x, xy.y, 'good', label || 'GOOD');
    else if (type === 'bad' || type === 'junk' || type === 'hurt') burst(xy.x, xy.y, 'bad', label || 'OOPS');
    else if (type === 'miss' || type === 'timeout' ) burst(xy.x, xy.y, 'miss', label || 'MISS');
    else if (type === 'perfect' || type === 'bonus') burst(xy.x, xy.y, 'perfect', label || 'BONUS');
    else {
      // unknown -> subtle pop only
      if (label) popText(xy.x, xy.y-10, label, 'bonus');
      else ring(xy.x, xy.y, 'bonus');
    }
  }

  function onCoach(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const msg = d.msg || d.text || '';
    if (!msg) return;

    const xy = getLastXY();
    // coach tip pops slightly above center so it doesn't look like a hit marker
    popText(xy.x, xy.y-70, msg, 'bonus');
  }

  WIN.addEventListener('hha:judge', onJudge, { passive:true });
  WIN.addEventListener('hha:coach', onCoach, { passive:true });

  // Optional compatibility: some games might emit these
  WIN.addEventListener('groups:hit', (ev)=>{
    try{
      const t = String(ev?.detail?.type||'').toLowerCase();
      const xy = getXYFromEvent(ev) || getLastXY();
      if (t.includes('good')) burst(xy.x, xy.y, 'good', 'GOOD');
      else if (t.includes('bad')) burst(xy.x, xy.y, 'bad', 'BAD');
      else if (t.includes('miss')) burst(xy.x, xy.y, 'miss', 'MISS');
    }catch(_){}
  }, { passive:true });

  // ---------------- public API ----------------
  WIN.HHA_FX = WIN.HHA_FX || {};
  WIN.HHA_FX.layer = ensureLayer;

  WIN.HHA_FX.burst = (x,y, opts)=>{
    const tone = (opts && opts.tone) ? opts.tone : 'good';
    const label = (opts && opts.label) ? opts.label : null;
    burst(Number(x)||0, Number(y)||0, tone, label);
  };

  WIN.HHA_FX.popText = (x,y,text, tone)=> popText(Number(x)||0, Number(y)||0, text, tone||'bonus');
  WIN.HHA_FX.ring    = (x,y, tone)=> ring(Number(x)||0, Number(y)||0, tone||'bonus');

  // semantic helpers
  WIN.HHA_FX.hitGood   = (x,y)=> burst(x,y,'good','GOOD');
  WIN.HHA_FX.hitBad    = (x,y)=> burst(x,y,'bad','OOPS');
  WIN.HHA_FX.miss      = (x,y)=> burst(x,y,'miss','MISS');
  WIN.HHA_FX.bonus     = (x,y,label)=> burst(x,y,'perfect', label||'BONUS');
  WIN.HHA_FX.bossHit   = (x,y)=> burst(x,y,'boss','BOSS');
  WIN.HHA_FX.bossClear = (x,y)=> burst(x,y,'perfect','BOSS CLEAR!');

  // allow games to tell director where the last meaningful interaction happened
  WIN.HHA_FX.setLastXY = (x,y)=> setLastXY(Number(x)||0, Number(y)||0);
  WIN.HHA_FX.getLastXY = ()=> getLastXY();

  // Eager-create layer once body exists (helps CSS/z-index expectations)
  function init(){
    try{ ensureLayer(); }catch(_){}
  }
  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init);
  else init();

})();