// === /fitness/js/dom-renderer-shadow.js ===
// Dom renderer for Shadow Breaker (HUD-safe spawn + anti-clump + smooth expire)
// ES Module

'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();

function readCssPx(name, fallback){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }catch(_){ return fallback; }
}

function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

export class DomRendererShadow {
  constructor(layerEl, opts = {}){
    this.layerEl = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = typeof opts.onTargetHit === 'function' ? opts.onTargetHit : null;

    this.targets = new Map(); // id -> { el, type, bornAt, sizePx }
    this.diff = 'normal';

    // soft tuning
    this.EXPIRE_ANIM_MS = 180;
    this.HIT_ANIM_MS = 220;

    // bind
    this._onPointer = this._onPointer.bind(this);
  }

  setDifficulty(diff){
    this.diff = diff || 'normal';
  }

  // -------------------------
  // Spawn placement helpers
  // -------------------------
  _layerRect(){
    const r = this.layerEl?.getBoundingClientRect?.();
    const w = r?.width  || window.innerWidth  || 360;
    const h = r?.height || window.innerHeight || 640;
    const left = r?.left || 0;
    const top  = r?.top  || 0;
    return { left, top, w, h };
  }

  _resolveMargins(payload){
    // priority: payload margins > CSS vars
    const topCss = readCssPx('--sb-safe-top', 80);
    const botCss = readCssPx('--sb-safe-bottom', 70);
    const leftCss = readCssPx('--safe-left', 0) + 10;
    const rightCss= readCssPx('--safe-right', 0) + 10;

    return {
      top:    Number.isFinite(payload?.marginTop)    ? payload.marginTop    : topCss,
      bottom: Number.isFinite(payload?.marginBottom) ? payload.marginBottom : botCss,
      left:   Number.isFinite(payload?.marginLeft)   ? payload.marginLeft   : leftCss,
      right:  Number.isFinite(payload?.marginRight)  ? payload.marginRight  : rightCss,
    };
  }

  _existingCenters(){
    const pts = [];
    for(const [, obj] of this.targets.entries()){
      const el = obj?.el;
      if(!el) continue;
      const r = el.getBoundingClientRect();
      pts.push({ x: r.left + r.width/2, y: r.top + r.height/2 });
    }
    return pts;
  }

  _pickSpawnPoint(sizePx, payload){
    const { left, top, w, h } = this._layerRect();
    const m = this._resolveMargins(payload);

    // playable box inside layer
    const minX = left + m.left  + sizePx*0.55;
    const maxX = left + w - m.right - sizePx*0.55;
    const minY = top  + m.top   + sizePx*0.55;
    const maxY = top  + h - m.bottom- sizePx*0.55;

    // if too tight, fallback to center-ish
    if(!(maxX > minX) || !(maxY > minY)){
      return { x: left + w*0.5, y: top + h*0.62 };
    }

    const minDistPx = Number(payload?.minDistPx) || 0;
    const minD2 = minDistPx > 0 ? (minDistPx * minDistPx) : 0;

    const avoid = Array.isArray(payload?.avoidPoints) ? payload.avoidPoints : [];
    const existing = this._existingCenters();
    const pool = existing.concat(
      avoid.map(p => ({ x: Number(p?.x)||0, y: Number(p?.y)||0 })).filter(p => p.x && p.y)
    );

    // try multiple times to avoid clump
    const tries = 22;
    for(let i=0;i<tries;i++){
      const x = minX + Math.random()*(maxX - minX);
      const y = minY + Math.random()*(maxY - minY);

      if(minD2 <= 0 || pool.length === 0){
        return { x, y };
      }

      let ok = true;
      for(const p of pool){
        if(dist2(x,y,p.x,p.y) < minD2){ ok = false; break; }
      }
      if(ok) return { x, y };
    }

    // last resort: random
    return {
      x: minX + Math.random()*(maxX - minX),
      y: minY + Math.random()*(maxY - minY)
    };
  }

  // -------------------------
  // Targets
  // -------------------------
  spawnTarget(payload){
    const id = payload?.id;
    if(id == null) return;

    const type = String(payload?.type || 'normal');
    const sizePx = clamp(Number(payload?.sizePx) || 100, 60, 180);

    // create element
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `sb-target sb-target--${type}`;
    el.setAttribute('data-id', String(id));
    el.setAttribute('aria-label', type);

    // size
    el.style.width  = `${sizePx}px`;
    el.style.height = `${sizePx}px`;

    // place (absolute to layer viewport)
    // NOTE: we position in viewport coords then translate to layer coords via rect offset
    const pt = this._pickSpawnPoint(sizePx, payload);
    const layerR = this._layerRect();
    const lx = pt.x - layerR.left;
    const ly = pt.y - layerR.top;

    el.style.position = 'absolute';
    el.style.left = `${lx}px`;
    el.style.top  = `${ly}px`;
    el.style.transform = 'translate(-50%, -50%)';

    // content (emoji / icon)
    // you can swap to images later; keep light for now
    if(type === 'bossface'){
      el.textContent = payload?.bossEmoji || '👊';
    }else if(type === 'bomb'){
      el.textContent = '💣';
    }else if(type === 'decoy'){
      el.textContent = '🎯';
      el.classList.add('is-decoy');
    }else if(type === 'heal'){
      el.textContent = '➕';
      el.classList.add('is-heal');
    }else if(type === 'shield'){
      el.textContent = '🛡️';
      el.classList.add('is-shield');
    }else{
      el.textContent = '🎯';
    }

    // events
    el.addEventListener('pointerdown', this._onPointer, { passive: true });
    el.addEventListener('click', (ev)=>{ ev.preventDefault(); }, { passive: false });

    // mount
    this.layerEl?.appendChild(el);

    // record
    this.targets.set(id, {
      el,
      type,
      bornAt: now(),
      sizePx
    });

    // optional: ttl progress / style hook
    if(Number.isFinite(payload?.ttlMs)){
      el.style.setProperty('--ttl', `${payload.ttlMs}ms`);
    }
  }

  _onPointer(ev){
    const el = ev.currentTarget;
    if(!el) return;

    const id = Number(el.getAttribute('data-id'));
    if(!Number.isFinite(id)) return;

    if(this.onTargetHit){
      this.onTargetHit(id, { clientX: ev.clientX, clientY: ev.clientY });
    }
  }

  // grade: good/perfect/bad/bomb/shield/heal/expire
  playHitFx(id, info = {}){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if(!el) return;

    const grade = String(info.grade || 'good');
    el.classList.add('is-hit', `hit-${grade}`);

    // small popup (optional)
    if(this.feedbackEl && (grade === 'perfect' || grade === 'bad' || grade === 'bomb' || grade === 'expire')){
      this.feedbackEl.classList.add('pulse');
      setTimeout(()=>this.feedbackEl?.classList?.remove('pulse'), 140);
    }

    setTimeout(()=>{
      el.classList.remove('is-hit', `hit-${grade}`);
    }, this.HIT_ANIM_MS);
  }

  removeTarget(id, reason='hit'){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if(!el) return;

    // quick pop-out
    el.classList.add(reason === 'hit' ? 'rm-hit' : 'rm');
    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
    }, 120);

    this.targets.delete(id);
  }

  // smooth expire: fade + shrink then remove
  expireTarget(id){
    const obj = this.targets.get(id);
    const el = obj?.el;
    if(!el) return;

    el.classList.add('is-expiring');
    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      this.targets.delete(id);
    }, this.EXPIRE_ANIM_MS);
  }

  destroy(){
    // remove all targets
    for(const [id, obj] of this.targets.entries()){
      try{ obj?.el?.remove(); }catch(_){}
      this.targets.delete(id);
    }
  }
}