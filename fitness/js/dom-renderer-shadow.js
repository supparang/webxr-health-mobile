'use strict';

import { burstText, burstRing } from './fx-burst.js';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layerEl = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    if (this.layerEl) {
      this.layerEl.addEventListener('pointerdown', this._onPointerDown, { passive: true });
      window.addEventListener('keydown', this._onKeyDown);
    }
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  destroy() {
    if (this.layerEl) {
      this.layerEl.removeEventListener('pointerdown', this._onPointerDown);
    }
    window.removeEventListener('keydown', this._onKeyDown);

    // remove nodes
    for (const [id, el] of this.targets) {
      try { el.remove(); } catch {}
    }
    this.targets.clear();
  }

  spawnTarget(data) {
    if (!this.layerEl || !data) return;

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(data.id);

    if (data.isBomb) el.classList.add('is-bomb');
    if (data.isDecoy) el.classList.add('is-decoy');
    if (data.isHeal) el.classList.add('is-heal');
    if (data.isShield) el.classList.add('is-shield');
    if (data.isBossFace) el.classList.add('is-bossface');

    const emoji = document.createElement('div');
    emoji.className = 'emoji';

    if (data.isBomb) emoji.textContent = '💣';
    else if (data.isDecoy) emoji.textContent = '👻';
    else if (data.isHeal) emoji.textContent = '🩹';
    else if (data.isShield) emoji.textContent = '🛡️';
    else if (data.isBossFace) emoji.textContent = data.bossEmoji || '🥊';
    else emoji.textContent = '🎯';

    el.appendChild(emoji);

    // position random but safe
    const r = this.layerEl.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const size = data.sizePx || 120;

    const pad = Math.max(10, size * 0.55);
    const x = clamp(Math.random() * w, pad, w - pad);
    const y = clamp(Math.random() * h, pad, h - pad);

    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    this.layerEl.appendChild(el);
    this.targets.set(data.id, el);
  }

  removeTarget(id, reason) {
    const el = this.targets.get(id);
    if (!el) return;
    this.targets.delete(id);
    try { el.remove(); } catch {}
  }

  playHitFx(id, fx) {
    // fx: {grade, scoreDelta, clientX, clientY}
    const grade = fx && fx.grade ? fx.grade : 'good';
    const scoreDelta = fx && fx.scoreDelta != null ? fx.scoreDelta : 0;

    const x = fx && fx.clientX != null ? fx.clientX : (window.innerWidth/2);
    const y = fx && fx.clientY != null ? fx.clientY : (window.innerHeight/2);

    const label =
      scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`;

    burstText(x, y, label, grade);
    burstRing(x, y, grade);
  }

  // ===== Input handling =====
  _onPointerDown(e) {
    const t = e.target.closest('.sb-target');
    if (!t) return;
    const id = Number(t.dataset.id);
    if (!id) return;

    if (typeof this.onTargetHit === 'function') {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY, source: 'pointer' });
    }
  }

  _onKeyDown(e) {
    // debug: space hit nearest target
    if (e.code !== 'Space') return;
    if (!this.layerEl) return;

    let best = null;
    let bestD = 1e9;
    const r = this.layerEl.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    for (const [id, el] of this.targets) {
      const br = el.getBoundingClientRect();
      const ex = br.left + br.width/2;
      const ey = br.top + br.height/2;
      const d = (ex-cx)*(ex-cx) + (ey-cy)*(ey-cy);
      if (d < bestD) { bestD = d; best = id; }
    }

    if (best && typeof this.onTargetHit === 'function') {
      this.onTargetHit(best, { clientX: cx, clientY: cy, source: 'space' });
    }
  }
}