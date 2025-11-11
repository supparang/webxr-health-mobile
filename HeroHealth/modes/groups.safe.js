// === /HeroHealth/modes/groups.safe.js — DOM mode + MissionDeck ===
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg={}){
  const layer=prepLayer(); const diff=String(cfg.difficulty||'normal'); const dur=Number(cfg.duration||60);

  const GROUPS={
    veg:['🥦','🥕','🥬','🍅','🧄','🧅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain:['🍞','🥖','🥯','🥐','🍚','🍘'],
    protein:['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦','🍨','🍮']
  };
  const ALL=Object.values(GROUPS).flat();
  const keys=Object.keys(GROUPS);
  let target=keys[(Math.random()*keys.length)|0];

  let spawnMin=900, spawnMax=1200, life=1600, goalSize=1, correctPicked=0, maxConcurrent=3, guaranteeRate=0.3;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; maxConcurrent=2; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=950;  life=1400; maxConcurrent=4; }

  let score=0, combo=0, maxCombo=0, misses=0, left=Math.max(1,Math.round(dur));
  let timer=null, spawner=null, watchdog=null, running=true;

  const deck = new MissionDeck(); deck.draw3();
  let questSetCleared=0, questSetLocked=false;
  hudQuest(deck.getCurrent());

  function fire(n,d){ try{window.dispatchEvent(new CustomEvent(n,{detail:d}))}catch{} }
  function hudQuest(cur){ fire('hha:quest',{label: cur?`เป้า: ${target.toUpperCase()} • ${cur.label}`:`เป้า: ${target.toUpperCase()}`}); fire('hha:quest-progress',{list: deck.getProgress()}); }
  function vw(){return Math.max(320,window.innerWidth||320);} function vh(){return Math.max(320,window.innerHeight||320);}
  function planNext(){ spawner=setTimeout(spawnOne, Math.floor(900+Math.random()*300)); }
  function setGoal(){ target=keys[(Math.random()*keys.length)|0]; correctPicked=0; }

  function spawnOne(forceCenter){
    if(!running) return;
    // limit density
    if(layer.querySelectorAll('.hha-tgt').length>=maxConcurrent){ planNext(); return; }

    let ch;
    if(Math.random()<guaranteeRate){
      const pool=GROUPS[target]; ch=pool[(Math.random()*pool.length)|0];
    }else{ ch=ALL[(Math.random()*ALL.length)|0]; }
    const inTarget = GROUPS[target].includes(ch);

    const el=document.createElement('div'); el.className='hha-tgt'; el.textContent=ch;
    const x=forceCenter?vw()/2:Math.floor(vw()*0.12+Math.random()*vw()*0.76);
    const y=forceCenter?vh()/2:Math.floor(vh()*0.18+Math.random()*vh()*0.62);
    el.style.left=x+'px'; el.style.top=y+'px';

    let clicked=false;
    function onHit(ev){
      if(clicked) return; clicked=true; try{ev.preventDefault();}catch{}
      if(inTarget){
        const val=25+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo);
        correctPicked++; deck.tick({good:true, score, combo});
        if(correctPicked>=goalSize){ goalSize=Math.min(3,goalSize+1); setGoal(); }
      }else{
        combo=0; score=Math.max(0,score-12); deck.tick({junk:true, score, combo});
      }
      el.className='hha-tgt hit'; try{layer.removeChild(el);}catch{}
      fire('hha:score',{score,combo}); checkQuestSet(); hudQuest(deck.getCurrent()); planNext();
    }

    el.addEventListener('click',onHit,{passive:false});
    el.addEventListener('touchstart',onHit,{passive:false});

    setTimeout(()=>{ if(clicked||!running) return; if(inTarget){ combo=0; score=Math.max(0,score-10); misses++; deck.tick({junk:true, score, combo}); } try{layer.removeChild(el);}catch{}; planNext(); }, life);

    layer.appendChild(el);
  }

  function checkQuestSet(){ if(deck.isCleared()&&!questSetLocked){ questSetLocked=true; questSetCleared++; if(left>5){ deck.draw3(); questSetLocked=false; } } }

  function tick(){ if(!running) return; left=Math.max(0,left-1); deck.second(); hudQuest(deck.getCurrent()); fire('hha:time',{sec:left}); if(left<=0) end(); }

  function end(){ if(!running) return; running=false; try{clearInterval(timer);}catch{}; try{clearTimeout(spawner);}catch{}; try{clearInterval(watchdog);}catch{};
    const mini=questSetCleared+(deck.isCleared()&&questSetLocked?1:0);
    fire('hha:end',{ score, comboMax:maxCombo, miniSetsCleared:mini, goalDone:true }); // goal ของโหมดนี้คือ “ทำเป้าตาม target” ต่อเนื่อง — ถือว่าสำเร็จเมื่อเล่นครบเวลา
    cleanupLayer(layer);
  }

  timer=setInterval(tick,1000); spawnOne(true); planNext();
  watchdog=setInterval(()=>{ if(!running) return; if(!layer.querySelector('.hha-tgt')) spawnOne(true); }, 2000);

  return { stop:end, pause(){running=false;}, resume(){ if(!running){running=true; planNext();} } };
}
export default { boot };

function prepLayer(){
  if(!document.getElementById('hha-style')){
    const st=document.createElement('style'); st.id='hha-style';
    st.textContent='.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto}.hha-tgt{position:absolute;transform:translate(-50%,-50%);font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));transition:transform .12s,opacity .24s;opacity:1}.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15}';
    document.head.appendChild(st);
  }
  document.querySelectorAll('.hha-layer').forEach(n=>{try{n.remove()}catch{}});
  const layer=document.createElement('div'); layer.className='hha-layer'; document.body.appendChild(layer);
  return layer;
}
function cleanupLayer(layer){ try{layer.remove();}catch{} }