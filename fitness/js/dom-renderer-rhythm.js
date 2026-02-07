'use strict';

(function(){
  const DOC = document;

  class DomRendererRhythm{
    constructor(opts={}){
      this.field = opts.field || null;
      this.lanesEl = opts.lanesEl || null;
      this.flashEl = opts.flashEl || null;
      this.feedbackEl = opts.feedbackEl || null;

      this._fbT = 0;
      this._flashT = 0;
    }

    _flash(){
      if(!this.flashEl) return;
      this.flashEl.classList.add('on');
      clearTimeout(this._flashT);
      this._flashT = setTimeout(()=>this.flashEl.classList.remove('on'), 140);
    }

    _feedback(text){
      if(!this.feedbackEl) return;
      this.feedbackEl.textContent = text;
      clearTimeout(this._fbT);
      this._fbT = setTimeout(()=>{ this.feedbackEl.textContent = ''; }, 650);
    }

    showHitFx({lane, judgment}){
      this._flash();
      if(judgment === 'perfect') this._feedback('PERFECT!');
      else if(judgment === 'great') this._feedback('GREAT!');
      else this._feedback('GOOD!');
    }

    showMissFx({lane}){
      this._feedback('MISS');
    }
  }

  window.DomRendererRhythm = DomRendererRhythm;
})();