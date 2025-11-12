// === /HeroHealth/modes/groups.safe.js (2025-11-12 LATEST) ===
// Food Groups + Goal/Mini ผ่าน MissionDeck + HUD โฟกัสทีละอัน + Score pop

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const GROUPS = ['🥩','🥚','🐟','🥛','🧀','🥦','🥕','🍅','🍇','🍌','🍚','🍞','🥜','🌽','🍠'];
  const LURE   = ['🥤','🧋','🍰','🍩','🍫','🍔','🍟','🌭']; // ตัวล่อ
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar(); setFever(0); setShield(0);

  const G = {
    good: s=>s.goodCount|0,
    junk: s=>s.junkMiss|0,
    score: s=>s.score|0,
    comboMax: s=>s.comboMax|0,
    tick: s=>s.tick|0
  };

  const GOAL_POOL = [
    { id:'g_groups24',  label:'เก็บอาหาร 5 หมู่ให้ได้ 24 ชิ้น', level:'easy',   target:24, check:s=>G.good(s)>=24,    prog:s=>Math.min(24,G.good(s)) },
    { id:'g_groups30',  label:'เก็บอาหาร 5 หมู่ให้ได้ 30 ชิ้น', level:'normal', target:30, check:s=>G.good(s)>=30,    prog:s=>Math.min(30,G.good(s)) },
    { id:'g_groups36',  label:'เก็บอาหาร 5 หมู่ให้ได้ 36 ชิ้น', level:'hard',   target:36, check:s=>G.good(s)>=36,    prog:s=>Math.min(36,G.good(s)) },
    { id:'g_score1000', label:'ทำคะแนนรวม 1000+',              level:'easy',   target:1000,check:s=>G.score(s)>=1000, prog:s=>Math.min(1000,G.score(s)) },
    { id:'g_score1800', label:'ทำคะแนนรวม 1800+',              level:'normal', target:1800,check:s=>G.score(s)>=1800, prog:s=>Math.min(1800,G.score(s)) },
    { id:'g_combo18',   label:'คอมโบสูงสุด ≥ 18',             level:'normal', target:18,  check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'g_combo26',   label:'คอมโบสูงสุด ≥ 26',             level:'hard',   target:26,  check:s=>G.comboMax(s)>=26, prog:s=>Math.min(26,G.comboMax(s)) },
    { id:'g_time40',    label:'อยู่รอดเกิน 40 วินาที',        level:'easy',   target:40,  check:s=>G.tick(s)>=40,     prog:s=>Math.min(40,G.tick(s)) },
    { id:'g_under5',    label:'พลาดไม่เกิน 5 ครั้ง',           level:'normal', target:0,   check:s=>G.junk(s)<=5,      prog:s=>Math.max(0,5-G.junk(s)) },
    { id:'g_under3',    label:'พลาดไม่เกิน 3 ครั้ง',           level:'hard',   target:0,   check:s=>G.junk(s)<=3,      prog:s=>Math.max(0,3-G.junk(s)) },
  ];

  const MINI_POOL = [
    { id:'m_combo14',  label:'คอมโบต่อเนื่อง 14',      level:'normal', target:14,  check:s=>G.comboMax(s)>=14, prog:s=>Math.min(14,G.comboMax(s)) },
    { id:'m_combo22',  label:'คอมโบต่อเนื่อง 22',      level:'hard',   target:22,  check:s=>G.comboMax(s)>=22, prog:s=>Math.min(22,G.comboMax(s)) },
    { id:'m_score900', label:'ทำคะแนนรวม 900+',        level:'easy',   target:900, check:s=>G.score(s)>=900,   prog:s=>Math.min(900,G.score(s)) },
    { id:'m_score1500',label:'ทำคะแนนรวม 1500+',       level:'normal', target:1500,check:s=>G.score(s)>=1500,  prog:s=>Math.min(1500,G.score(s)) },
    { id:'m_good15',   label:'เก็บของดี 15 ชิ้น',       level:'easy',   target:15,  check:s=>G.good(s)>=15,     prog:s=>Math.min(15,G.good(s)) },
    { id:'m_good22',   label:'เก็บของดี 22 ชิ้น',       level:'normal', target:22,  check:s=>G.good(s)>=22,     prog:s=>Math.min(22,G.good(s)) },
    { id:'m_nomiss10', label:'ไม่พลาด 10 วินาที',        level:'normal', target:10,  check:s=>G.tick(s)>=10 && s.combo>0, prog:s=>Math.min(10,G.tick(s)) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',            level:'hard',   target:2,   check:s=>s.star>=2,         prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',           level:'hard',   target:1,   check:s=>s.diamond>=1,      prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_under4',   label:'พลาดไม่เกิน 4 ครั้ง',      level:'normal', target:0,   check:s=>G.junk(s)<=4,      prog:s=>Math.max(0,4-G.junk(s)) },
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    const payload = { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint };
    try{ window.dispatchEvent(new CustomEvent('hha:quest',    { detail: payload })); }catch(_){}
    try{ window.dispatchEvent(new CustomEvent('quest:update', { detail: payload })); }catch(_){}
  }

  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;
  const mult = ()=> (feverActive?2:1);
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true;setFeverActive(true);} }
  function decayFever(base){ const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false;setFeverActive(false);} }
  function syncDeck(){ deck.updateScore(score); deck.updateCombo(combo); deck.stats.star=star; deck.stats.diamond=diamond; }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;

    // Power-ups
    if (ch===STAR){ const d=35*mult(); score+=d; gainFever(10); star++;
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop(x,y,'+'+d);
      deck.onGood(); syncDeck(); pushQuest(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=70*mult(); score+=d; gainFever(28); diamond++;
      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); Particles.scorePop(x,y,'+'+d);
      deck.onGood(); syncDeck(); pushQuest(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=18;
      Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'}); Particles.scorePop(x,y,'+18');
      deck.onGood(); syncDeck(); pushQuest(); return {good:true, scoreDelta:18}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=20;
      Particles.burstShards(null,null,{screen:{x,y},theme:'plate'});     Particles.scorePop(x,y,'+20');
      deck.onGood(); syncDeck(); pushQuest(); return {good:true, scoreDelta:20}; }

    const isGood = GROUPS.includes(ch);
    if (isGood){
      const base = 18 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.55);
      deck.onGood(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});    Particles.scorePop(x,y,'+'+delta);
      pushQuest();
      return {good:true, scoreDelta:delta};
    }else{
      if (shield>0){ shield-=1; setShield(shield);
        Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});  Particles.scorePop(x,y,'±0');
        syncDeck(); pushQuest(); return {good:false, scoreDelta:0}; }
      const delta = -14;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});  Particles.scorePop(x,y,String(delta));
      pushQuest();
      return {good:false, scoreDelta:delta};
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    gainFever(4); deck.onJunk(); syncDeck(); pushQuest();
  }
  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck(); pushQuest();
    if (deck.isCleared('mini'))  { deck.draw3();       pushQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5);  pushQuest('Goal ใหม่'); }
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time',    (e)=>{ if((e.detail?.sec|0)>=0) onSec(); });

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GROUPS, ...BONUS], bad:[...LURE] },
    goodRate  : 0.60,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0){
      const goals = deck.getProgress('goals');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);
      const minis = deck.getProgress('mini');
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Food Groups', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared,
        questsCleared: minis.filter(m=>m.done).length,
        questsTotal  : deck.miniPresented
      }}));
    }});
    pushQuest('เริ่ม');
    return ctrl;
  });
}

export default { boot };
