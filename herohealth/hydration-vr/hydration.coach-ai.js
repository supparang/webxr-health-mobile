// === /herohealth/hydration-vr/hydration.coach-ai.js ===
// Hydration Explainable Coach AI
// PATCH v20260315-HYD-COACH-AI

export function createHydrationCoachAI(opts = {}){
  const cooldownMs = Math.max(2500, Number(opts.cooldownMs || 4000));
  let lastSpeakTs = 0;

  function decide({ features, prediction, mode }){
    const ts = Number(features?.ts || 0);
    if(ts - lastSpeakTs < cooldownMs) return null;
    if(!features?.valid || !prediction) return null;

    let text = '';
    let reasonCode = '';
    let severity = 'info';

    if(prediction.failRisk >= 0.70 && features.waterPct < 25){
      text = 'น้ำลดเร็วมาก เก็บเป้าน้ำก่อน';
      reasonCode = 'water_drop_fast';
      severity = 'high';
    }else if(prediction.missRisk >= 0.65 && features.badHitRateRecent > 0.25){
      text = 'ช่วงนี้แตะของไม่ดีติดกัน ลองรอจังหวะก่อน';
      reasonCode = 'high_miss_recent';
      severity = 'medium';
    }else if(features.inDangerPhase && features.shield <= 0){
      text = 'พายุหรือบอสใกล้มาแล้ว เก็บโล่ไว้ก่อน';
      reasonCode = 'danger_no_shield';
      severity = 'medium';
    }else if(prediction.dropoffRisk >= 0.60){
      text = 'เริ่มช้าลงนิดนึง ลองโฟกัสเป้าน้ำก่อน';
      reasonCode = 'dropoff_risk';
      severity = 'medium';
    }else if(features.frustrationProxy >= 0.60){
      text = 'ใจเย็น ๆ ก่อน ลองแตะเฉพาะเป้าน้ำชัด ๆ';
      reasonCode = 'frustration_proxy_high';
      severity = 'medium';
    }else if(features.bossLevel >= 1 && features.shield > 0 && prediction.needHelp >= 0.40){
      text = 'ตอนนี้พร้อมแล้ว เก็บน้ำต่อและเก็บโล่ไว้ใช้';
      reasonCode = 'boss_manage_resources';
      severity = 'low';
    }

    if(!text) return null;
    lastSpeakTs = ts;

    return {
      text,
      reasonCode,
      severity,
      confidence: Number(prediction?.confidence || 0),
      mode: String(mode || 'play')
    };
  }

  return {
    decide
  };
}