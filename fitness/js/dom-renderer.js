// === js/dom-renderer.js — Shadow Breaker DOM renderer (2025-11-24) ===
'use strict';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host;
    this.sizePx = opts.sizePx || 110;

    this._bounds = null;
    this._onPtrDown = this.onPointerDown.bind(this);

    if (this.host) {
      this.host.addEventListener('pointerdown', this._onPtrDown);
      this.updateBounds();
    }

    window.addEventListener('resize', () => this.updateBounds());
  }

  updateBounds() {
    if (!this.host) return;
    this._bounds = this.host.getBoundingClientRect();
  }

  clear() {
    if (!this.host) return;
    this.host.innerHTML = '';
  }

  /* ---------------------------------------------------------- */
  /*  Spawn target                                              */
  /* ---------------------------------------------------------- */
  spawnTarget(t) {
    if (!this.host) return;

    if (!this._bounds) this.updateBounds();
    const rect = this._bounds || this.host.getBoundingClientRect();

    const pad = this.sizePx * 0.7;
    const w = rect.width  || 400;
    const h = rect.height || 260;

    const x = pad + Math.random() * Math.max(10, w - pad * 2);
    const y = pad + Math.random() * Math.max(10, h - pad * 2);

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(t.id);

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🥊';
    el.appendChild(inner);

    el.style.width  = this.sizePx + 'px';
    el.style.height = this.sizePx + 'px';
    el.style.left   = x + 'px';
    el.style.top    = y + 'px';

    // type flags
    if (t.decoy) el.dataset.type = 'bad';
    if (t.bossFace) el.dataset.bossFace = '1';

    // เก็บพิกัด normalized ไว้ใช้ใน CSV
    t.x_norm = w ? x / w : 0.5;
    t.y_norm = h ? y / h : 0.5;

    t._el = el;

    this.host.appendChild(el);
  }

  /* ---------------------------------------------------------- */
  /*  Pointer handler                                           */
  /* ---------------------------------------------------------- */
  onPointerDown(ev) {
    if (!this.game || !this.game.running) return;
    if (!this.host) return;

    const targetEl = ev.target.closest('.sb-target');
    if (!targetEl || !this.host.contains(targetEl)) return;

    const id = Number(targetEl.dataset.id || '0');
    if (!id) return;

    const hostRect = this.host.getBoundingClientRect();
    const x = ev.clientX - hostRect.left;
    const y = ev.clientY - hostRect.top;

    this.game.registerTouch(x, y, id);
  }

  /* ---------------------------------------------------------- */
  /*  Remove target (ใช้ทั้งโดนตีและ Miss timeout)            */
  /* ---------------------------------------------------------- */
  removeTarget(t) {
    if (!t || !t._el) return;
    const el = t._el;
    t._el = null;

    el.classList.add('sb-hit');
    el.style.pointerEvents = 'none';

    // ให้เล่น animation ก่อนแล้วค่อยลบออกจาก DOM
    setTimeout(() => {
      if (el.parentNode === this.host) {
        this.host.removeChild(el);
      }
    }, 220);
  }

  /* ---------------------------------------------------------- */
  /*  Hit / Miss / Decoy effects                                */
  /* ---------------------------------------------------------- */
  spawnHitEffect(t, opts = {}) {
    if (!this.host || !t || !t._el) return;

    const el = t._el;
    const hostRect = this.host.getBoundingClientRect();
    const rect = el.getBoundingClientRect();

    const cx = rect.left + rect.width / 2 - hostRect.left;
    const cy = rect.top + rect.height / 2 - hostRect.top;

    // 1) particle 💥 / 💣
    const particle = document.createElement('div');
    particle.className = 'hitParticle';
    particle.textContent = opts.decoy ? '💣' : '💥';
    particle.style.left = cx + 'px';
    particle.style.top  = cy + 'px';
    this.host.appendChild(particle);
    setTimeout(() => {
      if (particle.parentNode === this.host) {
        this.host.removeChild(particle);
      }
    }, 480);

    // 2) score popup
    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    let text = '';
    if (opts.miss) {
      fx.classList.add('sb-miss');
      text = 'MISS';
    } else if (opts.decoy) {
      fx.classList.add('sb-decoy');
      text = `-${Math.abs(opts.score || 0)}`;
    } else {
      const g = opts.grade || 'good';
      const sc = opts.score || 0;
      if (g === 'perfect') {
        fx.classList.add('sb-perfect');
        text = `+${sc} PERFECT`;
      } else if (g === 'good') {
        fx.classList.add('sb-good');
        text = `+${sc}`;
      } else {
        fx.classList.add('sb-miss');
        text = `+${sc}`;
      }
    }

    fx.textContent = text;
    fx.style.left = cx + 'px';
    fx.style.top  = cy + 'px';
    this.host.appendChild(fx);

    setTimeout(() => {
      if (fx.parentNode === this.host) {
        this.host.removeChild(fx);
      }
    }, 650);
  }
}
