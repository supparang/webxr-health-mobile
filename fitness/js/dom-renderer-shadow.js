// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets — PATCH ABCD
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ HUD-safe spawn using CSS vars (--sb-safe-*) from wrap/root
// ✅ targets map stores { el, type, sizePx, spawnedAt }
// ✅ expireTarget(id) smooth fade then remove

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

function readCssPx(el, varName, fallback){
  try{
    const cs = getComputedStyle(el || document.documentElement);
    const v = (cs.getPropertyValue(varName) || '').trim();
    if(!v) return fallback;
    const n = Number(String(v).replace('px','').trim());
    return Number.isFinite(n) ? n : fallback;
  }catch{
    return fallback;
  }
}

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || document.documentElement;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    this.targets = new Map(); // id -> { el, type, sizePx, spawnedAt }

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

    // ✅ read CSS vars (tuned by responsive CSS)
    const padTop = readCssPx(this.wrapEl, '--sb-safe-top', 84);
    const padRight = readCssPx(this.wrapEl, '--sb-safe-right', 10);
    const padBottom = readCssPx(this.wrapEl, '--sb-safe-bottom', 140);
    const padLeft = readCssPx(this.wrapEl, '--sb-safe-left', 10);

    const left = padLeft;
    const top = padTop;
    const right = r.width - padRight;
    const bottom = r.height - padBottom;

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

    const size = clamp(Number(data.sizePx) || 110, 70, 220);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // emoji scales with size
    const emojiSize = clamp(Math.round(size * 0.36), 28, 56);
    el.style.setProperty('--sb-emoji', emojiSize + 'px');

    // random position within safe rect
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    // content
    const emoji = this._emojiForType(type, data.bossEmoji);
    const span = document.createElement('span');
    span.className = 'sb-emoji';
    span.textContent = emoji;
    el.appendChild(span);

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(data.id, { el, type, sizePx: size, spawnedAt: performance.now() });
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

    // smooth fade
    el.classList.add('is-expiring');
    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}

    // remove after animation
    setTimeout(() => {
      try { el.remove(); } catch {}
      this.targets.delete(id);
    }, 240);
  }

  playHitFx(id, info = {}){
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
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, `${scoreDelta}`, 'sb-fx-miss');
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
      FxBurst.burst(x, y, { n: 7, spread: 34, ttlMs: 420, cls: 'sb-fx-expire' });
      FxBurst.popText(x, y, 'MISS', 'sb-fx-expire');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}