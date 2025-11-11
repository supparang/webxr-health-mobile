import { drawThree } from '../vr/quests-powerups.js';

export async function boot(cfg = {}) {
  const MODE_KEY='plate';
  const diff=String(cfg.difficulty||'normal');
  const dur =Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍍','🍌','🍉','🍑'],
    grain:['🍞','🥖','🍚','🍘'],
    protein:['🐟','🍗','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦']
  };
  const STAR='⭐', DIA='💎';

  document.querySelectorAll('.hha-layer').forEach(n=>n.remove());
  const layer=document.createElement('div'); layer.className='hha-layer';
  Object.assign(layer.style,{position:'fixed',inset:'0',zIndex:650}); document.body.appendChild(layer);
  if(!document.getElementById('hha-style')){
    const st=document.createElement('style'); st.id='hha-style';
    st.textContent='.hha-tgt{position:absolute;transform:translate(-50%,-50%);font-size:66px;filter:drop-shadow(0 10px 16px rgba(0,0,0,.5));}.hha-tgt.hit{opacity:.2;transform:translate(-50%,-50%) scale(.85);}';
    document.head.appendChild(st);
  }

  let spawnMin=900, spawnMax=1200, life=1600;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=950;  life=1400; }

  // Mini Deck
  let deck=drawThree(MODE_KEY,diff), deckIdx=0, deckRound=1;
  const mstats={good:0,junk:0,star:0,diamond:0,comboMax:0,noMiss:0,score:0};
  function resetMini(){ mstats.good=0;mstats.junk=0;mstats.star=0;mstats.diamond=0;mstats.comboMax=0;mstats.noMiss=0;mstats.score=0; }
  function startNewDeck(){ deck=drawThree(MODE_KEY,diff); deckIdx=0; deckRound++; resetMini(); emitQuest(); }
  function advance(){ const q=deck[deckIdx]; if(!q) return;
    const ok=q.check({score:mstats.score,goodCount:mstats.good,junkMiss:mstats.junk,comboMax:mstats.comboMax,noMissTime:mstats.noMiss,star:mstats.star,diamond:mstats.diamond});
    if(ok){ if(deckIdx>=deck.length-1){ if(left>1) startNewDeck(); } else { deckIdx++; emitQuest(); } }
  }
  function emitQuest(){
    const q=deck[deckIdx]; const title=q?`Quest ${deckIdx+1}/3 — ${q.label}`:'Mini Quest — กำลังเริ่ม…';
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:title}}));
    const cur=q?.prog?q.prog({score:mstats.score,goodCount:mstats.good,junkMiss:mstats.junk,comboMax:mstats.comboMax,noMissTime:mstats.noMiss,star:mstats.star,diamond:mstats.diamond}):0;
    window.dispatchEvent(new CustomEvent('hha:quest-progress',{detail:{round:deckRound,index:deckIdx,cur,tgt:q?.target??0,label:q?.label||''}}));
  }

  // รอบ “จัดครบ 5 หมู่”
  let roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false};
  function clearRoundIfDone(wpEl){
    if(Object.values(roundDone).every(Boolean)){
      // โบนัส + เริ่มนับรอบใหม่
      roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false};
      fireScore(100,true);
    }
  }

  // state
  let running=true, score=0, combo=0, left=dur;
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}})); emitQuest();

  function fireScore(delta,good){
    if(good){ combo++; mstats.comboMax=Math.max(mstats.comboMax,combo); }
    else { combo=0; mstats.noMiss=0; }
    score=Math.max(0,score+delta); mstats.score=Math.max(mstats.score,score);
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
  }

  let spawnTimer=0, timeTimer=0, watchdog=0;
  function vw(){ return Math.max(320,window.innerWidth||320); }
  function vh(){ return Math.max(320,window.innerHeight||320); }
  function plan(){ spawnTimer=setTimeout(spawnOne, Math.floor(spawnMin+Math.random()*(spawnMax-spawnMin))); }
  function spawnOne(forceCenter){
    if(!running) return;
    let ch,type='food', group=null;
    const r=Math.random();
    if(r<0.05){ ch=STAR; type='star'; }
    else if(r<0.08){ ch=DIA; type='diamond'; }
    else{
      const keys=Object.keys(GROUPS); group=keys[(Math.random()*keys.length)|0];
      const pool=GROUPS[group]; ch=pool[(Math.random()*pool.length)|0];
    }
    const el=document.createElement('div'); el.className='hha-tgt'; el.textContent=ch;
    const x=forceCenter?vw()/2:Math.floor(vw()*0.14+Math.random()*vw()*0.72);
    const y=forceCenter?vh()/2:Math.floor(vh()*0.22+Math.random()*vh()*0.58);
    Object.assign(el.style,{left:x+'px',top:y+'px'}); layer.appendChild(el);

    const ttl=setTimeout(()=>{ if(!el.parentNode) return; layer.removeChild(el); mstats.junk++; combo=0; advance(); }, life);

    function hit(ev){
      ev?.preventDefault?.(); clearTimeout(ttl); try{layer.removeChild(el);}catch{}
      if(type==='star'){ mstats.star++; fireScore(40,true); }
      else if(type==='diamond'){ mstats.diamond++; fireScore(80,true); }
      else{
        mstats.good++; roundDone[group]=true; fireScore(22+combo*2,true); clearRoundIfDone();
      }
      advance(); plan();
    }
    el.addEventListener('click',hit,{passive:false});
    el.addEventListener('touchstart',hit,{passive:false});
  }

  function startTimers(){
    timeTimer=setInterval(()=>{ if(!running) return; left=Math.max(0,left-1);
      window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}}));
      mstats.noMiss=Math.min(999,mstats.noMiss+1); emitQuest();
      if(left<=0) end();
    },1000);
    spawnOne(true); plan();
    watchdog=setInterval(()=>{ if(!running) return; if(layer.querySelectorAll('.hha-tgt').length===0) spawnOne(true); },2000);
  }

  function end(){
    running=false; clearInterval(timeTimer); clearInterval(watchdog); clearTimeout(spawnTimer);
    layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove());
    const clearedInThisSet = deckIdx + ((deck[deckIdx] && deck[deckIdx].check({
      score:mstats.score, goodCount:mstats.good, junkMiss:mstats.junk, comboMax:mstats.comboMax,
      noMissTime:mstats.noMiss, star:mstats.star, diamond:mstats.diamond
    })) ? 1 : 0);
    const miniClearedTotal = (deckRound-1)*3 + Math.min(3, clearedInThisSet);
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:MODE_KEY,difficulty:diff,score,combo,duration:dur,miniQuestCleared:miniClearedTotal,miniQuestRounds:deckRound
    }}));
    layer.remove();
  }

  startTimers();
  return { stop:end, pause(){running=false;}, resume(){ if(!running){ running=true; startTimers(); } } };
}
export default { boot };