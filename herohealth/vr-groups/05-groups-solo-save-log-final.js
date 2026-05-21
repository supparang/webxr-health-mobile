/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260520-groups-solo-save-log-final-05
   File: /herohealth/patches/groups/05-groups-solo-save-log-final.js

   Purpose:
   - Save latest summary for Hub / Zone / Teacher view
   - Add HHA event/session logging hook
   - Flush-hardened on summary / pagehide / visibilitychange
   - Never block gameplay if API fails
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260520-groups-solo-save-log-final-05';
  if (window.__HHA_GROUPS_SOLO_SAVE_LOG_FINAL__) return;
  window.__HHA_GROUPS_SOLO_SAVE_LOG_FINAL__ = true;

  const qs = new URLSearchParams(location.search);

  const GAME_ID = 'groups';
  const GAME_NAME = 'Food Groups';
  const MODE = 'solo';
  const ZONE = 'nutrition';

  const START_TS = Date.now();
  const START_ISO = new Date(START_TS).toISOString();

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function safeText(v){
    return String(v === null || v === undefined ? '' : v).trim();
  }

  function safeNumber(v, fallback){
    const n = Number(String(v || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : fallback;
  }

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function viewMode(){
    const raw = String(getParam('view', '')).toLowerCase();

    if (['pc','desktop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function todayKey(){
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('');
  }

  function randomId(prefix){
    return [
      prefix || 'id',
      todayKey(),
      Math.random().toString(36).slice(2, 8),
      Date.now().toString(36)
    ].join('_');
  }

  function storageGet(key){
    try { return sessionStorage.getItem(key) || localStorage.getItem(key); }
    catch(e){ return null; }
  }

  function storageSet(key, value){
    try { localStorage.setItem(key, value); } catch(e) {}
    try { sessionStorage.setItem(key, value); } catch(e) {}
  }

  function storageSetJSON(key, value){
    try {
      storageSet(key, JSON.stringify(value));
    } catch(e) {}
  }

  const SESSION_ID_KEY = [
    'HHA_GROUPS_SOLO_SESSION_ID',
    getParam('pid', 'anon'),
    todayKey()
  ].join('_');

  let SESSION_ID = storageGet(SESSION_ID_KEY);

  if (!SESSION_ID) {
    SESSION_ID = randomId('groups_solo');
    storageSet(SESSION_ID_KEY, SESSION_ID);
  }

  const LOG_ENDPOINT =
    getParam('log', '') ||
    getParam('api', '') ||
    getParam('endpoint', '');

  const state = {
    patch: PATCH_ID,
    sessionId: SESSION_ID,
    gameId: GAME_ID,
    gameName: GAME_NAME,
    mode: MODE,
    zone: ZONE,
    pid: getParam('pid', 'anon'),
    name: getParam('name', 'Hero'),
    studentId: getParam('studentId', getParam('pid', 'anon')),
    studentName: getParam('studentName', getParam('name', 'Hero')),
    classSection: getParam('classSection', ''),
    diff: getParam('diff', 'normal'),
    timeLimit: safeNumber(getParam('time', '90'), 90),
    view: viewMode(),
    seed: getParam('seed', ''),
    studyId: getParam('studyId', ''),
    conditionGroup: getParam('conditionGroup', ''),
    pageUrl: location.href,
    userAgent: navigator.userAgent || '',
    startedAt: START_ISO,
    lastActiveAt: START_ISO,

    actionsCount: 0,
    clickCount: 0,
    keyCount: 0,
    shootCount: 0,
    hhaEventCount: 0,

    correctCount: 0,
    missCount: 0,
    scoreLive: 0,
    comboLive: 0,

    completed: false,
    summarySaved: false,
    lastSummary: null,

    events: []
  };

  function compactEventPayload(detail){
    const out = {};

    if (!detail || typeof detail !== 'object') return out;

    [
      'type',
      'eventType',
      'name',
      'score',
      'combo',
      'correct',
      'wrong',
      'miss',
      'accuracy',
      'target',
      'food',
      'group',
      'ok',
      'phase',
      'message'
    ].forEach(k => {
      if (detail[k] !== undefined && detail[k] !== null) {
        out[k] = detail[k];
      }
    });

    return out;
  }

  function addEvent(type, detail){
    state.lastActiveAt = nowIso();
    state.hhaEventCount += type && String(type).startsWith('hha:') ? 1 : 0;

    const ev = {
      ts: nowIso(),
      t: Math.round((Date.now() - START_TS) / 1000),
      type: String(type || 'event'),
      detail: compactEventPayload(detail)
    };

    state.events.push(ev);

    if (state.events.length > 80) {
      state.events.splice(0, state.events.length - 80);
    }

    updateLiveMetricsFromDetail(detail);
  }

  function updateLiveMetricsFromDetail(detail){
    if (!detail || typeof detail !== 'object') return;

    if (detail.score !== undefined) state.scoreLive = safeNumber(detail.score, state.scoreLive);
    if (detail.combo !== undefined) state.comboLive = safeNumber(detail.combo, state.comboLive);

    const ok =
      detail.ok === true ||
      detail.correct === true ||
      detail.result === 'correct' ||
      detail.type === 'correct';

    const miss =
      detail.miss === true ||
      detail.wrong === true ||
      detail.result === 'wrong' ||
      detail.result === 'miss' ||
      detail.type === 'miss' ||
      detail.type === 'wrong';

    if (ok) state.correctCount += 1;
    if (miss) state.missCount += 1;
  }

  function bodyText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummaryVisible(){
    const t = bodyText();

    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('กลับ Nutrition Zone') ||
      (t.includes('Food Hero') && t.includes('Best Score')) ||
      (t.includes('Mobile Final Polish') && t.includes('Avg Response'))
    );
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findSummaryRoot(){
    const candidates = Array.from(document.querySelectorAll('main,section,article,div'))
      .filter(el => {
        const t = textOf(el);
        if (t.length < 40) return false;

        return (
          t.includes('สรุปผลการเล่น') ||
          t.includes('เล่นอีกครั้ง') ||
          t.includes('กลับ Nutrition Zone') ||
          (t.includes('Food Hero') && t.includes('Best Score'))
        );
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          el,
          area: Math.max(1, r.width * r.height)
        };
      })
      .filter(x => x.area > 12000)
      .sort((a,b) => b.area - a.area);

    return candidates.length ? candidates[0].el : null;
  }

  function findNumberNear(root, labels){
    if (!root) return null;

    const all = Array.from(root.querySelectorAll('*'));
    const wanted = labels.map(x => String(x).toLowerCase());

    for (const el of all) {
      const txt = textOf(el);
      if (!txt) continue;

      const low = txt.toLowerCase();
      const hit = wanted.some(label => low.includes(label.toLowerCase()));

      if (!hit) continue;

      const same = txt.match(/-?\d+(\.\d+)?%?/);
      if (same) return same[0];

      const parent = el.parentElement;
      if (parent) {
        const ptxt = textOf(parent);
        const nums = ptxt.match(/-?\d+(\.\d+)?%?/g);
        if (nums && nums.length) return nums[0];
      }

      const prev = el.previousElementSibling;
      const next = el.nextElementSibling;

      if (prev) {
        const n = textOf(prev).match(/-?\d+(\.\d+)?%?/);
        if (n) return n[0];
      }

      if (next) {
        const n = textOf(next).match(/-?\d+(\.\d+)?%?/);
        if (n) return n[0];
      }
    }

    return null;
  }

  function collectBadges(root){
    if (!root) return [];

    const names = [
      'Golden Hunter',
      'Decoy Dodger',
      'Fever Finisher',
      'Comeback Hero',
      'Mission Master',
      'Veg Master',
      'Food Hero',
      'Event Director'
    ];

    const t = textOf(root);
    return names.filter(name => t.includes(name));
  }

  function collectSummary(){
    const root = findSummaryRoot();
    const allText = textOf(root || document.body);

    const score = findNumberNear(root, ['คะแนน', 'Score']) ||
      (allText.match(/(\d+)\s*คะแนน/) || [])[1];

    const accuracy = findNumberNear(root, ['ความแม่นยำ', 'Accuracy']);

    const combo = findNumberNear(root, ['คอมโบสูงสุด', 'Best Combo', 'Combo']);

    const correct = findNumberNear(root, ['ตอบถูก', 'Correct']);

    const avgResponse = findNumberNear(root, ['Avg Response']);

    const itemsSeen = findNumberNear(root, ['Items Seen']);

    const decoyDodged = findNumberNear(root, ['Decoy Dodged']);

    const badgeCollected = findNumberNear(root, ['Badge Collected']);

    const summary = {
      patch: PATCH_ID,
      sessionId: SESSION_ID,
      gameId: GAME_ID,
      gameName: GAME_NAME,
      mode: MODE,
      zone: ZONE,

      pid: state.pid,
      name: state.name,
      studentId: state.studentId,
      studentName: state.studentName,
      classSection: state.classSection,

      diff: state.diff,
      view: state.view,
      timeLimit: state.timeLimit,
      seed: state.seed,
      studyId: state.studyId,
      conditionGroup: state.conditionGroup,

      score: safeNumber(score, state.scoreLive),
      accuracy: safeText(accuracy || ''),
      bestCombo: safeNumber(combo, state.comboLive),
      correct: safeNumber(correct, state.correctCount),
      miss: state.missCount,

      avgResponseMs: safeNumber(avgResponse, null),
      itemsSeen: safeNumber(itemsSeen, null),
      decoyDodged: safeNumber(decoyDodged, null),
      badgeCollected: safeNumber(badgeCollected, null),
      badges: collectBadges(root),

      actionsCount: state.actionsCount,
      clickCount: state.clickCount,
      keyCount: state.keyCount,
      shootCount: state.shootCount,
      hhaEventCount: state.hhaEventCount,

      startedAt: state.startedAt,
      finishedAt: nowIso(),
      durationSec: Math.max(1, Math.round((Date.now() - START_TS) / 1000)),
      completed: true,

      pageUrl: location.href,
      userAgent: state.userAgent,
      source: 'groups-solo-summary-dom'
    };

    const accNum = safeNumber(summary.accuracy, null);
    if (accNum !== null) summary.accuracyPercent = accNum;

    return summary;
  }

  function saveLastSummary(summary){
    if (!summary) return;

    state.completed = true;
    state.summarySaved = true;
    state.lastSummary = summary;

    const keys = [
      'HHA_LAST_SUMMARY',
      'HHA_GROUPS_LAST_SUMMARY',
      'HHA_GROUPS_SOLO_LAST_SUMMARY',
      'HHA_NUTRITION_GROUPS_LAST_SUMMARY',
      [
        'HHA_LAST_SUMMARY',
        GAME_ID,
        MODE,
        state.pid
      ].join('_')
    ];

    keys.forEach(key => storageSetJSON(key, summary));

    storageSet('HHA_LAST_GAME', GAME_ID);
    storageSet('HHA_LAST_MODE', MODE);
    storageSet('HHA_LAST_ZONE', ZONE);
    storageSet('HHA_LAST_SESSION_ID', SESSION_ID);
    storageSet('HHA_LAST_SCORE', String(summary.score || 0));
    storageSet('HHA_LAST_COMPLETED_AT', summary.finishedAt);

    window.dispatchEvent(new CustomEvent('hha:summary-saved', {
      detail: summary
    }));
  }

  function buildSessionPayload(eventType, extra){
    const durationSec = Math.max(1, Math.round((Date.now() - START_TS) / 1000));

    const payload = {
      api: 'herohealth',
      type: eventType || 'session_update',
      eventType: eventType || 'session_update',

      patch: PATCH_ID,
      sessionId: SESSION_ID,
      visitId: SESSION_ID,

      gameId: GAME_ID,
      game: GAME_ID,
      gameName: GAME_NAME,
      mode: MODE,
      zone: ZONE,

      pid: state.pid,
      studentId: state.studentId,
      studentName: state.studentName,
      name: state.name,
      classSection: state.classSection,

      diff: state.diff,
      view: state.view,
      timeLimit: state.timeLimit,
      seed: state.seed,
      studyId: state.studyId,
      conditionGroup: state.conditionGroup,

      startedAt: state.startedAt,
      lastActiveAt: state.lastActiveAt,
      clientTs: nowIso(),
      durationSec: durationSec,
      activeTimeSec: durationSec,

      actionsCount: state.actionsCount,
      score: state.lastSummary ? state.lastSummary.score : state.scoreLive,
      completed: !!state.completed,

      pageUrl: location.href,
      userAgent: state.userAgent,

      summary: state.lastSummary || null,
      events: state.events.slice(-30)
    };

    if (extra && typeof extra === 'object') {
      Object.assign(payload, extra);
    }

    payload.extraJson = JSON.stringify({
      patch: PATCH_ID,
      source: 'groups-solo',
      summary: payload.summary,
      events: payload.events
    });

    return payload;
  }

  function canSend(){
    return !!(LOG_ENDPOINT && /^https?:\/\//.test(LOG_ENDPOINT));
  }

  function sendPayload(payload, reason){
    if (!canSend()) return false;

    const body = JSON.stringify(payload);

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type:'text/plain;charset=UTF-8' });
        const ok = navigator.sendBeacon(LOG_ENDPOINT, blob);
        if (ok) return true;
      }
    } catch(e) {}

    try {
      fetch(LOG_ENDPOINT, {
        method:'POST',
        mode:'no-cors',
        keepalive:true,
        headers:{
          'Content-Type':'text/plain;charset=UTF-8'
        },
        body:body
      }).catch(function(){});
      return true;
    } catch(e) {
      return false;
    }
  }

  let lastFlushAt = 0;
  let lastFlushType = '';

  function flush(eventType, force){
    const now = Date.now();

    if (!force && lastFlushType === eventType && now - lastFlushAt < 1200) {
      return;
    }

    lastFlushAt = now;
    lastFlushType = eventType || 'flush';

    if (isSummaryVisible() && !state.summarySaved) {
      const summary = collectSummary();
      saveLastSummary(summary);
    }

    const payload = buildSessionPayload(eventType || 'session_update', {
      flushReason: eventType || 'manual',
      sentAt: nowIso()
    });

    storageSetJSON('HHA_GROUPS_SOLO_LAST_SESSION_PAYLOAD', payload);

    sendPayload(payload, eventType);
  }

  function onSummaryDetected(){
    if (!isSummaryVisible()) return false;

    const summary = collectSummary();

    if (!summary || !summary.score && !summary.correct && !summary.badges.length) {
      return false;
    }

    saveLastSummary(summary);

    flush('session_end', true);

    return true;
  }

  function bindUserActivity(){
    document.addEventListener('click', function(ev){
      state.actionsCount += 1;
      state.clickCount += 1;
      state.lastActiveAt = nowIso();

      const targetText = textOf(ev.target).slice(0, 40);

      addEvent('click', {
        target: targetText
      });
    }, true);

    document.addEventListener('keydown', function(ev){
      state.actionsCount += 1;
      state.keyCount += 1;
      state.lastActiveAt = nowIso();

      addEvent('keydown', {
        key: ev.key
      });
    }, true);

    window.addEventListener('hha:shoot', function(ev){
      state.actionsCount += 1;
      state.shootCount += 1;
      state.lastActiveAt = nowIso();

      addEvent('hha:shoot', ev.detail || {});
    }, true);

    [
      'hha:score',
      'hha:judge',
      'hha:hit',
      'hha:miss',
      'hha:combo',
      'hha:phase',
      'hha:quest:update',
      'hha:summary',
      'hha:gameover',
      'hha:complete'
    ].forEach(name => {
      window.addEventListener(name, function(ev){
        addEvent(name, ev.detail || {});

        if (name === 'hha:summary' || name === 'hha:gameover' || name === 'hha:complete') {
          setTimeout(function(){
            onSummaryDetected();
            flush('session_end', true);
          }, 120);
        }
      }, true);
    });
  }

  function addTinyDebugButton(){
    if (!/debug=1|teacher=1/.test(location.search)) return;
    if (document.getElementById('hha-groups-log-debug-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'hha-groups-log-debug-btn';
    btn.type = 'button';
    btn.textContent = '📋 Summary JSON';
    btn.style.cssText = [
      'position:fixed',
      'left:10px',
      'bottom:10px',
      'z-index:999999',
      'border:0',
      'border-radius:999px',
      'padding:9px 12px',
      'background:rgba(21,48,74,.9)',
      'color:white',
      'font:800 12px system-ui',
      'box-shadow:0 10px 24px rgba(0,0,0,.2)'
    ].join(';');

    btn.addEventListener('click', function(){
      const summary = state.lastSummary || collectSummary();
      saveLastSummary(summary);

      const text = JSON.stringify(summary, null, 2);

      try {
        navigator.clipboard.writeText(text);
        btn.textContent = '✅ Copied';
      } catch(e) {
        console.log('[Groups Summary JSON]', summary);
        btn.textContent = 'ดูใน Console';
      }

      setTimeout(function(){
        btn.textContent = '📋 Summary JSON';
      }, 1400);
    });

    document.body.appendChild(btn);
  }

  function scan(){
    if (isSummaryVisible()) {
      onSummaryDetected();
      addTinyDebugButton();
    }
  }

  function boot(){
    storageSetJSON('HHA_GROUPS_SOLO_ACTIVE_SESSION', {
      patch: PATCH_ID,
      sessionId: SESSION_ID,
      gameId: GAME_ID,
      mode: MODE,
      zone: ZONE,
      pid: state.pid,
      name: state.name,
      diff: state.diff,
      view: state.view,
      seed: state.seed,
      startedAt: state.startedAt,
      pageUrl: location.href
    });

    addEvent('session_start', {
      game: GAME_ID,
      mode: MODE,
      view: state.view,
      diff: state.diff
    });

    bindUserActivity();

    scan();
    setTimeout(scan, 300);
    setTimeout(scan, 900);
    setTimeout(scan, 1800);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_SAVE_LOG_SCAN_TIMER__);
      window.__HHA_GROUPS_SAVE_LOG_SCAN_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true
    });

    window.addEventListener('pagehide', function(){
      flush(state.completed ? 'pagehide_after_complete' : 'pagehide_partial', true);
    });

    window.addEventListener('beforeunload', function(){
      flush(state.completed ? 'beforeunload_after_complete' : 'beforeunload_partial', true);
    });

    document.addEventListener('visibilitychange', function(){
      if (document.visibilityState === 'hidden') {
        flush(state.completed ? 'hidden_after_complete' : 'hidden_partial', true);
      }
    });

    setInterval(function(){
      if (!state.completed) {
        flush('session_heartbeat', false);
      }
    }, 30000);

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      sessionId: SESSION_ID,
      endpointEnabled: canSend(),
      endpoint: canSend() ? LOG_ENDPOINT : '(local only)',
      view: state.view
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
