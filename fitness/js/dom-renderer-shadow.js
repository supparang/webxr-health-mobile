// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ PATCH H: smart safe-zone spawn (avoid HUD / bars / meta panel)
//   - uses wrapEl query to measure occluders
//   - expands padding on small screens, keeps targets out of blocked zones

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || document;
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

  _rectIntersect(a, b){
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    const w = right - left;
    const h = bottom - top;
    if (w <= 0 || h <= 0) return null;
    return { left, top, right, bottom, width:w, height:h };
  }

  _measureOccluders(layerRect){
    // We avoid these areas (in viewport coords): HUD, top bars, bottom bars, meta panel
    const root = this.wrapEl || document;

    const hudTop   = root.querySelector('.sb-hud-top');
    const barsTop  = root.querySelector('.sb-bars-top');
    const barsBot  = root.querySelector('.sb-bars-bottom');
    const meta     = root.querySelector('.sb-meta');

    const occ = [];

    for (const el of [hudTop, barsTop, barsBot, meta]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const x = this._rectIntersect(layerRect, r);
      if (x) occ.push(x);
    }
    return occ;
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // base padding: looser on small screens
    const vw = Math.max(320, window.innerWidth || r.width || 820);
    const basePad = vw < 520 ? 18 : 22;
    const dynPad  = Math.min(44, Math.max(basePad, r.width * 0.035));
    let left   = r.left   + dynPad;
    let top    = r.top    + dynPad;
    let right  = r.right  - dynPad;
    let bottom = r.bottom - dynPad;

    // occluder-aware tightening
    const occ = this._measureOccluders(r);

    // 1) protect TOP area (HUD + top bars)
    // find the lowest bottom among occluders that sit near top
    let topBlockBottom = null;
    for (const o of occ){
      const oMidY = (o.top + o.bottom) * 0.5;
      const nearTop = oMidY < (r.top + r.height * 0.45);
      if (!nearTop) continue;
      topBlockBottom = topBlockBottom == null ? o.bottom : Math.max(topBlockBottom, o.bottom);
    }
    if (topBlockBottom != null){
      top = Math.max(top, topBlockBottom + 12);
    }

    // 2) protect BOTTOM area (bottom bars)
    // find the highest top among occluders that sit near bottom
    let bottomBlockTop = null;
    for (const o of occ){
      const oMidY = (o.top + o.bottom) * 0.5;
      const nearBot = oMidY > (r.top + r.height * 0.55);
      if (!nearBot) continue;
      bottomBlockTop = bottomBlockTop == null ? o.top : Math.min(bottomBlockTop, o.top);
    }
    if (bottomBlockTop != null){
      bottom = Math.min(bottom, bottomBlockTop - 12);
    }

    // 3) protect RIGHT area (meta panel)
    // if meta overlaps, shrink right bound to the meta's left
    const metaEl = (this.wrapEl || document).querySelector('.sb-meta');
    if (metaEl){
      const m = metaEl.getBoundingClientRect();
      const mi = this._rectIntersect(r, m);
      if (mi){
        // only if meta is actually on right side
        const metaOnRight = mi.left > (r.left + r.width * 0.45);
        if (metaOnRight){
          right = Math.min(right, mi.left - 12);
        }
      }
    }

    // keep sane min size
    const minW = 220, minH = 220;
    if ((right - left) < minW){
      const cx = (r.left + r.right) * 0.5;
      left = cx - minW/2;
      right = cx + minW/2;
    }
    if ((bottom - top) < minH){
      const cy = (r.top + r.bottom) * 0.52;
      top = cy - minH/2;
      bottom = cy + minH/2;
    }

    // convert back to local coords (relative to layer)
    return {
      r,
      left: left - r.left,
      top: top - r.top,
      right: right - r.left,
      bottom: bottom - r.top
    };
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

    const size = clamp(Number(data.sizePx) || 110, 64, 260);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random position in safe rect
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    el.textContent = this._emojiForType(data.type, data.bossEmoji);

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