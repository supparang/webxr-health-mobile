// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA FX LAYER (shared for all games)
// ✅ popText(x,y,text,cls?)
// ✅ burstAt(x,y,kind?)
// ✅ shockwave(x,y,opts?)
// ✅ celebrate(kind?)
// ✅ Safe: single-load guard + pointer-events:none + self-contained CSS
// -----------------------------------------------------

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ------------------ layer ------------------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:160',            // above playfield; below critical overlays if they use >185
      'overflow:hidden',
      'contain:layout style paint'
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  // If topbars/buttons are sometimes unclickable, they must be > 160
  // Your current .hha-controls uses z-index:185 so it's safe.

  // ------------------ utils ------------------
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function rnd(a,b){ return a + Math.random()*(b-a); }
  function now(){ return performance.now(); }

  function mkEl(tag, cssText){
    const el = doc.createElement(tag);
    if(cssText) el.style.cssText = cssText;
    return el;
  }

  function ttlRemove(el, ms){
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms);
  }

  function pos(el,x,y){
    el.style.left = `${Math.round(x)}px`;
    el.style.top  = `${Math.round(y)}px`;
  }

  // ------------------ CSS ------------------
  const st = doc.createElement('style');
  st.textContent = `
  .hha-fx-layer{ font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif; }

  /* pop text */
  .hha-pop{
    position:absolute;
    transform: translate(-50%,-50%) scale(.96);
    opacity:.98;
    font: 1000 18px/1 system-ui;
    color:#fff;
    text-shadow: 0 10px 28px rgba(0,0,0,.58);
    will-change: transform, opacity, filter;
    animation: hhaPop 560ms ease-out forwards;
    filter: drop-shadow(0 10px 22px rgba(0,0,0,.40));
  }
  .hha-pop.big{ font-size:26px; letter-spacing:.4px; }
  .hha-pop.score{ font-size:20px; }
  .hha-pop.bad{ filter: drop-shadow(0 12px 26px rgba(239,68,68,.20)); }
  .hha-pop.good{ filter: drop-shadow(0 12px 26px rgba(34,197,94,.20)); }
  .hha-pop.star{ filter: drop-shadow(0 12px 26px rgba(245,158,11,.22)); }
  .hha-pop.block{ filter: drop-shadow(0 12px 26px rgba(59,130,246,.20)); }
  .hha-pop.diamond{ filter: drop-shadow(0 12px 26px rgba(34,211,238,.20)); }

  @keyframes hhaPop{
    0%{ transform:translate(-50%,-50%) scale(.92); opacity:.92; }
    55%{ transform:translate(-50%,-85%) scale(1.18); opacity:1; }
    100%{ transform:translate(-50%,-110%) scale(1.06); opacity:0; }
  }

  /* burst particles */
  .hha-burst{
    position:absolute;
    width:10px; height:10px;
    transform: translate(-50%,-50%);
    will-change: transform, opacity;
  }
  .hha-dot{
    position:absolute;
    width:8px; height:8px;
    border-radius:999px;
    opacity:.95;
    transform: translate(-50%,-50%);
    animation: hhaDot 620ms cubic-bezier(.15,.85,.15,1) forwards;
    filter: drop-shadow(0 8px 14px rgba(0,0,0,.28));
  }
  @keyframes hhaDot{
    0%{ transform:translate(-50%,-50%) scale(.85); opacity:.95; }
    70%{ opacity:.98; }
    100%{ transform:translate(var(--dx), var(--dy)) scale(.55); opacity:0; }
  }

  /* shockwave */
  .hha-wave{
    position:absolute;
    width:12px; height:12px;
    border-radius:999px;
    border: 2px solid rgba(255,255,255,.9);
    transform: translate(-50%,-50%) scale(.2);
    opacity:.85;
    will-change: transform, opacity;
    animation: hhaWave 520ms ease-out forwards;
    filter: drop-shadow(0 14px 28px rgba(0,0,0,.35));
  }
  @keyframes hhaWave{
    0%{ transform:translate(-50%,-50%) scale(.2); opacity:.75; }
    70%{ opacity:.45; }
    100%{ transform:translate(-50%,-50%) scale(var(--s,6)); opacity:0; }
  }

  /* celebrate confetti */
  .hha-confetti{
    position:absolute;
    width:10px; height:18px;
    border-radius:6px;
    opacity:.95;
    transform: translate(-50%,-50%) rotate(var(--r,0deg));
    animation: hhaConf 980ms cubic-bezier(.14,.92,.18,1) forwards;
    will-change: transform, opacity;
    filter: drop-shadow(0 10px 20px rgba(0,0,0,.30));
  }
  @keyframes hhaConf{
    0%{ transform:translate(-50%,-50%) translate(0,0) rotate(var(--r,0deg)); opacity:.95; }
    70%{ opacity:.9; }
    100%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) rotate(calc(var(--r,0deg) + 220deg)); opacity:0; }
  }
  `;
  doc.head.appendChild(st);

  // ------------------ color palettes ------------------
  // NOTE: we avoid hardcoding too many colors; but we still need some base hues for particles.
  // Keep minimal & readable.
  const PAL = {
    good:   ['#22c55e','#34d399','#a7f3d0','#86efac'],
    bad:    ['#ef4444','#fb7185','#fecaca','#f97316'],
    star:   ['#f59e0b','#fbbf24','#fde68a','#fef3c7'],
    shield: ['#3b82f6','#60a5fa','#93c5fd','#dbeafe'],
    diamond:['#22d3ee','#67e8f9','#a5f3fc','#cffafe'],
    block:  ['#a78bfa','#c4b5fd','#ddd6fe','#f5f3ff'],
    neutral:['#e5e7eb','#cbd5e1','#94a3b8','#f8fafc']
  };

  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // ------------------ API ------------------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = mkEl('div');
    el.className = 'hha-pop';
    if(cls) String(cls).split(/\s+/).filter(Boolean).forEach(c=> el.classList.add(c));
    el.textContent = String(text ?? '');
    pos(el,x,y);
    layer.appendChild(el);
    ttlRemove(el, 700);
  }

  function shockwave(x,y,opts={}){
    const layer = ensureLayer();
    const s = clamp(opts.s || opts.scale || 6, 2.5, 11);
    const color = opts.color || 'rgba(255,255,255,.95)';
    const el = mkEl('div');
    el.className = 'hha-wave';
    el.style.borderColor = color;
    el.style.setProperty('--s', String(s));
    pos(el,x,y);
    layer.appendChild(el);
    ttlRemove(el, 560);
  }

  function burstAt(x,y,kind='good'){
    const layer = ensureLayer();
    const k = (PAL[kind] ? kind : 'neutral');
    const colors = PAL[k];

    // wave first (strong feedback)
    const waveColor =
      (k==='bad') ? 'rgba(239,68,68,.95)' :
      (k==='good') ? 'rgba(34,197,94,.95)' :
      (k==='star') ? 'rgba(245,158,11,.95)' :
      (k==='shield') ? 'rgba(59,130,246,.95)' :
      (k==='diamond') ? 'rgba(34,211,238,.95)' :
      'rgba(255,255,255,.95)';
    shockwave(x,y,{ s: (k==='bad')?7.2:6.2, color: waveColor });

    const burst = mkEl('div');
    burst.className = 'hha-burst';
    pos(burst,x,y);

    // dots
    const n = (k==='bad') ? 14 : (k==='diamond') ? 16 : 12;
    const rad = (k==='bad') ? 92 : (k==='star') ? 86 : 78;

    for(let i=0;i<n;i++){
      const dot = mkEl('div');
      dot.className = 'hha-dot';
      dot.style.background = pick(colors);

      const a = (Math.PI*2) * (i/n) + rnd(-0.2,0.2);
      const d = rnd(rad*0.55, rad);
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d + rnd(-10, 18);

      dot.style.setProperty('--dx', `${dx}px`);
      dot.style.setProperty('--dy', `${dy}px`);
      dot.style.left = '0px';
      dot.style.top  = '0px';

      const s = rnd(0.7, 1.2);
      dot.style.width  = `${Math.round(7*s)}px`;
      dot.style.height = `${Math.round(7*s)}px`;

      burst.appendChild(dot);
    }

    layer.appendChild(burst);
    ttlRemove(burst, 720);
  }

  function celebrate(kind='good'){
    const layer = ensureLayer();
    const colors = PAL[kind] || PAL.neutral;

    const W = doc.documentElement.clientWidth;
    const H = doc.documentElement.clientHeight;

    const baseY = Math.round(H * 0.28);
    const baseX = Math.round(W * 0.5);

    // big pop text
    popText(baseX, baseY, '🎉', 'big');
    shockwave(baseX, baseY+20, { s: 9.5, color:'rgba(255,255,255,.92)' });

    // confetti shower
    const n = 26;
    for(let i=0;i<n;i++){
      const el = mkEl('div');
      el.className = 'hha-confetti';
      el.style.background = pick(colors);

      const r = rnd(-180, 180);
      el.style.setProperty('--r', `${r}deg`);

      const dx = rnd(-260, 260);
      const dy = rnd(120, 420);

      el.style.setProperty('--dx', `${dx}px`);
      el.style.setProperty('--dy', `${dy}px`);

      const x = baseX + rnd(-40, 40);
      const y = baseY + rnd(-30, 30);
      pos(el,x,y);

      // size variation
      const w = rnd(8, 12);
      const h = rnd(14, 22);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;

      layer.appendChild(el);
      ttlRemove(el, 1050);
    }
  }

  // expose both global names for backward compatibility
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.burstAt = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  // Also attach to GAME_MODULES for your older pattern
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);