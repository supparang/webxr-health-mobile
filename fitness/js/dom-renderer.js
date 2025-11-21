// === fitness/js/dom-renderer.js (2025-11-20 SCORE@TARGET) ===
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
    this.bounds = {
      w: rect.width || 1,
      h: rect.height || 1
    };
  }

  // สร้างเป้าใหม่แบบ emoji ตรงกลางจอ
  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const box = document.createElement('div');
    box.className = 'sb-target';
    box.dataset.id = String(t.id);
    box.dataset.type = t.decoy ? 'bad' : 'good';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || (t.decoy ? '💣' : '🥊');
    box.appendChild(inner);

    const size = this.sizePx;
    box.style.width = size + 'px';
    box.style.height = size + 'px';

    // สุ่มตำแหน่งในกรอบ แต่กันขอบ 32px
    const margin = 32;
    const w = Math.max(10, this.bounds.w - margin * 2);
    const h = Math.max(10, this.bounds.h - margin * 2);
    const x = margin + Math.random() * w;
    const y = margin + Math.random() * h;

    box.style.left = x + 'px';
    box.style.top  = y + 'px';

    box.addEventListener('pointerdown', this.handleClick);
    this.host.appendChild(box);

    t.dom = box;
    this.targets.set(t.id, box);
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
      if (el.parentNode === this.host) el.parentNode.removeChild(el);
    }
    this.targets.delete(t.id);
  }

  // เอฟเฟกต์ตอนตีโดน: เป้าแตก + คะแนนเด้งตรงตำแหน่งเป้า
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    const el = t && t.dom;
    if (el) {
      el.classList.add('sb-target-hit');
      setTimeout(() => {
        el.classList.remove('sb-target-hit');
      }, 260);
    }

    const hostRect = this.host.getBoundingClientRect();
    let x = hostRect.width / 2;
    let y = hostRect.height / 2;

    if (el) {
      const r = el.getBoundingClientRect();
      x = r.left - hostRect.left + r.width / 2;
      y = r.top  - hostRect.top  + r.height / 2;
    }

    const score = typeof opts.score === 'number' ? opts.score : 0;

    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    // ตั้งสี/ข้อความตามเกรด
    if (opts.miss) {
      fx.classList.add('sb-miss');
      fx.textContent = 'MISS';
    } else if (opts.decoy && score < 0) {
      fx.classList.add('sb-miss');
      fx.textContent = String(score);
    } else {
      if (opts.grade === 'perfect') fx.classList.add('sb-perfect');
      else if (opts.grade === 'good') fx.classList.add('sb-good');
      else fx.classList.add('sb-miss');

      fx.textContent = score > 0 ? '+' + score : (score || '');
    }

    fx.style.left = x + 'px';
    fx.style.top  = y + 'px';

    this.host.appendChild(fx);
    setTimeout(() => {
      if (fx.parentNode === this.host) this.host.removeChild(fx);
    }, 650);
  }

  clear() {
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) el.parentNode.removeChild(el);
    }
    this.targets.clear();
  }
}