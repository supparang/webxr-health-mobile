/* =========================================================
   EAP Hero Sheet Envelope v132
   - Enriches every Sheet payload with 15-week route/replay/scenario metadata.
   - Forces no-cors payloads through fetch so the JSON can be enriched.
   - Adds local send-attempt queue/status for classroom troubleshooting.
   - Adds hidden fields to manual Sheet form submission.
   - Does not change scores, pass/fail, evidence content, or Apps Script endpoint.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-SHEET-ENVELOPE-V132';
  const CONFIG_NAME = 'EAP_SHEET_CONFIG';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const QUEUE_KEY = 'EAP_SHEET_ENVELOPE_V132_QUEUE';
  const STATUS_ID = 'eap-sheet-envelope-status';
  const STYLE_ID = 'eap-sheet-envelope-style';
  const MAX_QUEUE = 80;

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  const originalBeacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
  const originalFormSubmit = HTMLFormElement.prototype.submit;

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function safe(value, limit){ return clean(value).slice(0, limit || 800); }
  function nowIso(){ try { return new Date().toISOString(); } catch(error) { return String(Date.now()); } }

  function config(){ return window[CONFIG_NAME] || {}; }
  function endpoint(){ return safe(config().webAppUrl || '', 2000); }
  function isEapEndpoint(url){
    const ep = endpoint();
    return !!ep && safe(url || '', 2000).indexOf(ep) === 0;
  }

  function readJson(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(error) { return fallback; }
  }

  function writeJson(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(error) {}
  }

  function appText(){ return safe((document.getElementById('app') || document.body).innerText || '', 12000); }

  function pack(){
    const data = window[PACK_NAME];
    return data && Array.isArray(data.routes) ? data : null;
  }

  function byRouteId(routeId){
    const data = pack();
    const key = safe(routeId, 40).toUpperCase();
    if (!data || !key) return null;
    return data.routes.find(route => safe(route.routeId, 40).toUpperCase() === key) || null;
  }

  function routeIdFromUrl(){
    const params = new URLSearchParams(location.search);
    const raw = safe(params.get('session') || params.get('route') || params.get('stage') || '', 40);
    if (!raw) return '';
    return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
  }

  function routeIdFromStorage(){
    const keys = ['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION','EAP_ACTIVE_SESSION'];
    for (const key of keys) {
      try {
        const raw = safe(localStorage.getItem(key), 40);
        if (raw) return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
      } catch(error) {}
    }
    return '';
  }

  function routeIdFromPayload(payload){
    const raw = safe(payload && (payload.routeId || payload.sessionId || payload.session || payload.stage), 40);
    if (!raw) return '';
    return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
  }

  function routeIdFromDom(){
    const text = appText();
    const session = text.match(/Session\s*(1[0-5]|[1-9])/i);
    if (session) return 'S' + Number(session[1]);
    const boss = text.match(/\b(B[1-5])\b/i);
    if (boss) return boss[1].toUpperCase();
    const data = pack();
    if (!data) return '';
    const lower = text.toLowerCase();
    const found = data.routes.find(route => {
      const title = safe(route.title, 240).toLowerCase();
      const rid = safe(route.routeId, 40).toLowerCase();
      return (title && lower.includes(title)) || (rid && new RegExp('\\b' + rid + '\\b','i').test(lower));
    });
    return found ? found.routeId : '';
  }

  function currentRoute(payload){
    return byRouteId(routeIdFromPayload(payload)) || byRouteId(routeIdFromUrl()) || byRouteId(routeIdFromDom()) || byRouteId(routeIdFromStorage()) || null;
  }

  function routeNumber(route){
    const m = safe(route && route.routeId, 40).match(/^S(\d+)$/i);
    return m ? Number(m[1]) : '';
  }

  function skillKey(payload){ return safe(payload && payload.skill, 80).toLowerCase(); }

  function skillRole(route, skill){
    const contract = route && route.skillContract || {};
    return safe(contract[skill] || contract[skill.toLowerCase()] || '', 40);
  }

  function replayChallenge(route){
    try {
      if (window.EAPReplayChallengeDirector && typeof window.EAPReplayChallengeDirector.routeChallenge === 'function') {
        return window.EAPReplayChallengeDirector.routeChallenge(route && route.routeId);
      }
    } catch(error) {}
    return route && route.replayChallenge || {};
  }

  function activeScenarioFromDom(){
    const panel = document.getElementById('eap-replay-challenge-panel');
    const text = safe(panel && panel.innerText || '', 1200);
    const match = text.match(/(S\d{2}_G\d{2}|S\d{1,2}_G\d{2})\s*[·\-]\s*([^\n]+)/i);
    return match ? { scenarioId: match[1], scenarioTitle: safe(match[2], 180) } : {};
  }

  function metaFor(payload){
    const route = currentRoute(payload);
    const routeId = route ? safe(route.routeId, 40) : safe(routeIdFromPayload(payload) || routeIdFromUrl() || routeIdFromStorage(), 40);
    const skill = skillKey(payload);
    const challenge = replayChallenge(route) || {};
    const source = challenge.source || {};
    const domScenario = activeScenarioFromDom();
    const isBoss = !!(route && route.routeType === 'boss_gate') || /^B[1-5]$/i.test(routeId);

    return {
      sheetEnvelopeVersion: VERSION,
      sheetEnvelopeAt: nowIso(),
      course: safe(config().course || 'EAP Hero: Save the Society', 160),
      section: safe((payload && payload.section) || config().section || '122', 40),
      routeId: routeId,
      routeType: safe((route && route.routeType) || (isBoss ? 'boss_gate' : 'session'), 80),
      weekNo: route ? routeNumber(route) : '',
      sessionLabel: route ? safe((isBoss ? routeId : ('Week ' + routeNumber(route) + ' / ' + routeId)), 80) : routeId,
      routeTitle: safe((route && route.title) || (payload && payload.sessionTitle) || '', 240),
      skillRole: route && skill ? skillRole(route, skill) : '',
      replayMode: safe(challenge.mode && (challenge.mode.label || challenge.mode.id) || '', 120),
      replayModeThai: safe(challenge.mode && challenge.mode.th || '', 120),
      replayIntensity: safe(challenge.intensity || '', 120),
      scenarioId: safe(source.id || domScenario.scenarioId || payload && payload.scenarioId || '', 120),
      scenarioTitle: safe(source.title || domScenario.scenarioTitle || payload && payload.scenarioTitle || '', 240),
      noRepeatWindow: challenge.noRepeatWindow || '',
      replayDirectorVersion: safe((window.EAPReplayChallengeDirector && window.EAPReplayChallengeDirector.version) || (challenge && challenge.version) || '', 180),
      choiceGuardVersion: safe((window.EAPAnswerChoiceQualityGuard && window.EAPAnswerChoiceQualityGuard.version) || '', 180),
      studentPageUrl: location.href,
      clientUserAgent: safe(navigator.userAgent, 500)
    };
  }

  function enrichPayload(payload){
    if (!payload || typeof payload !== 'object') return payload;
    const meta = metaFor(payload);
    const enriched = Object.assign({}, payload, meta);
    enriched.sheetMetaJson = JSON.stringify(meta);
    return enriched;
  }

  function payloadKey(payload){
    return safe(payload && (payload.evidenceId || payload.attemptId || payload.action || 'payload'), 180) + '|' + safe(payload && (payload.routeId || payload.sessionId || ''), 60) + '|' + safe(payload && (payload.skill || ''), 60);
  }

  function recordAttempt(payload, transport){
    const q = readJson(QUEUE_KEY, []);
    q.push({
      at: nowIso(),
      key: payloadKey(payload),
      action: safe(payload && payload.action, 80),
      routeId: safe(payload && payload.routeId, 40),
      sessionId: safe(payload && payload.sessionId, 40),
      skill: safe(payload && payload.skill, 60),
      studentId: safe(payload && payload.studentId, 80),
      transport: safe(transport, 40),
      status: 'sent_attempted_no_cors'
    });
    writeJson(QUEUE_KEY, q.slice(-MAX_QUEUE));
    renderStatus();
  }

  function parseBody(body){
    if (typeof body === 'string') {
      try { return JSON.parse(body); } catch(error) { return null; }
    }
    if (body && typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      const obj = {};
      body.forEach((v,k) => { obj[k] = v; });
      return obj;
    }
    return null;
  }

  function serializeLikeOriginal(originalBody, payload){
    if (typeof originalBody === 'string') return JSON.stringify(payload);
    if (originalBody && typeof URLSearchParams !== 'undefined' && originalBody instanceof URLSearchParams) {
      const params = new URLSearchParams();
      Object.keys(payload).forEach(key => params.set(key, typeof payload[key] === 'string' ? payload[key] : JSON.stringify(payload[key])));
      return params;
    }
    return JSON.stringify(payload);
  }

  function patchFetch(){
    if (!originalFetch) return;
    window.fetch = function(input, init){
      try {
        const url = typeof input === 'string' ? input : (input && input.url);
        if (isEapEndpoint(url) && init && init.body) {
          const parsed = parseBody(init.body);
          if (parsed) {
            const enriched = enrichPayload(parsed);
            init = Object.assign({}, init, { body: serializeLikeOriginal(init.body, enriched) });
            recordAttempt(enriched, 'fetch');
          }
        }
      } catch(error) {}
      return originalFetch(input, init);
    };
  }

  function patchBeacon(){
    if (!originalBeacon) return;
    navigator.sendBeacon = function(url, data){
      if (isEapEndpoint(url)) {
        /* Existing sheet sync has fetch fallback. Returning false prevents an
           un-enriched Blob from being sent before our fetch enrichment layer. */
        return false;
      }
      return originalBeacon(url, data);
    };
  }

  function formToObject(form){
    const obj = {};
    Array.from(form.elements || []).forEach(el => {
      if (!el.name) return;
      obj[el.name] = el.value;
    });
    return obj;
  }

  function upsertHidden(form, key, value){
    let input = form.querySelector('input[name="' + key.replace(/"/g,'') + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      form.appendChild(input);
    }
    input.value = typeof value === 'string' ? value : JSON.stringify(value);
  }

  function patchForms(){
    HTMLFormElement.prototype.submit = function(){
      try {
        if (isEapEndpoint(this.action)) {
          const enriched = enrichPayload(formToObject(this));
          Object.keys(enriched).forEach(key => upsertHidden(this, key, enriched[key]));
          recordAttempt(enriched, 'manual_form');
        }
      } catch(error) {}
      return originalFormSubmit.call(this);
    };
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${STATUS_ID}{position:fixed;right:18px;bottom:70px;z-index:99998;border-radius:999px;padding:8px 11px;background:#064e3b;color:#fff;font:800 12px Arial,'Noto Sans Thai',sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.22);display:flex;align-items:center;gap:7px;max-width:calc(100vw - 36px)}
      #${STATUS_ID}.warn{background:#7c2d12}
      #${STATUS_ID} button{border:0;border-radius:999px;background:rgba(255,255,255,.2);color:#fff;font:inherit;padding:4px 7px;cursor:pointer}
      @media(max-width:760px){#${STATUS_ID}{right:12px;bottom:64px;font-size:11px;padding:7px 9px}}
    `;
    document.head.appendChild(style);
  }

  function renderStatus(){
    injectStyle();
    let el = document.getElementById(STATUS_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = STATUS_ID;
      document.body.appendChild(el);
      el.addEventListener('click', function(event){
        const btn = event.target.closest('button');
        if (!btn) return;
        const q = readJson(QUEUE_KEY, []);
        const last = q.slice(-8).map(item => [item.at, item.action, item.routeId || item.sessionId, item.skill, item.transport].filter(Boolean).join(' · ')).join('\n');
        alert(last || 'ยังไม่มีรายการส่ง Sheet ในเครื่องนี้');
      });
    }
    const q = readJson(QUEUE_KEY, []);
    const last = q[q.length - 1];
    el.classList.toggle('warn', !endpoint());
    el.innerHTML = endpoint()
      ? '📤 Sheet: ' + q.length + ' send attempts' + (last ? ' · ' + safe(last.routeId || last.sessionId || '', 20) : '') + ' <button type="button">ดู</button>'
      : '⚠️ Sheet endpoint missing';
  }

  function publicApi(){
    return {
      version: VERSION,
      enrichPayload,
      metaFor,
      queue: () => readJson(QUEUE_KEY, []),
      clearQueue: () => { writeJson(QUEUE_KEY, []); renderStatus(); },
      refresh: renderStatus
    };
  }

  function start(){
    patchBeacon();
    patchFetch();
    patchForms();
    renderStatus();
    window.EAPSheetEnvelopeV132 = publicApi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();