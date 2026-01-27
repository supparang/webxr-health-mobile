// === /herohealth/vr-groups/flush-log.js ===
// GroupsVR Flush Log — PRODUCTION (PACK 13)
// ✅ Flush-hardened: pagehide, visibilitychange(hidden), beforeunload, freeze
// ✅ Throttle + single-flight lock
// ✅ Recovery: store pending summary in localStorage if send fails, auto resend on next load
// ✅ Also flush Telemetry queue if GroupsVR.Telemetry exists
// ✅ Endpoint: from ?log=... (POST JSON via sendBeacon or fetch keepalive)

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  if (NS.__FLUSH_LOG_LOADED__) return;
  NS.__FLUSH_LOG_LOADED__ = true;

  // ---------- utils ----------
  function qs(k, def = null) {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function isoNow() { try { return new Date().toISOString(); } catch { return String(Date.now()); } }
  function nowMs() { return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function safeParse(s, fb) { try { return JSON.parse(s); } catch { return fb; } }

  function getEndpoint() {
    const u = String(qs('log', '') || '').trim();
    return u ? u : '';
  }

  // localStorage keys
  const LS_PENDING = 'HHA_PENDING_SUMMARY_GroupsVR';
  const LS_PENDING_TS = 'HHA_PENDING_SUMMARY_GroupsVR_TS';

  // throttle/lock
  let _lastFlushAt = 0;
  let _inFlight = false;

  // allow user to bind: GroupsVR.bindFlushOnLeave(() => lastSummary)
  NS.bindFlushOnLeave = function bindFlushOnLeave(getSummaryFn, opt) {
    opt = opt || {};
    const endpoint = String(opt.endpoint || getEndpoint() || '');
    const throttleMs = Number(opt.throttleMs || 700);
    const alsoFlushTelemetry = (opt.alsoFlushTelemetry !== false); // default true

    if (!endpoint) {
      // still keep recovery storage so user can export later
      // (we keep it passive; no endpoint means no send)
    }

    // try resend pending from previous crash/close
    tryResendPending(endpoint, alsoFlushTelemetry);

    const flushHard = (reason) => {
      const t = nowMs();
      if (t - _lastFlushAt < throttleMs) return;
      if (_inFlight) return;
      _lastFlushAt = t;

      const summary = (typeof getSummaryFn === 'function') ? getSummaryFn() : null;
      // store pending first (so even if the tab dies mid-send, we can resend later)
      if (summary) storePending(summary);

      // fire and forget send + telemetry flush
      _inFlight = true;
      sendSummary(endpoint, summary, reason || 'leave')
        .catch(() => {})
        .finally(() => { _inFlight = false; });

      if (alsoFlushTelemetry) {
        try {
          const T = NS.Telemetry;
          if (T && typeof T.flushNow === 'function') {
            // do not await (unload-safe)
            T.flushNow('leave').catch(() => {});
          }
        } catch (_) {}
      }
    };

    // install guards once
    installOnce(flushHard);

    // optional manual flush API for debug
    NS.flushNow = async function flushNow(reason) {
      const summary = (typeof getSummaryFn === 'function') ? getSummaryFn() : null;
      if (summary) storePending(summary);
      const r = await sendSummary(endpoint, summary, reason || 'manual');
      if (alsoFlushTelemetry) {
        try {
          const T = NS.Telemetry;
          if (T && typeof T.flushNow === 'function') await T.flushNow('manual');
        } catch (_) {}
      }
      return r;
    };

    return true;
  };

  // ---------- pending storage ----------
  function storePending(summary) {
    try {
      localStorage.setItem(LS_PENDING, JSON.stringify(summary));
      localStorage.setItem(LS_PENDING_TS, isoNow());
    } catch (_) {}
  }

  function clearPending() {
    try {
      localStorage.removeItem(LS_PENDING);
      localStorage.removeItem(LS_PENDING_TS);
    } catch (_) {}
  }

  function loadPending() {
    try {
      const s = localStorage.getItem(LS_PENDING);
      if (!s) return null;
      return safeParse(s, null);
    } catch (_) {
      return null;
    }
  }

  // ---------- sender ----------
  async function sendSummary(endpoint, summary, reason) {
    reason = String(reason || 'send');
    // If no endpoint, just keep pending (recovery/export)
    if (!endpoint) {
      return { ok: false, reason: 'no-endpoint', stored: !!summary };
    }
    if (!summary) {
      return { ok: true, reason: 'no-summary', sent: 0 };
    }

    const payload = {
      v: 1,
      kind: 'summary',
      ts: isoNow(),
      reason,
      url: String(location.href || ''),
      summary
    };

    const body = JSON.stringify(payload);

    // sendBeacon first
    let ok = false;
    try {
      if (navigator && typeof navigator.sendBeacon === 'function') {
        ok = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      }
    } catch (_) {}

    // fallback fetch keepalive
    if (!ok) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
          mode: 'no-cors'
        });
        ok = !!res;
      } catch (_) {
        ok = false;
      }
    }

    if (ok) {
      // if we sent successfully, clear pending
      clearPending();
      return { ok: true, reason: 'sent' };
    }

    // keep pending for recovery
    return { ok: false, reason: 'send-failed', stored: true };
  }

  // ---------- resend pending on next load ----------
  function tryResendPending(endpoint, alsoFlushTelemetry) {
    const pending = loadPending();
    if (!pending) return;

    // don't spam: resend once on load if endpoint exists
    if (!endpoint) return;

    // attempt quickly, no UI blocking
    sendSummary(endpoint, pending, 'recover')
      .catch(() => {})
      .finally(() => {});

    if (alsoFlushTelemetry) {
      try {
        const T = NS.Telemetry;
        if (T && typeof T.flushNow === 'function') {
          T.flushNow('recover').catch(() => {});
        }
      } catch (_) {}
    }
  }

  // ---------- guard install ----------
  let _guardsInstalled = false;
  function installOnce(flushFn) {
    if (_guardsInstalled) return;
    _guardsInstalled = true;

    const hard = () => flushFn('leave');

    root.addEventListener('pagehide', hard, { capture: true });
    root.addEventListener('beforeunload', hard, { capture: true });

    DOC.addEventListener('visibilitychange', () => {
      if (DOC.visibilityState === 'hidden') hard();
    }, { capture: true });

    // Chrome freeze
    root.addEventListener('freeze', hard, { capture: true });

    // optional: online => try resend pending
    root.addEventListener('online', () => {
      const ep = getEndpoint();
      tryResendPending(ep, true);
    }, { passive: true });
  }

})(typeof window !== 'undefined' ? window : globalThis);