// === /HeroHealth/modes/hydration.safe.js (Water gauge + scaling + coach) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import Particles from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createHydrationQuest } from './hydration.quest.js';

const GOOD = ['💧','🥛','🍉'];               // น้ำ/นม/ผลไม้ฉ่ำน้ำ
const BAD  = ['🥤','🧋','🍺','☕️'];          // น้ำหวาน/ชาไข่มุก/แอลกอฮอล์/คาเฟอีน
const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

// ---- Coach helper ----
let lastCoachAt = 0;
function coach(text, minGap = 2600){
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try{ window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}})); }catch(_){}
}

export async function boot(cfg={}){
  const diff=(cfg.difficulty||'normal').toLowerCase();
  const dur =(cfg.duration|0)||60;

  ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);
  ensureWaterGauge(); 
  let waterPct = 50;
  setWaterGauge(waterPct);

  // Quest
  const deck = createHydrationQuest(diff); deck.drawGoals(2); deck.draw3();
  let accMiniDone=0, accGoalDone=0;

  // State
  let score=0, combo=0, comboMax=0, misses=0;
  let star=0, diamond=0, shield=0, fever=0, feverActive=false;
  let lastZone = zoneFrom(waterPct);

  function pushQuest(hint){
    const goals=deck.getProgress('goals'), minis=deck.getProgress('mini');
    const z = zoneFrom(waterPct);
    window.dispatchEvent(new CustomEvent('quest:update',{detail:{
      goal:(goals.find(g=>!g.done)||goals[0]||null),
      mini:(minis.find(m=>!m.done)||minis[0]||null),
      goalsAll:goals, minisAll:minis, hint:`Zone: ${z}`
    }}));
  }

  function mult(){ return feverActive?2:1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true; setFeverActive(true); coach('ตอนนี้ร่างกายสดชื่นสุด ๆ ลองรักษาโซนสมดุลให้ได้ต่อเนื่อง!', 3500);} }
  function decayFever(n){ const d=feverActive?10:n; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false; setFeverActive(false);} }

  function handleZoneChange(newPct){
    const z = zoneFrom(newPct);
    deck.stats.zone = z;
    if (z !== lastZone){
      if (z === 'GREEN'){
        coach('ยอดเยี่ยม! น้ำในร่างกายอยู่โซน Balanced แล้ว พยายามรักษาโซนนี้ให้นานที่สุด', 4000);
      }else if (z === 'LOW'){
        coach('โซน Low แล้ว ร่างกายเริ่มขาดน้ำ ดื่มน้ำเปล่าเพิ่มแทนน้ำหวานนะ', 4000);
      }else if (z === 'HIGH'){
        coach('โซน High น้ำ/เครื่องดื่มเยอะไป ลองลดน้ำหวาน น้ำอัดลม และคาเฟอีนลงหน่อย', 4000);
      }
      lastZone = z;
    }
  }

  function addWater(n){
    waterPct=Math.max(0,Math.min(100,waterPct+n));
    setWaterGauge(waterPct);
    handleZoneChange(waterPct);
  }

  function syncDeck(){ deck.updateScore(score); deck.updateCombo(combo); }

  function scoreFX(x,y,val,good){ 
    try{
      Particles.scorePop(x,y,(val>0?'+':'')+val,{good});
      Particles.burstAt(x,y,{color: good ? '#38bdf8' : '#f97316'});
    }catch(_){}
  }

  function maybeCoachCombo(){
    if (combo === 3) coach('ดีมาก! เก็บเครื่องดื่มที่ช่วยเติมน้ำให้ร่างกายต่อเนื่องเลย');
    if (combo === 6) coach('คอมโบสวย! รักษาโซน Balanced ไว้ให้นานที่สุดนะ', 4000);
  }

  function judge(ch, ctx){
    const x=ctx.clientX||ctx.cx||0, y=ctx.clientY||ctx.cy||0;
    // power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo); syncDeck(); pushQuest(); scoreFX(x,y,d,true); maybeCoachCombo(); return {good:true,scoreDelta:d}; }
    if (ch===DIA) { const d=80*mult(); score+=d; diamond++; gainFever(30); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo); syncDeck(); pushQuest(); scoreFX(x,y,d,true); maybeCoachCombo(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=20; deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,20,true); coach('ได้เกราะแล้ว เผื่อพลาดเลือกเครื่องดื่มหวาน ๆ', 4000); return {good:true,scoreDelta:20}; }
    if (ch===FIRE) { feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,25,true); coach('โหมดพลังน้ำสดชื่น! เลือกน้ำ/นมให้รัว ๆ เลย', 3500); return {good:true,scoreDelta:25}; }

    if (GOOD.includes(ch)){
      addWater(8); const d=(14+combo*2)*mult(); score+=d; combo++; comboMax=Math.max(comboMax,combo); gainFever(6+combo*0.4); deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,d,true);
      maybeCoachCombo();
      return {good:true, scoreDelta:d};
    }else{
      if (shield>0){ shield--; setShield(shield); addWater(-4); decayFever(6); syncDeck(); pushQuest(); scoreFX(x,y,0,false); coach('เกราะช่วยกันผลกระทบจากเครื่องดื่มไม่ดีแล้วนะ เลือกน้ำเปล่าแทนดีกว่า', 4000); return {good:false,scoreDelta:0}; }
      addWater(-8); const d=-10; score=Math.max(0,score+d); combo=0; misses++; decayFever(14); deck.onJunk(); syncDeck(); pushQuest(); scoreFX(x,y,d,false);
      if (misses===1) coach('เครื่องดื่มหวาน ๆ ทำให้โซนแย่ลง ลองหลีกเลี่ยงดูนะ');
      if (misses===3) coach('เริ่มเลือกเครื่องดื่มไม่ดีบ่อยแล้ว เปลี่ยนมาเก็บน้ำเปล่า/นมให้มากขึ้น', 4000);
      return {good:false, scoreDelta:d};
    }
  }

  function onExpire(ev){
    // ปล่อย BAD ผ่านไป นับ miss เล็กน้อย
    if (ev && !ev.isGood){ misses++; deck.onJunk(); syncDeck(); pushQuest(); }
  }

  function onSec(){
    // drain / overflow correction
    const z = zoneFrom(waterPct);
    if (z==='GREEN'){ decayFever(2); } else { decayFever(6); }
    addWater(z==='HIGH' ? -4 : (z==='LOW' ? +4 : -1));  // กลับเข้าช่วงสมดุล
    deck.second(); syncDeck();

    const g=deck.getProgress('goals'), m=deck.getProgress('mini');
    if (g.length>0 && g.every(x=>x.done)){ accGoalDone+=g.length; deck.drawGoals(2); pushQuest('Goal ใหม่'); coach('ภารกิจโซนน้ำชุดหนึ่งสำเร็จแล้ว เก่งมาก รักษาโซน GREEN ต่อเลย!', 4000); }
    if (m.length>0 && m.every(x=>x.done)){ accMiniDone+=m.length; deck.draw3();       pushQuest('Mini ใหม่'); coach('Mini quest เรื่องสมดุลน้ำผ่านอีกชุดแล้ว!', 4000); }
  }

  // factory
  return factoryBoot({
    difficulty: diff, duration: dur,
    pools:{good:[...GOOD,...BONUS], bad:[...BAD]},
    goodRate:0.60, powerups:BONUS, powerRate:0.10, powerEvery:7,
    judge:(ch,ctx)=>judge(ch,ctx), onExpire
  }).then(ctrl=>{
    pushQuest('เริ่ม');
    coach('พยายามรักษาเกจน้ำให้อยู่โซน Balanced (สีเขียว) ให้นานที่สุด เลือกน้ำ/นม แทนน้ำหวานนะ');

    window.addEventListener('hha:time',(e)=>{
      const sec=(e.detail?.sec|0);
      if (sec>=0) onSec();
      if (sec===20) coach('เหลือ 20 วินาที ลองรักษาโซน GREEN ให้นานที่สุด!', 5000);
      if (sec===10) coach('10 วินาทีสุดท้าย รักษาโซนน้ำให้สมดุลให้ได้!', 6000);
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
