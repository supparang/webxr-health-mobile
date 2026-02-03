// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ pointerdown hit -> calls onTargetHit(id, {x,y})
// ✅ supports xPct/yPct from engine for deterministic patterns
// ✅ PATCH: safe spawn zone avoids HUD/meta/bars + bigger targets on small screens

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }
function rand(min,max){ return min + Math.random()*(max-min); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.targets = new Map();
    this._onPointer = this._onPointer.bind(this);
  }

  destroy(){
    try { this.layer && this.layer.removeEventListener('pointerdown', this._onPointer); } catch {}
    for (const [, el] of this.targets.entries()) { try{ el.remove(); }catch{} }
    this.targets.clear();
  }

  bind(){
    if (!this.layer) return;
    this.layer.addEventListener('pointerdown', this._onPointer, { passive: true });
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

    const rect = this.layer.getBoundingClientRect();

    // ---- SAFE spawn zone (avoid HUD/meta/bars) ----
    const pad = Math.min(56, Math.max(16, rect.width * 0.045));
    let safeL = pad;
    let safeT = pad;
    let safeR = rect.width - pad;
    let safeB = rect.height - pad;

    const wrap = this.wrapEl || document;

    const hud = wrap.querySelector('.sb-hud-top');
    const barsTop = wrap.querySelector('.sb-bars-top');
    const barsBottom = wrap.querySelector('.sb-bars-bottom');
    const meta = wrap.querySelector('.sb-meta');

    const toLocal = (r2)=>({
      left: r2.left - rect.left,
      top: r2.top - rect.top,
      right: r2.right - rect.left,
      bottom: r2.bottom - rect.top
    });

    try{
      let maxTop = safeT;
      if (hud) {
        const hr = toLocal(hud.getBoundingClientRect());
        maxTop = Math.max(maxTop, hr.bottom + 10);
      }
      if (barsTop) {
        const br = toLocal(barsTop.getBoundingClientRect());
        maxTop = Math.max(maxTop, br.bottom + 8);
      }
      safeT = maxTop;
    }catch(_){}

    try{
      if (barsBottom) {
        const rr = toLocal(barsBottom.getBoundingClientRect());
        safeB = Math.min(safeB, rr.top - 10);
      }
    }catch(_){}

    try{
      if (meta) {
        const mr = toLocal(meta.getBoundingClientRect());
        safeR = Math.min(safeR, mr.left - 10);
      }
    }catch(_){}

    // ---- Target size ----
    let size = clamp(Number(data.sizePx) || 120, 80, 240);
    // Slightly larger targets on small screens for usability
    if (window.innerWidth <= 520) size = clamp(size * 1.18, 90, 280);

    // keep safe area sane vs size
    safeR = Math.max(safeL + size + 10, safeR);
    safeB = Math.max(safeT + size + 10, safeB);

    let x = 0;
    let y = 0;
    // If engine provides xPct/yPct (0..1), use it for deterministic patterns.
    if (Number.isFinite(Number(data.xPct)) && Number.isFinite(Number(data.yPct))) {
      x = safeL + clamp(Number(data.xPct) || 0, 0, 1) * Math.max(0, (safeR - safeL - size));
      y = safeT + clamp(Number(data.yPct) || 0, 0, 1) * Math.max(0, (safeB - safeT - size));
    } else {
      x = rand(safeL, safeR - size);
      y = rand(safeT, safeB - size);
    }

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);
    el.style.width = Math.round(size) + 'px';
    el.style.height = Math.round(size) + 'px';
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    el.textContent = this._emojiForType(data.type, data.bossEmoji);

    this.layer.appendChild(el);
    this.targets.set(Number(data.id), el);
  }

  removeTarget(id){
    const el = this.targets.get(Number(id));
    if (!el) return;
    try{ el.remove(); }catch{}
    this.targets.delete(Number(id));
  }

  _onPointer(e){
    if (!this.layer) return;

    const x = e.clientX;
    const y = e.clientY;

    // find target at point
    const el = document.elementFromPoint(x, y);
    if (!el || !el.classList || !el.classList.contains('sb-target')) return;

    const id = Number(el.dataset.id);
    if (!Number.isFinite(id)) return;

    if (this.onTargetHit) this.onTargetHit(id, { clientX: x, clientY: y });
  }

  playHitFx(x, y, info = {}){
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