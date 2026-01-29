// === js/dom-renderer-rhythm.js — Rhythm Boxer DOM Renderer (IIFE / window.RbDomRenderer) ===
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  class RbDomRenderer {
    constructor(host, opts = {}) {
      this.host = host || null;

      this.wrapEl = opts.wrapEl || DOC.body;
      this.fieldEl = opts.fieldEl || DOC.getElementById('rb-field');
      this.lanesEl = opts.lanesEl || DOC.getElementById('rb-lanes');

      this.flashEl = opts.flashEl || DOC.getElementById('rb-flash');
      this.feedbackEl = opts.feedbackEl || DOC.getElementById('rb-feedback');

      // ตรงกับ CSS lane::before bottom:40px
      this.hitLineFromBottomPx = (opts.hitLineFromBottomPx != null) ? opts.hitLineFromBottomPx : 40;

      this._lastFeedbackMs = 0;
    }

    _laneHitPoint(lane){
      const lanesEl = this.lanesEl;
      if (!lanesEl) return { x: WIN.innerWidth/2, y: WIN.innerHeight/2 };

      const laneEl = lanesEl.querySelector(`.rb-lane[data-lane="${lane}"]`);
      const laneRect = laneEl ? laneEl.getBoundingClientRect() : lanesEl.getBoundingClientRect();
      const x = laneRect.left + laneRect.width/2;
      const y = laneRect.bottom - this.hitLineFromBottomPx;
      return { x, y };
    }

    flash(kind){
      const el = this.flashEl;
      if (!el) return;
      el.classList.add('active');
      el.dataset.kind = kind || '';
      setTimeout(()=>{ el.classList.remove('active'); el.dataset.kind=''; }, 160);
    }

    showFeedback(text, cls){
      const el = this.feedbackEl;
      if (!el) return;
      const now = Date.now();
      if (now - this._lastFeedbackMs < 55) return;
      this._lastFeedbackMs = now;

      el.textContent = text || '';
      el.classList.remove('perfect','good','miss','bomb');
      if (cls) el.classList.add(cls);
    }

    showHitFx(payload){
      const lane = payload && (payload.lane != null) ? payload.lane : 2;
      const judgment = (payload && payload.judgment) || 'good';
      const scoreDelta = (payload && payload.scoreDelta != null) ? payload.scoreDelta : null;
      const isBoss = payload && payload.isBoss ? true : false;

      const p = this._laneHitPoint(lane);

      if (judgment === 'perfect') {
        this.flash(isBoss ? 'boss' : 'perfect');
        this.showFeedback(isBoss ? 'BOSS PERFECT!' : 'PERFECT!', 'perfect');
      } else if (judgment === 'great') {
        this.flash(isBoss ? 'boss' : 'great');
        this.showFeedback(isBoss ? 'BOSS GREAT!' : 'GREAT!', 'good');
      } else {
        this.flash(isBoss ? 'boss' : 'good');
        this.showFeedback(isBoss ? 'BOSS GOOD' : 'GOOD', 'good');
      }

      this.spawnHitParticle(p.x, p.y, isBoss ? 'boss' : judgment);
      this.spawnScoreText(p.x, p.y, scoreDelta, isBoss ? 'boss' : judgment);
    }

    showMissFx(payload){
      const lane = payload && (payload.lane != null) ? payload.lane : 2;
      const isBoss = payload && payload.isBoss ? true : false;
      const blocked = payload && payload.blocked ? true : false;

      const p = this._laneHitPoint(lane);

      if (blocked){
        this.flash('shield');
        this.showFeedback('SHIELD!', 'good');
        return;
      }

      this.flash(isBoss ? 'boss' : 'miss');
      this.showFeedback(isBoss ? 'BOSS MISS' : 'MISS', 'miss');
      this.spawnMissParticle(p.x, p.y);
    }

    spawnScoreText(x, y, scoreDelta, kind) {
      if (!Number.isFinite(scoreDelta)) return;

      const el = DOC.createElement('div');
      const cls = (kind === 'boss') ? 'rb-score-boss'
               : (kind === 'perfect') ? 'rb-score-perfect'
               : (kind === 'great') ? 'rb-score-great'
               : 'rb-score-good';
      el.className = `rb-score-fx ${cls}`;
      el.textContent = `${scoreDelta > 0 ? '+' : ''}${scoreDelta}`;

      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      DOC.body.appendChild(el);
      void el.offsetWidth;
      el.classList.add('is-live');

      setTimeout(() => {
        el.classList.remove('is-live');
        el.remove();
      }, 460);
    }

    spawnHitParticle(x, y, kind) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const el = DOC.createElement('div');
        const cls = (kind === 'boss') ? 'rb-frag-boss'
                : (kind === 'perfect') ? 'rb-frag-perfect'
                : (kind === 'great') ? 'rb-frag-great'
                : 'rb-frag-good';
        el.className = `rb-frag ${cls}`;

        const size = 6 + Math.random() * 7;
        const ang = (i / n) * Math.PI * 2;
        const dist = 34 + Math.random() * 44;
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist;
        const life = 380 + Math.random() * 220;

        el.style.width  = size + 'px';
        el.style.height = size + 'px';
        el.style.left   = x + 'px';
        el.style.top    = y + 'px';
        el.style.setProperty('--dx', dx + 'px');
        el.style.setProperty('--dy', dy + 'px');
        el.style.setProperty('--life', life + 'ms');

        DOC.body.appendChild(el);
        void el.offsetWidth;
        el.classList.add('is-live');

        setTimeout(() => el.remove(), life);
      }
    }

    spawnMissParticle(x, y) {
      const el = DOC.createElement('div');
      el.className = 'rb-frag rb-frag-miss';

      const size = 16;
      const life = 420;

      el.style.width  = size + 'px';
      el.style.height = size + 'px';
      el.style.left   = x + 'px';
      el.style.top    = y + 'px';
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '22px');
      el.style.setProperty('--life', life + 'ms');

      DOC.body.appendChild(el);
      void el.offsetWidth;
      el.classList.add('is-live');

      setTimeout(() => el.remove(), life);
    }
  }

  WIN.RbDomRenderer = RbDomRenderer;

})();