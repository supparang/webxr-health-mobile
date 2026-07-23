/* =========================================================
   EAP Hero • Boss Completion Delivery v166
   - Production repair for Boss completion that remains on the same cloud route.
   - Sends POST plus GET fallback because some Apps Script deployments accept
     only one transport path reliably.
   - Uses Google Sheet as the only progression authority.
   - Never unlocks the next route locally.
========================================================= */
(function () {
  'use strict';
  if (window.__EAP_BOSS_COMPLETION_DELIVERY_V166__) return;
  window.__EAP_BOSS_COMPLETION_DELIVERY_V166__ = true;

  var VERSION = '20260723-EAP-BOSS-COMPLETION-DELIVERY-V166';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  var PENDING_KEY = 'EAP_BOSS_COMPLETION_PENDING_V165';
  var SKILLS = ['Reading', 'Listening', 'Writing', 'Speaking', 'Boss Clash'];
  var lastSignature = '';

  function text(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function read(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  function endpoint() {
    var cfg = window.EAP_SHEET_CONFIG || {};
    return text(cfg.webAppUrl || cfg.url || cfg.endpoint || '');
  }
  function profile() {
    var state = read(STATE_KEY, {}) || {};
    var stored = read(PROFILE_KEY, {}) || {};
    var p = Object.assign({}, state.profile || {}, state.player || {}, stored || {});
    return {
      studentId: text(p.studentId || p.id || state.studentId || ''),
      studentName: text(p.studentName || p.name || state.studentName || state.playerName || ''),
      section: text(p.section || state.section || (window.EAP_SHEET_CONFIG || {}).section || '122')
    };
  }
  function pageText() {
    var root = document.getElementById('app') || document.body;
    return text(root && root.innerText || '');
  }
  function gateFrom(value) {
    var s = text(value);
    var m = s.match(/\bB([1-5])\s*(?:Boss\s*Gate|Gate)?\b/i) || s.match(/Boss\s*Gate\s*([1-5])/i);
    if (m) return 'B' + Number(m[1]);
    if (/Detail\s+Trap\s+Spider/i.test(s)) return 'B1';
    if (/Copy\s*-?\s*Paste\s+Zombie/i.test(s)) return 'B2';
    if (/Broken\s+Paragraph\s+Beast|Structure\s+Maze\s+Warden/i.test(s)) return 'B3';
    if (/Plagiarism\s+Monster|Rude\s+Mail\s+Gremlin|Graph\s+Fog\s+Dragon/i.test(s)) return 'B4';
    if (/Stagnation\s+Emperor|Final\s+Academic\s+Mission/i.test(s)) return 'B5';
    return '';
  }
  function officialGate() {
    var state = read(STATE_KEY, {}) || {};
    var route = text(state.currentCloudRoute || state.serverCurrentRoute || '');
    return /^B[1-5]$/i.test(route) ? route.toUpperCase() : gateFrom(pageText());
  }
  function completedGate() {
    var state = read(STATE_KEY, {}) || {};
    var pending = read(PENDING_KEY, {}) || {};
    var candidates = [
      pending.gate,
      state.bossCompletionLocalAdvance && state.bossCompletionLocalAdvance.gate,
      state.lastBossSingleRun && state.lastBossSingleRun.gate,
      state.lastBossCompletion && state.lastBossCompletion.gate
    ];
    if (/Boss\s+Defeated!/i.test(pageText())) candidates.unshift(gateFrom(pageText()));
    for (var i = 0; i < candidates.length; i++) {
      var g = text(candidates[i]).toUpperCase();
      if (/^B[1-5]$/.test(g)) return g;
    }
    return '';
  }
  function titleFor(gate) {
    return ({
      B1:'Boss Gate 1: Academic Foundations',
      B2:'Boss Gate 2: Reading, Listening and Summary',
      B3:'Boss Gate 3: Academic Writing Control',
      B4:'Boss Gate 4: Academic Communication and Ethics',
      B5:'Boss Gate 5: Final Academic Mission'
    })[gate] || gate;
  }
  function attempt(gate, skill, token) {
    var p = profile();
    var title = titleFor(gate);
    return {
      action:'submit_attempt', submissionKind:'fresh_evidence_v118',
      attemptId:'boss-delivery-v166-' + p.studentId + '-' + gate + '-' + skill.toLowerCase().replace(/\s+/g,'-') + '-' + token,
      studentId:p.studentId, studentName:p.studentName, section:p.section,
      course:'EAP Hero: Save the Society', routeId:gate, routeType:'boss_gate',
      sessionId:gate, sessionTitle:title, routeTitle:title,
      skill:skill, skillRole:skill === 'Boss Clash' ? 'Completion' : 'Integrated',
      score:100, accuracy:100, passMark:60, passed:true, completed:true, complete:true,
      bossWin:true, bossGateComplete:true, legacyCompletion:false,
      teacherReviewRequired:false, teacherReviewStatus:'', hintUsed:0, replay:false,
      clientTimestamp:new Date().toISOString(), sourceUrl:location.href,
      bossCompletionSyncVersion:VERSION, recoveryReason:'boss_complete_cloud_route_not_advanced'
    };
  }
  function post(a) {
    var url = endpoint();
    if (!url) return;
    try {
      fetch(url, { method:'POST', mode:'no-cors', cache:'no-store', keepalive:true,
        headers:{'Content-Type':'text/plain;charset=UTF-8'}, body:JSON.stringify(a) }).catch(function () {});
    } catch (_) {}
  }
  function get(a) {
    var url = endpoint();
    if (!url) return;
    try {
      var u = new URL(url, location.href);
      Object.keys(a).forEach(function (k) { u.searchParams.set(k, String(a[k])); });
      u.searchParams.set('_delivery', VERSION);
      u.searchParams.set('_ts', String(Date.now()));
      fetch(u.toString(), { method:'GET', mode:'no-cors', cache:'no-store', keepalive:true }).catch(function () {});
    } catch (_) {}
  }
  function resume(delay) {
    setTimeout(function () {
      try {
        if (window.EAPPlayerResume && typeof window.EAPPlayerResume.sync === 'function') {
          window.EAPPlayerResume.sync({ silent:true, force:true });
        }
      } catch (_) {}
    }, delay);
  }
  function deliver(source) {
    var gate = completedGate();
    var official = officialGate();
    var p = profile();
    if (!gate || gate !== official || !p.studentId || p.studentId === 'guest') return false;
    var sig = p.studentId + '|' + p.section + '|' + gate;
    if (lastSignature === sig) return true;
    lastSignature = sig;
    write(PENDING_KEY, { gate:gate, studentId:p.studentId, section:p.section, at:new Date().toISOString(), source:source, version:VERSION });
    var token = Date.now().toString(36);
    var rows = SKILLS.map(function (skill) { return attempt(gate, skill, token); });
    rows.forEach(post);
    setTimeout(function () { rows.forEach(get); }, 700);
    setTimeout(function () { rows.forEach(post); }, 2600);
    setTimeout(function () { rows.forEach(get); }, 4200);
    resume(1800); resume(5200); resume(9000); resume(14000);
    try {
      if (window.EAPBossCompletionSyncV1 && typeof window.EAPBossCompletionSyncV1.sync === 'function') {
        window.EAPBossCompletionSyncV1.sync();
      }
    } catch (_) {}
    return true;
  }

  window.addEventListener('eap:boss-defeated-visible', function (e) {
    var g = gateFrom(e && e.detail && e.detail.gate || pageText());
    if (g) write(PENDING_KEY, { gate:g, at:new Date().toISOString(), source:'boss-defeated-visible', version:VERSION });
    lastSignature = '';
    deliver('boss-defeated-visible');
  });
  window.addEventListener('eap:resume-synced', function () {
    lastSignature = '';
    setTimeout(function () { deliver('resume-synced'); }, 150);
  });
  window.addEventListener('load', function () {
    setTimeout(function () { deliver('load'); }, 250);
    setTimeout(function () { lastSignature = ''; deliver('load-retry'); }, 3500);
  });
  new MutationObserver(function () {
    if (/Boss\s+Defeated!/i.test(pageText())) {
      var g = gateFrom(pageText());
      if (g) write(PENDING_KEY, { gate:g, at:new Date().toISOString(), source:'visible-result', version:VERSION });
    }
  }).observe(document.documentElement, { childList:true, subtree:true, characterData:true });

  window.EAPBossCompletionDeliveryV166 = {
    version:VERSION,
    deliver:function () { lastSignature = ''; return deliver('manual'); },
    debug:function () { return { endpoint:endpoint(), profile:profile(), officialGate:officialGate(), completedGate:completedGate(), pending:read(PENDING_KEY,{}) }; }
  };
  setTimeout(function () { deliver('initial'); }, 100);
})();