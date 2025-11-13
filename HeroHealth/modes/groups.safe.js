// === /HeroHealth/modes/groups.safe.js ===
// เลือกอาหารตาม "หมู่เป้าหมาย" ที่กำหนด

import { burstAt, scorePop } from '../vr/particles.js';

const GROUPS = {
  1: ['🍚','🍙','🍞','🥐','🥖','🥯'],
  2: ['🥩','🍗','🍖','🥚','🧀','🥓'],
  3: ['🥦','🥕','🍅','🥬','🌽','🥗'],
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],
  5: ['🥛','🧈','🧀','🍨']
};

const ALL_EMOJI = Object.values(GROUPS).flat();

function foodGroup(emo){
  for(const [g,list] of Object.entries(GROUPS)){
    if(list.includes(emo)) return Number(g);
  }
  return 0;
}

const diffCfg = {
  easy:   { spawn:950, life:2200, targetCount:18, comboMini:8, focusGroups:1 },
  normal: { spawn:800, life:2000, targetCount:26, comboMini:10, focusGroups:2 },
  hard:   { spawn:650, life:1800, targetCount:34, comboMini:12, focusGroups:3 }
};

export async function boot(opts = {}) {
  const diff = (opts.difficulty||'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  const host=document.getElementById('spawnHost') || makeHost();
  host.innerHTML = '';

  let score=0, combo=0, comboMax=0, misses=0, hits=0;
  let timeLeft=dur;
  let spawnTimer=null, tickTimer=null;

  let activeGroups = pickGroups(cfg.focusGroups);
  let focusLevel   = 1;

  let goodHits=0; // จำนวนที่คลิกถูก "หมู่เป้าหมาย"

  const mission = {
    goalLabel  : `เก็บอาหารหมู่เป้าหมายรวม ${cfg.targetCount} ชิ้น`,
    goalTarget : cfg.targetCount,
    goalProg   : ()=>goodHits,
    goalDone   : ()=>goodHits >= cfg.targetCount,
    miniLabel  : `คอมโบต่อเนื่อง ${cfg.comboMini} ครั้ง`,
    miniTarget : cfg.comboMini,
    miniProg   : ()=>comboMax,
    miniDone   : ()=>comboMax >= cfg.comboMini
  };

  function updateQuest(){
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        goal:{
          label: mission.goalLabel,
          target: mission.goalTarget,
          prog: mission.goalProg(),
          done: mission.goalDone()
        },
        mini:{
          label: mission.miniLabel,
          target: mission.miniTarget,
          prog: mission.miniProg(),
          done: mission.miniDone()
        }
      }
    }));
  }

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}}));
  }

  function emitScore(delta, good, targetHit, ev){
    score = Math.max(0, score+delta);
    if(good){
      combo++;
      hits++;
      if(targetHit) goodHits++;
      comboMax=Math.max(comboMax,combo);
    }else{
      combo=0;
      misses++;
    }

    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        delta,
        total:score,
        combo,
        comboMax,
        good
      }
    }));

    if(ev){
      const x=ev.clientX,y=ev.clientY;
      burstAt(x,y,{color:good?'#22c55e':'#f97316'});
      scorePop(x,y,(delta>0?'+':'')+delta,{good});
    }

    // ปรับระดับ focus (โหดขึ้น)
    if(goodHits>=cfg.targetCount*0.5 && focusLevel===1 && cfg.focusGroups>=2){
      focusLevel=2;
      activeGroups = pickGroups(2);
      coach('เก่งมาก! เพิ่มหมู่เป้าหมายเป็น 2 หมู่แล้ว');
    }else if(goodHits>=cfg.targetCount*0.8 && focusLevel===2 && cfg.focusGroups>=3){
      focusLevel=3;
      activeGroups = pickGroups(3);
      coach('สุดยอด! ตอนนี้โฟกัสพร้อมกัน 3 หมู่!');
    }

    if(mission.goalDone()) coach('ถึงเป้าหมายจำนวนชิ้นแล้ว ลองทำคอมโบเพิ่ม!');
    if(mission.miniDone()) coach('คอมโบตาม Mini Quest สำเร็จแล้ว!');

    updateQuest();
  }

  function spawnOne(){
    if(timeLeft<=0) return;

    const targetBias = 0.7;
    let emoji, g;
    if(Math.random()<targetBias){
      const tg = activeGroups[(Math.random()*activeGroups.length)|0];
      emoji = randomFrom(GROUPS[tg]);
      g = tg;
    }else{
      emoji = randomFrom(ALL_EMOJI);
      g = foodGroup(emoji);
    }

    const el=document.createElement('div');
    el.textContent=emoji;
    el.dataset.group = g;
    Object.assign(el.style,{
      position:'absolute',
      left:(10+Math.random()*80)+'%',
      top:(18+Math.random()*60)+'%',
      transform:'translate(-50%,-50%)',
      font:'900 46px system-ui',
      textShadow:'0 6px 18px rgba(0,0,0,.55)',
      cursor:'pointer',
      pointerEvents:'auto',
      userSelect:'none'
    });

    const life=cfg.life;
    const kill=()=>{ if(el.parentNode) try{host.removeChild(el);}catch(_){}; };

    el.addEventListener('click',(ev)=>{
      if(!el.parentNode) return;
      kill();
      const groupHit = Number(el.dataset.group||0);
      const isTarget = activeGroups.includes(groupHit);
      if(isTarget) emitScore(140,true,true,ev);
      else         emitScore(-120,false,false,ev);
    });

    host.appendChild(el);
    setTimeout(kill,life);
  }

  function tick(){
    timeLeft--;
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    updateQuest();
    if(timeLeft<=0){
      stopAll();
      finish();
    }
  }

  function stopAll(){
    if(spawnTimer){clearInterval(spawnTimer);spawnTimer=null;}
    if(tickTimer){clearInterval(tickTimer);tickTimer=null;}
  }

  function finish(){
    updateQuest();
    const questsTotal   = 2;
    const questsCleared = (mission.goalDone()?1:0) + (mission.miniDone()?1:0);
    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:'groups',
        difficulty:diff,
        score,
        misses,
        comboMax,
        duration:dur,
        goalCleared:mission.goalDone(),
        questsCleared,
        questsTotal
      }
    }));
  }

  return {
    start(){
      score=0;combo=0;comboMax=0;misses=0;hits=0;timeLeft=dur;
      goodHits=0;activeGroups=pickGroups(cfg.focusGroups);focusLevel=1;
      window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
      updateQuest();
      coach('เก็บอาหารตามหมู่เป้าหมายที่กำหนด ระวังของล่อที่ไม่ใช่หมู่นะ!');
      spawnTimer=setInterval(spawnOne,cfg.spawn);
      tickTimer=setInterval(tick,1000);
    },
    stop(){ stopAll(); }
  };
}

export default { boot };

function randomFrom(arr){ return arr[(Math.random()*arr.length)|0]; }
function pickGroups(n){
  const all=[1,2,3,4,5];
  const out=[];
  while(out.length<n && all.length){
    const i=(Math.random()*all.length)|0;
    out.push(all.splice(i,1)[0]);
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
