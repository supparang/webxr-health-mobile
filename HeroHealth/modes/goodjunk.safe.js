// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 MISS≤6 FIX) ===
// โหมด Good vs Junk + Goal/Mini + Fever + Coach + scorePop

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- EMOJI POOLS ----------
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // HUD เริ่มต้น
  ensureFeverBar();
  setFever(0);
  setShield(0);

  // ---------- GOAL & MINI QUEST ----------
  const G = {
    good: s=>s.goodCount|0,
    junk: s=>s.junkMiss|0,
    score: s=>s.score|0,
    comboMax: s=>s.comboMax|0,
    tick: s=>s.tick|0
  };

  const GOAL_POOL = [
    { id:'g_good20',  label:'เก็บของดีให้ได้ 20 ชิ้น',  level:'easy',   target:20,   check:s=>G.good(s)>=20,  prog:s=>Math.min(20,G.good(s)) },
    { id:'g_good28',  label:'เก็บของดีให้ได้ 28 ชิ้น',  level:'normal', target:28,   check:s=>G.good(s)>=28,  prog:s=>Math.min(28,G.good(s)) },
    { id:'g_good34',  label:'เก็บของดีให้ได้ 34 ชิ้น',  level:'hard',   target:34,   check:s=>G.good(s)>=34,  prog:s=>Math.min(34,G.good(s)) },
    { id:'g_score800', label:'ทำคะแนนรวม 800+',          level:'easy',   target:800,  check:s=>G.score(s)>=800,  prog:s=>Math.min(800,G.score(s)) },
    { id:'g_score1500',label:'ทำคะแนนรวม 1500+',         level:'normal', target:1500, check:s=>G.score(s)>=1500, prog:s=>Math.min(1500,G.score(s)) },
    { id:'g_score2200',label:'ทำคะแนนรวม 2200+',         level:'hard',   target:2200, check:s=>G.score(s)>=2200, prog:s=>Math.min(2200,G.score(s)) },
    { id:'g_combo16', label:'คอมโบสูงสุด ≥ 16',         level:'normal', target:16,   check:s=>G.comboMax(s)>=16,prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_combo24', label:'คอมโบสูงสุด ≥ 24',         level:'hard',   target:24,   check:s=>G.comboMax(s)>=24,prog:s=>Math.min(24,G.comboMax(s)) },
    { id:'g_time30',  label:'อยู่รอดเกิน 30 วินาที',     level:'easy',   target:30,   check:s=>G.tick(s)>=30,   prog:s=>Math.min(30,G.tick(s)) },
    // พลาดไม่เกิน 6 ครั้ง → ผ่านถ้า junkMiss <= 6
    { id:'g_nojunk6', label:'พลาดไม่เกิน 6 ครั้ง',       level:'normal',
      target:6,
      check:s=>G.junk(s)<=6,
      prog:s=>Math.min(6,G.junk(s)) }
  ];

  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',      level:'normal', target:12,   check:s=>G.comboMax(s)>=12, prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',  label:'คอมโบต่อเนื่อง 18',      level:'hard',   target:18,   check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'m_score600', label:'ทำคะแนนรวม 600+',        level:'easy',   target:600,  check:s=>G.score(s)>=600,   prog:s=>Math.min(600,G.score(s)) },
    { id:'m_score1200',label:'ทำคะแนนรวม 1200+',       level:'normal', target:1200, check:s=>G.score(s)>=1200,  prog:s=>Math.min(1200,G.score(s)) },
    { id:'m_good10',   label:'เก็บของดี 10 ชิ้น',       level:'easy',   target:10,   check:s=>G.good(s)>=10,     prog:s=>Math.min(10,G.good(s)) },
    { id:'m_good18',   label:'เก็บของดี 18 ชิ้น',       level:'normal', target:18,   check:s=>G.good(s)>=18,     prog:s=>Math.min(18,G.good(s)) },
    // mini: พลาดไม่เกิน 6 ครั้ง (ดูจำนวนที่พลาดจริง)
    { id:'m_under6',   label:'พลาดไม่เกิน 6 ครั้ง',     level:'normal',
      target:6,
      check:s=>G.junk(s)<=6,
      prog:s=>Math.min(6,G.junk(s)) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',            level:'hard',   target:2,    check:s=>(s.star|0)>=2,     prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',           level:'hard',   target:1,    check:s=>(s.diamond|0)>=1,  prog:s=>Math.min(1,s.diamond|0) }
  ];

  // ---------- Mission Deck ----------
  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  // ช่องเก็บพิเศษ
  deck.stats.star    = 0;
  deck.stats.diamond = 0;

  deck.drawGoals(5);
  deck.draw3();

  function emitQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal:focusGoal, mini:focusMini, goalsAll:goals, minisAll:minis, hint }
    }));
  }

  function emitCoach(msg, tone='info'){
    try{
      window.dispatchEvent(new CustomEvent('hha:coach', { detail:{ msg, tone, mode:'goodjunk' } }));
    }catch(_){}
  }

  function emitCombo(combo, comboMax){
    try{
      window.dispatchEvent(new CustomEvent('hha:combo',{detail:{combo,comboMax}}));
    }catch(_){}
  }

  // ---------- Runtime Stats ----------
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;
  let star=0, diamond=0;

  function mult(){ return feverActive ? 2 : 1; }

  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever>=100){
      feverActive=true; setFeverActive(true);
      emitCoach('FEVER! เก็บให้สุดกำลังเลย!','good');
    }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever<=0){
      feverActive=false;
      setFeverActive(false);
      emitCoach('โหมด Fever จบแล้ว ลองเก็บคอมโบใหม่','warn');
    }
  }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
    emitCombo(combo, deck.stats.comboMax);
  }

  // ---------- JUDGE ----------
  function judge(ch, ctx){
    const x = (ctx.cx ?? ctx.clientX ?? ctx.hitX ?? 0);
    const y = (ctx.cy ?? ctx.clientY ?? ctx.hitY ?? 0);

    // Power-ups
    if (ch===STAR){
      const d = 40 * mult();
      score += d; star++;
      gainFever(10);
      syncDeck();
      Particles.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
      Particles.scorePop?.(x,y,d,true);
      emitQuest();
      emitCoach('ได้ ⭐ เพิ่มพลังคะแนน!','good');
      return { good:true, scoreDelta:d };
    }
    if (ch===DIA){
      const d = 80 * mult();
      score += d; diamond++;
      gainFever(30);
      syncDeck();
      Particles.burstShards?.(null,null,{screen:{x,y},theme:'groups'});
      Particles.scorePop?.(x,y,d,true);
      emitQuest();
      emitCoach('ได้ 💎 โบนัสใหญ่!','good');
      return { good:true, scoreDelta:d };
    }
    if (ch===SHIELD){
      // ถือว่าเป็นการ “กันพลาด” แต่ยังนับจำนวนพลาด (miss) เพื่อใช้กับ quest
      deck.stats.junkMiss = (deck.stats.junkMiss|0) + 1;

      shield = Math.min(3, shield+1);
      setShield(shield);
      score += 20;
      syncDeck();
      Particles.burstShards?.(null,null,{screen:{x,y},theme:'hydration'});
      Particles.scorePop?.(x,y,20,true);
      emitQuest();
      emitCoach('ได้เกราะกันพลาด 1 ชั้น (ยังนับเป็นการพลาด 1 ครั้ง)','info');
      return { good:true, scoreDelta:20 };
    }
    if (ch===FIRE){
      feverActive = true;
      fever = Math.max(fever, 60);
      setFeverActive(true);
      setFever(fever);
      score += 25;
      syncDeck();
      Particles.burstShards?.(null,null,{screen:{x,y},theme:'plate'});
      Particles.scorePop?.(x,y,25,true);
      emitQuest();
      emitCoach('ไฟลุกแล้ว! คะแนนคูณสองช่วงนี้','good');
      return { good:true, scoreDelta:25 };
    }

    const isGood = GOOD.includes(ch);

    if (isGood){
      const base  = 16 + combo*2;
      const delta = base * mult();
      score += delta;
      combo += 1;
      deck.onGood();              // นับของดีสำเร็จ
      gainFever(7 + combo*0.5);
      syncDeck();
      Particles.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
      Particles.scorePop?.(x,y,delta,true);
      emitQuest();
      if (combo===4) emitCoach('เริ่มติดมือแล้ว!','good');
      if (combo===8) emitCoach('คอมโบสวย! รักษาจังหวะนี้ไว้','good');
      return { good:true, scoreDelta:delta };
    } else {
      // โดนของเสีย → นับพลาดเสมอ
      if (shield>0){
        shield = Math.max(0, shield-1);
        setShield(shield);
        deck.stats.junkMiss = (deck.stats.junkMiss|0) + 1;  // นับ miss แต่ไม่ลดคะแนนมาก
        syncDeck();
        Particles.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
        Particles.scorePop?.(x,y,0,false);
        emitQuest();
        emitCoach('ใช้เกราะกันพลาดไป 1 ครั้งแล้ว','warn');
        return { good:false, scoreDelta:0 };
      }

      // ไม่มีเกราะ → พลาดเต็ม ๆ
      const delta = -12;
      score = Math.max(0, score + delta);
      combo = 0;
      deck.onJunk();              // เพิ่ม junkMiss + reset comboMax logic
      decayFever(16);
      syncDeck();
      Particles.burstShards?.(null,null,{screen:{x,y},theme:'groups'});
      Particles.scorePop?.(x,y,delta,false);
      emitQuest();
      emitCoach('เผลอเก็บของเสีย คอมโบหลุดแล้ว ลองตั้งหลักใหม่','bad');
      return { good:false, scoreDelta:delta };
    }
  }

  function onExpire(ev){
    // เป้าหายไปไม่ว่าดีหรือเสีย → นับเป็นพลาดหนึ่งครั้ง
    if (!ev) return;
    deck.stats.junkMiss = (deck.stats.junkMiss|0) + 1;
    combo = 0;
    decayFever(4);
    syncDeck();
    emitQuest();
  }

  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second();
    syncDeck();
    emitQuest();

    // เติมเควสต์อัตโนมัติ
    if (deck.isCleared('mini'))  { deck.draw3(); emitQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5); emitQuest('Goal ใหม่'); }
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec>=0) onSec();
  });

  // ---------- Start factory ----------
  const ctrl = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD,...BONUS], bad:[...JUNK] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.10,
    powerEvery: 7,
    judge,
    onExpire
  });

  // จบเกม → ส่งสรุปให้ main.js
  window.addEventListener('hha:time', (e)=>{
    const sec = (e.detail?.sec|0);
    if (sec===0){
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);
      const miniDone = minis.filter(m=>m.done).length;
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'goodjunk',
        difficulty:diff,
        score,
        comboMax:deck.stats.comboMax,
        misses:deck.stats.junkMiss,    // ใช้ค่าเดียวกับ quest
        hits:deck.stats.goodCount,
        duration:dur,
        goalCleared,
        questsCleared:miniDone,
        questsTotal:minis.length || 0
      }}));
    }
  });

  emitQuest('เริ่ม');
  emitCoach('แตะของดี เลี่ยงของเสีย พยายามพลาดไม่เกิน 6 ครั้งต่อเกม','info');
  emitCombo(combo, deck.stats.comboMax);

  return ctrl;
}

export default { boot };