// === /fitness/js/dom-renderer-rhythm.js ===
// Rhythm Boxer DOM Renderer (FX) — PRODUCTION
// ✅ Hit/Miss FX anchored to HIT LINE (bottom yellow line) per lane
// ✅ Works on PC/Mobile/cVR (no WebGL required)
// ✅ Uses CSS vars: --rb-hitline-bottom (px) for hit line position from lane bottom
'use strict';

(function(){
  const DOC = document;

  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }

  class RhythmDomRenderer{
    constructor(opts = {}){
      this.lanesEl = opts.lanesEl || document.querySelector('#rb-lanes');
      this.fieldEl = opts.fieldEl || document.querySelector('#rb-field');
      this.flashEl = opts.flashEl || document.querySelector('#rb-flash');
      this.feedbackEl = opts.feedbackEl || document.querySelector('#rb-feedback');

      this._flashT = null;
      this._fbT = null;
    }

    // ===== public helpers =====
    setFeedback(text, cls){
      if(!this.feedbackEl) return;
      this.feedbackEl.textContent = String(text || '');
      this.feedbackEl.classList.remove('perfect','great','good','miss','ready');
      if(cls) this.feedbackEl.classList.add(cls);
      clearTimeout(this._fbT);
      // auto clear highlight class, keep text
      this._fbT = setTimeout(()=>{
        if(!this.feedbackEl) return;
        this.feedbackEl.classList.remove('perfect','great','good','miss','ready');
      }, 240);
    }

    flash(kind){
      if(!this.flashEl) return;
      this.flashEl.classList.add('active');
      clearTimeout(this._flashT);
      this._flashT = setTimeout(()=>{
        if(this.flashEl) this.flashEl.classList.remove('active');
      }, 140);
    }

    // ===== engine callbacks =====
    showHitFx({ lane, judgment, scoreDelta }){
      const p = this._hitPointForLane(lane);
      this._spawnHitParticle(p.x, p.y, judgment);
      this._spawnScoreText(p.x, p.y, scoreDelta, judgment);
      this.setFeedback(String(judgment||'HIT').toUpperCase(), judgment || 'good');
    }

    showMissFx({ lane }){
      const p = this._hitPointForLane(lane);
      this._spawnMissParticle(p.x, p.y);
      this.flash('miss');
      this.setFeedback('MISS', 'miss');
    }

    // ===== anchor math =====
    _hitPointForLane(lane){
      // Anchor = lane center X, hit line Y at bottom (yellow line)
      const lanesEl = this.lanesEl || DOC.querySelector('#rb-lanes');
      const laneEl = lanesEl ? lanesEl.querySelector(`.rb-lane[data-lane="${lane}"]`) : null;

      // fallback: center screen-ish
      if(!laneEl){
        const r = (this.fieldEl || DOC.body).getBoundingClientRect();
        return { x: r.left + r.width/2, y: r.top + r.height*0.72 };
      }

      const rect = laneEl.getBoundingClientRect();
      const x = rect.left + rect.width/2;

      // CSS var: --rb-hitline-bottom (px) = distance from lane bottom upward to hit line
      const cs = getComputedStyle(laneEl);
      let hitBottom = parseFloat(cs.getPropertyValue('--rb-hitline-bottom'));
      if(!Number.isFinite(hitBottom)) hitBottom = 58; // sane default

      // Y is at (lane bottom - hitBottom)
      const y = rect.top + rect.height - hitBottom;

      return { x, y };
    }

    // ===== FX spawners =====
    _spawnScoreText(x, y, scoreDelta, judgment){
      if(!Number.isFinite(scoreDelta)) return;
      const el = DOC.createElement('div');
      el.className = `rb-score-fx rb-score-${judgment || 'good'}`;
      el.textContent = `${scoreDelta > 0 ? '+' : ''}${scoreDelta}`;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      DOC.body.appendChild(el);
      void el.offsetWidth;
      el.classList.add('is-live');
      setTimeout(()=>{ el.classList.remove('is-live'); el.remove(); }, 520);
    }

    _spawnHitParticle(x, y, judgment){
      const n = 12;
      for(let i=0;i<n;i++){
        const el = DOC.createElement('div');
        el.className = `rb-frag rb-frag-${judgment || 'good'}`;

        const size = 6 + Math.random()*7;
        const ang = (i/n) * Math.PI*2 + (Math.random()*0.35);
        const dist = 22 + Math.random()*34;

        const dx = Math.cos(ang)*dist;
        const dy = Math.sin(ang)*dist;

        const life = 420 + Math.random()*220;

        el.style.width = size+'px';
        el.style.height = size+'px';
        el.style.left = x+'px';
        el.style.top  = y+'px';
        el.style.setProperty('--dx', dx+'px');
        el.style.setProperty('--dy', dy+'px');
        el.style.setProperty('--life', life+'ms');

        DOC.body.appendChild(el);
        setTimeout(()=>el.remove(), life);
      }
    }

    _spawnMissParticle(x, y){
      const el = DOC.createElement('div');
      el.className = 'rb-frag rb-frag-miss';

      const life = 520;
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.left = x+'px';
      el.style.top  = y+'px';
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '30px');
      el.style.setProperty('--life', life+'ms');

      DOC.body.appendChild(el);
      setTimeout(()=>el.remove(), life);
    }
  }

  window.RhythmDomRenderer = RhythmDomRenderer;
})();