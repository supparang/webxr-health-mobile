/* =========================================================
   EAP Hero • Single Sheet Authority Runtime v1
   ---------------------------------------------------------
   One owner for:
   - player_resume acceptance
   - current route / unlocked routes
   - lobby loading state
   - Recent Portfolio cloud records
   - refresh after submit

   Rules:
   1) Google Sheet player_resume is the only progression authority.
   2) Local evidence never advances a route.
   3) Submit modules only deliver evidence; this runtime refreshes resume.
   4) Cached data is usable only when it was server-verified for the same identity.
========================================================= */
(function () {
  'use strict';

  if (window.__EAP_SINGLE_AUTHORITY_V1__) return;
  window.__EAP_SINGLE_AUTHORITY_V1__ = true;

  var VERSION = '20260802-EAP-SINGLE-SHEET-AUTHORITY-V1';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  var ORDER = [
    'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
    'S10','S11','S12','B4','S13','S14','S15','B5'
  ];
  var SKILLS = ['Reading','Writing','Listening','Speaking','Boss Clash','boss'];
  var live = { verified: false, loading: true, route: '', records: [], identity: '', checkedAt: '' };
  var renderTimer = 0;
  var loadingStartedAt = Date.now();

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function parseJSON(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function readState() {
    return parseJSON(localStorage.getItem(STATE_KEY) || '{}', {}) || {};
  }

  function writeState(state) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state || {})); } catch (_) {}
  }

  function readProfile() {
    var official = parseJSON(localStorage.getItem(PROFILE_KEY) || '{}', {}) || {};
    var state = readState();
    var studentId = text(official.studentId || official.id || state.studentId || state.id);
    var studentName = text(official.studentName || official.name || state.studentName || state.name || state.playerName);
    var section = text(official.section || state.section || (window.EAP_SHEET_CONFIG || {}).section || '122') || '122';
    return { studentId: studentId, studentName: studentName, section: section };
  }

  function identityOf(profile) {
    profile = profile || readProfile();
    return profile.section + '|' + profile.studentId;
  }

  function normalizeRoute(value) {
    var raw = text(value && value.routeId || value).toUpperCase();
    var match = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
    if (match) return 'S' + Number(match[1]);
    match = raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i);
    if (match) return 'B' + Number(match[1]);
    return raw;
  }

  function bool(value) {
    return value === true || String(value).toUpperCase() === 'TRUE' || String(value) === '1';
  }

  function compactRecord(row) {
    row = row || {};
    var routeId = normalizeRoute(row.routeId || row.sessionId || row.session);
    return {
      studentId: text(row.studentId),
      studentName: text(row.studentName),
      section: text(row.section),
      routeId: routeId,
      sessionId: routeId,
      sessionTitle: text(row.sessionTitle || row.routeTitle),
      skill: text(row.skill),
      score: Number(row.bestScore !== undefined ? row.bestScore : row.score || 0),
      bestScore: Number(row.bestScore !== undefined ? row.bestScore : row.score || 0),
      latestScore: Number(row.latestScore !== undefined ? row.latestScore : row.score || 0),
      accuracy: Number(row.bestAccuracy !== undefined ? row.bestAccuracy : row.accuracy || 0),
      passed: bool(row.passed),
      updatedAt: text(row.updatedAt || row.latestAt || row.submittedAt || row.createdAt),
      sourceSheet: text(row.sourceSheet || 'summary'),
      restoredFromSheet: true,
      cloudVerified: true,
      serverVerified: true,
      attemptId: text(row.attemptId),
      summaryId: text(row.summaryId),
      teacherReviewRequired: row.teacherReviewRequired === true,
      teacherReviewStatus: text(row.teacherReviewStatus)
    };
  }

  function validResume(data) {
    if (!data || data.ok !== true) return false;
    if (text(data.service) && text(data.service) !== 'eap-session-authority') return false;
    var profile = readProfile();
    if (!profile.studentId) return false;
    if (text(data.studentId) && text(data.studentId) !== profile.studentId) return false;
    if (text(data.section) && text(data.section) !== profile.section) return false;
    return ORDER.indexOf(normalizeRoute(data.currentRoute || data.currentCloudRoute || data.nextRoute)) >= 0;
  }

  function compactResume(data) {
    var route = normalizeRoute(data.currentRoute || data.currentCloudRoute || data.nextRoute);
    var records = Array.isArray(data.records) ? data.records.map(compactRecord) : [];
    var unlocked = {};
    var source = data.unlockedRoutes || data.unlockedRouteIds;
    if (Array.isArray(source)) {
      source.forEach(function (item) { var id = normalizeRoute(item); if (id) unlocked[id] = true; });
    } else if (source && typeof source === 'object') {
      Object.keys(source).forEach(function (key) {
        var id = normalizeRoute(key), value = source[key];
        if (id && (value === true || (value && value.unlocked === true))) unlocked[id] = true;
      });
    }
    var routeIndex = ORDER.indexOf(route);
    if (routeIndex >= 0) {
      for (var i = 0; i <= routeIndex; i += 1) unlocked[ORDER[i]] = true;
    }
    return {
      ok: true,
      service: 'eap-session-authority',
      version: text(data.version),
      authorityMode: 'sheet-only',
      studentId: text(data.studentId),
      studentName: text(data.studentName),
      section: text(data.section),
      identityKey: identityOf(),
      currentRoute: route,
      currentCloudRoute: route,
      nextRoute: normalizeRoute(data.nextRoute || route),
      unlockedRoutes: unlocked,
      records: records,
      recordCount: records.length,
      checkedAt: text(data.checkedAt || data.generatedAt || new Date().toISOString()),
      acceptedAt: new Date().toISOString(),
      cloudVerified: true,
      compact: true
    };
  }

  function acceptResume(eventOrData) {
    var detail = eventOrData && eventOrData.detail ? eventOrData.detail : eventOrData;
    var data = detail && detail.data ? detail.data : detail;
    if (!validResume(data)) return false;

    var resume = compactResume(data);
    var state = readState();
    state.cloudResumeStatus = 'ok';
    state.currentRoute = resume.currentRoute;
    state.currentCloudRoute = resume.currentRoute;
    state.unlockedRoutes = resume.unlockedRoutes;
    state.serverResume = resume;
    state.authorityVersion = VERSION;
    writeState(state);

    live = {
      verified: true,
      loading: false,
      route: resume.currentRoute,
      records: resume.records,
      identity: resume.identityKey,
      checkedAt: resume.checkedAt
    };

    scheduleRender();
    try {
      window.dispatchEvent(new CustomEvent('eap:single-authority-applied', {
        detail: { data: resume, currentRoute: resume.currentRoute, version: VERSION }
      }));
    } catch (_) {}
    return true;
  }

  function restoreVerifiedCache() {
    var state = readState();
    var resume = state.serverResume || {};
    var profile = readProfile();
    if (
      state.cloudResumeStatus === 'ok' &&
      resume.cloudVerified === true &&
      resume.identityKey === identityOf(profile) &&
      ORDER.indexOf(normalizeRoute(resume.currentRoute)) >= 0
    ) {
      live = {
        verified: true,
        loading: false,
        route: normalizeRoute(resume.currentRoute),
        records: Array.isArray(resume.records) ? resume.records : [],
        identity: resume.identityKey,
        checkedAt: text(resume.checkedAt || resume.acceptedAt)
      };
      return true;
    }
    return false;
  }

  function requestResume(force) {
    var transport = window.EAPPlayerResumeStableJSONP;
    if (transport && typeof transport.request === 'function') {
      try { return transport.request(force === true); } catch (_) {}
    }
    return false;
  }

  function routeTitle(route) {
    var map = {
      S1:'Week 1 / S1',S2:'Week 2 / S2',S3:'Week 3 / S3',B1:'B1 Boss Gate',
      S4:'Week 4 / S4',S5:'Week 5 / S5',S6:'Week 6 / S6',B2:'B2 Boss Gate',
      S7:'Week 7 / S7',S8:'Week 8 / S8',S9:'Week 9 / S9',B3:'B3 Boss Gate',
      S10:'Week 10 / S10',S11:'Week 11 / S11',S12:'Week 12 / S12',B4:'B4 Boss Gate',
      S13:'Week 13 / S13',S14:'Week 14 / S14',S15:'Week 15 / S15',B5:'B5 Final Boss'
    };
    return map[route] || route;
  }

  function findButtonByText(pattern) {
    var nodes = document.querySelectorAll('button,a,[role="button"]');
    for (var i = 0; i < nodes.length; i += 1) {
      if (pattern.test(text(nodes[i].textContent))) return nodes[i];
    }
    return null;
  }

  function renderLobby() {
    var bodyText = text(document.body && document.body.textContent);
    if (!/STUDENT LOBBY|เข้าสู่เส้นทางการเรียนของฉัน/i.test(bodyText)) return;

    var start = findButtonByText(/Start\s*\/\s*Continue|เริ่ม|เรียนต่อ/i);
    var loadingText = /กำลังโหลดความคืบหน้าจาก Google Sheet/i;
    var statusNodes = Array.prototype.slice.call(document.querySelectorAll('div,p,span,strong,h2,h3'));

    if (live.verified) {
      if (start) {
        start.disabled = false;
        start.removeAttribute('aria-disabled');
        start.style.pointerEvents = '';
        start.style.opacity = '';
        start.textContent = '▶ Start / Continue';
      }
      statusNodes.forEach(function (node) {
        if (loadingText.test(text(node.textContent)) && node.children.length === 0) {
          node.textContent = routeTitle(live.route);
        }
      });
      document.documentElement.dataset.eapCurrentRoute = live.route;
      return;
    }

    if (Date.now() - loadingStartedAt > 10000) {
      if (start) {
        start.disabled = true;
        start.setAttribute('aria-disabled', 'true');
        start.style.pointerEvents = 'none';
        start.style.opacity = '.65';
      }
      statusNodes.forEach(function (node) {
        if (loadingText.test(text(node.textContent)) && node.children.length === 0) {
          node.textContent = 'ยังไม่ได้รับคำตอบจาก Google Sheet — กรุณากดลองใหม่';
        }
      });
      var retry = findButtonByText(/ลองใหม่|Retry/i);
      if (!retry) {
        retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'ลองโหลดจาก Google Sheet อีกครั้ง';
        retry.style.cssText = 'display:block;margin:10px auto;padding:11px 18px;border:0;border-radius:12px;background:#16a34a;color:#fff;font-weight:800;cursor:pointer';
        retry.addEventListener('click', function () {
          loadingStartedAt = Date.now();
          live.loading = true;
          requestResume(true);
          scheduleRender();
        });
        var host = start && start.parentElement;
        if (host) host.appendChild(retry);
      }
    }
  }

  function scoreOf(record) {
    var values = [record.bestScore, record.latestScore, record.score];
    for (var i = 0; i < values.length; i += 1) {
      var number = Number(values[i]);
      if (Number.isFinite(number)) return number;
    }
    return 0;
  }

  function findPortfolioTable() {
    var tables = document.querySelectorAll('#app table, table');
    for (var i = 0; i < tables.length; i += 1) {
      var headers = text(tables[i].querySelector('thead') ? tables[i].querySelector('thead').textContent : tables[i].textContent).toLowerCase();
      if (headers.indexOf('session') >= 0 && headers.indexOf('skill') >= 0 && headers.indexOf('score') >= 0) return tables[i];
    }
    return null;
  }

  function renderPortfolio() {
    var table = findPortfolioTable();
    if (!table) return;
    var tbody = table.tBodies && table.tBodies[0];
    if (!tbody) { tbody = document.createElement('tbody'); table.appendChild(tbody); }

    var records = (live.records || []).filter(function (record) {
      return /^S\d+$/.test(normalizeRoute(record.sessionId || record.routeId)) &&
        SKILLS.indexOf(text(record.skill)) >= 0 && scoreOf(record) > 0;
    });

    var best = {};
    records.forEach(function (record) {
      var route = normalizeRoute(record.sessionId || record.routeId);
      var skill = text(record.skill);
      var key = route + '|' + skill;
      if (!best[key] || scoreOf(record) > scoreOf(best[key])) best[key] = record;
    });
    records = Object.keys(best).map(function (key) { return best[key]; });

    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px">ยังไม่มีหลักฐานรายทักษะที่ยืนยันจาก Google Sheet</td></tr>';
      return;
    }

    records.sort(function (a, b) {
      return text(b.updatedAt).localeCompare(text(a.updatedAt));
    });
    tbody.innerHTML = records.slice(0, 12).map(function (record) {
      var route = normalizeRoute(record.sessionId || record.routeId);
      var date = text(record.updatedAt) || 'ยืนยันแล้ว';
      try { date = new Date(date).toLocaleString('th-TH', { timeZone:'Asia/Bangkok' }); } catch (_) {}
      return '<tr data-eap-authority="sheet">' +
        '<td>' + date + '</td>' +
        '<td>' + route + '</td>' +
        '<td>' + text(record.skill) + '</td>' +
        '<td><strong>' + scoreOf(record) + '/100</strong></td>' +
        '<td>ยืนยันจาก Google Sheet แล้ว</td>' +
        '</tr>';
    }).join('');
    table.dataset.eapAuthorityVersion = VERSION;
  }

  function render() {
    renderLobby();
    renderPortfolio();
    document.documentElement.dataset.eapAuthorityRuntime = VERSION;
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 60);
  }

  function resetForProfile() {
    live = { verified:false, loading:true, route:'', records:[], identity:identityOf(), checkedAt:'' };
    loadingStartedAt = Date.now();
    requestResume(true);
    scheduleRender();
  }

  function refreshAfterSubmit() {
    setTimeout(function () { requestResume(true); }, 500);
    setTimeout(function () { requestResume(true); }, 2500);
  }

  window.addEventListener('eap:resume-synced', acceptResume);
  window.addEventListener('eap:profile-changed', resetForProfile);
  window.addEventListener('online', function () { requestResume(true); });
  [
    'eap:local-result-saved','eap:sheet-delivery-queued','eap:evidence-submitted',
    'eap:boss-completed','eap:boss-completion-submitted','eap:resume-refresh-requested'
  ].forEach(function (name) { window.addEventListener(name, refreshAfterSubmit); });

  new MutationObserver(scheduleRender).observe(document.documentElement, { childList:true, subtree:true });
  setInterval(render, 1200);

  restoreVerifiedCache();
  requestResume(true);
  scheduleRender();

  window.EAPAuthorityRuntime = {
    version: VERSION,
    acceptResume: acceptResume,
    refresh: function () { return requestResume(true); },
    currentRoute: function () { return live.verified ? live.route : ''; },
    records: function () { return (live.records || []).slice(); },
    isVerified: function () { return live.verified; },
    diagnostics: function () {
      return {
        version: VERSION,
        verified: live.verified,
        loading: live.loading,
        currentRoute: live.route,
        recordCount: live.records.length,
        identity: live.identity || identityOf(),
        checkedAt: live.checkedAt
      };
    }
  };
})();
