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
    try{ return await res.json(); } catch { return { ok:true }; }
  }
  function buildCsvBundle(summary){
    return {
      summaryCsv: rowsToCsv([summary]),
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

  const sessionId = ['HYD', pid || 'anon', seedStr, Date.now()].join('_');
  const launchUrl = location.href;

  const sessionMeta = {
    sessionId, pid, seed: seedStr, studyId, phaseName, conditionGroup, schoolCode, classRoom,
    game: 'hydration', zone: 'nutrition', runMode, diff, view
  };

  function detectFlowStage(){
    const href = location.href;
    const gatePhase = qs('gatePhase','');
    if(/hydration-vr\/hydration-vr\.html$/i.test(location.pathname)) return 'run';
    if(/herohealth\/hydration-vr\.html$/i.test(location.pathname)) return 'launcher';
    if(/warmup-gate\.html/i.test(href) && gatePhase === 'warmup') return 'warmup-gate';
    if(/warmup-gate\.html/i.test(href) && gatePhase === 'cooldown') return 'cooldown-gate';
    return 'unknown';
  }
  function queryDump(){
    try{
      return Object.fromEntries(new URL(location.href).searchParams.entries());
    }catch(e){
      return {};
    }
  }
  function pathAudit(){
    const dump = queryDump();
    return {
      href: location.href,
      origin: location.origin,
      pathname: location.pathname,
      flowStage: detectFlowStage(),
      pid,
      seed: seedStr,
      view,
      runMode,
      diff,
      plannedSec,
      hubUrl: hubUrl || '../hub.html',
      hasCooldown: cooldownRequired,
      zone: dump.zone || '',
      cat: dump.cat || '',
      gatePhase: dump.gatePhase || '',
      next: dump.next || '',
      query: dump
    };
  }
  function requiredRunParams(){
    return ['pid','view','run','diff','time','seed','hub'];
  }
  function missingRunParams(){
    const u = new URL(location.href);
    return requiredRunParams().filter(k => {
      const v = u.searchParams.get(k);
      return v == null || String(v).trim() === '';
    });
  }
  function selfHealRunQuery(){
    try{
      const u = new URL(location.href);
      let changed = false;
      const setIfMissing = (k, v)=>{
        if(!u.searchParams.get(k) && v != null && String(v).trim() !== ''){
          u.searchParams.set(k, String(v));
          changed = true;
        }
      };

      setIfMissing('pid', pid || 'anon');
      setIfMissing('view', view || 'mobile');
      setIfMissing('run', runMode || 'play');
      setIfMissing('diff', diff || 'normal');
      setIfMissing('time', plannedSec || 80);
      setIfMissing('seed', seedStr || String(Date.now()));
      setIfMissing('hub', hubUrl || '../hub.html');
      setIfMissing('zone', qs('zone','nutrition') || 'nutrition');
      setIfMissing('cat', qs('cat','nutrition') || 'nutrition');

      if(changed){
        location.replace(u.toString());
        return true;
      }
    }catch(e){}
    return false;
  }

  function emojiFor(diffKey, phase, level=0){
    diffKey = String(diffKey || 'normal').toLowerCase();
    const p = String(phase || 'normal').toLowerCase();
    if(p==='storm'){
      if(diffKey==='easy') return '🌦️⚡';
      if(diffKey==='hard') return '🌪️⚡⚡⚡';
      return '🌩️⚡⚡';
    }
    if(p==='boss'){
      if(level===1) return diffKey==='easy' ? '⛈️⚡' : diffKey==='hard' ? '🌀🌩️⚡⚡' : '⛈️🌀⚡';
      if(level===2) return diffKey==='easy' ? '🌩️⚡' : diffKey==='hard' ? '🌪️⚡⚡⚡' : '🌩️⚡⚡';
      if(level===3) return diffKey==='easy' ? '🌪️⚡' : diffKey==='hard' ? '🌀🌪️⚡⚡⚡' : '🌪️⚡⚡';
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
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(_){} }
  function lsRemove(k){ try{ localStorage.removeItem(k); }catch(_){} }

  function cooldownDone(cat, game, who){
    const day=hhDayKey();
    const kNew=`HHA_COOLDOWN_DONE:${cat}:${game}:${who}:${day}`;
    const kOld=`HHA_COOLDOWN_DONE:${cat}:${who}:${day}`;
    return (lsGet(kNew)==='1') || (lsGet(kOld)==='1');
  }
  function passthroughKeys(){
    return [
      'studyId','phase','conditionGroup','api','debug','ai','log',
      'schoolCode','classRoom','zone','cat'
    ];
  }
  function buildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, who }){
    const gate = new URL('../warmup-gate.html', location.href);

    const hubSafe = String(hub || hubUrl || qs('hub','../hub.html') || '../hub.html');
    const nextSafe = String(nextAfterCooldown || hubSafe || '../hub.html');

    gate.searchParams.set('gatePhase', 'cooldown');
    gate.searchParams.set('zone', String(qs('zone','nutrition') || 'nutrition'));
    gate.searchParams.set('cat', String(cat || qs('cat','nutrition') || 'nutrition'));
    gate.searchParams.set('game', String(gameKey || 'hydration'));
    gate.searchParams.set('theme', String(gameKey || 'hydration'));
    gate.searchParams.set('pid', String(who || pid || 'anon'));
    gate.searchParams.set('view', String(view || qs('view','mobile') || 'mobile'));
    gate.searchParams.set('run', String(runMode || qs('run','play') || 'play'));
    gate.searchParams.set('diff', String(diff || qs('diff','normal') || 'normal'));
    gate.searchParams.set('time', String(plannedSec || qs('time','80') || '80'));
    gate.searchParams.set('seed', String(seedStr || qs('seed', String(Date.now()))));
    gate.searchParams.set('hub', hubSafe);
    gate.searchParams.set('next', nextSafe);

    passthroughKeys().forEach(k=>{
      const v = qs(k,'');
      if(v && !gate.searchParams.has(k)) gate.searchParams.set(k, v);
    });

    return gate.toString();
  }
  function buildLauncherUrl(){
    try{
      const u = new URL('../hydration-vr.html', location.href);
      u.searchParams.set('pid', pid);
      u.searchParams.set('view', view);
      u.searchParams.set('run', runMode);
      u.searchParams.set('diff', diff);
      u.searchParams.set('time', String(plannedSec));
      u.searchParams.set('seed', String(seedStr));
      u.searchParams.set('hub', hubUrl || '../hub.html');
      u.searchParams.set('zone', qs('zone','nutrition') || 'nutrition');
      u.searchParams.set('cat', qs('cat','nutrition') || 'nutrition');

      passthroughKeys().forEach(k=>{
        const v = qs(k,'');
        if(v && !u.searchParams.has(k)) u.searchParams.set(k, v);
      });

      return u.toString();
    }catch(e){
      return launchUrl || '../hydration-vr.html';
    }
  }
  function buildRunUrl(){
    try{
      const u = new URL('./hydration-vr.html', location.href);
      u.searchParams.set('pid', pid);
      u.searchParams.set('view', view);
      u.searchParams.set('run', runMode);
      u.searchParams.set('diff', diff);
      u.searchParams.set('time', String(plannedSec));
      u.searchParams.set('seed', String(seedStr));
      u.searchParams.set('hub', hubUrl || '../hub.html');
      u.searchParams.set('zone', qs('zone','nutrition') || 'nutrition');
      u.searchParams.set('cat', qs('cat','nutrition') || 'nutrition');
      u.searchParams.set('cooldown', '1');

      passthroughKeys().forEach(k=>{
        const v = qs(k,'');
        if(v && !u.searchParams.has(k)) u.searchParams.set(k, v);
      });

      return u.toString();
    }catch(e){
      return launchUrl || './hydration-vr.html';
    }
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
    fever: DOC.getElementById('uiFever'),
    stars: DOC.getElementById('uiStars'),
    mission: DOC.getElementById('uiMission'),
    phase: DOC.getElementById('uiPhase'),
    aiRisk: DOC.getElementById('aiRisk'),
    aiHint: DOC.getElementById('aiHint'),
    aiMode: DOC.getElementById('uiAiMode'),
    director: DOC.getElementById('uiDirector'),
    aiTopFactor: DOC.getElementById('aiTopFactor'),
    aiFailSoon: DOC.getElementById('aiFailSoon'),

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
    endStars: DOC.getElementById('endStars'),
    endMissionCount: DOC.getElementById('endMissionCount'),
    endMissionSummary: DOC.getElementById('endMissionSummary'),
    endPhaseSummary: DOC.getElementById('endPhaseSummary'),
    endCoach: DOC.getElementById('endCoach'),
    endReward: DOC.getElementById('endReward'),
    endBadge: DOC.getElementById('endBadge'),

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
  const streakToast = DOC.getElementById('streakToast');

  const SFX = (() => {
    let ctx = null, unlocked = false, enabled = true, volumeMul = 1.0;
    let last = new Map();

    try{
      const saved = lsGet('HHA_SFX_ENABLED');
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
        o.start(); o.stop(c.currentTime + 0.01);
        unlocked = true;
      }catch(e){}
    }
    function setEnabled(v){
      enabled = !!v;
      lsSet('HHA_SFX_ENABLED', enabled ? '1' : '0');
    }
    function isEnabled(){ return enabled; }
    function setPhaseVolume(p){
      if(p==='storm') volumeMul = 0.95;
      else if(p==='boss') volumeMul = 1.00;
      else if(p==='final') volumeMul = 1.08;
      else if(p==='fever') volumeMul = 1.14;
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
      }else if(name==='fever'){
        beep({ f0:620, f1:920, dur:0.14, type:'triangle', vol:0.10 });
        beep({ f0:980, f1:1120, dur:0.10, type:'square', vol:0.08 });
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
      ev.preventDefault(); ev.stopPropagation();
      await SFX.unlock();
      SFX.setEnabled(!SFX.isEnabled());
      refreshSfxBtn();
    });
  }

  const RESEARCH_MODE = runMode === 'research';

  const BASE_TUNE = {
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

  const director = {
    aiMode: RESEARCH_MODE ? 'deterministic' : 'adaptive',
    skill: 0.5,
    tension: 0.5,
    spawnMul: 1.0,
    goodTtlMul: 1.0,
    shieldBias: 0.0,
    comebackBias: 1.0,
    riskBand: 'mid',
    lastUpdateAt: -1,
    profile: 'balanced'
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
  let coachToastLock = 0;

  let comebackCooldown = 0;
  let comebackCount = 0;

  let stars = 0;
  let mission = null;
  let missionDone = false;
  let missionHistory = [];
  let currentMissionKey = '';
  let missionAssignCount = 0;
  let lastMissionCompleteAt = -999;

  let playing = true;
  let paused = false;
  let helpOpen = false;
  let gameEnded = false;

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

  let patternClock = 0;
  let patternState = 'idle';
  let patternBurstLeft = 0;
  let finalRush = false;
  let finalRushAnnounced = false;
  let bossMood = 'normal';
  let bossBurstCooldown = 0;

  let signatureClock = 0;
  let fakeCalmLeft = 0;
  let finisherWindowLeft = 0;
  let finalDoubleStrikeCooldown = 0;
  let forceLaneSwitchCount = 0;

  let telegraphLeft = 0;
  let telegraphKind = '';
  let lanePatternQueue = [];
  let lastSpawnLane = 'C';

  let rewardMedal = '—';
  let rewardTitle = '—';
  let hydrationBadge = null;
  let celebrationLock = false;

  const SNAPSHOT_KEY = `HHA_HYD_SNAPSHOT:${pid}:${seedStr}`;
  let lastAutosaveAt = 0;

  function currentPhaseKey(){
    if(phase === 'boss') return `boss${bossLevel}`;
    return phase;
  }
  function logEvent(type, data={}){
    const item = {
      ts: nowIso(), ms: nowMs(), sessionId, pid, seed: seedStr, studyId, phaseName, conditionGroup,
      game: 'hydration', zone: 'nutrition', type, phase: currentPhaseKey(), ...data
    };
    eventLog.push(item);
    try{ WIN.dispatchEvent(new CustomEvent('hha:event', { detail:item })); }catch(e){}
  }

  function setVrUiVisibility(hidden){
    try{
      DOC.documentElement.classList.toggle('hyd-end-open', !!hidden);
      DOC.body.classList.toggle('hyd-end-open', !!hidden);
    }catch(e){}
    try{
      const selectors = [
        '.vr-ui-root','.vr-ui','.vr-controls','.hha-vr-ui',
        '#btnEnterVR','#btnExitVR','#btnRecenter','#enterVR','#exitVR','#recenter',
        '.a-enter-vr','.a-orientation-modal'
      ];
      selectors.forEach(sel=>{
        DOC.querySelectorAll(sel).forEach(el=>{
          el.style.visibility = hidden ? 'hidden' : '';
          el.style.pointerEvents = hidden ? 'none' : '';
          el.style.opacity = hidden ? '0' : '';
        });
      });
    }catch(e){}
  }
  function focusEndCard(){
    try{
      const card = DOC.querySelector('#end .end-card');
      if(!card) return;
      card.scrollTop = 0;
      card.setAttribute('tabindex', '-1');
      card.focus({ preventScroll:true });
    }catch(e){}
  }

  function setStagePhase(p){
    stageEl?.classList?.toggle('is-storm', p==='storm');
    stageEl?.classList?.toggle('is-boss', p==='boss');
    stageEl?.classList?.toggle('is-final', p==='final');
  }
  function setFeverStage(on){
    stageEl?.classList?.toggle('is-fever', !!on);
    if(ui.fever) ui.fever.textContent = on ? `${Math.ceil(feverLeft)}s` : 'OFF';
  }
  function setCriticalStage(on){
    stageEl?.classList?.toggle('is-critical', !!on);
  }
  function isInNeededZone(){ return (needZone==='L') ? (aimX01 < 0.5) : (aimX01 >= 0.5); }
  function swapZone(){ needZone = (needZone === 'L') ? 'R' : 'L'; }

  function laneX01(lane){
    if(lane === 'L') return 0.24;
    if(lane === 'R') return 0.76;
    return 0.50;
  }
  function queueLanePattern(seq){
    lanePatternQueue = Array.isArray(seq) ? seq.slice() : [];
  }
  function popLaneFromQueue(){
    if(!lanePatternQueue.length) return null;
    return lanePatternQueue.shift();
  }
  function telegraph(kind, sec=0.55){
    telegraphKind = String(kind || '');
    telegraphLeft = Math.max(telegraphLeft, sec);
    logEvent('telegraph', { kind: telegraphKind, sec });
  }
  function lanePatternFor(name){
    if(name === 'good-burst-left') return ['L','L','C'];
    if(name === 'good-burst-right') return ['R','R','C'];
    if(name === 'good-burst-center') return ['L','C','R'];
    if(name === 'bad-wall-left') return ['L','L','L'];
    if(name === 'bad-wall-right') return ['R','R','R'];
    if(name === 'zigzag') return ['L','R','L','R'];
    if(name === 'shield-center') return ['C','C'];
    return [];
  }

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
    if(!ui.helpOverlay){ helpOpen = false; paused = false; return; }
    helpOpen = true; paused = true;
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
    if(!ui.pauseOverlay){ paused = true; return; }
    paused = true; ui.pauseOverlay.setAttribute('aria-hidden','false');
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
    setTimeout(()=> el.remove(), 920);
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
  function showStreakToast(text){
    if(!streakToast) return;
    streakToast.textContent = String(text || '');
    streakToast.setAttribute('aria-hidden','false');
    clearTimeout(WIN.__HYD_STREAK_TIMER__);
    WIN.__HYD_STREAK_TIMER__ = setTimeout(()=>{
      try{ streakToast.setAttribute('aria-hidden','true'); }catch(e){}
    }, 720);
  }
  function toastCoach(msg, minGapMs=1200){
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

  function refreshAiWidgets(topFactor='—', failSoon='—'){
    if(ui.aiMode) ui.aiMode.textContent = director.aiMode === 'adaptive' ? 'ADAPT' : 'DETERMINISTIC';
    if(ui.director) ui.director.textContent = `${director.profile}/${director.riskBand}`;
    if(ui.aiTopFactor) ui.aiTopFactor.textContent = topFactor;
    if(ui.aiFailSoon) ui.aiFailSoon.textContent = failSoon;
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

      if(hudRect && hudRect.height > 0) top = Math.max(top, hudRect.bottom - layerRect.top + 14);
      if(zoneRect && zoneRect.height > 0 && zoneSign && zoneSign.textContent) top = Math.max(top, zoneRect.bottom - layerRect.top + 14);
      if(dockRect && dockRect.height > 0) bottom = Math.max(bottom, layerRect.bottom - dockRect.top + 14);

      _safeTop = Math.round(top);
      _safeBottom = Math.round(bottom);
    }catch(e){}
  }
  function safeSpawnXY(forcedLane=null){
    const r = layer.getBoundingClientRect();
    const padX = (view === 'mobile') ? 22 : 26;
    const yMin = clamp(_safeTop, 18, Math.max(18, r.height - 100));
    const yMax = clamp(r.height - _safeBottom, yMin + 1, r.height - 40);

    let x;
    const lane = forcedLane || popLaneFromQueue();

    if(lane){
      const x01 = laneX01(lane);
      const spread = r.width * 0.08;
      x = clamp(r.width * x01 + (r01()*2 - 1) * spread, padX, r.width - padX);
      lastSpawnLane = lane;
    }else{
      x = padX + r01() * Math.max(1, r.width - padX * 2);
      lastSpawnLane = 'C';
    }

    const y = yMin + r01() * Math.max(1, yMax - yMin);
    return { x, y, lane:lastSpawnLane };
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
    logEvent('spawn', { kind, x:p.x, y:p.y, lane:p.lane, ttlSec:+ttlSec.toFixed(3) });
  }
  function removeBubble(id){
    const b = bubbles.get(String(id));
    if(!b) return;
    bubbles.delete(String(id));
    try{ b.el.remove(); }catch(e){}
  }

  function totalGoodHits(){
    return phaseStats.normal.goodHit + phaseStats.storm.goodHit + phaseStats.boss1.goodHit + phaseStats.boss2.goodHit + phaseStats.boss3.goodHit + phaseStats.final.goodHit;
  }
  function uniqueMissionKeys(){
    return Array.from(new Set(missionHistory));
  }
  function missionSummaryText(){
    if(!missionHistory.length) return 'ยังไม่สำเร็จภารกิจ';
    return uniqueMissionKeys().join(', ');
  }
  function phaseSummaryText(){
    const arr = [];
    if(stormEntered) arr.push('Storm');
    if(boss1Entered) arr.push('Boss1');
    if(boss2Entered) arr.push('Boss2');
    if(boss3Entered) arr.push('Boss3');
    if(finalEntered) arr.push('Final');
    if(finalCleared) arr.push('Clear');
    return arr.length ? arr.join(' → ') : 'Normal only';
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
  function buildRiskFactors(){
    const missPressure = (missBadHit / Math.max(1, BASE_TUNE.missLimit));
    const expirePressure = clamp(missGoodExpired / 25, 0, 1);
    const lowWater = (waterPct < 35) ? (35 - waterPct) / 35 : 0;
    const noShieldStorm = ((phase==='storm' || phase==='boss' || phase==='final') && shield===0) ? 0.20 : 0;
    const wrongZonePenalty = ((phase==='storm' || phase==='boss' || phase==='final') && !isInNeededZone()) ? 0.12 : 0;
    const raw = clamp(missPressure*0.40 + lowWater*0.28 + expirePressure*0.10 + noShieldStorm + wrongZonePenalty, 0, 1);

    const factors = [
      { key:'miss_pressure', score: missPressure*0.40, label:'โดนของไม่ดี' },
      { key:'low_water', score: lowWater*0.28, label:'น้ำต่ำ' },
      { key:'expire_pressure', score: expirePressure*0.10, label:'เก็บน้ำไม่ทัน' },
      { key:'no_shield', score: noShieldStorm, label:'ไม่มีโล่' },
      { key:'wrong_zone', score: wrongZonePenalty, label:'อยู่ผิดฝั่ง' },
    ].sort((a,b)=> b.score - a.score);

    return { raw, factors };
  }
  function buildRisk(){ return buildRiskFactors().raw; }
  function explainRisk(risk){
    const factors = buildRiskFactors().factors.filter(f => f.score > 0.05).slice(0,2);
    if(!factors.length){
      if(risk < 0.25) return 'ปลอดภัยดี เล่นต่อได้';
      if(risk < 0.5) return 'เสี่ยงปานกลาง ระวังจังหวะ';
      return 'เริ่มเสี่ยง คุมโล่และน้ำให้ดี';
    }
    return `เสี่ยง: ${factors.map(f=>f.label).join(' + ')}`;
  }
  function aiCoachMessage(pred){
    const top = pred.topFactor;
    if(top === 'น้ำต่ำ') return 'น้ำกำลังต่ำ รีบเก็บ 💧 ก่อน';
    if(top === 'ไม่มีโล่') return 'ต้องหาโล่ 🛡️ ทันที';
    if(top === 'อยู่ผิดฝั่ง') return `ย้ายไป${needZone==='L'?'ซ้าย':'ขวา'}เดี๋ยวนี้`;
    if(top === 'โดนของไม่ดี') return 'คุมเป้าให้นิ่งขึ้น เลี่ยงของไม่ดี';
    if(top === 'เก็บน้ำไม่ทัน') return 'เร่งจังหวะเก็บน้ำให้ไวขึ้น';
    return 'เล่นต่อได้ดี รักษาจังหวะไว้';
  }
  function buildAIPrediction(features){
    const factors = buildRiskFactors();
    const topFactor = factors.factors[0]?.label || '—';
    const risk = factors.raw;
    const failSoon = predictFailSoon(features) ? 'YES' : 'NO';

    return {
      risk,
      failSoon,
      topFactor,
      explain: aiCoachMessage({ topFactor }),
      confidence: clamp(0.55 + Math.abs(risk - 0.5)*0.5, 0.55, 0.98)
    };
  }

  function bossProfile(){
    if(phase !== 'boss' && phase !== 'final'){
      return { badBias:0, lightningMul:1, swapMul:1, shieldBias:0, label:'NORMAL' };
    }
    if(phase === 'boss' && bossLevel === 1){
      return { badBias:-0.04, lightningMul:0.92, swapMul:1.00, shieldBias:0.03, label:'LEARN THE RULE' };
    }
    if(phase === 'boss' && bossLevel === 2){
      return { badBias:0.02, lightningMul:1.05, swapMul:1.15, shieldBias:0.00, label:'PRESSURE BUILDER' };
    }
    if(phase === 'boss' && bossLevel === 3){
      return { badBias:0.06, lightningMul:1.18, swapMul:1.28, shieldBias:-0.02, label:'CHAOS CONTROL' };
    }
    if(phase === 'final'){
      return { badBias:0.10, lightningMul:1.35, swapMul:1.35, shieldBias:-0.03, label:'BURST FINISH' };
    }
    return { badBias:0, lightningMul:1, swapMul:1, shieldBias:0, label:'NORMAL' };
  }
  function currentBossMood(){
    if(phase !== 'boss' && phase !== 'final') return 'normal';
    if(phase === 'boss' && bossLevel === 1) return 'teach';
    if(phase === 'boss' && bossLevel === 2) return 'press';
    if(phase === 'boss' && bossLevel === 3) return 'chaos';
    if(phase === 'final') return 'last-stand';
    return 'normal';
  }
  function inFakeCalm(){ return fakeCalmLeft > 0; }
  function inFinisherWindow(){ return finisherWindowLeft > 0; }
  function isLateGame(){ return tLeft <= Math.max(12, plannedSec * 0.22); }
  function isNearFinalClear(){ return phase === 'final' && (finalGoal - finalHits) <= 4; }
  function maybeEnterFinalRush(){
    if(finalRush) return;
    if(phase === 'final' && (tLeft <= Math.max(14, plannedSec * 0.18) || (finalGoal - finalHits) <= 7)){
      finalRush = true;
      if(!finalRushAnnounced){
        finalRushAnnounced = true;
        showStreakToast('🔥 FINAL RUSH!');
        fxPhaseBanner('🔥 FINAL RUSH!');
        toastCoach('ช่วงสุดท้ายแล้ว! เร่งเก็บน้ำและคุมโล่!', 300);
        logEvent('final_rush_start', { tLeft, finalHits, finalGoal });
      }
    }
  }
  function comboMilestoneToast(){
    if(combo === 5) showStreakToast('NICE!');
    else if(combo === 8) showStreakToast('HOT STREAK!');
    else if(combo === 12) showStreakToast('UNSTOPPABLE!');
    else if(combo === 16) showStreakToast('DOMINATING!');
    else if(combo === 20) showStreakToast('LEGENDARY!');
  }

  function patternSpawnSet(kind){
    if(kind === 'good-burst'){
      const side = r01() < 0.5 ? 'left' : 'right';
      queueLanePattern(side === 'left' ? lanePatternFor('good-burst-left') : lanePatternFor('good-burst-right'));
      makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul + 0.25);
      makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul + 0.15);
      if(r01() < 0.60) makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul + 0.10);
      logEvent('pattern_spawn', { pattern:'good-burst', side });
      return;
    }
    if(kind === 'bad-wall'){
      const side = r01() < 0.5 ? 'left' : 'right';
      queueLanePattern(side === 'left' ? lanePatternFor('bad-wall-left') : lanePatternFor('bad-wall-right'));
      makeBubble('bad', pick(BAD), BASE_TUNE.ttlBad);
      makeBubble('bad', pick(BAD), BASE_TUNE.ttlBad);
      if(r01() < 0.55) makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul);
      logEvent('pattern_spawn', { pattern:'bad-wall', side });
      return;
    }
    if(kind === 'shield-rescue'){
      queueLanePattern(lanePatternFor('shield-center'));
      if(shield === 0) makeBubble('shield', pick(SHLD), 2.7);
      makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul + 0.20);
      if(r01() < 0.70) makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul + 0.05);
      logEvent('pattern_spawn', { pattern:'shield-rescue' });
      return;
    }
    if(kind === 'storm-zigzag'){
      queueLanePattern(lanePatternFor('zigzag'));
      makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul);
      makeBubble('bad', pick(BAD), BASE_TUNE.ttlBad);
      if(r01() < 0.45) makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul);
      logEvent('pattern_spawn', { pattern:'storm-zigzag' });
      return;
    }
  }

  function updateDirector(predictedRisk){
    const playedSec = Math.round(plannedSec - tLeft);
    if(playedSec === director.lastUpdateAt) return;
    director.lastUpdateAt = playedSec;

    const accLike = clamp(totalGoodHits() / Math.max(1, totalGoodHits() + missBadHit + missGoodExpired), 0, 1);
    const comboLike = clamp(bestCombo / 15, 0, 1);
    const survivalLike = clamp((waterPct / 100), 0, 1);

    director.skill = clamp(accLike*0.45 + comboLike*0.35 + survivalLike*0.20, 0, 1);
    director.tension = clamp(predictedRisk*0.65 + ((phase==='storm'||phase==='boss'||phase==='final') ? 0.20 : 0), 0, 1);

    if(predictedRisk < 0.28) director.riskBand = 'low';
    else if(predictedRisk < 0.60) director.riskBand = 'mid';
    else director.riskBand = 'high';

    if(director.skill >= 0.72) director.profile = 'aggressive';
    else if(director.skill <= 0.38) director.profile = 'assist';
    else director.profile = 'balanced';

    if(RESEARCH_MODE){
      director.spawnMul = 1.0;
      director.goodTtlMul = 1.0;
      director.shieldBias = 0.0;
      director.comebackBias = 1.0;
      return;
    }

    if(director.profile === 'assist'){
      director.spawnMul = 0.92;
      director.goodTtlMul = 1.10;
      director.shieldBias = 0.03;
      director.comebackBias = 1.18;
    }else if(director.profile === 'aggressive'){
      director.spawnMul = 1.10;
      director.goodTtlMul = 0.92;
      director.shieldBias = -0.02;
      director.comebackBias = 0.86;
    }else{
      director.spawnMul = 1.0;
      director.goodTtlMul = 1.0;
      director.shieldBias = 0.0;
      director.comebackBias = 1.0;
    }

    if(director.riskBand === 'high'){
      director.spawnMul *= 0.95;
      director.goodTtlMul *= 1.06;
      director.shieldBias += 0.02;
      director.comebackBias *= 1.08;
    }else if(director.riskBand === 'low'){
      director.spawnMul *= 1.03;
      director.goodTtlMul *= 0.97;
    }

    director.spawnMul = clamp(director.spawnMul, 0.86, 1.16);
    director.goodTtlMul = clamp(director.goodTtlMul, 0.88, 1.18);
    director.shieldBias = clamp(director.shieldBias, -0.04, 0.05);
    director.comebackBias = clamp(director.comebackBias, 0.80, 1.25);
  }

  function nextMission(){
    const playedSec = Math.round(plannedSec - tLeft);
    const pool = [];
    pool.push({ key:'combo6', text:'คอมโบให้ถึง 6', check:()=> combo >= 6, reward:()=>{ score += 25; } });
    pool.push({ key:'shield2', text:'เก็บโล่ให้ครบ 2', check:()=> shield >= 2, reward:()=>{ score += 20; } });
    pool.push({ key:'block1', text:'กันฟ้าผ่า 1 ครั้ง', check:()=> lightningBlockCount >= 1, reward:()=>{ waterPct = clamp(waterPct + 8, 0, 100); } });
    pool.push({ key:'good8', text:'เก็บน้ำรวม 8 ครั้ง', check:()=> totalGoodHits() >= 8, reward:()=>{ score += 30; } });
    if(!stormEntered) pool.push({ key:'stormReach', text:'ไปให้ถึง STORM', check:()=> stormEntered === 1, reward:()=>{ score += 18; } });
    if(!eventLog.some(e=>e.type==='fever_start')) pool.push({ key:'fever1', text:'เข้า FEVER 1 ครั้ง', check:()=> eventLog.some(e=>e.type==='fever_start'), reward:()=>{ score += 26; } });
    if(!boss1Entered) pool.push({ key:'boss1reach', text:'ไปให้ถึง BOSS 1', check:()=> boss1Entered === 1, reward:()=>{ score += 22; } });
    if(playedSec > 20) pool.push({ key:'water50', text:'รักษาน้ำให้ถึง 50%', check:()=> waterPct >= 50, reward:()=>{ score += 16; } });
    if(playedSec > 28) pool.push({ key:'lowMiss', text:'คุม miss ไม่เกิน 2', check:()=> missBadHit <= 2 && playedSec >= 36, reward:()=>{ score += 22; } });
    if(playedSec > 35) pool.push({ key:'survive60', text:'เอาตัวรอดถึงช่วงท้าย', check:()=> tLeft <= plannedSec * 0.25, reward:()=>{ score += 20; } });

    const recentBan = missionHistory.slice(-2);
    const available = pool.filter(m => !recentBan.includes(m.key));
    const source = available.length ? available : pool;

    mission = source[(r01()*source.length)|0];
    missionDone = false;
    currentMissionKey = mission.key;
    missionAssignCount++;
    if(ui.mission) ui.mission.textContent = mission.text;
    logEvent('mission_assign', { missionKey: mission.key, missionText: mission.text });
  }
  function resolveMission(){
    if(!mission || missionDone) return;
    if(!mission.check()) return;

    missionDone = true;
    stars++;
    missionHistory.push(mission.key);
    lastMissionCompleteAt = Math.round(plannedSec - tLeft);

    try{ mission.reward(); }catch(e){}

    if(ui.stars) ui.stars.textContent = String(stars);
    showStreakToast('🎯 MISSION CLEAR');
    fxPhaseBanner('⭐ MISSION CLEAR');
    toastCoach('ภารกิจสำเร็จ! โบนัสมาแล้ว', 300);
    logEvent('mission_clear', { missionKey: mission.key, stars });

    setTimeout(()=>{
      if(playing) nextMission();
    }, 1200);
  }

  function predictFailSoon(features){
    return (features.waterPct < 18 || (features.inDangerPhase && features.shield === 0 && !features.inCorrectZone)) ? 1 : 0;
  }

  function updatePatternDirector(dt){
    patternClock += dt;
    bossMood = currentBossMood();

    if(bossBurstCooldown > 0) bossBurstCooldown = Math.max(0, bossBurstCooldown - dt);

    if(phase === 'normal'){
      if(patternClock >= 7.5){
        patternClock = 0;
        if(buildRisk() < 0.45 && r01() < 0.70){
          patternState = 'good-burst';
          patternBurstLeft = 1.2;
        }else if(buildRisk() >= 0.45 && r01() < 0.55){
          patternState = 'shield-rescue';
          patternBurstLeft = 1.0;
        }else{
          patternState = 'idle';
        }
      }
      return;
    }

    if(phase === 'storm'){
      if(patternClock >= 5.2){
        patternClock = 0;
        patternState = r01() < 0.55 ? 'storm-zigzag' : 'bad-wall';
        patternBurstLeft = 1.1;
      }
      return;
    }

    if(phase === 'boss'){
      if(bossMood === 'teach' && patternClock >= 5.0){
        patternClock = 0;
        patternState = r01() < 0.65 ? 'good-burst' : 'shield-rescue';
        patternBurstLeft = 1.0;
      }else if(bossMood === 'press' && patternClock >= 4.3){
        patternClock = 0;
        patternState = r01() < 0.55 ? 'bad-wall' : 'storm-zigzag';
        patternBurstLeft = 1.2;
      }else if(bossMood === 'chaos' && patternClock >= 3.6){
        patternClock = 0;
        patternState = pick(['bad-wall','storm-zigzag','good-burst']);
        patternBurstLeft = 1.25;
      }
      return;
    }

    if(phase === 'final'){
      if(patternClock >= (finalRush ? 2.6 : 3.8)){
        patternClock = 0;
        patternState = finalRush
          ? pick(['bad-wall','storm-zigzag','good-burst','good-burst','storm-zigzag'])
          : pick(['storm-zigzag','bad-wall','shield-rescue','good-burst']);
        patternBurstLeft = finalRush ? 1.55 : 1.15;
      }
    }
  }

  function startFakeCalm(sec = 1.6){
    fakeCalmLeft = sec;
    telegraph('fake-calm', 0.7);
    showStreakToast('…CALM?');
    toastCoach('บอสดูเงียบลง ระวัง burst ต่อไป!', 500);
    logEvent('boss_fake_calm_start', { sec, bossLevel, phase });
  }
  function startFinisherWindow(sec = 2.4){
    finisherWindowLeft = sec;
    telegraph('finisher', 0.5);
    showStreakToast('✨ FINISHER WINDOW!');
    fxPhaseBanner('✨ FINISHER WINDOW!');
    toastCoach('จังหวะปิดเกมมาแล้ว! โกย good hit เดี๋ยวนี้', 300);
    logEvent('boss_finisher_window_start', { sec, finalHits, finalGoal });
  }
  function forceLaneSwitch(times = 2){
    forceLaneSwitchCount = Math.max(forceLaneSwitchCount, times);
    logEvent('boss_force_lane_switch', { times, phase, bossLevel });
  }
  function bossSignatureName(){
    if(phase === 'boss' && bossLevel === 1) return 'teach-storm';
    if(phase === 'boss' && bossLevel === 2) return 'switch-pressure';
    if(phase === 'boss' && bossLevel === 3) return 'fake-calm-burst';
    if(phase === 'final') return 'double-strike-finisher';
    return 'none';
  }

  function updateBossSignature(dt){
    signatureClock += dt;

    if(fakeCalmLeft > 0) fakeCalmLeft = Math.max(0, fakeCalmLeft - dt);
    if(finisherWindowLeft > 0) finisherWindowLeft = Math.max(0, finisherWindowLeft - dt);
    if(finalDoubleStrikeCooldown > 0) finalDoubleStrikeCooldown = Math.max(0, finalDoubleStrikeCooldown - dt);

    if(phase !== 'boss' && phase !== 'final') return;

    if(phase === 'boss' && bossLevel === 1){
      if(signatureClock >= 6.0){
        signatureClock = 0;
        patternState = r01() < 0.70 ? 'good-burst' : 'shield-rescue';
        patternBurstLeft = 1.0;
        toastCoach('Boss 1: ฝึกอ่าน safe zone แล้วเก็บ good burst', 700);
        logEvent('boss_signature', { name:'teach-storm' });
      }
      return;
    }

    if(phase === 'boss' && bossLevel === 2){
      if(signatureClock >= 5.0){
        signatureClock = 0;
        telegraph('switch-pressure', 0.6);
        forceLaneSwitch(2 + (r01() < 0.5 ? 1 : 0));
        patternState = 'bad-wall';
        patternBurstLeft = 1.15;
        showStreakToast('↔ SWITCH!');
        toastCoach('Boss 2: เปลี่ยนฝั่งเร็ว!', 700);
        logEvent('boss_signature', { name:'switch-pressure' });
      }
      return;
    }

    if(phase === 'boss' && bossLevel === 3){
      if(signatureClock >= 5.8){
        signatureClock = 0;
        startFakeCalm(1.4);
        bossBurstCooldown = 1.4;
        logEvent('boss_signature', { name:'fake-calm-prep' });
      }

      if(bossBurstCooldown <= 0 && fakeCalmLeft <= 0 && r01() < dt * 1.4){
        telegraph('burst', 0.35);
        bossBurstCooldown = 999;
        patternState = pick(['bad-wall','storm-zigzag','bad-wall']);
        patternBurstLeft = 1.45;
        showStreakToast('💥 BURST!');
        fxPhaseBanner('💥 BURST!');
        toastCoach('Boss 3: หลุด calm แล้ว burst มาแรง!', 400);
        logEvent('boss_signature', { name:'fake-calm-burst' });
      }
      return;
    }

    if(phase === 'final'){
      if(finalDoubleStrikeCooldown <= 0 && r01() < dt * (finalRush ? 0.95 : 0.55)){
        telegraph('double-strike', 0.45);
        finalDoubleStrikeCooldown = finalRush ? 2.8 : 4.0;
        logEvent('boss_signature', { name:'double-strike' });
        showStreakToast('⚡⚡ DOUBLE STRIKE!');
        toastCoach('Final Boss: ฟ้าผ่าคู่!', 400);
        setTimeout(()=>{ if(playing && phase === 'final') applyLightningStrike(999); }, 0);
        setTimeout(()=>{ if(playing && phase === 'final') applyLightningStrike(999); }, finalRush ? 260 : 420);
      }

      const hitsLeft = Math.max(0, finalGoal - finalHits);
      if(hitsLeft <= 5 && finisherWindowLeft <= 0){
        startFinisherWindow(2.6);
        logEvent('boss_signature', { name:'finisher-window' });
      }
    }
  }

  function shouldTriggerComeback(){
    if(!playing || paused) return false;
    if(phase === 'final') return false;
    if(comebackCooldown > 0) return false;
    if(waterPct > 18) return false;
    if(combo > 0) return false;
    const baseChance = 0.18 * director.comebackBias;
    if(r01() > clamp(baseChance, 0.10, 0.28)) return false;
    return true;
  }
  function triggerComebackSet(){
    comebackCooldown = 7.5;
    comebackCount++;
    makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul + 0.25);
    if(r01() < 0.60) makeBubble('good', pick(GOOD), BASE_TUNE.ttlGood * director.goodTtlMul + 0.25);
    if(shield === 0 && r01() < clamp(0.45 + director.shieldBias, 0.18, 0.65)) makeBubble('shield', pick(SHLD), 2.8);
    showStreakToast('💧 COMEBACK');
    toastCoach('โอกาสกลับมาแล้ว! รีบเก็บน้ำ', 500);
    logEvent('comeback_spawn', { comebackCount, waterPct, shield, comebackBias:+director.comebackBias.toFixed(3) });
  }

  function phaseSpawnMul(){
    if(inFakeCalm()) return 0.55;
    if(inFinisherWindow()) return (phase === 'final' ? 1.30 : 1.12);

    const bp = bossProfile();
    if(feverOn && phase === 'normal') return 1.10 * director.spawnMul;
    if(phase === 'storm') return (diff==='easy' ? 1.24 : diff==='hard' ? 1.52 : 1.34) * director.spawnMul;
    if(phase === 'boss'){
      if(bossLevel === 1) return (diff==='easy' ? 1.16 : diff==='hard' ? 1.30 : 1.22) * director.spawnMul;
      if(bossLevel === 2) return (diff==='easy' ? 1.24 : diff==='hard' ? 1.40 : 1.30) * director.spawnMul;
      if(bossLevel === 3) return (diff==='easy' ? 1.34 : diff==='hard' ? 1.52 : 1.40) * director.spawnMul;
    }
    if(phase === 'final') return (diff==='easy' ? 1.42 : diff==='hard' ? 1.62 : 1.50) * director.spawnMul;
    return (1.0 + (bp.badBias * 0.2)) * director.spawnMul;
  }
  function phaseBadP(){
    const bp = bossProfile();
    let base;
    if(phase === 'storm') base = diff==='easy' ? 0.38 : diff==='hard' ? 0.56 : 0.46;
    else if(phase === 'boss'){
      if(bossLevel === 1) base = diff==='easy' ? 0.34 : diff==='hard' ? 0.46 : 0.40;
      else if(bossLevel === 2) base = diff==='easy' ? 0.38 : diff==='hard' ? 0.52 : 0.44;
      else base = diff==='easy' ? 0.42 : diff==='hard' ? 0.58 : 0.48;
    }else if(phase === 'final'){
      base = diff==='easy' ? 0.46 : diff==='hard' ? 0.62 : 0.52;
    }else{
      base = 0.22;
    }
    if(feverOn && phase === 'normal') base = Math.max(0.12, base - 0.06);
    return clamp(base + bp.badBias, 0.08, 0.82);
  }
  function phaseLightningRate(){
    const bp = bossProfile();
    let base;
    if(phase === 'storm') base = diff==='easy' ? 0.75 : diff==='hard' ? 1.15 : 0.96;
    else if(phase === 'boss'){
      if(bossLevel === 1) base = diff==='easy' ? 0.82 : diff==='hard' ? 1.18 : 0.96;
      else if(bossLevel === 2) base = diff==='easy' ? 0.98 : diff==='hard' ? 1.36 : 1.10;
      else base = diff==='easy' ? 1.12 : diff==='hard' ? 1.58 : 1.26;
    }else if(phase === 'final'){
      base = diff==='easy' ? 1.30 : diff==='hard' ? 1.95 : 1.55;
    }else{
      base = 0;
    }
    return base * bp.lightningMul;
  }
  function phaseZoneChunk(){
    const bp = bossProfile();
    let base;
    if(phase === 'storm') base = BASE_TUNE.zoneChunkStorm;
    else if(phase === 'boss'){
      if(bossLevel === 1) base = BASE_TUNE.zoneChunkBoss1;
      else if(bossLevel === 2) base = BASE_TUNE.zoneChunkBoss2;
      else base = BASE_TUNE.zoneChunkBoss3;
    }else if(phase === 'final'){
      base = BASE_TUNE.zoneChunkFinal;
    }else{
      base = 99;
    }
    return base / Math.max(0.75, bp.swapMul);
  }

  function startFever(sec=5.5){
    feverOn = true;
    feverLeft = Math.max(feverLeft, sec);
    setFeverStage(true);
    SFX.setPhaseVolume('fever');
    SFX.phase('fever');
    showStreakToast('🔥 FEVER!');
    fxPhaseBanner('🔥 FEVER!');
    toastCoach('เข้า FEVER แล้ว! โกยคะแนนเลย', 200);
    logEvent('fever_start', { sec });
  }
  function stopFever(){
    if(!feverOn) return;
    feverOn = false;
    feverLeft = 0;
    setFeverStage(false);
    SFX.setPhaseVolume(phase === 'final' ? 'final' : phase === 'boss' ? 'boss' : phase === 'storm' ? 'storm' : 'normal');
    if(ui.fever) ui.fever.textContent = 'OFF';
    logEvent('fever_end', {});
  }

  function startBoss(level){
    phase = 'boss';
    bossLevel = level;
    if(level === 1) boss1Entered = 1;
    if(level === 2) boss2Entered = 1;
    if(level === 3) boss3Entered = 1;
    bossHits = 0;
    bossGoal = level===1 ? BASE_TUNE.boss1NeedHits : level===2 ? BASE_TUNE.boss2NeedHits : BASE_TUNE.boss3NeedHits;
    setStagePhase('boss');
    SFX.setPhaseVolume('boss');
    SFX.phase('boss');
    zoneT = 0;
    needZone = (r01() < 0.5) ? 'L' : 'R';
    lightning();
    fxPhaseBanner(`${emojiFor(diff,'boss',bossLevel)} BOSS ${bossLevel}`);
    toastCoach(`บอส ${level} • ${bossProfile().label}`, 300);
    logEvent('phase_enter', { phase:`boss${bossLevel}` });
    resolveMission();
  }

  function calcRewardPack(summary){
    const grade = String(summary.grade || 'D').toUpperCase();
    let medal = '🥉';
    let title = 'Hydration Rookie';
    if(grade === 'S'){ medal = '👑'; title = 'Hydration Storm Master'; }
    else if(grade === 'A'){ medal = '🏆'; title = 'Hydration Elite'; }
    else if(grade === 'B'){ medal = '🥈'; title = 'Hydration Defender'; }

    let badge = null;
    if(summary.finalCleared){
      badge = { key:'final_clear', icon:'⚡', label:'Storm Conqueror' };
    }else if(summary.lightningBlockCount >= 3){
      badge = { key:'lightning_guard', icon:'🛡️', label:'Lightning Guard' };
    }else if(summary.comboMax >= 15){
      badge = { key:'combo_surge', icon:'🔥', label:'Combo Surge' };
    }else if(summary.starsEarned >= 3){
      badge = { key:'mission_star', icon:'⭐', label:'Mission Star' };
    }
    return { medal, title, badge };
  }
  function saveHydrationReward(summary){
    const reward = calcRewardPack(summary);
    try{
      lsSet(`HYD_LAST_REWARD:${pid}`, JSON.stringify({
        pid,
        sessionId,
        medal: reward.medal,
        title: reward.title,
        badge: reward.badge,
        scoreFinal: summary.scoreFinal,
        grade: summary.grade,
        finalCleared: summary.finalCleared ? 1 : 0,
        ts: new Date().toISOString()
      }));
    }catch(e){}

    if(reward.badge){
      try{
        const key = `HYD_BADGES:${pid}`;
        let bag = {};
        try{ bag = JSON.parse(lsGet(key) || '{}') || {}; }catch(e){ bag = {}; }
        bag[reward.badge.key] = {
          icon: reward.badge.icon,
          label: reward.badge.label,
          ts: new Date().toISOString(),
          sessionId
        };
        lsSet(key, JSON.stringify(bag));
      }catch(e){}
    }

    rewardMedal = reward.medal;
    rewardTitle = reward.title;
    hydrationBadge = reward.badge;
  }
  function saveHydrationHubProfile(summary){
    try{
      const key = `HYD_PROFILE:${pid}`;
      let prev = {};
      try{ prev = JSON.parse(lsGet(key) || '{}') || {}; }catch(e){ prev = {}; }

      const bestScore = Math.max(Number(prev.bestScore || 0), Number(summary.scoreFinal || 0));
      const totalRuns = Number(prev.totalRuns || 0) + 1;
      const finalClearCount = Number(prev.finalClearCount || 0) + (summary.finalCleared ? 1 : 0);
      const bestCombo = Math.max(Number(prev.bestCombo || 0), Number(summary.comboMax || 0));
      const bestStars = Math.max(Number(prev.bestStars || 0), Number(summary.starsEarned || 0));

      const data = {
        pid,
        game:'hydration',
        bestScore,
        totalRuns,
        finalClearCount,
        bestCombo,
        bestStars,
        lastScore: Number(summary.scoreFinal || 0),
        lastGrade: String(summary.grade || 'D'),
        lastMedal: rewardMedal || '—',
        lastTitle: rewardTitle || '—',
        lastBadge: hydrationBadge || null,
        lastFinalClear: summary.finalCleared ? 1 : 0,
        updatedAt: new Date().toISOString()
      };
      lsSet(key, JSON.stringify(data));
    }catch(e){}
  }

  function celebrateFinalClear(){
    if(celebrationLock) return;
    celebrationLock = true;
    const texts = ['🏆 FINAL CLEAR!', '⚡ STORM MASTER!', '💧 HEROHEALTH!'];
    texts.forEach((txt, i)=>{
      setTimeout(()=>{
        try{
          fxPhaseBanner(txt);
          showStreakToast(txt);
          SFX.phase('final');
        }catch(e){}
      }, i * 260);
    });
    setTimeout(()=>{ celebrationLock = false; }, 1500);
  }
  function celebrateBossDefeat(level){
    const txt = level === 1 ? '⚔️ BOSS 1 DOWN!' : level === 2 ? '⚔️ BOSS 2 DOWN!' : level === 3 ? '⚔️ BOSS 3 DOWN!' : '⚔️ BOSS DOWN!';
    fxPhaseBanner(txt);
    showStreakToast(txt);
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
        showStreakToast(finalRush ? '⚡ HERO BLOCK!' : '⚡ PERFECT BLOCK');
        fxScore(120, 230, finalRush ? 'HERO BLOCK⚡' : 'BLOCK⚡');
        toastCoach('กันฟ้าผ่าสำเร็จ! ดีมาก', 500);
        logEvent('lightning_block', { shield });
        resolveMission();
      }else{
        streakGood = 0;
        stopFever();
        combo = 0;
        waterPct = clamp(waterPct - BASE_TUNE.lightningDmgWater, 0, 100);
        score = Math.max(0, score - BASE_TUNE.lightningDmgScore);
        lightningHitCount++;
        phaseStats[currentPhaseKey()].lightningHit++;
        SFX.bad();
        fxScore(120, 230, `-${BASE_TUNE.lightningDmgScore}⚡`);
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

      if(streakGood >= 8 && !feverOn) startFever(5.5);

      comboMilestoneToast();

      const comboTier = combo>=18 ? 4 : combo>=12 ? 3 : combo>=7 ? 2 : 1;
      const feverMul = feverOn ? 1.35 : 1.0;
      const rushMul = finalRush ? 1.12 : 1.0;
      const nearClearMul = isNearFinalClear() ? 1.18 : 1.0;
      const windowMul = inFinisherWindow() ? 1.22 : 1.0;
      const add = Math.round((9 + Math.min(14, combo)) * comboTier * feverMul * rushMul * nearClearMul * windowMul);

      score += add;
      waterPct = clamp(waterPct + BASE_TUNE.waterGain + (feverOn ? 1.0 : 0), 0, 100);
      phaseStats[pk].goodHit++;

      SFX.pop();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, `+${add}${feverOn ? ' 🔥' : ''}${finalRush ? ' ⚡' : ''}`);
      logEvent('good_hit', { scoreAdd:add, combo, waterPct });

      if(phase === 'boss'){
        bossHits++;
        fxScore(bx, by-12, `${bossHits}/${bossGoal}`);

        if(bossHits >= bossGoal){
          celebrateBossDefeat(bossLevel);

          if(bossLevel < 3){
            bossLevel++;
            if(bossLevel === 2) boss2Entered = 1;
            if(bossLevel === 3) boss3Entered = 1;
            bossHits = 0;
            bossGoal = bossLevel===2 ? BASE_TUNE.boss2NeedHits : BASE_TUNE.boss3NeedHits;
            SFX.setPhaseVolume('boss');
            SFX.phase('boss');
            needZone = (r01() < 0.5) ? 'L' : 'R';
            zoneT = 0;
            fxPhaseBanner(`${emojiFor(diff,'boss',bossLevel)} BOSS ${bossLevel}`);
            toastCoach(`บอส ${bossLevel} • ${bossProfile().label}`, 300);
            logEvent('phase_enter', { phase:`boss${bossLevel}` });
          }else{
            celebrateBossDefeat(3);
            phase = 'final';
            finalEntered = 1;
            bossHits = 0;
            finalHits = 0;
            finalGoal = BASE_TUNE.finalNeedHits;
            setStagePhase('final');
            SFX.setPhaseVolume('final');
            SFX.phase('final');
            zoneT = 0;
            needZone = (r01() < 0.5) ? 'L' : 'R';
            fxPhaseBanner(`${emojiFor(diff,'final')} FINAL BOSS`);
            toastCoach('FINAL BOSS • BURST FINISH', 300);
            logEvent('phase_enter', { phase:'final' });
          }
        }
      }else if(phase === 'final'){
        finalHits++;
        const leftHits = Math.max(0, finalGoal - finalHits);
        fxScore(bx, by-12, `${finalHits}/${finalGoal}`);

        if(leftHits === 5) showStreakToast('5 LEFT!');
        if(leftHits === 3){
          showStreakToast('3 LEFT!');
          toastCoach('อีก 3 hit เท่านั้น!', 300);
        }
        if(leftHits === 1){
          showStreakToast('⚡ LAST HIT!');
          fxPhaseBanner('⚡ LAST HIT!');
          toastCoach('ปิดมันเลย!', 250);
        }

        if(finalHits >= finalGoal){
          showEnd('final-clear');
          return;
        }
      }

      resolveMission();
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
      resolveMission();
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
      resolveMission();
      setTimeout(()=> removeBubble(b.id), 50);
      return;
    }

    badHitCount++;
    streakGood = 0;
    stopFever();
    missBadHit++;
    combo = 0;
    score = Math.max(0, score - 8);
    waterPct = clamp(waterPct - BASE_TUNE.waterLoss, 0, 100);
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
    let best = null, bestD = 1e9;
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

  function buildFeatureRow(aiPred){
    const playedSec = Math.round(plannedSec - tLeft);
    const inDangerPhase = (phase==='storm' || phase==='boss' || phase==='final') ? 1 : 0;
    const inCorrectZone = isInNeededZone() ? 1 : 0;

    return {
      sessionId, pid, seed: seedStr, studyId, phaseName, conditionGroup, diff, view, runMode,
      t: playedSec, timeLeft: Math.ceil(tLeft),
      phase: currentPhaseKey(), bossLevel,
      score, waterPct: Math.round(waterPct), shield, combo, streakGood,
      feverOn: feverOn ? 1 : 0, feverLeft: +feverLeft.toFixed(3),
      missBadHit, missGoodExpired, blockCount, lightningHitCount, lightningBlockCount,
      comebackCount, stars, missionKey: currentMissionKey || '', missionAssignCount,
      inDangerPhase, inCorrectZone,
      riskHeuristic: +aiPred.risk.toFixed(4),
      aiRiskPred: +aiPred.risk.toFixed(4),
      aiFailSoonPred: aiPred.failSoon === 'YES' ? 1 : 0,
      aiTopFactor: aiPred.topFactor,
      aiConfidence: +(aiPred.confidence).toFixed(4),
      directorMode: director.aiMode,
      directorProfile: director.profile,
      directorRiskBand: director.riskBand,
      directorSpawnMul: +director.spawnMul.toFixed(4),
      directorGoodTtlMul: +director.goodTtlMul.toFixed(4),
      directorShieldBias: +director.shieldBias.toFixed(4),
      directorComebackBias: +director.comebackBias.toFixed(4),
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
      sessionId, pid, seed: seedStr, studyId, phaseName, conditionGroup,
      t: featureRow.t, phase: featureRow.phase,
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
  function updateTimelineAndFeatures(aiPred){
    const playedSec = Math.round(plannedSec - tLeft);
    if(playedSec === lastTimelineAt) return;
    lastTimelineAt = playedSec;

    const featureRow = buildFeatureRow(aiPred);
    const labelRow = buildLabelRow(featureRow);

    featureRows.push(featureRow);
    labelRows.push(labelRow);

    riskTimeline.push({
      sessionId, pid, seed: seedStr, studyId, phaseName, conditionGroup,
      t: featureRow.t, timeLeft: featureRow.timeLeft, phase: featureRow.phase, bossLevel: featureRow.bossLevel,
      risk: featureRow.aiRiskPred, waterPct: featureRow.waterPct, shield: featureRow.shield, combo: featureRow.combo,
      missBadHit: featureRow.missBadHit, missGoodExpired: featureRow.missGoodExpired, blockCount: featureRow.blockCount,
      inDangerPhase: featureRow.inDangerPhase, inCorrectZone: featureRow.inCorrectZone,
      aiTopFactor: featureRow.aiTopFactor, aiFailSoonPred: featureRow.aiFailSoonPred,
      directorProfile: featureRow.directorProfile, directorRiskBand: featureRow.directorRiskBand
    });
  }

  function endReasonText(reason){
    if(reason === 'time') return 'หมดเวลา';
    if(reason === 'miss-limit') return 'พลาดมากเกินไป';
    if(reason === 'dehydrated') return 'ค่าน้ำหมด';
    if(reason === 'final-clear') return 'ชนะ Final Boss สำเร็จ';
    if(reason === 'pagehide') return 'บันทึกก่อนออกหน้า';
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
    else if(summary.missBadHit >= Math.max(3, Math.floor(BASE_TUNE.missLimit*0.5))) lines.push('ควรหลบของไม่ดีให้มากขึ้น');
    else if(summary.missGoodExpired >= 4) lines.push('ควรเก็บน้ำให้ทันก่อนหมดเวลา');
    else if(summary.lightningHitCount >= 2) lines.push('ควรดู safe zone และมีโล่ก่อนฟ้าผ่า');
    else lines.push('ทำได้ดี ลองรักษาคอมโบให้สูงขึ้นอีก');

    if(summary.comboMax >= 12) lines.push('คอมโบดีมาก แปลว่าจังหวะการเล่นเริ่มแม่นแล้ว');
    if(summary.lightningBlockCount >= 2) lines.push('กันฟ้าผ่าได้ดี แสดงว่าเริ่มอ่านเกมได้ถูก');
    if(summary.feverUsed) lines.push('เข้าสู่ FEVER ได้แล้ว แปลว่าเล่นต่อเนื่องดี');
    if(summary.comebackCount >= 1) lines.push('มีการกลับเกมได้ดีในช่วงวิกฤต');
    if(summary.starsEarned >= 2) lines.push('ทำภารกิจได้หลายครั้ง แปลว่าคุมเกมและวางแผนดี');
    if(summary.finalCleared) lines.push('ปลดล็อก Final Clear reward');
    if(summary.lightningBlockCount >= 3) lines.push('ป้องกันฟ้าผ่าได้ยอดเยี่ยม');
    if(summary.starsEarned >= 3) lines.push('ทำภารกิจสำเร็จหลายครั้ง');

    return lines.slice(0,3).join(' • ');
  }

  function buildSummary(reason){
    const playedSec = Math.round(plannedSec - tLeft);
    return {
      sessionId, pid, seed: seedStr, studyId, phaseName, conditionGroup, schoolCode, classRoom,
      projectTag:'HydrationVR',
      gameVersion:'HydrationVR_PATCH_P_2026-03-13',
      game:'hydration',
      zone:'nutrition',
      runMode, diff, device:view, launchUrl,
      reason:String(reason || ''), endReasonText: endReasonText(reason), reachedPhaseText: reachedPhaseText(),
      durationPlannedSec: plannedSec, durationPlayedSec: playedSec,
      scoreFinal: score|0, grade: gradeText(),
      waterPct: Math.round(clamp(waterPct,0,100)), shield: shield|0, comboMax: bestCombo|0,
      missBadHit: missBadHit|0, missGoodExpired: missGoodExpired|0, badHitCount: badHitCount|0, goodExpireCount: goodExpireCount|0,
      blockCount: blockCount|0, lightningHitCount: lightningHitCount|0, lightningBlockCount: lightningBlockCount|0,
      comebackCount: comebackCount|0,
      starsEarned: stars|0,
      missionsCleared: uniqueMissionKeys().length|0,
      missionHistory: missionHistory.slice(),
      missionAssignCount: missionAssignCount|0,
      lastMissionCompleteAt,
      directorMode: director.aiMode,
      directorProfile: director.profile,
      directorRiskBand: director.riskBand,
      stormEntered, boss1Entered, boss2Entered, boss3Entered, finalEntered, finalCleared,
      phaseFinal: currentPhaseKey(), bossLevel, bossHits: bossHits|0, finalHits: finalHits|0,
      feverUsed: eventLog.some(e => e.type === 'fever_start') ? 1 : 0,
      eventCount: eventLog.length, timelineCount: riskTimeline.length, featureCount: featureRows.length, labelCount: labelRows.length,
      startTimeIso: nowIso(), endTimeIso: nowIso(),
      coachSummary: '',
      phaseStats
    };
  }
  function buildTeacherSummary(summary){
    return {
      sessionId: summary.sessionId,
      pid: summary.pid,
      game: summary.game,
      zone: summary.zone,
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
      comebackCount: summary.comebackCount,
      starsEarned: summary.starsEarned,
      missionsCleared: summary.missionsCleared,
      coachSummary: summary.coachSummary
    };
  }
  function buildHubLastRun(summary){
    const extra = {
      url: buildLauncherUrl(),
      runUrl: buildRunUrl(),
      sessionId,
      seed: seedStr,
      phase: currentPhaseKey(),
      scoreFinal: summary.scoreFinal
    };

    return {
      pid,
      game: 'hydration',
      zone: 'nutrition',
      projectTag: 'HydrationVR',
      runMode,
      diff,
      scoreFinal: summary.scoreFinal,
      accPct: Math.max(0, Math.min(100,
        Math.round((totalGoodHits() / Math.max(1, totalGoodHits() + missBadHit + missGoodExpired)) * 1000) / 10
      )),
      comboMax: summary.comboMax,
      missTotal: summary.missBadHit + summary.missGoodExpired,
      reason: summary.reason,
      grade: summary.grade,
      bossVariant: summary.phaseFinal,
      bossRule: summary.reachedPhaseText,
      timestampIso: new Date().toISOString(),
      __extraJson: JSON.stringify(extra)
    };
  }
  function buildResearchPacket(reason){
    const summary = buildSummary(reason);
    return {
      packetVersion: 'HHA_HYD_RESEARCH_PACKET_2026-03-13_PATCH_P',
      session: { ...sessionMeta },
      summary,
      phaseStats,
      tables: { events: eventLog, timeline: riskTimeline, features: featureRows, labels: labelRows }
    };
  }
  function buildCloudEnvelope(reason){
    const packet = buildResearchPacket(reason);
    return {
      source: 'HeroHealth-HydrationVR',
      schemaVersion: '2026-03-13-PATCH-P',
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

  function hardSaveLastSummary(summary, reason){
    summary.coachSummary = summary.coachSummary || buildEndCoachSummary(summary);

    try{
      const teacherPacket = {
        teacherSummary: buildTeacherSummary(summary),
        researchPacket: buildResearchPacket(reason),
        savedAtIso: new Date().toISOString()
      };
      lsSet('HHA_HYD_LAST_SUMMARY', JSON.stringify(teacherPacket));
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
        arr = JSON.parse(lsGet(k) || '[]');
        if(!Array.isArray(arr)) arr = [];
      }catch(e){ arr = []; }
      arr.unshift(teacherPacket);
      if(arr.length > 120) arr = arr.slice(0, 120);
      lsSet(k, JSON.stringify(arr));
    }catch(e){}

    try{
      lsSet(`HHA_LAST_SUMMARY:hydration:${pid}`, JSON.stringify(summary));
      lsSet('HHA_LAST_SUMMARY', JSON.stringify(buildHubLastRun(summary)));
    }catch(e){}

    try{
      lsSet(`HHA_LAST_REWARD:hydration:${pid}`, JSON.stringify({
        game:'hydration',
        pid,
        medal: rewardMedal,
        title: rewardTitle,
        badge: hydrationBadge,
        scoreFinal: summary.scoreFinal,
        grade: summary.grade,
        ts: new Date().toISOString()
      }));
    }catch(e){}
  }

  function saveSnapshot(tag='tick'){
    try{
      const snapshot = {
        tag,
        ts: new Date().toISOString(),
        sessionId, pid, seedStr, runMode, diff, view,
        launchUrl,
        playing, paused, helpOpen, gameEnded,
        tLeft, score, missBadHit, missGoodExpired, blockCount,
        combo, bestCombo, shield, waterPct,
        phase, stormLeft, stormDone,
        bossLevel, bossHits, bossGoal, finalHits, finalGoal,
        needZone, zoneT, aimX01,
        lightningHitCount, lightningBlockCount, badHitCount, goodExpireCount,
        stormEntered, boss1Entered, boss2Entered, boss3Entered, finalEntered, finalCleared,
        feverOn, feverLeft, streakGood,
        comebackCooldown, comebackCount,
        stars, mission, missionDone, missionHistory, currentMissionKey, missionAssignCount, lastMissionCompleteAt,
        director,
        phaseStats,
        eventCount: eventLog.length,
        timelineCount: riskTimeline.length,
        featureCount: featureRows.length,
        labelCount: labelRows.length,
        flowAudit: pathAudit()
      };
      lsSet(SNAPSHOT_KEY, JSON.stringify(snapshot));
      lastAutosaveAt = Date.now();
    }catch(e){}
  }
  function clearSnapshot(){ lsRemove(SNAPSHOT_KEY); }

  function restoreSnapshotIfAny(){
    try{
      const raw = lsGet(SNAPSHOT_KEY);
      if(!raw) return;
      const snap = JSON.parse(raw);
      if(!snap) return;

      if(String(snap.pid || '') !== String(pid || '')) return;
      if(String(snap.seedStr || snap.seed || '') !== String(seedStr || '')) return;
      if(String(snap.runMode || '') !== String(runMode || '')) return;

      const ageMs = Date.now() - new Date(snap.ts || 0).getTime();
      if(!Number.isFinite(ageMs) || ageMs > 6 * 60 * 60 * 1000){
        clearSnapshot();
        return;
      }

      tLeft = clamp(snap.tLeft, 0, plannedSec);
      score = Number(snap.score) || 0;
      missBadHit = Number(snap.missBadHit) || 0;
      missGoodExpired = Number(snap.missGoodExpired) || 0;
      blockCount = Number(snap.blockCount) || 0;
      combo = Number(snap.combo) || 0;
      bestCombo = Number(snap.bestCombo) || 0;
      shield = Number(snap.shield) || 0;
      waterPct = clamp(snap.waterPct, 0, 100);

      phase = String(snap.phase || 'normal');
      stormLeft = Number(snap.stormLeft) || 0;
      stormDone = !!snap.stormDone;
      bossLevel = Number(snap.bossLevel) || 0;
      bossHits = Number(snap.bossHits) || 0;
      bossGoal = Number(snap.bossGoal) || 0;
      finalHits = Number(snap.finalHits) || 0;
      finalGoal = Number(snap.finalGoal) || 0;

      needZone = snap.needZone === 'R' ? 'R' : 'L';
      zoneT = Number(snap.zoneT) || 0;
      aimX01 = clamp(snap.aimX01, 0, 1);

      lightningHitCount = Number(snap.lightningHitCount) || 0;
      lightningBlockCount = Number(snap.lightningBlockCount) || 0;
      badHitCount = Number(snap.badHitCount) || 0;
      goodExpireCount = Number(snap.goodExpireCount) || 0;

      stormEntered = Number(snap.stormEntered) || 0;
      boss1Entered = Number(snap.boss1Entered) || 0;
      boss2Entered = Number(snap.boss2Entered) || 0;
      boss3Entered = Number(snap.boss3Entered) || 0;
      finalEntered = Number(snap.finalEntered) || 0;
      finalCleared = Number(snap.finalCleared) || 0;

      feverOn = !!snap.feverOn;
      feverLeft = Number(snap.feverLeft) || 0;
      streakGood = Number(snap.streakGood) || 0;

      comebackCooldown = Number(snap.comebackCooldown) || 0;
      comebackCount = Number(snap.comebackCount) || 0;

      stars = Number(snap.stars) || 0;
      mission = snap.mission || null;
      missionDone = !!snap.missionDone;
      missionHistory = Array.isArray(snap.missionHistory) ? snap.missionHistory.slice() : [];
      currentMissionKey = String(snap.currentMissionKey || '');
      missionAssignCount = Number(snap.missionAssignCount) || 0;
      lastMissionCompleteAt = Number(snap.lastMissionCompleteAt) || -999;

      if(snap.director && typeof snap.director === 'object'){
        Object.assign(director, snap.director);
      }
      if(snap.phaseStats && typeof snap.phaseStats === 'object'){
        Object.keys(phaseStats).forEach(k=>{
          if(snap.phaseStats[k]) phaseStats[k] = { ...phaseStats[k], ...snap.phaseStats[k] };
        });
      }

      setStagePhase(phase === 'boss' ? 'boss' : phase);
      setFeverStage(feverOn);
      setCriticalStage(waterPct <= 15);
      refreshAiWidgets();
    }catch(e){}
  }

  function buildDiagnostics(){
    return {
      pathAudit: pathAudit(),
      launcherUrl: buildLauncherUrl(),
      runUrl: buildRunUrl(),
      cooldownUrl: buildCooldownUrl({
        hub: hubUrl || '../hub.html',
        nextAfterCooldown: hubUrl || '../hub.html',
        cat: 'nutrition',
        gameKey: 'hydration',
        who: pid
      }),
      hubUrl: hubUrl || '../hub.html',
      ui: {
        hasLayer: !!layer,
        hasEnd: !!ui.end,
        hasPauseOverlay: !!ui.pauseOverlay,
        hasHelpOverlay: !!ui.helpOverlay
      },
      state: {
        sessionId,
        playing,
        paused,
        helpOpen,
        gameEnded,
        phase,
        bossLevel,
        bossHits,
        finalHits,
        finalGoal,
        tLeft,
        score,
        waterPct,
        shield,
        missBadHit,
        missGoodExpired,
        combo,
        bestCombo,
        stormEntered,
        boss1Entered,
        boss2Entered,
        boss3Entered,
        finalEntered,
        finalCleared,
        stars,
        cooldownRequired
      },
      missingRunParams: missingRunParams(),
      snapshotKey: SNAPSHOT_KEY,
      hasSnapshot: !!lsGet(SNAPSHOT_KEY),
    };
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
    if(ui.fever) ui.fever.textContent = feverOn ? `${Math.ceil(feverLeft)}s` : 'OFF';
    if(ui.stars) ui.stars.textContent = String(stars);
    if(ui.mission && mission) ui.mission.textContent = mission.text;

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
        const bp = bossProfile();
        const emo = phase==='boss' ? emojiFor(diff,'boss',bossLevel) : emojiFor(diff,phase);
        zoneSign.textContent = `${emo} SAFE: ${needZone==='L'?'⬅️LEFT':'➡️RIGHT'} + 🛡️ • ${bp.label}`;
      }else{
        zoneSign.textContent = '';
      }
    }

    if(zoneSign && telegraphLeft > 0){
      if(telegraphKind === 'switch-pressure'){
        zoneSign.textContent = `⚠️ SWITCH PRESSURE`;
      }else if(telegraphKind === 'fake-calm'){
        zoneSign.textContent = `⚠️ FAKE CALM`;
      }else if(telegraphKind === 'burst'){
        zoneSign.textContent = `💥 BURST INCOMING`;
      }else if(telegraphKind === 'double-strike'){
        zoneSign.textContent = `⚡⚡ DOUBLE STRIKE`;
      }else if(telegraphKind === 'finisher'){
        zoneSign.textContent = `✨ FINISHER WINDOW`;
      }
    }
  }

  function setAIHud(risk, hint, topFactor='—', failSoon='—'){
    if(ui.aiRisk) ui.aiRisk.textContent = String((+risk).toFixed(2));
    if(ui.aiHint) ui.aiHint.textContent = String(hint || '—');
    if(ui.riskFill) ui.riskFill.style.width = `${Math.round(clamp(risk,0,1)*100)}%`;
    if(ui.coachExplain) ui.coachExplain.textContent = explainRisk(risk);
    refreshAiWidgets(topFactor, failSoon);
  }

  function saveHydrationRewardAndProfile(summary){
    saveHydrationReward(summary);
    saveHydrationHubProfile(summary);
  }

  function setEndButtons(summary){
    const done = cooldownDone('nutrition', 'hydration', pid);
    const needCooldown = !!cooldownRequired && !done;
    const safeHub = String(hubUrl || qs('hub','../hub.html') || '../hub.html');

    const safeCooldownUrl = buildCooldownUrl({
      hub: hubUrl || '../hub.html',
      nextAfterCooldown: hubUrl || '../hub.html',
      cat: 'nutrition',
      gameKey: 'hydration',
      who: pid
    });

    if(qs('debug','')){
      logEvent('end_button_paths', {
        replay: buildRunUrl(),
        cooldown: safeCooldownUrl,
        hub: hubUrl || '../hub.html'
      });
    }

    if(ui.btnNextCooldown){
      ui.btnNextCooldown.classList.toggle('is-hidden', !needCooldown);
      ui.btnNextCooldown.onclick = null;

      if(needCooldown){
        ui.btnNextCooldown.textContent = 'ไป Cooldown';
        ui.btnNextCooldown.onclick = ()=>{
          setVrUiVisibility(false);
          location.href = safeCooldownUrl;
        };
      }
    }

    if(ui.btnBackHub){
      ui.btnBackHub.textContent = 'กลับ HUB';
      ui.btnBackHub.onclick = ()=>{
        setVrUiVisibility(false);
        location.href = safeHub;
      };
    }

    if(ui.btnReplay){
      ui.btnReplay.textContent = 'เล่นอีกครั้ง';
      ui.btnReplay.onclick = ()=>{
        try{
          setVrUiVisibility(false);
          clearSnapshot();
          const u = new URL(buildRunUrl());
          if(runMode !== 'research'){
            u.searchParams.set('seed', String((Date.now() ^ (Math.random()*1e9))|0));
          }
          location.href = u.toString();
        }catch(e){
          location.href = buildRunUrl();
        }
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
    if(ui.btnCopyFeaturesCsv) ui.btnCopyFeaturesCsv.onclick = async ()=> copyText(rowsToCsv(featureRows), 'Copy Features CSV');
    if(ui.btnCopyLabelsCsv) ui.btnCopyLabelsCsv.onclick = async ()=> copyText(rowsToCsv(labelRows), 'Copy Labels CSV');
    if(ui.btnCopyCsvBundle) ui.btnCopyCsvBundle.onclick = async ()=> copyText(safeJson(buildCsvBundle(summary)), 'Copy CSV bundle');
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

  function checkEnd(){
    if(tLeft <= 0){ showEnd('time'); return true; }
    if(missBadHit >= BASE_TUNE.missLimit){ showEnd('miss-limit'); return true; }
    if(waterPct <= 0){ showEnd('dehydrated'); return true; }
    return false;
  }

  function showEnd(reason){
    if(gameEnded) return;
    gameEnded = true;
    playing = false;
    paused = false;

    ui.pauseOverlay?.setAttribute('aria-hidden','true');
    ui.helpOverlay?.setAttribute('aria-hidden','true');
    setStagePhase('normal');
    stopFever();
    setCriticalStage(false);
    setVrUiVisibility(true);

    for(const b of bubbles.values()){
      try{ b.el.remove(); }catch(e){}
    }
    bubbles.clear();

    if(reason === 'final-clear'){
      finalCleared = 1;
      for(const row of labelRows) row.final_clear_label = 1;
      celebrateFinalClear();
    }

    const summary = buildSummary(reason);
    summary.coachSummary = buildEndCoachSummary(summary);

    saveHydrationRewardAndProfile(summary);
    hardSaveLastSummary(summary, reason);
    clearSnapshot();
    logEvent('game_end', { reason });

    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      setTimeout(()=>{ focusEndCard(); }, 30);
      ui.endTitle.textContent = (reason === 'final-clear') ? '🏆 FINAL CLEAR!' : 'Game Over';

      const subParts = [
        `ผลลัพธ์: ${summary.endReasonText}`,
        `ไปได้ถึง: ${summary.reachedPhaseText}`,
        `เกรด: ${summary.grade || '—'}`,
        `AI: ${director.profile}/${director.riskBand}`
      ];
      ui.endSub.textContent = subParts.join(' • ');
      if(ui.endCoach) ui.endCoach.textContent = summary.coachSummary || '—';

      ui.endGrade.textContent = summary.grade || '—';
      ui.endScore.textContent = String(summary.scoreFinal|0);
      ui.endMiss.textContent = `${summary.missBadHit|0} / expire ${summary.missGoodExpired|0}`;
      ui.endWater.textContent = `${summary.waterPct}%`;
      if(ui.endStars) ui.endStars.textContent = String(summary.starsEarned || 0);
      if(ui.endMissionCount) ui.endMissionCount.textContent = String(summary.missionsCleared || 0);
      if(ui.endMissionSummary) ui.endMissionSummary.textContent = missionSummaryText();
      if(ui.endPhaseSummary) ui.endPhaseSummary.textContent = phaseSummaryText();
      if(ui.endReward) ui.endReward.textContent = `${rewardMedal} ${rewardTitle}`;
      if(ui.endBadge) ui.endBadge.textContent = hydrationBadge ? `${hydrationBadge.icon} ${hydrationBadge.label}` : '—';

      setEndButtons(summary);

      setTimeout(()=>{
        try{
          if(ui.btnNextCooldown && cooldownRequired){
            const hidden = ui.btnNextCooldown.classList.contains('is-hidden');
            if(hidden){
              ui.btnNextCooldown.classList.remove('is-hidden');
              ui.btnNextCooldown.textContent = 'ไป Cooldown';
              ui.btnNextCooldown.onclick = ()=>{
                setVrUiVisibility(false);
                location.href = buildCooldownUrl({
                  hub: hubUrl || '../hub.html',
                  nextAfterCooldown: hubUrl || '../hub.html',
                  cat: 'nutrition',
                  gameKey: 'hydration',
                  who: pid
                });
              };
            }
          }
        }catch(e){}
      }, 80);

      try{
        if(!DOC.getElementById('btnEmergencyContinue')){
          const emergency = DOC.createElement('button');
          emergency.id = 'btnEmergencyContinue';
          emergency.className = 'btn primary';
          emergency.textContent = cooldownRequired ? 'Emergency: ไป Cooldown' : 'Emergency: กลับ HUB';
          emergency.onclick = ()=>{
            setVrUiVisibility(false);
            if(cooldownRequired){
              location.href = buildCooldownUrl({
                hub: hubUrl || '../hub.html',
                nextAfterCooldown: hubUrl || '../hub.html',
                cat: 'nutrition',
                gameKey: 'hydration',
                who: pid
              });
            }else{
              location.href = hubUrl || '../hub.html';
            }
          };
          DOC.querySelector('#end .actions')?.appendChild(emergency);
        }
      }catch(e){}
    }
  }
  function showEndSafe(reason='debug'){ if(gameEnded) return; showEnd(reason); }

  function phaseSpawnAndLogic(dt){
    if(shield > 0 && r01() < dt*BASE_TUNE.shieldDrop) shield = Math.max(0, shield - 1);
    if(comebackCooldown > 0) comebackCooldown = Math.max(0, comebackCooldown - dt);

    if(!stormDone && phase === 'normal' && tLeft <= plannedSec*0.72){
      phase = 'storm';
      stormEntered = 1;
      setStagePhase('storm');
      SFX.setPhaseVolume('storm');
      SFX.phase('storm');
      stormLeft = BASE_TUNE.stormSec;
      stormDone = true;
      zoneT = 0;
      needZone = (r01() < 0.5) ? 'L' : 'R';
      lightning();
      fxPhaseBanner(`${emojiFor(diff,'storm')} STORM`);
      toastCoach(`ฟ้าผ่าแล้ว! ไป${needZone==='L'?'ซ้าย':'ขวา'} และต้องมีโล่ 🛡️`, 300);
      logEvent('phase_enter', { phase:'storm' });
      resolveMission();
    }

    if(phase === 'storm'){
      stormLeft = Math.max(0, stormLeft - dt);
      zoneT += dt;
      if(zoneT >= phaseZoneChunk()){
        zoneT = 0;
        swapZone();
      }
      if(forceLaneSwitchCount > 0){
        forceLaneSwitchCount--;
        swapZone();
        zoneT = 0;
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
      if(forceLaneSwitchCount > 0){
        forceLaneSwitchCount--;
        swapZone();
        zoneT = 0;
      }
      applyLightningStrike(dt * phaseLightningRate());
    }

    if(phase === 'final'){
      zoneT += dt;
      if(zoneT >= phaseZoneChunk()){
        zoneT = 0;
        swapZone();
      }
      if(forceLaneSwitchCount > 0){
        forceLaneSwitchCount--;
        swapZone();
        zoneT = 0;
      }
      applyLightningStrike(dt * phaseLightningRate());
    }

    if(shouldTriggerComeback()) triggerComebackSet();

    if(patternBurstLeft > 0){
      patternBurstLeft = Math.max(0, patternBurstLeft - dt);
      if(r01() < dt * (finalRush ? 4.4 : 3.0)){
        patternSpawnSet(patternState);
      }
    }

    let spawnBaseNow = BASE_TUNE.spawnBase * phaseSpawnMul();
    if(isLateGame()) spawnBaseNow *= 1.10;
    if(finalRush) spawnBaseNow *= 1.18;
    if(isNearFinalClear()) spawnBaseNow *= 1.10;

    if(!phaseSpawnAndLogic.spawnAcc) phaseSpawnAndLogic.spawnAcc = 0;
    phaseSpawnAndLogic.spawnAcc += spawnBaseNow * dt;

    while(phaseSpawnAndLogic.spawnAcc >= 1){
      phaseSpawnAndLogic.spawnAcc -= 1;
      const p = r01();
      const bp = bossProfile();
      const badP = phaseBadP();

      let shieldChance = 0.08 + bp.shieldBias + director.shieldBias;
      shieldChance = clamp(shieldChance, 0.02, 0.18);

      let kind = 'good';
      if(phase === 'normal'){
        if(p < 0.64) kind = 'good';
        else if(p < 0.88) kind = 'bad';
        else kind = 'shield';
      }else{
        const goodCut = 1.0 - badP - shieldChance;
        const shieldCut = 1.0 - shieldChance;
        if(p < goodCut) kind = 'good';
        else if(p < shieldCut) kind = 'bad';
        else kind = 'shield';
      }

      const ttlGood = BASE_TUNE.ttlGood * director.goodTtlMul;
      const ttlBad = BASE_TUNE.ttlBad;

      if(kind === 'good') makeBubble('good', pick(GOOD), ttlGood);
      else if(kind === 'shield') makeBubble('shield', pick(SHLD), 2.6);
      else makeBubble('bad', pick(BAD), ttlBad);
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

    setCriticalStage(waterPct <= 15 && playing);

    const tempFeatures = {
      waterPct: Math.round(waterPct),
      shield,
      inDangerPhase: (phase==='storm'||phase==='boss'||phase==='final') ? 1 : 0,
      inCorrectZone: isInNeededZone() ? 1 : 0
    };
    const aiPred = buildAIPrediction(tempFeatures);

    updateDirector(aiPred.risk);
    maybeEnterFinalRush();
    updatePatternDirector(dt);
    updateBossSignature(dt);
    phaseSpawnAndLogic(dt);
    updateBubbles();
    resolveMission();

    let hint = aiPred.explain;
    if(phase === 'boss'){
      if(bossLevel === 1){
        hint = `${emojiFor(diff,'boss',1)} Boss 1 • ฝึก safe zone + good burst`;
      }else if(bossLevel === 2){
        hint = `${emojiFor(diff,'boss',2)} Boss 2 • switch pressure • เปลี่ยนฝั่งเร็ว`;
      }else{
        hint = inFakeCalm()
          ? `${emojiFor(diff,'boss',3)} Boss 3 • calm... ระวัง burst`
          : `${emojiFor(diff,'boss',3)} Boss 3 • fake calm + burst trap`;
      }
    }else if(phase === 'final'){
      if(inFinisherWindow()){
        hint = `${emojiFor(diff,'final')} FINAL • FINISHER WINDOW • อีก ${Math.max(0,finalGoal-finalHits)} hit`;
      }else{
        hint = finalRush
          ? `${emojiFor(diff,'final')} FINAL RUSH • double strike • อีก ${Math.max(0,finalGoal-finalHits)} hit`
          : `${emojiFor(diff,'final')} FINAL • double strike • อีก ${Math.max(0,finalGoal-finalHits)} hit`;
      }
    }else if(phase === 'storm'){
      hint = `${emojiFor(diff,'storm')} STORM • ไป${needZone==='L'?'ซ้าย':'ขวา'}และต้องมีโล่`;
    }else if(feverOn){
      hint = '🔥 FEVER! เร่งเก็บน้ำเลย';
    }

    if(telegraphLeft > 0){
      telegraphLeft = Math.max(0, telegraphLeft - dt);
      if(telegraphKind === 'switch-pressure'){
        hint = '⚠️ เตรียมสลับฝั่ง!';
      }else if(telegraphKind === 'fake-calm'){
        hint = '⚠️ บอสเงียบผิดปกติ...';
      }else if(telegraphKind === 'burst'){
        hint = '⚠️ BURST กำลังมา!';
      }else if(telegraphKind === 'double-strike'){
        hint = '⚠️ ฟ้าผ่าคู่กำลังมา!';
      }else if(telegraphKind === 'finisher'){
        hint = '✨ จังหวะปิดเกมกำลังเปิด!';
      }
    }

    updateTimelineAndFeatures(aiPred);
    setAIHud(aiPred.risk, hint, aiPred.topFactor, aiPred.failSoon);
    setHUD();

    const playedSec = Math.round(plannedSec - tLeft);
    if(playedSec % 8 === 0 && playedSec !== 0){
      if(aiPred.risk >= 0.62){
        toastCoach(aiCoachMessage(aiPred), 1800);
      }
    }

    if(Date.now() - lastAutosaveAt > 5000){
      saveSnapshot('autosave');
    }

    if(checkEnd()) return;
    requestAnimationFrame(loop);
  }

  function flushBeforeLeave(reason='pagehide'){
    try{
      if(gameEnded) return;
      const summary = buildSummary(reason);
      summary.coachSummary = buildEndCoachSummary(summary);
      hardSaveLastSummary(summary, reason);
      saveSnapshot(reason);
    }catch(e){}
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(!playing) return;
    if(DOC.hidden){
      paused = true;
      if(ui.pauseOverlay) ui.pauseOverlay.setAttribute('aria-hidden','false');
      flushBeforeLeave('hidden');
    }
  });
  WIN.addEventListener('pagehide', ()=> flushBeforeLeave('pagehide'));
  WIN.addEventListener('beforeunload', ()=> flushBeforeLeave('beforeunload'));
  WIN.addEventListener('resize', ()=>{
    try{
      if(ui.end?.getAttribute('aria-hidden') === 'false'){
        setTimeout(()=> focusEndCard(), 80);
      }
    }catch(e){}
  }, { passive:true });
  WIN.addEventListener('orientationchange', ()=>{
    try{
      if(ui.end?.getAttribute('aria-hidden') === 'false'){
        setTimeout(()=> focusEndCard(), 120);
      }
    }catch(e){}
  }, { passive:true });

  WIN.__HYD_DEBUG__ = {
    getState: ()=>({
      sessionId,
      playing,
      paused,
      helpOpen,
      gameEnded,
      phase,
      bossLevel,
      bossHits,
      bossGoal,
      finalHits,
      finalGoal,
      tLeft,
      score,
      waterPct,
      shield,
      bubbleCount: bubbles.size,
      missBadHit,
      missGoodExpired,
      lightningHitCount,
      lightningBlockCount,
      stormEntered,
      boss1Entered,
      boss2Entered,
      boss3Entered,
      finalEntered,
      finalCleared,
      feverOn,
      feverLeft,
      streakGood,
      comebackCooldown,
      comebackCount,
      stars,
      mission: mission?.text || '',
      missionDone,
      missionHistory: missionHistory.slice(),
      director,
      eventCount: eventLog.length,
      timelineCount: riskTimeline.length,
      featureCount: featureRows.length,
      labelCount: labelRows.length,
      launcherUrl: buildLauncherUrl(),
      runUrl: buildRunUrl(),
      cooldownUrl: buildCooldownUrl({
        hub: hubUrl || '../hub.html',
        nextAfterCooldown: hubUrl || '../hub.html',
        cat: 'nutrition',
        gameKey: 'hydration',
        who: pid
      }),
      hubUrl: hubUrl || '../hub.html',
      cooldownRequired,
      pathAudit: pathAudit(),
      bossSignature: bossSignatureName(),
      patternState,
      patternBurstLeft,
      fakeCalmLeft,
      finisherWindowLeft,
      finalRush,
      forceLaneSwitchCount,
      finalDoubleStrikeCooldown
    }),
    diagnostics: ()=> buildDiagnostics(),
    forceEnd: (reason='debug')=> showEndSafe(reason),
    saveSnapshot: ()=> saveSnapshot('debug'),
    clearSnapshot: ()=> clearSnapshot(),
    openLauncher: ()=> location.href = buildLauncherUrl(),
    openRun: ()=> location.href = buildRunUrl(),
    openCooldown: ()=> location.href = buildCooldownUrl({
      hub: hubUrl || '../hub.html',
      nextAfterCooldown: hubUrl || '../hub.html',
      cat: 'nutrition',
      gameKey: 'hydration',
      who: pid
    })
  };

  if(selfHealRunQuery()) return;

  nextMission();
  restoreSnapshotIfAny();
  SFX.setPhaseVolume('normal');
  helpOpen = false;
  paused = false;
  setFeverStage(feverOn);
  setCriticalStage(waterPct <= 15);
  refreshAiWidgets();
  refreshSfxBtn();
  setHUD();
  setVrUiVisibility(false);

  try{
    const dbgOn = ['1','true','yes','on'].includes(String(qs('debug','')).toLowerCase());
    if(dbgOn && typeof WIN.__HYD_DEV_SET__ === 'function'){
      WIN.__HYD_DEV_SET__(JSON.stringify(buildDiagnostics(), null, 2));
    }
  }catch(e){}

  try{
    const audit = pathAudit();
    const warnings = [];
    const missing = missingRunParams();

    if(missing.length) warnings.push(`missing: ${missing.join(', ')}`);
    if(audit.flowStage !== 'run') warnings.push(`flowStage=${audit.flowStage}`);

    if(warnings.length){
      logEvent('audit_warning', { warnings });
      if(['1','true','yes','on'].includes(String(qs('debug','')).toLowerCase())){
        toastCoach(`AUDIT: ${warnings.join(' | ')}`, 0);
        if(typeof WIN.__HYD_DEV_SET__ === 'function'){
          WIN.__HYD_DEV_SET__(JSON.stringify(buildDiagnostics(), null, 2));
        }
      }
    }
  }catch(e){}

  saveSnapshot('boot');
  requestAnimationFrame(loop);
}