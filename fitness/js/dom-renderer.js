// === fitness/js/dom-renderer.js (2025-11-21 SAFE AREA + SHARDS) ===
'use strict';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host;
    this.sizePx = opts.sizePx || 96;
    this.targets = new Map();

    this.handleClick = this.handleClick.bind(this);
    this.updateBounds = this.updateBounds.bind(this);

    this.updateBounds();
    window.addEventListener('resize', this.updateBounds);
  }

  updateBounds() {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.bounds = { w: rect.width || 1, h: rect.height || 1 };
  }

  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(t.id);
    el.dataset.type = t.decoy ? 'bad' : 'good';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🎯';
    el.appendChild(inner);

    const size = this.sizePx;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.marginLeft = -(size / 2) + 'px';
    el.style.marginTop = -(size / 2) + 'px';

    // SAFE AREA: กันไม่ให้ทับ HUD ด้านบน / FEVER ด้านล่าง
    const padTop = 140;   // เว้นจากขอบบนลงมา ~ HUD + margin
    const padBottom = 120; // เว้นจากขอบล่างขึ้นไป ~ FEVER + controls
    const padSide = 24;

    const x = padSide + Math.random() * (this.bounds.w - padSide * 2);
    const usableH = Math.max(40, this.bounds.h - padTop - padBottom);
    const y = padTop + Math.random() * usableH;

    el.style.left = x + 'px';
    el.style.top = y + 'px';

    el.addEventListener('pointerdown', this.handleClick);
    this.host.appendChild(el);

    t.dom = el;
    this.targets.set(t.id, el);
  }

  handleClick(ev) {
    const el = ev.currentTarget;
    if (!el || !this.host) return;

    const id = parseInt(el.dataset.id || '0', 10);
    if (!id) return;

    const rect = this.host.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    this.game.registerTouch(x, y, id);
  }

  removeTarget(t) {
    const el = t && t.dom;
    if (el) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.delete(t.id);
  }

  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    // ให้ตัวเป้าเล่น animation hit/miss
    if (t.dom) {
      if (opts.miss) t.dom.classList.add('sb-miss');
      else           t.dom.classList.add('sb-hit');
      setTimeout(() => {
        if (!t.dom) return;
        t.dom.classList.remove('sb-hit');
        t.dom.classList.remove('sb-miss');
      }, 200);
    }

    // คำนวณจุดกึ่งกลางของเป้าใน host
    const hostRect = this.host.getBoundingClientRect();
    let cx = hostRect.width / 2;
    let cy = hostRect.height / 2;

    if (t.dom) {
      const r = t.dom.getBoundingClientRect();
      cx = r.left - hostRect.left + r.width / 2;
      cy = r.top - hostRect.top + r.height / 2;
    }

    // คะแนนลอยขึ้น "ตรงเป้า"
    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    const score = opts.score || 0;
    let text = score === 0 ? '' : (score > 0 ? '+' + score : String(score));
    if (opts.miss) text = 'MISS';
    if (opts.decoy && score < 0) text = String(score);

    if (opts.miss) {
      fx.classList.add('sb-miss');
    } else if (score > 0 && opts.fever) {
      fx.classList.add('sb-perfect');
    } else if (score > 0) {
      fx.classList.add('sb-good');
    }

    fx.textContent = text;
    fx.style.left = cx + 'px';
    fx.style.top  = cy + 'px';

    this.host.appendChild(fx);
    setTimeout(() => {
      if (fx.parentNode === this.host) this.host.removeChild(fx);
    }, 700);

    // แตกกระจายเป็นชิ้น ๆ รอบเป้า
    const shardCount = 6;
    for (let i = 0; i < shardCount; i++) {
      const shard = document.createElement('div');
      shard.className = 'sb-shard';
      shard.textContent = t.decoy ? '✖' : '▾';

      const angle = (Math.PI * 2 * i) / shardCount + Math.random() * 0.4;
      const dist  = 20 + Math.random() * 16;

      shard.style.left = cx + 'px';
      shard.style.top  = cy + 'px';
      shard.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      shard.style.setProperty('--dy', Math.sin(angle) * dist + 'px');

      this.host.appendChild(shard);
      setTimeout(() => {
        if (shard.parentNode === this.host) this.host.removeChild(shard);
      }, 420);
    }
  }

  clear() {
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.clear();
  }
}