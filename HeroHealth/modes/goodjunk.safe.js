// === /HeroHealth/modes/goodjunk.safe.js — DOM mode + MissionDeck ===
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}){
  const layer = prepLayer();
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // pools
  const GOOD=['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // tuning
  let spawnMin=900, spawnMax=1200, life=1600, goodRate=0.65, goalTarget=25;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; goodRate=0.72; goalTarget=20; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=950;  life=1400; goodRate=0.58; goalTarget=30; }

  // state
  let score=0, combo=0, maxCombo=0, misses=0, left=Math.max(1,Math.round(dur));
  let timer=null, spawner=null, watchdog=null, running=true, shield=0;
  let goalCount=0, goalDone=false;

  // mini-quest deck
  const deck = new MissionDeck(); deck.draw3();
  let questSetCleared=0, questSetLocked=false;
  hudQuest(deck.getCurrent());

  // helpers
  function r(a,b){return a+Math.random()*(b-a);}
  function vw(){return Math.max(320, window.innerWidth||320);}
  function vh(){return Math.max(320, window.innerHeight||320);}
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch{} }
  function hudQuest(cur){ fire('hha:quest',{label: cur?cur.label:'กำลังเริ่ม…'}); fire('hha:quest-progress',{list: deck.getProgress()}); }

  // place first target immediately
  const spawnNow = ()=> spawnOne(true);
  const planNext = ()=> { spawner=setTimeout(spawnOne, Math.floor(r(spawnMin,spawnMax))); };

  function spawnOne(forceCenter){
    if(!running) return;
    // choose type
    let ch,type; const roll=Math.random();
    if      (roll<0.04){ ch=STAR; type='star'; }
    else if (roll<0.06){ ch=DIA;  type='diamond'; }
    else if (roll<0.09){ ch=SHIELD; type='shield'; }
    else {
      const good = Math.random()<goodRate;
      ch = (good?GOOD:JUNK)[(Math.random()*(good?GOOD:JUNK).length)|0];
      type = good?'good':'junk';
    }

    const el = document.createElement('div');
    el.className='hha-tgt';
    el.textContent=ch;

    const x = forceCenter? vw()/2 : Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    const y = forceCenter? vh()/2 : Math.floor(vh()*0.18 + Math.random()*vh()*0.62);
    el.style.left=x+'px'; el.style.top=y+'px'; el.style.fontSize=(diff==='easy'?74:diff==='hard'?56:64)+'px';

    let clicked=false;
    function onHit(ev){
      if(clicked) return; clicked=true;
      try{ev.preventDefault();}catch{}
      if(type==='good'){
        const val=20 + combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); goalCount++;
        deck.tick({good:true, score, combo});
      }else if(type==='junk'){
        if(shield>0){ shield--; deck.tick({score,combo}); }
        else{ combo=0; score=Math.max(0, score-15); misses++; deck.tick({junk:true, score, combo}); }
      }else if(type==='star'){ score+=40; deck.tick({star:true, score, combo}); }
      else if(type==='diamond'){ score+=80; deck.tick({diamond:true, score, combo}); }
      else if(type==='shield'){ shield=Math.min(3, shield+1); deck.tick({score,combo}); }

      // goal
      if(!goalDone && goalCount>=goalTarget){ goalDone=true; }

      el.className='hha-tgt hit';
      try{ layer.removeChild(el); }catch{}
      fire('hha:score',{score, combo});

      checkQuestSet();
      hudQuest(deck.getCurrent());
      planNext();
    }

    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    const ttl=setTimeout(()=>{
      if(clicked||!running) return;
      try{ layer.removeChild(el); }catch{}
      combo=0; misses++; deck.tick({junk:true, score, combo});
      hudQuest(deck.getCurrent());
      planNext();
    }, life);

    layer.appendChild(el);
  }

  function checkQuestSet(){
    if(deck.isCleared() && !questSetLocked){
      questSetLocked=true;
      questSetCleared+=1;
      if(left>5){ deck.draw3(); questSetLocked=false; hudQuest(deck.getCurrent()); }
    }
  }

  function tick(){
    if(!running) return;
    left=Math.max(0,left-1);
    deck.second(); hudQuest(deck.getCurrent());
    fire('hha:time',{sec:left});
    if(left<=0) end();
  }

  function end(){
    if(!running) return; running=false;
    try{clearInterval(timer);}catch{}; try{clearTimeout(spawner);}catch{}; try{clearInterval(watchdog);}catch{};
    const mini = questSetCleared + (deck.isCleared() && questSetLocked ? 1 : 0);
    fire('hha:end',{ score, comboMax:maxCombo, miniSetsCleared:mini, goalDone });
    cleanupLayer(layer);
  }

  // timers
  timer=setInterval(tick,1000);
  spawnNow();
  planNext();
  watchdog=setInterval(()=>{ if(!running) return; if(!layer.querySelector('.hha-tgt')) spawnOne(true); }, 2000);

  return { stop:end, pause(){running=false;}, resume(){ if(!running){running=true; planNext();} } };
}

export default { boot };

// ---------- small UI helpers ----------
function prepLayer(){
  if(!document.getElementById('hha-style')){
    const st=document.createElement('style'); st.id='hha-style';
    st.textContent='.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto}'+
      '.hha-tgt{position:absolute;transform:translate(-50%,-50%);font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));transition:transform .12s,opacity .24s;opacity:1}'+
      '.hha-tgt.hit{transform:translate(-50%,-50%) scale(.85);opacity:.15}';
    document.head.appendChild(st);
  }
  const old=document.querySelectorAll('.hha-layer'); old.forEach(n=>{try{n.remove()}catch{}});
  const layer=document.createElement('div'); layer.className='hha-layer'; document.body.appendChild(layer);
  return layer;
}
function cleanupLayer(layer){ try{layer.remove();}catch{} }