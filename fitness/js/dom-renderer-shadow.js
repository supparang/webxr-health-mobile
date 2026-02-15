// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker targets
// ✅ spawn/remove targets in #sb-target-layer
// ✅ click/touch hit -> calls onTargetHit(id, {clientX, clientY})
// ✅ SAFE ZONE from CSS vars (HUD-safe 100%)
// ✅ targets Map stores { el, type, expireAt }
// ✅ expireTarget(id) smooth fade-out

'use strict';

import { FxBurst } from './fx-burst.js';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rand(min,max){ return min + Math.random()*(max-min); }

function readCssPx(el, name, fallback=0){
  try{
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    if(!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }catch{
    return fallback;
  }
}

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';

    // Map: id -> { el, type, expireAt, removing }
    this.targets = new Map();

    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(k){ this.diffKey = k || 'normal'; }

  destroy(){
    for (const [id, obj] of this.targets.entries()) {
      const el = obj?.el;
      if(!el) continue;
      try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
      try { el.remove(); } catch {}
    }
    this.targets.clear();
  }

  _safeAreaRect(){
    const layer = this.layer;
    const r = layer.getBoundingClientRect();

    // ✅ Base padding (small so playfield feels open)
    const basePad = Math.min(28, Math.max(12, r.width * 0.025));

    // ✅ Read safe-zone margins injected by engine via CSS vars
    const host = this.wrapEl || document.documentElement;

    const safeTop    = readCssPx(host, '--sb-safe-top', 0);
    const safeBottom = readCssPx(host, '--sb-safe-bottom', 0);
    const safeLeft   = readCssPx(host, '--sb-safe-left', 0);
    const safeRight  = readCssPx(host, '--sb-safe-right', 0);

    const left   = basePad + safeLeft;
    const top    = basePad + safeTop;
    const right  = r.width  - basePad - safeRight;
    const bottom = r.height - basePad - safeBottom;

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

    const id = Number(data.id);
    if(!Number.isFinite(id)) return;

    // avoid duplicates
    if(this.targets.has(id)){
      this.removeTarget(id, 'dup');
    }

    const el = document.createElement('div');
    const type = String(data.type || 'normal');
    el.className = 'sb-target sb-target--' + type;
    el.dataset.id = String(id);
    el.dataset.type = type;

    const size = clamp(Number(data.sizePx) || 110, 60, 220);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random position (ensure inside safe-zone)
    const x = rand(left, Math.max(left, right - size));
    const y = rand(top,  Math.max(top,  bottom - size));
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    // content
    el.textContent = this._emojiForType(type, data.bossEmoji);

    // lifecycle hint
    const ttl = Number(data.ttlMs) || 0;
    const expireAt = ttl > 0 ? (performance.now() + ttl) : 0;

    el.addEventListener('pointerdown', this._onPointer, { passive: true });

    // pop-in
    el.style.opacity = '0';
    el.style.transform = 'scale(.86)';
    this.layer.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.transition = 'transform 140ms ease-out, opacity 140ms ease-out';
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
    });

    this.targets.set(id, { el, type, expireAt, removing:false });
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
    const obj = this.targets.get(id);
    const el = obj?.el;
    if (!el) return;

    try { el.removeEventListener('pointerdown', this._onPointer); } catch {}
    try { el.remove(); } catch {}
    this.targets.delete(id);
  }

  // ✅ smooth expire (fade + shrink) then remove
  expireTarget(id){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if(!el) return;

    if(obj.removing) return;
    obj.removing = true;

    try{ el.style.pointerEvents = 'none'; }catch{}

    // smooth vanish
    const done = () => {
      try { el.removeEventListener('transitionend', done); } catch {}
      this.removeTarget(id, 'expire');
    };

    try{
      el.addEventListener('transitionend', done);
      el.style.transition = 'transform 180ms ease-in, opacity 180ms ease-in, filter 180ms ease-in';
      el.style.opacity = '0';
      el.style.transform = 'scale(.72)';
      el.style.filter = 'blur(1px)';
      // fallback remove
      setTimeout(done, 240);
    }catch{
      done();
    }
  }

  playHitFx(id, info = {}){
    // if target exists use its center, else use given pointer
    const obj = this.targets.get(id);
    const el = obj?.el;
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
      FxBurst.popText(x, y, `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`, 'sb-fx-miss');
    } else if (grade === 'bomb') {
      FxBurst.burst(x, y, { n: 16, spread: 86, ttlMs: 700, cls: 'sb-fx-bomb' });
      FxBurst.popText(x, y, `-${Math.abs(scoreDelta)}`, 'sb-fx-bomb');
    } else if (grade === 'heal') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-heal' });
      FxBurst.popText(x, y, '+HP', 'sb-fx-heal');
    } else if (grade === 'shield') {
      FxBurst.burst(x, y, { n: 12, spread: 60, ttlMs: 620, cls: 'sb-fx-shield' });
      FxBurst.popText(x, y, '+SHIELD', 'sb-fx-shield');
    } else if (grade === 'expire') {
      // ✅ soft miss FX (no harsh red)
      FxBurst.burst(x, y, { n: 7, spread: 42, ttlMs: 520, cls: 'sb-fx-decoy' });
      FxBurst.popText(x, y, 'MISS', 'sb-fx-tip');
    } else {
      FxBurst.burst(x, y, { n: 8, spread: 46, ttlMs: 520 });
    }
  }
}