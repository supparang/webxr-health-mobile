// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst (patched: smaller + tighter spread)

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
    this.targets = new Map();
    this._onPointer = this._onPointer.bind(this);

    // reserve meta panel area (top-right)
    this._reserveMeta = opts.reserveMeta !== false; // default true
  }

  setDifficulty(k){ this.diffKey = (k || 'normal').toLowerCase(); }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();
  }

  _isMobile(){
    try { return matchMedia('(max-width: 640px)').matches; } catch { return false; }
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // Base padding
    const basePad = Math.min(46, Math.max(18, r.width * 0.045));
    const isMobile = this._isMobile();

    // Extra top/bottom to avoid HUD/bars; mobile needs more
    const topPad = basePad + (isMobile ? 58 : 44);
    const bottomPad = basePad + (isMobile ? 70 : 54);
    const sidePad = basePad + 10;

    const left = sidePad;
    const top = topPad;
    const right = r.width - sidePad;
    const bottom = r.height - bottomPad;

    // Reserve meta panel area (top-right card)
    // Approx box: width 260 (or 62vw mobile), height 210-ish
    const metaW = Math.min(260, isMobile ? r.width * 0.62 : r.width * 0.42);
    const metaH = isMobile ? 200 : 210;
    const metaPad = 10;

    const metaRect = this._reserveMeta
      ? {
          x0: r.width - metaW - metaPad,
          y0: metaPad,
          x1: r.width - metaPad,
          y1: metaH + metaPad
        }
      : null;

    return { r, left, top, right, bottom, metaRect };
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

  _sizeForDifficulty(base){
    const isMobile = this._isMobile();
    const k = this.diffKey;

    // baseline from engine
    let s = Number(base) || 120;

    // Difficulty scaling tuned for kids/mobile readability
    if (k === 'easy') s *= 1.18;
    else if (k === 'hard') s *= 0.92;

    // Mobile scaling: make targets a bit larger (touch friendly)
    if (isMobile) {
      if (k === 'easy') s *= 1.08;
      else if (k === 'hard') s *= 1.02;
      else s *= 1.05;
    }

    // clamp
    // Mobile: slightly higher min, lower max to avoid huge blobs
    const minS = isMobile ? 92 : 78;
    const maxS = isMobile ? 240 : 320;
    return clamp(Math.round(s), minS, maxS);
  }

  _pickPosition({left, top, right, bottom, metaRect}, size){
    // Try several times to avoid reserved meta panel zone
    for (let i=0;i<14;i++){
      const x = rand(left, Math.max(left, right - size));
      const y = rand(top, Math.max(top, bottom - size));
      const cx = x + size/2;
      const cy = y + size/2;

      if (metaRect){
        const inMeta =
          cx >= metaRect.x0 && cx <= metaRect.x1 &&
          cy >= metaRect.y0 && cy <= metaRect.y1;
        if (inMeta) continue;
      }
      return { x, y };
    }
    // fallback
    return {
      x: rand(left, Math.max(left, right - size)),
      y: rand(top, Math.max(top, bottom - size))
    };
  }

  spawnTarget(data){
    if (!this.layer || !data) return;

    const area = this._safeAreaRect();

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);

    const size = this._sizeForDifficulty(data.sizePx);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    const pos = this._pickPosition(area, size);
    el.style.left = Math.round(pos.x) + 'px';
    el.style.top = Math.round(pos.y) + 'px';

    // content
    const emoji = this._emojiForType(data.type, data.bossEmoji);
    el.textContent = emoji;

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

    // ✅ PATCH: tighten spreads (avoid huge FX that blocks play)
    if (grade === 'perfect') {
      FxBurst.burst(x, y, { n: 12, spread: 54, ttlMs: 620, cls: 'sb-fx-fever' });
      FxBurst.popText(x, y, `PERFECT +${Math.max(0,scoreDelta)}`, 'sb-fx-fever');
    } else if (grade === 'good') {
      FxBurst.burst(x, y, { n: 10, spread: 38, ttlMs: 520, cls: 'sb-fx-hit' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-hit');
    } else if (grade === 'bad') {
      FxBurst.burst(x, y, { n: 8, spread: 34, ttlMs: 500, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-miss');
    } else if (grade === 'bomb') {
      FxBurst.burst(x, y, { n: 14, spread: 64, ttlMs: 660, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      FxBurst.burst(x, y, { n: 10, spread: 44, ttlMs: 580, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      FxBurst.burst(x, y, { n: 10, spread: 44, ttlMs: 580, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 34, ttlMs: 520 });
    }
  }
}