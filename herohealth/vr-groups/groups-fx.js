// === /herohealth/vr-groups/groups-fx.js ===
// Food Groups VR — FX + Overlays (classic script) — PRODUCTION
// ✅ ensure: lock ring, group banner, stun overlay, fx layer
// ✅ listen: groups:lock, groups:panic, groups:stun, groups:group_change, groups:power
// ✅ listen: hha:celebrate, hha:judge
// ✅ panic tick sound via WebAudio (no assets)
// ✅ lock ring uses CSS vars --p (progress) and --c (charge)

(function () {
  'use strict';

  const doc = document;
  if (!doc) return;

  const W = window;
  const NS = (W.GroupsFX = W.GroupsFX || {});
  if (NS.__bound) return;
  NS.__bound = true;

  // ---------------- helpers ----------------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function $(sel){ return doc.querySelector(sel); }
  function byId(id){ return doc.getElementById(id); }

  function ensureEl(id, tag, cls, parent){
    let el = byId(id);
    if (el) return el;
    el = doc.createElement(tag || 'div');
    if (id) el.id = id;
    if (cls) el.className = cls;
    (parent || doc.body).appendChild(el);
    return el;
  }

  function setStyle(el, obj){
    if (!el) return;
    try{ Object.assign(el.style, obj); }catch(_){}
  }

  // ---------------- ensure base layers ----------------
  function ensureFXLayer(){
    let layer = $('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    setStyle(layer, {
      position:'fixed', inset:'0',
      zIndex: 40,
      pointerEvents:'none',
      overflow:'hidden'
    });
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureGroupBanner(){
    // Prefer CSS class .group-banner defined in groups-vr.css
    const el = ensureEl('fgGroupBanner', 'div', 'group-banner', doc.body);
    if (!el.querySelector('.group-banner-text')){
      el.innerHTML = `
        <div class="group-banner-text" id="fgGroupBannerText">หมู่ ?</div>
        <div class="group-banner-sub" id="fgGroupBannerSub">ยิงให้ถูกหมู่ปัจจุบัน 🎯</div>
      `;
    }
    // hidden initially
    if (!el.dataset.ready){
      el.dataset.ready = '1';
      setStyle(el, { opacity:'0', transform:'translateX(-50%) translateY(-10px) scale(.96)' });
      // let CSS animation handle when .pop added
    }
    return el;
  }

  function ensureLockRing(){
    const ring = ensureEl('fgLockRing', 'div', 'lock-ring', doc.body);
    if (!ring.querySelector('.lock-core')){
      ring.innerHTML = `
        <div class="lock-core"></div>
        <div class="lock-prog" id="fgLockProg"></div>
        <div class="lock-charge" id="fgLockCharge"></div>
      `;
    }
    // hide until active
    setStyle(ring, { opacity:'0', transform:'translate(-50%,-50%) scale(.9)' });
    return ring;
  }

  function ensureStunOverlay(){
    const ov = ensureEl('fgStunOverlay', 'div', 'stun-overlay', doc.body);
    if (!ov.querySelector('.stun-card')){
      ov.innerHTML = `
        <div class="stun-card">
          <div class="stun-title">STUN!</div>
          <div class="stun-sub" id="fgStunSub">พักแป๊บ…</div>
        </div>
      `;
    }
    setStyle(ov, { display:'none' });
    return ov;
  }

  // ---------------- tiny audio (panic tick) ----------------
  let audioCtx = null;
  function getAudio(){
    if (audioCtx) return audioCtx;
    try{
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }catch(_){
      audioCtx = null;
    }
    return audioCtx;
  }
  function beep(freq, durMs, gain){
    const ctx = getAudio();
    if (!ctx) return;
    try{
      if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq || 880;
      g.gain.value = 0.0001;

      o.connect(g);
      g.connect(ctx.destination);

      const t0 = ctx.currentTime;
      const attack = 0.005;
      const hold = Math.max(0.01, (durMs||60)/1000);
      const peak = clamp(gain==null?0.06:gain, 0.01, 0.12);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + hold);

      o.start(t0);
      o.stop(t0 + hold + 0.02);
    }catch(_){}
  }

  // ---------------- FX primitives ----------------
  const fxLayer = ensureFXLayer();

  function scorePop(text, x, y, big){
    const el = doc.createElement('div');
    el.textContent = String(text || '');
    setStyle(el, {
      position:'fixed',
      left:'0', top:'0',
      transform:`translate3d(${Math.round(x||0)}px, ${Math.round(y||0)}px, 0) translate(-50%,-50%)`,
      fontWeight:'1000',
      letterSpacing:'.2px',
      fontSize: big ? '26px' : '18px',
      opacity:'0',
      textShadow:'0 10px 30px rgba(0,0,0,.45)',
      filter:'drop-shadow(0 8px 20px rgba(0,0,0,.35))',
      willChange:'transform,opacity',
      pointerEvents:'none'
    });
    fxLayer.appendChild(el);

    // animate
    const dy = big ? 56 : 44;
    requestAnimationFrame(()=>{
      el.style.transition = 'transform .35s ease-out, opacity .35s ease-out';
      el.style.opacity = '1';
      el.style.transform =
        `translate3d(${Math.round(x||0)}px, ${Math.round((y||0)-dy)}px, 0) translate(-50%,-50%)`;
    });

    setTimeout(()=>{
      try{
        el.style.transition = 'transform .22s ease-in, opacity .22s ease-in';
        el.style.opacity = '0';
        el.style.transform =
          `translate3d(${Math.round(x||0)}px, ${Math.round((y||0)-dy-18)}px, 0) translate(-50%,-50%) scale(.98)`;
      }catch(_){}
    }, 260);

    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  function burstAt(x, y, emoji){
    const n = 9;
    for (let i=0;i<n;i++){
      const p = doc.createElement('div');
      p.textContent = emoji || '✨';
      const ang = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 38;
      const dx = Math.cos(ang) * r;
      const dy = Math.sin(ang) * r;
      setStyle(p, {
        position:'fixed',
        left:'0', top:'0',
        transform:`translate3d(${x}px, ${y}px, 0) translate(-50%,-50%) scale(.9)`,
        opacity:'0',
        fontSize:'22px',
        willChange:'transform,opacity',
        pointerEvents:'none',
        filter:'drop-shadow(0 10px 18px rgba(0,0,0,.35))'
      });
      fxLayer.appendChild(p);

      requestAnimationFrame(()=>{
        p.style.transition = 'transform .42s ease-out, opacity .42s ease-out';
        p.style.opacity = '1';
        p.style.transform =
          `translate3d(${Math.round(x+dx)}px, ${Math.round(y+dy)}px, 0) translate(-50%,-50%) scale(1.12)`;
      });

      setTimeout(()=>{
        try{
          p.style.transition = 'transform .32s ease-in, opacity .32s ease-in';
          p.style.opacity = '0';
          p.style.transform =
            `translate3d(${Math.round(x+dx*1.4)}px, ${Math.round(y+dy*1.4)}px, 0) translate(-50%,-50%) scale(.9)`;
        }catch(_){}
      }, 240);

      setTimeout(()=>{ try{ p.remove(); }catch(_){ } }, 820);
    }
  }

  function toast(text, kind){
    const el = doc.createElement('div');
    el.textContent = String(text || '');
    const top = 160;
    setStyle(el, {
      position:'fixed',
      left:'50%',
      top: top + 'px',
      transform:'translateX(-50%) translateY(-10px) scale(.98)',
      padding:'10px 14px',
      borderRadius:'16px',
      fontWeight:'1000',
      letterSpacing:'.4px',
      zIndex: 45,
      opacity:'0',
      pointerEvents:'none',
      background: kind==='warn'
        ? 'rgba(245,158,11,.14)'
        : (kind==='bad' ? 'rgba(239,68,68,.14)' : 'rgba(34,197,94,.14)'),
      border: kind==='warn'
        ? '1px solid rgba(245,158,11,.22)'
        : (kind==='bad' ? '1px solid rgba(239,68,68,.22)' : '1px solid rgba(34,197,94,.22)'),
      backdropFilter:'blur(10px)',
      WebkitBackdropFilter:'blur(10px)',
      boxShadow:'0 18px 60px rgba(0,0,0,.45)'
    });
    doc.body.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    });

    setTimeout(()=>{
      try{
        el.style.transition = 'transform .18s ease-in, opacity .18s ease-in';
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(-8px) scale(.98)';
      }catch(_){}
    }, 520);

    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 820);
  }

  // ---------------- bind events ----------------
  const lockRing = ensureLockRing();
  const groupBanner = ensureGroupBanner();
  const stunOverlay = ensureStunOverlay();

  // LOCK RING
  W.addEventListener('groups:lock', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const on = !!d.on;

    if (!on){
      lockRing.style.opacity = '0';
      lockRing.style.transform = 'translate(-50%,-50%) scale(.9)';
      lockRing.style.setProperty('--p', '0');
      return;
    }

    const x = Number(d.x)|| (innerWidth/2);
    const y = Number(d.y)|| (innerHeight/2);
    const p = clamp(d.prog, 0, 1);
    const c = clamp(d.charge, 0, 1);

    lockRing.style.left = Math.round(x) + 'px';
    lockRing.style.top  = Math.round(y) + 'px';
    lockRing.style.opacity = '1';
    lockRing.style.transform = 'translate(-50%,-50%) scale(1)';
    lockRing.style.setProperty('--p', String(p));
    lockRing.style.setProperty('--c', String(c));
  }, { passive:true });

  // PANIC (last 3 seconds of mini window)
  let panicLastLeft = 999;
  W.addEventListener('groups:panic', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const on = !!d.on;
    const left = (d.left|0);

    // toggle HTML class (CSS already has html.panic)
    if (on) doc.documentElement.classList.add('panic');
    else doc.documentElement.classList.remove('panic');

    // tick sound only when countdown changes
    if (on && left !== panicLastLeft){
      panicLastLeft = left;

      // 3..2..1 pitch up
      const freq = (left===3)?660:(left===2?820:980);
      beep(freq, 55, 0.06);

      // tiny pulse on timer text (if exists)
      const tEl = byId('hud-time');
      if (tEl){
        tEl.style.transform = 'scale(1.04)';
        setTimeout(()=>{ try{ tEl.style.transform='scale(1)'; }catch(_){} }, 90);
      }
    }

    if (!on){
      panicLastLeft = 999;
    }
  }, { passive:true });

  // STUN overlay
  W.addEventListener('groups:stun', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const on = !!d.on;
    const ms = Math.max(200, d.ms|0);

    if (!on){
      stunOverlay.style.display = 'none';
      return;
    }

    stunOverlay.style.display = '';
    stunOverlay.classList.remove('pop');
    void stunOverlay.offsetWidth; // reflow
    stunOverlay.classList.add('pop');

    const sub = byId('fgStunSub');
    if (sub) sub.textContent = `พัก ${Math.ceil(ms/1000)}s…`;

    // auto hide
    setTimeout(()=>{ stunOverlay.style.display='none'; }, ms);
  }, { passive:true });

  // GROUP banner pop
  W.addEventListener('groups:group_change', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const textEl = byId('fgGroupBannerText');
    if (textEl) textEl.textContent = d.label || 'หมู่ ?';

    groupBanner.classList.remove('pop');
    // show instantly (CSS anim will fade/slide in)
    groupBanner.style.opacity = '1';
    void groupBanner.offsetWidth;
    groupBanner.classList.add('pop');

    // fade after a moment
    setTimeout(()=>{
      try{
        groupBanner.style.transition = 'opacity .35s ease-in';
        groupBanner.style.opacity = '0';
      }catch(_){}
    }, 900);

    setTimeout(()=>{
      try{ groupBanner.style.transition=''; }catch(_){}
    }, 1400);
  }, { passive:true });

  // POWER pulse (nice feedback when power increments)
  W.addEventListener('groups:power', (ev)=>{
    const fill = $('.power-fill');
    if (!fill) return;
    fill.classList.remove('pulse');
    void fill.offsetWidth;
    fill.classList.add('pulse');
  }, { passive:true });

  // CELEBRATE (goal/mini)
  W.addEventListener('hha:celebrate', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind||'').toLowerCase();
    const text = d.text || (kind==='goal' ? 'GOAL CLEAR!' : 'MINI CLEAR!');
    toast(text, 'good');

    // light confetti burst around center
    const x = Math.round(innerWidth/2);
    const y = Math.round(innerHeight*0.32);
    burstAt(x, y, kind==='goal' ? '✨' : '⭐');

    // subtle screen flash
    doc.documentElement.classList.add('swapflash');
    setTimeout(()=>doc.documentElement.classList.remove('swapflash'), 160);
  }, { passive:true });

  // JUDGE (warn)
  W.addEventListener('hha:judge', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const text = d.text || 'WARNING';
    toast(text, 'warn');

    // small burst
    const x = Math.round(innerWidth/2);
    const y = Math.round(innerHeight*0.32);
    burstAt(x, y, '⚠️');
  }, { passive:true });

  // Provide a tiny API if you want (optional)
  NS.scorePop = scorePop;
  NS.burstAt  = burstAt;

})();