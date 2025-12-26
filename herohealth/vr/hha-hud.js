// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR) — FULL (PATCH)
// ✅ listens: hha:score, hha:time, quest:update, hha:coach, hha:end, hha:fever
// ✅ updates IDs used in your GoodJunk/Plate/Hydration/Groups HTML
// ✅ safe: no-throw if elements missing, avoids double-bind

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // prevent double bind
  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  const $ = (id) => doc.getElementById(id);

  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function pct(cur, max) {
    cur = Number(cur) || 0;
    max = Number(max) || 0;
    if (max <= 0) return 0;
    return clamp((cur / max) * 100, 0, 100);
  }
  function setText(id, v) {
    const el = $(id);
    if (!el) return;
    el.textContent = (v == null) ? '' : String(v);
  }
  function setHTML(id, v) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = (v == null) ? '' : String(v);
  }
  function setWidth(id, percent) {
    const el = $(id);
    if (!el) return;
    el.style.width = `${clamp(percent, 0, 100).toFixed(1)}%`;
  }

  // --- elements (optional) ---
  const elScore = $('hhaScore');
  const elCombo = $('hhaCombo');
  const elMiss  = $('hhaMiss');
  const elTime  = $('hhaTime');
  const elGrade = $('hhaGrade');

  const elCoachImg  = $('hhaCoachImg');
  const elCoachLine = $('hhaCoachLine');
  const elCoachSub  = $('hhaCoachSub');

  const elQuestMeta = $('hhaQuestMeta');

  // Goal / Mini
  const elGoalTitle = $('qGoalTitle');
  const elGoalCur   = $('qGoalCur');
  const elGoalMax   = $('qGoalMax');
  const elGoalFill  = $('qGoalFill');

  const elMiniTitle = $('qMiniTitle');
  const elMiniCur   = $('qMiniCur');
  const elMiniMax   = $('qMiniMax');
  const elMiniFill  = $('qMiniFill');

  const elMiniTLeft = $('qMiniTLeft');

  // If quest panel exists, set initial placeholder (so it doesn't stay 0/0 forever)
  (function initQuestPlaceholders(){
    if (elGoalTitle) elGoalTitle.textContent = 'Goal: กำลังโหลด…';
    if (elMiniTitle) elMiniTitle.textContent = 'Mini: กำลังโหลด…';
    if (elGoalCur) elGoalCur.textContent = '0';
    if (elGoalMax) elGoalMax.textContent = '0';
    if (elMiniCur) elMiniCur.textContent = '0';
    if (elMiniMax) elMiniMax.textContent = '0';
    if (elGoalFill) elGoalFill.style.width = '0%';
    if (elMiniFill) elMiniFill.style.width = '0%';
    if (elMiniTLeft) elMiniTLeft.textContent = '—';
    if (elQuestMeta) elQuestMeta.textContent = '—';
  })();

  // ---------------------------
  // Handlers
  // ---------------------------

  function onScore(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if (elScore) elScore.textContent = String(d.score ?? 0);
    if (elCombo) elCombo.textContent = String(d.combo ?? 0);
    if (elMiss)  elMiss.textContent  = String(d.misses ?? 0);

    // Some games may pass grade continuously
    if (d.grade != null && elGrade) elGrade.textContent = String(d.grade);

    // optional: quick meta in quest panel
    if (elQuestMeta) {
      const diff = (d.diff != null) ? String(d.diff) : '';
      const ch   = (d.challenge != null) ? String(d.challenge) : '';
      const fever = (d.fever != null) ? `fever ${d.fever}%` : '';
      const shield = (d.shield != null) ? `sh ${d.shield}` : '';
      const parts = [diff && `โหมด ${diff}`, ch && `• ${ch}`, fever && `• ${fever}`, shield && `• ${shield}`].filter(Boolean);
      if (parts.length) elQuestMeta.textContent = parts.join(' ');
    }
  }

  function onTime(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    // accept multiple field names
    const t = (d.timeLeft != null) ? d.timeLeft :
              (d.timeLeftSec != null) ? Math.ceil(d.timeLeftSec) :
              (d.t != null) ? d.t : null;
    if (t != null && elTime) elTime.textContent = String(Math.max(0, Number(t) || 0));
  }

  function onCoach(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if (elCoachLine && d.line != null) elCoachLine.textContent = String(d.line);
    if (elCoachSub && d.sub != null)  elCoachSub.textContent  = String(d.sub);

    // mood -> image switch if possible
    if (elCoachImg && d.mood) {
      const mood = String(d.mood).toLowerCase();
      // expected filenames in your project:
      // coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png
      let src = './img/coach-neutral.png';
      if (mood.includes('happy')) src = './img/coach-happy.png';
      else if (mood.includes('sad')) src = './img/coach-sad.png';
      else if (mood.includes('fever') || mood.includes('fire')) src = './img/coach-fever.png';
      elCoachImg.src = src;
    }
  }

  function onQuest(ev){
    const d = (ev && ev.detail) ? ev.detail : {};

    // normalize goal
    const gTitle = d.goalTitle ?? d.goal ?? d.goalName ?? 'Goal: —';
    const gCur   = (d.goalCur != null) ? d.goalCur : (d.gCur != null ? d.gCur : 0);
    const gMax   = (d.goalMax != null) ? d.goalMax : (d.gMax != null ? d.gMax : 0);

    // normalize mini
    const mTitle = d.miniTitle ?? d.mini ?? d.miniName ?? 'Mini: —';
    const mCur   = (d.miniCur != null) ? d.miniCur : (d.mCur != null ? d.mCur : 0);
    const mMax   = (d.miniMax != null) ? d.miniMax : (d.mMax != null ? d.mMax : 0);

    if (elGoalTitle) elGoalTitle.textContent = String(gTitle);
    if (elGoalCur)   elGoalCur.textContent   = String(gCur ?? 0);
    if (elGoalMax)   elGoalMax.textContent   = String(gMax ?? 0);
    if (elGoalFill)  elGoalFill.style.width  = `${pct(gCur, gMax).toFixed(1)}%`;

    if (elMiniTitle) elMiniTitle.textContent = String(mTitle);
    if (elMiniCur)   elMiniCur.textContent   = String(mCur ?? 0);
    if (elMiniMax)   elMiniMax.textContent   = String(mMax ?? 0);
    if (elMiniFill)  elMiniFill.style.width  = `${pct(mCur, mMax).toFixed(1)}%`;

    // mini timer
    if (elMiniTLeft) {
      const tLeft = (d.miniTLeft != null) ? d.miniTLeft :
                    (d.tLeft != null) ? d.tLeft : null;
      elMiniTLeft.textContent = (tLeft == null || tLeft === '') ? '—' : String(tLeft);
    }

    // meta: overall progress
    if (elQuestMeta) {
      const gc = (d.goalsCleared != null) ? d.goalsCleared : null;
      const gt = (d.goalsTotal != null) ? d.goalsTotal : null;
      const mc = (d.minisCleared != null) ? d.minisCleared : null;
      const mt = (d.minisTotal != null) ? d.minisTotal : null;

      const parts = [];
      if (gc != null && gt != null) parts.push(`Goals ${gc}/${gt}`);
      if (mc != null && mt != null) parts.push(`Minis ${mc}/${mt}`);
      if (d.reason) parts.push(String(d.reason));
      if (parts.length) elQuestMeta.textContent = parts.join(' • ');
    }
  }

  function onEnd(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    if (elGrade && d.grade != null) elGrade.textContent = String(d.grade);

    // freeze final numbers if present
    if (elScore && (d.scoreFinal != null || d.score != null)) elScore.textContent = String(d.scoreFinal ?? d.score);
    if (elCombo && d.comboMax != null) elCombo.textContent = String(d.comboMax);
    if (elMiss && d.misses != null) elMiss.textContent = String(d.misses);
  }

  // ---------------------------
  // Bind listeners
  // ---------------------------
  root.addEventListener('hha:score', onScore);
  root.addEventListener('hha:time', onTime);
  root.addEventListener('quest:update', onQuest);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:end', onEnd);

  // for debugging: show that binder loaded
  try {
    root.dispatchEvent(new CustomEvent('hha:hud_ready', { detail: { ts: Date.now() } }));
  } catch (_) {}

})(typeof window !== 'undefined' ? window : globalThis);