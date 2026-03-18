// === /herohealth/nutrition-groups/js/groups.summary.js ===
// Summary builder for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-A

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
  let weakId = 'm1';
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

  return FOOD_GROUPS[weakId]?.label || '-';
}

export function buildGroupsSummary(ctx, stats, sessionMeta) {
  const bestGroup = findBestGroup(stats.sort.byGroup);
  const weakGroup = findWeakGroup(stats.sort.byGroup);
  const metrics = buildGroupsMetrics(ctx, stats, sessionMeta);

  return {
    title: 'สรุปผลเกม Groups',
    subtitle: 'หนูได้ฝึกแยกหมวดอาหาร เลือกตัวเลือกที่ดีกว่า และตอบเหตุผลง่าย ๆ',
    items: [
      { label: 'คะแนนรวม', value: String(stats.score) },
      { label: 'Sort ถูก', value: `${stats.sort.correct}/${stats.sort.total} (${formatPercent(stats.sort.correct, stats.sort.total)})` },
      { label: 'Compare ถูก', value: `${stats.compare.correct}/${stats.compare.total} (${formatPercent(stats.compare.correct, stats.compare.total)})` },
      { label: 'Reason ถูก', value: `${stats.reason.correct}/${stats.reason.total} (${formatPercent(stats.reason.correct, stats.reason.total)})` },
      { label: 'หมู่ที่แม่นที่สุด', value: bestGroup },
      { label: 'หมู่ที่ควรฝึกเพิ่ม', value: weakGroup }
    ],
    notes: [
      `หมู่ที่หนูทำได้ดี: ${bestGroup}`,
      `ลองฝึกเพิ่มเรื่อง: ${weakGroup}`,
      `ต่อเนื่องสูงสุด: ${stats.bestStreak} ข้อ`
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