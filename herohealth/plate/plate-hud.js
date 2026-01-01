// === /herohealth/plate/plate-hud.js ===
// Plate HUD Binder — PRODUCTION (HHA Standard)
// ✅ Listen: hha:score, quest:update, hha:coach, hha:judge, hha:end
// ✅ Update DOM ids in /herohealth/plate-vr.html (uiScore/uiCombo/uiTime/...)
// ✅ Soft-safe if elements missing
// ✅ Works with play/study + SSS..C grade
// ✅ Optional: show quick judge toast in coachMsg (no extra DOM needed)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // --------------------- helpers ---------------------
  function qs(id){ try{ return doc.getElementById(id); }catch(_){ return null; } }
  function setText(id, v){
    const el = qs(id);
    if (!el) return;
    el.textContent = (v == null) ? '' : String(v);
  }
  function setWidth(id, pct){
    const el = qs(id);
    if (!el) return;
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    el.style.width = `${p}%`;
  }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  // grade color hint (optional via class)
  function applyGradeStyle(grade){
    const el = qs('uiGrade');
    if(!el) return;
    el.classList.remove('g-sss','g-ss','g-s','g-a','g-b','g-c');
    const g = String(grade||'C').toLowerCase();
    if (g === 'sss') el.classList.add('g-sss');
    else if (g === 'ss') el.classList.add('g-ss');
    else if (g === 's') el.classList.add('g-s');
    else if (g === 'a') el.classList.add('g-a');
    else if (g === 'b') el.classList.add('g-b');
    else el.classList.add('g-c');
  }

  // quick coach toast (reuse coachMsg)
  let judgeTimer = 0;
  function coachToast(text, mood){
    const msgEl = qs('coachMsg');
    if (!msgEl) return;
    const prev = msgEl.textContent;
    msgEl.textContent = String(text||'');
    // mood image
    const img = qs('coachImg');
    if(img){
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[mood] || map.neutral;
    }
    clearTimeout(judgeTimer);
    judgeTimer = setTimeout(()=>{ msgEl.textContent = prev; }, 900);
  }

  // --------------------- main handlers ---------------------
  function onScore(e){
    const d = (e && e.detail) ? e.detail : {};
    if (d.game && String(d.game) !== 'plate') return; // ignore other games

    // numbers
    const score = Number(d.score) || 0;
    const combo = Number(d.combo) || 0;
    const comboMax = Number(d.comboMax) || 0;
    const miss = Number(d.miss) || 0;
    const tLeft = (d.timeLeftSec != null) ? Math.max(0, Math.ceil(Number(d.timeLeftSec)||0)) : null;

    // plate + groups
    const plateHave = (d.plateHave != null) ? Number(d.plateHave)||0 : null;
    const gCount = Array.isArray(d.gCount) ? d.gCount : null;

    // fever + shield
    const fever = clamp(d.fever, 0, 100);
    const shield = clamp(d.shield, 0, 99);

    // accuracy + grade
    const acc = (d.accuracyGoodPct != null) ? Number(d.accuracyGoodPct)||0 : 0;
    const grade = d.grade || 'C';

    setText('uiScore', score);
    setText('uiCombo', combo);
    setText('uiComboMax', comboMax);
    setText('uiMiss', miss);

    if (plateHave != null) setText('uiPlateHave', plateHave);

    if (gCount){
      setText('uiG1', Number(gCount[0])||0);
      setText('uiG2', Number(gCount[1])||0);
      setText('uiG3', Number(gCount[2])||0);
      setText('uiG4', Number(gCount[3])||0);
      setText('uiG5', Number(gCount[4])||0);
    }

    setText('uiAcc', `${Math.round(acc)}%`);
    setText('uiGrade', grade);
    applyGradeStyle(grade);

    if (tLeft != null) setText('uiTime', tLeft);

    setWidth('uiFeverFill', fever);
    setText('uiShieldN', shield);
  }

  function onQuest(e){
    const d = (e && e.detail) ? e.detail : {};
    if (d.game && String(d.game) !== 'plate') return;

    const goal = d.goal || null;
    const mini = d.mini || null;

    if (goal){
      setText('uiGoalTitle', goal.title || '—');
      const cur = Number(goal.cur)||0;
      const tar = Math.max(0, Number(goal.target)||0);
      setText('uiGoalCount', `${cur}/${tar}`);
      const pct = (tar > 0) ? (cur/tar*100) : 0;
      setWidth('uiGoalFill', pct);
    } else {
      setText('uiGoalTitle', '—');
      setText('uiGoalCount', '0/0');
      setWidth('uiGoalFill', 0);
    }

    if (mini){
      setText('uiMiniTitle', mini.title || '—');
      // uiMiniCount is handled by game, but we keep safe fallback
      if (mini.timeLeft == null){
        setText('uiMiniTime', '--');
        setWidth('uiMiniFill', 0);
      } else {
        const tl = Math.max(0, Number(mini.timeLeft)||0);
        setText('uiMiniTime', `${Math.ceil(tl)}s`);
        const tar = Math.max(0, Number(mini.target)||0);
        const pct = (tar > 0) ? ((tar - tl)/tar*100) : 0;
        setWidth('uiMiniFill', pct);
      }
    } else {
      setText('uiMiniTitle', '—');
      setText('uiMiniTime', '--');
      setWidth('uiMiniFill', 0);
    }
  }

  function onCoach(e){
    const d = (e && e.detail) ? e.detail : {};
    if (d.game && String(d.game) !== 'plate') return;

    const msg = d.msg || '';
    const mood = d.mood || 'neutral';

    const cm = qs('coachMsg');
    if (cm) cm.textContent = String(msg);

    const img = qs('coachImg');
    if (img){
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[mood] || map.neutral;
    }
  }

  function onJudge(e){
    const d = (e && e.detail) ? e.detail : {};
    if (d.game && String(d.game) !== 'plate') return;

    const text = d.text || '';
    const kind = String(d.kind||'info').toLowerCase();

    // map kind -> mood
    const mood =
      (kind === 'good' || kind === 'ok') ? 'happy' :
      (kind === 'bad' || kind === 'fail' || kind === 'danger') ? 'sad' :
      (kind === 'fever') ? 'fever' :
      'neutral';

    // quick toast
    coachToast(text, mood);
  }

  function onEnd(e){
    const d = (e && e.detail) ? e.detail : {};
    if (d.game && String(d.game) !== 'plate') return;
    const s = d.summary || null;
    if (!s) return;

    // If result overlay exists, game will fill it.
    // But we can ensure some text consistency in case of timing.
    setText('rMode', s.runMode || 'play');
    setText('rGrade', s.grade || 'C');
    setText('rScore', s.scoreFinal || 0);
    setText('rMaxCombo', s.comboMax || 0);
    setText('rMiss', s.misses || 0);
    setText('rPerfect', (s.fastHitRatePct != null) ? (Math.round(Number(s.fastHitRatePct)||0) + '%') : '0%');
    setText('rGoals', `${s.goalsCleared||0}/${s.goalsTotal||0}`);
    setText('rMinis', `${s.miniCleared||0}/${s.miniTotal||0}`);

    if (s.plate && Array.isArray(s.plate.counts)){
      setText('rG1', s.plate.counts[0]||0);
      setText('rG2', s.plate.counts[1]||0);
      setText('rG3', s.plate.counts[2]||0);
      setText('rG4', s.plate.counts[3]||0);
      setText('rG5', s.plate.counts[4]||0);
      setText('rGTotal', s.plate.total||0);
    }
  }

  // --------------------- bind once ---------------------
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    root.addEventListener('hha:score', onScore);
    root.addEventListener('quest:update', onQuest);
    root.addEventListener('hha:coach', onCoach);
    root.addEventListener('hha:judge', onJudge);
    root.addEventListener('hha:end', onEnd);

    // optional: add grade style css quickly (no external dep)
    const cssId = 'plate-hud-grade-css';
    if (!doc.getElementById(cssId)){
      const st = doc.createElement('style');
      st.id = cssId;
      st.textContent = `
        #uiGrade.g-sss{ color: rgba(250,204,21,.98); text-shadow:0 0 18px rgba(250,204,21,.20); }
        #uiGrade.g-ss { color: rgba(56,189,248,.98); text-shadow:0 0 18px rgba(56,189,248,.18); }
        #uiGrade.g-s  { color: rgba(167,139,250,.98); text-shadow:0 0 18px rgba(167,139,250,.18); }
        #uiGrade.g-a  { color: rgba(34,197,94,.98);  text-shadow:0 0 18px rgba(34,197,94,.16); }
        #uiGrade.g-b  { color: rgba(245,158,11,.98); text-shadow:0 0 18px rgba(245,158,11,.16); }
        #uiGrade.g-c  { color: rgba(239,68,68,.98);  text-shadow:0 0 18px rgba(239,68,68,.14); }
      `;
      doc.head.appendChild(st);
    }
  }

  if (doc.readyState === 'loading'){
    doc.addEventListener('DOMContentLoaded', bind, { once:true });
  } else {
    bind();
  }

})(typeof window !== 'undefined' ? window : globalThis);