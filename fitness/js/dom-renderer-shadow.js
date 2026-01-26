// === js/dom-renderer-shadow.js — DOM target renderer (safe bounds + hit FX) ===
'use strict';

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layerEl = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    this.targets = new Map();

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onResize = this._onResize.bind(this);

    if (this.layerEl) {
      this.layerEl.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    }
    window.addEventListener('resize', this._onResize, { passive: true });
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  destroy() {
    try {
      if (this.layerEl) this.layerEl.removeEventListener('pointerdown', this._onPointerDown);
      window.removeEventListener('resize', this._onResize);
    } catch (_) {}
    for (const id of this.targets.keys()) this.removeTarget(id, 'destroy');
    this.targets.clear();
  }

  _onResize() {
    // no-op for now (spawn uses %)
  }

  _layerRect() {
    if (!this.layerEl) return null;
    return this.layerEl.getBoundingClientRect();
  }

  _rand(min, max) {
    return min + Math.random() * (max - min);
  }

  _pickPosPct(sizePx) {
    const rect = this._layerRect();
    // fallback safe
    if (!rect || rect.width < 50 || rect.height < 50) {
      return { leftPct: this._rand(18, 82), topPct: this._rand(18, 82) };
    }

    // Padding based on size (avoid edges)
    const padPx = Math.max(18, Math.min(56, sizePx * 0.22));
    const minX = padPx / rect.width;
    const maxX = 1 - minX;
    const minY = padPx / rect.height;
    const maxY = 1 - minY;

    const left = this._rand(minX, maxX) * 100;
    const top = this._rand(minY, maxY) * 100;
    return { leftPct: left, topPct: top };
  }

  _emojiForType(t) {
    if (t === 'bomb') return '💣';
    if (t === 'decoy') return '🫥';
    if (t === 'heal') return '🩹';
    if (t === 'shield') return '🛡️';
    if (t === 'bossface') return '👊';
    return '🥊';
  }

  spawnTarget(data) {
    if (!this.layerEl || !data) return;

    const size = Math.max(72, Math.round(data.sizePx || 120));
    const { leftPct, topPct } = this._pickPosPct(size);

    const el = document.createElement('div');
    el.className = `sb-target ${data.type || 'normal'}`;
    el.dataset.id = String(data.id);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = leftPct + '%';
    el.style.top = topPct + '%';

    const emoji = document.createElement('div');
    emoji.className = 'sb-target-emoji';
    emoji.textContent = data.isBossFace ? (data.bossEmoji || '😈') : (data.bossEmoji || this._emojiForType(data.type));
    el.appendChild(emoji);

    this.layerEl.appendChild(el);
    this.targets.set(data.id, el);
  }

  removeTarget(id, reason) {
    const el = this.targets.get(id);
    if (!el) return;
    this.targets.delete(id);

    // quick fade
    el.style.transition = 'transform .08s ease, opacity .08s ease, filter .08s ease';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-50%) scale(0.92)';
    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 90);
  }

  playHitFx(id, info = {}) {
    const el = this.targets.get(id);
    if (!el || !this.layerEl) return;

    // pop
    el.style.transform = 'translate(-50%,-50%) scale(1.08)';
    setTimeout(() => {
      if (el && el.style) el.style.transform = 'translate(-50%,-50%) scale(1.00)';
    }, 60);

    const fx = document.createElement('div');
    fx.className = 'sb-hit-fx';
    const txt = (info.grade === 'perfect') ? `+${info.scoreDelta} ✨`
      : (info.grade === 'good') ? `+${info.scoreDelta}`
      : (info.grade === 'bad') ? `+${info.scoreDelta}`
      : (info.grade === 'bomb') ? `${info.scoreDelta} 💥`
      : (info.grade === 'heal') ? `+${info.scoreDelta} 🩹`
      : (info.grade === 'shield') ? `+${info.scoreDelta} 🛡️`
      : `+${info.scoreDelta}`;

    fx.textContent = txt;

    const rect = this._layerRect();
    const cx = (info.clientX != null && rect) ? (info.clientX - rect.left) : (rect ? rect.width * 0.5 : 120);
    const cy = (info.clientY != null && rect) ? (info.clientY - rect.top) : (rect ? rect.height * 0.5 : 120);

    fx.style.position = 'absolute';
    fx.style.left = cx + 'px';
    fx.style.top = cy + 'px';
    fx.style.transform = 'translate(-50%,-60%)';
    fx.style.pointerEvents = 'none';
    fx.style.fontWeight = '900';
    fx.style.fontSize = '14px';
    fx.style.textShadow = '0 8px 18px rgba(0,0,0,.55)';

    // minimal tone (no hardcoded colors needed; CSS can override)
    this.layerEl.appendChild(fx);
    setTimeout(() => {
      fx.style.transition = 'transform .45s ease, opacity .45s ease';
      fx.style.opacity = '0';
      fx.style.transform = 'translate(-50%,-120%)';
    }, 0);
    setTimeout(() => { try { fx.remove(); } catch (_) {} }, 520);
  }

  _onPointerDown(e) {
    // prevent scroll on mobile if tapping targets
    const t = e.target && e.target.closest ? e.target.closest('.sb-target') : null;
    if (!t) return;

    e.preventDefault();
    const id = parseInt(t.dataset.id || '0', 10);
    if (!id) return;

    const hitInfo = { clientX: e.clientX, clientY: e.clientY };
    if (this.onTargetHit) this.onTargetHit(id, hitInfo);
  }
}