import fs from 'node:fs';

const identity = fs.readFileSync(
  'herohealth/eap-word-quest/apps-script/EAP_Identity_v121.gs',
  'utf8'
);
const router = fs.readFileSync(
  'herohealth/eap-word-quest/apps-script/SharedWebAppRouter.gs',
  'utf8'
);
const hero = fs.readFileSync(
  'eap-hero-save-society-v1/eap-profile-id-first-v117.js',
  'utf8'
);

function assert(value, message) {
  if (!value) throw new Error(message);
}

assert(identity.includes('20260802-EAP-IDENTITY-V121-CANONICAL-ROSTER'), 'identity v121 marker missing');
assert(identity.includes("'eap_word_roster'"), 'official roster must be eap_word_roster');
assert(identity.includes("'eap_identity_map'"), 'alias map must be supported');
assert(identity.includes("'profiles'"), 'legacy Hero fallback must remain available');
assert(
  identity.indexOf('eapIdentityRosterLookupV121_') < identity.indexOf('eapIdentityMapLookupV121_') &&
  identity.indexOf('eapIdentityMapLookupV121_') < identity.indexOf('eapIdentityLegacyLookupV121_'),
  'lookup order must be roster -> identity map -> legacy profiles'
);
assert(router.includes("action === 'eap_identity_lookup'"), 'router missing unified action');
assert(router.includes("action === 'eap_hero_profile_lookup'"), 'Hero legacy action must route through v121');
assert(router.includes("action === 'eap_word_profile_lookup'"), 'Word legacy action must route through v121');
assert(router.includes('eapIdentityLookupV121_(params)'), 'router does not invoke v121 authority');
assert(!/wordAuthorityActions\s*=\s*\[[\s\S]*?'eap_word_profile_lookup'/.test(router), 'Word profile lookup still bypasses unified identity');
assert(hero.includes("url.searchParams.set('action','eap_identity_lookup')"), 'Hero login must use unified lookup');
assert(hero.includes('canonicalStudentId'), 'Hero login must accept canonical student ID');
assert(hero.includes("dataset.eapIdentityAuthority='eap_word_roster'"), 'Hero UI authority marker missing');
assert(!hero.includes("url.searchParams.set('action','eap_hero_profile_lookup')"), 'Hero login still uses legacy profile lookup');

console.log(JSON.stringify({
  ok: true,
  contract: 'eap-identity-v121',
  authority: 'eap_word_roster',
  lookupOrder: ['eap_word_roster', 'eap_identity_map', 'profiles'],
  clients: ['EAP Hero', 'EAP Word Quest legacy route']
}, null, 2));
