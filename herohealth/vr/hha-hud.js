// === /herohealth/vr/hha-hud.js ===
// HeroHealth — Global HUD Binder (DOM)
// Listens: hha:score, hha:time, quest:update, hha:coach, hha:end

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const $ = (id) => doc.getElementById(id);

  function setText(id, v){
    const el = $(id);
    if (!el) return;
    el.textContent = (v == null) ? '—' : String(v);
  }

  function onScore(e){
    const d = (e && e.detail) ? e.detail : {};
    setText('hhaScore', d.score ?? 0);
    setText('hhaCombo', d.combo ?? 0);
    setText('hhaMiss', d.misses ?? 0);
    if (d.grade != null) setText('hhaGrade', d.grade);
  }

  function onTime(e){
    const d = (e && e.detail) ? e.detail : {};
    const t = (d.timeLeft != null) ? d.timeLeft : (d.timeLeftSec != null ? Math.ceil(d.timeLeftSec) : 0);
    setText('hhaTime', t);
  }

  function onQuest(e){
    const d = (e && e.detail) ? e.detail : {};
    if (d.goalTitle) setText('hudGoalTitle', d.goalTitle);
    if (d.goalMax != null) setText('hudGoalCount', `${d.goalCur ?? 0}/${d.goalMax ?? 0}`);
    if (d.miniTitle) setText('hudMiniTitle', d.miniTitle);
    if (d.miniMax != null) setText('hudMiniCount', `${d.miniCur ?? 0}/${d.miniMax ?? 0}`);

    const mt = doc.getElementById('hudMiniTimer');
    if (mt){
      mt.textContent = (d.miniTLeft != null) ? `⏱ ${d.miniTLeft}s` : '';
    }

    const qp = doc.getElementById('hudQProgress');
    if (qp){
      qp.textContent = `Goals ${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0} • Minis ${d.minisCleared ?? 0}/${d.minisTotal ?? 0}`;
    }
  }

  function coachImgForMood(m){
    m = String(m || 'neutral').toLowerCase();
    if (m === 'happy') return './img/coach-happy.png';
    if (m === 'sad') return './img/coach-sad.png';
    if (m === 'fever') return './img/coach-fever.png';
    return './img/coach-neutral.png';
  }

  function onCoach(e){
    const d = (e && e.detail) ? e.detail : {};
    if (d.line) setText('hudCoachLine', d.line);
    if (d.sub != null) setText('hudCoachSub', d.sub);

    const img = doc.getElementById('hudCoachImg');
    if (img && d.mood){
      img.src = coachImgForMood(d.mood);
    }
  }

  function onEnd(e){
    const d = (e && e.detail) ? e.detail : {};
    // freeze grade if exists
    if (d.grade != null) setText('hhaGrade', d.grade);
    // also store last summary (optional)
    try{ root.__HHA_LAST_END__ = d; } catch(_) {}
  }

  // bind once
  root.addEventListener('hha:score', onScore);
  root.addEventListener('hha:time', onTime);
  doc.addEventListener('quest:update', onQuest);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:end', onEnd);

})(window);