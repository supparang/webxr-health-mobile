// === js/dom-renderer.js — DOM target renderer + FX (Shadow Breaker v7) ===
'use strict';

export class DomRenderer {
  /**
   * @param {ShadowBreakerGame} game
   * @param {HTMLElement} host - #target-layer
   * @param {Object} opts
   */
import { spawnHitParticle } from './particle.js';
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host || null;
    this.sizePx = opts.sizePx || 100;

    if (this.host) {
      // ให้ layer ซ้อนเต็ม field
      const st = this.host.style;
      st.position = 'absolute';
      st.inset = '0';
      st.pointerEvents = 'auto';
    }
  }

  setHost(host) {
    this.host = host;
    if (this.host) {
      const st = this.host.style;
      st.position = 'absolute';
      st.inset = '0';
      st.pointerEvents = 'auto';
    }
  }

  clear() {
    if (!this.host) return;
    this.host.innerHTML = '';
  }

  /**
   * สร้างเป้าใหม่บนจอ
   * @param {Object} target - object จาก engine (t)
   */
  spawnTarget(target) {
    if (!this.host) return;

    const fieldRect = this.host.getBoundingClientRect();
    const w = fieldRect.width  || 1;
    const h = fieldRect.height || 1;

    // padding เล็กน้อย ไม่ให้ชิดขอบเกินไป
    const padX = w * 0.08;
    const padY = h * 0.10;

    let x = padX + Math.random() * Math.max(10, w - padX * 2);
    let y = padY + Math.random() * Math.max(10, h - padY * 2);

    if (!isFinite(x) || !isFinite(y)) {
      x = w / 2;
      y = h / 2;
    }

    // เก็บตำแหน่งล่าสุด (ใช้คำนวณ zone / x_norm / y_norm)
    target.lastPos = { x, y };

    // ขนาดเป้า (px)
    const size = target.size_px || this.sizePx;
    target.size_px = size;

    // แปลงเป็น %
    const nx = w > 0 ? (x / w) * 100 : 50;
    const ny = h > 0 ? (y / h) * 100 : 50;

    const outer = document.createElement('div');
    outer.className = 'sb-target';
    outer.dataset.id = String(target.id);

    if (target.decoy) outer.dataset.type = 'bad';
    if (target.bossFace) outer.dataset.bossFace = '1';

    outer.style.width = size + 'px';
    outer.style.height = size + 'px';
    outer.style.left = nx + '%';
    outer.style.top  = ny + '%';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = target.emoji || '🥊';
    outer.appendChild(inner);

    const onPtrDown = (ev) => {
      ev.preventDefault();
      if (!this.game || !this.host) return;

      const r = this.host.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;

      // update จุดตีจริง
      target.lastPos = { x: px, y: py };

      this.game.registerTouch(px, py, target.id);
    };

    outer.addEventListener('pointerdown', onPtrDown, { passive: false });

    target._el = outer;
    target._onPtr = onPtrDown;

    this.host.appendChild(outer);
  }

  /**
   * เอฟเฟกต์ตอนตีเป้าโดน / miss / bomb
   * @param {Object} target
   * @param {Object} opts { grade, score, fever, bossFace, decoy, miss }
   */
  spawnHitEffect(target, opts = {}) {
    if (!this.host) return;

    const fieldRect = this.host.getBoundingClientRect();
    const w = fieldRect.width  || 1;
    const h = fieldRect.height || 1;

    let x = target?.lastPos?.x;
    let y = target?.lastPos?.y;

    if (!isFinite(x) || !isFinite(y)) {
      x = w / 2;
      y = h / 2;
    }

    const nx = w > 0 ? (x / w) * 100 : 50;
    const ny = h > 0 ? (y / h) * 100 : 50;

    // ---- Score popup ----
    const fxScore = document.createElement('div');
    fxScore.className = 'sb-fx-score';

    let label = '';
    if (opts.miss) {
      label = 'MISS';
      fxScore.classList.add('sb-miss');
    } else if (opts.decoy) {
      label = '-60';
      fxScore.classList.add('sb-decoy');
    } else if (opts.grade === 'perfect') {
      label = `+${opts.score ?? 0} PERFECT`;
      fxScore.classList.add('sb-perfect');
    } else if (opts.grade === 'good') {
      label = `+${opts.score ?? 0}`;
      fxScore.classList.add('sb-good');
    } else {
      const sc = (opts.score ?? 0);
      label = sc >= 0 ? `+${sc}` : String(sc);
    }

    fxScore.textContent = label;
    fxScore.style.left = nx + '%';
    fxScore.style.top  = (ny - 4) + '%';

    // ---- Emoji particle ----
    const particle = document.createElement('div');
    particle.className = 'hitParticle';
    particle.textContent = opts.decoy
      ? '💥'
      : opts.miss
        ? '💦'
        : opts.bossFace
          ? '💫'
          : '✨';
    particle.style.left = nx + '%';
    particle.style.top  = ny + '%';

    // ---- Neon ring ----
    const neon = document.createElement('div');
    neon.className = 'sb-neon-hit';
    neon.style.left = nx + '%';
    neon.style.top  = ny + '%';

    this.host.appendChild(fxScore);
    this.host.appendChild(particle);
    this.host.appendChild(neon);

    // ลบ effect หลังจบ animation
    setTimeout(() => {
      fxScore.remove();
      particle.remove();
      neon.remove();
    }, 650);
  }
}