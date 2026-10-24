/* =========================================================
   EAP Hero • Trusted Attempt Transport v124 (receipt-safe)
   Captures ONLY fresh core-game submit_attempt GET calls. Sends their exact
   attempt data as POST to the configured EAP endpoint; retains a durable
   same-identity pending queue until EAP_Progress v150 confirms evidenceId.
   No scan of local portfolio, no historical backfill; no synthetic success for normal-session attempts.
========================================================= */
(function () {
  'use strict';
  var cfg = window.EAP_SHEET_CONFIG || {};
  if (!cfg.enabled || !cfg.webAppUrl || typeof window.fetch !== 'function') return;

  var nativeFetch = window.fetch.bind(window);
  var QUEUE_KEY = 'EAP_HERO_VERIFIED_ATTEMPT_PENDING_V124';
  var DONE_KEY = 'EAP_HERO_VERIFIED_ATTEMPT_CONFIRMED_V124';
  var RETRY_MS = 60000;
  var flight = {};
  var lastResumeRequest = 0;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function read(key) {
    try { var data = JSON.parse(localStorage.getItem(key) || '{}'); return data && typeof data === 'object' ? data : {}; }
    catch (_) { return {}; }
  }
  function write(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch (_) { return false; }
  }
  function route(value) {
    var raw = text(value).toUpperCase();
    if (/^\d+$/.test(raw)) return 'S' + Number(raw);
    if (/^S(?:ESSION)?0?([1-9]|1[0-5])$/.test(raw)) return 'S' + Number(raw.match(/\d+/)[0]);
    if (/^B(?:OSS)?0?([1-5])$/.test(raw)) return 'B' + Number(raw.match(/\d+/)[0]);
    return '';
  }
  function skill(value) {
    var key = text(value).toLowerCase();
    return {reading:'Reading',writing:'Writing',listening:'Listening',speaking:'Speaking'}[key] || '';
  }
  function keyFor(payload) {
    return [text(payload.section),text(payload.studentId),text(payload.attemptId)].join('|');
  }
  function identity() {
    var active = read('EAP_HERO_ACTIVE_PLAYER_V1');
    var profile = read('EAP_HERO_PLAYER_PROFILE_V1');
    var state = read('EAP_HERO_PROGRESS_V3');
    var s = state.profile || {};
    return {
      studentId: text(active.studentId || active.id || profile.studentId || profile.id || s.studentId || s.id),
      section: text(active.section || profile.section || s.section || cfg.section || '122')
    };
  }
  function sameIdentity(payload) {
    var current = identity();
    return current.studentId === text(payload.studentId) && current.section === text(payload.section);
  }
  function isHeroAttempt(value) {
    try {
      var url = new URL(value, location.href);
      var endpoint = new URL(cfg.webAppUrl);
      return url.origin === endpoint.origin && url.pathname === endpoint.pathname &&
        text(url.searchParams.get('action')).toLowerCase() === 'submit_attempt';
    } catch (_) { return false; }
  }
  // Boss submissions remain on their existing legacy transport. Their
  // teacher-review gate must not be changed by the normal-session S1 fix.
  function forwardLegacyBoss(value) {
    try {
      var frame = document.getElementById('eap_hero_sheet_receiver_v124');
      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = 'eap_hero_sheet_receiver_v124';
        frame.name = frame.id;
        frame.setAttribute('aria-hidden','true');
        frame.style.cssText='display:none!important;width:1px;height:1px;border:0';
        document.documentElement.appendChild(frame);
      }
      var form = document.createElement('form');
      form.method='GET';form.action=cfg.webAppUrl;form.target=frame.name;
      form.style.display='none';
      new URL(value,location.href).searchParams.forEach(function(v,k) {
        var field=document.createElement('input');
        field.type='hidden';field.name=k;field.value=v;form.appendChild(field);
      });
      [['submissionKind','fresh_evidence_v118'],['bridgeVersion','v124']].forEach(function(pair) {
        var field=document.createElement('input');field.type='hidden';
        field.name=pair[0];field.value=pair[1];form.appendChild(field);
      });
      document.body.appendChild(form);form.submit();
      setTimeout(function(){try{form.remove();}catch(_){}},0);
      return true;
    } catch (_) {return false;}
  }
  function payloadFrom(value) {
    var url = new URL(value, location.href);
    var payload = {};
    url.searchParams.forEach(function(v,k) { payload[k] = v; });
    payload.action = 'submit_attempt';
    payload.submissionKind = 'fresh_evidence_v118';
    payload.bridgeVersion = 'v124-receipt-safe';
    payload.routeId = route(payload.routeId || payload.sessionId);
    payload.skill = skill(payload.skill);
    payload.evidenceId = text(payload.evidenceId || payload.attemptId);
    payload.studentId = text(payload.studentId);
    payload.section = text(payload.section || cfg.section || '122');
    return payload;
  }
  function valid(payload) {
    var score = Number(payload.score);
    return !!(
      payload.attemptId && payload.evidenceId === payload.attemptId &&
      payload.studentId && payload.studentId.toLowerCase() !== 'guest' &&
      payload.section && payload.routeId && payload.skill &&
      Number.isFinite(score) && score >= 0 && score <= 100 &&
      text(payload.legacyCompletion).toLowerCase() !== 'true'
    );
  }
  function requestResume() {
    if (Date.now() - lastResumeRequest < 12000) return;
    lastResumeRequest = Date.now();
    try {
      if (window.EAPPlayerResumeStableJSONP && typeof window.EAPPlayerResumeStableJSONP.request === 'function') {
        window.EAPPlayerResumeStableJSONP.request(true);
      }
    } catch (_) {}
  }
  function send(key, forced) {
    var queue = read(QUEUE_KEY);
    var row = queue[key];
    if (!row || flight[key] || !sameIdentity(row.payload)) return Promise.resolve(null);
    if (!forced && Date.now() - Number(row.lastSentAt || 0) < RETRY_MS) return Promise.resolve(null);
    row.lastSentAt = Date.now();
    row.attempts = Number(row.attempts || 0) + 1;
    queue[key] = row;
    if (!write(QUEUE_KEY, queue)) return Promise.reject(new Error('Cannot persist attempt pending receipt'));
    flight[key] = true;
    // Apps Script ContentService uses redirects and cross-origin output.
    // An opaque response is NOT an acknowledgement of persistence.
    return nativeFetch(cfg.webAppUrl, {
      method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(row.payload)
    }).then(function(response) {
      setTimeout(requestResume, 2200);
      return response;
    }).finally(function() { delete flight[key]; });
  }
  function submitFresh(value) {
    // Allow the core game to call this trusted transport directly rather
    // than relying on global fetch monkey-patch ordering.
    if (!isHeroAttempt(value)) {
      return Promise.reject(new Error('Invalid EAP attempt endpoint'));
    }
    var payload = payloadFrom(value);
    if (!valid(payload) || !sameIdentity(payload)) {
      return Promise.reject(new Error('EAP attempt identity or evidence is invalid; submission not recorded'));
    }
    var key = keyFor(payload);
    if (read(DONE_KEY)[key]) return Promise.resolve(null);
    var queue = read(QUEUE_KEY);
    if (queue[key]) {
      if (Number(queue[key].payload.score) !== Number(payload.score) ||
          text(queue[key].payload.skill) !== text(payload.skill) ||
          text(queue[key].payload.routeId) !== text(payload.routeId)) {
        return Promise.reject(new Error('Conflicting score for an existing EAP attemptId'));
      }
    } else {
      queue[key] = {payload:payload,firstQueuedAt:new Date().toISOString(),lastSentAt:0,attempts:0};
      if (!write(QUEUE_KEY,queue)) return Promise.reject(new Error('Cannot save EAP pending attempt'));
    }
    return send(key,false);
  }
  function verifiedRecord(payload,data) {
    if (!data || data.ok !== true ||
        data.authorityMode !== 'EAP_Progress-single-source-of-truth' ||
        text(data.studentId) !== text(payload.studentId) ||
        text(data.section) !== text(payload.section)) return false;
    var r = (data.routeProgress || {})[payload.routeId] || {};
    var evidence = (r.skills || {})[payload.skill] || {};
    return text(evidence.evidenceId) === text(payload.evidenceId) &&
      Number(evidence.score) >= Number(payload.score) &&
      Number.isFinite(Number(evidence.score));
  }
  function reconcile(data) {
    var queue = read(QUEUE_KEY);
    var done = read(DONE_KEY);
    var changed = false;
    Object.keys(queue).forEach(function(key) {
      var row = queue[key];
      if (!row || !row.payload || !sameIdentity(row.payload)) return;
      if (!verifiedRecord(row.payload,data)) return;
      done[key] = {at:new Date().toISOString(),routeId:row.payload.routeId,
        skill:row.payload.skill,score:Number(row.payload.score),evidenceId:row.payload.evidenceId};
      delete queue[key];
      changed = true;
    });
    if (changed) {
      // Keep the pending queue if confirmation history cannot be saved.
      if (write(DONE_KEY,done)) write(QUEUE_KEY,queue);
    }
    return changed;
  }
  function retryPending() {
    var queue = read(QUEUE_KEY);
    Object.keys(queue).forEach(function(key) { send(key,false).catch(function(){}); });
  }
  window.fetch = function(input,init) {
    var value = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (isHeroAttempt(value)) {
      var session = route(new URL(value,location.href).searchParams.get('sessionId'));
      if (/^B[1-5]$/.test(session)) {
        if (forwardLegacyBoss(value)) {
          // Compatibility-only: previous Boss callers rely on this legacy
          // response. It does not constitute a confirmed server receipt.
          return Promise.resolve(new Response('',{status:204}));
        }
        return nativeFetch(input,init);
      }
      return submitFresh(value);
    }
    return nativeFetch(input,init);
  };
  window.addEventListener('eap:resume-synced',function(event) {
    var detail = event && event.detail || {};
    if (detail.data && reconcile(detail.data)) return;
    retryPending();
  });
  window.addEventListener('online',retryPending);
  setInterval(retryPending,RETRY_MS);
  setTimeout(retryPending,4000);
  window.EAPHeroTrustedTransportV124 = {
    active:true,version:'v124-receipt-safe',
    diagnostics:function() {
      return {active:true,pending:Object.keys(read(QUEUE_KEY)).filter(function(k) {
        return sameIdentity(read(QUEUE_KEY)[k].payload);
      }).length,confirmed:Object.keys(read(DONE_KEY)).length};
    },
    reconcile:reconcile,retryPending:retryPending,
    // Fresh core-game attempts only. No portfolio scan or historical replay.
    submitFreshAttempt:submitFresh
  };
})();