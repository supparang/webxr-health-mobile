// คืน "ชุดเควสต์ 3 ใบ" ตามโหมด+ระดับ โดยแต่ละใบมี check(stats) และ prog/target
function poolGoodjunk() {
  return [
    { id:'good10',  level:'easy',   label:'เก็บของดี 10 ชิ้น',  check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount),  target:10 },
    { id:'combo10', level:'normal', label:'ทำคอมโบ 10',         check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax),   target:10 },
    { id:'score500',level:'hard',   label:'ทำคะแนน 500+',       check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),     target:500 },
    { id:'star3',   level:'normal', label:'เก็บดาว ⭐ 3',       check:s=>s.star>=3,        prog:s=>Math.min(3,s.star),        target:3 },
    { id:'diamond1',level:'hard',   label:'เก็บเพชร 💎 1',      check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
    { id:'nomiss10',level:'normal', label:'ไม่พลาด 10 วิ',      check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
  ];
}
function poolGroups() {
  return [
    { id:'goal2',   level:'easy',   label:'ทำเป้า 2 รอบ',   check:s=>s.score>=150, prog:s=>Math.min(150,s.score), target:150 },
    { id:'combo12', level:'normal', label:'คอมโบถึง 12',    check:s=>s.comboMax>=12, prog:s=>Math.min(12,s.comboMax), target:12 },
    { id:'score400',level:'hard',   label:'คะแนน 400+',     check:s=>s.score>=400, prog:s=>Math.min(400,s.score), target:400 },
  ];
}
// Hydration — 10 ภารกิจ แล้วจะสุ่ม 3 ใบ
function poolHydration() {
  return [
    { id:'balanced15', level:'easy',   label:'รักษา Balanced 15 วิ', check:s=>s.noMissTime>=15, prog:s=>Math.min(15,s.noMissTime), target:15 },
    { id:'good12',     level:'easy',   label:'เก็บของดี 12 ชิ้น',    check:s=>s.goodCount>=12, prog:s=>Math.min(12,s.goodCount),   target:12 },
    { id:'combo10',    level:'normal', label:'คอมโบ 10',             check:s=>s.comboMax>=10,  prog:s=>Math.min(10,s.comboMax),   target:10 },
    { id:'score350',   level:'normal', label:'คะแนน 350+',           check:s=>s.score>=350,    prog:s=>Math.min(350,s.score),     target:350 },
    { id:'avoid5',     level:'normal', label:'หลีกเลี่ยงของหวาน 5',  check:s=>s.junkMiss>=5,   prog:s=>Math.min(5,s.junkMiss),    target:5 },
    { id:'star2',      level:'normal', label:'เก็บดาว ⭐ 2',          check:s=>s.star>=2,       prog:s=>Math.min(2,s.star),        target:2 },
    { id:'diamond1',   level:'hard',   label:'เก็บเพชร 💎 1',         check:s=>s.diamond>=1,    prog:s=>Math.min(1,s.diamond),     target:1 },
    { id:'good20',     level:'hard',   label:'เก็บของดี 20 ชิ้น',    check:s=>s.goodCount>=20, prog:s=>Math.min(20,s.goodCount),   target:20 },
    { id:'nomiss20',   level:'hard',   label:'ไม่พลาด 20 วิ',         check:s=>s.noMissTime>=20,prog:s=>Math.min(20,s.noMissTime),  target:20 },
    { id:'shield2',    level:'hard',   label:'รับโล่ 🛡️ 2 ครั้ง',     check:s=>s.shield>=2,     prog:s=>Math.min(2,s.shield||0),   target:2 },
  ];
}
function poolPlate() {
  return [
    { id:'round2',  level:'easy',   label:'จัดครบ 5 หมู่ 2 รอบ', check:s=>s.score>=200, prog:s=>Math.min(200,s.score), target:200 },
    { id:'combo12', level:'normal', label:'คอมโบ 12',             check:s=>s.comboMax>=12, prog:s=>Math.min(12,s.comboMax), target:12 },
    { id:'score450',level:'hard',   label:'คะแนน 450+',           check:s=>s.score>=450,   prog:s=>Math.min(450,s.score),   target:450 },
  ];
}

function pick3(pool){
  const lvls=['easy','normal','hard'];
  const out=[];
  for(const lv of lvls){
    const cands = pool.filter(q=>q.level===lv);
    if(cands.length) out.push(cands[(Math.random()*cands.length)|0]);
  }
  while(out.length<3 && pool.length){
    const q = pool[(Math.random()*pool.length)|0];
    if(!out.find(x=>x.id===q.id)) out.push(q);
  }
  return out.slice(0,3);
}

export function drawThree(mode){
  const m=String(mode||'').toLowerCase();
  let pool=[];
  if(m==='goodjunk') pool=poolGoodjunk();
  else if(m==='groups') pool=poolGroups();
  else if(m==='hydration') pool=poolHydration();
  else if(m==='plate') pool=poolPlate();
  else pool=poolGoodjunk();
  return pick3(pool);
}
export default { drawThree };