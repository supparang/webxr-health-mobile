// === /HeroHealth/modes/hydration.safe.js (MISS = กดผิดเท่านั้น + โค้ช ป.5) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import Particles from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createHydrationQuest } from './hydration.quest.js';

const GOOD = ['💧','🥛','🍉'];      // น้ำดี
const BAD  = ['🥤','🧋','🍺','☕️']; // น้ำหวาน / คาเฟอีน
const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

// ---- Coach helper (โค้ชสั้น ๆ + emoji) ----
let lastCoachAt = 0;
function coach(text, minGap = 2200){
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try { window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}})); } catch {}
}

export async function boot(cfg={}) {
  const diff=(cfg.difficulty||'normal').toLowerCase();
  const dur =(cfg.duration|0)||60;

  ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);
  ensureWaterGauge();
  let waterPct = 50;
  setWaterGauge(waterPct);

  // Quest
  const deck = createHydrationQuest(diff);
  deck.drawGoals(2);
  deck.draw3();
  let accMiniDone=0, accGoalDone=0;

  // State
  let score=0, combo=0, comboMax=0, misses=0;
  let star=0, diamond=0, shield=0, fever=0, feverActive=false;
  let lastZone = zoneFrom(waterPct);

  function pushQuest(hint){
    const goals=deck.getProgress('goals');
    const minis=deck.getProgress('mini');
    const z = zoneFrom(waterPct);
    window.dispatchEvent(new CustomEvent('quest:update',{detail:{
      goal:(goals.find(g=>!g.done)||goals[0]||null),
      mini:(minis.find(m=>!m.done)||minis[0]||null),
      goalsAll:goals, minisAll:minis, hint: hint || `โซน: ${z}`
    }}));
  }

  function mult(){ return feverActive?2:1; }
  function gainFever(n){
    fever=Math.max(0,Math.min(100,fever+n));
    setFever(fever);
    if (!feverActive && fever>=100){
      feverActive=true;
      setFeverActive(true);
      coach('โหมดพลังน้ำ 💧✨ ยิงของดีรัว ๆ เลย!');
    }
  }
  function decayFever(n){
    const d=feverActive?10:n;
    fever=Math.max(0,fever-d);
    setFever(fever);
    if (feverActive && fever<=0){
      feverActive=false;
      setFeverActive(false);
    }
  }

  function handleZoneChange(newPct){
    const z = zoneFrom(newPct);
    deck.stats.zone = z;
    if (z === lastZone) return;
    if (z === 'GREEN') coach('น้ำกำลังดีเลย ✅ อยู่โซนเขียวนาน ๆ นะ');
    if (z === 'LOW')   coach('เริ่มขาดน้ำแล้ว 🥵 เก็บน้ำเปล่าเพิ่มอีกหน่อย');
    if (z === 'HIGH')  coach('น้ำ/เครื่องดื่มเยอะไปหน่อย 😵 ลดน้ำหวานลงนิดนึง');
    lastZone = z;
  }

  function addWater(n){
    waterPct = Math.max(0,Math.min(100,waterPct+n));
    setWaterGauge(waterPct);
    handleZoneChange(waterPct);
  }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  function scoreFX(x,y,val,good){
    try{
      Particles.scorePop(x,y,(val>0?'+':'')+val,{good});
      Particles.burstAt(x,y,{color: good ? '#38bdf8' : '#f97316'});
    }catch{}
  }

  function maybeCoachCombo(){
    if (combo === 3) coach('เยี่ยมเลย! เลือกน้ำดีติดกัน 3 ครั้งแล้ว 👍');
    if (combo === 6) coach('คอมโบสวยมาก 💙 รักษาโซนเขียวต่อไป!');
  }

  function judge(ch, ctx){
    const x=ctx.clientX||ctx.cx||0, y=ctx.clientY||ctx.cy||0;

    // power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo); syncDeck(); pushQuest(); scoreFX(x,y,d,true); maybeCoachCombo(); return {good:true,scoreDelta:d}; }
    if (ch===DIA) { const d=80*mult(); score+=d; diamond++; gainFever(30); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo); syncDeck(); pushQuest(); scoreFX(x,y,d,true); maybeCoachCombo(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=20; deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,20,true); coach('ได้เกราะน้ำ 🛡️ พลาดได้นิดหน่อยไม่เป็นไร'); return {good:true,scoreDelta:20}; }
    if (ch===FIRE) { feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,25,true); coach('โหมดไฟน้ำ 💥 เก็บน้ำดีให้เต็มเลย!'); return {good:true,scoreDelta:25}; }

    // กดถูก / กดผิด
    if (GOOD.includes(ch)){
      addWater(8);
      const d=(14+combo*2)*mult();
      score+=d;
      combo++; comboMax=Math.max(comboMax,combo);
      gainFever(6+combo*0.4);
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x,y,d,true);
      maybeCoachCombo();
      return {good:true, scoreDelta:d};
    }else{
      // กดโดนของเสีย
      if (shield>0){
        shield--; setShield(shield);
        addWater(-4);
        decayFever(6);
        syncDeck(); pushQuest();
        scoreFX(x,y,0,false);
        coach('เกราะช่วยไว้แล้ว 👀 ระวังน้ำหวานกับชาไข่มุกนะ');
        return {good:false,scoreDelta:0};
      }
      addWater(-8);
      const d=-10;
      score=Math.max(0,score+d);
      combo=0;
      misses++;              // ✅ นับพลาดเฉพาะกดผิด
      decayFever(14);
      deck.onJunk();         // ✅ junkMiss เพิ่มเฉพาะกดผิด
      syncDeck(); pushQuest();
      scoreFX(x,y,d,false);
      if (misses === 1) coach('ไม่เป็นไร ลองเลี่ยงน้ำหวานดูนะ 🍹➡️💧');
      if (misses === 3) coach('เริ่มกดโดนน้ำหวานบ่อยแล้ว ลองโฟกัสรูปแก้วน้ำเปล่า 💧 ให้มากขึ้น');
      return {good:false, scoreDelta:d};
    }
  }

  // ✅ ปล่อยของเสียหลุดจอ “ไม่ถือว่าพลาด” อีกต่อไป
  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // แค่ลดไข้เบา ๆ แต่ไม่เพิ่ม miss / ไม่ onJunk
    decayFever(4);
    syncDeck();
    pushQuest();
  }

  function onSec(){
    const z = zoneFrom(waterPct);
    if (z==='GREEN') decayFever(2);
    else             decayFever(6);

    // ค่อย ๆ ดึงกลับสู่สมดุล
    addWater(z==='HIGH' ? -4 : (z==='LOW' ? +4 : -1));

    deck.second();
    syncDeck();

    const g=deck.getProgress('goals');
    const m=deck.getProgress('mini');
    if (g.length>0 && g.every(x=>x.done)){ accGoalDone+=g.length; deck.drawGoals(2); pushQuest('Goal ใหม่'); coach('ภารกิจน้ำผ่านอีกชุดแล้ว 🎉'); }
    if (m.length>0 && m.every(x=>x.done)){ accMiniDone+=m.length; deck.draw3();       pushQuest('Mini ใหม่'); coach('Mini quest น้ำสำเร็จแล้ว เก่งมาก! 🌟'); }
  }

  return factoryBoot({
    difficulty: diff,
    duration: dur,
    pools:{good:[...GOOD,...BONUS], bad:[...BAD]},
    goodRate:0.60, powerups:BONUS, powerRate:0.10, powerEvery:7,
    judge:(ch,ctx)=>judge(ch,ctx),
    onExpire
  }).then(ctrl=>{
    pushQuest('เริ่ม');
    coach('เลือกน้ำดี 💧 นม 🥛 ผลไม้ฉ่ำน้ำ 🍉 ให้เยอะ ๆ นะ');

    window.addEventListener('hha:time',(e)=>{
      const sec=(e.detail?.sec|0);
      if (sec>=0) onSec();
      if (sec===20) coach('เหลือ 20 วิ ลองอยู่โซนเขียวให้นานที่สุด 💚');
      if (sec===10) coach('10 วิ สุดท้าย เก็บน้ำดีให้สุดเลย! 💦');
      if (sec===0){
        const g=deck.getProgress('goals'), m=deck.getProgress('mini');
        const goalCleared=g.length>0 && g.every(x=>x.done);
        const goalsTotal  = accGoalDone + g.length;
        const goalsDone   = accGoalDone + g.filter(x=>x.done).length;
        const miniTotal   = accMiniDone + m.length;
        const miniDone    = accMiniDone + m.filter(x=>x.done).length;
        window.dispatchEvent(new CustomEvent('hha:end',{detail:{
          mode:'Hydration', difficulty:diff, score, misses, comboMax, duration:dur,
          goalCleared, goalsCleared:goalsDone, goalsTotal, questsCleared:miniDone, questsTotal:miniTotal
        }}));
      }
    });

    return ctrl;
  });
}

export default { boot };
