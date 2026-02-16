// === /fitness/js/dom-renderer-shadow.js ===
// PATCH: use CSS safe-zone vars + better HUD-safe spawn
// (only change/insert parts below)

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

/* ✅ ADD: read CSS variable (px) safely */
function cssPx(el, name, fallbackPx){
  try{
    const v = getComputedStyle(el || document.documentElement).getPropertyValue(name).trim();
    if(!v) return fallbackPx;
    // supports "12px" or "12"
    const n = Number(String(v).replace('px','').trim());
    return Number.isFinite(n) ? n : fallbackPx;
  }catch(_){
    return fallbackPx;
  }
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

  /* ✅ REPLACE: _safeAreaRect() */
  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // Base padding (keeps away from stage border)
    const base = Math.min(42, Math.max(12, r.width * 0.03));

    // Read CSS safe-zone vars (engine/css control these)
    const topPad    = cssPx(document.documentElement, '--sb-safe-top',    18);
    const bottomPad = cssPx(document.documentElement, '--sb-safe-bottom', 18);
    const leftPad   = cssPx(document.documentElement, '--sb-safe-left',   12);
    const rightPad  = cssPx(document.documentElement, '--sb-safe-right',  12);

    // Combine (base + safe pads)
    const left   = base + leftPad;
    const top    = base + topPad;
    const right  = r.width  - base - rightPad;
    const bottom = r.height - base - bottomPad;

    // Safety clamp (prevent negative/invalid)
    const L = clamp(left, 0, r.width  - 40);
    const T = clamp(top,  0, r.height - 40);
    const R = clamp(right,  40, r.width);
    const B = clamp(bottom, 40, r.height);

    return { r, left:L, top:T, right:R, bottom:B };
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

    const size = clamp(Number(data.sizePx) || 120, 64, 260); // ✅ slightly wider clamp
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // ✅ random position inside HUD-safe rect
    const maxX = Math.max(left, right - size);
    const maxY = Math.max(top, bottom - size);

    const x = rand(left, maxX);
    const y = rand(top,  maxY);

    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    const emoji = this._emojiForType(data.type, data.bossEmoji);
    el.textContent = emoji;

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(data.id, el);
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

  /* ✅ ADD: expire animation helper (engine calls renderer.expireTarget) */
  expireTarget(id){
    const el = this.targets.get(id);
    if(!el) return;
    try{
      el.style.transition = 'transform 140ms ease, opacity 140ms ease, filter 140ms ease';
      el.style.opacity = '0';
      el.style.transform = 'scale(.86)';
      el.style.filter = 'blur(0.6px)';
      setTimeout(()=> this.removeTarget(id,'expire'), 150);
    }catch(_){
      this.removeTarget(id,'expire');
    }
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
    } else if (grade === 'expire') {
      // ✅ soft miss FX (no harsh red)
      FxBurst.burst(x, y, { n: 6, spread: 36, ttlMs: 460, cls: 'sb-fx-decoy' });
      FxBurst.popText(x, y, 'MISS', 'sb-fx-tip');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}