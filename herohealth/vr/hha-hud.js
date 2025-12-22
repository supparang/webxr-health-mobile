// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR) — SAFE/ROBUST
// ✅ ฟัง event ที่ window (แก้ปัญหา quest:update ไม่ติดกับ Patch A)
// ✅ ไม่พังถ้า element ไม่มี (ข้ามได้หมด)
// ✅ รองรับ payload ได้หลายรูปแบบ (ของเก่า/ของใหม่)
// Events:
// - hha:score    {score, goodHits, misses|miss, combo, comboMax, multiplier, ...}
// - hha:time     {timeLeft|secLeft, timeTotal|secTotal, ...}
// - hha:coach    {text|msg, mood:'happy|neutral|sad|fever', ...}
// - hha:fever    {pct|feverPct, active, shield, ...}
// - hha:judge    {text, kind:'PERFECT|HIT|MISS|...'}   (optional)
// - quest:update {goal:{title,cur,max,pct,state,hint,timeLeft,timeTotal}, mini:{...}, meta:{...}} (Patch A)
// - quest:cleared {kind:'goal|mini', title, id} (optional)
// - hha:end      {stats:{...}, grade, ...}
// - hha:adaptive {level, size, rate, ...} (optional)

// NOTE: coach images are expected at /herohealth/img exactly:
// coach-fever.png, coach-happy.png, coach-neutral.png, coach-sad.png

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // prevent double bind
  root.GAME_MODULES = root.GAME_MODULES || {};
  if (root.GAME_MODULES.HUD && root.GAME_MODULES.HUD.__bound) return;

  // ---------------- helpers ----------------
  const isNum = (v) => Number.isFinite(Number(v));
  const toNum = (v, d = 0) => (isNum(v) ? Number(v) : d);
  const clamp01 = (x) => Math.max(0, Math.min(1, toNum(x, 0)));

  function byIdAny(ids) {
    for (const id of ids) {
      const el = doc.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  function qAny(selectors) {
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function setText(el, txt) {
    if (!el) return;
    try { el.textContent = String(txt ?? ''); } catch (_) {}
  }

  function setHTML(el, html) {
    if (!el) return;
    try { el.innerHTML = String(html ?? ''); } catch (_) {}
  }

  function show(el, on = true) {
    if (!el) return;
    try { el.style.display = on ? '' : 'none'; } catch (_) {}
  }

  function setBarPct(el, pct) {
    if (!el) return;
    const p = clamp01(pct);
    // support width-based bars
    try { el.style.width = (p * 100).toFixed(1) + '%'; } catch (_) {}
    // support scaleX-based bars
    try { el.style.transformOrigin = '0 50%'; el.style.transform = 'scaleX(' + p.toFixed(4) + ')'; } catch (_) {}
    // aria
    try { el.setAttribute('aria-valuenow', String(Math.round(p * 100))); } catch (_) {}
  }

  function fmtTime(sec) {
    const s = Math.max(0, sec | 0);
    const m = (s / 60) | 0;
    const r = s - m * 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function pickCoachSrc(mood) {
    const m = String(mood || '').toLowerCase();
    if (m.includes('fever') || m.includes('rage') || m.includes('alert')) return './img/coach-fever.png';
    if (m.includes('sad') || m.includes('warn') || m.includes('oops')) return './img/coach-sad.png';
    if (m.includes('happy') || m.includes('win') || m.includes('good')) return './img/coach-happy.png';
    return './img/coach-neutral.png';
  }

  // ---------------- element map (flexible IDs) ----------------
  const E = {
    // score line
    score: byIdAny(['hud-score', 'hha-score', 'score', 'scoreVal', 'txtScore']),
    combo: byIdAny(['hud-combo', 'hha-combo', 'combo', 'comboVal', 'txtCombo']),
    miss:  byIdAny(['hud-miss', 'hha-miss', 'miss', 'missVal', 'txtMiss']),
    mult:  byIdAny(['hud-mult', 'hha-mult', 'mult', 'multVal', 'txtMult']),
    good:  byIdAny(['hud-good', 'hha-good', 'goodHits', 'goodVal', 'txtGood']),

    // time
    time:  byIdAny(['hud-time', 'hha-time', 'time', 'timeVal', 'txtTime']),
    timeBar: byIdAny(['hud-timebar', 'hha-timebar', 'time-bar', 'timeBar', 'barTime']) || qAny(['.hud-timebar .bar', '.hha-timebar .bar']),

    // fever / shield
    feverBar: byIdAny(['hud-feverbar', 'hha-feverbar', 'fever-bar', 'feverBar', 'barFever']) || qAny(['.hud-fever .bar', '.hha-fever .bar']),
    feverTxt: byIdAny(['hud-fevertext', 'hha-fevertext', 'feverText', 'txtFever']),
    shieldBadge: byIdAny(['hud-shield', 'hha-shield', 'shield', 'shieldBadge']),

    // quest goal
    goalTitle: byIdAny(['hud-goal-title', 'goal-title', 'q-goal-title']),
    goalCur:   byIdAny(['hud-goal-cur', 'goal-cur', 'q-goal-cur']),
    goalMax:   byIdAny(['hud-goal-max', 'goal-max', 'q-goal-max']),
    goalHint:  byIdAny(['hud-goal-hint', 'goal-hint', 'q-goal-hint']),
    goalBar:   byIdAny(['hud-goal-bar', 'goal-bar', 'q-goal-bar']) || qAny(['.hud-goal .bar', '.q-goal .bar']),

    // quest mini
    miniTitle: byIdAny(['hud-mini-title', 'mini-title', 'q-mini-title']),
    miniCur:   byIdAny(['hud-mini-cur', 'mini-cur', 'q-mini-cur']),
    miniMax:   byIdAny(['hud-mini-max', 'mini-max', 'q-mini-max']),
    miniHint:  byIdAny(['hud-mini-hint', 'mini-hint', 'q-mini-hint']),
    miniBar:   byIdAny(['hud-mini-bar', 'mini-bar', 'q-mini-bar']) || qAny(['.hud-mini .bar', '.q-mini .bar']),

    // quest meta
    goalsCleared: byIdAny(['hud-goals-cleared', 'goals-cleared', 'q-goals-cleared']),
    minisCleared: byIdAny(['hud-minis-cleared', 'minis-cleared', 'q-minis-cleared']),

    // coach
    coachImg: byIdAny(['hud-coach-img', 'coach-img', 'hha-coach-img', 'coachAvatar']),
    coachText: byIdAny(['hud-coach-text', 'coach-text', 'hha-coach-text', 'coachMsg']),

    // judge popup (optional)
    judgeText: byIdAny(['hud-judge', 'judge-text', 'hha-judge', 'judgeText']),

    // end overlay (optional)
    endWrap: byIdAny(['hud-end', 'end-overlay', 'hha-end', 'endWrap']),
    endTitle: byIdAny(['hud-end-title', 'end-title', 'hha-end-title']),
    endBody: byIdAny(['hud-end-body', 'end-body', 'hha-end-body']),
    endGrade: byIdAny(['hud-grade', 'grade', 'gradeVal', 'badge-grade']),

    // debug adaptive (optional)
    adaptive: byIdAny(['hud-adaptive', 'hha-adaptive', 'adaptiveText'])
  };

  // ---------------- renderers ----------------
  function onScore(ev) {
    const d = ev?.detail || {};
    const score = toNum(d.score, null);
    const combo = toNum(d.combo, null);
    const comboMax = toNum(d.comboMax, null);
    const misses = toNum((d.miss ?? d.misses), null);
    const mult = toNum(d.multiplier, null);
    const goodHits = toNum(d.goodHits, null);

    if (score !== null) setText(E.score, score);
    if (goodHits !== null) setText(E.good, goodHits);
    if (combo !== null) setText(E.combo, combo);
    if (misses !== null) setText(E.miss, misses);
    if (mult !== null) setText(E.mult, 'x' + mult);

    // grade badge (if someone passes it in score event)
    if (d.grade != null && E.endGrade) setText(E.endGrade, d.grade);
    // sometimes show comboMax if element exists (fallback into title)
    if (!E.combo && comboMax !== null && E.endGrade) {
      // ignore
    }
  }

  function onTime(ev) {
    const d = ev?.detail || {};
    let left = d.timeLeft ?? d.secLeft ?? d.left ?? null;
    let total = d.timeTotal ?? d.secTotal ?? d.total ?? null;

    // if ms
    if (toNum(left, 0) > 1000) left = Math.round(toNum(left, 0) / 1000);
    if (toNum(total, 0) > 1000) total = Math.round(toNum(total, 0) / 1000);

    if (left != null) setText(E.time, fmtTime(toNum(left, 0)));
    if (left != null && total != null && E.timeBar) {
      const pct = (toNum(total, 0) > 0) ? (toNum(left, 0) / toNum(total, 1)) : 0;
      setBarPct(E.timeBar, pct);
    }
  }

  function onCoach(ev) {
    const d = ev?.detail || {};
    const text = d.text ?? d.msg ?? d.message ?? '';
    const mood = d.mood ?? d.state ?? '';
    if (E.coachText) setText(E.coachText, text);
    if (E.coachImg) {
      try {
        const src = pickCoachSrc(mood);
        if (E.coachImg.getAttribute('src') !== src) E.coachImg.setAttribute('src', src);
        if (!E.coachImg.getAttribute('alt')) E.coachImg.setAttribute('alt', 'Coach');
      } catch (_) {}
    }
  }

  function onFever(ev) {
    const d = ev?.detail || {};
    const pct = clamp01(d.pct ?? d.feverPct ?? d.fever ?? 0);
    const shield = !!(d.shield ?? d.shieldOn ?? d.hasShield);
    if (E.feverBar) setBarPct(E.feverBar, pct);
    if (E.feverTxt) setText(E.feverTxt, Math.round(pct * 100) + '%');
    if (E.shieldBadge) {
      show(E.shieldBadge, shield);
      if (shield) setText(E.shieldBadge, '🛡️');
    }
  }

  function onJudge(ev) {
    const d = ev?.detail || {};
    if (!E.judgeText) return;
    const txt = d.text ?? d.label ?? d.kind ?? '';
    if (!txt) return;
    setText(E.judgeText, txt);
    // optional auto-hide if element uses opacity animation (CSS can handle)
  }

  function normalizeQuestPart(part) {
    if (!part) return null;

    // Patch A shape already: {title,cur,max,pct,state,hint,timeLeft,timeTotal}
    const title = part.title ?? part.label ?? '';
    const cur = (part.cur != null) ? toNum(part.cur, 0) : toNum(part.value, 0);
    const max = (part.max != null) ? toNum(part.max, 0) : toNum(part.target, 0);
    const pct = clamp01(part.pct ?? (max > 0 ? (cur / max) : 0));
    const hint = part.hint ?? part.desc ?? '';

    // timer fields (ms)
    const timeLeft = part.timeLeft ?? null;
    const timeTotal = part.timeTotal ?? null;

    return { title, cur, max, pct, hint, state: part.state ?? 'active', timeLeft, timeTotal };
  }

  function onQuestUpdate(ev) {
    const d = ev?.detail || {};
    const goal = normalizeQuestPart(d.goal);
    const mini = normalizeQuestPart(d.mini);
    const meta = d.meta || {};

    if (goal) {
      if (E.goalTitle) setText(E.goalTitle, goal.title || 'ภารกิจหลัก');
      if (E.goalCur) setText(E.goalCur, goal.cur);
      if (E.goalMax) setText(E.goalMax, goal.max);
      if (E.goalHint) setText(E.goalHint, goal.hint || '');
      if (E.goalBar) setBarPct(E.goalBar, goal.pct);

      // if timer-like info present, prefer showing time remaining in hint slot (optional)
      if (goal.timeLeft != null && goal.timeTotal != null && E.goalHint) {
        const l = toNum(goal.timeLeft, 0) > 1000 ? Math.round(toNum(goal.timeLeft, 0) / 1000) : toNum(goal.timeLeft, 0);
        const t = toNum(goal.timeTotal, 0) > 1000 ? Math.round(toNum(goal.timeTotal, 0) / 1000) : toNum(goal.timeTotal, 0);
        setText(E.goalHint, (goal.hint ? goal.hint + ' • ' : '') + fmtTime(l) + ' / ' + fmtTime(t));
      }
    }

    if (mini) {
      if (E.miniTitle) setText(E.miniTitle, mini.title || 'Mini quest');
      if (E.miniCur) setText(E.miniCur, mini.cur);
      if (E.miniMax) setText(E.miniMax, mini.max);
      if (E.miniHint) setText(E.miniHint, mini.hint || '');
      if (E.miniBar) setBarPct(E.miniBar, mini.pct);

      if (mini.timeLeft != null && mini.timeTotal != null && E.miniHint) {
        const l = toNum(mini.timeLeft, 0) > 1000 ? Math.round(toNum(mini.timeLeft, 0) / 1000) : toNum(mini.timeLeft, 0);
        const t = toNum(mini.timeTotal, 0) > 1000 ? Math.round(toNum(mini.timeTotal, 0) / 1000) : toNum(mini.timeTotal, 0);
        setText(E.miniHint, (mini.hint ? mini.hint + ' • ' : '') + fmtTime(l) + ' / ' + fmtTime(t));
      }
    }

    if (E.goalsCleared && meta.goalsCleared != null) setText(E.goalsCleared, meta.goalsCleared);
    if (E.minisCleared && meta.minisCleared != null) setText(E.minisCleared, meta.minisCleared);
  }

  function onQuestCleared(ev) {
    // optional tiny toast; if you want, wire to judgeText
    const d = ev?.detail || {};
    if (!E.judgeText) return;
    const kind = String(d.kind || '').toLowerCase();
    const title = d.title || '';
    if (!title) return;
    setText(E.judgeText, (kind === 'goal' ? 'GOAL CLEAR 🎉 ' : 'MINI CLEAR ✅ ') + title);
  }

  function onAdaptive(ev) {
    const d = ev?.detail || {};
    if (!E.adaptive) return;
    const parts = [];
    if (d.level != null) parts.push('level:' + d.level);
    if (d.size != null) parts.push('size:' + d.size);
    if (d.rate != null) parts.push('rate:' + d.rate);
    if (d.note != null) parts.push(String(d.note));
    setText(E.adaptive, parts.join(' • '));
  }

  function onEnd(ev) {
    const d = ev?.detail || {};
    if (E.endWrap) show(E.endWrap, true);

    if (d.grade != null && E.endGrade) setText(E.endGrade, d.grade);

    const title = d.title ?? 'สรุปผลการเล่น';
    if (E.endTitle) setText(E.endTitle, title);

    const stats = d.stats || d;
    if (E.endBody) {
      // safe quick summary (edit ids freely in HTML)
      const lines = [];
      if (stats.score != null) lines.push('คะแนน: <b>' + stats.score + '</b>');
      if (stats.goodHits != null) lines.push('เก็บของดี: <b>' + stats.goodHits + '</b>');
      if (stats.miss != null || stats.misses != null) lines.push('MISS: <b>' + (stats.miss ?? stats.misses) + '</b>');
      if (stats.comboMax != null) lines.push('คอมโบสูงสุด: <b>' + stats.comboMax + '</b>');
      if (stats.goalsCleared != null) lines.push('Goals เคลียร์: <b>' + stats.goalsCleared + '</b>');
      if (stats.minisCleared != null) lines.push('Minis เคลียร์: <b>' + stats.minisCleared + '</b>');
      setHTML(E.endBody, lines.join('<br>'));
    }
  }

  // ---------------- bind listeners (✅ window) ----------------
  const on = (name, fn) => root.addEventListener(name, fn, { passive: true });
  on('hha:score', onScore);
  on('hha:time', onTime);
  on('hha:coach', onCoach);
  on('hha:fever', onFever);
  on('hha:judge', onJudge);
  on('quest:update', onQuestUpdate);
  on('quest:cleared', onQuestCleared);
  on('hha:adaptive', onAdaptive);
  on('hha:end', onEnd);

  // expose module
  root.GAME_MODULES.HUD = {
    __bound: true,
    refresh() {
      // noop: events drive UI; keep for compatibility
    }
  };
})(window);