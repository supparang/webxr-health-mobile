// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR)
// รองรับทุกเกม (GoodJunkVR / HydrationVR / PlateVR / GroupsVR ฯลฯ)
// ฟัง event กลางจาก GameEngine / mode-factory แล้วอัปเดต UI:
// - hha:score      (อัปเดตคะแนน/คอมโบ/miss/โซนน้ำ/ฯลฯ)
// - quest:update   (หัวข้อ Goal/Mini + ตัวนับความคืบหน้า)
// - hha:coach      (ข้อความโค้ช + mood → เปลี่ยนรูปโค้ช)
// - hha:fever      (sync fever -> เรียก FeverUI ถ้ามี)
// - hha:end        (สรุปตอนจบ + ตรึงผล)
// - hha:adaptive   (debug เล็ก ๆ)
// ✅ NEW:
// - hha:celebrate  (ฉลองจบ mini/goal/all จาก quest deck)

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

  function nowMs() {
    return (root.performance && performance.now) ? performance.now() : Date.now();
  }

  // ---------------------------
  // External modules (optional)
  // ---------------------------
  const FeverUI =
    (root.GAME_MODULES && root.GAME_MODULES.FeverUI) ||
    root.FeverUI ||
    null;

  const WaterUI =
    (root.GAME_MODULES && root.GAME_MODULES.WaterUI) ||
    root.WaterUI ||
    null;

  function getParticles() {
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
           root.Particles ||
           null;
  }

  // ---------------------------
  // DOM refs (optional)
  // ---------------------------
  const refs = {
    // top water gauge (ถ้าหน้านั้นมี element เอง)
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

    // fever (ถ้าหน้านั้นมี element legacy)
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
  // Coach avatar (optional)
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
  // Water gauge UI (ถ้ามี element บนหน้า / หรือมี module ui-water.js)
  // ---------------------------
  function setWaterUI(pct, zone) {
    const p = clamp(pct, 0, 100);
    const z = upper(zone || '');

    // ถ้ามี module (แนะนำ) → ให้ module จัดการ UI เอง
    if (WaterUI && typeof WaterUI.setWaterGauge === 'function') {
      try { WaterUI.setWaterGauge(p); } catch {}
    } else if (root.setWaterGauge) {
      try { root.setWaterGauge(p); } catch {}
    }

    // ถ้ามี element legacy บนหน้า → sync ให้ด้วย
    if (refs.waterFill) refs.waterFill.style.width = p.toFixed(0) + '%';
    if (refs.waterStatus) safeText(refs.waterStatus, `${z || '—'} ${p.toFixed(0)}%`);
    if (refs.waterZoneText) safeText(refs.waterZoneText, z || '—');

    if (refs.waterFill) {
      if (z === 'GREEN') refs.waterFill.style.background = 'linear-gradient(90deg,#22c55e,#4ade80)';
      else refs.waterFill.style.background = 'linear-gradient(90deg,#f97316,#fb923c)';
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

    const md = Number(detail.meta?.questsCleared ?? detail.meta?.quests ?? detail.miniIndex ?? 0) || 0;
    const mt = Number(detail.meta?.questsTarget  ?? detail.meta?.questsTotal ?? detail.miniTotal ?? 0) || 0;

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
      if (gt) { safeText(refs.goalDone, fmtInt(gd)); safeText(refs.goalTotal, fmtInt(gt)); }
    }
    if (refs.miniDone && refs.miniTotal) {
      const md = Number(d.questsCleared ?? d.quests ?? d.miniCleared ?? 0) || 0;
      const mt = Number(d.questsTarget ?? d.questsTotal ?? d.miniTotal ?? 0) || 0;
      if (mt) { safeText(refs.miniDone, fmtInt(md)); safeText(refs.miniTotal, fmtInt(mt)); }
    }

    if (refs.gradeBadge) {
      const g = computeGrade(d);
      safeText(refs.gradeBadge, g);
    }
  }

  // ---------------------------
  // Fever UI (sync to ui-fever.js ถ้ามี)
  // ---------------------------
  function updateFeverUI(d) {
    if (!d) return;
    const fever = clamp(d.fever ?? d.feverValue ?? 0, 0, 100);
    const active = !!(d.active ?? d.feverActive);

    // แนะนำให้ ui-fever.js เป็นตัวหลัก
    if (FeverUI) {
      try { FeverUI.ensureFeverBar && FeverUI.ensureFeverBar(); } catch {}
      try { FeverUI.setFever && FeverUI.setFever(fever); } catch {}
      try { FeverUI.setFeverActive && FeverUI.setFeverActive(active); } catch {}
      if (d.shield != null || d.shieldCount != null) {
        try { FeverUI.setShield && FeverUI.setShield(Number(d.shield ?? d.shieldCount ?? 0) || 0); } catch {}
      }
    }

    // ถ้ามี element legacy บนหน้า → sync ให้ด้วย
    if (refs.feverFill) {
      refs.feverFill.style.width = fever.toFixed(0) + '%';
      refs.feverFill.style.opacity = active ? '1' : '0.9';
    }
    if (refs.feverPct) safeText(refs.feverPct, fever.toFixed(0) + '%');
    if (refs.shield && (d.shield != null || d.shieldCount != null)) {
      safeText(refs.shield, fmtInt(d.shield ?? d.shieldCount ?? 0));
    }

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
  // ✅ Celebration Toast (NEW)
  // ---------------------------
  let toastWrap = null;
  let toastTimer = null;
  let lastToastAt = 0;

  function ensureToastStyle() {
    if (doc.getElementById('hha-toast-style')) return;
    const style = doc.createElement('style');
    style.id = 'hha-toast-style';
    style.textContent = `
      .hha-toast{
        position:fixed;
        left:50%;
        top:18%;
        transform:translate3d(-50%, -8px, 0) scale(.98);
        z-index:920; /* เหนือ HUD */
        pointer-events:none;
        opacity:0;
        transition:opacity .18s ease-out, transform .18s ease-out;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        filter: drop-shadow(0 18px 30px rgba(15,23,42,.55));
      }
      .hha-toast.on{
        opacity:1;
        transform:translate3d(-50%, 0, 0) scale(1);
      }
      .hha-toast-card{
        display:flex;
        align-items:center;
        gap:10px;
        padding:10px 12px;
        border-radius:18px;
        background:linear-gradient(135deg, rgba(15,23,42,.96), rgba(2,6,23,.92));
        border:1px solid rgba(148,163,184,.25);
        color:#e5e7eb;
        min-width:260px;
        max-width:min(520px, 86vw);
      }
      .hha-toast-badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-width:44px;
        height:44px;
        border-radius:14px;
        background:radial-gradient(circle at 30% 25%, rgba(34,197,94,.95), rgba(16,185,129,.65));
        border:1px solid rgba(34,197,94,.55);
        box-shadow:0 0 0 2px rgba(34,197,94,.12) inset;
        font-size:22px;
      }
      .hha-toast-badge.goal{ background:radial-gradient(circle at 30% 25%, rgba(250,204,21,.95), rgba(249,115,22,.65)); border-color:rgba(250,204,21,.55); }
      .hha-toast-badge.all{  background:radial-gradient(circle at 30% 25%, rgba(59,130,246,.95), rgba(168,85,247,.60)); border-color:rgba(59,130,246,.55); }

      .hha-toast-title{
        font-weight:800;
        letter-spacing:.02em;
        font-size:14px;
        line-height:1.1;
        margin-bottom:2px;
      }
      .hha-toast-sub{
        font-size:12px;
        color:rgba(226,232,240,.82);
        line-height:1.25;
      }
      .hha-toast-kicker{
        font-size:10px;
        letter-spacing:.14em;
        text-transform:uppercase;
        color:rgba(203,213,225,.72);
        margin-bottom:4px;
      }
    `;
    doc.head.appendChild(style);
  }

  function ensureToast() {
    if (toastWrap && toastWrap.isConnected) return toastWrap;
    ensureToastStyle();
    toastWrap = doc.createElement('div');
    toastWrap.className = 'hha-toast';
    toastWrap.innerHTML = `
      <div class="hha-toast-card">
        <div class="hha-toast-badge mini" id="hha-toast-badge">✨</div>
        <div class="hha-toast-body">
          <div class="hha-toast-kicker" id="hha-toast-kicker">MINI CLEARED</div>
          <div class="hha-toast-title" id="hha-toast-title">ภารกิจสำเร็จ!</div>
          <div class="hha-toast-sub" id="hha-toast-sub">ไปต่อได้เลย</div>
        </div>
      </div>
    `;
    doc.body.appendChild(toastWrap);
    return toastWrap;
  }

  function showToast(kind, title, sub) {
    ensureToast();
    const badge = toastWrap.querySelector('#hha-toast-badge');
    const kicker = toastWrap.querySelector('#hha-toast-kicker');
    const t = toastWrap.querySelector('#hha-toast-title');
    const s = toastWrap.querySelector('#hha-toast-sub');

    const k = String(kind || 'mini').toLowerCase();
    let icon = '✨';
    let kick = 'MINI CLEARED';
    let cls = 'mini';

    if (k === 'goal') { icon = '🏁'; kick = 'GOAL CLEARED'; cls = 'goal'; }
    if (k === 'all')  { icon = '🎆'; kick = 'ALL CLEAR';   cls = 'all';  }

    if (badge) {
      badge.textContent = icon;
      badge.classList.remove('mini','goal','all');
      badge.classList.add(cls);
    }
    if (kicker) kicker.textContent = kick;
    if (t) t.textContent = title || 'ภารกิจสำเร็จ!';
    if (s) s.textContent = sub || '';

    // กันเด้งถี่ ๆ
    const tNow = nowMs();
    const gap = tNow - lastToastAt;
    lastToastAt = tNow;

    toastWrap.classList.remove('on');
    // ถ้า toast มาเร็วมาก ให้เว้น frame
    const delay = (gap < 220) ? 80 : 0;
    setTimeout(() => {
      if (!toastWrap) return;
      toastWrap.classList.add('on');
    }, delay);

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (!toastWrap) return;
      toastWrap.classList.remove('on');
    }, 1200);
  }

  function onCelebrate(ev) {
    const d = ev?.detail || {};
    const kind = String(d.kind || '').toLowerCase() || 'mini';
    const label = d.label || 'ภารกิจสำเร็จ!';
    const id = d.id || '';

    // โค้ชยิ้ม
    if (kind === 'all') setCoachMood('happy');
    else if (kind === 'goal') setCoachMood('happy');

    // Toast
    const sub =
      (kind === 'mini') ? 'เก่งมาก! ทำอันต่อไปเลย 💪' :
      (kind === 'goal') ? 'เป้าหลักผ่านแล้ว! ไปอีกเป้า 🏆' :
      'เคลียร์ครบทุกภารกิจ! สุดยอดมาก 🎉';
    showToast(kind, label, sub);

    // Particles celebration (ถ้ามี)
    const P = getParticles();
    if (P) {
      try {
        if (typeof P.celebrate === 'function') {
          P.celebrate(kind);
        } else if (typeof P.burstAt === 'function') {
          // ยิงแสง/แตกกระจายกลางจอ
          P.burstAt(root.innerWidth * 0.5, root.innerHeight * 0.22, (kind === 'all') ? 36 : 22);
        }
      } catch {}
    }

    // ส่ง hint ให้เกมอื่น/ระบบ logger ถ้าต้องการ
    try {
      root.dispatchEvent(new CustomEvent('hha:event', {
        detail: {
          type: 'CELEBRATE',
          mode: d.mode || '',
          difficulty: d.diff || '',
          emoji: (kind === 'mini') ? '✨' : (kind === 'goal' ? '🏁' : '🎆'),
          extra: JSON.stringify({ kind, id, label })
        }
      }));
    } catch {}
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

    // ปิด toast ถ้าค้าง
    if (toastWrap) toastWrap.classList.remove('on');
  }

  // ---------------------------
  // VR button
  // ---------------------------
  function bindVrButton() {
    if (!refs.btnVr) return;
    refs.btnVr.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try { root.dispatchEvent(new CustomEvent('hha:enter-vr', { detail: { source: 'hud' } })); } catch {}
      const host = doc.getElementById('hvr-playfield');
      if (host && host.scrollIntoView) {
        try { host.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
      }
    }, { passive: false });
  }

  // ---------------------------
  // Adaptive debug (optional)
  // ---------------------------
  function onAdaptive(ev) {
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

    if (refs.coachText && !refs.coachText.textContent) {
      safeText(refs.coachText, 'พร้อมแล้ว! เล็งแล้วแตะเป้าได้เลย 👀');
    }
    setCoachMood('neutral');

    // Listen events
    root.addEventListener('hha:score', (ev) => updateScoreUI(ev.detail));
    root.addEventListener('quest:update', (ev) => updateQuestUI(ev.detail));
    root.addEventListener('hha:coach', onCoach);
    root.addEventListener('hha:fever', (ev) => updateFeverUI(ev.detail));
    root.addEventListener('hha:end', onEnd);

    // adaptive (from mode-factory)
    root.addEventListener('hha:adaptive', onAdaptive);

    // ✅ celebration
    root.addEventListener('hha:celebrate', onCelebrate);

    // rebind
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