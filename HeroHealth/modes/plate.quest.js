// === /HeroHealth/modes/plate.quest.js (2025-11-13 BALANCED PLATE QUEST) ===
// โหมดจัดจานอาหารสมดุล: เน้นสัดส่วน ผัก / ผลไม้ / ข้าว-แป้ง / โปรตีน
// - ใช้ MissionDeck ทำ Goal + Mini Quest
// - นับจำนวนผัก/ผลไม้/แป้ง/โปรตีนที่เก็บได้
// - มีโค้ชน้อย ๆ ช่วยบอก Tip

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck }        from '../vr/mission.js';
import { setFever, setFeverActive } from '../vr/ui-fever.js';
import { Particles }          from '../vr/particles.js';

// ---------- Food Categories ----------
const VEG   = ['🥦','🥕','🥬','🍅','🌽','🧅','🫛','🫑'];
const FRUIT = ['🍎','🍌','🍇','🍓','🍊','🍉','🍍','🍐','🥝'];
const CARB  = ['🍚','🍙','🍞','🥖','🥐','🥯','🫓','🥔'];
const PROT  = ['🥩','🍗','🍖','🥚','🧆','🐟','🍤','🫘'];

const JUNK_PLATE = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🍫','🧋','🥤'];

const GOOD_PLATE = Array.from(new Set([...VEG, ...FRUIT, ...CARB, ...PROT]));

// ระบุประเภทของ emoji
function typeOfFood(ch){
  if (VEG.includes(ch))   return 'veg';
  if (FRUIT.includes(ch)) return 'fruit';
  if (CARB.includes(ch))  return 'carb';
  if (PROT.includes(ch))  return 'prot';
  return 'junk';
}

// ---------- Goal / Mini ----------
function buildGoalPool(diff){
  return [
    {
      id:'g_plate_veg12',
      label:'เก็บผักให้ได้ 12 ชิ้น',
      level:'easy',
      target:12,
      check:s => (s.veg|0) >= 12,
      prog :s => Math.min(12, s.veg|0)
    },
    {
      id:'g_plate_balanced22',
      label:'เก็บแต่ละหมวด (ผัก/ผลไม้/ข้าว-แป้ง/โปรตีน) อย่างน้อย 8 ชิ้น',
      level:'normal',
      target:8,
      check:s => (s.veg|0) >= 8 && (s.fruit|0) >= 8 && (s.carb|0) >= 8 && (s.prot|0) >= 8,
      prog :s => Math.min(
        8,
        Math.min(s.veg|0, s.fruit|0, s.carb|0, s.prot|0)
      )
    },
    {
      id:'g_plate_miss_le6',
      label:'พลาดไม่เกิน 6 ครั้ง',
      level:'normal',
      target:6,
      check:s => (s.junkMiss|0) <= 6,
      prog :s => Math.max(0, 6 - (s.junkMiss|0))
    }
  ];
}

function buildMiniPool(diff){
  return [
    {
      id:'m_plate_combo10',
      label:'ทำคอมโบต่อเนื่อง 10',
      level:'easy',
      target:10,
      check:s => (s.comboMax|0) >= 10,
      prog :s => Math.min(10, s.comboMax|0)
    },
    {
      id:'m_plate_combo16',
      label:'ทำคอมโบต่อเนื่อง 16',
      level:'normal',
      target:16,
      check:s => (s.comboMax|0) >= 16,
      prog :s => Math.min(16, s.comboMax|0)
    },
    {
      id:'m_plate_each6',
      label:'เก็บผัก/ผลไม้/ข้าว-แป้ง/โปรตีน อย่างน้อย 6 ชิ้น',
      level:'normal',
      target:6,
      check:s => (s.veg|0) >= 6 && (s.fruit|0) >= 6 && (s.carb|0) >= 6 && (s.prot|0) >= 6,
      prog :s => Math.min(
        6,
        Math.min(s.veg|0, s.fruit|0, s.carb|0, s.prot|0)
      )
    }
  ];
}

// ---------- Mode Boot ----------
export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  setFever(0);
  setFeverActive(false);

  // Mission deck
  const deck = new MissionDeck({
    goalPool: buildGoalPool(diff),
    miniPool: buildMiniPool(diff)
  });
  deck.drawGoals(2);
  deck.draw3();

  // เพิ่มสถิติของแต่ละหมวด
  deck.stats.veg   = 0;
  deck.stats.fruit = 0;
  deck.stats.carb  = 0;
  deck.stats.prot  = 0;

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{ goal:focusGoal, mini:focusMini, goalsAll:goals, minisAll:minis, hint }
    }));
  }

  let score    = 0;
  let combo    = 0;
  let comboMax = 0;

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}}));
  }

  function updateStats(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function addFoodType(type){
    if (type === 'veg')   deck.stats.veg   += 1;
    if (type === 'fruit') deck.stats.fruit += 1;
    if (type === 'carb')  deck.stats.carb  += 1;
    if (type === 'prot')  deck.stats.prot  += 1;
  }

  // ---------- judge ----------
  function judge(ch, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    const kind = typeOfFood(ch);
    const isGood = kind !== 'junk' && GOOD_PLATE.includes(ch);

    let delta = 0;
    if (isGood){
      const base = 14 + combo*2;
      delta = base;
      score += delta;
      combo += 1;
      if (combo > comboMax) comboMax = combo;

      deck.onGood();
      addFoodType(kind);
      updateStats();

      Particles.burstShards(null,null,{screen:{x,y},theme:'plate'});
      Particles.scorePop({x,y,text:`+${delta}`,good:true});
    } else {
      delta = -10;
      score = Math.max(0, score + delta);
      combo = 0;

      deck.onJunk();
      updateStats();

      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
      Particles.scorePop({x,y,text:`${delta}`,good:false});
    }

    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ delta, total:score, good:isGood, combo, comboMax }
    }));
    window.dispatchEvent(new CustomEvent('hha:combo',{
      detail:{ combo, comboMax }
    }));

    pushQuest();
    return { good:isGood, scoreDelta:delta };
  }

  function onExpire(ev){
    const ch   = ev?.ch || ev?.char || '';
    const kind = typeOfFood(ch);
    // ถ้าปล่อยอาหารดีหลุด → นับเป็นพลาดเล็กน้อย
    if (kind !== 'junk' && GOOD_PLATE.includes(ch)){
      deck.onJunk();
      combo = 0;
      updateStats();
      pushQuest();
    }
  }

  // per-second
  function onSec(){
    deck.second();
    updateStats();
    pushQuest();
  }

  window.addEventListener('hha:time',(e)=>{
    if ((e.detail?.sec|0) >= 0) onSec();
  });

  coach('โหมด Balanced Plate: เลือกอาหารให้ครบ ผัก ผลไม้ ข้าว-แป้ง โปรตีน ให้สมดุลกัน!');

  // ---------- start factory ----------
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good: GOOD_PLATE, bad: JUNK_PLATE },
    goodRate  : 0.72,
    judge,
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time',(e)=>{
      if ((e.detail?.sec|0) <= 0){
        const goals = deck.getProgress('goals');
        const minis = deck.getProgress('mini');
        const goalCleared   = goals.length>0 && goals.every(g=>g.done);
        const questsCleared = minis.filter(m=>m.done).length;
        const questsTotal   = minis.length;

        window.dispatchEvent(new CustomEvent('hha:end',{
          detail:{
            mode       : 'Balanced Plate',
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
      }
    });

    pushQuest('เริ่ม');
    return ctrl;
  });
}

export default { boot };
