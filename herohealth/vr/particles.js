// === /herohealth/vr/particles.js ===
// FX layer กลางจอ: คะแนนเด้ง + คำตัดสิน + เป้าแตกกระจาย "หนักมาก"
// ใช้ร่วมกับทุกเกม HeroHealth (GoodJunkVR / Hydration / Plate / Groups ฯลฯ)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  let fxLayer = null;
  let cssInjected = false;

  // ---------- inject CSS (ครั้งเดียว) ----------
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    const style = doc.createElement('style');
    style.textContent = `
      .hha-fx-layer{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:9999;
        overflow:hidden;
      }

      .hha-frag{
        position:fixed;
        border-radius:999px;
        pointer-events:none;
        will-change:transform,opacity;
        mix-blend-mode:screen;
      }

      .hha-fx-text{
        position:fixed;
        pointer-events:none;
        will-change:transform,opacity;
        white-space:nowrap;
        text-shadow:0 0 14px rgba(15,23,42,0.95);
      }

      .hha-fx-text-score{
        font-size:18px;
        font-weight:700;
        color:#bbf7d0;
      }

      .hha-fx-text-judge{
        font-size:20px;
        font-weight:900;
        letter-spacing:.14em;
        text-transform:uppercase;
      }

      .hha-fx-text-judge.good{    color:#4ade80; }
      .hha-fx-text-judge.perfect{ color:#a855f7; }
      .hha-fx-text-judge.late{    color:#fde047; }
      .hha-fx-text-judge.miss{    color:#fb923c; }
      .hha-fx-text-judge.block{   color:#60a5fa; }
    `;
    doc.head.appendChild(style);
  }

  function ensureLayer() {
    if (fxLayer && fxLayer.parentNode) return fxLayer;
    injectCSS();
    fxLayer = doc.createElement('div');
    fxLayer.className = 'hha-fx-layer';
    doc.body.appendChild(fxLayer);
    return fxLayer;
  }

  // ---------- helpers ----------
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // ---------- เป้าแตกกระจาย (burstAt) ----------
  // opts: { color, count, radius }
  function burstAt(x, y, opts) {
    const layer = ensureLayer();
    const baseColor = (opts && opts.color) || '#22c55e';

    // ดันค่าให้ “หนัก” ขึ้นกว่าที่ GameEngine ส่งมา
    const baseCount  = (opts && opts.count)  || 18;
    const baseRadius = (opts && opts.radius) || 80;

    const count  = Math.floor(baseCount * 1.8);   // ชิ้นเยอะขึ้น
    const radius = baseRadius * 1.4;              // กระจายกว้างขึ้น

    // ชิ้นแตก 2 ชั้นต่อ 1 ทิศ
    for (let i = 0; i < count; i++) {
      const baseAng = (i / count) * Math.PI * 2;
      const jitter  = rand(-0.4, 0.4);
      const ang     = baseAng + jitter;
      const dist    = radius * rand(0.45, 1.05);

      // ชั้น 1: กลมใหญ่สว่าง ๆ
      spawnFrag(layer, x, y, ang, dist, {
        color: baseColor,
        sizeMin: 12,
        sizeMax: 20,
        lifeMin: 480,
        lifeMax: 700,
        blur: 12,
        stretch: false
      });

      // ชั้น 2: shard ยาวพุ่งแรง ๆ
      spawnFrag(layer, x, y, ang, dist * rand(0.9, 1.2), {
        color: baseColor,
        sizeMin: 4,
        sizeMax: 7,
        lifeMin: 550,
        lifeMax: 780,
        blur: 5,
        stretch: true
      });
    }

    // วงแหวนกระแทก 2 ชั้น
    spawnRing(layer, x, y, baseColor, 52, 600);
    spawnRing(layer, x, y, baseColor, 76, 700, true);

    // Flash ตรงกลางนิดหนึ่ง ให้รู้สึก “ตูม!”
    spawnFlash(layer, x, y, baseColor);
  }

  function spawnFrag(layer, x, y, ang, dist, cfg) {
    const el = doc.createElement('div');
    el.className = 'hha-frag';

    const size = rand(cfg.sizeMin, cfg.sizeMax);
    const life = rand(cfg.lifeMin, cfg.lifeMax);

    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const tx  = x + cos * dist;
    const ty  = y + sin * dist;

    const blur = cfg.blur || 0;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.left   = (x - size / 2) + 'px';
    el.style.top    = (y - size / 2) + 'px';
    el.style.opacity = '0.98';
    el.style.background = cfg.stretch
      ? `linear-gradient(90deg, ${cfg.color}, rgba(15,23,42,0))`
      : `radial-gradient(circle, ${cfg.color}, rgba(15,23,42,0))`;
    el.style.filter = blur ? `blur(${blur}px)` : 'none';

    const baseScale = cfg.stretch ? rand(1.4, 1.9) : rand(1.0, 1.4);
    const angleDeg  = ang * 180 / Math.PI;
    const rot       = cfg.stretch ? angleDeg + rand(-16, 16) : rand(-40, 40);

    el.style.transform =
      `translate3d(0,0,0) scale(${baseScale * 0.6}) rotate(${rot}deg)`;
    el.style.transition =
      `transform ${life}ms cubic-bezier(0.18,0.88,0.3,1.2),` +
      `opacity ${life}ms ease-out`;

    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform =
        `translate3d(${tx - x}px, ${ty - y}px,0) ` +
        `scale(${cfg.stretch ? baseScale * 1.9 : baseScale * 1.4}) ` +
        `rotate(${rot}deg)`;
      el.style.opacity = '0';
    });

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, life + 60);
  }

  function spawnRing(layer, x, y, color, size, life, dashed) {
    const el = doc.createElement('div');
    el.className = 'hha-frag';

    const s = size || 56;
    const L = life || 580;

    el.style.width  = s + 'px';
    el.style.height = s + 'px';
    el.style.left   = (x - s / 2) + 'px';
    el.style.top    = (y - s / 2) + 'px';
    el.style.borderRadius = '999px';
    el.style.border = dashed
      ? `2px dashed ${color}`
      : `2px solid ${color}`;
    el.style.boxShadow = `0 0 22px ${color}`;
    el.style.opacity = '0.9';
    el.style.background = 'transparent';
    el.style.transform = 'translate3d(0,0,0) scale(0.4)';
    el.style.transition =
      `transform ${L}ms ease-out, opacity ${L}ms ease-out`;

    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translate3d(0,0,0) scale(1.8)';
      el.style.opacity = '0';
    });

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, L + 60);
  }

  function spawnFlash(layer, x, y, color) {
    const el = doc.createElement('div');
    el.className = 'hha-frag';

    const s = 140;
    const L = 260;
    el.style.width  = s + 'px';
    el.style.height = s + 'px';
    el.style.left   = (x - s / 2) + 'px';
    el.style.top    = (y - s / 2) + 'px';
    el.style.background =
      `radial-gradient(circle, rgba(248,250,252,0.85), rgba(15,23,42,0))`;
    el.style.boxShadow = `0 0 40px ${color}`;
    el.style.opacity = '0.0';
    el.style.transform = 'translate3d(0,0,0) scale(0.4)';
    el.style.transition =
      `transform ${L}ms ease-out, opacity ${L}ms ease-out`;

    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate3d(0,0,0) scale(1.1)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate3d(0,0,0) scale(1.4)';
    }, L - 80);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, L + 80);
  }

  // ---------- คะแนน + คำตัดสิน (scorePop) ----------
  // opts: { kind: 'score' | 'judge', judgment: 'PERFECT'|'GOOD'|'LATE'|'MISS'|'BLOCK' }
  function scorePop(x, y, text, opts) {
    const layer = ensureLayer();
    const kind = (opts && opts.kind) || 'score';
    const judgment = (opts && opts.judgment) || '';

    const el = doc.createElement('div');
    el.className =
      'hha-fx-text ' + (kind === 'judge'
        ? 'hha-fx-text-judge'
        : 'hha-fx-text-score');

    el.textContent = text;

    if (kind === 'judge') {
      const j = String(judgment || text || '').toUpperCase();
      if (j === 'PERFECT') el.classList.add('perfect');
      else if (j === 'GOOD') el.classList.add('good');
      else if (j === 'LATE') el.classList.add('late');
      else if (j === 'MISS') el.classList.add('miss');
      else if (j === 'BLOCK') el.classList.add('block');
    }

    const offsetX = kind === 'score' ? rand(-10, 10) : rand(-18, 18);
    const offsetY = kind === 'score' ? rand(-4, 4)  : rand(-14, 0);

    const baseScale = kind === 'judge' ? 1.0 : 0.95;
    const floatY    = kind === 'judge' ? -40 : -26;
    const life      = kind === 'judge' ? 650 : 580;

    el.style.left = (x + offsetX) + 'px';
    el.style.top  = (y + offsetY) + 'px';
    el.style.opacity = '0';
    el.style.transform =
      `translate3d(0,0,0) scale(${baseScale * 0.6})`;
    el.style.transition =
      `transform ${life}ms cubic-bezier(0.17,0.89,0.32,1.28),` +
      `opacity ${life}ms ease-out`;

    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform =
        `translate3d(0,${floatY}px,0) scale(${baseScale})`;
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform =
        `translate3d(0,${floatY - 10}px,0) scale(${baseScale * 0.9})`;
    }, life - 120);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, life + 100);
  }

  const api = { burstAt, scorePop, ensureLayer };
  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;

})(window);