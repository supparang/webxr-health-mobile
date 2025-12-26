// === /herohealth/vr-groups/groups-fx.js ===
// GroupsVR — FX/Binder layer
// ✅ group banner pop
// ✅ stun overlay show/hide
// ✅ lock ring position + progress/charge
// ✅ power bar (if your HUD has ids)
// ✅ safe: no crash if elements missing

(function(root){
  'use strict';
  const W = root;
  const doc = W.document;
  if (!doc) return;

  const FX = (W.GAME_MODULES && W.GAME_MODULES.Particles) || W.Particles || null;

  function $(sel){ return doc.querySelector(sel); }
  function byId(id){ return doc.getElementById(id); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // ---------- ensure LockRing ----------
  function ensureLockRing(){
    let el = $('.lock-ring');
    if (el) return el;

    el = doc.createElement('div');
    el.className = 'lock-ring';
    el.innerHTML = `
      <div class="lock-core"></div>
      <div class="lock-prog"></div>
      <div class="lock-charge"></div>
    `;
    doc.body.appendChild(el);
    return el;
  }

  // ---------- ensure GroupBanner ----------
  function ensureBanner(){
    let el = $('.group-banner');
    if (el) return el;

    el = doc.createElement('div');
    el.className = 'group-banner';
    el.innerHTML = `
      <div class="group-banner-text" id="fg-bannerText">หมู่ ?</div>
      <div class="group-banner-sub" id="fg-bannerSub">สะสมพลังเพื่อสลับหมู่ ✨</div>
    `;
    doc.body.appendChild(el);
    return el;
  }

  // ---------- ensure StunOverlay ----------
  function ensureStun(){
    let el = $('.stun-overlay');
    if (el) return el;

    el = doc.createElement('div');
    el.className = 'stun-overlay';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="stun-card">
        <div class="stun-title">STUN!</div>
        <div class="stun-sub">โดนขยะ 🧁🥤 หยุดชั่วคราว…</div>
      </div>
    `;
    doc.body.appendChild(el);
    return el;
  }

  // ---------- lock ring update ----------
  const lockEl = ensureLockRing();
  function setLock(on, x, y, p, c){
    if (!lockEl) return;
    lockEl.style.display = on ? '' : 'none';
    if (!on) return;

    lockEl.style.left = (x|0) + 'px';
    lockEl.style.top  = (y|0) + 'px';
    lockEl.style.transform = 'translate(-50%,-50%)';

    lockEl.style.setProperty('--p', String(clamp(p,0,1)));
    lockEl.style.setProperty('--c', String(clamp(c,0,1)));
  }

  // ---------- banner ----------
  const banner = ensureBanner();
  function popBanner(text){
    if (!banner) return;
    const t = banner.querySelector('#fg-bannerText');
    if (t) t.textContent = String(text || 'หมู่ ?');

    banner.classList.remove('pop');
    // force reflow
    void banner.offsetWidth;
    banner.classList.add('pop');

    if (FX && FX.scorePop){
      try{ FX.scorePop('SWAP!', window.innerWidth/2, 140); }catch(_){}
    }
  }

  // ---------- stun ----------
  const stun = ensureStun();
  let stunTimer = 0;
  function showStun(ms){
    if (!stun) return;
    stun.style.display = '';
    stun.classList.remove('pop');
    void stun.offsetWidth;
    stun.classList.add('pop');

    clearTimeout(stunTimer);
    stunTimer = setTimeout(()=>{ stun.style.display = 'none'; }, Math.max(200, ms|0));
  }

  // ---------- power bar (optional) ----------
  function setPower(charge, threshold){
    const fill = $('.power-fill');
    const label = byId('fg-powerText') || null;
    if (!fill && !label) return;

    const th = Math.max(1, threshold|0);
    const c = clamp(charge|0, 0, th);
    const pct = (c / th) * 100;

    if (fill){
      fill.style.width = pct.toFixed(1) + '%';
      fill.classList.add('pulse');
      setTimeout(()=>{ try{ fill.classList.remove('pulse'); }catch(_){} }, 180);
    }
    if (label) label.textContent = `${c}/${th}`;
  }

  // ---------- events ----------
  W.addEventListener('groups:group_change', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    popBanner(d.label || 'หมู่ ?');
  }, { passive:true });

  W.addEventListener('groups:stun', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    showStun(d.ms || 800);
  }, { passive:true });

  W.addEventListener('groups:lock', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    setLock(!!d.on, d.x, d.y, d.prog, d.charge);
  }, { passive:true });

  W.addEventListener('groups:power', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    setPower(d.charge, d.threshold);
  }, { passive:true });

})(window);