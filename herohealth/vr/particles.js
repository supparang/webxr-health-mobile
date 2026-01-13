// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (ULTRA, SAFE)
// ✅ Provides: window.Particles + window.GAME_MODULES.Particles
// ✅ Methods:
//   - popText(x,y,text,cls?)
//   - scorePop(x,y,text,cls?)
//   - burstAt(x,y,kind='good', opts?)
//   - shockwave(x,y,opts?)
//   - celebrate(opts?)  // confetti-like
// ✅ No dependencies. Works across all games.
//
// Recommended load order (HTML):
// <script src="./vr/particles.js" defer></script>
// <script src="./vr/hha-fx-director.js" defer></script>

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------------- utils ----------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const rnd = (a,b)=> a + Math.random()*(b-a);
  const now = ()=> (root.performance ? performance.now() : Date.now());

  function ensureStyle(){
    if(doc.getElementById('hhaParticlesStyle')) return;
    const st = doc.createElement('style');
    st.id = 'hhaParticlesStyle';
    st.textContent = `
      .hha-fx-layer{
        position:fixed; inset:0; pointer-events:none; z-index: 9997;
        overflow:hidden;
      }

      /* score pop */
      @keyframes hhaPopUp {
        0%{ transform:translate(-50%,-50%) scale(.88); opacity:.0; filter: blur(.2px); }
        14%{ opacity:.98; }
        70%{ transform:translate(-50%,-78%) scale(1.22); opacity:1; }
        100%{ transform:translate(-50%,-105%) scale(1.06); opacity:0; }
      }

      /* small shards burst */
      @keyframes hhaShard {
        0%{ transform: translate(-50%,-50%) scale(.9); opacity:1; }
        100%{ transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.6); opacity:0; }
      }

      /* shockwave ring */
      @keyframes hhaRing {
        0%{ transform:translate(-50%,-50%) scale(.25); opacity:.0; }
        20%{ opacity:.85; }
        100%{ transform:translate(-50%,-50%) scale(1.25); opacity:0; }
      }

      /* confetti */
      @keyframes hhaConfetti {
        0%{ transform: translate3d(0,0,0) rotate(0deg); opacity:1; }
        100%{ transform: translate3d(var(--dx), var(--dy), 0) rotate(var(--rot)); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  }

  function ensureLayer(){
    ensureStyle();
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    doc.body.appendChild(layer);
    return layer;
  }

  function safeRemove(el, ms){
    setTimeout(()=>{ try{ el && el.remove(); }catch(_){ } }, ms);
  }

  // ---------------- palette ----------------
  function kindColor(kind){
    switch(String(kind||'').toLowerCase()){
      case 'good': return 'rgba(34,197,94,.95)';
      case 'bad': return 'rgba(239,68,68,.95)';
      case 'star': return 'rgba(245,158,11,.95)';
      case 'shield': return 'rgba(34,211,238,.95)';
      case 'diamond': return 'rgba(167,139,250,.95)';
      case 'block': return 'rgba(99,102,241,.95)';
      default: return 'rgba(226,232,240,.95)';
    }
  }
  function kindGlow(kind){
    switch(String(kind||'').toLowerCase()){
      case 'good': return 'rgba(34,197,94,.35)';
      case 'bad': return 'rgba(239,68,68,.35)';
      case 'star': return 'rgba(245,158,11,.35)';
      case 'shield': return 'rgba(34,211,238,.35)';
      case 'diamond': return 'rgba(167,139,250,.35)';
      case 'block': return 'rgba(99,102,241,.35)';
      default: return 'rgba(148,163,184,.30)';
    }
  }

  // ---------------- primitives ----------------
  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.textContent = String(text ?? '');
    const size = (cls === 'big') ? 26 : 18;
    const w = Math.min(720, doc.documentElement.clientWidth || 720);

    el.style.cssText = `
      position:absolute;
      left:${Math.round(x)}px; top:${Math.round(y)}px;
      transform: translate(-50%,-50%);
      font: 900 ${size}px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
      color:#fff;
      text-shadow: 0 10px 28px rgba(0,0,0,.55);
      letter-spacing: .5px;
      max-width:${w}px;
      padding: 2px 6px;
      border-radius: 10px;
      opacity:.0;
      will-change: transform, opacity;
      animation: hhaPopUp 560ms ease-out forwards;
      z-index: 2;
    `;
    layer.appendChild(el);
    safeRemove(el, 700);
  }

  function scorePop(x,y,text,cls){
    // cls could be: 'good','bad','star','shield','diamond','block'
    const layer = ensureLayer();
    const kind = String(cls||'').toLowerCase();
    const el = doc.createElement('div');
    el.textContent = String(text ?? '');
    const col = kindColor(kind);
    const glow = kindGlow(kind);

    el.style.cssText = `
      position:absolute;
      left:${Math.round(x)}px; top:${Math.round(y)}px;
      transform: translate(-50%,-50%);
      font: 1000 20px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
      color:#fff;
      background: linear-gradient(180deg, rgba(2,6,23,.22), rgba(2,6,23,.10));
      border: 1px solid rgba(148,163,184,.20);
      border-radius: 999px;
      padding: 6px 10px;
      box-shadow: 0 16px 42px rgba(0,0,0,.35), 0 0 0 8px ${glow};
      text-shadow: 0 10px 26px rgba(0,0,0,.55);
      opacity:.0;
      will-change: transform, opacity;
      animation: hhaPopUp 620ms ease-out forwards;
      z-index: 3;
    `;
    // small accent dot
    const dot = doc.createElement('span');
    dot.style.cssText = `
      display:inline-block;
      width:10px; height:10px;
      border-radius:50%;
      margin-right:8px;
      background:${col};
      box-shadow: 0 0 18px ${glow};
      vertical-align:middle;
    `;
    el.prepend(dot);

    layer.appendChild(el);
    safeRemove(el, 780);
  }

  function burstAt(x,y,kind,opts){
    const layer = ensureLayer();
    const k = String(kind||'good').toLowerCase();
    const col = kindColor(k);
    const glow = kindGlow(k);

    const count = clamp(Number(opts?.count ?? 12), 6, 26);
    const power = clamp(Number(opts?.power ?? 86), 40, 140);
    const sizeMin = clamp(Number(opts?.sizeMin ?? 6), 3, 14);
    const sizeMax = clamp(Number(opts?.sizeMax ?? 12), 6, 22);
    const dur = clamp(Number(opts?.dur ?? 520), 320, 900);

    for(let i=0;i<count;i++){
      const shard = doc.createElement('div');

      const ang = rnd(0, Math.PI*2);
      const dist = rnd(power*0.55, power);
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist;
      const s = rnd(sizeMin, sizeMax);

      shard.style.cssText = `
        position:absolute;
        left:${Math.round(x)}px; top:${Math.round(y)}px;
        width:${Math.round(s)}px; height:${Math.round(s)}px;
        border-radius:${rnd(3, 999)}px;
        background:${col};
        box-shadow: 0 10px 26px rgba(0,0,0,.25), 0 0 0 6px ${glow};
        transform: translate(-50%,-50%);
        opacity:1;
        will-change: transform, opacity;
        --dx:${dx.toFixed(1)}px;
        --dy:${dy.toFixed(1)}px;
        animation: hhaShard ${dur}ms cubic-bezier(.15,.85,.22,1) forwards;
        z-index: 1;
      `;

      layer.appendChild(shard);
      safeRemove(shard, dur + 40);
    }
  }

  function shockwave(x,y,opts){
    const layer = ensureLayer();
    const r = clamp(Number(opts?.r ?? 64), 30, 140);
    const kind = String(opts?.kind || 'good').toLowerCase();
    const col = kindColor(kind);
    const glow = kindGlow(kind);
    const dur = clamp(Number(opts?.dur ?? 520), 360, 900);

    const ring = doc.createElement('div');
    ring.style.cssText = `
      position:absolute;
      left:${Math.round(x)}px; top:${Math.round(y)}px;
      width:${Math.round(r)}px; height:${Math.round(r)}px;
      border-radius:999px;
      border: 2px solid ${col};
      box-shadow: 0 0 24px ${glow};
      transform: translate(-50%,-50%) scale(.25);
      opacity:.0;
      will-change: transform, opacity;
      animation: hhaRing ${dur}ms ease-out forwards;
      z-index: 0;
    `;
    layer.appendChild(ring);
    safeRemove(ring, dur + 50);
  }

  function celebrate(opts){
    // confetti-like: spawn from top center / center
    const layer = ensureLayer();
    const W = doc.documentElement.clientWidth || 800;
    const H = doc.documentElement.clientHeight || 600;
    const n = clamp(Number(opts?.count ?? 36), 18, 90);
    const cx = Number.isFinite(opts?.x) ? opts.x : (W/2);
    const cy = Number.isFinite(opts?.y) ? opts.y : (H*0.28);

    for(let i=0;i<n;i++){
      const c = doc.createElement('div');
      const kind = ['good','star','shield','diamond'][Math.floor(Math.random()*4)];
      const col = kindColor(kind);
      const glow = kindGlow(kind);
      const s = rnd(6, 12);

      const dx = rnd(-W*0.40, W*0.40);
      const dy = rnd(H*0.25, H*0.70);
      const rot = `${rnd(-220, 220)}deg`;
      const dur = rnd(680, 1100);

      c.style.cssText = `
        position:absolute;
        left:${Math.round(cx)}px; top:${Math.round(cy)}px;
        width:${Math.round(s)}px; height:${Math.round(s*1.4)}px;
        border-radius:${rnd(2, 10)}px;
        background:${col};
        box-shadow: 0 10px 28px rgba(0,0,0,.25), 0 0 18px ${glow};
        opacity:1;
        transform: translate3d(0,0,0) rotate(0deg);
        will-change: transform, opacity;
        --dx:${dx.toFixed(1)}px;
        --dy:${dy.toFixed(1)}px;
        --rot:${rot};
        animation: hhaConfetti ${dur}ms cubic-bezier(.12,.86,.25,1) forwards;
      `;
      layer.appendChild(c);
      safeRemove(c, dur + 60);
    }
  }

  // ---------------- export ----------------
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

  // dev probe
  root.HHA_PARTICLES_TEST = function(){
    const W = doc.documentElement.clientWidth || 800;
    const H = doc.documentElement.clientHeight || 600;
    const x = W/2, y = H/2;
    burstAt(x,y,'good');
    shockwave(x,y,{kind:'good', r:82});
    scorePop(x,y-10,'+25','good');
    setTimeout(()=>burstAt(x-90,y+40,'bad'), 260);
    setTimeout(()=>scorePop(x-90,y+40,'-','bad'), 260);
    setTimeout(()=>celebrate({x, y:H*0.25, count:48}), 520);
  };

})(window);