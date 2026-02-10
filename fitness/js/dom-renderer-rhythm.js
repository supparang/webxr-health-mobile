// === /fitness/js/dom-renderer-rhythm.js ===
// DOM Renderer for Rhythm Boxer
// ✅ Ensures hit line exists in every lane (.rb-hitline)
// ✅ Lane pulse FX + feedback label
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  function qs(sel, root=DOC){ return root.querySelector(sel); }
  function qsa(sel, root=DOC){ return Array.from(root.querySelectorAll(sel)); }

  class DomRendererRhythm{
    constructor(opts={}){
      this.wrap = opts.wrap || DOC.body;
      this.field = opts.field || qs('#rb-field');
      this.lanesEl = opts.lanesEl || qs('#rb-lanes');
      this.flashEl = opts.flashEl || qs('#rb-flash');
      this.feedbackEl = opts.feedbackEl || qs('#rb-feedback');

      this._pulseT = new Map();
      this._ensureHitlines();
    }

    _ensureHitlines(){
      if(!this.lanesEl) return;
      const lanes = qsa('.rb-lane', this.lanesEl);
      for(const lane of lanes){
        if(!lane.querySelector('.rb-hitline')){
          const hl = DOC.createElement('div');
          hl.className = 'rb-hitline';
          lane.appendChild(hl);
        }
      }
    }

    _setFeedback(txt){
      if(!this.feedbackEl) return;
      this.feedbackEl.textContent = txt || '';
    }

    _flash(){
      if(!this.flashEl) return;
      this.flashEl.style.opacity = '1';
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(()=>{ this.flashEl.style.opacity = '0'; }, 140);
    }

    _pulseLane(lane, cls){
      if(!this.lanesEl) return;
      const el = this.lanesEl.querySelector(`.rb-lane[data-lane="${lane}"]`);
      if(!el) return;

      // clear previous pulses
      el.classList.remove('rb-pulse-perfect','rb-pulse-great','rb-pulse-good','rb-pulse-miss');
      el.classList.add(cls);

      clearTimeout(this._pulseT.get(el));
      const t = setTimeout(()=>{
        el.classList.remove(cls);
      }, 120);
      this._pulseT.set(el, t);
    }

    showHitFx({lane, judgment, scoreDelta}){
      if(judgment==='perfect'){
        this._setFeedback('PERFECT!');
        this._pulseLane(lane, 'rb-pulse-perfect');
        this._flash();
      }else if(judgment==='great'){
        this._setFeedback('GREAT');
        this._pulseLane(lane, 'rb-pulse-great');
      }else{
        this._setFeedback('GOOD');
        this._pulseLane(lane, 'rb-pulse-good');
      }
    }

    showMissFx({lane}){
      this._setFeedback('MISS');
      this._pulseLane(lane, 'rb-pulse-miss');
    }
  }

  WIN.DomRendererRhythm = DomRendererRhythm;
})();