// === /HeroHealth/modes/goodjunk.safe.js ===
// คลิกของดี บวกคะแนน / ของเสีย หักคะแนน + นับ goal + mini quest

import { burstAt, scorePop } from '../vr/particles.js';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];

const diffCfg = {
  easy:   { spawn:900,  life:2200, goalScore: 800, maxMiss:10 },
  normal: { spawn:750,  life:2000, goalScore:1600, maxMiss: 8 },
  hard:   { spawn:620,  life:1800, goalScore:2400, maxMiss: 6 }
};

export async function boot(opts = {}) {
  const diff = (opts.difficulty||'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML = '';

  let score=0, combo=0, comboMax=0, misses=0, hits=0;
  let timeLeft=dur;
  let spawnTimer=null, tickTimer=null;

  const stats = { score, combo, comboMax, misses, hits, timeLeft };

  function updateStats(){
    stats.score   = score;
    stats.combo   = combo;
    stats.comboMax= comboMax;
    stats.misses  = misses;
    stats.hits    = hits;
    stats.timeLeft= timeLeft;
  }

  // ---------- Quest model ----------
  const mission = {
    goalLabel : `ทำคะแนนรวม ${cfg.goalScore}+`,
    goalTarget: cfg.goalScore,
    goalProg  : ()=>score,
    goalDone  : ()=>score >= cfg.goalScore,
    miniLabel : `พลาดไม่เกิน ${cfg.maxMiss} ครั้ง`,
    miniTarget: cfg.maxMiss,
    miniProg  : ()=>misses,
    miniDone  : ()=>misses <= cfg.maxMiss
  };

  function emitQuest(){
    updateStats();
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

  // ---------- Score emit ----------
  function emitScore(delta, good, ev){
    score = Math.max(0, score + delta);
    if(good){
      combo++;
      hits++;
      comboMax = Math.max(comboMax, combo);
    }else{
      combo = 0;
      misses++;
    }

    updateStats();

    const detail = {
      delta,
      total: score,
      combo,
      comboMax,
      good
    };
    window.dispatchEvent(new CustomEvent('hha:score',{detail}));

    if(ev){
      const x = ev.clientX, y = ev.clientY;
      burstAt(x,y,{color:good?'#22c55e':'#ef4444'});
      const txt = (delta>0?'+':'')+delta;
      scorePop(x,y,txt,{good});
    }

    // โค้ชเล็ก ๆ
    if(good && combo===5)  coach('เยี่ยมเลย! คอมโบ 5 แล้ว ลุยต่อ!');
    if(good && combo===10) coach('สุดยอด! คอมโบ 10 ต่อเนื่อง!');
    if(!good && misses===cfg.maxMiss-1) coach('ระวังนะ ใกล้ครบโควต้าพลาดแล้ว!');
    if(mission.goalDone()) coach('ถึงเป้าคะแนนรวมแล้ว ลองดันให้สูงกว่านี้!');
    if(mission.miniDone() && misses>0) coach('ยังไม่เกินโควต้าพลาด เล่นต่อให้จบเกมนะ');

    emitQuest();
  }

  // ---------- Spawn ----------
  function randomBy(arr){ return arr[(Math.random()*arr.length)|0]; }

  function spawnOne(){
    if(timeLeft<=0) return;
    const isGood = Math.random() < 0.7; // 70% good
    const emoji  = isGood ? randomBy(GOOD) : randomBy(JUNK);

    const el = document.createElement('div');
    el.textContent = emoji;
    el.dataset.kind = isGood ? 'good' : 'junk';
    Object.assign(el.style,{
      position:'absolute',
      left:(10+Math.random()*80)+'%',
      top:(15+Math.random()*60)+'%',
      transform:'translate(-50%,-50%)',
      font:'900 46px system-ui',
      textShadow:'0 6px 18px rgba(0,0,0,.55)',
      cursor:'pointer',
      pointerEvents:'auto',
      userSelect:'none'
    });

    const life = cfg.life;
    const kill = ()=>{
      if(!el.parentNode) return;
      try{ host.removeChild(el); }catch(_){}
    };

    el.addEventListener('click',(ev)=>{
      if(!el.parentNode) return;
      kill();
      const kind = el.dataset.kind;
      if(kind==='good') emitScore(120,true,ev);
      else             emitScore(-150,false,ev);
    });

    host.appendChild(el);
    setTimeout(kill, life);
  }

  // ---------- Timer ----------
  function tick(){
    timeLeft--;
    updateStats();
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    emitQuest();

    if(timeLeft<=0){
      stopAll();
      finish();
    }
  }

  function stopAll(){
    if(spawnTimer){ clearInterval(spawnTimer); spawnTimer=null; }
    if(tickTimer){ clearInterval(tickTimer);  tickTimer=null; }
  }

  function finish(){
    emitQuest();
    const questsTotal   = 2;
    const questsCleared = (mission.goalDone()?1:0) + (mission.miniDone()?1:0);

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:'goodjunk',
        difficulty:diff,
        score,
        misses,
        comboMax,
        duration: dur,
        goalCleared: mission.goalDone(),
        questsCleared,
        questsTotal
      }
    }));
  }

  // controller ที่ main.js จะเรียก start()
  return {
    start(){
      score=0;combo=0;comboMax=0;misses=0;hits=0;timeLeft=dur;
      updateStats();
      setTimeout(()=>emitQuest(),50);
      window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
      coach('โฟกัสของดี หลีกเลี่ยงของเสีย พยายามไม่พลาดเกินโควต้า!');
      spawnTimer=setInterval(spawnOne,cfg.spawn);
      tickTimer =setInterval(tick,1000);
    },
    stop(){ stopAll(); }
  };
}

export default { boot };

// helper เผื่อไม่มี host
function makeHost(){
  const h=document.createElement('div');
  h.id='spawnHost';
  Object.assign(h.style,{position:'absolute',inset:0,pointerEvents:'none',zIndex:650});
  document.body.appendChild(h);
  return h;
}
