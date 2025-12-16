// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR)
// รองรับทุกเกม (GoodJunkVR / HydrationVR / PlateVR / GroupsVR ฯลฯ)
// ฟัง event กลางจาก GameEngine / mode-factory แล้วอัปเดต UI:
// - hha:score      (อัปเดตคะแนน/คอมโบ/miss/โซนน้ำ/ฯลฯ)
// - quest:update   (หัวข้อ Goal/Mini + ตัวนับความคืบหน้า)
// - hha:coach      (ข้อความโค้ช + mood → เปลี่ยนรูปโค้ช)
// - hha:fever      (สถานะ fever — เผื่อเกมอยาก sync เพิ่ม)
// - hha:judge      (ข้อความ judgement — เผื่ออยากโชว์เพิ่มในอนาคต)
// - hha:end        (สรุปตอนจบ + ตรึงผล)
// - hha:adaptive   (โชว์ debug เล็ก ๆ ได้ถ้าต้องการ)
// * ทำงานแบบ "ปลอดภัย" ถ้า element ไม่อยู่ก็ข้าม

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

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
    // top water gauge
    waterFill:   null,
    waterStatus: null,

    // main stats
    modeLabel:   null,
    modePill:    null,
    diffPill:    null,
    score:       null,
    comboMax:    null,
    miss:        null,
    waterZoneText: null,

    // grade badge
    gradeBadge:  null,

    // quest card
    questGoal:   null,
    questMini:   null,
    goalDone:    null,
    goalTotal:   null,
    miniDone:    null,
    miniTotal:   null,

    // coach
    coachBubble: null,
    coachText:   null,
    coachName:   null,
    coachAvatarWrap: null,
    coachAvatarImg:  null,

    // fever (ส่วนใหญ่ให้ ui-fever.js ดูแล แต่เราช่วยอัปเดต text บางจุดได้)
    feverFill:   null,
    feverPct:    null,
    shield:      null,

    // vr button
    btnVr:       null,

    // crosshair (ถ้ามี)
    crosshair:   null,
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
  // Grade logic (simple + stable)
  // ---------------------------
  // เกณฑ์นี้ intentionally “อ่อน” เพื่อไม่ทำลาย UX
  // ถ้าคุณมี rubric จริงจาก sessions (accuracyGoodPct ฯลฯ) ค่อย upgrade ได้
  function computeGrade(d) {
    const score = Number(d?.score ?? d?.scoreFinal ?? 0) || 0;
    const misses = Number(d?.misses ?? d?.miss ?? 0) || 0;

    // bonus: เคลียร์ภารกิจ
    const goalsCleared = Number(d?.goalsCleared ?? 0) || 0;
    const goalsTarget  = Number(d?.goalsTarget ?? d?.goalsTotal ?? 0) || 0;
    const questsCleared = Number(d?.questsCleared ?? d?.quests ?? d?.miniCleared ?? 0) || 0;
    const questsTarget  = Number(d?.questsTarget ?? d?.questsTotal ?? d?.miniTotal ?? 0) || 0;

    const goalRatio  = goalsTarget > 0 ? (goalsCleared / goalsTarget) : 0;
    const questRatio = questsTarget > 0 ? (questsCleared / questsTarget) : 0;

    const taskBonus = (goalRatio >= 1 ? 0.10 : 0) + (questRatio >= 1 ? 0.08 : 0);

    // miss penalty: ยิ่งพลาดเยอะยิ่งตัด
    const missPenalty = clamp(misses * 0.04, 0, 0.40);

    // score normalization: ปรับให้อยู่ 0..1 แบบคร่าว ๆ
    // (แต่ละเกมคะแนนต่างกัน) → ใช้ log ให้ยืดหยุ่น
    const sNorm = clamp(Math.log10(1 + score) / 3.2, 0, 1); // score ~ 10^3.2 ≈ 1585 → 1.0

    const raw = clamp(sNorm + taskBonus - missPenalty, 0, 1);

    // map → C..SSS
    if (raw >= 0.92) return 'SSS';
    if (raw >= 0.84) return 'SS';
    if (raw >= 0.76) return 'S';
    if (raw >= 0.62) return 'A';
    if (raw >= 0.50) return 'B';
    return 'C';
  }

  // ---------------------------
  // Coach avatar (optional)
  // ---------------------------
  // ใช้ไฟล์ที่คุณมี:
  // /herohealth/img/coach-fever.png
  // /herohealth/img/coach-happy.png
  // /herohealth/img/coach-neutral.png
  // /herohealth/img/coach-sad.png
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
  // Water gauge UI (top header)
  // ---------------------------
  function setWaterUI(pct, zone) {
    const p = clamp(pct, 0, 100);
    if (refs.waterFill) refs.waterFill.style.width = p.toFixed(0) + '%';

    const z = upper(zone || '');
    if (refs.waterStatus) safeText(refs.waterStatus, `${z || '—'} ${p.toFixed(0)}%`);
    if (refs.waterZoneText) safeText(refs.waterZoneText, z || '—');

    // โทนสีตามโซน (optional)
    // GREEN = เขียว, LOW/HIGH = ส้ม
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

    // Heading strings (preferred)
    if (detail.goalHeading != null) safeText(refs.questGoal, detail.goalHeading);
    else if (detail.goal && (detail.goal.label || detail.goal.title || detail.goal.text)) {
      safeText(refs.questGoal, 'Goal: ' + (detail.goal.label || detail.goal.title || detail.goal.text));
    }

    if (detail.miniHeading != null) safeText(refs.questMini, detail.miniHeading);
    else if (detail.mini && (detail.mini.label || detail.mini.title || detail.mini.text)) {
      safeText(refs.questMini, 'Mini: ' + (detail.mini.label || detail.mini.title || detail.mini.text));
    }

    // Counters
    const gd = Number(detail.meta?.goalsCleared ?? detail.goalsCleared ?? detail.goalIndex ?? 0) || 0;
    const gt = Number(detail.meta?.goalsTarget  ?? detail.goalTotal   ?? 0) || 0;

    // mini counter: รองรับทั้งชื่อเก่า quests/questsTotal และ miniIndex/miniTotal
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
    if (refs.goalTotal) safeText(refs.goalTotal, fmtInt(gt || detail.meta?.goalsTarget || 0));

    if (refs.miniDone)  safeText(refs.miniDone, fmtInt(md));
    if (refs.miniTotal) safeText(refs.miniTotal, fmtInt(mt || detail.meta?.questsTotal || 0));
  }

  // ---------------------------
  // Score UI
  // ---------------------------
  let lastScorePayload = null;

  function updateScoreUI(d) {
    if (!d) return;
    lastScorePayload = d;

    // labels
    if (refs.modeLabel && d.modeLabel) safeText(refs.modeLabel, d.modeLabel);
    if (refs.modePill) {
      const rm = String(d.runMode || '').toUpperCase();
      if (rm) safeText(refs.modePill, rm + ' MODE');
    }

    // diff pill (ถ้าเกมไม่ set เอง)
    if (refs.diffPill && d.difficulty) {
      const t = (String(d.difficulty).toUpperCase());
      // duration อาจมีใน d.durationSec / timeSec / durationPlannedSec
      const dur = (Number(d.durationPlannedSec ?? d.durationSec ?? d.timeSec ?? '') || '').toString();
      safeText(refs.diffPill, dur ? `${t} • ${dur}s` : t);
    }

    // numbers
    if (refs.score) safeText(refs.score, fmtInt(d.score));
    if (refs.comboMax) safeText(refs.comboMax, fmtInt(d.comboMax));
    if (refs.miss) safeText(refs.miss, fmtInt(d.misses ?? d.miss));

    // water
    if (d.waterPct != null || d.waterZone != null) {
      setWaterUI(d.waterPct ?? 0, d.waterZone ?? '');
    }

    // quest counters from score event (fallback)
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

    // grade
    if (refs.gradeBadge) {
      const g = computeGrade(d);
      safeText(refs.gradeBadge, g);
    }
  }

  // ---------------------------
  // Fever UI (ถ้ามี element แต่ ui-fever.js จะเป็นตัวหลัก)
  // ---------------------------
  function updateFeverUI(d) {
    if (!d) return;
    // d.fever / d.active / d.state
    const fever = clamp(d.fever ?? d.feverValue ?? 0, 0, 100);
    const active = !!(d.active ?? d.feverActive);

    if (refs.feverFill) {
      refs.feverFill.style.width = fever.toFixed(0) + '%';
      refs.feverFill.style.opacity = active ? '1' : '0.9';
    }
    if (refs.feverPct) safeText(refs.feverPct, fever.toFixed(0) + '%');

    // mood hint
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

    // mood switching (optional)
    const mood = d.mood || d.face || (String(text).includes('🔥') ? 'fever' : null);
    if (mood) setCoachMood(mood);

    // pulse effect
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
  // End event
  // ---------------------------
  function onEnd(ev) {
    const d = ev?.detail || {};
    // ตรึงค่าใน HUD รอบสุดท้าย
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

    // coach finish
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
      // ให้เกม/หน้าอื่นเป็นคนจัดการ VR จริง ๆ
      try {
        root.dispatchEvent(new CustomEvent('hha:enter-vr', { detail: { source: 'hud' } }));
      } catch {}
      // UX: scroll ไปกลาง playfield
      const host = doc.getElementById('hvr-playfield');
      if (host && host.scrollIntoView) {
        try { host.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
      }
    }, { passive: false });
  }

  // ---------------------------
  // Optional: adaptive debug (ไม่โชว์ แต่เปิดทางให้ใช้ภายหลัง)
  // ---------------------------
  function onAdaptive(ev) {
    // ถ้าต้องการทำป้าย debug ให้ใช้ event นี้ได้
    // const d = ev.detail || {};
    // console.log('[HUD] adaptive', d);
  }

  // ---------------------------
  // Bind all
  // ---------------------------
  function init() {
    bindRefs();
    ensureCoachImg();
    bindVrButton();

    // default coach
    if (refs.coachText && !refs.coachText.textContent) {
      safeText(refs.coachText, 'พร้อมแล้ว! เล็งแล้วแตะเป้าได้เลย 👀');
    }
    setCoachMood('neutral');

    // Listen events
    root.addEventListener('hha:score', (ev) => updateScoreUI(ev.detail));
    root.addEventListener('quest:update', (ev) => updateQuestUI(ev.detail));
    root.addEventListener('hha:coach', onCoach);
    root.addEventListener('hha:fever', (ev) => updateFeverUI(ev.detail));
    root.addEventListener('hha:judge', () => {}); // เผื่อใช้
    root.addEventListener('hha:end', onEnd);

    // adaptive (from mode-factory)
    root.addEventListener('hha:adaptive', onAdaptive);

    // ถ้า DOM ถูก hot-reload / เปลี่ยนหน้าใน SPA
    root.addEventListener('hha:rebind-hud', () => {
      bindRefs();
      ensureCoachImg();
      bindVrButton();
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expose (optional)
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.HUD = {
    rebind() {
      try { root.dispatchEvent(new Event('hha:rebind-hud')); } catch {}
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
