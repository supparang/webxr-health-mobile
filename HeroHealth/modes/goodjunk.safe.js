// === /HeroHealth/modes/goodjunk.safe.js (FINAL, wave quests + goal + power-ups + proper quest events) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- Pools ----------
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // ---------- Goal (ตามระดับ) ----------
  const GOAL_SCORE = (diff==='easy') ? 350 : (diff==='hard' ? 750 : 550);
  function goalObj(score){ return { label:`ทำคะแนนให้ถึงเป้า (${diff})`, prog:score, target:GOAL_SCORE }; }

  // ---------- Mini quest pool 10 ใบ (Good vs Junk) ----------
  const gjQuestPool10 = [
    { id:'g_good15',   level:'easy',   label:'เก็บของดี 15 ชิ้น',     check:s=>s.goodCount>=15,  prog:s=>Math.min(15,s.goodCount),  target:15 },
    { id:'g_good25',   level:'normal', label:'เก็บของดี 25 ชิ้น',     check:s=>s.goodCount>=25,  prog:s=>Math.min(25,s.goodCount),  target:25 },
    { id:'g_combo12',  level:'normal', label:'ทำคอมโบ 12',            check:s=>s.comboMax>=12,   prog:s=>Math.min(12,s.comboMax),   target:12 },
    { id:'g_score500', level:'hard',   label:'ทำคะแนนรวม 500+',       check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),     target:500 },
    { id:'g_nomiss10', level:'normal', label:'ไม่พลาด 10 วินาที',     check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime), target:10 },
    // นับ “หลีกขยะ” เฉพาะกรณีที่ขยะหมดอายุ (ไม่ได้คลิก) → เราจะอัปเดตผ่าน onExpire เท่านั้น
    { id:'g_avoid5',   level:'easy',   label:'หลีกของขยะ 5 ครั้ง',    check:s=>s.junkMiss>=5,    prog:s=>Math.min(5,s.junkMiss),    target:5 },
    { id:'g_star2',    level:'hard',   label:'เก็บดาว ⭐ 2 ดวง',        check:s=>s.star>=2,        prog:s=>Math.min(2,s.star),        target:2 },
    { id:'g_dia1',     level:'hard',   label:'เก็บเพชร 💎 1 เม็ด',      check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),     target:1 },
    { id:'g_streak20', level:'hard',   label:'คอมโบสูงสุด 20',         check:s=>s.comboMax>=20,   prog:s=>Math.min(20,s.comboMax),   target:20 },
    { id:'g_fever2',   level:'normal', label:'เข้าโหมด Fever 2 ครั้ง',  check:s=>s.feverCount>=2,  prog:s=>Math.min(2,s.feverCount),  target:2 },
  ];

  // ---------- HUD / Fever ----------
  ensureFeverBar(); setFever(0); setShield(0);

  // ---------- Mission deck (สุ่ม 3 ใบ / เติมเมื่อผ่านครบ) ----------
  const deck = new MissionDeck({ pool: gjQuestPool10 });
  deck.draw3();
  let wave = 1;
  let totalQuestsCleared = 0;

  questHUDInit();

  // ---------- Game state ----------
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false, feverCount=0;
  let star=0, diamond=0;

  // ชี้ให้ deck เห็นค่าที่จำเป็น (ใช้สำหรับ quests)
  function syncDeckStats(){
    deck.stats.star     = star;
    deck.stats.diamond  = diamond;
    deck.stats.feverCount = feverCount;
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    const prev = fever;
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever>=100){
      feverActive = true; setFeverActive(true); feverCount += 1;
      deck.onFeverStart?.(); // รองรับ mission.js ใหม่
    }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    const wasActive = feverActive;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (wasActive && fever<=0){ feverActive=false; setFeverActive(false); }
  }

  // ---------- Push quest+goal to HUD ----------
  function pushQuestHUD(hintText){
    // current mini (ทีละใบ) จาก deck
    const cur = deck.getCurrent();
    let mini=null;
    if (cur){
      const progList = deck.getProgress();
      const now = progList.find(x=>x.id===cur.id) || {};
      mini = {
        label: cur.label,
        prog:  Number.isFinite(now.prog) ? now.prog : 0,
        target:Number.isFinite(now.target) ? now.target : (now.done?1:0)
      };
    }
    // goal
    const g = goalObj(score);
    window.dispatchEvent(new CustomEvent('hha:quest',{ detail:{ goal:g, mini } }));
    questHUDUpdate(deck, hintText ?? `Wave ${wave}`);
  }

  // ---------- Judge ----------
  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'}); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; diamond++; gainFever(30);
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'groups'});   syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20;
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'hydration'}); syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25;
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'plate'});     syncDeckStats(); pushQuestHUD(); return {good:true, scoreDelta:25}; }

    const isGood = GOOD.includes(ch);
    if (isGood){
      const base  = 20 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(8 + combo*0.6);
      deck.onGood();           // ✅ นับของดี
      syncDeckStats();
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'goodjunk'});
      pushQuestHUD();
      return { good:true, scoreDelta: delta };
    } else {
      // ตีโดนขยะ
      if (shield>0){
        shield -= 1; setShield(shield);
        Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'hydration'});
        pushQuestHUD();
        return {good:false, scoreDelta:0};
      }
      const delta = -15;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      // ❌ สำคัญ: "ตีโดนขยะ" ไม่ถือว่า 'หลีกขยะ' → ห้าม deck.onJunk() ที่นี่
      // แต่ต้องรีเซ็ต no-miss timer ด้วยตนเอง
      deck.stats.noMissTime = 0;
      syncDeckStats();
      Particles.burstShards(null,null,{screen:{x:cx,y:cy},theme:'plate'});
      pushQuestHUD();
      return { good:false, scoreDelta: delta };
    }
  }

  // ---------- Event hooks ----------
  // ขยะหมดเวลา = "หลีกขยะ" → deck.onJunk() เพื่อให้นับ junkMiss และรีเซ็ต noMissTime ภายใน
  function onExpire(ev){
    if (!ev || ev.isGood) return;
    gainFever(4);
    deck.onJunk(); // ✅ นับหลีกขยะ
    syncDeckStats();
    pushQuestHUD(`Wave ${wave}`);
  }

  function refillWaveIfCleared(){
    if (deck.isCleared()){
      totalQuestsCleared += 3;
      deck.draw3();                    // สุ่มชุดใหม่ทันที
      pushQuestHUD(`Wave ${++wave}`);
    }
  }

  function onHitScreen(){
    pushQuestHUD(`Wave ${wave}`);
    refillWaveIfCleared();
  }

  function onSec(){
    // Fever ค่อย ๆ ลดเอง (ถ้าไม่คอมโบลดไวขึ้น)
    decayFever(combo<=0 ? 6 : 2);
    // นับเวลาไม่พลาด
    deck.second();
    syncDeckStats();
    pushQuestHUD(`Wave ${wave}`);
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
      const questsTotal   = (wave-1)*3 + 3; // เควสต์ที่ถูกเสนอทั้งหมดจนจบ

      questHUDDispose();

      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Good vs Junk', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur,
        goalCleared: score>=GOAL_SCORE,
        goalTarget : GOAL_SCORE,
        questsCleared, questsTotal
      }}));
    }catch{}
  };

  // ---------- Boot via factory (มี power-ups + expired hook) ----------
  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.65,
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