// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ store targets as { el, type, dying }
// ✅ expireTarget(id, opts) with soft fade/shrink + optional FX
// ✅ safe-zone spawn via CSS vars (--sb-safe-*)
// ✅ anti-race: prevent hit/expire double-processing

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function rand(min, max){ return min + Math.random() * (max - min); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    // id -> { el, type, dying:boolean }
    this.targets = new Map();

    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){
    this.diffKey = k || 'normal';
  }

  destroy(){
    for (const [, obj] of this.targets.entries()) {
      const el = obj?.el;
      try { el?.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el?.remove(); } catch {}
    }
    this.targets.clear();
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // CSS vars allow layout tuning without JS edits
    const cs = getComputedStyle(document.documentElement);

    const padBase = Number.parseFloat(cs.getPropertyValue('--sb-safe-pad')) || 18;
    const padTop  = Number.parseFloat(cs.getPropertyValue('--sb-safe-top')) || 14;
    const padSide = Number.parseFloat(cs.getPropertyValue('--sb-safe-side')) || 14;
    const padBot  = Number.parseFloat(cs.getPropertyValue('--sb-safe-bot')) || 14;

    const pad = Math.min(42, Math.max(padBase, r.width * 0.035));
    const top = pad + padTop;
    const left = pad + padSide;
    const right = r.width - pad - padSide;
    const bottom = r.height - pad - padBot;

    return { r, left, top, right, bottom };
  }

  _emojiForType(t, bossEmoji){
    if (t === 'normal') return '🎯';
    if (t === 'decoy') return '👀';
    if (t === 'bomb') return '💣';
    if (t === 'heal') return '🩹';
    if (t === 'shield') return '🛡️';
    if (t === 'bossface') return bossEmoji || '👊';
    return '🎯';
  }

  spawnTarget(data){
    if (!this.layer || !data) return;

    const { left, top, right, bottom } = this._safeAreaRect();

    const type = (data.type || 'normal');
    const id = Number(data.id);
    if (!Number.isFinite(id)) return;

    // if same id somehow exists, remove old first (safety)
    if (this.targets.has(id)) this.removeTarget(id);

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + type;
    el.dataset.id = String(id);

    const size = clamp(Number(data.sizePx) || 110, 64, 240);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    el.textContent = this._emojiForType(type, data.bossEmoji);

    // optional TTL visual hint (pure visual, engine is source-of-truth)
    if (Number.isFinite(Number(data.ttlMs)) && Number(data.ttlMs) > 0) {
      el.style.setProperty('--sb-ttl-ms', `${Math.round(Number(data.ttlMs))}ms`);
    }

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(id, { el, type, dying: false });
  }

  _onPointer(e){
    const el = e.currentTarget;
    if (!el) return;

    const id = Number(el.dataset.id);
    if (!Number.isFinite(id)) return;

    const obj = this.targets.get(id);
    if (!obj || !obj.el) return;

    // ✅ anti-race: if expiring/removing, ignore hit
    if (obj.dying) return;

    // lock immediately to avoid double trigger on touch/pointer races
    obj.dying = true;
    el.style.pointerEvents = 'none';

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY });
    }
  }

  removeTarget(id){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) {
      this.targets.delete(id);
      return;
    }

    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}
    this.targets.delete(id);
  }

  /**
   * Soft-expire a target before removal.
   * @param {number} id
   * @param {{showFx?: boolean, missCounted?: boolean}} opts
   */
  expireTarget(id, opts = {}){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    // ✅ anti-race: if already being hit/expired, ignore
    if (obj.dying) return;
    obj.dying = true;

    const showFx = !!opts.showFx; // engine decides when MISS FX is truly shown

    try {
      el.style.pointerEvents = 'none';

      if (showFx) {
        // only engine should request this when miss is counted (normal/bossface)
        this.playHitFx(id, { grade: 'expire' });
      }

      // visual soften
      el.classList.add('is-expiring');

      // remove after CSS animation window
      setTimeout(() => this.removeTarget(id), 180);
    } catch {
      this.removeTarget(id);
    }
  }

  playHitFx(id, info = {}){
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
      // decoy hit (bad choice) => should look "penalty", not miss-expire
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-decoy' });
      if (scoreDelta < 0) FxBurst.popText(x, y, `${scoreDelta}`, 'sb-fx-decoy');
      else FxBurst.popText(x, y, 'DECOY!', 'sb-fx-decoy');

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
      // ✅ MISS FX: use only when engine says this expire really counts miss
      FxBurst.burst(x, y, { n: 6, spread: 34, ttlMs: 400, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, 'MISS', 'sb-fx-miss');

    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}