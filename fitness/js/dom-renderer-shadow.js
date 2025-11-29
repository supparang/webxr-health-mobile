// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (2025-12-XX) ===
'use strict';

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host;
    this.wrapEl = opts.wrapEl || document.body;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';
  }

  setDifficulty(key) {
    this.diffKey = key || 'normal';
  }

  // ----- SPAWN -----
  spawnTarget(data) {
    if (!this.host) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';
    if (data.isBossFace) el.classList.add('sb-target-boss');
    if (data.isBomb) el.classList.add('sb-target-bomb');
    if (data.isDecoy) el.classList.add('sb-target-decoy');

    el.dataset.id = String(data.id);

    const emo = document.createElement('span');
    emo.className = 'sb-target-emoji';
    emo.textContent = data.isBossFace
      ? (data.bossEmoji || '🥊')
      : data.isBomb
      ? '💣'
      : '🥊';
    el.appendChild(emo);

    const size = data.sizePx || 110;
    el.style.setProperty('--sb-target-size', size + 'px');

    // กระจายเป้าให้เต็มพื้นที่ แต่เว้นขอบ
    const hostRect = this.host.getBoundingClientRect();
    const padX = hostRect.width * 0.12;
    const padY = hostRect.height * 0.18;
    const availableW = Math.max(20, hostRect.width - padX * 2);
    const availableH = Math.max(20, hostRect.height - padY * 2);

    const x = padX + Math.random() * availableW;
    const y = padY + Math.random() * availableH;

    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const clickHandler = (ev) => {
      if (this.onTargetHit) {
        this.onTargetHit(data.id, {
          clientX: ev.clientX,
          clientY: ev.clientY
        });
      }
    };
    el.addEventListener('click', clickHandler);

    data._el = el;
    data._clickHandler = clickHandler;
    this.targets.set(data.id, data);

    this.host.appendChild(el);
  }

  // ----- REMOVE -----
  removeTarget(id /* reason */) {
    const data = this.targets.get(id);
    if (!data) return;
    const el = data._el;
    if (el && el.parentNode) {
      el.removeEventListener('click', data._clickHandler);
      el.parentNode.removeChild(el);
    }
    this.targets.delete(id);
  }

  // ----- FX -----
  playHitFx(id, opts = {}) {
    const data = this.targets.get(id);
    if (!this.host) return;

    const hostRect = this.host.getBoundingClientRect();
    let x = opts.clientX;
    let y = opts.clientY;

    if ((!x || !y) && data && data._el) {
      const r = data._el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    if (!x || !y) return;

    const localX = x - hostRect.left;
    const localY = y - hostRect.top;

    this.spawnHitParticles(localX, localY, opts.grade);
    this.spawnScoreFx(localX, localY, opts.scoreDelta, opts.grade);
  }

  spawnHitParticles(x, y /* grade */) {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'sb-frag';
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';

      const angle = (i / count) * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;

      dot.style.setProperty('--sb-frag-dx', dx + 'px');
      dot.style.setProperty('--sb-frag-dy', dy + 'px');

      this.host.appendChild(dot);

      setTimeout(() => {
        if (dot.parentNode) dot.parentNode.removeChild(dot);
      }, 620);
    }
  }

  spawnScoreFx(x, y, delta, grade) {
    if (delta == null) return;
    const fx = document.createElement('div');
    fx.className = 'sb-score-fx';
    if (grade) fx.classList.add('grade-' + grade);
    fx.textContent = (delta > 0 ? '+' : '') + delta;
    fx.style.left = x + 'px';
    fx.style.top = y + 'px';

    this.host.appendChild(fx);

    setTimeout(() => {
      if (fx.parentNode) fx.parentNode.removeChild(fx);
    }, 820);
  }

  destroy() {
    for (const [, data] of this.targets) {
      const el = data._el;
      if (el && el.parentNode) {
        el.removeEventListener('click', data._clickHandler);
        el.parentNode.removeChild(el);
      }
    }
    this.targets.clear();
  }
}
