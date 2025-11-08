// === goodjunk.safe.js — VR/DOM hybrid (sequential missions 1-by-1, 3 of 10) ===
/* eslint-disable */
export async function boot(cfg = {}) {
  // ---------- config ----------
  const host = cfg.host || document.getElementById('spawnHost') || document.body;
  const duration = Number(cfg.duration || 60);
  const difficulty = String(cfg.difficulty || 'normal');

  // spawn tuning by difficulty
  const diff = {
    easy:   { spawnMin: 800,  spawnMax: 1100, life: 1900 },
    normal: { spawnMin: 650,  spawnMax: 900,  life: 1600 },
    hard:   { spawnMin: 520,  spawnMax: 760,  life: 1300 },
  }[difficulty] || { spawnMin: 650, spawnMax: 900, life: 1600 };

  const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🥛','🐟','🥗'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const SPECIAL = { STAR:'⭐', DIAMOND:'💎', SHIELD:'🛡️' };

  const GOOD_RATE = 0.7;            // chance good
  const SPECIAL_RATE = 0.08;         // chance to be star/diamond/shield (among goods)

  // ---------- missions (10) ----------
  const QUEST_POOL = [
    { id:'good10',      label:'เก็บของดี 10 ชิ้น',         kind:'good',    target:10,  get: s=>s.goodCount },
    { id:'avoid5',      label:'เลี่ยงขยะ 5 ครั้ง',          kind:'avoid',   target:5,   get: s=>s.junkAvoid },
    { id:'combo10',     label:'ทำคอมโบ 10',                kind:'combo',   target:10,  get: s=>s.comboMax },
    { id:'good20',      label:'เก็บของดี 20 ชิ้น',         kind:'good',    target:20,  get: s=>s.goodCount },
    { id:'score500',    label:'ทำคะแนน 500+',               kind:'score',   target:500, get: s=>s.score },
    { id:'star3',       label:'เก็บดาว ⭐ 3 ดวง',            kind:'star',    target:3,   get: s=>s.star },
    { id:'diamond1',    label:'เก็บเพชร 💎 1 เม็ด',          kind:'diamond', target:1,   get: s=>s.diamond },
    { id:'shield2',     label:'เก็บโล่ 🛡️ 2 อัน',            kind:'shield',  target:2,   get: s=>s.shield },
    { id:'nostreak10',  label:'ไม่พลาด 10 วิ',              kind:'noMiss',  target:10,  get: s=>s.noMissTime },
    { id:'combo20',     label:'คอมโบ 20',                   kind:'combo',   target:20,  get: s=>s.comboMax },
  ];

  // ---------- state ----------
  let running = true;
  let spawnTimer = null, timeTimer = null, watchdog = null;
  let left = Math.max(1, Math.round(duration));

  const stats = {
    score: 0,
    hits: 0,
    spawns: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,        // click miss on good (หรือโดน junk)
    junkAvoid: 0,     // ปล่อย junk ให้หมดเวลา (นับเป็น "เลี่ยงขยะ")
    goodCount: 0,
    star: 0,
    diamond: 0,
    shield: 0,
    noMissTime: 0,    // วินาทีที่ยังไม่พลาด
    fever: 0,         // 0..100
    shields: 0,       // ใช้งานกันพลาด/กันหักคอมโบ 1 ครั้ง
    questsCleared: 0,
    questsTotal: 3
  };

  // ---------- missions: pick 3 unique; show one-by-one ----------
  const deck = pick3Unique(QUEST_POOL);
  let qIndex = 0;

  // ---------- layer host for DOM targets ----------
  const layer = ensureLayer();

  // ---------- helpers ----------
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch(e){} }

  function ensureLayer(){
    // clear old
    Array.from(document.querySelectorAll('.hha-layer')).forEach(el=>{ try{ el.remove(); }catch{} });
    const el = document.createElement('div');
    el.className = 'hha-layer';
    Object.assign(el.style, {
      position:'fixed', inset:'0', zIndex:'650', pointerEvents:'auto', background:'transparent'
    });
    document.body.appendChild(el);
    // style (once)
    if(!document.getElementById('hha-style')){
      const st = document.createElement('style');
      st.id='hha-style';
      st.textContent = `
      .hha-tgt{position:absolute;display:block;transform:translate(-50%,-50%);
        font-size:64px;line-height:1;will-change:transform,opacity;
        filter:drop-shadow(0 8px 14px rgba(0,0,0,.5));transition:transform .12s ease, opacity .24s ease;cursor:pointer}
      .hha-hit{transform:translate(-50%,-50%) scale(.85);opacity:.15}
      .hha-pop{position:absolute; left:50%; top:50%; font-weight:800; color:#e8eefc; transform:translate(-50%,-120%);
        text-shadow:0 2px 8px #0008; animation:popUp .6s ease-out forwards}
      @keyframes popUp{ from{opacity:.0; transform:translate(-50%,-80%) scale(.9)} to{opacity:1; transform:translate(-50%,-130%) scale(1)} }
      .shard{position:absolute; width:6px; height:6px; border-radius:3px; opacity:.85; filter:blur(.2px)}
      `;
      document.head.appendChild(st);
    }
    return el;
  }

  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }

  // ---------- HUD + coach ----------
  function updateScoreCombo(){
    fire('hha:score', { score:stats.score, combo:stats.combo });
    stats.comboMax = Math.max(stats.comboMax, stats.combo);
    coachCombo(stats.combo);
  }
  function coachCombo(c){
    if(c===5)  fire('hha:coach',{text:'ดีมาก! คอมโบ 5 แล้ว ✨'});
    if(c===10) fire('hha:coach',{text:'สุดยอด! คอมโบ 10! 🔥'});
    if(c===15) fire('hha:coach',{text:'คอมโบ 15! โหดมาก 💥'});
    if(c>=20)  fire('hha:coach',{text:'โหมดเทพแล้ว! รัวต่อเลย ⚡'});
  }
  function updateQuestHUD(){
    const q = deck[qIndex];
    if(!q){ fire('hha:quest', { text:'Quest: ✓ ครบ 3 ภารกิจ — เปิด FEVER!' }); return; }
    const cur = q.get(stats);
    fire('hha:quest', { text: `Quest ${qIndex+1}/3: ${q.label} (${cur}/${q.target})` });
  }

  // ---------- shards + score pop ----------
  function burstShards(x,y,color='#7dd3fc', count=16, speed=320){
    for(let i=0;i<count;i++){
      const s=document.createElement('div'); s.className='shard';
      const c = tweakColor(color, 0.7+Math.random()*0.6);
      s.style.background = c;
      layer.appendChild(s);
      const ang = Math.random()*Math.PI*2;
      const dist = 20 + Math.random()*36;
      const dx = Math.cos(ang)*dist, dy = Math.sin(ang)*dist;
      const start = performance.now();
      const dur = 380 + Math.random()*240;
      (function tick(t){
        const k = Math.min(1,(t-start)/dur);
        const ease = 1 - Math.pow(1-k, 2);
        s.style.left = (x + dx*ease) + 'px';
        s.style.top  = (y + dy*ease) + 'px';
        s.style.opacity = String(1-k);
        if(k<1 && running) requestAnimationFrame(tick); else s.remove();
      })(start);
    }
  }
  function scorePop(x,y,text='+1'){
    const el = document.createElement('div');
    el.className='hha-pop'; el.textContent = text;
    el.style.left=x+'px'; el.style.top=y+'px';
    layer.appendChild(el);
    setTimeout(()=>el.remove(), 620);
  }
  function tweakColor(hex, mul){
    // naive lighten/darken
    try{
      const c=hex.replace('#','');
      let r=parseInt(c.slice(0,2),16), g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
      r=Math.max(0,Math.min(255,Math.round(r*mul)));
      g=Math.max(0,Math.min(255,Math.round(g*mul)));
      b=Math.max(0,Math.min(255,Math.round(b*mul)));
      return '#'+r.toString(16).padStart(2,'0')+g.toString(16).padStart(2,'0')+b.toString(16).padStart(2,'0');
    }catch{return hex}
  }

  // ---------- fever ----------
  function feverAdd(v){
    stats.fever = clamp(stats.fever + v, 0, 100);
    fire('hha:fever', {state:'change', level:stats.fever, active:false});
    if(stats.fever>=100){
      fire('hha:fever', {state:'start', level:100, active:true});
      setTimeout(()=>{ // auto end
        stats.fever = 0;
        fire('hha:fever', {state:'end', level:0, active:false});
      }, 10000);
    }
  }

  // ---------- missions flow (sequential) ----------
  function pick3Unique(pool){
    const ids = new Set();
    const out=[];
    while(out.length<3 && ids.size<pool.length){
      const q = pool[(Math.random()*pool.length)|0];
      if(!ids.has(q.id)){ ids.add(q.id); out.push(q); }
    }
    return out;
  }
  function checkQuestAdvance(){
    const cur = deck[qIndex];
    if(!cur) return; // already cleared all
    if(cur.get(stats) >= cur.target){
      qIndex++;
      stats.questsCleared = Math.min(3, qIndex);
      if(qIndex>=deck.length){
        // All 3 done → guarantee fever
        fire('hha:quest', { text:'✓ เคลียร์ครบ 3 ภารกิจ! FEVER กำลังทำงาน…' });
        feverAdd(100);
      }else{
        // next quest
        const nq = deck[qIndex];
        fire('hha:coach', {text:'ยอดเยี่ยม! ไปภารกิจถัดไป ▶'});
        updateQuestHUD();
      }
    }else{
      updateQuestHUD();
    }
  }

  // ---------- game loop ----------
  function startTimers(){
    timeTimer = setInterval(()=>{
      if(!running) return;
      left = Math.max(0, left-1);
      stats.noMissTime = Math.min(9999, stats.noMissTime + 1);
      fire('hha:time', {sec:left});
      // quest that cares time sequence (noMissTime)
      checkQuestAdvance();
      if(left<=0) end('timeout');
    }, 1000);

    planNextSpawn();
    startWatchdog();
    updateQuestHUD();
  }

  function planNextSpawn(){
    if(!running) return;
    const wait = Math.floor(diff.spawnMin + Math.random()*(diff.spawnMax-diff.spawnMin));
    spawnTimer = setTimeout(spawnOne, wait);
  }

  function startWatchdog(){
    if(watchdog) clearInterval(watchdog);
    watchdog = setInterval(()=>{
      if(!running) return;
      if(layer.querySelectorAll('.hha-tgt').length===0){
        spawnOne(true);
      }
    }, 2000);
  }

  function randPos(forceCenter){
    if(forceCenter) return {x: vw()/2, y: vh()/2};
    const x = Math.floor(vw()*0.18 + Math.random()*vw()*0.64);
    const y = Math.floor(vh()*0.26 + Math.random()*vh()*0.52);
    return {x,y};
  }

  function spawnOne(forceCenter){
    if(!running) return;

    const isGood = Math.random() < GOOD_RATE;
    let ch = isGood ? pick(GOOD) : pick(JUNK);

    // specials among goods
    if(isGood && Math.random()<SPECIAL_RATE){
      const r = Math.random();
      if(r<0.5) ch = SPECIAL.STAR;
      else if(r<0.85) ch = SPECIAL.SHIELD;
      else ch = SPECIAL.DIAMOND;
    }

    const el = document.createElement('div');
    el.className = 'hha-tgt';
    el.textContent = ch;

    const pos = randPos(!!forceCenter);
    el.style.left = pos.x+'px';
    el.style.top  = pos.y+'px';

    const fs = (difficulty==='easy')?74 : (difficulty==='hard'?56:64);
    el.style.fontSize = fs+'px';

    const life = diff.life;

    let clicked = false;
    const type = classify(ch);

    function onClick(ev){
      if(clicked) return; clicked=true;
      try{ ev.preventDefault(); }catch{}
      try{ el.classList.add('hha-hit'); }catch{}
      // resolve
      handleHit(type, pos.x, pos.y);
      // cleanup
      try{ el.remove(); }catch{}
      planNextSpawn();
    }
    el.addEventListener('click', onClick, {passive:false});
    el.addEventListener('touchstart', onClick, {passive:false});

    const ttl = setTimeout(()=>{
      // timeout (escape)
      if(clicked || !running) return;
      try{ el.remove(); }catch{}
      handleTimeout(type);
      planNextSpawn();
    }, life);

    layer.appendChild(el);
    stats.spawns++;
  }

  function classify(ch){
    if(ch===SPECIAL.STAR)    return 'star';
    if(ch===SPECIAL.DIAMOND) return 'diamond';
    if(ch===SPECIAL.SHIELD)  return 'shield';
    if(GOOD.includes(ch))    return 'good';
    return 'junk';
  }

  function handleHit(type, x, y){
    if(type==='good'){
      stats.goodCount++; stats.hits++;
      stats.score += 10; stats.combo += 1; feverAdd(4);
      updateScoreCombo();
      scorePop(x,y,'+10'); burstShards(x,y,'#22c55e', 18, 360);
    }else if(type==='junk'){
      // junk punishment (shield can save once)
      if(stats.shields>0){
        stats.shields--; // consume
        fire('hha:coach',{text:'โล่ช่วยไว้! 🛡️'});
        scorePop(x,y,'SAVE');
      }else{
        stats.misses++; stats.combo = 0; stats.score = Math.max(0, stats.score-20);
        updateScoreCombo();
        scorePop(x,y,'-20'); burstShards(x,y,'#ef4444', 18, 360);
        stats.noMissTime = 0;
      }
    }else if(type==='star'){
      stats.star++; stats.hits++;
      stats.score += 25; stats.combo += 1; feverAdd(12);
      updateScoreCombo();
      scorePop(x,y,'⭐ +25'); burstShards(x,y,'#ffd166', 26, 420);
    }else if(type==='diamond'){
      stats.diamond++; stats.hits++;
      stats.score += 60; stats.combo += 1; feverAdd(20);
      updateScoreCombo();
      scorePop(x,y,'💎 +60'); burstShards(x,y,'#60a5fa', 30, 460);
    }else if(type==='shield'){
      stats.shield++; stats.hits++;
      stats.shields++; stats.combo += 1; stats.score += 15; feverAdd(8);
      updateScoreCombo();
      scorePop(x,y,'🛡️ +1'); burstShards(x,y,'#a3e635', 22, 420);
    }
    // mission step
    checkQuestAdvance();
  }

  function handleTimeout(type){
    if(type==='junk'){
      // avoided: +point small, keep combo
      stats.junkAvoid++; stats.score += 5; feverAdd(3);
      fire('hha:coach',{text:'เลี่ยงขยะได้ดี! +5'});
      scorePop(vw()/2, vh()/2, '+5');
    }else{
      // good missed → penalty
      if(stats.shields>0){
        stats.shields--; // shield saves penalty once
        fire('hha:coach',{text:'โล่กันพลาด! 🛡️'});
      }else{
        stats.misses++; stats.combo = 0;
        stats.score = Math.max(0, stats.score - 10);
        updateScoreCombo();
        stats.noMissTime = 0;
      }
    }
    checkQuestAdvance();
  }

  // ---------- lifecycle ----------
  function end(reason='done'){
    if(!running) return;
    running = false;
    try{ clearTimeout(spawnTimer); }catch{}
    try{ clearInterval(timeTimer); }catch{}
    try{ clearInterval(watchdog); }catch{}
    // clear targets
    Array.from(layer.querySelectorAll('.hha-tgt')).forEach(n=>{ try{ n.remove() }catch{} });

    // result
    fire('hha:end', {
      reason, duration,
      score: stats.score, hits: stats.hits, spawns: stats.spawns, misses: stats.misses,
      comboMax: stats.comboMax, difficulty,
      questsCleared: stats.questsCleared, questsTotal: stats.questsTotal
    });

    try{ layer.remove(); }catch{}
  }

  // start
  fire('hha:quest', {text:'กำลังสุ่มภารกิจ…'} );
  startTimers();

  // public API
  return {
    pause(){ running=false; try{ clearTimeout(spawnTimer);}catch{}; },
    resume(){ if(running) return; running=true; planNextSpawn(); },
    stop(){ end('quit'); }
  };
}

// ---------- default export ----------
export default { boot };

// ---------- (end of file) ----------
