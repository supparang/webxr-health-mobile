// === /fitness/js/dom-renderer-rhythm.js ===
// Dom renderer for Rhythm Boxer — FX/Feedback/Flash (PROD)
// ✅ showHitFx(): score pop + fragments
// ✅ showMissFx(): red flash + miss pop
// ✅ Safe even if elements missing

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  function now(){ return performance.now(); }

  function makeEl(tag, cls){
    const el = DOC.createElement(tag);
    if(cls) el.className = cls;
    return el;
  }

  function rand(min,max){ return min + Math.random()*(max-min); }

  class RbDomRenderer{
    constructor(fieldEl, opts = {}){
      this.fieldEl = fieldEl || null;
      this.wrapEl = opts.wrapEl || DOC.body;
      this.flashEl = opts.flashEl || null;
      this.feedbackEl = opts.feedbackEl || null;

      this._fx = new Set();
      this._frag = new Set();

      // bind
      this._cleanup = this._cleanup.bind(this);
      this._alive = true;

      // periodic cleanup (safety)
      this._tCleanup = WIN.setInterval(this._cleanup, 2000);
    }

    destroy(){
      this._alive = false;
      try{ WIN.clearInterval(this._tCleanup); }catch(_){}
      this._cleanup(true);
      this._fx.clear();
      this._frag.clear();
    }

    setFeedback(text){
      if(!this.feedbackEl) return;
      this.feedbackEl.textContent = text || '';
    }

    flash(kind){
      // kind: 'miss' | 'danger' | 'ok'
      if(!this.flashEl) return;

      this.flashEl.classList.remove('active');
      // small delay to re-trigger transition
      requestAnimationFrame(()=>{
        if(!this._alive) return;
        this.flashEl.classList.add('active');
        WIN.setTimeout(()=>{
          if(!this._alive) return;
          this.flashEl.classList.remove('active');
        }, 120);
      });
    }

    showHitFx({ lane, judgment, scoreDelta }){
      // feedback text
      const j = (judgment||'good').toLowerCase();
      if(j==='perfect') this.setFeedback('PERFECT!');
      else if(j==='great') this.setFeedback('GREAT!');
      else this.setFeedback('GOOD');

      // pop score at hitline position (approx)
      this._spawnScorePop(j, scoreDelta);

      // fragments burst
      this._spawnFragments(j, 10 + (j==='perfect'? 6 : j==='great'? 4 : 2));
    }

    showMissFx({ lane }){
      this.setFeedback('MISS');
      this.flash('miss');
      this._spawnScorePop('miss', -5);
      this._spawnFragments('miss', 12);
    }

    _spawnScorePop(judgment, scoreDelta){
      const fx = makeEl('div', 'rb-score-fx');
      fx.classList.add('rb-score-' + judgment);

      const sign = (scoreDelta>=0) ? '+' : '';
      fx.textContent = `${judgment.toUpperCase()} ${sign}${scoreDelta}`;

      // position: center of field near bottom hitline
      const pos = this._getHitlineAnchor();
      fx.style.left = pos.x + 'px';
      fx.style.top  = pos.y + 'px';

      DOC.body.appendChild(fx);
      this._fx.add(fx);

      // animate
      requestAnimationFrame(()=>{
        fx.classList.add('is-live');
      });

      WIN.setTimeout(()=>{
        fx.remove();
        this._fx.delete(fx);
      }, 520);
    }

    _spawnFragments(judgment, n){
      const pos = this._getHitlineAnchor();
      for(let i=0;i<n;i++){
        const f = makeEl('div', 'rb-frag');
        f.classList.add('rb-frag-' + judgment);

        const size = rand(5, 10);
        f.style.width = size + 'px';
        f.style.height = size + 'px';

        const dx = rand(-120, 120);
        const dy = rand(-120, 60);
        const life = rand(420, 720);

        f.style.setProperty('--dx', dx.toFixed(0) + 'px');
        f.style.setProperty('--dy', dy.toFixed(0) + 'px');
        f.style.setProperty('--life', life.toFixed(0) + 'ms');

        f.style.left = pos.x + 'px';
        f.style.top  = pos.y + 'px';

        DOC.body.appendChild(f);
        this._frag.add(f);

        WIN.setTimeout(()=>{
          f.remove();
          this._frag.delete(f);
        }, life + 40);
      }
    }

    _getHitlineAnchor(){
      // anchor at the “gold hitline” in center lane if possible
      // fallback: bottom-center of field
      try{
        if(this.fieldEl){
          const lanes = this.fieldEl.querySelectorAll('.rb-lane');
          if(lanes && lanes.length){
            const mid = Math.floor(lanes.length/2);
            const r = lanes[mid].getBoundingClientRect();

            const root = getComputedStyle(document.documentElement);
            const hitY = parseFloat(root.getPropertyValue('--rb-hitline-y')) || 72;

            return {
              x: r.left + r.width/2,
              y: r.bottom - hitY
            };
          }
          const fr = this.fieldEl.getBoundingClientRect();
          return { x: fr.left + fr.width/2, y: fr.bottom - 90 };
        }
      }catch(_){}
      return { x: window.innerWidth/2, y: window.innerHeight*0.75 };
    }

    _cleanup(force){
      if(force){
        for(const el of this._fx){ try{ el.remove(); }catch(_){} }
        for(const el of this._frag){ try{ el.remove(); }catch(_){} }
        this._fx.clear();
        this._frag.clear();
        return;
      }

      // remove detached
      for(const el of Array.from(this._fx)){
        if(!el || !el.isConnected){ this._fx.delete(el); }
      }
      for(const el of Array.from(this._frag)){
        if(!el || !el.isConnected){ this._frag.delete(el); }
      }
    }
  }

  WIN.RbDomRenderer = RbDomRenderer;

})();