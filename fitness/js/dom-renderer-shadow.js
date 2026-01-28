// === /fitness/js/dom-renderer-shadow.js ===
// DomRendererShadow — target spawner + hit handler + fx
// A-15: spawnTarget returns placement {x,y,zoneId} and sets data.zoneId

'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

export class DomRendererShadow{
  constructor(layerEl, opts = {}){
    this.layerEl = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.diffKey = 'normal';
    this.targets = new Map();

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize, { passive:true });

    this._vw = 0; this._vh = 0;
    this._pad = { l:12, r:12, t:12, b:12 };
    this._resize();

    // safe area avoid HUD: read CSS vars if exist
    this._safeTop = 0;
    this._safeBottom = 0;
    this._readSafeInsets();
  }

  destroy(){
    try{ window.removeEventListener('resize', this._resize); }catch(_){}
    for (const [id, el] of this.targets.entries()){
      try{ el.remove(); }catch(_){}
    }
    this.targets.clear();
  }

  setDifficulty(diffKey){
    this.diffKey = (diffKey || 'normal');
  }

  _readSafeInsets(){
    // best-effort: use env safe-area via computed styles if your CSS sets it
    try{
      const cs = getComputedStyle(document.documentElement);
      const sat = cs.getPropertyValue('--sat') || '';
      const sab = cs.getPropertyValue('--sab') || '';
      // fallback: 0
      this._safeTop = 0;
      this._safeBottom = 0;
      void sat; void sab;
    }catch(_){
      this._safeTop = 0;
      this._safeBottom = 0;
    }
  }

  _resize(){
    const r = this.layerEl ? this.layerEl.getBoundingClientRect() : null;
    if (!r) return;
    this._vw = r.width;
    this._vh = r.height;

    // padding for edges
    this._pad.l = 14;
    this._pad.r = 14;
    this._pad.t = 12 + this._safeTop;
    this._pad.b = 14 + this._safeBottom;
  }

  _pickZone(){
    // 2 rows x 3 cols => 6 zones: 0..5
    // weighted to avoid repetitive same zone
    const last = this._lastZoneId ?? -1;
    const weights = [];
    for(let z=0; z<6; z++){
      let w = 1.0;
      if (z === last) w *= 0.55;
      // slight preference center zones (Z2,Z3,Z5,Z6) feel nicer
      if (z === 1 || z === 2 || z === 4 || z === 5) w *= 1.08;
      weights.push({z, w});
    }
    const total = weights.reduce((a,it)=>a+it.w,0);
    let r = Math.random()*total;
    for (const it of weights){
      if (r < it.w){ this._lastZoneId = it.z; return it.z; }
      r -= it.w;
    }
    this._lastZoneId = weights[weights.length-1].z;
    return this._lastZoneId;
  }

  _zoneRect(zoneId){
    const W = this._vw;
    const H = this._vh;

    const cols = 3;
    const rows = 2;

    const col = zoneId % cols;
    const row = Math.floor(zoneId / cols);

    // margins
    const x0 = this._pad.l;
    const x1 = W - this._pad.r;
    const y0 = this._pad.t;
    const y1 = H - this._pad.b;

    const cellW = (x1 - x0) / cols;
    const cellH = (y1 - y0) / rows;

    const rx0 = x0 + col * cellW;
    const ry0 = y0 + row * cellH;
    const rx1 = rx0 + cellW;
    const ry1 = ry0 + cellH;

    // inner margin inside zone for nicer spawn
    const inset = Math.min(18, cellW*0.08, cellH*0.08);

    return {
      x0: rx0 + inset,
      y0: ry0 + inset,
      x1: rx1 - inset,
      y1: ry1 - inset
    };
  }

  _rand(min, max){
    return min + Math.random()*(max-min);
  }

  spawnTarget(data){
    if (!this.layerEl || !data) return null;

    const zoneId = (data.zoneId != null) ? clamp(data.zoneId,0,5) : this._pickZone();
    const zr = this._zoneRect(zoneId);

    const size = clamp(data.sizePx || 120, 70, 260);

    // ensure within zone
    const x = this._rand(zr.x0, Math.max(zr.x0, zr.x1 - size));
    const y = this._rand(zr.y0, Math.max(zr.y0, zr.y1 - size));

    // store back
    data.zoneId = zoneId;
    data.spawnX = x;
    data.spawnY = y;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target';
    el.dataset.id = String(data.id);
    el.dataset.type = String(data.type || 'normal');
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.setProperty('--z', String(zoneId));

    // label / emoji
    let face = '🥊';
    if (data.type === 'bomb') face = '💣';
    else if (data.type === 'decoy') face = '🫥';
    else if (data.type === 'heal') face = '🩹';
    else if (data.type === 'shield') face = '🛡️';
    else if (data.isBossFace) face = data.bossEmoji || '😈';

    el.innerHTML = `<span class="sb-target-face">${face}</span>`;

    // click / touch
    const onHit = (e)=>{
      e.preventDefault();
      const id = Number(el.dataset.id);
      const rect = el.getBoundingClientRect();
      const cx = (e && e.clientX != null) ? e.clientX : (rect.left + rect.width/2);
      const cy = (e && e.clientY != null) ? e.clientY : (rect.top + rect.height/2);

      if (this.onTargetHit){
        this.onTargetHit(id, { clientX: cx, clientY: cy, zoneId });
      }
    };

    el.addEventListener('pointerdown', onHit, { passive:false });

    this.layerEl.appendChild(el);
    this.targets.set(data.id, el);

    return { x, y, zoneId };
  }

  removeTarget(id, reason){
    const el = this.targets.get(id);
    if (!el) return;
    this.targets.delete(id);
    try{
      el.classList.add('is-out');
      el.dataset.out = reason || '';
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 120);
    }catch(_){
      try{ el.remove(); }catch(__){}
    }
  }

  playHitFx(id, info){
    // optional: small pop
    const el = this.targets.get(id);
    if (!el) return;
    try{
      el.classList.add('is-hit');
      setTimeout(()=>{ try{ el.classList.remove('is-hit'); }catch(_){ } }, 180);
    }catch(_){}
  }
}