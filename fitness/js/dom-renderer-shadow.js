// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// PATCH D:
// ✅ Use computed padding of layer as SAFE ZONE (avoid HUD/meta blocking)
// ✅ Cap target size (double safety)
// ✅ Keep spawn fully inside layer

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

function pxToNum(s){
  const n = Number(String(s||'').replace('px',''));
  return Number.isFinite(n) ? n : 0;
}

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    this.targets = new Map();
    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // ✅ PATCH: read CSS padding as safe zone (we set it in .sb-target-layer)
    let padT = 0, padR = 0, padB = 0, padL = 0;
    try{
      const cs = getComputedStyle(this.layer);
      padT = pxToNum(cs.paddingTop);
      padR = pxToNum(cs.paddingRight);
      padB = pxToNum(cs.paddingBottom);
      padL = pxToNum(cs.paddingLeft);
    }catch{}

    // fallback minimal padding (in case CSS not loaded yet)
    const fallback = Math.min(42, Math.max(14, r.width * 0.03));
    if(!(padT||padR||padB||padL)){
      padT = fallback + 40;
      padR = fallback + 220;
      padB = fallback + 20;
      padL = fallback + 16;
    }

    const left = padL;
    const top = padT;
    const right = Math.max(left + 10, r.width - padR);
    const bottom = Math.max(top + 10, r.height - padB);

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
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);

    // ✅ PATCH: cap size (double safety: CSS already caps max)
    const size = clamp(Number(data.sizePx) || 120, 68, 150);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random position inside SAFE ZONE
    const maxX = Math.max(left, right - size);
    const maxY = Math.max(top, bottom - size);

    const x = rand(left, maxX);
    const y = rand(top, maxY);

    el.style.position = 'absolute';
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    // content
    const emoji = this._emojiForType(data.type, data.bossEmoji);
    el.textContent = emoji;

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(data.id, el);

    // optional TTL auto-remove hook (if caller uses ttlMs, they handle expire in engine)
    // kept intentionally simple.
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
      FxBurst.burst(x, y, { n: 14, spread: 64, ttlMs: 620, cls: 'sb-fx-fever' });
      FxBurst.popText(x, y, `PERFECT +${Math.max(0,scoreDelta)}`, 'sb-fx-fever');
    } else if (grade === 'good') {
      FxBurst.burst(x, y, { n: 10, spread: 46, ttlMs: 520, cls: 'sb-fx-hit' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-hit');
    } else if (grade === 'bad') {
      FxBurst.burst(x, y, { n: 8, spread: 42, ttlMs: 500, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-miss');
    } else if (grade === 'bomb') {
      FxBurst.burst(x, y, { n: 14, spread: 80, ttlMs: 660, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      FxBurst.burst(x, y, { n: 12, spread: 56, ttlMs: 600, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      FxBurst.burst(x, y, { n: 12, spread: 56, ttlMs: 600, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520 });
    }
  }
}