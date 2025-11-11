// === /HeroHealth/modes/hydration.quest.js — DOM mode + water gauge + MissionDeck ===
import { MissionDeck } from '../vr/mission.js';

function makeGauge(){
  const wrap=document.createElement('div'); wrap.id='waterWrap'; wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style,{position:'fixed',left:'50%',bottom:'56px',transform:'translateX(-50%)',width:'min(560px,92vw)',zIndex:'900',
    background:'#0f172aCC',border:'1px solid #334155',borderRadius:'12px',padding:'10px 12px',color:'#e8eefc',fontWeight:'800'});
  wrap.innerHTML='<div style="display:flex;justify-content:space-between"><span>Water</span><span id="waterLbl">Balanced</span></div>'+
    '<div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">'+
    '<div id="waterFill" style="height:100%;width:55%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div></div>';
  document.body.appendChild(wrap);
}
function setGauge(v){
  const f=document.getElementById('waterFill'), l=document.getElementById('waterLbl'); if(!f||!l) return;
  const pct=Math.max(0,Math.min(100,Math.round(v))); f.style.width=pct+'%';
  let zone='Low'; if(pct>=40&&pct<=70) zone='Balanced'; else if(pct>70) zone='High';
  l.textContent=zone;
  f.style.background = zone==='Balanced' ? 'linear-gradient(90deg,#06d6a0,#37d67a)' :
    (zone==='High' ? 'linear-gradient(90deg,#22c55e,#93c5fd)' : 'linear-gradient(90deg,#f59e0b,#ef4444)');
}

export async function boot(cfg={}){
  const layer = prepLayer(); makeGauge();
  const diff=String(cfg.difficulty||'normal'); const dur=Number(cfg.duration||60);

  // pools
  const GOOD=['💧','🚰','🥛','🍊','🍋'];
  const BAD =['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // tune
  let spawnMin=900, spawnMax=1200, life=1600, goodRate=0.65, goalTarget=15; // goal = อยู่โซน Balanced รวม 15 วินาที
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; goodRate=0.7; goalTarget=12; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=950;  life=1400; goodRate=0.6; goalTarget=20; }

  let score=0, combo=0, maxCombo=0, misses=0, left=Math.max(1,Math.round(dur));
  let timer=null, spawner=null, watchdog=null, running=true, shield=0;
  let water=55, balancedSec=0, goalDone=false;

  const deck = new MissionDeck(); deck.draw3();
  let questSetCleared=0, questSetLocked=false;
  hudQuest(deck.getCurrent());

  function r(a,b){return a+Math.random()*(b-a);}
  function vw(){return Math.max(320,window.innerWidth||320);}
  function vh(){return Math.max(320,window.innerHeight||320);}
  function fire(name,detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch{} }
  function hudQuest(cur){ fire('hha:quest',{label: cur?cur.label:'กำลังเริ่ม…'}); fire('hha:quest-progress',{list: deck.getProgress()}); }
  function zone(){ return water>=40 && water<=70 ? 'GREEN' : (water>70 ? 'HIGH' : 'LOW'); }

  const spawnNow=()=>spawnOne(true);
  const planNext=()=>{ spawner=setTimeout(spawnOne, Math.floor(r(spawnMin,spawnMax))); };

  function spawnOne(forceCenter){
    if(!running) return;
    // type
    let ch,type; const roll=Math.random();
    if      (roll<0.05){ ch=STAR; type='star'; }
    else if (roll<0.07){ ch=DIA;  type='diamond'; }
    else if (roll<0.10){ ch=SHIELD; type='shield'; }
    else {
      const good=Math.random()<goodRate;
      ch=(good?GOOD:BAD)[(Math.random()*(good?GOOD:BAD).length)|0];
      type=good?'good':'bad';
    }

    const el=document.createElement('div'); el.className='hha-tgt'; el.textContent=ch;
    const x=forceCenter?vw()/2:Math.floor(vw()*0.12+Math.random()*vw()*0.76);
    const y=forceCenter?vh()/2:Math.floor(vh()*0.18+Math.random()*vh()*0.62);
    el.style.left=x+'px'; el.style.top=y+'px'; el.style.fontSize=(diff==='easy'?74:diff==='hard'?56:64)+'px';

    let clicked=false;
    function onHit(ev){
      if(clicked) return; clicked=true; try{ev.preventDefault();}catch{}
      if(type==='good'){
        const val=20+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); water=Math.min(100, water+6);
        deck.tick({good:true, score, combo});
      }else if(type==='bad'){
        if(shield>0){ shield--; deck.tick({score,combo}); }
        else{
          if(zone()==='HIGH'){ score+=5; } else { score=Math.max(0,score-20); combo=0; }
          water=Math.max(0, water-8); deck.tick({junk:true, score, combo});
        }
      }else if(type==='star'){ score+=40; deck.tick({star:true, score, combo}); }
      else if(type==='diamond'){ score+=80; deck.tick({diamond:true, score, combo}); }
      else if(type==='shield'){ shield=Math.min(3,shield+1); deck.tick({score,combo}); }

      setGauge(water);
      el.className='hha-tgt hit';
      try{layer.removeChild(el);}catch{}
      fire('hha:score',{score, combo});
      checkQuestSet();
      hudQuest(deck.getCurrent());
      planNext();
    }

    el.addEventListener('click',onHit,{passive:false});
    el.addEventListener('touchstart',onHit,{passive:false});

    setTimeout(()=>{ if(clicked||!running) return;
      try{layer.removeChild(el);}catch{}; 
      // พลาด good = ลงโทษเบา ๆ
      if(type==='good'){ water=Math.max(0, water-4); score=Math.max(0,score-8); combo=0; misses++; deck.tick({junk:true, score, combo}); setGauge(water); }
      planNext();
    }, life);

    layer.appendChild(el);
  }

  function checkQuestSet(){
    if(deck.isCleared() && !questSetLocked){
      questSetLocked=true; questSetCleared+=1;
      if(left>5){ deck.draw3(); questSetLocked=false; hudQuest(deck.getCurrent()); }
    }
  }

  function tick(){
    if(!running) return;
    left=Math.max(0,left-1);
    // balanced counter + goal
    if(zone()==='GREEN'){ balancedSec++; if(!goalDone && balancedSec>=goalTarget) goalDone=true; }
    deck.second(); hudQuest(deck.getCurrent());
    setGauge(water);
    fire('hha:time',{sec:left});
    if(left<=0) end();
  }

  function end(){
    if(!running) return; running=false;
    try{clearInterval(timer);}catch{}; try{clearTimeout(spawner);}catch{}; try{clearInterval(watchdog);}catch{};
    const mini = questSetCleared + (deck.isCleared() && questSetLocked ? 1 : 0);
    fire('hha:end',{ score, comboMax:maxCombo, miniSetsCleared:mini, goalDone });
    try{ document.getElementById('waterWrap')?.remove(); }catch{}
    cleanupLayer(layer);
  }

  timer=setInterval(tick,1000);
  spawnNow(); planNext();
  watchdog=setInterval(()=>{ if(!running) return; if(!layer.querySelector('.hha-tgt')) spawnOne(true); }, 2000);

  return { stop:end, pause(){running=false;}, resume(){ if(!running){running=true; planNext();} } };
}
export default { boot };

// shared UI helpers
function prepLayer(){
  if(!document.getElementById('hha-style')){
    const st=document.createElement('style'); st.id='hha-style';
    st.textContent='.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto}'+
      '.hha-tgt{position:absolute;transform:translate(-50%,-50%);font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));