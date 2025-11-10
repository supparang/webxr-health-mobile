// === vr/quests-powerups.js (update: hydration has 10 quests) ===

// ... (poolGoodjunk / poolGroups / poolPlate เดิมคงไว้) ...

function poolHydration(diff) {
  // ใช้สถิติที่ระบบมี: score, goodCount, comboMax, noMissTime, junkMiss, star, diamond, feverCount
  return [
    // EASY (อย่างน้อย 2 ใบ)
    { id:'h_good12',   level:'easy',   label:'เก็บของดี 12 ชิ้น',      check:s=>s.goodCount>=12,   prog:s=>Math.min(12,s.goodCount),   target:12 },
    { id:'h_avoid3',   level:'easy',   label:'หลีกเครื่องดื่มหวาน 3 ครั้ง', check:s=>s.junkMiss>=3,     prog:s=>Math.min(3, s.junkMiss),    target:3  },

    // NORMAL (อย่างน้อย 4 ใบ)
    { id:'h_combo8',   level:'normal', label:'ทำคอมโบ 8',              check:s=>s.comboMax>=8,     prog:s=>Math.min(8, s.comboMax),    target:8  },
    { id:'h_score300', level:'normal', label:'ทำคะแนน 300+',           check:s=>s.score>=300,      prog:s=>Math.min(300,s.score),      target:300},
    { id:'h_star2',    level:'normal', label:'เก็บดาว ⭐ 2 ดวง',        check:s=>s.star>=2,         prog:s=>Math.min(2, s.star),        target:2  },
    { id:'h_nomiss12', level:'normal', label:'ไม่พลาด 12 วิ',           check:s=>s.noMissTime>=12,  prog:s=>Math.min(12,s.noMissTime),  target:12 },

    // HARD (อย่างน้อย 4 ใบ)
    { id:'h_good20',   level:'hard',   label:'เก็บของดี 20 ชิ้น',      check:s=>s.goodCount>=20,   prog:s=>Math.min(20,s.goodCount),   target:20 },
    { id:'h_combo15',  level:'hard',   label:'ทำคอมโบ 15',             check:s=>s.comboMax>=15,    prog:s=>Math.min(15,s.comboMax),    target:15 },
    { id:'h_score450', level:'hard',   label:'ทำคะแนน 450+',           check:s=>s.score>=450,      prog:s=>Math.min(450,s.score),      target:450},
    { id:'h_diamond1', level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',      check:s=>s.diamond>=1,      prog:s=>Math.min(1, s.diamond),     target:1  },
  ];
}

function pick3(pool, diff){
  const lvls = ['easy','normal','hard'];
  const out = [];
  for (const lv of lvls){
    const cands = pool.filter(q=>q.level===lv);
    if (cands.length) out.push(cands[(Math.random()*cands.length)|0]);
  }
  while (out.length<3 && pool.length) {
    const q = pool[(Math.random()*pool.length)|0];
    if (!out.find(x=>x.id===q.id)) out.push(q);
  }
  return out.slice(0,3);
}

export function drawThree(mode, diff='normal'){
  const m = String(mode||'').toLowerCase();
  let pool = [];
  if (m==='goodjunk')      pool = poolGoodjunk(diff);
  else if (m==='groups')   pool = poolGroups(diff);
  else if (m==='hydration')pool = poolHydration(diff); // ← ใช้พูล 10 ใบที่อัปเดตแล้ว
  else if (m==='plate')    pool = poolPlate(diff);
  else pool = poolGoodjunk(diff);
  return pick3(pool, diff);
}
export default { drawThree };