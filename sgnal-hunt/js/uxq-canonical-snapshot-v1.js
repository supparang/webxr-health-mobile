/* CSAI2601 UX Quest • Canonical Snapshot v1
 * Captures the untouched canonical curriculum immediately after it loads.
 * Later legacy enrichment/question layers may mutate the live content object;
 * this immutable snapshot remains the source of truth for alignment.
 */
(() => {
  'use strict';
  const SRC = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!SRC || !Array.isArray(SRC.nodes)) return;
  const clone = value => JSON.parse(JSON.stringify(value));
  const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return value;
  };
  const nodes = clone(SRC.nodes);
  const snapshot = {
    courseId:SRC.courseId,
    version:SRC.version,
    scope:SRC.scope,
    courseAlignment:clone(SRC.courseAlignment || {}),
    dashboardFields:clone(SRC.dashboardFields || []),
    nodes,
    progression:clone(SRC.progression || []),
    byId(id) {
      return nodes.find(node => String(node.id || '').toUpperCase() === String(id || '').toUpperCase()) || null;
    }
  };
  deepFreeze(snapshot.courseAlignment);
  deepFreeze(snapshot.dashboardFields);
  deepFreeze(snapshot.nodes);
  deepFreeze(snapshot.progression);
  window.CSAI2601_UXQ_CANONICAL_SNAPSHOT_V1 = Object.freeze(snapshot);
  document.documentElement.dataset.uxqCanonicalSnapshot = SRC.version;
})();