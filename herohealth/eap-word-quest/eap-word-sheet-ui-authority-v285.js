/* =========================================================
   EAP Word Quest • Sheet-authoritative Core/Home/Arc
   Version: 20260731-EAPWQ-V288-SHEET-SINGLE-STATE

   Google Sheet is the sole authority. This patch:
   - persists the official profile before any reload,
   - writes the official resume into the exact V196 Core state key,
   - renders Home statistics and CTA from the same resume,
   - reloads once when the visible Arc map differs from Sheet.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V288-SHEET-SINGLE-STATE';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var GROUP = '122';
  var PROFILE_KEY = 'EAP_WORD_QUEST_PROFILE_V01';
  var CORE_PREFIX = 'EAP_WORD_QUEST_CORE_V196_STATE';
  var RELOAD_PREFIX = 'EAPWQ_V288_ARC_SYNC_';
  var latest = null;

  if (window.__EAP_WORD_V288_SHEET_SINGLE_STATE__) return;
  window.__EAP_WORD_V288_SHEET_SINGLE_STATE__ = true;
  window.__EAP_WORD_V286_SHEET_CORE_AUTHORITY__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function num(value) {
    var n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function safeId(value) {
    return text(value || 'anon').replace(/[^a-z0-9_-]/gi, '_') || 'anon';
  }

  function coreKey(studentId) {
    return CORE_PREFIX + '_' + GROUP + '_' + safeId(studentId);
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (ignore) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('[EAP Word Quest] V288 write failed', key, error);
      return false;
    }
  }

  function persistProfile(profile) {
    var saved = {
      studentName: text(profile.studentName || profile.name),
      studentId: text(profile.studentId || profile.id),
      section: text(profile.section || profile.group || GROUP) || GROUP,
      group: GROUP,
      official: true,
      authority: 'google_sheet_roster',
      updatedAt: new Date().toISOString()
    };
    writeJson(PROFILE_KEY, saved);
    try { sessionStorage.setItem('EAPWQ_V288_PROFILE', JSON.stringify(saved)); } catch (ignore) {}
    if (byId('studentNameInput')) byId('studentNameInput').value = saved.studentName;
    if (byId('studentIdInput')) byId('studentIdInput').value = saved.studentId;
    if (byId('sectionInput')) byId('sectionInput').value = GROUP;
    return saved;
  }

  function passedIds(resume) {
    if (Array.isArray(resume.passedSessions)) {
      return resume.passedSessions.map(function (id) { return text(id).toUpperCase(); }).filter(function (id) {
        return FLOW.indexOf(id) >= 0;
      });
    }
    return FLOW.filter(function (id) {
      return Boolean(resume.sessions && resume.sessions[id] && resume.sessions[id].passed);
    });
  }

  function compactSession(row) {
    row = row && typeof row === 'object' ? row : {};
    var latestAccuracy = num(row.latestAccuracy || row.lastAccuracy || row.accuracy);
    var bestAccuracy = num(row.bestAccuracy || latestAccuracy);
    var latestScore = num(row.latestScore || row.lastScore || row.score);
    var bestScore = num(row.bestScore || latestScore);
    var attempts = num(row.attempts || row.totalAttempts);
    return {
      played: Boolean(row.played || attempts > 0),
      passed: Boolean(row.passed),
      accuracy: clamp(Math.round(bestAccuracy || latestAccuracy), 0, 100),
      bestAccuracy: clamp(Math.round(bestAccuracy), 0, 100),
      bestScore: Math.max(0, Math.round(bestScore)),
      lastAccuracy: clamp(Math.round(latestAccuracy || bestAccuracy), 0, 100),
      lastScore: Math.max(0, Math.round(latestScore)),
      totalAttempts: Math.max(0, Math.round(attempts)),
      lastPlayed: text(row.lastPlayed || row.latestPlayed)
    };
  }

  function fingerprint(resume) {
    return FLOW.map(function (id) {
      var row = resume.sessions && resume.sessions[id] || {};
      return [id, row.played ? 1 : 0, row.passed ? 1 : 0, num(row.attempts || row.totalAttempts), num(row.bestAccuracy)].join(':');
    }).join('|') + '|next:' + text(resume.currentSession || resume.nextMission);
  }

  function syncCore(profile, resume) {
    var key = coreKey(profile.studentId);
    var old = readJson(key, {}) || {};
    var sessions = {};
    FLOW.forEach(function (id) {
      sessions[id] = compactSession(resume.sessions && resume.sessions[id]);
    });

    writeJson(key, {
      version: 'v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122',
      group: GROUP,
      coreOnly: true,
      sessions: sessions,
      recentItemIds: Array.isArray(old.recentItemIds) ? old.recentItemIds.slice(0, 36) : [],
      weakTargets: old.weakTargets && typeof old.weakTargets === 'object' ? old.weakTargets : {},
      sheetAuthority: true,
      sheetFingerprint: fingerprint(resume),
      createdAt: old.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return key;
  }

  function aggregateAccuracy(resume) {
    var values = [];
    FLOW.forEach(function (id) {
      var row = resume.sessions && resume.sessions[id];
      if (!row || !(row.played || num(row.attempts) > 0)) return;
      var accuracy = num(row.bestAccuracy || row.latestAccuracy);
      if (accuracy > 0) values.push(accuracy);
    });
    return values.length ? Math.round(values.reduce(function (sum, value) { return sum + value; }, 0) / values.length) : 0;
  }

  function weakCount(resume) {
    var found = Object.create(null);
    FLOW.forEach(function (id) {
      var row = resume.sessions && resume.sessions[id];
      (row && Array.isArray(row.weakWords) ? row.weakWords : []).forEach(function (word) {
        var key = text(typeof word === 'string' ? word : word && (word.word || word.term || word.target));
        if (key) found[key.toLowerCase()] = true;
      });
    });
    return Object.keys(found).length;
  }

  function totalAttempts(resume) {
    return FLOW.reduce(function (sum, id) {
      return sum + num(resume.sessions && resume.sessions[id] && (resume.sessions[id].attempts || resume.sessions[id].totalAttempts));
    }, 0);
  }

  function statCard(value, label) {
    return '<div class="stat"><b>' + value + '</b><span>' + label + '</span></div>';
  }

  function renderHome(resume) {
    var host = byId('homeStats');
    var button = byId('quickStartBtn');
    var passed = passedIds(resume);
    var current = text(resume.currentSession || resume.nextMission || 'S1').toUpperCase();
    var currentRow = resume.sessions && resume.sessions[current] || {};

    if (host) {
      host.innerHTML = [
        statCard(passed.length + '/' + FLOW.length, 'ความก้าวหน้าภารกิจ'),
        statCard(passed.length, 'ภารกิจที่ผ่าน'),
        statCard(aggregateAccuracy(resume) + '%', 'คะแนนเฉลี่ย Core'),
        statCard(weakCount(resume), 'คำที่ต้องทบทวน'),
        statCard(totalAttempts(resume), 'รอบที่เล่นจาก Core')
      ].join('');
      host.dataset.sheetAuthority = 'true';
    }

    if (button) {
      if (current === 'DONE') button.textContent = 'ดูสรุปความก้าวหน้า';
      else button.textContent = (currentRow.played || num(currentRow.attempts || currentRow.totalAttempts) > 0) ? ('ฝึก ' + current + ' ต่อ') : ('ไปทำ ' + current + ' ต่อ');
      button.dataset.session = current;
      button.dataset.sheetAuthority = 'true';
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }
  }

  function visiblePassedCount() {
    return document.querySelectorAll('#sessionGrid .eap192-session-card.passed').length;
  }

  function visibleCurrentState(current) {
    var card = document.querySelector('#sessionGrid [data-session-id="' + current + '"]');
    return Boolean(card && !card.classList.contains('locked'));
  }

  function reconcile(profile, resume) {
    var passed = passedIds(resume);
    var current = text(resume.currentSession || resume.nextMission || 'S1').toUpperCase();
    var fp = fingerprint(resume);
    var reloadKey = RELOAD_PREFIX + safeId(profile.studentId);
    var mismatch = visiblePassedCount() !== passed.length || !visibleCurrentState(current);

    renderHome(resume);
    if (!mismatch) return;
    if (sessionStorage.getItem(reloadKey) === fp) return;
    sessionStorage.setItem(reloadKey, fp);
    console.info('[EAP Word Quest] V288 reloading mismatched Arc map', {
      studentId: profile.studentId,
      passedSheet: passed.length,
      passedVisible: visiblePassedCount(),
      currentSession: current
    });
    setTimeout(function () { location.reload(); }, 220);
  }

  function apply(event) {
    var detail = event && event.detail;
    var profile = detail && detail.profile;
    var resume = detail && detail.resume;
    var savedProfile;
    if (!profile || profile.official !== true || !text(profile.studentId)) return;
    if (!resume || resume.ok !== true || resume.official !== true || !resume.sessions) return;

    savedProfile = persistProfile(profile);
    latest = { profile: savedProfile, resume: resume };
    syncCore(savedProfile, resume);
    [0, 100, 350, 900, 1800].forEach(function (delay) {
      setTimeout(function () { reconcile(savedProfile, resume); }, delay);
    });
  }

  window.addEventListener('eap-word-authority-ready', apply);
  window.addEventListener('eap-word-sheet-confirmed', function (event) {
    var detail = event && event.detail;
    var profile = null;
    try {
      if (typeof window.getEapWordOfficialProfileV278 === 'function') profile = window.getEapWordOfficialProfileV278();
    } catch (ignore) {}
    if (detail && detail.resume) apply({ detail: { profile: profile, resume: detail.resume } });
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && latest) reconcile(latest.profile, latest.resume);
  });
  window.addEventListener('pageshow', function () {
    if (latest) reconcile(latest.profile, latest.resume);
  });

  window.inspectEapWordSheetAuthorityV288 = function () {
    return {
      version: VERSION,
      studentId: latest && latest.profile && latest.profile.studentId,
      currentSession: latest && latest.resume && latest.resume.currentSession,
      passedSheet: latest ? passedIds(latest.resume).length : 0,
      passedVisible: visiblePassedCount(),
      coreKey: latest && coreKey(latest.profile.studentId)
    };
  };

  console.info('[EAP Word Quest] V288 Sheet single-state authority ready', { version: VERSION });
})();
