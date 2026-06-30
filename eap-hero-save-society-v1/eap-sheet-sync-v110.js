/* EAP Hero v110: direct portfolio-to-Sheet sync.
   Reads saved portfolio records only. It never reads result-page text.
*/
(function () {
  'use strict';
  const CONFIG = window.EAP_SHEET_CONFIG || {};
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const SENT_KEY = 'EAP_HERO_SHEET_SENT_V110';

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || ''); }
    catch (_) { return fallback; }
  }

  function asText(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function getProfile(state) {
    const p = state.profile || state.player || {};
    return {
      studentId: asText(p.studentId || p.id || state.studentId || 'guest'),
      studentName: asText(p.studentName || p.name || state.studentName || 'Guest'),
      section: asText(p.section || state.section || CONFIG.section || '122')
    };
  }

  function requestUrl(payload) {
    const url = new URL(CONFIG.webAppUrl);
    Object.keys(payload).forEach((key) => url.searchParams.set(key, asText(payload[key])));
    url.searchParams.set('_cache', String(Date.now()));
    return url.toString();
  }

  function send(payload) {
    const image = document.createElement('img');
    image.width = 1;
    image.height = 1;
    image.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none';
    image.onload = image.onerror = () => setTimeout(() => image.remove(), 100);
    image.src = requestUrl(payload);
    document.body.appendChild(image);
  }

  function sync() {
    if (!CONFIG.enabled || !CONFIG.webAppUrl) return;
    const state = readJson(STATE_KEY, null);
    if (!state || !Array.isArray(state.portfolio)) return;

    const profile = getProfile(state);
    const sent = readJson(SENT_KEY, {});

    state.portfolio.forEach((entry, index) => {
      const sessionId = asText(entry.session || entry.sessionId);
      const skill = asText(entry.skill);
      if (!sessionId || !skill) return;

      const score = asNumber(entry.latestScore !== undefined ? entry.latestScore : entry.score);
      const stamp = asText(entry.latestAt || entry.at || entry.evidenceId || index);
      const attemptId = 'eap-' + profile.studentId + '-s' + sessionId + '-' + skill.toLowerCase() + '-' + stamp.replace(/[^A-Za-z0-9_-]/g, '');
      if (sent[attemptId]) return;

      const legacy = entry.legacyCompletion === true || String(entry.legacyCompletion).toLowerCase() === 'true';
      const payload = {
        action: 'submit_attempt',
        attemptId: attemptId,
        studentId: profile.studentId,
        studentName: profile.studentName,
        section: profile.section,
        sessionId: sessionId,
        sessionTitle: asText(entry.sessionTitle || (state.sessions && state.sessions[sessionId] && state.sessions[sessionId].title)),
        skill: skill,
        score: score,
        accuracy: asNumber(entry.accuracy || entry.bestAccuracy || entry.accPct),
        passMark: 60,
        passed: legacy || score >= 60,
        legacyCompletion: legacy,
        hintUsed: asNumber(entry.aiUses || entry.hintUsed),
        replay: entry.replay === true,
        clientTimestamp: stamp,
        sourceUrl: location.href
      };

      send(payload);
      sent[attemptId] = Date.now();
    });

    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  }

  window.EAPSheetSyncV110 = { sync };
  window.addEventListener('load', () => setTimeout(sync, 700));
  setInterval(sync, 1800);
})();
