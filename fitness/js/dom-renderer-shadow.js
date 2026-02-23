// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ store targets as { el, type }
// ✅ expireTarget(id, opts): soft fade/shrink, supports silent expire
// ✅ UX patch: avoid duplicate expire FX on already-hit target

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    this.targets = new Map(); // id -> { el, type }
    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, obj] of this.targets.entries()) {
      const el = obj?.el;
      try { el?.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el?.remove(); } catch {}
    }
    this.targets.clear();
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // margins driven by CSS vars (helps layout/HUD overlap)
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

    const el = document.createElement('div');
    const type = (data.type || 'normal');
    el.className = 'sb-target sb-target--' + type;
    el.dataset.id = String(data.id);
    el.dataset.type = type;
    el.dataset.state = 'alive'; // alive | expiring | removed

    const size = clamp(Number(data.sizePx) || 110, 64, 240);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    el.textContent = this._emojiForType(type, data.bossEmoji);
    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(Number(data.id), { el, type });
  }

  _onPointer(e){
    const el = e.currentTarget;
    if (!el) return;

    // กันการกดย้ำระหว่าง expiring/removing
    if (el.dataset.state && el.dataset.state !== 'alive') return;

    const id = Number(el.dataset.id);
    if (!Number.isFinite(id)) return;

    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY });
    }
  }

  removeTarget(id){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    try { el.dataset.state = 'removed'; } catch {}
    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}

    this.targets.delete(id);
  }

  /**
   * expireTarget(id, opts)
   * opts = {
   *   silent?: boolean,   // true => no visual "miss" emphasis class
   *   ttlMs?: number      // fade duration before remove (default 180)
   * }
   */
  expireTarget(id, opts = {}){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    // already transitioning/removed => do nothing
    if (el.dataset.state && el.dataset.state !== 'alive') return;

    const silent = !!opts.silent;
    const ttlMs = clamp(Number(opts.ttlMs) || 180, 90, 420);

    try {
      el.dataset.state = 'expiring';
      el.style.pointerEvents = 'none';

      // base expire animation class
      el.classList.add('is-expiring');

      // only add miss emphasis when this expiry should feel like a real miss
      if (!silent) el.classList.add('is-expire-miss');

      // hard remove after animation
      setTimeout(() => this.removeTarget(id), ttlMs);
    } catch {
      this.removeTarget(id);
    }
  }

  playHitFx(id, info = {}){
    // NOTE:
    // - If target is already removed, fallback to provided clientX/clientY still works
    // - Engine should call this BEFORE removeTarget(id) on hit
    const obj = this.targets.get(id);
    const el = obj?.el;

    const rect = el ? el.getBoundingClientRect() : null;
    const x = info.clientX ?? (rect ? rect.left + rect.width/2 : window.innerWidth/2);
    const y = info.clientY ?? (rect ? rect.top + rect.height/2 : window.innerHeight/2);

    const grade = info.grade || 'good';
    const scoreDelta = Number(info.scoreDelta) || 0;

    if (grade === 'perfect') {
      FxBurst.burst(x, y, { n: 14, spread: 68, ttlMs: 640, cls: 'sb-fx-fever' });
      FxBurst.popText(x, y, `PERFECT +${Math.max(0,scoreDelta)}`, 'sb-fx-fever');

    } else if (grade === 'good') {
      FxBurst.burst(x, y, { n: 10, spread: 48, ttlMs: 540, cls: 'sb-fx-hit' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-hit');

    } else if (grade === 'bad') {
      // decoy hit (penalty)
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-decoy' });
      FxBurst.popText(x, y, `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`, 'sb-fx-decoy');

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
      // show ONLY when engine decides this is a real miss expire (normal/bossface)
      FxBurst.burst(x, y, { n: 6, spread: 36, ttlMs: 420, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, 'MISS', 'sb-fx-miss');

    } else if (grade === 'expire-silent') {
      // no text, just tiny subtle fade sparkle (optional)
      FxBurst.burst(x, y, { n: 4, spread: 22, ttlMs: 260, cls: 'sb-fx-decoy' });

    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}