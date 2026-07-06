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

/* =========================================================
   Receiver guard. The router calls eapHeroSubmitAttemptGuarded_ instead
   of submitAttempt_. It canonicalises incoming fields before the existing
   receiver writes attempts / summary rows.
========================================================= */

function eapHeroSubmitAttemptGuarded_(payload, source) {
  const p = Object.assign({}, payload || {});
  p.section = text_(p.section, EAP_CONFIG.DEFAULT_SECTION).trim();
  p.studentId = text_(p.studentId, '').trim();
  p.studentName = text_(p.studentName, 'Guest').trim();
  p.sessionId = eapHeroCanonicalSession_(p.sessionId);
  p.skill = eapHeroCanonicalSkill_(p.skill);

  if (!p.studentId || !p.sessionId || !p.skill) {
    return {
      ok: false,
      code: 'missing_required_fields',
      error: 'studentId, sessionId and skill are required'
    };
  }

  if (!eapHeroSkillAllowed_(p.sessionId, p.skill)) {
    const reason = eapHeroContractReason_(p.sessionId, p.skill);
    eapHeroRecordIntegrityReject_(reason, p);
    return {
      ok: false,
      code: 'invalid_session_skill',
      error: reason,
      expectedSkills: EAP_HERO_SKILL_CONTRACT[p.sessionId] || []
    };
  }

  const score = Number(p.score);
  const accuracy = Number(p.accuracy);
  p.score = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  p.accuracy = Number.isFinite(accuracy) ? Math.max(0, Math.min(100, accuracy)) : 0;
  p.passMark = 60;
  p.passed = p.score >= p.passMark;
  p.legacyCompletion = false;

  const canonicalName = eapHeroProfileName_(p.section, p.studentId);
  if (canonicalName && !/^(guest|student|unknown)$/i.test(canonicalName)) {
    p.studentName = canonicalName;
  }

  return submitAttempt_(p, source);
}

function eapHeroProfileName_(section, studentId) {
  try {
    const values = sh_('profiles').getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      const row = rowObject_(H.profiles, values[i]);
      if (
        text_(row.section).trim() === text_(section).trim() &&
        text_(row.studentId).trim() === text_(studentId).trim()
      ) {
        return text_(row.studentName).trim();
      }
    }
  } catch (error) {
    // A profile lookup failure never blocks a valid learning attempt.
  }
  return '';
}

function eapHeroRecordIntegrityReject_(reason, payload) {
  try {
    logError_('EAP_INTEGRITY_REJECT', new Error(reason), payload);
  } catch (error) {
    // Do not allow audit logging to create a second failure.
  }
}
