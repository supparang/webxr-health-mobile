// === /HeroHealth/modes/hydration.quest.js (compat fix: no deck.tick) ===
import { boot as domBoot } from '../vr/mode-factory.js';
import {
  ensureWaterGauge, setWaterGauge, destroyWaterGauge,
  floatScoreScreen, burstAtScreen
} from '../vr/ui-water.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { MissionDeck } from '../vr/mission.js';

const GOOD = ['💧','🚰','🥛','🧃','🍋','🍊','🍎'];
const JUNK = ['🧋','🥤','🍺','🍷','🍹'];

const WATER_DELTA = { '💧':+10,'🚰':+12,'🥛':+6,'🧃':+5,'🍋':+4,'🍊':+4,'🍎':+3,
                      '🧋':-10,'🥤':-8,'🍺':-14,'🍷':-12,'🍹':-10 };

const HYDRATION_QUESTS = [
  { id:'bal15',   level:'easy',   label:'รักษา Balanced 15 วิ',  check:s=>s.balancedTime>=15, prog:s=>Math.min(15,s.balancedTime), target:15 },
  { id:'bal25',   level:'normal', label:'รักษา Balanced 25 วิ',  check:s=>s.balancedTime>=25, prog:s=>Math.min(25,s.balancedTime), target:25 },
  { id:'combo10', level:'easy',   label:'ทำคอมโบ 10',           check:s=>s.comboMax>=10,     prog:s=>Math.min(10,s.comboMax),   target:10 },
  { id:'combo15', level:'normal', label:'ทำคอมโบ 15',           check:s=>s.comboMax>=15,     prog:s=>Math.min(15,s.comboMax),   target:15 },
  { id:'score350',level:'normal', label:'ทำคะแนน 350+',         check:s=>s.score>=350,       prog:s=>Math.min(350,s.score),     target:350 },
  { id:'good12',  level:'easy',   label:'เก็บของดี 12 ชิ้น',     check:s=>s.goodCount>=12,    prog:s=>Math.min(12,s.goodCount),  target:12 },
  { id:'avoid8',  level:'easy',   label:'หลีกของขยะ 8 ครั้ง',     check:s=>s.junkAvoid>=8,     prog:s=>Math.min(8,s.junkAvoid),  target:8  },
  { id:'milk3',   level:'normal', label:'ดื่ม 🥛 3 แก้ว',         check:s=>s.milk>=3,          prog:s=>Math.min(3,s.milk),       target:3  },
  { id:'water8',  level:'hard',   label:'ดื่ม 💧/🚰 8 แก้ว',       check:s=>s.waterIcon>=8,     prog:s=>Math.min(8,s.waterIcon),  target:8  },
  { id:'nojunk10',level:'hard',   label:'ไม่โดนขยะ 10 วิ',        check:s=>s.noJunkTime>=10,   prog:s=>Math.min(10,s.noJunkTime), target:10 },
];

const GOAL = { id:'goal25', label:'คงระดับน้ำให้อยู่โซน GREEN รวม 25 วิ', target:25 };

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const isGood = ch => GOOD.includes(ch);
const isJunk = ch => JUNK.includes(ch);

export async function boot(config={}){
  ensureWaterGauge();
  questHUDInit();

  let water = 55;
  let extraRounds = 0;
  let goalProg = 0;

  const stats = { score:0, combo:0, comboMax:0, goodCount:0, junkAvoid:0,
                  milk:0, waterIcon:0, noJunkTime:0, balancedTime:0 };

  const deck = new MissionDeck({ pool: HYDRATION_QUESTS });
  deck.draw3();

  // ---- COMPAT SHIM (ถ้า deck.tick ไม่มี ให้แพตช์เอง) ----
  function deckUpdate(patch={}){
    if (typeof deck.tick === 'function') { deck.tick(patch); return; }
    // sync ตัวเลขเข้า deck.stats
    if (deck.stats) {
      if (patch.good) deck.stats.goodCount = (deck.stats.goodCount||0) + 1;
      if (patch.junk) { deck.stats.junkMiss = (deck.stats.junkMiss||0) + 1; deck.stats.noMissTime = 0; }
      if (Number.isFinite(patch.score)) deck.stats.score = Math.max(deck.stats.score||0, patch.score);
      if (Number.isFinite(patch.combo)) deck.stats.comboMax = Math.max(deck.stats.comboMax||0, patch.combo);
      if (patch.junkAvoidInc) deck.stats.junkAvoid = (deck.stats.junkAvoid||0) + patch.junkAvoidInc;
      if (patch.balancedInc) deck.stats.balancedTime = (deck.stats.balancedTime||0) + patch.balancedInc;
      if (patch.noJunkSecInc) deck.stats.noJunkTime = (deck.stats.noJunkTime||0) + patch.noJunkSecInc;
    }
    // เลื่อนใบถ้าผ่าน
    try{
      const cur = deck.getCurrent?.();
      if (cur?.check && deck.stats && cur.check(deck.stats)) {
        deck.currentIndex = Math.min((deck.deck?.length||1)-1, (deck.currentIndex||0)+1);
      }
    }catch{}
  }
  // -------------------------------------------------------

  function zoneOf(p){ return (p>=40&&p<=70)?'GREEN':(p>70?'HIGH':'LOW'); }

  function updateWater(by){
    water = clamp(water + (by||0), 0, 100);
    setWaterGauge(water);
    if (zoneOf(water)==='GREEN'){ stats.balancedTime++; goalProg = Math.min(GOAL.target, goalProg+1); deckUpdate({ balancedInc:1 }); }
  }

  function pushHUD(miniText){
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text: miniText ? `Mini Quest — ${miniText}` : undefined,
        goal:{ label:GOAL.label, prog:goalProg, target:GOAL.target },
        mini:(()=>{
          const cur=deck.getCurrent?.(); if(!cur) return;
          const p=deck.getProgress?.().find(x=>x.current)||{};
          return { label:cur.label, prog:p.prog||0, target:p.target||1 };
        })()
      }
    }));
    questHUDUpdate(deck, deck.getCurrent?.()?.label || '—');
  }

  function judge(ch){
    let dScore=0, good=false;
    if (isGood(ch)){
      good=true;
      stats.goodCount++; if (ch==='🥛') stats.milk++; if (ch==='💧'||ch==='🚰') stats.waterIcon++;
      stats.noJunkTime++;
      dScore=25; updateWater(WATER_DELTA[ch] ?? +6);
      floatScoreScreen(innerWidth/2, innerHeight-120, '+'+dScore, '#8ef');
      burstAtScreen(innerWidth/2, innerHeight-120, {count:14, color:'#60a5fa'});
      deckUpdate({ good:true, score:stats.score+dScore, combo:stats.combo+1 });
    }else if (isJunk(ch)){
      good=false;
      stats.noJunkTime = 0;
      dScore=-20; updateWater(WATER_DELTA[ch] ?? -8);
      floatScoreScreen(innerWidth/2, innerHeight-120, dScore, '#f66');
      burstAtScreen(innerWidth/2, innerHeight-120, {count:12, color:'#ef4444'});
      deckUpdate({ junk:true, score:stats.score+dScore, combo:0 });
    }else{
      good=true; dScore=10; deckUpdate({ score:stats.score+dScore, combo:stats.combo+1 });
    }

    stats.score = Math.max(0, stats.score + dScore);
    stats.combo = good ? Math.min(9999, stats.combo + 1) : 0;
    stats.comboMax = Math.max(stats.comboMax, stats.combo);

    pushHUD();
    return { good, scoreDelta:dScore };
  }

  function onExpire(ev){
    if (ev && ev.isGood === false) {
      stats.junkAvoid++;
      deckUpdate({ junkAvoidInc:1 });
      pushHUD();
    }
  }

  function onSecond(){
    updateWater(-0.6);
    // ผ่านครบ 3 ใบ → จั่วชุดใหม่ (ทำได้หลายรอบจนหมดเวลา)
    if (deck.isCleared?.()) {
      deck.draw3?.();
      extraRounds++;
      pushHUD('เริ่มชุดใหม่!');
    } else {
      pushHUD();
    }
  }

  window.addEventListener('hha:time', onSecond);

  const game = await domBoot({
    host: document.getElementById('spawnHost'),
    difficulty: (config.difficulty||'normal'),
    duration: Number(config.duration||60),
    pools: { good:GOOD, bad:JUNK },
    goodRate: 0.66,
    judge, onExpire
  });

  pushHUD(deck.getCurrent?.()?.label || '—');

  function finish(){
    window.removeEventListener('hha:time', onSecond);
    questHUDDispose(); destroyWaterGauge();
    const clearedNow = (deck.getProgress?.().filter(q=>q.done).length)||0;
    window.dispatchEvent(new CustomEvent('hha:end',{ detail:{
      score:stats.score, comboMax:stats.comboMax,
      questsTotal: 3*(1+extraRounds),
      questsCleared: clearedNow + extraRounds*3,
      goalCleared: goalProg >= GOAL.target
    }}));
  }

  window.addEventListener('hha:end', ()=>finish(), { once:true });
  window.addEventListener('hha:dispose-ui', ()=>{ try{game?.stop?.();}catch{} finish(); }, { once:true });
}

export default { boot };
