/* CSAI2601 UX Quest • Phase 1 Canonical Content Authority v1.2
 * Ensures Mission Control, Node Player, Studio and Reflection use one curriculum source.
 * Google Sheet remains the sole authority for official progress/unlock.
 * v1.1: validate week/boss schemas separately.
 * v1.2: do NOT freeze live canonical node objects. Downstream item-bank and
 * field-aware enrichment scripts intentionally extend seedCases/missionRounds.
 * The authority map itself stays frozen, but its live node values remain mutable.
 */
(() => {
  'use strict';

  const EXPECTED_VERSION = 'v20260728-course-description-100pct-alignment';
  const EXPECTED_ORDER = ['W1','W2','W3','B1','W4','W5','W6','W7','B2','W8','W9','W10','W11','B3','W12','W13','W14','B4','W15'];
  const COMMON_REQUIRED_FIELDS = [
    'id','type','order','title','missionTitle','focus',
    'missionRounds','reasonChecks','artifact','artifactChecklist','dashboardEvidence',
    'completionRule','sourceOfTruth','aiRule'
  ];
  const WEEK_REQUIRED_FIELDS = ['concepts','learningOutcomes'];
  const BOSS_REQUIRED_FIELDS = ['covers','bossScenario','passCriteria'];

  function fail(code, detail) {
    const payload = { ok:false, code, detail:detail || '', expectedVersion:EXPECTED_VERSION, timestamp:new Date().toISOString() };
    window.UXQCanonicalPhase1Status = payload;
    document.documentElement.dataset.uxqCanonicalReady = '0';
    window.dispatchEvent(new CustomEvent('uxq:canonical-phase1-error', { detail:payload }));
    console.error('[UXQ Phase 1]', code, detail || '');
    return payload;
  }

  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content) {
    fail('CANONICAL_CONTENT_MISSING', 'uxq-csai2601-canonical-content-v1.js must load before Phase 1 authority.');
    return;
  }

  if (String(content.version || '') !== EXPECTED_VERSION) {
    fail('CANONICAL_VERSION_STALE', `Loaded ${content.version || 'unknown'}; expected ${EXPECTED_VERSION}.`);
    return;
  }

  const nodes = Array.isArray(content.nodes) ? content.nodes : [];
  const order = nodes.slice().sort((a,b) => Number(a.order || 0) - Number(b.order || 0)).map(node => String(node.id || '').toUpperCase());
  if (JSON.stringify(order) !== JSON.stringify(EXPECTED_ORDER)) {
    fail('CANONICAL_ORDER_INVALID', `Loaded order: ${order.join(' > ')}`);
    return;
  }

  const errors = [];
  nodes.forEach((node) => {
    const type = String(node.type || '').trim().toLowerCase();
    const required = COMMON_REQUIRED_FIELDS.concat(type === 'boss' ? BOSS_REQUIRED_FIELDS : WEEK_REQUIRED_FIELDS);
    required.forEach((field) => {
      const value = node[field];
      const missing = value == null || value === '' || (Array.isArray(value) && value.length === 0);
      if (missing) errors.push(`${node.id}.${field}`);
    });
    if (type !== 'week' && type !== 'boss') errors.push(`${node.id}.type`);
    if (node.sourceOfTruth !== 'Google Sheet') errors.push(`${node.id}.sourceOfTruth`);
  });

  if (errors.length) {
    fail('CANONICAL_NODE_INCOMPLETE', errors.join(', '));
    return;
  }

  // Freeze only the lookup container. Keep node objects mutable because the
  // canonical item-bank/enrichment layers loaded later extend these live nodes.
  const map = Object.freeze(nodes.reduce((acc, node) => {
    acc[String(node.id).toUpperCase()] = node;
    return acc;
  }, {}));

  const api = Object.freeze({
    ok:true,
    phase:'Phase 1',
    version:EXPECTED_VERSION,
    authorityVersion:'20260814-phase1-schema-v1.2-live-nodes',
    nodeCount:nodes.length,
    order:Object.freeze(EXPECTED_ORDER.slice()),
    map,
    getNode(id) { return map[String(id || '').toUpperCase()] || null; },
    getChecklist(id) { return (this.getNode(id)?.artifactChecklist || []).slice(); },
    getRequiredEvidence(id) { return content.requiredEvidence?.(id) || []; },
    assertReady() { return true; }
  });

  window.UXQ_CANONICAL_PHASE1 = api;
  window.UXQCanonicalPhase1Status = api;
  document.documentElement.dataset.uxqCanonicalReady = '1';
  document.documentElement.dataset.uxqCanonicalVersion = EXPECTED_VERSION;
  window.dispatchEvent(new CustomEvent('uxq:canonical-phase1-ready', { detail:api }));
})();