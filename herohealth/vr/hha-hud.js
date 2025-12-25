// === /herohealth/vr/hha-hud.js ===
// HeroHealth — HUD Binder (A-COMPAT for goodjunk-vr.html IDs)
// ✅ Works with IDs: hhaScore/hhaCombo/hhaMiss/hhaTime/hhaGrade
// ✅ Quest IDs: qGoalTitle/qGoalCur/qGoalMax/qGoalFill + qMiniTitle/qMiniCur/qMiniMax/qMiniFill + qMiniTLeft + hhaQuestMeta
// ✅ Coach IDs: hhaCoachLine/hhaCoachSub/hhaCoachImg
// ✅ Events: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:rank, hha:end
// ✅ VR: when enter-vr, stack panels to top-left (keep FeverUI top-right)
// ✅ Safe: missing elements => skip, no double bind

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;
  if (root.__HHA_HUD_BOUND_A__) return;
  root.__HHA_HUD_BOUND_A__ = true;

  // ---------------- helpers ----------------
  const $ = (id) => { try { return doc.getElementById(id); } catch { return null; } };
  const qs = (sel) => { try { return doc.querySelector(sel); } catch { return null; } };
  const clamp = (v, a, b) => { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); };
  const s = (v) => String(v ?? '').trim();
  const setTxt = (el, v) => { if (!el) return; try { el.textContent = String(v ?? ''); } catch {} };
  const setW = (el, pct) => { if (!el) return; try { el.style.width = `${clamp(pct, 0, 100)}%`; } catch {} };

  function pctFrom(cur, max){
    const c = Number(cur) || 0;
    const m = Number(max) || 0;
    if (m <= 0) return 0;
    return clamp((c / m) * 100, 0, 100);
  }

  function inferMood(text){
    const t = String(text || '').toLowerCase();
    if (t.includes('fever') || t.includes('🔥')) return 'fever';
    if (t.includes('เยี่ยม') || t.includes('สำเร็จ') || t.includes('ผ่าน') || t.includes('🎉') || t.includes('⭐')) return 'happy';
    if (t.includes('พลาด') || t.includes('โดน') || t.includes('miss') || t.includes('😵') || t.includes('⚠️')) return 'sad';
    return 'neutral';
  }

  // ---------------- elements (A HTML) ----------------
  // Top KPIs
  const elScore = $('hhaScore');
  const elCombo = $('hhaCombo');
  const elMiss  = $('hhaMiss');
  const elTime  = $('hhaTime');
  const elGrade = $('hhaGrade');

  // Quest
  const elQuestMeta = $('hhaQuestMeta');
  const elGoalTitle = $('qGoalTitle');
  const elGoalCur   = $('qGoalCur');
  const elGoalMax   = $('qGoalMax');
  const elGoalFill  = $('qGoalFill');

  const elMiniTitle = $('qMiniTitle');
  const elMiniCur   = $('qMiniCur');
  const elMiniMax   = $('qMiniMax');
  const elMiniFill  = $('qMiniFill');
  const elMiniTLeft = $('qMiniTLeft');

  // Coach
  const elCoachImg  = $('hhaCoachImg');
  const elCoachLine = $('hhaCoachLine');
  const elCoachSub  = $('hhaCoachSub');

  // Panels (for VR layout)
  const elTopbar = qs('.topbar');
  const elQuestPanel = qs('.quest');
  const elCoachPanel = qs('.coach');

  // ---------------- coach images ----------------
  const COACH_IMG = {
    fever:   './img/coach-fever.png',
    happy:   './img/coach-happy.png',
    neutral: './img/coach-neutral.png',
    sad:     './img/coach-sad.png'
  };
  let lastMood = 'neutral';
  function setCoachMood(mood){
    const m = String(mood || '').toLowerCase();
    const pick =
      (m.includes('fever') || m.includes('fire') || m.includes('hot') || m.includes('🔥')) ? 'fever' :
      (m.includes('happy') || m.includes('win')  || m.includes('good') || m.includes('success') || m.includes('🎉') || m.includes('⭐')) ? 'happy' :
      (m.includes('sad')   || m.includes('miss') || m.includes('bad')  || m.includes('fail') || m.includes('😵') || m.includes('⚠️')) ? 'sad' :
      'neutral';

    if (pick === lastMood) return;
    lastMood = pick;
    if (elCoachImg) {
      try { elCoachImg.src = COACH_IMG[pick] || COACH_IMG.neutral; } catch {}
    }
  }

  function showCoach(text, mood){
    if (text != null) setTxt(elCoachLine, text);
    setCoachMood(mood || inferMood(text));
    // sub line stays unless provided
  }

  // ---------------- tiny CSS fix (VR + keep FeverUI on top-right) ----------------
  (function injectCSS(){
    if (doc.getElementById('hha-hud-a-css')) return;
    const st = doc.createElement('style');
    st.id = 'hha-hud-a-css';
    st.textContent = `
      body.hha-vr .topbar{
        left:12px !important;
        right:auto !important;
        width: min(560px, 94vw) !important;
      }
      body.hha-vr .quest{
        left:12px !important;
        bottom:auto !important;
        top: calc(env(safe-area-inset-top, 0px) + 84px) !important;
        width: min(560px, 94vw) !important;
        opacity:.98;
      }
      body.hha-vr .coach{
        left:12px !important;
        right:auto !important;
        bottom:auto !important;
        top: calc(env(safe-area-inset-top, 0px) + 260px) !important;
        width: min(560px, 94vw) !important;
        opacity:.98;
      }
      /* FeverUI stays top-right (just a bit safer in VR) */
      body.hha-vr .hha-fever-wrap{
        top: calc(env(safe-area-inset-top, 0px) + 8px) !important;
        right: 12px !important;
        z-index: 9999 !important;
      }
    `;
    (doc.head || doc.documentElement).appendChild(st);
  })();

  // ---------------- state ----------------
  let score=0, combo=0, miss=0, timeSec=0, grade='—';

  // quest summary meta
  let goalsCleared=0, goalsTotal=0, minisCleared=0, miniCount=0;

  // ---------------- render ----------------
  function renderTop(){
    setTxt(elScore, score|0);
    setTxt(elCombo, combo|0);
    setTxt(elMiss,  miss|0);
    setTxt(elTime,  timeSec|0);
    if (elGrade) setTxt(elGrade, grade || '—');
  }

  function renderQuest(goal, mini){
    // meta line
    const metaBits = [];
    if (goalsTotal > 0) metaBits.push(`Goals ${goalsCleared|0}/${goalsTotal|0}`);
    if (minisCleared > 0 || miniCount > 0) metaBits.push(`Minis ✓${minisCleared|0}`);
    setTxt(elQuestMeta, metaBits.length ? metaBits.join(' • ') : '—');

    // goal
    if (goal){
      setTxt(elGoalTitle, `Goal: ${goal.title || goal.label || '—'}`);
      setTxt(elGoalCur, goal.cur ?? goal.prog ?? 0);
      setTxt(elGoalMax, goal.target ?? goal.max ?? 0);
      setW(elGoalFill, pctFrom(goal.cur ?? goal.prog ?? 0, goal.target ?? goal.max ?? 0));
    } else {
      setTxt(elGoalTitle, 'Goal: —');
      setTxt(elGoalCur, 0);
      setTxt(elGoalMax, 0);
      setW(elGoalFill, 0);
    }

    // mini
    if (mini){
      setTxt(elMiniTitle, `Mini: ${mini.title || mini.label || '—'}`);
      setTxt(elMiniCur, mini.cur ?? mini.prog ?? 0);
      setTxt(elMiniMax, mini.target ?? mini.max ?? 0);
      setW(elMiniFill, pctFrom(mini.cur ?? mini.prog ?? 0, mini.target ?? mini.max ?? 0));

      const tl = (mini.tLeft != null) ? mini.tLeft : (mini.left != null ? mini.left : null);
      setTxt(elMiniTLeft, (tl == null) ? '—' : String(Math.max(0, tl|0)));
    } else {
      setTxt(elMiniTitle, 'Mini: —');
      setTxt(elMiniCur, 0);
      setTxt(elMiniMax, 0);
      setW(elMiniFill, 0);
      setTxt(elMiniTLeft, '—');
    }
  }

  // ---------------- quest normalize (nested + flat) ----------------
  function normObj(obj){
    if (!obj || typeof obj !== 'object') return null;
    const title = s(obj.title ?? obj.label ?? obj.name ?? '');
    const cur = (obj.cur != null) ? obj.cur : (obj.prog != null ? obj.prog : 0);
    const max = (obj.target != null) ? obj.target : (obj.max != null ? obj.max : 0);
    const out = { title, cur: Number(cur)||0, target: Number(max)||0 };
    if (obj.tLeft != null) out.tLeft = obj.tLeft;
    if (obj.windowSec != null) out.windowSec = obj.windowSec;
    if (obj.hint != null) out.hint = obj.hint;
    return title ? out : null;
  }

  function normFromFlat(prefix, d){
    // supports: goalTitle/goalCur/goalTarget|goalMax, miniTitle/miniCur/miniTarget|miniMax
    const Title = s(d[`${prefix}Title`]);
    if (!Title) return null;
    const Cur = Number(d[`${prefix}Cur`] ?? 0) || 0;
    const Max = Number(
      d[`${prefix}Target`] ?? d[`${prefix}Max`] ?? d[`${prefix}TargetOrMax`] ?? 0
    ) || 0;

    const out = { title: Title, cur: Cur, target: Max };
    if (prefix === 'mini'){
      if (d.miniTLeft != null) out.tLeft = d.miniTLeft;
      if (d.miniWindowSec != null) out.windowSec = d.miniWindowSec;
    }
    return out;
  }

  // ---------------- VR layout bind ----------------
  function applyVR(on){
    try { doc.body.classList.toggle('hha-vr', !!on); } catch {}
  }
  (function bindAFRAMEVR(){
    const scene = qs('a-scene');
    if (!scene) return;
    try{
      scene.addEventListener('enter-vr', ()=> applyVR(true));
      scene.addEventListener('exit-vr',  ()=> applyVR(false));
    }catch{}
  })();

  // ---------------- events ----------------
  root.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};

    if (d.score != null) score = d.score|0;

    // Combo (A UI label = "Combo" -> prefer current combo, fallback comboMax)
    if (d.combo != null) combo = d.combo|0;
    else if (d.comboMax != null) combo = d.comboMax|0;

    if (d.misses != null) miss = d.misses|0;

    // some engines include time in score payload
    if (d.sec != null) timeSec = Math.max(0, d.sec|0);
    if (d.left != null) timeSec = Math.max(0, d.left|0);

    renderTop();
  });

  root.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const sec = (d.sec != null) ? d.sec : (d.left != null ? d.left : null);
    if (sec != null){
      timeSec = Math.max(0, sec|0);
      renderTop();
    }
  });

  root.addEventListener('hha:rank', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const g = s(d.grade).toUpperCase();
    if (g) { grade = g; renderTop(); }
  });

  root.addEventListener('quest:update', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};

    const metaIn = (d.meta && typeof d.meta === 'object') ? d.meta : null;
    goalsCleared = Number(d.goalsCleared ?? metaIn?.goalsCleared ?? 0) || 0;
    goalsTotal   = Number(d.goalsTotal   ?? metaIn?.goalsTotal   ?? metaIn?.goalIndex ?? 0) || 0;
    minisCleared = Number(d.minisCleared ?? metaIn?.minisCleared ?? 0) || 0;
    miniCount    = Number(d.miniCount    ?? metaIn?.miniCount    ?? 0) || 0;

    const goal = normObj(d.goal || d.main) || normFromFlat('goal', d);
    const mini = normObj(d.mini) || normFromFlat('mini', d);

    renderQuest(goal, mini);
  });

  root.addEventListener('hha:coach', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const text = (d.text != null) ? String(d.text) : '';
    const mood = d.mood || inferMood(text);
    if (text) setTxt(elCoachLine, text);
    if (d.sub != null) setTxt(elCoachSub, d.sub);
    setCoachMood(mood);
  });

  root.addEventListener('hha:judge', (ev)=>{
    // (A HTML ไม่มี judge element) -> ใช้ coach line เป็น fallback
    const d = (ev && ev.detail) ? ev.detail : {};
    const txt = d.label ?? d.text ?? d.judge ?? '';
    const t = s(txt);
    if (!t) return;
    // โผล่สั้น ๆ ใน coach line
    showCoach(t, inferMood(t));
  });

  root.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.scoreFinal != null) score = d.scoreFinal|0;
    if (d.comboMax != null) combo = d.comboMax|0;
    if (d.misses != null) miss = d.misses|0;
    const g = s(d.grade).toUpperCase();
    if (g) grade = g;
    renderTop();

    // final coach mood
    if (g === 'SSS' || g === 'SS' || g === 'S') setCoachMood('happy');
    else if ((miss|0) >= 8) setCoachMood('sad');
    else setCoachMood('neutral');
  });

  // initial paint
  renderTop();
  renderQuest(null, null);

})(window);