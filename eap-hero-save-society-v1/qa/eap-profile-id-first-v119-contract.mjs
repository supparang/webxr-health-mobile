import fs from 'node:fs';

const source = fs.readFileSync(
  'eap-hero-save-society-v1/eap-profile-id-first-v117.js',
  'utf8'
);
const index = fs.readFileSync(
  'eap-hero-save-society-v1/index.html',
  'utf8'
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  source.includes("20260801-EAP-ID-FIRST-PROFILE-V119-SHEET-AUTHORITY"),
  'v119 Sheet-authority version marker is missing'
);
assert(
  /LOOKUP_TIMEOUT_MS\s*=\s*45000/.test(source),
  'ID lookup timeout must be 45 seconds'
);
assert(
  !/setTimeout\([^\n]*8000/.test(source),
  'obsolete 8-second lookup timeout is still present'
);
assert(
  source.includes('function showRetry(error)'),
  'network/server retry state is missing'
);
assert(
  /catch\(err\)\{\s*showRetry\(err\);\s*\}/s.test(source),
  'network failure must show retry instead of manual fallback'
);
assert(
  source.includes('function openManualForConfirmedMissing()'),
  'confirmed-missing manual flow is missing'
);
assert(
  source.includes('var manualAllowed=false;'),
  'manual identity gate is missing'
);
assert(
  source.includes("if(!manualAllowed){showRetry(new Error('identity_not_verified'));return;}"),
  'manual name must remain blocked until server-confirmed missing ID'
);
assert(
  index.includes('eap-profile-id-first-v117.js?v=20260801-profile-id-first-v119-sheet-authority'),
  'index cache key was not updated to v119'
);

console.log(JSON.stringify({
  ok: true,
  contract: 'eap-profile-id-first-v119',
  lookupTimeoutMs: 45000,
  manualFallback: 'server-confirmed-missing-only'
}, null, 2));
