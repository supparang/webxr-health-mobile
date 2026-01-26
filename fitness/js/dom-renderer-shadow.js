// === /fitness/js/dom-renderer-shadow.js ===
// DOM Renderer (Shadow Breaker) — PRODUCTION (Pack A+B)
// ✅ Multi-target spawn/remove
// ✅ Tap/click hit -> onTargetHit(id, {clientX, clientY})
// ✅ Hit FX: floating text

'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class DomRendererShadow {
  /**
   * @param {HTMLElement} layerEl
   * @param {Object} opts
   * @param {HTMLElement=} opts.wrapEl
   * @param {HTMLElement=} opts.feedbackEl
   * @param {(id:number, hitInfo:Object)=>void=} opts.onTargetHit
   */
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.diffKey = 'normal';
    this.targets = new Map(); // id -> {el, data}

    this._boundHit = (e) => this._handlePointer(e);
    this.layer?.addEventListener('pointerdown', this._boundHit, { passive: true });
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  destroy() {
    try {
      this.layer?.removeEventListener('pointerdown', this._boundHit);
    } catch {}
    for (const id of this.targets.keys()) {
      this.removeTarget(id, 'destroy');
    }
    this.targets.clear();
  }

  /** Spawn 1 target */
  spawnTarget(data) {
    if (!this.layer || !data) return;

    const rect = this.layer.getBoundingClientRect();
    // safe margins: keep away from edges a bit
    const margin = 18;

    const x = margin + Math.random() * Math.max(10, rect.width - margin * 2);
    const y = margin + Math.random() * Math.max(10, rect.height - margin * 2);

    const size = clamp(Number(data.sizePx) || 120, 80, 240);

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.id = String(data.id);
    el.dataset.kind = data.type || 'normal';

    const emoji = document.createElement('div');
    emoji.className = 'emoji';
    emoji.textContent = data.isBossFace ? (data.bossEmoji || '👊') : this._emojiForKind(data.type);
    el.appendChild(emoji);

    // Slight pulse by kind
    if (data.type === 'bomb') el.style.filter = 'drop-shadow(0 0 14px rgba(251,113,133,.25))';
    if (data.type === 'heal') el.style.filter = 'drop-shadow(0 0 14px rgba(34,197,94,.22))';
    if (data.type === 'shield') el.style.filter = 'drop-shadow(0 0 14px rgba(250,204,21,.20))';
    if (data.type === 'bossface') el.style.filter = 'drop-shadow(0 0 16px rgba(168,85,247,.22))';

    this.layer.appendChild(el);
    this.targets.set(data.id, { el, data });

    // Attach direct handler too (works if pointer events bubble)
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this._emitHit(data.id, e);
    }, { passive: true });
  }

  removeTarget(id, reason) {
    const rec = this.targets.get(id);
    if (!rec) return;
    try {
      rec.el.remove();
    } catch {}
    this.targets.delete(id);
  }

  playHitFx(id, info) {
    const grade = info?.grade || 'good';
    const scoreDelta = info?.scoreDelta ?? '';
    const x = info?.clientX ?? (window.innerWidth / 2);
    const y = info?.clientY ?? (window.innerHeight / 2);

    const fx = document.createElement('div');
    fx.className = 'sb-fx';

    let label = '';
    if (grade === 'perfect') label = 'PERFECT +' + scoreDelta;
    else if (grade === 'good') label = 'GOOD +' + scoreDelta;
    else if (grade === 'bad') label = 'OK +' + scoreDelta;
    else if (grade === 'heal') label = 'HEAL +' + scoreDelta;
    else if (grade === 'shield') label = 'SHIELD +' + scoreDelta;
    else if (grade === 'bomb') label = 'BOOM ' + scoreDelta;
    else label = String(grade).toUpperCase();

    fx.textContent = label;
    fx.style.left = x + 'px';
    fx.style.top = y + 'px';

    document.body.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  }

  _emojiForKind(kind) {
    switch (kind) {
      case 'bomb': return '💣';
      case 'decoy': return '🎭';
      case 'heal': return '🩹';
      case 'shield': return '🛡️';
      case 'bossface': return '👹';
      default: return '🥊';
    }
  }

  _handlePointer(e) {
    // fallback: if user taps empty area, ignore
  }

  _emitHit(id, e) {
    if (typeof this.onTargetHit === 'function') {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY });
    }
  }
}