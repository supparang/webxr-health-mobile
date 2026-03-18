// === /herohealth/nutrition-groups/js/groups.summary.js ===
// Summary builder for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-C

import { formatPercent } from '../../shared/nutrition-common.js';
import { FOOD_GROUPS } from './groups.content.js';
import { buildGroupsMetrics } from './groups.metrics.js';

function findBestGroup(sortByGroup) {
  let bestId = 'm1';
  let bestPct = -1;

  Object.keys(sortByGroup).forEach(groupId => {
    const bucket = sortByGroup[groupId];
    const pct = bucket.total ? bucket.correct / bucket.total : 0;
    if (pct > bestPct) {
      bestPct = pct;
      bestId = groupId;
    }
  });

  return FOOD_GROUPS[bestId]?.label || '-';
}

function findWeakGroup(sortByGroup) {
  let weakId = null;
  let weakPct = Infinity;

  Object.keys(sortByGroup).forEach(groupId => {
    const bucket = sortByGroup[groupId];
    if (!bucket.total) return;
    const pct = bucket.correct / bucket.total;
    if (pct < weakPct) {
      weakPct = pct;
      weakId = groupId;
    }
  });

  return weakId ? FOOD_GROUPS[weakId]?.label || '-' : '-';
}

function buildGroupNotes(sortByGroup) {
  return Object.entries(sortByGroup).map(([groupId, bucket]) => {
    const label = FOOD_GROUPS[groupId]?.label || groupId;
    return `${label}: ${bucket.correct}/${bucket.total || 0}`;
  });
}

export function buildGroupsSummary(ctx, stats, sessionMeta) {
  const bestGroup = findBestGroup(stats.sort.byGroup);
  const weakGroup = findWeakGroup(stats.sort.byGroup);
  const metrics = buildGroupsMetrics(ctx, stats, sessionMeta);

  const retryNote =
    stats.retry.total > 0
      ? `รอบทบทวนแก้ได้ ${stats.retry.correct}/${stats.retry.total} ข้อ`
      : 'รอบนี้ตอบได้ครบโดยไม่ต้องทบทวนเพิ่ม';

  const weaknessNote =
    weakGroup && weakGroup !== '-'
      ? `ลองฝึกเพิ่มเรื่อง: ${weakGroup}`
      : 'รอบนี้ยังไม่มีหมู่ที่อ่อนชัดเจน';

  const quizDelta = metrics.quizDelta;
  const quizDeltaText =
    quizDelta > 0
      ? `หลังเล่นทำ mini quiz ดีขึ้น +${quizDelta}`
      : quizDelta < 0
      ? `หลังเล่น mini quiz ลดลง ${quizDelta}`
      : 'mini quiz ก่อนและหลังเล่นใกล้เคียงกัน';

  return {
    title: 'สรุปผลเกม Groups',
    subtitle: 'หนูได้ฝึกแยกหมวดอาหาร เลือกตัวเลือกที่ดีกว่า และตอบเหตุผลง่าย ๆ',
    items: [
      { label: 'คะแนนรวม', value: String(stats.score) },
      { label: 'Pre quiz', value: `${metrics.quizPreCorrect}/${metrics.quizPreTotal}` },
      { label: 'Post quiz', value: `${metrics.quizPostCorrect}/${metrics.quizPostTotal}` },
      { label: 'Sort ถูก', value: `${stats.sort.correct}/${stats.sort.total} (${formatPercent(stats.sort.correct, stats.sort.total)})` },
      { label: 'Compare ถูก', value: `${stats.compare.correct}/${stats.compare.total} (${formatPercent(stats.compare.correct, stats.compare.total)})` },
      { label: 'Reason ถูก', value: `${stats.reason.correct}/${stats.reason.total} (${formatPercent(stats.reason.correct, stats.reason.total)})` },
      { label: 'Retry แก้ได้', value: `${stats.retry.correct}/${stats.retry.total}` },
      { label: 'หมู่ที่แม่นที่สุด', value: bestGroup },
      { label: 'หมู่ที่ควรฝึกเพิ่ม', value: weakGroup || '-' }
    ],
    notes: [
      `หมู่ที่หนูทำได้ดี: ${bestGroup}`,
      weaknessNote,
      retryNote,
      quizDeltaText,
      `ต่อเนื่องสูงสุด: ${stats.bestStreak} ข้อ`,
      ...buildGroupNotes(stats.sort.byGroup)
    ],
    payload: {
      kind: 'nutrition-groups-summary',
      gameId: ctx.gameId,
      ts: Date.now(),
      ctx,
      metrics
    }
  };
}