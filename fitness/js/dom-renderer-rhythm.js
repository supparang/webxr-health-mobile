// === /fitness/js/dom-renderer-rhythm.js ===
// Rhythm Boxer DOM Renderer — PATCH (5-lane + mobile feedback + stable FX)
// ใช้ร่วมกับ rhythm-engine.js (engine เป็นคนสร้าง/ขยับ .rb-note)

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

  class DomRendererRhythm {
    constructor(opts = {}){
      this.wrap = opts.wrap || DOC.querySelector('#rb-wrap') || DOC.body;
      this.field = opts.field || DOC.querySelector('#rb-field');
      this.lanesEl = opts.lanesEl || DOC.querySelector('#rb-lanes');
      this.feedbackEl = opts.feedbackEl || DOC.querySelector('#rb-feedback');

      this._feedbackTimer = null;
      this._lastLanePulseAt = new Map();

      // safety
      if (!this.field || !this.lanesEl) {
        console.warn('[DomRendererRhythm] missing #rb-field or #rb-lanes');
      }
    }

    // -----------------------------
    // Public API used by engine
    // -----------------------------
    showHitFx(payload = {}){
      const lane = Number(payload.lane);
      const judgment = String(payload.judgment || 'good').toLowerCase();
      const scoreDelta = Number(payload.scoreDelta || 0);

      // feedback text
      const label =
        judgment === 'perfect' ? 'PERFECT' :
        judgment === 'great'   ? 'GREAT'   :
        judgment === 'good'    ? 'GOOD'    : 'HIT';

      this._setFeedback(label, judgment);

      // lane pulse
      this._pulseLane(lane, judgment);

      // spark at hit line
      this._spawnSpark(lane, judgment);

      // floating score (optional)
      if (scoreDelta > 0) {
        this._spawnFloatText(lane, `+${scoreDelta}`, judgment);
      }
    }

    showMissFx(payload = {}){
      const lane = Number(payload.lane);
      this._setFeedback('MISS', 'miss');
      this._pulseLane(lane, 'miss');
      this._spawnSpark(lane, 'miss');
    }

    // optional (if later needed)
    clear(){
      if (!this.lanesEl) return;
      this.lanesEl.querySelectorAll('.rb-fx-spark,.rb-fx-float').forEach(el=>el.remove());
      this._clearFeedbackTimer();
      if (this.feedbackEl) {
        this.feedbackEl.textContent = 'พร้อม!';
        this.feedbackEl.classList.remove(
          'is-perfect','is-great','is-good','is-miss','show'
        );
      }
    }

    // -----------------------------
    // Internals
    // -----------------------------
    _laneEl(lane){
      if (!this.lanesEl || !Number.isFinite(lane)) return null;
      return this.lanesEl.querySelector(`.rb-lane[data-lane="${lane}"]`);
    }

    _setFeedback(text, kind){
      const el = this.feedbackEl;
      if (!el) return;

      el.textContent = text || '';
      el.classList.remove('is-perfect','is-great','is-good','is-miss');
      if (kind) el.classList.add(`is-${kind}`);
      el.classList.add('show');

      this._clearFeedbackTimer();
      this._feedbackTimer = setTimeout(()=>{
        el.classList.remove('show','is-perfect','is-great','is-good','is-miss');
      }, kind === 'miss' ? 320 : 260);
    }

    _clearFeedbackTimer(){
      if (this._feedbackTimer){
        clearTimeout(this._feedbackTimer);
        this._feedbackTimer = null;
      }
    }

    _pulseLane(lane, kind){
      const laneEl = this._laneEl(lane);
      if (!laneEl) return;

      // กัน pulse ถี่เกินบนมือถือ
      const now = performance.now();
      const last = this._lastLanePulseAt.get(lane) || 0;
      if (now - last < 35) return;
      this._lastLanePulseAt.set(lane, now);

      laneEl.classList.remove('fx-hit-perfect','fx-hit-great','fx-hit-good','fx-hit-miss');

      const cls =
        kind === 'perfect' ? 'fx-hit-perfect' :
        kind === 'great'   ? 'fx-hit-great'   :
        kind === 'good'    ? 'fx-hit-good'    :
                             'fx-hit-miss';

      // force reflow ให้เล่น animation ซ้ำได้
      void laneEl.offsetWidth;
      laneEl.classList.add(cls);

      // cleanup class หลัง anim
      setTimeout(()=> laneEl.classList.remove(cls), 260);
    }

    _spawnSpark(lane, kind){
      const laneEl = this._laneEl(lane);
      if (!laneEl) return;

      // จุดเกิด FX: แถวเส้นตี (ด้านล่าง)
      // ใช้ CSS var --rb-hitline-y ถ้ามี; fallback 78%
      const hitlineYVar = this._readCssPx(this.wrap, '--rb-hitline-y');
      const laneRect = laneEl.getBoundingClientRect();
      const yPx = Number.isFinite(hitlineYVar)
        ? clamp(hitlineYVar, 40, laneRect.height - 20)
        : Math.round(laneRect.height * 0.78);

      const fx = DOC.createElement('div');
      fx.className = `rb-fx-spark ${this._sparkKindClass(kind)}`;
      fx.style.left = '50%';
      fx.style.top = `${Math.round(yPx)}px`;
      fx.style.transform = 'translate(-50%, -50%)';

      laneEl.appendChild(fx);

      // auto remove
      setTimeout(()=> fx.remove(), 260);
    }

    _spawnFloatText(lane, text, kind){
      const laneEl = this._laneEl(lane);
      if (!laneEl) return;

      const hitlineYVar = this._readCssPx(this.wrap, '--rb-hitline-y');
      const laneRect = laneEl.getBoundingClientRect();
      const yPx = Number.isFinite(hitlineYVar)
        ? clamp(hitlineYVar - 32, 20, laneRect.height - 40)
        : Math.round(laneRect.height * 0.70);

      const el = DOC.createElement('div');
      el.className = `rb-fx-float ${this._sparkKindClass(kind)}`;
      el.textContent = text;
      el.style.left = '50%';
      el.style.top = `${Math.round(yPx)}px`;
      el.style.transform = 'translate(-50%, -50%)';

      laneEl.appendChild(el);
      setTimeout(()=> el.remove(), 520);
    }

    _sparkKindClass(kind){
      if (kind === 'perfect') return 'is-perfect';
      if (kind === 'great') return 'is-great';
      if (kind === 'good') return 'is-good';
      return 'is-miss';
    }

    _readCssPx(el, varName){
      try{
        if (!el) return NaN;
        const s = getComputedStyle(el).getPropertyValue(varName).trim();
        if (!s) return NaN;
        // รองรับ "123px" หรือ "123"
        const n = parseFloat(s.replace('px',''));
        return Number.isFinite(n) ? n : NaN;
      }catch(_){
        return NaN;
      }
    }
  }

  // expose
  WIN.DomRendererRhythm = DomRendererRhythm;

})();