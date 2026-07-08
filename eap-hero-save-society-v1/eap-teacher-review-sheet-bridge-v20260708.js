/* =========================================================
   EAP Hero Teacher Review Sheet Bridge v20260708
   - Adds teacher-review metadata to submit_attempt / submit_evidence payloads.
   - Works with Sheet Envelope v132 and existing no-cors transport.
   - Does not change scores, pass/fail, evidence text, or endpoint.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-TEACHER-REVIEW-SHEET-BRIDGE-V1';
  const CONFIG_NAME = 'EAP_SHEET_CONFIG';
  const CONTRACT_NAME = 'EAPTeacherReviewContract';

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  const originalFormSubmit = HTMLFormElement.prototype.submit;

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function safe(value, limit){ return clean(value).slice(0, limit || 1200); }
  function config(){ return window[CONFIG_NAME] || {}; }
  function endpoint(){ return safe(config().webAppUrl || '', 2000); }
  function isEapEndpoint(url){ const ep = endpoint(); return !!ep && safe(url || '', 2000).indexOf(ep) === 0; }

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

  function routeIdFromPayload(payload){
    const raw = safe(payload && (payload.routeId || payload.sessionId || payload.session || payload.stage), 40);
    if (!raw) return '';
    return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
  }

  function contractTask(payload){
    const api = window[CONTRACT_NAME];
    const routeId = routeIdFromPayload(payload);
    const skill = safe(payload && payload.skill, 80).toLowerCase();
    try {
      if (api && typeof api.task === 'function') return api.task(routeId, skill);
    } catch(error) {}
    return null;
  }

  function routeContract(payload){
    const api = window[CONTRACT_NAME];
    const routeId = routeIdFromPayload(payload);
    try {
      if (api && typeof api.route === 'function') return api.route(routeId);
    } catch(error) {}
    return null;
  }

  function enrichPayload(payload){
    if (!payload || typeof payload !== 'object') return payload;
    const task = contractTask(payload);
    const contract = routeContract(payload);
    if (!task && !contract) return payload;

    const out = Object.assign({}, payload);
    out.teacherReviewBridgeVersion = VERSION;
    out.teacherReviewContractVersion = safe(window[CONTRACT_NAME] && window[CONTRACT_NAME].version || '', 180);
    out.contentComplete = contract ? contract.completeContent === true : '';
    out.fourSkillsIncluded = contract ? contract.fourSkillsIncluded === true : '';
    out.teacherCanReview = true;
    out.teacherCanReviewSkills = contract ? (contract.teacherCanReviewSkills || []).join('|') : '';
    out.masterySkills = contract ? (contract.masterySkills || []).join('|') : '';
    out.exposureSkills = contract ? (contract.exposureSkills || []).join('|') : '';

    if (task) {
      out.skillRole = out.skillRole || task.skillRole;
      out.contractScope = task.scope;
      out.masteryEligible = task.masteryEligible === true;
      out.evidenceType = out.evidenceType || task.evidenceType;
      out.teacherReviewRequired = out.teacherReviewRequired === true || String(out.teacherReviewRequired).toLowerCase() === 'true' || task.teacherReviewRequired === true;
      out.teacherReviewStatus = out.teacherReviewStatus || task.teacherReviewStatusDefault;
      out.teacherCheck = task.teacherCheck;
      out.teacherRequiredFields = (task.requiredFields || []).join('|');
      out.teacherRubric = (task.rubric || []).join('|');
      out.feedbackCodes = (task.feedbackCodes || []).map(item => item.code || item).join('|');
      out.passEvidenceRule = task.passEvidenceRule;
      out.teacherSheetTabs = (task.sheetTabs || []).join('|');
      out.teacherReviewJson = JSON.stringify(task);
    }

    if (contract) {
      out.routeReviewJson = JSON.stringify({
        routeId: contract.routeId,
        routeType: contract.routeType,
        routeTitle: contract.routeTitle,
        completeContent: contract.completeContent,
        fourSkillsIncluded: contract.fourSkillsIncluded,
        masterySkills: contract.masterySkills,
        exposureSkills: contract.exposureSkills,
        teacherReviewRequiredSkills: contract.teacherReviewRequiredSkills,
        evidenceReadiness: contract.evidenceReadiness
      });
    }

    return out;
  }

  function formToObject(form){
    const obj = {};
    Array.from(form.elements || []).forEach(el => { if (el.name) obj[el.name] = el.value; });
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
          }
        }
      } catch(error) {}
      return originalFetch(input, init);
    };
  }

  function patchForms(){
    HTMLFormElement.prototype.submit = function(){
      try {
        if (isEapEndpoint(this.action)) {
          const enriched = enrichPayload(formToObject(this));
          Object.keys(enriched).forEach(key => upsertHidden(this, key, enriched[key]));
        }
      } catch(error) {}
      return originalFormSubmit.call(this);
    };
  }

  function start(){
    patchFetch();
    patchForms();
    window.EAPTeacherReviewSheetBridge = { version: VERSION, enrichPayload };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();