window.HH_CONFIG = window.HH_CONFIG || {};

window.HH_CONFIG.backend = {
  enabled: true,
  webAppUrl: "https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec",
  queueOffline: true,
  duplicateGuard: true,
  syncIntervalMs: 15000
};

window.HH_CONFIG.teacherAccess = {
  sessionKey: "herohealth_teacher_authorized_v1",
  pin: "7319"
};

/*
 * Game Shell transport hotfix R35
 *
 * game-shell-once.html historically sends the complete game payload through
 * GET/JSONP. Research telemetry can make that URL too long, producing
 * sheet_load_failed before Apps Script receives the request.
 *
 * This scoped interceptor changes only action=submit + eventType=game into a
 * hidden-form POST. Short JSONP reads (event, student, reconcileStudent) remain
 * unchanged. The original game shell receives a normal acknowledgement only
 * after HH_Events confirms the exact eventId.
 */
(() => {
  'use strict';

  const VERSION = '20260730-GAME-FORM-POST-VERIFY-R35';
  const shellPath = /\/HeroHealth_Learning1\/game-shell-once\.html$/;

  if (!shellPath.test(location.pathname)) return;
  if (window.__HH_GAME_FORM_POST_R35__) return;
  window.__HH_GAME_FORM_POST_R35__ = VERSION;

  const endpoint = String(window.HH_CONFIG?.backend?.webAppUrl || '').trim();
  if (!endpoint) return;

  const endpointUrl = new URL(endpoint, location.href);
  const originalAppendChild = Node.prototype.appendChild;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function sameEndpoint(url) {
    return url.origin === endpointUrl.origin && url.pathname === endpointUrl.pathname;
  }

  function originalAppend(parent, node) {
    return originalAppendChild.call(parent, node);
  }

  function shortJsonp(params, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const callback = 'HHGPOST_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const script = document.createElement('script');
      let settled = false;

      const finish = (error, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onerror = null;
        try { delete window[callback]; } catch (_) {}
        try { script.remove(); } catch (_) {}
        error ? reject(error) : resolve(data);
      };

      const timer = setTimeout(() => finish(new Error('sheet_timeout')), timeoutMs);
      window[callback] = data => finish(null, data);
      script.onerror = () => finish(new Error('sheet_load_failed'));
      script.async = true;
      script.src = endpoint + '?' + new URLSearchParams({
        ...params,
        callback,
        transport: 'jsonp-short-r35',
        clientVersion: VERSION,
        _: String(Date.now())
      }).toString();

      originalAppend(document.head || document.body || document.documentElement, script);
    });
  }

  function hiddenFormPost(payloadText) {
    return new Promise((resolve, reject) => {
      try {
        const targetName = 'HH_GAME_POST_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const iframe = document.createElement('iframe');
        const form = document.createElement('form');

        iframe.name = targetName;
        iframe.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-9999px;top:-9999px';
        iframe.setAttribute('aria-hidden', 'true');

        form.method = 'POST';
        form.action = endpoint;
        form.target = targetName;
        form.acceptCharset = 'UTF-8';
        form.enctype = 'application/x-www-form-urlencoded';
        form.style.display = 'none';

        const fields = {
          action: 'submit',
          payload: payloadText,
          transport: 'hidden-form-post-r35',
          clientVersion: VERSION,
          _: String(Date.now())
        };

        Object.entries(fields).forEach(([name, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });

        originalAppend(document.body || document.documentElement, iframe);
        originalAppend(document.body || document.documentElement, form);
        form.submit();

        setTimeout(() => resolve({ ok: true }), 250);
        setTimeout(() => {
          try { form.remove(); } catch (_) {}
          try { iframe.remove(); } catch (_) {}
        }, 60000);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function confirmSubmission(payload, callbackName, interceptedScript) {
    const eventId = String(payload?.eventId || '').trim();
    const studentId = String(payload?.studentId || '').trim();

    const reply = data => {
      const callback = window[callbackName];
      if (typeof callback === 'function') {
        callback(data);
      } else if (typeof interceptedScript.onerror === 'function') {
        interceptedScript.onerror(new Event('error'));
      }
    };

    try {
      if (!eventId || !studentId) throw new Error('missing_game_event_identity');

      await hiddenFormPost(JSON.stringify(payload));

      const delays = [600, 800, 950, 1100, 1250, 1450, 1650, 1850, 2100, 2400];
      let eventApi = null;

      for (const baseDelay of delays) {
        await sleep(baseDelay + Math.floor(Math.random() * 350));
        eventApi = await shortJsonp({ action: 'event', eventId }).catch(() => null);
        if (eventApi?.ok === true && eventApi?.found === true) break;
      }

      if (!(eventApi?.ok === true && eventApi?.found === true)) {
        throw new Error('event_not_found_after_form_post');
      }

      const studentApi = await shortJsonp({
        action: 'student',
        studentId,
        reconcile: '1'
      }).catch(() => null);

      reply({
        ...(studentApi && typeof studentApi === 'object' ? studentApi : {}),
        ok: true,
        eventId,
        studentId,
        transport: 'hidden-form-post-r35',
        version: studentApi?.version || VERSION
      });
    } catch (error) {
      console.error('[HeroHealth game form POST]', error);
      reply({
        ok: false,
        eventId,
        studentId,
        error: String(error?.message || error),
        transport: 'hidden-form-post-r35',
        version: VERSION
      });
    }
  }

  Node.prototype.appendChild = function patchedAppendChild(node) {
    try {
      if (node?.tagName === 'SCRIPT' && node.src) {
        const url = new URL(node.src, location.href);
        const action = String(url.searchParams.get('action') || '');
        const payloadText = url.searchParams.get('payload');
        const callbackName = String(url.searchParams.get('callback') || '');

        if (sameEndpoint(url) && action === 'submit' && payloadText && callbackName) {
          const payload = JSON.parse(payloadText);
          if (String(payload?.eventType || payload?.type || '').toLowerCase() === 'game') {
            node.dataset.hhTransport = VERSION;
            confirmSubmission(payload, callbackName, node);
            return node;
          }
        }
      }
    } catch (error) {
      console.warn('[HeroHealth game transport interception]', error);
    }

    return originalAppendChild.call(this, node);
  };

  console.info('[HeroHealth] game result transport installed', VERSION);
})();
