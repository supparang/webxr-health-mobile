// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ supports spawnHint {zone,biasX,biasY,tag}
// ✅ avoids HUD overlap + corner clumps

'use strict';

export class DomRendererShadow {
  constructor(targetLayer, opts = {}) {
    this.layer = targetLayer;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

    this._onPointer = this._onPointer.bind(this);
    this.layer.addEventListener('pointerdown', this._onPointer, { passive: true });

    // cached rect
    this.lastRectAt = 0;
    this.rect = null;
  }

  setDifficulty(key) {
    this.diffKey = key || 'normal';
  }

  _getRect() {
    const now = performance.now();
    if (!this.rect || now - this.lastRectAt > 200) {
      this.rect = this.layer.getBoundingClientRect();
      this.lastRectAt = now;
    }
    return this.rect;
  }

  _zoneToRange(z) {
    // 0 TL,1 TR,2 CL,3 CR,4 BL,5 BR
    // returns [x0,x1,y0,y1] in 0..1
    const left = [0.06, 0.48];
    const right = [0.52, 0.94];
    const top = [0.10, 0.38];
    const mid = [0.40, 0.62];
    const bot = [0.64, 0.90];

    switch (z) {
      case 0: return [left[0], left[1], top[0], top[1]];
      case 1: return [right[0], right[1], top[0], top[1]];
      case 2: return [left[0], left[1], mid[0], mid[1]];
      case 3: return [right[0], right[1], mid[0], mid[1]];
      case 4: return [left[0], left[1], bot[0], bot[1]];
      case 5: return [right[0], right[1], bot[0], bot[1]];
      default: return [0.08, 0.92, 0.12, 0.88];
    }
  }

  _rand(min, max) {
    return min + Math.random() * (max - min);
  }

  _pickPos(sizePx, hint) {
    const rect = this._getRect();
    const pad = Math.max(10, Math.min(18, rect.width * 0.02));

    // safe area shrink to avoid edges + HUD
    const W = rect.width;
    const H = rect.height;

    const sz = Math.max(44, sizePx);
    const half = sz / 2;

    // zone range
    const z = hint && typeof hint.zone === 'number' ? hint.zone : null;
    const [x0n, x1n, y0n, y1n] = (z != null) ? this._zoneToRange(z) : [0.08,0.92,0.12,0.88];

    // convert to pixels
    let x0 = x0n * W, x1 = x1n * W;
    let y0 = y0n * H, y1 = y1n * H;

    // apply padding
    x0 = Math.max(pad + half, x0);
    x1 = Math.min(W - pad - half, x1);
    y0 = Math.max(pad + half, y0);
    y1 = Math.min(H - pad - half, y1);

    // bias
    const bx = (hint && hint.biasX) ? hint.biasX : 0;
    const by = (hint && hint.biasY) ? hint.biasY : 0;

    let x = this._rand(x0, x1) + bx * W;
    let y = this._rand(y0, y1) + by * H;

    // clamp again
    x = Math.max(pad + half, Math.min(W - pad - half, x));
    y = Math.max(pad + half, Math.min(H - pad - half, y));

    // avoid clump: push away from last few targets
    const recent = Array.from(this.targets.values()).slice(-5);
    for (let k = 0; k < recent.length; k++) {
      const t = recent[k];
      const dx = x - t.x;
      const dy = y - t.y;
      const d2 = dx*dx + dy*dy;
      const minD = Math.max(60, sz * 0.78);
      if (d2 < minD * minD) {
        // nudge
        x = x + (dx >= 0 ? 1 : -1) * minD * 0.35;
        y = y + (dy >= 0 ? 1 : -1) * minD * 0.35;
        x = Math.max(pad + half, Math.min(W - pad - half, x));
        y = Math.max(pad + half, Math.min(H - pad - half, y));
      }
    }

    return { x, y };
  }

  spawnTarget(data) {
    if (!data || !this.layer) return;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';
    el.dataset.tid = String(data.id);
    el.dataset.kind = data.type;

    if (data.isBossFace) el.classList.add('is-bossface');
    if (data.isBomb) el.classList.add('is-bomb');
    if (data.isDecoy) el.classList.add('is-decoy');
    if (data.isHeal) el.classList.add('is-heal');
    if (data.isShield) el.classList.add('is-shield');

    const size = Math.max(52, Math.round(data.sizePx || 110));
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // text/emoji
    let txt = '🥊';
    if (data.isBossFace) txt = (data.bossEmoji || '👊');
    else if (data.isBomb) txt = '💣';
    else if (data.isDecoy) txt = '🎭';
    else if (data.isHeal) txt = '🩹';
    else if (data.isShield) txt = '🛡️';
    else txt = '🎯';

    el.innerHTML = `<span class="sb-target-emoji">${txt}</span>`;

    // position
    const hint = data.spawnHint || null;
    const pos = this._pickPos(size, hint);
    el.style.left = (pos.x - size/2) + 'px';
    el.style.top = (pos.y - size/2) + 'px';

    // store
    this.targets.set(data.id, { id: data.id, el, x: pos.x, y: pos.y, size });

    this.layer.appendChild(el);

    // pop-in animation via css class
    requestAnimationFrame(() => el.classList.add('is-live'));
  }

  removeTarget(id, reason) {
    const t = this.targets.get(id);
    if (!t) return;
    const el = t.el;
    this.targets.delete(id);
    if (!el) return;

    el.classList.add('is-out');
    setTimeout(() => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 140);
  }

  playHitFx(id, fx) {
    const t = this.targets.get(id);
    if (!t) return;

    // small floating text
    const tag = document.createElement('div');
    tag.className = 'sb-fx';
    const delta = fx?.scoreDelta || 0;
    const grade = fx?.grade || '';
    tag.textContent = (delta >= 0 ? `+${delta}` : `${delta}`) + (grade ? ` ${grade.toUpperCase()}` : '');
    tag.style.left = (t.x) + 'px';
    tag.style.top = (t.y - 10) + 'px';
    this.layer.appendChild(tag);
    setTimeout(() => tag.remove(), 520);
  }

  _onPointer(e) {
    const el = e.target && e.target.closest ? e.target.closest('.sb-target') : null;
    if (!el) return;

    const id = Number(el.dataset.tid || '0');
    if (!id) return;

    if (typeof this.onTargetHit === 'function') {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY });
    }
  }

  destroy() {
    try {
      if (this.layer) this.layer.removeEventListener('pointerdown', this._onPointer);
    } catch(e) {}
    for (const id of this.targets.keys()) this.removeTarget(id, 'destroy');
    this.targets.clear();
  }
}