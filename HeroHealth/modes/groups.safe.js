// === /HeroHealth/modes/groups.safe.js (Target groups + power-ups + coach tuned) ===
import Particles from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createGroupsQuest } from './groups.quest.js';

const GROUPS = {
  1: ['🍚','🍙','🍞','🥐','🥖','🥯'],
  2: ['🥩','🍗','🍖','🥚','🧀'],
  3: ['🥦','🥕','🍅','🥬','🌽','🥗'],
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],
  5: ['🥛','🧈','🧀','🍨']
};
const ALL = Object.values(GROUPS).flat();
const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

const diffCfg = {
  easy:   { spawn:950,  life:2200, targets:18, focus:1 },
  normal: { spawn:820,  life:2000, targets:26, focus:2 },
  hard:   { spawn:680,  life:1800, targets:34, focus:3 }
};

function foodGroup(emo){ for(const [g,arr] of Object.entries(GROUPS)){ if(arr.includes(emo)) return +g; } return 0; }
function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }
function xy(ev){ if(ev?.changedTouches?.[0]){const t=ev.changedTouches[0];return {x:t.clientX,y:t.clientY};}
                 return {x:ev?.clientX||0,y:ev?.clientY||0}; }

// ---- Coach helper ----
let lastCoachAt = 0;
function coach(text, minGap = 2300){
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try{
    window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}}));
  }catch(_){}
}

export async function boot(opts={}){
  const diff = (opts.difficulty||'normal').toLowerCase();
  const dur  = (opts.duration|0)||60;
  const cfg  = diffCfg[diff]||diffCfg.normal;

  ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);

  const host = document.getElementById('spawnHost') || makeHost(); host.innerHTML='';
  let timerSpawn=null, timerTick=null;
  let timeLeft=dur;

  // Quest (2+3)
  const deck = createGroupsQuest(diff);
  deck.drawGoals(2); deck.draw3();

  // state
  let score=0, combo=0, comboMax=0, misses=0;
  let star=0, diamond=0, shield=0, fever=0, feverActive=false;
  let goodHits=0;
  let accMiniDone=0, accGoalDone=0;

  // target groups (auto escalate)
  let activeGroups = pickGroups(cfg.focus);
  let focusLevel = cfg.focus;

  function mult(){ return feverActive?2:1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true;setFeverActive(true); coach('โหมดพลังพิเศษ! เลือกหมู่เป้าหมายให้ไวขึ้นได้เลย', 3500);} }
  function decayFever(n){ const d=feverActive?10:n; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false;setFeverActive(false);} }

  function labelGroupsShort(){
    return activeGroups.map(g=>'หมู่ '+g).join(', ');
  }

  function pushQuest(hint){
    const goals=deck.getProgress('goals'), minis=deck.getProgress('mini');
    const labelGroups = `หมู่เป้าหมาย: ${activeGroups.map(g=>'('+g+')').join(' ')}`;
    window.dispatchEvent(new CustomEvent('quest:update',{detail:{
      goal:{...(goals.find(g=>!g.done)||goals[0]||{}), label:(goals[0]?.label||'')+' • '+labelGroups},
      mini:(minis.find(m=>!m.done)||minis[0]||null),
      goalsAll:goals, minisAll:minis, hint
    }}));
  }

  function maybeCoachCombo(){
    if (combo === 3)  coach('เริ่มคอมโบหมู่เป้าหมายได้แล้ว เก็บต่อเนื่องให้ครบทุกหมู่เลย!');
    if (combo === 6)  coach('คอมโบยาวมาก! มองให้ชัดว่าเป็นหมู่เป้าหมายก่อนแตะนะ', 3500);
  }

  function escalateIfReady(){
    if (focusLevel>=cfg.focus) return;
    const need = Math.ceil(cfg.targets * (focusLevel===1?0.55:0.80));
    if (goodHits>=need && focusLevel<3){
      focusLevel++;
      activeGroups = pickGroups(focusLevel);
      coach(`โฟกัสเพิ่มเป็น ${focusLevel} หมู่แล้ว: ${labelGroupsShort()}`, 3500);
      pushQuest('ระดับโฟกัสเพิ่ม');
    }
  }

  function hitGood(ev, isTarget){
    const p=xy(ev);
    const d = isTarget ? (140+combo*4)*mult() : -120;
    if (isTarget){
      score+=d; combo++; comboMax=Math.max(comboMax,combo); gainFever(6+combo*0.4); deck.onGood(); goodHits++;
      Particles.scorePop(p.x,p.y,'+'+d,{good:true}); Particles.burstAt(p.x,p.y,{color:'#22c55e'});
      maybeCoachCombo();
    }else{
      if (shield>0){
        shield--; setShield(shield);
        Particles.scorePop(p.x,p.y,'0'); Particles.burstAt(p.x,p.y,{color:'#60a5fa'});
        coach('เกราะช่วยกันพลาดหมู่ผิดให้แล้ว ดูหมู่เป้าหมายด้านบนก่อนแตะนะ', 4000);
      }else{
        score=Math.max(0,score+d); combo=0; misses++; decayFever(14); deck.onJunk();
        Particles.scorePop(p.x,p.y,String(d)); Particles.burstAt(p.x,p.y,{color:'#f97316'});
        if (misses===1) coach('แตะหมู่ผิดไปนิดหนึ่ง ลองสังเกตรูปอาหารให้ตรงกับหมู่เป้าหมายก่อนนะ');
        else if (misses===3) coach('เริ่มกดหมู่ผิดบ่อย ลองชะลอแล้วดูสัญลักษณ์หมู่ให้ชัด ๆ ก่อนแตะ', 4000);
      }
    }
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{delta:d,total:score,combo,comboMax,good:isTarget}}));
    deck.updateScore(score); deck.updateCombo(combo); pushQuest();
    escalateIfReady();
  }

  function hitBonus(ev, ch){
    const p=xy(ev);
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo);
      Particles.scorePop(p.x,p.y,'+'+d,{good:true}); Particles.burstAt(p.x,p.y,{color:'#22c55e'}); maybeCoachCombo(); }
    else if (ch===DIA){ const d=80*mult(); score+=d; diamond++; gainFever(30); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo);
      Particles.scorePop(p.x,p.y,'+'+d,{good:true}); Particles.burstAt(p.x,p.y,{color:'#22c55e'}); maybeCoachCombo(); }
    else if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=20; deck.onGood();
      Particles.scorePop(p.x,p.y,'+20',{good:true}); Particles.burstAt(p.x,p.y,{color:'#60a5fa'}); coach('ได้เกราะแล้ว เผื่อแตะโดนหมู่ผิดจะได้ไม่เสียคะแนน', 4000); }
    else if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; deck.onGood();
      Particles.scorePop(p.x,p.y,'+25',{good:true}); Particles.burstAt(p.x,p.y,{color:'#fbbf24'}); coach('ไฟลุกแล้ว! เก็บหมู่เป้าหมายให้ไวขึ้นได้เลย', 3500); }
    deck.updateScore(score); deck.updateCombo(combo); pushQuest();
  }

  function spawnOne(){
    if(timeLeft<=0) return;
    const roll=Math.random();
    // 12% chance power-up
    if (roll<0.12){
      spawnChar(rnd(BONUS), null, true);
      return;
    }
    // 70% bias to target groups, 30% other foods
    if (Math.random()<0.7){
      const tg = rnd(activeGroups);
      spawnChar(rnd(GROUPS[tg]), tg, false);
    }else{
      const emo=rnd(ALL);
      spawnChar(emo, foodGroup(emo), false);
    }
  }

  function spawnChar(ch, g, isBonus){
    const el=document.createElement('div');
    el.textContent=ch;
    el.dataset.g = String(g||0);
    Object.assign(el.style,{
      position:'absolute', left:(10+Math.random()*80)+'%', top:(18+Math.random()*60)+'%',
      transform:'translate(-50%,-50%)', font:'900 46px system-ui', textShadow:'0 6px 18px rgba(0,0,0,.55)',
      cursor:'pointer', userSelect:'none', pointerEvents:'auto', zIndex:651
    });
    const kill=()=>{ try{host.removeChild(el);}catch(_){ } };
    el.addEventListener('click',(ev)=>{
      kill();
      if (isBonus) return hitBonus(ev,ch);
      const isTarget = activeGroups.includes(+el.dataset.g||0);
      hitGood(ev,isTarget);
    });
    host.appendChild(el);
    setTimeout(kill, diff==='hard' ? cfg.life-200 : cfg.life);
  }

  function onSec(){
    timeLeft--;
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    deck.second(); deck.updateScore(score); deck.updateCombo(combo);

    const goals=deck.getProgress('goals'), minis=deck.getProgress('mini');
    if (goals.length>0 && goals.every(x=>x.done)){ accGoalDone+=goals.length; deck.drawGoals(2); pushQuest('Goal ใหม่'); coach('ภารกิจหมู่เป้าหมายชุดหนึ่งสำเร็จแล้ว เก่งมาก!', 4000); }
    if (minis.length>0 && minis.every(x=>x.done)){ accMiniDone+=minis.length; deck.draw3();       pushQuest('Mini ใหม่'); coach('Mini quest เกี่ยวกับหมู่สำเร็จอีกชุดหนึ่งแล้ว!', 4000); }
    if (combo<=0) decayFever(6); else decayFever(2);

    if (timeLeft===20) coach('เหลือ 20 วินาที ลองโฟกัสหมู่เป้าหมายให้ครบทุกหมู่!', 5000);
    if (timeLeft===10) coach('10 วินาทีสุดท้าย เก็บหมู่เป้าหมายให้ได้มากที่สุด!', 6000);

    if (timeLeft<=0){ stopAll(); finish(); }
  }

  function stopAll(){ if(timerSpawn){clearInterval(timerSpawn);timerSpawn=null;}
                      if(timerTick){clearInterval(timerTick);timerTick=null;}}

  function finish(){
    const g=deck.getProgress('goals'), m=deck.getProgress('mini');
    const goalCleared = g.length>0 && g.every(x=>x.done);
    const goalsTotal  = accGoalDone + g.length;
    const goalsDone   = accGoalDone + g.filter(x=>x.done).length;
    const miniTotal   = accMiniDone + m.length;
    const miniDone    = accMiniDone + m.filter(x=>x.done).length;
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Groups', difficulty:diff, score, misses, comboMax, duration:dur,
      goalCleared, goalsCleared:goalsDone, goalsTotal, questsCleared:miniDone, questsTotal:miniTotal
    }}));
  }

  return {
    start(){
      score=0; combo=0; comboMax=0; misses=0; goodHits=0;
      star=0; diamond=0; shield=0; fever=0; feverActive=false;
      activeGroups=pickGroups(cfg.focus); focusLevel=cfg.focus;
      deck.stats.star=0; deck.stats.diamond=0;
      window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
      pushQuest('เริ่ม • โฟกัส '+labelGroupsShort());
      coach('ดูให้ชัดว่าหมู่เป้าหมายคือหมู่ไหน แล้วแตะเฉพาะอาหารในหมู่นั้นเท่านั้นนะ');
      timerSpawn=setInterval(spawnOne, cfg.spawn);
      timerTick=setInterval(onSec, 1000);
    },
    stop(){ stopAll(); }
  };
}

export default { boot };

function pickGroups(n){
  const pool=[1,2,3,4,5], out=[];
  while(out.length<n && pool.length){
    out.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  }
  return out;
}
function makeHost(){ const h=document.createElement('div'); h.id='spawnHost';
  Object.assign(h.style,{position:'absolute',inset:0,pointerEvents:'none',zIndex:650}); document.body.appendChild(h); return h; }
