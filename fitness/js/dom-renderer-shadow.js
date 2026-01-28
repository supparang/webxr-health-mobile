// === /fitness/js/dom-renderer-shadow.js ===
// DOM renderer for Shadow Breaker — spawns targets, hit fx, zones, storm drift
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class DomRendererShadow {
  constructor(layerEl, opts = {}) {
    this.layer = layerEl;
    this.wrapEl = opts.wrapEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.onTargetHit = opts.onTargetHit || null;

    this.targets = new Map();
    this.diffKey = 'normal';

    // runtime flags
    this.storm = false;

    this._boundOnClick = (e)=>this._handlePointer(e);
    this.layer.addEventListener('pointerdown', this._boundOnClick, { passive:false });
  }

  setDifficulty(diffKey){
    this.diffKey = diffKey || 'normal';
  }

  setStorm(on){
    this.storm = !!on;
  }

  destroy(){
    try{
      this.layer.removeEventListener('pointerdown', this._boundOnClick);
    }catch{}
    for (const id of this.targets.keys()) this.removeTarget(id, 'destroy');
    this.targets.clear();
  }

  // 6 zones = 3 columns x 2 rows
  _zoneFromXY(x, y){
    const r = this.layer.getBoundingClientRect();
    const px = clamp((x - r.left) / r.width, 0, 0.999999);
    const py = clamp((y - r.top)  / r.height,0, 0.999999);

    const col = Math.min(2, Math.floor(px * 3)); // 0..2
    const row = Math.min(1, Math.floor(py * 2)); // 0..1
    return row*3 + col; // 0..5
  }

  spawnTarget(data){
    if (!data) return;
    const id = data.id;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target sb-target--' + (data.type || 'normal');
    el.dataset.id = String(id);
    el.style.setProperty('--sb-target-size', (data.sizePx || 120) + 'px');

    // place in safe bounds
    const r = this.layer.getBoundingClientRect();
    const pad = 18;
    const size = Number(data.sizePx||120);
    const half = size/2;

    const minX = pad + half;
    const maxX = Math.max(minX+1, r.width - pad - half);
    const minY = pad + half;
    const maxY = Math.max(minY+1, r.height - pad - half);

    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // compute zone id at spawn
    const zoneId = this._zoneFromXY(r.left + x, r.top + y);
    el.dataset.zone = String(zoneId);

    // core emoji
    const core = document.createElement('div');
    core.className = 'sb-target-core';
    core.textContent = (data.isBossFace && data.bossEmoji) ? data.bossEmoji : this._emojiFor(data.type);
    el.appendChild(core);

    // drift (only in storm)
    if (this.storm) {
      const dx = (Math.random()*2-1) * 28;
      const dy = (Math.random()*2-1) * 18;
      el.animate([
        { transform: 'translate(-50%,-50%)' },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))` }
      ], { duration: 520, direction:'alternate', iterations: Infinity, easing:'ease-in-out' });
    }

    this.layer.appendChild(el);
    this.targets.set(id, el);
  }

  _emojiFor(type){
    if (type==='bomb') return '💣';
    if (type==='decoy') return '👻';
    if (type==='heal') return '🩹';
    if (type==='shield') return '🛡️';
    if (type==='bossface') return '👑';
    return '🥊';
  }

  removeTarget(id, why){
    const el = this.targets.get(id);
    if (!el) return;
    el.classList.add('sb-target--gone');
    setTimeout(()=>{
      try{ el.remove(); }catch{}
    }, 120);
    this.targets.delete(id);
  }

  playHitFx(id, info){
    // reuse CSS fx classes already in your stylesheet
    const x = Number(info?.clientX) || (window.innerWidth/2);
    const y = Number(info?.clientY) || (window.innerHeight/2);

    const grade = String(info?.grade||'good');
    const delta = Number(info?.scoreDelta||0);

    const txt = document.createElement('div');
    txt.className = 'sb-fx-score is-live sb-fx-' + (grade==='perfect'?'perfect':grade==='bad'?'bad':'good');
    txt.textContent = (delta>=0?'+':'') + String(delta);
    txt.style.left = x + 'px';
    txt.style.top  = y + 'px';
    document.body.appendChild(txt);

    setTimeout(()=>{ txt.classList.remove('is-live'); }, 160);
    setTimeout(()=>{ try{ txt.remove(); }catch{} }, 520);

    // dots
    const n = 10;
    for (let i=0;i<n;i++){
      const dot = document.createElement('div');
      dot.className = 'sb-fx-dot is-live sb-fx-' + (grade==='perfect'?'perfect':grade==='bad'?'bad':'good');
      dot.style.left = x + 'px';
      dot.style.top  = y + 'px';
      dot.style.setProperty('--sb-fx-dx', ((Math.random()*2-1)*60).toFixed(1)+'px');
      dot.style.setProperty('--sb-fx-dy', ((Math.random()*2-1)*48).toFixed(1)+'px');
      dot.style.setProperty('--sb-fx-scale', (0.6+Math.random()*1.2).toFixed(2));
      document.body.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch{} }, 520);
    }
  }

  _handlePointer(e){
    // let clicks fall through unless hitting target
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const btn = t.closest('.sb-target');
    if (!btn) return;

    e.preventDefault();

    const id = Number(btn.dataset.id);
    const zoneId = Number(btn.dataset.zone);

    if (this.onTargetHit) {
      this.onTargetHit(id, {
        clientX: e.clientX,
        clientY: e.clientY,
        zoneId
      });
    }
  }
}