// === /fitness/js/dom-renderer-shadow.js ===
// Dom renderer for Shadow Breaker (PATCH: safe-zone + true expiry + reliable pointer)
// Exposes: spawnTarget(), removeTarget(), expireTarget(), playHitFx(), destroy(), setDifficulty()
// Stores targets map: id -> { el, type, sizePx }

'use strict';

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

export class DomRendererShadow {
  constructor(layerEl, opts={}){
    this.layerEl = layerEl;
    this.wrapEl = opts.wrapEl || document.body;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.targets = new Map();   // id -> { el, type, sizePx }
    this.diff = 'normal';

    // bind
    this._onPointerDown = this._onPointerDown.bind(this);

    // ensure layer is clickable
    if(this.layerEl){
      this.layerEl.style.position = this.layerEl.style.position || 'relative';
      this.layerEl.style.pointerEvents = 'auto';
      this.layerEl.addEventListener('pointerdown', this._onPointerDown, { passive:false });
    }
  }

  setDifficulty(diff){
    this.diff = diff || 'normal';
    try{
      if(this.wrapEl) this.wrapEl.setAttribute('data-diff', this.diff);
    }catch{}
  }

  // --- safe zone helpers (driven by CSS vars) ---
  _readSafeVars(){
    const st = getComputedStyle(this.wrapEl || document.documentElement);
    const px = (name, def=0)=>{
      const v = st.getPropertyValue(name).trim();
      const n = Number(String(v).replace('px','').trim());
      return Number.isFinite(n) ? n : def;
    };
    // allow both: --sb-safe-* and fallback to safe-area insets
    const top    = px('--sb-safe-top',    px('--safe-top', 0));
    const bottom = px('--sb-safe-bottom', px('--safe-bottom', 0));
    const left   = px('--sb-safe-left',   px('--safe-left', 0));
    const right  = px('--sb-safe-right',  px('--safe-right', 0));
    return { top, bottom, left, right };
  }

  _layerRect(){
    return this.layerEl?.getBoundingClientRect?.() || { left:0, top:0, width:360, height:640 };
  }

  _pickXY(sizePx){
    const r = this._layerRect();
    const safe = this._readSafeVars();

    // keep a little inner padding too
    const pad = Math.max(10, Math.round(sizePx*0.08));
    const minX = r.left + safe.left + pad;
    const maxX = r.left + r.width - safe.right - pad - sizePx;
    const minY = r.top  + safe.top  + pad;
    const maxY = r.top  + r.height  - safe.bottom - pad - sizePx;

    // if too cramped, relax but still prevent NaN
    const x1 = (maxX > minX) ? minX : r.left + pad;
    const x2 = (maxX > minX) ? maxX : r.left + Math.max(pad, r.width - sizePx - pad);
    const y1 = (maxY > minY) ? minY : r.top + pad;
    const y2 = (maxY > minY) ? maxY : r.top + Math.max(pad, r.height - sizePx - pad);

    const x = x1 + Math.random()*(x2 - x1);
    const y = y1 + Math.random()*(y2 - y1);
    return { x, y };
  }

  // create target element
  spawnTarget(t){
    if(!this.layerEl) return;

    const id = t.id;
    const type = t.type || 'normal';
    const sizePx = clamp(Number(t.sizePx)||100, 50, 220);

    const el = document.createElement('div');
    el.className = `sb-target sb-target--${type}`;
    el.dataset.id = String(id);
    el.dataset.type = type;

    el.style.width = `${sizePx}px`;
    el.style.height = `${sizePx}px`;
    el.style.position = 'absolute';
    el.style.touchAction = 'none';
    el.style.pointerEvents = 'auto';

    // emoji / face
    const face = document.createElement('div');
    face.className = 'sb-target__face';
    face.textContent = (type === 'bossface') ? (t.bossEmoji || '👾') : this._emojiFor(type, t.bossEmoji);
    el.appendChild(face);

    // place
    const pos = this._pickXY(sizePx);
    const r = this._layerRect();
    el.style.left = `${pos.x - r.left}px`;
    el.style.top  = `${pos.y - r.top}px`;

    this.layerEl.appendChild(el);
    this.targets.set(id, { el, type, sizePx });

    // small pop in
    requestAnimationFrame(()=> el.classList.add('is-on'));
  }

  _emojiFor(type, bossEmoji){
    if(type === 'bomb') return '💣';
    if(type === 'decoy') return '😵‍💫';
    if(type === 'heal') return '❤️';
    if(type === 'shield') return '🛡️';
    if(type === 'bossface') return bossEmoji || '👾';
    return '🥊';
  }

  _onPointerDown(ev){
    // IMPORTANT: allow menu buttons to work (they’re outside layer)
    // This handler is only on layerEl, so safe.
    ev.preventDefault();

    const targetEl = ev.target?.closest?.('.sb-target');
    if(!targetEl) return;

    const id = Number(targetEl.dataset.id);
    if(!Number.isFinite(id)) return;

    const pt = { clientX: ev.clientX, clientY: ev.clientY };
    if(this.onTargetHit) this.onTargetHit(id, pt);
  }

  playHitFx(id, opt={}){
    // create lightweight fx at target center (or at pointer if given)
    const o = this.targets.get(id);
    const el = o?.el;
    const layer = this.layerEl;
    if(!layer) return;

    const fx = document.createElement('div');
    fx.className = 'sb-fx';

    const grade = opt.grade || 'good';
    fx.dataset.grade = grade;

    let x = opt.clientX, y = opt.clientY;
    if(!(Number.isFinite(x) && Number.isFinite(y)) && el){
      const r = el.getBoundingClientRect();
      x = r.left + r.width/2;
      y = r.top + r.height/2;
    }
    if(!(Number.isFinite(x) && Number.isFinite(y))) return;

    const lr = layer.getBoundingClientRect();
    fx.style.left = `${x - lr.left}px`;
    fx.style.top  = `${y - lr.top}px`;

    layer.appendChild(fx);
    requestAnimationFrame(()=> fx.classList.add('is-on'));
    setTimeout(()=> fx.remove(), 420);
  }

  removeTarget(id, reason='hit'){
    const o = this.targets.get(id);
    if(!o?.el) { this.targets.delete(id); return; }
    const el = o.el;
    this.targets.delete(id);

    el.classList.add(reason === 'hit' ? 'is-hit' : 'is-off');
    // remove after animation
    setTimeout(()=> {
      try{ el.remove(); }catch{}
    }, 180);
  }

  // ✅ key function: smooth expiry then remove (engine calls this)
  expireTarget(id){
    const o = this.targets.get(id);
    if(!o?.el) { this.targets.delete(id); return; }
    const el = o.el;
    this.targets.delete(id);

    el.classList.add('is-expire');
    setTimeout(()=> {
      try{ el.remove(); }catch{}
    }, 260);
  }

  destroy(){
    // remove all targets
    for(const [id,o] of this.targets.entries()){
      try{ o.el?.remove(); }catch{}
    }
    this.targets.clear();

    // remove fx leftovers
    try{
      this.layerEl?.querySelectorAll?.('.sb-fx')?.forEach(n=>n.remove());
    }catch{}
  }
}