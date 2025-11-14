// === /HeroHealth/modes/groups.safe.js (Full, bias to target groups + power-ups + coach) ===
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

export async function boot(opts={}){

  const diff = (opts.difficulty||'normal').toLowerCase();
  const dur  = (opts.duration|0)||60;
  const cfg  = diffCfg[diff]||diffCfg.normal;

  ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);

  const host = document.getElementById('spawnHost') || makeHost(); 
  host.innerHTML='';

  let timerSpawn=null, timerTick=null;
  let timeLeft=dur;

  const deck = createGroupsQuest(diff); 
  deck.drawGoals(2); 
  deck.draw3();

  function pushQuest(hint){
    const goals=deck.getProgress('goals'), minis=deck.getProgress('mini');
    const labelGroups = `หมู่เป้าหมาย: ${activeGroups.map(g=>'('+g+')').join(' ')}`;
    window.dispatchEvent(new CustomEvent('quest:update',{detail:{
      goal:{...(goals.find(g=>!g.done)||goals[0]||{}), label:(goals[0]?.label||'')+' • '+labelGroups},
      mini:(minis.find(m=>!m.done)||minis[0]||null),
      goalsAll:goals, minisAll:minis, hint
    }}));
  }

  let score=0, combo=0, comboMax=0, misses=0;
  let star=0, diamond=0, shield=0, fever=0, feverActive=false;
  let goodHits=0;

  let accMiniDone=0, accGoalDone=0;

  function mult(){ return feverActive?2:1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever);
    if(!feverActive&&fever>=100){feverActive=true;setFeverActive(true);} }
  function decayFever(n){ const d=feverActive?10:n; fever=Math.max(0,fever-d); setFever(fever);
    if(feverActive&&fever<=0){feverActive=false;setFeverActive(false);} }

  function coach(t){ window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:t}})); }

  let activeGroups = pickGroups(cfg.focus);
  let focusLevel = cfg.focus;

  function escalateIfReady(){
    if (focusLevel>=cfg.focus) return;
    const need = Math.ceil(cfg.targets * (focusLevel===1?0.55:0.80));
    if (goodHits>=need && focusLevel<3){
      focusLevel++;
      activeGroups = pickGroups(focusLevel);
      coach(`โฟกัสเพิ่มเป็น ${focusLevel} หมู่!`);
      pushQuest('ระดับโฟกัสเพิ่ม');
    }
  }

  function hitGood(ev, isTarget){
    const p=xy(ev);
    const d = isTarget ? (140+combo*4)*mult() : -120;

    if (isTarget){
      score+=d; combo++; comboMax=Math.max(comboMax,combo); gainFever(6+combo*0.4); 
      deck.onGood(); goodHits++;
    }else{
      if (shield>0){ shield--; setShield(shield); }
      else { score=Math.max(0,score+d); combo=0; misses++; decayFever(14); deck.onJunk(); }
    }

    Particles.scorePop(p.x,p.y,(d>=0?'+':'')+d);
    Particles.burstShards(null,null,{screen:{x:p.x,y:p.y},theme:'groups'});

    window.dispatchEvent(new CustomEvent('hha:score',{detail:{delta:d,total:score,combo,comboMax,good:isTarget}}));
    deck.updateScore(score); deck.updateCombo(combo); pushQuest();
    escalateIfReady();
  }

  function hitBonus(ev, ch){
    const p=xy(ev);
    let d=0;
    if (ch===STAR){ d=40*mult(); score+=d; star++; gainFever(10); combo++; comboMax=Math.max(comboMax,combo); deck.onGood();}
    else if (ch===DIA){ d=80*mult(); score+=d; diamond++; gainFever(30); combo++; comboMax=Math.max(comboMax,combo); deck.onGood();}
    else if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); d=20; score+=20; deck.onGood();}
    else if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); d=25; score+=25; deck.onGood(); }

    Particles.scorePop(p.x,p.y,'+'+d);
    Particles.burstShards(null,null,{screen:{x:p.x,y:p.y},theme:'goodjunk'});
    deck.updateScore(score); deck.updateCombo(combo); pushQuest();
  }

  function spawnOne(){
    if(timeLeft<=0) return;
    const roll=Math.random();
    if (roll<0.12){ spawnChar(rnd(BONUS), null, true); return; }

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
      transform:'translate(-50%,-50%)', font:'900 46px system-ui',
      textShadow:'0 6px 18px rgba(0,0,0,.55)', cursor:'pointer',
      userSelect:'none', pointerEvents:'auto', zIndex:651
    });

    const kill=()=>{ try{host.removeChild(el);}catch(_){ } };

    el.addEventListener('click',(ev)=>{
      kill();
      if (isBonus) hitBonus(ev,ch);
      else hitGood(ev, activeGroups.includes(+el.dataset.g||0));
    });

    host.appendChild(el);
    setTimeout(kill, cfg.life);
  }

  function onSec(){
    timeLeft--;
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));

    deck.second(); deck.updateScore(score); deck.updateCombo(combo);

    const g=deck.getProgress('goals'), m=deck.getProgress('mini');

    if (g.length>0 && g.every(x=>x.done)){ accGoalDone+=g.length; deck.drawGoals(2); pushQuest('Goal ใหม่'); }
    if (m.length>0 && m.every(x=>x.done)){ accMiniDone+=m.length; deck.draw3();       pushQuest('Mini ใหม่'); }

    if (timeLeft<=0){ 
      stopAll(); 
      finish(); 
    }
  }

  function stopAll(){
    if(timerSpawn){clearInterval(timerSpawn);timerSpawn=null;}
    if(timerTick){clearInterval(timerTick);timerTick=null;}
  }

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

      deck.stats.star=0; 
      deck.stats.diamond=0;

      window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));

      pushQuest('เริ่ม • โฟกัส '+activeGroups.join(', '));
      coach('เลือกเฉพาะ “หมู่เป้าหมาย” ให้ถูกต้อง!');

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
function makeHost(){ 
  const h=document.createElement('div'); 
  h.id='spawnHost';
  Object.assign(h.style,{position:'absolute',inset:0,pointerEvents:'none',zIndex:650}); 
  document.body.appendChild(h); 
  return h; 
}
