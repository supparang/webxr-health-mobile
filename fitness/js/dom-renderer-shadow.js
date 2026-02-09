// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ PATCH: safe-zone from CSS vars (--sb-safe-top/right/bottom/left) to avoid HUD/meta overlap

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

function readCssPx(el, name, fallback){
  try{
    const v = getComputedStyle(el || document.documentElement).getPropertyValue(name);
    const n = Number(String(v||'').trim().replace('px',''));
    return Number.isFinite(n) ? n : fallback;
  }catch(_){
    return fallback;
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

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // ✅ Read safe-zone from CSS vars (defined in shadow-breaker.css)
    const base = this.wrapEl || document.documentElement;
    const safeTop = readCssPx(base, '--sb-safe-top', 90);
    const safeRight = readCssPx(base, '--sb-safe-right', 260);
    const safeBottom = readCssPx(base, '--sb-safe-bottom', 90);
    const safeLeft = readCssPx(base, '--sb-safe-left', 26);

    // keep a little pad as well
    const pad = readCssPx(base, '--sb-safe-pad', Math.min(34, Math.max(18, r.width * 0.04)));

    const left = pad + safeLeft;
    const top = pad + safeTop;
    const right = r.width - pad - safeRight;
    const bottom = r.height - pad - safeBottom;

    // if extreme small screens cause inverted rect, relax gracefully
    const L = clamp(left, 8, r.width - 8);
    const T = clamp(top, 8, r.height - 8);
    const R = Math.max(L + 8, right);
    const B = Math.max(T + 8, bottom);

    return { r, left: L, top: T, right: R, bottom: B };
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

    // keep ttl (optional) for debugging / future timeout handling
    if (data.ttlMs != null) el.dataset.ttl = String(Math.max(0, Number(data.ttlMs)||0));

    // size
    const size = clamp(Number(data.sizePx) || 110, 66, 260);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random position (safe-zone)
    const maxX = Math.max(left, right - size);
    const maxY = Math.max(top, bottom - size);

    // If safe-zone too tight, fall back to broader area
    const fallbackMaxX = Math.max(8, (this.layer.clientWidth || window.innerWidth) - size - 8);
    const fallbackMaxY = Math.max(8, (this.layer.clientHeight || window.innerHeight) - size - 8);

    const useFallback = !Number.isFinite(maxX) || !Number.isFinite(maxY) || (maxX <= left + 2) || (maxY <= top + 2);

    const x = useFallback ? rand(8, fallbackMaxX) : rand(left, maxX);
    const y = useFallback ? rand(8, fallbackMaxY) : rand(top, maxY);

    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    // content
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

    // forward hit
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