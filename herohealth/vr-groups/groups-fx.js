/* === /herohealth/vr-groups/groups-fx.js ===
Food Groups VR — Candy FX Pack (PRODUCTION)
✅ Sparkle stars on spawn/hit (วิ้ง ๆ)
✅ GOOD: trail glitter while floating
✅ JUNK/WRONG/DECOY: cute smoke/slime puff (ไม่หลอน)
✅ Celebrate burst for goal/mini/all via hha:celebrate
✅ Overdrive-aware: ถ้า body.groups-overdrive => วิ้งแรงขึ้น
✅ Safe: ไม่พังถ้า element ไม่มี / bind ซ้ำ
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  if (NS.__fxCandyInited) return;
  NS.__fxCandyInited = true;

  // ---------- locate layer ----------
  const fgLayer = DOC.getElementById('fg-layer') || DOC.querySelector('.fg-layer');
  // FX layer
  let fx = DOC.querySelector('.fg-fx-layer');
  if (!fx) {
    fx = DOC.createElement('div');
    fx.className = 'fg-fx-layer';
    Object.assign(fx.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '9999',
      overflow: 'hidden',
      contain: 'layout paint style',
    });
    DOC.body.appendChild(fx);
  }

  // ---------- small CSS injection (only if missing) ----------
  // (ทำไว้เผื่อยังไม่ได้ใส่บางคลาสใน CSS)
  if (!DOC.getElementById('fg-fx-style')) {
    const st = DOC.createElement('style');
    st.id = 'fg-fx-style';
    st.textContent = `
      .fg-fx-layer .fx{ position:absolute; left:0; top:0; transform: translate(-9999px,-9999px); will-change: transform, opacity; }
      .fg-fx-layer .fx-star{ font-size:14px; filter: drop-shadow(0 10px 14px rgba(0,0,0,.28)); opacity:.95; }
      .fg-fx-layer .fx-puff{ width:10px; height:10px; border-radius:999px; opacity:.95; filter: blur(.15px); }
      @keyframes fxStarPop{
        0%   { transform: translate(var(--x),var(--y)) scale(.55) rotate(-8deg); opacity:0; }
        20%  { opacity:1; }
        100% { transform: translate(calc(var(--x) + var(--dx)), calc(var(--y) + var(--dy))) scale(1.1) rotate(var(--r)); opacity:0; }
      }
      @keyframes fxPuff{
        0%   { transform: translate(var(--x),var(--y)) scale(.75); opacity:0; }
        18%  { opacity:.95; }
        100% { transform: translate(calc(var(--x) + var(--dx)), calc(var(--y) + var(--dy))) scale(1.55); opacity:0; }
      }
    `;
    DOC.head.appendChild(st);
  }

  // ---------- helpers ----------
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const rnd = () => Math.random(); // (FX ไม่ต้อง deterministic)
  const overdrive = () => DOC.body.classList.contains('groups-overdrive');

  function getRectCenter(el) {
    try {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    } catch {
      return { x: root.innerWidth / 2, y: root.innerHeight / 2, w: 0, h: 0 };
    }
  }

  function add(node, ms) {
    fx.appendChild(node);
    root.setTimeout(() => { try { node.remove(); } catch {} }, ms | 0);
  }

  // ---------- sparkle stars ----------
  function sparkleAt(x, y, power, mode) {
    power = Math.max(1, Math.min(30, power | 0));
    const isOver = overdrive();
    const extra = isOver ? 6 : 0;
    const n = clamp(power + extra, 8, isOver ? 28 : 22);

    // candy star set
    const stars = isOver
      ? ['✨', '⭐', '💫', '🌟', '🍬', '🍭', '🎇', '🧁']
      : ['✨', '⭐', '💫', '🌟', '🍬', '🍭'];

    const boost = (mode === 'spawn') ? 0.85 : 1.0;
    const spread = isOver ? 92 : 74;

    for (let i = 0; i < n; i++) {
      const s = DOC.createElement('div');
      s.className = 'fx fx-star fx-star-pop';
      s.classList.add('fx-star');
      s.textContent = stars[(rnd() * stars.length) | 0];

      const a = rnd() * Math.PI * 2;
      const dist = (22 + rnd() * spread) * boost;
      const dx = Math.cos(a) * dist;
      const dy = Math.sin(a) * dist;

      const rot = ((rnd() * 140) - 70).toFixed(0) + 'deg';
      const fs = (12 + rnd() * (isOver ? 18 : 12)).toFixed(0) + 'px';

      s.style.setProperty('--x', x.toFixed(1) + 'px');
      s.style.setProperty('--y', y.toFixed(1) + 'px');
      s.style.setProperty('--dx', dx.toFixed(1) + 'px');
      s.style.setProperty('--dy', dy.toFixed(1) + 'px');
      s.style.setProperty('--r', rot);

      s.style.fontSize = fs;
      s.style.animation = `fxStarPop ${isOver ? 760 : 620}ms ease-out both`;
      s.style.animationDelay = (rnd() * 0.06).toFixed(3) + 's';

      add(s, isOver ? 860 : 720);
    }
  }

  // ---------- junk cute smoke/slime puff ----------
  function slimePuffAt(x, y, power, kind) {
    power = clamp(power | 0, 4, 18);
    const isOver = overdrive();
    const n = clamp(power + (isOver ? 4 : 0), 8, isOver ? 20 : 16);

    // สี “เมือก/ควันการ์ตูน” (ไม่หลอน)
    // junk -> ชมพู+แดงอมส้ม / wrong -> เหลือง+ส้ม / decoy -> ม่วง+ฟ้า
    let c1 = 'rgba(244,114,182,.42)', c2 = 'rgba(248,113,113,.34)';
    if (kind === 'wrong') { c1 = 'rgba(250,204,21,.40)'; c2 = 'rgba(251,146,60,.30)'; }
    if (kind === 'decoy') { c1 = 'rgba(167,139,250,.38)'; c2 = 'rgba(34,211,238,.26)'; }

    const spread = isOver ? 92 : 70;

    for (let i = 0; i < n; i++) {
      const p = DOC.createElement('div');
      p.className = 'fx fx-puff';
      p.style.background = (rnd() < 0.55) ? c1 : c2;

      const a = rnd() * Math.PI * 2;
      const dist = 16 + rnd() * spread;
      const dx = Math.cos(a) * dist;
      const dy = Math.sin(a) * dist;

      const size = (8 + rnd() * (isOver ? 18 : 14)).toFixed(0) + 'px';
      p.style.width = size;
      p.style.height = size;

      p.style.setProperty('--x', x.toFixed(1) + 'px');
      p.style.setProperty('--y', y.toFixed(1) + 'px');
      p.style.setProperty('--dx', dx.toFixed(1) + 'px');
      p.style.setProperty('--dy', dy.toFixed(1) + 'px');

      p.style.animation = `fxPuff ${isOver ? 820 : 680}ms ease-out both`;
      p.style.animationDelay = (rnd() * 0.05).toFixed(3) + 's';

      add(p, isOver ? 940 : 780);
    }
  }

  // ---------- GOOD trail glitter (เบา ๆ) ----------
  let trailTimer = null;
  function trailTick() {
    // ถ้าไม่มี fgLayer ก็ไม่ต้องทำ
    if (!fgLayer) return;

    const goods = fgLayer.querySelectorAll('.fg-target.fg-good');
    if (!goods || goods.length === 0) return;

    // จำกัดไม่ให้หนัก
    const maxTrail = overdrive() ? 9 : 6;
    let budget = maxTrail;

    goods.forEach(el => {
      if (budget <= 0) return;

      // โอกาสวิ้งต่อเฟรม
      const chance = overdrive() ? 0.14 : 0.10;
      if (rnd() > chance) return;

      const c = getRectCenter(el);
      const x = c.x + (rnd() * 18 - 9);
      const y = c.y + (rnd() * 18 - 9);

      sparkleAt(x, y, overdrive() ? 6 : 4, 'trail');
      budget--;
    });
  }

  function startTrail() {
    if (trailTimer) return;
    trailTimer = root.setInterval(trailTick, 120);
  }
  function stopTrail() {
    if (trailTimer) { root.clearInterval(trailTimer); trailTimer = null; }
  }

  // ---------- observe target spawn/hit/out ----------
  let mo = null;
  function bindObserver() {
    if (!fgLayer) return;

    mo = new MutationObserver((mutList) => {
      for (const m of mutList) {
        if (!m.addedNodes) continue;
        m.addedNodes.forEach(node => {
          if (!node || node.nodeType !== 1) return;
          const el = /** @type {HTMLElement} */ (node);
          if (!el.classList || !el.classList.contains('fg-target')) return;

          const tp = String(el.dataset.type || '').toLowerCase();
          const c = getRectCenter(el);

          // spawn sparkle
          if (tp === 'good' || tp === 'boss' || tp === 'star' || tp === 'ice') {
            sparkleAt(c.x, c.y, tp === 'boss' ? 12 : 7, 'spawn');
          } else {
            // junk / wrong / decoy
            slimePuffAt(c.x, c.y, 7, tp || 'junk');
          }
        });
      }
    });

    try {
      mo.observe(fgLayer, { childList: true, subtree: false });
    } catch {}
  }

  // ---------- listen judge + celebrate ----------
  function onJudge(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind || '').toLowerCase();
    const text = String(d.text || '').toLowerCase();

    // ใช้ตำแหน่งกลางจอเป็น fallback
    const x = root.innerWidth * 0.5;
    const y = root.innerHeight * 0.52;

    if (kind === 'good') {
      // good sparkle
      sparkleAt(x, y, overdrive() ? 14 : 10, 'hit');
      return;
    }
    if (kind === 'boss') {
      sparkleAt(x, y, overdrive() ? 18 : 14, 'hit');
      return;
    }
    if (kind === 'bad' || kind === 'warn') {
      // cute slime puff
      const isWrong = text.includes('wrong');
      slimePuffAt(x, y, overdrive() ? 16 : 12, isWrong ? 'wrong' : 'junk');
      return;
    }
  }

  function onCelebrate(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    const k = String(d.kind || 'mini').toLowerCase();

    // burst center-ish
    const x = root.innerWidth * 0.5;
    const y = root.innerHeight * 0.38;

    if (k === 'all') {
      sparkleAt(x, y, 22, 'celebrate');
      sparkleAt(x - 120, y + 30, 16, 'celebrate');
      sparkleAt(x + 120, y + 30, 16, 'celebrate');
      return;
    }
    if (k === 'goal') {
      sparkleAt(x, y, 18, 'celebrate');
      return;
    }
    // mini
    sparkleAt(x, y, 14, 'celebrate');
  }

  root.addEventListener('hha:judge', onJudge, { passive: true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive: true });

  // ---------- public api ----------
  NS.FX = NS.FX || {};
  NS.FX.sparkleAt = sparkleAt;
  NS.FX.slimePuffAt = slimePuffAt;

  // ---------- init ----------
  bindObserver();
  startTrail();

  // clean up on end (optional)
  root.addEventListener('hha:end', () => {
    stopTrail();
    try { if (mo) mo.disconnect(); } catch {}
  }, { passive: true });

})(typeof window !== 'undefined' ? window : globalThis);
