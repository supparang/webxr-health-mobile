// === /herohealth/vr-groups/groups-fx.js ===
// Food Groups VR — FX Layer (IIFE) — PRODUCTION
// ✅ lock ring (groups:lock {on,x,y,prog,charge})
// ✅ group banner (groups:group_change)
// ✅ stun overlay (groups:stun)
// ✅ panic last 10s (hha:time)
// ✅ celebrate (hha:celebrate {kind,text})
// ✅ judge (hha:judge {text,kind})
// ✅ afterimage + tiny burst on hit (lightweight)
// ✅ NEVER create bottom quest panel; remove if exists

(function () {
  'use strict';

  const doc = document;
  const W = window;
  if (!doc) return;

  const NS = (W.GroupsFX = W.GroupsFX || {});
  if (NS.__bound) return;
  NS.__bound = true;

  // ---------- helpers ----------
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function $(sel) { return doc.querySelector(sel); }
  function byId(id) { return doc.getElementById(id); }

  function removeBottomPanelIfAny(){
    const p = byId('fg-questPanel');
    if (p && p.parentNode) { try{ p.parentNode.removeChild(p); }catch(_){ } }
  }

  function makeEl(tag, cls, css){
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (css) Object.assign(el.style, css);
    return el;
  }

  // safe-area read (fallback 0)
  function safeInset(name){
    try{
      const cs = getComputedStyle(doc.documentElement);
      return parseFloat(cs.getPropertyValue(name)) || 0;
    }catch(_){ return 0; }
  }

  // ---------- ensure FX DOM ----------
  function ensureLockRing(){
    let ring = $('.lock-ring');
    if (ring) return ring;

    ring = makeEl('div','lock-ring');
    ring.style.display = 'none';

    const core = makeEl('div','lock-core');
    const prog = makeEl('div','lock-prog');
    const chg  = makeEl('div','lock-charge');

    ring.appendChild(core);
    ring.appendChild(prog);
    ring.appendChild(chg);

    doc.body.appendChild(ring);
    return ring;
  }

  function ensureGroupBanner(){
    let b = $('.group-banner');
    if (b) return b;

    b = makeEl('div','group-banner');
    b.style.display = 'none';
    b.innerHTML = `
      <div class="group-banner-text" id="fg-bannerText">หมู่ ?</div>
      <div class="group-banner-sub"  id="fg-bannerSub">ยิงให้ถูกหมู่ปัจจุบัน 🎯</div>
    `;
    doc.body.appendChild(b);
    return b;
  }

  function ensureStunOverlay(){
    let o = $('.stun-overlay');
    if (o) return o;

    o = makeEl('div','stun-overlay');
    o.style.display = 'none';
    o.innerHTML = `
      <div class="stun-card">
        <div class="stun-title">STUN!</div>
        <div class="stun-sub" id="fg-stunSub">โดนขยะ 🚫 พักแป๊บ</div>
      </div>
    `;
    doc.body.appendChild(o);
    return o;
  }

  function ensureToastLayer(){
    let layer = $('.fg-toast-layer');
    if (layer) return layer;

    layer = makeEl('div','fg-toast-layer', {
      position:'fixed',
      left:'0', top:'0', right:'0', bottom:'0',
      pointerEvents:'none',
      zIndex: 25
    });
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureFxLayer(){
    // for bursts/afterimage
    let layer = $('.fg-fx-layer');
    if (layer) return layer;

    layer = makeEl('div','fg-fx-layer', {
      position:'fixed',
      left:'0', top:'0', right:'0', bottom:'0',
      pointerEvents:'none',
      zIndex: 9
    });
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- toast (celebrate/judge) ----------
  function toast(text, kind){
    const layer = ensureToastLayer();
    const sat = safeInset('--sat');

    const card = makeEl('div','fg-toast', {
      position:'fixed',
      left:'50%',
      top: `calc(${(78 + sat)}px)`,
      transform:'translateX(-50%)',
      background:'rgba(2,6,23,.78)',
      border:'1px solid rgba(148,163,184,.20)',
      borderRadius:'18px',
      padding:'10px 14px',
      color:'#e5e7eb',
      fontWeight:'900',
      letterSpacing:'.4px',
      boxShadow:'0 18px 60px rgba(0,0,0,.45)',
      backdropFilter:'blur(10px)',
      WebkitBackdropFilter:'blur(10px)',
      opacity:'0',
      zIndex: 26
    });

    // tint
    const k = String(kind||'').toLowerCase();
    if (k === 'warn' || k === 'bad') {
      card.style.borderColor = 'rgba(239,68,68,.22)';
      card.style.boxShadow   = '0 18px 60px rgba(0,0,0,.45), 0 0 0 1px rgba(239,68,68,.10)';
    } else if (k === 'mini') {
      card.style.borderColor = 'rgba(167,139,250,.22)';
    } else if (k === 'goal') {
      card.style.borderColor = 'rgba(34,197,94,.22)';
    } else {
      card.style.borderColor = 'rgba(34,211,238,.20)';
    }

    card.textContent = String(text || '');
    layer.appendChild(card);

    // animate
    card.animate([
      { transform:'translateX(-50%) translateY(-6px) scale(.98)', opacity:0 },
      { transform:'translateX(-50%) translateY(0) scale(1)', opacity:1, offset:0.18 },
      { transform:'translateX(-50%) translateY(0) scale(1)', opacity:1, offset:0.75 },
      { transform:'translateX(-50%) translateY(-6px) scale(.99)', opacity:0 }
    ], { duration: 1200, easing:'cubic-bezier(.2,.9,.2,1)' });

    setTimeout(()=>{ try{ card.remove(); }catch(_){ } }, 1250);
  }

  // ---------- afterimage + burst ----------
  function afterimageAt(x, y, emoji){
    const layer = ensureFxLayer();
    const el = makeEl('div','fg-afterimage a1');
    el.style.setProperty('--x', Math.round(x) + 'px');
    el.style.setProperty('--y', Math.round(y) + 'px');

    const inner = makeEl('div','fg-afterimage-inner');
    inner.textContent = emoji || '✨';
    el.appendChild(inner);

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 220);

    // second trail
    const el2 = makeEl('div','fg-afterimage a2');
    el2.style.setProperty('--x', Math.round(x) + 'px');
    el2.style.setProperty('--y', Math.round(y) + 'px');
    const inner2 = makeEl('div','fg-afterimage-inner');
    inner2.textContent = emoji || '✨';
    inner2.style.opacity = '.65';
    el2.appendChild(inner2);
    layer.appendChild(el2);
    setTimeout(()=>{ try{ el2.remove(); }catch(_){ } }, 260);
  }

  function burstAt(x, y, kind){
    const layer = ensureFxLayer();

    const n = 8;
    const k = String(kind||'').toLowerCase();
    const sym = (k === 'goal') ? '🎉' :
                (k === 'mini') ? '✨' :
                (k === 'warn') ? '⚠️' : '💥';

    for (let i=0;i<n;i++){
      const p = makeEl('div','fg-burst', {
        position:'fixed',
        left: Math.round(x) + 'px',
        top:  Math.round(y) + 'px',
        transform:'translate(-50%,-50%)',
        fontSize: (22 + (Math.random()*16)) + 'px',
        opacity:'0',
        zIndex: 10
      });
      p.textContent = sym;
      layer.appendChild(p);

      const ang = Math.random()*Math.PI*2;
      const dist = 24 + Math.random()*44;
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist;

      p.animate([
        { transform:`translate(-50%,-50%) translate(${dx*0.25}px,${dy*0.25}px) scale(.9)`, opacity:0 },
        { transform:`translate(-50%,-50%) translate(${dx*0.65}px,${dy*0.65}px) scale(1.05)`, opacity:0.9, offset:0.22 },
        { transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.95)`, opacity:0 }
      ], { duration: 420 + Math.random()*260, easing:'cubic-bezier(.2,.9,.2,1)' });

      setTimeout(()=>{ try{ p.remove(); }catch(_){ } }, 800);
    }
  }

  // ---------- lock ring driver ----------
  const lockRing = ensureLockRing();
  function setLock(on, x, y, prog, charge){
    if (!on){
      lockRing.style.display = 'none';
      return;
    }

    // position on target center
    lockRing.style.display = '';
    lockRing.style.left = Math.round(x) + 'px';
    lockRing.style.top  = Math.round(y) + 'px';
    lockRing.style.transform = 'translate(-50%,-50%)';

    // css vars for conic gradients
    lockRing.style.setProperty('--p', String(clamp(prog,0,1)));
    lockRing.style.setProperty('--c', String(clamp(charge,0,1)));
  }

  // ---------- group banner ----------
  const banner = ensureGroupBanner();
  let bannerTimer = 0;

  function showBanner(label){
    const t = byId('fg-bannerText');
    if (t) t.textContent = label || 'หมู่ ?';

    const sub = byId('fg-bannerSub');
    if (sub) sub.textContent = 'ยิงให้ถูกหมู่ปัจจุบัน 🎯';

    // avoid HUD overlap: push below HUD based on .hud-top bottom
    try{
      const hud = $('.hud-top');
      if (hud){
        const r = hud.getBoundingClientRect();
        const sat = safeInset('--sat');
        const top = Math.max(96 + sat, Math.round(r.bottom + 10));
        banner.style.top = top + 'px';
      }
    }catch(_){}

    banner.style.display = '';
    banner.classList.remove('pop');
    // restart animation
    void banner.offsetWidth;
    banner.classList.add('pop');

    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(()=>{ banner.style.display='none'; }, 1100);
  }

  // ---------- stun overlay ----------
  const stun = ensureStunOverlay();
  let stunTimer = 0;

  function showStun(ms){
    stun.style.display = '';
    stun.classList.remove('pop');
    void stun.offsetWidth;
    stun.classList.add('pop');

    // hide after ms
    clearTimeout(stunTimer);
    stunTimer = setTimeout(()=>{ stun.style.display='none'; }, Math.max(120, ms|0));
  }

  // ---------- panic ----------
  let panicOn = false;
  function setPanic(on){
    on = !!on;
    if (on === panicOn) return;
    panicOn = on;
    doc.documentElement.classList.toggle('panic', panicOn);
  }

  // ---------- bind events ----------
  removeBottomPanelIfAny();

  W.addEventListener('groups:lock', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    setLock(!!d.on, d.x||0, d.y||0, d.prog||0, d.charge||0);
  }, { passive:true });

  W.addEventListener('groups:group_change', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    showBanner(d.label || 'หมู่ ?');
  }, { passive:true });

  W.addEventListener('groups:stun', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const ms = (d.ms|0) || 800;
    showStun(ms);

    // slight shake (safe)
    try{
      if (navigator.vibrate) navigator.vibrate([40,40,40]);
    }catch(_){}
  }, { passive:true });

  W.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const left = (d.left|0);
    // panic when <= 10s
    setPanic(left > 0 && left <= 10);
  }, { passive:true });

  W.addEventListener('hha:celebrate', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind || 'ok');
    const text = d.text || (kind === 'goal' ? 'GOAL CLEAR!' : 'NICE!');
    toast(text, kind);

    // burst near center-top (avoid HUD)
    const sat = safeInset('--sat');
    const x = (innerWidth||360)/2;
    const y = Math.max(120 + sat, 0.30*(innerHeight||640));
    burstAt(x, y, kind);
  }, { passive:true });

  W.addEventListener('hha:judge', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const text = d.text || 'OK';
    const kind = d.kind || 'warn';
    toast(text, kind);
  }, { passive:true });

  // If you want a tiny hit FX without touching engine:
  // capture clicks on targets at capture phase (doesn't block engine)
  doc.addEventListener('pointerdown', (ev)=>{
    const t = ev.target;
    if (!t || !t.classList) return;
    if (!t.classList.contains('fg-target')) return;

    const r = t.getBoundingClientRect();
    const x = r.left + r.width/2;
    const y = r.top  + r.height/2;

    // emoji for trail (first child span)
    let emoji = '✨';
    try{
      const sp = t.querySelector('span');
      if (sp && sp.textContent) emoji = sp.textContent.trim() || emoji;
    }catch(_){}

    afterimageAt(x, y, emoji);
  }, { passive:true, capture:true });

})();