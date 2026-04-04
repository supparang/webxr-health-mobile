// === /herohealth/vr-goodjunk/hha-cloud-logger.js ===
(function(root){
  'use strict';

  function qs(k, d=''){
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_) { return d; }
  }

  const API = qs('api', root.HHA_APPS_SCRIPT_URL || '');

  async function postSummary(summary){
    if (!API) {
      console.warn('[HHA LOGGER] missing api endpoint');
      return;
    }

    const payload = {
      type: 'session_end',
      source: 'herohealth',
      game: 'goodjunk',
      data: summary
    };

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const ok = navigator.sendBeacon(API, blob);
        console.log('[HHA LOGGER] sendBeacon', ok, payload);
        if (ok) return;
      }

      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors'
      });

      const text = await res.text().catch(() => '');
      console.log('[HHA LOGGER] fetch done', res.status, text);
    } catch (err) {
      console.error('[HHA LOGGER] post failed', err);
    }
  }

  function onEnd(e){
    try{
      const summary = e?.detail || {};
      console.log('[HHA LOGGER] hha:end', summary);
      postSummary(summary);
    }catch(err){
      console.error('[HHA LOGGER] onEnd failed', err);
    }
  }

  root.HHACloudLogger = {
    postSummary
  };

  root.addEventListener('hha:end', onEnd);
})(window);