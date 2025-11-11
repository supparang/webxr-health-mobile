// === modes/hydration.quest.js — Hydration (water gauge + goal & mini) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureWaterGauge, destroyWaterGauge, setWaterGauge, zoneFrom, burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

const DROP = '💧', WATER = '🚰';
const DRINKS_GOOD = ['🥤','🧃','🥛', DROP, WATER]; // น้ำ/นม/น้ำผลไม้/หยดน้ำ/ก๊อก
const DRINKS_BAD  = ['🧋','🍺','☕'];              // ชานม/เบียร์/กาแฟ (ขาดน้ำ)
const FRUITS      = ['🍎','🍐','🍊','🍋','🍉','🍇','🍓','🥝','🥭','🍍'];

export async function boot({ host, difficulty='normal', duration=60 } = {}){
  questHUDDispose(); questHUDInit();
  ensureWaterGauge();

  // --- goal หลัก: ยืนโซน GREEN รวม X วินาที ---
  const GOAL_TARGET = (difficulty==='easy') ? 20 : (difficulty==='hard' ? 30 : 25);
  const goal = { label:`เป้า: คงระดับน้ำให้อยู่โซน GREEN รวม ${GOAL_TARGET} วิ`, prog:0, target:GOAL_TARGET };

  // --- mini quest: ใช้ MissionDeck (10 ใบในไฟล์ของคุณ) ---
  const deck = new MissionDeck(); deck.draw3();

  // --- water model ---
  let water = 55;                 // 0..100
  let greenSecs = 0;              // สะสม GREEN
  let feverUntil = 0;             // คูณคะแนน
  let shieldUntil = 0;

  function pushHUD(){
    const cur = deck.getCurrent();
    const prog = deck.getProgress();
    setWaterGauge(water);
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text: cur ? `Mini Quest — ${cur.label}` : 'Mini Quest — กำลังเริ่ม…',
        goal: { label: goal.label, prog: goal.prog, target: goal.target },
        mini: cur ? { label: cur.label, prog: (prog.find(p=>p.id===cur.id)?.prog)||0, target:cur.target||0 } : null
      }
    }));
    questHUDUpdate(deck, 'กำหนดน้ำให้สมดุล');
  }
  pushHUD();

  // --- น้ำลดตามเวลา ---
  const DECAY = 0.35; // ต่อวินาที
  function second(){
    water = Math.max(0, water - DECAY);
    if (zoneFrom(water) === 'GREEN') {
      greenSecs = Math.min(9999, greenSecs + 1);
      goal.prog = Math.min(goal.target, greenSecs);
    }
    deck.second();
    pushHUD();
  }

  // --- power-ups ผลจากตัวอักษรดีพิเศษ ---
  function handlePower(ch){
    const now = performance.now();
    if (ch==='⭐') return { dScore: 80 };
    if (ch==='💎'){ deck.onDiamond(); return { dScore: 120 }; }
    if (ch==='🛡️'){ shieldUntil = now + 5000; return { dScore: 30 }; }
    if (ch==='🔥'){ deck.onFeverStart(); feverUntil = now + 6000; return { dScore: 40 }; }
    return null;
  }

  // --- judge สำหรับ hydration ---
  function judge(char, { isGood }){
    // ปรับน้ำตามชนิด
    let dWater = 0, base = 0, good = false;

    // พาวเวอร์ก่อน
    const p = handlePower(char);
    if (p) return { good:true, scoreDelta:p.dScore };

    if (char===WATER || char===DROP){ dWater = +12; base = 12; good = true; }
    else if (char==='🥛'){ dWater = +8; base = 10; good = true; deck.onStar?.(); }
    else if (char==='🧃'){ dWater = +6; base = 8; good = true; }
    else if (FRUITS.includes(char)){ dWater = +4; base = 6; good = true; }
    else if (char==='🥤'){ dWater = +3; base = 6; good = true; }
    else if (char==='☕'){ dWater = -6; base = -10; good = false; }
    else if (char==='🍺'){ dWater = -12; base = -14; good = false; }
    else if (char==='🧋'){ dWater = -8; base = -12; good = false; }
    else { // อื่น ๆ
      good = isGood; base = isGood ? 6 : -8;
    }

    water = Math.max(0, Math.min(100, water + dWater));
    const mul = (feverUntil>performance.now()) ? 2 : 1;
    return { good, scoreDelta: Math.round(base * mul) };
  }

  // --- เอฟเฟกต์เมื่อโดนเป้า ---
  function onHit(e){
    const d=e.detail||{};
    if (d.good) deck.onGood(); else deck.onJunk();
    floatScoreScreen(d.x||0, d.y||0, (d.delta>0?'+':'')+d.delta, d.good?'#a7f3d0':'#fecaca');
    burstAtScreen(d.x||0, d.y||0, { count:d.good?18:10, color:d.good?'#22c55e':'#f97316' });
    pushHUD();
  }
  function onScore(e){
    const s=e.detail||{}; deck.updateScore(s.score||0); deck.updateCombo(s.combo||0); pushHUD();
  }
  function onTime(){ second(); }
  function onExpired(){ deck.onJunk(); pushHUD(); } // หลบของไม่ดี/หมดเวลา

  window.addEventListener('hha:hit-screen', onHit);
  window.addEventListener('hha:score', onScore);
  window.addEventListener('hha:time', onTime);
  window.addEventListener('hha:expired', onExpired);

  // สรุปผล (ซ้อน hha:end ใส่สถิติเพิ่ม)
  const onEndOnce = (ev)=>{
    window.removeEventListener('hha:hit-screen', onHit);
    window.removeEventListener('hha:score', onScore);
    window.removeEventListener('hha:time', onTime);
    window.removeEventListener('hha:expired', onExpired);
    destroyWaterGauge();

    const cleared = deck.getProgress().filter(q=>q.done).length;
    const total   = deck.getProgress().length;
    const base = ev.detail||{};
    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{ ...base, questsCleared:cleared, questsTotal:total, goalCleared:(goal.prog>=goal.target) }
    }));
  };
  window.addEventListener('hha:end', onEndOnce, { once:true });

  // เริ่มเกมผ่าน factory (สุ่มของผสมดื่ม/ผลไม้/พาวเวอร์)
  const poolGood = [WATER, DROP, '🥛','🧃','🥤', ...FRUITS, '⭐','💎','🛡️','🔥'];
  const poolBad  = ['🧋','🍺','☕'];

  return factoryBoot({
    host, difficulty, duration,
    pools:{ good: poolGood, bad: poolBad },
    goodRate: 0.72,
    judge,
    onExpire: (ev)=>{ if(ev && ev.isGood===false) window.dispatchEvent(new CustomEvent('hha:expired',{detail:ev})); }
  });
}

export default { boot };
