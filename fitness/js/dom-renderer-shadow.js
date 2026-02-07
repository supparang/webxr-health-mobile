// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ PATCH: smaller targets + avoid HUD/meta overlays (safe-area)

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
  }

  setDifficulty(k){ this.diffKey = (k || 'normal').toLowerCase(); }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();
  }

  _pickSizePx(data){
    // Base sizes tuned for Mobile-first (เป้าห้าม “กินจอ”)
    // easy > normal > hard
    const diff = this.diffKey;
    const base =
      diff === 'easy' ? 104 :
      diff === 'hard' ?  86 :
                        96;

    // types: bossface a bit bigger, bomb/decoy slightly smaller
    const t = (data?.type || 'normal');
    let s = base;
    if (t === 'bossface') s += 12;
    if (t === 'bomb' || t === 'decoy') s -= 6;

    // allow engine override (sizePx) but clamp to sane range
    const want = Number(data?.sizePx);
    if (Number.isFinite(want)) s = want;

    // FINAL CLAMP (นี่แหละที่ทำให้ “ไม่ใหญ่เกิน”)
    return clamp(s, 72, 132);
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // dynamic HUD avoidance (best effort)
    const hud = document.querySelector('.sb-hud');
    const barsTop = document.querySelector('.sb-bars-top');
    const barsBottom = document.querySelector('.sb-bars-bottom');
    const meta = document.querySelector('.sb-meta');

    const hudH = hud ? hud.getBoundingClientRect().height : 0;
    const topBarsH = barsTop ? barsTop.getBoundingClientRect().height : 0;
    const bottomBarsH = barsBottom ? barsBottom.getBoundingClientRect().height : 0;

    // pad scales with viewport
    const padX = clamp(r.width * 0.05, 16, 34);
    const padY = clamp(r.height * 0.05, 16, 34);

    // reserve top/bottom zones so targets don't sit under HUD/bars
    const top = padY + hudH + topBarsH + 10;
    const bottom = r.height - (padY + bottomBarsH + 10);

    // meta avoidance: keep away from right side where meta panel sits
    let right = r.width - padX;
    if (meta) {
      const mr = meta.getBoundingClientRect();
      // if meta overlaps stage region, reserve its width + margin
      const reserve = clamp(mr.width + 14, 160, 320);
      right = Math.max(padX + 40, r.width - reserve);
    }

    const left = padX;

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

    const size = this._pickSizePx(data);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random position inside safe zone
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top,  Math.max(top,  bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    // content
    el.textContent = this._emojiForType(data.type, data.bossEmoji);

    // mobile feel
    el.style.touchAction = 'manipulation';

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
      FxBurst.burst(x, y, { n: 14, spread: 64, ttlMs: 640, cls: 'sb-fx-fever' });
      FxBurst.popText(x, y, `PERFECT +${Math.max(0,scoreDelta)}`, 'sb-fx-fever');
    } else if (grade === 'good') {
      FxBurst.burst(x, y, { n: 10, spread: 46, ttlMs: 540, cls: 'sb-fx-hit' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-hit');
    } else if (grade === 'bad') {
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, `+${Math.max(0,scoreDelta)}`, 'sb-fx-miss');
    } else if (grade === 'bomb') {
      FxBurst.burst(x, y, { n: 16, spread: 80, ttlMs: 700, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      FxBurst.burst(x, y, { n: 12, spread: 58, ttlMs: 620, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      FxBurst.burst(x, y, { n: 12, spread: 58, ttlMs: 620, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 44, ttlMs: 520 });
    }
  }
}