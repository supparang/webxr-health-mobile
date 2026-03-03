function bossForecaster(state, top3, boss){
  if(!boss) return null;
  // predict trigger soon
  const tLeft = clamp(state.timeLeftS, 0, 999);
  if(state.mode!=='A') return null;
  if(boss.active) return null;

  // simple: warn 8s before trigger window
  if(boss.nextAtS > 0 && tLeft <= (boss.nextAtS + 8) && tLeft > boss.nextAtS){
    const name = boss.type === 'wet' ? 'Bathroom Outbreak' : 'Shared Device Meltdown';
    const hint = top3 && top3[0] ? `เตรียมเก็บ "${top3[0].name}"` : 'เตรียมเลือกจุดคุ้มที่สุด';
    return { tipId:'boss_warn', text:`⚠️ บอสกำลังมา: ${name} (8 วิ) — ${hint}` };
  }
  return null;
}