// === /herohealth/nutrition-plate/js/plate.summary.js ===
// Summary builder for Nutrition Plate
// PATCH v20260323-PLATE-SUMMARY-CHILDFRIENDLY-A

import { buildPlateMetrics } from './plate.metrics.js';

function plateValue(food) {
  if (!food) return '-';
  return `${food.emoji} ${food.label}`;
}

function buildPlateNotes(stats, metrics) {
  const notes = [];

  if (stats.build.balanceScore >= 48) {
    notes.push('เยี่ยมมาก จานนี้สมดุลดี');
  } else if (stats.build.balanceScore >= 36) {
    notes.push('ดีเลย จานนี้เริ่มสมดุลแล้ว');
  } else {
    notes.push('จานนี้ยังต้องปรับอีกนิด');
  }

  if (!stats.build.vegChosen) {
    notes.push('ครั้งหน้าอย่าลืมเพิ่มผัก');
  } else {
    notes.push('รอบนี้หนูใส่ผักได้แล้ว');
  }

  if (!stats.build.fruitChosen) {
    notes.push('ลองเลือกผลไม้แทนของหวาน');
  } else {
    notes.push('รอบนี้หนูเลือกผลไม้ได้ดี');
  }

  if (!stats.build.healthyDrinkChosen) {
    notes.push('ลองเปลี่ยนเป็นน้ำเปล่าหรือนมจืด');
  } else {
    notes.push('เครื่องดื่มรอบนี้เหมาะสม');
  }

  if (stats.fix.total > 0) {
    notes.push(`Fix ทำได้ ${stats.fix.correct}/${stats.fix.total}`);
  }

  if (stats.swap.total > 0) {
    notes.push(`Swap ทำได้ ${stats.swap.correct}/${stats.swap.total}`);
  }

  const quizDelta = metrics.quizDelta;
  if (quizDelta > 0) {
    notes.push(`หลังเล่น หนูตอบดีขึ้น +${quizDelta}`);
  } else if (quizDelta < 0) {
    notes.push(`หลังเล่น คะแนนเปลี่ยน ${quizDelta}`);
  } else {
    notes.push('ก่อนและหลังเล่น ใกล้เคียงกัน');
  }

  return notes;
}

export function buildPlateSummary(ctx, stats, sessionMeta, plate) {
  const metrics = buildPlateMetrics(ctx, stats, sessionMeta);
  const notes = buildPlateNotes(stats, metrics);

  return {
    title: 'สรุปผลเกม Plate',
    subtitle: 'หนูได้ฝึกจัดจานอาหารและเลือกสิ่งที่ดีกว่า',
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