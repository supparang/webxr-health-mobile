// === /HeroHealth/modes/hydration.safe.js (Full, FIXED: water GREEN time + FX import) ===
import Particles from '../vr/particles.js';
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createHydrationQuest } from './hydration.quest.js';

const GOOD  = ['💧','🥛','🍉'];          // น้ำ/นม/ผลไม้ฉ่ำน้ำ
const BAD   = ['🥤','🧋','🍺','☕️'];     // น้ำหวาน/ชาไข่มุก/แอลกอฮอล์/คาเฟอีน
const STAR  = '⭐', DIA = '💎', SHIELD = '🛡️', FIRE = '🔥';
const BONUS = [STAR, DIA, SHIELD, FIRE];

export async function boot(cfg = {}){
  const diff = (cfg.difficulty || 'normal').toLowerCase();
  const dur  = (cfg.duration | 0) || 60;

  // HUD reset
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);

  ensureWaterGauge();
  setWaterGauge(50);

  // Quest deck (2 goals + 3 minis, auto refill)
  const deck = createHydrationQuest(diff);
  deck.drawGoals(2);
  deck.draw3();

  let accMiniDone = 0;
  let accGoalDone = 0;

  // ----- State -----
  let score      = 0;
  let combo      = 0;
  let comboMax   = 0;
  let misses     = 0;
  let star       = 0;
  let diamond    = 0;
  let shield     = 0;
  let fever      = 0;
  let feverActive = false;

  let waterPct   = 50;
  let timeGreen  = 0; // เวลาสะสมที่อยู่ในโซน GREEN (วินาที)

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
    const info = setWaterGauge(waterPct); // { pct, zone, label }
    deck.stats.zone = info.zone;         // ใช้ zone นี้ใน quest
  }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.timeInGreen = timeGreen;  // ให้ hydration.quest ใช้ได้
  }

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const z     = zoneFrom(waterPct);
    window.dispatchEvent(new CustomEvent('quest:update',{
      detail:{
        goal: (goals.find(g=>!g.done) || goals[0] || null),
        mini: (minis.find(m=>!m.done) || minis[0] || null),
        goalsAll: goals,
        minisAll: minis,
        hint: `Zone: ${z}`
      }
    }));
  }

  // FX: ใช้ DOM overlay (scorePop + burstAt)
  function scoreFX(x, y, val){
    try{
      scorePop(x, y, (val > 0 ? '+' : '') + val, { good: val >= 0 });
      burstAt(x, y, { color: val >= 0 ? '#22c55e' : '#f97316' });
    }catch(_){}
  }

  function judge(ch, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    // ----- Power-ups -----
    if (ch === STAR){
      const d = 40 * mult();
      score += d; star++;
      gainFever(10);
      deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good:true, scoreDelta:d };
    }
    if (ch === DIA){
      const d = 80 * mult();
      score += d; diamond++;
      gainFever(30);
      deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good:true, scoreDelta:d };
    }
    if (ch === SHIELD){
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good:true, scoreDelta:d };
    }
    if (ch === FIRE){
      feverActive = true;
      setFeverActive(true);
      fever = Math.max(fever, 60);
      setFever(fever);
      const d = 25;
      score += d;
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good:true, scoreDelta:d };
    }

    // ----- Normal Good / Bad -----
    if (GOOD.includes(ch)){
      addWater(8);
      const d = (14 + combo * 2) * mult();
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);
      gainFever(6 + combo * 0.4);
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good:true, scoreDelta:d };
    }else{
      if (shield > 0){
        shield--;
        setShield(shield);
        addWater(-4);
        decayFever(6);
        syncDeck(); pushQuest();
        scoreFX(x, y, 0);
        return { good:false, scoreDelta:0 };
      }
      addWater(-8);
      const d = -10;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;
      decayFever(14);
      deck.onJunk();
      syncDeck(); pushQuest();
      scoreFX(x, y, d);
      return { good:false, scoreDelta:d };
    }
  }

  function onExpire(ev){
    // ปล่อย BAD ผ่านไป → นับ miss เล็กน้อย
    if (ev && !ev.isGood){
      misses++;
      deck.onJunk();
      syncDeck();
      pushQuest();
    }
  }

  function onSec(){
    const z = zoneFrom(waterPct);

    // นับเวลาที่อยู่ในโซน GREEN
    if (z === 'GREEN') timeGreen++;
    deck.stats.timeInGreen = timeGreen;
    deck.stats.zone        = z;

    // drain / overflow correction
    if (z === 'GREEN') decayFever(2);
    else               decayFever(6);

    // ขยับน้ำกลับเข้าช่วงสมดุล
    addWater(
      z === 'HIGH' ? -4 :
      z === 'LOW'  ? +4 :
                     -1
    );

    deck.second();
    syncDeck();

    // refill wave
    const g = deck.getProgress('goals');
    const m = deck.getProgress('mini');
    if (g.length > 0 && g.every(x=>x.done)){
      accGoalDone += g.length;
      deck.drawGoals(2);
      pushQuest('Goal ใหม่');
    }
    if (m.length > 0 && m.every(x=>x.done)){
      accMiniDone += m.length;
      deck.draw3();
      pushQuest('Mini ใหม่');
    }
  }

  // ---- Attach to factory time events ----
  return factoryBoot({
    difficulty: diff,
    duration:   dur,
    pools:      { good:[...GOOD, ...BONUS], bad:[...BAD] },
    goodRate:   0.60,
    powerups:   BONUS,
    powerRate:  0.10,
    powerEvery: 7,
    judge:(ch,ctx)=>judge(ch,ctx),
    onExpire
  }).then(ctrl=>{
    pushQuest('เริ่ม');

    window.addEventListener('hha:time',(e)=>{
      const sec = (e.detail?.sec | 0);
      if (sec >= 0) onSec();
      if (sec === 0){
        const g = deck.getProgress('goals');
        const m = deck.getProgress('mini');

        const goalCleared = g.length > 0 && g.every(x=>x.done);
        const goalsTotal  = accGoalDone + g.length;
        const goalsDone   = accGoalDone + g.filter(x=>x.done).length;
        const miniTotal   = accMiniDone + m.length;
        const miniDone    = accMiniDone + m.filter(x=>x.done).length;

        window.dispatchEvent(new CustomEvent('hha:end',{
          detail:{
            mode:          'Hydration',
            difficulty:    diff,
            score,
            misses,
            comboMax,
            duration:      dur,
            goalCleared,
            goalsCleared:  goalsDone,
            goalsTotal,
            questsCleared: miniDone,
            questsTotal:   miniTotal
          }
        }));
      }
    });

    return ctrl;
  });
}

export default { boot };
