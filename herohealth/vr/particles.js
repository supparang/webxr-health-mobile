// === /herohealth/vr/particles.js ===
// Simple FX layer: score pop + judgment text + target burst
// ใช้ได้กับทุกเกม HeroHealth (GoodJunkVR, Hydration, Plate, Groups ฯลฯ)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // ----- สร้างเลเยอร์ FX กลางจอ -----
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: '60'
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  // ----- ช่วยสร้าง div -----
  function makeDiv(cls, text) {
    const el = doc.createElement('div');
    el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  // =====================================================
  //  Score pop: คะแนน + คำตัดสิน เด้งขึ้นตรงจุดตีเป้า
  // =====================================================
  function scorePop(x, y, text, opts = {}) {
    const layer = ensureLayer();

    const good = !!opts.good;
    const judgment = (opts.judgment || '').toString().trim();

    const wrap = makeDiv('hha-fx-score-wrap');
    const scoreEl = makeDiv('hha-fx-score');
    scoreEl.textContent = text;

    if (good) {
      wrap.classList.add('is-good');
    } else {
      wrap.classList.add('is-bad');
    }

    // คำตัดสิน (MISS / GOOD / PERFECT / FEVER / BLOCK ฯลฯ)
    let judgeEl = null;
    if (judgment) {
      judgeEl = makeDiv('hha-fx-judge', judgment);
      // ให้สีตามประเภทคร่าว ๆ
      const j = judgment.toUpperCase();
      if (j === 'MISS' || j === 'LATE' || j === 'BAD') {
        judgeEl.classList.add('judge-miss');
      } else if (j === 'GOOD' || j === 'HIT') {
        judgeEl.classList.add('judge-good');
      } else if (j === 'PERFECT') {
        judgeEl.classList.add('judge-perfect');
      } else if (j === 'FEVER') {
        judgeEl.classList.add('judge-fever');
      } else if (j === 'BLOCK') {
        judgeEl.classList.add('judge-block');
      }
    }

    wrap.appendChild(scoreEl);
    if (judgeEl) wrap.appendChild(judgeEl);

    // จัดตำแหน่งรอบ ๆ จุดคลิก
    const dx = (Math.random() - 0.5) * 24;
    const dy = (Math.random() - 0.5) * 10;
    wrap.style.left = (x + dx) + 'px';
    wrap.style.top = (y + dy) + 'px';

    layer.appendChild(wrap);

    // เอาออกหลัง animation จบ
    const ttl = 900;
    setTimeout(() => {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }, ttl);
  }

  // =====================================================
  //  Burst effect: เป้าแตกกระจายรอบจุดตีเป้า
  // =====================================================
  function burstAt(x, y, opts = {}) {
    const layer = ensureLayer();
    const color = opts.color || '#22c55e';
    const count = opts.count || 14;

    for (let i = 0; i < count; i++) {
      const p = makeDiv('hha-fx-frag');
      const ang = (Math.PI * 2 * i) / count;
      const dist = 24 + Math.random() * 26;
      const size = 4 + Math.random() * 5;

      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = color;
      p.style.setProperty('--hha-fx-dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--hha-fx-dy', Math.sin(ang) * dist + 'px');

      layer.appendChild(p);

      setTimeout(() => {
        if (p.parentNode) p.parentNode.removeChild(p);
      }, 500);
    }
  }

  // export ให้เกมอื่นใช้
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = {
    scorePop,
    burstAt
  };

  // เผื่อโค้ดเก่าเรียก root.Particles
  root.Particles = root.Particles || root.GAME_MODULES.Particles;
})(window);