// === /herohealth/vr/particles.js ===
// FX layer กลางจอ: คะแนนเด้ง + คำตัดสิน + เป้าแตกกระจายแบบแรง ๆ
// ใช้ร่วมกับทุกเกม HeroHealth (GoodJunkVR, Hydration, Plate, Groups ฯลฯ)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  let fxLayer = null;
  let cssInjected = false;

  // สร้าง <style> สำหรับ FX (ครั้งเดียว)
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    const style = doc.createElement('style');
    style.textContent = `
      .hha-fx-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999;
        overflow: hidden;
      }

      .hha-frag {
        position: fixed;
        border-radius: 999px;
        pointer-events: none;
        will-change: transform, opacity;
        mix-blend-mode: screen;
      }

      .hha-fx-text {
        position: fixed;
        pointer-events: none;
        will-change: transform, opacity;
        white-space: nowrap;
        text-shadow: 0 0 12px rgba(15,23,42,0.9);
      }

      .hha-fx-text-score {
        font-size: 18px;
        font-weight: 700;
        color: #bbf7d0;
      }

      .hha-fx-text-judge {
        font-size: 20px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .hha-fx-text-judge.good {
        color: #4ade80;
      }
      .hha-fx-text-judge.perfect {
        color: #a855f7;
      }
      .hha-fx-text-judge.late {
        color: #fde047;
      }
      .hha-fx-text-judge.miss {
        color: #fb923c;
      }
      .hha-fx-text-judge.block {
        color: #60a5fa;
      }
    `;
    doc.head.appendChild(style);
  }

  // เลเยอร์ FX กลางจอ
  function ensureLayer() {
    if (fxLayer && fxLayer.parentNode) return fxLayer;
    injectCSS();
    fxLayer = doc.createElement('div');
    fxLayer.className = 'hha-fx-layer';
    doc.body.appendChild(fxLayer);
    return fxLayer;
  }

  // ----- Helper: random -----
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // ----- เป้าแตกกระจาย (burstAt) -----
  // opts: { color, count, radius }
  function burstAt(x, y, opts) {
    const layer = ensureLayer();
    const color = (opts && opts.color) || '#22c55e';
    const count = (opts && opts.count) || 18;
    const radius = (opts && opts.radius) || 80;

    // สร้างเศษ 2 ชั้นต่อ 1 ชิ้น (วงกลม + เส้น shard) ให้ดูแน่นขึ้น
    const total = Math.max(6, count);

    for (let i = 0; i < total; i++) {
      const baseAngle = (i / total) * Math.PI * 2;
      const jitter = rand(-0.35, 0.35);
      const ang = baseAngle + jitter;
      const dist = radius * rand(0.45, 1.0);

      // ชั้นที่ 1: กลมสว่าง
      spawnFrag(layer, x, y, ang, dist, {
        color,
        sizeMin: 10,
        sizeMax: 18,
        lifeMin: 450,
        lifeMax: 650,
        blur: 10
      });

      // ชั้นที่ 2: shard เส้นยาว ๆ พุ่งออก
      spawnFrag(layer, x, y, ang, dist * rand(0.8, 1.1), {
        color,
        sizeMin: 4,
        sizeMax: 7,
        lifeMin: 550,
        lifeMax: 750,
        stretch: true,
        blur: 4
      });
    }

    // แหวนกระแทกตรงกลาง
    spawnRing(layer, x, y, color);
  }

  function spawnFrag(layer, x, y, ang, dist, cfg) {
    const el = doc.createElement('div');
    el.className = 'hha-frag';

    const size = rand(cfg.sizeMin, cfg.sizeMax);
    const life = rand(cfg.lifeMin, cfg.lifeMax);

    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const tx = x + cos * dist;
    const ty = y + sin * dist;

    const blur = cfg.blur || 0;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x - size / 2 + 'px';
    el.style.top = y - size / 2 + 'px';
    el.style.opacity = '0.98';
    el.style.background = cfg.stretch
      ? `linear-gradient(90deg, ${cfg.color}, rgba(15,23,42,0))`
      : `radial-gradient(circle, ${cfg.color}, rgba(15,23,42,0))`;
    el.style.filter = blur ? `blur(${blur}px)` : 'none';

    const baseScale = cfg.stretch ? rand(1.2, 1.6) : rand(0.9, 1.3);
    const angleDeg = (ang * 180) / Math.PI;
    const rot = cfg.stretch ? angleDeg + rand(-12, 12) : rand(-30, 30);

    el.style.transform = `translate3d(0,0,0) scale(${baseScale})`;
    el.style.transition =
      `transform ${life}ms cubic-bezier(0.15,0.9,0.3,1.1),` +
      `opacity ${life}ms ease-out`;

    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform =
        `translate3d(${tx - x}px, ${ty - y}px, 0) ` +
        `scale(${cfg.stretch ? baseScale * 1.8 : baseScale * 1.4}) ` +
        `rotate(${rot}deg)`;
      el.style.opacity = '0';
    });

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, life + 40);
  }

  function spawnRing(layer, x, y, color) {
    const el = doc.createElement('div');
    el.className = 'hha-frag';

    const size = 48;
    const life = 520;

    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x - size / 2 + 'px';
    el.style.top = y - size / 2 + 'px';
    el.style.borderRadius = '999px';
    el.style.border = `2px solid ${color}`;
    el.style.boxShadow = `0 0 20px ${color}`;
    el.style.opacity = '0.9';
    el.style.background = 'transparent';
    el.style.transform = 'translate3d(0,0,0) scale(0.4)';
    el.style.transition =
      `transform ${life}ms ease-out, opacity ${life}ms ease-out`;

    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translate3d(0,0,0) scale(1.7)';
      el.style.opacity = '0';
    });

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, life + 40);
  }

  // ----- ตัวหนังสือคะแนน/คำตัดสิน (scorePop) -----
  // opts: { kind: 'score' | 'judge', judgment: 'PERFECT' | 'GOOD' | 'LATE' | 'MISS' | 'BLOCK' }
  function scorePop(x, y, text, opts) {
    const layer = ensureLayer();
    const kind = (opts && opts.kind) || 'score';
    const judgment = (opts && opts.judgment) || '';

    const el = doc.createElement('div');
    el.className = 'hha-fx-text ' + (kind === 'judge' ? 'hha-fx-text-judge' : 'hha-fx-text-score');
    el.textContent = text;

    let cls = '';
    if (kind === 'judge') {
      const j = String(judgment || text || '').toUpperCase();
      if (j === 'PERFECT') cls = 'perfect';
      else if (j === 'GOOD') cls = 'good';
      else if (j === 'LATE') cls = 'late';
      else if (j === 'MISS') cls = 'miss';
      else if (j === 'BLOCK') cls = 'block';
    }
    if (cls) el.classList.add(cls);

    const offsetX = kind === 'score' ? rand(-12, 12) : rand(-20, 20);
    const offsetY = kind === 'score' ? rand(-6, 4) : rand(-16, 0);

    const baseScale = kind === 'judge' ? 1.0 : 0.95;
    const floatY = kind === 'judge' ? -40 : -26;
    const life = kind === 'judge' ? 650 : 580;

    el.style.left = x + offsetX + 'px';
    el.style.top = y + offsetY + 'px';
    el.style.opacity = '0';
    el.style.transform =
      `translate3d(0,0,0) scale(${baseScale * 0.7})`;
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
    }, life + 80);
  }

  const api = {
    ensureLayer,
    burstAt,
    scorePop
  };

  root.Particles = api;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = api;

})(window);