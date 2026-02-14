// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ pointer hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ auto-expire by ttlMs: fade out with .is-expiring then remove
// ✅ optional onTargetExpire(id, info) so engine can count miss / do miss FX
// ✅ tries to avoid overlapping the right meta panel (.sb-meta)

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
    this.targets = new Map(); // id -> el
    this._timers = new Map(); // id -> timeoutId

    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    for (const [, t] of this._timers.entries()) {
      try { clearTimeout(t); } catch {}
    }
    this.targets.clear();
    this._timers.clear();
  }

  _safeAreaRect(){
    const r = this.layer.getBoundingClientRect();
    // keep margins away from edges (engine already has HUD outside stage)
    const pad = Math.min(44, Math.max(16, r.width * 0.035));
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

  _getMetaRect(){
    try{
      const meta = this.wrapEl ? this.wrapEl.querySelector('.sb-meta') : document.querySelector('.sb-meta');
      if (!meta) return null;
      const mr = meta.getBoundingClientRect();
      const lr = this.layer.getBoundingClientRect();
      // convert to layer-local coordinates
      return {
        left: mr.left - lr.left,
        top: mr.top - lr.top,
        right: mr.right - lr.left,
        bottom: mr.bottom - lr.top
      };
    }catch{
      return null;
    }
  }

  _pickPosAvoidMeta(left, top, right, bottom, size){
    // Try multiple candidates; choose the one with max distance from meta center if overlapping
    const meta = this._getMetaRect();
    const tries = 12;

    let best = null;
    let bestScore = -1;

    const metaCx = meta ? (meta.left + meta.right) / 2 : 0;
    const metaCy = meta ? (meta.top + meta.bottom) / 2 : 0;

    for (let i=0; i<tries; i++){
      const x = rand(left, Math.max(left, right - size));
      const y = rand(top, Math.max(top, bottom - size));

      if (!meta){
        return { x, y };
      }

      const a = { left:x, top:y, right:x+size, bottom:y+size };
      const overlap = !(a.right < meta.left || a.left > meta.right || a.bottom < meta.top || a.top > meta.bottom);

      if (!overlap){
        return { x, y };
      }

      // if overlap, score by distance from meta center (try to push away)
      const cx = x + size/2;
      const cy = y + size/2;
      const dx = cx - metaCx;
      const dy = cy - metaCy;
      const score = dx*dx + dy*dy;

      if (score > bestScore){
        bestScore = score;
        best = { x, y };
      }
    }

    return best || { x:left, y:top };
  }

  spawnTarget(data){
    if (!this.layer || !data) return;

    const { r, left, top, right, bottom } = this._safeAreaRect();

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);
    el.dataset.type = String(data.type || 'normal');

    const size = clamp(Number(data.sizePx) || 120, 64, 280);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random position (avoid meta if possible)
    const pos = this._pickPosAvoidMeta(left, top, right, bottom, size);
    el.style.left = Math.round(pos.x) + 'px';
    el.style.top = Math.round(pos.y) + 'px';

    // content
    const emoji = this._emojiForType(data.type, data.bossEmoji);
    el.textContent = emoji;

    // attach
    el.addEventListener('pointerdown', this._onPointer, { passive: true });
    this.layer.appendChild(el);
    this.targets.set(data.id, el);

    // ttl -> expire
    const ttlMs = clamp(Number(data.ttlMs) || 0, 0, 60000);
    if (ttlMs > 0){
      const t = setTimeout(() => {
        // if already removed/hit, ignore
        const cur = this.targets.get(data.id);
        if (!cur) return;

        // fade out (soft)
        try { cur.classList.add('is-expiring'); } catch {}

        // let engine know (for miss counting / miss fx) BEFORE removal
        try{
          if (this.onTargetExpire){
            const rect = cur.getBoundingClientRect();
            const cx = rect.left + rect.width/2;
            const cy = rect.top + rect.height/2;
            this.onTargetExpire(data.id, {
              clientX: cx,
              clientY: cy,
              type: cur.dataset.type || (data.type || 'normal')
            });
          }
        }catch{}

        // remove after short delay (match CSS transition)
        setTimeout(() => {
          this.removeTarget(data.id, 'expire');
        }, 140);
      }, ttlMs);

      this._timers.set(data.id, t);
    }
  }

  _onPointer(e){
    const el = e.currentTarget;
    if (!el) return;

    const id = Number(el.dataset.id);
    if (!Number.isFinite(id)) return;

    // prevent double-fire after expiring animation starts
    if (el.classList.contains('is-expiring')) return;

    // forward hit
    if (this.onTargetHit) {
      this.onTargetHit(id, { clientX: e.clientX, clientY: e.clientY });
    }
  }

  removeTarget(id, reason){
    const el = this.targets.get(id);
    if (!el) return;

    // clear timer
    const t = this._timers.get(id);
    if (t){
      try { clearTimeout(t); } catch {}
      this._timers.delete(id);
    }

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
    } else if (grade === 'miss') {
      // lightweight miss (for expiry)
      FxBurst.burst(x, y, { n: 6, spread: 32, ttlMs: 420, cls: 'sb-fx-miss' });
      FxBurst.popText(x, y, 'MISS', 'sb-fx-miss');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}