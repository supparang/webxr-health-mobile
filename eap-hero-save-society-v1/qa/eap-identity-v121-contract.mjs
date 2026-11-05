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

assert(identity.includes('EAP Unified Identity Authority v123 FAST ROSTER') && identity.includes("var EAP_IDENTITY_V121 = '20260810-EAP-IDENTITY-V123-WORD-QUEST-SPREADSHEET-AUTHORITY'"), 'current roster-only identity v123 marker missing');
assert(identity.includes("var EAP_IDENTITY_ROSTER_SHEET_V121 = 'eap_word_roster'"), 'official roster must be eap_word_roster');
assert(identity.includes('function eapIdentityLookupV121_(params)'), 'compatible identity lookup entry point missing');
assert(identity.includes('eapIdentityRosterIndexV122_(forceRefresh)'), 'identity lookup must use canonical roster index');
assert(!identity.includes('function eapIdentityMapLookupV121_'), 'retired alias-map lookup must not return');
assert(!identity.includes('function eapIdentityLegacyLookupV121_'), 'retired profiles fallback must not return');
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
  contract: 'eap-identity-v123-roster-only (v121-compatible action)',
  authority: 'eap_word_roster',
  lookupOrder: ['eap_word_roster'],
  clients: ['EAP Hero', 'EAP Word Quest legacy route']
}, null, 2));
