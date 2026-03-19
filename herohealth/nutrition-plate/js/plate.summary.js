// === /herohealth/nutrition-plate/js/plate.summary.js ===
// Summary builder for Nutrition Plate
// PATCH v20260318-PLATE-RUN-FULL

import { buildPlateMetrics } from './plate.metrics.js';

function plateValue(food) {
  if (!food) return '-';
  return `${food.emoji} ${food.label}`;
}

export function buildPlateSummary(ctx, stats, sessionMeta, plate) {
  const metrics = buildPlateMetrics(ctx, stats, sessionMeta);

  const notes = [];

  if (stats.build.balanceScore >= 48) {
    notes.push('จานของหนูค่อนข้างสมดุลมาก');
  } else if (stats.build.balanceScore >= 36) {
    notes.push('จานของหนูพอใช้ได้ แต่ยังปรับให้ดีขึ้นได้อีก');
  } else {
    notes.push('จานนี้ยังต้องเพิ่มผัก ผลไม้ หรือเปลี่ยนเครื่องดื่ม');
  }

  if (!stats.build.vegChosen) notes.push('ลองเพิ่มผักในมื้อถัดไป');
  if (!stats.build.fruitChosen) notes.push('ลองเปลี่ยนของหวานเป็นผลไม้');
  if (!stats.build.healthyDrinkChosen) notes.push('ลองเปลี่ยนเป็นน้ำเปล่าหรือนมจืด');

  if (stats.fix.total > 0) notes.push(`Fix the Plate ทำได้ ${stats.fix.correct}/${stats.fix.total}`);
  if (stats.swap.total > 0) notes.push(`Healthy Swap ทำได้ ${stats.swap.correct}/${stats.swap.total}`);

  const quizDelta = metrics.quizDelta;
  const quizDeltaText =
    quizDelta > 0
      ? `หลังเล่นทำ mini quiz ดีขึ้น +${quizDelta}`
      : quizDelta < 0
      ? `หลังเล่น mini quiz ลดลง ${quizDelta}`
      : 'mini quiz ก่อนและหลังเล่นใกล้เคียงกัน';

  notes.push(quizDeltaText);

  return {
    title: 'สรุปผลเกม Plate',
    subtitle: 'หนูได้ฝึกจัดมื้ออาหาร ดูความสมดุลของจาน และสลับตัวเลือกให้ดีขึ้น',
    items: [
      { label: 'คะแนนรวม', value: String(stats.score) },
      { label: 'Pre quiz', value: `${metrics.quizPreCorrect}/${metrics.quizPreTotal}` },
      { label: 'Post quiz', value: `${metrics.quizPostCorrect}/${metrics.quizPostTotal}` },
      { label: 'สมดุลจาน', value: `${stats.build.balanceScore}/60` },
      { label: 'ระดับจาน', value: stats.build.balanceLevel || '-' },
      { label: 'Fix ถูก', value: `${stats.fix.correct}/${stats.fix.total}` },
      { label: 'Swap ถูก', value: `${stats.swap.correct}/${stats.swap.total}` },
      { label: 'อาหารหลัก', value: plateValue(plate.base) },
      { label: 'โปรตีน', value: plateValue(plate.protein) },
      { label: 'ผัก', value: plateValue(plate.veg) },
      { label: 'ผลไม้/ของหวาน', value: plateValue(plate.fruit) },
      { label: 'เครื่องดื่ม', value: plateValue(plate.drink) }
    ],
    notes,
    payload: {
      kind: 'nutrition-plate-summary',
      gameId: ctx.gameId,
      ts: Date.now(),
      ctx,
      metrics,
      plate
    }
  };
}