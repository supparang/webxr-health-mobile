/* === /herohealth/plate/plate-hud.js ===
Balanced Plate VR — HUD Binder (PRODUCTION)
✅ Listens: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
✅ Updates DOM safely (no crash if missing)
✅ Auto view mode: view-pc / view-mobile / view-vr / view-cvr (URL + device + A-Frame enter-vr/exit-vr)
✅ Lightweight Judge Toast (auto-inject)
*/

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // -------------------- helpers --------------------
  const qs = (id) => doc.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const num = (v, d=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const setText = (id, v) => {
    const el = qs(id);
    if (el) el.textContent = String(v);
  };
  const setWidthPct = (id, pct) => {
    const el = qs(id);
    if (!el) return;
    const p = clamp(num(pct, 0), 0, 100);
    el.style.width = p.toFixed(2) + '%';
  };

  function fmtPct(x){
    return Math.round(num(x,0)) + '%';
  }

  // -------------------- view mode --------------------
  function readViewFromUrl(){
    try{
      const u = new URL(location.href);
      const v = (u.searchParams.get('view') || '').toLowerCase().trim();
      const cvr = (u.searchParams.get('cvr') || '').toLowerCase().trim();
      if (v) return v;
      if (cvr === '1' || cvr === 'true' || cvr === 'yes') return 'cvr';
      return '';
    }catch(_){
      return '';
    }
  }

  function autoDeviceView(){
    try{
      const w = root.innerWidth || 360;
      const touch = ('ontouchstart' in root) || (navigator && navigator.maxTouchPoints > 0);
      if (touch && w <= 980) return 'mobile';
      return 'pc';
    }catch(_){
      return 'pc';
    }
  }

  function setBodyView(view){
    const b = doc.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);
  }

  // initialize view
  (function initView(){
    const v = readViewFromUrl();
    if (v === 'vr' || v === 'cvr' || v === 'pc' || v === 'mobile'){
      setBodyView(v);
    } else {
      setBodyView(autoDeviceView());
    }

    // Upgrade to VR automatically when entering A-Frame VR
    const scene = doc.querySelector('a-scene');
    if (scene){
      scene.addEventListener('enter-vr', () => {
        // don't override cVR if user requested it
        const b = doc.body;
        if (b && b.classList.contains('view-cvr')) return;
        setBodyView('vr');
      });
      scene.addEventListener('exit-vr', () => {
        const forced = readViewFromUrl();
        if (forced === 'cvr') return setBodyView('cvr');
        if (forced === 'vr') return setBodyView('vr');
        setBodyView(autoDeviceView());
      });
    }
  })();

  // -------------------- judge toast (auto inject) --------------------
  function ensureJudgeToast(){
    let el = qs('judgeToast');
    if (el) return el;

    // css once
    const cssId = 'plate-judge-toast-css';
    if (!doc.getElementById(cssId)){
      const st = doc.createElement('style');
      st.id = cssId;
      st.textContent = `
        #judgeToast{
          position:fixed;
          left:50%;
          top: calc(env(safe-area-inset-top, 0px) + 10px);
          transform: translateX(-50%);
          z-index:120;
          max-width:min(760px, calc(100vw - 24px));
          padding:10px 12px;
          border-radius:999px;
          border:1px solid rgba(148,163,184,.18);
          background: rgba(2,6,23,.72);
          color: rgba(229,231,235,.98);
          font: 1100 13px/1.15 system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
          letter-spacing:.01em;
          box-shadow: 0 18px 44px rgba(0,0,0,.32);
          backdrop-filter: blur(10px);
          opacity:0;
          pointer-events:none;
          transition: opacity .14s ease, transform .14s ease;
        }
        #judgeToast.show{
          opacity:1;
          transform: translateX(-50%) translateY(0);
        }
        #judgeToast.good{ border-color: rgba(34,197,94,.28); background: rgba(34,197,94,.10); }
        #judgeToast.warn{ border-color: rgba(245,158,11,.30); background: rgba(245,158,11,.10); }
        #judgeToast.bad { border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.10); }
      `;
      doc.head.appendChild(st);
    }

    el = doc.createElement('div');
    el.id = 'judgeToast';
    el.textContent = '';
    doc.body.appendChild(el);
    return el;
  }

  let toastT = null;
  function showJudgeToast(text, kind){
    const el = ensureJudgeToast();
    if (!el) return;
    el.classList.remove('good','warn','bad','show');
    const k = (kind || 'info').toLowerCase();
    if (k === 'good') el.classList.add('good');
    else if (k === 'warn' || k === 'warning') el.classList.add('warn');
    else if (k === 'bad' || k === 'danger' || k === 'error') el.classList.add('bad');

    el.textContent = String(text || '');
    clearTimeout(toastT);
    // reflow for animation
    void el.offsetWidth;
    el.classList.add('show');
    toastT = setTimeout(() => el.classList.remove('show'), 900);
  }

  // -------------------- grade styling (optional) --------------------
  function applyGradeStyle(grade){
    // Optional: tint grade chip slightly by grade
    const g = String(grade || '').toUpperCase();
    const chip = qs('uiGrade');
    if (!chip) return;
    // We won't overwrite styles heavily; just set dataset for CSS hooks if you want later
    chip.dataset.grade = g;
  }

  // -------------------- event listeners --------------------
  root.addEventListener('hha:score', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;

    // numbers
    if (d.score != null) setText('uiScore', d.score);
    if (d.combo != null) setText('uiCombo', d.combo);
    if (d.comboMax != null) setText('uiComboMax', d.comboMax);
    if (d.miss != null) setText('uiMiss', d.miss);
    if (d.timeLeftSec != null) setText('uiTime', Math.ceil(num(d.timeLeftSec, 0)));

    // plate/group
    if (d.plateHave != null) setText('uiPlateHave', d.plateHave);
    if (Array.isArray(d.gCount)){
      setText('uiG1', d.gCount[0] ?? 0);
      setText('uiG2', d.gCount[1] ?? 0);
      setText('uiG3', d.gCount[2] ?? 0);
      setText('uiG4', d.gCount[3] ?? 0);
      setText('uiG5', d.gCount[4] ?? 0);
    }

    // fever/shield
    if (d.fever != null) setWidthPct('uiFeverFill', num(d.fever,0));
    if (d.shield != null) setText('uiShieldN', d.shield);

    // accuracy/grade
    if (d.accuracyGoodPct != null) setText('uiAcc', fmtPct(d.accuracyGoodPct));
    if (d.grade != null){
      setText('uiGrade', d.grade);
      applyGradeStyle(d.grade);
    }
  });

  root.addEventListener('hha:time', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;
    if (d.timeLeftSec != null) setText('uiTime', Math.ceil(num(d.timeLeftSec, 0)));
  });

  root.addEventListener('quest:update', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;

    // goal
    if (d.goal){
      setText('uiGoalTitle', d.goal.title ?? '—');
      if (d.goal.cur != null && d.goal.target != null){
        setText('uiGoalCount', `${d.goal.cur}/${d.goal.target}`);
        const pct = d.goal.target ? (num(d.goal.cur,0) / num(d.goal.target,1) * 100) : 0;
        setWidthPct('uiGoalFill', pct);
      }
    }

    // mini
    if (d.mini){
      setText('uiMiniTitle', d.mini.title ?? '—');
      if (d.mini.timeLeft != null){
        setText('uiMiniTime', `${Math.ceil(num(d.mini.timeLeft,0))}s`);
      }
      if (d.mini.target != null && d.mini.timeLeft != null){
        const used = clamp(num(d.mini.target,0) - num(d.mini.timeLeft,0), 0, num(d.mini.target,0));
        const pct = d.mini.target ? (used / num(d.mini.target,1) * 100) : 0;
        setWidthPct('uiMiniFill', pct);
      }
    }
  });

  root.addEventListener('hha:coach', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;

    const msg = d.msg ?? '';
    const mood = (d.mood || 'neutral').toLowerCase();

    const cm = qs('coachMsg');
    if (cm) cm.textContent = String(msg);

    const img = qs('coachImg');
    if (img){
      const map = {
        happy: './img/coach-happy.png',
        neutral: './img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[mood] || map.neutral;
    }
  });

  root.addEventListener('hha:judge', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;
    const text = d.text ?? '';
    const kind = d.kind ?? 'info';
    if (text) showJudgeToast(text, kind);
  });

  root.addEventListener('hha:end', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;
    const summary = d.summary || {};
    // Only fill if elements exist (plate.safe.js also fills)
    setText('rMode', summary.runMode ?? '');
    setText('rGrade', summary.grade ?? '');
    setText('rScore', summary.scoreFinal ?? 0);
    setText('rMaxCombo', summary.comboMax ?? 0);
    setText('rMiss', summary.misses ?? 0);
    setText('rPerfect', (summary.fastHitRatePct != null) ? (Math.round(num(summary.fastHitRatePct,0)) + '%') : '0%');
    setText('rGoals', `${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}`);
    setText('rMinis', `${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}`);

    if (summary.plate && Array.isArray(summary.plate.counts)){
      setText('rG1', summary.plate.counts[0] ?? 0);
      setText('rG2', summary.plate.counts[1] ?? 0);
      setText('rG3', summary.plate.counts[2] ?? 0);
      setText('rG4', summary.plate.counts[3] ?? 0);
      setText('rG5', summary.plate.counts[4] ?? 0);
      setText('rGTotal', summary.plate.total ?? 0);
    }
  });

})(window);