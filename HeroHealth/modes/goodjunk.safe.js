// === HeroHealth/modes/goodjunk.safe.js — goal + mini quest + on-screen spawn (2025-11-11) ===
export async function boot(cfg = {}) {
  // ------- config -------
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || (diff==='easy'?75 : diff==='hard'?45 : 60));
  const host = document.body; // ใช้เลเยอร์ DOM

  // ------- style / layer -------
  injectOnce();
  cleanupLayers();
  const layer = document.createElement('div');
  layer.className = 'hha-layer'; // ดู style ใน injectOnce()
  document.body.appendChild(layer);

  // ------- state -------
  let running = true;
  let score=0, combo=0, maxCombo=0, misses=0;
  let left = Math.max(1, Math.round(dur));
  let spawnTimer = 0, timeTimer = 0, watchdog = 0;

  // tuning ตามระดับ
  let life=1500, gapMin=820, gapMax=1100;
  if (diff==='easy'){ life=1700; gapMin=950; gapMax=1300; }
  if (diff==='hard'){ life=1300; gapMin=650; gapMax=900;  }

  // พูลอิโมจิ
  const GOOD = ['🍎','🍐','🍇','🍑','🥝','🥕','🥦','🌽','🍅','🥒'];
  const JUNK = ['🍔','🍟','🍕','🌭','🍩','🍪','🍰','🍫','🧋','🥤'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  // ------- Goal + Mini Quest -------
  let goalTarget = 25;                 // เก็บของดี 25 ชิ้น
  let goalProg = 0;
  const miniPool = [
    {id:'good10',  label:'เก็บของดี 10 ชิ้น',  target:10,  check:s=>s.good>=10,  prog:s=>s.good},
    {id:'combo10', label:'ทำคอมโบ 10',        target:10,  check:s=>s.comboMax>=10, prog:s=>s.comboMax},
    {id:'star3',   label:'เก็บดาว ⭐ 3',       target:3,   check:s=>s.star>=3, prog:s=>s.star},
    {id:'dia1',    label:'เก็บเพชร 💎 1',     target:1,   check:s=>s.diamond>=1, prog:s=>s.diamond},
    {id:'nomiss8', label:'ไม่พลาด 8 วิ',       target:8,   check:s=>s.noMiss>=8, prog:s=>s.noMiss},
  ];
  const deck = draw3(miniPool);
  let deckIdx = 0;
  const stats = { good:0, star:0, diamond:0, noMiss:0, comboMax:0 };

  // ------- helpers -------
  const vw = () => Math.max(320, window.innerWidth||320);
  const vh = () => Math.max(320, window.innerHeight||320);
  const rng = (a,b)=>Math.floor(a + Math.random()*(b-a));
  const inRect = (x,y)=> x>=vw()*0.12 && x<=vw()*0.88 && y>=vh()*0.18 && y<=vh()*0.82;

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }
  function emitQuest(){
    // goal
    const goal = { label:`เป้า: เก็บของดีให้ได้ ${goalTarget} ชิ้น — คืบหน้า ${goalProg}/${goalTarget}`,
                   prog: goalProg, target: goalTarget };
    // mini
    const q = deck[deckIdx] || null;
    const mini = q ? { label:`Quest ${deckIdx+1}/3 — ${q.label} (${Math.min(q.target, q.prog(stats))}/${q.target})`,
                       prog:q.prog(stats), target:q.target } : null;
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text: mini? mini.label:'Mini Quest — กำลังเริ่ม…', goal, mini}}));
  }

  function advanceMiniIfDone(){
    const q = deck[deckIdx];
    if (!q) return;
    if (q.check(stats)) {
      deckIdx = Math.min(deck.length-1, deckIdx+1);
      emitQuest();
    }
  }

  // ------- spawn / gameplay -------
  function ensureOnScreen(el){
    try{
      const r = el.getBoundingClientRect();
      if (!inRect(r.left+r.width/2, r.top+r.height/2)){
        el.style.left = (vw()/2)+'px';
        el.style.top  = (vh()/2)+'px';
      }
    }catch{}
  }
  function firstSpawn(){ spawnOne(true); planNext(); }
  function planNext(){
    if(!running) return;
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(spawnOne, rng(gapMin,gapMax));
  }

  function spawnOne(forceCenter){
    if(!running) return;

    // เลือกชนิด (มีของพิเศษนิดหน่อย)
    let kind='good', ch;
    const r = Math.random();
    if      (r<0.06){ kind='star';   ch=STAR; }
    else if (r<0.08){ kind='diamond';ch=DIA;  }
    else if (r<0.10){ kind='shield'; ch=SHIELD; }
    else {
      const good = Math.random() < 0.7;
      kind = good ? 'good' : 'junk';
      ch = good ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
    }

    const el = document.createElement('div');
    el.className = 'hha-tgt';
    el.textContent = ch;

    // position in safe rect
    const x = forceCenter ? vw()/2 : rng(vw()*0.18, vw()*0.82);
    const y = forceCenter ? vh()/2 : rng(vh()*0.24, vh()*0.78);
    el.style.left = x+'px'; el.style.top = y+'px';

    // size ตามระดับ
    let fs = 64; if(diff==='easy') fs=74; if(diff==='hard') fs=56;
    el.style.fontSize = fs+'px';

    let clicked=false;
    const ttl = setTimeout(()=>{ if(clicked||!running) return; miss(kind, el); }, life);

    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    function onHit(ev){
      if(clicked) return; clicked=true;
      try{ ev.preventDefault(); }catch{}
      clearTimeout(ttl);

      if(kind==='good'){
        const val = 22 + combo*2;
        score += val; combo++; stats.good++; stats.comboMax = Math.max(stats.comboMax, combo);
        goalProg = Math.min(goalTarget, goalProg+1);
        stats.noMiss = Math.min(999, stats.noMiss+1);
        burst(el, '#22c55e'); floatScore(el, '+'+val);
      }else if(kind==='junk'){
        combo=0; score=Math.max(0, score-18); stats.noMiss=0;
        burst(el, '#ef4444'); floatScore(el, '-18');
      }else if(kind==='star'){
        score += 40; stats.star++; burst(el, '#fde047'); floatScore(el, '+40 ⭐');
      }else if(kind==='diamond'){
        score += 80; stats.diamond++; burst(el, '#a78bfa'); floatScore(el, '+80 💎');
      }else if(kind==='shield'){
        score += 10; burst(el, '#60a5fa'); floatScore(el, '🛡️+');
      }
      maxCombo = Math.max(maxCombo, combo);
      try{ layer.removeChild(el); }catch{}
      emitScore(); emitQuest(); advanceMiniIfDone();
      planNext();
    }

    layer.appendChild(el);
    ensureOnScreen(el);
  }

  function miss(kind, el){
    if(!running) return;
    combo=0; misses++;
    stats.noMiss=0;
    try{ layer.removeChild(el); }catch{}
    emitScore(); emitQuest();
    planNext();
  }

  function burst(el, color){
    // ใช้ CSS burst แบบเบาๆ (มี class จาก injectOnce)
    const fx = document.createElement('div');
    fx.className = 'hha-burst';
    fx.style.left = el.style.left; fx.style.top = el.style.top;
    fx.style.setProperty('--c', color||'#fff');
    layer.appendChild(fx);
    setTimeout(()=>{ try{ layer.removeChild(fx);}catch{} }, 520);
    try{ el.classList.add('hit'); setTimeout(()=>el.remove(),100);}catch{}
  }
  function floatScore(el, text){
    const fs = document.createElement('div');
    fs.className='hha-floater';
    fs.textContent=text; fs.style.left=el.style.left; fs.style.top=el.style.top;
    layer.appendChild(fs);
    setTimeout(()=>{ try{ layer.removeChild(fs);}catch{} }, 900);
  }

  // ------- timers / lifecycle -------
  function tickTime(){
    if(!running) return;
    left = Math.max(0, left-1);
    stats.noMiss = Math.min(999, stats.noMiss+1);  // นับ “ไม่พลาด” รายวินาที
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}}));
    emitQuest();
    if(left<=0) end(true);
  }

  function start(){
    emitQuest();
    clearInterval(timeTimer); timeTimer=setInterval(tickTime,1000);
    firstSpawn();
    startWatchdog();
  }
  function startWatchdog(){
    clearInterval(watchdog);
    watchdog = setInterval(()=>{
      if(!running) return;
      const on = layer.querySelectorAll('.hha-tgt').length;
      if(on===0) spawnOne(true);
    }, 1800);
  }
  function end(timeout=false){
    if(!running) return; running=false;
    try{ clearInterval(timeTimer);}catch{}; try{ clearTimeout(spawnTimer);}catch{}; try{ clearInterval(watchdog);}catch{};
    // ล้างเป้า
    layer.querySelectorAll('.hha-tgt,.hha-burst,.hha-floater').forEach(n=>{ try{ n.remove(); }catch{} });
    // แจ้งผล
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Good vs Junk', difficulty:diff, score, comboMax:maxCombo, misses,
      questsCleared: deckIdx+ (deck[deckIdx] && miniPool.find(q=>q.id===deck[deckIdx].id).check(stats)?1:0),
      questsTotal:3, goalCleared: goalProg>=goalTarget, duration:dur, reason: timeout?'timeout':'quit'
    }}));
    try{ document.body.removeChild(layer);}catch{}
  }

  // resize -> กันเป้าล้นจอเมื่อ viewport เปลี่ยน
  const onResize = ()=> {
    const nodes = layer.querySelectorAll('.hha-tgt');
    nodes.forEach(el=>ensureOnScreen(el));
  };
  window.addEventListener('resize', onResize);

  start();

  return {
    stop(){ end(false); },
    pause(){ running=false; clearInterval(timeTimer); clearTimeout(spawnTimer); },
    resume(){ if(!running){ running=true; start(); } }
  };
}

// ------- utils (style, deck, cleanup) -------
function draw3(pool){
  // เลือก easy/normal/hard อย่างละ 1 ถ้ามี มิฉะนั้นสุ่มจนได้ 3 ไม่ซ้ำ
  const lvls=['easy','normal','hard'];
  const out=[];
  lvls.forEach(l=>{
    const c=pool.filter(q=>q.level===l); if(c.length) out.push(c[(Math.random()*c.length)|0]);
  });
  while(out.length<3){
    const q = pool[(Math.random()*pool.length)|0];
    if(!out.find(x=>x.id===q.id)) out.push(q);
  }
  return out.slice(0,3);
}

function injectOnce(){
  if(document.getElementById('hha-style')) return;
  const st=document.createElement('style'); st.id='hha-style';
  st.textContent = `
  .hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent}
  .hha-tgt{position:absolute;pointer-events:auto;transform:translate(-50%,-50%);font-size:64px;line-height:1;
           filter:drop-shadow(0 10px 18px rgba(0,0,0,.55)); transition:transform .12s ease,opacity .18s ease;}
  .hha-tgt.hit{transform:translate(-50%,-50%) scale(.86); opacity:.2}
  .hha-floater{position:absolute;transform:translate(-50%,-80%);font-weight:800;color:#fff;
               text-shadow:0 2px 8px rgba(0,0,0,.7); animation:hhaUp .9s ease-out forwards}
  @keyframes hhaUp{from{opacity:0; transform:translate(-50%,0)} to{opacity:1; transform:translate(-50%,-56px)}}
  .hha-burst{position:absolute;width:12px;height:12px;border-radius:999px;background:var(--c,#fff);
             transform:translate(-50%,-50%);opacity:.9;box-shadow:0 0 0 8px color-mix(in srgb,var(--c),transparent 70%);
             animation:burst .5s ease-out forwards}
  @keyframes burst{from{opacity:.95; transform:translate(-50%,-50%) scale(.3)}
                   to{opacity:0; transform:translate(-50%,-50%) scale(1.6)}}
  `;
  document.head.appendChild(st);
}
function cleanupLayers(){
  document.querySelectorAll('.hha-layer').forEach(n=>{ try{ n.remove(); }catch{} });
}

export default { boot };