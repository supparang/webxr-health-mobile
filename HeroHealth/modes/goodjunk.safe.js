// === /HeroHealth/modes/goodjunk.safe.js (2025-11-12) ===
// โหมด Good vs Junk + Goal 5/สุ่มจาก 10 + Mini 3/สุ่มจาก 10 (เติมใหม่อัตโนมัติ)

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // พูลอีโมจิ
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // HUD เริ่มต้น
  ensureFeverBar(); setFever(0); setShield(0);

  // ---------- GOAL และ MINI QUEST ----------
  // helper นับจากสถิติด้านล่าง (deck.stats)
  const G = {
    good: s=>s.goodCount|0,
    junk: s=>s.junkMiss|0,
    score: s=>s.score|0,
    comboMax: s=>s.comboMax|0,
    tick: s=>s.tick|0
  };

  // 10 เป้าหมายหลัก (สุ่มมา 5)
  const GOAL_POOL = [
    { id:'g_good20', label:'เก็บของดีให้ได้ 20 ชิ้น', level:'easy',   target:20, check:s=>G.good(s)>=20, prog:s=>Math.min(20,G.good(s)) },
    { id:'g_good28', label:'เก็บของดีให้ได้ 28 ชิ้น', level:'normal', target:28, check:s=>G.good(s)>=28, prog:s=>Math.min(28,G.good(s)) },
    { id:'g_good34', label:'เก็บของดีให้ได้ 34 ชิ้น', level:'hard',   target:34, check:s=>G.good(s)>=34, prog:s=>Math.min(34,G.good(s)) },
    { id:'g_score800',label:'ทำคะแนนรวม 800+',        level:'easy',   target:800,check:s=>G.score(s)>=800,prog:s=>Math.min(800,G.score(s)) },
    { id:'g_score1500',label:'ทำคะแนนรวม 1500+',      level:'normal', target:1500,check:s=>G.score(s)>=1500,prog:s=>Math.min(1500,G.score(s)) },
    { id:'g_score2200',label:'ทำคะแนนรวม 2200+',      level:'hard',   target:2200,check:s=>G.score(s)>=2200,prog:s=>Math.min(2200,G.score(s)) },
    { id:'g_combo16', label:'คอมโบสูงสุด ≥ 16',       level:'normal', target:16,  check:s=>G.comboMax(s)>=16, prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_combo24', label:'คอมโบสูงสุด ≥ 24',       level:'hard',   target:24,  check:s=>G.comboMax(s)>=24, prog:s=>Math.min(24,G.comboMax(s)) },
    { id:'g_time30',  label:'อยู่รอดเกิน 30 วินาที',  level:'easy',   target:30,  check:s=>G.tick(s)>=30,     prog:s=>Math.min(30,G.tick(s)) },
    { id:'g_nojunk6', label:'พลาด (โดนของเสีย) ≤ 6',  level:'normal', target:0,   check:s=>G.junk(s)<=6,      prog:s=>Math.max(0,6-G.junk(s)) }
  ];

  // 10 mini (สุ่ม 3)
  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',      level:'normal', target:12,  check:s=>G.comboMax(s)>=12, prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',  label:'คอมโบต่อเนื่อง 18',      level:'hard',   target:18,  check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'m_score600', label:'ทำคะแนนรวม 600+',        level:'easy',   target:600, check:s=>G.score(s)>=600,   prog:s=>Math.min(600,G.score(s)) },
    { id:'m_score1200',label:'ทำคะแนนรวม 1200+',       level:'normal', target:1200,check:s=>G.score(s)>=1200,  prog:s=>Math.min(1200,G.score(s)) },
    { id:'m_good10',   label:'เก็บของดี 10 ชิ้น',       level:'easy',   target:10,  check:s=>G.good(s)>=10,     prog:s=>Math.min(10,G.good(s)) },
    { id:'m_good18',   label:'เก็บของดี 18 ชิ้น',       level:'normal', target:18,  check:s=>G.good(s)>=18,     prog:s=>Math.min(18,G.good(s)) },
    { id:'m_nomiss12', label:'ไม่พลาด 12 วินาที',        level:'normal', target:12,  check:s=>G.tick(s)>=12 && s.combo>0, prog:s=>Math.min(12,G.tick(s)) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',            level:'hard',   target:2,   check:s=>s.star>=2,         prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',           level:'hard',   target:1,   check:s=>s.diamond>=1,      prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_under6',   label:'พลาดไม่เกิน 6 ครั้ง',      level:'normal', target:0,   check:s=>G.junk(s)<=6,      prog:s=>Math.max(0,6-G.junk(s)) },
  ];

  // เด็ค
  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  // ส่งไป HUD (โฟกัสทีละอัน: เอาตัวแรกที่ยังไม่เสร็จ)
  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // สถานะหลัก
  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever>=100){ feverActive=true; setFeverActive(true); }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d); setFever(fever);
    if (feverActive && fever<=0){ feverActive=false; setFeverActive(false); }
  }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); star++;
      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); diamond++;
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20;
      Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'}); deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25;
      Particles.burstShards(null,null,{screen:{x,y},theme:'plate'}); deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:25}; }

    const isGood = GOOD.includes(ch);
    if (isGood){
      const base  = 16 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.5);
      deck.onGood(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
      pushQuest();
      return { good:true, scoreDelta: delta };
    } else {
      if (shield>0){ shield-=1; setShield(shield);
        Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); syncDeck(); pushQuest(); return {good:false,scoreDelta:0}; }
      const delta = -12;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(16);
      deck.onJunk(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});
      pushQuest();
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // เลี่ยงของเสียได้ → นับเป็น junk-avoid
    gainFever(4); deck.onJunk(); // onJunk จะ reset combo; เอาไว้เป็นปัจจัยความยาก
    syncDeck(); pushQuest();
  }

  // ต่อวินาที
  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck(); pushQuest();

    // เติมเควสต์/เป้าหมายอัตโนมัติหากเคลียร์หมด
    if (deck.isCleared('mini'))  { deck.draw3(); pushQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5); pushQuest('Goal ใหม่'); }
  }

  window.addEventListener('hha:hit-screen', ()=>{/* pushQuest เรียกใน judge แล้ว */});
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       (e)=>{ if((e.detail?.sec|0)>=0) onSec(); });

  // เริ่มโรงงาน
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.10,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    // จบเกม ส่งสรุป
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0){
      const goals = deck.getProgress('goals');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);
      const minis = deck.getProgress('mini');
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Good vs Junk', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur,
        goalCleared,
        questsCleared: minis.filter(m=>m.done).length, questsTotal: (deck.currentMini||[]).length
      }}));
    }});
    // kick first paint
    pushQuest('เริ่ม');
    return ctrl;
  });
}

export default { boot };
