/* =========================================================
   EAP Word Quest • Name Selection Persistence Guard
   Version: 20260731-EAPWQ-V287-NAME-SELECTION-PERSIST

   Fixes the race where V283 fills the profile inputs, then V286 reloads
   before the selected identity is saved. The official roster remains the
   authority; this patch only preserves the selected ID/name across reload.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V287-NAME-SELECTION-PERSIST';
  var PROFILE_KEY = 'EAP_WORD_QUEST_PROFILE_V01';
  var PENDING_KEY = 'EAP_WORD_QUEST_PENDING_ROSTER_PROFILE_V287';

  if (window.__EAP_WORD_NAME_SELECTION_PERSIST_V287__) return;
  window.__EAP_WORD_NAME_SELECTION_PERSIST_V287__ = true;

  function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function readInputs() {
    return {
      studentName: text(byId('studentNameInput') && byId('studentNameInput').value),
      studentId: text(byId('studentIdInput') && byId('studentIdInput').value),
      section: text(byId('sectionInput') && byId('sectionInput').value) || '122',
      group: '122',
      selectedFromRoster: true,
      selectedAt: new Date().toISOString()
    };
  }

  function valid(profile) {
    return Boolean(profile && /^\d{10}$/.test(text(profile.studentId)) && text(profile.studentName));
  }

  function write(profile) {
    if (!valid(profile)) return false;
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(profile));
      return true;
    } catch (error) {
      console.error('[EAP Word Quest] V287 could not persist selected roster profile', error);
      return false;
    }
  }

  function restore() {
    var raw;
    var profile;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
      profile = raw ? JSON.parse(raw) : null;
    } catch (ignore) {
      profile = null;
    }
    if (!valid(profile)) return false;

    if (byId('studentNameInput') && !text(byId('studentNameInput').value)) {
      byId('studentNameInput').value = profile.studentName;
    }
    if (byId('studentIdInput') && !text(byId('studentIdInput').value)) {
      byId('studentIdInput').value = profile.studentId;
    }
    if (byId('sectionInput')) byId('sectionInput').value = profile.section || '122';

    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (ignore2) {}
    return true;
  }

  document.addEventListener('click', function (event) {
    var result = event.target && event.target.closest ? event.target.closest('.eap-name-result') : null;
    if (!result) return;

    /* V283 writes the selected values in its target-phase click handler.
       Persist immediately afterward, well before its 100 ms authority reload. */
    setTimeout(function () {
      var profile = readInputs();
      if (write(profile)) {
        console.info('[EAP Word Quest] V287 roster profile persisted before authority reload', {
          studentId: profile.studentId,
          version: VERSION
        });
      }
    }, 0);
    setTimeout(function () { write(readInputs()); }, 35);
  }, true);

  window.addEventListener('eap-word-authority-ready', function (event) {
    var detail = event && event.detail;
    var profile = detail && detail.profile;
    if (!profile || profile.official !== true) return;
    try { sessionStorage.removeItem(PENDING_KEY); } catch (ignore) {}
  });

  function boot() {
    restore();
    setTimeout(restore, 120);
    setTimeout(restore, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.inspectEapWordNameSelectionPersistV287 = function () {
    return {
      version: VERSION,
      profile: readInputs(),
      pending: Boolean(sessionStorage.getItem(PENDING_KEY))
    };
  };

  console.info('[EAP Word Quest] V287 name selection persistence ready', { version: VERSION });
})();
