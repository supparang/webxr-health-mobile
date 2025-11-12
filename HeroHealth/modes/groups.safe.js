import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const GROUPS = ['🥩','🥚','🐟','🥛','🧀','🥦','🥕','🍅','🍇','🍌','🍚','🍞','🥜','🌽','🍠'];
  const LURE   = ['🥤','🧋','🍰','🍩','🍫','🍔','🍟','🌭'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar(); setFever(0); setShield(0);

  // Deck: goal = “โฟกัสหมู่ที่ถูกต้องตามจำนวนชนิดที่กำหนด”
  const G = { score:s=>s.score|0, comboMax:s=>s.comboMax|0, good:s=>s.goodCount|0, junk:s=>s.junkMiss|0 };
  const MINI_POOL = [
    { id:'m_combo12', label:'คอมโบ 12',     target:12,  check:s=>G.comboMax(s)>=12,  prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_score900',label:'คะแนน 900+',    target:900, check:s=>G.score(s)>=900,    prog:s=>Math.min(900,G.score(s)) },
    { id:'m_under6',  label:'พลาด ≤ 6',      target:6,   check:s=>G.junk(s)<=6,       prog:s=>Math.max(0,6-G.junk(s)) },
    { id:'m_good20',  label:'เก็บถูก 20',     target:20,  check:s=>G.good(s)>=20,      prog:s=>Math.min(20,G.good(s)) },
    { id:'m_combo18', label:'คอมโบ 18',     target:18,  check:s=>G.comboMax(s)>=18,  prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'m_score1400',label:'คะแนน 1400+',  target:1400,check:s=>G.score(s)>=1400,   prog:s=>Math.min(1400,G.score(s)) },
    { id:'m_good28',  label:'เก็บถูก 28',     target:28,  check:s=>G.good(s)>=28,      prog:s=>Math.min(28,G.good(s)) },
    { id:'m_nomiss15',label:'ไม่พลาด 15 วิ',  target:15,  check:s=>s.tick>=15 && s.combo>0, prog:s=>Math.min(15,s.tick) },
    { id:'m_star2',   label:'⭐ จำนวน 2',      target:2,   check:s=>s.star>=2,          prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',    label:'💎 จำนวน 1',      target:1,   check:s=>s.diamond>=1,       prog:s=>Math.min(1,s.diamond|0) },
  ];

  // ความยากแบบ “โฟกัสกี่หมู่ต่อรอบ”
  const baseFocus = (diff==='easy'?1:(diff==='hard'?3:2));
  let focusKinds  = baseFocus; // จะเพิ่มอัตโนมัติเมื่อเล่นดี

  // สุ่มชุดหมู่ที่ “ให้คลิกได้”
  let focusSet = [];
  const rollFocus = ()=>{
    const pool = [...GROUPS];
    focusSet = [];
    for(let i=0;i<focusKinds && pool.length;i++){
      const k = (Math.random()*pool.length)|0;
      focusSet.push(pool.splice(k,1)[0]);
    }
  };
  rollFocus();

  const deck = new MissionDeck({ miniPool: MINI_POOL });
  deck.draw3();

  // ส่งขึ้น HUD (goal = อธิบายกี่หมู่ที่ต้องโฟกัส)
  const pushQuest = (hint)=>{
    const minis = deck.getProgress('mini');
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    const goal = {
      id:'g_focus',
      label:`เลือกให้ถูกเฉพาะ ${focusKinds} หมู่: ${focusSet.join(' ')}`,
      target: 10, // นับ “ถูก” สะสมรอบปัจจุบันให้ถึง 10
      prog:   goodStreak | 0
    };
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal, mini:focusMini}}));
    window.dispatchEvent(new CustomEvent('quest:update',{detail:{goal, mini:focusMini}}));
  };

  // สถานะ
  let score=0, combo=0, shield=0, fever=0, feverActive=false, star=0, diamond=0;
  let goodStreak = 0; // นับจำนวนครั้งที่ “เลือกถูกหมู่” ในรอบนี้

  const mult = ()=> feverActive?2:1;
  const gainFever=(n)=>{ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true; setFeverActive(true);} };
  const decayFever=(base)=>{ const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false; setFeverActive(false);} };
  const sync=()=>{ deck.updateScore(score); deck.updateCombo(combo); deck.stats.star=star; deck.stats.diamond=diamond; };

  function toastUp(msg){
    // ให้ HUD ของอาจารย์เติม popup จริงภายหลัง ตอนนี้ยิง event ไว้ก่อน
    window.dispatchEvent(new CustomEvent('hha:toast',{detail:{text:msg}}));
  }

  function onLevelUp(){
    focusKinds = Math.min(3, focusKinds+1);
    rollFocus();
    goodStreak = 0;
    toastUp(`โฟกัสเพิ่มเป็น ${focusKinds} หมู่!`);
  }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); star++; deck.onGood(); sync(); Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});   Particles.scorePop(x,y,d); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); diamond++; deck.onGood(); sync(); Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});   Particles.scorePop(x,y,d); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ const d=20; shield=Math.min(3,shield+1); setShield(shield); score+=d; deck.onGood(); sync(); Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'}); Particles.scorePop(x,y,d); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===FIRE){ const d=25; feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=d; deck.onGood(); sync(); Particles.burstShards(null,null,{screen:{x,y},theme:'plate'});     Particles.scorePop(x,y,d); pushQuest(); return {good:true,scoreDelta:d}; }

    const isFocus = focusSet.includes(ch);
    if (isFocus){
      const d = (18 + combo*2) * mult();
      score += d; combo += 1; gainFever(7 + combo*0.55);
      deck.onGood(); sync(); Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop(x,y,d);
      goodStreak += 1;
      if (goodStreak>=10) onLevelUp(); // เมื่อสะสมถูกครบ 10 ครั้ง → เพิ่มจำนวนหมู่ที่ต้องโฟกัส
      pushQuest();
      return { good:true, scoreDelta: d };
    }else{
      if (shield>0){ shield-=1; setShield(shield); sync(); Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop(x,y,0); pushQuest(); return {good:false,scoreDelta:0}; }
      const d = -14; score = Math.max(0, score + d); combo = 0; decayFever(18);
      deck.onJunk(); sync(); Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); Particles.scorePop(x,y,d);
      goodStreak = Math.max(0, goodStreak-2); // พลาดลดความคืบหน้าเล็กน้อย
      pushQuest();
      return { good:false, scoreDelta: d };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    gainFever(4); deck.onJunk(); sync(); pushQuest();
  }

  function onSec(){
    decayFever(combo<=0?6:2);
    deck.second(); sync();
    // เคลียร์ mini แล้วจั่วใหม่
    if (deck.isCleared('mini')){ deck.draw3(); toastUp('Mini ใหม่!'); }
    pushQuest();
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time',    (e)=>{ if((e.detail?.sec|0)>=0) onSec(); });

  return factoryBoot({
    difficulty: diff, duration: dur,
    pools:{ good:[...GROUPS, ...BONUS], bad:[...LURE] },
    goodRate:0.60, powerups:BONUS, powerRate:0.08, powerEvery:7,
    judge:(ch,ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    // ส่งสรุปเมื่อหมดเวลา
    window.addEventListener('hha:time',(e)=>{ if((e.detail?.sec|0)<=0){
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Food Groups', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared:(focusKinds>=3) // ถือว่าถึงเป้าหมายถ้าขยับถึง 3 หมู่
      }}));
    }});
    pushQuest('เริ่ม');
    return ctrl;
  });
}
export default { boot };
