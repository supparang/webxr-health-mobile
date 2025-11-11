// === /HeroHealth/modes/goodjunk.safe.js (2025-11-10) ===
import { boot as domBoot } from '../vr/mode-factory.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { MissionDeck } from '../vr/mission.js';
import { burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

const GOOD=['🥕','🥦','🍎','🍐','🍇','🍓','🌽','🍅','🥬','🫘'];
const JUNK=['🍪','🍩','🍔','🍟','🍕','🍰','🧋','🥤'];
const SCORE_GOOD=25, SCORE_JUNK=-20;

const QUESTS=[
  { id:'good10',   level:'easy',   label:'เก็บของดี 10 ชิ้น',  check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount), target:10 },
  { id:'combo10',  level:'normal', label:'ทำคอมโบ 10',         check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax),   target:10 },
  { id:'score500', level:'hard',   label:'ทำคะแนน 500+',       check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),     target:500 },
  { id:'star3',    level:'normal', label:'เก็บดาว ⭐ 3',        check:s=>s.star>=3,        prog:s=>Math.min(3,s.star),        target:3 },
  { id:'diamond1', level:'hard',   label:'เก็บเพชร 💎 1',       check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
  { id:'nomiss10', level:'normal', label:'ไม่พลาด 10 วิ',       check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
];
const GOAL={ id:'goal25', label:'เก็บของดีให้ได้ 25 ชิ้น', target:25 };

const isGood = ch=>GOOD.includes(ch);
const isJunk = ch=>JUNK.includes(ch);

export async function boot(cfg={}){
  questHUDInit();

  // สถานะรวม
  const stats={ score:0, combo:0, comboMax:0, goodCount:0, missCount:0, noMissTime:0, star:0, diamond:0 };
  let goalProg=0;

  // เด็ค + ตัวช่วยนับเควสต์ที่ผ่าน
  const deck = new MissionDeck({ pool: QUESTS });
  deck.draw3();
  let clearedCountPrev = 0;
  let totalCleared = 0;   // ไว้ใช้ในสรุปผล
  let extraRounds = 0;

  // ช่วยอัปเดตเด็ค (รองรับกรณีไม่มี .tick())
  function deckUpdate(patch={}){
    if (typeof deck.tick === 'function'){ deck.tick(patch); }
    else {
      if (deck.stats){
        if (patch.good) deck.stats.goodCount = (deck.stats.goodCount||0)+1;
        if (patch.junk){ deck.stats.junkMiss = (deck.stats.junkMiss||0)+1; deck.stats.noMissTime = 0; }
        if (Number.isFinite(patch.score)) deck.stats.score = Math.max(deck.stats.score||0, patch.score);
        if (Number.isFinite(patch.combo)) deck.stats.comboMax = Math.max(deck.stats.comboMax||0, patch.combo);
        if (patch.noMissSecInc) deck.stats.noMissTime = (deck.stats.noMissTime||0)+patch.noMissSecInc;
      }
      // ตรวจเลื่อนไปใบถัดไป
      const cur = deck.getCurrent?.();
      if (cur?.check && deck.stats && cur.check(deck.stats)){
        deck.currentIndex = Math.min((deck.deck?.length||1)-1, (deck.currentIndex||0)+1);
      }
    }
  }

  // ดันข้อมูลขึ้น HUD (ทั้ง index และกล่องด้านขวา)
  function pushHUD(text){
    const progArr = deck.getProgress?.() || [];
    const cur = progArr.find(x=>x.current) || deck.getCurrent?.();
    const curProg = progArr.find(x=>x.current) || {};
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text: text?`Mini Quest — ${text}`:undefined,
        goal:{ label:GOAL.label, prog:goalProg, target:GOAL.target },
        mini: cur ? { label:cur.label, prog: curProg.prog||0, target: curProg.target||1 } : undefined
      }
    }));
    questHUDUpdate(deck, cur?.label || '—');
  }

  // ตรวจและอัปเดตจำนวนเควสต์ที่ผ่าน เพื่อไม่ให้ “0/3” อีก
  function tallyQuests(){
    const progArr = deck.getProgress?.() || [];
    const clearedNow = progArr.filter(q=>q.done).length;
    if (clearedNow > clearedCountPrev){
      totalCleared += (clearedNow - clearedCountPrev);
      clearedCountPrev = clearedNow;
    }
  }

  // ต่อวินาที: นับ no-miss, เช็คเคลียร์ครบ 3 ใบแล้วจั่วเพิ่ม
  function onSecond(){
    stats.noMissTime++;
    deckUpdate({ noMissSecInc:1 });
    tallyQuests();

    // เคลียร์ครบ 3 ใบแล้ว และยังมีเวลา → จั่วชุดใหม่ทันที
    const progArr = deck.getProgress?.() || [];
    if (progArr.length && progArr.every(q=>q.done)){
      deck.draw3?.();
      clearedCountPrev = 0;
      extraRounds++;
      pushHUD('เริ่มชุดใหม่!');
    }else{
      pushHUD();
    }
  }
  window.addEventListener('hha:time', onSecond);

  // เอฟเฟกต์ตำแหน่งจอ
  window.addEventListener('hha:hit-screen', (e)=>{
    const {x,y,good,delta} = e.detail||{};
    burstAtScreen(x,y,{ color: good ? '#22c55e' : '#ef4444', count: good?18:12 });
    floatScoreScreen(x,y, (delta>0?`+${delta}`:`${delta}`), good ? '#86efac' : '#fca5a5');
  });

  function judge(ch){
    let good=false, delta=0;
    if (isGood(ch)){
      good=true;
      stats.goodCount++; goalProg=Math.min(GOAL.target, goalProg+1);
      stats.score += SCORE_GOOD; delta=SCORE_GOOD;
      stats.combo = Math.min(9999, stats.combo+1);
      stats.comboMax = Math.max(stats.comboMax, stats.combo);
      deckUpdate({ good:true, score:stats.score, combo:stats.combo });
    }else if (isJunk(ch)){
      good=false;
      stats.missCount++; stats.noMissTime=0;
      stats.score = Math.max(0, stats.score + SCORE_JUNK); delta=SCORE_JUNK;
      stats.combo = 0;
      deckUpdate({ junk:true, score:stats.score, combo:0 });
    }else{
      good=true; delta=10; stats.score+=delta;
      stats.combo=Math.min(9999,stats.combo+1);
      stats.comboMax=Math.max(stats.comboMax,stats.combo);
      deckUpdate({ score:stats.score, combo:stats.combo });
    }
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score:stats.score, combo:stats.combo, delta, good}}));
    tallyQuests();
    pushHUD();
    return { good, scoreDelta:delta };
  }

  // เผื่อใช้ในอนาคตสำหรับ “หลบขยะ”
  function onExpire(ev){ /* no-op for now */ }

  const game = await domBoot({
    host: document.getElementById('spawnHost'),
    difficulty: (cfg.difficulty || 'normal'),
    duration: Number(cfg.duration || 60),
    pools: { good: GOOD, bad: JUNK },
    goodRate: 0.7,
    judge, onExpire
  });

  // เริ่มต้นดัน HUD ครั้งแรก
  pushHUD(deck.getCurrent?.()?.label || '—');

  function finish(){
    window.removeEventListener('hha:time', onSecond);
    questHUDDispose();

    // รวมยอด Mini Quest ที่ผ่านจริง (รวมรอบที่จั่วใหม่)
    tallyQuests();

    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      score: stats.score,
      comboMax: stats.comboMax,
      misses: stats.missCount,
      duration: Number(cfg.duration||60),
      questsTotal: 3*(1+extraRounds),
      questsCleared: totalCleared + (deck.getProgress?.().filter(q=>q.done).length||0),
      goalCleared: goalProg >= GOAL.target
    }}));
  }
  window.addEventListener('hha:dispose-ui', ()=>{ try{game?.stop?.();}catch{} finish(); }, { once:true });
}
export default { boot };
