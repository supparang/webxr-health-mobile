// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR) (FIX-ALL)
// ✅ รองรับหลายชื่อ element id (legacy + new)
// ✅ quest:update แสดง GOAL/MINI แบบไม่ค้าง (questOk false ก็โชว์เตือน)
// ✅ รองรับ mini rush window (tLeft/windowSec)
// ✅ hha:fever/hha:score sync shield/fever
// ✅ hha:end แสดง end overlay ถ้ามี
// ✅ ปลอดภัย: element ไม่มี → ข้าม (ไม่ throw)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // ---------- helpers ----------
  const clamp = (v, a, b) => {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  };

  function $(sel) { try { return doc.querySelector(sel); } catch { return null; } }

  function pickId(ids) {
    for (let i = 0; i < ids.length; i++) {
      const el = doc.getElementById(ids[i]);
      if (el) return el;
    }
    return null;
  }

  function setText(el, t) {
    if (!el) return;
    try { el.textContent = (t == null ? '' : String(t)); } catch {}
  }

  function setWidthPct(barFillEl, pct01) {
    if (!barFillEl) return;
    const p = clamp(pct01, 0, 1);
    try { barFillEl.style.width = Math.round(p * 100) + '%'; } catch {}
  }

  function pct01(prog, target) {
    const a = Number(prog) || 0;
    const b = Math.max(1, Number(target) || 1);
    return clamp(a / b, 0, 1);
  }

  function safeDetail(e) { return (e && e.detail) ? e.detail : {}; }

  // ---------- element map (supports legacy + new) ----------
  const E = {
    // time / shield / grade / group label
    time:  pickId(['hud-time', 'timeLeft', 'time', 'hudTime']),
    shield:pickId(['hud-shield', 'shield', 'shieldCount']),
    grade: pickId(['hud-grade', 'grade', 'hudGrade']),
    group: pickId(['hud-group', 'groupLabel', 'hudGroup']),

    // coach
    coachText: pickId(['hud-coach-text', 'coachText', 'hudCoachText']),
    coachImg:  pickId(['hud-coach-img', 'coachImg', 'hudCoachImg']),

    // goal panel
    goalTitle: pickId(['hud-goal-title', 'goalTitle', 'goalText']),
    goalPct:   pickId(['hud-goal-pct', 'goalPct', 'goalPercent']),
    goalCount: pickId(['hud-goal-count', 'goalCount']),
    goalBarFill: (function(){
      const wrap = pickId(['hud-goal-bar', 'goalBar']);
      if (wrap) return wrap.querySelector('i') || wrap.querySelector('.fill') || null;
      // fallback direct fill id
      return pickId(['hud-goal-bar-fill', 'goalBarFill']);
    })(),

    // mini panel
    miniTitle: pickId(['hud-mini-title', 'miniTitle', 'miniText']),
    miniPct:   pickId(['hud-mini-pct', 'miniPct', 'miniPercent']),
    miniExtra: pickId(['hud-mini-extra', 'miniExtra', 'miniHint']),
    miniBarFill: (function(){
      const wrap = pickId(['hud-mini-bar', 'miniBar']);
      if (wrap) return wrap.querySelector('i') || wrap.querySelector('.fill') || null;
      return pickId(['hud-mini-bar-fill', 'miniBarFill']);
    })(),

    // end overlay (optional)
    endOverlay: pickId(['endOverlay', 'hudEnd', 'end']),
    endScore:   pickId(['end-score', 'endScore']),
    endCombo:   pickId(['end-combo', 'endCombo']),
    endMiss:    pickId(['end-miss', 'endMiss']),
    endQuests:  pickId(['end-quests', 'endQuests']),
    endZone:    pickId(['end-zone', 'endZone'])
  };

  // ---------- coach moods (optional) ----------
  const COACH_IMG = {
    neutral: './img/coach-neutral.png',
    happy:   './img/coach-happy.png',
    sad:     './img/coach-sad.png',
    fever:   './img/coach-fever.png'
  };

  function setCoachMood(mood) {
    if (!E.coachImg) return;
    const m = String(mood || 'neutral').toLowerCase();
    const src =
      (m.includes('fever') && COACH_IMG.fever) ? COACH_IMG.fever :
      (m.includes('happy') && COACH_IMG.happy) ? COACH_IMG.happy :
      (m.includes('sad')   && COACH_IMG.sad)   ? COACH_IMG.sad :
      COACH_IMG.neutral;
    try { E.coachImg.src = src; } catch {}
  }

  // ---------- state ----------
  let lastQuestOk = null;

  // ---------- listeners ----------
  root.addEventListener('hha:time', (e) => {
    const d = safeDetail(e);
    if (typeof d.left === 'number') setText(E.time, d.left | 0);
  });

  root.addEventListener('hha:score', (e) => {
    const d = safeDetail(e);
    if (typeof d.shield === 'number') setText(E.shield, d.shield);
    // บางเกมส่ง grade ผ่าน score ก็รับไว้
    if (d.grade) setText(E.grade, d.grade);
  });

  root.addEventListener('hha:rank', (e) => {
    const d = safeDetail(e);
    if (d.grade) setText(E.grade, d.grade);
  });

  root.addEventListener('hha:coach', (e) => {
    const d = safeDetail(e);
    if (d.text) setText(E.coachText, d.text);
    if (d.mood) setCoachMood(d.mood);
  });

  // Fever channel (compat)
  root.addEventListener('hha:fever', (e) => {
    const d = safeDetail(e);
    // ถ้า fever on ให้โค้ชเป็น fever mood (ถ้ามีรูป)
    if (d && d.on) setCoachMood('fever');
  });

  // ✅ QUEST UPDATE (Fix-all)
  root.addEventListener('quest:update', (e) => {
    const d = safeDetail(e);
    const questOk = !!d.questOk;

    // prevent "stuck UI": update even if same
    if (lastQuestOk !== questOk) lastQuestOk = questOk;

    if (!questOk) {
      // show fallback
      setText(E.goalTitle, '—');
      setText(E.goalPct, '0%');
      setText(E.goalCount, '0/0');
      setWidthPct(E.goalBarFill, 0);

      setText(E.miniTitle, '—');
      setText(E.miniPct, '0%');
      setWidthPct(E.miniBarFill, 0);

      // extra message helps debugging without breaking play
      setText(E.miniExtra, '⚠️ QUEST ไม่พร้อม (เช็ค groups-quests.js)');
      setText(E.group, '—');
      return;
    }

    const goal = d.goal || null;
    const mini = d.mini || null;

    // goalsAll/minisAll for counters
    const goalsAll = Array.isArray(d.goalsAll) ? d.goalsAll : [];
    const minisAll = Array.isArray(d.minisAll) ? d.minisAll : [];

    const gCleared = goalsAll.filter(x => x && x.done).length;
    const mCleared = minisAll.filter(x => x && x.done).length;

    // goal block
    if (goal) {
      const p = pct01(goal.prog, goal.target);
      setText(E.goalTitle, goal.label || 'GOAL');
      setText(E.goalPct, Math.round(p * 100) + '%');
      setWidthPct(E.goalBarFill, p);
    } else {
      setText(E.goalTitle, 'GOAL เคลียร์แล้ว ✅');
      setText(E.goalPct, '100%');
      setWidthPct(E.goalBarFill, 1);
    }

    if (E.goalCount) setText(E.goalCount, `${gCleared}/${goalsAll.length || 0}`);

    // mini block
    if (mini) {
      const p = pct01(mini.prog, mini.target);
      setText(E.miniTitle, mini.label || 'MINI');
      setText(E.miniPct, Math.round(p * 100) + '%');
      setWidthPct(E.miniBarFill, p);

      // mini rush window support
      if (typeof mini.tLeft === 'number' && typeof mini.windowSec === 'number') {
        setText(E.miniExtra, `⏱️ เหลือ ${mini.tLeft | 0} วิ / ${mini.windowSec | 0} วิ`);
      } else {
        // show progress text
        setText(E.miniExtra, `(${Number(mini.prog || 0)}/${Number(mini.target || 0)})`);
      }
    } else {
      setText(E.miniTitle, 'MINI เคลียร์หมดแล้ว ⭐');
      setText(E.miniPct, '100%');
      setWidthPct(E.miniBarFill, 1);
      setText(E.miniExtra, `${mCleared}/${minisAll.length || 0}`);
    }

    // group label
    if (d.groupLabel) setText(E.group, d.groupLabel);
  });

  // end overlay (optional)
  root.addEventListener('hha:end', (e) => {
    const d = safeDetail(e);

    const scoreFinal = d.scoreFinal || 0;
    const comboMax = d.comboMax || 0;
    const misses = d.misses || 0;

    const goalsTotal = d.goalsTotal || 0;
    const goalsCleared = d.goalsCleared || 0;
    const miniTotal = d.miniTotal || 0;
    const miniCleared = d.miniCleared || 0;

    const qTotal = goalsTotal + miniTotal;
    const qCleared = goalsCleared + miniCleared;
    const qp = (qTotal > 0) ? Math.round((qCleared / qTotal) * 100) : 0;

    setText(E.endScore, scoreFinal);
    setText(E.endCombo, comboMax);
    setText(E.endMiss, misses);
    setText(E.endQuests, qp + '%');
    if (E.endZone) setText(E.endZone, d.zone || 'ZONE -');

    if (E.endOverlay) {
      try { E.endOverlay.classList.add('show'); } catch {}
      // support legacy display style
      try { E.endOverlay.style.display = 'flex'; } catch {}
    }
  });

  // initial ping (avoid empty HUD)
  // NOTE: We don't emit events here—just keep HUD stable.
  if (!E.goalTitle && !E.miniTitle) {
    // no HUD elements present, silent
  }

})(window);