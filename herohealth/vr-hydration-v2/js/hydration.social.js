// === /herohealth/vr-hydration-v2/js/hydration.social.js ===
// Hydration V2 Social / Team Mission
// PATCH v20260317c-HYDRATION-V2-SOCIAL

export function computeSocialProgress({
  type = 'solo',
  goodCatch = 0,
  correctChoices = 0,
  createdPlanScore = 0,
  rewardCount = 0
} = {}) {
  if (type !== 'team') {
    return {
      contributionPercent: 0,
      socialScore: 0,
      missionDone: false,
      missionLabel: 'Solo Mode',
      missionNote: 'โหมดนี้ยังไม่คิดภารกิจทีม',
      teamStars: 0
    };
  }

  const contributionRaw =
    (goodCatch * 4) +
    (correctChoices * 10) +
    (Math.min(createdPlanScore, 18) * 2) +
    (rewardCount * 3);

  const contributionPercent = clamp(Math.round(contributionRaw), 0, 100);
  const socialScore = clamp(Math.floor(contributionPercent / 5), 0, 20);

  const missionDone =
    goodCatch >= 7 &&
    correctChoices >= 1 &&
    createdPlanScore >= 9;

  const teamStars =
    contributionPercent >= 80 ? 3 :
    contributionPercent >= 50 ? 2 :
    contributionPercent >= 25 ? 1 : 0;

  let missionLabel = 'Team Hydration Goal ยังไม่ครบ';
  let missionNote = 'ลองช่วยทีมเพิ่มทั้งช่วงเล่น ตอบสถานการณ์ และวางแผนให้สมดุลขึ้น';

  if (missionDone) {
    missionLabel = 'Team Hydration Goal ผ่านแล้ว';
    missionNote = 'ทีมทำได้ดีทั้งในรอบเล่น ความเข้าใจ และการวางแผนดื่มน้ำ';
  } else if (goodCatch < 7) {
    missionNote = 'เก็บน้ำให้มากขึ้นอีกนิด เพื่อช่วย contribution ของทีม';
  } else if (correctChoices < 1) {
    missionNote = 'ตอบสถานการณ์ให้ถูกอย่างน้อย 1 ข้อ เพื่อดันภารกิจทีม';
  } else if (createdPlanScore < 9) {
    missionNote = 'ลองจัดแผนดื่มน้ำให้กระจายทั้งวันมากขึ้น เพื่อให้ทีมผ่านเป้าหมาย';
  }

  return {
    contributionPercent,
    socialScore,
    missionDone,
    missionLabel,
    missionNote,
    teamStars
  };
}

export function buildSocialSummary(progress = {}) {
  if (!progress || progress.missionLabel === 'Solo Mode') {
    return 'โหมดเดี่ยว: รอบนี้ยังไม่คิดภารกิจทีมแบบเต็ม';
  }

  return [
    `Contribution ${progress.contributionPercent || 0}%`,
    `${progress.teamStars || 0} ดาว`,
    progress.missionLabel || 'ภารกิจทีม',
    progress.missionNote || ''
  ].join(' • ');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}