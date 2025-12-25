// === /herohealth/vr/hha-hud.js ===
// HeroHealth — Global HUD Binder (Universal)
// ✅ listens: hha:time, hha:score, hha:coach, quest:update, hha:fever, hha:rank, hha:end
// ✅ Safe: element missing = skip
// ✅ Works across GoodJunk / Hydration / Plate / Groups (shared IDs if present)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const $ = (id) => doc.getElementById(id);
  const setTxt = (el, t) => { if (el) el.textContent = String(t); };

  // shared HUD IDs (your current html uses these)
  const HUD = {
    time: $('hudTime'),
    score: $('hudScore'),
    combo: $('hudCombo'),
    miss: $('hudMiss'),
    grade: $('hudGrade'),
    feverPct: $('hudFeverPct'),
    mode: $('hudMode'),
    diff: $('hudDiff'),
    have: $('hudGroupsHave'),
    perfect: $('hudPerfectCount'),

    miniLine: $('miniLine'),
    goalLine: $('goalLine'),
    miniHint: $('miniHint'),

    // result
    resultBackdrop: $('resultBackdrop'),
    rMode: $('rMode'),
    rGrade: $('rGrade'),
    rScore: $('rScore'),
    rMaxCombo: $('rMaxCombo'),
    rMiss: $('rMiss'),
    rPerfect: $('rPerfect'),
    rGoals: $('rGoals'),
    rMinis: $('rMinis'),
  };

  function on(name, fn) {
    try { root.addEventListener(name, fn); } catch (_) {}
  }

  // time
  on('hha:time', (e) => {
    const d = (e && e.detail) || {};
    const sec = Number(d.sec ?? d.timeLeftSec ?? d.time ?? d.t ?? 0) || 0;
    setTxt(HUD.time, Math.max(0, Math.floor(sec)));
  });

  // score payload
  on('hha:score', (e) => {
    const d = (e && e.detail) || {};
    if ('score' in d) setTxt(HUD.score, d.score);
    if ('combo' in d) setTxt(HUD.combo, d.combo);
    if ('miss' in d) setTxt(HUD.miss, d.miss);
    if ('grade' in d) setTxt(HUD.grade, d.grade);
    if ('perfect' in d) setTxt(HUD.perfect, d.perfect);
    if ('have' in d && HUD.have) setTxt(HUD.have, d.have);
  });

  // fever
  on('hha:fever', (e) => {
    const d = (e && e.detail) || {};
    const pct = Number(d.feverPct ?? d.fever ?? 0) || 0;
    if (HUD.feverPct) setTxt(HUD.feverPct, `${Math.round(pct)}%`);
  });

  // quest:update
  on('quest:update', (e) => {
    const d = (e && e.detail) || {};
    // support both styles:
    // { miniTitle, miniProgress, miniHint, goalTitle, goalProgress }
    // { miniLine, goalLine, hint }
    const mini = d.miniLine || (d.miniTitle ? `MINI: ${d.miniTitle}${d.miniProgress ? ` (${d.miniProgress})` : ''}` : '');
    const goal = d.goalLine || (d.goalTitle ? `Goal: ${d.goalTitle}${d.goalProgress ? ` (${d.goalProgress})` : ''}` : '');
    const hint = d.hint || d.miniHint || '';

    if (mini && HUD.miniLine) setTxt(HUD.miniLine, mini);
    if (goal && HUD.goalLine) setTxt(HUD.goalLine, goal);
    if (hint && HUD.miniHint) setTxt(HUD.miniHint, hint);
  });

  // rank/grade ticker
  on('hha:rank', (e) => {
    const d = (e && e.detail) || {};
    if (d && d.grade && HUD.grade) setTxt(HUD.grade, d.grade);
  });

  // end summary (if any game emits hha:end)
  on('hha:end', (e) => {
    const d = (e && e.detail) || {};
    if (!HUD.resultBackdrop) return;

    // fill what exists
    setTxt(HUD.rMode, d.runMode || d.mode || '—');
    setTxt(HUD.rGrade, d.grade || '—');
    setTxt(HUD.rScore, d.scoreFinal ?? d.score ?? 0);
    setTxt(HUD.rMaxCombo, d.comboMax ?? d.maxCombo ?? 0);
    setTxt(HUD.rMiss, d.misses ?? d.miss ?? 0);
    setTxt(HUD.rPerfect, d.perfectCount ?? d.perfect ?? 0);

    const gC = d.goalsCleared ?? 0, gT = d.goalsTotal ?? 0;
    const mC = d.miniCleared ?? 0, mT = d.miniTotal ?? 0;
    if (HUD.rGoals) setTxt(HUD.rGoals, `${gC}/${gT || 0}`);
    if (HUD.rMinis) setTxt(HUD.rMinis, `${mC}/${mT || 0}`);

    // show overlay
    HUD.resultBackdrop.style.display = 'flex';
  });

  // expose
  root.HHA_HUDBinder = { ok: true };

})(typeof window !== 'undefined' ? window : globalThis);