// === /herohealth/hygiene-vr/hygiene.missions.js ===
// Small mission set for HygieneVR (kid-friendly, clear goals)

export function pickMission({ seed=0, runMode='play', diff='normal' }={}){
  const bag = [
    {
      id:'C01_clean_loop',
      name:'ครบ 1 รอบ (7 ขั้นตอน)',
      story:'วันนี้เป็น “ฮีโร่มือสะอาด” ทำครบ 7 ขั้นตอนให้ได้อย่างน้อย 1 รอบ!',
      rules:{ minLoops: 1 }
    },
    {
      id:'C02_combo_rookie',
      name:'คอมโบ 10',
      story:'ลองโฟกัสให้ถูกขั้นตอนต่อเนื่อง ทำคอมโบให้ถึง 10!',
      rules:{ minComboMax: 10 }
    },
    {
      id:'C03_safe_hands',
      name:'ห้ามโดนเชื้อเกิน 2',
      story:'โหมดระวัง! โดน 🦠 ได้ไม่เกิน 2 ครั้งตลอดเกม',
      rules:{ maxHazHits: 2 }
    },
    {
      id:'C04_accuracy',
      name:'ความแม่นยำ 75%',
      story:'ยิงให้ถูกขั้นตอนเยอะ ๆ ทำความแม่นยำให้ถึง 75% ขึ้นไป',
      rules:{ minStepAcc: 0.75 }
    },
    {
      id:'C05_boss_hunter',
      name:'ล้ม King Germ 1 ครั้ง',
      story:'บอสเชื้อจอมกวนจะโผล่! ล้มให้ได้อย่างน้อย 1 ครั้ง',
      rules:{ minBossClears: 1 }
    }
  ];

  // deterministic pick (research-friendly)
  const idx = Math.abs((Number(seed)||0) % bag.length);
  const m = bag[idx];

  // tweak by diff
  if(diff==='easy' && m.rules?.minComboMax) m.rules.minComboMax = Math.max(8, m.rules.minComboMax-2);
  if(diff==='hard' && m.rules?.minComboMax) m.rules.minComboMax = m.rules.minComboMax + 2;

  // keep mission fixed in research
  if(runMode === 'study') return m;

  // in play mode, still mostly deterministic but a bit varied
  const jitter = (Number(seed)||0) % 3;
  return bag[(idx + jitter) % bag.length];
}