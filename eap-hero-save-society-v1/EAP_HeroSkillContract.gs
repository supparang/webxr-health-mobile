/* =========================================================
   EAP Hero Session–Skill Contract

   Purpose
   - Defines the only valid core skill pair for each S1–S15.
   - Keeps historic raw rows for audit, but prevents impossible pairs from
     affecting Player Resume, unlocks, averages, or the normal teacher view.
   - B1–B5 accept the four skills plus Boss Clash as a separate outcome.
========================================================= */

const EAP_HERO_SKILL_CONTRACT = {
  S1:  ['Reading', 'Speaking'],
  S2:  ['Reading', 'Writing'],
  S3:  ['Reading', 'Writing'],
  S4:  ['Reading', 'Listening'],
  S5:  ['Reading', 'Speaking'],
  S6:  ['Reading', 'Writing'],
  S7:  ['Writing', 'Speaking'],
  S8:  ['Reading', 'Writing'],
  S9:  ['Writing', 'Speaking'],
  S10: ['Reading', 'Writing'],
  S11: ['Writing', 'Speaking'],
  S12: ['Reading', 'Writing'],
  S13: ['Listening', 'Writing'],
  S14: ['Writing', 'Speaking'],
  S15: ['Writing', 'Speaking']
};

function eapHeroCanonicalSession_(value) {
  const raw = text_(value).toUpperCase().replace(/\s+/g, '');
  if (/^\d+$/.test(raw)) return 'S' + raw;
  const session = raw.match(/^S(?:ESSION)?(\d{1,2})$/);
  if (session) return 'S' + session[1];
  const boss = raw.match(/^B(?:OSS)?(\d{1,2})$/);
  if (boss) return 'B' + boss[1];
  return raw;
}

function eapHeroCanonicalSkill_(value) {
  const raw = text_(value).trim().toLowerCase();
  const map = {
    reading: 'Reading',
    listening: 'Listening',
    writing: 'Writing',
    speaking: 'Speaking',
    'boss clash': 'Boss Clash'
  };
  return map[raw] || text_(value).trim();
}

function eapHeroSkillAllowed_(sessionId, skill) {
  const sid = eapHeroCanonicalSession_(sessionId);
  const normalizedSkill = eapHeroCanonicalSkill_(skill);

  if (EAP_HERO_SKILL_CONTRACT[sid]) {
    return EAP_HERO_SKILL_CONTRACT[sid].indexOf(normalizedSkill) >= 0;
  }

  if (/^B[1-5]$/.test(sid)) {
    return ['Reading', 'Listening', 'Writing', 'Speaking', 'Boss Clash']
      .indexOf(normalizedSkill) >= 0;
  }

  /* Unknown/non-core rows are retained for audit but never used as a core
     route score. */
  return false;
}

function eapHeroContractReason_(sessionId, skill) {
  const sid = eapHeroCanonicalSession_(sessionId);
  const normalizedSkill = eapHeroCanonicalSkill_(skill);

  if (EAP_HERO_SKILL_CONTRACT[sid]) {
    return sid + ' accepts only ' + EAP_HERO_SKILL_CONTRACT[sid].join(' + ') +
      '; found ' + normalizedSkill;
  }

  if (/^B[1-5]$/.test(sid)) {
    return sid + ' accepts Reading, Listening, Writing, Speaking, or Boss Clash; found ' + normalizedSkill;
  }

  return 'Unrecognized EAP Hero session: ' + sid;
}
