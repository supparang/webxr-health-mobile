// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ PATCH Q: smart safe-zone (avoid HUD/Bars/Meta/Controls) + better scattering + adaptive size

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

function rectIntersect(a,b){
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function rectFrom(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, w:r.width, h:r.height };
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

  // ---------- PATCH Q helpers ----------
  _getBlocks() {
    // elements we must avoid (best-effort)
    const DOC = document;
    const blocks = [];

    // HUD + bars + controls (in play view)
    const hudTop    = DOC.querySelector('.sb-hud-top');
    const barsTop   = DOC.querySelector('.sb-bars-top');
    const barsBot   = DOC.querySelector('.sb-bars-bottom');
    const controls  = DOC.querySelector('.sb-controls');
    const meta      = DOC.querySelector('.sb-meta');

    const add = (el, pad=10) => {
      const r = rectFrom(el);
      if(!r) return;
      blocks.push({
        left: r.left - pad,
        top: r.top - pad,
        right: r.right + pad,
        bottom: r.bottom + pad
      });
    };

    // padding per block (meta gets bigger pad)
    add(hudTop, 12);
    add(barsTop, 10);
    add(barsBot, 10);
    add(controls, 10);
    add(meta, 14);

    return blocks;
  }

  _safeAreaRect(){
    // base rect = layer rect
    const r = this.layer.getBoundingClientRect();

    // base padding from edges (smaller than before to reduce “tight feeling”)
    const pad = Math.min(34, Math.max(14, r.width * 0.028));

    const left = pad;
    const top = pad;
    const right = r.width - pad;
    const bottom = r.height - pad;

    // return in LOCAL coords (layer space), plus absolute rect for converting blocks
    return { r, left, top, right, bottom };
  }

  _adaptiveSize(px){
    // PATCH Q: size scales by viewport; mobile => smaller
    const vw = Math.max(320, Math.min(1400, window.innerWidth || 900));
    const scale = vw < 480 ? 0.88 : (vw < 820 ? 0.94 : 1.0);
    return Math.round((Number(px) || 110) * scale);
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

  _pickPosition(size, blocksAbs){
    const { r, left, top, right, bottom } = this._safeAreaRect();

    // convert blocks from ABS viewport coords -> LOCAL layer coords
    const blocks = (blocksAbs || []).map(b => ({
      left: b.left - r.left,
      top: b.top - r.top,
      right: b.right - r.left,
      bottom: b.bottom - r.top
    }));

    // candidate tries
    const tries = 26;

    // keep distance from existing targets (avoid clustering)
    const minDist = Math.max(18, Math.min(56, size * 0.35));

    const existing = [];
    for (const el of this.targets.values()) {
      try {
        const er = el.getBoundingClientRect();
        existing.push({
          cx: (er.left - r.left) + er.width/2,
          cy: (er.top - r.top) + er.height/2
        });
      } catch {}
    }

    const fits = (x,y)=>{
      const rect = { left:x, top:y, right:x+size, bottom:y+size };
      // stay inside safe area
      if (rect.left < left || rect.top < top || rect.right > right || rect.bottom > bottom) return false;
      // avoid blocks
      for (const b of blocks) {
        if (rectIntersect(rect, b)) return false;
      }
      // avoid clustering
      const cx = x + size/2, cy = y + size/2;
      for (const p of existing) {
        const dx = cx - p.cx, dy = cy - p.cy;
        if ((dx*dx + dy*dy) < (minDist*minDist)) return false;
      }
      return true;
    };

    for (let i=0;i<tries;i++){
      const x = rand(left, Math.max(left, right - size));
      const y = rand(top, Math.max(top, bottom - size));
      if (fits(x,y)) return { x, y };
    }

    // fallback: just place within safe area (even if near blocks) but still within bounds
    return {
      x: rand(left, Math.max(left, right - size)),
      y: rand(top, Math.max(top, bottom - size))
    };
  }

  spawnTarget(data){
    if (!this.layer || !data) return;

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);

    // ✅ PATCH Q: adaptive size + tighter clamp
    const raw = Number(data.sizePx) || 110;
    const scaled = this._adaptiveSize(raw);
    const size = clamp(scaled, 62, 240);

    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // ✅ PATCH Q: smart position (avoid HUD/meta/controls) + anti-cluster
    const blocksAbs = this._getBlocks();
    const { x, y } = this._pickPosition(size, blocksAbs);
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