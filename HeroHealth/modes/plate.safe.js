// === /HeroHealth/modes/plate.safe.js ===
// เกมจัดจาน 5 หมู่: quota ต่อจาน + goal/mini

import { burstAt, scorePop } from '../vr/particles.js';

const GROUPS = {
  1: ['🍚','🍙','🍞','🥐','🥖','🥯'],
  2: ['🥩','🍗','🍖','🥚','🧀','🥓'],
  3: ['🥦','🥕','🍅','🥬','🌽','🥗'],
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],
  5: ['🥛','🧈','🧀','🍨','🧋']
};

const ALL = Object.values(GROUPS).flat();

function foodGroup(emo){
  for (const [g,list] of Object.entries(GROUPS)){
    if (list.includes(emo)) return Number(g);
  }
  return 0;
}

const baseQuota = { 1:2,2:1,3:2,4:1,5:1 };

const diffCfg = {
  easy:   { spawn:900, life:2300, goalSets:1, maxMiss:10 },
  normal: { spawn:800, life:2100, goalSets:2, maxMiss:8  },
  hard:   { spawn:700, life:1900, goalSets:3, maxMiss:6  }
};

export async function boot(opts = {}) {
  const diff = (opts.difficulty||'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML = '';

  let score=0, combo=0, comboMax=0, misses=0, hits=0;
  let timeLeft=dur;

  let setsCompleted = 0;

  let spawnTimer=null, tickTimer=null;

  let quota   = newSetQuota();
  let filled  = resetFill();

  function newSetQuota(){
    // สำเนา baseQuota
    return {1:baseQuota[1],2:baseQuota[2],3:baseQuota[3],4:baseQuota[4],5:baseQuota[5]};
  }
  function resetFill(){ return {1:0,2:0,3:0,4:0,5:0}; }

  function isSetDone(){
    for (let g=1; g<=5; g++){
      if ((filled[g]||0) < (quota[g]||0)) return false;
    }
    return true;
  }

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}}));
  }

  // ---------- Quest ----------
  const mission = {
    goalLabel  : `จัดจาน 5 หมู่ให้ครบ ${cfg.goalSets} ชุด`,
    goalTarget : cfg.goalSets,
    goalProg   : ()=>setsCompleted,
    goalDone   : ()=>setsCompleted >= cfg.goalSets,

    miniLabel  : `เลือกหมู่ผิดไม่เกิน ${cfg.maxMiss} ครั้ง`,
    miniTarget : cfg.maxMiss,
    miniProg   : ()=>misses,
    miniDone   : ()=>misses <= cfg.maxMiss
  };

  function emitQuest(){
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

  // ---------- Score ----------
  function emitScore(delta, good, ev){
    score = Math.max(0, score + delta);
    if (good){
      combo++;
      hits++;
      comboMax = Math.max(comboMax, combo);
    }else{
      combo=0;
      misses++;
    }

    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ delta, total:score, combo, comboMax, good }
    }));

    if (ev){
      const x=ev.clientX,y=ev.clientY;
      burstAt(x,y,{color:good?'#22c55e':'#f97316'});
      const txt=(delta>0?'+':'')+delta;
      scorePop(x,y,txt,{good});
    }

    if (good && combo===5)  coach('จัดจานได้เนียนมาก! คอมโบ 5 แล้ว 👏');
    if (!good && misses===3) coach('ลองสังเกตโควต้าหมู่ที่ยังไม่ครบ แล้วเลือกให้ตรงหมู่');

    if (mission.goalDone()) coach('ทำจานครบตามเป้าหมายแล้ว เยี่ยมมาก!');
    if (mission.miniDone()) coach('Mini Quest ผ่าน! เลือกหมู่ผิดไม่เกินโควต้าแล้ว');

    emitQuest();
  }

  // ---------- Spawn ----------
  function spawnOne(){
    if (timeLeft<=0) return;

    // หา “หมู่ที่ยังไม่ครบโควต้า”
    const needGroups = [];
    for (let g=1; g<=5; g++){
      if ((filled[g]||0) < (quota[g]||0)) needGroups.push(g);
    }

    let emoji, g;
    const needBias = 0.7;

    if (needGroups.length && Math.random()<needBias){
      // spawn ตามหมู่ที่ยังไม่ครบ
      g = pickOne(needGroups);
      emoji = pickOne(GROUPS[g]);
    }else{
      emoji = pickOne(ALL);
      g = foodGroup(emoji);
    }

    const el=document.createElement('div');
    el.textContent = emoji;
    el.dataset.group = g;
    Object.assign(el.style,{
      position:'absolute',
      left:(12+Math.random()*76)+'%',
      top:(18+Math.random()*60)+'%',
      transform:'translate(-50%,-50%)',
      font:'900 46px system-ui',
      textShadow:'0 6px 18px rgba(0,0,0,.55)',
      cursor:'pointer',
      pointerEvents:'auto',
      userSelect:'none'
    });

    const life = cfg.life;
    const kill=()=>{ if(el.parentNode) try{host.removeChild(el);}catch(_){ } };

    el.addEventListener('click',(ev)=>{
      if(!el.parentNode) return;
      kill();

      const groupHit = Number(el.dataset.group||0);
      const canUse   = quota[groupHit] && filled[groupHit] < quota[groupHit];

      if (canUse){
        // เติมโควต้าจาน
        filled[groupHit] = (filled[groupHit]||0)+1;
        emitScore(+140,true,ev);

        if (isSetDone()){
          setsCompleted++;
          coach(`จานครบทั้ง 5 หมู่แล้ว! ชุดที่ ${setsCompleted}`);
          // เริ่มจานใหม่
          quota  = newSetQuota();
          filled = resetFill();
        }
      }else{
        emitScore(-120,false,ev);
      }
    });

    host.appendChild(el);
    setTimeout(kill,life);
  }

  // ---------- Timer ----------
  function tick(){
    timeLeft--;
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    emitQuest();
    if (timeLeft<=0){
      stopAll();
      finish();
    }
  }

  function stopAll(){
    if (spawnTimer){clearInterval(spawnTimer);spawnTimer=null;}
    if (tickTimer){clearInterval(tickTimer);tickTimer=null;}
  }

  function finish(){
    emitQuest();
    const questsTotal   = 2;
    const questsCleared = (mission.goalDone()?1:0) + (mission.miniDone()?1:0);

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:'plate',
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
      score=0;combo=0;comboMax=0;misses=0;hits=0;
      timeLeft=dur;setsCompleted=0;
      quota  = newSetQuota();
      filled = resetFill();
      window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
      emitQuest();
      coach('สังเกตโควต้าจาน 5 หมู่ แล้วเลือกอาหารให้ตรงหมู่ที่ยังไม่ครบ!');
      spawnTimer=setInterval(spawnOne,cfg.spawn);
      tickTimer=setInterval(tick,1000);
    },
    stop(){ stopAll(); }
  };
}

export default { boot };

function pickOne(arr){ return arr[(Math.random()*arr.length)|0]; }

function makeHost(){
  const h=document.createElement('div');
  h.id='spawnHost';
  Object.assign(h.style,{
    position:'absolute',
    inset:0,
    pointerEvents:'none',
    zIndex:650
  });
  document.body.appendChild(h);
  return h;
}
