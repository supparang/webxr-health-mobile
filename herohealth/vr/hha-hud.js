// === /herohealth/vr/hha-hud.js ===
// HeroHealth — Global HUD Binder (SAFE / ROBUST)
// ✅ Works with GoodJunk HUD ids (uiScore/uiComboMax/uiMiss/uiTime/uiFever/uiShield/qTitle/qBar/miniText/miniCount/...)
// ✅ Also supports Plate HUD ids (hudScore/hudTime/hudCombo/hudMiss/hudFever/hudFeverPct/hudGrade/hudGoalLine/hudMiniLine/hudMiniHint/...)
// ✅ Supports quest:update new shape: {goal, mini, meta}
// ✅ Also supports legacy quest:update: {title, progressPct, miniText, miniCleared, miniLeft}

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  root.GAME_MODULES = root.GAME_MODULES || {};
  if (root.GAME_MODULES.HUD && root.GAME_MODULES.HUD.__bound) return;

  // ---------- helpers ----------
  const toNum = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const clamp01 = (x) => Math.max(0, Math.min(1, toNum(x, 0)));

  const $id = (id) => doc.getElementById(id);
  const pickId = (ids) => {
    for (const id of ids) {
      const el = $id(id);
      if (el) return el;
    }
    return null;
  };

  const setText = (el, v) => { if (el) try { el.textContent = String(v ?? ''); } catch (_) {} };
  const setBarPct = (el, pct01) => {
    if (!el) return;
    const p = clamp01(pct01);
    // For <i> inside bar (GoodJunk/Plate), we set width
    try { el.style.width = (p * 100).toFixed(0) + '%'; } catch (_) {}
    try { el.setAttribute('aria-valuenow', String(Math.round(p * 100))); } catch (_) {}
  };
  const setBarWidthPct = (el, pct100) => {
    if (!el) return;
    const p = Math.max(0, Math.min(100, toNum(pct100, 0)));
    try { el.style.width = p.toFixed(0) + '%'; } catch (_) {}
    try { el.setAttribute('aria-valuenow', String(Math.round(p))); } catch (_) {}
  };

  const fmtTime = (sec) => {
    const s = Math.max(0, (toNum(sec, 0) | 0));
    const m = (s / 60) | 0;
    const r = s - m * 60;
    return m + ':' + String(r).padStart(2, '0');
  };

  // ---------- element map (GoodJunk) ----------
  const GJ = {
    modeName: $id('modeName'),
    runName: $id('runName'),
    uiScore: $id('uiScore'),
    uiComboMax: $id('uiComboMax'),
    uiMiss: $id('uiMiss'),
    uiTime: $id('uiTime'),
    uiFever: $id('uiFever'),
    uiShield: $id('uiShield'),
    uiDiffChallenge: $id('uiDiffChallenge'),

    qTitle: $id('qTitle'),
    qBar: $id('qBar'), // <i> inside bar
    miniText: $id('miniText'),
    miniCount: $id('miniCount')
  };

  // ---------- element map (Plate) ----------
  const PL = {
    hudTime: $id('hudTime'),
    hudScore: $id('hudScore'),
    hudCombo: $id('hudCombo'),
    hudMiss: $id('hudMiss'),

    hudFever: $id('hudFever'),         // inner bar span
    hudFeverPct: $id('hudFeverPct'),   // "0%"
    hudGrade: $id('hudGrade'),

    hudGoalLine: $id('hudGoalLine'),
    hudMiniLine: $id('hudMiniLine'),
    hudMiniHint: $id('hudMiniHint'),

    rMode: $id('rMode'),
    rGrade: $id('rGrade'),
    rScore: $id('rScore'),
    rMaxCombo: $id('rMaxCombo'),
    rMiss: $id('rMiss'),
    rPerfect: $id('rPerfect'),
    rGoals: $id('rGoals'),
    rMinis: $id('rMinis')
  };

  function hasGoodJunkHUD(){
    return !!(GJ.uiScore || GJ.qTitle || GJ.qBar || GJ.miniText);
  }
  function hasPlateHUD(){
    return !!(PL.hudScore || PL.hudTime || PL.hudGoalLine || PL.hudMiniLine);
  }

  // ---------- normalize quest payload ----------
  function normalizeQuestPart(part){
    if (!part) return null;
    // Patch A: {id,title,cur,max,pct,hint}
    const title = part.title ?? part.label ?? '';
    const cur = (part.cur != null) ? toNum(part.cur, 0) : toNum(part.value, 0);
    const max = (part.max != null) ? toNum(part.max, 0) : toNum(part.target, 0);
    const pct = clamp01(part.pct ?? (max > 0 ? (cur / max) : 0));
    const hint = part.hint ?? part.desc ?? '';
    return { title, cur, max, pct, hint, id: part.id ?? '' };
  }

  function onScore(ev){
    const d = ev?.detail || {};

    // score
    const score = (d.score != null) ? toNum(d.score, 0) : null;
    const comboMax = (d.comboMax != null) ? toNum(d.comboMax, 0) : null;
    const combo = (d.combo != null) ? toNum(d.combo, 0) : null;
    const miss = (d.miss != null) ? toNum(d.miss, 0) : (d.misses != null ? toNum(d.misses, 0) : null);

    // GoodJunk
    if (hasGoodJunkHUD()){
      if (score != null && GJ.uiScore) setText(GJ.uiScore, score);
      if (comboMax != null && GJ.uiComboMax) setText(GJ.uiComboMax, comboMax);
      if (miss != null && GJ.uiMiss) setText(GJ.uiMiss, miss);
    }

    // Plate
    if (hasPlateHUD()){
      if (PL.hudScore && score != null) setText(PL.hudScore, score);
      if (PL.hudCombo && combo != null) setText(PL.hudCombo, combo);
      if (PL.hudMiss && miss != null) setText(PL.hudMiss, miss);

      if (d.grade != null && PL.hudGrade) setText(PL.hudGrade, d.grade);
      if (d.maxCombo != null && PL.rMaxCombo) setText(PL.rMaxCombo, d.maxCombo);
    }
  }

  function onTime(ev){
    const d = ev?.detail || {};
    // accept many keys:
    // - {sec} (legacy)
    // - {secLeft}/{timeLeft}/{left}
    // - {timeMsLeft}/{msLeft} (ms)
    let sec =
      (d.sec != null) ? toNum(d.sec, NaN) :
      (d.secLeft != null) ? toNum(d.secLeft, NaN) :
      (d.timeLeft != null) ? toNum(d.timeLeft, NaN) :
      (d.left != null) ? toNum(d.left, NaN) :
      NaN;

    if (!Number.isFinite(sec)) {
      // try ms
      const ms =
        (d.timeMsLeft != null) ? toNum(d.timeMsLeft, NaN) :
        (d.msLeft != null) ? toNum(d.msLeft, NaN) :
        NaN;
      if (Number.isFinite(ms)) sec = Math.round(ms / 1000);
    }

    if (!Number.isFinite(sec)) return;

    if (hasGoodJunkHUD()){
      // GoodJunk shows just number + "s" in HTML
      if (GJ.uiTime) setText(GJ.uiTime, String(sec | 0));
    }
    if (hasPlateHUD()){
      // Plate expects number (seconds) as text
      if (PL.hudTime) setText(PL.hudTime, String(sec | 0));
    }
  }

  function onFever(ev){
    const d = ev?.detail || {};
    // accept:
    // - pct 0..1
    // - feverPct 0..1
    // - fever 0..100 (your GoodJunk HTML currently expects 0..100)
    let pct01 = NaN;
    if (d.pct != null) pct01 = toNum(d.pct, NaN);
    else if (d.feverPct != null) pct01 = toNum(d.feverPct, NaN);
    else if (d.fever != null) {
      const f = toNum(d.fever, NaN);
      if (Number.isFinite(f)) pct01 = (f > 1.2) ? (f / 100) : f;
    }

    if (!Number.isFinite(pct01)) pct01 = 0;
    pct01 = clamp01(pct01);

    const fever100 = Math.round(pct01 * 100);

    // shield could be boolean or count
    const shieldVal =
      (d.shield != null) ? d.shield :
      (d.shieldCount != null) ? d.shieldCount :
      (d.blocks != null) ? d.blocks :
      null;

    if (hasGoodJunkHUD()){
      if (GJ.uiFever) setText(GJ.uiFever, fever100);
      if (GJ.uiShield && shieldVal != null) setText(GJ.uiShield, String(shieldVal));
    }

    if (hasPlateHUD()){
      if (PL.hudFever) {
        // Plate bar inner wants width%
        setBarWidthPct(PL.hudFever, fever100);
      }
      if (PL.hudFeverPct) setText(PL.hudFeverPct, fever100 + '%');
    }
  }

  function onQuestUpdate(ev){
    const d = ev?.detail || {};

    // --- NEW Patch A shape ---
    // d = { goal:{title,cur,max,pct,hint}, mini:{...}, meta:{goalsCleared,minisCleared,goalIndex,miniCount,diff,challenge} }
    const goal = normalizeQuestPart(d.goal);
    const mini = normalizeQuestPart(d.mini);
    const meta = d.meta || null;

    // --- LEGACY shape (your old inline listener) ---
    // d = { title, progressPct, miniText, miniCleared, miniLeft }
    const legacyTitle = (d.title != null) ? String(d.title) : '';
    const legacyPct = (d.progressPct != null) ? toNum(d.progressPct, NaN) : NaN;

    // GoodJunk quest panel
    if (hasGoodJunkHUD()){
      if (goal) {
        const line = goal.max > 0 ? `${goal.title} • ${goal.cur}/${goal.max}` : (goal.title || '—');
        if (GJ.qTitle) setText(GJ.qTitle, line);
        if (GJ.qBar) setBarPct(GJ.qBar, goal.pct);
      } else if (legacyTitle) {
        if (GJ.qTitle) setText(GJ.qTitle, legacyTitle);
        if (GJ.qBar && Number.isFinite(legacyPct)) setBarWidthPct(GJ.qBar, legacyPct);
      }

      if (mini) {
        const mline = mini.max > 0
          ? `Mini: ${mini.title} • ${mini.cur}/${mini.max}`
          : `Mini: ${mini.title || '—'}`;
        if (GJ.miniText) setText(GJ.miniText, mline);

        // meta counters
        if (GJ.miniCount) {
          const minisCleared = meta ? (meta.minisCleared|0) : (toNum(d.miniCleared, 0)|0);
          const miniCount = meta ? (meta.miniCount|0) : (toNum(d.miniLeft, 0)|0);
          setText(GJ.miniCount, `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount}`);
        }
      } else if (d.miniText) {
        if (GJ.miniText) setText(GJ.miniText, d.miniText);
        if (GJ.miniCount && (typeof d.miniCleared === 'number' || typeof d.miniLeft === 'number')) {
          setText(GJ.miniCount, `mini ผ่าน ${d.miniCleared||0} • เล่นอยู่ ${d.miniLeft||0}`);
        }
      }

      // show diff/challenge if provided
      if (GJ.uiDiffChallenge && meta && (meta.diff || meta.challenge)) {
        const diff = String(meta.diff || '').toUpperCase() || 'NORMAL';
        const ch = String(meta.challenge || '').toUpperCase() || 'RUSH';
        setText(GJ.uiDiffChallenge, `Diff: ${diff} • Challenge: ${ch}`);
      }
    }

    // Plate quest panels
    if (hasPlateHUD()){
      if (goal && PL.hudGoalLine) {
        const gline = goal.max > 0 ? `${goal.title} (${goal.cur}/${goal.max})` : (goal.title || '…');
        setText(PL.hudGoalLine, gline);
      }
      if (mini && PL.hudMiniLine) {
        const mline = mini.max > 0 ? `${mini.title} (${mini.cur}/${mini.max})` : (mini.title || '…');
        setText(PL.hudMiniLine, mline);
      }
      if (mini && PL.hudMiniHint) setText(PL.hudMiniHint, mini.hint || '…');
    }
  }

  function onEnd(ev){
    const d = ev?.detail || {};
    const stats = d.stats || d;

    // Plate result screen support (if present)
    if (hasPlateHUD()){
      if (PL.rMode && stats.mode != null) setText(PL.rMode, stats.mode);
      if (PL.rGrade && (d.grade != null || stats.grade != null)) setText(PL.rGrade, d.grade ?? stats.grade);
      if (PL.rScore && stats.score != null) setText(PL.rScore, stats.score);
      if (PL.rMaxCombo && stats.comboMax != null) setText(PL.rMaxCombo, stats.comboMax);
      if (PL.rMiss && (stats.miss != null || stats.misses != null)) setText(PL.rMiss, stats.miss ?? stats.misses);
      if (PL.rPerfect && stats.perfect != null) setText(PL.rPerfect, stats.perfect);
      if (PL.rGoals && (stats.goalsCleared != null || stats.maxGoals != null)) {
        const a = stats.goalsCleared ?? 0;
        const b = stats.maxGoals ?? 2;
        setText(PL.rGoals, `${a}/${b}`);
      }
      if (PL.rMinis && (stats.minisCleared != null || stats.maxMinis != null)) {
        const a = stats.minisCleared ?? 0;
        const b = stats.maxMinis ?? 7;
        setText(PL.rMinis, `${a}/${b}`);
      }
    }
  }

  // ---------- bind (window) ----------
  root.addEventListener('hha:score', onScore, { passive: true });
  root.addEventListener('hha:time', onTime, { passive: true });
  root.addEventListener('hha:fever', onFever, { passive: true });
  root.addEventListener('quest:update', onQuestUpdate, { passive: true });
  root.addEventListener('hha:end', onEnd, { passive: true });

  root.GAME_MODULES.HUD = { __bound: true };
})(window);