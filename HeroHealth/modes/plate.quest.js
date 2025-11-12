// === /HeroHealth/modes/plate.safe.js (Healthy Plate + Goal tracker + Fever/Power-ups/Wave Quests) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // --- หมวดหมู่อาหาร 5 หมู่สำหรับ "Healthy Plate" ---
  // map: emoji → category
  const CAT = {
    protein : new Set(['🥩','🥚','🐟','🍗','🫘']),
    veggie  : new Set(['🥦','🥕','🥬','🍅','🌽','🍆']),
    fruit   : new Set(['🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐']),
    grain   : new Set(['🍚','🍞','🥖','🌾','🥐']),
    dairy   : new Set(['🥛','🧀'])
  };
  const ALL_CATS = ['protein','veggie','fruit','grain','dairy'];

  // พูลไอเท็ม
  const PLATE_GOOD = [...CAT.protein, ...CAT.veggie, ...CAT.fruit, ...CAT.grain, ...CAT.dairy];
  const LURE = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬']; // ของล่อ/ขยะ

  // Power-ups
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // --- HUD เริ่มต้น ---
  ensureFeverBar(); setFever(0); setShield(0);

  // --- Wave mini-quests ---
  const deck = new MissionDeck(); deck.draw3();
  let wave = 1, totalCleared = 0;
  questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  // --- Goal เฉพาะโหมด: “จัดครบ 5 หมู่ 2 รอบ” ---
  const GOAL_ROUNDS = 2;               // ต้องครบกี่รอบ
  let roundsDone = 0;                  // รอบที่สำเร็จไปแล้ว
  const catThisRound = new Set();      // หมวดที่เก็บได้ในรอบปัจจุบัน

  function emojiToCat(emj){
    if (CAT.protein.has(emj)) return 'protein';
    if (CAT.veggie.has(emj))  return 'veggie';
    if (CAT.fruit.has(emj))   return 'fruit';
    if (CAT.grain.has(emj))   return 'grain';
    if (CAT.dairy.has(emj))   return 'dairy';
    return null;
  }
  function goalProgUnits(){ return roundsDone*5 + catThisRound.size; }  // หน่วย: 1 หมวด = 1 หน่วย
  function goalTargetUnits(){ return GOAL_ROUNDS * 5; }                 // 2 รอบ × 5 หมวด = 10
  function goalCleared(){ return roundsDone >= GOAL_ROUNDS; }

  // ส่งข้อมูลไป HUD หลัก (index.vr.html) + แผง mini-quests
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
    // goal
    const g = {
      label: `จัดครบ 5 หมู่ ${GOAL_ROUNDS} รอบ`,
      prog:  goalProgUnits(),
      target: goalTargetUnits()
    };

    // อัปเดต HUD ทั้งสองฝั่ง
    window.dispatchEvent(new CustomEvent('hha:quest', { detail: { goal: g, mini } }));
    questHUDUpdate(deck, hint ?? `Wave ${wave}`);
  }

  // --- สถานะคะแนน/คอมโบ/Fever ---
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;

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

  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // ---- Power-ups ----
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10);
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' });
      pushQuestUpdate(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30);
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'groups' });
      pushQuestUpdate(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20;
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'hydration' });
      pushQuestUpdate(); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever = Math.max(fever, 60); setFever(fever); score+=25;
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'goodjunk' });
      pushQuestUpdate(); return {good:true, scoreDelta:25}; }

    // ---- Logic หลักของ Plate ----
    const cat = emojiToCat(ch);
    const isGood = !!cat;

    if (isGood){
      const base  = 18 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.55);

      // อัปเดต goal: เก็บหมวดนี้ในรอบปัจจุบัน
      catThisRound.add(cat);
      if (catThisRound.size >= 5){
        roundsDone += 1;
        catThisRound.clear();  // เปิดรอบใหม่
      }

      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' });
      pushQuestUpdate();
      return { good:true, scoreDelta: delta };
    }else{
      // ขยะ
      if (shield>0){
        shield -= 1; setShield(shield);
        Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' });
        pushQuestUpdate();
        return {good:false, scoreDelta:0};
      }
      const delta = -14;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'groups' });
      pushQuestUpdate();
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // หลีกขยะได้ → ส่งผลกับสถิติ deck (เพื่อ mini quest ประเภท nomiss/balanced)
    gainFever(4);
    deck.onJunk(); deck.updateScore(score);
    pushQuestUpdate(`Wave ${wave}`);
  }

  function onHitScreen(){
    const before = deck.getProgress().filter(q=>q.done).length;
    pushQuestUpdate(`Wave ${wave}`);
    const after  = deck.getProgress().filter(q=>q.done).length;

    // ถ้าเพิ่งเคลียร์ครบ 3 ใบ → เปิด Wave ถัดไป (สุ่มใหม่) และนับรวม
    if (after > before && deck.isCleared()){
      totalCleared += 3;
      deck.draw3();
      pushQuestUpdate(`Wave ${++wave}`);
    }
  }

  function onSec(){
    // Fever ลดเอง (ลดเร็วขึ้นถ้าไม่คอมโบ)
    decayFever(combo <= 0 ? 6 : 2);
    deck.second(); deck.updateScore(score);
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

      const clearedNow   = deck.getProgress().filter(q=>q.done).length;
      const questsCleared= totalCleared + clearedNow;
      const questsTotal  = (wave-1)*3 + 3;

      questHUDDispose();

      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Healthy Plate', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur,
        // ✅ ใช้ผล “รอบ” เป็นเกณฑ์สำเร็จของ Goal
        goalCleared: goalCleared(),
        goalProgressUnits: goalProgUnits(), goalTargetUnits: goalTargetUnits(),
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
