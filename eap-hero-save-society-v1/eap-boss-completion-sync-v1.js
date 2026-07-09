/* =========================================================
   EAP Hero Boss Completion Sync v5
   - Records a B1–B5 Boss Clash pass as normal EAP attempts after the
     real core game shows “Boss Defeated!”.
   - Sends one completion attempt for each integrated Boss Gate skill
     (Reading, Listening, Writing, Speaking) so Cloud Resume can mark
     the Boss Gate complete and unlock the next route.
   - Fixes stale evidence/session IDs: if the visible defeated boss is
     Copy-Paste Zombie, it is treated as B2, even if an old queued event
     incorrectly says B1.
   - Does NOT require the optional Boss Speaking Evidence queue before
     sending the Boss Gate completion rows. The teacher-review speaking
     evidence remains separate.
   - This file never fabricates a speaking note, audio, pronunciation,
     grammar, or teacher score. It records only Boss Gate completion.
   - Uses POST first so the Apps Script router can mirror rows and refresh
     Fast Resume cache, with GET fallback for older deployments.
========================================================= */
(function () {
  'use strict';

  var VERSION = 'v20260709-EAP-BOSS-COMPLETION-SYNC-V5-NO-QUEUE-COMPLETE';
  var CFG = window.EAP_SHEET_CONFIG || {};
  var ENDPOINT = String(CFG.webAppUrl || '');
  var QUEUE_KEY = 'EAP_HERO_BOSS_REVIEW_EVENT_QUEUE_V2';
  var LEGACY_QUEUE_KEY = 'EAP_HERO_BOSS_REVIEW_EVENT_QUEUE_V1';
  var SENT_KEY = 'EAP_HERO_BOSS_COMPLETION_SENT_V5';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var timer = null;

  var BOSS_SKILLS = ['Reading', 'Listening', 'Writing', 'Speaking'];
  var NEXT_ROUTE = { B1:'S4', B2:'S7', B3:'S10', B4:'S13', B5:'B5' };
  var BOSS_NAME_TO_GATE = [
    { re:/Detail\s+Trap\s+Spider/i, gate:'B1', name:'Detail Trap Spider' },
    { re:/Copy\s*-?\s*Paste\s+Zombie/i, gate:'B2', name:'Copy-Paste Zombie' },
    { re:/Broken\s+Paragraph\s+Beast|Structure\s+Maze\s+Warden/i, gate:'B3', name:'Broken Paragraph Beast' },
    { re:/Plagiarism\s+Monster|Rude\s+Mail\s+Gremlin|Graph\s+Fog\s+Dragon/i, gate:'B4', name:'Plagiarism Monster' },
    { re:/Stagnation\s+Emperor|Final\s+Academic\s+Mission/i, gate:'B5', name:'Final Academic Mission' }
  ];

  function text(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function read(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
  function now() { return new Date().toISOString(); }
  function todayKey() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }

  function profile() {
    var state = read(STATE_KEY, {}) || {};
    var stored = read('EAP_HERO_PLAYER_PROFILE_V1', {}) || {};
    var p = Object.assign({}, state.profile || {}, state.player || {}, stored || {});
    return {
      studentId: text(p.studentId || p.id || state.studentId || 'guest'),
      studentName: text(p.studentName || p.name || state.studentName || state.playerName || 'Guest'),
      section: text(p.section || state.section || CFG.section || '122')
    };
  }

  function bodyText() {
    return text((document.getElementById('app') || document.body).innerText || '');
  }

  function completedPage() {
    return /Boss Defeated!/i.test(bodyText());
  }

  function bossNameFromText(source) {
    var s = text(source);
    for (var i = 0; i < BOSS_NAME_TO_GATE.length; i++) {
      if (BOSS_NAME_TO_GATE[i].re.test(s)) return BOSS_NAME_TO_GATE[i].name;
    }
    return '';
  }

  function routeFromHomeText() {
    var body = bodyText();
    var b = body.match(/\b(B[1-5])\s+Boss\s+Gate/i);
    return b ? b[1].toUpperCase() : '';
  }

  function gateFromText(source) {
    var s = text(source);
    if (!s) return '';
    var explicit = s.match(/\b(B[1-5])\s*(?:Boss\s*Gate|Gate)?\b/i);
    if (explicit) return explicit[1].toUpperCase();
    for (var i = 0; i < BOSS_NAME_TO_GATE.length; i++) {
      if (BOSS_NAME_TO_GATE[i].re.test(s)) return BOSS_NAME_TO_GATE[i].gate;
    }
    return '';
  }

  function queueItems() {
    var merged = Object.assign({}, read(LEGACY_QUEUE_KEY, {}), read(QUEUE_KEY, {}));
    return Object.keys(merged).map(function (key) { return merged[key]; });
  }

  function baseDetail(item) {
    var event = item && item.event || {};
    return event.value || {};
  }

  function eventText(item) {
    var event = item && item.event || {};
    var detail = baseDetail(item);
    return [
      event.sessionId,
      event.eventId,
      detail.sessionId,
      detail.routeId,
      detail.sessionTitle,
      detail.routeTitle,
      detail.bossName,
      detail.boss,
      detail.prompt,
      detail.output,
      detail.sourceUrl
    ].map(text).join(' ');
  }

  function inferredGate(item) {
    /* Visible page wins over stale queued event IDs. */
    var fromBody = gateFromText(bodyText());
    if (fromBody) return fromBody;

    var fromEventText = gateFromText(eventText(item));
    if (fromEventText) return fromEventText;

    var event = item && item.event || {};
    var detail = baseDetail(item);
    var explicit = text(event.sessionId || detail.sessionId || detail.routeId).toUpperCase();
    return /^B[1-5]$/.test(explicit) ? explicit : '';
  }

  function titleForGate(gate, detail) {
    var fallback = {
      B1:'Boss Gate 1: Academic Foundations',
      B2:'Boss Gate 2: Reading, Listening and Summary',
      B3:'Boss Gate 3: Academic Writing Control',
      B4:'Boss Gate 4: Academic Communication and Ethics',
      B5:'Boss Gate 5: Final Academic Mission'
    };
    return text((detail || {}).sessionTitle || (detail || {}).routeTitle || fallback[gate] || ('Boss Gate ' + gate.replace('B', '')));
  }

  function visibleBossItem() {
    if (!completedPage()) return null;
    var gate = gateFromText(bodyText());
    if (!gate) return null;
    var p = profile();
    var bossName = bossNameFromText(bodyText()) || gate;
    var stableId = 'visible-boss-complete-' + p.studentId + '-' + gate + '-' + todayKey();
    return {
      queuedAt: now(),
      event: {
        eventId: stableId,
        sessionId: gate,
        value: {
          evidenceId: stableId,
          sessionId: gate,
          routeId: gate,
          sessionTitle: titleForGate(gate, {}),
          routeTitle: titleForGate(gate, {}),
          bossName: bossName,
          teacherReviewRequired: false,
          sourceUrl: location.href,
          visibleBossDefeatedFallback: true
        }
      }
    };
  }

  function currentBossEvidence() {
    var items = queueItems()
      .filter(function (item) {
        if (!item || !item.event || !item.event.value) return false;
        return !!inferredGate(item);
      })
      .sort(function (a, b) { return String(b.queuedAt || '').localeCompare(String(a.queuedAt || '')); });

    if (items[0]) return items[0];

    /* Critical fallback: Boss Defeated is enough to send completion rows.
       Optional Boss Speaking Evidence still sends teacher-review evidence separately. */
    return visibleBossItem();
  }

  function itemGate(item) {
    return inferredGate(item);
  }

  function accuracy() {
    var body = bodyText();
    var match = body.match(/(\d{1,3})%\s*Accuracy/i);
    return match ? Math.max(0, Math.min(100, Number(match[1]))) : 100;
  }

  function attemptIdFor(person, gate, skill, item) {
    var detail = baseDetail(item);
    var event = item.event || {};
    var evidence = text(event.eventId || detail.evidenceId || detail.rawEvidenceId || item.queuedAt || now());
    return 'boss-gate-complete-' + person.studentId + '-' + gate + '-' + skill.toLowerCase() + '-' + evidence;
  }

  function buildSkillAttempt(item, skill) {
    var detail = baseDetail(item);
    var p = profile();
    var gate = itemGate(item);
    var acc = accuracy();
    var title = titleForGate(gate, detail);
    return {
      action: 'submit_attempt',
      submissionKind: 'fresh_evidence_v118',
      attemptId: attemptIdFor(p, gate, skill, item),
      studentId: p.studentId,
      studentName: p.studentName,
      section: p.section,
      course: 'EAP Hero: Save the Society',
      routeId: gate,
      routeType: 'boss_gate',
      sessionId: gate,
      sessionTitle: title,
      routeTitle: title,
      skill: skill,
      skillRole: 'Integrated',
      score: acc,
      accuracy: acc,
      passMark: 60,
      passed: true,
      legacyCompletion: false,
      hintUsed: 0,
      replay: false,
      clientTimestamp: now(),
      sourceUrl: location.href,
      bossWin: true,
      bossGateComplete: true,
      bossCompletionSyncVersion: VERSION,
      bossEvidenceId: text((item.event || {}).eventId || detail.evidenceId),
      visibleBossDefeatedFallback: !!detail.visibleBossDefeatedFallback,
      teacherReviewRequired: false,
      teacherReviewStatus: ''
    };
  }

  function buildBossClashAttempt(item) {
    var detail = baseDetail(item);
    var p = profile();
    var gate = itemGate(item);
    var acc = accuracy();
    var title = titleForGate(gate, detail);
    return {
      action: 'submit_attempt',
      submissionKind: 'fresh_evidence_v118',
      attemptId: 'boss-clash-' + p.studentId + '-' + gate + '-' + text((item.event || {}).eventId || detail.evidenceId || item.queuedAt || now()),
      studentId: p.studentId,
      studentName: p.studentName,
      section: p.section,
      course: 'EAP Hero: Save the Society',
      routeId: gate,
      routeType: 'boss_gate',
      sessionId: gate,
      sessionTitle: title,
      routeTitle: title,
      skill: 'Boss Clash',
      skillRole: 'Completion',
      score: acc,
      accuracy: acc,
      passMark: 60,
      passed: true,
      legacyCompletion: false,
      hintUsed: 0,
      replay: false,
      clientTimestamp: now(),
      sourceUrl: location.href,
      bossWin: true,
      bossGateComplete: true,
      bossCompletionSyncVersion: VERSION,
      bossEvidenceId: text((item.event || {}).eventId || detail.evidenceId),
      visibleBossDefeatedFallback: !!detail.visibleBossDefeatedFallback
    };
  }

  function buildAttempts(item) {
    if (!item || !itemGate(item)) return [];
    var attempts = BOSS_SKILLS.map(function (skill) { return buildSkillAttempt(item, skill); });
    attempts.push(buildBossClashAttempt(item));
    return attempts;
  }

  function markLocalBossComplete(gate) {
    if (!gate || !NEXT_ROUTE[gate]) return;
    var next = NEXT_ROUTE[gate];
    var state = read(STATE_KEY, {}) || {};
    state.completedSessions = state.completedSessions || {};
    state.sessionProgress = state.sessionProgress || {};
    state.unlockedSessions = state.unlockedSessions || {};
    state.unlockedRoutes = state.unlockedRoutes || {};
    state.completedSessions[gate] = true;
    state.unlockedSessions[gate] = true;
    state.unlockedRoutes[gate] = true;
    state.unlockedSessions[next] = true;
    state.unlockedRoutes[next] = true;
    state.sessionProgress[gate] = Object.assign({}, state.sessionProgress[gate] || {}, {
      sessionId: gate,
      routeId: gate,
      complete: true,
      passed: true,
      required: BOSS_SKILLS,
      passedSkills: BOSS_SKILLS,
      updatedAt: now(),
      source: 'boss_completion_sync_v5'
    });
    state.currentRoute = next;
    state.currentCloudRoute = next;
    state.cloudResumeStatus = 'ok';
    state.bossCompletionLocalAdvance = { gate: gate, nextRoute: next, at: now(), version: VERSION };
    write(STATE_KEY, state);
    try { localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', next); localStorage.setItem('EAP_HERO_CURRENT_ROUTE', next); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('eap:resume-synced', { detail: state })); } catch (_) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: STATE_KEY, newValue: JSON.stringify(state), storageArea: localStorage })); } catch (_) {}
  }

  function postAttempt(attempt) {
    if (!ENDPOINT || !attempt) return false;
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(attempt)
      }).catch(function () {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function getFallback(attempt) {
    if (!ENDPOINT || !attempt) return false;
    try {
      var url = new URL(ENDPOINT, location.href);
      Object.keys(attempt).forEach(function (key) { url.searchParams.set(key, String(attempt[key])); });
      fetch(url.toString()).catch(function () {});
      return true;
    } catch (_) { return false; }
  }

  function sendOne(attempt) {
    if (!attempt || !attempt.attemptId) return false;
    var sent = read(SENT_KEY, {});
    if (sent[attempt.attemptId]) return true;
    var ok = postAttempt(attempt);
    if (!ok) ok = getFallback(attempt);
    sent[attempt.attemptId] = { at: now(), score: attempt.score, skill: attempt.skill, via: VERSION };
    write(SENT_KEY, sent);
    return true;
  }

  function sync() {
    var item = currentBossEvidence();
    if (!item) return;
    var gate = itemGate(item);
    if (!gate) return;

    var homeGate = routeFromHomeText();
    var allowed = completedPage() || (homeGate && homeGate === gate) || gateFromText(bodyText()) === gate;
    if (!allowed) return;

    buildAttempts(item).forEach(sendOne);
    markLocalBossComplete(gate);

    if (window.EAPPlayerResume && typeof window.EAPPlayerResume.sync === 'function') {
      setTimeout(function () { window.EAPPlayerResume.sync({ silent:true }); }, 1600);
      setTimeout(function () { window.EAPPlayerResume.sync({ silent:true }); }, 4800);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(sync, 260);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
  window.addEventListener('load', schedule);
  window.addEventListener('eap:resume-synced', schedule);
  window.EAPBossCompletionSyncV1 = { version: VERSION, sync:sync, inferGate: inferredGate, visibleBossItem: visibleBossItem };
  schedule();
})();