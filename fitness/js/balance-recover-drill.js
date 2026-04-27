// === /fitness/js/balance-recover-drill.js ===
// Recover Drill 15s — HeroHealth mini game
// FINAL PATCH v20260415-recover-drill-mini-v1

(() => {
  'use strict';

  const W = window;
  const D = document;
  const $ = (sel, root = D) => root.querySelector(sel);

  const qs = new URLSearchParams(location.search);

  const q = (k, d = '') => {
    const v = qs.get(k);
    return v == null || v === '' ? d : v;
  };

  const qNum = (k, d = 0) => {
    const n = Number(q(k, d));
    return Number.isFinite(n) ? n : d;
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const lerp = (a, b, t) => a + (b - a) * t;
  const nowMs = () => (W.performance && performance.now ? performance.now() : Date.now());

  const GAME_ID = 'balancerecover';
  const SUMMARY_KEY = 'HHA_BALANCE_RECOVER_LAST_SUMMARY';
  const SESSION_KEY = 'HHA_BALANCE_RECOVER_LAST_SESSION';
  const HISTORY_KEY = 'HHA_BALANCE_RECOVER_HISTORY';
  const EXPORT_KEY = 'HHA_BALANCE_RECOVER_TEACHER_EXPORT_LAST_V1';

  const ctx = {
    pid: q('pid', 'anon'),
    name: q('name', q('nickName', q('nick', 'Player'))),
    studyId: q('studyId', ''),
    zone: q('zone', 'fitness'),
    cat: q('cat', 'fitness'),
    game: q('game', GAME_ID),
    gameId: q('gameId', GAME_ID),
    theme: q('theme', GAME_ID),
    mode: q('mode', 'mini'),
    run: q('run', 'play'),
    diff: q('diff', 'normal'),
    time: qNum('time', 15),
    seed: q('seed', String(Date.now())),
    view: q('view', 'mobile'),
    hub: q('hub', '../herohealth/hub-v2.html'),
    log: q('log', '0') === '1',
    debug: q('debug', '0') === '1',
    api: q('api', ''),
    weekNo: q('weekNo', ''),
    sessionNo: q('sessionNo', ''),
    grade: q('grade', ''),
    teacher: q('teacher', ''),

    sourceGame: q('sourceGame', 'balancehold'),
    sourceSessionId: q('sourceSessionId', ''),
    sourceGrade: q('sourceGrade', ''),
    sourceRank: q('sourceRank', ''),
    sourceOutCount: qNum('sourceOutCount', 0),
    sourceValidHoldRatio: Number(q('sourceValidHoldRatio', '0')) || 0,
    sourceAvgRecoveryLatency: qNum('sourceAvgRecoveryLatency', 0),
    sourceBossPassed: q('sourceBossPassed', ''),
    recommendReason: q('recommendReason', q('sourceReason', ''))
  };

  const root = $('#rdGame');
  const arena = $('#rdArena');
  const elTarget = $('#rdTarget');
  const elCursor = $('#rdCursor');
  const elPulse = $('#rdPulse');
  const elArrow = $('#rdArrow');
  const elCue = $('#rdCue');
  const elHoldText = $('#rdHoldText');
  const elCoach = $('#rdCoach');
  const elCoachMood = $('#rdCoachMood');
  const elOverlay = $('#rdOverlay');
  const elFlash = $('#rdFlash');
  const elPop = $('#rdPop');
  const elBanner = $('#rdBanner');
  const elToast = $('#rdToast');

  const elTime = $('#rdTime');
  const elSuccess = $('#rdSuccess');
  const elMiss = $('#rdMiss');
  const elBest = $('#rdBest');

  if (!root || !arena || !elTarget || !elCursor || !elOverlay) {
    return;
  }

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const seedFn = xmur3(String(ctx.seed));
  const rand = mulberry32(seedFn());

  const sessionId = [
    ctx.gameId,
    ctx.pid || 'anon',
    Date.now(),
    String(ctx.seed).slice(0, 12)
  ].join('_');

  let eventSeq = 0;

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function toast(msg) {
    if (!elToast) return;
    elToast.textContent = msg;
    elToast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => elToast.classList.remove('show'), 1800);
  }

  function emitWindowEvent(name, detail) {
    try {
      W.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function baseEventPayload() {
    const t = Date.now();
    const iso = new Date(t).toISOString();
    return {
      event_id: `${sessionId}_${String(++eventSeq).padStart(4, '0')}`,
      event_seq: eventSeq,
      ts_ms: t,
      ts_iso: iso,
      session_id: sessionId,
      pid: ctx.pid,
      name: ctx.name,
      studyId: ctx.studyId,
      game: ctx.game,
      gameId: ctx.gameId,
      zone: ctx.zone,
      cat: ctx.cat,
      mode: ctx.mode,
      run: ctx.run,
      diff: ctx.diff,
      view: ctx.view,
      seed: ctx.seed,
      sourceGame: ctx.sourceGame,
      sourceSessionId: ctx.sourceSessionId
    };
  }

  function storeEventLocally(evt) {
    const key = `HHA_EVENT_BUFFER_${ctx.gameId}`;
    const allKey = 'HHA_EVENT_BUFFER_ALL';

    try {
      const arr = safeJsonParse(localStorage.getItem(key), []);
      arr.push(evt);
      localStorage.setItem(key, JSON.stringify(arr.slice(-400)));
    } catch (_) {}

    try {
      const arr = safeJsonParse(localStorage.getItem(allKey), []);
      arr.push(evt);
      localStorage.setItem(allKey, JSON.stringify(arr.slice(-1500)));
    } catch (_) {}
  }

  function logEvent(type, data = {}) {
    const evt = { ...baseEventPayload(), type, ...data };
    storeEventLocally(evt);
    emitWindowEvent('hha:event', evt);
    emitWindowEvent(`hha:${type}`, evt);

    if (ctx.log || ctx.debug) {
      console.log('[RecoverDrill:event]', type, evt);
    }

    if (typeof W.HHA_LOG_EVENT === 'function') {
      try { W.HHA_LOG_EVENT(evt); } catch (_) {}
    }
    if (W.HHA && typeof W.HHA.logEvent === 'function') {
      try { W.HHA.logEvent(evt); } catch (_) {}
    }

    return evt;
  }

  function flushEventBuffer(reason = 'manual') {
    emitWindowEvent('hha:flush', {
      gameId: ctx.gameId,
      sessionId,
      reason,
      ts: new Date().toISOString()
    });
  }

  function cfgForDiff(diff) {
    if (diff === 'easy') {
      return {
        radius: 62,
        holdMs: 500,
        ttlMs: 3200,
        minOffset: 82,
        maxOffset: 118,
        perfectMs: 760,
        spring: 0.18,
        drag: 0.84,
        includeDiagonal: false
      };
    }
    if (diff === 'hard') {
      return {
        radius: 42,
        holdMs: 720,
        ttlMs: 2300,
        minOffset: 132,
        maxOffset: 182,
        perfectMs: 680,
        spring: 0.22,
        drag: 0.82,
        includeDiagonal: true
      };
    }
    return {
      radius: 52,
      holdMs: 600,
      ttlMs: 2700,
      minOffset: 104,
      maxOffset: 148,
      perfectMs: 720,
      spring: 0.2,
      drag: 0.83,
      includeDiagonal: true
    };
  }

  const CFG = cfgForDiff(ctx.diff);

  const G = {
    phase: 'tutorial',
    phaseAt: 0,
    startedAt: 0,
    timeLeftMs: ctx.time * 1000,
    summaryShown: false,

    attempts: 0,
    successCount: 0,
    missCount: 0,
    perfectCount: 0,
    score: 0,

    recoverMsSum: 0,
    recoverMsN: 0,
    bestRecoverMs: 0,

    holdStableMsSum: 0,
    holdStableMsN: 0,

    active: null,

    cursor: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0
    },

    input: {
      active: false,
      tx: 0,
      ty: 0,
      pointerId: null
    },

    fx: {
      lastSuccessAt: 0
    },

    events: []
  };

  function getArenaRect() {
    return arena.getBoundingClientRect();
  }

  function arenaSize() {
    const r = getArenaRect();
    return {
      w: Math.max(320, r.width),
      h: Math.max(320, r.height)
    };
  }

  function centerPos() {
    const { w, h } = arenaSize();
    return { x: w * 0.5, y: h * 0.54 };
  }

  function placeEl(el, x, y, r = null) {
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (r != null) {
      el.style.width = `${r * 2}px`;
      el.style.height = `${r * 2}px`;
      el.style.marginLeft = `${-r}px`;
      el.style.marginTop = `${-r}px`;
    }
  }

  function showOverlay(html) {
    elOverlay.hidden = false;
    elOverlay.innerHTML = html;
  }

  function hideOverlay() {
    elOverlay.hidden = true;
    elOverlay.innerHTML = '';
  }

  function setCue(text) {
    if (elCue) elCue.textContent = text || '';
  }

  function setCoach(text) {
    if (elCoach) elCoach.textContent = text || '';
  }

  function kickClass(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function setCoachMood(mood = 'neutral', emoji = '') {
    if (!elCoachMood) return;
    if (emoji) elCoachMood.textContent = emoji;
    else if (mood === 'happy') elCoachMood.textContent = '😄';
    else if (mood === 'warn') elCoachMood.textContent = '😯';
    else if (mood === 'great') elCoachMood.textContent = '🤩';
    else elCoachMood.textContent = '🙂';
    kickClass(elCoachMood, 'rd-coach-bounce');
  }

  function flash() {
    kickClass(elFlash, 'rd-flash-on');
  }

  function pulseTarget() {
    kickClass(elPulse, 'rd-pulse-on');
  }

  function showPop(text = 'Great Save!') {
    if (!elPop) return;
    elPop.textContent = text;
    kickClass(elPop, 'rd-pop-show');
  }

  function showBanner(text = 'READY!') {
    if (!elBanner) return;
    elBanner.textContent = text;
    kickClass(elBanner, 'rd-banner-show');
  }

  function updateHUD() {
    if (elTime) elTime.textContent = `${Math.max(0, G.timeLeftMs / 1000).toFixed(1)}s`;
    if (elSuccess) elSuccess.textContent = String(G.successCount);
    if (elMiss) elMiss.textContent = String(G.missCount);
    if (elBest) elBest.textContent = G.bestRecoverMs ? `${G.bestRecoverMs} ms` : '-';

    if (elHoldText && G.active) {
      const pct = G.active.holdTargetMs > 0
        ? Math.round((G.active.holdAccumMs / G.active.holdTargetMs) * 100)
        : 0;
      elHoldText.textContent = `${clamp(pct, 0, 100)}%`;
    } else if (elHoldText) {
      elHoldText.textContent = '0%';
    }
  }

  function resetCursor() {
    const c = centerPos();
    G.cursor.x = c.x;
    G.cursor.y = c.y;
    G.cursor.vx = 0;
    G.cursor.vy = 0;
    G.input.tx = c.x;
    G.input.ty = c.y;
  }

  function pointerToArena(e) {
    const r = getArenaRect();
    return {
      x: clamp(e.clientX - r.left, 0, r.width),
      y: clamp(e.clientY - r.top, 0, r.height)
    };
  }

  function onPointerDown(e) {
    G.input.active = true;
    G.input.pointerId = e.pointerId;
    const p = pointerToArena(e);
    G.input.tx = p.x;
    G.input.ty = p.y;
    try { arena.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(e) {
    if (!G.input.active) return;
    if (G.input.pointerId != null && e.pointerId !== G.input.pointerId) return;
    const p = pointerToArena(e);
    G.input.tx = p.x;
    G.input.ty = p.y;
  }

  function onPointerUp(e) {
    if (G.input.pointerId != null && e.pointerId !== G.input.pointerId) return;
    G.input.active = false;
    G.input.pointerId = null;
    const c = centerPos();
    G.input.tx = c.x;
    G.input.ty = c.y;
  }

  arena.addEventListener('pointerdown', onPointerDown);
  W.addEventListener('pointermove', onPointerMove);
  W.addEventListener('pointerup', onPointerUp);
  W.addEventListener('pointercancel', onPointerUp);

  function arrowForPattern(pattern) {
    if (pattern === 'left') return '←';
    if (pattern === 'right') return '→';
    if (pattern === 'up') return '↑';
    if (pattern === 'diag-ne') return '↗';
    if (pattern === 'diag-nw') return '↖';
    return '•';
  }

  function choosePattern() {
    const base = ['left', 'right', 'up'];
    if (CFG.includeDiagonal) {
      base.push('diag-ne', 'diag-nw');
    }
    return base[Math.floor(rand() * base.length)];
  }

  function offsetForPattern(pattern, amount) {
    if (pattern === 'left') return { x: -amount, y: 0 };
    if (pattern === 'right') return { x: amount, y: 0 };
    if (pattern === 'up') return { x: 0, y: -amount };
    if (pattern === 'diag-ne') return { x: amount * 0.72, y: -amount * 0.62 };
    if (pattern === 'diag-nw') return { x: -amount * 0.72, y: -amount * 0.62 };
    return { x: 0, y: 0 };
  }

  function spawnTarget() {
    if (G.timeLeftMs <= 0) return finishGame();

    const center = centerPos();
    const amount = lerp(CFG.minOffset, CFG.maxOffset, rand());
    const pattern = choosePattern();
    const offset = offsetForPattern(pattern, amount);

    const tx = center.x + offset.x;
    const ty = center.y + offset.y;

    G.attempts += 1;
    G.active = {
      index: G.attempts,
      pattern,
      x: tx,
      y: ty,
      r: CFG.radius,
      spawnedAt: nowMs(),
      ttlMs: CFG.ttlMs,
      holdTargetMs: CFG.holdMs,
      holdAccumMs: 0,
      inside: false,
      success: false
    };

    placeEl(elTarget, tx, ty, CFG.radius);
    placeEl(elPulse, tx, ty, CFG.radius);

    const kick = offsetForPattern(pattern, amount * 0.34);
    G.cursor.vx = -kick.x * 0.045;
    G.cursor.vy = -kick.y * 0.045;
    G.cursor.x = center.x - kick.x * 0.22;
    G.cursor.y = center.y - kick.y * 0.22;

    elArrow.textContent = arrowForPattern(pattern);
    elArrow.classList.remove('hidden');

    setCue(`Recover ${pattern}`);
    setCoachMood('warn', '😯');
    setCoach('ดึงกลับเข้าเป้าให้ไว แล้วค้างให้นิ่ง');
    elTarget.classList.add('is-active');
    elTarget.classList.remove('is-hold', 'is-danger');

    logEvent('spawn', {
      spawn_index: G.attempts,
      pattern,
      target_x: Math.round(tx),
      target_y: Math.round(ty),
      target_radius: CFG.radius,
      ttl_ms: CFG.ttlMs,
      hold_ms: CFG.holdMs
    });
  }

  function markSuccess(recoverMs, holdStableMs) {
    if (!G.active || G.active.success) return;
    G.active.success = true;

    G.successCount += 1;
    G.recoverMsSum += recoverMs;
    G.recoverMsN += 1;
    G.bestRecoverMs = G.bestRecoverMs ? Math.min(G.bestRecoverMs, recoverMs) : recoverMs;
    G.holdStableMsSum += holdStableMs;
    G.holdStableMsN += 1;

    const perfect = recoverMs < CFG.perfectMs;
    if (perfect) G.perfectCount += 1;

    const speedBonus = perfect ? 40 : recoverMs < 1000 ? 20 : 0;
    const holdBonus = holdStableMs >= CFG.holdMs ? 20 : 0;
    const pts = 100 + speedBonus + holdBonus;

    G.score += pts;
    pulseTarget();
    flash();
    showPop(perfect ? 'Perfect Recover!' : 'Great Save!');
    showBanner(perfect ? 'PERFECT!' : 'SAVE!');
    setCoachMood(perfect ? 'great' : 'happy', perfect ? '🤩' : '😄');
    setCoach(perfect ? 'เร็วมาก! นิ่งด้วย' : 'ดีมาก กลับเข้าเป้าได้แล้ว');

    elArrow.classList.add('hidden');

    logEvent('recover_success', {
      spawn_index: G.active.index,
      pattern: G.active.pattern,
      recover_ms: Math.round(recoverMs),
      hold_ms: Math.round(holdStableMs),
      perfect: perfect ? 1 : 0,
      score_delta: pts
    });

    G.active = null;
    setTimeout(() => {
      if (!G.summaryShown) spawnTarget();
    }, 320);
  }

  function markMiss(reason = 'timeout') {
    if (!G.active) return;

    G.missCount += 1;
    const failed = G.active;
    G.active = null;

    showPop(reason === 'hold_break' ? 'Hold Break!' : 'Try Again');
    showBanner(reason === 'hold_break' ? 'KEEP HOLDING!' : 'MISS');
    setCoachMood('warn', '😯');
    setCoach(reason === 'hold_break' ? 'ค้างต่ออีกนิดจะผ่านแล้ว' : 'ดึงกลับให้ไวขึ้นอีกหน่อย');
    elArrow.classList.add('hidden');

    logEvent('recover_miss', {
      spawn_index: failed.index,
      pattern: failed.pattern,
      miss_reason: reason
    });

    setTimeout(() => {
      if (!G.summaryShown) spawnTarget();
    }, 320);
  }

  function updateCursor(dt) {
    const c = centerPos();
    const driftX = Math.sin(nowMs() * 0.002) * 0.35;
    const driftY = Math.cos(nowMs() * 0.0016) * 0.25;

    const tx = (G.input.active ? G.input.tx : c.x) + driftX;
    const ty = (G.input.active ? G.input.ty : c.y) + driftY;

    const ax = (tx - G.cursor.x) * CFG.spring;
    const ay = (ty - G.cursor.y) * CFG.spring;

    G.cursor.vx = (G.cursor.vx + ax) * CFG.drag;
    G.cursor.vy = (G.cursor.vy + ay) * CFG.drag;

    G.cursor.x += G.cursor.vx * dt * 0.06;
    G.cursor.y += G.cursor.vy * dt * 0.06;

    const { w, h } = arenaSize();
    G.cursor.x = clamp(G.cursor.x, 24, w - 24);
    G.cursor.y = clamp(G.cursor.y, 24, h - 24);

    placeEl(elCursor, G.cursor.x, G.cursor.y, 14);
  }

  function updateActive(dt) {
    if (!G.active) return;

    const d = dist(G.cursor.x, G.cursor.y, G.active.x, G.active.y);
    const inside = d <= G.active.r;

    if (inside) {
      G.active.holdAccumMs += dt;
      elTarget.classList.add('is-hold');
      elTarget.classList.remove('is-danger');
      elCursor.classList.add('is-hold');
      setCue('ค้างให้นิ่ง');
    } else {
      G.active.holdAccumMs = Math.max(0, G.active.holdAccumMs - dt * 0.8);
      elTarget.classList.remove('is-hold');
      elCursor.classList.remove('is-hold');

      const leftMs = G.active.ttlMs - (nowMs() - G.active.spawnedAt);
      if (leftMs < 700) {
        elTarget.classList.add('is-danger');
        setCue('รีบกลับเข้าเป้า!');
      } else {
        elTarget.classList.remove('is-danger');
      }
    }

    const recoverMs = nowMs() - G.active.spawnedAt;
    const holdStableMs = G.active.holdAccumMs;

    if (holdStableMs >= G.active.holdTargetMs) {
      markSuccess(Math.round(recoverMs), Math.round(holdStableMs));
      return;
    }

    if (recoverMs >= G.active.ttlMs) {
      markMiss(holdStableMs > 150 ? 'hold_break' : 'timeout');
      return;
    }
  }

  function computeSummary() {
    const successRate = G.attempts > 0 ? G.successCount / G.attempts : 0;
    const avgRecoverMs = G.recoverMsN > 0 ? Math.round(G.recoverMsSum / G.recoverMsN) : 0;
    const avgHoldStableMs = G.holdStableMsN > 0 ? Math.round(G.holdStableMsSum / G.holdStableMsN) : 0;

    const speedScore =
      avgRecoverMs <= 0 ? 0 :
      avgRecoverMs < 650 ? 1 :
      avgRecoverMs < 850 ? 0.85 :
      avgRecoverMs < 1050 ? 0.7 :
      avgRecoverMs < 1300 ? 0.5 : 0.35;

    const holdScore = clamp(avgHoldStableMs / CFG.holdMs, 0, 1);

    const focusScore = clamp(
      Math.round((successRate * 60) + (speedScore * 25) + (holdScore * 15)),
      0,
      100
    );

    let grade = 'D';
    if (successRate >= 0.9 && avgRecoverMs > 0 && avgRecoverMs <= 700) grade = 'S';
    else if (successRate >= 0.8 && avgRecoverMs > 0 && avgRecoverMs <= 950) grade = 'A';
    else if (successRate >= 0.65) grade = 'B';
    else if (successRate >= 0.45) grade = 'C';

    const recommendation =
      successRate >= 0.85 && avgRecoverMs > 0 && avgRecoverMs <= 900
        ? 'พร้อมกลับไปลอง Balance Hold รอบใหม่'
        : successRate >= 0.6
          ? 'ควรฝึก Recover Drill เพิ่มอีก 1 รอบ'
          : 'ควรฝึก recover เพิ่มก่อนกลับไปเล่น main game';

    const observation =
      successRate >= 0.85
        ? 'ผู้เรียนสามารถดึงกลับเข้าเป้าได้รวดเร็วและรักษาความนิ่งหลัง recover ได้ดี'
        : successRate >= 0.6
          ? 'ผู้เรียน recover ได้ในระดับพอใช้ แต่ยังเสียความนิ่งในช่วง hold หลังกลับเข้าเป้า'
          : 'ผู้เรียนยังใช้เวลา recover ค่อนข้างนาน และมีการหลุดซ้ำหลายครั้ง ควรฝึก recover drill เพิ่ม';

    return {
      sessionId,
      game: ctx.game,
      gameId: ctx.gameId,
      mode: ctx.mode,
      sourceGame: ctx.sourceGame,
      sourceSessionId: ctx.sourceSessionId,
      pid: ctx.pid,
      name: ctx.name,
      studyId: ctx.studyId,
      diff: ctx.diff,
      view: ctx.view,
      timeSec: ctx.time,
      seed: ctx.seed,
      score: G.score,
      attempts: G.attempts,
      successCount: G.successCount,
      missCount: G.missCount,
      successRate: Number(successRate.toFixed(4)),
      avgRecoverMs,
      bestRecoverMs: G.bestRecoverMs || 0,
      avgHoldStableMs,
      perfectCount: G.perfectCount,
      focusScore,
      grade,
      recommendation,
      observation,
      hub: ctx.hub,
      ts: new Date().toISOString()
    };
  }

  function saveSummary(summary) {
    try {
      localStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
      localStorage.setItem(`${SUMMARY_KEY}_${ctx.pid}`, JSON.stringify(summary));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    } catch (_) {}

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        sessionId,
        pid: ctx.pid,
        gameId: ctx.gameId,
        score: summary.score,
        ts: summary.ts
      }));
    } catch (_) {}

    try {
      const arr = safeJsonParse(localStorage.getItem(HISTORY_KEY), []);
      arr.push(summary);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(-30)));
    } catch (_) {}
  }

  function buildTeacherExport(summary) {
    return {
      exported_at: new Date().toISOString(),
      session_id: summary.sessionId,
      pid: ctx.pid,
      player_name: ctx.name,
      game_id: ctx.gameId,
      source_game: ctx.sourceGame,
      source_session_id: ctx.sourceSessionId,
      diff: ctx.diff,
      time_sec: ctx.time,
      score_total: summary.score,
      success_count: summary.successCount,
      miss_count: summary.missCount,
      success_rate: summary.successRate,
      avg_recover_ms: summary.avgRecoverMs,
      best_recover_ms: summary.bestRecoverMs,
      avg_hold_stable_ms: summary.avgHoldStableMs,
      perfect_count: summary.perfectCount,
      focus_score: summary.focusScore,
      grade: summary.grade,
      recommendation: summary.recommendation,
      observation: summary.observation
    };
  }

  function saveTeacherExport(summary) {
    try {
      localStorage.setItem(EXPORT_KEY, JSON.stringify(buildTeacherExport(summary)));
    } catch (_) {}
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8') {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = D.createElement('a');
      a.href = url;
      a.download = filename;
      D.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_) {}
  }

  async function copySummaryText(summary) {
    const text = [
      'Recover Drill Summary',
      `Player: ${ctx.name}`,
      `Grade: ${summary.grade}`,
      `Score: ${summary.score}`,
      `Success: ${summary.successCount}`,
      `Miss: ${summary.missCount}`,
      `Success Rate: ${Math.round(summary.successRate * 100)}%`,
      `Avg Recover: ${summary.avgRecoverMs} ms`,
      `Best Recover: ${summary.bestRecoverMs} ms`,
      `Perfect: ${summary.perfectCount}`,
      `Focus Score: ${summary.focusScore}`,
      `Recommendation: ${summary.recommendation}`,
      `Observation: ${summary.observation}`
    ].join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast('คัดลอกสรุปแล้ว');
      } else {
        toast('คัดลอกอัตโนมัติไม่ได้');
      }
    } catch (_) {
      toast('คัดลอกไม่ได้บนอุปกรณ์นี้');
    }
  }

  function downloadCsv(summary) {
    const row = buildTeacherExport(summary);
    const headers = Object.keys(row);
    const values = headers.map((k) => csvCell(row[k]));
    const csv = [headers.join(','), values.join(',')].join('\n');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadTextFile(`recover-drill-${ctx.pid}-${ts}.csv`, csv, 'text/csv;charset=utf-8');
    toast('ดาวน์โหลด CSV แล้ว');
  }

  function safeNavigate(url, reason = 'navigate') {
    flushEventBuffer(reason);
    try {
      location.href = url;
    } catch (_) {
      location.assign(url);
    }
  }

  function buildMainGameUrl() {
    const u = new URL('../herohealth/balance-hold-vr.html', location.href);

    u.searchParams.set('pid', ctx.pid);
    u.searchParams.set('name', ctx.name);
    u.searchParams.set('zone', 'fitness');
    u.searchParams.set('cat', 'fitness');
    u.searchParams.set('game', 'balancehold');
    u.searchParams.set('gameId', 'balancehold');
    u.searchParams.set('theme', 'balancehold');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('run', 'play');
    u.searchParams.set('diff', ctx.diff === 'hard' ? 'normal' : ctx.diff);
    u.searchParams.set('time', '90');
    u.searchParams.set('view', ctx.view);
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('hub', ctx.hub);

    if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
    return u.toString();
  }

  function finishGame() {
    if (G.summaryShown) return;
    G.summaryShown = true;

    const summary = computeSummary();
    saveSummary(summary);
    saveTeacherExport(summary);

    logEvent('session_end', {
      score_total: summary.score,
      success_count: summary.successCount,
      miss_count: summary.missCount,
      success_rate: summary.successRate,
      avg_recover_ms: summary.avgRecoverMs,
      best_recover_ms: summary.bestRecoverMs,
      perfect_count: summary.perfectCount,
      focus_score: summary.focusScore,
      grade: summary.grade
    });

    renderSummary(summary);
  }

  function renderSummary(summary) {
    showOverlay(`
      <div class="card">
        <h2>Recover Drill Summary</h2>

        <div class="card-grid">
          <div>Success<br><b>${summary.successCount}</b></div>
          <div>Miss<br><b>${summary.missCount}</b></div>
          <div>Avg Recover<br><b>${summary.avgRecoverMs || '-'} ms</b></div>
          <div>Grade<br><b>${summary.grade}</b></div>
        </div>

        <div class="card-grid">
          <div>Score<br><b>${summary.score}</b></div>
          <div>Best Recover<br><b>${summary.bestRecoverMs || '-'} ms</b></div>
          <div>Perfect<br><b>${summary.perfectCount}</b></div>
          <div>Focus Score<br><b>${summary.focusScore}</b></div>
        </div>

        <div class="card-copy">
          <div><b>คำแนะนำ:</b> ${summary.recommendation}</div>
          <div><b>สำหรับครู:</b> ${summary.observation}</div>
        </div>

        <div class="card-actions">
          <button id="rdPlayMainBtn" type="button">🔁 เล่น Main อีกครั้ง</button>
          <button id="rdRetryBtn" type="button">⚡ ฝึก Recover อีก 15s</button>
          <a id="rdBackFitnessBtn" href="../herohealth/fitness-zone.html">🏃 Fitness Zone</a>
        </div>

        <div class="card-actions">
          <button id="rdCopyBtn" type="button">📋 คัดลอกสรุป</button>
          <button id="rdCsvBtn" type="button">📥 ดาวน์โหลด CSV</button>
          <a id="rdBackHubBtn" href="${ctx.hub || '../herohealth/hub-v2.html'}">🏠 HUB</a>
        </div>
      </div>
    `);

    flash();
    showBanner(summary.grade === 'S' ? 'AMAZING!' : summary.grade === 'A' ? 'GREAT SAVE!' : 'GOOD JOB!');
    setCoachMood(summary.grade === 'S' ? 'great' : 'happy', summary.grade === 'S' ? '🤩' : '😄');
    setCoach('จบรอบฝึกแล้ว เลือกไปต่อได้เลย');

    const retryBtn = $('#rdRetryBtn', elOverlay);
    const playMainBtn = $('#rdPlayMainBtn', elOverlay);
    const copyBtn = $('#rdCopyBtn', elOverlay);
    const csvBtn = $('#rdCsvBtn', elOverlay);
    const fitnessBtn = $('#rdBackFitnessBtn', elOverlay);

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        safeNavigate(location.pathname + location.search, 'retry_recover_drill');
      });
    }

    if (playMainBtn) {
      playMainBtn.addEventListener('click', () => {
        safeNavigate(buildMainGameUrl(), 'back_to_main_game');
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => copySummaryText(summary));
    }

    if (csvBtn) {
      csvBtn.addEventListener('click', () => downloadCsv(summary));
    }

    if (fitnessBtn) {
      fitnessBtn.href = ctx.hub && ctx.hub.includes('fitness-zone.html')
        ? ctx.hub
        : '../herohealth/fitness-zone.html';
    }

    emitWindowEvent('hha:session-summary', summary);
    logEvent('summary_ready', {
      score_total: summary.score,
      grade: summary.grade,
      success_rate: summary.successRate
    });
  }

  function showTutorial() {
    showOverlay(`
      <div class="card">
        <h2>Recover Drill เล่นยังไง</h2>

        <div class="card-copy">
          <div>1. เป้าจะกระโดดออกไป</div>
          <div>2. ดึง cursor กลับเข้าเป้าให้ไว</div>
          <div>3. เมื่อเข้าเป้าแล้ว ค้างให้นิ่งจนวงนับเต็ม</div>
          <div>4. ทำให้ได้มากที่สุดใน 15 วินาที</div>
        </div>

        <div class="card-actions">
          <button id="rdStartTutorialBtn" type="button">เริ่มฝึก</button>
          <a href="${ctx.hub || '../herohealth/hub-v2.html'}">กลับ HUB</a>
          <a href="../herohealth/fitness-zone.html">กลับ Fitness Zone</a>
        </div>
      </div>
    `);

    const btn = $('#rdStartTutorialBtn', elOverlay);
    if (btn) {
      btn.addEventListener('click', () => {
        hideOverlay();
        startCountdown();
      });
    }
  }

  function startCountdown() {
    G.phase = 'ready';
    G.phaseAt = nowMs();
    let count = 3;

    showOverlay(`
      <div class="card" style="place-items:center;text-align:center">
        <h2 id="rdCountText" style="font-size:64px">3</h2>
        <div>เตรียมดึงกลับเข้าเป้าให้ไว</div>
      </div>
    `);

    const countEl = $('#rdCountText', elOverlay);

    const timer = setInterval(() => {
      count -= 1;
      if (countEl) countEl.textContent = count > 0 ? String(count) : 'GO!';
      if (count <= 0) {
        clearInterval(timer);
        hideOverlay();
        startRun();
      }
    }, 600);
  }

  function startRun() {
    G.phase = 'running';
    G.phaseAt = nowMs();
    G.startedAt = nowMs();
    G.timeLeftMs = ctx.time * 1000;

    resetCursor();
    updateHUD();
    showBanner('READY!');
    setCoachMood('neutral', '🙂');
    setCoach('ดึงกลับเข้าเป้าให้ไว แล้วค้างให้นิ่ง');
    spawnTarget();

    logEvent('session_start', {
      time_sec: ctx.time,
      diff: ctx.diff,
      source_session_id: ctx.sourceSessionId || ''
    });
  }

  let lastTs = nowMs();

  function tick() {
    const t = nowMs();
    const dt = Math.min(50, t - lastTs);
    lastTs = t;

    updateCursor(dt);
    updateHUD();

    if (G.phase === 'running') {
      G.timeLeftMs = Math.max(0, (ctx.time * 1000) - (t - G.startedAt));
      updateActive(dt);

      if (G.timeLeftMs <= 0) {
        finishGame();
      }
    }

    W.requestAnimationFrame(tick);
  }

  W.addEventListener('beforeunload', () => flushEventBuffer('beforeunload'));
  D.addEventListener('visibilitychange', () => {
    if (D.visibilityState === 'hidden') flushEventBuffer('visibility_hidden');
  });
  W.addEventListener('pagehide', () => flushEventBuffer('pagehide'));

  function boot() {
    resetCursor();
    placeEl(elCursor, G.cursor.x, G.cursor.y, 14);

    const c = centerPos();
    placeEl(elTarget, c.x, c.y, CFG.radius);
    placeEl(elPulse, c.x, c.y, CFG.radius);

    setCue('Recover Drill');
    setCoachMood('neutral', '🙂');
    setCoach('ดึงกลับเข้าเป้าให้ไว แล้วค้างให้นิ่ง');
    showTutorial();

    W.requestAnimationFrame(tick);
  }

  boot();
})();