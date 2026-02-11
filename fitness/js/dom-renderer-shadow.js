// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ TTL auto-expire -> calls onTargetExpire(id, {reason:'ttl'})
// ✅ Safe spawn avoids HUD(top) + Bars(top) + Meta(right) more aggressively
// ✅ FX via FxBurst

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
    this.onTargetExpire = typeof opts.onTargetExpire === 'function' ? opts.onTargetExpire : null;

    this.diffKey = 'normal';
    this.targets = new Map(); // id -> el

    // id -> {timeoutId, expiresAtMs, ttlMs}
    this._ttl = new Map();

    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();

    for (const [id, t] of this._ttl.entries()) {
      try { clearTimeout(t.timeoutId); } catch {}
    }
    this._ttl.clear();
  }

  // --- SAFE SPAWN RECT ---
  // Strategy:
  // - use layer rect
  // - reserve: top strip for HUD+top bars, right strip for meta panel
  // - keep overall padding
  _safeAreaRect(size){
    const r = this.layer.getBoundingClientRect();

    const pad = Math.min(42, Math.max(16, r.width * 0.03));

    // reserve areas (tuned to feel "less crowded")
    const reserveTop = Math.min(140, Math.max(92, r.height * 0.18));      // HUD + top bars
    const reserveRight = Math.min(280, Math.max(190, r.width * 0.26));    // meta panel

    const left = pad + 10;
    const top = pad + reserveTop;
    const right = r.width - pad - reserveRight;
    const bottom = r.height - pad - 14;

    // if screen is too tight, relax reserveRight a bit
    const minW = 220;
    let adjRight = right;
    if ((adjRight - left) < minW) {
      adjRight = r.width - pad - Math.max(110, reserveRight * 0.55);
    }

    // final clamp
    const safe = {
      r,
      left: clamp(left, 0, r.width),
      top: clamp(top, 0, r.height),
      right: clamp(adjRight, 0, r.width),
      bottom: clamp(bottom, 0, r.height),
    };

    // ensure room for size
    if ((safe.right - safe.left) < (size + 6)) {
      safe.right = Math.min(r.width - pad, safe.left + size + 6);
    }
    if ((safe.bottom - safe.top) < (size + 6)) {
      safe.bottom = Math.min(r.height - pad, safe.top + size + 6);
    }

    return safe;
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

    const id = Number(data.id);
    if (!Number.isFinite(id)) return;

    // if exists, remove first (avoid duplicates)
    if (this.targets.has(id)) this.removeTarget(id, 'replace');

    const size = clamp(Number(data.sizePx) || 112, 68, 180);
    const { r, left, top, right, bottom } = this._safeAreaRect(size);

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(id);

    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random position inside safe box
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    // content
    const emoji = this._emojiForType(data.type, data.bossEmoji);
    el.textContent = emoji;

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(id, el);

    // ✅ TTL auto-expire
    const ttlMs = clamp(Number(data.ttlMs) || 1200, 260, 6000);
    const timeoutId = setTimeout(() => {
      // already removed by hit?
      if (!this.targets.has(id)) return;

      // expire
      this.removeTarget(id, 'ttl');
      if (this.onTargetExpire) {
        try { this.onTargetExpire(id, { reason:'ttl' }); } catch {}
      }
    }, ttlMs);

    this._ttl.set(id, { timeoutId, expiresAtMs: performance.now() + ttlMs, ttlMs });
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

  removeTarget(id, reason){
    const el = this.targets.get(id);
    if (!el) return;

    // clear ttl timer
    const t = this._ttl.get(id);
    if (t) {
      try { clearTimeout(t.timeoutId); } catch {}
      this._ttl.delete(id);
    }

    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}
    this.targets.delete(id);
  }

  playHitFx(id, info = {}){
    const el = this.targets.get(id);
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
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-miss');
    } else if (grade === 'bomb') {
      FxBurst.burst(x, y, { n: 16, spread: 86, ttlMs: 700, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}