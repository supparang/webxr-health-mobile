'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const layer = DOC.getElementById('layer');
  if(!layer) throw new Error('Missing #layer');

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(e){ return '{}'; } };

  function csvEscape(v){
    if(v == null) return '';
    const s = String(v);
    if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  function rowsToCsv(rows){
    rows = Array.isArray(rows) ? rows : [];
    if(!rows.length) return '';
    const keys = Array.from(rows.reduce((set,row)=>{
      Object.keys(row || {}).forEach(k=> set.add(k));
      return set;
    }, new Set()));
    const head = keys.map(csvEscape).join(',');
    const body = rows.map(row => keys.map(k => csvEscape(row?.[k])).join(',')).join('\n');
    return `${head}\n${body}`;
  }
  async function copyText(txt, label='Copy'){
    try{
      await navigator.clipboard.writeText(String(txt || ''));
    }catch(e){
      try{ prompt(`${label}:`, String(txt || '')); }catch(_){}
    }
  }
  async function postToHHACloud(payload){
    const api = qs('api','').trim();
    if(!api) throw new Error('Missing ?api= endpoint');
    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    if(!res.ok){
      const text = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${text}`.trim());
    }
    try{ return await res.json(); }
    catch{ return { ok:true }; }
  }
  function buildCsvBundle(){
    return {
      summaryCsv: rowsToCsv([buildSummary('export')]),
      eventsCsv: rowsToCsv(eventLog),
      timelineCsv: rowsToCsv(riskTimeline),
      featuresCsv: rowsToCsv(featureRows),
      labelsCsv: rowsToCsv(labelRows)
    };
  }

  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  const studyId = String(qs('studyId','')).trim();
  const phaseName = String(qs('phase','')).trim();
  const conditionGroup = String(qs('conditionGroup','')).trim();
  const schoolCode = String(qs('schoolCode','')).trim();
  const classRoom = String(qs('classRoom','')).trim();

  const sessionId = [
    'HYD',
    pid || 'anon',
    seedStr,
    Date.now()
  ].join('_');

  const sessionMeta = {
    sessionId,
    pid,
    seed: seedStr,
    studyId,
    phaseName,
    conditionGroup,
    schoolCode,
    classRoom,
    game: 'hydration',
    zone: 'nutrition',
    runMode,
    diff,
    view
  };

  function emojiFor(diffKey, phase, level=0){
    diffKey = String(diffKey || 'normal').toLowerCase();
    const p = String(phase || 'normal').toLowerCase();
    if(p==='storm'){
      if(diffKey==='easy') return '🌦️⚡';
      if(diffKey==='hard') return '🌪️⚡⚡⚡';
      return '🌩️⚡⚡';
    }
    if(p==='boss'){
      if(diffKey==='easy') return ['⛈️⚡','🌩️⚡','🌪️⚡'][Math.max(0,Math.min(2,level-1))];
      if(diffKey==='hard') return ['🌀🌩️⚡⚡','🌪️⚡⚡⚡','🌀🌪️⚡⚡⚡'][Math.max(0,Math.min(2,level-1))];
      return ['⛈️🌀⚡','🌩️⚡⚡','🌪️⚡⚡'][Math.max(0,Math.min(2,level-1))];
    }
    if(p==='final'){
      if(diffKey==='easy') return '🌩️👑⚡';
      if(diffKey==='hard') return '🌪️👑⚡⚡⚡🔥';
      return '🌪️👑⚡⚡';
    }
    return '💧';
  }

  function hhDayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function cooldownDone(cat, game, who){
    const day=hhDayKey();
    const kNew=`HHA_COOLDOWN_DONE:${cat}:${game}:${who}:${day}`;
    const kOld=`HHA_COOLDOWN_DONE:${cat}:${who}:${day}`;
    return (lsGet(kNew)==='1') || (lsGet(kOld)==='1');
  }
  function buildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, who }){
    const gate = new URL('../warmup-gate.html', location.href);
    gate.searchParams.set('gatePhase','cooldown');
    gate.searchParams.set('cat', String(cat || 'nutrition'));
    gate.searchParams.set('theme', String(gameKey || 'hydration'));
    gate.searchParams.set('pid', String(who || 'anon'));
    if(hub) gate.searchParams.set('hub', String(hub));
    gate.searchParams.set('next', String(nextAfterCooldown || hub || '../hub.html'));
    return gate.toString();
  }

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a>>>=0; b>>>=0; c>>>=0; d>>>=0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const s = xmur3(seed);
    return sfc32(s(), s(), s(), s());
  }

  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01() * arr.length) | 0];

  const ui = {
    score: DOC.getElementById('uiScore'),
    time: DOC.getElementById('uiTime'),
    miss: DOC.getElementById('uiMiss'),
    expire: DOC.getElementById('uiExpire'),
    block: DOC.getElementById('uiBlock'),
    grade: DOC.getElementById('uiGrade'),
    water: DOC.getElementById('uiWater'),
    combo: DOC.getElementById('uiCombo'),
    shield: DOC.getElementById('uiShield'),
    phase: DOC.getElementById('uiPhase'),
    aiRisk: DOC.getElementById('aiRisk'),
    aiHint: DOC.getElementById('aiHint'),

    btnSfx: DOC.getElementById('btnSfx'),
    btnPause: DOC.getElementById('btnPause'),
    btnHelp: DOC.getElementById('btnHelp'),
    helpOverlay: DOC.getElementById('helpOverlay'),
    btnHelpStart: DOC.getElementById('btnHelpStart'),
    pauseOverlay: DOC.getElementById('pauseOverlay'),
    btnResume: DOC.getElementById('btnResume'),

    end: DOC.getElementById('end'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endMiss: DOC.getElementById('endMiss'),
    endWater: DOC.getElementById('endWater'),
    endCoach: DOC.getElementById('endCoach'),

    btnCopy: DOC.getElementById('btnCopy'),
    btnCopyEvents: DOC.getElementById('btnCopyEvents'),
    btnCopyTimeline: DOC.getElementById('btnCopyTimeline'),
    btnCopyFeatures: DOC.getElementById('btnCopyFeatures'),
    btnCopyLabels: DOC.getElementById('btnCopyLabels'),
    btnCopyFeaturesCsv: DOC.getElementById('btnCopyFeaturesCsv'),
    btnCopyLabelsCsv: DOC.getElementById('btnCopyLabelsCsv'),
    btnCopyCsvBundle: DOC.getElementById('btnCopyCsvBundle'),
    btnSendCloud: DOC.getElementById('btnSendCloud'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub: DOC.getElementById('btnBackHub'),

    riskFill: DOC.getElementById('riskFill'),
    coachExplain: DOC.getElementById('coachExplain'),

    coachToast: DOC.getElementById('coachToast'),
    coachToastText: DOC.getElementById('coachToastText'),
  };

  const stageEl = DOC.getElementById('stage') || layer.parentElement;
  const zoneSign = DOC.getElementById('zoneSign');
  const btnZoneL = DOC.getElementById('btnZoneL');
  const btnZoneR = DOC.getElementById('btnZoneR');

  const SFX = (() => {
    let ctx = null;
    let unlocked = false;
    let enabled = true;
    let volumeMul = 1.0;
    let last = new Map();

    try{
      const saved = localStorage.getItem('HHA_SFX_ENABLED');
      if(saved === '0') enabled = false;
    }catch(e){}

    function now(){ return (ctx && ctx.currentTime) ? ctx.currentTime : 0; }
    function ensure(){
      if(ctx) return ctx;
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
      return ctx;
    }
    async function unlock(){
      const c = ensure();
      if(!c) return;
      try{
        if(c.state === 'suspended') await c.resume();
        const o = c.createOscillator();
        const g = c.createGain();
        g.gain.value = 0.0001;
        o.connect(g); g.connect(c.destination);
        o.start();
        o.stop(c.currentTime + 0.01);
        unlocked = true;
      }catch(e){}
    }
    function setEnabled(v){
      enabled = !!v;
      try{ localStorage.setItem('HHA_SFX_ENABLED', enabled ? '1' : '0'); }catch(e){}
    }
    function isEnabled(){ return enabled; }
    function setPhaseVolume(p){
      if(p==='storm') volumeMul = 0.95;
      else if(p==='boss') volumeMul = 1.00;
      else if(p==='final') volumeMul = 1.08;
      else volumeMul = 0.88;
    }
    function canPlay(key, minGapMs){
      if(!enabled) return false;
      const t = Date.now();
      const prev = last.get(key) || 0;
      if(t - prev < minGapMs) return false;
      last.set(key, t);
      return true;
    }
    function beep({f0=440,f1=440,dur=0.08,type='sine',vol=0.12,attack=0.004,release=0.06}){
      const c = ensure();
      if(!c || (!unlocked && c.state!=='running') || !enabled) return;
      const t0 = now();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.linearRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol * volumeMul, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.001, dur + release));
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + release + 0.02);
    }
    function noise({dur=0.14,vol=0.10,attack=0.002,release=0.12,hp=800}){
      const c = ensure();
      if(!c || (!unlocked && c.state!=='running') || !enabled) return;
      const t0 = now();
      const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2 - 1) * (1 - i / bufferSize);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = hp;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol * volumeMul, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.001, dur + release));
      src.connect(filter); filter.connect(g); g.connect(c.destination);
      src.start(t0); src.stop(t0 + dur + release + 0.02);
    }
    function pop(){ if(canPlay('pop',30)) beep({ f0:720, f1:980, dur:0.06, type:'triangle', vol:0.10 }); }
    function shield(){ if(canPlay('shield',60)){ beep({ f0:520, f1:780, dur:0.08, type:'sine', vol:0.12 }); beep({ f0:880, f1:880, dur:0.04, type:'triangle', vol:0.08, attack:0.002, release:0.04 }); } }
    function bad(){ if(canPlay('bad',80)){ beep({ f0:220, f1:120, dur:0.12, type:'sawtooth', vol:0.10 }); noise({ dur:0.10, vol:0.06, hp:1200 }); } }
    function block(){ if(canPlay('block',70)) beep({ f0:360, f1:280, dur:0.08, type:'square', vol:0.08 }); }
    function thunder(){ if(canPlay('thunder',160)){ noise({ dur:0.18, vol:0.10, hp:400 }); beep({ f0:120, f1:70, dur:0.22, type:'sine', vol:0.10, attack:0.01, release:0.18 }); } }
    function phase(name){
      if(!canPlay('phase',260)) return;
      if(name==='storm'){
        beep({ f0:420, f1:560, dur:0.10, type:'triangle', vol:0.10 });
        noise({ dur:0.08, vol:0.05, hp:900 });
      }else if(name==='boss'){
        beep({ f0:300, f1:420, dur:0.12, type:'sawtooth', vol:0.09 });
        beep({ f0:520, f1:520, dur:0.08, type:'square', vol:0.06 });
      }else if(name==='final'){
        beep({ f0:360, f1:540, dur:0.14, type:'sawtooth', vol:0.10 });
        beep({ f0:720, f1:980, dur:0.10, type:'triangle', vol:0.08 });
        noise({ dur:0.10, vol:0.06, hp:700 });
      }
    }
    return { unlock, pop, shield, bad, block, thunder, phase, setEnabled, isEnabled, setPhaseVolume };
  })();

  const unlockOnce = (() => {
    let done = false;
    return async ()=>{
      if(done) return;
      done = true;
      await SFX.unlock();
      DOC.removeEventListener('pointerdown', unlockOnce, true);
      DOC.removeEventListener('touchstart', unlockOnce, true);
      DOC.removeEventListener('keydown', unlockOnce, true);
    };
  })();
  DOC.addEventListener('pointerdown', unlockOnce, true);
  DOC.addEventListener('touchstart', unlockOnce, true);
  DOC.addEventListener('keydown', unlockOnce, true);

  function refreshSfxBtn(){
    if(ui.btnSfx) ui.btnSfx.textContent = SFX.isEnabled() ? '🔊 SFX' : '🔇 SFX';
  }
  if(ui.btnSfx){
    refreshSfxBtn();
    ui.btnSfx.addEventListener('click', async (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      await SFX.unlock();
      SFX.setEnabled(!SFX.isEnabled());
      refreshSfxBtn();
    });
  }

  const TUNE = {
    spawnBase: diff==='easy' ? 0.66 : diff==='hard' ? 0.95 : 0.78,
    ttlGood: diff==='easy' ? 3.2 : diff==='hard' ? 2.5 : 2.9,
    ttlBad: diff==='easy' ? 3.2 : diff==='hard' ? 2.6 : 3.0,
    missLimit: diff==='easy' ? 8 : diff==='hard' ? 5 : 6,
    waterGain: diff==='easy' ? 8.5 : diff==='hard' ? 6.8 : 7.5,
    waterLoss: diff==='easy' ? 5.2 : diff==='hard' ? 7.0 : 6.0,
    shieldDrop: diff==='easy' ? 0.10 : diff==='hard' ? 0.18 : 0.14,

    stormSec: diff==='easy' ? 8 : diff==='hard' ? 12 : 10,

    boss1NeedHits: diff==='easy' ? 6 : diff==='hard' ? 10 : 8,
    boss2NeedHits: diff==='easy' ? 8 : diff==='hard' ? 12 : 10,
    boss3NeedHits: diff==='easy' ? 10 : diff==='hard' ? 14 : 12,
    finalNeedHits: diff==='easy' ? 12 : diff==='hard' ? 16 : 14,

    lightningDmgWater: diff==='easy' ? 5.5 : diff==='hard' ? 8.5 : 7.0,
    lightningDmgScore: diff==='easy' ? 4 : diff==='hard' ? 8 : 6,

    zoneChunkStorm: diff==='easy' ? 3.5 : diff==='hard' ? 2.7 : 3.1,
    zoneChunkBoss1: diff==='easy' ? 3.2 : diff==='hard' ? 2.5 : 2.9,
    zoneChunkBoss2: diff==='easy' ? 3.0 : diff==='hard' ? 2.3 : 2.7,
    zoneChunkBoss3: diff==='easy' ? 2.8 : diff==='hard' ? 2.0 : 2.4,
    zoneChunkFinal: diff==='easy' ? 2.6 : diff==='hard' ? 1.8 : 2.1
  };

  const phaseStats = {
    normal:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    storm:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    boss1:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    boss2:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    boss3:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    final:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
  };

  const eventLog = [];
  const riskTimeline = [];
  const featureRows = [];
  const labelRows = [];

  let lightningHitCount = 0;
  let lightningBlockCount = 0;
  let badHitCount = 0;
  let goodExpireCount = 0;

  let stormEntered = 0;
  let boss1Entered = 0;
  let boss2Entered = 0;
  let boss3Entered = 0;
  let finalEntered = 0;
  let finalCleared = 0;

  let feverOn = false;
  let feverLeft = 0;
  let streakGood = 0;
  let phaseBannerLock = 0;
  let coachToastLock = 0;

  function currentPhaseKey(){
    if(phase === 'boss') return `boss${bossLevel}`;
    return phase;
  }
  function logEvent(type, data={}){
    const item = {
      ts: nowIso(),
      ms: nowMs(),
      sessionId,
      pid,
      seed: seedStr,
      studyId,
      phaseName,
      conditionGroup,
      game: 'hydration',
      zone: 'nutrition',
      type,
      phase: currentPhaseKey(),
      ...data
    };
    eventLog.push(item);
    try{ WIN.dispatchEvent(new CustomEvent('hha:event', { detail:item })); }catch(e){}
  }

  let playing = true;
  let paused = false;
  let helpOpen = false;

  let tLeft = plannedSec;
  let lastTick = nowMs();

  let score = 0;
  let missBadHit = 0;
  let missGoodExpired = 0;
  let blockCount = 0;

  let combo = 0;
  let bestCombo = 0;
  let shield = 0;
  let waterPct = 30;

  let phase = 'normal';
  let stormLeft = 0;
  let stormDone = false;

  let bossLevel = 0;
  let bossHits = 0;
  let bossGoal = 0;

  let finalHits = 0;
  let finalGoal = 0;

  let needZone = 'L';
  let zoneT = 0;
  let aimX01 = 0.5;

  let lastTimelineAt = -1;

  function setStagePhase(p){
    stageEl?.classList?.toggle('is-storm', p==='storm');
    stageEl?.classList?.toggle('is-boss', p==='boss');
    stageEl?.classList?.toggle('is-final', p==='final');
  }
  function isInNeededZone(){ return (needZone==='L') ? (aimX01 < 0.5) : (aimX01 >= 0.5); }
  function swapZone(){ needZone = (needZone === 'L') ? 'R' : 'L'; }

  function updateAimFromEvent(ev){
    try{
      const r = layer.getBoundingClientRect();
      aimX01 = clamp((ev.clientX - r.left) / Math.max(1, r.width), 0, 1);
    }catch(e){}
  }
  layer.addEventListener('pointermove', (ev)=>{ updateAimFromEvent(ev); }, { passive:true });
  layer.addEventListener('pointerdown', (ev)=>{ updateAimFromEvent(ev); }, { passive:true });

  if(btnZoneL && btnZoneR){
    btnZoneL.onclick = ()=>{ aimX01 = 0.25; };
    btnZoneR.onclick = ()=>{ aimX01 = 0.75; };
  }

  function showHelp(){
    if(!ui.helpOverlay){
      helpOpen = false;
      paused = false;
      return;
    }
    helpOpen = true;
    paused = true;
    ui.helpOverlay.setAttribute('aria-hidden','false');
  }
  function hideHelp(){
    helpOpen = false;
    if(ui.helpOverlay) ui.helpOverlay.setAttribute('aria-hidden','true');
    paused = false;
    lastTick = nowMs();
    requestAnimationFrame(loop);
  }
  function showPause(){
    if(!ui.pauseOverlay){
      paused = true;
      return;
    }
    paused = true;
    ui.pauseOverlay.setAttribute('aria-hidden','false');
  }
  function hidePause(){
    if(ui.pauseOverlay) ui.pauseOverlay.setAttribute('aria-hidden','true');
    paused = false;
    lastTick = nowMs();
    requestAnimationFrame(loop);
  }

  if(ui.btnHelp) ui.btnHelp.onclick = showHelp;
  if(ui.btnHelpStart) ui.btnHelpStart.onclick = hideHelp;
  if(ui.btnPause) ui.btnPause.onclick = ()=> paused ? hidePause() : showPause();
  if(ui.btnResume) ui.btnResume.onclick = hidePause;

  function fxShake(){
    try{
      stageEl.classList.remove('fx-shake');
      void stageEl.offsetWidth;
      stageEl.classList.add('fx-shake');
      setTimeout(()=> stageEl.classList.remove('fx-shake'), 220);
    }catch(e){}
  }
  function fxRing(x,y){
    const el = DOC.createElement('div');
    el.className = 'fx-ring';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layer.appendChild(el);
    setTimeout(()=> el.remove(), 520);
  }
  function fxScore(x,y,text){
    const el = DOC.createElement('div');
    el.className = 'fx-score';
    el.textContent = String(text || '');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layer.appendChild(el);
    setTimeout(()=> el.remove(), 900);
  }
  function fxBubblePop(el, kind){
    el.classList.remove('fx-pop','fx-bad');
    void el.offsetWidth;
    el.classList.add(kind === 'bad' ? 'fx-bad' : 'fx-pop');
  }
  function fxPhaseBanner(text){
    const r = layer.getBoundingClientRect();
    const cx = r.width / 2;
    const cy = Math.max(120, Math.min(r.height * 0.30, 260));
    fxRing(cx, cy);
    fxScore(cx, cy, text);
    fxShake();
  }

  function startFever(sec=5){
    feverOn = true;
    feverLeft = Math.max(feverLeft, sec);
    fxPhaseBanner('🔥 FEVER');
    logEvent('fever_start', { sec });
  }

  function stopFever(){
    if(!feverOn) return;
    feverOn = false;
    feverLeft = 0;
    logEvent('fever_end', {});
  }

  function phaseBanner(text){
    const t = nowMs();
    if(t - phaseBannerLock < 900) return;
    phaseBannerLock = t;
    fxPhaseBanner(text);
  }

  function toastCoach(msg, minGapMs=1600){
    const t = nowMs();
    if(t - coachToastLock < minGapMs) return;
    coachToastLock = t;

    if(!ui.coachToast || !ui.coachToastText) return;
    ui.coachToastText.textContent = String(msg || '');
    ui.coachToast.setAttribute('aria-hidden','false');

    clearTimeout(WIN.__HYD_TOAST_TIMER__);
    WIN.__HYD_TOAST_TIMER__ = setTimeout(()=>{
      try{ ui.coachToast.setAttribute('aria-hidden','true'); }catch(e){}
    }, 1350);
  }

  function lightning(){
    SFX.thunder();
    const f = DOC.createElement('div');
    f.className = 'storm-flash';
    stageEl.appendChild(f);
    setTimeout(()=> f.remove(), 220);

    const b = DOC.createElement('div');
    b.className = 'bolt';
    b.style.left = `${10 + r01()*80}%`;
    b.style.transform = `translateX(-50%) rotate(${(r01()*18-9).toFixed(1)}deg)`;
    stageEl.appendChild(b);
    setTimeout(()=> b.remove(), 260);
  }

  let _safeTop = 150;
  let _safeBottom = 110;

  function measureSafeZones(){
    try{
      const hudRect = DOC.querySelector('.hud')?.getBoundingClientRect();
      const zoneRect = DOC.getElementById('zoneSign')?.getBoundingClientRect();
      const dockRect = DOC.getElementById('timelineDock')?.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();

      let top = 18;
      let bottom = 90;

      if(hudRect && hudRect.height > 0){
        top = Math.max(top, hudRect.bottom - layerRect.top + 14);
      }
      if(zoneRect && zoneRect.height > 0 && zoneSign && zoneSign.textContent){
        top = Math.max(top, zoneRect.bottom - layerRect.top + 14);
      }
      if(dockRect && dockRect.height > 0){
        bottom = Math.max(bottom, layerRect.bottom - dockRect.top + 14);
      }

      _safeTop = Math.round(top);
      _safeBottom = Math.round(bottom);
    }catch(e){}
  }

  function safeSpawnXY(){
    const r = layer.getBoundingClientRect();
    const padX = (view === 'mobile') ? 22 : 26;
    const yMin = clamp(_safeTop, 18, Math.max(18, r.height - 100));
    const yMax = clamp(r.height - _safeBottom, yMin + 1, r.height - 40);

    const x = padX + r01() * Math.max(1, r.width - padX * 2);
    const y = yMin + r01() * Math.max(1, yMax - yMin);

    return { x, y };
  }

  measureSafeZones();
  WIN.addEventListener('resize', ()=> setTimeout(measureSafeZones, 120), { passive:true });
  WIN.addEventListener('orientationchange', ()=> setTimeout(measureSafeZones, 180), { passive:true });
  setInterval(measureSafeZones, 700);

  const bubbles = new Map();
  let idSeq = 1;
  const GOOD = ['💧','💦','🫗'];
  const BAD  = ['🧋','🥤','🍟'];
  const SHLD = ['🛡️'];

  function makeBubble(kind, emoji, ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'bubble';
    el.textContent = emoji;
    el.dataset.id = id;
    el.dataset.kind = kind;

    const p = safeSpawnXY();
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.animation = `hydFloat ${1.6 + r01()*1.6}s ease-in-out infinite alternate`;
    el.style.transform = 'translate(-50%, -50%)';

    layer.appendChild(el);
    bubbles.set(id, { id, el, kind, emoji, born:nowMs(), ttl:Math.max(0.9, ttlSec)*1000 });
    logEvent('spawn', { kind, x:p.x, y:p.y });
  }

  function removeBubble(id){
    const b = bubbles.get(String(id));
    if(!b) return;
    bubbles.delete(String(id));
    try{ b.el.remove(); }catch(e){}
  }

  function gradeText(){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = score / played;
    const x = sps*10 - missBadHit*0.55 - missGoodExpired*0.08;
    if(x >= 70) return 'S';
    if(x >= 55) return 'A';
    if(x >= 40) return 'B';
    if(x >= 28) return 'C';
    return 'D';
  }

  function buildRisk(){
    const missPressure = (missBadHit / Math.max(1, TUNE.missLimit));
    const expirePressure = clamp(missGoodExpired / 25, 0, 1);
    const lowWater = (waterPct < 35) ? (35 - waterPct) / 35 : 0;
    const noShieldStorm = ((phase==='storm' || phase==='boss' || phase==='final') && shield===0) ? 0.20 : 0;
    const wrongZonePenalty = ((phase==='storm' || phase==='boss' || phase==='final') && !isInNeededZone()) ? 0.12 : 0;
    return clamp(missPressure*0.40 + lowWater*0.28 + expirePressure*0.10 + noShieldStorm + wrongZonePenalty, 0, 1);
  }

  function explainRisk(risk){
    const reasons = [];
    if(waterPct < 35) reasons.push('น้ำต่ำ');
    if(shield === 0 && (phase==='storm' || phase==='boss' || phase==='final')) reasons.push('ไม่มีโล่');
    if(missBadHit >= Math.max(2, Math.floor(TUNE.missLimit*0.4))) reasons.push('โดนของไม่ดีบ่อย');
    if(missGoodExpired >= 4) reasons.push('เก็บน้ำไม่ทัน');
    if((phase==='storm' || phase==='boss' || phase==='final') && !isInNeededZone()) reasons.push('อยู่ผิดฝั่ง');

    if(reasons.length === 0){
      if(risk < 0.25) return 'ปลอดภัยดี เล่นต่อได้';
      if(risk < 0.5) return 'เสี่ยงปานกลาง ระวังจังหวะ';
      return 'เริ่มเสี่ยง คุมโล่และน้ำให้ดี';
    }
    return `เสี่ยง: ${reasons.slice(0,2).join(' + ')}`;
  }

  function setHUD(){
    if(ui.score) ui.score.textContent = String(score|0);
    if(ui.time) ui.time.textContent = String(Math.ceil(tLeft));
    if(ui.miss) ui.miss.textContent = String(missBadHit|0);
    if(ui.expire) ui.expire.textContent = String(missGoodExpired|0);
    if(ui.block) ui.block.textContent = String(blockCount|0);
    if(ui.water) ui.water.textContent = `${Math.round(clamp(waterPct,0,100))}%`;
    if(ui.combo) ui.combo.textContent = String(combo|0);
    if(ui.shield) ui.shield.textContent = String(shield|0);
    if(ui.grade) ui.grade.textContent = gradeText();

    if(ui.phase){
      if(phase === 'storm'){
        ui.phase.textContent = `${emojiFor(diff,'storm')} STORM ${needZone==='L'?'LEFT':'RIGHT'}`;
      }else if(phase === 'boss'){
        ui.phase.textContent = `${emojiFor(diff,'boss',bossLevel)} BOSS ${bossLevel} ${bossHits}/${bossGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      }else if(phase === 'final'){
        ui.phase.textContent = `${emojiFor(diff,'final')} FINAL ${finalHits}/${finalGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      }else{
        ui.phase.textContent = feverOn ? `🔥 FEVER ${feverLeft.toFixed(1)}s` : '💧 NORMAL';
      }
    }

    if(zoneSign){
      if(phase==='storm' || phase==='boss' || phase==='final'){
        const emo = phase==='boss' ? emojiFor(diff,'boss',bossLevel) : emojiFor(diff,phase);
        zoneSign.textContent = `${emo} SAFE: ${needZone==='L'?'⬅️LEFT':'➡️RIGHT'} + 🛡️`;
      }else{
        zoneSign.textContent = '';
      }
    }
  }

  function setAIHud(risk, hint){
    if(ui.aiRisk) ui.aiRisk.textContent = String((+risk).toFixed(2));
    if(ui.aiHint) ui.aiHint.textContent = String(hint || '—');
    if(ui.riskFill) ui.riskFill.style.width = `${Math.round(clamp(risk,0,1)*100)}%`;
    if(ui.coachExplain) ui.coachExplain.textContent = explainRisk(risk);
  }

  function predictRiskFromFeatures(features){
    return features.riskHeuristic;
  }
  function predictFailSoon(features){
    return (features.waterPct < 18 || (features.inDangerPhase && features.shield === 0 && !features.inCorrectZone)) ? 1 : 0;
  }

  function applyLightningStrike(rate){
    if(r01() < rate){
      lightning();
      fxShake();
      const r = layer.getBoundingClientRect();
      fxRing(r.width/2, r.height/2);
      fxScore(r.width/2, r.height/2, '⚡');

      if(shield > 0 && isInNeededZone()){
        shield--;
        blockCount++;
        lightningBlockCount++;
        phaseStats[currentPhaseKey()].lightningBlock++;
        phaseStats[currentPhaseKey()].block++;
        SFX.block();
        fxScore(120, 230, 'BLOCK⚡');
        toastCoach('กันฟ้าผ่าสำเร็จ! ดีมาก', 500);
        logEvent('lightning_block', { shield });
      }else{
        streakGood = 0;
        stopFever();
        combo = 0;
        waterPct = clamp(waterPct - TUNE.lightningDmgWater, 0, 100);
        score = Math.max(0, score - TUNE.lightningDmgScore);
        lightningHitCount++;
        phaseStats[currentPhaseKey()].lightningHit++;
        SFX.bad();
        fxScore(120, 230, `-${TUNE.lightningDmgScore}⚡`);
        toastCoach(`โดนฟ้าผ่า! คราวหน้าไป${needZone==='L'?'ซ้าย':'ขวา'}และมีโล่`, 500);
        logEvent('lightning_hit', { waterPct, score });
      }
    }
  }

  function hit(b){
    if(!playing || paused) return;

    const bb = b.el.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const bx = (bb.left + bb.width/2) - lr.left;
    const by = (bb.top + bb.height/2) - lr.top;
    const pk = currentPhaseKey();

    if(b.kind === 'good'){
      streakGood++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);

      if(streakGood >= 8 && !feverOn){
        startFever(5.5);
      }

      const comboTier = combo>=18 ? 4 : combo>=12 ? 3 : combo>=7 ? 2 : 1;
      const feverMul = feverOn ? 1.35 : 1.0;
      const add = Math.round((9 + Math.min(14, combo)) * comboTier * feverMul);

      score += add;
      waterPct = clamp(waterPct + TUNE.waterGain + (feverOn ? 1.0 : 0), 0, 100);
      phaseStats[pk].goodHit++;

      SFX.pop();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, `+${add}${feverOn ? ' 🔥' : ''}`);
      logEvent('good_hit', { scoreAdd:add, combo, waterPct });

      if(phase === 'boss'){
        bossHits++;
        fxScore(bx, by-12, `${bossHits}/${bossGoal}`);

        if(bossHits >= bossGoal){
          if(bossLevel < 3){
            bossLevel++;
            if(bossLevel === 2) boss2Entered = 1;
            if(bossLevel === 3) boss3Entered = 1;
            bossHits = 0;
            bossGoal = bossLevel===2 ? TUNE.boss2NeedHits : TUNE.boss3NeedHits;
            SFX.setPhaseVolume('boss');
            SFX.phase('boss');
            needZone = (r01() < 0.5) ? 'L' : 'R';
            zoneT = 0;
            phaseBanner(`${emojiFor(diff,'boss',bossLevel)} BOSS ${bossLevel}`);
            toastCoach(`บอส ${bossLevel} เริ่มแล้ว! เก็บน้ำต่อเนื่องและหลบฟ้าผ่า`, 300);
            logEvent('phase_enter', { phase:`boss${bossLevel}` });
          }else{
            phase = 'final';
            finalEntered = 1;
            bossHits = 0;
            finalHits = 0;
            finalGoal = TUNE.finalNeedHits;
            setStagePhase('final');
            SFX.setPhaseVolume('final');
            SFX.phase('final');
            zoneT = 0;
            needZone = (r01() < 0.5) ? 'L' : 'R';
            phaseBanner(`${emojiFor(diff,'final')} FINAL BOSS`);
            toastCoach('FINAL BOSS! อย่าพลาด เก็บน้ำต่อเนื่องและดู safe zone', 300);
            logEvent('phase_enter', { phase:'final' });
          }
        }
      }else if(phase === 'final'){
        finalHits++;
        fxScore(bx, by-12, `${finalHits}/${finalGoal}`);
        if(finalHits >= finalGoal){
          showEnd('final-clear');
          return;
        }
      }

      setTimeout(()=> removeBubble(b.id), 50);
      return;
    }

    if(b.kind === 'shield'){
      shield = clamp(shield + 1, 0, 9);
      score += 6;
      SFX.shield();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, '🛡️+1');
      logEvent('shield_hit', { shield });
      setTimeout(()=> removeBubble(b.id), 50);
      return;
    }

    if(shield > 0){
      shield--;
      blockCount++;
      score += 2;
      phaseStats[pk].block++;
      SFX.block();
      fxBubblePop(b.el, 'bad');
      fxRing(bx, by);
      fxScore(bx, by, 'BLOCK');
      logEvent('bad_block', { shield });
      setTimeout(()=> removeBubble(b.id), 50);
      return;
    }

    badHitCount++;
    streakGood = 0;
    stopFever();
    missBadHit++;
    combo = 0;
    score = Math.max(0, score - 8);
    waterPct = clamp(waterPct - TUNE.waterLoss, 0, 100);
    phaseStats[pk].badHit++;

    SFX.bad();
    fxShake();
    fxBubblePop(b.el, 'bad');
    fxRing(bx, by);
    fxScore(bx, by, '-8');
    toastCoach('โดนของไม่ดี! คะแนนและน้ำลด', 500);
    logEvent('bad_hit', { waterPct, score });

    setTimeout(()=> removeBubble(b.id), 50);
  }

  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.bubble');
    if(!el) return;
    const b = bubbles.get(String(el.dataset.id));
    if(b) hit(b);
  }, { passive:true });

  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
    let best = null;
    let bestD = 1e9;
    const r = layer.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    for(const b of bubbles.values()){
      const bb = b.el.getBoundingClientRect();
      const bx = bb.left + bb.width/2;
      const by = bb.top + bb.height/2;
      const d = Math.hypot(bx-cx, by-cy);
      if(d < bestD){
        bestD = d;
        best = b;
      }
    }
    return (best && bestD <= lockPx) ? best : null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const b = pickClosestToCenter(ev?.detail?.lockPx ?? 56);
    if(b) hit(b);
  });

  function updateBubbles(){
    const t = nowMs();
    const lr = layer.getBoundingClientRect();
    const pk = currentPhaseKey();

    for(const b of Array.from(bubbles.values())){
      if(t - b.born >= b.ttl){
        if(b.kind === 'good'){
          goodExpireCount++;
          streakGood = 0;
          stopFever();
          missGoodExpired++;
          combo = 0;
          score = Math.max(0, score - 4);
          waterPct = clamp(waterPct - 4.5, 0, 100);
          phaseStats[pk].goodExpire++;

          const bb = b.el.getBoundingClientRect();
          const bx = (bb.left + bb.width/2) - lr.left;
          const by = (bb.top + bb.height/2) - lr.top;

          fxBubblePop(b.el, 'bad');
          fxRing(bx, by);
          fxScore(bx, by, 'MISS💧');
          toastCoach('น้ำหายไปแล้ว รีบเก็บให้ไวขึ้น', 500);
          logEvent('good_expire', { waterPct, score });
        }else{
          fxBubblePop(b.el, 'good');
        }
        setTimeout(()=> removeBubble(b.id), 40);
      }
    }
  }

  function buildFeatureRow(riskHeuristic){
    const playedSec = Math.round(plannedSec - tLeft);
    const inDangerPhase = (phase==='storm' || phase==='boss' || phase==='final') ? 1 : 0;
    const inCorrectZone = isInNeededZone() ? 1 : 0;

    return {
      sessionId,
      pid,
      seed: seedStr,
      studyId,
      phaseName,
      conditionGroup,
      diff,
      view,
      runMode,

      t: playedSec,
      timeLeft: Math.ceil(tLeft),

      phase: currentPhaseKey(),
      bossLevel,

      score,
      waterPct: Math.round(waterPct),
      shield,
      combo,
      streakGood,
      feverOn: feverOn ? 1 : 0,
      feverLeft: +feverLeft.toFixed(3),

      missBadHit,
      missGoodExpired,
      blockCount,
      lightningHitCount,
      lightningBlockCount,

      inDangerPhase,
      inCorrectZone,

      riskHeuristic: +riskHeuristic.toFixed(4),

      recentBadHitRate: +(missBadHit / Math.max(1, playedSec)).toFixed(4),
      recentExpireRate: +(missGoodExpired / Math.max(1, playedSec)).toFixed(4),
      recentBlockRate: +(blockCount / Math.max(1, playedSec)).toFixed(4),
      recentLightningHitRate: +(lightningHitCount / Math.max(1, playedSec)).toFixed(4),
      recentLightningBlockRate: +(lightningBlockCount / Math.max(1, playedSec)).toFixed(4)
    };
  }

  function buildLabelRow(featureRow){
    const lowWater = featureRow.waterPct < 25 ? 1 : 0;
    const noShield = featureRow.shield === 0 ? 1 : 0;
    const wrongZone = featureRow.inDangerPhase && !featureRow.inCorrectZone ? 1 : 0;
    const highRisk = featureRow.riskHeuristic >= 0.60 ? 1 : 0;

    return {
      sessionId,
      pid,
      seed: seedStr,
      studyId,
      phaseName,
      conditionGroup,

      t: featureRow.t,
      phase: featureRow.phase,

      fail_soon_5s: predictFailSoon(featureRow),
      fail_soon_10s: (featureRow.waterPct < 12 || (featureRow.inDangerPhase && featureRow.shield===0)) ? 1 : 0,

      low_water_label: lowWater,
      no_shield_label: noShield,
      wrong_zone_label: wrongZone,
      high_risk_label: highRisk,

      fever_label: featureRow.feverOn ? 1 : 0,
      final_clear_label: 0
    };
  }

  function updateTimelineAndFeatures(risk){
    const playedSec = Math.round(plannedSec - tLeft);
    if(playedSec === lastTimelineAt) return;
    lastTimelineAt = playedSec;

    const featureRow = buildFeatureRow(risk);
    const labelRow = buildLabelRow(featureRow);

    featureRows.push(featureRow);
    labelRows.push(labelRow);

    riskTimeline.push({
      sessionId,
      pid,
      seed: seedStr,
      studyId,
      phaseName,
      conditionGroup,
      t: featureRow.t,
      timeLeft: featureRow.timeLeft,
      phase: featureRow.phase,
      bossLevel: featureRow.bossLevel,
      risk: featureRow.riskHeuristic,
      waterPct: featureRow.waterPct,
      shield: featureRow.shield,
      combo: featureRow.combo,
      missBadHit: featureRow.missBadHit,
      missGoodExpired: featureRow.missGoodExpired,
      blockCount: featureRow.blockCount,
      inDangerPhase: featureRow.inDangerPhase,
      inCorrectZone: featureRow.inCorrectZone
    });
  }

  function endReasonText(reason){
    if(reason === 'time') return 'หมดเวลา';
    if(reason === 'miss-limit') return 'พลาดมากเกินไป';
    if(reason === 'dehydrated') return 'ค่าน้ำหมด';
    if(reason === 'final-clear') return 'ชนะ Final Boss สำเร็จ';
    return String(reason || 'จบเกม');
  }

  function reachedPhaseText(){
    if(finalCleared) return 'ผ่าน Final Boss';
    if(finalEntered) return 'ถึง Final Boss';
    if(boss3Entered) return 'ถึง Boss 3';
    if(boss2Entered) return 'ถึง Boss 2';
    if(boss1Entered) return 'ถึง Boss 1';
    if(stormEntered) return 'ถึง Storm';
    return 'ช่วงเริ่มเกม';
  }

  function buildEndCoachSummary(summary){
    const lines = [];

    if(summary.finalCleared) lines.push('ยอดเยี่ยม! ผ่าน Final Boss ได้สำเร็จ');
    else if(summary.waterPct < 20) lines.push('ควรเก็บน้ำให้เร็วขึ้นเพราะค่าน้ำต่ำบ่อย');
    else if(summary.missBadHit >= Math.max(3, Math.floor(TUNE.missLimit*0.5))) lines.push('ควรหลบของไม่ดีให้มากขึ้น');
    else if(summary.missGoodExpired >= 4) lines.push('ควรเก็บน้ำให้ทันก่อนหมดเวลา');
    else if(summary.lightningHitCount >= 2) lines.push('ควรดู safe zone และมีโล่ก่อนฟ้าผ่า');
    else lines.push('ทำได้ดี ลองรักษาคอมโบให้สูงขึ้นอีก');

    if(summary.comboMax >= 12) lines.push('คอมโบดีมาก แปลว่าจังหวะการเล่นเริ่มแม่นแล้ว');
    if(summary.lightningBlockCount >= 2) lines.push('กันฟ้าผ่าได้ดี แสดงว่าเริ่มอ่านเกมได้ถูก');
    if(summary.feverUsed) lines.push('เข้าสู่ FEVER ได้แล้ว แปลว่าเล่นต่อเนื่องดี');

    return lines.slice(0,3).join(' • ');
  }

  function buildTeacherSummary(summary){
    return {
      sessionId: summary.sessionId,
      pid: summary.pid,
      result: summary.endReasonText,
      reachedPhase: summary.reachedPhaseText,
      score: summary.scoreFinal,
      grade: summary.grade,
      waterPct: summary.waterPct,
      comboMax: summary.comboMax,
      missBadHit: summary.missBadHit,
      missGoodExpired: summary.missGoodExpired,
      lightningHitCount: summary.lightningHitCount,
      lightningBlockCount: summary.lightningBlockCount,
      feverUsed: summary.feverUsed,
      coachSummary: summary.coachSummary
    };
  }

  function buildSummary(reason){
    const playedSec = Math.round(plannedSec - tLeft);

    return {
      sessionId,
      pid,
      seed: seedStr,
      studyId,
      phaseName,
      conditionGroup,
      schoolCode,
      classRoom,

      projectTag:'HydrationVR',
      gameVersion:'HydrationVR_RESEARCH_POLISH_2026-03-07',
      device:view,
      runMode,
      diff,
      zone:'nutrition',
      game:'hydration',

      reason:String(reason || ''),
      endReasonText: endReasonText(reason),
      reachedPhaseText: reachedPhaseText(),

      durationPlannedSec: plannedSec,
      durationPlayedSec: playedSec,

      scoreFinal: score|0,
      grade: gradeText(),

      waterPct: Math.round(clamp(waterPct,0,100)),
      shield: shield|0,
      comboMax: bestCombo|0,

      missBadHit: missBadHit|0,
      missGoodExpired: missGoodExpired|0,
      badHitCount: badHitCount|0,
      goodExpireCount: goodExpireCount|0,

      blockCount: blockCount|0,
      lightningHitCount: lightningHitCount|0,
      lightningBlockCount: lightningBlockCount|0,

      stormEntered,
      boss1Entered,
      boss2Entered,
      boss3Entered,
      finalEntered,
      finalCleared,

      phaseFinal: currentPhaseKey(),
      bossLevel,
      bossHits: bossHits|0,
      finalHits: finalHits|0,

      feverUsed: eventLog.some(e => e.type === 'fever_start') ? 1 : 0,

      eventCount: eventLog.length,
      timelineCount: riskTimeline.length,
      featureCount: featureRows.length,
      labelCount: labelRows.length,

      startTimeIso: nowIso(),
      endTimeIso: nowIso(),

      coachSummary: '',
      phaseStats
    };
  }

  function buildResearchPacket(reason){
    const summary = buildSummary(reason);
    return {
      packetVersion: 'HHA_HYD_RESEARCH_PACKET_2026-03-07',
      session: { ...sessionMeta },
      summary,
      phaseStats,
      tables: {
        events: eventLog,
        timeline: riskTimeline,
        features: featureRows,
        labels: labelRows
      }
    };
  }

  function buildCloudEnvelope(reason){
    const packet = buildResearchPacket(reason);
    return {
      source: 'HeroHealth-HydrationVR',
      schemaVersion: '2026-03-07',
      session: packet.session,
      summary: packet.summary,
      phaseStats: packet.phaseStats,
      counts: {
        events: packet.tables.events.length,
        timeline: packet.tables.timeline.length,
        features: packet.tables.features.length,
        labels: packet.tables.labels.length
      },
      tables: packet.tables
    };
  }

  function setEndButtons(summary){
    const done = cooldownDone('nutrition', 'hydration', pid);
    const needCooldown = cooldownRequired && !done;

    if(ui.btnNextCooldown){
      ui.btnNextCooldown.classList.toggle('is-hidden', !needCooldown);
      ui.btnNextCooldown.onclick = null;
      if(needCooldown){
        const nextAfterCooldown = hubUrl || '../hub.html';
        const url = buildCooldownUrl({
          hub: hubUrl,
          nextAfterCooldown,
          cat:'nutrition',
          gameKey:'hydration',
          who: pid
        });
        ui.btnNextCooldown.onclick = ()=>{ location.href = url; };
      }
    }

    if(ui.btnBackHub) ui.btnBackHub.onclick = ()=>{ location.href = hubUrl; };
    if(ui.btnReplay){
      ui.btnReplay.onclick = ()=>{
        try{
          const u = new URL(location.href);
          if(runMode !== 'research'){
            u.searchParams.set('seed', String((Date.now() ^ (Math.random()*1e9))|0));
          }
          location.href = u.toString();
        }catch(e){ location.reload(); }
      };
    }

    if(ui.btnCopy){
      ui.btnCopy.onclick = async ()=>{
        const packet = {
          teacherSummary: buildTeacherSummary(summary),
          researchPacket: buildResearchPacket(summary.reason || 'end')
        };
        await copyText(safeJson(packet), 'Copy Summary');
      };
    }

    if(ui.btnCopyEvents) ui.btnCopyEvents.onclick = async ()=> copyText(safeJson(eventLog), 'Copy Events JSON');
    if(ui.btnCopyTimeline) ui.btnCopyTimeline.onclick = async ()=> copyText(safeJson(riskTimeline), 'Copy Timeline JSON');
    if(ui.btnCopyFeatures) ui.btnCopyFeatures.onclick = async ()=> copyText(safeJson(featureRows), 'Copy Features JSON');
    if(ui.btnCopyLabels) ui.btnCopyLabels.onclick = async ()=> copyText(safeJson(labelRows), 'Copy Labels JSON');

    if(ui.btnCopyFeaturesCsv){
      ui.btnCopyFeaturesCsv.onclick = async ()=>{
        await copyText(rowsToCsv(featureRows), 'Copy Features CSV');
      };
    }
    if(ui.btnCopyLabelsCsv){
      ui.btnCopyLabelsCsv.onclick = async ()=>{
        await copyText(rowsToCsv(labelRows), 'Copy Labels CSV');
      };
    }
    if(ui.btnCopyCsvBundle){
      ui.btnCopyCsvBundle.onclick = async ()=>{
        const bundle = buildCsvBundle();
        await copyText(safeJson(bundle), 'Copy CSV bundle');
      };
    }
    if(ui.btnSendCloud){
      ui.btnSendCloud.onclick = async ()=>{
        try{
          const payload = buildCloudEnvelope(summary?.reason || 'end');
          const out = await postToHHACloud(payload);
          try{ alert(`Cloud log sent${out?.ok===false ? ' (server returned not ok)' : ''}`); }catch(e){}
        }catch(err){
          try{ alert(`Send cloud failed: ${err.message || err}`); }catch(e){}
        }
      };
    }
  }

  function showEnd(reason){
    playing = false;
    paused = false;
    ui.pauseOverlay?.setAttribute('aria-hidden','true');
    ui.helpOverlay?.setAttribute('aria-hidden','true');
    setStagePhase('normal');

    for(const b of bubbles.values()){
      try{ b.el.remove(); }catch(e){}
    }
    bubbles.clear();

    if(reason === 'final-clear'){
      finalCleared = 1;
      for(const row of labelRows) row.final_clear_label = 1;
      for(let i=0;i<5;i++){
        setTimeout(()=>{
          try{
            fxPhaseBanner('🏆 FINAL CLEAR!');
            SFX.phase('final');
          }catch(e){}
        }, i * 180);
      }
    }

    const summary = buildSummary(reason);
    summary.coachSummary = buildEndCoachSummary(summary);

    try{
      const teacherPacket = {
        teacherSummary: buildTeacherSummary(summary),
        researchPacket: buildResearchPacket(reason),
        savedAtIso: new Date().toISOString()
      };
      localStorage.setItem('HHA_HYD_LAST_SUMMARY', JSON.stringify(teacherPacket));
    }catch(e){}

    try{
      const teacherPacket = {
        teacherSummary: buildTeacherSummary(summary),
        researchPacket: buildResearchPacket(reason),
        savedAtIso: new Date().toISOString()
      };

      const k = 'HHA_HYD_SUMMARY_HISTORY';
      let arr = [];
      try{
        arr = JSON.parse(localStorage.getItem(k) || '[]');
        if(!Array.isArray(arr)) arr = [];
      }catch(e){ arr = []; }

      arr.unshift(teacherPacket);
      if(arr.length > 120) arr = arr.slice(0, 120);

      localStorage.setItem(k, JSON.stringify(arr));
    }catch(e){}

    logEvent('game_end', { reason });

    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');

      ui.endTitle.textContent = (reason === 'final-clear') ? '🏆 FINAL CLEAR!' : 'Game Over';

      const subParts = [
        `ผลลัพธ์: ${summary.endReasonText}`,
        `ไปได้ถึง: ${summary.reachedPhaseText}`,
        `เกรด: ${summary.grade || '—'}`
      ];
      ui.endSub.textContent = subParts.join(' • ');
      if(ui.endCoach) ui.endCoach.textContent = summary.coachSummary || '—';

      ui.endGrade.textContent = summary.grade || '—';
      ui.endScore.textContent = String(summary.scoreFinal|0);
      ui.endMiss.textContent = `${summary.missBadHit|0} / expire ${summary.missGoodExpired|0}`;
      ui.endWater.textContent = `${summary.waterPct}%`;

      setEndButtons(summary);
    }
  }

  function checkEnd(){
    if(tLeft <= 0){ showEnd('time'); return true; }
    if(missBadHit >= TUNE.missLimit){ showEnd('miss-limit'); return true; }
    if(waterPct <= 0){ showEnd('dehydrated'); return true; }
    return false;
  }

  let spawnAcc = 0;

  function phaseSpawnMul(){
    if(feverOn && phase === 'normal') return 1.12;
    if(phase === 'storm') return diff==='easy' ? 1.24 : diff==='hard' ? 1.52 : 1.34;
    if(phase === 'boss'){
      if(bossLevel === 1) return diff==='easy' ? 1.16 : diff==='hard' ? 1.30 : 1.22;
      if(bossLevel === 2) return diff==='easy' ? 1.24 : diff==='hard' ? 1.40 : 1.30;
      return diff==='easy' ? 1.34 : diff==='hard' ? 1.52 : 1.40;
    }
    if(phase === 'final') return diff==='easy' ? 1.42 : diff==='hard' ? 1.62 : 1.50;
    return 1.0;
  }
  function phaseBadP(){
    if(phase === 'storm') return diff==='easy' ? 0.38 : diff==='hard' ? 0.56 : 0.46;
    if(phase === 'boss'){
      if(bossLevel === 1) return diff==='easy' ? 0.34 : diff==='hard' ? 0.46 : 0.40;
      if(bossLevel === 2) return diff==='easy' ? 0.38 : diff==='hard' ? 0.52 : 0.44;
      return diff==='easy' ? 0.42 : diff==='hard' ? 0.58 : 0.48;
    }
    if(phase === 'final') return diff==='easy' ? 0.46 : diff==='hard' ? 0.62 : 0.52;
    return 0.22;
  }
  function phaseLightningRate(){
    if(phase === 'storm') return diff==='easy' ? 0.75 : diff==='hard' ? 1.15 : 0.96;
    if(phase === 'boss'){
      if(bossLevel === 1) return diff==='easy' ? 0.82 : diff==='hard' ? 1.18 : 0.96;
      if(bossLevel === 2) return diff==='easy' ? 0.98 : diff==='hard' ? 1.36 : 1.10;
      return diff==='easy' ? 1.12 : diff==='hard' ? 1.58 : 1.26;
    }
    if(phase === 'final') return diff==='easy' ? 1.30 : diff==='hard' ? 1.95 : 1.55;
    return 0;
  }
  function phaseZoneChunk(){
    if(phase === 'storm') return TUNE.zoneChunkStorm;
    if(phase === 'boss'){
      if(bossLevel === 1) return TUNE.zoneChunkBoss1;
      if(bossLevel === 2) return TUNE.zoneChunkBoss2;
      return TUNE.zoneChunkBoss3;
    }
    if(phase === 'final') return TUNE.zoneChunkFinal;
    return 99;
  }

  function startBoss(level){
    phase = 'boss';
    bossLevel = level;
    if(level === 1) boss1Entered = 1;
    if(level === 2) boss2Entered = 1;
    if(level === 3) boss3Entered = 1;
    bossHits = 0;
    bossGoal = level===1 ? TUNE.boss1NeedHits : level===2 ? TUNE.boss2NeedHits : TUNE.boss3NeedHits;
    setStagePhase('boss');
    SFX.setPhaseVolume('boss');
    SFX.phase('boss');
    zoneT = 0;
    needZone = (r01() < 0.5) ? 'L' : 'R';
    lightning();
    phaseBanner(`${emojiFor(diff,'boss',bossLevel)} BOSS ${bossLevel}`);
    toastCoach(`บอส ${level} เริ่มแล้ว! เก็บน้ำต่อเนื่องและหลบฟ้าผ่า`, 300);
    logEvent('phase_enter', { phase:`boss${bossLevel}` });
  }

  function startFinal(){
    phase = 'final';
    finalEntered = 1;
    finalHits = 0;
    finalGoal = TUNE.finalNeedHits;
    setStagePhase('final');
    SFX.setPhaseVolume('final');
    SFX.phase('final');
    zoneT = 0;
    needZone = (r01() < 0.5) ? 'L' : 'R';
    lightning();
    phaseBanner(`${emojiFor(diff,'final')} FINAL BOSS`);
    toastCoach('FINAL BOSS! อย่าพลาด เก็บน้ำต่อเนื่องและดู safe zone', 300);
    logEvent('phase_enter', { phase:'final' });
  }

  function spawnTick(dt){
    if(shield > 0 && r01() < dt*TUNE.shieldDrop){
      shield = Math.max(0, shield - 1);
    }

    if(!stormDone && phase === 'normal' && tLeft <= plannedSec*0.72){
      phase = 'storm';
      stormEntered = 1;
      setStagePhase('storm');
      SFX.setPhaseVolume('storm');
      SFX.phase('storm');
      stormLeft = TUNE.stormSec;
      stormDone = true;
      zoneT = 0;
      needZone = (r01() < 0.5) ? 'L' : 'R';
      lightning();
      phaseBanner(`${emojiFor(diff,'storm')} STORM`);
      toastCoach(`ฟ้าผ่าแล้ว! ไป${needZone==='L'?'ซ้าย':'ขวา'} และต้องมีโล่ 🛡️`, 300);
      logEvent('phase_enter', { phase:'storm' });
    }

    if(phase === 'storm'){
      stormLeft = Math.max(0, stormLeft - dt);
      zoneT += dt;
      if(zoneT >= phaseZoneChunk()){
        zoneT = 0;
        swapZone();
      }
      applyLightningStrike(dt * phaseLightningRate());
      if(stormLeft <= 0) startBoss(1);
    }

    if(phase === 'boss'){
      zoneT += dt;
      if(zoneT >= phaseZoneChunk()){
        zoneT = 0;
        swapZone();
      }
      applyLightningStrike(dt * phaseLightningRate());
    }

    if(phase === 'final'){
      zoneT += dt;
      if(zoneT >= phaseZoneChunk()){
        zoneT = 0;
        swapZone();
      }
      applyLightningStrike(dt * phaseLightningRate());
    }

    spawnAcc += (TUNE.spawnBase * phaseSpawnMul()) * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      const p = r01();
      let kind = 'good';
      const badP = phaseBadP();

      if(phase === 'normal'){
        if(p < 0.64) kind = 'good';
        else if(p < 0.88) kind = 'bad';
        else kind = 'shield';
      }else{
        if(p < (1.0 - badP - 0.08)) kind = 'good';
        else if(p < (1.0 - 0.08)) kind = 'bad';
        else kind = 'shield';
      }

      if(kind === 'good') makeBubble('good', pick(GOOD), TUNE.ttlGood);
      else if(kind === 'shield') makeBubble('shield', pick(SHLD), 2.6);
      else makeBubble('bad', pick(BAD), TUNE.ttlBad);
    }
  }

  function loop(){
    if(!playing) return;

    if(helpOpen){
      setHUD();
      requestAnimationFrame(loop);
      return;
    }

    if(paused){
      lastTick = nowMs();
      setHUD();
      requestAnimationFrame(loop);
      return;
    }

    const t = nowMs();
    const dt = Math.min(0.05, Math.max(0.001, (t - lastTick)/1000));
    lastTick = t;

    if(feverOn){
      feverLeft = Math.max(0, feverLeft - dt);
      if(feverLeft <= 0) stopFever();
    }

    tLeft = Math.max(0, tLeft - dt);
    waterPct = clamp(waterPct - dt*(diff==='hard' ? 1.35 : diff==='easy' ? 0.95 : 1.15), 0, 100);

    spawnTick(dt);
    updateBubbles();

    const risk = buildRisk();
    const features = buildFeatureRow(risk);
    const predictedRisk = predictRiskFromFeatures(features);

    let hint = 'เก็บน้ำ 💧 + หาโล่ 🛡️';
    if(phase === 'storm'){
      hint = `${emojiFor(diff,'storm')} ฟ้าผ่า! ไป ${needZone==='L'?'ซ้าย':'ขวา'} + มีโล่`;
    }else if(phase === 'boss'){
      hint = `${emojiFor(diff,'boss',bossLevel)} บอส ${bossLevel} • ${bossHits}/${bossGoal} • ${needZone==='L'?'ซ้าย':'ขวา'} + โล่`;
    }else if(phase === 'final'){
      hint = `${emojiFor(diff,'final')} FINAL • ${finalHits}/${finalGoal} • ${needZone==='L'?'ซ้าย':'ขวา'} + โล่`;
    }else if(feverOn){
      hint = `🔥 FEVER ACTIVE • รีบเก็บน้ำต่อเนื่อง`;
    }else if(waterPct < 30){
      hint = 'น้ำต่ำ! รีบเก็บ 💧';
    }else if(shield === 0){
      hint = 'หาโล่ 🛡️ ไว้กันฟ้าผ่า';
    }else if(combo >= 10){
      hint = 'คอมโบแรงแล้ว อย่าพลาด!';
    }else if(missGoodExpired >= 3){
      hint = 'เก็บน้ำให้ไวขึ้น อย่าปล่อยหมดเวลา';
    }

    updateTimelineAndFeatures(predictedRisk);
    setAIHud(predictedRisk, hint);
    setHUD();

    if(checkEnd()) return;
    requestAnimationFrame(loop);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(!playing) return;
    if(DOC.hidden){
      paused = true;
      if(ui.pauseOverlay) ui.pauseOverlay.setAttribute('aria-hidden','false');
    }
  });

  WIN.__HYD_DEBUG__ = {
    getState: ()=>({
      sessionId,
      playing, paused, helpOpen,
      phase, bossLevel, bossHits, bossGoal,
      finalHits, finalGoal,
      tLeft, score, waterPct, shield,
      bubbleCount: bubbles.size,
      missBadHit, missGoodExpired,
      lightningHitCount, lightningBlockCount,
      stormEntered, boss1Entered, boss2Entered, boss3Entered, finalEntered, finalCleared,
      feverOn, feverLeft, streakGood,
      events: eventLog.length,
      timeline: riskTimeline.length,
      features: featureRows.length,
      labels: labelRows.length
    })
  };

  SFX.setPhaseVolume('normal');
  helpOpen = false;
  paused = false;
  setHUD();
  requestAnimationFrame(loop);
}