// === /fitness/js/dom-renderer-rhythm.js ===
// DOM Renderer for Rhythm Boxer (PC/Mobile/cVR friendly)
// ✅ Hit/Miss FX rendered near lane hit line (reads CSS --rb-hitline-y)
// ✅ Feedback text on #rb-feedback
// ✅ No module export (classic <script>)
// ✅ Safe if some DOM nodes missing

'use strict';

(function () {
  const WIN = window;
  const DOC = document;

  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function getCssVarPx(el, name, fallback) {
    try {
      const v = getComputedStyle(el).getPropertyValue(name).trim();
      if (!v) return fallback;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function centerOfRect(r) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  class RhythmDomRenderer {
    constructor(opts = {}) {
      this.wrap = opts.wrap || DOC.querySelector('#rb-wrap') || DOC.body;
      this.field = opts.field || DOC.querySelector('#rb-field');
      this.lanesEl = opts.lanesEl || DOC.querySelector('#rb-lanes');
      this.feedbackEl = opts.feedbackEl || DOC.querySelector('#rb-feedback');
      this.flashEl = opts.flashEl || DOC.querySelector('#rb-flash');

      this._feedbackTimer = null;
      this._lastLanePulse = 0;
    }

    // ---- public API used by engine ----

    showHitFx(payload = {}) {
      const lane = Number(payload.lane);
      const judgment = String(payload.judgment || 'good').toLowerCase();
      const scoreDelta = Number(payload.scoreDelta) || 0;

      const laneEl = this._getLaneEl(lane);
      if (!laneEl) {
        this._showFeedback(this._labelFromJudgment(judgment, scoreDelta), judgment);
        return;
      }

      const p = this._getLaneHitPoint(laneEl);

      // 1) floating score/judgment text
      this._spawnScoreFx({
        x: p.x,
        y: p.y - 8,
        judgment,
        scoreDelta
      });

      // 2) particles burst at hit line
      this._spawnBurst({
        x: p.x,
        y: p.y,
        judgment
      });

      // 3) lane pulse
      this._pulseLane(laneEl, judgment);

      // 4) top feedback pill text
      this._showFeedback(this._labelFromJudgment(judgment, scoreDelta), judgment);

      // 5) subtle screen flash on perfect/great
      if (judgment === 'perfect') this._flash(0.16);
      else if (judgment === 'great') this._flash(0.10);
    }

    showMissFx(payload = {}) {
      const lane = Number(payload.lane);
      const laneEl = this._getLaneEl(lane);

      if (laneEl) {
        const p = this._getLaneHitPoint(laneEl);

        this._spawnScoreFx({
          x: p.x,
          y: p.y - 6,
          judgment: 'miss',
          scoreDelta: 0
        });

        this._spawnBurst({
          x: p.x,
          y: p.y,
          judgment: 'miss'
        });

        this._pulseLane(laneEl, 'miss');
      }

      this._showFeedback('MISS', 'miss');
      this._flash(0.06);
    }

    // ---- internals ----

    _getLaneEl(lane) {
      if (!this.lanesEl) return null;
      if (!Number.isFinite(lane)) return null;
      return this.lanesEl.querySelector(`.rb-lane[data-lane="${lane}"]`);
    }

    _getLaneHitPoint(laneEl) {
      // IMPORTANT: sync with CSS hit line at bottom: var(--rb-hitline-y)
      // Engine visual note reaches hit line when translateY -> 0.
      const r = laneEl.getBoundingClientRect();
      const center = centerOfRect(r);

      // Prefer lane element CSS variable; fallback to root default
      let hitlineY = getCssVarPx(laneEl, '--rb-hitline-y', NaN);
      if (!Number.isFinite(hitlineY)) {
        hitlineY = getCssVarPx(DOC.documentElement, '--rb-hitline-y', 74);
      }

      // y at line center (lane bottom - hitlineY + ~2px line thickness center)
      const y = r.bottom - hitlineY + 2;

      return {
        x: center.x,
        y
      };
    }

    _labelFromJudgment(j, scoreDelta) {
      if (j === 'perfect') return `PERFECT +${scoreDelta || 150}`;
      if (j === 'great') return `GREAT +${scoreDelta || 100}`;
      if (j === 'good') return `GOOD +${scoreDelta || 50}`;
      return 'MISS';
    }

    _showFeedback(text, kind) {
      if (!this.feedbackEl) return;

      this.feedbackEl.textContent = text || '';
      this.feedbackEl.classList.remove('perfect', 'great', 'good', 'miss');
      if (kind) this.feedbackEl.classList.add(kind);

      // animate with quick "pop"
      this.feedbackEl.animate(
        [
          { transform: 'translateX(-50%) scale(0.96)', opacity: 0.75 },
          { transform: 'translateX(-50%) scale(1.04)', opacity: 1.00 },
          { transform: 'translateX(-50%) scale(1.00)', opacity: 1.00 }
        ],
        { duration: 180, easing: 'ease-out' }
      );

      if (this._feedbackTimer) clearTimeout(this._feedbackTimer);
      this._feedbackTimer = setTimeout(() => {
        // return to neutral text (optional)
        if (!this.feedbackEl) return;
        this.feedbackEl.classList.remove('perfect', 'great', 'good', 'miss');
        this.feedbackEl.textContent = 'พร้อม!';
      }, 380);
    }

    _pulseLane(laneEl, judgment) {
      if (!laneEl) return;

      let glow = 'rgba(99,102,241,.22)';
      if (judgment === 'perfect') glow = 'rgba(250,204,21,.30)';
      else if (judgment === 'great') glow = 'rgba(96,165,250,.28)';
      else if (judgment === 'good') glow = 'rgba(52,211,153,.24)';
      else if (judgment === 'miss') glow = 'rgba(239,68,68,.22)';

      // Use WAAPI so we don't need extra CSS classes
      laneEl.animate(
        [
          { boxShadow: `inset 0 0 0 0 ${glow}, inset 0 -8px 20px 0 rgba(0,0,0,0)` },
          { boxShadow: `inset 0 0 0 1px ${glow}, inset 0 -20px 40px 0 ${glow}` },
          { boxShadow: `inset 0 0 0 0 rgba(0,0,0,0), inset 0 -8px 20px 0 rgba(0,0,0,0)` }
        ],
        { duration: judgment === 'miss' ? 220 : 180, easing: 'ease-out' }
      );
    }

    _spawnScoreFx({ x, y, judgment, scoreDelta }) {
      const el = DOC.createElement('div');
      el.className = `rb-score-fx rb-score-${judgment}`;

      if (judgment === 'miss') {
        el.textContent = 'MISS';
      } else {
        const label = judgment.toUpperCase();
        const plus = scoreDelta ? ` +${scoreDelta}` : '';
        el.textContent = `${label}${plus}`;
      }

      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.fontSize =
        judgment === 'perfect' ? '18px' :
        judgment === 'great' ? '16px' :
        judgment === 'good' ? '15px' : '15px';

      DOC.body.appendChild(el);

      // next frame -> animate in
      requestAnimationFrame(() => {
        el.classList.add('is-live');
      });

      // cleanup
      setTimeout(() => {
        el.remove();
      }, 460);
    }

    _spawnBurst({ x, y, judgment }) {
      const count =
        judgment === 'perfect' ? 10 :
        judgment === 'great' ? 8 :
        judgment === 'good' ? 6 : 6;

      for (let i = 0; i < count; i++) {
        const frag = DOC.createElement('div');
        frag.className = `rb-frag rb-frag-${judgment}`;

        const size =
          judgment === 'miss'
            ? rand(4, 7)
            : rand(4, 9);

        frag.style.width = `${size}px`;
        frag.style.height = `${size}px`;
        frag.style.left = `${x + rand(-8, 8)}px`;
        frag.style.top = `${y + rand(-4, 4)}px`;

        // spread mostly upward + sideways from hit line
        const dx = rand(-34, 34);
        const dy = judgment === 'miss' ? rand(-8, 14) : rand(-34, 8);
        frag.style.setProperty('--dx', `${dx}px`);
        frag.style.setProperty('--dy', `${dy}px`);
        frag.style.setProperty('--life', `${Math.round(rand(300, 520))}ms`);

        DOC.body.appendChild(frag);

        setTimeout(() => frag.remove(), 700);
      }
    }

    _flash(alpha) {
      if (!this.flashEl) return;
      const a = clamp(alpha, 0, 0.3);
      this.flashEl.style.opacity = String(a);
      this.flashEl.classList.add('active');

      // quick fade
      clearTimeout(this._flashTimer);
      this._flashTimer = setTimeout(() => {
        if (!this.flashEl) return;
        this.flashEl.style.opacity = '0';
        this.flashEl.classList.remove('active');
      }, 80);
    }
  }

  // expose globally (classic script)
  WIN.RhythmDomRenderer = RhythmDomRenderer;
})();