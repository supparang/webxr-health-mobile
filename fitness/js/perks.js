// === /fitness/js/perks.js — Play-only perks (mini build) ===
'use strict';

export const PERKS = [
  { id:'shield1',  name:'เริ่มด้วยเกราะ +1',     desc:'เริ่มเกมได้ Shield 1',         icon:'🛡️' },
  { id:'feverUp',  name:'FEVER ขึ้นไว',          desc:'FEVER ต่อ hit เพิ่มขึ้น',       icon:'⚡️' },
  { id:'scoreUp',  name:'คะแนนคูณ x1.15',        desc:'คะแนนจาก hit เพิ่ม 15%',       icon:'💎' },
  { id:'hpRegen',  name:'ฟื้น HP เล็กน้อย',      desc:'ทุก 6 วินาที +HP นิดเดียว',    icon:'🩹' },
  { id:'comboSafe',name:'กันคอมโบแตก 1 ครั้ง',  desc:'กันคอมโบแตกฟรี 1 ครั้ง/เฟส',  icon:'🧠' },
];

export function pickPerks(rng, n=3){
  const pool = PERKS.slice();
  // shuffle deterministic
  for (let i=pool.length-1; i>0; i--){
    const j = Math.floor((rng ? rng() : Math.random()) * (i+1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export function applyPerkToState(state, perkId){
  state.perkId = perkId || '';
  state.perkMeta = PERKS.find(p=>p.id===perkId) || null;

  // perk variables
  state.perkScoreMul = 1;
  state.perkFeverBonus = 0;
  state.perkRegenOn = false;
  state.perkComboGuardByPhase = { 1:false, 2:false, 3:false };

  if (perkId === 'shield1'){
    state.shield = Math.max(0, (state.shield|0) + 1);
  } else if (perkId === 'feverUp'){
    state.perkFeverBonus = 0.06; // +0.06 ต่อ hit
  } else if (perkId === 'scoreUp'){
    state.perkScoreMul = 1.15;
  } else if (perkId === 'hpRegen'){
    state.perkRegenOn = true;
    state.perkNextRegenAt = (state.startedAt || 0) + 6000;
  } else if (perkId === 'comboSafe'){
    // guard per phase, reset on phase change
    state.perkComboGuardByPhase = { 1:false, 2:false, 3:false };
  }
}