// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets — PATCH A
// ✅ spawn/remove targets in #sb-target-layer
// ✅ SAFE SPAWN: avoids HUD top/bottom + meta side
// ✅ RESPONSIVE SIZE: scales by diff + viewport + playfield size
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst (optional)

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;         // (optional) #sb-wrap
    this.stageEl = opts.stageEl || null;       // (optional) .sb-stage (recommended)
    this.hudTopEl = opts.hudTopEl || null;     // (optional) .sb-hud-top
    this.barsTopEl = opts.barsTopEl || null;   // (optional) .sb-bars-top
    this.barsBottomEl = opts.barsBottomEl || null; // (optional) .sb-bars-bottom
    this.metaEl = opts.metaEl || null;         // (optional) .sb-meta
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    this.targets = new Map();
    this._onPointer = this._onPointer.bind(this);

    // harden: ensure layer is positioned
    try{
      const cs = window.getComputedStyle(this.layer);
      if (cs.position === 'static') this.layer.style.position = 'absolute';
      if (!this.layer.style.inset) this.layer.style.inset = '0';
    }catch{}
  }

  setDifficulty(k){ this.diffKey = (k || 'normal'); }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();
  }

  // ---- compute safe spawn area inside stage/layer, excluding HUD + meta ----
  _safeAreaRect(){
    const layer = this.layer;
    const stage = this.stageEl || layer;

    const rStage = stage.getBoundingClientRect();
    const rLayer = layer.getBoundingClientRect();

    // base padding from edges (responsive)
    const basePad = clamp(Math.round(Math.min(rStage.width, rStage.height) * 0.045), 14, 34);

    // reserve top area for HUD + bars (if provided)
    const hudTop = this.hudTopEl ? this.hudTopEl.getBoundingClientRect() : null;
    const barsTop = this.barsTopEl ? this.barsTopEl.getBoundingClientRect() : null;
    const barsBottom = this.barsBottomEl ? this.barsBottomEl.getBoundingClientRect() : null;

    // convert reserved bands into stage local offsets
    // (we just need a rough "no-spawn zone" band inside stage)
    let topBan = basePad;
    if (hudTop) topBan = Math.max(topBan, Math.round((hudTop.bottom - rStage.top) + 10));
    if (barsTop) topBan = Math.max(topBan, Math.round((barsTop.bottom - rStage.top) + 8));

    let bottomBan = basePad;
    if (barsBottom) bottomBan = Math.max(bottomBan, Math.round((rStage.bottom - barsBottom.top) + 10));

    // reserve right area for meta panel
    const meta = this.metaEl ? this.metaEl.getBoundingClientRect() : null;
    let rightBan = basePad;
    if (meta && meta.width > 0) {
      // meta sits inside stage (absolute). Reserve its width + small gap
      const metaLeftFromStage = meta.left - rStage.left;
      // If meta overlaps stage interior, reserve from metaLeft to stageRight.
      if (metaLeftFromStage > 0 && metaLeftFromStage < rStage.width) {
        const reserve = Math.round(rStage.width - metaLeftFromStage + 10);
        rightBan = Math.max(rightBan, reserve);
      } else {
        // fallback: reserve meta width
        rightBan = Math.max(rightBan, Math.round(meta.width + 10));
      }
    }

    // left ban slightly smaller (no big UI there)
    const leftBan = basePad;

    // final safe box in stage coords
    const safeLeft = leftBan;
    const safeTop = topBan;
    const safeRight = Math.max(safeLeft + 40, Math.round(rStage.width - rightBan));
    const safeBottom = Math.max(safeTop + 40, Math.round(rStage.height - bottomBan));

    // also return stage/layer rects for conversions
    return { rStage, rLayer, safeLeft, safeTop, safeRight, safeBottom, basePad };
  }

  // ---- target size: responsive + per difficulty + per stage size ----
  _sizePx(type){
    // baseline by difficulty
    const diff = (this.diffKey || 'normal').toLowerCase();
    let base = 112; // normal baseline (was feeling too big)
    if (diff === 'easy') base = 104;
    if (diff === 'hard') base = 96;

    // type tweaks
    if (type === 'bossface') base += 10;
    if (type === 'bomb') base -= 6;      // smaller but scary
    if (type === 'decoy') base -= 4;     // slightly smaller
    if (type === 'heal' || type === 'shield') base -= 2;

    // responsive scale by stage size
    const stage = this.stageEl || this.layer;
    const r = stage.getBoundingClientRect();
    const minSide = Math.min(r.width, r.height);

    // scale down on small phones
    let s = 1;
    if (minSide < 420) s = 0.78;
    else if (minSide < 520) s = 0.86;
    else if (minSide < 680) s = 0.94;
    else s = 1.0;

    // clamp final
    const out = clamp(Math.round(base * s), 66, 150);
    return out;
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

    const { rStage, rLayer, safeLeft, safeTop, safeRight, safeBottom } = this._safeAreaRect();

    // ensure we can spawn (avoid negative area)
    const size = this._sizePx(data.type || 'normal');
    const maxX = Math.max(safeLeft, safeRight - size);
    const maxY = Math.max(safeTop, safeBottom - size);

    // if area too tight, soften bans instead of "no spawn"
    let left = safeLeft, top = safeTop, right = safeRight, bottom = safeBottom;
    if ((right - left) < (size + 16)) { left = 10; right = Math.max(20, Math.round(rStage.width - 10)); }
    if ((bottom - top) < (size + 16)) { top = 10; bottom = Math.max(20, Math.round(rStage.height - 10)); }

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);

    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random pos inside safe area (stage coords)
    const xStage = rand(left, Math.max(left, right - size));
    const yStage = rand(top, Math.max(top, bottom - size));

    // convert stage coords -> layer absolute coords
    // layer is inside stage; use rect offset
    const x = (rStage.left + xStage) - rLayer.left;
    const y = (rStage.top + yStage) - rLayer.top;

    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    // content
    el.textContent = this._emojiForType(data.type, data.bossEmoji);

    // pointer
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

  removeTarget(id){
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