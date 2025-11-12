// === /HeroHealth/modes/plate.safe.js
// Healthy Plate (Per-Category Quotas by difficulty) + Mini Quest (10) w/ Waves
// - Goal หลัก = "จัดจานให้ครบตามโควตาของแต่ละหมู่" (โควตาเปลี่ยนตาม diff)
// - Mini quest = มี 10 ใบ สุ่มแค่ 3 ใบ/หนึ่งรอบ (Wave) ถ้าทำครบก่อนหมดเวลา → สุ่มชุดใหม่ (เติมเควสต์) และนับสะสม
// - Fever/Power-ups/Particles เหมือนเกมอื่น ๆ และส่งข้อมูลไป HUD ผ่าน hha:quest

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- หมวดหมู่หลัก ----------
  const CAT = {
    protein : new Set(['🥩','🥚','🐟','🍗','🫘']),
    veggie  : new Set(['🥦','🥕','🥬','🍅','🌽','🍆']),
    fruit   : new Set(['🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐']),
    grain   : new Set(['🍚','🍞','🥖','🌾','🥐']),
    dairy   : new Set(['🥛','🧀'])
  };
  const ALL_CATS = ['protein','veggie','fruit','grain','dairy'];

  // ---------- พูลของดี/ตัวล่อ ----------
  const PLATE_GOOD = [...CAT.protein, ...CAT.veggie, ...CAT.fruit, ...CAT.grain, ...CAT.dairy];
  const LURE       = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  // ---------- Power-ups ----------
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // ---------- โควตาต่อหมู่ตามระดับ ----------
  // ค่าเหล่านี้ = จำนวน “ชิ้นอาหารของหมู่นั้น” ที่ต้องเก็บให้ครบในหนึ่งเกม
  // สามารถปรับสมดุลได้ตามจริง (รวมทั้งหมด ≈ 10–14 ชิ้น) เพื่อให้เหมาะกับเวลา
  const QUOTAS = {
    easy   : { protein:2, veggie:3, fruit:3, grain:2, dairy:1 },  // รวม 11
    normal : { protein:3, veggie:3, fruit:3, grain:3, dairy:2 },  // รวม 14
    hard   : { protein:4, veggie:4, fruit:4, grain:3, dairy:2 },  // รวม 17
  };
  const GOAL = QUOTAS[diff] || QUOTAS.normal;                  // โควตาที่ใช้จริงตาม diff
  const goalTargetUnits = Object.values(GOAL).reduce((a,b)=>a+b,0);
  const catCount = { protein:0, veggie:0, fruit:0, grain:0, dairy:0 };

  function emojiToCat(emj){
    if (CAT.protein.has(emj)) return 'protein';
    if (CAT.veggie.has(emj))  return 'veggie';
    if (CAT.fruit.has(emj))   return 'fruit';
    if (CAT.grain.has(emj))   return 'grain';
    if (CAT.dairy.has(emj))   return 'dairy';
    return null;
  }

  function goalProgressUnits(){
    let sum = 0;
    for (const k of ALL_CATS){
      sum += Math.min(catCount[k], GOAL[k]);
    }
    return sum;
  }
  function goalCleared(){
    return ALL_CATS.every(k => catCount[k] >= GOAL[k]);
  }
  function goalBreakdown(){
    return ALL_CATS.map(k => ({ cat:k, have:catCount[k], need:GOAL[k] }));
  }

  // ---------- Mini Quest: 10 ใบ (สุ่ม 3) ----------
  const plateQuestPool10 = [
    { id:'p_combo12',  level:'normal', label:'คอมโบต่อเนื่อง 12',        check:s=>s.comboMax>=12,     prog:s=>Math.min(12,s.comboMax),     target:12 },
    { id:'p_score450', level:'hard',   label:'ทำคะแนนรวม 450+',          check:s=>s.score>=450,       prog:s=>Math.min(450,s.score),       target:450 },
    { id:'p_protein3', level:'easy',   label:'เก็บโปรตีน 3 ชิ้น',         check:s=>s.cat_protein>=3,   prog:s=>Math.min(3,s.cat_protein),   target:3 },
    { id:'p_veggie4',  level:'normal', label:'เก็บผัก 4 ชิ้น',            check:s=>s.cat_veggie>=4,    prog:s=>Math.min(4,s.cat_veggie),    target:4 },
    { id:'p_fruit4',   level:'normal', label:'เก็บผลไม้ 4 ชิ้น',         check:s=>s.cat_fruit>=4,     prog:s=>Math.min(4,s.cat_fruit),     target:4 },
    { id:'p_grain3',   level:'easy',   label:'เก็บธัญพืช 3 ชิ้น',         check:s=>s.cat_grain>=3,     prog:s=>Math.min(3,s.cat_grain),     target:3 },
    { id:'p_dairy2',   level:'easy',   label:'เก็บนม/นมเปรี้ยว/ชีส 2',   check:s=>s.cat_dairy>=2,     prog:s=>Math.min(2,s.cat_dairy),     target:2 },
    { id:'p_nomiss15', level:'normal', label:'ไม่พลาด 15 วินาที',         check:s=>s.noMissTime>=15,   prog:s=>Math.min(15,s.noMissTime),   target:15 },
    { id:'p_star2',    level:'hard',   label:'เก็บดาว ⭐ 2 ดวง',           check:s=>s.star>=2,          prog:s=>Math.min(2,s.star),          target:2 },
    { id:'p_diamond1', level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',         check:s=>s.diamond>=1,       prog:s=>Math.min(1,s.diamond),       target:1 },
  ];

  // เตรียม HUD หลัก
  ensureFeverBar(); setFever(0); setShield(0);

  // ใช้ MissionDeck พร้อม pool 10 ใบ (จะสุ่ม 3 ใบ/รอบ)
  const deck = new MissionDeck({ pool: plateQuestPool10 });
  deck.draw3();
  let wave = 1;
  let totalQuestsCleared = 0;

  questHUDInit();

  function pushQuestUpdate(hint){
    // mini quest current
    const cur = deck.getCurrent();
    let mini = null;
    if (cur){
      const progList = deck.getProgress();
      const now = progList.find(x => x.id === cur.id) || {};
      mini = {
        label: cur.label,
        prog:  Number.isFinite(now.prog) ? now.prog : 0,
        target: Number.isFinite(now.target) ? now.target : (now.done ? 1 : 0)
      };
    }
    // goal summary + breakdown
    const g = {
      label : `จัดครบตามโควตา (ระดับ: ${diff})`,
      prog  : goalProgressUnits(),
      target: goalTargetUnits,
      // breakdown รายหมู่ (ให้ HUD นำไปแสดงเป็นรายการย่อยได้)
      breakdown: goalBreakdown()
    };

    // ส่งขึ้น HUD บน (index) และแผง mini quest
    window.dispatchEvent(new CustomEvent('hha:quest', { detail: { goal: g, mini } }));
    questHUDUpdate(deck, hint ?? `Wave ${wave}`);
  }

  // ---------- สถานะคะแนน/คอมโบ/Fever ----------
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;
  let star=0, diamond=0; // นับเพื่อใช้ใน quest pool

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100){ feverActive = true; setFeverActive(true); }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0){ feverActive = false; setFeverActive(false); }
  }

  function syncDeckCategoryStats(){
    // ส่งค่านับรายหมู่เข้า deck.stats เพื่อให้ quest pool อ่านได้
    deck.stats.cat_protein = catCount.protein;
    deck.stats.cat_veggie  = catCount.veggie;
    deck.stats.cat_fruit   = catCount.fruit;
    deck.stats.cat_grain   = catCount.grain;
    deck.stats.cat_dairy   = catCount.dairy;
    deck.stats.star        = star;
    deck.stats.diamond     = diamond;
    deck.updateScore(score);
  }

  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // ---- Power-ups ----
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); star++;
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' });
      syncDeckCategoryStats(); pushQuestUpdate(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); diamond++;
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'groups' });
      syncDeckCategoryStats(); pushQuestUpdate(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20;
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'hydration' });
      syncDeckCategoryStats(); pushQuestUpdate(); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever, 60); setFever(fever); score+=25;
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'goodjunk' });
      syncDeckCategoryStats(); pushQuestUpdate(); return {good:true, scoreDelta:25}; }

    // ---- Logic หลักของ Plate ----
    const cat = emojiToCat(ch);
    const isGood = !!cat;

    if (isGood){
      const base  = 18 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.55);

      // นับโควตาตามหมู่ (ไม่เกินโควตา)
      if (catCount[cat] < GOAL[cat]) catCount[cat]++;

      deck.onGood(); deck.updateCombo(combo);
      syncDeckCategoryStats();

      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' });
      pushQuestUpdate();
      return { good:true, scoreDelta: delta };
    }else{
      // ขยะ/ล่อ
      if (shield>0){
        shield -= 1; setShield(shield);
        Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' });
        pushQuestUpdate();
        return {good:false, scoreDelta:0};
      }
      const delta = -14;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); deck.updateCombo(combo);
      syncDeckCategoryStats();

      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'groups' });
      pushQuestUpdate();
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // หลีกขยะสำเร็จ
    gainFever(4);
    deck.onJunk();
    syncDeckCategoryStats();
    pushQuestUpdate(`Wave ${wave}`);
  }

  function refillWaveIfCleared(){
    if (deck.isCleared()){
      totalQuestsCleared += 3;
      deck.draw3();            // สุ่มเควสต์ชุดใหม่
      pushQuestUpdate(`Wave ${++wave}`);
    }
  }

  function onHitScreen(){
    // เรียกทุกครั้งหลังโดนเป้า: อัปเดต UI + ตรวจเติมเควสต์ถ้าผ่านครบ 3
    pushQuestUpdate(`Wave ${wave}`);
    refillWaveIfCleared();
  }

  function onSec(){
    // Fever ลดเอง (ถ้าไม่คอมโบ ลดไวขึ้น)
    decayFever(combo <= 0 ? 6 : 2);

    deck.second();
    syncDeckCategoryStats();
    pushQuestUpdate(`Wave ${wave}`);
  }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  const onEnd = () => {
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);

      const clearedNow    = deck.getProgress().filter(q=>q.done).length;
      const questsCleared = totalQuestsCleared + clearedNow;
      const questsTotal   = (wave-1)*3 + 3; // จำนวนเควสต์ที่ถูกเสนอรวมจนสิ้นสุด

      questHUDDispose();

      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Healthy Plate', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur,
        // Goal (quota-based)
        goalCleared: goalCleared(),
        goalProgressUnits: goalProgressUnits(),
        goalTargetUnits: goalTargetUnits,
        goalBreakdown: goalBreakdown(),
        // Mini quest summary
        questsCleared, questsTotal
      }}));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...PLATE_GOOD, ...BONUS], bad:[...LURE] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    return ctrl;
  });
}

export default { boot };
