// === /herohealth/vr/hha-hud.js ===
// HeroHealth — Global HUD Binder (SAFE / ROBUST + TOAST)
// ✅ GoodJunk HUD ids: uiScore/uiComboMax/uiMiss/uiTime/uiFever/uiShield/qTitle/qBar/miniText/miniCount
// ✅ Plate HUD ids: hudScore/hudTime/hudCombo/hudMiss/hudFever/hudFeverPct/hudGrade/hudGoalLine/hudMiniLine/hudMiniHint
// ✅ Supports quest:update new shape: { goal, mini, meta }
// ✅ Supports legacy quest:update: { title, progressPct, miniText, miniCleared, miniLeft }
// ✅ Adds toast via #badge/#badgeText when present (GoodJunk)
// ✅ Emits hha:celebrate on goal/mini/all clear (Particles can hook it)

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

  const setText = (el, v) => { if (el) try { el.textContent = String(v ?? ''); } catch (_) {} };
  const setBarPct01 = (el, pct01) => {
    if (!el) return;
    const p = clamp01(pct01);
    try { el.style.width = (p * 100).toFixed(0) + '%'; } catch (_) {}
    try { el.setAttribute('aria-valuenow', String(Math.round(p * 100))); } catch (_) {}
  };
  const setBarPct100 = (el, pct100) => {
    if (!el) return;
    const p = Math.max(0, Math.min(100, toNum(pct100, 0)));
    try { el.style.width = p.toFixed(0) + '%'; } catch (_) {}
    try { el.setAttribute('aria-valuenow', String(Math.round(p))); } catch (_) {}
  };

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---------- element map (GoodJunk) ----------
  const GJ = {
    uiScore: $id('uiScore'),
    uiComboMax: $id('uiComboMax'),
    uiMiss: $id('uiMiss'),
    uiTime: $id('uiTime'),
    uiFever: $id('uiFever'),
    uiShield: $id('uiShield'),
    uiDiffChallenge: $id('uiDiffChallenge'),

    qTitle: $id('qTitle'),
    qBar: $id('qBar'),
    miniText: $id('miniText'),
    miniCount: $id('miniCount'),

    badge: $id('badge'),
    badgeText: $id('badgeText')
  };

  // ---------- element map (Plate) ----------
  const PL = {
    hudTime: $id('hudTime'),
    hudScore: $id('hudScore'),
    hudCombo: $id('hudCombo'),
    hudMiss: $id('hudMiss'),

    hudFever: $id('hudFever'),
    hudFeverPct: $id('hudFeverPct'),
    hudGrade: $id('hudGrade'),

    hudGoalLine: $id('hudGoalLine'),
    hudMiniLine: $id('hudMiniLine'),
    hudMiniHint: $id('hudMiniHint')
  };

  const hasGoodJunkHUD = () => !!(GJ.uiScore || GJ.qTitle || GJ.qBar || GJ.miniText);
  const hasPlateHUD    = () => !!(PL.hudScore || PL.hudTime || PL.hudGoalLine || PL.hudMiniLine);

  // ---------- toast (badge) ----------
  let toastTimer = 0;
  function toast(msg, ok = true, ms = 900){
    if (!GJ.badgeText || !GJ.badge) return;
    try{
      GJ.badge.classList.toggle('ok', !!ok);
      GJ.badgeText.textContent = String(msg || '');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(()=> {
        // don't wipe if game is still writing "running…"
        // (leave last message as-is)
      }, Math.max(250, ms|0));
    }catch(_){}
  }

  // ---------- normalize quest payload ----------
  function normalizeQuestPart(part){
    if (!part) return null;
    const title = part.title ?? part.label ?? '';
    const cur = (part.cur != null) ? toNum(part.cur, 0) : toNum(part.value, 0);
    const max = (part.max != null) ? toNum(part.max, 0) : toNum(part.target, 0);
    const pct = clamp01(part.pct ?? (max > 0 ? (cur / max) : 0));
    const hint = part.hint ?? part.desc ?? '';
    return { title, cur, max, pct, hint, id: part.id ?? '' };
  }

  // ---------- handlers ----------
  function onScore(ev){
    const d = ev?.detail || {};

    const score = (d.score != null) ? toNum(d.score, 0) : null;
    const comboMax = (d.comboMax != null) ? toNum(d.comboMax, 0) : null;
    const combo = (d.combo != null) ? toNum(d.combo, 0) : null;
    const miss = (d.miss != null) ? toNum(d.miss, 0) : (d.misses != null ? toNum(d.misses, 0) : null);

    if (hasGoodJunkHUD()){
      if (score != null && GJ.uiScore) setText(GJ.uiScore, score);
      if (comboMax != null && GJ.uiComboMax) setText(GJ.uiComboMax, comboMax);
      if (miss != null && GJ.uiMiss) setText(GJ.uiMiss, miss);
    }

    if (hasPlateHUD()){
      if (PL.hudScore && score != null) setText(PL.hudScore, score);
      if (PL.hudCombo && combo != null) setText(PL.hudCombo, combo);
      if (PL.hudMiss && miss != null) setText(PL.hudMiss, miss);
      if (d.grade != null && PL.hudGrade) setText(PL.hudGrade, d.grade);
    }
  }

  function onTime(ev){
    const d = ev?.detail || {};
    let sec =
      (d.sec != null) ? toNum(d.sec, NaN) :
      (d.secLeft != null) ? toNum(d.secLeft, NaN) :
      (d.timeLeft != null) ? toNum(d.timeLeft, NaN) :
      (d.left != null) ? toNum(d.left, NaN) :
      NaN;

    if (!Number.isFinite(sec)) {
      const ms =
        (d.timeMsLeft != null) ? toNum(d.timeMsLeft, NaN) :
        (d.msLeft != null) ? toNum(d.msLeft, NaN) :
        NaN;
      if (Number.isFinite(ms)) sec = Math.round(ms / 1000);
    }
    if (!Number.isFinite(sec)) return;

    if (hasGoodJunkHUD()){
      if (GJ.uiTime) setText(GJ.uiTime, String(sec | 0));
    }
    if (hasPlateHUD()){
      if (PL.hudTime) setText(PL.hudTime, String(sec | 0));
    }
  }

  function onFever(ev){
    const d = ev?.detail || {};
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
      if (PL.hudFever) setBarPct100(PL.hudFever, fever100);
      if (PL.hudFeverPct) setText(PL.hudFeverPct, fever100 + '%');
    }
  }

  function onQuestUpdate(ev){
    const d = ev?.detail || {};

    // NEW shape
    const goal = normalizeQuestPart(d.goal);
    const mini = normalizeQuestPart(d.mini);
    const meta = d.meta || null;

    // LEGACY
    const legacyTitle = (d.title != null) ? String(d.title) : '';
    const legacyPct = (d.progressPct != null) ? toNum(d.progressPct, NaN) : NaN;

    if (hasGoodJunkHUD()){
      if (goal) {
        const line = goal.max > 0 ? `${goal.title} • ${goal.cur}/${goal.max}` : (goal.title || '—');
        if (GJ.qTitle) setText(GJ.qTitle, line);
        if (GJ.qBar) setBarPct01(GJ.qBar, goal.pct);
      } else if (legacyTitle) {
        if (GJ.qTitle) setText(GJ.qTitle, legacyTitle);
        if (GJ.qBar && Number.isFinite(legacyPct)) setBarPct100(GJ.qBar, legacyPct);
      }

      if (mini) {
        const mline = mini.max > 0
          ? `Mini: ${mini.title} • ${mini.cur}/${mini.max}`
          : `Mini: ${mini.title || '—'}`;
        if (GJ.miniText) setText(GJ.miniText, mline);

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

      if (GJ.uiDiffChallenge && meta && (meta.diff || meta.challenge)) {
        const diff = String(meta.diff || '').toUpperCase() || 'NORMAL';
        const ch = String(meta.challenge || '').toUpperCase() || 'RUSH';
        setText(GJ.uiDiffChallenge, `Diff: ${diff} • Challenge: ${ch}`);
      }
    }

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

  // ----- quest event toasts -----
  function onMiniStart(ev){
    const d = ev?.detail || {};
    if (d.title) toast(`🧩 เริ่ม Mini: ${d.title}`, true, 850);
  }
  function onMiniClear(ev){
    const d = ev?.detail || {};
    toast(`✅ Mini ผ่าน! ${d.title || ''}`.trim(), true, 1000);
    emit('hha:celebrate', { kind:'mini', id:d.id||'' });
  }
  function onGoalClear(ev){
    const d = ev?.detail || {};
    toast(`🎯 Goal ผ่าน! ${d.title || ''}`.trim(), true, 1100);
    emit('hha:celebrate', { kind:'goal', id:d.id||'' });
  }
  function onAllGoalsClear(ev){
    toast('🏁 เคลียร์ GOAL ครบแล้ว! โหดมาก!', true, 1400);
    emit('hha:celebrate', { kind:'allGoals' });
  }

  // ---------- bind ----------
  root.addEventListener('hha:score', onScore, { passive: true });
  root.addEventListener('hha:time', onTime, { passive: true });
  root.addEventListener('hha:fever', onFever, { passive: true });
  root.addEventListener('quest:update', onQuestUpdate, { passive: true });

  root.addEventListener('quest:miniStart', onMiniStart, { passive: true });
  root.addEventListener('quest:miniClear', onMiniClear, { passive: true });
  root.addEventListener('quest:goalClear', onGoalClear, { passive: true });
  root.addEventListener('quest:allGoalsClear', onAllGoalsClear, { passive: true });

  root.GAME_MODULES.HUD = { __bound: true };
})(window);