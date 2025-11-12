// === /HeroHealth/modes/groups.safe.js (2025-11-13 ADAPTIVE GOALS 1–3 GROUPS) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

// ---------- emoji pools ----------
const CAT = {
  protein : ['🥩','🥚','🐟','🍗','🫘'],
  veggie  : ['🥦','🥕','🥬','🍅','🌽','🍆'],
  fruit   : ['🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐'],
  grain   : ['🍚','🍞','🥖','🌾','🥐'],
  dairy   : ['🥛','🧀']
};
const ALL_CATS = Object.keys(CAT);
const LURE = ['🥤','🧋','🍰','🍩','🍫','🍔','🍟','🌭']; // ของล่อ/ขยะ

const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

function flat(arrs){ return arrs.reduce((a,b)=>a.concat(b),[]); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function pickN(arr, n){
  const src=[...arr]; const out=[];
  for(let i=0;i<n && src.length;i++){ out.push(src.splice((Math.random()*src.length)|0,1)[0]); }
  return out;
}
function emojiToCat(e){
  for(const k of ALL_CATS){ if (CAT[k].includes(e)) return k; }
  return null;
}

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- HUD base ----------
  ensureFeverBar(); setFever(0); setShield(0);

  // ---------- difficulty caps ----------
  const MAX_GROUPS_BY_DIFF = { easy:2, normal:3, hard:3 };
  const BASE_TARGET_BY_DIFF = { easy:6, normal:8, hard:10 };     // จำนวนชิ้นรวมที่ต้องสะสมต่อ goal
  const ADD_PER_GROUP = { easy:0, normal:1, hard:2 };            // เพิ่ม target เมื่อกลุ่มมากขึ้น

  // ---------- adaptive goal state ----------
  // ถ้าต้องการ “กำหนดเอง” ผ่าน query (?gsel=1/2/3) ให้ส่งมาใน cfg.goalGroups
  const qs = new URLSearchParams(location.search);
  let fixedGroups = Number(qs.get('gsel')||cfg.goalGroups||0)|0;
  let groupsCount = fixedGroups || 1;               // เริ่ม 1 กลุ่ม แล้วค่อยๆ เพิ่ม
  const groupsCap  = Math.max(1, Math.min(MAX_GROUPS_BY_DIFF[diff]||3, 3));

  // ---------- counters ----------
  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;

  const catCount = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };

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

  // ---------- MissionDeck: dynamic goal builder ----------
  function makeOneGoal(groupsN){
    const chosenCats = pickN(ALL_CATS, groupsN);
    const target = (BASE_TARGET_BY_DIFF[diff]||8) + (ADD_PER_GROUP[diff]||0)*Math.max(0, groupsN-1);
    const labelCats = chosenCats.map(k=>{
      return k==='protein'?'โปรตีน':k==='veggie'?'ผัก':k==='fruit'?'ผลไม้':k==='grain'?'ธัญพืช':'นม/ชีส';
    }).join(' + ');
    return {
      id: 'g_groups_'+chosenCats.join('_'),
      level: diff,
      label: `สะสมเฉพาะหมู่: ${labelCats} ให้ครบ ${target} ชิ้น`,
      target,
      check: (s)=> {
        // รวมเฉพาะหมู่ที่เลือก
        const sum = chosenCats.reduce((a,k)=>a + (catCount[k]|0), 0);
        return sum >= target;
      },
      prog: (_s)=>{
        const sum = chosenCats.reduce((a,k)=>a + (catCount[k]|0), 0);
        return Math.min(target, sum);
      },
      _metaCats: chosenCats
    };
  }

  // mini quests (ทั่วไป)
  const MINI_POOL = [
    { id:'m_combo10',  label:'คอมโบต่อเนื่อง 10',      level:'easy',   target:10,  check:s=>s.comboMax>=10,  prog:s=>Math.min(10,s.comboMax) },
    { id:'m_combo16',  label:'คอมโบต่อเนื่อง 16',      level:'normal', target:16,  check:s=>s.comboMax>=16,  prog:s=>Math.min(16,s.comboMax) },
    { id:'m_score900', label:'ทำคะแนนรวม 900+',        level:'easy',   target:900, check:s=>s.score>=900,    prog:s=>Math.min(900,s.score) },
    { id:'m_score1500',label:'ทำคะแนนรวม 1500+',       level:'normal', target:1500,check:s=>s.score>=1500,   prog:s=>Math.min(1500,s.score) },
    { id:'m_good14',   label:'เก็บของดี 14 ชิ้น',       level:'easy',   target:14,  check:s=>s.goodCount>=14, prog:s=>Math.min(14,s.goodCount) },
    { id:'m_nomiss12', label:'ไม่พลาด 12 วินาที',        level:'normal', target:12,  check:s=>s.tick>=12 && s.combo>0, prog:s=>Math.min(12,s.tick) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',            level:'hard',   target:2,   check:s=>s.star>=2,       prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',           level:'hard',   target:1,   check:s=>s.diamond>=1,    prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_under6',   label:'พลาดไม่เกิน 6 ครั้ง',      level:'normal', target:0,   check:s=>s.junkMiss<=6,   prog:s=>Math.max(0,6-s.junkMiss) },
    { id:'m_fever1',   label:'เข้า Fever 1 ครั้ง',       level:'easy',   target:1,   check:(_s)=>feverActive,   prog:(_s)=>feverActive?1:0 }
  ];

  // เด็ค (จะสุ่ม goal ตาม groupsCount ทีละครั้ง)
  const deck = new MissionDeck({ goalPool: [], miniPool: MINI_POOL });
  deck.draw3();
  deck.goals = [ makeOneGoal(groupsCount) ]; // goal ปัจจุบันมี 1 ชิ้นงานเสมอ

  // ---------- HUD bridge ----------
  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // ---------- sync deck stats ----------
  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  // ---------- judge ----------
  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); star++;
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop?.(x,y,`+${d}`);
      deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); diamond++;
      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); Particles.scorePop?.(x,y,`+${d}`);
      deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20;
      Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'}); Particles.scorePop?.(x,y,`+20`);
      deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25;
      Particles.burstShards(null,null,{screen:{x,y},theme:'plate'}); Particles.scorePop?.(x,y,`+25`);
      deck.onGood(); syncDeck(); pushQuest(); return {good:true,scoreDelta:25}; }

    const cat = emojiToCat(ch);
    const isGood = !!cat;

    if (isGood){
      // นับรายหมู่
      catCount[cat] = (catCount[cat]|0) + 1;

      const base  = 16 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.5);

      deck.onGood(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); Particles.scorePop?.(x,y,`+${delta|0}`);
      pushQuest();
      return { good:true, scoreDelta: delta };
    } else {
      if (shield>0){ shield-=1; setShield(shield);
        Particles.burstShards(null,null,{screen:{x,y},theme:'groups'}); pushQuest(); return {good:false,scoreDelta:0}; }
      const delta = -12;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(16);
      deck.onJunk(); syncDeck();
      Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'}); Particles.scorePop?.(x,y,`${delta}`);
      pushQuest();
      return { good:false, scoreDelta: delta };
    }
  }

  // ---------- lifecycle helpers ----------
  function refillIfCleared(){
    // mini ใบใหม่เมื่อครบ 3
    if (deck.isCleared('mini')) { deck.draw3(); }

    // goal: ถ้าผ่านแล้ว และไม่ได้ fix จำนวนกลุ่ม → เพิ่ม groupsCount ทีละขั้นจนถึง cap
    const clearedGoal = deck.isCleared('goals');
    if (clearedGoal){
      if (!fixedGroups){ groupsCount = Math.min(groupsCap, groupsCount + 1); }
      deck.goals = [ makeOneGoal(groupsCount) ];
      // reset นับรายหมู่สำหรับรอบใหม่ (ให้โฟกัสกับ goal ถัดไป)
      ALL_CATS.forEach(k=>{ catCount[k]=0; });
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // เลี่ยงขยะสำเร็จ (เฉพาะหมดอายุ) → เพิ่ม fever เล็กน้อย
    gainFever(4); deck.onJunk(); // onJunk จะ reset combo
    syncDeck(); pushQuest();
  }

  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck();

    refillIfCleared();
    pushQuest();
  }

  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)>=0) onSec(); });

  // ---------- start factory ----------
  const goodPool = flat(Object.values(CAT));

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...goodPool, ...BONUS], bad:[...LURE] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.10,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    // end summary
    window.addEventListener('hha:time',(e)=>{ if((e.detail?.sec|0)<=0){
      const goals = deck.getProgress('goals');
      const minis = deck.getProgress('mini');
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Food Groups', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur,
        goalCleared: goals.length>0 && goals.every(g=>g.done),
        questsCleared: minis.filter(m=>m.done).length,
        questsTotal: minis.length
      }}));
    }});
    // first paint
    pushQuest('เริ่ม');
    return ctrl;
  });
}

export default { boot };
