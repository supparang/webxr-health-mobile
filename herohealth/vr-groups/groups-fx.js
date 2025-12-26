// === /herohealth/vr-groups/groups-fx.js ===
// Food Groups VR — FX + UI helpers (IIFE) — PRODUCTION
// ✅ Creates (if missing): lock ring, stun overlay, group banner, end summary modal (optional)
// ✅ Binds events:
//    - groups:lock        -> lock ring follows target + progress + charge
//    - groups:group_change-> banner pop
//    - groups:stun        -> stun overlay + shake
//    - hha:time           -> panic blink when low time
//    - hha:score          -> score pop
//    - hha:celebrate      -> goal/mini/all celebration burst
//    - hha:judge          -> judge toast
//    - hha:end            -> optional summary modal (safe if you don't want)
// Works with: groups-vr.css + groups-vr.html + GameEngine.js + groups-quests.js

(function () {
  'use strict';

  const W = window;
  const doc = document;
  if (!doc) return;

  // prevent double bind
  const NS = (W.GroupsFX = W.GroupsFX || {});
  if (NS.__bound) return;
  NS.__bound = true;

  // ---------------- helpers ----------------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function $(id){ return doc.getElementById(id); }
  function el(tag, cls){
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  // ---------- ensure base FX layer (for pop/burst/toast) ----------
  function ensureFxLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = el('div', 'hha-fx-layer');
    Object.assign(layer.style, {
      position:'fixed',
      inset:'0',
      zIndex:'40',
      pointerEvents:'none',
      overflow:'hidden'
    });
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- ensure lock ring ----------
  function ensureLockRing(){
    let ring = doc.querySelector('.lock-ring');
    if (ring) return ring;

    ring = el('div', 'lock-ring');
    ring.innerHTML = `
      <div class="lock-prog"></div>
      <div class="lock-charge"></div>
      <div class="lock-core"></div>
    `;
    // default hidden
    ring.style.opacity = '0';
    ring.style.transform = 'translate3d(-9999px,-9999px,0)';
    doc.body.appendChild(ring);
    return ring;
  }

  // ---------- ensure stun overlay ----------
  function ensureStunOverlay(){
    let s = doc.querySelector('.stun-overlay');
    if (s) return s;

    s = el('div', 'stun-overlay');
    s.style.display = 'none';
    s.innerHTML = `
      <div class="stun-card">
        <div class="stun-title">STUN!</div>
        <div class="stun-sub">โดนขยะแล้ว 🥤 ล็อกชั่วคราว</div>
      </div>
    `;
    doc.body.appendChild(s);
    return s;
  }

  // ---------- ensure group banner ----------
  function ensureGroupBanner(){
    let b = doc.querySelector('.group-banner');
    if (b) return b;

    b = el('div', 'group-banner');
    b.style.display = 'none';
    b.innerHTML = `
      <div class="group-banner-text" id="fg-bannerText">หมู่ ?</div>
      <div class="group-banner-sub" id="fg-bannerSub">POWER ready → สลับหมู่!</div>
    `;
    doc.body.appendChild(b);
    return b;
  }

  // ---------- ensure end summary modal (optional, safe) ----------
  function ensureEndModal(){
    let m = doc.getElementById('fg-endModal');
    if (m) return m;

    m = el('div');
    m.id = 'fg-endModal';
    Object.assign(m.style, {
      position:'fixed',
      inset:'0',
      zIndex:'60',
      display:'none',
      alignItems:'center',
      justifyContent:'center',
      padding:'18px',
      background:'radial-gradient(circle at 50% 35%, rgba(34,211,238,.10), rgba(2,6,23,.92))'
    });

    const card = el('div');
    Object.assign(card.style, {
      width:'min(760px, 94vw)',
      background:'rgba(2,6,23,.86)',
      border:'1px solid rgba(148,163,184,.20)',
      borderRadius:'26px',
      padding:'18px',
      boxShadow:'0 24px 90px rgba(0,0,0,.55)',
      backdropFilter:'blur(12px)'
    });

    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div>
          <div style="font-weight:1000;font-size:22px;letter-spacing:.4px">สรุปผล Food Groups VR</div>
          <div id="fg-endReason" style="margin-top:6px;opacity:.8;font-weight:700">—</div>
        </div>
        <div id="fg-endGrade" style="font-weight:1000;font-size:34px;letter-spacing:1px">C</div>
      </div>

      <div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <div style="background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.14);border-radius:18px;padding:10px">
          <div style="opacity:.75;font-size:12px">SCORE</div>
          <div id="fg-endScore" style="font-weight:1000;font-size:18px">0</div>
        </div>
        <div style="background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.14);border-radius:18px;padding:10px">
          <div style="opacity:.75;font-size:12px">ACC</div>
          <div id="fg-endAcc" style="font-weight:1000;font-size:18px">0%</div>
        </div>
        <div style="background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.14);border-radius:18px;padding:10px">
          <div style="opacity:.75;font-size:12px">BEST COMBO</div>
          <div id="fg-endCombo" style="font-weight:1000;font-size:18px">0</div>
        </div>
      </div>

      <div style="margin-top:10px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
        <div style="background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.12);border-radius:18px;padding:10px">
          <div style="opacity:.75;font-size:12px">MISSES</div>
          <div id="fg-endMiss" style="font-weight:900">0</div>
        </div>
        <div style="background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.12);border-radius:18px;padding:10px">
          <div style="opacity:.75;font-size:12px">HITS / SHOTS</div>
          <div id="fg-endHS" style="font-weight:900">0 / 0</div>
        </div>
      </div>

      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
        <button id="fg-endClose" style="
          pointer-events:auto;
          padding:10px 14px;border-radius:16px;
          border:1px solid rgba(148,163,184,.22);
          background:transparent;color:rgba(229,231,235,.92);
          font-weight:900;cursor:pointer
        ">ปิด</button>
        <button id="fg-endRestart" style="
          pointer-events:auto;
          padding:10px 14px;border-radius:16px;
          border:1px solid rgba(34,211,238,.25);
          background:linear-gradient(90deg, rgba(34,197,94,.92), rgba(34,211,238,.92));
          color:#081019;font-weight:1000;cursor:pointer
        ">เล่นอีกครั้ง</button>
      </div>
    `;

    m.appendChild(card);
    doc.body.appendChild(m);

    // buttons
    const close = card.querySelector('#fg-endClose');
    const restart = card.querySelector('#fg-endRestart');
    close.addEventListener('click', ()=>{ m.style.display='none'; });
    restart.addEventListener('click', ()=>{ location.reload(); });

    return m;
  }

  // ---------- score pop ----------
  function scorePop(text, x, y){
    const layer = ensureFxLayer();
    const n = el('div');
    n.textContent = String(text);
    Object.assign(n.style, {
      position:'fixed',
      left: (x|0) + 'px',
      top:  (y|0) + 'px',
      transform:'translate(-50%,-50%)',
      fontWeight:'1000',
      fontSize:'18px',
      letterSpacing:'.3px',
      textShadow:'0 10px 24px rgba(0,0,0,.45)',
      opacity:'0',
      willChange:'transform,opacity',
      pointerEvents:'none'
    });
    layer.appendChild(n);

    // animate
    requestAnimationFrame(()=>{
      n.style.opacity = '1';
      n.style.transform = 'translate(-50%,-70%) scale(1.06)';
    });
    setTimeout(()=>{
      n.style.opacity = '0';
      n.style.transform = 'translate(-50%,-95%) scale(.98)';
    }, 240);
    setTimeout(()=>{ try{ n.remove(); }catch{} }, 520);
  }

  // ---------- burst confetti (simple emoji burst) ----------
  function burstAt(x,y, emoji){
    const layer = ensureFxLayer();
    const count = 10;
    for (let i=0;i<count;i++){
      const p = el('div');
      p.textContent = emoji || '✨';
      Object.assign(p.style, {
        position:'fixed',
        left:(x|0)+'px',
        top:(y|0)+'px',
        transform:'translate(-50%,-50%)',
        fontSize:(16 + (Math.random()*16))|0 + 'px',
        opacity:'0',
        pointerEvents:'none',
        willChange:'transform,opacity'
      });
      layer.appendChild(p);

      const a = Math.random()*Math.PI*2;
      const r = 12 + Math.random()*40;
      const dx = Math.cos(a)*r;
      const dy = Math.sin(a)*r;

      requestAnimationFrame(()=>{
        p.style.opacity = '1';
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.08)`;
      });
      setTimeout(()=>{
        p.style.opacity = '0';
        p.style.transform = `translate(calc(-50% + ${dx*1.2}px), calc(-50% + ${dy*1.2}px)) scale(.92)`;
      }, 220);
      setTimeout(()=>{ try{ p.remove(); }catch{} }, 520);
    }
  }

  // ---------- judge toast ----------
  function toast(text, kind){
    const layer = ensureFxLayer();
    const box = el('div');
    const isWarn = (kind === 'warn');
    box.textContent = String(text || '');
    Object.assign(box.style, {
      position:'fixed',
      left:'50%',
      top:'calc(16px + var(--sat, 0px))',
      transform:'translateX(-50%)',
      padding:'10px 14px',
      borderRadius:'16px',
      border:'1px solid ' + (isWarn ? 'rgba(245,158,11,.25)' : 'rgba(148,163,184,.18)'),
      background: isWarn ? 'rgba(245,158,11,.10)' : 'rgba(2,6,23,.55)',
      color:'rgba(229,231,235,.92)',
      fontWeight:'900',
      letterSpacing:'.2px',
      boxShadow:'0 18px 60px rgba(0,0,0,.35)',
      opacity:'0',
      pointerEvents:'none',
      zIndex:'55'
    });
    layer.appendChild(box);

    requestAnimationFrame(()=>{ box.style.opacity='1'; });
    setTimeout(()=>{ box.style.opacity='0'; }, 560);
    setTimeout(()=>{ try{ box.remove(); }catch{} }, 880);
  }

  // ---------- panic timer (low time) ----------
  let lastPanic = false;
  function setPanic(on){
    on = !!on;
    if (on === lastPanic) return;
    lastPanic = on;
    doc.documentElement.classList.toggle('panic', on);
  }

  // ---------------- ensure UI ----------
  const ring = ensureLockRing();
  const stun = ensureStunOverlay();
  const banner = ensureGroupBanner();
  const endModal = ensureEndModal(); // safe even if you don't show

  // ---------------- event bindings ----------------

  // lock ring follow
  W.addEventListener('groups:lock', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const on = !!d.on;

    if (!on){
      ring.style.opacity = '0';
      ring.style.transform = 'translate3d(-9999px,-9999px,0)';
      ring.style.setProperty('--p', 0);
      ring.style.setProperty('--c', 0);
      return;
    }

    const x = Number(d.x)||0;
    const y = Number(d.y)||0;
    const prog = clamp(d.prog, 0, 1);
    const charge = clamp(d.charge, 0, 1);

    ring.style.opacity = '1';
    ring.style.left = x + 'px';
    ring.style.top  = y + 'px';
    ring.style.transform = 'translate(-50%,-50%)';
    ring.style.setProperty('--p', prog);
    ring.style.setProperty('--c', charge);
  }, { passive:true });

  // group banner pop
  let bannerTO = 0;
  W.addEventListener('groups:group_change', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const label = d.label || 'หมู่ ?';

    const t = banner.querySelector('#fg-bannerText');
    if (t) t.textContent = label;

    banner.style.display = '';
    banner.classList.remove('pop');
    // reflow
    void banner.offsetWidth;
    banner.classList.add('pop');

    clearTimeout(bannerTO);
    bannerTO = setTimeout(()=>{
      banner.style.display = 'none';
      banner.classList.remove('pop');
    }, 900);
  }, { passive:true });

  // stun overlay
  let stunTO = 0;
  W.addEventListener('groups:stun', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const on = !!d.on;
    const ms = Math.max(200, d.ms|0);

    if (!on) return;

    stun.style.display = 'flex';
    stun.classList.remove('pop');
    void stun.offsetWidth;
    stun.classList.add('pop');

    // subtle shake
    doc.documentElement.classList.add('stunshake');
    clearTimeout(stunTO);
    stunTO = setTimeout(()=>{
      stun.style.display = 'none';
      doc.documentElement.classList.remove('stunshake');
    }, ms);
  }, { passive:true });

  // panic when <= 10 sec
  W.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const left = d.left|0;
    setPanic(left > 0 && left <= 10);
  }, { passive:true });

  // score pop (center-ish)
  W.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    // show small pop on big milestones only to avoid spam
    const score = d.score|0;
    const combo = d.combo|0;

    if (combo > 0 && (combo % 5 === 0)){
      scorePop('COMBO x' + combo, window.innerWidth*0.5, window.innerHeight*0.58);
      burstAt(window.innerWidth*0.5, window.innerHeight*0.58, '✨');
    }
    // optional: score tick pop every 1000
    if (score !== 0 && (Math.abs(score) % 1000 === 0)){
      scorePop((score>0?'+':'') + score, window.innerWidth*0.5, window.innerHeight*0.52);
    }
  }, { passive:true });

  // celebrate (from quests)
  W.addEventListener('hha:celebrate', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind || '');
    const text = d.text || (kind === 'goal' ? 'GOAL CLEAR!' : 'NICE!');
    toast(text, 'ok');

    const cx = window.innerWidth*0.5;
    const cy = window.innerHeight*0.46;

    if (kind === 'goal'){
      burstAt(cx, cy, '🎉');
      burstAt(cx, cy, '✨');
    } else if (kind === 'mini'){
      burstAt(cx, cy, '⚡');
      burstAt(cx, cy, '✨');
    } else {
      burstAt(cx, cy, '🎊');
    }
  }, { passive:true });

  // judge toast
  W.addEventListener('hha:judge', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    toast(d.text || '—', d.kind || 'warn');
  }, { passive:true });

  // end summary (optional modal)
  W.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    // show end modal automatically
    try{
      $('fg-endReason').textContent = 'เหตุผล: ' + (d.reason || 'end');
      $('fg-endGrade').textContent  = d.grade || 'C';
      $('fg-endScore').textContent  = String(d.scoreFinal|0);
      $('fg-endAcc').textContent    = String((d.accuracy|0)) + '%';
      $('fg-endCombo').textContent  = String(d.comboMax|0);
      $('fg-endMiss').textContent   = String(d.misses|0);
      $('fg-endHS').textContent     = `${d.hits|0} / ${d.shots|0}`;
      endModal.style.display = 'flex';
    }catch(_){
      // if anything missing, fail silently
    }
  }, { passive:true });

})();