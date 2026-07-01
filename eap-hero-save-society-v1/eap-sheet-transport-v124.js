/* =========================================================
   EAP Hero • Trusted Result Transport v124
   Purpose:
   - Runs BEFORE eap-hero.js.
   - Captures only the core game's own submit_attempt request.
   - Preserves its exact session / skill / score payload.
   - Adds the receiver trust marker required by EAPHero.gs v118.
   - Does not scan, replay, or backfill portfolio history.
========================================================= */
(function () {
  'use strict';

  var cfg = window.EAP_SHEET_CONFIG || {};
  if (!cfg.enabled || !cfg.webAppUrl || !window.fetch) return;

  var nativeFetch = window.fetch.bind(window);
  var frameName = 'eap_hero_sheet_receiver_v124';

  function ensureFrame() {
    var frame = document.getElementById(frameName);
    if (frame) return frame;

    frame = document.createElement('iframe');
    frame.id = frameName;
    frame.name = frameName;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'display:none!important;width:1px;height:1px;border:0';
    document.documentElement.appendChild(frame);
    return frame;
  }

  function isHeroAttempt(urlText) {
    try {
      var url = new URL(urlText, location.href);
      var endpoint = new URL(cfg.webAppUrl);

      return url.origin === endpoint.origin &&
        url.pathname === endpoint.pathname &&
        String(url.searchParams.get('action') || '').toLowerCase() === 'submit_attempt';
    } catch (error) {
      return false;
    }
  }

  function forwardTrusted(urlText) {
    try {
      var url = new URL(urlText, location.href);
      ensureFrame();

      var form = document.createElement('form');
      form.method = 'GET';
      form.action = cfg.webAppUrl;
      form.target = frameName;
      form.style.display = 'none';

      url.searchParams.forEach(function (value, key) {
        var field = document.createElement('input');
        field.type = 'hidden';
        field.name = key;
        field.value = value;
        form.appendChild(field);
      });

      var trusted = document.createElement('input');
      trusted.type = 'hidden';
      trusted.name = 'submissionKind';
      trusted.value = 'fresh_evidence_v118';
      form.appendChild(trusted);

      var version = document.createElement('input');
      version.type = 'hidden';
      version.name = 'bridgeVersion';
      version.value = 'v124';
      form.appendChild(version);

      document.body.appendChild(form);
      form.submit();
      setTimeout(function () {
        try { form.remove(); } catch (ignore) {}
      }, 0);

      return true;
    } catch (error) {
      return false;
    }
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string'
      ? input
      : (input && input.url ? input.url : '');

    if (isHeroAttempt(url) && forwardTrusted(url)) {
      return Promise.resolve(new Response('', {
        status: 204,
        statusText: 'EAP Hero result forwarded'
      }));
    }

    return nativeFetch(input, init);
  };

  window.EAPHeroTrustedTransportV124 = {
    active: true,
    version: 'v124'
  };
})();
