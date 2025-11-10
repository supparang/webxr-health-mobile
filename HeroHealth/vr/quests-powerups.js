// === vr/quests-powerups.js ===
// คืน "ชุดเควสต์ 3 ใบ" ตามโหมด+ระดับ โดยแต่ละใบมี check(stats) และ prog/target (ถ้ามี)
function poolGoodjunk(diff) {
  return [
    { id:'good10',  level:'easy',   label:'เก็บของดี 10 ชิ้น',  check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount), target:10 },
    { id:'combo10', level:'normal', label:'ทำคอมโบ 10',         check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax),   target:10 },
    { id:'score500',level:'hard',   label:'ทำคะแนน 500+',       check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),     target:500 },
    { id:'star3',   level:'normal', label:'เก็บดาว ⭐ 3',       check:s=>s.star>=3,        prog:s=>Math.min(3,s.star),        target:3 },
    { id:'diamond1',level:'hard',   label:'เก็บเพชร 💎 1',      check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
    { id:'nomiss10',level:'normal', label:'ไม่พลาด 10 วิ',      check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
  ];
}
function poolGroups(diff) {
  return [
    { id:'goal2',   level:'easy',   label:'ทำเป้า 2 รอบ',   check:s=>s.score>=150, prog:s=>s.score, target:150 },
    { id:'combo12', level:'normal', label:'คอมโบถึง 12',    check:s=>s.comboMax>=12, prog:s=>Math.min(12,s.comboMax), target:12 },
    { id:'score400',level:'hard',   label:'คะแนน 400+',     check:s=>s.score>=400, prog:s=>Math.min(400,s.score), target:400 },
  ];
}
function poolHydration(diff) {
  return [
    { id:'balanced15',level:'normal',label:'รักษา Balanced 15 วิ',check:s=>s.noMissTime>=15,prog:s=>Math.min(15,s.noMissTime), target:15 },
    { id:'combo10',   level:'easy',  label:'คอมโบ 10',            check:s=>s.comboMax>=10, prog:s=>Math.min(10,s.comboMax),    target:10 },
    { id:'score350',  level:'hard',  label:'คะแนน 350+',          check:s=>s.score>=350,   prog:s=>Math.min(350,s.score),      target:350 },
  ];
}
function poolPlate(diff) {
  return [
    { id:'round2',  level:'easy',   label:'จัดครบ 5 หมู่ 2 รอบ', check:s=>s.score>=200, prog:s=>s.score, target:200 },
    { id:'combo12', level:'normal', label:'คอมโบ 12',             check:s=>s.comboMax>=12, prog:s=>Math.min(12,s.comboMax), target:12 },
    { id:'score450',level:'hard',   label:'คะแนน 450+',           check:s=>s.score>=450,   prog:s=>Math.min(450,s.score),   target:450 },
  ];
}

function pick3(pool, diff){
  // เลือก 3 ใบ (easy/normal/hard อย่างละ 1 ถ้ามี)
  const lvls = ['easy','normal','hard'];
  const out = [];
  for (const lv of lvls){
    const cands = pool.filter(q=>q.level===lv);
    if (cands.length) out.push(cands[(Math.random()*cands.length)|0]);
  }
  // กันกรณีไม่ครบ 3
  while (out.length<3 && pool.length) {
    const q = pool[(Math.random()*pool.length)|0];
    if (!out.find(x=>x.id===q.id)) out.push(q);
  }
  return out.slice(0,3);
}

export function drawThree(mode, diff='normal'){
  const m = String(mode||'').toLowerCase();
  let pool = [];
  if (m==='goodjunk')   pool = poolGoodjunk(diff);
  else if (m==='groups')   pool = poolGroups(diff);
  else if (m==='hydration')pool = poolHydration(diff);
  else if (m==='plate')    pool = poolPlate(diff);
  else pool = poolGoodjunk(diff);
  return pick3(pool, diff);
}
export default { drawThree };
