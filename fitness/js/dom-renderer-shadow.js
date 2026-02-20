// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst (engine may call playHitFx)
// ✅ store targets as { el, type } (engine needs type)
// ✅ safe-area margins driven by CSS vars (solve HUD/meta cramped)
// ✅ expireTarget(id, opts) supports soft fade and optional FX suppression
// ✅ prevent double-hit + disable pointer during expire

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(min, max) { return min + Math.random() * (max - min); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    // id -> { el, type, bornAt, dying, hit }
    this.targets = new Map();

    this._onPointer = this._onPointer.bind(this);
    this._rafSafe = null;
  }

  setDifficulty(k) { this.diffKey = k || 'normal'; }

  destroy() {
    try { if (this._rafSafe) cancelAnimationFrame(this._rafSafe); } catch {}
    this._rafSafe = null;

    for (const [id, obj] of this.targets.entries()) {
      const el = obj?.el;
      try { el?.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el?.remove(); } catch {}
    }
    this.targets.clear();
  }

  // Optional helper for engine
  getTargetType(id) {
    const obj = this.targets.get(Number(id));
    return obj?.type || null;
  }

  _readCssNumber(varName, fallback) {
    try {
      const cs = getComputedStyle(document.documentElement);
      const raw = cs.getPropertyValue(varName);
      const n = Number.parseFloat(raw);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }

  _safeAreaRect() {
    const r = this.layer.getBoundingClientRect();

    // ✅ margins driven by CSS vars (numbers without px are OK)
    const padBase = this._readCssNumber('--sb-safe-pad', 18);
    const padTop  = this._readCssNumber('--sb-safe-top', 14);
    const padSide = this._readCssNumber('--sb-safe-side', 14);
    const padBot  = this._readCssNumber('--sb-safe-bot', 14);

    // pad grows a touch on wide screens but capped
    const pad = Math.min(42, Math.max(padBase, r.width * 0.035));

    const top = pad + padTop;
    const left = pad + padSide;
    const right = r.width - pad - padSide;
    const bottom = r.height - pad - padBot;

    return { r, left, top, right, bottom };
  }

  _emojiForType(t, bossEmoji) {
    if (t === 'normal') return '🎯';
    if (t === 'decoy') return '👀';
    if (t === 'bomb') return '💣';
    if (t === 'heal') return '🩹';
    if (t === 'shield') return '🛡️';
    if (t === 'bossface') return bossEmoji || '👊';
    return '🎯';
  }

  spawnTarget(data) {
    if (!this.layer || !data) return;

    const { left, top, right, bottom } = this._safeAreaRect();

    const el = document.createElement('div');
    const type = (data.type || 'normal');

    el.className = 'sb-target sb-target--' + type;
    el.dataset.id = String(data.id);

    const size = clamp(Number(data.sizePx) || 110, 64, 240);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random pos inside safe rect
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    el.textContent = this._emojiForType(type, data.bossEmoji);

    // avoid browser scroll delay on mobile
    el.style.touchAction = 'manipulation';

    // pointerdown: fastest for both mouse/touch
    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(Number(data.id), {
      el,
      type,
      bornAt: performance.now(),
      dying: false,
      hit: false
    });
  }

  _onPointer(e) {
    const el = e.currentTarget;
    if (!el) return;

    const id = Number(el.dataset.id);
    if (!Number.isFinite(id)) return;

    const obj = this.targets.get(id);
    if (!obj || !obj.el) return;

    // ✅ prevent double-hit while expiring / already hit
    if (obj.dying || obj.hit) return;
    obj.hit = true;

    // disable click immediately for safety
    try { obj.el.style.pointerEvents = 'none'; } catch {}

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY });
    }
  }

  removeTarget(id) {
    id = Number(id);
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}
    this.targets.delete(id);
  }

  /**
   * expireTarget(id, opts)
   * opts:
   * - showFx: boolean (default true)  -> if false, do not call playHitFx('expire') internally
   * - removeDelayMs: number (default 180)
   *
   * NOTE: Engine can fully control FX by calling playHitFx before expireTarget,
   *       and pass {showFx:false} to avoid duplicate "MISS" visuals.
   */
  expireTarget(id, opts = {}) {
    id = Number(id);
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    const showFx = (opts.showFx !== false);
    const removeDelayMs = Number.isFinite(opts.removeDelayMs) ? opts.removeDelayMs : 180;

    // mark dying
    obj.dying = true;

    // prevent click during fade
    try { el.style.pointerEvents = 'none'; } catch {}

    // ✅ optional internal FX (grade=expire)
    if (showFx) {
      this.playHitFx(id, { grade: 'expire' });
    }

    // fade + shrink via CSS
    try {
      el.classList.add('is-expiring');
      setTimeout(() => this.removeTarget(id), removeDelayMs);
    } catch {
      this.removeTarget(id);
    }
  }

  playHitFx(id, info = {}) {
    id = Number(id);
    const obj = this.targets.get(id);
    const el = obj?.el;

    const rect = el ? el.getBoundingClientRect() : null;
    const x = info.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y = info.clientY ?? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

    const grade = info.grade || 'good';
    const scoreDelta = Number(info.scoreDelta) || 0;

    if (grade === 'perfect') {
      FxBurst.burst(x, y, { n: 14, spread: 68, ttlMs: 640, cls: 'sb-fx-fever' });
      FxBurst.popText(x, y, `PERFECT +${Math.max(0, scoreDelta)}`, 'sb-fx-fever');
    } else if (grade === 'good') {
      FxBurst.burst(x, y, { n: 10, spread: 48, ttlMs: 540, cls: 'sb-fx-hit' });
      FxBurst.popText(x, y, `+${Math.max(0, scoreDelta)}`, 'sb-fx-hit');
    } else if (grade === 'bad') {
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`, 'sb-fx-miss');
    } else if (grade === 'bomb') {
      FxBurst.burst(x, y, { n: 16, spread: 86, ttlMs: 700, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else if (grade === 'expire') {
      // ✅ soft miss FX (เบา ๆ) — engine should call only when miss-counted
      FxBurst.burst(x, y, { n: 6, spread: 36, ttlMs: 420, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, 'MISS', 'sb-fx-miss');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}