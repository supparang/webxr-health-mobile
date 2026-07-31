/* =========================================================
   EAP Word Quest • Stable Profile Action Proxy
   Version: 20260731-EAPWQ-V291-PROFILE-ACTIONS-PROXY

   Authority V275 legitimately refreshes the original profile controls at
   bounded delays (0–9000 ms). Keep those controls available to legacy code,
   but isolate the visible student buttons in a stable proxy row so the UI
   never flickers or changes width while authority state settles.
========================================================= */
(function () {
  'use strict';

  var VERSION = '20260731-EAPWQ-V291-PROFILE-ACTIONS-PROXY';
  var PROXY_ID = 'eapStableProfileActionsV291';
  var built = false;

  if (window.__EAP_WORD_PROFILE_ACTIONS_STABILITY_V291__) return;
  window.__EAP_WORD_PROFILE_ACTIONS_STABILITY_V291__ = true;
  window.__EAP_WORD_PROFILE_ACTIONS_STABILITY_V289__ = true;

  function byId(id) {
    return document.getElementById(id);
  }

  function installStyle() {
    if (byId('eapWordProfileActionsStableV291')) return;
    var style = document.createElement('style');
    style.id = 'eapWordProfileActionsStableV291';
    style.textContent = [
      '#eapStableProfileActionsV291{',
      ' display:flex!important;flex-wrap:wrap!important;align-items:center!important;',
      ' gap:10px!important;margin-top:14px!important;min-height:52px!important;',
      ' contain:layout style paint!important;',
      '}',
      '#eapStableProfileActionsV291 .btn{',
      ' visibility:visible!important;opacity:1!important;transform:none!important;',
      ' filter:none!important;animation:none!important;transition:none!important;',
      ' min-height:48px!important;white-space:nowrap!important;',
      '}',
      '#eapStableProfileActionsV291 [data-action="save"]{min-width:146px!important}',
      '#eapStableProfileActionsV291 [data-action="reset"]{min-width:142px!important}',
      '#eapStableProfileActionsV291 [data-action="lookup"]{min-width:270px!important}',
      '.profile-actions.eap-v291-original{',
      ' position:absolute!important;left:-10000px!important;top:auto!important;',
      ' width:1px!important;height:1px!important;overflow:hidden!important;',
      ' opacity:0!important;pointer-events:none!important;margin:0!important;',
      '}',
      '@media(max-width:680px){',
      ' #eapStableProfileActionsV291{display:grid!important;grid-template-columns:1fr!important}',
      ' #eapStableProfileActionsV291 .btn{width:100%!important;min-width:0!important}',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function proxyButton(action, label, sourceId, secondary) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn' + (secondary ? ' secondary' : '');
    button.dataset.action = action;
    button.textContent = label;
    button.addEventListener('click', function () {
      var source = byId(sourceId);
      if (source && !source.disabled) source.click();
    });
    return button;
  }

  function build() {
    var original = document.querySelector('.profile-actions:not(#' + PROXY_ID + ')');
    var save = byId('saveProfileBtn');
    var reset = byId('resetProfileBtn');
    var lookup = byId('eapNameLookupBtn');
    var proxy;

    if (built || byId(PROXY_ID)) return true;
    if (!original || !save || !reset || !lookup) return false;

    installStyle();
    proxy = document.createElement('div');
    proxy.id = PROXY_ID;
    proxy.className = 'profile-actions eap-v291-proxy';
    proxy.setAttribute('aria-label', 'การจัดการข้อมูลผู้เรียน');
    proxy.appendChild(proxyButton('save', 'บันทึกข้อมูล', 'saveProfileBtn', false));
    proxy.appendChild(proxyButton('reset', 'รีเซ็ตข้อมูล', 'resetProfileBtn', true));
    proxy.appendChild(proxyButton('lookup', 'จำรหัสไม่ได้? ค้นหาด้วยชื่อ', 'eapNameLookupBtn', true));

    original.insertAdjacentElement('afterend', proxy);
    original.classList.add('eap-v291-original');
    original.setAttribute('aria-hidden', 'true');
    built = true;
    return true;
  }

  function attemptBuild() {
    if (build()) return;
    [120, 350, 800, 1600, 3000].forEach(function (delay) {
      setTimeout(build, delay);
    });
  }

  function boot() {
    installStyle();
    attemptBuild();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('eap-word-authority-ready', build);
  window.addEventListener('pageshow', build);

  window.inspectEapWordProfileActionsStabilityV291 = function () {
    return {
      version: VERSION,
      built: Boolean(byId(PROXY_ID)),
      originalHidden: Boolean(document.querySelector('.profile-actions.eap-v291-original')),
      visibleButtons: byId(PROXY_ID) ? byId(PROXY_ID).querySelectorAll('button').length : 0
    };
  };

  console.info('[EAP Word Quest] V291 stable profile action proxy ready', { version: VERSION });
})();
