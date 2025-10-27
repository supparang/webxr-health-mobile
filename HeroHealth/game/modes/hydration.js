// === Hero Health Academy — game/modes/hydration.js (Mini Quests 5 แบบ: สุ่ม 3 ต่อเกม + อัปเดตชิป HUD) ===
export const name = 'hydration';

/**
 * โซนระดับน้ำ (เปอร์เซ็นต์)
 *  - LOW:   0–39
 *  - MID:   40–70
 *  - HIGH:  71–100
 *
 * กติกาหลัก (ตามที่กำหนด):
 *  - ระดับน้ำ "สูง" แล้วคลิกน้ำเปล่า => BAD (หักคะแนน/คอมโบ)
 *  - ระดับน้ำ "สูง" แล้วคลิกน้ำหวาน => GOOD (ให้คะแนน ไม่หักคอมโบ)
 *  - ระดับน้ำ "ต่ำ" แล้วคลิกน้ำหวาน => BAD (หักคะแนน/คอมโบ)
 *  - อื่น ๆ (เช่น ต่ำ/กลาง + น้ำเปล่า) => GOOD / OK ตามความเหมาะสม
 */

const Z = { LOW: 'low', MID: 'mid', HIGH: 'high' };
const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));

const ST = {
  lang: 'TH',
  difficulty: 'Normal',
  // น้ำเริ่มต้น & สายเวลา
  level: 55,                 // 0..100
  decayPerSec: 1.0,          // ลดตามเวลา
  lastZone: 'mid',
  // เควส
  qAll: [],                  // 5 เควส (def)
  qActive: [],               // สุ่มมา 3 เควส
  qMap: new Map(),           // id -> runtime
  questHost: null,
  // เวลาในโซนกลางแบบต่อเนื่อง (เควส 1)
  midStreakSec: 0,
  // สำหรับเควส 5 (ออกนอกโซน -> กลับเข้ากลาง นับรอบ)
  needRecover: false,
};

/* ----------------------- เควส 5 แบบ -----------------------
1) คงระดับสมดุล (MID) ต่อเนื่อง Xs
2) งดหวานยาว ๆ (ทั้งเกมไม่กดน้ำหวาน)
3) ดื่มน้ำเปล่าถูกช่วง X ครั้ง (LOW/MID เท่านั้น)
4) เลี่ยงจมน้ำ (ห้ามกดน้ำขณะ HIGH)
5) แกว่งกลับกลาง (จากนอกโซนกลับเข้ากลาง X รอบ)
----------------------------------------------------------- */

function difficultyNeed(d, easy, normal, hard){
  return d==='Easy' ? easy : d==='Hard' ? hard : normal;
}

function labelTH(id, need){
  switch(id){
    case 'stay_mid':   return `คงระดับ “พอดี” ${need}s`;
    case 'no_sugar':   return `ห้ามกดน้ำหวานตลอดเกม`;
    case 'right_water':return `ดื่มน้ำเปล่าจังหวะเหมาะ ×${need}`;
    case 'no_water_high':return `ห้ามกด “น้ำเปล่า” ตอนสูง`;
    case 'recover_mid':return `พาเกจกลับสู่ “พอดี” ×${need}`;
  }
  return id;
}
function labelEN(id, need){
  switch(id){
    case 'stay_mid':   return `Stay in optimal zone for ${need}s`;
    case 'no_sugar':   return `No sugary drinks this run`;
    case 'right_water':return `Right-time water ×${need}`;
    case 'no_water_high':return `No water clicks when HIGH`;
    case 'recover_mid':return `Bring level back to MID ×${need}`;
  }
  return id;
}

function zoneOf(level){
  if (level <= 39) return Z.LOW;
  if (level <= 70) return Z.MID;
  return Z.HIGH;
}

function select3of5(arr){
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a.slice(0,3);
}

/* ----------------------- HUD: ชิปเควส ----------------------- */
function chipHost(){
  if (!ST.questHost) ST.questHost = document.getElementById('questChips');
  return ST.questHost;
}
function renderQuestChips(){
  const host = chipHost(); if (!host) return;
  host.innerHTML = '';
  for (const q of ST.qActive){
    const run = ST.qMap.get(q.id);
    const prog = Math.min(run.prog, run.need);
    const done = !!run.done;
    const fail = !!run.fail;

    const chip = document.createElement('div');
    chip.className = 'questChip';
    chip.dataset.qid = q.id;
    chip.style.cssText = `display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:#0f1b33;border:1px solid #243659;font-weight:800;`;
    const pct = Math.round((prog/run.need)*100);

    // สถานะสี
    let badge = fail ? '❌' : done ? '✅' : '🟡';

    chip.innerHTML = `
      <span class="qBadge">${badge}</span>
      <span class="qLabel">${q.label}</span>
      <span class="qProg">${prog}/${run.need}</span>
      <div class="qBar" style="position:relative;height:6px;width:72px;border-radius:999px;background:#0b1530;overflow:hidden;border:1px solid #203155">
        <i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#4ade80,#22c55e)"></i>
      </div>
    `;
    if (fail){
      chip.style.opacity = .55;
      chip.style.filter = 'grayscale(0.35)';
    }
    if (done){
      chip.style.outline = '2px solid #4ade80';
      chip.style.boxShadow = '0 0 12px rgba(74,222,128,.25)';
    }

    host.appendChild(chip);
  }
}

/* ----------------------- สาธารณะ: lifecycle ----------------------- */
export function init(gameState, hud, diff){
  ST.lang = localStorage.getItem('hha_lang') || 'TH';
  ST.difficulty = gameState?.difficulty || 'Normal';

  // ค่าเริ่มต้น
  ST.level = 55;
  ST.lastZone = zoneOf(ST.level);
  ST.midStreakSec = 0;
  ST.needRecover = false;

  // แสดง HUD น้ำ
  const wrap = document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
  updateHydroBar();

  // สร้าง 5 เควสจาก difficulty
  const stayNeed    = difficultyNeed(ST.difficulty, 10, 15, 20);
  const rightNeed   = difficultyNeed(ST.difficulty, 6, 8, 10);
  const recoverNeed = difficultyNeed(ST.difficulty, 2, 3, 4);

  ST.qAll = [
    { id:'stay_mid',     need: stayNeed,    type:'time' },
    { id:'no_sugar',     need: 1,           type:'flag' },
    { id:'right_water',  need: rightNeed,   type:'count' },
    { id:'no_water_high',need: 1,           type:'flag' },
    { id:'recover_mid',  need: recoverNeed, type:'count' },
  ];

  // สุ่ม 3 เควส & set label
  ST.qActive = select3of5(ST.qAll).map(q=>{
    const label = (ST.lang==='EN'?labelEN(q.id,q.need):labelTH(q.id,q.need));
    return {...q, label};
  });

  // map runtime
  ST.qMap.clear();
  for (const q of ST.qActive){
    ST.qMap.set(q.id, { prog:0, need:q.need, done:false, fail:false });
  }

  renderQuestChips();
}

export function cleanup(){
  const wrap = document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'none';
  ST.qMap.clear();
  const host = chipHost(); if (host) host.innerHTML = '';
}

export function tick(state, systems, hud){
  // ลดน้ำตามเวลา
  ST.level = clamp(ST.level - ST.decayPerSec, 0, 100);
  const prevZone = ST.lastZone;
  const nowZone  = zoneOf(ST.level);

  // เควส 1: อยู่ใน MID ต่อเนื่อง
  if (nowZone === Z.MID){
    ST.midStreakSec += 1;
    addQuestProgress('stay_mid', 1, 'time');
  }else{
    ST.midStreakSec = 0;
  }

  // เควส 5: ออกนอกโซน -> กลับเข้า MID นับรอบ
  if (prevZone !== nowZone){
    if (prevZone === Z.MID && nowZone !== Z.MID){
      ST.needRecover = true;
    }
    if (ST.needRecover && nowZone === Z.MID){
      addQuestProgress('recover_mid', 1, 'count');
      ST.needRecover = false;
    }
    ST.lastZone = nowZone;
  }

  // อัปเดตแถบน้ำ
  updateHydroBar();
}

/* ----------------------- สาธารณะ: spawn & onHit ----------------------- */
export function pickMeta(diff, gameState){
  // สุ่มน้ำเปล่า 💧 หรือ น้ำหวาน 🥤 ตามสภาพโซน ให้โอกาสเหมาะกับโจทย์
  const z = zoneOf(ST.level);
  let type; // 'water' | 'sugar'
  if (z === Z.LOW)      type = Math.random() < 0.70 ? 'water' : 'sugar';
  else if (z === Z.MID) type = Math.random() < 0.55 ? 'water' : 'sugar';
  else                  type = Math.random() < 0.60 ? 'sugar' : 'water'; // HIGH อยากให้มี sugary เยอะหน่อย

  return {
    id: (type==='water'?'water':'sugar') + '_' + Math.random().toString(36).slice(2,7),
    char: (type==='water'?'💧':'🥤'),
    kind: type,
    life: diff?.life || 3000,
  };
}

export function onHit(meta, systems, gameState, hud){
  const z = zoneOf(ST.level);
  const isWater = meta.kind === 'water';
  const isSugar = meta.kind === 'sugar';

  // เควส 2/4: ธง fail หรือเพิ่มโปรเกรสก่อน
  if (isSugar){
    // เควส 2: งดหวาน → ถ้ากดน้ำหวาน = fail
    setQuestFail('no_sugar');
  }
  if (isWater && z === Z.HIGH){
    // เควส 4: ห้ามน้ำตอนสูง → กด = fail
    setQuestFail('no_water_high');
  }

  // ตรรกะหลัก + ปรับระดับน้ำ
  let result = 'ok';
  if (z === Z.HIGH){
    if (isWater){            // สูง + น้ำเปล่า → BAD
      result = 'bad';
      ST.level = clamp(ST.level + 6, 0, 100);     // ทำให้ “ผิด” ชัด (ดันสูงขึ้นนิด)
    }else if (isSugar){      // สูง + น้ำหวาน → GOOD
      result = 'good';
      ST.level = clamp(ST.level - 8, 0, 100);     // ช่วยลดเพื่อให้มีเป้าหมายเชิงเกม
    }
  }else if (z === Z.LOW){
    if (isWater){            // ต่ำ + น้ำเปล่า → GOOD
      result = 'good';
      ST.level = clamp(ST.level + 18, 0, 100);
      // เควส 3: ดื่มน้ำถูกช่วง
      addQuestProgress('right_water', 1, 'count');
    }else if (isSugar){      // ต่ำ + น้ำหวาน → BAD
      result = 'bad';
      ST.level = clamp(ST.level - 6, 0, 100);
    }
  }else{ // MID
    if (isWater){            // กลาง + น้ำเปล่า → GOOD เล็กน้อย
      result = 'good';
      ST.level = clamp(ST.level + 10, 0, 100);
      addQuestProgress('right_water', 1, 'count');
    }else if (isSugar){      // กลาง + น้ำหวาน → OK / เบา ๆ
      result = 'ok';
      ST.level = clamp(ST.level - 2, 0, 100);
    }
  }

  // อัปเดตโซนสำหรับเควส 5 (ออกนอก → กลับกลาง)
  const prevZone = ST.lastZone;
  const nowZone  = zoneOf(ST.level);
  if (prevZone !== nowZone){
    if (prevZone === Z.MID && nowZone !== Z.MID) ST.needRecover = true;
    if (ST.needRecover && nowZone === Z.MID){ addQuestProgress('recover_mid', 1, 'count'); ST.needRecover=false; }
    ST.lastZone = nowZone;
  }

  updateHydroBar();
  // ให้ main.js ตัดสินคะแนน/คอมโบต่อด้วย result ที่คืน
  return result;
}

/* ----------------------- ภายใน: Quest Runtime ----------------------- */
function addQuestProgress(id, amount, mode){
  const run = ST.qMap.get(id); if (!run || run.done || run.fail) return;

  if (id === 'stay_mid'){
    // mode==='time' และ amount=1 ต่อวินาทีเมื่ออยู่ MID
    run.prog = Math.min(run.need, ST.midStreakSec);
  }else if (mode === 'count'){
    run.prog = clamp(run.prog + (amount|0), 0, run.need);
  }

  if (run.prog >= run.need) run.done = true;
  renderQuestChips();
}

function setQuestFail(id){
  const run = ST.qMap.get(id); if (!run || run.done || run.fail) return;
  run.fail = true;
  renderQuestChips();
}

/* ----------------------- ภายใน: HUD น้ำ ----------------------- */
function updateHydroBar(){
  const bar = document.getElementById('hydroBar');
  const lab = document.getElementById('hydroLabel');
  if (bar) bar.style.width = `${Math.round(ST.level)}%`;
  if (lab){
    const z = zoneOf(ST.level);
    if (ST.lang==='EN'){
      lab.textContent = z===Z.LOW?'Low': z===Z.MID?'Optimal':'High';
    }else{
      lab.textContent = z===Z.LOW?'ต่ำ': z===Z.MID?'พอดี':'สูง';
    }
  }
}
