// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ PATCH: adaptive size + diff/type scaling + separate hitbox vs visual

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

function isCoarsePointer(){
  try { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
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

  setDifficulty(k){ this.diffKey = (k || 'normal').toLowerCase(); }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();
  }

  // ---- sizing helpers ----
  _diffScale(){
    // easy bigger, hard smaller (feel different but still fair)
    if (this.diffKey === 'easy') return 1.12;
    if (this.diffKey === 'hard') return 0.88;
    return 1.0; // normal
  }

  _typeScale(t){
    const type = (t || 'normal').toLowerCase();
    if (type === 'heal' || type === 'shield') return 1.10;   // "want to grab"
    if (type === 'decoy' || type === 'bomb') return 0.88;     // trickier
    if (type === 'bossface') return 1.30;                     // boss moment
    return 1.0;
  }

  _baseVisualSizePx(){
    const r = this.layer.getBoundingClientRect();
    const m = Math.min(r.width, r.height);

    const coarse = isCoarsePointer();
    const smallScreen = r.width < 720;
    const mobileLike = coarse || smallScreen;

    // base target size in px (visual), clamped
    // Mobile: a bit larger; PC: slightly smaller
    const k = mobileLike ? 0.14 : 0.12;
    const minPx = mobileLike ? 52 : 48;
    const maxPx = mobileLike ? 86 : 84;

    return clamp(m * k, minPx, maxPx);
  }

  _sizesFor(data){
    const base = this._baseVisualSizePx();
    const visualFromEngine = Number(data && data.sizePx);

    // compute recommended visual size
    let visual = base * this._diffScale() * this._typeScale(data && data.type);

    // if engine sends sizePx, treat as "hint" but keep within sane bounds
    if (Number.isFinite(visualFromEngine) && visualFromEngine > 0) {
      // allow engine to nudge but clamp tight around our base
      const minV = base * 0.75;
      const maxV = base * 1.55;
      visual = clamp(visualFromEngine, minV, maxV);
      // still apply diff/type scale on top (so difficulty feels consistent)
      visual = visual * this._diffScale() * this._typeScale(data && data.type);
    }

    // final clamp (safety)
    visual = clamp(visual, 44, 110);

    // hitbox slightly larger than visual (mobile-friendly)
    const coarse = isCoarsePointer();
    const r = this.layer.getBoundingClientRect();
    const mobileLike = coarse || r.width < 720;
    const hitScale = mobileLike ? 1.12 : 1.06;
    const hit = clamp(visual * hitScale, visual, 140);

    return { visualPx: Math.round(visual), hitPx: Math.round(hit) };
  }

  _safeAreaRect(hitSize){
    const r = this.layer.getBoundingClientRect();

    // padding away from edges (avoid UI overlap feeling)
    const pad = Math.min(46, Math.max(18, r.width * 0.05));
    const left = pad;
    const top = pad;
    const right = r.width - pad;
    const bottom = r.height - pad;

    // ensure inside bounds given hitbox size
    const maxX = Math.max(left, right - hitSize);
    const maxY = Math.max(top, bottom - hitSize);

    return { r, left, top, right, bottom, maxX, maxY };
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

    const { visualPx, hitPx } = this._sizesFor(data);
    const { left, top, maxX, maxY } = this._safeAreaRect(hitPx);

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);

    // OUTER = hitbox size (easier on mobile)
    el.style.width = hitPx + 'px';
    el.style.height = hitPx + 'px';

    // position (use hitbox size so it never goes out of field)
    const x = rand(left, maxX);
    const y = rand(top, maxY);
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    // inner emoji uses visual size (so it doesn't look too huge)
    const emoji = this._emojiForType((data.type || 'normal').toLowerCase(), data.bossEmoji);

    // Use flex center to keep emoji centered even if hitbox > visual
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.lineHeight = '1';

    // emoji font sizing: tune visually (0.52 feels good for round target)
    const fontPx = Math.max(18, Math.round(visualPx * 0.52));
    el.style.fontSize = fontPx + 'px';
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
    // guard: if FxBurst not ready, don't crash gameplay
    if (!FxBurst || typeof FxBurst.burst !== 'function') return;

    const el = this.targets.get(id);
    const rect = el ? el.getBoundingClientRect() : null;
    const x = info.clientX ?? (rect ? rect.left + rect.width/2 : window.innerWidth/2);
    const y = info.clientY ?? (rect ? rect.top + rect.height/2 : window.innerHeight/2);

    const grade = info.grade || 'good';
    const scoreDelta = Number(info.scoreDelta) || 0;

    try{
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
    }catch(_){}
  }
}