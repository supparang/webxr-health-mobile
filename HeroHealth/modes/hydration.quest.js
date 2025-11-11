// === /HeroHealth/modes/hydration.quest.js (DOM-only, 2025-11-07) ===
// ไม่ใช้ THREE/AFRAME เพื่อกัน error บนอุปกรณ์บางรุ่น

export async function boot(cfg = {}) {
  // ----- Config / state -----
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // pools
  const GOOD = ['💧','🚰','🥛','🍊','🍋'];                  // ช่วยเพิ่มน้ำ
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];                  // ลดน้ำ / โทษ
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // tuning
  const tune = {
    easy:   { nextGap:[420,620], life:[1500,1800], badRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[320,520], life:[1200,1500], badRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[260,460], life:[1000,1300], badRate:0.40, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;

  // game state
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain=dur;
  let layer=null, watchdogId=0, timerId=0, nextTimer=0;
  let water=55;               // 0..100
  let balancedSec=0;          // วินาทีที่น้ำอยู่ในโซนพอดี
  let avoidJunk=0;            // จำนวนครั้งที่ปล่อย junk ให้หมดอายุ (นับเป็น "หลีกของขยะ")

  // ----- Utilities -----
  const $ = s=>document.querySelector(s);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const rand =(a,b)=>a+Math.random()*(b-a);
  const nextGap =()=>Math.floor(rand(C.nextGap[0],C.nextGap[1]));
  const lifeMs  =()=>Math.floor(rand(C.life[0],C.life[1]));
  function fire(name,detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(_){} }
  function scheduleNext(fn, delay){ try{clearTimeout(nextTimer);}catch{} nextTimer=setTimeout(fn, delay); }
  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }

  // ----- Water Gauge (DOM HUD) -----
  function ensureGauge(){
    destroyGauge();
    const wrap=document.createElement('div');
    wrap.id='waterWrap'; wrap.setAttribute('data-hha-ui','');
    Object.assign(wrap.style,{
      position:'fixed',left:'50%',bottom:'72px',transform:'translateX(-50%)',
      width:'min(620px,92vw)',zIndex:900,color:'#e8eefc',background:'#0f172a99',
      border:'1px solid #334155',borderRadius:'16px',padding:'14px 16px',
      backdropFilter:'blur(6px)',fontWeight:'800',boxShadow:'0 16px 40px #0008'
    });
    wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:18px">Water</div>
        <div id="waterLbl" style="opacity:.9">Balanced</div>
      </div>
      <div style="height:12px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
        <div id="waterFill" style="height:100%;width:55%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div>
      </div>`;
    document.body.appendChild(wrap);
  }
  function destroyGauge(){ const el=$('#waterWrap'); if(el) try{el.remove();}catch{} }
  function setGauge(val){
    val=clamp(Math.round(val),0,100);
    const f=$('#waterFill'), l=$('#waterLbl'); if(!f||!l) return;
    f.style.width=val+'%';
    let zone='Low';
    if(val>=40 && val<=70) zone='Balanced'; else if(val>70) zone='High';
    l.textContent=zone;
    f.style.background = zone==='Balanced'
      ? 'linear-gradient(90deg,#06d6a0,#37d67a)'
      : (zone==='High'
          ? 'linear-gradient(90deg,#22c55e,#93c5fd)'
          : 'linear-gradient(90deg,#f59e0b,#ef4444)');
  }

  // ----- Layer & placement (DOM targets) -----
  // สร้างเลเยอร์บน body (หลบ pointer issue)
  function makeLayer(){
    const old=document.querySelectorAll('.hha-layer');
    old.forEach(n=>{ try{ n.remove(); }catch{} });
    const l=document.createElement('div');
    l.className='hha-layer'; // ใช้กับ index สำหรับเคลียร์อัตโนมัติ
    Object.assign(l.style,{position:'fixed',inset:0,zIndex:650,pointerEvents:'auto'});
    document.body.appendChild(l);
    return l;
  }

  const DOM_MIN_DIST = 120;
  function r2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }
  function pickDomPos(){
    const nodes=layer?Array.from(layer.querySelectorAll('.hha-tgt')):[];
    for(let i=0;i<24;i++){
      const x=Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
      const y=Math.floor(vh()*0.18 + Math.random()*vh()*0.62);
      let ok=true;
      for(const n of nodes){
        const rect=n.getBoundingClientRect();
        const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
        if(r2({x,y},{x:cx,y:cy}) < DOM_MIN_DIST*DOM_MIN_DIST){ ok=false; break; }
      }
      if(ok) return {x,y};
    }
    return {x:vw()/2, y:vh()/2};
  }

  // ----- Score & FX -----
  function emitScore(){ fire('hha:score',{score,combo}); }
  function floatScore(x,y,text){
    const el=document.createElement('div');
    el.textContent=text;
    Object.assign(el.style,{
      position:'fixed',left:x+'px',top:y+'px',transform:'translate(-50%,-50%)',
      font:'800 18px system-ui, -apple-system, Segoe UI, Roboto, Thonburi, sans-serif',
      color:'#e8eefc',textShadow:'0 2px 8px #000',pointerEvents:'none',zIndex:900,
      transition:'transform .52s ease-out, opacity .52s linear',opacity:'1'
    });
    document.body.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.transform='translate(-50%,-120%)';
      el.style.opacity='0';
    });
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 560);
  }

  // ----- Mini Quests (10 แบบ เลือกมา 3) -----
  const QUEST_POOL = [
    { id:'combo10',     label:'คอมโบ 10',             check:s=>s.comboMax>=10,    prog:s=>Math.min(10,s.comboMax),    target:10 },
    { id:'good15',      label:'เก็บของดี 15 ชิ้น',    check:s=>s.good>=15,        prog:s=>Math.min(15,s.good),        target:15 },
    { id:'avoid5',      label:'หลีกของขยะ 5 ครั้ง',   check:s=>s.avoid>=5,        prog:s=>Math.min(5,s.avoid),        target:5 },
    { id:'balanced15',  label:'น้ำ Balanced 15 วิ',   check:s=>s.balanced>=15,    prog:s=>Math.min(15,s.balanced),    target:15 },
    { id:'score350',    label:'คะแนน 350+',           check:s=>s.score>=350,      prog:s=>Math.min(350,s.score),      target:350 },
    { id:'star2',       label:'เก็บดาว ⭐ 2',         check:s=>s.star>=2,         prog:s=>Math.min(2,s.star),         target:2 },
    { id:'diamond1',    label:'เก็บเพชร 💎 1',        check:s=>s.diamond>=1,      prog:s=>Math.min(1,s.diamond),      target:1 },
    { id:'shield2',     label:'สะสมเกราะ 2',         check:s=>s.shield>=2,       prog:s=>Math.min(2,s.shield),       target:2 },
    { id:'goodStreak8', label:'โดนของดีติด 8',        check:s=>s.comboMax>=8,     prog:s=>Math.min(8,s.comboMax),     target:8 },
    { id:'badTap3',     label:'แตะของขยะ 3',         check:s=>s.badTap>=3,       prog:s=>Math.min(3,s.badTap),       target:3 },
  ];
  function pick3(){
    const bag=[...QUEST_POOL], out=[];
    for(let i=0;i<3 && bag.length;i++){
      const idx=(Math.random()*bag.length)|0;
      out.push(bag.splice(idx,1)[0]);
    }
    return out;
  }
  const QUESTS = pick3();
  let qIdx = 0;
  const statsForQuest = { comboMax:0, good:0, avoid:0, balanced:0, score:0, star:0, diamond:0, shield:0, badTap:0 };
  function updateQuestHUD(){
    const cur=QUESTS[qIdx]; const txt = `Quest ${qIdx+1}/3 — ${cur?cur.label:'-'}`;
    fire('hha:quest',{detail:{text:txt}});
  }
  function tryAdvanceQuest(){
    const cur=QUESTS[qIdx]; if(!cur) return;
    if (cur.check(statsForQuest)) qIdx=Math.min(2,qIdx+1), updateQuestHUD();
  }
  updateQuestHUD();

  // ----- Spawn (DOM) -----
  function spawnDOM(){
    if(!running) return;
    if(!layer) layer=makeLayer();

    const alive = layer.querySelectorAll('.hha-tgt').length;
    if (alive >= C.maxConcurrent){ scheduleNext(spawnDOM, 140); return; }

    // type
    let ch,type; const r=Math.random();
    if      (r<0.05){ ch=STAR; type='star'; }
    else if (r<0.07){ ch=DIA;  type='diamond'; }
    else if (r<0.10){ ch=SHIELD; type='shield'; }
    else {
      const good = Math.random() > C.badRate;
      ch = (good?GOOD:BAD)[(Math.random()*(good?GOOD:BAD).length)|0];
      type = good?'good':'bad';
    }

    const el=document.createElement('div');
    el.className='hha-tgt';
    el.textContent=ch;
    Object.assign(el.style,{
      position:'absolute',transform:'translate(-50%,-50%)',
      fontSize:(diff==='easy'?74:diff==='hard'?56:64)+'px',
      lineHeight:'1',filter:'drop-shadow(0 8px 14px rgba(0,0,0,.5))',
      transition:'transform .12s ease, opacity .24s ease',opacity:'1',pointerEvents:'auto'
    });
    const p=pickDomPos();
    el.style.left=p.x+'px'; el.style.top=p.y+'px';
    layer.appendChild(el); spawns++;

    const ttl=setTimeout(()=>{
      if(!running) return;
      try{ layer.removeChild(el); }catch{}
      if (type==='good'){ // พลาดของดี = โทษ
        water=Math.max(0,water-4); score=Math.max(0,score-8); combo=0; misses++;
        setGauge(water); emitScore();
      } else if (type==='bad'){
        // นับ "หลีกของขยะ"
        statsForQuest.avoid++; tryAdvanceQuest();
      }
    }, lifeMs());

    function onHit(ev){
      if(!running) return;
      try{ ev.preventDefault(); }catch{}
      clearTimeout(ttl);

      // apply score/water
      if(type==='good'){
        const val=20 + combo*2;
        score += val; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
        water = Math.min(100, water+6);
        statsForQuest.good++; statsForQuest.comboMax=maxCombo;
        floatScore(p.x,p.y,'+'+val);
      } else if (type==='bad'){
        statsForQuest.badTap++;
        if (shield>0){ shield--; floatScore(p.x,p.y,'Shield!'); }
        else{
          if (water>70){ score += 5; floatScore(p.x,p.y,'+5 (High)'); }
          else { score=Math.max(0,score-20); combo=0; floatScore(p.x,p.y,'-20'); }
          water=Math.max(0, water-8);
        }
      } else if (type==='star'){
        score+=40; statsForQuest.star++; floatScore(p.x,p.y,'+40 ⭐');
      } else if (type==='diamond'){
        score+=80; statsForQuest.diamond++; floatScore(p.x,p.y,'+80 💎');
      } else if (type==='shield'){
        shield=Math.min(3,shield+1); statsForQuest.shield++; floatScore(p.x,p.y,'🛡️+1');
      }

      setGauge(water); emitScore();
      try{ el.style.transform='translate(-50%,-50%) scale(.85)'; el.style.opacity='.12'; }catch{}
      setTimeout(()=>{ try{ layer.removeChild(el); }catch{} }, 140);
      tryAdvanceQuest();
      scheduleNext(spawnDOM, nextGap());
    }
    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    scheduleNext(spawnDOM, nextGap());
  }

  // ----- Game loop: time + watchdog -----
  function end(reason='timeout'){
    if(!running) return;
    running=false;
    try{ clearInterval(timerId); }catch{}
    try{ clearInterval(watchdogId); }catch{}
    try{ clearTimeout(nextTimer); }catch{}
    try{ layer && layer.querySelectorAll('.hha-tgt').forEach(n=>n.remove()); }catch{}
    destroyGauge();
    const questsCleared = QUESTS.reduce((n,q)=> n + (q.check(statsForQuest)?1:0), 0);
    fire('hha:end',{
      mode:'Hydration', difficulty:diff, score, comboMax:maxCombo, combo, misses, hits, spawns,
      duration:dur, questsCleared, questsTotal:3, reason
    });
  }

  // HUD init
  fire('hha:score',{score,combo});
  fire('hha:time',{sec:remain});
  ensureGauge(); setGauge(water);

  // per-second timer
  timerId=setInterval(()=>{
    if(!running) return;
    remain=Math.max(0,remain-1);
    fire('hha:time',{sec:remain});
    // balanced time counter
    if (water>=40 && water<=70) balancedSec++;
    statsForQuest.balanced = balancedSec;
    statsForQuest.score    = Math.max(statsForQuest.score, score);
    statsForQuest.comboMax = Math.max(statsForQuest.comboMax, maxCombo);
    tryAdvanceQuest();
    if(remain<=0) end('timeout');
  },1000);

  // watchdog: ถ้า 2 วินาทีไม่มีเป้าเลย → spawn ทันที
  watchdogId=setInterval(()=>{
    if(!running||!layer) return;
    if(layer.querySelectorAll('.hha-tgt').length===0) spawnDOM();
  }, 2000);

  // go!
  spawnDOM();

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnDOM(); } }
  };
}

export default { boot };