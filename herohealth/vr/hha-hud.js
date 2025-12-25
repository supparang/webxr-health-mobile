// === /herohealth/vr/hha-hud.js ===
// HeroHealth — HUD Binder (for NEW goodjunk-vr.html IDs)
// ✅ Supports: hha:score / hha:time / quest:update / hha:coach / hha:rank / hha:end
// ✅ Uses NEW HTML IDs: hhaScore/hhaCombo/hhaMiss/hhaTime/hhaGrade + quest + coach + end overlay
// ✅ Does NOT create Fever UI (leave to ./vr/ui-fever.js) -> prevents FEVER duplicate
// ✅ Safe: missing elements -> skip, guard bind

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;
  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  // ---------- helpers ----------
  const $id = (id) => doc.getElementById(id);
  const setText = (el, v) => { if (el) el.textContent = String(v ?? ''); };
  const setStyle = (el, k, v) => { if (el) el.style[k] = v; };
  const clamp = (v, a, b) => { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); };
  const sstr = (v) => String(v ?? '').trim();

  function pctFrom(cur, max){
    const c = Number(cur) || 0;
    const m = Number(max) || 0;
    if (m <= 0) return 0;
    return clamp((c / m) * 100, 0, 100);
  }

  // ---------- NEW HTML elements ----------
  // Topbar
  const elScore = $id('hhaScore');
  const elCombo = $id('hhaCombo'); // (comboMax or current, your engine decides)
  const elMiss  = $id('hhaMiss');
  const elTime  = $id('hhaTime');
  const elGrade = $id('hhaGrade');

  // Quest panel
  const qGoalTitle = $id('qGoalTitle');
  const qGoalCur   = $id('qGoalCur');
  const qGoalMax   = $id('qGoalMax');
  const qGoalFill  = $id('qGoalFill');

  const qMiniTitle = $id('qMiniTitle');
  const qMiniCur   = $id('qMiniCur');
  const qMiniMax   = $id('qMiniMax');
  const qMiniFill  = $id('qMiniFill');
  const qMiniTLeft = $id('qMiniTLeft');

  const qMeta = $id('hhaQuestMeta');

  // Coach
  const coachImg = $id('hhaCoachImg');
  const coachLine = $id('hhaCoachLine');
  const coachSub  = $id('hhaCoachSub');

  const COACH_IMG = {
    fever:   './img/coach-fever.png',
    happy:   './img/coach-happy.png',
    neutral: './img/coach-neutral.png',
    sad:     './img/coach-sad.png'
  };
  let coachMood = 'neutral';
  function setCoachMood(m){
    const pick =
      (String(m||'').includes('fever') || String(m||'').includes('🔥')) ? 'fever' :
      (String(m||'').includes('happy') || String(m||'').includes('🎉') || String(m||'').includes('⭐')) ? 'happy' :
      (String(m||'').includes('sad')   || String(m||'').includes('😵') || String(m||'').includes('⚠️')) ? 'sad' :
      'neutral';

    if (pick === coachMood) return;
    coachMood = pick;
    if (coachImg) coachImg.src = COACH_IMG[pick] || COACH_IMG.neutral;
  }

  // End overlay (your HTML fallback)
  const endBox = $id('hhaEnd');
  const endGrade = $id('endGrade');
  const endScore = $id('endScore');
  const endComboMax = $id('endComboMax');
  const endMiss = $id('endMiss');
  const endGoals = $id('endGoals');
  const endGoalsTotal = $id('endGoalsTotal');
  const endMinis = $id('endMinis');
  const endMinisTotal = $id('endMinisTotal');
  const endAcc = $id('endAcc');

  // ---------- state ----------
  let sScore = 0, sComboMax = 0, sMiss = 0, sTime = 0;
  let sGrade = '—';

  let goal = null; // {title, cur, max}
  let mini = null; // {title, cur, max, tLeft?}

  // ---------- render ----------
  function renderTop(){
    setText(elScore, sScore|0);
    setText(elCombo, sComboMax|0);
    setText(elMiss,  sMiss|0);
    setText(elTime,  sTime|0);
    if (elGrade) setText(elGrade, sGrade || '—');
  }

  function renderQuest(){
    if (goal){
      setText(qGoalTitle, `Goal: ${goal.title || '—'}`);
      setText(qGoalCur, goal.cur|0);
      setText(qGoalMax, goal.max|0);
      if (qGoalFill) setStyle(qGoalFill, 'width', `${pctFrom(goal.cur, goal.max)}%`);
    } else {
      setText(qGoalTitle, 'Goal: —');
      setText(qGoalCur, 0);
      setText(qGoalMax, 0);
      if (qGoalFill) setStyle(qGoalFill, 'width', `0%`);
    }

    if (mini){
      setText(qMiniTitle, `Mini: ${mini.title || '—'}`);
      setText(qMiniCur, mini.cur|0);
      setText(qMiniMax, mini.max|0);
      if (qMiniFill) setStyle(qMiniFill, 'width', `${pctFrom(mini.cur, mini.max)}%`);
      if (qMiniTLeft) setText(qMiniTLeft, (mini.tLeft != null) ? String(Math.max(0, mini.tLeft|0)) : '—');
    } else {
      setText(qMiniTitle, 'Mini: —');
      setText(qMiniCur, 0);
      setText(qMiniMax, 0);
      if (qMiniFill) setStyle(qMiniFill, 'width', `0%`);
      if (qMiniTLeft) setText(qMiniTLeft, '—');
    }
  }

  function openEnd(d){
    if (!endBox) return;
    setText(endGrade, d.grade ?? sGrade ?? '—');
    setText(endScore, d.scoreFinal ?? d.score ?? sScore ?? 0);
    setText(endComboMax, d.comboMax ?? sComboMax ?? 0);
    setText(endMiss, d.misses ?? sMiss ?? 0);

    setText(endGoals, d.goalsCleared ?? 0);
    setText(endGoalsTotal, d.goalsTotal ?? 0);
    setText(endMinis, d.minisCleared ?? d.miniCleared ?? 0);
    setText(endMinisTotal, d.minisTotal ?? d.miniTotal ?? 0);
    setText(endAcc, d.accuracy ?? 0);

    endBox.style.display = 'flex';
  }

  // ---------- normalize quest:update ----------
  function normBlock(obj, flatTitle, flatCur, flatMax){
    if (obj && typeof obj === 'object'){
      const title = sstr(obj.title ?? obj.label ?? '');
      const cur = Number(obj.cur ?? obj.prog ?? 0) || 0;
      const max = Number(obj.target ?? obj.max ?? 0) || 0;
      if (title) return { title, cur, max, tLeft: obj.tLeft, windowSec: obj.windowSec };
    }
    const t = sstr(flatTitle);
    if (!t) return null;
    return { title: t, cur: Number(flatCur||0)||0, max: Number(flatMax||0)||0 };
  }

  // ---------- events ----------
  root.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.score != null) sScore = d.score|0;

    // prefer comboMax if present, else keep max seen of combo
    if (d.comboMax != null) sComboMax = d.comboMax|0;
    else if (d.combo != null) sComboMax = Math.max(sComboMax|0, d.combo|0);

    if (d.misses != null) sMiss = d.misses|0;

    // optional: some engines send {sec} here
    if (d.sec != null) sTime = d.sec|0;

    renderTop();
  });

  root.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const sec = (d.sec != null) ? d.sec : (d.left != null ? d.left : null);
    if (sec != null){
      sTime = Math.max(0, sec|0);
      renderTop();
    }
  });

  root.addEventListener('hha:rank', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const g = sstr(d.grade).toUpperCase();
    if (g) sGrade = g;
    renderTop();
  });

  root.addEventListener('quest:update', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};

    // meta text (optional)
    if (qMeta){
      const parts = [];
      if (d.goalsCleared != null && d.goalsTotal != null) parts.push(`Goals ${d.goalsCleared}/${d.goalsTotal}`);
      if (d.minisCleared != null) parts.push(`Minis ✓${d.minisCleared}`);
      setText(qMeta, parts.join(' • ') || '—');
    }

    // nested or flat shapes
    const gFlatMax = (d.goalTarget != null) ? d.goalTarget : (d.goalMax != null ? d.goalMax : d.goalTargetOrMax);
    const mFlatMax = (d.miniTarget != null) ? d.miniTarget : (d.miniMax != null ? d.miniMax : d.miniTargetOrMax);

    goal = normBlock(d.goal ?? d.main, d.goalTitle, d.goalCur, gFlatMax);
    mini = normBlock(d.mini, d.miniTitle, d.miniCur, mFlatMax);

    // flat mini time
    if (mini){
      if (mini.tLeft == null && d.miniTLeft != null) mini.tLeft = d.miniTLeft;
      if (mini.windowSec == null && d.miniWindowSec != null) mini.windowSec = d.miniWindowSec;
    }

    renderQuest();
  });

  root.addEventListener('hha:coach', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.text != null) setText(coachLine, d.text);
    if (d.sub != null)  setText(coachSub, d.sub);

    // infer mood if not provided
    let mood = d.mood;
    if (!mood && d.text){
      const t = String(d.text).toLowerCase();
      if (t.includes('fever') || t.includes('🔥')) mood = 'fever';
      else if (t.includes('ผ่าน') || t.includes('เยี่ยม') || t.includes('สำเร็จ') || t.includes('🎉') || t.includes('⭐')) mood = 'happy';
      else if (t.includes('miss') || t.includes('พลาด') || t.includes('โดน') || t.includes('😵') || t.includes('⚠️')) mood = 'sad';
      else mood = 'neutral';
    }
    setCoachMood(mood || 'neutral');
  });

  root.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.scoreFinal != null) sScore = d.scoreFinal|0;
    if (d.comboMax != null) sComboMax = d.comboMax|0;
    if (d.misses != null) sMiss = d.misses|0;
    if (d.grade != null) sGrade = String(d.grade).toUpperCase();

    renderTop();
    openEnd(d);

    // coach mood at end
    if (sGrade === 'SSS' || sGrade === 'SS' || sGrade === 'S') setCoachMood('happy');
    else if ((d.misses|0) >= 8) setCoachMood('sad');
    else setCoachMood('neutral');
  });

  // ---------- initial paint ----------
  renderTop();
  renderQuest();
  if (coachImg && !coachImg.src) coachImg.src = COACH_IMG.neutral;

})(window);