// === /fitness/js/dom-renderer-rhythm.js ===
// DOM Renderer — Rhythm Boxer (FX + Feedback) — PRODUCTION
// ✅ FX spawn near hit line (bottom) using CSS var --rb-hitline-y
// ✅ Works on PC/Mobile/cVR (no canvas)
// ✅ No module export (safe for <script src>)

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b, v)); }
  function rand(a,b){ return a + Math.random()*(b-a); }

  function cssNum(el, name, fallback){
    try{
      const v = getComputedStyle(el).getPropertyValue(name);
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    }catch(_){
      return fallback;
    }
  }

  function flash(){
    const el = DOC.querySelector('#rb-flash');
    if(!el) return;
    el.classList.add('active');
    setTimeout(()=>el.classList.remove('active'), 80);
  }

  function setFeedback(text, cls){
    const fb = DOC.querySelector('#rb-feedback');
    if(!fb) return;
    fb.textContent = text;
    fb.classList.remove('perfect','great','good','miss');
    if(cls) fb.classList.add(cls);
  }

  function laneRect(lanesEl, lane){
    const laneEl = lanesEl && lanesEl.querySelector
      ? lanesEl.querySelector(`.rb-lane[data-lane="${lane}"]`)
      : null;
    if(!laneEl) return null;
    return { el: laneEl, rect: laneEl.getBoundingClientRect() };
  }

  function hitPointFromLane(lanesEl, lane){
    // place FX at lane center X and at hit line Y (bottom - --rb-hitline-y)
    const info = laneRect(lanesEl, lane);
    if(!info) return null;

    const wrap = DOC.querySelector('#rb-wrap') || DOC.body;
    const hitY = cssNum(wrap, '--rb-hitline-y', 56);

    const r = info.rect;
    const x = r.left + r.width * 0.5;

    // CSS: hit line drawn at bottom: --rb-hitline-y
    // we want the FX point slightly above the line for nice look
    const y = (r.bottom - hitY) - 6;

    return { x, y, laneEl: info.el };
  }

  function spawnScoreFx(pt, label, cls){
    const el = DOC.createElement('div');
    el.className = `rb-score-fx ${cls||''}`;
    el.textContent = label;

    el.style.left = pt.x + 'px';
    el.style.top  = pt.y + 'px';

    DOC.body.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('is-live'));
    setTimeout(()=> el.remove(), 520);
  }

  function spawnFrags(pt, kind){
    const count = (kind==='perfect') ? 10 : (kind==='great') ? 8 : (kind==='good') ? 6 : 7;
    const baseLife = (kind==='miss') ? 520 : 460;

    for(let i=0;i<count;i++){
      const f = DOC.createElement('div');
      f.className = 'rb-frag ' + (
        kind==='perfect' ? 'rb-frag-perfect' :
        kind==='great'   ? 'rb-frag-great'   :
        kind==='good'    ? 'rb-frag-good'    :
                           'rb-frag-miss'
      );

      const s = clamp(rand(4,9), 3, 12);
      f.style.width = s + 'px';
      f.style.height = s + 'px';

      const dx = Math.round(rand(-38, 38));
      const dy = Math.round(rand(-40, 14));
      const life = Math.round(baseLife + rand(-60, 90));

      f.style.setProperty('--dx', dx + 'px');
      f.style.setProperty('--dy', dy + 'px');
      f.style.setProperty('--life', life + 'ms');

      f.style.left = pt.x + 'px';
      f.style.top  = pt.y + 'px';

      DOC.body.appendChild(f);
      setTimeout(()=> f.remove(), life + 40);
    }
  }

  // ===== Public Renderer API expected by engine =====
  const Renderer = {
    init(opts){
      this.lanesEl = opts && opts.lanesEl ? opts.lanesEl : DOC.querySelector('#rb-lanes');
      return this;
    },

    showHitFx(payload){
      // payload: { lane, judgment, scoreDelta }
      const lane = payload && payload.lane != null ? payload.lane : 0;
      const judgment = (payload && payload.judgment) ? String(payload.judgment) : 'good';
      const scoreDelta = (payload && payload.scoreDelta != null) ? payload.scoreDelta : 0;

      const pt = hitPointFromLane(this.lanesEl, lane);
      if(!pt) return;

      if(judgment === 'perfect'){
        setFeedback('PERFECT!', 'perfect');
        spawnScoreFx(pt, `+${scoreDelta}`, 'rb-score-perfect');
        spawnFrags(pt, 'perfect');
        flash();
      }else if(judgment === 'great'){
        setFeedback('GREAT!', 'great');
        spawnScoreFx(pt, `+${scoreDelta}`, 'rb-score-great');
        spawnFrags(pt, 'great');
      }else{
        setFeedback('GOOD', 'good');
        spawnScoreFx(pt, `+${scoreDelta}`, 'rb-score-good');
        spawnFrags(pt, 'good');
      }
    },

    showMissFx(payload){
      // payload: { lane }
      const lane = payload && payload.lane != null ? payload.lane : 0;
      const pt = hitPointFromLane(this.lanesEl, lane);
      if(!pt) return;

      setFeedback('MISS', 'miss');
      spawnScoreFx(pt, `MISS`, 'rb-score-miss');
      spawnFrags(pt, 'miss');
    },

    clearFeedback(){
      setFeedback('พร้อม!', '');
    }
  };

  WIN.RhythmBoxerDomRenderer = Renderer;
})();