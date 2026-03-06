'use strict';

(function(){
  const DOC = document;
  const WIN = window;
  const $ = (s)=>DOC.querySelector(s);
  const byId = (id)=>DOC.getElementById(id);

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,Number(v)));
  const clamp01 = (v)=>clamp(v,0,1);
  const qs = (k,d='')=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const hub = qs('hub','../hub.html');
  const diff = String(qs('diff','normal')).toLowerCase();
  const mode = String(qs('run','play')).toLowerCase();
  const seed = Number(qs('seed', Date.now()));
  const timeLimit = Math.max(30, Number(qs('time','70')) || 70);
  const view = String(qs('view','mobile')).toLowerCase();
  const rng = seededRng(seed);

  const arena = byId('arena');
  const world = byId('world');
  const popLayer = byId('popLayer');
  const bossBanner = byId('bossBanner');
  const crosshairHint = byId('crosshairHint');

  const btnStart = byId('btnStart');
  const btnRetry = byId('btnRetry');
  const btnPause = byId('btnPause');
  const btnBack = byId('btnBack');
  const btnEndRetry = byId('btnEndRetry');
  const btnEndBack = byId('btnEndBack');

  const endScreen = byId('endScreen');

  const tScore = byId('tScore');
  const tCombo = byId('tCombo');
  const tPhase = byId('tPhase');
  const tMission = byId('tMission');
  const tShield = byId('tShield');
  const bShield = byId('bShield');
  const tThreat = byId('tThreat');
  const bThreat = byId('bThreat');
  const tParry = byId('tParry');
  const bParry = byId('bParry');
  const tDroplets = byId('tDroplets');
  const tInfected = byId('tInfected');
  const tPerfect = byId('tPerfect');
  const tMiss = byId('tMiss');

  const sScore = byId('sScore');
  const sComboMax = byId('sComboMax');
  const sPerfect = byId('sPerfect');
  const sMiss = byId('sMiss');
  const sShield = byId('sShield');
  const sThreat = byId('sThreat');
  const endBadges = byId('endBadges');
  const endNote = byId('endNote');

  const st = {
    running:false,
    paused:false,
    over:false,
    t0:0,
    elapsedSec:0,

    score:0,
    combo:0,
    comboMax:0,
    perfect:0,
    miss:0,

    shield:42,
    threat:0,
    parry:0,

    phase:'warm', // warm | pressure | boss
    warmClears:0,
    pressureParries:0,

    dropletCount:0,
    infectedCount:0,

    bossActive:false,
    bossNeedPerfect:0,
    bossGotPerfect:0,
    nextBossAt:0,

    entities:new Map(),
    uid:0,

    freezeUntil:0,
    spawnTimer:null,
    tickTimer:null
  };

  const CFG = {
    spawnMs: diff==='hard' ? 700 : diff==='easy' ? 980 : 820,
    ttlDroplet: diff==='hard' ? 1700 : diff==='easy' ? 2400 : 2000,
    ttlMask: diff==='hard' ? 1800 : diff==='easy' ? 2400 : 2100,
    ttlInfected: diff==='hard' ? 2600 : diff==='easy' ? 3200 : 2900,
    coughWarnMs: diff==='hard' ? 360 : 460,
    coughChargeMs: diff==='hard' ? 320 : 380,
    coughStrikeMs: diff==='hard' ? 240 : 280,
    bossEveryMs: diff==='hard' ? 17000 : 21000
  };

  function rect(){ return world.getBoundingClientRect(); }

  function toast(msg){
    const el = byId('toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1000);
  }

  function prompt(msg){
    const el = byId('mcfxPrompt');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(prompt._t);
    prompt._t = setTimeout(()=> el.classList.remove('show'), 950);
  }

  function flashBad(){
    const el = byId('mcfxFlash');
    if(!el) return;
    el.style.opacity='1';
    clearTimeout(flashBad._t);
    flashBad._t = setTimeout(()=> el.style.opacity='0', 120);
  }

  function shake(){
    if(!arena) return;
    arena.classList.remove('shake');
    void arena.offsetWidth;
    arena.classList.add('shake');
  }

  function pop(x,y,text,cls='good'){
    const el = DOC.createElement('div');
    el.className = `pop ${cls}`;
    el.style.left = x+'px';
    el.style.top = y+'px';
    el.textContent = text;
    popLayer.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch(_){} }, 600);
  }

  function showBossBanner(text='👿 BOSS INCOMING'){
    bossBanner.hidden = false;
    bossBanner.textContent = text;
  }
  function hideBossBanner(){
    bossBanner.hidden = true;
  }

  function updateHud(){
    tScore.textContent = String(st.score);
    tCombo.textContent = String(st.combo);
    tPhase.textContent = st.phase;
    tShield.textContent = `${Math.round(st.shield)}%`;
    bShield.style.width = `${clamp(st.shield,0,100)}%`;
    tThreat.textContent = `${Math.round(st.threat)}%`;
    bThreat.style.width = `${clamp(st.threat,0,100)}%`;
    tParry.textContent = `${Math.round(st.parry)}%`;
    bParry.style.width = `${clamp(st.parry,0,100)}%`;
    tDroplets.textContent = String(st.dropletCount);
    tInfected.textContent = String(st.infectedCount);
    tPerfect.textContent = String(st.perfect);
    tMiss.textContent = String(st.miss);

    if(st.phase==='warm'){
      tMission.textContent = `Clear ${Math.min(st.warmClears,12)}/12`;
    }else if(st.phase==='pressure'){
      tMission.textContent = `Parry ${Math.min(st.pressureParries,2)}/2`;
    }else{
      tMission.textContent = `Boss ${st.bossGotPerfect}/${st.bossNeedPerfect}`;
    }
  }

  function recomputeCounts(){
    let d=0, i=0;
    for(const [,e] of st.entities){
      if(e.type==='droplet') d++;
      if(e.type==='infected') i++;
    }
    st.dropletCount = d;
    st.infectedCount = i;
  }

  function updatePhase(){
    if(st.elapsedSec < 20){
      st.phase = 'warm';
    }else if(st.elapsedSec < Math.max(45, timeLimit - 15)){
      st.phase = 'pressure';
    }else{
      st.phase = 'boss';
    }
  }

  function entityEmoji(type){
    if(type==='droplet') return '💦';
    if(type==='mask') return '😷';
    if(type==='infected') return '🦠';
    if(type==='cough') return '🤧';
    return '❔';
  }

  function addEntity(type,x,y,ttl){
    const id = String(++st.uid);
    const el = DOC.createElement('div');
    el.className = `entity ${type}`;
    el.textContent = entityEmoji(type);
    el.style.left = x+'px';
    el.style.top = y+'px';
    el.dataset.id = id;
    el.dataset.type = type;

    const now = performance.now();

    const e = {
      id, el, type, x, y,
      bornMs: now,
      dieMs: now + ttl,
      state: 'idle',   // cough: warn|charge|strike
      stateAt: now
    };

    if(type==='cough'){
      e.state='warn';
      el.classList.add('warn');
    }

    el.addEventListener('pointerdown', (ev)=>{
      if(view==='cvr') return;
      ev.preventDefault();
      onTapEntity(id);
    }, {passive:false});

    st.entities.set(id, e);
    world.appendChild(el);
    recomputeCounts();
  }

  function removeEntity(id, popped=false){
    const e = st.entities.get(id);
    if(!e) return;
    st.entities.delete(id);
    if(e.el){
      e.el.classList.add(popped ? 'pop' : 'fade');
      setTimeout(()=>{ try{e.el.remove();}catch(_){} }, 220);
    }
    recomputeCounts();
  }

  function randomXY(){
    const r = rect();
    const pad = 52;
    return {
      x: pad + rng() * Math.max(20, r.width - pad*2),
      y: pad + rng() * Math.max(20, r.height - pad*2)
    };
  }

  function spawnDroplet(){
    const p = randomXY();
    addEntity('droplet', p.x, p.y, CFG.ttlDroplet);
  }

  function spawnMask(){
    const p = randomXY();
    addEntity('mask', p.x, p.y, CFG.ttlMask);
  }

  function spawnInfected(x,y){
    addEntity('infected', x, y, CFG.ttlInfected);
  }

  function spawnCough(){
    const p = randomXY();
    addEntity('cough', p.x, p.y, CFG.coughWarnMs + CFG.coughChargeMs + CFG.coughStrikeMs);
  }

  function spawnWave(){
    if(!st.running || st.paused || st.over) return;

    const ratio = clamp01(st.elapsedSec / timeLimit);
    const speedMul = diff==='hard' ? (1 + ratio*0.18) : (1 + ratio*0.10);

    if(st.phase==='warm'){
      spawnDroplet();
      if(rng() < 0.28) spawnDroplet();
      if(rng() < 0.18) spawnMask();
      if(rng() < 0.22) spawnCough();
    }else if(st.phase==='pressure'){
      spawnDroplet();
      spawnDroplet();
      if(rng() < 0.38) spawnCough();
      if(rng() < 0.16) spawnMask();
      if(rng() < 0.20){
        const p = randomXY();
        spawnInfected(p.x,p.y);
      }
    }else{
      spawnDroplet();
      spawnDroplet();
      if(rng() < 0.46) spawnCough();
      if(rng() < 0.10) spawnMask();
      if(rng() < 0.22){
        const p = randomXY();
        spawnInfected(p.x,p.y);
      }
    }

    const next = Math.max(260, Math.round(CFG.spawnMs / speedMul));
    st.spawnTimer = setTimeout(spawnWave, next);
  }

  function mutateDroplet(e){
    removeEntity(e.id, false);
    spawnInfected(e.x, e.y);
  }

  function clearNearbyInfected(x,y,radius){
    let cleared = 0;
    for(const [id,e] of [...st.entities]){
      if(e.type!=='infected') continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if(d <= radius){
        removeEntity(id, true);
        cleared++;
      }
    }
    return cleared;
  }

  function clearNearbyDroplets(x,y,radius){
    let cleared = 0;
    for(const [id,e] of [...st.entities]){
      if(e.type!=='droplet') continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if(d <= radius){
        removeEntity(id, true);
        cleared++;
      }
    }
    return cleared;
  }

  function onPerfectParry(e){
    const r = rect();
    const sx = r.left + e.x;
    const sy = r.top + e.y;

    st.perfect++;
    st.combo++;
    st.comboMax = Math.max(st.comboMax, st.combo);
    st.score += (st.phase==='boss' ? 8 : 6);
    st.parry = clamp(st.parry + 18, 0, 100);
    st.threat = Math.max(0, st.threat - 14);
    st.shield = clamp(st.shield + 4, 0, 100);

    if(st.phase==='pressure') st.pressureParries++;
    if(st.phase==='boss') st.bossGotPerfect++;

    const c1 = clearNearbyInfected(e.x, e.y, 130);
    const c2 = clearNearbyDroplets(e.x, e.y, 95);

    removeEntity(e.id, true);
    pop(sx, sy, `+${6 + c1 + c2}`, 'pro');
    shake();
    prompt('✨ PERFECT PARRY!');
  }

  function onNormalBlock(e){
    const r = rect();
    const sx = r.left + e.x;
    const sy = r.top + e.y;

    st.combo++;
    st.comboMax = Math.max(st.comboMax, st.combo);
    st.score += 2;
    st.parry = clamp(st.parry + 8, 0, 100);
    st.threat = Math.max(0, st.threat - 6);

    removeEntity(e.id, true);
    pop(sx, sy, '+2', 'good');
  }

  function onCoughHit(e){
    const r = rect();
    const sx = r.left + e.x;
    const sy = r.top + e.y;

    st.combo = 0;
    st.miss++;
    st.shield = clamp(st.shield - 16, 0, 100);
    st.threat = clamp(st.threat + 14, 0, 100);

    removeEntity(e.id, false);

    flashBad();
    shake();
    pop(sx, sy, '-16', 'bad');
    prompt('😷 โดนละอองไอ!');

    for(let i=0;i<2;i++){
      const dx = (rng()*80)-40;
      const dy = (rng()*80)-40;
      spawnInfected(clamp(e.x+dx,30,rect().width-30), clamp(e.y+dy,30,rect().height-30));
    }
  }

  function onTapEntity(id){
    if(!st.running || st.paused || st.over) return;
    const e = st.entities.get(id);
    if(!e) return;

    const r = rect();
    const sx = r.left + e.x;
    const sy = r.top + e.y;

    if(e.type==='droplet'){
      st.score += 1;
      st.combo++;
      st.comboMax = Math.max(st.comboMax, st.combo);
      st.warmClears++;
      st.parry = clamp(st.parry + 3, 0, 100);
      removeEntity(id, true);
      pop(sx, sy, '+1', 'good');
    }
    else if(e.type==='mask'){
      st.score += 1;
      st.combo++;
      st.comboMax = Math.max(st.comboMax, st.combo);
      st.shield = clamp(st.shield + 15, 0, 100);
      removeEntity(id, true);
      pop(sx, sy, '+Shield', 'good');
      prompt('🛡️ Shield +');
    }
    else if(e.type==='infected'){
      st.combo = 0;
      st.miss++;
      st.shield = clamp(st.shield - 8, 0, 100);
      st.threat = clamp(st.threat + 8, 0, 100);
      removeEntity(id, true);
      pop(sx, sy, '-8', 'bad');
      flashBad();
    }
    else if(e.type==='cough'){
      if(e.state==='strike'){
        onPerfectParry(e);
      }else if(e.state==='charge'){
        onNormalBlock(e);
      }else{
        // too early
        st.combo = 0;
        st.threat = clamp(st.threat + 5, 0, 100);
        pop(sx, sy, 'EARLY!', 'bad');
      }
    }

    applyComboRewards();
    updateHud();
  }

  function applyComboRewards(){
    if(st.combo === 3){
      st.score += 3;
      prompt('⚡ x2 Combo!');
    }else if(st.combo === 5){
      st.shield = clamp(st.shield + 6, 0, 100);
      prompt('🛡️ Combo Shield!');
    }else if(st.combo === 8){
      st.parry = clamp(st.parry + 18, 0, 100);
      st.freezeUntil = performance.now() + 700;
      prompt('⏳ Slow Time!');
    }else if(st.combo === 12){
      const n = clearNearbyDroplets(rect().width/2, rect().height/2, 9999);
      st.score += n;
      prompt('💥 Clean Burst!');
    }
  }

  function advanceCoughState(e, now){
    const age = now - e.bornMs;
    const a = CFG.coughWarnMs;
    const b = CFG.coughWarnMs + CFG.coughChargeMs;

    if(age < a){
      if(e.state!=='warn'){
        e.state='warn';
        e.el.classList.remove('charge','strike');
        e.el.classList.add('warn');
      }
    }else if(age < b){
      if(e.state!=='charge'){
        e.state='charge';
        e.el.classList.remove('warn','strike');
        e.el.classList.add('charge');
      }
    }else if(age < a + CFG.coughChargeMs + CFG.coughStrikeMs){
      if(e.state!=='strike'){
        e.state='strike';
        e.el.classList.remove('warn','charge');
        e.el.classList.add('strike');
      }
    }else{
      onCoughHit(e);
    }
  }

  function maybeBoss(){
    if(st.phase!=='boss') return;
    if(st.bossActive) return;
    if(st.elapsedSec < Math.max(45, timeLimit-15)) return;

    st.bossActive = true;
    st.bossNeedPerfect = diff==='hard' ? 3 : 2;
    st.bossGotPerfect = 0;
    showBossBanner(`👿 BOSS SWEEP ${st.bossNeedPerfect} PERFECT`);
    prompt('👿 บอสมาแล้ว!');
  }

  function tick(){
    if(!st.running || st.paused || st.over) return;

    const now = performance.now();
    st.elapsedSec = (now - st.t0)/1000;

    updatePhase();
    maybeBoss();

    for(const [id,e] of [...st.entities]){
      if(e.type==='cough'){
        advanceCoughState(e, now);
        continue;
      }

      if(now >= e.dieMs){
        if(e.type==='droplet'){
          st.combo = 0;
          st.miss++;
          st.threat = clamp(st.threat + 5, 0, 100);
          mutateDroplet(e);
        }else if(e.type==='mask'){
          removeEntity(id,false);
        }else if(e.type==='infected'){
          st.threat = clamp(st.threat + 6, 0, 100);
          removeEntity(id,false);
        }
      }
    }

    // infected pressure
    st.threat = clamp(st.threat + (st.infectedCount * 0.02), 0, 100);

    // too many droplets = pressure
    if(st.dropletCount >= 6){
      st.threat = clamp(st.threat + 0.16, 0, 100);
    }

    // threat punishes shield slowly
    if(st.threat >= 75){
      st.shield = clamp(st.shield - 0.05, 0, 100);
    }

    // boss fail at end
    if(st.phase==='boss' && st.elapsedSec >= timeLimit - 0.3){
      if(st.bossGotPerfect < st.bossNeedPerfect){
        st.shield = clamp(st.shield - 12, 0, 100);
        st.score = Math.max(0, st.score - 6);
      }
    }

    if(st.elapsedSec >= timeLimit){
      endGame('time');
      return;
    }
    if(st.shield <= 0){
      endGame('shield');
      return;
    }

    updateHud();
  }

  function resetState(){
    st.running = false;
    st.paused = false;
    st.over = false;
    st.t0 = 0;
    st.elapsedSec = 0;

    st.score = 0;
    st.combo = 0;
    st.comboMax = 0;
    st.perfect = 0;
    st.miss = 0;

    st.shield = diff==='easy' ? 48 : diff==='hard' ? 38 : 42;
    st.threat = 0;
    st.parry = 0;

    st.phase = 'warm';
    st.warmClears = 0;
    st.pressureParries = 0;

    st.dropletCount = 0;
    st.infectedCount = 0;

    st.bossActive = false;
    st.bossNeedPerfect = 0;
    st.bossGotPerfect = 0;
    st.nextBossAt = 0;

    st.freezeUntil = 0;

    if(st.spawnTimer) clearTimeout(st.spawnTimer);
    if(st.tickTimer) clearInterval(st.tickTimer);

    for(const [,e] of st.entities){
      try{ e.el.remove(); }catch(_){}
    }
    st.entities.clear();

    hideBossBanner();
    updateHud();
  }

  function startGame(){
    resetState();
    endScreen.hidden = true;

    st.running = true;
    st.t0 = performance.now();

    if(view==='cvr'){
      crosshairHint.hidden = false;
    }else{
      crosshairHint.hidden = true;
    }

    prompt('💦 เคลียร์ฝูงก่อน แล้วรอ 🤧 ให้เข้าเขียว');
    spawnWave();
    st.tickTimer = setInterval(tick, 80);
  }

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;

    if(st.spawnTimer) clearTimeout(st.spawnTimer);
    if(st.tickTimer) clearInterval(st.tickTimer);

    sScore.textContent = String(st.score);
    sComboMax.textContent = String(st.comboMax);
    sPerfect.textContent = String(st.perfect);
    sMiss.textContent = String(st.miss);
    sShield.textContent = `${Math.round(st.shield)}%`;
    sThreat.textContent = `${Math.round(st.threat)}%`;

    const badges = [];
    if(st.perfect >= 4) badges.push('✨ Perfect x4');
    if(st.comboMax >= 12) badges.push('🔥 Combo 12');
    if(st.bossGotPerfect >= st.bossNeedPerfect && st.bossNeedPerfect > 0) badges.push('👑 Crown Clear');
    if(st.infectedCount === 0 && st.threat < 30) badges.push('🧼 Clean Arena');

    endBadges.innerHTML = badges.length
      ? badges.map(b=>`<span class="badge ${b.includes('👑')?'crown':''}">${b}</span>`).join('')
      : `<span class="badge">🙂 Keep going</span>`;

    endNote.textContent =
`reason=${reason}
score=${st.score}
comboMax=${st.comboMax}
perfect=${st.perfect}
miss=${st.miss}
shield=${Math.round(st.shield)}%
threat=${Math.round(st.threat)}%
bossPerfect=${st.bossGotPerfect}/${st.bossNeedPerfect}
diff=${diff} view=${view} time=${timeLimit}s seed=${seed}`;

    endScreen.hidden = false;
  }

  function backHub(){
    try{
      const u = new URL(hub, location.href);
      location.href = u.toString();
    }catch(_){
      location.href = hub || '../hub.html';
    }
  }

  // cVR shoot
  function pickTargetAt(x,y){
    let best = null;
    let bestD = 1e9;
    for(const [id,e] of st.entities){
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if(d < 64 && d < bestD){
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(view!=='cvr') return;
    if(!st.running || st.paused || st.over) return;
    const r = rect();
    const x = clamp((ev?.detail?.x ?? (r.left+r.width/2)) - r.left, 0, r.width);
    const y = clamp((ev?.detail?.y ?? (r.top+r.height/2)) - r.top, 0, r.height);
    const id = pickTargetAt(x,y);
    if(id) onTapEntity(id);
  });

  btnStart?.addEventListener('click', startGame);
  btnRetry?.addEventListener('click', startGame);
  btnEndRetry?.addEventListener('click', startGame);

  btnPause?.addEventListener('click', ()=>{
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    btnPause.textContent = st.paused ? '▶ Resume' : '⏸ Pause';
    if(!st.paused) prompt('กลับมาแล้ว ลุยต่อ!');
  });

  btnBack?.addEventListener('click', backHub);
  btnEndBack?.addEventListener('click', backHub);

  updateHud();
})();