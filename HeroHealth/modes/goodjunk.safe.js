// === /HeroHealth/modes/goodjunk.safe.js (DOM layer, HUD goals + mini quests) ===
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  // --- config / tuning ---
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));
  const good = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const junk = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  let spawnMin=900, spawnMax=1200, life=1600, goodRate=0.68;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1800; goodRate=0.74; }
  if(diff==='hard'){ spawnMin=700;  spawnMax=980;  life=1400; goodRate=0.60; }

  // --- HUD helpers ---
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch(e){} }

  // --- DOM layer host ---
  injectCSS();
  const layer = freshLayer();

  // --- state ---
  let score=0, combo=0, misses=0;
  let left = dur;
  let spawnTimer=null, timeTimer=null, watchdog=null, running=true;

  // goal: เก็บของดีให้ครบ N ชิ้น
  const goalTarget = 25;
  let goalCount = 0;

  // mini-quest deck
  const deck = new MissionDeck({
    pool: [
      { id:'good10',  level:'easy',   label:'เก็บของดี 10 ชิ้น',    check:s=>s.goodCount>=10,  prog:s=>Math.min(10,s.goodCount), target:10 },
      { id:'avoid5',  level:'easy',   label:'หลีกของขยะ 5 ครั้ง',   check:s=>s.junkMiss>=5,    prog:s=>Math.min(5,s.junkMiss),  target:5  },
      { id:'combo10', level:'normal', label:'ทำคอมโบ 10',           check:s=>s.comboMax>=10,   prog:s=>Math.min(10,s.comboMax), target:10 },
      { id:'star3',   level:'normal', label:'เก็บดาว ⭐ 3',         check:s=>s.star>=3,        prog:s=>Math.min(3,s.star),      target:3  },
      { id:'diamond1',level:'hard',   label:'เก็บเพชร 💎 1',        check:s=>s.diamond>=1,     prog:s=>Math.min(1,s.diamond),   target:1  },
      { id:'score600',level:'hard',   label:'ทำคะแนน 600+',         check:s=>s.score>=600,     prog:s=>Math.min(600,s.score),   target:600}
    ]
  });
  deck.draw3();

  // --- HUD emitters ---
  function hudGoal(){
    fire('hha:goal', { label:`เป้า: เก็บของดีให้ได้ ${goalTarget} ชิ้น`, value:goalCount, max:goalTarget, mode:diff });
  }
  function hudQuest(){
    const list = deck.getProgress();
    const cur  = list.find(x=>x.current) || list[0] || null;
    fire('hha:quest', { label: cur ? cur.label : 'Mini Quest — กำลังเริ่ม…' });
    fire('hha:quest-progress', {
      label: cur ? cur.label : '',
      value: cur && Number.isFinite(cur.prog) ? cur.prog : 0,
      max: cur && Number.isFinite(cur.target) ? cur.target : 0
    });
  }
  hudGoal(); hudQuest();
  fire('hha:score', {score, combo});
  fire('hha:time',  {sec:left});

  // --- spawn loop ---
  planNextSpawn(); startWatchdog();
  timeTimer = setInterval(tickTime, 1000);

  function tickTime(){
    if(!running) return;
    left = Math.max(0, left-1);
    deck.second();
    hudQuest();       // อัปเดตแถบล่างทุกวินาที
    fire('hha:time', {sec:left});
    if(left<=0){ end(); return; }
    // เคลียร์ 3/3 แล้วสุ่มชุดใหม่ถ้าเวลาเหลือ
    if(deck.isCleared() && left>0){
      deck.draw3(); hudQuest();
    }
  }

  function planNextSpawn(){
    if(!running) return;
    const wait = Math.floor(spawnMin + Math.random()*(spawnMax-spawnMin));
    spawnTimer = setTimeout(spawnOne, wait);
  }
  function startWatchdog(){
    if(watchdog) clearInterval(watchdog);
    watchdog = setInterval(()=>{
      if(!running) return;
      if(layer.querySelectorAll('.hha-tgt').length===0) spawnOne(true);
    }, 2000);
  }

  function spawnOne(forceCenter){
    if(!running) return;
    const isGood = Math.random() < goodRate;
    const ch = pick(isGood ? good : junk);

    const el = document.createElement('div');
    el.className = 'hha-tgt';
    el.textContent = ch;
    sizeByDiff(el);

    place(el, forceCenter);
    layer.appendChild(el);

    let clicked=false;
    const onHit=(ev)=>{
      if(clicked) return; clicked=true;
      ev && ev.preventDefault && ev.preventDefault();
      layer.removeChild(el);

      if(isGood){
        const delta = 20 + combo*2;
        score += delta; combo = Math.min(9999, combo+1);
        goalCount = Math.min(goalTarget, goalCount+1);
        deck.onGood();
        deck.updateScore(score); deck.updateCombo(combo);
        hudGoal(); hudQuest();
        fire('hha:score', {score, combo});
      }else{
        combo = 0; misses += 1;
        deck.onJunk();
        deck.updateCombo(combo);
        hudQuest();
        fire('hha:score', {score, combo});
      }
      planNextSpawn();
    };
    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    setTimeout(()=>{
      if(clicked || !running) return;
      // timeout = ถ้าดีถือว่าพลาด / ถ้าขยะถือว่า "หลบสำเร็จ"
      try{ layer.removeChild(el);}catch{}
      if(isGood){
        combo=0; misses+=1; deck.onJunk(); deck.updateCombo(combo);
      }else{
        // หลีกขยะ → นับ junkMiss (เควสต์ avoid5)
        deck.onJunk();
      }
      hudQuest();
      planNextSpawn();
    }, life);
  }

  function end(){
    if(!running) return;
    running=false;
    try{ clearInterval(timeTimer); }catch{}
    try{ clearTimeout(spawnTimer); }catch{}
    try{ clearInterval(watchdog); }catch{}
    wipe(layer);

    const prog = deck.getProgress();
    const questsCleared = prog.filter(p=>p.done).length;
    fire('hha:end', {
      score, combo, misses, duration:dur,
      goal: goalCount>=goalTarget,
      questsCleared, questsTotal: 3
    });
  }

  // --- utils ---
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }
  function sizeByDiff(el){ el.style.fontSize = (diff==='easy'?74:(diff==='hard'?56:64))+'px'; }
  function place(el, center){
    const x = center ? vw()/2 : Math.floor(vw()*0.14 + Math.random()*vw()*0.72);
    const y = center ? vh()/2 : Math.floor(vh()*0.20 + Math.random()*vh()*0.56);
    el.style.left = x+'px'; el.style.top = y+'px';
  }

  return { stop:end, pause(){running=false;}, resume(){ if(!running){ running=true; planNextSpawn(); startWatchdog(); } } };
}

// --- DOM helpers shared ---
function injectCSS(){
  if(document.getElementById('hha-style')) return;
  const st = document.createElement('style');
  st.id='hha-style';
  st.textContent =
    '.hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent}'+
    '.hha-tgt{position:absolute;transform:translate(-50%,-50%);line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5))}';
  document.head.appendChild(st);
}
function freshLayer(){
  document.querySelectorAll('.hha-layer').forEach(n=>{ try{n.remove();}catch{} });
  const d = document.createElement('div'); d.className='hha-layer'; document.body.appendChild(d); return d;
}
function wipe(layer){ try{ layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove()); layer.remove(); }catch{} }

export default { boot };