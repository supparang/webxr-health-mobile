// === /fitness/js/dom-renderer-rhythm.js — Rhythm Boxer DOM Renderer (FX) ===
// PRODUCTION: FX anchored to GOLD hit line (bottom: --rb-hitline-y)
'use strict';

(function(){
  class RbDomRenderer{
    constructor(host, opts = {}){
      this.host = host;
      this.wrapEl = opts.wrapEl || document.body;
      this.flashEl = opts.flashEl || null;
      this.feedbackEl = opts.feedbackEl || null;

      this._flashT = null;
      this._hitlinePxCache = null;
      this._hitlineCacheAt = 0;
    }

    _readHitlinePx(laneEl){
      // read CSS variable --rb-hitline-y (e.g., "44px" or "calc(...)")
      // if calc() exists, computedStyle will return px.
      const now = performance.now();
      if(this._hitlinePxCache != null && (now - this._hitlineCacheAt) < 800) return this._hitlinePxCache;

      try{
        const cs = getComputedStyle(laneEl || document.documentElement);
        const v = cs.getPropertyValue('--rb-hitline-y').trim();
        const px = parseFloat(v);
        if(Number.isFinite(px)){
          this._hitlinePxCache = px;
          this._hitlineCacheAt = now;
          return px;
        }
      }catch(_){}
      // fallback (should match CSS default roughly)
      return 44;
    }

    _screenPosFromLane(lane){
      // center X of lane, Y at GOLD hit line position
      const laneEl = document.querySelector(`.rb-lane[data-lane="${lane}"]`);
      if(!laneEl){
        const r = this.wrapEl.getBoundingClientRect();
        return { x: r.left + r.width/2, y: r.top + r.height/2 };
      }

      const rect = laneEl.getBoundingClientRect();
      const x = rect.left + rect.width/2;

      const hitlineY = this._readHitlinePx(laneEl); // px from lane bottom
      const y = rect.bottom - hitlineY;

      return { x, y };
    }

    _flash(kind){
      if(!this.flashEl) return;
      this.flashEl.classList.add('active');
      clearTimeout(this._flashT);
      this._flashT = setTimeout(()=>this.flashEl.classList.remove('active'), 140);
    }

    _feedback(text, cls){
      if(!this.feedbackEl) return;
      this.feedbackEl.textContent = text;
      this.feedbackEl.classList.remove('perfect','great','good','miss');
      if(cls) this.feedbackEl.classList.add(cls);
    }

    showHitFx({ lane, judgment, scoreDelta }){
      const p = this._screenPosFromLane(lane);
      this.spawnHitParticle(p.x, p.y, judgment);
      this.spawnScoreText(p.x, p.y, scoreDelta, judgment);
      this._feedback((judgment||'good').toUpperCase(), judgment);
    }

    showMissFx({ lane }){
      const p = this._screenPosFromLane(lane);
      this.spawnMissParticle(p.x, p.y);
      this._flash('miss');
      this._feedback('MISS', 'miss');
    }

    spawnScoreText(x, y, scoreDelta, judgment){
      if(!Number.isFinite(scoreDelta)) return;
      const el = document.createElement('div');
      el.className = `rb-score-fx rb-score-${judgment||'good'}`;
      el.textContent = `${scoreDelta>0?'+':''}${scoreDelta}`;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      document.body.appendChild(el);
      // force reflow
      void el.offsetWidth;
      el.classList.add('is-live');
      setTimeout(()=>{ el.classList.remove('is-live'); el.remove(); }, 420);
    }

    spawnHitParticle(x, y, judgment){
      const n = 10;
      for(let i=0;i<n;i++){
        const el = document.createElement('div');
        el.className = `rb-frag rb-frag-${judgment||'good'}`;
        const size = 6 + Math.random()*6;
        const ang = (i/n) * Math.PI*2;
        const dist = 26 + Math.random()*34;
        const dx = Math.cos(ang)*dist;
        const dy = Math.sin(ang)*dist;
        const life = 420 + Math.random()*180;

        el.style.width = size+'px';
        el.style.height = size+'px';
        el.style.left = x+'px';
        el.style.top  = y+'px';
        el.style.setProperty('--dx', dx+'px');
        el.style.setProperty('--dy', dy+'px');
        el.style.setProperty('--life', life+'ms');

        document.body.appendChild(el);
        setTimeout(()=>el.remove(), life);
      }
    }

    spawnMissParticle(x, y){
      const el = document.createElement('div');
      el.className = 'rb-frag rb-frag-miss';
      const size = 14;
      const life = 460;

      el.style.width = size+'px';
      el.style.height = size+'px';
      el.style.left = x+'px';
      el.style.top  = y+'px';
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '28px');
      el.style.setProperty('--life', life+'ms');

      document.body.appendChild(el);
      setTimeout(()=>el.remove(), life);
    }
  }

  window.RbDomRenderer = RbDomRenderer;
})();