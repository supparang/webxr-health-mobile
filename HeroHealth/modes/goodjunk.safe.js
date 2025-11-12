// === /HeroHealth/modes/groups.safe.js (2025-11-12 FULL)
// Food Groups mode (5 หมู่) + Fever/Powerups + MissionDeck Goals & Mini Quests (สุ่ม)
// - Goal pool 10 → สุ่มมา 5 ตามระดับ
// - Mini pool 10 → สุ่มมา 3; ถ้าทำครบก่อนหมดเวลา → สุ่มเติม
// - ส่ง event 'hha:quest' ให้ quest-hud แสดง "ทีละเป้าหมาย" + "ทีละ mini quest"

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

// ---------- หมวด/พูล ----------
const CAT = {
  protein : new Set(['🥩','🥚','🐟','🍗','🫘']),
  veggie  : new Set(['🥦','🥕','🥬','🍅','🌽','🍆']),
  fruit   : new Set(['🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐']),
  grain   : new Set(['🍚','🍞','🥖','🌾','🥐']),
  dairy   : new Set(['🥛','🧀'])
};
const ALL_CATS = ['protein','veggie','fruit','grain','dairy'];
const GROUPS_GOOD = [
  ...CAT.protein, ...CAT.veggie, ...CAT.fruit, ...CAT.grain, ...CAT.dairy
];
const LURE = ['🥤','🧋','🍰','🍩','🍫','🍔','🍟','🌭','🍪','🧁','🍕','🍬'];
const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

// ---------- Goal/Mini Pools ----------
const GOAL_POOL10 = [
  { id:'g_protein', label:'เก็บโปรตีนให้ครบ',     target:{easy:4, normal:5, hard:6},      prog:s=>s.cat_protein||0 },
  { id:'g_veggie',  label:'เก็บผักให้ครบ',         target:{easy:5, normal:6, hard:7},      prog:s=>s.cat_veggie ||0 },
  { id:'g_fruit',   label:'เก็บผลไม้ให้ครบ',       target:{easy:5, normal:6, hard:7},      prog:s=>s.cat_fruit  ||0 },
  { id:'g_grain',   label:'เก็บธัญพืชให้ครบ',       target:{easy:4, normal:5, hard:6},      prog:s=>s.cat_grain  ||0 },
  { id:'g_dairy',   label:'เก็บนม/ชีสให้ครบ',       target:{easy:2, normal:3, hard:4},      prog:s=>s.cat_dairy  ||0 },
  { id:'g_sets',    label:'ทำชุดครบ 5 หมู่',        target:{easy:1, normal:2, hard:3},      prog:s=>s.sets       ||0 },
  { id:'g_combo',   label:'คอมโบสูงสุด',            target:{easy:10,normal:14,hard:18},     prog:s=>s.comboMax   ||0 },
  { id:'g_score',   label:'คะแนนรวม',               target:{easy:800,normal:1200,hard:1600},prog:s=>s.score      ||0 },
  { id:'g_avoid',   label:'เลี่ยงขยะ (หมดอายุ)',     target:{easy:6, normal:8, hard:10},     prog:s=>s.junkAvoid  ||0 },
  { id:'g_fever',   label:'เปิด Fever',             target:{easy:1, normal:2, hard:3},      prog:s=>s.feverCount ||0 },
];

const MINI_POOL10 = [
  { id:'m_combo',    level:'normal', label:'คอมโบต่อเนื่อง',        target:{easy:8, normal:12, hard:16}, prog:s=>s.comboMax||0 },
  { id:'m_nomiss',   level:'normal', label:'ไม่พลาดต่อเนื่อง (วินาที)',target:{easy:10, normal:15, hard:20}, prog:s=>s.noMissTime||0 },
  { id:'m_star',     level:'easy',   label:'เก็บดาว ⭐',            target:{easy:1, normal:2, hard:2},  prog:s=>s.star||0 },
  { id:'m_diamond',  level:'hard',   label:'เก็บเพชร 💎',           target:{easy:1, normal:1, hard:2},  prog:s=>s.diamond||0 },
  { id:'m_shield',   level:'normal', label:'ใช้โล่ 🛡️ ป้องกัน',      target:{easy:1, normal:2, hard:3},  prog:s=>s.shieldBlocks||0 },
  { id:'m_fever',    level:'normal', label:'เติม Fever เต็ม',        target:{easy:1, normal:2, hard:2},  prog:s=>s.feverFull||0 },
  { id:'m_protein',  level:'easy',   label:'เก็บโปรตีน (mini)',     target:{easy:3, normal:4, hard:5},  prog:s=>s.cat_protein||0 },
  { id:'m_veggie',   level:'easy',   label:'เก็บผัก (mini)',        target:{easy:3, normal:4, hard:5},  prog:s=>s.cat_veggie ||0 },
  { id:'m_fruit',    level:'easy',   label:'เก็บผลไม้ (mini)',      target:{easy:3, normal:4, hard:5},  prog:s=>s.cat_fruit  ||0 },
  { id:'m_avoid',    level:'normal', label:'เลี่ยงขยะ (mini)',      target:{easy:4, normal:6, hard:8},  prog:s=>s.junkAvoid||0 },
];

// ---------- Utils ----------
function catOf(emoji){
  if (CAT.protein.has(emoji)) return 'protein';
  if (CAT.veggie .has(emoji)) return 'veggie';
  if (CAT.fruit  .has(emoji)) return 'fruit';
  if (CAT.grain  .has(emoji)) return 'grain';
  if (CAT.dairy  .has(emoji)) return 'dairy';
  return null;
}
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

export async function boot(cfg = {}){
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration||60);

  // HUD base
  ensureFeverBar(); setFever(0); setShield(0);
  questHUDInit();

  // Deck (สุ่ม goal 5 + mini 3)
  const deck = new MissionDeck({ goalPool: GOAL_POOL10, miniPool: MINI_POOL10, difficulty: diff });
  deck.drawGoals(5);
  deck.draw3();
  questHUDUpdate(deck, 'Wave 1');

  // ---------- State ----------
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;
  let star=0, diamond=0;
  let sets=0;                         // ชุดครบ 5 หมู่
  const picked = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };
  let junkAvoid=0;                    // ปล่อยของล่อให้หมดอายุ
  let noMissTime=0;                   // วินาทีที่ไม่พลาด
  let recentMiss=false;
  let feverCount=0, feverFull=0;      // นับเปิด fever / เติมเต็ม
  let shieldBlocks=0;

  // sync ค่าเข้า deck.stats ทุกครั้งหลังอัปเดต
  function syncStats(){
    deck.stats.score = score;
    deck.stats.combo = combo;
    deck.stats.comboMax = Math.max(deck.stats.comboMax||0, combo);

    deck.stats.cat_protein = picked.protein;
    deck.stats.cat_veggie  = picked.veggie;
    deck.stats.cat_fruit   = picked.fruit;
    deck.stats.cat_grain   = picked.grain;
    deck.stats.cat_dairy   = picked.dairy;

    deck.stats.sets = sets;
    deck.stats.junkAvoid = junkAvoid;
    deck.stats.noMissTime = noMissTime;
    deck.stats.feverCount = feverCount;
    deck.stats.feverFull  = feverFull;
    deck.stats.star = star;
    deck.stats.diamond = diamond;
    deck.stats.shieldBlocks = shieldBlocks;

    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function pushQuestUI(hint){
    // ให้ HUD โฟกัสทีละอัน (current ของ deck)
    const curGoal = deck.getCurrentGoal();   // เสริมใน MissionDeck: current goal pointer
    const curMini = deck.getCurrent();       // mini ปัจจุบัน

    const gProg = curGoal ? deck.progressOf(curGoal.id) : null;
    const mProg = curMini ? deck.progressOf(curMini.id) : null;

    const goal = curGoal ? {
      label  : curGoal.label,
      prog   : (gProg?.prog ?? 0),
      target : (gProg?.target ?? 0)
    } : null;

    const mini = curMini ? {
      label  : curMini.label,
      prog   : (mProg?.prog ?? 0),
      target : (mProg?.target ?? 0)
    } : null;

    window.dispatchEvent(new CustomEvent('hha:quest', { detail: { goal, mini, hint } }));
    questHUDUpdate(deck, hint||'');
  }

  // Fever helpers
  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    const before = fever;
    fever = clamp(fever + n, 0, 100);
    setFever(fever);
    if (!feverActive && fever>=100){
      feverActive = true; setFeverActive(true);
      feverCount += 1;    // เปิด fever สำเร็จ
    }
    if (before<100 && fever>=100) feverFull += 1; // เติมเต็ม
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = clamp(fever - d, 0, 100);
    setFever(fever);
    if (feverActive && fever<=0){ feverActive=false; setFeverActive(false); }
  }

  // นับ "ชุดครบ 5 หมู่" แบบง่าย: เมื่อทั้งห้าหมู่มีอย่างน้อย 1 → +1 set แล้วหักออกหมู่ละ 1
  function tryMakeSet(){
    if (ALL_CATS.every(k => picked[k] > 0)){
      ALL_CATS.forEach(k => picked[k]-=1);
      sets += 1;
    }
  }

  // ---------- Judge ----------
  function judge(emoji, ctx){
    const cx = ctx.clientX ?? ctx.cx, cy = ctx.clientY ?? ctx.cy;

    // Power-ups
    if (emoji===STAR){ const d=35*mult(); score+=d; star++; gainFever(10);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy}, theme:'groups'}); recentMiss=false; syncStats(); pushQuestUI(); return {good:true,scoreDelta:d}; }
    if (emoji===DIA){  const d=70*mult(); score+=d; diamond++; gainFever(28);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy}, theme:'goodjunk'}); recentMiss=false; syncStats(); pushQuestUI(); return {good:true,scoreDelta:d}; }
    if (emoji===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=18;
      Particles.burstShards(null,null,{screen:{x:cx,y:cy}, theme:'hydration'}); recentMiss=false; syncStats(); pushQuestUI(); return {good:true,scoreDelta:18}; }
    if (emoji===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=20;
      Particles.burstShards(null,null,{screen:{x:cx,y:cy}, theme:'plate'}); recentMiss=false; syncStats(); pushQuestUI(); return {good:true,scoreDelta:20}; }

    // Food / Lure
    const cat = catOf(emoji);
    if (cat){
      const base  = 16 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.5);

      picked[cat] += 1;
      tryMakeSet();

      deck.onGood();                // แจ้ง Deck ว่าได้ของดี
      recentMiss=false;             // รีเซ็ต no-miss line

      Particles.burstShards(null,null,{screen:{x:cx,y:cy}, theme:'groups'});
      syncStats(); pushQuestUI();
      return { good:true, scoreDelta:delta };
    }else{
      // lure
      if (shield>0){
        shield--; setShield(shield); shieldBlocks++;
        Particles.burstShards(null,null,{screen:{x:cx,y:cy}, theme:'groups'});
        recentMiss=false; syncStats(); pushQuestUI();
        return {good:false, scoreDelta:0};
      }
      score = Math.max(0, score - 12);
      combo = 0;
      decayFever(16);
      deck.onJunk();                // แจ้ง Deck ว่ากดโดนขยะ
      recentMiss = true;

      Particles.burstShards(null,null,{screen:{x:cx,y:cy}, theme:'goodjunk'});
      syncStats(); pushQuestUI();
      return { good:false, scoreDelta:-12 };
    }
  }

  function onExpire(e){
    // หมดอายุ: ถ้าเป็น lure → นับเลี่ยงสำเร็จ
    if (e && e.isGood===false){
      junkAvoid += 1;
      deck.onJunk(); // เลี่ยงขยะ = จัดการฝั่ง junk ใน deck เพื่อให้บาง quest นับ
      syncStats(); pushQuestUI();
    }
  }

  function onHitScreen(){
    // เคลียร์ mini ครบ 3 ใบก่อนหมดเวลา → เติมชุดใหม่
    // หมายเหตุ: MissionDeck ควรมี deck.isCleared() สำหรับ mini
    syncStats(); pushQuestUI();
    if (deck.isCleared()){
      deck.draw3();
      questHUDUpdate(deck, 'New Mini Set');
      pushQuestUI('New Mini Set');
    }
    // Goal: เปลี่ยนโฟกัสไปยัง goal ถัดไปเมื่อถึง target (ใช้ getCurrentGoal()/advanceGoal() ใน Deck)
    if (deck.isCurrentGoalCleared?.()){
      deck.advanceGoal?.();
      pushQuestUI('Next Goal');
    }
  }

  function onSec(){
    // นับเส้น no-miss (เพิ่มถ้าไม่มี miss ในวินาทีนั้น)
    if (!recentMiss) noMissTime += 1; else recentMiss=false;

    // fever ลดอัตโนมัติ
    decayFever(combo<=0 ? 6 : 2);

    deck.second();
    syncStats();
    pushQuestUI();
  }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  // สรุปผลเมื่อหมดเวลา (จับจาก hha:time sec<=0)
  const onEnd = () => {
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);

      questHUDDispose();

      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Food Groups', difficulty:diff, score,
        comboMax: (deck.stats.comboMax||0),
        misses:   (deck.stats.junkMiss||0),
        hits:     (deck.stats.goodCount||0),
        duration: dur,
        // Summary สำคัญสำหรับจอผลลัพธ์
        goalsCleared: deck.goalsCleared?.() ?? 0,
        goalsTotal  : deck.goalsTotal?.()   ?? 5,
        questsCleared: deck.questsCleared?.() ?? 0,
        questsTotal  : deck.questsTotal?.()   ?? 3
      }}));
    }catch(_){}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GROUPS_GOOD, ...BONUS], bad:[...LURE] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge,
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    // แสดง UI ครั้งแรก
    syncStats(); pushQuestUI('Wave 1');
    return ctrl;
  });
}

export default { boot };
