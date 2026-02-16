// === /fitness/js/dom-renderer-rhythm.js ===
// Rhythm Boxer — DOM Renderer (PRODUCTION)
// ✅ Auto add HIT LINE (gold) into every lane
// ✅ FX: hit / miss -> feedback chip + flash
// ✅ Auto swap note icon to 🎵 (even if engine spawns 🥊)
// ✅ Safe on mobile (no heavy DOM work)

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  class DomRendererRhythm{
    constructor(opts = {}){
      this.wrap = opts.wrap || DOC.body;
      this.field = opts.field || DOC.querySelector('#rb-field');
      this.lanesEl = opts.lanesEl || DOC.querySelector('#rb-lanes');
      this.feedbackEl = opts.feedbackEl || DOC.querySelector('#rb-feedback');
      this.flashEl = opts.flashEl || DOC.querySelector('#rb-flash');

      this.noteIcon = (opts.noteIcon != null) ? String(opts.noteIcon) : '🎵';

      this._hitlineClass = 'rb-hitline';
      this._mo = null;

      this.ensureHitlines();
      this._observeNotes();
    }

    // ---------- Hit line ----------
    ensureHitlines(){
      if(!this.lanesEl) return;
      const lanes = Array.from(this.lanesEl.querySelectorAll('.rb-lane'));
      for(const lane of lanes){
        // if already exists, skip
        if(lane.querySelector('.' + this._hitlineClass)) continue;
        const el = DOC.createElement('div');
        el.className = this._hitlineClass;
        lane.appendChild(el);
      }
    }

    // ---------- Observe notes added by engine (swap icon to 🎵) ----------
    _observeNotes(){
      if(!this.lanesEl || typeof MutationObserver === 'undefined') return;

      // clean old
      try{ if(this._mo) this._mo.disconnect(); }catch(_){}

      this._mo = new MutationObserver((muts)=>{
        for(const m of muts){
          if(!m.addedNodes || !m.addedNodes.length) continue;
          for(const node of m.addedNodes){
            if(!node || node.nodeType !== 1) continue;
            // engine adds <div class="rb-note"><div class="rb-note-ico">...</div></div>
            if(node.classList && node.classList.contains('rb-note')){
              this._applyNoteIcon(node);
            }else{
              // in case a batch was added
              const notes = node.querySelectorAll ? node.querySelectorAll('.rb-note') : [];
              notes.forEach(n=>this._applyNoteIcon(n));
            }
          }
        }
      });

      this._mo.observe(this.lanesEl, { childList:true, subtree:true });
    }

    _applyNoteIcon(noteEl){
      try{
        const ico = noteEl.querySelector('.rb-note-ico');
        if(ico) ico.textContent = this.noteIcon;
      }catch(_){}
    }

    // ---------- FX ----------
    flash(){
      if(!this.flashEl) return;
      this.flashEl.classList.remove('rb-on');
      // force reflow
      void this.flashEl.offsetWidth;
      this.flashEl.classList.add('rb-on');
      // auto off
      WIN.setTimeout(()=>{ try{ this.flashEl.classList.remove('rb-on'); }catch(_){} }, 180);
    }

    setFeedback(text, type){
      if(!this.feedbackEl) return;
      this.feedbackEl.textContent = text || '';
      this.feedbackEl.classList.toggle('rb-hit', type === 'hit');
      this.feedbackEl.classList.toggle('rb-miss', type === 'miss');
    }

    showHitFx({ lane, judgment, scoreDelta } = {}){
      // feedback
      const j = String(judgment||'good').toUpperCase();
      const txt = (scoreDelta!=null) ? `${j} +${scoreDelta}` : j;
      this.setFeedback(txt, 'hit');

      // tiny flash on perfect/great
      if(judgment === 'perfect' || judgment === 'great') this.flash();

      // lane pulse (lightweight)
      this._pulseLane(lane, judgment);
    }

    showMissFx({ lane } = {}){
      this.setFeedback('MISS', 'miss');
      this._pulseLane(lane, 'miss');
    }

    _pulseLane(lane, kind){
      if(!this.lanesEl) return;
      const el = this.lanesEl.querySelector(`.rb-lane[data-lane="${Number(lane)}"]`);
      if(!el) return;

      const cls =
        kind === 'perfect' ? 'rb-pulse-perfect' :
        kind === 'great'   ? 'rb-pulse-great' :
        kind === 'miss'    ? 'rb-pulse-miss' : 'rb-pulse-good';

      el.classList.remove('rb-pulse-perfect','rb-pulse-great','rb-pulse-good','rb-pulse-miss');
      el.classList.add(cls);
      WIN.setTimeout(()=>{ try{ el.classList.remove(cls); }catch(_){} }, 160);
    }

    destroy(){
      try{ if(this._mo) this._mo.disconnect(); }catch(_){}
      this._mo = null;
    }
  }

  // expose
  WIN.DomRendererRhythm = DomRendererRhythm;
})();