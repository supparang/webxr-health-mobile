/* =========================================================
   EAP Word Quest • Profile Actions Stability Patch
   Version: 20260731-EAPWQ-V289-PROFILE-ACTIONS-STABILITY

   Prevents visible flicker caused by multiple legacy/runtime patches touching
   the profile action row during authority restore and roster lookup startup.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V289-PROFILE-ACTIONS-STABILITY';

  if (window.__EAP_WORD_PROFILE_ACTIONS_STABILITY_V289__) return;
  window.__EAP_WORD_PROFILE_ACTIONS_STABILITY_V289__ = true;

  function installStyle() {
    if (document.getElementById('eapWordProfileActionsStableV289')) return;

    var style = document.createElement('style');
    style.id = 'eapWordProfileActionsStableV289';
    style.textContent = [
      '.profile-actions{',
      '  display:flex!important;',
      '  flex-wrap:wrap!important;',
      '  align-items:center!important;',
      '  gap:10px!important;',
      '  min-height:52px!important;',
      '  contain:layout style!important;',
      '}',
      '.profile-actions #saveProfileBtn,',
      '.profile-actions #resetProfileBtn,',
      '.profile-actions #eapNameLookupBtn{',
      '  visibility:visible!important;',
      '  opacity:1!important;',
      '  transform:none!important;',
      '  filter:none!important;',
      '  animation:none!important;',
      '  transition:none!important;',
      '  will-change:auto!important;',
      '  flex:0 0 auto!important;',
      '  min-height:48px!important;',
      '}',
      '.profile-actions #saveProfileBtn{min-width:146px!important}',
      '.profile-actions #resetProfileBtn{min-width:142px!important}',
      '.profile-actions #eapNameLookupBtn{min-width:270px!important}',
      '.profile-actions [hidden]{display:none!important}',
      '@media(max-width:680px){',
      '  .profile-actions{display:grid!important;grid-template-columns:1fr!important;min-height:0!important}',
      '  .profile-actions #saveProfileBtn,',
      '  .profile-actions #resetProfileBtn,',
      '  .profile-actions #eapNameLookupBtn{width:100%!important;min-width:0!important}',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function stabilize() {
    var row = document.querySelector('.profile-actions');
    if (!row) return;
    row.dataset.eapStable = 'v289';

    ['saveProfileBtn', 'resetProfileBtn', 'eapNameLookupBtn'].forEach(function (id) {
      var button = document.getElementById(id);
      if (!button) return;
      button.style.removeProperty('opacity');
      button.style.removeProperty('visibility');
      button.style.removeProperty('transform');
      button.style.removeProperty('filter');
      button.dataset.eapStable = 'v289';
    });
  }

  function boot() {
    installStyle();
    [0, 80, 250, 700, 1600, 3200].forEach(function (delay) {
      setTimeout(stabilize, delay);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('eap-word-authority-ready', stabilize);
  window.addEventListener('pageshow', stabilize);

  window.inspectEapWordProfileActionsStabilityV289 = function () {
    var row = document.querySelector('.profile-actions');
    return {
      version: VERSION,
      stable: Boolean(row && row.dataset.eapStable === 'v289'),
      buttons: ['saveProfileBtn', 'resetProfileBtn', 'eapNameLookupBtn'].map(function (id) {
        var node = document.getElementById(id);
        return { id: id, exists: Boolean(node), visible: Boolean(node && !node.hidden) };
      })
    };
  };

  console.info('[EAP Word Quest] V289 profile actions stability ready', { version: VERSION });
})();
