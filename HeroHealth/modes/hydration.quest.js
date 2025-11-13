// === /HeroHealth/modes/hydration.quest.js (2025-11-13 LATEST) ===
// โหมด Hydration — รักษาน้ำในร่างกายให้อยู่โซน GREEN ให้นานที่สุด
// - ใช้ ui-water.js แสดงเกจน้ำ + เอฟเฟกต์น้ำกระเซ็น
// - MissionDeck สำหรับ Goal / Mini
// - ปรับความโหดอัตโนมัติ (spawn ถี่ขึ้น, leak แรงขึ้น)

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import {
  ensureWaterGauge,
  setWaterGauge,
  burstAtScreen,
  floatScoreScreen,
  zoneFrom
} from '../vr/ui-water.js';
import { ensureFeverBar, setFever, setFeverActive } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  ensureWaterGauge();
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  // ---------- Emoji pools ----------
  const WATER_GOOD = ['💧','🚰','🫗','🥛','🧊','🍵'];
  const WATER_HIGH = ['🥤','🧋','🍹'];       // ดื่มได้แต่อย่ามาก → ขึ้นน้ำเยอะ
  const WATER_LOW  = ['☀️','🔥','🏃'];      // ทำให้เสียน้ำ
  const JUNK       = ['🍔','🍟','🍕','🍩','🍫','🍬'];

  const GOOD_POOL = [...WATER_GOOD, ...WATER_HIGH, ...WATER_LOW];
  const BAD_POOL  = [...JUNK];

  // ---------- MissionDeck ----------
  const G = {
    score   : s => s.score     | 0,
    comboMax: s => s.comboMax  | 0,
    tick    : s => s.tick      | 0,
    green   : s => s.greenSec  | 0,
    low     : s => s.lowSec    | 0,
    high    : s => s.highSec   | 0,
    miss    : s => s.junkMiss  | 0,
    goodHit : s => s.goodCount | 0
  };

  const GOAL_POOL = [
    { id:'g_green25', label:'รักษาโซน GREEN ≥ 25 วิ',
      target:25, level:'easy',
      check:s=>G.green(s)>=25, prog:s=>Math.min(25,G.green(s)) },

    { id:'g_green35', label:'รักษาโซน GREEN ≥ 35 วิ',
      target:35, level:'normal',
      check:s=>G.green(s)>=35, prog:s=>Math.min(35,G.green(s)) },

    { id:'g_green45', label:'รักษาโซน GREEN ≥ 45 วิ',
      target:45, level:'hard',
      check:s=>G.green(s)>=45, prog:s=>Math.min(45,G.green(s)) },

    { id:'g_score1200', label:'ทำคะแนนรวม 1200+',
      target:1200, level:'normal',
      check:s=>G.score(s)>=1200, prog:s=>Math.min(1200,G.score(s)) },

    { id:'g_combo16', label:'คอมโบสูงสุด ≥ 16',
      target:16, level:'hard',
      check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },

    { id:'g_low6', label:'อยู่ในโซน LOW ไม่เกิน 6 วิ',
      target:6, level:'normal',
      check:s=>G.low(s)<=6, prog:s=>Math.min(6,G.low(s)) },

    { id:'g_high8', label:'อยู่ในโซน HIGH ไม่เกิน 8 วิ',
      target:8, level:'normal',
      check:s=>G.high(s)<=8, prog:s=>Math.min(8,G.high(s)) },

    { id:'g_miss8', label:'เลือกผิด / ของเสีย ไม่เกิน 8 ครั้ง',
      target:8, level:'normal',
      check:s=>G.miss(s)<=8, prog:s=>Math.min(8,G.miss(s)) },

    { id:'g_tick50', label:'อยู่รอดครบ 50 วินาที',
      target:50, level:'easy',
      check:s=>G.tick(s)>=50, prog:s=>Math.min(50,G.tick(s)) },

    { id:'g_good25', label:'เลือกน้ำที่ดี 25 ครั้ง',
      target:25, level:'normal',
      check:s=>G.goodHit(s)>=25, prog:s=>Math.min(25,G.goodHit(s)) }
  ];

  const MINI_POOL = [
    { id:'m_green12', label:'รักษาโซน GREEN ต่อเนื่อง 12 วิ',
      target:12, level:'easy',
      check:s=>G.green(s)>=12, prog:s=>Math.min(12,G.green(s)) },

    { id:'m_green20', label:'รักษาโซน GREEN ต่อเนื่อง 20 วิ',
      target:20, level:'normal',
      check:s=>G.green(s)>=20, prog:s=>Math.min(20,G.green(s)) },

    { id:'m_noLow6', label:'ช่วง 6 วิ โดยไม่ตกโซน LOW',
      target:6, level:'normal',
      check:s=>G.low(s)<=0 && G.tick(s)>=6, prog:s=>Math.min(6,G.tick(s)) },

    { id:'m_noHigh6', label:'ช่วง 6 วิ โดยไม่กระโดดไปโซน HIGH',
      target:6, level:'normal',
      check:s=>G.high(s)<=0 && G.tick(s)>=6, prog:s=>Math.min(6,G.tick(s)) },

    { id:'m_good15', label:'เลือกน้ำที่ดี 15 ครั้ง',
      target:15, level:'easy',
      check:s=>G.goodHit(s)>=15, prog:s=>Math.min(15,G.goodHit(s)) },

    { id:'m_miss4', label:'เลือกผิดไม่เกิน 4 ครั้ง',
      target:4, level:'hard',
      check:s=>G.miss(s)<=4, prog:s=>Math.min(4,G.miss(s)) }
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();
  deck.stats.greenSec = 0;
  deck.stats.lowSec   = 0;
  deck.stats.highSec  = 0;

  // ---------- Coach ----------
  function coachSay(key){
    let text = '';
    switch(key){
      case 'start':  text = 'จิบน้ำพอดี ๆ รักษาเกจให้อยู่โซนสีเขียวให้ได้'; break;
      case 'low':    text = 'น้ำเริ่มน้อยแล้ว รีบเก็บ 💧 หรือ 🥛 มาช่วย'; break;
      case 'high':   text = 'น้ำเริ่มเยอะไป ระวัง🥤/🧋 อย่าดื่มหวานเกินไป'; break;
      case 'green':  text = 'ดีมาก! ตอนนี้อยู่โซนสมดุล รักษาไว้ให้ได้นานที่สุด'; break;
      case 'miss':   text = 'เลือกพลาดไปนิด ลองดูสัญลักษณ์ให้ชัดก่อนแตะ'; break;
    }
    if (!text) return;
    try{
      window.dispatchEvent(new CustomEvent('coach:line',{detail:{text,mode:'hydration'}}));
    }catch(_){}
  }

  // ---------- Mode state ----------
  let score = 0;
  let combo = 0;
  let fever = 0;
  let feverActive = false;

  let water = 55; // 0–100
  setWaterGauge(water);

  function mult(){ return feverActive ? 2 : 1; }

  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100){
      feverActive = true;
      setFeverActive(true);
    }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0){
      feverActive = false;
      setFeverActive(false);
    }
  }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }
  function emitCombo(){
    try{ window.dispatchEvent(new CustomEvent('hha:combo',{detail:{combo}})); }catch(_){}
  }

  function pushQuest(){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    window.dispatchEvent(new CustomEvent('quest:update',{
      detail:{
        goal: goals.find(g=>!g.done)||goals[0]||null,
        mini: minis.find(m=>!m.done)||minis[0]||null,
        goalsAll:goals,
        minisAll:minis
      }
    }));
  }

  // ---------- Scoring / judge ----------
  function adjustWater(kind){
    if (WATER_GOOD.includes(kind)) return  +7;
    if (WATER_HIGH.includes(kind)) return  +11;
    if (WATER_LOW.includes(kind))  return  -12;
    if (JUNK.includes(kind))       return   0;
    return 0;
  }

  function judge(emo, ctx){
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    const dW = adjustWater(emo);
    let delta = 0;

    if (dW !== 0){
      water = Math.max(0, Math.min(100, water + dW));
      setWaterGauge(water);

      let base = 12;
      if (diff === 'hard')   base = 14;
      if (diff === 'easy')   base = 10;

      delta = (base + Math.max(0, dW)) * mult();
      score += delta;
      combo++;
      emitCombo();
      gainFever(6 + combo*0.3);

      deck.onGood();
      deck.stats.goodCount++;
      syncDeck();

      const zone = zoneFrom(water);
      if (zone === 'GREEN') coachSay('green');
      else if (zone === 'LOW') coachSay('low');
      else if (zone === 'HIGH') coachSay('high');

      burstAtScreen(x,y,{color:'#38bdf8'});
      floatScoreScreen(x,y,'+'+delta,'#e0f2fe');
      Particles.scorePop?.(x,y,delta,{good:true});

      pushQuest();
      return { good:true, scoreDelta:delta };
    }

    // junk food / clickอื่นๆ = พลาด
    delta = -10;
    if (diff === 'hard')  delta = -14;
    if (diff === 'easy')  delta = -8;

    score = Math.max(0, score + delta);
    combo = 0;
    emitCombo();
    decayFever(10);

    deck.onJunk();
    syncDeck();

    Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
    Particles.scorePop?.(x,y,delta,{good:false});
    coachSay('miss');
    pushQuest();
    return { good:false, scoreDelta:delta };
  }

  function onExpire(ev){
    if (!ev) return;
    // เป้าไหลหายไป → เสียน้ำเล็กน้อย
    water = Math.max(0, water - 5);
    setWaterGauge(water);
    deck.onJunk();
    combo = 0;
    emitCombo();
    decayFever(8);
    syncDeck();
    pushQuest();
  }

  function onSec(){
    // leak ตามระดับ
    let leak = 2.0;
    if (diff === 'easy') leak = 1.4;
    if (diff === 'hard') leak = 2.8;

    water = Math.max(0, water - leak);
    setWaterGauge(water);

    const z = zoneFrom(water);
    if (z === 'GREEN') deck.stats.greenSec++;
    else if (z === 'LOW') deck.stats.lowSec++;
    else if (z === 'HIGH') deck.stats.highSec++;

    if (combo <= 0) decayFever(6); else decayFever(2);

    deck.second();
    syncDeck();

    // ปรับความโหด: ช่วงหลัง ๆ leak แรง + spawn ถี่ขึ้น (ให้ mode-factory ใช้ tick)
    pushQuest();
  }

  window.addEventListener('hha:time',(e)=>{
    const sec = (e.detail?.sec|0);
    if (sec > 0) onSec();
    if (sec === 0){
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      const goalsCleared = goals.filter(g=>g.done).length;
      const goalCleared  = goalsCleared > 0;
      const questsCleared = minis.filter(m=>m.done).length;

      window.dispatchEvent(new CustomEvent('hha:end',{
        detail:{
          mode        : 'Hydration',
          difficulty  : diff,
          score,
          comboMax    : deck.stats.comboMax,
          misses      : deck.stats.junkMiss,
          hits        : deck.stats.goodCount,
          duration    : dur,
          goalCleared,
          goalsCleared,
          goalsTotal  : goals.length,
          questsCleared,
          questsTotal : minis.length
        }
      }));
    }
  });

  // ---------- Factory ----------
  const controller = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:GOOD_POOL, bad:BAD_POOL },
    goodRate  : 0.70,
    judge,
    onExpire
  });

  pushQuest();
  coachSay('start');
  return controller;
}

export default { boot };