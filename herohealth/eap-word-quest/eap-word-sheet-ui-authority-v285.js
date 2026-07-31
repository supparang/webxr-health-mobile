/* =========================================================
   EAP Word Quest • Sheet-authoritative Core + Home UI
   Version: 20260731-EAPWQ-V286-SHEET-CORE-AUTHORITY

   Google Sheet is the official source of truth. This patch:
   1) writes the official resume into the exact V196 Core state key,
   2) performs one guarded reload when Core differs from Sheet,
   3) keeps Home statistics and CTA aligned during the current page.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V286-SHEET-CORE-AUTHORITY';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var GROUP = '122';
  var CORE_PREFIX = 'EAP_WORD_QUEST_CORE_V196_STATE';
  var RELOAD_PREFIX = 'EAPWQ_V286_CORE_SYNC_';
  var latest = null;

  if (window.__EAP_WORD_V286_SHEET_CORE_AUTHORITY__) return;
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
      console.error('[EAP Word Quest] V286 core write failed', error);
      return false;
    }
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
    return {
      played: Boolean(row.played || num(row.attempts) > 0),
      passed: Boolean(row.passed),
      accuracy: clamp(Math.round(num(row.latestAccuracy || row.bestAccuracy)), 0, 100),
      bestAccuracy: clamp(Math.round(num(row.bestAccuracy || row.latestAccuracy)), 0, 100),
      bestScore: Math.max(0, Math.round(num(row.bestScore || row.latestScore))),
      lastAccuracy: clamp(Math.round(num(row.latestAccuracy || row.bestAccuracy)), 0, 100),
      lastScore: Math.max(0, Math.round(num(row.latestScore || row.bestScore))),
      totalAttempts: Math.max(0, Math.round(num(row.attempts))),
      lastPlayed: text(row.lastPlayed)
    };
  }

  function fingerprint(resume) {
    return FLOW.map(function (id) {
      var row = resume.sessions && resume.sessions[id] || {};
      return id + ':' + (row.played ? 1 : 0) + ':' + (row.passed ? 1 : 0) + ':' + num(row.attempts) + ':' + num(row.bestAccuracy);
    }).join('|') + '|next:' + text(resume.currentSession || resume.nextMission);
  }

  function syncCore(profile, resume) {
    var key = coreKey(profile.studentId);
    var old = readJson(key, {}) || {};
    var sessions = {};
    var changed = false;
    var officialFingerprint = fingerprint(resume);
    var localFingerprint;

    FLOW.forEach(function (id) {
      sessions[id] = compactSession(resume.sessions && resume.sessions[id]);
    });

    localFingerprint = FLOW.map(function (id) {
      var row = old.sessions && old.sessions[id] || {};
      return id + ':' + (row.played ? 1 : 0) + ':' + (row.passed ? 1 : 0) + ':' + num(row.totalAttempts) + ':' + num(row.bestAccuracy);
    }).join('|') + '|next:' + text(old.currentSession);

    changed = localFingerprint !== officialFingerprint;

    writeJson(key, {
      version: 'v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122',
      group: GROUP,
      coreOnly: true,
      sessions: sessions,
      recentItemIds: Array.isArray(old.recentItemIds) ? old.recentItemIds.slice(0, 36) : [],
      weakTargets: old.weakTargets && typeof old.weakTargets === 'object' ? old.weakTargets : {},
      currentSession: text(resume.currentSession || resume.nextMission || 'S1'),
      sheetAuthority: true,
      sheetFingerprint: officialFingerprint,
      createdAt: old.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return { changed: changed, fingerprint: officialFingerprint, key: key };
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
      return sum + num(resume.sessions && resume.sessions[id] && resume.sessions[id].attempts);
    }, 0);
  }

  function statCard(value, label) {
    return '<div class="stat-card eap-sheet-stat"><strong>' + value + '</strong><span>' + label + '</span></div>';
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
      else button.textContent = (currentRow.played || num(currentRow.attempts) > 0) ? ('ฝึก ' + current + ' ต่อ') : ('ไปทำ ' + current + ' ต่อ');
      button.dataset.session = current;
      button.dataset.sheetAuthority = 'true';
      button.disabled = false;
    }
  }

  function apply(event) {
    var detail = event && event.detail;
    var profile = detail && detail.profile;
    var resume = detail && detail.resume;
    var sync;
    var reloadKey;

    if (!profile || profile.official !== true || !text(profile.studentId)) return;
    if (!resume || resume.ok !== true || resume.official !== true || !resume.sessions) return;

    latest = { profile: profile, resume: resume };
    sync = syncCore(profile, resume);
    renderHome(resume);

    if (sync.changed) {
      reloadKey = RELOAD_PREFIX + safeId(profile.studentId);
      if (sessionStorage.getItem(reloadKey) !== sync.fingerprint) {
        sessionStorage.setItem(reloadKey, sync.fingerprint);
        console.info('[EAP Word Quest] V286 reloading after official Core sync', {
          version: VERSION,
          studentId: profile.studentId,
          currentSession: resume.currentSession,
          coreKey: sync.key
        });
        setTimeout(function () { location.reload(); }, 180);
      }
    }
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
    if (!document.hidden && latest) renderHome(latest.resume);
  });
  window.addEventListener('pageshow', function () {
    if (latest) renderHome(latest.resume);
  });

  window.inspectEapWordSheetCoreAuthorityV286 = function () {
    return {
      version: VERSION,
      currentSession: latest && latest.resume && latest.resume.currentSession,
      studentId: latest && latest.profile && latest.profile.studentId,
      coreKey: latest && coreKey(latest.profile.studentId)
    };
  };

  console.info('[EAP Word Quest] V286 Sheet Core authority ready', { version: VERSION });
})();
