// === /HeroHealth/modes/goodjunk.safe.js (2025-11-10) ===
// แก้: ยิง hha:quest ให้ index อัปเดต "เป้า" และ "Mini Quest" ด้านล่างเสมอ
//      เพิ่ม compat-shim ถ้า MissionDeck ไม่มี .tick()

import { boot as domBoot } from '../vr/mode-factory.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { MissionDeck } from '../vr/mission.js';

// อิโมจิแต่ละฝั่ง
const GOOD = ['🥕','🥦','🍎','🍐','🍇','🍓','🌽','🍅','🥬','🫘'];
const JUNK = ['🍪','🍩','🍔','🍟','🍕','🍰','🧋','🥤'];

const SCORE_GOOD = 25;
const SCORE_JUNK = -20;

// Mini quest pool สำหรับ goodjunk
const QUESTS = [
  { id:'good10',   level:'easy',   label:'เก็บของดี 10 ชิ้น',  check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount), target:10 },
  { id:'combo10',  level:'normal', label:'ทำคอมโบ 10',         check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax),   target:10 },
  { id:'score500', level:'hard',   label:'ทำคะแนน 500+',       check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),     target:500 },
  { id:'star3',    level:'normal', label:'เก็บดาว ⭐ 3',        check:s=>s.star>=3,        prog:s=>Math.min(3,s.star),        target:3 },
  { id:'diamond1', level:'hard',   label:'เก็บเพชร 💎 1',       check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
  { id:'nomiss10', level:'normal', label:'ไม่พลาด 10 วิ',       check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
];

// เป้าหมายหลักของโหมด
const GOAL = { id:'goal25', label:'เก็บของดีให้ได้ 25 ชิ้น', target:25 };

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const isGood = ch => GOOD.includes(ch);
const isJunk = ch => JUNK.includes(ch);

export async function boot(cfg={}){
  questHUDInit();

  const stats = {
    score:0, combo:0, comboMax:0,
    goodCount:0, missCount:0,
    noMissTime:0, star:0, diamond:0
  };

  let goalProg = 0;
  let extraRounds = 0;

  // สร้างเด็คเควสต์ (3 ใบ)
  const deck = new MissionDeck({ pool: QUESTS });
  deck.draw3();

  // --- compat shim สำหรับ deck.tick ---
  function deckUpdate(patch={}){
    if (typeof deck.tick === 'function'){ deck.tick(patch); return; }
    if (deck.stats){
      if (patch.good) deck.stats.goodCount = (deck.stats.goodCount||0)+1;
      if (patch.junk){ deck.stats.junkMiss = (deck.stats.junkMiss||0)+1; deck.stats.noMissTime = 0; }
      if (Number.isFinite(patch.score)) deck.stats.score = Math.max(deck.stats.score||0, patch.score);
      if (Number.isFinite(patch.combo)) deck.stats.comboMax = Math.max(deck.stats.comboMax||0, patch.combo);
      if (patch.noMissSecInc) deck.stats.noMissTime = (deck.stats.noMissTime||0)+patch.noMissSecInc;
      if (patch.star) deck.stats.star = (deck.stats.star||0)+patch.star;
      if (patch.diamond) deck.stats.diamond = (deck.stats.diamond||0)+patch.diamond;
    }
    try{
      const cur = deck.getCurrent?.();
      if (cur?.check && deck.stats && cur.check(deck.stats)){
        deck.currentIndex = Math.min((deck.deck?.length||1)-1, (deck.currentIndex||0)+1);
      }
    }catch{}
  }
  // -------------------------------------

  // ยิงข้อมูลไปให้ index + อัปเดตแผง HUD ขวา
  function pushHUD(text){
    const cur = deck.getCurrent?.();
    const progArr = deck.getProgress?.() || [];
    const curProg = progArr.find(x=>x.current) || {};
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: {
        text: text ? `Mini Quest — ${text}` : undefined,
        goal: { label: GOAL.label, prog: goalProg, target: GOAL.target },
        mini: cur ? { label: cur.label, prog: curProg.prog||0, target: curProg.target||1 } : undefined
      }
    }));
    questHUDUpdate(deck, cur?.label || '—');
  }

  // ให้รันทุกวินาที: เพิ่มตัวนับ noMissTime และเช็คเควสต์ครบ 3 ใบแล้วจั่วใหม่
  function onSecond(){
    stats.noMissTime++;
    deckUpdate({ noMissSecInc: 1 });

    if (deck.isCleared?.()){
      deck.draw3?.();
      extraRounds++;
      pushHUD('เริ่มชุดใหม่!');
    }else{
      pushHUD();
    }
  }
  window.addEventListener('hha:time', onSecond);

  function judge(ch){
    let good=false, delta=0;
    if (isGood(ch)){
      good=true;
      stats.goodCount++; goalProg = Math.min(GOAL.target, goalProg+1);
      stats.score += SCORE_GOOD; delta = SCORE_GOOD;
      stats.combo = Math.min(9999, stats.combo+1);
      stats.comboMax = Math.max(stats.comboMax, stats.combo);
      deckUpdate({ good:true, score:stats.score, combo:stats.combo });
    }else if (isJunk(ch)){
      good=false;
      stats.missCount++; stats.noMissTime = 0;
      stats.score = Math.max(0, stats.score + SCORE_JUNK); delta = SCORE_JUNK;
      stats.combo = 0;
      deckUpdate({ junk:true, score:stats.score, combo:0 });
    }else{
      // อื่น ๆ ถือว่า good เล็กน้อย
      good=true; delta = 10; stats.score += delta; stats.combo = Math.min(9999, stats.combo+1);
      stats.comboMax = Math.max(stats.comboMax, stats.combo);
      deckUpdate({ score:stats.score, combo:stats.combo });
    }

    // ส่งคะแนนขึ้น HUD กลาง
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail: { score: stats.score, combo: stats.combo, delta, good }
    }));
    pushHUD();
    return { good, scoreDelta: delta };
  }

  // เมื่อเป้าหมายหมดอายุ
  function onExpire(ev){
    // กรณีปล่อยให้ “ขยะ” หลุด → ถือว่าหลีกขยะได้สำเร็จ (ไม่ถือเป็น miss)
    // โหมดนี้ยังไม่ต้องนับพิเศษ เพิ่มได้ในอนาคต
  }

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
    window.dispatchEvent(new CustomEvent('hha:end', { detail: {
      score: stats.score,
      comboMax: stats.comboMax,
      questsTotal: 3*(1+extraRounds),
      questsCleared: (deck.getProgress?.().filter(q=>q.done).length||0) + extraRounds*3,
      goalCleared: goalProg >= GOAL.target
    }}));
  }
  window.addEventListener('hha:dispose-ui', ()=>{ try{game?.stop?.();}catch{} finish(); }, { once:true });
}

export default { boot };
