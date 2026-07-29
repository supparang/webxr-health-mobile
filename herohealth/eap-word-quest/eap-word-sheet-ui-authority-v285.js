/* =========================================================
   EAP Word Quest • Sheet-authoritative Home UI
   Version: 20260729-EAPWQ-V285-SHEET-UI-AUTHORITY

   Google Sheet resume is the official source for:
   - passed mission count / progress
   - current mission
   - Home primary CTA

   This patch updates the existing DOM only after an official Sheet response.
   It uses a short bounded refresh window; no observer and no endless polling.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260729-EAPWQ-V285-SHEET-UI-AUTHORITY';
  var FLOW = ['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var latest = null;

  if (window.__EAP_WORD_V285_SHEET_UI_AUTHORITY__) return;
  window.__EAP_WORD_V285_SHEET_UI_AUTHORITY__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function num(value) {
    var n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
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

  function playedCurrent(resume, current) {
    var row = resume.sessions && resume.sessions[current];
    return Boolean(row && (row.played || num(row.attempts) > 0));
  }

  function aggregateAccuracy(resume) {
    var values = [];
    FLOW.forEach(function (id) {
      var row = resume.sessions && resume.sessions[id];
      if (!row || !row.played) return;
      var accuracy = num(row.bestAccuracy || row.latestAccuracy);
      if (accuracy > 0) values.push(accuracy);
    });
    if (!values.length) return 0;
    return Math.round(values.reduce(function (sum, value) { return sum + value; }, 0) / values.length);
  }

  function weakCount(resume) {
    if (Array.isArray(resume.weakWords)) return resume.weakWords.length;
    var found = Object.create(null);
    FLOW.forEach(function (id) {
      var row = resume.sessions && resume.sessions[id];
      (row && Array.isArray(row.weakWords) ? row.weakWords : []).forEach(function (word) {
        var key = text(typeof word === 'string' ? word : (word && (word.word || word.term || word.target)));
        if (key) found[key.toLowerCase()] = true;
      });
    });
    return Object.keys(found).length;
  }

  function totalAttempts(resume) {
    if (num(resume.totalAttempts) > 0) return num(resume.totalAttempts);
    return FLOW.reduce(function (sum, id) {
      return sum + num(resume.sessions && resume.sessions[id] && resume.sessions[id].attempts);
    }, 0);
  }

  function statCard(value, label) {
    return '<div class="stat-card eap-sheet-stat"><strong>' + value + '</strong><span>' + label + '</span></div>';
  }

  function renderHomeStats(resume) {
    var host = byId('homeStats');
    var passed = passedIds(resume);
    var progress = Math.max(num(resume.progressPercent), Math.round((passed.length / FLOW.length) * 100));
    var accuracy = aggregateAccuracy(resume);
    var weak = weakCount(resume);
    var attempts = totalAttempts(resume);
    if (!host) return;

    host.innerHTML = [
      statCard(passed.length + '/' + FLOW.length, 'ความก้าวหน้าภารกิจ'),
      statCard(passed.length, 'ภารกิจที่ผ่าน'),
      statCard(accuracy + '%', 'คะแนนเฉลี่ย Core'),
      statCard(weak, 'คำที่ต้องทบทวน'),
      statCard(attempts, 'รอบที่เล่นจาก Core')
    ].join('');
    host.dataset.sheetAuthority = 'true';
    host.dataset.sheetProgress = String(progress);
  }

  function renderPrimaryCta(resume) {
    var button = byId('quickStartBtn');
    var current = text(resume.currentSession || resume.nextMission || 'S1').toUpperCase();
    var label;
    if (!button) return;

    if (current === 'DONE') {
      label = 'ดูสรุปความก้าวหน้า';
      button.dataset.session = 'DONE';
    } else {
      label = playedCurrent(resume, current) ? ('ฝึก ' + current + ' ต่อ') : ('ไปทำ ' + current + ' ต่อ');
      button.dataset.session = current;
    }
    button.textContent = label;
    button.dataset.sheetAuthority = 'true';
    button.disabled = false;
    button.removeAttribute('aria-disabled');
  }

  function applyResume(resume) {
    if (!resume || resume.ok !== true || resume.official !== true) return;
    latest = resume;
    renderHomeStats(resume);
    renderPrimaryCta(resume);
  }

  function boundedApply(resume) {
    [0, 80, 250, 700, 1600, 3200, 6000].forEach(function (delay) {
      setTimeout(function () { applyResume(resume); }, delay);
    });
  }

  function onAuthority(event) {
    var detail = event && event.detail;
    var resume = detail && detail.resume;
    var profile = detail && detail.profile;
    if (!profile || profile.official !== true) return;
    boundedApply(resume);
  }

  window.addEventListener('eap-word-authority-ready', onAuthority);
  window.addEventListener('eap-word-sheet-confirmed', function (event) {
    var detail = event && event.detail;
    if (detail && detail.resume) boundedApply(detail.resume);
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && latest) applyResume(latest);
  });
  window.addEventListener('pageshow', function () {
    if (latest) applyResume(latest);
  });

  window.inspectEapWordSheetUiAuthorityV285 = function () {
    return {
      version: VERSION,
      currentSession: latest && latest.currentSession,
      passed: latest ? passedIds(latest).length : 0,
      homeAuthority: byId('homeStats') && byId('homeStats').dataset.sheetAuthority === 'true'
    };
  };

  console.info('[EAP Word Quest] V285 Sheet UI authority ready', { version: VERSION });
})();
