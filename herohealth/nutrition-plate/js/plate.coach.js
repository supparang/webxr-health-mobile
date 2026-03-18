// === /herohealth/nutrition-plate/js/plate.coach.js ===
// Child-friendly coach with rate limit for Nutrition Plate
// PATCH v20260318-PLATE-VSLICE-B

export function createPlateCoach() {
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
    if (phaseKey === 'build') return 'ค่อย ๆ เลือกอาหารให้ครบและสมดุล';
    if (phaseKey === 'fix') return 'มองก่อนว่าจานนี้ขาดอะไรหรือเกินอะไร';
    if (phaseKey === 'swap') return 'ลองเปลี่ยนของเดิมเป็นตัวเลือกที่ดีกว่า';
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

    if (!evaluation.correct && ['fix', 'swap', 'pre', 'post'].includes(phaseKey)) {
      if (phaseKey === 'fix' || phaseKey === 'pre' || phaseKey === 'post') {
        line = 'ลองมองก่อนว่าจานนี้ยังขาดผัก ผลไม้ หรือเครื่องดื่มที่เหมาะสมไหม';
      } else if (phaseKey === 'swap') {
        line = 'ลองเลือกตัวเลือกที่ทอดน้อยกว่า หวานน้อยกว่า หรือสดกว่า';
      }
    } else if (phaseKey === 'build') {
      if (evaluation.tone === 'bad') {
        line = 'มื้อนี้ยังปรับได้อีก ลองเพิ่มผัก ผลไม้ หรือน้ำเปล่า';
      } else if (evaluation.delta >= 48) {
        line = 'ยอดเยี่ยมเลย จานนี้สมดุลมาก';
      } else if (evaluation.delta >= 36) {
        line = 'ดีมาก จานนี้เริ่มสมดุลขึ้นแล้ว';
      }
    } else if (evaluation.correct && stats.streak >= 4) {
      line = 'ดีมาก กำลังเลือกมื้ออาหารได้เหมาะขึ้นเรื่อย ๆ';
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