// === js/dom-renderer-rhythm.js — Rhythm Boxer DOM Renderer (IIFE / window.RbDomRenderer) ===
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // Renderer นี้ "ไม่ยุ่งกับการสร้าง/ขยับโน้ต" (engine ทำแล้ว)
  // หน้าที่หลัก: flash + feedback + FX (score pop + fragments) โดยอิง lane + ตำแหน่งเส้นตี
  class RbDomRenderer {
    constructor(host, opts = {}) {
      this.host = host || null;

      this.wrapEl = opts.wrapEl || DOC.body;
      this.fieldEl = opts.fieldEl || DOC.getElementById('rb-field');
      this.lanesEl = opts.lanesEl || DOC.getElementById('rb-lanes');

      this.flashEl = opts.flashEl || DOC.getElementById('rb-flash');
      this.feedbackEl = opts.feedbackEl || DOC.getElementById('rb-feedback');

      // ปรับค่าได้ ถ้าต้องการ
      this.hitLineFromBottomPx = (opts.hitLineFromBottomPx != null) ? opts.hitLineFromBottomPx : 40; // ตรงกับ CSS
      this.fxLifeMs = (opts.fxLifeMs != null) ? opts.fxLifeMs : 450;

      this._lastFeedbackMs = 0;
    }

    // จุดกลางเลนที่เส้นตี (screen px)
    _laneHitPoint(lane){
      const lanesEl = this.lanesEl;
      if (!lanesEl) return { x: WIN.innerWidth/2, y: WIN.innerHeight/2 };

      const laneEl = lanesEl.querySelector(`.rb-lane[data-lane="${lane}"]`);
      const laneRect = laneEl ? laneEl.getBoundingClientRect() : lanesEl.getBoundingClientRect();
      const x = laneRect.left + laneRect.width/2;
      const y = laneRect.bottom - this.hitLineFromBottomPx; // เส้นตีอยู่เหนือ bottom
      return { x, y };
    }

    // ---------- flash ----------
    flash(kind){
      const el = this.flashEl;
      if (!el) return;
      el.classList.add('active');
      // เพิ่ม class เฉพาะชนิด (optional)
      el.dataset.kind = kind || '';
      setTimeout(()=>{ el.classList.remove('active'); el.dataset.kind=''; }, 160);
    }

    // ---------- feedback bubble ----------
    showFeedback(text, cls){
      const el = this.feedbackEl;
      if (!el) return;
      const now = Date.now();
      if (now - this._lastFeedbackMs < 60) return; // กันสั่น
      this._lastFeedbackMs = now;

      el.textContent = text || '';
      el.classList.remove('perfect','good','miss','bomb');
      if (cls) el.classList.add(cls);
    }

    // ---------- public hooks called by engine ----------
    showHitFx(payload){
      // engine ส่ง: { lane, judgment, scoreDelta, ... }
      const lane = payload && (payload.lane != null) ? payload.lane : 2;
      const judgment = (payload && payload.judgment) || 'good';
      const scoreDelta = (payload && payload.scoreDelta != null) ? payload.scoreDelta : null;

      const p = this._laneHitPoint(lane);

      // flash + feedback
      if (judgment === 'perfect') {
        this.flash('perfect');
        this.showFeedback('PERFECT!', 'perfect');
      } else if (judgment === 'great') {
        this.flash('great');
        this.showFeedback('GREAT!', 'good');
      } else {
        this.flash('good');
        this.showFeedback('GOOD', 'good');
      }

      this.spawnHitParticle(p.x, p.y, judgment);
      this.spawnScoreText(p.x, p.y, scoreDelta, judgment);
    }

    showMissFx(payload){
      const lane = payload && (payload.lane != null) ? payload.lane : 2;
      const p = this._laneHitPoint(lane);

      this.flash('miss');
      this.showFeedback('MISS', 'miss');
      this.spawnMissParticle(p.x, p.y);
    }

    // ---------- FX: score pop ----------
    spawnScoreText(x, y, scoreDelta, judgment) {
      if (!Number.isFinite(scoreDelta)) return;

      const el = DOC.createElement('div');
      el.className = `rb-score-fx rb-score-${judgment || 'good'}`;
      el.textContent = `${scoreDelta > 0 ? '+' : ''}${scoreDelta}`;

      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      DOC.body.appendChild(el);
      void el.offsetWidth;
      el.classList.add('is-live');

      setTimeout(() => {
        el.classList.remove('is-live');
        el.remove();
      }, this.fxLifeMs);
    }

    // ---------- FX: fragments ----------
    spawnHitParticle(x, y, judgment) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const el = DOC.createElement('div');
        el.className = `rb-frag rb-frag-${judgment || 'good'}`;

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