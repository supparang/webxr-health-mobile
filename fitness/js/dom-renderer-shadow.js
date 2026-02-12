// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ TTL expire -> fadeout then remove (PATCH G)
// ✅ onTargetExpire(id, meta) callback (PATCH G)
// ✅ FX via FxBurst (hit side uses renderer.playHitFx)

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

    // ✅ PATCH G: expire callback
    this.onTargetExpire = typeof opts.onTargetExpire === 'function' ? opts.onTargetExpire : null;

    this.diffKey = 'normal';
    this.targets = new Map();     // id -> el
    this.timers = new Map();      // id -> { ttl, fade }
    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();

    for (const [id, t] of this.timers.entries()){
      try { clearTimeout(t.ttl); } catch {}
      try { clearTimeout(t.fade); } catch {}
    }
    this.timers.clear();
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();
    // keep margins away from HUD/meta
    const pad = Math.min(44, Math.max(18, r.width * 0.04));
    const top = pad + 10;
    const left = pad + 10;
    const right = r.width - pad - 10;
    const bottom = r.height - pad - 10;
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

  // ✅ PATCH G: internal timer wiring
  _armTTL(id, ttlMs, meta){
    // clear old
    const old = this.timers.get(id);
    if (old){
      try { clearTimeout(old.ttl); } catch {}
      try { clearTimeout(old.fade); } catch {}
      this.timers.delete(id);
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;

    // fade window: last 140ms
    const fadeMs = 140;
    const tFade = Math.max(0, ttlMs - fadeMs);

    const fade = setTimeout(()=>{
      const el = this.targets.get(id);
      if (!el) return;
      el.classList.add('sb-target--fadeout'); // CSS has this
    }, tFade);

    const ttl = setTimeout(()=>{
      // if still alive => expire
      const el = this.targets.get(id);
      if (!el) return;

      // compute center for soft miss fx (optional)
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;

      // remove element
      this.removeTarget(id, 'timeout');

      // callback to engine (count miss / hp penalty / etc.)
      if (this.onTargetExpire){
        this.onTargetExpire(id, {
          ...meta,
          clientX: cx,
          clientY: cy,
          reason: 'timeout'
        });
      }
    }, ttlMs);

    this.timers.set(id, { ttl, fade });
  }

  spawnTarget(data){
    if (!this.layer || !data) return;

    const { left, top, right, bottom } = this._safeAreaRect();

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);
    el.dataset.type = String(data.type || 'normal');

    const size = clamp(Number(data.sizePx) || 120, 64, 300);
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

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(data.id, el);

    // ✅ PATCH G: TTL expire
    const ttlMs = Number(data.ttlMs);
    this._armTTL(data.id, ttlMs, {
      targetType: (data.type || 'normal'),
      sizePx: Math.round(size)
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

  removeTarget(id, reason){
    // clear timers
    const t = this.timers.get(id);
    if (t){
      try { clearTimeout(t.ttl); } catch {}
      try { clearTimeout(t.fade); } catch {}
      this.timers.delete(id);
    }

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

  // ✅ optional: simple miss fx helper (engine may call its own)
  playMissFx(x, y){
    FxBurst.burst(x, y, { n: 8, spread: 42, ttlMs: 520, cls: 'sb-fx-miss' });
    FxBurst.popText(x, y, 'MISS', 'sb-fx-miss');
  }
}