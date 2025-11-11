// === /HeroHealth/modes/plate.quest.js (complete 5 groups per round) ===
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GROUPS = {
    veg: ['🥦','🥕','🥬','🍅','🌽'],
    fruit: ['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain: ['🍞','🥖','🍚','🍘'],
    protein: ['🐟','🍗','🥚','🫘','🥜'],
    dairy: ['🥛','🧀','🍦'],
  };
  const ALL = Object.entries(GROUPS).flatMap(([k,v])=>v.map(x=>({ch:x,g:k})));

  let spawnMin=900, spawnMax=1200, life=1600;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=980;  life=1400; }

  injectCSS(); const layer=freshLayer();

  let score=0, combo=0, misses=0, left=dur, running=true;
  let spawnTimer=null, timeTimer=null, watchdog=null;

  // เป้าหมายหลัก: “จัดครบ 5 หมู่” N รอบ
  const goalTargetRounds = 2;
  let roundCollected = resetRound(); // {veg:false,...}
  let roundsDone = 0;

  // mission deck
  const deck = new MissionDeck({
    pool: [
      { id:'round1',  level:'easy',   label:'จัดครบ 5 หมู่ 1 รอบ', check:s=>s.goodCount>=5,  prog:s=>Math.min(5,s.goodCount), target:5 },
      { id:'combo12', level:'normal', label:'คอมโบ 12',             check:s=>s.comboMax>=12, prog:s=>Math.min(12,s.comboMax), target:12 },
      { id:'score600',level:'hard',   label:'คะแนน 600+',           check:s=>s.score>=600,   prog:s=>Math.min(600,s.score),   target:600},
    ]
  });
  deck.draw3();

  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch{} }
  function hudGoal(){
    const v = Math.min(goalTargetRounds*5, doneCount() + roundsDone*5);
    fire('hha:goal', { label:`เป้า: จัดครบ 5 หมู่ ให้ได้ ${goalTargetRounds} รอบ`, value:v, max:goalTargetRounds*5, mode:diff });
  }
  function hudQuest(){
    const list=deck.getProgress(); const cur=list.find(x=>x.current)||list[0]||null;
    fire('hha:quest',{label:cur?cur.label:'Mini Quest — กำลังเริ่ม…'});
    fire('hha:quest-progress',{label:cur?cur.label:'', value:cur&&Number.isFinite(cur.prog)?cur.prog:0, max:cur&&Number.isFinite(cur.target)?cur.target:0});
  }
  hudGoal(); hudQuest(); fire('hha:score',{score,combo}); fire('hha:time',{sec:left});

  planNextSpawn(); startWatchdog();
  timeTimer=setInterval(()=>{
    if(!running) return;
    left=Math.max(0,left-1);
    deck.second(); hudQuest(); fire('hha:time',{sec:left});
    if(left<=0){ end(); return; }
    if(deck.isCleared() && left>0){ deck.draw3(); hudQuest(); }
  },1000);

  function spawnOne(forceCenter){
    if(!running) return;
    const pick = ALL[(Math.random()*ALL.length)|0];
    const el=document.createElement('div'); el.className='hha-tgt'; el.textContent=pick.ch; sizeByDiff(el); place(el,forceCenter); layer.appendChild(el);
    let clicked=false;
    const onHit=(ev)=>{
      if(clicked) return; clicked=true; ev&&ev.preventDefault&&ev.preventDefault(); try{layer.removeChild(el);}catch{}
      const delta=22+combo*2; score+=delta; combo=Math.min(9999,combo+1);
      if(!roundCollected[pick.g]){ roundCollected[pick.g]=true; }
      if(doneCount()>=5){ roundsDone=Math.min(goalTargetRounds, roundsDone+1); roundCollected=resetRound(); score+=100; }
      deck.onGood(); deck.updateScore(score); deck.updateCombo(combo);
      hudGoal(); fire('hha:score',{score,combo}); hudQuest(); planNextSpawn();
    };
    el.addEventListener('click',onHit,{passive:false}); el.addEventListener('touchstart',onHit,{passive:false});
    setTimeout(()=>{
      if(clicked||!running) return; try{layer.removeChild(el);}catch{}
      combo=0; misses++; deck.onJunk(); deck.updateCombo(combo); hudQuest(); planNextSpawn();
    }, life);
  }

  function end(){
    if(!running) return; running=false;
    try{clearInterval(timeTimer);}catch{} try{clearTimeout(spawnTimer);}catch{} try{clearInterval(watchdog);}catch{}
    wipe(layer);
    const prog=deck.getProgress(); const questsCleared=prog.filter(p=>p.done).length;
    const goalDone = (roundsDone >= goalTargetRounds);
    fire('hha:end',{score,combo,misses,duration:dur,goal:goalDone,questsCleared,questsTotal:3});
  }

  // helpers
  function resetRound(){ return {veg:false,fruit:false,grain:false,protein:false,dairy:false}; }
  function doneCount(){ return Object.values(roundCollected).filter(Boolean).length; }
  function planNextSpawn(){ const w=Math.floor(spawnMin+Math.random()*(spawnMax-spawnMin)); spawnTimer=setTimeout(spawnOne,w); }
  function startWatchdog(){ if(watchdog) clearInterval(watchdog); watchdog=setInterval(()=>{ if(!running) return; if(layer.querySelectorAll('.hha-tgt').length===0) spawnOne(true); },2000); }
  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }
  function sizeByDiff(el){ el.style.fontSize=(diff==='easy'?74:(diff==='hard'?56:64))+'px'; }
  function place(el,center){ const x=center?vw()/2:Math.floor(vw()*0.14+Math.random()*vw()*0.72); const y=center?vh()/2:Math.floor(vh()*0.20+Math.random()*vh()*0.56); el.style.left=x+'px'; el.style.top=y+'px'; }

  return { stop:end, pause(){running=false;}, resume(){ if(!running){ running=true; planNextSpawn(); startWatchdog(); } } };
}

function injectCSS(){ if(document.getElementById('hha-style')) return; const st=document.createElement('style'); st.id='hha-style'; st.textContent='.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto}.hha-tgt{position:absolute;transform:translate(-50%,-50%);line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5))}'; document.head.appendChild(st); }
function freshLayer(){ document.querySelectorAll('.hha-layer').forEach(n=>{try{n.remove();}catch{}}); const d=document.createElement('div'); d.className='hha-layer'; document.body.appendChild(d); return d; }
function wipe(layer){ try{ layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove()); layer.remove(); }catch{} }

export default { boot };