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
  source.includes('20260802-EAP-ID-FIRST-PROFILE-V120-QUICK-LOOKUP'),
  'v120 quick-lookup version marker is missing'
);
assert(
  /LOOKUP_TIMEOUT_MS\s*=\s*15000/.test(source),
  'quick identity lookup timeout must be 15 seconds'
);
assert(
  source.includes("url.searchParams.set('action','eap_hero_profile_lookup')"),
  'login must use eap_hero_profile_lookup'
);
assert(
  !source.includes("url.searchParams.set('action','player_resume')"),
  'login must not use player_resume for identity lookup'
);
assert(
  source.includes('function showRetry(error)'),
  'network/server retry state is missing'
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
  source.includes('data.identityFound===true&&data.found===true'),
  'positive identity must require found and identityFound from server'
);
assert(
  index.includes('eap-profile-id-first-v117.js?v=20260802-profile-id-first-v120-quick-lookup'),
  'index cache key was not updated to v120'
);

console.log(JSON.stringify({
  ok: true,
  contract: 'eap-profile-id-first-v120',
  lookupAction: 'eap_hero_profile_lookup',
  lookupTimeoutMs: 15000,
  progressActionAfterReload: 'player_resume',
  manualFallback: 'server-confirmed-missing-only'
}, null, 2));
