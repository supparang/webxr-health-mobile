// === /fitness/js/dom-renderer-rhythm.js — Rhythm Boxer DOM Renderer (FX, hitline-bottom aware) ===
'use strict';

(function(){
  const DOC = document;
  const WIN = window;

  class RbDomRenderer{
    constructor(host, opts = {}){
      this.host = host || DOC.body;
      this.wrapEl = opts.wrapEl || DOC.body;
      this.flashEl = opts.flashEl || null;
      this.feedbackEl = opts.feedbackEl || null;

      // cache
      this._flashT = null;
      this._feedbackT = null;
    }

    // ------------------------------
    // Helpers
    // ------------------------------
    _num(v, fb){
      const n = Number(v);
      return Number.isFinite(n) ? n : fb;
    }

    _readHitlineOffsetPx(laneEl){
      // Prefer CSS var --rb-hitline-y from lane / root
      // meaning: distance from lane bottom to hit line
      try{
        const csLane = laneEl ? getComputedStyle(laneEl) : null;
        let raw = csLane ? csLane.getPropertyValue('--rb-hitline-y') : '';
        if (!raw || !String(raw).trim()){
          const csRoot = getComputedStyle(DOC.documentElement);
          raw = csRoot.getPropertyValue('--rb-hitline-y');
        }
        const n = parseFloat(raw);
        if (Number.isFinite(n)) return n;
      }catch(_){}
      return 42; // fallback same as previous behavior
    }

    _laneHitlineScreenPos(lane){
      // Get exact screen position near the hit line for a lane
      const laneEl = DOC.querySelector(`.rb-lane[data-lane="${lane}"]`);

      if(!laneEl){
        const r = (this.wrapEl || DOC.body).getBoundingClientRect();
        return { x: r.left + r.width/2, y: r.top + r.height/2 };
      }

      const rect = laneEl.getBoundingClientRect();
      const hitlineYFromBottom = this._readHitlineOffsetPx(laneEl);

      const x = rect.left + rect.width / 2;
      const y = rect.bottom - hitlineYFromBottom; // hit line near bottom

      return { x, y };
    }

    _flash(kind){
      if(!this.flashEl) return;
      // kind reserved for future CSS variations
      this.flashEl.classList.add('active');
      clearTimeout(this._flashT);
      this._flashT = setTimeout(()=>{
        if (this.flashEl) this.flashEl.classList.remove('active');
      }, 140);
    }

    _feedback(text, cls){
      if(!this.feedbackEl) return;

      this.feedbackEl.textContent = text || '';
      this.feedbackEl.classList.remove('perfect','great','good','miss','show');

      if (cls) this.feedbackEl.classList.add(cls);

      // trigger small pop animation if CSS supports .show
      void this.feedbackEl.offsetWidth;
      this.feedbackEl.classList.add('show');

      clearTimeout(this._feedbackT);
      this._feedbackT = setTimeout(()=>{
        if (this.feedbackEl) this.feedbackEl.classList.remove('show');
      }, 220);
    }

    _appendFx(el){
      // FX must not block lane taps
      el.style.pointerEvents = 'none';
      (DOC.body || this.wrapEl || DOC.documentElement).appendChild(el);
      return el;
    }

    // ------------------------------
    // Public API called by engine
    // ------------------------------
    showHitFx({ lane, judgment, scoreDelta }){
      const p = this._laneHitlineScreenPos(lane);

      this.spawnHitParticle(p.x, p.y, judgment);
      this.spawnScoreText(p.x, p.y, scoreDelta, judgment);

      // subtle flash for perfect/great
      if (judgment === 'perfect' || judgment === 'great') {
        this._flash('hit');
      }

      this._feedback(String(judgment || 'HIT').toUpperCase(), judgment || 'good');
    }

    showMissFx({ lane }){
      const p = this._laneHitlineScreenPos(lane);

      this.spawnMissParticle(p.x, p.y);
      this._flash('miss');
      this._feedback('MISS', 'miss');
    }

    // ------------------------------
    // FX primitives
    // ------------------------------
    spawnScoreText(x, y, scoreDelta, judgment){
      if(!Number.isFinite(scoreDelta)) return;

      const el = DOC.createElement('div');
      el.className = `rb-score-fx rb-score-${judgment || 'good'}`;

      // prettier labels (optional)
      const sign = scoreDelta > 0 ? '+' : '';
      el.textContent = `${sign}${scoreDelta}`;

      el.style.left = `${x}px`;
      // spawn just above hit line
      el.style.top  = `${y - 8}px`;

      this._appendFx(el);

      // kick animation
      void el.offsetWidth;
      el.classList.add('is-live');

      setTimeout(()=>{
        el.classList.remove('is-live');
        el.remove();
      }, 460);
    }

    spawnHitParticle(x, y, judgment){
      const n = 10;

      for(let i=0;i<n;i++){
        const el = DOC.createElement('div');
        el.className = `rb-frag rb-frag-${judgment || 'good'}`;

        const size = 6 + Math.random() * 6;
        const ang = (i / n) * Math.PI * 2 + (Math.random() * 0.25);
        const dist = 22 + Math.random() * 34;

        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist - (4 + Math.random()*6); // bias a bit upward

        const life = 360 + Math.random() * 180;

        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.left = `${x}px`;
        el.style.top  = `${y}px`;

        // CSS animation variables
        el.style.setProperty('--dx', `${dx}px`);
        el.style.setProperty('--dy', `${dy}px`);
        el.style.setProperty('--life', `${Math.round(life)}ms`);

        this._appendFx(el);

        // some CSS setups animate on insertion, no extra class needed
        setTimeout(()=>el.remove(), life + 40);
      }
    }

    spawnMissParticle(x, y){
      // center drop puff / cross fragment
      const el = DOC.createElement('div');
      el.className = 'rb-frag rb-frag-miss';

      const size = 14;
      const life = 440;

      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;

      // drift downward from hit line for "miss"
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '26px');
      el.style.setProperty('--life', `${life}ms`);

      this._appendFx(el);

      setTimeout(()=>el.remove(), life + 30);
    }
  }

  WIN.RbDomRenderer = RbDomRenderer;
})();