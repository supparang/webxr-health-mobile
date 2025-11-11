// === /HeroHealth/modes/hydration.quest.js ===
import { boot as domBoot }     from '../vr/mode-factory.js';
import {
  ensureWaterGauge, setWaterGauge, destroyWaterGauge,
  floatScoreScreen, burstAtScreen
} from '../vr/ui-water.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { MissionDeck } from '../vr/mission.js';

// ---------- กำหนดคอนเทนต์โหมด ----------
const GOOD = ['💧','🚰','🥛','🧃','🍋','🍊','🍎'];      // ดื่มน้ำ/ผลไม้ฉ่ำน้ำ
const JUNK = ['🧋','🥤','🍺','🍷','🍹'];              // หวานจัด/แอลกอฮอล์

// โบนัส/โทษต่อ “ระดับน้ำ” (%)
const WATER_DELTA = {
  '💧': +10, '🚰': +12, '🥛': +6, '🧃': +5,
  '🍋': +4, '🍊': +4, '🍎': +3,
  '🧋': -10,'🥤': -8,  '🍺': -14,'🍷': -12,'🍹': -10
};

// มิชชั่นย่อย 10 ใบ (จะสุ่มมา 3 ใบ)
const HYDRATION_QUESTS = [
  { id:'bal15', level:'easy',   label:'รักษา Balanced 15 วิ',   check:s=>s.balancedTime>=15, prog:s=>Math.min(15,s.balancedTime), target:15 },
  { id:'bal25', level:'normal', label:'รักษา Balanced 25 วิ',   check:s=>s.balancedTime>=25, prog:s=>Math.min(25,s.balancedTime), target:25 },
  { id:'combo10',level:'easy',  label:'ทำคอมโบ 10',            check:s=>s.comboMax>=10,     prog:s=>Math.min(10,s.comboMax),   target:10 },
  { id:'combo15',level:'normal',label:'ทำคอมโบ 15',            check:s=>s.comboMax>=15,     prog:s=>Math.min(15,s.comboMax),   target:15 },
  { id:'score350',level:'normal',label:'ทำคะแนน 350+',         check:s=>s.score>=350,       prog:s=>Math.min(350,s.score),     target:350 },
  { id:'good12',  level:'easy',  label:'เก็บของดี 12 ชิ้น',     check:s=>s.goodCount>=12,    prog:s=>Math.min(12,s.goodCount),  target:12 },
  { id:'avoid8',  level:'easy',  label:'หลีกของขยะ 8 ครั้ง',     check:s=>s.junkAvoid>=8,     prog:s=>Math.min(8, s.junkAvoid),  target:8  },
  { id:'milk3',   level:'normal',label:'ดื่ม 🥛 3 แก้ว',         check:s=>s.milk>=3,          prog:s=>Math.min(3, s.milk),       target:3  },
  { id:'water8',  level:'hard',  label:'ดื่ม 💧/🚰 8 แก้ว',       check:s=>s.waterIcon>=8,     prog:s=>Math.min(8, s.waterIcon),  target:8  },
  { id:'nojunk10',level:'hard',  label:'ไม่โดนขยะ 10 วิ',        check:s=>s.noJunkTime>=10,   prog:s=>Math.min(10,s.noJunkTime), target:10 },
];

// Goal หลักของโหมดนี้
const GOAL = { id:'goal25', label:'คงระดับน้ำให้อยู่zona GREEN รวม 25 วิ', target:25 };

// ---------- ช่วยคำนวณ ----------
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const isGood = ch => GOOD.includes(ch);
const isJunk = ch => JUNK.includes(ch);

// ---------- โหมดหลัก ----------
export async function boot(config={}){
  // UI
  ensureWaterGauge();
  questHUDInit();

  // สถานะภายในโหมด
  let water = 55;                   // เริ่มกลาง ๆ
  let lastZone = 'GREEN';
  let extraRounds = 0;              // จำนวนรอบ mini quest ที่สุ่มเพิ่มแล้ว
  let goalProg = 0;                 // เป้าหลัก: เวลาที่อยู่โซน GREEN รวม (วินาที)

  // สถิติเพื่อภารกิจ
  const stats = {
    score:0, combo:0, comboMax:0,
    goodCount:0, junkAvoid:0,
    milk:0, waterIcon:0,
    noJunkTime:0, balancedTime:0
  };

  // Deck มิชชั่น
  const deck = new MissionDeck({ pool: HYDRATION_QUESTS });
  deck.draw3();

  function zoneOf(pct){
    return (pct>=40 && pct<=70) ? 'GREEN' : (pct>70? 'HIGH' : 'LOW');
  }

  function updateWater(by){
    water = clamp(water + (by||0), 0, 100);
    setWaterGauge(water);

    const z = zoneOf(water);
    if (z === 'GREEN') {
      stats.balancedTime = Math.min(9999, stats.balancedTime + 1);
      goalProg = Math.min(GOAL.target, goalProg + 1);
    } else {
      stats.balancedTime = 0;
    }
    if (stats.noJunkTime < 9999) stats.noJunkTime += 1;
    lastZone = z;
  }

  // ยิงสถานะไปให้ HUD ด้านล่าง (index.vr.html ใช้)
  function pushHUD(miniText){
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail:{
        text: miniText ? `Mini Quest — ${miniText}` : undefined,
        goal:{ label: GOAL.label, prog: goalProg, target: GOAL.target },
        mini:(()=>{
          const cur = deck.getCurrent();
          if (!cur) return undefined;
          const prog = deck.getProgress().find(p=>p.current) || {};
          return { label: cur.label, prog: prog.prog||0, target: prog.target||1 };
        })()
      }
    }));
    // แผงด้านขวา (Quest HUD)
    const cur = deck.getCurrent();
    questHUDUpdate(deck, cur ? cur.label : '—');
  }

  // กติกาตีเป้า (ชวน domBoot ทำสปอว์นให้)
  function judge(ch){
    let dScore = 0;
    let good = false;

    if (isGood(ch)) {
      good = true;
      stats.goodCount++;
      if (ch==='🥛') stats.milk++;
      if (ch==='💧' || ch==='🚰') stats.waterIcon++;
      stats.noJunkTime = Math.min(9999, stats.noJunkTime + 1);

      dScore = 25;
      const by = WATER_DELTA[ch] ?? +6;
      updateWater(by);

      // เอฟเฟกต์เล็ก ๆ ตรงกลางล่าง
      floatScoreScreen(window.innerWidth/2, window.innerHeight-120, '+'+dScore, '#8ef');
      burstAtScreen(window.innerWidth/2, window.innerHeight-120, {count:14, color:'#60a5fa'});
    } else if (isJunk(ch)) {
      good = false;
      stats.noJunkTime = 0;

      dScore = -20;
      const by = WATER_DELTA[ch] ?? -8;
      updateWater(by);

      floatScoreScreen(window.innerWidth/2, window.innerHeight-120, dScore, '#f66');
      burstAtScreen(window.innerWidth/2, window.innerHeight-120, {count:12, color:'#ef4444'});
    } else {
      // อื่น ๆ ถือว่าเฉย ๆ
      good = true; dScore = 10;
    }

    // คอมโบ/สกอร์รวม
    stats.score = Math.max(0, stats.score + dScore);
    stats.combo = good ? Math.min(9999, stats.combo + 1) : 0;
    stats.comboMax = Math.max(stats.comboMax, stats.combo);

    // แจ้ง deck (ให้ทัน HUD)
    deck.tick({ score:stats.score, combo:stats.combo });

    // เปลี่ยนใบ mini quest อัตโนมัติเมื่อผ่าน
    if (deck._autoAdvance()) {
      const cur = deck.getCurrent();
      pushHUD(cur ? cur.label : '—');
    }

    return { good, scoreDelta: dScore };
  }

  // เมื่อ “ขยะ” หมดอายุบนจอ (เลี่ยงได้)
  function onExpire(ev){
    if (ev && ev.isGood === false) {
      stats.junkAvoid++;
      deck.tick(); // ให้รีเฟรช progress
      pushHUD();
    }
  }

  // เวลาลด/ระบบนาทีต่อนาที
  const onSecond = () => {
    // Decay ทีละนิด
    updateWater(-0.6);

    // จัดการเควสต์ชุดใหม่ถ้าผ่านครบและยังมีเวลา
    if (deck.isCleared()) {
      // เพิ่มเซ็ตใหม่ทันที แล้วนับรวมเป็น “รอบเพิ่ม”
      deck.draw3();
      extraRounds++;
      pushHUD('เริ่มชุดใหม่!');
    } else {
      pushHUD();
    }
  };

  // hook HUD ด้านบนจาก index
  window.addEventListener('hha:time', onSecond);

  // เริ่มเกม (ให้ mode-factory สุ่มเป้าให้)
  const game = await domBoot({
    host: document.getElementById('spawnHost'),
    difficulty: (config.difficulty || 'normal'),
    duration: Number(config.duration || 60),
    pools: { good: GOOD, bad: JUNK },
    goodRate: 0.66,
    judge,
    onExpire
  });

  // แจ้ง HUD เริ่มต้น
  pushHUD(deck.getCurrent()?.label || '—');

  // ตอนจบเกม
  function finish(summary={}){
    window.removeEventListener('hha:time', onSecond);
    questHUDDispose();
    destroyWaterGauge();

    const result = {
      score: stats.score,
      comboMax: stats.comboMax,
      questsTotal: 3 * (1 + extraRounds),
      questsCleared: deck.getProgress().filter(q=>q.done).length + (extraRounds*3),
      goalCleared: goalProg >= GOAL.target
    };
    // ส่งให้ index แสดงสรุป
    window.dispatchEvent(new CustomEvent('hha:end', { detail: result }));
  }

  // ดักจบจาก index (mode-factory ยิงให้)
  window.addEventListener('hha:end', () => finish(), { once:true });

  // เผื่อถูกสลับโหมดกลางคัน
  window.addEventListener('hha:dispose-ui', ()=>{
    try{ game?.stop?.(); }catch{}
    finish();
  }, { once:true });

  // ส่งสถานะเริ่มต้นให้ index แสดง Goal แถบล่าง
  pushHUD(deck.getCurrent()?.label || '—');
}

export default { boot };
