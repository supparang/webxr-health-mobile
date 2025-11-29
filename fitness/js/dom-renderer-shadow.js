// === js/dom-renderer-shadow.js — Shadow Breaker DOM Renderer (2025-12-05) ===
'use strict';

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host;
    this.wrapEl = opts.wrapEl || document.body;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;
    this.diffKey = 'normal';
    this.targets = new Map();

    this._onPointer = this._onPointer.bind(this);
    this.host.addEventListener('pointerdown', this._onPointer);
  }

  setDifficulty(diff) {
    this.diffKey = diff || 'normal';
  }

  // ---------- TARGETS ----------
  spawnTarget(data) {
    if (!this.host) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';
    el.dataset.id = String(data.id);
    el.style.setProperty('--size', (data.sizePx || 120) + 'px');

    // กระจายให้ทั่วจอ gameplay
    const padX = 0.12;
    const padY = 0.15;
    const x = padX + Math.random() * (1 - padX * 2);
    const y = padY + Math.random() * (1 - padY * 2);
    el.style.left = (x * 100) + '%';
    el.style.top = (y * 100) + '%';

    const emo = document.createElement('span');
    emo.className = 'sb-target-emoji';

    if (data.isBossFace) {
      emo.textContent = data.bossEmoji || '👑';
    } else if (data.isBomb) {
      emo.textContent = '💣';
    } else if (data.isHeal) {
      emo.textContent = '💊';
    } else if (data.isShield) {
      emo.textContent = '🛡️';
    } else if (data.isDecoy) {
      emo.textContent = '🎭';
    } else {
      emo.textContent = '🥊';
    }

    el.appendChild(emo);
    this.host.appendChild(el);
    this.targets.set(data.id, el);
  }

  removeTarget(id /* , reason */) {
    const el = this.targets.get(id);
    if (!el) return;
    this.targets.delete(id);
    el.remove();
  }

  // ---------- HIT FX ----------
  playHitFx(id, payload = {}) {
    if (!this.host) return;

    const hostRect = this.host.getBoundingClientRect();
    const targetEl = this.targets.get(id);
    let cx, cy;

    if (targetEl) {
      const r = targetEl.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    } else if (payload.clientX != null && payload.clientY != null) {
      cx = payload.clientX;
      cy = payload.clientY;
    } else {
      cx = hostRect.left + hostRect.width / 2;
      cy = hostRect.top + hostRect.height / 2;
    }

    const localX = cx - hostRect.left;
    const localY = cy - hostRect.top;

    this._spawnHitParticle(localX, localY);
    if (typeof payload.scoreDelta === 'number' && payload.scoreDelta !== 0) {
      this._spawnScoreText(localX, localY, payload.scoreDelta, payload.grade);
    }
  }

  _spawnHitParticle(x, y) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const frag = document.createElement('div');
      frag.className = 'sb-frag';
      frag.style.left = x + 'px';
      frag.style.top = y + 'px';

      const ang = (Math.PI * 2 * i) / n;
      const dist = 40 + Math.random() * 30;
      const dur = 450 + Math.random() * 220;

      frag.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      frag.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      frag.style.setProperty('--dur', dur + 'ms');

      this.host.appendChild(frag);
      setTimeout(() => frag.remove(), dur + 100);
    }
  }

  _spawnScoreText(x, y, scoreDelta, grade) {
    const fx = document.createElement('div');
    fx.className = 'sb-score-fx';
    if (grade) fx.dataset.grade = grade;
    fx.textContent = (scoreDelta > 0 ? '+' : '') + scoreDelta;
    fx.style.left = x + 'px';
    fx.style.top = y + 'px';
    this.host.appendChild(fx);
    setTimeout(() => fx.remove(), 800);
  }

  // ---------- INPUT ----------
  _onPointer(ev) {
    const btn = ev.target.closest('.sb-target');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (!id) return;

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: ev.clientX, clientY: ev.clientY });
    }
  }

  destroy() {
    this.targets.forEach(el => el.remove());
    this.targets.clear();
    if (this.host) {
      this.host.removeEventListener('pointerdown', this._onPointer);
    }
  }

  // alias เก่า
  showHitFx(id, payload) {
    this.playHitFx(id, payload);
  }
}
