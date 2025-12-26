// === /herohealth/vr-groups/groups-fx.js ===
// Food Groups VR — FX Binder (classic script) — PRODUCTION
// ✅ Ensures: lock ring UI, stun overlay, group banner
// ✅ Listens: groups:lock, groups:stun, groups:group_change, hha:time, hha:score, hha:rank, hha:celebrate, hha:judge
// ✅ Adds: panic class near end, swap flash already done by Engine, stun flash class compat
// ✅ Optional: afterimage trail on hits (uses .fg-afterimage in CSS)
// ✅ Safe / idempotent

(function () {
  'use strict';

  const doc = document;
  if (!doc) return;

  const NS = (window.GroupsFX = window.GroupsFX || {});
  if (NS.__bound) return;
  NS.__bound = true;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function $(sel){ return doc.querySelector(sel); }
  function byId(id){ return doc.getElementById(id); }

  // ---------------- Ensure UI nodes ----------------
  function ensureLockRing(){
    let ring = $('.lock-ring');
    if (ring) return ring;

    ring = doc.createElement('div');
    ring.className = 'lock-ring';
    ring.style.transform = 'translate(-50%,-50%)';

    const core = doc.createElement('div');
    core.className = 'lock-core';

    const prog = doc.createElement('div');
    prog.className = 'lock-prog';

    const chg = doc.createElement('div');
    chg.className = 'lock-charge';

    ring.appendChild(core);
    ring.appendChild(prog);
    ring.appendChild(chg);

    doc.body.appendChild(ring);

    // hidden by default
    ring.style.opacity = '0';
    ring.style.transition = 'opacity .10s linear';
    return ring;
  }

  function ensureStunOverlay(){
    let ov = $('.stun-overlay');
    if (ov) return ov;

    ov = doc.createElement('div');
    ov.className = 'stun-overlay';
    ov.style.display = 'none';

    const card = doc.createElement('div');
    card.className = 'stun-card';
    card.innerHTML = `
      <div class="stun-title">STUN!</div>
      <div class="stun-sub">โดนขยะแล้ว 😵‍💫</div>
    `;
    ov.appendChild(card);
    doc.body.appendChild(ov);
    return ov;
  }

  function ensureGroupBanner(){
    let bn = $('.group-banner');
    if (bn) return bn;

    bn = doc.createElement('div');
    bn.className = 'group-banner';
    bn.style.display = 'none';
    bn.innerHTML = `
      <div class="group-banner-text" id="fg-bannerText">หมู่ ?</div>
      <div class="group-banner-sub" id="fg-bannerSub">ยิงให้ถูก “หมู่ปัจจุบัน” 🎯</div>
    `;
    doc.body.appendChild(bn);
    return bn;
  }

  const lockRing = ensureLockRing();
  const stunOv   = ensureStunOverlay();
  const banner   = ensureGroupBanner();

  // ---------------- Lock ring control ----------------
  function setLock(on, x, y, prog, charge){
    if (!lockRing) return;

    if (!on){
      lockRing.style.opacity = '0';
      return;
    }

    // position
    lockRing.style.left = (x|0) + 'px';
    lockRing.style.top  = (y|0) + 'px';

    // CSS vars for conic progress
    lockRing.style.setProperty('--p', String(clamp(prog,0,1)));
    lockRing.style.setProperty('--c', String(clamp(charge,0,1)));

    lockRing.style.opacity = '1';
  }

  // ---------------- Stun overlay control ----------------
  let stunTimer = 0;
  function showStun(ms){
    if (!stunOv) return;
    try{ clearTimeout(stunTimer); }catch(_){}

    stunOv.style.display = '';
    stunOv.classList.remove('pop');
    // retrigger anim
    void stunOv.offsetWidth;
    stunOv.classList.add('pop');

    // subtle screen shake via class (if you want stronger, tweak CSS in html.stunflash::before)
    doc.documentElement.classList.add('stunflash');
    setTimeout(()=>doc.documentElement.classList.remove('stunflash'), 220);

    stunTimer = setTimeout(()=>{
      stunOv.style.display = 'none';
    }, Math.max(180, ms|0));
  }

  // ---------------- Group banner control ----------------
  let bannerTimer = 0;
  function flashGroup(label){
    if (!banner) return;

    const t = byId('fg-bannerText');
    if (t) t.textContent = label || 'หมู่ ?';

    banner.style.display = '';
    banner.classList.remove('pop');
    void banner.offsetWidth;
    banner.classList.add('pop');

    try{ clearTimeout(bannerTimer); }catch(_){}
    bannerTimer = setTimeout(()=>{
      banner.style.display = 'none';
    }, 900);
  }

  // ---------------- Panic mode (near end) ----------------
  // Adds html.panic when <= 10s
  let lastPanic = false;
  function applyPanic(left){
    const on = (left|0) <= 10;
    if (on === lastPanic) return;
    lastPanic = on;
    doc.documentElement.classList.toggle('panic', on);

    // little extra vibrate tick at 3..1
    if (on && navigator.vibrate){
      // nothing here, handled on time event for 3..1 below
    }
  }

  // ---------------- Afterimage trail ----------------
  function spawnAfterimage(x, y, emoji){
    try{
      const a = doc.createElement('div');
      a.className = 'fg-afterimage a1';
      a.style.setProperty('--x', (x|0) + 'px');
      a.style.setProperty('--y', (y|0) + 'px');

      const inner = doc.createElement('div');
      inner.className = 'fg-afterimage-inner';
      inner.textContent = emoji || '✨';

      a.appendChild(inner);
      doc.body.appendChild(a);

      setTimeout(()=>{ try{ a.className = 'fg-afterimage a2'; }catch(_){ } }, 60);
      setTimeout(()=>{ try{ if (a.parentNode) a.parentNode.removeChild(a); }catch(_){ } }, 260);
    }catch(_){}
  }

  // optional: small “burst” using text pop (lightweight)
  function burstAt(x, y, text){
    try{
      const b = doc.createElement('div');
      b.style.position = 'fixed';
      b.style.left = (x|0) + 'px';
      b.style.top  = (y|0) + 'px';
      b.style.transform = 'translate(-50%,-50%) scale(0.8)';
      b.style.zIndex = '40';
      b.style.pointerEvents = 'none';
      b.style.fontSize = '18px';
      b.style.fontWeight = '900';
      b.style.opacity = '0';
      b.style.transition = 'transform .18s ease, opacity .18s ease';
      b.textContent = text || '+';

      doc.body.appendChild(b);
      requestAnimationFrame(()=>{
        b.style.opacity = '1';
        b.style.transform = 'translate(-50%,-50%) scale(1)';
      });
      setTimeout(()=>{
        b.style.opacity = '0';
        b.style.transform = 'translate(-50%,-60%) scale(1.05)';
      }, 160);
      setTimeout(()=>{ try{ if (b.parentNode) b.parentNode.removeChild(b); }catch(_){ } }, 360);
    }catch(_){}
  }

  // ---------------- Event bindings ----------------
  window.addEventListener('groups:lock', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    setLock(!!d.on, d.x, d.y, d.prog, d.charge);
  }, { passive:true });

  window.addEventListener('groups:stun', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if (d.on) showStun(d.ms || 800);
  }, { passive:true });

  window.addEventListener('groups:group_change', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    flashGroup(d.label || 'หมู่ ?');
  }, { passive:true });

  window.addEventListener('hha:time', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    const left = d.left|0;

    applyPanic(left);

    // tick vibes for last 3 seconds
    if (left <= 3 && left > 0 && navigator.vibrate){
      try{ navigator.vibrate(30); }catch(_){}
    }
  }, { passive:true });

  // add a tiny “feel” on score changes (optional)
  let lastScore = 0;
  window.addEventListener('hha:score', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    const score = d.score|0;
    if (score !== lastScore){
      lastScore = score;
      // very light feedback: no DOM spam
    }
  }, { passive:true });

  // Celebrate / judge (from quest system)
  window.addEventListener('hha:celebrate', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    // quick banner sub hint
    const sub = byId('fg-bannerSub');
    if (sub) sub.textContent = d.text || 'NICE! ✨';

    // flash banner even if not group change
    const t = byId('fg-bannerText');
    if (t) t.textContent = (d.kind === 'goal') ? 'GOAL ✅' : (d.kind === 'mini' ? 'MINI ✅' : 'NICE');

    banner.style.display = '';
    banner.classList.remove('pop');
    void banner.offsetWidth;
    banner.classList.add('pop');

    try{ clearTimeout(bannerTimer); }catch(_){}
    bannerTimer = setTimeout(()=>{ banner.style.display = 'none'; }, 900);
  }, { passive:true });

  window.addEventListener('hha:judge', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    // quick small burst at center
    burstAt(window.innerWidth/2, window.innerHeight/2, d.text || '!');
  }, { passive:true });

  // Afterimage: when player hits (tap/lock) we can infer by pointerdown on targets
  // (safe: only listens capture on body)
  doc.body.addEventListener('pointerdown', (ev)=>{
    const t = ev.target;
    if (!t) return;
    if (!(t.classList && t.classList.contains('fg-target'))) return;

    // get center
    const r = t.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    // emoji is first span child
    let emoji = '✨';
    try{
      const span = t.querySelector('span');
      if (span && span.textContent) emoji = span.textContent.trim() || emoji;
    }catch(_){}

    spawnAfterimage(cx, cy, emoji);
  }, { passive:true, capture:true });

})();