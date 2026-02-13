// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets (TTL + soft expire)
// ✅ spawn/remove targets in #sb-target-layer
// ✅ pointerdown hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ expires -> fades out then removes + calls onTargetExpire(id, info)
// ✅ FX via FxBurst (engine calls renderer.playHitFx)
// Export: DomRendererShadow

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
    this.onTargetExpire = typeof opts.onTargetExpire === 'function' ? opts.onTargetExpire : null;

    this.diffKey = 'normal';
    this.targets = new Map();     // id -> element
    this.meta = new Map();        // id -> { type, bornAt, ttlMs, timer, sizePx, bossEmoji }

    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
      const m = this.meta.get(id);
      if (m?.timer) { try { clearTimeout(m.timer); } catch {} }
    }
    this.targets.clear();
    this.meta.clear();
  }

  // --- Compute a safe rect to spawn targets (avoid HUD + meta overlay) ---
  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();

    // base padding scales with width
    const pad = Math.min(46, Math.max(18, r.width * 0.04));

    // reserve top/bottom for HUD/bars feel
    const topHud = Math.min(110, Math.max(74, r.height * 0.10));
    const bottomHud = Math.min(110, Math.max(74, r.height * 0.10));

    // reserve right area for meta panel (if present)
    // read CSS var if available, else default 250
    let metaW = 250;
    try{
      const cs = getComputedStyle(document.documentElement);
      const v = parseFloat(cs.getPropertyValue('--sb-meta-w')) || 0;
      if (v > 140) metaW = v;
    }catch{}

    // if viewport is small, reserve less so it doesn't choke the field
    if (r.width < 520) metaW = Math.min(metaW, Math.max(160, r.width * 0.38));

    const left = pad + 8;
    const top = pad + 6 + Math.max(0, topHud - 62);
    const right = r.width - pad - 8 - Math.max(0, metaW - 140); // reserve part of meta width
    const bottom = r.height - pad - 8 - Math.max(0, bottomHud - 62);

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

    const id = Number(data.id);
    if (!Number.isFinite(id)) return;

    // prevent duplicates
    if (this.targets.has(id)) return;

    const { left, top, right, bottom } = this._safeAreaRect();

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(id);

    const size = clamp(Number(data.sizePx) || 110, 64, 260);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random position
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    // content
    const emoji = this._emojiForType(data.type, data.bossEmoji);
    el.textContent = emoji;

    // input
    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    // mount
    this.layer.appendChild(el);
    this.targets.set(id, el);

    // TTL / expire
    const ttlMs = clamp(Number(data.ttlMs) || 1200, 450, 5000);
    const bornAt = performance.now();

    const timer = setTimeout(() => {
      this._expireTarget(id, 'ttl');
    }, ttlMs);

    this.meta.set(id, {
      type: data.type || 'normal',
      bossEmoji: data.bossEmoji || '',
      sizePx: size,
      bornAt,
      ttlMs,
      timer
    });
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

  _expireTarget(id, reason='ttl'){
    const el = this.targets.get(id);
    const m = this.meta.get(id);

    // already removed
    if (!el) return;

    // stop future timer
    if (m?.timer) { try { clearTimeout(m.timer); } catch {} }

    // soft fade-out
    try{ el.classList.add('is-expiring'); }catch{}

    // capture center point for potential miss fx
    let cx = window.innerWidth/2, cy = window.innerHeight/2;
    try{
      const r = el.getBoundingClientRect();
      cx = r.left + r.width/2;
      cy = r.top + r.height/2;
    }catch{}

    // remove after short fade (match CSS transition ~120ms)
    setTimeout(() => {
      // may have been removed by hit
      const el2 = this.targets.get(id);
      if (!el2) return;

      try { el2.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el2.remove(); } catch {}

      this.targets.delete(id);
      this.meta.delete(id);

      // notify engine for miss logic
      if (this.onTargetExpire) {
        this.onTargetExpire(id, {
          reason,
          type: m?.type || 'normal',
          ttlMs: m?.ttlMs || 0,
          bornAt: m?.bornAt || 0,
          clientX: cx,
          clientY: cy
        });
      }
    }, 140);
  }

  removeTarget(id, reason='remove'){
    const el = this.targets.get(id);
    if (!el) return;

    const m = this.meta.get(id);
    if (m?.timer) { try { clearTimeout(m.timer); } catch {} }

    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}

    this.targets.delete(id);
    this.meta.delete(id);
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

  // optional helper: engine may call this to show a soft miss fx
  playMissFx(x, y, text='MISS'){
    FxBurst.burst(x, y, { n: 7, spread: 42, ttlMs: 520, cls: 'sb-fx-miss' });
    FxBurst.popText(x, y, text, 'sb-fx-miss');
  }
}