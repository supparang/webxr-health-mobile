// === /HeroHealth/modes/hydration.quest.js (water gauge + HUD goals + mini quests) ===
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // pools
  const GOOD = ['💧','🚰','🥛','🍊','🍋']; // เพิ่มน้ำ
  const BAD  = ['🧋','🥤','🍹','🧃','🍺']; // ลดน้ำ
  let spawnMin=900, spawnMax=1200, life=1600, goodRate=0.65;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; goodRate=0.72; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=980;  life=1400; goodRate=0.58; }

  // DOM
  injectCSS();
  const layer = freshLayer();
  ensureWaterGauge();

  // state
  let score=0, combo=0, misses=0;
  let water=55; setWaterGauge(water);
  let left=dur, running=true;
  let spawnTimer=null, timeTimer=null, watchdog=null;

  // goal: อยู่ในโซน Balanced ให้ครบ N วิ
  const goalTarget = 15;
  let balancedSec = 0;

  // mini-quest deck (10 ใบเลือก 3)
  const deck = new MissionDeck({
    pool: [
      { id:'combo10',    level:'easy',   label:'คอมโบ 10',                 check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax), target:10 },
      { id:'good12',     level:'easy',   label:'เก็บของน้ำดี 12 ชิ้น',     check:s=>s.goodCount>=12,  prog:s=>Math.min(12,s.goodCount),target:12 },
      { id:'avoid6',     level:'easy',   label:'หลีกของหวาน 6 ครั้ง',      check:s=>s.junkMiss>=6,    prog:s=>Math.min(6,s.junkMiss),  target:6  },
      { id:'balanced10', level:'normal', label:'รักษา Balanced 10 วิ',      check:s=>s.noMissTime>=10, prog:s=>Math.min(10,s.noMissTime),target:10 },
      { id:'star2',      level:'normal', label:'เก็บดาว ⭐ 2',              check:s=>s.star>=2,        prog:s=>Math.min(2,s.star),      target:2  },
      { id:'score500',   level:'normal', label:'ทำคะแนน 500+',              check:s=>s.score>=500,     prog:s=>Math.min(500,s.score),   target:500},
      { id:'diamond1',   level:'hard',   label:'เก็บเพชร 💎 1',              check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),   target:1  },
      { id:'combo18',    level:'hard',   label:'คอมโบ 18',                  check:s=>s.comboMax>=18,   prog:s=>Math.min(18,s.comboMax), target:18 },
      { id:'good20',     level:'hard',   label:'เก็บของน้ำดี 20 ชิ้น',     check:s=>s.goodCount>=20,  prog:s=>Math.min(20,s.goodCount),target:20 },
      { id:'balanced15', level:'hard',   label:'Balanced 15 วิ',            check:s=>s.noMissTime>=15, prog:s=>Math.min(15,s.noMissTime),target:15 },
    ]
  });
  deck.draw3();

  // HUD emit
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch{} }
  function hudGoal(){
    fire('hha:goal', { label:`เป้า: Balanced ให้ครบ ${goalTarget} วิ`, value:balancedSec, max:goalTarget, mode:diff });
  }
  function hudQuest(){
    const list = deck.getProgress(); const cur = list.find(x=>x.current)||list[0]||null;
    fire('hha:quest', { label: cur ? cur.label : 'Mini Quest — กำลังเริ่ม…' });
    fire('hha:quest-progress', {
      label: cur ? cur.label : '',
      value: cur && Number.isFinite(cur.prog) ? cur.prog : 0,
      max: cur && Number.isFinite(cur.target) ? cur.target : 0
    });
  }
  hudGoal(); hudQuest(); fire('hha:score', {score, combo}); fire('hha:time', {sec:left});

  // spawn + time
  planNextSpawn(); startWatchdog();
  timeTimer = setInterval(()=>{
    if(!running) return;
    left = Math.max(0,left-1);

    // noMissTime = ถ้าในโซน Balanced เท่านั้น
    if(zone()==='GREEN'){ balancedSec=Math.min(goalTarget, balancedSec+1); deck.stats.noMissTime = Math.min(9999, deck.stats.noMissTime+1); }
    else { deck.stats.noMissTime = 0; }
    hudGoal(); deck.second(); hudQuest();

    fire('hha:time',{sec:left});
    if(left<=0){ end(); return; }
    if(deck.isCleared() && left>0){ deck.draw3(); hudQuest(); }
  },1000);

  function spawnOne(forceCenter){
    if(!running) return;
    const isGood = Math.random() < goodRate;
    const ch = pick(isGood ? GOOD : BAD);

    const el = document.createElement('div');
    el.className='hha-tgt';
    el.textContent=ch; sizeByDiff(el); place(el, forceCenter); layer.appendChild(el);
    let clicked=false;

    const onHit=(ev)=>{
      if(clicked) return; clicked=true; ev && ev.preventDefault && ev.preventDefault(); try{layer.removeChild(el);}catch{}
      if(isGood){
        const delta = 20 + combo*2;
        score += delta; combo=Math.min(9999, combo+1);
        water = Math.min(100, water+6);
        deck.onGood(); deck.updateScore(score); deck.updateCombo(combo);
      }else{
        combo=0; misses++;
        water = Math.max(0, water-8);
        deck.onJunk(); deck.updateCombo(combo);
      }
      setWaterGauge(water);
      fire('hha:score',{score, combo}); hudQuest();
      planNextSpawn();
    };
    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    setTimeout(()=>{
      if(clicked||!running) return;
      try{layer.removeChild(el);}catch{}
      if(isGood){ combo=0; misses++; deck.onJunk(); deck.updateCombo(combo); water=Math.max(0, water-4); setWaterGauge(water); }
      else { deck.onJunk(); } // หลบของไม่ดี นับความพยายาม
      hudQuest(); planNextSpawn();
    }, life);
  }

  function end(){
    if(!running) return; running=false;
    try{clearInterval(timeTimer);}catch{} try{clearTimeout(spawnTimer);}catch{} try{clearInterval(watchdog);}catch{}
    wipe(layer); destroyWaterGauge();
    const prog=deck.getProgress(); const questsCleared=prog.filter(p=>p.done).length;
    fire('hha:end',{score, combo, misses, duration:dur, goal: balancedSec>=goalTarget, questsCleared, questsTotal:3});
  }

  // helpers
  function planNextSpawn(){ const w=Math.floor(spawnMin+Math.random()*(spawnMax-spawnMin)); spawnTimer=setTimeout(spawnOne, w); }
  function startWatchdog(){ if(watchdog) clearInterval(watchdog); watchdog=setInterval(()=>{ if(!running) return; if(layer.querySelectorAll('.hha-tgt').length===0) spawnOne(true); },2000); }
  function pick(a){ return a[(Math.random()*a.length)|0]; }
  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }
  function sizeByDiff(el){ el.style.fontSize = (diff==='easy'?74:(diff==='hard'?56:64))+'px'; }
  function place(el, center){ const x=center?vw()/2:Math.floor(vw()*0.14+Math.random()*vw()*0.72); const y=center?vh()/2:Math.floor(vh()*0.20+Math.random()*vh()*0.56); el.style.left=x+'px'; el.style.top=y+'px'; }
  function zone(){ return (water>=40 && water<=70) ? 'GREEN' : (water>70 ? 'HIGH' : 'LOW'); }

  return { stop:end, pause(){running=false;}, resume(){ if(!running){ running=true; planNextSpawn(); startWatchdog(); } } };
}

/* ---- gauge (DOM) ---- */
function ensureWaterGauge(){
  destroyWaterGauge();
  const wrap=document.createElement('div'); wrap.id='waterWrap'; Object.assign(wrap.style,{
    position:'fixed',left:'50%',bottom:'56px',transform:'translateX(-50%)',width:'min(560px,90vw)',zIndex:'900',
    color:'#e8eefc',background:'#0f172a99',border:'1px solid #334155',borderRadius:'14px',padding:'10px 12px',backdropFilter:'blur(6px)',fontWeight:'800'
  });
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>Water</span><span id="waterLbl">Balanced</span>
    </div>
    <div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
      <div id="waterFill" style="height:100%;width:55%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div>
    </div>`;
  document.body.appendChild(wrap);
}
function setWaterGauge(val){
  const f=document.getElementById('waterFill'), l=document.getElementById('waterLbl');
  if(!f||!l) return; const pct=Math.max(0,Math.min(100,Math.round(val))); f.style.width=pct+'%';
  let zone='Low'; if(pct>=40&&pct<=70) zone='Balanced'; else if(pct>70) zone='High';
  l.textContent=zone;
  f.style.background = zone==='Balanced' ? 'linear-gradient(90deg,#06d6a0,#37d67a)' :
                       zone==='High'     ? 'linear-gradient(90deg,#22c55e,#93c5fd)' :
                                           'linear-gradient(90deg,#f59e0b,#ef4444)';
}
function destroyWaterGauge(){ const el=document.getElementById('waterWrap'); if(el){ try{el.remove();}catch{} }}

/* ---- shared DOM helpers ---- */
function injectCSS(){
  if(document.getElementById('hha-style')) return;
  const st=document.createElement('style'); st.id='hha-style';
  st.textContent='.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent}.hha-tgt{position:absolute;transform:translate(-50%,-50%);line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5))}';
  document.head.appendChild(st);
}
function freshLayer(){ document.querySelectorAll('.hha-layer').forEach(n=>{try{n.remove();}catch{}}); const d=document.createElement('div'); d.className='hha-layer'; document.body.appendChild(d); return d; }
function wipe(layer){ try{ layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove()); layer.remove(); }catch{} }

export default { boot };