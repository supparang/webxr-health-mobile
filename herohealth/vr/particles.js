// === /herohealth/vr/particles.js ===
// HeroHealth FX Layer — FAIR / PRODUCTION
// ✅ window.Particles + window.GAME_MODULES.Particles
// ✅ popText(x,y,text,cls,opts)
// ✅ burstAt(x,y,kind,opts)
// ✅ ringPulse(x,y,kind,opts)
// ✅ celebrate(kind,opts)
// Notes:
// - Never blocks pointer events (layer pointer-events:none)
// - High z-index but below vr-ui controls if any (controls use z>=200)

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const MODS = root.GAME_MODULES = root.GAME_MODULES || {};
  if (MODS.Particles) return;

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none;
      z-index:140;
      overflow:hidden;
    `;
    DOC.body.appendChild(layer);
    return layer;
  }

  function makeEl(tag, cssText){
    const el = DOC.createElement(tag);
    if (cssText) el.style.cssText = cssText;
    return el;
  }

  function kindStyle(kind){
    // ไม่ fix สีแบบตายตัว (ให้ดูเข้ม/ชัด แต่เรียบ)
    // ใช้ filter + shadow แทนสีหลัก
    const k = String(kind||'').toLowerCase();
    if (k==='good')   return { glow:'0 10px 28px rgba(34,197,94,.22)',  ring:'rgba(34,197,94,.28)' };
    if (k==='bad')    return { glow:'0 10px 28px rgba(251,113,133,.22)', ring:'rgba(251,113,133,.28)' };
    if (k==='star')   return { glow:'0 10px 28px rgba(245,158,11,.22)',  ring:'rgba(245,158,11,.28)' };
    if (k==='shield') return { glow:'0 10px 28px rgba(34,211,238,.20)',  ring:'rgba(34,211,238,.26)' };
    if (k==='violet' || k==='diamond')
                   return { glow:'0 10px 28px rgba(167,139,250,.22)', ring:'rgba(167,139,250,.26)' };
    return { glow:'0 10px 28px rgba(255,255,255,.12)', ring:'rgba(255,255,255,.18)' };
  }

  function popText(x,y,text,cls=null,opts=null){
    const layer = ensureLayer();
    const o = opts || {};
    const size = clamp(o.size || 18, 12, 42);

    const el = makeEl('div');
    el.textContent = String(text ?? '');
    el.className = 'hha-fx-pop';
    el.style.cssText = `
      position:absolute;
      left:${Math.floor(x)}px; top:${Math.floor(y)}px;
      transform: translate(-50%,-50%);
      font: 1000 ${size}px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      letter-spacing: .01em;
      color:#fff;
      text-shadow: 0 10px 28px rgba(0,0,0,.45), 0 2px 0 rgba(0,0,0,.25);
      opacity: 0;
      will-change: transform, opacity;
    `;

    // class flavor (ไม่บังคับสีจัด)
    if (cls){
      const c = String(cls).toLowerCase();
      if (c==='bad') el.style.textShadow = `0 10px 28px rgba(251,113,133,.25), 0 2px 0 rgba(0,0,0,.25)`;
      if (c==='warn') el.style.textShadow = `0 10px 28px rgba(245,158,11,.25), 0 2px 0 rgba(0,0,0,.25)`;
      if (c==='good') el.style.textShadow = `0 10px 28px rgba(34,197,94,.25), 0 2px 0 rgba(0,0,0,.25)`;
      if (c==='cyan') el.style.textShadow = `0 10px 28px rgba(34,211,238,.22), 0 2px 0 rgba(0,0,0,.25)`;
      if (c==='violet') el.style.textShadow = `0 10px 28px rgba(167,139,250,.22), 0 2px 0 rgba(0,0,0,.25)`;
    }

    layer.appendChild(el);

    // animate
    requestAnimationFrame(()=>{
      el.style.transition = 'transform .46s ease, opacity .10s ease';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-70%)';
      setTimeout(()=>{
        el.style.transition = 'transform .26s ease, opacity .22s ease';
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-95%)';
        setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 260);
      }, 380);
    });
  }

  function ringPulse(x,y,kind='good',opts=null){
    const layer = ensureLayer();
    const o = opts || {};
    const size = clamp(o.size || 180, 90, 520);
    const st = kindStyle(kind);

    const ring = makeEl('div');
    ring.className = 'hha-fx-ring';
    ring.style.cssText = `
      position:absolute;
      left:${Math.floor(x)}px; top:${Math.floor(y)}px;
      width:${Math.floor(size)}px; height:${Math.floor(size)}px;
      transform: translate(-50%,-50%) scale(.78);
      border-radius: 999px;
      border: 3px solid ${st.ring};
      box-shadow: ${st.glow};
      opacity: .0;
      will-change: transform, opacity;
    `;
    layer.appendChild(ring);

    requestAnimationFrame(()=>{
      ring.style.transition = 'transform .38s ease, opacity .10s ease';
      ring.style.opacity = '1';
      ring.style.transform = 'translate(-50%,-50%) scale(1.0)';
      setTimeout(()=>{
        ring.style.transition = 'transform .24s ease, opacity .18s ease';
        ring.style.opacity = '0';
        ring.style.transform = 'translate(-50%,-50%) scale(1.12)';
        setTimeout(()=>{ try{ ring.remove(); }catch(_){} }, 220);
      }, 250);
    });
  }

  function burstAt(x,y,kind='good',opts=null){
    const layer = ensureLayer();
    const o = opts || {};
    const count = clamp(o.count || 10, 6, 22);
    const spread = clamp(o.spread || 64, 34, 140);
    const size = clamp(o.size || 8, 4, 14);
    const st = kindStyle(kind);

    for(let i=0;i<count;i++){
      const p = makeEl('div');
      p.className = 'hha-fx-p';
      const a = (Math.PI*2) * (i / count) + (Math.random()*0.35);
      const r = spread * (0.55 + Math.random()*0.55);
      const dx = Math.cos(a)*r;
      const dy = Math.sin(a)*r;

      p.style.cssText = `
        position:absolute;
        left:${Math.floor(x)}px; top:${Math.floor(y)}px;
        width:${Math.floor(size)}px; height:${Math.floor(size)}px;
        transform: translate(-50%,-50%);
        border-radius: 999px;
        background: rgba(255,255,255,.92);
        box-shadow: ${st.glow};
        opacity: 0;
        will-change: transform, opacity;
      `;
      layer.appendChild(p);

      requestAnimationFrame(()=>{
        p.style.transition = 'transform .42s ease, opacity .10s ease';
        p.style.opacity = '1';
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        setTimeout(()=>{
          p.style.transition = 'transform .20s ease, opacity .22s ease';
          p.style.opacity = '0';
          p.style.transform = `translate(calc(-50% + ${dx*1.08}px), calc(-50% + ${dy*1.08}px))`;
          setTimeout(()=>{ try{ p.remove(); }catch(_){} }, 220);
        }, 280);
      });
    }
  }

  function celebrate(kind='win', opts=null){
    const layer = ensureLayer();
    const o = opts || {};
    const count = clamp(o.count || 18, 10, 60);

    const W = DOC.documentElement.clientWidth || innerWidth || 360;
    const H = DOC.documentElement.clientHeight || innerHeight || 640;

    for(let i=0;i<count;i++){
      const p = makeEl('div');
      const x = Math.floor(Math.random() * W);
      const y = Math.floor(Math.random() * (H*0.30)) + Math.floor(H*0.08);
      const size = clamp(8 + Math.random()*10, 8, 20);
      const fall = clamp(320 + Math.random()*520, 320, 900);
      const rot = (Math.random()*240 - 120);

      p.style.cssText = `
        position:absolute;
        left:${x}px; top:${y}px;
        width:${Math.floor(size)}px; height:${Math.floor(size)}px;
        transform: translate(-50%,-50%) rotate(0deg);
        border-radius: 6px;
        background: rgba(255,255,255,.92);
        opacity: 0;
        will-change: transform, opacity;
      `;
      layer.appendChild(p);

      requestAnimationFrame(()=>{
        p.style.transition = 'transform .95s ease, opacity .10s ease';
        p.style.opacity = '1';
        p.style.transform = `translate(-50%, ${fall}px) rotate(${rot}deg)`;
        setTimeout(()=>{
          p.style.transition = 'opacity .35s ease';
          p.style.opacity = '0';
          setTimeout(()=>{ try{ p.remove(); }catch(_){} }, 360);
        }, 820);
      });
    }
  }

  const API = { popText, burstAt, ringPulse, celebrate };

  MODS.Particles = API;
  root.Particles = API;

})(typeof window !== 'undefined' ? window : globalThis);