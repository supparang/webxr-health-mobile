// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (PRODUCTION)
// ✅ Listens: hha:score, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate
// ✅ Updates DOM ids in /herohealth/plate-vr.html
// ✅ Adds: mini toast, combo glow, fever-high state, shield pulse, grade styling
// ✅ Safe: if element missing -> skip

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const qs = (id) => DOC.getElementById(id);
  const clamp = (v, a, b) => {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  };

  // ---- DOM handles (all optional) ----
  const hudTop = qs('hudTop');
  const miniPanel = qs('miniPanel');
  const coachPanel = qs('coachPanel');

  const uiScore = qs('uiScore');
  const uiCombo = qs('uiCombo');
  const uiComboMax = qs('uiComboMax');
  const uiMiss = qs('uiMiss');
  const uiPlateHave = qs('uiPlateHave');
  const uiG1 = qs('uiG1');
  const uiG2 = qs('uiG2');
  const uiG3 = qs('uiG3');
  const uiG4 = qs('uiG4');
  const uiG5 = qs('uiG5');
  const uiAcc = qs('uiAcc');
  const uiGrade = qs('uiGrade');
  const uiTime = qs('uiTime');
  const uiFeverFill = qs('uiFeverFill');
  const uiShieldN = qs('uiShieldN');

  const uiGoalTitle = qs('uiGoalTitle');
  const uiGoalCount = qs('uiGoalCount');
  const uiGoalFill  = qs('uiGoalFill');

  const uiMiniTitle = qs('uiMiniTitle');
  const uiMiniCount = qs('uiMiniCount');
  const uiMiniTime  = qs('uiMiniTime');
  const uiMiniFill  = qs('uiMiniFill');
  const uiHint      = qs('uiHint');

  const coachMsg = qs('coachMsg');
  const coachImg = qs('coachImg');

  // result panel (optional)
  const resultBackdrop = qs('resultBackdrop');
  const rMode = qs('rMode');
  const rGrade = qs('rGrade');
  const rScore = qs('rScore');
  const rMaxCombo = qs('rMaxCombo');
  const rMiss = qs('rMiss');
  const rPerfect = qs('rPerfect');
  const rGoals = qs('rGoals');
  const rMinis = qs('rMinis');
  const rG1 = qs('rG1');
  const rG2 = qs('rG2');
  const rG3 = qs('rG3');
  const rG4 = qs('rG4');
  const rG5 = qs('rG5');
  const rGTotal = qs('rGTotal');

  // ---- Toast layer (judge / celebrate) ----
  function ensureToast() {
    let wrap = DOC.querySelector('.plateToastWrap');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'plateToastWrap';
    wrap.style.cssText = `
      position:fixed; left:0; right:0;
      top: calc(env(safe-area-inset-top, 0px) + 108px);
      z-index:95;
      display:flex; justify-content:center;
      pointer-events:none;
    `;
    const inner = DOC.createElement('div');
    inner.className = 'plateToast';
    inner.style.cssText = `
      max-width:min(560px, 92vw);
      padding:10px 12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.62);
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 44px rgba(0,0,0,.28);
      font: 1100 13px/1.15 system-ui;
      color: rgba(229,231,235,.95);
      opacity:0;
      transform: translateY(-6px) scale(.98);
      transition: opacity .14s ease, transform .14s ease;
      text-align:center;
      white-space:pre-wrap;
    `;
    wrap.appendChild(inner);
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function toast(text, kind) {
    const wrap = ensureToast();
    const el = wrap.querySelector('.plateToast');
    if (!el) return;

    // kind styling
    const k = (kind || 'info').toLowerCase();
    let border = 'rgba(148,163,184,.18)';
    let bg = 'rgba(2,6,23,.62)';
    if (k === 'good' || k === 'success') { border = 'rgba(34,197,94,.28)'; bg = 'rgba(34,197,94,.10)'; }
    if (k === 'warn' || k === 'warning') { border = 'rgba(250,204,21,.30)'; bg = 'rgba(250,204,21,.10)'; }
    if (k === 'bad'  || k === 'error')   { border = 'rgba(239,68,68,.28)'; bg = 'rgba(239,68,68,.10)'; }

    el.style.borderColor = border;
    el.style.background = bg;
    el.textContent = String(text || '');

    // show
    el.style.opacity = '1';
    el.style.transform = 'translateY(0px) scale(1)';

    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px) scale(.98)';
    }, 950);
  }

  // ---- Small HUD polish ----
  function setText(el, v) {
    if (!el) return;
    el.textContent = String(v);
  }

  function setBar(el, pct) {
    if (!el) return;
    el.style.width = `${clamp(pct, 0, 100)}%`;
  }

  function setGradeUI(grade, accPct) {
    if (uiGrade) uiGrade.textContent = String(grade || 'C');
    if (uiAcc) uiAcc.textContent = `${Math.round(Number(accPct) || 0)}%`;

    // subtle emphasis on top chip
    if (!hudTop) return;
    hudTop.classList.remove('hha-combo-glow');
  }

  function pulseShield() {
    const pill = DOC.getElementById('uiShield');
    if (!pill) return;
    pill.animate(
      [
        { transform:'scale(1)', filter:'none' },
        { transform:'scale(1.06)', filter:'brightness(1.15)' },
        { transform:'scale(1)', filter:'none' },
      ],
      { duration: 260, easing:'ease-out' }
    );
  }

  function comboGlow() {
    if (!hudTop) return;
    hudTop.classList.add('hha-combo-glow');
    clearTimeout(comboGlow._t);
    comboGlow._t = setTimeout(() => hudTop.classList.remove('hha-combo-glow'), 260);
  }

  function setFeverState(fever) {
    const f = Number(fever) || 0;
    if (!DOC.body) return;
    if (f >= 80) DOC.body.classList.add('fever-high');
    else DOC.body.classList.remove('fever-high');
  }

  function setCoach(mood, msg) {
    if (coachMsg && msg != null) coachMsg.textContent = String(msg);

    if (coachImg) {
      const m = String(mood || 'neutral').toLowerCase();
      const map = {
        happy: './img/coach-happy.png',
        neutral: './img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      coachImg.src = map[m] || map.neutral;
    }
  }

  // ---- Event handlers ----
  function onScore(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;

    setText(uiScore, d.score ?? 0);
    setText(uiCombo, d.combo ?? 0);
    setText(uiComboMax, d.comboMax ?? 0);
    setText(uiMiss, d.miss ?? 0);

    setText(uiPlateHave, d.plateHave ?? 0);

    if (Array.isArray(d.gCount)) {
      setText(uiG1, d.gCount[0] ?? 0);
      setText(uiG2, d.gCount[1] ?? 0);
      setText(uiG3, d.gCount[2] ?? 0);
      setText(uiG4, d.gCount[3] ?? 0);
      setText(uiG5, d.gCount[4] ?? 0);
    }

    setText(uiTime, d.timeLeftSec ?? (qs('uiTime') ? qs('uiTime').textContent : 0));

    const fever = Number(d.fever) || 0;
    setBar(uiFeverFill, fever);
    setFeverState(fever);

    const shield = Number(d.shield) || 0;
    setText(uiShieldN, shield);
    if (shield > (onScore._lastShield || 0)) pulseShield();
    onScore._lastShield = shield;

    const acc = Number(d.accuracyGoodPct) || 0;
    const grade = d.grade || 'C';
    setGradeUI(grade, acc);

    if ((Number(d.combo) || 0) >= 6) comboGlow();
  }

  function onQuest(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;

    // goal
    if (d.goal) {
      setText(uiGoalTitle, d.goal.title ?? '—');
      const cur = Number(d.goal.cur) || 0;
      const tar = Number(d.goal.target) || 0;
      setText(uiGoalCount, `${cur}/${tar}`);
      setBar(uiGoalFill, tar ? (cur / tar * 100) : 0);
    }

    // mini
    if (d.mini) {
      setText(uiMiniTitle, d.mini.title ?? '—');

      if (uiMiniCount) {
        // some games send cur/target; plate.safe.js sends miniCleared separately in its own UI
        const cur = Number(d.mini.cur) || 0;
        const tar = Number(d.mini.target) || 0;
        uiMiniCount.textContent = (tar > 0) ? `${cur}/${tar}` : (uiMiniCount.textContent || '0/0');
      }

      const tl = d.mini.timeLeft;
      if (uiMiniTime) {
        if (tl == null || !isFinite(tl)) uiMiniTime.textContent = '--';
        else uiMiniTime.textContent = `${Math.ceil(Number(tl) || 0)}s`;
      }

      if (uiMiniFill) {
        const tar = Number(d.mini.target) || 0;
        const tlN = (tl == null) ? null : Number(tl) || 0;
        const pct = (tar > 0 && tlN != null) ? ((tar - tlN) / tar * 100) : 0;
        setBar(uiMiniFill, pct);
      }
    }
  }

  function onCoach(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;
    setCoach(d.mood, d.msg);
  }

  function onJudge(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;
    if (!d.text) return;
    toast(d.text, d.kind || 'info');
  }

  function onEnd(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;
    const s = d.summary || null;
    if (!s) return;

    // if plate.safe.js already shows result, this is just a safe mirror
    if (resultBackdrop) resultBackdrop.style.display = 'grid';

    setText(rMode, s.runMode || s.mode || 'play');
    setText(rGrade, s.grade || 'C');
    setText(rScore, s.scoreFinal ?? 0);
    setText(rMaxCombo, s.comboMax ?? 0);
    setText(rMiss, s.misses ?? 0);
    setText(rPerfect, (s.fastHitRatePct != null) ? (Math.round(Number(s.fastHitRatePct) || 0) + '%') : '0%');
    setText(rGoals, `${s.goalsCleared ?? 0}/${s.goalsTotal ?? 0}`);
    setText(rMinis, `${s.miniCleared ?? 0}/${s.miniTotal ?? (s.miniCleared ?? 0)}`);

    const plate = s.plate || {};
    const c = Array.isArray(plate.counts) ? plate.counts : [0,0,0,0,0];
    setText(rG1, c[0] ?? 0);
    setText(rG2, c[1] ?? 0);
    setText(rG3, c[2] ?? 0);
    setText(rG4, c[3] ?? 0);
    setText(rG5, c[4] ?? 0);
    setText(rGTotal, plate.total ?? (c.reduce((a,b)=>a+(Number(b)||0),0)));
  }

  function onCelebrate(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.game && d.game !== 'plate') return;

    const kind = String(d.kind || '').toLowerCase();
    if (kind === 'goal') toast('🎯 GOAL COMPLETE!', 'good');
    else if (kind === 'mini') toast('⚡ MINI COMPLETE!', 'warn');
    else if (kind === 'end') toast('🏁 END!', 'good');
  }

  // ---- Wire events ----
  root.addEventListener('hha:score', onScore);
  root.addEventListener('quest:update', onQuest);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:judge', onJudge);
  root.addEventListener('hha:end', onEnd);
  root.addEventListener('hha:celebrate', onCelebrate);

  // ---- Initial state: show coach panel even before first event ----
  // (if plate.safe.js hasn't emitted yet)
  try {
    if (coachPanel && coachMsg && !coachMsg.textContent) {
      coachMsg.textContent = 'พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪';
    }
  } catch (_) {}

})(typeof window !== 'undefined' ? window : globalThis);