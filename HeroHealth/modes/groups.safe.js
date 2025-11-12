// === /HeroHealth/modes/groups.safe.js (2025-11-12 LATEST) ===
// Food Groups + Fever + Power-ups + Goal/Mini (MissionDeck) + Wave refill

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // กลุ่มอาหาร (“ดี”) และตัวล่อ (“เสีย”)
  const GROUPS = ['🥩','🥚','🐟','🥛','🧀','🥦','🥕','🍅','🍇','🍌','🍚','🍞','🥜','🌽','🍠'];
  const LURE   = ['🥤','🧋','🍰','🍩','🍫','🍔','🍟','🌭'];

  // Power-ups
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar(); setFever(0); setShield(0);

  // ---------- Goal/Mini Pools ----------
  const G = {
    good: s=>s.goodCount|0,
    junk: s=>s.junkMiss|0,
    score: s=>s.score|0,
    comboMax: s=>s.comboMax|0,
    tick: s=>s.tick|0
  };

  // 10 เป้าหมายหลัก (โหมด Groups เน้น “เก็บให้ครบตามจำนวน” และ “คะแนน/คอมโบ” ผสม)
  const GOAL_POOL = [
    { id:'g_good18',  label:'เก็บของดี 18 ชิ้น',  level:'easy',   target:18,  check:s=>G.good(s)>=18,  prog:s=>Math.min(18,G.good(s)) },
    { id:'g_good26',  label:'เก็บของดี 26 ชิ้น',  level:'normal', target:26,  check:s=>G.good(s)>=26,  prog:s=>Math.min(26,G.good(s)) },
    { id:'g_good32',  label:'เก็บของดี 32 ชิ้น',  level:'hard',   target:32,  check:s=>G.good(s)>=32,  prog:s=>Math.min(32,G.good(s)) },
    { id:'g_score900',label:'ทำคะแนนรวม 900+',    level:'easy',   target:900, check:s=>G.score(s)>=900,prog:s=>Math.min(900,G.score(s)) },
    { id:'g_score1600',label:'ทำคะแนนรวม 1600+',  level:'normal', target:1600,check:s=>G.score(s)>=1600,prog:s=>Math.min(1600,G.score(s)) },
    { id:'g_score2300',label:'ทำคะแนนรวม 2300+',  level:'hard',   target:2300,check:s=>G.score(s)>=2300,prog:s=>Math.min(2300,G.score(s)) },
    { id:'g_combo14', label:'คอมโบสูงสุด ≥ 14',   level:'normal', target:14,  check:s=>G.comboMax(s)>=14, prog:s=>Math.min(14,G.comboMax(s)) },
    { id:'g_combo22', label:'คอมโบสูงสุด ≥ 22',   level:'hard',   target:22,  check:s=>G.comboMax(s)>=22, prog:s=>Math.min(22,G.comboMax(s)) },
    { id:'g_time30',  label:'อยู่รอดเกิน 30 วินาที', level:'easy', target:30, check:s=>G.tick(s)>=30,     prog:s=>Math.min(30,G.tick(s)) },
    { id:'g_nojunk5', label:'พลาด ≤ 5 ครั้ง',      level:'normal', target:0,   check:s=>G.junk(s)<=5,     prog:s=>Math.max(0,5-G.junk(s)) }
  ];

  // 10 mini quests
  const MINI_POOL = [
    { id:'m_combo10',  label:'คอมโบต่อเนื่อง 10',   level:'easy',   target:10,  check:s=>G.comboMax(s)>=10,  prog:s=>Math.min(10,G.comboMax(s)) },
    { id:'m_combo16',  label:'คอมโบต่อเนื่อง 16',   level:'normal', target:16,  check:s=>G.comboMax(s)>=16,  prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'m_score700', label:'ทำคะแนนรวม 700+',     level:'easy',   target:700, check:s=>G.score(s)>=700,    prog:s=>Math.min(700,G.score(s)) },
    { id:'m_score1300',label:'ทำคะแนนรวม 1300+',    level:'normal', target:1300,check:s=>G.score(s)>=1300,   prog:s=>Math.min(1300,G.score(s)) },
    { id:'m_good14',   label:'เก็บของดี 14 ชิ้น',    level:'easy',   target:14,  check:s=>G.good(s)>=14,      prog:s=>Math.min(14,G.good(s)) },
    { id:'m_good20',   label:'เก็บของดี 20 ชิ้น',    level:'normal', target:20,  check:s=>G.good(s)>=20,      prog:s=>Math.min(20,G.good(s)) },
    { id:'m_nomiss10', label:'ไม่พลาด 10 วินาที',     level:'normal', target:10,  check:s=>G.tick(s)>=10 && s.combo>0, prog:s=>Math.min(10,G.tick(s)) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',          level:'hard',   target:2,   check:s=>s.star>=2,          prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',         level:'hard',   target:1,   check:s=>s.diamond>=1,       prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_under5',   label:'พลาดไม่เกิน 5 ครั้ง',    level:'normal', target:0,   check:s=>G.junk(s)<=5,       prog:s=>Math.max(0,5-G.junk(s)) },
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();
  questHUDInit();

  function focusFromDeck(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    questHUDUpdate({ goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint });
    window.dispatchEvent(new CustomEvent('hha:quest', { detail: { goal: focusGoal, mini: focusMini } }));
  }

  // State
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;
  let star=0, diamond=0;
  let totalMiniCleared=0;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever = Math.max(0, Math.min(100, fever + n)); setFever(fever); if (!feverActive && fever>=100){ feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d = feverActive ? 10 : base; fever=Math.max(0, fever-d); setFever(fever); if(feverActive && fever<=0){ feverActive=false; setFeverActive(false);} }
  function syncDeck(){ deck.updateScore(score); deck.updateCombo(combo); deck.stats.star=star; deck.stats.diamond=diamond; }
  function popScore(x,y,delta,good){ try{ if(Particles?.scorePop){ Particles.scorePop({x,y,delta,good}); } }catch(_){} }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;

    // power-ups
    if (ch===STAR){ const d=35*mult(); score+=d; gainFever(10); star++;
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'groups'}); deck.onGood(); syncDeck(); popScore(x,y,d,true); focusFromDeck(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=70*mult(); score+=d; gainFever(28); diamond++;
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'}); deck.onGood(); syncDeck(); popScore(x,y,d,true); focusFromDeck(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=18;
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'hydration'}); deck.onGood(); syncDeck(); popScore(x,y,18,true); focusFromDeck(); return {good:true,scoreDelta:18}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=20;
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'plate'}); deck.onGood(); syncDeck(); popScore(x,y,20,true); focusFromDeck(); return {good:true,scoreDelta:20}; }

    const isGood = GROUPS.includes(ch);
    if (isGood){
      const base  = 18 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.55);
      deck.onGood(); syncDeck();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'groups'});
      popScore(x,y,delta,true);
      focusFromDeck();
      return { good:true, scoreDelta: delta };
    } else {
      if (shield>0){ shield-=1; setShield(shield);
        Particles?.burstShards?.(null,null,{screen:{x,y},theme:'groups'}); syncDeck(); popScore(x,y,0,false); focusFromDeck(); return {good:false,scoreDelta:0}; }
      const delta = -14;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); syncDeck();
      Particles?.burstShards?.(null,null,{screen:{x,y},theme:'goodjunk'});
      popScore(x,y,delta,false);
      focusFromDeck();
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // หลีกล่อสำเร็จ → ได้เฟเวอร์เล็กน้อย
    gainFever(4); deck.onJunk(); syncDeck(); focusFromDeck();
  }

  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck(); focusFromDeck();

    if (deck.isCleared('mini'))  { totalMiniCleared += 3; deck.draw3();        focusFromDeck('Mini ใหม่'); }
    if (deck.isCleared('goals')) {               deck.drawGoals(5); focusFromDeck('Goal ใหม่'); }
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time',    (e)=>{ const s=e.detail?.sec|0; if(s>=0) onSec(); });

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
      const minisNow  = deck.getProgress('mini');
      const doneNow   = minisNow.filter(m => m.done).length;
      const cleared   = totalMiniCleared + doneNow;
      const totalSeen = deck.miniPresented;

      const goals = deck.getProgress('goals');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);

      questHUDDispose();
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Food Groups', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared,
        questsCleared: cleared, questsTotal: totalSeen
      }}));
    }});
    focusFromDeck('เริ่ม');
    return ctrl;
  });
}

export default { boot };
