// === /HeroHealth/modes/plate.quest.js (2025-11-13) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // หมวดหลัก
  const CAT = {
    protein : new Set(['🥩','🥚','🐟','🍗','🫘']),
    veggie  : new Set(['🥦','🥕','🥬','🍅','🌽','🍆']),
    fruit   : new Set(['🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐']),
    grain   : new Set(['🍚','🍞','🥖','🌾','🥐']),
    dairy   : new Set(['🥛','🧀']),
  };
  const ALL = ['protein','veggie','fruit','grain','dairy'];

  const GOOD  = [...CAT.protein, ...CAT.veggie, ...CAT.fruit, ...CAT.grain, ...CAT.dairy];
  const LURE  = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);

  // โควตาตามระดับ (ค่าพื้นฐาน)
  const BASE = {
    easy   : { protein:2, veggie:3, fruit:3, grain:2, dairy:1 },  // 11
    normal : { protein:3, veggie:3, fruit:3, grain:3, dairy:2 },  // 14
    hard   : { protein:4, veggie:4, fruit:4, grain:3, dairy:2 },  // 17
  };

  // 10 เป้าหมายหลัก (สุ่มมา 5): ดัดแปลงตัวเลขเล็กน้อย
  const GOAL_POOL = [
    { id:'g_q1',  label:'จัดครบตามโควตา (โปรตีน2 ผัก3 ผลไม้3 ธัญพืช2 นม1)',  level:'easy',   q:{...BASE.easy} },
    { id:'g_q2',  label:'จัดครบตามโควตา (โปรตีน3 ผัก3 ผลไม้3 ธัญพืช3 นม2)',  level:'normal', q:{...BASE.normal} },
    { id:'g_q3',  label:'จัดครบตามโควตา (โปรตีน4 ผัก4 ผลไม้4 ธัญพืช3 นม2)',  level:'hard',   q:{...BASE.hard} },
    { id:'g_q4',  label:'โปรตีน +1, ผัก +1 (จาก normal)', level:'normal', q:{...BASE.normal, protein:4, veggie:4} },
    { id:'g_q5',  label:'ผลไม้ +1, ธัญพืช +1 (จาก normal)', level:'normal', q:{...BASE.normal, fruit:4, grain:4} },
    { id:'g_q6',  label:'โปรตีน +1, ผลไม้ +1 (จาก easy)',   level:'easy',   q:{...BASE.easy, protein:3, fruit:4} },
    { id:'g_q7',  label:'ผัก +1, ธัญพืช +1 (จาก easy)',     level:'easy',   q:{...BASE.easy, veggie:4, grain:3} },
    { id:'g_q8',  label:'ดันนมเป็น 2 (จาก easy)',            level:'easy',   q:{...BASE.easy, dairy:2} },
    { id:'g_q9',  label:'ทุกหมู่ +1 (จาก normal บางหมู่)',   level:'hard',   q:{...BASE.normal, protein:4, fruit:4} },
    { id:'g_q10', label:'โปรตีน5 ผัก4 ผลไม้4 ธัญพืช3 นม2',  level:'hard',   q:{protein:5, veggie:4, fruit:4, grain:3, dairy:2} },
  ];

  // แปลง goal เป็นฟังก์ชันตรวจ
  function mkGoalDef(ent){
    const need = ent.q;
    const targetUnits = Object.values(need).reduce((a,b)=>a+b,0);
    return {
      id: ent.id, label: ent.label, level: ent.level, target: targetUnits,
      check: (s)=>{ // s.cat_* ต้องถูกอัปเดตโดยโหมด
        const sum = Math.min(s.cat_protein|0, need.protein)
                  + Math.min(s.cat_veggie|0 , need.veggie)
                  + Math.min(s.cat_fruit|0  , need.fruit)
                  + Math.min(s.cat_grain|0  , need.grain)
                  + Math.min(s.cat_dairy|0  , need.dairy);
        return sum >= targetUnits;
      },
      prog: (s)=>{
        return Math.min(need.protein, s.cat_protein|0)
             + Math.min(need.veggie , s.cat_veggie|0 )
             + Math.min(need.fruit  , s.cat_fruit|0  )
             + Math.min(need.grain  , s.cat_grain|0  )
             + Math.min(need.dairy  , s.cat_dairy|0  );
      }
    };
  }
  const GOALS = GOAL_POOL.map(mkGoalDef);

  // Mini quest 10 ใบ (สุ่ม 3 / เติมใหม่เมื่อครบ)
  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',      level:'normal', target:12,  check:s=>s.comboMax>=12,  prog:s=>Math.min(12,s.comboMax) },
    { id:'m_score900', label:'ทำคะแนนรวม 900+',        level:'easy',   target:900,  check:s=>s.score>=900,    prog:s=>Math.min(900,s.score) },
    { id:'m_score1500',label:'ทำคะแนนรวม 1500+',       level:'normal', target:1500, check:s=>s.score>=1500,   prog:s=>Math.min(1500,s.score) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',           level:'hard',   target:2,    check:s=>s.star>=2,       prog:s=>Math.min(2,s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',          level:'hard',   target:1,    check:s=>s.diamond>=1,    prog:s=>Math.min(1,s.diamond|0) },
    { id:'m_protein3', label:'เก็บโปรตีน 3 ชิ้น',       level:'easy',   target:3,    check:s=>s.cat_protein>=3,prog:s=>Math.min(3,s.cat_protein|0) },
    { id:'m_veggie4',  label:'เก็บผัก 4 ชิ้น',          level:'normal', target:4,    check:s=>s.cat_veggie>=4, prog:s=>Math.min(4,s.cat_veggie|0) },
    { id:'m_fruit4',   label:'เก็บผลไม้ 4 ชิ้น',       level:'normal', target:4,    check:s=>s.cat_fruit>=4,  prog:s=>Math.min(4,s.cat_fruit|0) },
    { id:'m_grain3',   label:'เก็บธัญพืช 3 ชิ้น',       level:'easy',   target:3,    check:s=>s.cat_grain>=3,  prog:s=>Math.min(3,s.cat_grain|0) },
    { id:'m_dairy2',   label:'เก็บนม/ชีส 2 ชิ้น',       level:'easy',   target:2,    check:s=>s.cat_dairy>=2,  prog:s=>Math.min(2,s.cat_dairy|0) },
  ];

  // Deck
  const deck = new MissionDeck({ goalPool: GOALS, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  // นับหมู่สะสมเพื่อเช็ค goal
  const catCount = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };
  function emojiToCat(emj){
    if (CAT.protein.has(emj)) return 'protein';
    if (CAT.veggie.has(emj))  return 'veggie';
    if (CAT.fruit.has(emj))   return 'fruit';
    if (CAT.grain.has(emj))   return 'grain';
    if (CAT.dairy.has(emj))   return 'dairy';
    return null;
  }

  // HUD bridge (focus ทีละอัน)
  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // สถานะคะแนน/เฟเวอร์/ชิลด์
  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive && fever>=100){feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive && fever<=0){feverActive=false; setFeverActive(false);} }
  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star=star; deck.stats.diamond=diamond;
    deck.stats.cat_protein = catCount.protein;
    deck.stats.cat_veggie  = catCount.veggie;
    deck.stats.cat_fruit   = catCount.fruit;
    deck.stats.cat_grain   = catCount.grain;
    deck.stats.cat_dairy   = catCount.dairy;
  }
  function scoreAt(x,y,delta,good,theme='plate'){ Particles.burstShards(null,null,{screen:{x,y},theme}); try{Particles.scorePop({x,y,delta,good});}catch{} }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;

    // Powerups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); star++; deck.onGood(); syncDeck(); scoreAt(x,y,d,true,'plate'); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); diamond++; deck.onGood(); syncDeck(); scoreAt(x,y,d,true,'groups'); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20; deck.onGood(); syncDeck(); scoreAt(x,y,20,true,'hydration'); pushQuest(); return {good:true,scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; deck.onGood(); syncDeck(); scoreAt(x,y,25,true,'goodjunk'); pushQuest(); return {good:true,scoreDelta:25}; }

    const cat = emojiToCat(ch);
    const isGood = !!cat;
    if (isGood){
      const base=18+combo*2; const delta=base*mult();
      score+=delta; combo+=1; gainFever(7+combo*0.55);
      // นับรายหมู่ (ไม่ล็อกเพดานที่นี่ ให้ไปคุมใน check/prog)
      catCount[cat] = (catCount[cat]||0)+1;

      deck.onGood(); syncDeck(); scoreAt(x,y,delta,true,'plate'); pushQuest();
      return { good:true, scoreDelta:delta };
    }else{
      if (shield>0){ shield-=1; setShield(shield); scoreAt(x,y,0,false,'plate'); syncDeck(); pushQuest(); return {good:false,scoreDelta:0}; }
      const delta=-14; score=Math.max(0,score+delta); combo=0; decayFever(18);
      deck.onJunk(); syncDeck(); scoreAt(x,y,delta,false,'groups'); pushQuest();
      return { good:false, scoreDelta:delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    gainFever(4);
    deck.onJunk(); syncDeck(); pushQuest();
  }

  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck(); pushQuest();
    if (deck.isCleared('mini'))  { deck.draw3();      pushQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5); pushQuest('Goal ใหม่'); }
  }
  window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)>=0) onSec(); });

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...LURE] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.10,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0){
      const goals = deck.getProgress('goals');
      const goalCleared = goals.length>0 && goals.every(g=>g.done);
      const minis = deck.getProgress('mini');
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Balanced Plate', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur,
        goalCleared,
        questsCleared: minis.filter(m=>m.done).length, questsTotal: (deck.currentMini||[]).length
      }}));
    }});
    pushQuest('เริ่ม');
    return ctrl;
  });
}

export default { boot };
