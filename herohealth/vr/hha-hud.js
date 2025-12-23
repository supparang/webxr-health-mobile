// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (SAFE / PRODUCTION)
// รองรับทุกเกม (GoodJunkVR / HydrationVR / PlateVR / GroupsVR ฯลฯ)
// ฟัง event กลางแล้วอัปเดต UI ถ้ามี element นั้น ๆ ก็อัปเดต ถ้าไม่มีก็ข้าม
//
// Events:
// - hha:score    {score, comboMax/combomax, misses/miss, goodHits, multiplier, ...}
// - hha:time     {sec}
// - hha:fever    {fever, shield, stunActive, slow}
// - quest:update
//    * NEW: { goal:{title,cur,max,pct,hint}, mini:{title,cur,max,pct,hint}, meta:{goalsCleared,minisCleared,goalIndex,miniCount,diff,challenge} }
//    * OLD: { title, progressPct, miniText, miniCleared, miniLeft, hint, ... }
// - hha:judge    {label}
// - hha:end      {score, comboMax, misses, ...}  (เผื่อเกมอื่นใช้)
//
// Notes:
// - ทำงานแบบ "ปลอดภัย" ถ้า id ไม่อยู่ก็ไม่พัง
// - มี adapter สำหรับ quest:update ใหม่ -> ฟิลด์แบบเก่า เพื่อ UI เดิม

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const $ = (id) => doc.getElementById(id);

  // ---------- safe setters ----------
  function setText(id, v) {
    const el = $(id);
    if (!el) return;
    el.textContent = (v === undefined || v === null) ? '' : String(v);
  }
  function setWidth(id, pct01) {
    const el = $(id);
    if (!el) return;
    const p = Math.max(0, Math.min(1, Number(pct01 || 0)));
    el.style.width = (p * 100).toFixed(0) + '%';
  }
  function setStyleWidthPx(id, px) {
    const el = $(id);
    if (!el) return;
    el.style.width = (Number(px) || 0) + 'px';
  }

  function clamp01(x) {
    x = Number(x) || 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  // ---------- map helpers ----------
  function readNum(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // ---------- Score HUD bindings (multi-layout) ----------
  function onScore(d) {
    // GoodJunk layout ids
    setText('uiScore', d.score ?? 0);
    setText('uiComboMax', d.comboMax ?? d.combomax ?? 0);
    setText('uiMiss', d.misses ?? d.miss ?? 0);

    // Plate layout ids
    setText('hudScore', d.score ?? 0);
    setText('hudCombo', d.combo ?? d.comboNow ?? 0);
    setText('hudMiss', d.misses ?? d.miss ?? 0);

    // Optional: perfect count / groups have / grade (ถ้ามีเกมส่งมา)
    if (d.perfect !== undefined) setText('hudPerfectCount', d.perfect);
    if (d.grade !== undefined) setText('hudGrade', d.grade);

    // Hydration/others may use different ids
    if (d.goodHits !== undefined) setText('hudGood', d.goodHits);
    if (d.multiplier !== undefined) setText('hudMul', (readNum(d.multiplier, 1)).toFixed(2));
  }

  function onTime(d) {
    const sec = (d && d.sec !== undefined) ? (d.sec | 0) : '--';
    setText('uiTime', sec);
    setText('hudTime', sec);
  }

  function onFever(d) {
    const fever = Math.max(0, Math.min(100, readNum(d.fever, 0)));
    const shield = readNum(d.shield, 0) | 0;

    // GoodJunk ids
    setText('uiFever', Math.round(fever));
    setText('uiShield', shield);

    // Plate ids
    setText('hudFeverPct', Math.round(fever) + '%');
    setWidth('hudFever', fever / 100);

    // Generic
    setText('hudShield', shield);
  }

  // ---------- Quest adapter ----------
  function adaptQuestUpdate(detail) {
    const d = detail || {};

    // NEW format?
    if (d.goal || d.mini || d.meta) {
      const goal = d.goal || null;
      const mini = d.mini || null;
      const meta = d.meta || {};

      const goalTitle = goal ? (goal.title || goal.label || 'ภารกิจหลัก') : '—';
      const goalPct = goal ? clamp01(goal.pct) : 0;

      const miniTitle = mini ? (mini.title || mini.label || 'Mini') : 'Mini: —';
      const miniPct = mini ? clamp01(mini.pct) : 0;

      const miniCleared = (meta.minisCleared | 0) || 0;
      const miniCount = (meta.miniCount | 0) || 0;

      // “compat” fields for older UIs
      return {
        // old-ish:
        title: goalTitle,
        progressPct: Math.round(goalPct * 100),
        hint: (goal && goal.hint) ? String(goal.hint) : '',

        miniText: `Mini: ${miniTitle}`,
        miniProgressPct: Math.round(miniPct * 100),
        miniHint: (mini && mini.hint) ? String(mini.hint) : '',

        miniCleared,
        miniLeft: miniCount, // ใน UI บางอันใช้คำว่า "เล่นอยู่"
        meta
      };
    }

    // OLD format (already)
    return d;
  }

  function onQuestUpdate(detail) {
    const d = adaptQuestUpdate(detail);

    // GoodJunk HUD (your goodjunk-vr.html has these)
    // - qTitle expects text
    // - qBar is <i> inside .bar -> width%
    setText('qTitle', d.title || '—');
    if ($('qBar')) setStyleWidthPx('qBar', 0); // safety if someone used px; will override below
    if ($('qBar')) $('qBar').style.width = (Math.max(0, Math.min(100, readNum(d.progressPct, 0)))).toFixed(0) + '%';

    if (d.miniText) setText('miniText', d.miniText);
    if (d.miniHint) setText('miniHint', d.miniHint);

    if (d.miniCleared !== undefined || d.miniLeft !== undefined) {
      const a = readNum(d.miniCleared, 0) | 0;
      const b = readNum(d.miniLeft, 0) | 0;
      setText('miniCount', `mini ผ่าน ${a} • เล่นอยู่ ${b}`);
    }

    // Plate HUD ids (quest/mini line)
    if (d.title) setText('hudGoalLine', d.title);
    if (d.miniText) setText('hudMiniLine', d.miniText.replace(/^Mini:\s*/i, ''));

    if (d.miniHint) setText('hudMiniHint', d.miniHint);
  }

  // ---------- Judge -> optional floating pop ----------
  function onJudge(d) {
    const label = (d && d.label) ? String(d.label) : '';
    setText('hudJudge', label);

    // if particles has floatpop listener itself, no need.
    // but safe to emit a floatpop for overlays that want it:
    if (label) {
      try {
        root.dispatchEvent(new CustomEvent('hha:floatpop', {
          detail: { text: label, kind: /miss|hit|bad/i.test(label) ? 'bad' : 'good', size: 'small', ms: 520 }
        }));
      } catch (_) {}
    }
  }

  // ---------- End (optional result panels) ----------
  function onEnd(d) {
    const s = d || {};
    // if result ids exist
    setText('rScore', s.score ?? 0);
    setText('rMaxCombo', s.comboMax ?? 0);
    setText('rMiss', s.misses ?? 0);
    setText('rMode', s.runMode ?? s.run ?? '');
    setText('rDiff', s.diff ?? '');
    setText('rChallenge', s.challenge ?? '');
  }

  // ---------- attach listeners ----------
  root.addEventListener('hha:score', (e) => onScore(e.detail || {}));
  root.addEventListener('hha:time', (e) => onTime(e.detail || {}));
  root.addEventListener('hha:fever', (e) => onFever(e.detail || {}));
  root.addEventListener('quest:update', (e) => onQuestUpdate(e.detail || {}));
  root.addEventListener('hha:judge', (e) => onJudge(e.detail || {}));
  root.addEventListener('hha:end', (e) => onEnd(e.detail || {}));

  // mark ready
  try { root.GAME_MODULES = root.GAME_MODULES || {}; root.GAME_MODULES.HUD = { ok: true }; } catch (_) {}

})(window);
