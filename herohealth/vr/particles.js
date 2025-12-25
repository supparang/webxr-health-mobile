// === /herohealth/vr/particles.js ===
// HeroHealth FX Layer — PRODUCTION (Universal)
// ✅ scorePop(x,y,text,label) + floatPop
// ✅ burstAt(x,y,kind)
// ✅ celebrate({kind,intensity})
// ✅ listens: hha:celebrate, hha:judge, hha:fever (optional)
// ✅ Anti long-number / sanitize text
// ✅ Mobile-safe, no crash if called weirdly

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // -------- utils --------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  function safeText(t) {
    t = String(t ?? '');
    // เลขยาว/ข้อมูลพิลึก ๆ กันลอยยาว
    if (/^\d{10,}$/.test(t)) return '✓';
    if (t.length > 24) return t.slice(0, 24) + '…';
    return t;
  }

  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      zIndex: 999,
      pointerEvents: 'none',
      overflow: 'hidden',
    });
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureStyle() {
    if (doc.getElementById('hha-fx-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-fx-style';
    st.textContent = `
      .hha-fx-pop{
        position:absolute;
        transform:translate(-50%,-50%);
        font-family:system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif;
        font-weight:1000;
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.22);
        backdrop-filter: blur(8px);
        box-shadow:0 18px 44px rgba(0,0,0,.35);
        background:rgba(2,6,23,.62);
        color:rgba(229,231,235,.95);
        will-change: transform, opacity;
        opacity:0;
      }
      .hha-fx-pop b{font-weight:1100}
      .hha-fx-pop .tag{opacity:.85; margin-left:6px; font-weight:1000}

      @keyframes hhaPopUp {
        0%   { opacity:0; transform:translate(-50%,-50%) translateY(10px) scale(.92); }
        15%  { opacity:1; transform:translate(-50%,-50%) translateY(0px) scale(1.02); }
        100% { opacity:0; transform:translate(-50%,-50%) translateY(-34px) scale(1.0); }
      }
      .hha-fx-pop.up { animation:hhaPopUp 760ms ease-out both; }

      .hha-fx-burst{
        position:absolute;
        left:0; top:0;
        width:14px; height:14px;
        transform:translate(-50%,-50%);
        border-radius:999px;
        opacity:0;
        will-change: transform, opacity;
      }
      @keyframes hhaBurst {
        0% { opacity:0; transform:translate(-50%,-50%) scale(.5); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.15); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(2.2); }
      }
      .hha-fx-burst.go { animation:hhaBurst 420ms ease-out both; }

      .hha-toast{
        position:fixed;
        left:50%; bottom:14px;
        transform:translateX(-50%);
        z-index:1000;
        pointer-events:none;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.22);
        border-radius:999px;
        padding:8px 12px;
        font-weight:1000;
        color:rgba(229,231,235,.95);
        box-shadow:0 18px 44px rgba(0,0,0,.40);
        backdrop-filter: blur(8px);
        opacity:0;
      }
      @keyframes hhaToast {
        0%{ opacity:0; transform:translateX(-50%) translateY(10px) scale(.98); }
        12%{ opacity:1; transform:translateX(-50%) translateY(0) scale(1.0); }
        88%{ opacity:1; }
        100%{ opacity:0; transform:translateX(-50%) translateY(6px) scale(.99); }
      }
      .hha-toast.go{ animation:hhaToast 1400ms ease-out both; }

      /* intensity glow (FEVER) */
      .hha-fx-fever{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index: 998;
        opacity:0;
        transition: opacity .18s linear;
        background: radial-gradient(circle at 50% 50%, rgba(250,204,21,.0) 40%, rgba(248,113,113,.10) 70%, rgba(2,6,23,.48) 100%);
      }
      .hha-fx-fever.on{ opacity:1; }
    `;
    doc.head.appendChild(st);
  }

  ensureStyle();
  const layer = ensureLayer();

  // Fever glow overlay (optional)
  let feverEl = doc.querySelector('.hha-fx-fever');
  if (!feverEl) {
    feverEl = doc.createElement('div');
    feverEl.className = 'hha-fx-fever';
    doc.body.appendChild(feverEl);
  }

  // -------- API --------
  function scorePop(x, y, text, label) {
    try {
      x = Number(x) || (root.innerWidth * 0.5);
      y = Number(y) || (root.innerHeight * 0.5);
      const t = safeText(text);
      const l = label ? safeText(label) : '';

      const el = doc.createElement('div');
      el.className = 'hha-fx-pop up';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.innerHTML = `<b>${t}</b>${l ? `<span class="tag">${l}</span>` : ''}`;

      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 900);
    } catch (_) {}
  }

  // alias
  function floatPop(x, y, text) { scorePop(x, y, text, ''); }

  function burstAt(x, y, kind) {
    try {
      x = Number(x) || (root.innerWidth * 0.5);
      y = Number(y) || (root.innerHeight * 0.5);
      kind = String(kind || 'good');

      const el = doc.createElement('div');
      el.className = 'hha-fx-burst go';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      // ไม่ fix สีตามคำสั่งระบบ? (ระบบห้าม set สีเฉพาะตอนทำ chart เท่านั้น)
      // ใน CSS/DOM UI ใส่สีได้ปกติ
      let bg = 'rgba(229,231,235,.30)';
      if (kind === 'good') bg = 'rgba(34,197,94,.34)';
      else if (kind === 'bad') bg = 'rgba(251,113,133,.30)';
      else if (kind === 'gold') bg = 'rgba(250,204,21,.34)';
      else if (kind === 'boss') bg = 'rgba(248,113,113,.34)';
      else if (kind === 'trap') bg = 'rgba(147,51,234,.32)';
      else if (kind === 'power') bg = 'rgba(56,189,248,.32)';

      el.style.background = bg;
      el.style.boxShadow = `0 0 0 10px ${bg.replace('0.34','0.12').replace('0.32','0.12').replace('0.30','0.12')}`;

      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 520);
    } catch (_) {}
  }

  function toast(text) {
    try {
      text = safeText(text);
      let el = doc.querySelector('.hha-toast');
      if (!el) {
        el = doc.createElement('div');
        el.className = 'hha-toast';
        doc.body.appendChild(el);
      }
      el.textContent = text;
      el.classList.remove('go');
      void el.offsetWidth; // restart anim
      el.classList.add('go');
    } catch (_) {}
  }

  function celebrate(payload) {
    try {
      const kind = safeText(payload && payload.kind ? payload.kind : 'CLEAR!');
      const intensity = clamp(Number(payload && payload.intensity ? payload.intensity : 1.0) || 1.0, 0.6, 2.2);
      toast(`🎉 ${kind}`);

      // burst confetti-ish around center
      const cx = root.innerWidth * 0.5;
      const cy = root.innerHeight * 0.42;
      const n = Math.floor(10 * intensity);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 18 + Math.random() * (52 * intensity);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        burstAt(x, y, (kind.includes('BOSS') ? 'boss' : 'gold'));
      }
    } catch (_) {}
  }

  // -------- event bridge --------
  function onEvt(name, fn) {
    try { root.addEventListener(name, fn); } catch (_) {}
  }

  onEvt('hha:celebrate', (e) => celebrate((e && e.detail) || {}));
  onEvt('hha:judge', (e) => {
    const d = (e && e.detail) || {};
    if (d && d.label) toast(String(d.label));
  });
  onEvt('hha:fever', (e) => {
    const d = (e && e.detail) || {};
    const pct = Number(d.feverPct ?? d.fever ?? 0) || 0;
    // เปิด glow เบา ๆ เมื่อ fever สูง
    if (!feverEl) return;
    feverEl.classList.toggle('on', pct >= 80);
    feverEl.style.opacity = String(clamp((pct - 70) / 30, 0, 1) * 0.55);
  });

  // expose
  root.Particles = { scorePop, floatPop, burstAt, celebrate, toast };
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(typeof window !== 'undefined' ? window : globalThis);