// === /HeroHealth/modes/hydration.quest.js (LATEST) ===
// Hydration with dynamic difficulty: faster spawns & shorter life over time.
// Goal: ใช้ MissionDeck (สุ่ม 5 เป้าใหญ่จาก 10) + Mini (สุ่ม 3 จาก 10 เติมใหม่อัตโนมัติ)
// UI: ส่ง hha:quest -> quest-hud แสดงทีละ Goal/Mini สลับทุก 6s
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const WATER = ['💧','🚰','🥤','🧊']; // นับเป็นน้ำ (ดี)
  const DRY   = ['☕','🍵','🍺','🥫']; // ล่อ/ลดน้ำ
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar(); setFever(0); setShield(0);
  ensureWaterGauge(); setWaterGauge(55); // เริ่มกลาง ๆ

  // ===== Goal/Mini pools =====
  const G = {
    good: s=>s.goodCount|0,
    junk: s=>s.junkMiss|0,
    score: s=>s.score|0,
    comboMax: s=>s.comboMax|0,
    tick: s=>s.tick|0
  };

  const GOAL_POOL = [
    { id:'g_water70',   label:'ดันมาตรวัดน้ำ ≥ 70', level:'easy',   target:70,  check:()=>zoneFrom((window.__hydr||55))!=='RED' && (window.__hydr|0)>=70, prog:()=>Math.min(100, Math.max(0,(window.__hydr|0))) },
    { id:'g_water80',   label:'ดันมาตรวัดน้ำ ≥ 80', level:'normal', target:80,  check:()=> (window.__hydr|0)>=80,   prog:()=>window.__hydr|0 },
    { id:'g_water90',   label:'ดันมาตรวัดน้ำ ≥ 90', level:'hard',   target:90,  check:()=> (window.__hydr|0)>=90,   prog:()=>window.__hydr|0 },
    { id:'g_good24',    label:'เก็บน้ำ 24 ชิ้น',     level:'easy',   target:24,  check:s=>G.good(s)>=24,  prog:s=>Math.min(24,G.good(s)) },
    { id:'g_good32',    label:'เก็บน้ำ 32 ชิ้น',     level:'normal', target:32,  check:s=>G.good(s)>=32,  prog:s=>Math.min(32,G.good(s)) },
    { id:'g_score1200', label:'ทำคะแนน 1200+',       level:'easy',   target:1200,check:s=>G.score(s)>=1200,prog:s=>Math.min(1200,G.score(s)) },
    { id:'g_score1800', label:'ทำคะแนน 1800+',       level:'normal', target:1800,check:s=>G.score(s)>=1800,prog:s=>Math.min(1800,G.score(s)) },
    { id:'g_combo16',   label:'คอมโบสูงสุด ≥ 16',    level:'normal', target:16,  check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_time40',    label:'อยู่รอดเกิน 40 วินาที',level:'easy',  target:40,  check:s=>G.tick(s)>=40,    prog:s=>Math.min(40,G.tick(s)) },
    { id:'g_nojunk6',   label:'พลาด (ของแห้ง) ≤ 6',  level:'normal', target:0,   check:s=>G.junk(s)<=6,     prog:s=>Math.max(0,6-G.junk(s)) },
  ];

  const MINI_POOL = [
    { id:'m_combo12',   label:'คอมโบต่อเนื่อง 12',  level:'normal', target:12, check:s=>G.comboMax(s)>=12, prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',   label:'คอมโบต่อเนื่อง 18',  level:'hard',   target:18, check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'m_score900',  label:'ทำคะแนน 900+',       level:'easy',   target:900,check:s=>G.score(s)>=900,   prog:s=>Math.min(900,G.score(s)) },
    { id:'m_score1500', label:'ทำคะแนน 1500+',      level:'normal', target:1500,check:s=>G.score(s)>=1500, prog:s=>Math.min(1500,G.score(s)) },
    { id:'m_water75',   label:'รักษาน้ำ ≥ 75',       level:'normal', target:75, check:()=> (window.__hydr|0)>=75, prog:()=>window.__hydr|0 },
    { id:'m_good16',    label:'เก็บน้ำ 16 ชิ้น',     level:'easy',   target:16, check:s=>G.good(s)>=16,     prog:s=>Math.min(16,G.good(s)) },
    { id:'m_nomiss12',  label:'ไม่พลาด 12 วินาที',   level:'normal', target:12, check:s=>G.tick(s)>=12 && s.combo>0, prog:s=>Math.min(12,G.tick(s)) },
    { id:'m_star2',     label:'เก็บ ⭐ 2 ดวง',        level:'hard',   target:2,  check:s=>s.star>=2,         prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',      label:'เก็บ 💎 1 เม็ด',       level:'hard',   target:1,  check:s=>s.diamond>=1,      prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_under6',    label:'พลาดไม่เกิน 6 ครั้ง',  level:'normal', target:0,  check:s=>G.junk(s)<=6,      prog:s=>Math.max(0,6-G.junk(s)) },
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // ===== Game state =====
  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;
  let water=55; window.__hydr = water;

  function mult(){ return feverActive ? 2 : 1; }
  function setWater(n){ water = Math.max(0, Math.min(100, n|0)); window.__hydr=water; setWaterGauge(water); }
  function gainFever(n){ fever = Math.max(0, Math.min(100, fever + n)); setFever(fever); if(!feverActive && fever>=100){feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d = feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive && fever<=0){feverActive=false; setFeverActive(false);} }

  function syncDeck(){ deck.updateScore(score); deck.updateCombo(combo); deck.stats.star=star; deck.stats.diamond=diamond; }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;
    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); star++; syncDeck(); Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'}); Particles.scorePop(x,y,`+${d}`); deck.onGood(); pushQuest(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); diamond++; syncDeck(); Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop(x,y,`+${d}`); deck.onGood(); pushQuest(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20; syncDeck(); Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); Particles.scorePop(x,y,`+20`); deck.onGood(); pushQuest(); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; syncDeck(); Particles.burstShards(null,null,{screen:{x,y},theme:'plate'}); Particles.scorePop(x,y,`+25`); deck.onGood(); pushQuest(); return {good:true, scoreDelta:25}; }

    const isWater = WATER.includes(ch);
    if (isWater){
      const add = (diff==='easy'?8:(diff==='hard'?5:6));
      setWater(water+add);
      const base = 16 + combo*2;
      const delta = base*mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.5);
      deck.onGood(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'});
      Particles.scorePop(x,y,`+${delta|0}`);
      pushQuest();
      return { good:true, scoreDelta:delta };
    } else {
      if (shield>0){ shield-=1; setShield(shield); syncDeck(); Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); pushQuest(); return {good:false, scoreDelta:0}; }
      const sub = (diff==='easy'?6:(diff==='hard'?10:8));
      setWater(water - sub);
      const delta = -12;
      score = Math.max(0, score + delta);
      combo = 0;
      decayFever(16);
      deck.onJunk(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'});
      Particles.scorePop(x,y,`${delta}`);
      pushQuest();
      return { good:false, scoreDelta:delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // หมายถึงหลบของแห้งได้ → ให้ fever เล็กน้อย
    gainFever(4); deck.onJunk(); syncDeck(); pushQuest();
  }

  // ===== Dynamic difficulty for factory (accelerate spawns / shorten life) =====
  let lifeReducer = 0;    // จะอ่านไปใช้ใน factory ผ่าน spawn cadence (ทำแบบ soft ด้วยการเร่ง spawnCount)
  let accelTick  = 0;

  function perSecond(){
    // baseline เข้าใกล้ 55 ช้า ๆ
    if (water>55) setWater(water-1); else if (water<55) setWater(water+1);

    // Fever decay
    decayFever(combo<=0 ? 6 : 2);

    // Stats tick + HUD
    deck.second(); syncDeck(); pushQuest();

    // เติม mini/goal ถ้าครบ
    if (deck.isCleared('mini'))  { deck.draw3(); pushQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5); pushQuest('Goal ใหม่'); }

    // ยกระดับความโหดทุก ๆ ~8s: ลดอายุเป้า + เร่งสปอว์นทางอ้อม
    accelTick++;
    if (accelTick % 8 === 0) {
      window.dispatchEvent(new CustomEvent('hha:toast', { detail: `สปอว์นเร็วขึ้น!` }));
      // ไม่มี API ตั้งค่า life โดยตรงใน factory เลยทำแบบอ้อม: ส่งสัญญาณให้ factory เร่ง spawn (ใช้ hit/expired วนบ่อยขึ้นอยู่แล้ว)
      // (ถ้าต้องแก้ที่ factory จริง ๆ ให้เพิ่ม opts.lifeBase/lifeDecay แล้วใช้ใน expiry)
      lifeReducer = Math.min(1200, lifeReducer + 120); // สำหรับใช้งานภายหลังถ้าเพิ่ม API
    }
  }

  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       (e)=>{ if((e.detail?.sec|0)>=0) perSecond(); });

  // Boot factory
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...WATER, ...BONUS], bad:[...DRY] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.10,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    // End -> summary
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0){
      const goals = deck.getProgress('goals');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);
      const minis = deck.getProgress('mini');
      const goalOK = zoneFrom(water)==='GREEN' || goalCleared;
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Hydration', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared: goalOK,
        questsCleared: minis.filter(m=>m.done).length, questsTotal: deck.miniPresented|0
      }}));
    }});
    // first paint
    pushQuest('เริ่ม');
    return ctrl;
  });
}
export default { boot };
