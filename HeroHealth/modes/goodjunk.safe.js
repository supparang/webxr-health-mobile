// === modes/goodjunk.safe.js (Release bundle) ===
// DOM-based arcade for A-Frame page. Spawns emoji targets as HTML nodes on a fixed layer.
// - Mini Quest: pick 3 of 10 each run (no duplicates, easy/normal/hard tiers)
// - Fever: gain on hits/quests; decay; start/end events for HUD; aura via body class handled in index
// - Shards: simple CSS particles with per-type color palette
// - Items: GOOD/JUNK/STAR/DIAMOND/SHIELD
// - Rules:
//   * Click GOOD => +10, combo++, fever +4, shards (green). Miss GOOD (expire) => -3, combo=0, miss++
//   * Click JUNK => -8, combo=0, miss++, shards (red)
//   * Let JUNK expire (avoid) => +2, combo stays, quest "เลี่ยงขยะ" +1
//   * STAR (⭐) => +30, fever +40
//   * DIAMOND (💎) => +60, fever +60
//   * SHIELD (🛡️) => protects next one BAD click (no penalty), small score +5
// - Difficulty affects spawn rate / life / size
// - Guaranteed watchdog spawns & first spawn centered

export async function boot(config={}){
  // ---------- config ----------
  const host = config.host || document.body;
  const DIFF = String(config.difficulty||'normal').toLowerCase();
  const DURATION = Math.max(15, Number(config.duration||60));
  const DEBUG = getFlag('debug');

  // Pools
  const POOLS = {
    GOOD:   ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'],
    JUNK:   ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'],
    STAR:   ['⭐'],
    DIAMOND:['💎'],
    SHIELD: ['🛡️']
  };

  // Difficulty tables
  const DIFFCFG = {
    easy:   { size: 72, rateMin: 900,  rateMax: 1200, life: 2200, junkRatio: 0.28, specialRatio: 0.08 },
    normal: { size: 64, rateMin: 750,  rateMax: 1000, life: 1800, junkRatio: 0.36, specialRatio: 0.10 },
    hard:   { size: 56, rateMin: 600,  rateMax:  850, life: 1500, junkRatio: 0.42, specialRatio: 0.12 }
  };
  const CFG = DIFFCFG[DIFF] || DIFFCFG.normal;

  // ---------- DOM layer ----------
  const layer = ensureLayer(); // fixed full-screen container for targets & shards
  const dbg = DEBUG ? ensureDbg() : null;

  // ---------- state ----------
  let running=true;
  let score=0, combo=0, misses=0, hits=0, spawns=0, comboMax=0;
  let avoidJunk=0, goodCount=0, starCount=0, diamondCount=0, shield=0;
  let feverLv=0, feverActive=false, feverCount=0;
  let timeLeft=DURATION;
  let spawnTimer=null, timeTimer=null, watchdog=null;

  // Mini Quest deck: 3 from 10 (tiers)
  const QUEST_POOL = [
    { id:'good10',    tier:'easy',   label:'เก็บของดี 10 ชิ้น',  check:s=>s.goodCount>=10,   prog:s=>`${Math.min(10,s.goodCount)}/10` },
    { id:'avoid5',    tier:'easy',   label:'หลีกของขยะ 5 ครั้ง',  check:s=>s.avoidJunk>=5,    prog:s=>`${Math.min(5,s.avoidJunk)}/5` },
    { id:'combo10',   tier:'normal', label:'ทำคอมโบ 10',         check:s=>s.comboMax>=10,    prog:s=>`${Math.min(10,s.comboMax)}/10` },
    { id:'good20',    tier:'normal', label:'เก็บของดี 20 ชิ้น',  check:s=>s.goodCount>=20,   prog:s=>`${Math.min(20,s.goodCount)}/20` },
    { id:'nostreak10',tier:'normal', label:'ไม่พลาด 10 วิ',       check:s=>s.noMissTime>=10,  prog:s=>`${Math.min(10,s.noMissTime)}s/10s` },
    { id:'fever2',    tier:'hard',   label:'เข้า FEVER 2 ครั้ง',  check:s=>s.feverCount>=2,   prog:s=>`${Math.min(2,s.feverCount)}/2` },
    { id:'combo20',   tier:'hard',   label:'คอมโบ 20 ต่อเนื่อง', check:s=>s.comboMax>=20,    prog:s=>`${Math.min(20,s.comboMax)}/20` },
    { id:'score500',  tier:'hard',   label:'ทำคะแนน 500+',        check:s=>s.score>=500,      prog:s=>`${Math.min(500,s.score)}/500`},
    { id:'star3',     tier:'normal', label:'เก็บดาว ⭐ 3 ดวง',     check:s=>s.starCount>=3,    prog:s=>`${Math.min(3,s.starCount)}/3` },
    { id:'diamond1',  tier:'hard',   label:'เก็บเพชร 💎 1 เม็ด',   check:s=>s.diamondCount>=1, prog:s=>`${Math.min(1,s.diamondCount)}/1` },
  ];
  const STATS = { goodCount, avoidJunk, comboMax, noMissTime:0, feverCount, score, starCount, diamondCount };
  const DECK = drawDeck(QUEST_POOL);
  let questIdx = 0;

  // ---------- boot ui ----------
  fire('hha:quest', { text: questLabel() });
  coach('เริ่มเลย! เก็บของดี หลีกของขยะ ถ้าเจอ ⭐ หรือ 💎 ยิงให้ไว!');

  // ---------- timers ----------
  timeTimer = setInterval(()=>{
    if(!running) return;
    timeLeft=Math.max(0,timeLeft-1);
    STATS.noMissTime = Math.min(999, STATS.noMissTime+1);
    fire('hha:time',{sec:timeLeft});
    if(timeLeft<=0){ end('timeout'); }
  },1000);

  // first spawn center, then schedule loop
  spawnOne(true);
  scheduleNext();
  startWatchdog();

  // ---------- public api ----------
  return {
    stop: end,
    pause(){ running=false; clearTimeout(spawnTimer); },
    resume(){ if(!running){ running=true; scheduleNext(); } }
  };

  // ========== functions ==========
  function questLabel(){
    const q = DECK[questIdx];
    if(!q) return 'Mini Quest — สำเร็จ!';
    return `Quest ${questIdx+1}/3: ${q.label} (${q.prog(mapStats())})`;
  }
  function mapStats(){
    return {
      goodCount, junkMiss:misses, comboMax,
      noMissTime:STATS.noMissTime, feverCount, score, star:starCount, diamond:diamondCount
    };
  }
  function tickQuest(){
    const cur = DECK[questIdx];
    if(!cur) return;
    if(cur.check(mapStats())){
      questIdx = Math.min(2, questIdx+1);
      if(questIdx>=DECK.length){
        coach('สุดยอด! เคลียร์ Mini Quest ครบแล้ว เปิด FEVER ให้เลย!');
        feverAdd(100); // เติมเต็ม
      }else{
        coach('ยอดมาก! ไปเควสต์ต่อไปกัน!');
      }
      fire('hha:quest',{ text: questLabel() });
    }else{
      fire('hha:quest',{ text: questLabel() });
    }
  }

  function scheduleNext(){
    if(!running) return;
    const wait = randInt(CFG.rateMin, CFG.rateMax);
    spawnTimer = setTimeout(spawnOne, wait);
  }
  function startWatchdog(){
    if(watchdog) clearInterval(watchdog);
    watchdog = setInterval(()=>{
      if(!running) return;
      if(!layer.querySelector('.hja-tgt')) spawnOne(true);
    }, 1800);
  }

  function spawnOne(forceCenter=false){
    if(!running) return;
    // decide type
    const r = Math.random();
    let type='GOOD';
    if(r<CFG.specialRatio) type = Math.random()<0.5 ? 'STAR':'DIAMOND';
    else if(r<CFG.specialRatio+0.05) type='SHIELD';
    else if(r<(CFG.specialRatio+0.05+CFG.junkRatio)) type='JUNK';

    const ch = pick(POOLS[type]);
    const el = document.createElement('div');
    el.className='hja-tgt';
    el.textContent = ch;
    el.dataset.type = type;
    spawns++;

    styleTarget(el, forceCenter);

    let clicked=false, expired=false;
    function destroy(){
      try{ el.remove(); }catch(_){}
    }

    const onClick = (ev)=>{
      if(clicked||expired||!running) return;
      ev.preventDefault?.();
      clicked=true;

      // Resolve by type
      if(type==='GOOD'){
        const gain = feverActive ? 15 : 10;
        score+=gain; hits++; goodCount++; combo++; comboMax=Math.max(comboMax,combo);
        feverAdd(4);
        shards(el, 'good');
        coachCombo(combo);
      }else if(type==='JUNK'){
        if(shield>0){
          shield--; coach('โล่ช่วยไว้! ไม่เสียคะแนน');
          shards(el, 'shield');
        }else{
          score-=8; combo=0; misses++;
          shards(el, 'junk');
          coach('บ๊ะ จิ้มโดนของขยะ! โฟกัสดี ๆ');
        }
      }else if(type==='STAR'){
        score+=30; hits++; starCount++; combo++; comboMax=Math.max(comboMax,combo);
        feverAdd(40); shards(el,'star'); coach('ได้ ⭐ บูสแรงมาก!');
      }else if(type==='DIAMOND'){
        score+=60; hits++; diamondCount++; combo++; comboMax=Math.max(comboMax,combo);
        feverAdd(60); shards(el,'diamond'); coach('เพชร! +60 คะแนน!');
      }else if(type==='SHIELD'){
        score+=5; shield=Math.min(2, shield+1); shards(el,'shield'); coach('ได้โล่! ป้องกันของขยะหนึ่งครั้ง');
      }

      destroy();
      updateScore();
      tickQuest();
      scheduleNext();
    };

    el.addEventListener('click', onClick, {passive:false});
    el.addEventListener('touchstart', onClick, {passive:false});

    // lifetime
    const ttl = setTimeout(()=>{
      if(clicked||!running) return;
      expired=true; destroy();

      if(type==='GOOD'){
        // penalty
        score-=3; combo=0; misses++; coach('ของดีหลุดมือ! ตั้งสติ');
      }else if(type==='JUNK'){
        // reward for avoiding
        score+=2; avoidJunk++; coach('เลี่ยงขยะได้ดี! +2');
      }else{
        // specials expire = no change
      }
      updateScore();
      tickQuest();
      scheduleNext();
    }, CFG.life);

    layer.appendChild(el);
    ensureOnScreen(el);

    // pop in
    el.style.transform+=' scale(.8)';
    setTimeout(()=> el.style.transform=el.style.transform.replace('scale(.8)','scale(1)'), 10);
  }

  function styleTarget(el, forceCenter){
    const fs = CFG.size; // px font-size
    const vw = Math.max(320, window.innerWidth||320);
    const vh = Math.max(320, window.innerHeight||320);
    const x = forceCenter ? vw/2 : Math.floor(vw*0.20 + Math.random()*vw*0.60);
    const y = forceCenter ? vh/2 : Math.floor(vh*0.28 + Math.random()*vh*0.48);

    Object.assign(el.style, {
      position:'absolute',
      left:x+'px', top:y+'px', transform:'translate(-50%,-50%)',
      fontSize: fs+'px', lineHeight:1, filter:'drop-shadow(0 8px 14px rgba(0,0,0,.5))',
      transition:'transform .12s ease, opacity .24s ease', cursor:'pointer', userSelect:'none'
    });
  }

  function updateScore(){
    fire('hha:score',{score, combo});
  }

  // ===== Fever =====
  function feverAdd(v){
    feverLv = clamp(feverLv + Number(v||0), 0, 100);
    if(!feverActive && feverLv>=100){ feverStart(); return; }
    fire('hha:fever', {state:'change', level:feverLv, active:feverActive});
  }
  function feverStart(){
    feverActive=true; feverLv=100; feverCount++; STATS.feverCount=feverCount;
    fire('hha:fever',{state:'start', level:100, active:true});
    setTimeout(()=>feverEnd(), 9000); // 9s
  }
  function feverEnd(){
    if(!feverActive) return;
    feverActive=false; feverLv=0;
    fire('hha:fever',{state:'end', level:0, active:false});
  }

  // ===== shards (simple CSS particles) =====
  function shards(anchor, kind){
    const palette = {
      good:['#4ade80','#34d399','#10b981','#22c55e'],
      junk:['#ef4444','#f97316','#fb7185','#f43f5e'],
      star:['#fde047','#facc15','#ffbf00','#ffdd55'],
      diamond:['#67e8f9','#22d3ee','#38bdf8','#60a5fa'],
      shield:['#a3a3a3','#9ca3af','#cbd5e1','#94a3b8']
    }[kind] || ['#93c5fd','#60a5fa','#3b82f6','#2563eb'];

    const rect = anchor.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    for(let i=0;i<18;i++){
      const p = document.createElement('div');
      p.className='hja-shard';
      const s = 4 + Math.random()*7;
      const ang = Math.random()*Math.PI*2;
      const dist = 40 + Math.random()*90;
      const tx = Math.cos(ang)*dist;
      const ty = Math.sin(ang)*dist;
      Object.assign(p.style,{
        position:'fixed', left:(cx-s/2)+'px', top:(cy-s/2)+'px', width:s+'px', height:s+'px',
        background: palette[Math.floor(Math.random()*palette.length)],
        borderRadius: '2px', opacity:'0.95', zIndex:700, transform:'translate(0,0)', transition:'transform .5s ease-out, opacity .5s ease-out'
      });
      layer.appendChild(p);
      requestAnimationFrame(()=>{ p.style.transform=`translate(${tx}px,${ty}px)`; p.style.opacity='0'; });
      setTimeout(()=>{ try{p.remove();}catch(_){}} ,520);
    }

    // score float
    const fl = document.createElement('div');
    fl.textContent = (kind==='junk' && shield===0) ? '-8' :
                     (kind==='good') ? (feverActive?'+15':'+10') :
                     (kind==='star') ? '+30' :
                     (kind==='diamond') ? '+60' :
                     (kind==='shield') ? '+5' : '+';
    Object.assign(fl.style,{
      position:'fixed', left:(cx)+'px', top:(cy)+'px', transform:'translate(-50%,-50%)',
      color:'#e5e7eb', fontWeight:800, textShadow:'0 2px 8px #000',
      transition:'transform .6s ease, opacity .6s ease', zIndex:720
    });
    layer.appendChild(fl);
    requestAnimationFrame(()=>{ fl.style.transform='translate(-50%,-120%)'; fl.style.opacity='0'; });
    setTimeout(()=>fl.remove(),650);
  }

  // ===== utils =====
  function ensureLayer(){
    // clean old
    document.querySelectorAll('.hja-layer').forEach(n=>n.remove());
    const el = document.createElement('div');
    el.className='hja-layer';
    Object.assign(el.style,{ position:'fixed', inset:0, zIndex:650, pointerEvents:'auto', background:'transparent' });
    document.body.appendChild(el);
    // embed base CSS once
    if(!document.getElementById('hja-style')){
      const st=document.createElement('style'); st.id='hja-style';
      st.textContent = `.hja-tgt{opacity:1}.hja-tgt.hit{opacity:.1;transform:translate(-50%,-50%) scale(.85)} .hja-shard{will-change:transform,opacity}`;
      document.head.appendChild(st);
    }
    return el;
  }
  function ensureDbg(){
    const d=document.createElement('div');
    d.className='hud-chip';
    Object.assign(d.style,{left:'50%',top:'54px',transform:'translateX(-50%)',zIndex:901});
    d.textContent='DEBUG';
    document.body.appendChild(d);
    return d;
  }
  function ensureOnScreen(el){
    const r = el.getBoundingClientRect();
    const vw= Math.max(320, window.innerWidth||320);
    const vh= Math.max(320, window.innerHeight||320);
    const ok = r.width>0 && r.height>0 && r.left>-2 && r.top>-2 && r.right<vw+2 && r.bottom<vh+2;
    if(!ok){ el.style.left = (vw/2)+'px'; el.style.top=(vh/2)+'px'; }
  }
  function coach(text){ fire('hha:coach',{text}); }
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }
  function randInt(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function drawDeck(pool){
    const select=(tier)=>{ const c=pool.filter(q=>q.tier===tier); return c[Math.floor(Math.random()*c.length)] };
    const chosen=new Map();
    ['easy','normal','hard'].forEach(t=>{
      let q=select(t), guard=30; while(chosen.has(q.id)&&guard-->0) q=select(t);
      chosen.set(q.id,q);
    });
    return Array.from(chosen.values());
  }
  function getFlag(name){
    const q = window?.location?.search || '';
    return new RegExp(`[?&]${name}(?:=1|&|$)`).test(q);
  }

  function end(reason='done'){
    if(!running) return;
    running=false;
    try{ clearTimeout(spawnTimer);}catch(_){}
    try{ clearInterval(timeTimer);}catch(_){}
    try{ clearInterval(watchdog);}catch(_){}
    // clear nodes
    layer.querySelectorAll('.hja-tgt,.hja-shard').forEach(n=>n.remove());
    const detail={
      reason, score, combo, comboMax, misses, hits, spawns,
      questsCleared: questIdx + (DECK[questIdx]?.check(mapStats())?1:0),
      questsTotal: DECK.length,
      duration: DURATION,
      mode: 'Good vs Junk',
      difficulty: DIFF
    };
    fire('hha:end', detail);
  }
}

export default { boot };
