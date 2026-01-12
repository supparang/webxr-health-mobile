// === /herohealth/vr/particles.js ===
// HeroHealth FX Layer — PRODUCTION (ULTRA, shared across all games)
// ✅ Single .hha-fx-layer overlay
// ✅ popText / burstAt / shockwave / comboBurst / celebrate / missX
// ✅ Safe: load-once + style-once
// ✅ No dependencies

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------------------------
  // helpers
  // ---------------------------
  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const rnd = (a,b)=> a + Math.random()*(b-a);
  const now = ()=> (typeof performance!=='undefined' ? performance.now() : Date.now());
  const px  = (n)=> `${Math.round(n)}px`;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0;
      pointer-events:none;
      z-index: 190;
      overflow:hidden;
      contain: layout style paint;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureStyle(){
    if (doc.getElementById('hhaParticlesStyle')) return;
    const st = doc.createElement('style');
    st.id = 'hhaParticlesStyle';
    st.textContent = `
      .hha-fx-layer .fx{
        position:absolute;
        left:0; top:0;
        transform: translate(-50%,-50%);
        will-change: transform, opacity, filter;
        pointer-events:none;
        user-select:none;
      }

      @keyframes hhaPopUp{
        0%{ transform: translate(-50%,-50%) scale(.88); opacity:.0; filter: blur(1px); }
        12%{ opacity:.98; filter: blur(0); }
        70%{ transform: translate(-50%,-76%) scale(1.18); opacity:1; }
        100%{ transform: translate(-50%,-98%) scale(1.02); opacity:0; }
      }

      @keyframes hhaBurst{
        0%{ transform: translate(-50%,-50%) scale(.6); opacity:.0; }
        12%{ opacity:.98; }
        100%{ transform: translate(-50%,-50%) scale(1.2); opacity:0; }
      }

      @keyframes hhaShard{
        0%{ transform: translate(-50%,-50%) translate3d(0,0,0) rotate(0deg) scale(1); opacity:1; }
        100%{ transform: translate(-50%,-50%) translate3d(var(--dx), var(--dy), 0) rotate(var(--dr)) scale(.75); opacity:0; }
      }

      @keyframes hhaRing{
        0%{ transform: translate(-50%,-50%) scale(.35); opacity:.0; }
        12%{ opacity:.85; }
        100%{ transform: translate(-50%,-50%) scale(1.25); opacity:0; }
      }

      @keyframes hhaConfetti{
        0%{ transform: translate(-50%,-50%) translate3d(0,0,0) rotate(0deg); opacity:1; }
        100%{ transform: translate(-50%,-50%) translate3d(var(--dx), var(--dy), 0) rotate(var(--dr)); opacity:0; }
      }

      @keyframes hhaX{
        0%{ transform: translate(-50%,-50%) scale(.7); opacity:0; }
        20%{ opacity:.95; }
        100%{ transform: translate(-50%,-50%) scale(1.12); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  }

  function add(el){
    const layer = ensureLayer();
    ensureStyle();
    layer.appendChild(el);
    return el;
  }

  function killSoon(el, ms){
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms);
  }

  function baseFxEl(x,y){
    const el = doc.createElement('div');
    el.className = 'fx';
    el.style.left = px(x);
    el.style.top  = px(y);
    return el;
  }

  // ---------------------------
  // API
  // ---------------------------

  // popText: score/+1/perfect etc.
  function popText(x,y,text,cls=''){
    const el = baseFxEl(x,y);
    el.textContent = String(text ?? '');
    el.style.cssText += `
      font: 1000 18px/1 system-ui;
      color:#fff;
      text-shadow: 0 10px 22px rgba(0,0,0,.55);
      opacity:.98;
      animation: hhaPopUp 520ms ease-out forwards;
    `;
    if(cls) el.className += ` ${cls}`;
    add(el);
    killSoon(el, 620);
  }

  // burstAt: little spark burst (good hit)
  function burstAt(x,y,emoji='✨', count=8, spread=46, dur=520){
    count = clamp(Number(count)||8, 4, 18);
    spread= clamp(Number(spread)||46, 18, 88);
    dur   = clamp(Number(dur)||520, 260, 900);

    // center puff
    const puff = baseFxEl(x,y);
    puff.textContent = emoji;
    puff.style.cssText += `
      font: 1000 20px/1 system-ui;
      opacity:.0;
      animation: hhaBurst ${dur}ms ease-out forwards;
      filter: drop-shadow(0 12px 22px rgba(0,0,0,.45));
    `;
    add(puff);
    killSoon(puff, dur + 80);

    for(let i=0;i<count;i++){
      const a = (Math.PI*2) * (i/count) + rnd(-0.25,0.25);
      const r = rnd(spread*0.55, spread*1.05);
      const dx = Math.cos(a)*r;
      const dy = Math.sin(a)*r + rnd(-6,6);
      const shard = baseFxEl(x,y);
      shard.textContent = (Math.random() < 0.35) ? '•' : emoji;
      shard.style.cssText += `
        font: 900 16px/1 system-ui;
        color:#fff;
        opacity:1;
        text-shadow: 0 10px 22px rgba(0,0,0,.45);
        --dx:${px(dx)};
        --dy:${px(dy)};
        --dr:${Math.round(rnd(-180,180))}deg;
        animation: hhaShard ${dur}ms cubic-bezier(.1,.7,.1,1) forwards;
      `;
      add(shard);
      killSoon(shard, dur + 120);
    }
  }

  // shockwave ring (boss hit / perfect / phase change)
  function shockwave(x,y, size=220, dur=520){
    size = clamp(Number(size)||220, 120, 520);
    dur  = clamp(Number(dur)||520, 260, 900);

    const ring = baseFxEl(x,y);
    ring.textContent = '';
    ring.style.width  = px(size);
    ring.style.height = px(size);
    ring.style.borderRadius = '999px';
    ring.style.border = '3px solid rgba(255,255,255,.35)';
    ring.style.boxShadow = '0 0 28px rgba(34,211,238,.16)';
    ring.style.opacity = '0';
    ring.style.animation = `hhaRing ${dur}ms ease-out forwards`;
    add(ring);
    killSoon(ring, dur + 90);
  }

  // comboBurst: emphasize combos (quick)
  function comboBurst(x,y, text='COMBO!', dur=420){
    dur = clamp(Number(dur)||420, 220, 800);
    popText(x,y,text,'fx-combo');
    shockwave(x,y, 200, dur);
  }

  // missX: red X / fail (junk hit, miss limit)
  function missX(x,y, text='✖', dur=520){
    dur = clamp(Number(dur)||520, 260, 900);
    const el = baseFxEl(x,y);
    el.textContent = text;
    el.style.cssText += `
      font: 1300 30px/1 system-ui;
      color: rgba(239,68,68,.98);
      text-shadow: 0 14px 26px rgba(0,0,0,.55);
      opacity:0;
      animation: hhaX ${dur}ms ease-out forwards;
    `;
    add(el);
    killSoon(el, dur + 90);
  }

  // celebrate: confetti rain (end / goal complete)
  function celebrate(opts={}){
    const layer = ensureLayer();
    ensureStyle();

    const w = root.innerWidth  || 800;
    const h = root.innerHeight || 600;

    const n = clamp(Number(opts.count)||28, 12, 64);
    const dur = clamp(Number(opts.dur)||900, 520, 1800);

    const emojis = Array.isArray(opts.emojis) && opts.emojis.length
      ? opts.emojis
      : ['🎉','✨','⭐','💎','🌈'];

    for(let i=0;i<n;i++){
      const x = rnd(0.12*w, 0.88*w);
      const y = rnd(0.10*h, 0.30*h);
      const dx = rnd(-0.45*w, 0.45*w);
      const dy = rnd(0.55*h, 0.95*h);
      const e = emojis[(Math.random()*emojis.length)|0];

      const conf = baseFxEl(x,y);
      conf.textContent = e;
      conf.style.cssText += `
        font: 1000 ${Math.round(rnd(16,26))}px/1 system-ui;
        opacity:1;
        filter: drop-shadow(0 10px 22px rgba(0,0,0,.40));
        --dx:${px(dx)};
        --dy:${px(dy)};
        --dr:${Math.round(rnd(-540,540))}deg;
        animation: hhaConfetti ${dur}ms cubic-bezier(.1,.7,.1,1) forwards;
      `;
      layer.appendChild(conf);
      killSoon(conf, dur + 160);
    }
  }

  // ---------------------------
  // Export
  // ---------------------------
  root.Particles = root.Particles || {};
  root.Particles.popText   = popText;
  root.Particles.burstAt   = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.comboBurst= comboBurst;
  root.Particles.missX     = missX;
  root.Particles.celebrate = celebrate;

  // tiny debug hook
  root.Particles.__ts = now();
})(window);