'use strict';

(function(){
  const DOC = document;
  const WIN = window;
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

  function buildCooldownUrlForCurrentGame(opts={}){
    const base = new URL('../warmup-gate.html', location.href);
    const src = new URL(location.href);
    src.searchParams.forEach((v,k)=> base.searchParams.set(k,v));
    base.searchParams.set('gatePhase', 'cooldown');
    base.searchParams.set('phase', 'cooldown');
    base.searchParams.set('mode', 'cooldown');
    base.searchParams.set('cat', opts.cat || 'hygiene');
    base.searchParams.set('game', opts.game || 'maskcough');
    base.searchParams.set('theme', opts.theme || 'maskcough');
    base.searchParams.set('hub', opts.fallbackHub || src.searchParams.get('hub') || '../hub.html');

    const extras = opts.extras || {};
    Object.keys(extras).forEach(k=>{
      const v = extras[k];
      if(v !== undefined && v !== null && v !== ''){
        base.searchParams.set(k, String(v));
      }
    });
    return base.toString();
  }

  const hub = qs('hub','../hub.html');
  const diff = String(qs('diff','normal')).toLowerCase();
  const mode = String(qs('run','play')).toLowerCase();
  const seed = Number(qs('seed', Date.now()));
  let timeLimit = Math.max(30, Number(qs('time','75')) || 75);
  const view = String(qs('view','mobile')).toLowerCase();

  if(diff === 'easy' && timeLimit < 80) timeLimit = 80;
  if(diff === 'normal' && timeLimit < 75) timeLimit = 75;

  const pid = qs('pid','anon');
  const studyId = qs('studyId','');
  const phase = qs('phase','');
  const conditionGroup = qs('conditionGroup','');
  const logEndpoint = qs('log','') || qs('api','');

  const rng = seededRng(seed);

  const arena = byId('arena');
  const world = byId('world');
  const popLayer = byId('popLayer');
  const bossBanner = byId('bossBanner');
  const crosshairHint = byId('crosshairHint');
  const hazardLayer = byId('hazardLayer');

  const teachBar = byId('teachBar');
  const teachIcon = byId('teachIcon');
  const teachText = byId('teachText');

  const btnStart = byId('btnStart');
  const btnRetry = byId('btnRetry');
  const btnBurst = byId('btnBurst');
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
  const learningSummary = byId('learningSummary');

  let crosshairEl = null;
  let endFlowRedirected = false;
  let __burstWasReady = false;

  const FX = {
    vibOn: String(qs('vib','1')) !== '0',
    sndOn: String(qs('snd','1')) !== '0',
  };

  let __ac = null;

  function vib(pattern){
    try{
      if(!FX.vibOn) return;
      if(navigator && navigator.vibrate) navigator.vibrate(pattern);
    }catch(_){}
  }

  function ensureAudio(){
    if(!FX.sndOn) return null;
    try{
      if(__ac && __ac.state !== 'closed') return __ac;
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      __ac = new AC();
      return __ac;
    }catch(_){ return null; }
  }

  function beep(freq, durMs, type='sine', gain=0.05){
    const ac = ensureAudio();
    if(!ac) return;
    const t0 = ac.currentTime;
    if(ac.state === 'suspended') ac.resume().catch(()=>{});
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs/1000));
    o.connect(g);
    g.connect(ac.destination);
    o.start(t0);
    o.stop(t0 + (durMs/1000) + 0.02);
  }

  function sfxParry(){
    vib([18,16,26]);
    beep(920, 70, 'triangle', 0.06);
    setTimeout(()=>beep(1320, 90, 'triangle', 0.05), 60);
  }
  function sfxBlock(){
    vib(12);
    beep(520, 45, 'sine', 0.035);
  }
  function sfxBad(){
    vib(48);
    beep(145, 140, 'square', 0.04);
  }
  function sfxBoss(){
    vib([30,20,30,20,50]);
    beep(220, 120, 'sawtooth', 0.05);
    setTimeout(()=>beep(180, 150, 'sawtooth', 0.045), 90);
  }
  function sfxBurst(){
    vib([20,20,20,20,60]);
    beep(300, 70, 'square', 0.04);
    setTimeout(()=>beep(460, 80, 'sawtooth', 0.05), 55);
    setTimeout(()=>beep(680, 100, 'triangle', 0.06), 120);
  }

  function createLogger(ctx){
    const q = [];
    let seq = 0;
    const sessionId = 'mcv2_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);

    function base(type){
      return {
        v: 2,
        game: 'maskcough-v2',
        type,
        sessionId,
        seq: ++seq,
        ts: Date.now(),
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        diff: ctx.diff || '',
        run: ctx.run || '',
        view: ctx.view || '',
        seed: ctx.seed || '',
        href: location.href.split('#')[0]
      };
    }

    function push(ev){
      q.push({ ...base(ev.type), ...ev });
      if(q.length > 1800) q.splice(0, q.length - 1200);
    }

    async function flush(reason){
      if(!ctx.log || !q.length) return;
      const payload = q.splice(0, q.length);
      const body = payload.map(x=>JSON.stringify(x)).join('\n');
      try{
        if(reason === 'unload' && navigator.sendBeacon){
          navigator.sendBeacon(ctx.log, new Blob([body], { type:'text/plain' }));
          return;
        }
        await fetch(ctx.log, {
          method:'POST',
          headers:{ 'content-type':'text/plain' },
          body,
          keepalive:true
        });
      }catch(_){}
    }

    return { sessionId, push, flush };
  }

  const logger = createLogger({
    pid, studyId, phase, conditionGroup,
    diff, run: mode, view, seed,
    log: logEndpoint
  });

  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') logger.flush('unload');
  });
  WIN.addEventListener('beforeunload', ()=>{
    logger.flush('unload');
  });

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  function saveSummary(sum){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify(sum));
      const arr = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      arr.push(sum);
      while(arr.length > 60) arr.shift();
      localStorage.setItem(LS_HIST, JSON.stringify(arr));
    }catch(_){}
  }

  function buildMaskCoughCooldownUrl(summary){
    const safe = summary || {};
    const endScore   = sScore?.textContent?.trim() || String(safe.score ?? '');
    const endCombo   = sComboMax?.textContent?.trim() || String(safe.comboMax ?? '');
    const endPerfect = sPerfect?.textContent?.trim() || String(safe.perfect ?? '');
    const endMiss    = sMiss?.textContent?.trim() || String(safe.miss ?? '');
    const endShield  = sShield?.textContent?.trim() || (safe.shieldEnd != null ? `${safe.shieldEnd}%` : '');
    const endThreat  = sThreat?.textContent?.trim() || (safe.threatEnd != null ? `${safe.threatEnd}%` : '');
    const noteText   = endNote?.textContent?.trim() || '';
    const phaseText = tPhase?.textContent?.trim() || '';
    const missionText = tMission?.textContent?.trim() || '';

    return buildCooldownUrlForCurrentGame({
      cat: 'hygiene',
      game: 'maskcough',
      theme: 'maskcough',
      fallbackHub: '../hub.html',
      extras: {
        endScore,
        endCombo,
        endPerfect,
        endMiss,
        endShield,
        endThreat,
        noteText,
        phaseText,
        missionText,
        reason: safe.reason || '',
        score: safe.score ?? '',
        comboMax: safe.comboMax ?? '',
        perfect: safe.perfect ?? '',
        miss: safe.miss ?? '',
        shieldEnd: safe.shieldEnd ?? '',
        threatEnd: safe.threatEnd ?? '',
        bossPerfect: safe.bossPerfect ?? '',
        bossNeedPerfect: safe.bossNeedPerfect ?? '',
        burstUsed: safe.burstUsed ?? '',
        learningOutcome: safe.learningOutcome ?? '',
        hazardControlScore: safe.hazardControlScore ?? '',
        responseTimingScore: safe.responseTimingScore ?? '',
        preventionScore: safe.preventionScore ?? ''
      }
    });
  }

  function goMaskCoughCooldown(summary){
    location.href = buildMaskCoughCooldownUrl(summary);
  }

  function goCooldownOnce(summary){
    if(endFlowRedirected) return;
    endFlowRedirected = true;
    goMaskCoughCooldown(summary);
  }

  function wireEndButtonForCooldown(){
    if(!btnEndBack) return;
    btnEndBack.textContent = '➡ ไป Cooldown';
    btnEndBack.onclick = (ev)=>{
      ev.preventDefault();
      goCooldownOnce(lastSummary);
    };
  }

  let lastSummary = null;

  const DIFF = {
    easy: {
      spawnMs: 1040,
      ttlDroplet: 2700,
      ttlMask: 2700,
      ttlInfected: 3500,
      coughWarnMs: 560,
      coughChargeMs: 440,
      coughStrikeMs: 320,
      shieldStart: 58,
      threatDecayPerTick: 0.06,
      infectPressure: { warm:0.012, pressure:0.022, boss:0.034 },
      dropletPressure: 0.08,
      burstThreatDrop: 26,
      burstShieldGain: 12,
      burstInfectedClearChance: 0.72,
      warmDuration: 24,
      bossDuration: 13,
      bossNeedPerfect: 2,
      warmClearNeed: 8,
      pressureParryNeed: 2
    },
    normal: {
      spawnMs: 860,
      ttlDroplet: 2200,
      ttlMask: 2300,
      ttlInfected: 3050,
      coughWarnMs: 500,
      coughChargeMs: 400,
      coughStrikeMs: 290,
      shieldStart: 48,
      threatDecayPerTick: 0.04,
      infectPressure: { warm:0.018, pressure:0.03, boss:0.045 },
      dropletPressure: 0.12,
      burstThreatDrop: 20,
      burstShieldGain: 10,
      burstInfectedClearChance: 0.6,
      warmDuration: 22,
      bossDuration: 14,
      bossNeedPerfect: 2,
      warmClearNeed: 10,
      pressureParryNeed: 2
    },
    hard: {
      spawnMs: 700,
      ttlDroplet: 1750,
      ttlMask: 1850,
      ttlInfected: 2550,
      coughWarnMs: 360,
      coughChargeMs: 320,
      coughStrikeMs: 240,
      shieldStart: 38,
      threatDecayPerTick: 0.02,
      infectPressure: { warm:0.028, pressure:0.048, boss:0.068 },
      dropletPressure: 0.24,
      burstThreatDrop: 14,
      burstShieldGain: 6,
      burstInfectedClearChance: 0.45,
      warmDuration: 18,
      bossDuration: 14,
      bossNeedPerfect: 3,
      warmClearNeed: 12,
      pressureParryNeed: 3
    }
  };
  const CFG = DIFF[diff] || DIFF.normal;

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

    shield:CFG.shieldStart,
    threat:0,
    parry:0,

    phase:'warm',
    warmClears:0,
    pressureParries:0,

    dropletCount:0,
    infectedCount:0,

    bossActive:false,
    bossNeedPerfect:0,
    bossGotPerfect:0,
    bossPatternNow:null,
    bossPatternEndsAt:0,
    bossSweepDir:'ltr',

    burstUsed:0,

    entities:new Map(),
    uid:0,

    freezeUntil:0,
    spawnTimer:null,
    tickTimer:null,

    maskPickups:0,
    __lowThreatPraiseAt:0,
    lastPhaseAnnounced:'warm',
    __lastChanceHelp:false,
    __bossClearShown:false
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

  function showTeach(icon, text, ms=1400){
    if(!teachBar || !teachIcon || !teachText) return;
    teachIcon.textContent = icon;
    teachText.textContent = text;
    teachBar.hidden = false;
    clearTimeout(showTeach._t);
    showTeach._t = setTimeout(()=>{
      if(teachBar) teachBar.hidden = true;
    }, ms);

    logger.push({
      type:'teach_hint',
      hintIcon: icon,
      hintText: text,
      phase: st.phase,
      elapsedSec: Math.round(st.elapsedSec * 10) / 10
    });
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
    if(!popLayer) return;
    const el = DOC.createElement('div');
    el.className = `pop ${cls}`;
    el.style.left = x+'px';
    el.style.top = y+'px';
    el.textContent = text;
    popLayer.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch(_){} }, 600);
  }

  function pulseEntity(el, cls='hit-good'){
    if(!el) return;
    el.classList.add(cls);
    setTimeout(()=>{ try{el.classList.remove(cls);}catch(_){} }, 180);
  }

  function pulseHud(el, cls){
    if(!el) return;
    el.classList.remove('pulse-good','pulse-bad');
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function clearHazards(){
    if(!hazardLayer) return;
    hazardLayer.innerHTML = '';
  }

  function showConeHazard(x, y){
    if(!hazardLayer) return;
    clearHazards();
    const el = DOC.createElement('div');
    el.className = 'hazard cone';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    hazardLayer.appendChild(el);
  }

  function showSweepHazard(dir){
    if(!hazardLayer) return;
    clearHazards();
    const el = DOC.createElement('div');
    el.className = `hazard sweep ${dir}`;
    hazardLayer.appendChild(el);
  }

  function showFakeHazard(x, y){
    if(!hazardLayer) return;
    clearHazards();
    const el = DOC.createElement('div');
    el.className = 'hazard fake';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    hazardLayer.appendChild(el);
  }

  function showBossBanner(text='👿 BOSS'){
    if(!bossBanner) return;
    bossBanner.hidden = false;
    bossBanner.textContent = text;
  }

  function showBigCallout(text, ms=1400){
    const el = bossBanner;
    if(!el) return;
    el.hidden = false;
    el.textContent = text;
    el.style.transform = 'translate(-50%,-50%) scale(1.08)';
    clearTimeout(showBigCallout._t);
    showBigCallout._t = setTimeout(()=>{
      if(el){
        el.style.transform = 'translate(-50%,-50%)';
        if(st.phase !== 'boss') el.hidden = true;
      }
    }, ms);
  }

  function hideBossBanner(){
    if(!bossBanner) return;
    bossBanner.hidden = true;
  }

  function updateArenaMood(){
    if(!arena) return;
    arena.classList.toggle('low-shield', st.shield <= 20);
    arena.classList.toggle('boss-hot', st.phase === 'boss');
  }

  function updateHud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tCombo) tCombo.textContent = String(st.combo);

    if(tPhase){
      const phaseText =
        st.phase === 'warm' ? 'เริ่ม' :
        st.phase === 'pressure' ? 'ท้าทาย' :
        'บอส';
      tPhase.textContent = phaseText;
    }

    if(tShield) tShield.textContent = `${Math.round(st.shield)}%`;
    if(bShield) bShield.style.width = `${clamp(st.shield,0,100)}%`;

    if(tThreat) tThreat.textContent = `${Math.round(st.threat)}%`;
    if(bThreat) bThreat.style.width = `${clamp(st.threat,0,100)}%`;

    if(tParry) tParry.textContent = `${Math.round(st.parry)}%`;
    if(bParry) bParry.style.width = `${clamp(st.parry,0,100)}%`;

    if(tDroplets) tDroplets.textContent = String(st.dropletCount);
    if(tInfected) tInfected.textContent = String(st.infectedCount);
    if(tPerfect) tPerfect.textContent = String(st.perfect);
    if(tMiss) tMiss.textContent = String(st.miss);

    if(tMission){
      if(st.phase === 'warm'){
        tMission.textContent = `เก็บละออง ${Math.min(st.warmClears, CFG.warmClearNeed)}/${CFG.warmClearNeed}`;
      }else if(st.phase === 'pressure'){
        tMission.textContent = `กันไอ ${Math.min(st.pressureParries, CFG.pressureParryNeed)}/${CFG.pressureParryNeed}`;
      }else{
        tMission.textContent = `ชนะบอส ${Math.round(st.bossGotPerfect)}/${st.bossNeedPerfect}`;
      }
    }

    if(arena){
      arena.classList.toggle('phase-warm', st.phase === 'warm');
      arena.classList.toggle('phase-pressure', st.phase === 'pressure');
      arena.classList.toggle('phase-boss', st.phase === 'boss');
    }

    if(btnBurst){
      const ready = st.parry >= 100;
      btnBurst.disabled = !ready;
      btnBurst.style.opacity = ready ? '1' : '.72';
      btnBurst.style.cursor = ready ? 'pointer' : 'not-allowed';
      btnBurst.classList.toggle('primary', ready);
      btnBurst.classList.toggle('accent', !ready);
      btnBurst.textContent = ready ? '💥 พร้อมใช้พลัง!' : '💥 พลังพิเศษ';
    }

    const burstReadyNow = st.parry >= 100;
    if(burstReadyNow && !__burstWasReady){
      showTeach('💥', 'พลังพิเศษพร้อมแล้ว!', 1200);
      prompt('💥 ใช้พลังได้แล้ว!');
      try{
        btnBurst?.classList.add('burst-ready-pop');
        setTimeout(()=> btnBurst?.classList.remove('burst-ready-pop'), 700);
      }catch(_){}
      logger.push({
        type:'burst_ready',
        phase: st.phase,
        elapsedSec: Math.round(st.elapsedSec * 10) / 10
      });
    }
    __burstWasReady = burstReadyNow;

    updateArenaMood();
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
    const warmEnd = CFG.warmDuration;
    const bossStart = Math.max(warmEnd + 18, timeLimit - CFG.bossDuration);
    if(st.elapsedSec < warmEnd){
      st.phase = 'warm';
    }else if(st.elapsedSec < bossStart){
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
      state: 'idle'
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

    logger.push({
      type:'spawn',
      entityType: type,
      entityId: id,
      x: Math.round(x),
      y: Math.round(y),
      ttlMs: Math.round(ttl),
      phase: st.phase
    });

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

  function applyComboRewards(){
    if(st.combo === 3){
      st.score += 2;
      prompt('⚡ เร็วมาก!');
      showTeach('⚡', 'ต่อเนื่องได้ดี!', 800);
    }
    else if(st.combo === 5){
      st.shield = clamp(st.shield + (diff==='easy' ? 8 : 6), 0, 100);
      prompt('🛡️ ปลอดภัยเพิ่ม!');
      showTeach('🛡️', 'เก็บต่อเนื่องแล้วโล่เพิ่ม!', 900);
    }
    else if(st.combo === 8){
      st.parry = clamp(st.parry + (diff==='easy' ? 22 : 18), 0, 100);
      st.freezeUntil = performance.now() + (diff==='easy' ? 850 : 700);
      prompt('⏳ ช้าลงแล้ว!');
      showTeach('⏳', 'ตอนนี้กดง่ายขึ้น!', 950);
    }
    else if(st.combo === 10){
      prompt('🔥 คอมโบเก่งมาก!');
      showTeach('🔥', 'สุดยอดเลย!', 900);
    }
    else if(st.combo === 12){
      const n = clearNearbyDroplets(rect().width/2, rect().height/2, 9999);
      st.score += n;
      st.threat = Math.max(0, st.threat - (diff==='easy' ? 8 : 5));
      prompt('💥 โล่งขึ้นแล้ว!');
      showTeach('💥', 'เคลียร์ละอองได้เยอะ!', 1000);
    }
  }

  function onPerfectParry(e){
    const r = rect();
    const sx = r.left + e.x;
    const sy = r.top + e.y;

    st.perfect++;
    st.combo++;
    st.comboMax = Math.max(st.comboMax, st.combo);
    st.score += (st.phase==='boss' ? 8 : 6);

    if(st.phase==='boss'){
      st.score += 2;
      st.threat = Math.max(0, st.threat - 6);
    }

    st.parry = clamp(st.parry + 18, 0, 100);
    st.threat = Math.max(0, st.threat - 14);
    st.shield = clamp(st.shield + 4, 0, 100);

    if(st.phase==='pressure') st.pressureParries++;
    if(st.phase==='boss') st.bossGotPerfect++;

    const radiusI = st.phase==='boss' ? 170 : 130;
    const radiusD = st.phase==='boss' ? 120 : 95;
    const c1 = clearNearbyInfected(e.x, e.y, radiusI);
    const c2 = clearNearbyDroplets(e.x, e.y, radiusD);

    pulseEntity(e.el, 'hit-good');
    removeEntity(e.id, true);

    pop(sx, sy, 'PERFECT!', 'pro');
    shake();
    sfxParry();

    prompt('✨ เยี่ยมมาก!');
    showTeach('✨', 'กันไอได้พอดี!', 1000);

    pulseHud(tParry, 'pulse-good');
    pulseHud(tShield, 'pulse-good');

    if(st.phase === 'boss'){
      toast('Boss Block!');
    }

    if(st.phase === 'boss' && (c1 + c2) >= 3){
      prompt('🔥 บอสสะดุด!');
      showTeach('🔥', 'ทำได้ดีมาก!', 1100);
    }

    if((c1 + c2) >= 2 && st.phase !== 'boss'){
      showTeach('🧼', 'พื้นที่สะอาดขึ้น!', 850);
    }

    if(st.combo === 3){
      showTeach('⚡', 'ต่อเนื่องได้ดี!', 800);
    }else if(st.combo === 5){
      showTeach('🛡️', 'เก่งมาก ปลอดภัยขึ้น!', 900);
    }else if(st.combo >= 8){
      showTeach('🔥', 'สุดยอดเลย!', 900);
    }

    logger.push({
      type:'perfect_parry',
      entityType: e.type,
      entityId: e.id,
      x: Math.round(e.x),
      y: Math.round(e.y),
      score: st.score,
      combo: st.combo,
      shield: Math.round(st.shield),
      threat: Math.round(st.threat),
      clearNearby: c1 + c2
    });
  }

  function onNormalBlock(e){
    const r = rect();
    const sx = r.left + e.x;
    const sy = r.top + e.y;

    st.combo++;
    st.comboMax = Math.max(st.comboMax, st.combo);
    st.score += 2;
    st.parry = clamp(st.parry + (diff === 'easy' ? 10 : 8), 0, 100);
    st.threat = Math.max(0, st.threat - 6);

    if(st.phase === 'boss' && diff === 'easy'){
      if(st.bossGotPerfect < st.bossNeedPerfect){
        st.bossGotPerfect += 0.5;
      }
    }

    pulseEntity(e.el, 'hit-good');
    removeEntity(e.id, true);

    pop(sx, sy, 'ทัน!', 'good');
    sfxBlock();

    prompt('🛡️ กันได้แล้ว!');
    showTeach('🛡️', 'ดีแล้ว! กันได้ทัน', 700);

    if(st.phase === 'boss'){
      toast('กันบอสได้!');
    }

    logger.push({
      type:'block',
      entityType: e.type,
      entityId: e.id,
      x: Math.round(e.x),
      y: Math.round(e.y),
      score: st.score,
      combo: st.combo
    });
  }

  function onCoughHit(e){
    const r = rect();
    const sx = r.left + e.x;
    const sy = r.top + e.y;

    st.combo = 0;
    st.miss++;

    const coughShieldLoss = st.phase === 'warm' ? 10 : 16;
    const coughThreatGain = st.phase === 'warm' ? 8 : 14;

    st.shield = clamp(st.shield - coughShieldLoss, 0, 100);
    st.threat = clamp(st.threat + coughThreatGain, 0, 100);

    removeEntity(e.id, false);
    flashBad();
    shake();
    sfxBad();
    pop(sx, sy, 'อุ๊บ!', 'bad');
    prompt('😷 โดนละอองไอ!');
    pulseHud(tShield, 'pulse-bad');
    pulseHud(tThreat, 'pulse-bad');

    for(let i=0;i<2;i++){
      const dx = (rng()*80)-40;
      const dy = (rng()*80)-40;
      spawnInfected(clamp(e.x+dx,30,rect().width-30), clamp(e.y+dy,30,rect().height-30));
    }

    logger.push({
      type:'cough_hit',
      entityType: e.type,
      entityId: e.id,
      x: Math.round(e.x),
      y: Math.round(e.y),
      miss: st.miss,
      shield: Math.round(st.shield),
      threat: Math.round(st.threat)
    });
  }

  function onTapEntity(id){
    if(!st.running || st.paused || st.over) return;
    const e = st.entities.get(id);
    if(!e) return;

    if(e?.el){
      pulseEntity(e.el, e.type === 'infected' ? 'hit-bad' : 'hit-good');
    }

    const r = rect();
    const sx = r.left + e.x;
    const sy = r.top + e.y;

    if(e.type==='droplet'){
      st.score += 1;
      st.combo++;
      st.comboMax = Math.max(st.comboMax, st.combo);
      st.warmClears++;
      st.parry = clamp(st.parry + (st.phase === 'warm' ? 4 : 3), 0, 100);
      removeEntity(id, true);
      pop(sx, sy, 'ดี!', 'good');

      if(st.warmClears === 3){
        showTeach('💦', 'เก็บละอองเก่งมาก!', 800);
      }
      if(st.warmClears === 6){
        showTeach('💦', 'ช่วยลดละอองได้ดี!', 900);
      }
    }
    else if(e.type==='mask'){
      st.score += 1;
      st.combo++;
      st.comboMax = Math.max(st.comboMax, st.combo);
      st.shield = clamp(st.shield + 15, 0, 100);
      st.maskPickups++;
      removeEntity(id, true);
      pop(sx, sy, 'ปลอดภัย+', 'good');
      prompt('😷 ป้องกันเพิ่ม!');
      pulseHud(tShield, 'pulse-good');

      if(st.maskPickups === 2){
        showTeach('😷', 'เก็บหน้ากากได้ดี!', 850);
      }else if(st.maskPickups === 4){
        showTeach('🛡️', 'ป้องกันเก่งมาก!', 900);
      }
    }
    else if(e.type==='infected'){
      st.combo = 0;
      st.miss++;

      const hitShield = st.phase === 'warm' ? 4 : 8;
      const hitThreat = st.phase === 'warm' ? 4 : 8;

      st.shield = clamp(st.shield - hitShield, 0, 100);
      st.threat = clamp(st.threat + hitThreat, 0, 100);
      removeEntity(id, true);
      pop(sx, sy, 'อุ๊บ!', 'bad');
      flashBad();
      sfxBad();
      pulseHud(tShield, 'pulse-bad');
      pulseHud(tThreat, 'pulse-bad');
    }
    else if(e.type==='cough'){
      if(e.state==='strike'){
        onPerfectParry(e);
      }else if(e.state==='charge'){
        onNormalBlock(e);
      }else{
        st.combo = 0;
        st.threat = clamp(st.threat + (st.bossPatternNow==='fake' ? 9 : 5), 0, 100);
        if(st.bossPatternNow==='fake'){
          st.shield = clamp(st.shield - 4, 0, 100);
        }
        pop(sx, sy, 'ยังไม่ใช่!', 'bad');
      }
    }

    applyComboRewards();

    logger.push({
      type:'tap',
      entityType: e.type,
      entityId: e.id,
      state: e.state || '',
      score: st.score,
      combo: st.combo,
      shield: Math.round(st.shield),
      threat: Math.round(st.threat),
      phase: st.phase
    });

    updateHud();
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

  function pickBossPattern(){
    const patterns = ['cone','sweep','fake'];
    return patterns[Math.floor(rng()*patterns.length)];
  }

  function startBossPattern(now){
    st.bossPatternNow = pickBossPattern();
    st.bossPatternEndsAt = now + 3400;
    clearHazards();

    const r = rect();

    if(st.bossPatternNow === 'cone'){
      const cx = 90 + rng() * Math.max(80, r.width - 180);
      const cy = 90 + rng() * Math.max(80, r.height - 180);

      showBossBanner('👿 บอสไอเป็นวง!');
      showConeHazard(cx, cy);

      prompt('🤧 รอจังหวะแล้วกัน!');
      showTeach('🤧', 'รอให้ถึงจังหวะก่อน', 1200);
    }
    else if(st.bossPatternNow === 'sweep'){
      st.bossSweepDir = rng() < 0.5 ? 'ltr' : 'rtl';

      showBossBanner(st.bossSweepDir === 'ltr' ? '👿 บอสกวาด →' : '👿 ← บอสกวาด');
      showSweepHazard(st.bossSweepDir);

      prompt('🌪 หลบให้ทัน แล้วกันไอ!');
      showTeach('🌪', 'บอสกำลังกวาดทั้งจอ', 1200);
    }
    else{
      const fx = 90 + rng() * Math.max(80, r.width - 180);
      const fy = 90 + rng() * Math.max(80, r.height - 180);

      showBossBanner('👿 บอสหลอกก่อน!');
      showFakeHazard(fx, fy);

      prompt('👀 อย่าเพิ่งรีบกด');
      showTeach('👀', 'ดูให้ชัวร์ก่อนค่อยกัน', 1200);
    }

    sfxBoss();
    if(arena) arena.classList.add('boss-hot');

    logger.push({
      type:'boss_pattern',
      pattern: st.bossPatternNow,
      bossNeedPerfect: st.bossNeedPerfect,
      bossGotPerfect: st.bossGotPerfect
    });
  }

  function maybeBoss(){
    if(st.phase!=='boss') return;
    const now = performance.now();

    if(!st.bossActive){
      st.bossActive = true;
      st.bossNeedPerfect = CFG.bossNeedPerfect;
      st.bossGotPerfect = 0;
      startBossPattern(now);
      return;
    }

    if(now >= st.bossPatternEndsAt){
      startBossPattern(now);
    }
  }

  function doBurst(){
    if(!st.running || st.paused || st.over) return;

    if(st.parry < 100){
      toast('พลังยังไม่เต็ม');
      showTeach('💥', 'เก็บพลังให้เต็มก่อน', 900);
      return;
    }

    st.parry = 0;
    st.burstUsed++;
    st.score += 8;
    st.shield = clamp(st.shield + CFG.burstShieldGain, 0, 100);
    st.threat = Math.max(0, st.threat - CFG.burstThreatDrop);

    let clearD = 0;
    let clearI = 0;

    for(const [id,e] of [...st.entities]){
      if(e.type === 'droplet'){
        removeEntity(id, true);
        clearD++;
      }else if(e.type === 'infected'){
        if(rng() < CFG.burstInfectedClearChance){
          removeEntity(id, true);
          clearI++;
        }
      }
    }

    recomputeCounts();
    shake();
    sfxBurst();
    flashBad();
    setTimeout(()=>{
      const el = byId('mcfxFlash');
      if(el) el.style.opacity = '0';
    }, 100);

    clearHazards();

    const totalClear = clearD + clearI;

    if(totalClear >= 6){
      prompt(`💥 ว้าว! เคลียร์ ${totalClear} เป้า`);
      showTeach('💥', 'พลังพิเศษสุดยอด!', 1300);
      pop(rect().width * 0.5, rect().height * 0.25, 'SUPER BURST!', 'pro');
    }else if(totalClear >= 3){
      prompt(`💥 เคลียร์ ${totalClear} เป้า`);
      showTeach('💥', 'ใช้พลังได้ดี!', 1000);
      pop(rect().width * 0.5, rect().height * 0.25, 'BURST!', 'good');
    }else{
      prompt('💥 ใช้พลังแล้ว!');
      showTeach('💥', 'ดีมาก!', 900);
      pop(rect().width * 0.5, rect().height * 0.25, 'POW!', 'good');
    }

    if(st.phase === 'boss'){
      showTeach('👿', 'บอสโดนพลังเข้าแล้ว!', 1000);
    }

    logger.push({
      type:'burst',
      burstUsed: st.burstUsed,
      shield: Math.round(st.shield),
      threat: Math.round(st.threat),
      score: st.score,
      clearDroplet: clearD,
      clearInfected: clearI,
      clearTotal: totalClear
    });

    updateHud();
  }

  function spawnWave(){
    if(!st.running || st.paused || st.over) return;

    const ratio = clamp01(st.elapsedSec / timeLimit);
    const threatMul = st.threat >= 70 ? 1.10 : st.threat >= 40 ? 1.05 : 1.0;
    const speedMul = (1 + ratio * (diff==='hard' ? 0.16 : diff==='easy' ? 0.06 : 0.09)) * threatMul;

    if(st.phase==='warm'){
      if(st.elapsedSec < 5){
        spawnDroplet();
        if(rng() < 0.10) spawnMask();
      }
      else if(st.elapsedSec < 10){
        spawnDroplet();
        if(rng() < 0.20) spawnDroplet();
        if(rng() < 0.18) spawnMask();
      }
      else if(st.elapsedSec < 15){
        spawnDroplet();
        if(rng() < 0.22) spawnMask();
        if(rng() < (diff==='easy' ? 0.08 : 0.12)) spawnCough();
      }
      else{
        spawnDroplet();
        if(rng() < 0.18) spawnDroplet();
        if(rng() < 0.20) spawnMask();
        if(rng() < (diff==='easy' ? 0.12 : 0.16)) spawnCough();
        if(rng() < 0.08){
          const p = randomXY();
          spawnInfected(p.x,p.y);
        }
      }
    }
    else if(st.phase==='pressure'){
      spawnDroplet();
      spawnDroplet();
      if(rng() < 0.28) spawnCough();
      if(rng() < 0.14) spawnMask();
      if(rng() < 0.14){
        const p = randomXY();
        spawnInfected(p.x,p.y);
      }
    }
    else{
      spawnDroplet();
      if(rng() < 0.48) spawnDroplet();
      if(rng() < 0.34) spawnCough();
      if(rng() < 0.10) spawnMask();
      if(rng() < 0.18){
        const p = randomXY();
        spawnInfected(p.x,p.y);
      }
    }

    if(st.threat >= 70 && rng() < 0.16){
      spawnDroplet();
    }
    if(st.threat >= 85 && rng() < 0.10){
      const p = randomXY();
      spawnInfected(p.x,p.y);
    }

    if(st.shield <= 28 && rng() < 0.22){
      spawnMask();
    }

    const next = Math.max(diff==='hard' ? 240 : 300, Math.round(CFG.spawnMs / speedMul));
    st.spawnTimer = setTimeout(spawnWave, next);
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

    st.shield = CFG.shieldStart;
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
    st.bossPatternNow = null;
    st.bossPatternEndsAt = 0;
    st.bossSweepDir = 'ltr';

    st.burstUsed = 0;
    st.maskPickups = 0;
    st.__lowThreatPraiseAt = 0;
    st.lastPhaseAnnounced = 'warm';
    st.__lastChanceHelp = false;
    st.__bossClearShown = false;

    endFlowRedirected = false;
    lastSummary = null;
    __burstWasReady = false;

    if(st.spawnTimer) clearTimeout(st.spawnTimer);
    if(st.tickTimer) clearInterval(st.tickTimer);

    for(const [,e] of st.entities){
      try{ e.el.remove(); }catch(_){}
    }
    st.entities.clear();

    hideBossBanner();
    clearHazards();

    if(crosshairEl){
      try{ crosshairEl.remove(); }catch(_){}
      crosshairEl = null;
    }

    if(btnPause) btnPause.textContent = '⏸ พัก';
    if(btnBurst){
      btnBurst.disabled = true;
      btnBurst.style.opacity = '.72';
      btnBurst.style.cursor = 'not-allowed';
      btnBurst.textContent = '💥 พลังพิเศษ';
    }

    if(btnEndBack){
      btnEndBack.textContent = '➡ ไป Cooldown';
    }

    if(teachBar) teachBar.hidden = true;

    updateHud();
  }

  function startGame(){
    ensureAudio();
    resetState();
    if(endScreen) endScreen.hidden = true;

    st.running = true;
    st.t0 = performance.now();

    if(view==='cvr'){
      if(crosshairHint) crosshairHint.hidden = false;
      if(!crosshairEl){
        crosshairEl = DOC.createElement('div');
        crosshairEl.className = 'crosshair-center';
        arena.appendChild(crosshairEl);
      }
    }else{
      if(crosshairHint) crosshairHint.hidden = true;
      if(crosshairEl){
        try{ crosshairEl.remove(); }catch(_){}
        crosshairEl = null;
      }
    }

    logger.push({
      type:'start',
      timeLimit,
      shieldStart: st.shield
    });

    showTeach('💦', 'เก็บละอองให้ไว!');
    prompt('💦 เก็บละอองก่อน');
    spawnWave();
    st.tickTimer = setInterval(tick, 80);
  }

  function tick(){
    if(!st.running || st.paused || st.over) return;

    const now = performance.now();
    st.elapsedSec = (now - st.t0)/1000;

    updatePhase();

    if(st.phase !== st.lastPhaseAnnounced){
      st.lastPhaseAnnounced = st.phase;

      if(st.phase === 'pressure'){
        showBigCallout('⚠️ ด่านกดดัน!');
        showTeach('⚠️', 'ตอนนี้เริ่มยากขึ้นแล้ว', 1200);
        logger.push({ type:'phase_change', to:'pressure' });
      }else if(st.phase === 'boss'){
        showBigCallout('👿 บอสมาแล้ว!');
        showTeach('👿', 'กันไอให้ทันเพื่อชนะบอส!', 1500);
        prompt('👿 บอสมาแล้ว!');
        logger.push({ type:'phase_change', to:'boss' });
      }
    }

    maybeBoss();

    if(st.phase === 'warm'){
      if(st.elapsedSec < 5){
        showTeach('💦', 'เก็บละอองให้ไว!', 900);
      }else if(st.elapsedSec < 10){
        showTeach('😷', 'เก็บหน้ากากเพื่อป้องกัน', 900);
      }else if(st.elapsedSec < 15){
        showTeach('🤧', 'รอจังหวะแล้วค่อยกัน', 900);
      }else if(st.elapsedSec < 20){
        showTeach('🦠', 'อย่าปล่อยเชื้อค้าง', 900);
      }
    }

    if(st.phase==='boss' && st.bossActive){
      if(st.bossPatternNow === 'cone'){
        if(rng() < 0.030) spawnCough();
        if(rng() < 0.014){
          const p = randomXY();
          spawnInfected(p.x, p.y);
          spawnInfected(clamp(p.x+34,30,rect().width-30), clamp(p.y+22,30,rect().height-30));
          spawnInfected(clamp(p.x-34,30,rect().width-30), clamp(p.y-18,30,rect().height-30));
        }
      }
      else if(st.bossPatternNow === 'sweep'){
        if(rng() < 0.070){
          const r = rect();
          const y = 60 + rng() * Math.max(30, r.height - 120);
          const x = st.bossSweepDir === 'ltr' ? 40 + rng()*120 : r.width - 40 - rng()*120;
          addEntity('droplet', x, y, CFG.ttlDroplet * 0.78);
        }
        if(rng() < 0.030){
          const y = 60 + rng() * Math.max(30, rect().height - 120);
          const x = st.bossSweepDir === 'ltr' ? 60 : rect().width - 60;
          addEntity('infected', x, y, CFG.ttlInfected * 0.92);
        }
      }
      else if(st.bossPatternNow === 'fake'){
        if(rng() < 0.034){
          const p = randomXY();
          addEntity('cough', p.x, p.y, CFG.coughWarnMs + CFG.coughChargeMs + CFG.coughStrikeMs);
        }
        if(rng() < 0.022){
          const p = randomXY();
          spawnInfected(p.x,p.y);
        }
      }
    }

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
          showTeach('🦠', 'อย่าปล่อยละอองไว้นาน', 1000);
          mutateDroplet(e);
        }else if(e.type==='mask'){
          removeEntity(id,false);
        }else if(e.type==='infected'){
          st.threat = clamp(st.threat + 8, 0, 100);

          const splitChance =
            st.phase === 'boss'
              ? (diff==='easy' ? 0.30 : diff==='hard' ? 0.58 : 0.48)
              : (diff==='easy' ? 0.18 : diff==='hard' ? 0.44 : 0.34);

          const doSplit = (st.phase !== 'warm') && rng() < splitChance;
          const ox = e.x, oy = e.y;
          removeEntity(id,false);

          if(doSplit){
            for(let k=0;k<2;k++){
              const dx = (rng()*70)-35;
              const dy = (rng()*70)-35;
              spawnInfected(
                clamp(ox+dx, 30, rect().width-30),
                clamp(oy+dy, 30, rect().height-30)
              );
            }
            showTeach('🦠', 'เชื้อกำลังลาม!', 1200);
            prompt('🦠 เชื้อลาม!');
          }
        }
      }
    }

    const infectPressure = CFG.infectPressure[st.phase] || CFG.infectPressure.pressure;
    st.threat = clamp(st.threat + (st.infectedCount * infectPressure), 0, 100);

    const dropletThreshold = diff==='easy' ? 7 : diff==='hard' ? 5 : 6;
    if(st.dropletCount >= dropletThreshold){
      st.threat = clamp(st.threat + CFG.dropletPressure, 0, 100);
    }

    st.threat = Math.max(0, st.threat - CFG.threatDecayPerTick);

    if(st.threat >= 75){
      st.shield = clamp(st.shield - 0.05, 0, 100);
    }

    if(st.threat >= 85 && ((performance.now() / 260) | 0) % 2 === 0){
      const toastEl = byId('toast');
      if(toastEl) toastEl.classList.add('urgent');
    }else{
      const toastEl = byId('toast');
      if(toastEl) toastEl.classList.remove('urgent');
    }

    if(st.phase !== 'warm' && st.threat <= 15 && st.infectedCount === 0){
      if(!st.__lowThreatPraiseAt || (performance.now() - st.__lowThreatPraiseAt) > 6000){
        st.__lowThreatPraiseAt = performance.now();
        showTeach('🌈', 'ตอนนี้ปลอดภัยดี!', 900);
      }
    }

    if(st.shield <= 12 && !st.__lastChanceHelp){
      st.__lastChanceHelp = true;
      showTeach('💛', 'ระวัง! เก็บหน้ากากด่วน', 1200);
      if(rng() < 0.7) spawnMask();
    }

    if(st.phase === 'boss' && st.bossNeedPerfect > 0 && st.bossGotPerfect >= st.bossNeedPerfect){
      if(!st.__bossClearShown){
        st.__bossClearShown = true;
        showBigCallout('👑 ชนะบอสแล้ว!');
        showTeach('👑', 'เยี่ยมมาก! ใกล้จบแล้ว', 1400);
        prompt('👑 ชนะบอสแล้ว!');
        st.score += 6;
        logger.push({ type:'boss_clear', atSec: Math.round(st.elapsedSec * 10) / 10 });
      }
    }

    if(st.phase==='boss' && st.elapsedSec >= timeLimit - 0.3){
      if(st.bossGotPerfect < st.bossNeedPerfect){
        const shieldPenalty = diff==='easy' ? 8 : diff==='hard' ? 14 : 12;
        const scorePenalty  = diff==='easy' ? 4 : diff==='hard' ? 8 : 6;
        st.shield = clamp(st.shield - shieldPenalty, 0, 100);
        st.score = Math.max(0, st.score - scorePenalty);
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

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;

    if(st.spawnTimer) clearTimeout(st.spawnTimer);
    if(st.tickTimer) clearInterval(st.tickTimer);

    clearHazards();

    if(sScore) sScore.textContent = String(st.score);
    if(sComboMax) sComboMax.textContent = String(st.comboMax);
    if(sPerfect) sPerfect.textContent = String(st.perfect);
    if(sMiss) sMiss.textContent = String(st.miss);
    if(sShield) sShield.textContent = `${Math.round(st.shield)}%`;
    if(sThreat) sThreat.textContent = `${Math.round(st.threat)}%`;

    const badges = [];
    if(st.perfect >= 4) badges.push('✨ กันไอเก่ง');
    if(st.comboMax >= 12) badges.push('🔥 คอมโบสุดยอด');
    if(st.bossGotPerfect >= st.bossNeedPerfect && st.bossNeedPerfect > 0) badges.push('👑 ชนะบอส');
    if(st.infectedCount === 0 && st.threat < 30) badges.push('🧼 พื้นที่สะอาด');
    if(st.burstUsed >= 1) badges.push('💥 ใช้พลังแล้ว');
    if(st.burstUsed >= 2) badges.push('⚡ ใช้พลังเก่ง');

    let verdict = 'พยายามได้ดี';
    if(st.score >= (diff==='easy' ? 28 : diff==='hard' ? 48 : 38)) verdict = 'เก่งมาก';
    if(st.bossGotPerfect >= st.bossNeedPerfect && st.comboMax >= (diff==='easy' ? 8 : 12)) verdict = 'สุดยอดฮีโร่';

    if(endBadges){
      endBadges.innerHTML = badges.length
        ? badges.map(b=>`<span class="badge ${b.includes('👑')?'crown':''}">${b}</span>`).join('')
        : `<span class="badge">🙂 เล่นได้ดี</span>`;

      if(verdict === 'สุดยอดฮีโร่'){
        endBadges.insertAdjacentHTML('afterbegin', `<span class="badge crown">🏆 ${verdict}</span>`);
      }else{
        endBadges.insertAdjacentHTML('afterbegin', `<span class="badge">🌟 ${verdict}</span>`);
      }
    }

    let childSummary = 'เก่งมาก! คุณช่วยลดการแพร่เชื้อได้';
    if(st.miss >= 6){
      childSummary = 'รอบหน้าลองเก็บหน้ากากและกันไอให้ทันมากขึ้นนะ';
    }else if(st.bossNeedPerfect > 0 && st.bossGotPerfect < st.bossNeedPerfect){
      childSummary = 'ดีแล้ว! ลองจับจังหวะตอนบอสอีกนิดนะ';
    }else if(st.bossNeedPerfect > 0 && st.bossGotPerfect >= st.bossNeedPerfect){
      childSummary = 'สุดยอด! คุณหยุดบอสได้แล้ว';
    }

    const learningOutcome =
      st.bossNeedPerfect > 0 && st.bossGotPerfect >= st.bossNeedPerfect ? 'boss_clear' :
      st.miss <= 3 ? 'stable_control' :
      st.perfect >= 4 ? 'timing_improved' :
      'needs_more_support';

    const hazardControlScore = Math.max(0, 100 - (st.miss * 8) - (st.infectedCount * 6));
    const responseTimingScore = Math.max(0, Math.min(100, (st.perfect * 15) + (st.comboMax * 2)));
    const preventionScore = Math.max(0, Math.min(100, Math.round(st.shield) + (st.maskPickups * 6)));

    const summary = {
      game: 'maskcough-v2',
      ts: Date.now(),
      pid, studyId, phase, conditionGroup,
      diff, run: mode, view, seed,
      timeLimit,
      timePlayedSec: Math.round(st.elapsedSec * 10) / 10,
      score: st.score,
      comboMax: st.comboMax,
      perfect: st.perfect,
      miss: st.miss,
      shieldEnd: Math.round(st.shield),
      threatEnd: Math.round(st.threat),
      bossPerfect: st.bossGotPerfect,
      bossNeedPerfect: st.bossNeedPerfect,
      burstUsed: st.burstUsed,
      warmClears: st.warmClears,
      pressureParries: st.pressureParries,
      maskPickups: st.maskPickups,
      infectedRemain: st.infectedCount,
      learningOutcome,
      hazardControlScore,
      responseTimingScore,
      preventionScore,
      reason,
      __extraJson: JSON.stringify({
        url: location.href,
        researchMetrics: {
          learningOutcome,
          hazardControlScore,
          responseTimingScore,
          preventionScore
        }
      })
    };

    lastSummary = summary;

    saveSummary(summary);
    logger.push({ type:'end', ...summary });
    logger.flush('end');

    if(learningSummary){
      learningSummary.innerHTML = `
        <div>💦 เก็บละอองได้ ${st.score} แต้ม</div>
        <div>🤧 กันไอได้ ${st.perfect} ครั้ง</div>
        <div>🦠 พลาด ${st.miss} ครั้ง</div>
        <div class="praise">${childSummary}</div>
      `;
    }

    if(endNote){
      if(mode === 'research'){
        endNote.textContent =
`pid=${pid}
studyId=${studyId || '-'} phase=${phase || '-'} conditionGroup=${conditionGroup || '-'}
verdict=${verdict}
reason=${reason}
score=${st.score}
comboMax=${st.comboMax}
perfect=${st.perfect}
miss=${st.miss}
shield=${Math.round(st.shield)}%
threat=${Math.round(st.threat)}%
bossPerfect=${st.bossGotPerfect}/${st.bossNeedPerfect}
burstUsed=${st.burstUsed}
learningOutcome=${learningOutcome}
hazardControlScore=${hazardControlScore}
responseTimingScore=${responseTimingScore}
preventionScore=${preventionScore}
diff=${diff} view=${view} time=${timeLimit}s seed=${seed}
log=${logEndpoint || '-'}`;
      }else{
        endNote.textContent = `คะแนน ${st.score} • คอมโบสูงสุด ${st.comboMax} • พลังพิเศษ ${st.burstUsed} ครั้ง`;
      }
    }

    wireEndButtonForCooldown();

    if(endScreen) endScreen.hidden = false;
  }

  function backHub(){
    try{
      const u = new URL(hub, location.href);
      const keep = ['pid','studyId','phase','conditionGroup','run','view','diff','time'];
      const src = new URL(location.href);
      keep.forEach(k=>{
        const v = src.searchParams.get(k);
        if(v) u.searchParams.set(k, v);
      });
      u.searchParams.set('from', 'maskcough-v2');
      location.href = u.toString();
    }catch(_){
      location.href = hub || '../hub.html';
    }
  }

  function pickTargetAt(x,y){
    let best = null;
    let bestScore = 1e9;
    const radius = view==='cvr' ? 82 : 64;

    for(const [id,e] of st.entities){
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if(d > radius) continue;

      let score = d;
      if(view==='cvr' && e.type==='cough'){
        if(e.state==='strike') score -= 18;
        else if(e.state==='charge') score -= 8;
      }

      if(score < bestScore){
        bestScore = score;
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
  btnBurst?.addEventListener('click', doBurst);

  btnPause?.addEventListener('click', ()=>{
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    btnPause.textContent = st.paused ? '▶ เล่นต่อ' : '⏸ พัก';

    if(st.paused){
      prompt('⏸ พักเกม');
      clearHazards();
    }else{
      prompt('▶ กลับมาแล้ว ลุยต่อ!');
      if(st.phase==='boss' && st.bossActive){
        const now = performance.now();
        startBossPattern(now);
      }
    }
  });

  btnBack?.addEventListener('click', backHub);
  btnEndBack?.addEventListener('click', (ev)=>{
    ev.preventDefault();
    goCooldownOnce(lastSummary);
  });

  if(btnEndBack){
    btnEndBack.textContent = '➡ ไป Cooldown';
  }

  updateHud();
})();