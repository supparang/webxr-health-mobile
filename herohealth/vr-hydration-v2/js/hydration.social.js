// === /herohealth/vr-hydration-v2/js/hydration.social.js ===
// Hydration V2 Social / Team Mission Logic
// PATCH v20260318b-HYDRATION-V2-SOCIAL-CHECKLIST

export function computeSocialProgress(input = {}) {
  const type = normalizeType(input.type);

  const goodCatch = positiveInt(input.goodCatch);
  const badCatch = positiveInt(input.badCatch);
  const correctChoices = positiveInt(input.correctChoices);
  const createdPlanScore = clampNumber(input.createdPlanScore, 0, 100);
  const rewardCount = positiveInt(input.rewardCount);
  const bestCombo = positiveInt(input.bestCombo);

  if (type !== 'team') {
    return buildSoloResult({
      goodCatch,
      correctChoices,
      createdPlanScore,
      rewardCount,
      bestCombo
    });
  }

  const actionPart = clampNumber((goodCatch / 14) * 40, 0, 40);
  const knowledgePart = clampNumber((correctChoices / 2) * 20, 0, 20);
  const planningPart = clampNumber((createdPlanScore / 100) * 25, 0, 25);
  const teamworkPart = clampNumber((rewardCount / 4) * 10, 0, 10);
  const comboPart = clampNumber((bestCombo / 8) * 5, 0, 5);

  const rawContribution =
    actionPart +
    knowledgePart +
    planningPart +
    teamworkPart +
    comboPart;

  const penalty = clampNumber(badCatch * 3, 0, 15);
  const contributionPercent = Math.round(clampNumber(rawContribution - penalty, 0, 100));

  const socialScore = Math.round(clampNumber(
    (contributionPercent * 0.6) +
    (correctChoices * 6) +
    (createdPlanScore * 0.14),
    0,
    100
  ));

  const checklist = {
    goodCatchOk: goodCatch >= 8,
    choicesOk: correctChoices >= 1,
    planOk: createdPlanScore >= 60,
    contributionOk: contributionPercent >= 60
  };

  const missionDone =
    checklist.goodCatchOk &&
    checklist.choicesOk &&
    checklist.planOk &&
    checklist.contributionOk;

  const teamStars =
    contributionPercent >= 85 && createdPlanScore >= 80 && correctChoices >= 2 ? 3 :
    contributionPercent >= 65 && createdPlanScore >= 60 ? 2 :
    contributionPercent >= 40 ? 1 : 0;

  const missionLabel = missionDone
    ? 'Team Hydration Goal ผ่านแล้ว'
    : 'Team Hydration Goal ยังไม่ผ่าน';

  const missing = [];
  if (!checklist.goodCatchOk) missing.push('เก็บน้ำให้มากขึ้น');
  if (!checklist.choicesOk) missing.push('ตอบสถานการณ์ให้ถูกอย่างน้อย 1 ข้อ');
  if (!checklist.planOk) missing.push('วางแผนดื่มน้ำให้ชัดขึ้น');
  if (!checklist.contributionOk) missing.push('ดัน contribution ให้ถึง 60%');

  const missionNote = missionDone
    ? 'ทีมทำครบทั้ง action + knowledge + planning แล้ว'
    : `ยังขาด: ${missing.join(' • ')}`;

  return {
    type: 'team',
    contributionPercent,
    socialScore,
    missionDone,
    missionLabel,
    missionNote,
    teamStars,
    checklist,

    metrics: {
      goodCatch,
      badCatch,
      correctChoices,
      createdPlanScore,
      rewardCount,
      bestCombo
    }
  };
}

export function buildSocialSummary(social = {}) {
  const contributionPercent = positiveInt(social.contributionPercent);
  const socialScore = positiveInt(social.socialScore);
  const teamStars = positiveInt(social.teamStars);
  const missionLabel = String(social.missionLabel || '-');
  const missionNote = String(social.missionNote || '-');

  if (social.type !== 'team') {
    return `Solo summary • contribution ${contributionPercent}% • social ${socialScore} • ${missionNote}`;
  }

  return `Team summary • contribution ${contributionPercent}% • social ${socialScore} • stars ${teamStars} • ${missionLabel} • ${missionNote}`;
}

function buildSoloResult({
  goodCatch = 0,
  correctChoices = 0,
  createdPlanScore = 0,
  rewardCount = 0,
  bestCombo = 0
} = {}) {
  const contributionPercent = Math.round(clampNumber(
    (goodCatch * 3) +
    (correctChoices * 10) +
    (createdPlanScore * 0.2) +
    (rewardCount * 4) +
    Math.min(bestCombo, 10),
    0,
    100
  ));

  const socialScore = Math.round(clampNumber(
    (correctChoices * 8) +
    (createdPlanScore * 0.18) +
    (rewardCount * 4),
    0,
    100
  ));

  return {
    type: 'solo',
    contributionPercent,
    socialScore,
    missionDone: false,
    missionLabel: 'Solo Mode',
    missionNote: 'โหมดนี้ยังไม่คิดภารกิจทีม',
    teamStars: 0,
    checklist: null,

    metrics: {
      goodCatch,
      correctChoices,
      createdPlanScore,
      rewardCount,
      bestCombo
    }
  };
}

function normalizeType(value) {
  return value === 'team' ? 'team' : 'solo';
}

function positiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}