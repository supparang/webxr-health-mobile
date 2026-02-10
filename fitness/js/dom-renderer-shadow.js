// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ FX via FxBurst
// ✅ PATCH H: smart safe-zone spawn (avoid HUD / bars / meta panel)
// ✅ PATCH I: TTL auto-expire (targets disappear if not hit)
// ✅ PATCH I: pickSpawnPos(sizePx) + spawnTarget supports fixed x/y
// ✅ PATCH I: telegraph(x,y,sizeMs) helper (warning ring)

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
    this.onTargetExpire = typeof opts.onTargetExpire === 'function' ? opts.onTargetExpire : null;

    this.diffKey = 'normal';
    this.targets = new Map();
    this._ttlTimers = new Map();

    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, el] of this.targets.entries()) {
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();

    for (const [id, t] of this._ttlTimers.entries()) {
      try { clearTimeout(t); } catch {}
    }
    this._ttlTimers.clear();
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

    const vw = Math.max(320, window.innerWidth || r.width || 820);
    const basePad = vw < 520 ? 18 : 22;
    const dynPad  = Math.min(44, Math.max(basePad, r.width * 0.035));

    let left   = r.left   + dynPad;
    let top    = r.top    + dynPad;
    let right  = r.right  - dynPad;
    let bottom = r.bottom - dynPad;

    const occ = this._measureOccluders(r);

    // top block
    let topBlockBottom = null;
    for (const o of occ){
      const oMidY = (o.top + o.bottom) * 0.5;
      const nearTop = oMidY < (r.top + r.height * 0.45);
      if (!nearTop) continue;
      topBlockBottom = topBlockBottom == null ? o.bottom : Math.max(topBlockBottom, o.bottom);
    }
    if (topBlockBottom != null) top = Math.max(top, topBlockBottom + 12);

    // bottom block
    let bottomBlockTop = null;
    for (const o of occ){
      const oMidY = (o.top + o.bottom) * 0.5;
      const nearBot = oMidY > (r.top + r.height * 0.55);
      if (!nearBot) continue;
      bottomBlockTop = bottomBlockTop == null ? o.top : Math.min(bottomBlockTop, o.top);
    }
    if (bottomBlockTop != null) bottom = Math.min(bottom, bottomBlockTop - 12);

    // right block (meta)
    const metaEl = (this.wrapEl || document).querySelector('.sb-meta');
    if (metaEl){
      const m = metaEl.getBoundingClientRect();
      const mi = this._rectIntersect(r, m);
      if (mi){
        const metaOnRight = mi.left > (r.left + r.width * 0.45);
        if (metaOnRight) right = Math.min(right, mi.left - 12);
      }
    }

    // minimum box
    const minW = 220, minH = 220;
    if ((right - left) < minW){
      const cx = (r.left + r.right) * 0.5;
      left = cx - minW/2; right = cx + minW/2;
    }
    if ((bottom - top) < minH){
      const cy = (r.top + r.bottom) * 0.52;
      top = cy - minH/2; bottom = cy + minH/2;
    }

    return {
      r,
      left: left - r.left,
      top: top - r.top,
      right: right - r.left,
      bottom: bottom - r.top
    };
  }

  // ✅ PATCH I: allow engine to compute a position once (for telegraph -> spawn)
  pickSpawnPos(sizePx){
    if (!this.layer) return { x: 0, y: 0 };
    const { left, top, right, bottom } = this._safeAreaRect();
    const size = clamp(Number(sizePx) || 110, 64, 260);
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top, Math.max(top, bottom - size));
    return { x: Math.round(x), y: Math.round(y) };
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

    const el = document.createElement('div');
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(data.id);

    const size = clamp(Number(data.sizePx) || 110, 64, 260);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // ✅ PATCH I: support fixed x/y
    let x = Number.isFinite(data.x) ? data.x : null;
    let y = Number.isFinite(data.y) ? data.y : null;
    if (x == null || y == null) {
      const pos = this.pickSpawnPos(size);
      x = pos.x; y = pos.y;
    }

    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';

    el.textContent = this._emojiForType(data.type, data.bossEmoji);
    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    this.layer.appendChild(el);
    this.targets.set(data.id, el);

    // ✅ PATCH I: TTL auto-expire (fix "target not disappearing")
    const ttl = clamp(Number(data.ttlMs) || 0, 0, 20000);
    if (ttl > 0) {
      const old = this._ttlTimers.get(data.id);
      if (old) { try { clearTimeout(old); } catch {} }
      const t = setTimeout(() => {
        // if still alive
        if (this.targets.has(data.id)) {
          this.removeTarget(data.id, 'ttl');
          try { this.onTargetExpire && this.onTargetExpire(data.id, data); } catch {}
        }
      }, ttl);
      this._ttlTimers.set(data.id, t);
    }
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

    const t = this._ttlTimers.get(id);
    if (t) { try { clearTimeout(t); } catch {} }
    this._ttlTimers.delete(id);
  }

  // ✅ PATCH I: warning ring before spawn
  telegraph(x, y, sizePx, ms = 120, cls = ''){
    const layer = this.layer;
    if (!layer) return;

    const ring = document.createElement('div');
    ring.className = 'sb-telegraph' + (cls ? ' ' + cls : '');
    const s = clamp(Number(sizePx) || 110, 64, 260);

    ring.style.width = s + 'px';
    ring.style.height = s + 'px';
    ring.style.left = Math.round(x) + 'px';
    ring.style.top = Math.round(y) + 'px';

    layer.appendChild(ring);
    setTimeout(()=>{ try{ ring.remove(); }catch{} }, clamp(ms, 60, 380));
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