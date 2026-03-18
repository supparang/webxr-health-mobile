// === /herohealth/nutrition-groups/js/groups.coach.js ===
// Child-friendly coach with rate limit
// PATCH v20260318-GROUPS-VSLICE-C

export function createGroupsCoach() {
  const cooldownMs = 3800;
  let lastShownAt = 0;
  const phaseSeen = new Set();

  function canSpeak(force = false) {
    if (force) return true;
    return Date.now() - lastShownAt >= cooldownMs;
  }

  function markShown() {
    lastShownAt = Date.now();
  }

  function phaseLine(phaseKey) {
    if (phaseKey === 'pre') return 'มาลองทำแบบสั้น ๆ ก่อนเริ่มเกมนะ';
    if (phaseKey === 'sort') return 'ดูให้ชัดว่าอาหารนี้อยู่หมู่ไหน';
    if (phaseKey === 'compare') return 'มองหาตัวเลือกที่ดีกว่าต่อสุขภาพ';
    if (phaseKey === 'reason') return 'ลองคิดว่าทำไมตัวเลือกนี้ดีกว่า';
    if (phaseKey === 'retry') return 'รอบทบทวนแล้ว ลองแก้ข้อที่เคยพลาดนะ';
    if (phaseKey === 'post') return 'จบเกมแล้ว มาลองตอบอีกครั้งดูว่าเก่งขึ้นไหม';
    return '';
  }

  function maybePhase(phaseKey, force = false) {
    if (phaseSeen.has(phaseKey) && !force) return null;
    if (!canSpeak(force)) return null;
    phaseSeen.add(phaseKey);
    markShown();
    return phaseLine(phaseKey);
  }

  function maybeAfterAnswer({ phaseKey, evaluation, stats }) {
    if (!evaluation) return null;
    if (!canSpeak(false)) return null;

    let line = '';

    if (!evaluation.correct) {
      if (phaseKey === 'sort') {
        line = 'ไม่เป็นไรนะ ลองดูหน้าที่ของอาหารก่อนว่าเป็นโปรตีน ผัก ผลไม้ หรือพลังงาน';
      } else if (phaseKey === 'compare') {
        line = 'ลองมองว่าอะไรหวานน้อยกว่า หรือเป็นผักผลไม้มากกว่า';
      } else if (phaseKey === 'reason') {
        line = 'ลองคิดเหตุผลด้านประโยชน์ต่อร่างกายมากกว่ารูปร่างหน้าตา';
      } else if (phaseKey === 'retry') {
        line = 'ใกล้แล้ว ลองทบทวนจาก feedback แล้วตอบอีกครั้งรอบหน้านะ';
      } else {
        line = 'ลองใหม่อีกนิดนะ';
      }
    } else if (stats.streak >= 5) {
      line = 'ยอดเยี่ยมเลย ตอบต่อเนื่องได้ดีมาก';
    } else if (stats.streak >= 3) {
      line = 'ดีมาก กำลังจับทางได้แล้ว';
    } else if (phaseKey === 'post' && evaluation.correct) {
      line = 'ดีเลย หลังเล่นแล้วตอบได้ดีขึ้น';
    }

    if (!line) return null;
    markShown();
    return line;
  }

  return {
    maybePhase,
    maybeAfterAnswer
  };
}