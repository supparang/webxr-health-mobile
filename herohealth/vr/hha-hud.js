// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR)
// ✅ PATCH: กัน bind ซ้ำ + รองรับ event "hha:celebrate" (Goal/Mini/All)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // ✅ กัน bind ซ้ำ (สำคัญมากตอน reload/สลับหน้า)
  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (sel) => doc.querySelector(sel);
  const clamp = (v, min, max) => {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  };

  function safeText(el, txt) {
    if (!el) return;
    el.textContent = (txt == null) ? '' : String(txt);
  }
  function fmtInt(v) {
    v = Number(v) || 0;
    return String(Math.round(v));
  }
  function upper(s) {
    return String(s || '').toUpperCase();
  }

  // ---------------------------
  // DOM refs (optional)
  // ---------------------------
  const refs = {
    waterFill: null,
    waterStatus: null,

    modeLabel: null,
    modePill: null,
    diffPill: null,
    score: null,
    comboMax: null,
    miss: null,
    waterZoneText: null,

    gradeBadge: null,

    questGoal: null,
    questMini: null,
    goalDone: null,
    goalTotal: null,
    miniDone: null,
    miniTotal: null,

    coachBubble: null,
    coachText: null,
    coachName: null,
    coachAvatarWrap: null,
    coachAvatarImg: null,

    feverFill: null,
    feverPct: null,
    shield: null,

    btnVr: null,
    crosshair: null,
  };

  function bindRefs() {
    refs.waterFill   = $('#hha-water-fill');
    refs.waterStatus = $('#hha-water-status');

    refs.modeLabel   = $('#hha-mode-label');
    refs.modePill    = $('#hha-mode-pill');
    refs.diffPill    = $('#hha-diff-pill');

    refs.score       = $('#hha-score-main');
    refs.comboMax    = $('#hha-combo-max');
    refs.miss        = $('#hha-miss');
    refs.waterZoneText = $('#hha-water-zone-text');

    refs.gradeBadge  = $('#hha-grade-badge');

    refs.questGoal   = $('#hha-quest-goal');
    refs.questMini   = $('#hha-quest-mini');
    refs.goalDone    = $('#hha-goal-done');
    refs.goalTotal   = $('#hha-goal-total');
    refs.miniDone    = $('#hha-mini-done');
    refs.miniTotal   = $('#hha-mini-total');

    refs.coachBubble = $('#hha-coach-bubble');
    refs.coachText   = $('#hha-coach-text');
    refs.coachName   = doc.querySelector('.hha-coach-name');
    refs.coachAvatarWrap = doc.querySelector('.hha-coach-avatar');
    refs.coachAvatarImg  = refs.coachAvatarWrap ? refs.coachAvatarWrap.querySelector('img') : null;

    refs.feverFill   = $('#hha-fever-fill');
    refs.feverPct    = $('#hha-fever-percent');
    refs.shield      = $('#hha-shield-count');

    refs.btnVr       = $('#hha-btn-vr');
    refs.crosshair   = $('#hvr-crosshair');
  }

  // ---------------------------
  // Grade logic
  // ---------------------------
  function computeGrade(d) {
    const score = Number(d?.score ?? d?.scoreFinal ?? 0) || 0;
    const misses = Number(d?.misses ?? d?.miss ?? 0) || 0;

    const goalsCleared = Number(d?.goalsCleared ?? 0) || 0;
    const goalsTarget  = Number(d?.goalsTarget ?? d?.goalsTotal ?? 0) || 0;
    const questsCleared = Number(d?.questsCleared ?? d?.quests ?? d?.miniCleared ?? 0) || 0;
    const questsTarget  = Number(d?.questsTarget ?? d?.questsTotal ?? d?.miniTotal ?? 0) || 0;

    const goalRatio  = goalsTarget > 0 ? (goalsCleared / goalsTarget) : 0;
    const questRatio = questsTarget > 0 ? (questsCleared / questsTarget) : 0;

    const taskBonus = (goalRatio >= 1 ? 0.10 : 0) + (questRatio >= 1 ? 0.08 : 0);
    const missPenalty = clamp(misses * 0.04, 0, 0.40);
    const sNorm = clamp(Math.log10(1 + score) / 3.2, 0, 1);

    const raw = clamp(sNorm + taskBonus - missPenalty, 0, 1);

    if (raw >= 0.92) return 'SSS';
    if (raw >= 0.84) return 'SS';
    if (raw >= 0.76) return 'S';
    if (raw >= 0.62) return 'A';
    if (raw >= 0.50) return 'B';
    return 'C';
  }

  // ---------------------------
  // Coach avatar
  // ---------------------------
  const COACH_IMG = {
    neutral: '../img/coach-neutral.png',
    happy:   '../img/coach-happy.png',
    sad:     '../img/coach-sad.png',
    fever:   '../img/coach-fever.png'
  };

  function ensureCoachImg() {
    if (!refs.coachAvatarWrap) return;
    if (!refs.coachAvatarImg) {
      const img = doc.createElement('img');
      img.alt = 'โค้ช';
      refs.coachAvatarWrap.appendChild(img);
      refs.coachAvatarImg = img;
    }
    if (!refs.coachAvatarImg.getAttribute('src')) {
      refs.coachAvatarImg.src = COACH_IMG.neutral;
    }
  }

  function setCoachMood(mood) {
    ensureCoachImg();
    if (!refs.coachAvatarImg) return;
    const key = String(mood || 'neutral').toLowerCase();
    const src =
      COACH_IMG[key] ||
      (key.includes('fever') ? COACH_IMG.fever : null) ||
      (key.includes('happy') ? COACH_IMG.happy : null) ||
      (key.includes('sad') ? COACH_IMG.sad : null) ||
      COACH_IMG.neutral;
    refs.coachAvatarImg.src = src;
  }

  // ---------------------------
  // Water gauge UI
  // ---------------------------
  function setWaterUI(pct, zone) {
    const p = clamp(pct, 0, 100);
    if (refs.waterFill) refs.waterFill.style.width = p.toFixed(0) + '%';

    const z = upper(zone || '');
    if (refs.waterStatus) safeText(refs.waterStatus, `${z || '—'} ${p.toFixed(0)}%`);
    if (refs.waterZoneText) safeText(refs.waterZoneText, z || '—');

    if (refs.waterFill) {
      if (z === 'GREEN') {
        refs.waterFill.style.background = 'linear-gradient(90deg,#22c55e,#4ade80)';
      } else {
        refs.waterFill.style.background = 'linear-gradient(90deg,#f97316,#fb923c)';
      }
    }
  }

  // ---------------------------
  // Quest UI
  // ---------------------------
  function updateQuestUI(detail) {
    if (!detail) return;

    if (detail.goalHeading != null) safeText(refs.questGoal, detail.goalHeading);
    else if (detail.goal && (detail.goal.label || detail.goal.title || detail.goal.text)) {
      safeText(refs.questGoal, 'Goal: ' + (detail.goal.label || detail.goal.title || detail.goal.text));
    }

    if (detail.miniHeading != null) safeText(refs.questMini, detail.miniHeading);
    else if (detail.mini && (detail.mini.label || detail.mini.title || detail.mini.text)) {
      safeText(refs.questMini, 'Mini: ' + (detail.mini.label || detail.mini.title || detail.mini.text));
    }

    const gd = Number(detail.meta?.goalsCleared ?? detail.goalsCleared ?? detail.goalIndex ?? 0) || 0;
    const gt = Number(detail.meta?.goalsTarget  ?? detail.goalTotal   ?? 0) || 0;

    const md =
      Number(
        detail.meta?.questsCleared ??
        detail.meta?.quests ??
        detail.miniIndex ??
        0
      ) || 0;

    const mt =
      Number(
        detail.meta?.questsTarget ??
        detail.meta?.questsTotal ??
        detail.miniTotal ??
        0
      ) || 0;

    if (refs.goalDone)  safeText(refs.goalDone, fmtInt(gd));
    if (refs.goalTotal) safeText(refs.goalTotal, fmtInt(gt || 0));
    if (refs.miniDone)  safeText(refs.miniDone, fmtInt(md));
    if (refs.miniTotal) safeText(refs.miniTotal, fmtInt(mt || 0));
  }

  // ---------------------------
  // Score UI
  // ---------------------------
  let lastScorePayload = null;

  function updateScoreUI(d) {
    if (!d) return;
    lastScorePayload = d;

    if (refs.modeLabel && d.modeLabel) safeText(refs.modeLabel, d.modeLabel);

    if (refs.modePill) {
      const rm = String(d.runMode || '').toUpperCase();
      if (rm) safeText(refs.modePill, rm + ' MODE');
    }

    if (refs.diffPill && d.difficulty) {
      const t = (String(d.difficulty).toUpperCase());
      const dur = (Number(d.durationPlannedSec ?? d.durationSec ?? d.timeSec ?? '') || '').toString();
      safeText(refs.diffPill, dur ? `${t} • ${dur}s` : t);
    }

    if (refs.score) safeText(refs.score, fmtInt(d.score));
    if (refs.comboMax) safeText(refs.comboMax, fmtInt(d.comboMax));
    if (refs.miss) safeText(refs.miss, fmtInt(d.misses ?? d.miss));

    if (d.waterPct != null || d.waterZone != null) {
      setWaterUI(d.waterPct ?? 0, d.waterZone ?? '');
    }

    if (refs.goalDone && refs.goalTotal) {
      const gd = Number(d.goalsCleared ?? 0) || 0;
      const gt = Number(d.goalsTarget ?? d.goalsTotal ?? 0) || 0;
      if (gt) {
        safeText(refs.goalDone, fmtInt(gd));
        safeText(refs.goalTotal, fmtInt(gt));
      }
    }
    if (refs.miniDone && refs.miniTotal) {
      const md = Number(d.questsCleared ?? d.quests ?? d.miniCleared ?? 0) || 0;
      const mt = Number(d.questsTarget ?? d.questsTotal ?? d.miniTotal ?? 0) || 0;
      if (mt) {
        safeText(refs.miniDone, fmtInt(md));
        safeText(refs.miniTotal, fmtInt(mt));
      }
    }

    if (refs.gradeBadge) {
      safeText(refs.gradeBadge, computeGrade(d));
    }
  }

  // ---------------------------
  // Fever UI (ช่วยเสริม)
  // ---------------------------
  function updateFeverUI(d) {
    if (!d) return;
    const fever = clamp(d.fever ?? d.feverValue ?? 0, 0, 100);
    const active = !!(d.active ?? d.feverActive);

    if (refs.feverFill) {
      refs.feverFill.style.width = fever.toFixed(0) + '%';
      refs.feverFill.style.opacity = active ? '1' : '0.9';
    }
    if (refs.feverPct) safeText(refs.feverPct, fever.toFixed(0) + '%');
    if (active) setCoachMood('fever');
  }

  // ---------------------------
  // Coach message
  // ---------------------------
  let coachTimer = null;
  function onCoach(ev) {
    const d = ev?.detail || {};
    const text = d.text || d.message || '';
    if (!text) return;

    if (refs.coachText) safeText(refs.coachText, text);

    const mood = d.mood || d.face || (String(text).includes('🔥') ? 'fever' : null);
    if (mood) setCoachMood(mood);

    if (refs.coachBubble) {
      refs.coachBubble.style.transform = 'scale(1.02)';
      refs.coachBubble.style.transition = 'transform 120ms ease-out';
      if (coachTimer) clearTimeout(coachTimer);
      coachTimer = setTimeout(() => {
        if (!refs.coachBubble) return;
        refs.coachBubble.style.transform = 'scale(1)';
      }, 220);
    }
  }

  // ---------------------------
  // ✅ Celebrate (Goal/Mini/All) from hydration.quest.js
  // ---------------------------
  function onCelebrate(ev) {
    const d = ev?.detail || {};
    const kind = String(d.kind || '').toLowerCase(); // 'goal'|'mini'|'all'
    const label = d.label || '';

    // โค้ชพูด
    if (refs.coachText) {
      if (kind === 'all') {
        safeText(refs.coachText, `สุดยอด! เคลียร์ครบทุกภารกิจแล้ว 🌟`);
        setCoachMood('happy');
      } else if (kind === 'goal') {
        safeText(refs.coachText, `ผ่าน GOAL! ✅ ${label}`);
        setCoachMood('happy');
      } else if (kind === 'mini') {
        safeText(refs.coachText, `ผ่าน MINI! ✨ ${label}`);
        setCoachMood('happy');
      }
    }

    // เรียก FX ถ้ามี particles.js โหลดอยู่
    const P = (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles;
    if (!P) return;

    // ยิงแตก+ป้ายกลางจอแบบง่าย ๆ ด้วย scorePop/burstAt (ปลอดภัยสุด)
    const cx = root.innerWidth / 2;
    const cy = root.innerHeight * (kind === 'all' ? 0.32 : 0.5);

    const title =
      kind === 'all' ? 'ALL CLEAR!' :
      kind === 'goal' ? 'GOAL CLEAR!' :
      'MINI CLEAR!';

    const color =
      kind === 'all' ? '#facc15' :
      kind === 'goal' ? '#22c55e' :
      '#38bdf8';

    if (typeof P.burstAt === 'function') {
      P.burstAt(cx, cy, { color, good: true, count: (kind === 'all' ? 40 : 28) });
    }
    if (typeof P.scorePop === 'function') {
      P.scorePop(cx, cy, 'MISSION CLEAR!', { judgment: title, good: true });
    }
  }

  // ---------------------------
  // End event
  // ---------------------------
  function onEnd(ev) {
    const d = ev?.detail || {};
    updateScoreUI({
      score: d.scoreFinal ?? d.score ?? 0,
      comboMax: d.comboMax ?? 0,
      misses: d.misses ?? 0,
      difficulty: d.difficulty || '',
      goalsCleared: d.goalsCleared ?? '',
      goalsTotal: d.goalsTarget ?? '',
      questsCleared: d.questsCleared ?? d.quests ?? '',
      questsTotal: d.questsTarget ?? d.questsTotal ?? '',
      waterPct: d.waterEnd ?? null,
      waterZone: d.waterZoneEnd ?? null
    });

    if (refs.coachText) {
      safeText(refs.coachText, 'จบเกมแล้ว 🎉 ดูสรุปผลได้เลย');
      setCoachMood('happy');
    }
  }

  // ---------------------------
  // VR button
  // ---------------------------
  function bindVrButton() {
    if (!refs.btnVr) return;
    refs.btnVr.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        root.dispatchEvent(new CustomEvent('hha:enter-vr', { detail: { source: 'hud' } }));
      } catch {}
      const host = doc.getElementById('hvr-playfield');
      if (host && host.scrollIntoView) {
        try { host.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
      }
    }, { passive: false });
  }

  function init() {
    bindRefs();
    ensureCoachImg();
    bindVrButton();

    if (refs.coachText && !refs.coachText.textContent) {
      safeText(refs.coachText, 'พร้อมแล้ว! เล็งแล้วแตะเป้าได้เลย 👀');
    }
    setCoachMood('neutral');

    root.addEventListener('hha:score', (ev) => updateScoreUI(ev.detail));
    root.addEventListener('quest:update', (ev) => updateQuestUI(ev.detail));
    root.addEventListener('hha:coach', onCoach);
    root.addEventListener('hha:fever', (ev) => updateFeverUI(ev.detail));
    root.addEventListener('hha:end', onEnd);

    // ✅ NEW: รับฉลองจาก hydration.quest.js
    root.addEventListener('hha:celebrate', onCelebrate);

    // rebind
    root.addEventListener('hha:rebind-hud', () => {
      bindRefs();
      ensureCoachImg();
      bindVrButton();
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.HUD = {
    rebind() {
      try { root.dispatchEvent(new Event('hha:rebind-hud')); } catch {}
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);