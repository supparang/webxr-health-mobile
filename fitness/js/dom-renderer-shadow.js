// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ targets map stores { el, type }
// ✅ expireTarget(id) soft fade/shrink
// ✅ UX PATCH: selective expire FX + anti "PERFECT + MISS" visual overlap

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

    // ✅ UX PATCH: remember recent “strong hit FX” timestamp to avoid MISS overlay deception
    this._lastStrongFxAt = 0;

    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

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

    // margins driven by CSS vars (tune in shadow-breaker.css)
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
    el.dataset.type = String(type);

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
    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}
    this.targets.delete(id);
  }

  expireTarget(id){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    try {
      el.classList.add('is-expiring');
      el.style.pointerEvents = 'none';
      setTimeout(() => this.removeTarget(id), 180);
    } catch {
      this.removeTarget(id);
    }
  }

  // ✅ NEW: selective expire FX
  // showMissText: true => visual MISS text/burst
  // showMissText: false => silent/soft vanish (used by decoy/bomb/heal/shield expire)
  playExpireFx(id, opts = {}){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width/2;
    const y = rect.top + rect.height/2;

    const showMissText = !!opts.showMissText;
    const silent = !!opts.silent;

    // ✅ Anti-overlap: if a strong hit FX just happened, suppress MISS text briefly
    const nowTs = performance.now();
    const tooCloseToStrongHit = (nowTs - this._lastStrongFxAt) < 120;

    if (silent || !showMissText || tooCloseToStrongHit) {
      // เบา ๆ ให้รู้ว่าหาย แต่ไม่เด้ง MISS หลอกตา
      FxBurst.burst(x, y, { n: 4, spread: 26, ttlMs: 260, cls: 'sb-fx-expire-soft' });
      return;
    }

    FxBurst.burst(x, y, { n: 6, spread: 36, ttlMs: 420, cls: 'sb-fx-miss' });
    FxBurst.popText(x, y, 'MISS', 'sb-fx-miss');
  }

  playHitFx(id, info = {}){
    const obj = this.targets.get(id);
    const el = obj?.el;

    const rect = el ? el.getBoundingClientRect() : null;
    const x = info.clientX ?? (rect ? rect.left + rect.width/2 : window.innerWidth/2);
    const y = info.clientY ?? (rect ? rect.top + rect.height/2 : window.innerHeight/2);

    const grade = info.grade || 'good';
    const scoreDelta = Number(info.scoreDelta) || 0;

    // mark strong FX timestamps to prevent immediate MISS overlay confusion
    const markStrong = () => { this._lastStrongFxAt = performance.now(); };

    if (grade === 'perfect') {
      markStrong();
      FxBurst.burst(x, y, { n: 14, spread: 68, ttlMs: 640, cls: 'sb-fx-fever' });
      FxBurst.popText(x, y, `PERFECT +${Math.max(0,scoreDelta)}`, 'sb-fx-fever');
    } else if (grade === 'good') {
      markStrong();
      FxBurst.burst(x, y, { n: 10, spread: 48, ttlMs: 540, cls: 'sb-fx-hit' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-hit');
    } else if (grade === 'bad') {
      // decoy hit = bad (not MISS)
      markStrong();
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-decoy' });
      FxBurst.popText(x, y, `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`, 'sb-fx-decoy');
    } else if (grade === 'bomb') {
      markStrong();
      FxBurst.burst(x, y, { n: 16, spread: 86, ttlMs: 700, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      markStrong();
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      markStrong();
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else if (grade === 'expire') {
      // backward-compatible path (if engine still calls playHitFx(id,{grade:'expire'}))
      this.playExpireFx(id, { showMissText: true });
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}