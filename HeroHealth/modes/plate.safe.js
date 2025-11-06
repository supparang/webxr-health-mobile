// === Hero Health — modes/plate.quest.js (Production, 2025-11-07) ===
// Plate (อาหาร 5 หมู่ + หมวดพิเศษ) — Continuous rounds, Goal scaling per round,
// Mini Quests, Anti-overlap (via mode-factory), HUD events: hha:goal (multiTargets),
// hha:quest (text), hha:score (score/combo), hha:end (end summary)

import { boot as factoryBoot } from '../vr/mode-factory.js';
import * as FX from '../vr/particles.js';
const Particles = FX.Particles || FX || { burst(){}, spark(){}, smoke(){} };

// ---------- Emoji Pools ----------
const G1_PROTEIN = ['🍗','🍖','🥩','🐟','🍤','🥚','🫘','🥜','🧀','🍣','🍢','🍡'];
const G2_CARBS   = ['🍚','🍙','🍘','🍜','🍝','🍞','🥖','🥪','🫓','🥯','🧇','🥞'];
const G3_VEG     = ['🥦','🥬','🥕','🍆','🌽','🧅','🧄','🥗','🥒','🫑','🍄','🥔'];
const G4_FRUIT   = ['🍎','🍏','🍓','🍇','🍊','🍋','🍉','🍍','🥝','🍐','🍑','🫐'];
const G5_FAT     = ['🧈','🥜','🌰','🫒','🧀','🥓']; // ไขมัน/น้ำมัน/ถั่ว/ชีส (คะแนนน้อยกว่ากลุ่มอื่นนิด)
const JUNK       = ['🍩','🍪','🍰','🧁','🍫','🍬','🍭','🧋','🥤','🍹','🍕','🍟','🌭'];

// รวมทั้งหมดไว้สำหรับสปอน (judge จะเป็นคนตัดสิน)
const ALL = [...G1_PROTEIN, ...G2_CARBS, ...G3_VEG, ...G4_FRUIT, ...G5_FAT, ...JUNK];

// ---------- Difficulty / Round scaling ----------
const DIFF_CFG = {
  easy:   { base:[3,3,3,3,2], max:[7,7,7,7,4], duration:60, junkPenalty:-10, good:+10, fatGood:+8, near:+6, bonusTime:+10, badTime:-5 },
  normal: { base:[4,4,4,4,2], max:[8,8,8,8,4], duration:65, junkPenalty:-10, good:+10, fatGood:+8, near:+6, bonusTime:+10, badTime:-5 },
  hard:   { base:[5,5,5,5,3], max:[9,9,9,9,5], duration:75, junkPenalty:-12, good:+10, fatGood:+8, near:+6, bonusTime:+10, badTime:-5 },
};

// ---------- Utils ----------
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const sumArr = (a)=>a.reduce((s,n)=>s+n,0);

function detectGroup(ch){
  if (G1_PROTEIN.includes(ch)) return 1;
  if (G2_CARBS.includes(ch))   return 2;
  if (G3_VEG.includes(ch))     return 3;
  if (G4_FRUIT.includes(ch))   return 4;
  if (G5_FAT.includes(ch))     return 5;
  if (JUNK.includes(ch))       return 0; // หมวดพิเศษ (ต้องเลี่ยง)
  return 0;
}

function colorOfGroup(g){
  return g===1 ? '#64b5f6' :       // ฟ้า (โปรตีน)
         g===2 ? '#ffd54f' :       // เหลือง (คาร์บ)
         g===3 ? '#81c784' :       // เขียว (ผัก)
         g===4 ? '#ffb74d' :       // ส้ม (ผลไม้)
         g===5 ? '#f48fb1' :       // ชมพู (ไขมัน)
                 '#ef5350';        // แดง (Junk)
}

function pushGoal5(state, target){
  try{
    window.dispatchEvent(new CustomEvent('hha:goal', { detail: { multiTargets: [
      { id:'g1', label:'โปรตีน',       have:state[1], need:target[1], examples:['🍗','🥚','🐟'] },
      { id:'g2', label:'คาร์บ/ธัญพืช', have:state[2], need:target[2], examples:['🍚','🍞','🍝'] },
      { id:'g3', label:'ผัก',          have:state[3], need:target[3], examples:['🥦','🥗','🥕'] },
      { id:'g4', label:'ผลไม้',        have:state[4], need:target[4], examples:['🍎','🍊','🍉'] },
      { id:'g5', label:'ไขมัน',        have:state[5], need:target[5], examples:['🧈','🥜','🧀'] },
    ]}}));
  }catch{}
}
function setQuestText(text){ try{ window.dispatchEvent(new CustomEvent('hha:quest',{ detail:{ text } })); }catch{} }
function pushScore(score, combo){ try{ window.dispatchEvent(new CustomEvent('hha:score',{ detail:{ score, combo } })); }catch{} }

// ---------- Mini Quest ----------
/*
 เลือกสุ่ม N ข้อ แล้ว "แสดงทีละข้อ"
 - GxN: สะสมหมู่ x ให้ถึง N
 - NOJUNK15: 15 วิไม่แตะ Junk
 - ORDER: ลำดับ 1→2→3→4→5 (อย่างละ 1)
 - BAL: ดึงสัดส่วนที่เกินให้กลับเข้าเป้า (เลือกหมู่ที่ขาด)
 - PERFECT: ช่วงท้ายให้กลุ่มห่าง target ไม่เกิน ±1 พร้อมกันทุกหมู่ (1 รอบ)
*/
function makeQuestPool(target){
  const T=(id,label,type,need,extra={})=>({ id,label,type,need,prog:0,...extra });
  return [
    T('G1_'+target[1], `เก็บโปรตีนให้ถึง ${target[1]} ชิ้น`, 'g', {g:1,n:target[1]}),
    T('G2_'+target[2], `เก็บคาร์บ/ธัญพืชให้ถึง ${target[2]} ชิ้น`, 'g', {g:2,n:target[2]}),
    T('G3_'+target[3], `เก็บผักให้ถึง ${target[3]} ชิ้น`, 'g', {g:3,n:target[3]}),
    T('G4_'+target[4], `เก็บผลไม้ให้ถึง ${target[4]} ชิ้น`, 'g', {g:4,n:target[4]}),
    T('G5_'+target[5], `เก็บไขมันให้ถึง ${target[5]} ชิ้น`, 'g', {g:5,n:target[5]}),
    T('NOJUNK15','ไม่แตะของหวาน/ขยะ 15 วินาที','nojunk',15,{ lastBadAt:0 }),
    T('ORDER','กดตามลำดับ 1→2→3→4→5','order',5,{ step:0 }),
    T('BAL','แก้สมดุล: เลือกหมู่ที่ "ขาด" จนเข้าใกล้เป้า','bal',1),
    T('PERFECT','Perfect Plate: ทุกหมู่ห่างเป้าไม่เกิน ±1','perfect',1),
  ];
}
function pickQuests(pool, count){
  const src=pool.slice(); const out=[];
  while(out.length<count && src.length){
    out.push(src.splice(Math.floor(Math.random()*src.length),1)[0]);
  }
  return { list: out, idx: 0 };
}
function qText(q, state, target){
  if(!q) return '';
  if(q.type==='g')   return `Mini Quest: ${q.label} (${Math.min(state[q.need.g], q.need.n)}/${q.need.n})`;
  if(q.type==='nojunk')  return `Mini Quest: ${q.label} (${Math.min(q.prog,q.need)}/${q.need})`;
  if(q.type==='order')   return `Mini Quest: ${q.label} (${q.step}/5)`;
  if(q.type==='bal')     return `Mini Quest: ${q.label}`;
  if(q.type==='perfect') return `Mini Quest: ${q.label}`;
  return `Mini Quest: ${q.label}`;
}

// ---------- Round target helpers ----------
function nextRoundTarget(curTarget, diffCfg){
  const t = curTarget.slice(); // [0..5]
  for(let g=1; g<=5; g++){
    t[g] = Math.min(t[g]+1, diffCfg.max[g-1]);
  }
  return t;
}
function baseTargetFor(diffKey){
  const cfg = DIFF_CFG[diffKey] || DIFF_CFG.normal;
  return [0, ...cfg.base]; // index 0 ไม่ใช้
}

// ---------- MAIN BOOT ----------
export async function boot({ host, difficulty='normal' } = {}) {
  const cfg = DIFF_CFG[difficulty] || DIFF_CFG.normal;

  // State (นับชิ้นที่เก็บได้ต่อ "รอบ")
  let target = baseTargetFor(difficulty);       // Array index 1..5
  let have   = [0,0,0,0,0,0];                    // have[1..5]
  let score=0, combo=0, round=1, seconds=0;
  let timeLeft = cfg.duration;                   // global countdown
  let lastBadSec = -999;

  // Mini Quests
  const pool = makeQuestPool(target);
  const Q = pickQuests(pool, difficulty==='easy' ? 3 : (difficulty==='hard'? 6 : 4));
  function renderQuest(){ setQuestText( qText(Q.list[Q.idx], have, target) ); }

  // HUD init
  pushGoal5(have, target);
  renderQuest();

  // Global time ticker
  const timeTicker = setInterval(()=>{
    seconds++;
    timeLeft = Math.max(0, timeLeft - 1);
    // อัปเดต HUD เวลา (ให้ index.vr.html แสดงเองจาก hha:score หรือจัดการเวลาใน HUD แยก)
    pushScore(score, combo);

    // เควส NOJUNK
    const cur = Q.list[Q.idx];
    if(cur?.type==='nojunk'){
      cur.prog = Math.min(cur.need, Math.max(0, seconds - (cur.lastBadAt ?? lastBadSec)));
      renderQuest();
    }

    // เควส PERFECT — ตรวจในช่วงท้ายเกม หรือทุก ๆ 3 วิ ให้ฟีดแบ็ก
    if(cur?.type==='perfect' && seconds % 3 === 0){
      const ok = isPerfectPlate(have, target, 1);
      if(ok){ cur.prog = 1; renderQuest(); }
    }

    if(timeLeft<=0){
      // Game over
      try{ window.dispatchEvent(new CustomEvent('hha:end',{ detail:{ reason:'timeout', score, round } })); }catch{}
      cleanup();
    }
  }, 1000);

  // Helpers for quests/balance
  function isAllGroupsComplete(have, target){
    for(let g=1; g<=5; g++){ if(have[g] < target[g]) return false; }
    return true;
  }
  function isPerfectPlate(have, target, tol){
    for(let g=1; g<=5; g++){
      if (Math.abs(have[g] - target[g]) > tol) return false;
    }
    return true;
  }

  // ---------- judge(): ให้คะแนน/อัปเดตเควส ----------
  function judge(hitChar, ctx){
    if(!hitChar){
      // timeout ของเป้า → โนสกอร์
      return { good:false, scoreDelta: -2 };
    }
    const g = detectGroup(hitChar);
    const cur = Q.list[Q.idx];

    // JUNK → โทษ
    if(g===0){
      combo = 0;
      score = Math.max(0, score + cfg.junkPenalty);
      timeLeft = Math.max(0, timeLeft + cfg.badTime);
      lastBadSec = seconds;
      if(cur?.type==='nojunk'){ cur.prog = 0; cur.lastBadAt = seconds; renderQuest(); }
      if(cur?.type==='order'){ cur.step = 0; renderQuest(); }
      Particles.smoke?.(document.querySelector('#spawnHost')||document.body, {x:0,y:1.2,z:-1.2});
      pushScore(score, combo);
      return { good:false, scoreDelta: cfg.junkPenalty, feverDelta: 0 };
    }

    // หมู่ 1..5
    let add = (g===5 ? cfg.fatGood : cfg.good); // ไขมันคะแนนน้อยกว่าเล็กน้อย
    // ถ้าหมู่เกินเป้าไปมาก ให้คะแนนลดลง (near)
    if (have[g] >= target[g]) add = cfg.near;

    have[g] = Math.min(have[g]+1, target[g]+3); // เผื่อเกินเล็กน้อยเพื่อ BAL quest
    combo++;
    score += add;

    // HUD & FX
    pushGoal5(have, target);
    Particles.burst?.(document.querySelector('#spawnHost')||document.body, {x:0,y:1.2,z:-1.2}, colorOfGroup(g));
    pushScore(score, combo);

    // Quests
    if(cur){
      if(cur.type==='g'){
        if(cur.need.g === g){
          cur.prog = Math.min(cur.need.n, have[g]); // ผูกกับ have จริง
        }
      }
      if(cur.type==='order'){
        // 1→2→3→4→5
        const nextNeed = (cur.step||0) + 1;
        if (g === nextNeed){ cur.step = nextNeed; }
        else if (g !== Math.max(1, cur.step||1)){ cur.step = 0; } // ผิดลำดับ รีเซ็ต (อนุโลมกดซ้ำตัวเดิมได้)
      }
      if(cur.type==='bal'){
        // มีหมู่เกิน/ขาดหรือไม่ ถ้ากดหมู่ "ขาด" จะเข้าใกล้เป้า
        if (isBalanceImproved(have, target)) cur.prog = 1;
      }
      if(cur.type==='perfect'){
        // จะคอนเฟิร์มอีกครั้งใน time ticker; ที่นี่ไม่ต้องทำอะไร
      }
      renderQuest();
    }

    // ผ่านรอบ (ครบ 5 หมู่) → เริ่มรอบใหม่ (ต่อเนื่อง)
    if (isAllGroupsComplete(have, target)){
      // โบนัส
      score += 20;
      timeLeft += cfg.bonusTime;
      round++;
      Particles.spark?.(document.querySelector('#spawnHost')||document.body, {x:0,y:1.4,z:-1.2}, '#ffd54f');

      // ขยายเป้ารอบใหม่
      target = nextRoundTarget(target, cfg);
      // รีเซ็ตตัวนับของรอบ (แต่คง score/combo/time)
      have = [0,0,0,0,0,0];

      // สุ่มเควสใหม่ตาม target ล่าสุด
      const newPool = makeQuestPool(target);
      const newPick = pickQuests(newPool, difficulty==='easy' ? 3 : (difficulty==='hard'? 6 : 4));
      Q.list = newPick.list; Q.idx = 0;

      pushGoal5(have, target);
      renderQuest();
    }

    return { good:true, scoreDelta: add, feverDelta: 1 };
  }

  function isBalanceImproved(have, target){
    // ถ้าหลังคลิกครั้งนี้ ความต่างรวม |have-target| ทั้ง 5 หมู่ "ลดลง" ถือว่าดีขึ้น
    const dBefore = balanceError(ctxPrevHave, target);
    const dAfter  = balanceError(have, target);
    ctxPrevHave = have.slice(0);
    return dAfter <= dBefore;
  }
  function balanceError(haveArr, targetArr){
    let e=0; for(let g=1; g<=5; g++) e += Math.abs((haveArr[g]||0)-(targetArr[g]||0)); return e;
  }
  let ctxPrevHave = have.slice(0);

  // ---------- ส่งให้โรงงาน (spawn/anti-overlap/คะแนน/เวลา) ----------
  const api = await factoryBoot({
    name: 'plate',
    host, difficulty,
    pools: { good: ALL },
    judge,
    ui: { questMainSel: '#hudQuest' },

    // เวลาเกมรวมต่อรอบ ใช้ timeLeft ภายนอกเป็นตัวกำกับจริง (เราจะสั่ง end ผ่าน timeTicker)
    timeByDiff:      { easy: 9999, normal: 9999, hard: 9999 }, // ปล่อยยาว; timeLeft เป็นตัวกำกับ
    maxActiveByDiff: { easy: 2,    normal: 3,    hard: 3 },
    budgetByDiff:    { easy: 2,    normal: 3,    hard: 3 },
    goldenRate: 0.05, goodRate: 1.0,
    minDist: 0.38, slotCooldownMs: 520,
  });

  // ---------- Cleanup ----------
  function cleanup(){
    try{ clearInterval(timeTicker); }catch{}
    try{ api?.stop?.(); }catch{}
  }

  // ปุ่มหยุดจากภายนอก
  const origStop = api?.stop;
  api.stop = function(){
    cleanup(); origStop?.call(api);
  };

  return api;
}
