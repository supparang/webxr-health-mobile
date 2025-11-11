// === /HeroHealth/modes/groups.safe.js (pick by food group) ===
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GROUPS = {
    veg: ['🥦','🥕','🥬','🍅','🌽'],
    fruit: ['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐'],
    grain: ['🍞','🥖','🍚','🍘'],
    protein: ['🐟','🍗','🥚','🫘','🥜'],
    dairy: ['🥛','🧀','🍦'],
  };
  const ALL = Object.values(GROUPS).flat();
  const groupKeys = Object.keys(GROUPS);

  let spawnMin=900, spawnMax=1200, life=1600;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=980;  life=1400; }

  injectCSS(); const layer=freshLayer();

  let score=0, combo=0, misses=0, left=dur, running=true;
  let spawnTimer=null, timeTimer=null, watchdog=null;

  // เป้าหมายหลัก: “เลือกให้ถูกหมู่” ให้ครบ N ครั้งต่อรอบ (ที่นี่นับรวม)
  const goalTarget = 12;
  let goalCount=0;

  // โจทย์หมู่ปัจจุบัน
  let target = groupKeys[(Math.random()*groupKeys.length)|0];

  // mission deck
  const deck = new MissionDeck({
    pool: [
      { id:'goal6',  level:'easy',   label:'เข้าหมู่ถูก 6 ครั้ง', check:s=>s.goodCount>=6,  prog:s=>Math.min(6,s.goodCount), target:6  },
      { id:'combo10',level:'normal', label:'คอมโบ 10',            check:s=>s.comboMax>=10, prog:s=>Math.min(10,s.comboMax),  target:10 },
      { id:'score500',level:'hard',  label:'คะแนน 500+',          check:s=>s.score>=500,   prog:s=>Math.min(500,s.score),    target:500},
    ]
  });
  deck.draw3();

  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch{} }
  function hudGoal(){
    fire('hha:goal', { label:`เป้า: เลือกกลุ่มที่ถูกต้อง (${target.toUpperCase()}) × ${goalTarget}`, value:goalCount, max:goalTarget, mode:diff });
  }
  function setNewTarget(){ target = groupKeys[(Math.random()*groupKeys.length)|0]; goalCount=0; hudGoal(); }
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
    let ch;
    // 30% การันตีจากหมู่เป้า
    if(Math.random()<0.30){
      const pool = GROUPS[target]; ch = pool[(Math.random()*pool.length)|0];
    }else ch = ALL[(Math.random()*ALL.length)|0];

    const inTarget = GROUPS[target].includes(ch);
    const el=document.createElement('div'); el.className='hha-tgt'; el.textContent=ch; sizeByDiff(el); place(el,forceCenter); layer.appendChild(el);
    let clicked=false;
    const onHit=(ev)=>{
      if(clicked) return; clicked=true; ev&&ev.preventDefault&&ev.preventDefault(); try{layer.removeChild(el);}catch{}
      if(inTarget){
        const delta=25+combo*2; score+=delta; combo=Math.min(9999,combo+1);
        goalCount=Math.min(goalTarget, goalCount+1);
        deck.onGood(); deck.updateScore(score); deck.updateCombo(combo); hudGoal();
        if(goalCount>=goalTarget) setNewTarget();
      }else{
        combo=0; misses++; deck.onJunk(); deck.updateCombo(combo);
      }
      fire('hha:score',{score,combo}); hudQuest(); planNextSpawn();
    };
    el.addEventListener('click',onHit,{passive:false}); el.addEventListener('touchstart',onHit,{passive:false});

    setTimeout(()=>{
      if(clicked||!running) return; try{layer.removeChild(el);}catch{}
      if(inTarget){ combo=0; misses++; deck.onJunk(); deck.updateCombo(combo); }
      else { deck.onJunk(); }
      hudQuest(); planNextSpawn();
    },life);
  }

  function end(){
    if(!running) return; running=false;
    try{clearInterval(timeTimer);}catch{} try{clearTimeout(spawnTimer);}catch{} try{clearInterval(watchdog);}catch{}
    wipe(layer);
    const prog=deck.getProgress(); const questsCleared=prog.filter(p=>p.done).length;
    fire('hha:end',{score,combo,misses,duration:dur,goal:goalCount>=goalTarget,questsCleared,questsTotal:3});
  }

  // helpers
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