// === /HeroHealth/modes/hydration.quest.js (2025-11-13 HYDRATION QUEST + WATER GAUGE) ===
// โหมดรักษาสมดุลน้ำในร่างกาย: คลิกน้ำดี, เลี่ยงตัวดูดน้ำ / น้ำหวาน
// - ใช้ Water Gauge (ui-water.js) แสดงโซน LOW / BALANCED / HIGH
// - มี Goal + Mini Quest ผ่าน MissionDeck
// - ความยากโหดขึ้นเรื่อย ๆ โดยอาศัย dynamic speed จาก mode-factory + โค้ชเตือน

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck }        from '../vr/mission.js';
import { ensureWaterGauge, setWaterGauge, destroyWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { setFever, setFeverActive } from '../vr/ui-fever.js';
import { Particles }          from '../vr/particles.js';

// ---------- Pools ----------
const WATER_GOOD = ['💧','🚰','🥤','🧃','🫗','🍵'];      // น้ำเปล่า/น้ำดี
const WATER_BAD  = ['☕','🧋','🥛','🍺','🍷','🍹','🍸','🍶']; // น้ำหวาน/คาเฟอีน-แอลกอฮอล์ = ทำให้เสียสมดุล

// ---------- Goal & Mini ----------
function buildGoalPool(diff){
  return [
    {
      id:'g_hydra_green25',
      label:'รักษาโซนสมดุล (GREEN) ให้ได้รวม 25 วินาที',
      level:'easy',
      target:25,
      check:s => (s.greenSec|0) >= 25,
      prog :s => Math.min(25, s.greenSec|0)
    },
    {
      id:'g_hydra_green40',
      label:'รักษาโซนสมดุล (GREEN) ให้ได้รวม 40 วินาที',
      level:'normal',
      target:40,
      check:s => (s.greenSec|0) >= 40,
      prog :s => Math.min(40, s.greenSec|0)
    },
    {
      id:'g_hydra_miss_le6',
      label:'ไม่ให้โซน LOW/HIGH เกิน 6 ครั้ง',
      level:'normal',
      target:6,
      check:s => (s.zoneBreaks|0) <= 6,
      prog :s => Math.max(0, 6 - (s.zoneBreaks|0))
    }
  ];
}

function buildMiniPool(diff){
  return [
    {
      id:'m_hydra_combo10',
      label:'ทำคอมโบต่อเนื่อง 10',
      level:'easy',
      target:10,
      check:s => (s.comboMax|0) >= 10,
      prog :s => Math.min(10, s.comboMax|0)
    },
    {
      id:'m_hydra_combo16',
      label:'ทำคอมโบต่อเนื่อง 16',
      level:'normal',
      target:16,
      check:s => (s.comboMax|0) >= 16,
      prog :s => Math.min(16, s.comboMax|0)
    },
    {
      id:'m_hydra_green15',
      label:'อยู่ในโซน GREEN ต่อเนื่อง 15 วินาที',
      level:'normal',
      target:15,
      check:s => (s.greenStreak|0) >= 15,
      prog :s => Math.min(15, s.greenStreak|0)
    }
  ];
}

// ---------- Mode Boot ----------
export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  setFever(0);
  setFeverActive(false);

  ensureWaterGauge();
  setWaterGauge(55); // กลาง ๆ

  // ----- Mission Deck -----
  const deck = new MissionDeck({
    goalPool: buildGoalPool(diff),
    miniPool: buildMiniPool(diff)
  });
  deck.drawGoals(2);
  deck.draw3();

  // เพิ่มช่องเก็บค่าเฉพาะโหมดน้ำ
  deck.stats.greenSec   = 0;  // เวลาที่อยู่ GREEN สะสม
  deck.stats.greenStreak= 0;  // GREEN ติดกันล่าสุด
  deck.stats.zoneBreaks = 0;  // จำนวนครั้งที่หลุดออกจาก GREEN

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail:{ goal:focusGoal, mini:focusMini, goalsAll:goals, minisAll:minis, hint }
    }));
  }

  let score    = 0;
  let combo    = 0;
  let comboMax = 0;
  let water    = 55;     // 0–100
  let lastZone = zoneFrom(water);

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}}));
  }

  function updateStats(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function applyWater(delta){
    water = Math.max(0, Math.min(100, water + delta));
    setWaterGauge(water);
  }

  // ---------- Judge ----------
  function judge(ch, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;
    let isGood = false;
    let deltaScore = 0;

    if (WATER_GOOD.includes(ch)){
      isGood = true;
      applyWater(+5);
      const base = 14 + combo * 2;
      deltaScore = base;
      score += deltaScore;
      combo += 1;
      if (combo > comboMax) comboMax = combo;

      deck.onGood();
      updateStats();

      Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'});
      Particles.scorePop({x,y,text:`+${deltaScore}`,good:true});
    } else {
      // ตัวดูดน้ำ/น้ำหวาน
      isGood = false;
      applyWater(-7);
      deltaScore = -10;
      score = Math.max(0, score + deltaScore);
      combo = 0;

      deck.onJunk();
      updateStats();

      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
      Particles.scorePop({x,y,text:`${deltaScore}`,good:false});
    }

    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ delta:deltaScore, total:score, good:isGood, combo, comboMax }
    }));
    window.dispatchEvent(new CustomEvent('hha:combo',{
      detail:{ combo, comboMax }
    }));

    pushQuest();
    return { good:isGood, scoreDelta:deltaScore };
  }

  function onExpire(ev){
    // ถ้าปล่อยน้ำดีหลุด = เสียน้ำนิดหน่อย
    const ch = ev?.ch || ev?.char || '';
    if (WATER_GOOD.includes(ch)){
      applyWater(-4);
      deck.onJunk();
      combo = 0;
      updateStats();
      pushQuest();
    }
  }

  // ---------- per-second ----------
  function onSec(){
    // drift เล็กน้อยตาม diff
    const drift =
      diff === 'easy'   ? -0.2 :
      diff === 'hard'   ? -0.6 :
                          -0.4;
    applyWater(drift);

    deck.second();
    updateStats();

    const zone = zoneFrom(water);
    if (zone === 'GREEN'){
      deck.stats.greenSec   += 1;
      deck.stats.greenStreak+= 1;
    } else {
      if (lastZone === 'GREEN') deck.stats.zoneBreaks += 1;
      deck.stats.greenStreak = 0;
    }
    lastZone = zone;

    // โค้ชเตือนเรื่องโซน
    if (zone === 'LOW' && (deck.stats.tick % 7 === 0)){
      coach('น้ำเริ่มต่ำแล้ว รีบเติมน้ำดี ๆ ด่วน!');
    } else if (zone === 'HIGH' && (deck.stats.tick % 7 === 0)){
      coach('น้ำมากเกินไป ระวังดื่มหวาน/กาแฟเยอะไปนะ!');
    }

    pushQuest();
  }

  window.addEventListener('hha:time',(e)=>{
    if ((e.detail?.sec|0) >= 0) onSec();
  });

  coach('โหมด Hydration: รักษา Water Gauge ให้อยู่ในโซน Balanced ให้ได้นานที่สุด!');

  // ---------- start factory ----------
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good: WATER_GOOD, bad: WATER_BAD },
    goodRate  : 0.65,
    judge,
    onExpire
  }).then(ctrl=>{
    // สรุปตอนหมดเวลา
    window.addEventListener('hha:time',(e)=>{
      if ((e.detail?.sec|0) <= 0){
        const goals = deck.getProgress('goals');
        const minis = deck.getProgress('mini');
        const goalCleared   = goals.length>0 && goals.every(g=>g.done);
        const questsCleared = minis.filter(m=>m.done).length;
        const questsTotal   = minis.length;

        window.dispatchEvent(new CustomEvent('hha:end',{
          detail:{
            mode       : 'Hydration',
            difficulty : diff,
            score,
            comboMax   : deck.stats.comboMax,
            misses     : deck.stats.junkMiss,
            hits       : deck.stats.goodCount,
            duration   : dur,
            goalCleared,
            questsCleared,
            questsTotal
          }
        }));

        // ปิดเกจน้ำออกหลังจบ
        setTimeout(()=>{ destroyWaterGauge(); }, 400);
      }
    });

    pushQuest('เริ่ม');
    return ctrl;
  });
}

export default { boot };
