// === /HeroHealth/modes/hydration.safe.js
// Hydration mode – น้ำสมดุล + Water Gauge + Fever + Quest
// ใช้ pattern เดียวกับโหมด goodjunk / groups:
// - ใช้ MissionDeck (createHydrationQuest)
// - ส่ง hha:end พร้อมข้อมูลสถิติและเควสต์ที่เคลียร์แล้ว

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import Particles from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createHydrationQuest } from './hydration.quest.js';

const GOOD = ['💧','🥛','🍉'];               // น้ำ/นม/ผลไม้ฉ่ำน้ำ
const BAD  = ['🥤','🧋','🍺','☕️'];          // น้ำหวาน/ชาไข่มุก/แอลกอฮอล์/คาเฟอีน
const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

export async function boot(cfg = {}) {
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (diffRaw === 'easy' || diffRaw === 'hard' || diffRaw === 'normal')
    ? diffRaw : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  if (dur < 20) dur = 20;
  if (dur > 180) dur = 180;

  // ===== HUD เริ่มต้น =====
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);

  ensureWaterGauge();
  const waterStart = 50;          // % เริ่มต้น
  let   waterPct   = waterStart;
  setWaterGauge(waterPct);

  // ===== Quest deck (MissionDeck) — pattern เดียวกับ goodjunk / groups =====
  const deck = createHydrationQuest(diff);
  deck.stats = deck.stats || {};
  deck.stats.mode       = 'hydration'; // ใช้ lowercase ให้เหมือน goodjunk/groups
  deck.stats.difficulty = diff;
  deck.stats.greenTick  = 0;           // จะนับเพิ่มใน onSec

  deck.drawGoals(2);
  deck.draw3();
  let accMiniDone = 0, accGoalDone = 0;

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const z = zoneFrom(waterPct);
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: {
        goal: goals.find(g=>!g.done) || goals[0] || null,
        mini: minis.find(m=>!m.done) || minis[0] || null,
        goalsAll: goals,
        minisAll: minis,
        hint: hint || `โซนน้ำ: ${z}`
      }
    }));
  }

  // ===== State หลักของโหมด =====
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let star = 0, diamond = 0, shield = 0;
  let fever = 0, feverActive = false;

  function mult(){ return feverActive ? 2 : 1; }

  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100){
      feverActive = true;
      setFeverActive(true);
    }
  }

  function decayFever(n){
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0){
      feverActive = false;
      setFeverActive(false);
    }
  }

  function addWater(n){
    waterPct = Math.max(0, Math.min(100, waterPct + n));
    const res = setWaterGauge(waterPct);
    // เก็บโซนไว้ใน stats เผื่อใช้ในวิจัย
    deck.stats.zone = res.zone;
  }

  function syncDeck(){
    // ให้ MissionDeck รู้ค่าคะแนน/คอมโบล่าสุด (ใช้ใน quest)
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function scoreFX(x,y,val){
    Particles.scorePop(x, y, (val>0?'+':'') + val, { good: val>=0 });
    Particles.burstAt(x, y, { color: val>=0 ? '#22c55e' : '#f97316' });
  }

  // ===== การตัดสินแต่ละเป้า =====
  function judge(ch, ctx){
    const x = ctx?.clientX ?? ctx?.cx ?? 0;
    const y = ctx?.clientY ?? ctx?.cy ?? 0;

    // ----- Power-ups -----
    if (ch === STAR){
      const d = 40 * mult();
      score += d; star++;
      gainFever(10);
      deck.onGood(); combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x,y,d);
      return { good:true, scoreDelta:d };
    }
    if (ch === DIA){
      const d = 80 * mult();
      score += d; diamond++;
      gainFever(30);
      deck.onGood(); combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x,y,d);
      return { good:true, scoreDelta:d };
    }
    if (ch === SHIELD){
      shield = Math.min(3, shield+1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood(); syncDeck(); pushQuest();
      scoreFX(x,y,d);
      return { good:true, scoreDelta:d };
    }
    if (ch === FIRE){
      feverActive = true;
      setFeverActive(true);
      fever = Math.max(fever, 60);
      setFever(fever);
      const d = 25;
      score += d;
      deck.onGood(); syncDeck(); pushQuest();
      scoreFX(x,y,d);
      return { good:true, scoreDelta:d };
    }

    // ----- ปกติ: GOOD / BAD -----
    if (GOOD.includes(ch)){
      // ดื่มน้ำดี/อาหารฉ่ำน้ำ → น้ำเพิ่ม
      addWater(8);
      const d = (14 + combo*2) * mult();
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);
      gainFever(6 + combo*0.4);
      deck.onGood(); syncDeck(); pushQuest();
      scoreFX(x,y,d);
      return { good:true, scoreDelta:d };
    } else {
      // แตะของไม่ดี (น้ำหวาน ฯลฯ)
      if (shield > 0){
        shield--;
        setShield(shield);
        addWater(-4);
        decayFever(6);
        syncDeck(); pushQuest();
        scoreFX(x,y,0);
        return { good:false, scoreDelta:0 };
      }
      addWater(-8);
      const d = -10;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;
      decayFever(14);
      deck.onJunk(); syncDeck(); pushQuest();
      scoreFX(x,y,d);
      return { good:false, scoreDelta:d };
    }
  }

  function onExpire(ev){
    // ปล่อย BAD ผ่านไป นับ miss เล็กน้อย (เหมือนปล่อยให้ “พฤติกรรมไม่ดี” หลุดไป)
    if (ev && !ev.isGood){
      misses++;
      deck.onJunk();
      syncDeck();
      pushQuest();
    }
  }

  // ===== Tick รายวินาที (รับจาก hha:time) =====
  function onSec(){
    const z = zoneFrom(waterPct);

    // ✅ นับเวลา GREEN สะสมเป็นวินาที (สำหรับ quest + วิจัย)
    if (z === 'GREEN'){
      deck.stats.greenTick = (deck.stats.greenTick | 0) + 1;
      decayFever(2);
    } else {
      decayFever(6);
    }

    // ดึงระดับน้ำกลับสู่สมดุล
    if (z === 'HIGH')      addWater(-4);
    else if (z === 'LOW')  addWater(+4);
    else                   addWater(-1); // GREEN: ค่อย ๆ ลด

    // ให้ MissionDeck อัปเดตเวลา/สถิติภายใน (tick ฯลฯ)
    deck.second();
    syncDeck();

    const g = deck.getProgress('goals');
    const m = deck.getProgress('mini');

    // หมุน goal ใหม่เมื่อเป้าหมายปัจจุบันครบ (pattern แบบ groups/goodjunk)
    if (g.length > 0 && g.every(x => x.done)){
      accGoalDone += g.length;
      deck.drawGoals(2);
      pushQuest('Goal ใหม่');
    }
    // หมุน mini quest ใหม่
    if (m.length > 0 && m.every(x => x.done)){
      accMiniDone += m.length;
      deck.draw3();
      pushQuest('Mini ใหม่');
    }
  }

  let ended = false;

  function finish(){
    if (ended) return;
    ended = true;

    const g = deck.getProgress('goals');
    const m = deck.getProgress('mini');

    const goalCleared = g.length>0 && g.every(x=>x.done);
    const goalsTotal  = accGoalDone + g.length;
    const goalsDone   = accGoalDone + g.filter(x=>x.done).length;
    const miniTotal   = accMiniDone + m.length;
    const miniDone    = accMiniDone + m.filter(x=>x.done).length;

    const greenTick = deck.stats.greenTick | 0;
    const zoneEnd   = zoneFrom(waterPct);

    // ยิง event hha:end ในรูปแบบที่สอดคล้องกับ goodjunk / groups
    window.dispatchEvent(new CustomEvent('hha:end', {
      detail: {
        mode: 'hydration',        // ใช้เป็น key หลัก
        modeLabel: 'Hydration',   // label สวย ๆ สำหรับหน้ารายงาน
        difficulty: diff,

        score,
        misses,
        comboMax,
        duration: dur,

        goalCleared,
        goalsCleared: goalsDone,
        goalsTotal,
        questsCleared: miniDone,
        questsTotal: miniTotal,

        // สถิติโหมด hydration โดยเฉพาะ
        greenTick,                // เวลาสะสมในโซน GREEN (s)
        waterStart,
        waterEnd: waterPct,
        waterZoneEnd: zoneEnd,

        powerStar:    star,
        powerDiamond: diamond,
        powerShield:  shield,

        // เผื่อ logger ฝั่ง CSV อยากอ่านค่า stats ตรง ๆ
        // (ควรเป็น primitive เท่านั้นใน MissionDeck.stats)
        deckStats: deck.stats
      }
    }));
  }

  // ใช้ hha:time จาก factory เป็น clock กลาง (นับถอยหลังจาก dur → 0)
  const onTime = (e) => {
    const sec = (e.detail?.sec | 0);
    if (sec >= 0) onSec();
    if (sec === 0){
      finish();
      window.removeEventListener('hha:time', onTime);
    }
  };
  window.addEventListener('hha:time', onTime);

  // เรียก factory boot (ตัวนี้จะ spawn เป้าและยิง hha:time ให้เอง)
  const inst = await factoryBoot({
    difficulty: diff,
    duration:   dur,
    pools:      { good:[...GOOD, ...BONUS], bad:[...BAD] },
    goodRate:   0.60,
    powerups:   BONUS,
    powerRate:  0.10,
    powerEvery: 7,
    judge:(ch,ctx)=>judge(ch,ctx),
    onExpire
  });

  // แสดงเควสต์ตั้งแต่เริ่ม (เหมือนโหมดอื่น)
  pushQuest('เริ่มโหมดน้ำสมดุล');

  return inst;
}

export default { boot };
