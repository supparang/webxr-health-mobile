// === /HeroHealth/modes/hydration.safe.js ===
// เกมสมดุลน้ำในร่างกาย: ใช้ ui-water + particles + goal/mini

import {
  ensureWaterGauge,
  destroyWaterGauge,
  setWaterGauge,
  zoneFrom,
  floatScoreScreen,
  burstAtScreen
} from '../vr/ui-water.js';

import { burstAt, scorePop } from '../vr/particles.js';

// กลุ่ม emoji
const GOOD_DRINK = [
  '💧','💦','🥛','🫗','🍵','🍲'
];

const DRY_DRINK = [
  '🥤','🧋','🍺','🍷','🍾','☕'
];

const HOT_LOSS = [
  '☀️','🔥','🏃‍♀️','🏃‍♂️'
];

const diffCfg = {
  easy:   { spawnStart:900, spawnMin:520, degrade:1.0, goalGreen:20, miniGood:8 },
  normal: { spawnStart:800, spawnMin:450, degrade:1.3, goalGreen:26, miniGood:10 },
  hard:   { spawnStart:700, spawnMin:380, degrade:1.6, goalGreen:32, miniGood:12 }
};

export async function boot(opts = {}) {
  const diff = (opts.difficulty || 'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML = '';

  // สร้าง/รีเซ็ต Water gauge
  ensureWaterGauge();
  let water = 55;          // เริ่มกลาง ๆ
  setWaterGauge(water);

  let score=0, combo=0, comboMax=0, misses=0, hits=0;
  let timeLeft = dur;

  let balancedTicks = 0;   // เวลาอยู่โซน GREEN (วินาที)
  let goodDrinks    = 0;   // ดื่มน้ำดีไปกี่ครั้ง

  let ticking   = false;
  let spawnLoop = null;

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}}));
  }

  // ---------- Quest ----------
  const mission = {
    goalLabel  : `รักษาโซนสมดุล (GREEN) ให้ครบ ${cfg.goalGreen} วินาที`,
    goalTarget : cfg.goalGreen,
    goalProg   : ()=>balancedTicks,
    goalDone   : ()=>balancedTicks >= cfg.goalGreen,

    miniLabel  : `ดื่มน้ำดีอย่างน้อย ${cfg.miniGood} แก้ว`,
    miniTarget : cfg.miniGood,
    miniProg   : ()=>goodDrinks,
    miniDone   : ()=>goodDrinks >= cfg.miniGood
  };

  function emitQuest(){
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        goal:{
          label: mission.goalLabel,
          target: mission.goalTarget,
          prog: mission.goalProg(),
          done: mission.goalDone()
        },
        mini:{
          label: mission.miniLabel,
          target: mission.miniTarget,
          prog: mission.miniProg(),
          done: mission.miniDone()
        }
      }
    }));
  }

  // ---------- คะแนน ----------
  function emitScore(delta, good, ev){
    score = Math.max(0, score + delta);
    if (good){
      combo++;
      hits++;
      comboMax = Math.max(comboMax, combo);
    } else {
      combo = 0;
      misses++;
    }

    const detail = {
      delta,
      total: score,
      combo,
      comboMax,
      good
    };
    window.dispatchEvent(new CustomEvent('hha:score',{detail}));

    if (ev){
      const x = ev.clientX, y = ev.clientY;
      burstAt(x,y,{color:good?'#22c55e':'#ef4444'});
      const txt = (delta>0?'+':'') + delta;
      scorePop(x,y,txt,{good});
      // เด้งเลขบนจอเพิ่ม (ผูก concept น้ำ)
      floatScoreScreen(x,y,txt,good?'#bbf7d0':'#fecaca');
    }

    if (good && combo===5)  coach('ดื่มดีต่อเนื่อง! คอมโบ 5 แล้ว 👍');
    if (good && combo===10) coach('สุดยอด! นักดื่มน้ำมือโปร 🤩');
    if (!good && misses===3) coach('ระวังของที่ทำให้ร่างกายขาดน้ำนะ');

    if (mission.goalDone()) coach('ถึงเป้าหมายเวลาในโซนสมดุลแล้ว 👏');
    if (mission.miniDone()) coach('ดื่มน้ำดีครบตาม Mini Quest แล้ว เยี่ยมมาก!');
    emitQuest();
  }

  // ---------- น้ำในร่างกาย ----------
  function applyWater(delta){
    water = Math.max(0, Math.min(100, water + delta));
    setWaterGauge(water);
  }

  function onGoodDrink(ev){
    goodDrinks++;
    applyWater(+8);
    emitScore(+110, true, ev);
  }

  function onDryDrink(ev){
    applyWater(-9);
    emitScore(-130, false, ev);
  }

  function onHotLoss(ev){
    applyWater(-12);
    emitScore(-80, false, ev);
  }

  // ---------- Spawn (โหดขึ้นเรื่อย ๆ) ----------
  let spawnDelay = cfg.spawnStart;

  function scheduleSpawn(){
    if (timeLeft <= 0) return;
    spawnLoop = setTimeout(()=>{
      spawnOne();
      // ลด delay ทีละนิดให้โหดขึ้น
      spawnDelay = Math.max(cfg.spawnMin, spawnDelay * 0.97);
      scheduleSpawn();
    }, spawnDelay);
  }

  function spawnOne(){
    if (timeLeft <= 0) return;

    const r = Math.random();
    let type;
    if (r < 0.55)      type = 'GOOD';
    else if (r < 0.85) type = 'DRY';
    else               type = 'HOT';

    let emoji;
    if (type === 'GOOD') emoji = pickOne(GOOD_DRINK);
    else if (type === 'DRY') emoji = pickOne(DRY_DRINK);
    else emoji = pickOne(HOT_LOSS);

    const el = document.createElement('div');
    el.textContent = emoji;
    el.dataset.type = type;
    Object.assign(el.style,{
      position:'absolute',
      left:(12 + Math.random()*76) + '%',
      top:(18 + Math.random()*60) + '%',
      transform:'translate(-50%,-50%)',
      font:'900 46px system-ui',
      textShadow:'0 6px 18px rgba(0,0,0,.55)',
      cursor:'pointer',
      pointerEvents:'auto',
      userSelect:'none'
    });

    // อายุเป้าลดลงตามเวลา (ยิ่งใกล้หมด ยิ่งสั้น)
    const lifeBase = 2100;
    const life = Math.max(1200, lifeBase * (0.5 + 0.5 * (timeLeft/dur)));

    const kill = ()=>{
      if (el.parentNode) try{ host.removeChild(el); }catch(_){}
    };

    el.addEventListener('click',(ev)=>{
      if (!el.parentNode) return;
      kill();
      const t = el.dataset.type;
      if (t === 'GOOD') onGoodDrink(ev);
      else if (t === 'DRY') onDryDrink(ev);
      else onHotLoss(ev);
    });

    host.appendChild(el);
    setTimeout(kill, life);
  }

  // ---------- Timer ----------
  function tick(){
    timeLeft--;
    // ร่างกายใช้น้ำเอง
    applyWater(-cfg.degrade);

    const zone = zoneFrom(water);
    if (zone === 'GREEN') balancedTicks++;
    if (zone !== 'GREEN'){
      // ถ้าอยากเพิ่ม tough mode ภายหลัง อาจเพิ่ม miss ที่นี่
    }

    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    emitQuest();

    if (timeLeft <= 0){
      stopAll();
      finish();
    }
  }

  function stopAll(){
    if (ticking){ clearInterval(ticking); ticking = false; }
    if (spawnLoop){ clearTimeout(spawnLoop); spawnLoop = null; }
  }

  function finish(){
    emitQuest();
    const questsTotal   = 2;
    const questsCleared = (mission.goalDone()?1:0) + (mission.miniDone()?1:0);

    destroyWaterGauge();
    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:'hydration',
        difficulty:diff,
        score,
        misses,
        comboMax,
        duration:dur,
        goalCleared:mission.goalDone(),
        questsCleared,
        questsTotal
      }
    }));
  }

  return {
    start(){
      score=0;combo=0;comboMax=0;misses=0;hits=0;
      timeLeft=dur;balancedTicks=0;goodDrinks=0;
      water=55; setWaterGauge(water);
      window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
      emitQuest();
      coach('เลือกดื่มน้ำดีให้บ่อย รักษาเกจให้อยู่โซนสีเขียวให้ได้นานที่สุด!');
      ticking = setInterval(tick,1000);
      scheduleSpawn();
    },
    stop(){
      stopAll();
      destroyWaterGauge();
    }
  };
}

export default { boot };

function pickOne(arr){ return arr[(Math.random()*arr.length)|0]; }

function makeHost(){
  const h=document.createElement('div');
  h.id='spawnHost';
  Object.assign(h.style,{
    position:'absolute',
    inset:0,
    pointerEvents:'none',
    zIndex:650
  });
  document.body.appendChild(h);
  return h;
}
