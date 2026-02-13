// === /fitness/js/dom-renderer-shadow.js ===
// DomRendererShadow — SAFE (spawn/remove/expire + FX anchor)
// PATCH v20260213-shadowbreaker-expire
// ✅ expire fade (sb-expire) then remove
// ✅ supports onTargetExpire(id, info) callback
// ✅ removeTarget safe (double-call tolerant)
// ✅ targets Map for fast lookup
// ✅ spawn respects wrap rect + safe margins

'use strict';

import { FXBurst } from './fx-burst.js'; // if you already have; else keep stub usage guarded

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const now = ()=>performance.now();

export class DomRendererShadow{
  constructor(layerEl, opt={}){
    this.layerEl = layerEl;
    this.wrapEl = opt.wrapEl || layerEl?.parentElement || document.body;
    this.feedbackEl = opt.feedbackEl || null;

    this.onTargetHit = typeof opt.onTargetHit === 'function' ? opt.onTargetHit : null;
    this.onTargetExpire = typeof opt.onTargetExpire === 'function' ? opt.onTargetExpire : null;

    this.targets = new Map(); // id -> {el, ttlAt, type, sizePx}
    this._diff = 'normal';

    this._safe = { top: 10, bottom: 10, left: 10, right: 10 };
    this._readSafeFromCSS();

    this._boundPointerDown = (ev)=>this._onPointerDown(ev);
    this.layerEl?.addEventListener('pointerdown', this._boundPointerDown, { passive:false });

    // FX
    this.fx = null;
    try{
      this.fx = new FXBurst({ root: this.wrapEl });
    }catch(e){
      // ok if fx module not present
      this.fx = null;
    }
  }

  setDifficulty(d){
    this._diff = d || 'normal';
  }

  destroy(){
    // remove all
    for(const [id, obj] of this.targets){
      try{ obj?.el?.remove?.(); }catch{}
    }
    this.targets.clear();

    try{
      this.layerEl?.removeEventListener('pointerdown', this._boundPointerDown);
    }catch{}
  }

  // -------------------------
  // safe margins (CSS vars)
  // -------------------------
  _readSafeFromCSS(){
    try{
      const cs = getComputedStyle(document.documentElement);
      const t = parseFloat(cs.getPropertyValue('--hw-top-safe')) || 0;
      const b = parseFloat(cs.getPropertyValue('--hw-bottom-safe')) || 0;
      // fallback: not hygiene vars? keep small
      this._safe.top = clamp(t || 10, 0, 180);
      this._safe.bottom = clamp(b || 10, 0, 220);
    }catch{}
  }

  _rect(){
    const r = (this.layerEl || this.wrapEl).getBoundingClientRect();
    return { x:r.left, y:r.top, w:r.width, h:r.height };
  }

  // -------------------------
  // spawn
  // -------------------------
  spawnTarget({ id, type='normal', sizePx=110, bossEmoji='🎯', ttlMs=1200 }){
    if(!this.layerEl) return;

    // if exists, remove first
    if(this.targets.has(id)) this.removeTarget(id, 'respawn');

    const el = document.createElement('div');
    el.className = `sb-target sb-target--${type}`;
    el.dataset.id = String(id);
    el.dataset.type = type;

    // visual content
    // (keep simple: emoji for all; you already style with bg)
    if(type === 'bomb') el.textContent = '💣';
    else if(type === 'decoy') el.textContent = '🌀';
    else if(type === 'heal') el.textContent = '💚';
    else if(type === 'shield') el.textContent = '🛡️';
    else if(type === 'bossface') el.textContent = bossEmoji || '😈';
    else el.textContent = '🎯';

    // size
    const s = Math.max(72, Math.min(220, Number(sizePx)||110));
    el.style.width = `${s}px`;
    el.style.height = `${s}px`;

    // position inside layer rect w/ safe margins
    const rc = this._rect();

    // hard safe margins:
    const padL = 10, padR = 10;
    const padT = 10 + (this._safe.top||0);
    const padB = 10 + (this._safe.bottom||0);

    const minX = padL;
    const maxX = Math.max(padL, rc.w - padR - s);
    const minY = padT;
    const maxY = Math.max(padT, rc.h - padB - s);

    // if stage too small, clamp
    const x = Math.floor(clamp(Math.random()*(maxX-minX) + minX, 0, Math.max(0, rc.w - s)));
    const y = Math.floor(clamp(Math.random()*(maxY-minY) + minY, 0, Math.max(0, rc.h - s)));

    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    // append
    this.layerEl.appendChild(el);

    // ttl
    const ttlAt = now() + Math.max(250, Number(ttlMs)||1200);

    const obj = { el, ttlAt, type, sizePx:s };
    this.targets.set(id, obj);

    // schedule expire
    obj._ttlTimer = setTimeout(()=>{
      // might already removed
      if(!this.targets.has(id)) return;

      // ✅ expire animation then remove
      try{
        el.classList.add('sb-expire');
      }catch{}

      // callback BEFORE remove (engine decides miss)
      try{
        this.onTargetExpire && this.onTargetExpire(id, { type, sizePx:s });
      }catch{}

      // remove after a tiny delay (match css animation .14s)
      setTimeout(()=>{
        this.removeTarget(id, 'expire');
      }, 150);

    }, Math.max(0, ttlAt - now()));
  }

  // -------------------------
  // hit / remove
  // -------------------------
  _onPointerDown(ev){
    // find target by closest
    const t = ev.target?.closest?.('.sb-target');
    if(!t) return;

    ev.preventDefault();

    const id = Number(t.dataset.id);
    if(!Number.isFinite(id)) return;

    // point coords for FX anchor
    const pt = {
      clientX: ev.clientX ?? (ev.touches?.[0]?.clientX ?? 0),
      clientY: ev.clientY ?? (ev.touches?.[0]?.clientY ?? 0),
    };

    // let engine handle scoring/removal
    try{
      this.onTargetHit && this.onTargetHit(id, pt);
    }catch(e){
      console.error(e);
    }
  }

  removeTarget(id, reason='unknown'){
    const obj = this.targets.get(id);
    if(!obj) return;

    this.targets.delete(id);

    try{ clearTimeout(obj._ttlTimer); }catch{}

    try{
      obj.el?.remove?.();
    }catch{}
  }

  // -------------------------
  // FX
  // -------------------------
  playHitFx(id, { clientX=0, clientY=0, grade='good', scoreDelta=0 } = {}){
    // Guard: FX module optional
    if(!this.fx || typeof this.fx.pop !== 'function') return;

    try{
      this.fx.pop({ x: clientX, y: clientY, grade, scoreDelta });
    }catch{}
  }
}