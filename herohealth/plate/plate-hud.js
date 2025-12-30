// === /herohealth/plate/plate-hud.js ===
// Plate HUD Binder — PATH SAFE (HTML at /herohealth/plate-vr.html, JS in /herohealth/plate/)
// ✅ listens: hha:score, quest:update, hha:coach, hha:end
// ✅ coach image path: /herohealth/plate-*.png (root)
// ✅ fallback: ../img/coach-*.png (if ever used)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // --- base urls (robust regardless of where HTML lives) ---
  const scriptUrl = (() => {
    try { return new URL(doc.currentScript && doc.currentScript.src ? doc.currentScript.src : location.href); }
    catch (e) { return new URL(location.href); }
  })();
  const PLATE_DIR = new URL('./', scriptUrl);   // .../herohealth/plate/
  const ROOT_DIR  = new URL('../', PLATE_DIR);  // .../herohealth/

  function qs(id){ return doc.getElementById(id); }
  function setText(id, v){ const el = qs(id); if (el) el.textContent = String(v); }
  function setWidth(id, pct){ const el = qs(id); if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`; }

  function setImgWithFallback(imgEl, urlList){
    if (!imgEl) return;
    let i = 0;
    const tryNext = () => {
      if (i >= urlList.length) return;
      const url = urlList[i++];
      const test = new Image();
      test.onload = () => { imgEl.src = url; };
      test.onerror = tryNext;
      test.src = url;
    };
    tryNext();
  }

  function coach(msg, mood){
    const cm = qs('coachMsg');
    if (cm && msg != null) cm.textContent = String(msg);

    const img = qs('coachImg');
    if (!img) return;

    const m = String(mood || 'neutral').toLowerCase();

    // ✅ root images: /herohealth/plate-neutral.png etc.
    const urls = [
      new URL(`plate-${m}.png`, ROOT_DIR).href,
      new URL(`img/coach-${m}.png`, ROOT_DIR).href,
      new URL(`img/plate-${m}.png`, ROOT_DIR).href,
    ];
    setImgWithFallback(img, urls);
  }

  // --- events ---
  root.addEventListener('hha:score', (ev) => {
    const d = (ev && ev.detail) || {};
    if (d.game && d.game !== 'plate') return;

    if (d.score != null) setText('uiScore', d.score);
    if (d.combo != null) setText('uiCombo', d.combo);
    if (d.comboMax != null) setText('uiComboMax', d.comboMax);
    if (d.miss != null) setText('uiMiss', d.miss);

    if (d.plateHave != null) setText('uiPlateHave', d.plateHave);
    if (Array.isArray(d.gCount)) {
      setText('uiG1', d.gCount[0] || 0);
      setText('uiG2', d.gCount[1] || 0);
      setText('uiG3', d.gCount[2] || 0);
      setText('uiG4', d.gCount[3] || 0);
      setText('uiG5', d.gCount[4] || 0);
    }

    if (d.timeLeftSec != null) setText('uiTime', d.timeLeftSec);

    if (d.accuracyGoodPct != null) setText('uiAcc', `${Math.round(Number(d.accuracyGoodPct) || 0)}%`);
    if (d.grade != null) setText('uiGrade', d.grade);

    if (d.fever != null) setWidth('uiFeverFill', Number(d.fever) || 0);
    if (d.shield != null) setText('uiShieldN', d.shield);
  });

  root.addEventListener('quest:update', (ev) => {
    const d = (ev && ev.detail) || {};
    if (d.game && d.game !== 'plate') return;

    const g = d.goal || null;
    if (g) {
      setText('uiGoalTitle', g.title || '—');
      setText('uiGoalCount', `${g.cur || 0}/${g.target || 0}`);
      const pct = (g.target > 0) ? ((g.cur || 0) / g.target) * 100 : 0;
      setWidth('uiGoalFill', pct);
    }

    const m = d.mini || null;
    if (m) {
      setText('uiMiniTitle', m.title || '—');
      if (m.timeLeft != null) setText('uiMiniTime', `${Math.ceil(m.timeLeft)}s`);
      const pct = (m.target > 0 && m.timeLeft != null) ? ((m.target - m.timeLeft) / m.target) * 100 : 0;
      setWidth('uiMiniFill', pct);
      // mini count (ถ้า detail ส่งมา)
      if (d.miniCountText) setText('uiMiniCount', d.miniCountText);
    }
  });

  root.addEventListener('hha:coach', (ev) => {
    const d = (ev && ev.detail) || {};
    if (d.game && d.game !== 'plate') return;
    coach(d.msg, d.mood);
  });

  root.addEventListener('hha:end', (ev) => {
    const d = (ev && ev.detail) || {};
    if (d.game && d.game !== 'plate') return;
    const s = d.summary || {};

    // show result overlay
    const back = qs('resultBackdrop');
    if (back) back.style.display = 'grid';

    setText('rMode', s.runMode || 'play');
    setText('rGrade', s.grade || 'C');
    setText('rScore', s.scoreFinal || 0);
    setText('rMaxCombo', s.comboMax || 0);
    setText('rMiss', s.misses || 0);
    setText('rPerfect', (s.fastHitRatePct != null) ? `${Math.round(s.fastHitRatePct)}%` : '0%');
    setText('rGoals', `${s.goalsCleared || 0}/${s.goalsTotal || 0}`);
    setText('rMinis', `${s.miniCleared || 0}/${s.miniTotal || 0}`);

    const counts = (s.plate && s.plate.counts) ? s.plate.counts : [0,0,0,0,0];
    setText('rG1', counts[0] || 0);
    setText('rG2', counts[1] || 0);
    setText('rG3', counts[2] || 0);
    setText('rG4', counts[3] || 0);
    setText('rG5', counts[4] || 0);
    setText('rGTotal', (s.plate && s.plate.total != null) ? s.plate.total : (counts.reduce((a,b)=>a+(b||0),0)));
  });

})(window);