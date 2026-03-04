// === /herohealth/vr-maskcough/maskcough.safe.js ===
// MaskCough SAFE Engine — PRODUCTION (A+B FUN NOW + PRO+ARCADE + SFX)
// FULL v20260304b-MASKCOUGH-FUNPRO-SFX
'use strict';

(function(){
  const WIN = window;
  const DOC = document;
  const $ = (s)=>DOC.querySelector(s);
  const byId = (id)=>DOC.getElementById(id);

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)));
  const clamp01=(x)=>clamp(x,0,1);

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function getQS(){ try{return new URL(location.href).searchParams;}catch(_){return new URLSearchParams();} }
  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }

  function getViewAuto(){
    const q=getQS();
    const v=(q.get('view')||'').toLowerCase(); if(v) return v;
    const ua=navigator.userAgent||'';
    const isMobile=/Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }

  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------- context ----------------
  const Q = getQS();
  const hub = (Q.get('hub')||'../hub.html').trim();
  const pid = (Q.get('pid')||Q.get('participantId')||'').trim() || 'anon';
  const diff = (Q.get('diff')||'normal').trim().toLowerCase(); // easy|normal|hard
  const seedParam = (Q.get('seed')||pid||'maskcough').trim();
  const mode = (Q.get('mode')||Q.get('run')||'play').trim().toLowerCase(); // play|study|research
  const view = getViewAuto();
  const timeLimit = Math.max(20, parseInt(Q.get('time')||'60',10) || 60);
  const logEndpoint = (Q.get('log')||'').trim();

  const studyId = (Q.get('studyId')||'').trim();
  const phase = (Q.get('phase')||'').trim();
  const conditionGroup = (Q.get('conditionGroup')||'').trim();

  const seed = (safeNum(seedParam, Date.now()) >>> 0);
  const rng = seededRng(seed);

  const wrap = $('#mc-wrap');
  const layer = $('#layer');
  const stageEl = byId('stage');
  const popLayer = byId('mc-pop-layer');

  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.run = mode;
  }

  function applyHubLink(a){
    if(!a) return;
    try{
      const u = new URL(hub, location.href);
      u.searchParams.set('pid', pid);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);
      a.href = u.toString();
    }catch(_){
      a.href = hub || '../hub.html';
    }
  }
  applyHubLink(byId('btnEndBack'));

  // ---------------- UI helpers ----------------
  function toast(msg){
    const el = byId('toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1100);
  }
  function showPrompt(msg){
    const el = byId('mc-prompt');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showPrompt._t);
    showPrompt._t = setTimeout(()=> el.classList.remove('show'), 980);
  }
  function flashBad(){
    const el = byId('mc-flash');
    if(!el) return;
    el.style.opacity='1';
    clearTimeout(flashBad._t);
    flashBad._t=setTimeout(()=> el.style.opacity='0', 120);
  }
  function feverGlow(on){
    const el = byId('mc-feverGlow');
    if(!el) return;
    el.style.opacity = on ? '1' : '0';
  }
  function shake(){
    if(!stageEl) return;
    stageEl.classList.remove('shake');
    void stageEl.offsetWidth;
    stageEl.classList.add('shake');
  }
  function popScore(x, y, text, cls){
    if(!popLayer) return;
    const el = DOC.createElement('div');
    el.className = 'mc-pop ' + (cls||'');
    el.style.left = x+'px';
    el.style.top = y+'px';
    el.textContent = text;
    popLayer.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch(_){} }, 650);
  }

  // Perfect freeze (visual + brief stall)
  function freeze(ms){
    const t = performance.now();
    st.freezeUntil = Math.max(st.freezeUntil||0, t + (ms||180));
    DOC.body.classList.add('mc-freeze');
    clearTimeout(freeze._t);
    freeze._t = setTimeout(()=> DOC.body.classList.remove('mc-freeze'), (ms||180)+40);
  }

  // ===== Vibrate + Sound (WebAudio) =====
  const FX = {
    vibOn: String(qs('vib','1')) !== '0',     // ?vib=0 ปิด
    sndOn: String(qs('snd','1')) !== '0',     // ?snd=0 ปิด
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

    if(ac.state === 'suspended'){
      ac.resume().catch(()=>{});
    }

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
  function sfxPerfect(){
    vib([20,20,30]);
    beep(880, 70, 'triangle', 0.06);
    setTimeout(()=>beep(1320, 90, 'triangle', 0.05), 60);
  }
  function sfxBoss(){
    vib([35,25,35,25,55]);
    beep(220, 120, 'sawtooth', 0.05);
    setTimeout(()=>beep(180, 140, 'sawtooth', 0.04), 80);
  }
  function sfxBad(){
    vib(50);
    beep(140, 140, 'square', 0.035);
  }
  function sfxHit(){
    vib(10);
    beep(520, 35, 'sine', 0.03);
  }

  // Boss banner + crosshair hint
  const bossBanner = byId('bossBanner');
  const crosshairHint = byId('crosshairHint');
  function setBossBanner(on, text){
    if(!bossBanner) return;
    if(on){
      if(text){ const t=byId('bossBannerText'); if(t) t.textContent=text; }
      bossBanner.hidden=false;
    }else bossBanner.hidden=true;
  }
  function setCrosshairHint(on){
    if(!crosshairHint) return;
    crosshairHint.hidden = !on;
  }
  setCrosshairHint(view==='cvr');

  // ---------------- FX layer ----------------
  const fxLayer = DOC.createElement('div');
  fxLayer.style.position='fixed';
  fxLayer.style.inset='0';
  fxLayer.style.pointerEvents='none';
  fxLayer.style.zIndex='70';
  DOC.body.appendChild(fxLayer);

  function fxSpark(x,y){
    const el=DOC.createElement('div');
    el.style.position='absolute';
    el.style.left=(x-6)+'px';
    el.style.top=(y-6)+'px';
    el.style.width='12px';
    el.style.height='12px';
    el.style.borderRadius='999px';
    el.style.background='rgba(34,197,94,.85)';
    el.style.boxShadow='0 0 18px rgba(34,197,94,.55)';
    el.style.transform='scale(.8)';
    el.style.opacity='1';
    el.style.transition='transform .18s ease, opacity .18s ease';
    fxLayer.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform='scale(1.8)'; el.style.opacity='0'; });
    setTimeout(()=>{ try{el.remove();}catch(_){} }, 220);
  }
  function fxShockwave(x,y){
    const el=DOC.createElement('div');
    el.style.position='absolute';
    el.style.left=(x)+'px';
    el.style.top=(y)+'px';
    el.style.width='12px';
    el.style.height='12px';
    el.style.borderRadius='999px';
    el.style.border='2px solid rgba(239,68,68,.65)';
    el.style.boxShadow='0 0 24px rgba(239,68,68,.28)';
    el.style.transform='translate(-50%,-50%) scale(1)';
    el.style.opacity='0.9';
    el.style.transition='transform .38s ease, opacity .38s ease';
    fxLayer.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform='translate(-50%,-50%) scale(14)'; el.style.opacity='0'; });
    setTimeout(()=>{ try{el.remove();}catch(_){} }, 420);
  }
  function fxConfettiBurst(x,y){
    for(let i=0;i<14;i++){
      const c=DOC.createElement('div');
      c.style.position='absolute';
      c.style.left=x+'px';
      c.style.top=y+'px';
      c.style.width='6px';
      c.style.height='10px';
      c.style.borderRadius='2px';
      c.style.background = (i%3===0) ? 'rgba(56,189,248,.9)' : (i%3===1) ? 'rgba(34,197,94,.9)' : 'rgba(167,139,250,.9)';
      c.style.transform='translate(-50%,-50%)';
      c.style.opacity='1';
      c.style.transition='transform .65s ease, opacity .65s ease';
      fxLayer.appendChild(c);

      const ang = (Math.PI*2) * (i/14);
      const dx = Math.cos(ang) * (70 + Math.random()*60);
      const dy = Math.sin(ang) * (70 + Math.random()*60) + (20 + Math.random()*40);
      const rot = (Math.random()*260 - 130);

      requestAnimationFrame(()=>{
        c.style.transform=`translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
        c.style.opacity='0';
      });
      setTimeout(()=>{ try{c.remove();}catch(_){} }, 700);
    }
  }

  // ---------------- logger (403-safe, flush-hardened) ----------------
  function createLogger(ctx){
    const q = [];
    let seq = 0;
    const sessionId = 'mc_' + (Date.now().toString(36)) + '_' + Math.random().toString(36).slice(2,8);

    function base(type){
      return {
        v: 1,
        game: 'maskcough',
        type,
        sessionId,
        seq: ++seq,
        ts: Date.now(),
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        diff: ctx.diff,
        mode: ctx.mode,
        view: ctx.view,
        seed: ctx.seed,
        timePlannedSec: ctx.timePlannedSec,
        href: location.href.split('#')[0]
      };
    }

    function push(ev){
      q.push({ ...base(ev.type), ...ev });
      if(q.length > 1400) q.splice(0, q.length - 1000);
    }

    async function flush(reason){
      if(!ctx.log || !q.length) return;
      const payload = q.splice(0, q.length);
      const body = payload.map(x=>JSON.stringify(x)).join('\n');
      try{
        if(reason === 'unload' && navigator.sendBeacon){
          navigator.sendBeacon(ctx.log, new Blob([body], {type:'text/plain'}));
          return;
        }
        const res = await fetch(ctx.log, {
          method:'POST',
          headers:{'content-type':'text/plain'},
          body,
          keepalive:true
        });
        if(res && res.status === 403) console.warn('[maskcough] log 403 (ignored)');
      }catch(_){}
    }

    return { sessionId, push, flush };
  }
  const logger = createLogger({ pid, diff, mode, view, seed, timePlannedSec: timeLimit, log: logEndpoint, studyId, phase, conditionGroup });

  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') logger.flush('unload');
  });
  WIN.addEventListener('beforeunload', ()=> logger.flush('unload'));

  // ---------------- Fun Boost (optional) ----------------
  const fun = WIN.HHA?.createFunBoost?.({
    seed: String(seed),
    baseSpawnMul: 1.0,
    waveCycleMs: 18000,
    feverThreshold: 18,
    feverDurationMs: 6500,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });
  let director = fun ? fun.tick() : {spawnMul:1,timeScale:1,wave:'calm',intensity:0,feverOn:false};

  // ---------------- AI Director (prediction + small assist only in play) ----------------
  function sigmoid(x){
    if(x >= 0){ const z=Math.exp(-x); return 1/(1+z); }
    const z=Math.exp(x); return z/(1+z);
  }
  function nz(v, lo, hi){ return clamp01((v - lo) / (hi - lo)); }

  function createRiskModel(){
    const w=[2.2,1.6,2.0,1.3,1.4,1.0,0.9], b=-1.4;
    return { predict(feat){
      let s=b; for(let i=0;i<w.length;i++) s += w[i]*(feat[i]||0);
      return sigmoid(s);
    }};
  }
  function createTinyMLP(){
    const W1=Array.from({length:8},()=>Array(7).fill(0));
    const B1=Array(8).fill(0);
    const W2=Array(8).fill(0);
    const B2=0;
    for(let i=0;i<8;i++){
      B1[i]=(i%2?-0.15:0.12);
      for(let j=0;j<7;j++) W1[i][j]=(((i+1)*(j+2))%7)*0.03-0.09;
      W2[i]=(i%2?0.22:-0.18);
    }
    const relu=(x)=>x>0?x:0;
    return { predict(feat){
      const h=new Array(8).fill(0);
      for(let i=0;i<8;i++){
        let s=B1[i];
        for(let j=0;j<7;j++) s += W1[i][j]*(feat[j]||0);
        h[i]=relu(s);
      }
      let o=B2;
      for(let i=0;i<8;i++) o += W2[i]*h[i];
      return sigmoid(o);
    }};
  }

  function createAIDirector(opts){
    const model=createRiskModel();
    const mlp=createTinyMLP();
    const cfg={
      windowMs: 5000,
      enableDL: !!opts?.enableDL,
      enabled: !!opts?.enabled,
      alpha: 0.65,
      maxAssist: 0.40,
      coachCooldownMs: 8000,
    };
    const stA={
      lastT: performance.now(),
      risk: 0.12,
      taps:0,hits:0,timeouts:0,coughTimeouts:0,perfects:0,
      latencySum:0,latencyN:0,
      shieldNow:40,shieldPrev:40,shieldSlope:0,
      coachT:0,
      riskSum:0,riskN:0
    };

    function reset(){
      stA.lastT=performance.now();
      stA.risk=0.12;
      stA.taps=stA.hits=stA.timeouts=0;
      stA.coughTimeouts=0; stA.perfects=0;
      stA.latencySum=0; stA.latencyN=0;
      stA.shieldPrev=stA.shieldNow=40;
      stA.shieldSlope=0;
      stA.coachT=0;
      stA.riskSum=0; stA.riskN=0;
    }

    function onTick(now, shield, focus, spam){
      stA.shieldNow=shield;
      stA.riskSum += stA.risk; stA.riskN++;

      if(!cfg.enabled) return stA.risk;

      if(now - stA.lastT >= cfg.windowMs){
        const total=Math.max(1, stA.taps + stA.timeouts);
        const hitRate=stA.hits/total;
        const missRate=stA.timeouts/total;
        const avgLat=stA.latencyN ? (stA.latencySum/stA.latencyN) : 0;
        const coughFail=stA.coughTimeouts/Math.max(1, stA.timeouts);
        const perfectRate=stA.perfects/Math.max(1, stA.hits);

        stA.shieldSlope=(stA.shieldNow - stA.shieldPrev)/100;
        stA.shieldPrev=stA.shieldNow;

        const feat=[
          nz(missRate,0.05,0.55),
          nz(1-hitRate,0.10,0.70),
          nz(1-(stA.shieldNow/100),0.30,0.95),
          nz(Math.max(0,-stA.shieldSlope),0.00,0.30),
          nz(coughFail,0.05,0.60),
          nz(avgLat,180,650),
          nz(1-perfectRate,0.20,0.95),
        ];

        const r1=model.predict(feat);
        const r2=cfg.enableDL ? mlp.predict(feat) : r1;
        const r=cfg.enableDL ? (0.55*r1 + 0.45*r2) : r1;

        const spamN = clamp01((spam||0)/14);
        const focusN = clamp01((100-(focus||100))/100);
        const rAdj = clamp01(r + 0.06*spamN + 0.05*focusN);

        stA.risk = cfg.alpha*stA.risk + (1-cfg.alpha)*rAdj;

        stA.taps=stA.hits=stA.timeouts=0;
        stA.coughTimeouts=0; stA.perfects=0;
        stA.latencySum=0; stA.latencyN=0;
        stA.lastT=now;

        logger.push({ type:'ai:risk', risk: +stA.risk.toFixed(4) });
      }
      return stA.risk;
    }

    function assistParams(){
      if(!cfg.enabled) return {assist:0,maskBonus:0,coughPenalty:0,spawnSlow:0,ttlBoost:0,perfectBoost:0};
      const a=Math.min(cfg.maxAssist, Math.max(0,(stA.risk-0.25)*0.85));
      return {
        assist:a,
        maskBonus:0.10*a,
        coughPenalty:0.12*a,
        spawnSlow:0.14*a,
        ttlBoost:0.12*a,
        perfectBoost:0.16*a,
      };
    }

    function onEvent(ev){
      stA.taps += 1;
      if(ev.type==='hit'){ stA.hits += 1; }
      else if(ev.type==='perfect'){ stA.hits += 1; stA.perfects += 1; }
      else if(ev.type==='timeout'){
        stA.timeouts += 1;
        if(ev.kind==='cough' || ev.kind==='boss') stA.coughTimeouts += 1;
      }
      if(Number.isFinite(ev.latencyMs)){ stA.latencySum += ev.latencyMs; stA.latencyN += 1; }
    }

    function riskAvg(){ return stA.riskN ? (stA.riskSum/stA.riskN) : stA.risk; }

    function topReasons(state){
      const items = [];
      const shieldLow = clamp01((35 - state.shield)/35);
      const spamHigh = clamp01(state.spam/12);
      const focusLow = clamp01((100 - state.focus)/100);
      const missHigh = clamp01(state.missRecent/8);
      const coughFail = clamp01(state.coughMissRecent/5);

      items.push({s: 0.34*shieldLow, t:'โล่ต่ำ'});
      items.push({s: 0.26*spamHigh,  t:'กดยิงรัว'});
      items.push({s: 0.18*focusLow,  t:'สมาธิลด'});
      items.push({s: 0.22*missHigh,  t:'พลาดบ่อย'});
      items.push({s: 0.22*coughFail, t:'พลาดไอ/บอส'});
      items.sort((a,b)=>b.s-a.s);
      return items.filter(x=>x.s>0.05).slice(0,2).map(x=>x.t);
    }

    function coachHint(now, state){
      if(!cfg.enabled) return null;
      if(now - stA.coachT < cfg.coachCooldownMs) return null;
      if(stA.risk < 0.42 && state.shield > 34) return null;

      stA.coachT = now;
      const reasons = topReasons(state);
      const rtxt = reasons.length ? `เพราะ ${reasons.join(' + ')}` : '';

      if(state.stage===3 && state.bossSweepGot < state.bossSweepNeed){
        return `👿 ช่วงท้าย! รอ 🤧 ให้เข้า Perfect (${rtxt})`;
      }
      if(state.mission && state.mission.need && !state.mission.done){
        return `🎯 Mission: ${state.mission.text} (${rtxt})`;
      }
      if(state.shield < 22) return `⚠️ โล่ใกล้หมด! เก็บ 😷 เพิ่ม Shield (${rtxt})`;
      if(stA.risk > 0.70) return `🎯 โฟกัส 🤧 ตอนท้ายเพื่อ Perfect Block (${rtxt})`;
      if(state.spam >= 6) return `🛑 ช้าลงนิด! ยิงรัวทำให้เสี่ยงสูง (${rtxt})`;
      return `✨ รักษา streak แล้วจะเข้า FEVER ไวขึ้น (${rtxt})`;
    }

    return { reset, onTick, onEvent, assistParams, coachHint, riskAvg, topReasons, get risk(){return stA.risk;} };
  }

  const aiEnabled = (mode === 'play'); // study/research OFF
  const ai = createAIDirector({ enabled: aiEnabled, enableDL: aiEnabled });

  // ---------------- game state ----------------
  const st = {
    running:false, paused:false, over:false,
    t0:0, elapsedSec:0,

    score:0, streak:0, maxStreak:0, miss:0, perfect:0,

    // analyze
    safeHits:0, riskHits:0, dangerHits:0,
    routeChain:0,
    spam:0,
    actionCount:0,
    lastActionMs:0,
    focus:100,

    // risk/threat
    risk: 0.12,
    threat:'LOW',
    threatValue:0,

    shield:40,

    // mission/stage
    stage:1,
    stage2At: 20,
    stage3At: Math.max(45, timeLimit-15),
    bossSweepOn:false,
    bossSweepNeedPerfect:2,
    bossSweepGotPerfect:0,

    warmNeedStreak: 8,
    warmDone:false,
    trickNeedPerfect: 2,
    trickPerfectGot: 0,
    trickDone:false,

    // pacing (PRO tuning)
    baseSpawnMs: (diff==='hard' ? 620 : diff==='easy' ? 900 : 760),
    ttlBaseMs:   (diff==='hard' ? 1320 : diff==='easy' ? 1950 : 1650),
    perfectBaseMs: (diff==='hard' ? 170 : diff==='easy' ? 250 : 220),

    // mini boss
    bossEveryMs: (diff==='hard' ? 20500 : diff==='easy' ? 27000 : 23500),
    nextBossAt: 0,
    bossActive:false,
    bossNeedPerfect:false,

    // freeze
    freezeUntil: 0,

    // targets
    targets: new Map(),
    uid:0,

    // coach windows
    missRecent:0,
    coughMissRecent:0,
    lastMissWindowAt:0
  };

  // HUD refs
  const tScore=byId('tScore'), tStreak=byId('tStreak'), tMiss=byId('tMiss');
  const tMask=byId('tMask'), bMask=byId('bMask');
  const tWave=byId('tWave'), tInt=byId('tInt'), tFever=byId('tFever'), tRisk=byId('tRisk');
  const tFeverPct=byId('tFeverPct'), bFever=byId('bFever');
  const tThreat=byId('tThreat');
  const tFocus=byId('tFocus'), bFocus=byId('bFocus');
  const tMission=byId('tMission');
  const tPro=byId('tPro');

  const tSafeHits=byId('tSafeHits'), tRiskHits=byId('tRiskHits'), tDangerHits=byId('tDangerHits');
  const tPerfectRate=byId('tPerfectRate'), tSpam=byId('tSpam'), tRouteChain=byId('tRouteChain');

  function layerRect(){ return layer.getBoundingClientRect(); }

  function riskZone(){
    return (st.risk>0.66) ? 'DANGER' : (st.risk>0.33) ? 'RISK' : 'SAFE';
  }

  function updateThreat(){
    const rv = clamp01(st.risk);
    const spam = st.spam || 0;
    let tv = (rv*65) + Math.min(25, st.miss*3) + Math.min(18, spam*2) + Math.min(14, (100-st.focus)/6);
    st.threatValue = clamp(tv,0,100);
    st.threat = (tv>=70) ? 'HIGH' : (tv>=40) ? 'MID' : 'LOW';
  }

  function updateMissionText(){
    if(!tMission) return;
    if(st.stage===1){
      tMission.textContent = `Warm: streak ${Math.min(st.streak, st.warmNeedStreak)}/${st.warmNeedStreak}`;
    }else if(st.stage===2){
      tMission.textContent = `Trick: perfect ${Math.min(st.trickPerfectGot, st.trickNeedPerfect)}/${st.trickNeedPerfect}`;
    }else{
      tMission.textContent = `Boss: perfect ${Math.min(st.bossSweepGotPerfect, st.bossSweepNeedPerfect)}/${st.bossSweepNeedPerfect}`;
    }
  }

  function setHud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tStreak) tStreak.textContent = String(st.streak);
    if(tMiss) tMiss.textContent = String(st.miss);

    const sh=clamp(st.shield,0,100);
    if(tMask) tMask.textContent = `${Math.round(sh)}%`;
    if(bMask) bMask.style.width = `${sh}%`;

    if(tWave) tWave.textContent = director.wave || '—';
    if(tInt) tInt.textContent = (director.intensity||0).toFixed(2);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    if(tRisk) tRisk.textContent = (st.risk||0).toFixed(2);
    if(tThreat) tThreat.textContent = st.threat;

    if(tFocus) tFocus.textContent = String(Math.round(st.focus));
    if(bFocus) bFocus.style.width = `${clamp(st.focus,0,100)}%`;

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(bFever) bFever.style.width = `${pct}%`;
    if(tFeverPct) tFeverPct.textContent = `${Math.round(pct)}%`;

    if(tPro){
      tPro.textContent = (diff==='hard') ? 'PRO' : (diff==='easy') ? 'EASY' : 'NORMAL';
    }

    if(tSafeHits) tSafeHits.textContent = String(st.safeHits);
    if(tRiskHits) tRiskHits.textContent = String(st.riskHits);
    if(tDangerHits) tDangerHits.textContent = String(st.dangerHits);

    const perfRate = Math.round((st.perfect/Math.max(1,(st.safeHits+st.riskHits+st.dangerHits))) * 100);
    if(tPerfectRate) tPerfectRate.textContent = `${isFinite(perfRate)?perfRate:0}%`;
    if(tSpam) tSpam.textContent = String(st.spam);
    if(tRouteChain) tRouteChain.textContent = String(st.routeChain);

    updateMissionText();
    feverGlow(!!director.feverOn);
  }

  function emoji(kind){
    if(kind==='droplet') return '💦';
    if(kind==='cough') return '🤧';
    if(kind==='mask') return '😷';
    if(kind==='infected') return '🦠';
    if(kind==='boss') return '👿';
    return '🎯';
  }
  function cssClass(kind){
    if(kind==='droplet') return 't good';
    if(kind==='infected') return 't bad';
    if(kind==='cough') return 't cough bad';
    if(kind==='mask') return 't mask';
    if(kind==='boss') return 't boss cough bad';
    return 't';
  }

  function updateRouteChain(kind, judge){
    st._lastKinds = st._lastKinds || [];
    st._lastKinds.push({kind, judge});
    if(st._lastKinds.length>3) st._lastKinds.shift();
    const a=st._lastKinds;
    if(a.length>=3){
      const k0=a[a.length-3], k1=a[a.length-2], k2=a[a.length-1];
      const ok = (k0.kind==='mask') && (k1.kind==='cough' && k1.judge==='perfect') && (k2.kind==='droplet');
      if(ok) st.routeChain++;
    }
  }

  function updateStage(){
    const s = st.elapsedSec;
    const prev = st.stage;
    st.stage = (s >= st.stage3At) ? 3 : (s >= st.stage2At) ? 2 : 1;

    if(st.stage !== prev){
      if(st.stage===2){
        toast('🌀 Trick Phase!');
        showPrompt('Trick: รอ 🤧 ให้ Perfect + ระวัง 🦠');
        logger.push({type:'stage', stage:2});
        sfxBoss(); // little hype
      }
      if(st.stage===3){
        st.bossSweepOn = true;
        st.bossSweepGotPerfect = 0;
        st.bossSweepNeedPerfect = (diff==='hard' ? 3 : 2);
        setBossBanner(true, `👿 BOSS SWEEP! Perfect ${st.bossSweepNeedPerfect} ครั้ง`);
        toast('👿 BOSS SWEEP!');
        shake();
        sfxBoss();
        logger.push({type:'bossSweep:start', need: st.bossSweepNeedPerfect});
      }
    }
    if(st.stage !== 3){
      setBossBanner(false);
      st.bossSweepOn = false;
    }
  }

  // FUN mission triggers
  function checkWarmMission(){
    if(st.stage!==1 || st.warmDone) return;
    if(st.streak >= st.warmNeedStreak){
      st.warmDone = true;
      st.score += 8;
      st.shield = clamp(st.shield + 10, 0, 100);
      st.focus = clamp(st.focus + 8, 0, 100);
      toast('✅ Warm Mission PASS! +Bonus');
      sfxPerfect();
      logger.push({type:'mission:warm_end', pass:true});
    }
  }
  function checkTrickMission(){
    if(st.stage!==2 || st.trickDone) return;
    if(st.trickPerfectGot >= st.trickNeedPerfect){
      st.trickDone = true;
      st.score += 10;
      st.focus = clamp(st.focus + 12, 0, 100);
      toast('✅ Trick Mission PASS! +Bonus');
      sfxPerfect();
      logger.push({type:'mission:trick_end', pass:true});
    }
  }

  function pickKind(){
    const feverOn=!!director.feverOn;
    const inten=director.intensity||0;
    const ap=ai.assistParams();

    let wDroplet=0.58, wCough=0.24, wMask=0.18;

    wCough += inten*0.16;
    wDroplet -= inten*0.10;

    if(st.stage===1){ wDroplet += 0.10; wCough -= 0.08; }
    if(st.stage===2){ wCough += 0.08; }
    if(st.stage===3){ wCough += 0.22; wDroplet -= 0.16; wMask += 0.06; }

    if(st.threat==='HIGH'){ wCough += 0.14; wMask += 0.06; wDroplet -= 0.12; }
    else if(st.threat==='MID'){ wCough += 0.06; wDroplet -= 0.05; }

    wMask += ap.maskBonus;
    wCough -= ap.coughPenalty;
    wMask += (st.shield < 35 ? 0.10 : 0.00);

    if(feverOn){ wDroplet += 0.10; wMask -= 0.06; }

    wDroplet=Math.max(0.30,wDroplet);
    wCough=Math.max(0.10,wCough);
    wMask=Math.max(0.08,wMask);

    const sum=wDroplet+wCough+wMask;
    wDroplet/=sum; wCough/=sum; wMask/=sum;

    const r=rng();
    if(r < wDroplet) return 'droplet';
    if(r < wDroplet + wCough) return (st.stage===3 && rng()<0.30) ? 'boss' : 'cough';
    return 'mask';
  }

  function spawnAt(kind, x, y, ttlMs){
    if(!st.running || st.over || st.paused) return;

    const id=String(++st.uid);
    const el=DOC.createElement('div');
    el.className=cssClass(kind);
    el.textContent=emoji(kind);
    el.style.left=x+'px';
    el.style.top=y+'px';
    el.dataset.id=id;
    el.dataset.kind=kind;

    const born=performance.now();
    const die=born+ttlMs;

    let armAtMs=0, perfectAtMs=0;
    if(kind==='cough' || kind==='boss'){
      armAtMs = die - Math.max(240, Math.round(ttlMs*0.30));
      perfectAtMs = die - Math.max(120, st.perfectBaseMs);
      el.classList.add('tele');
    }

    st.targets.set(id, {el, kind, bornMs:born, dieMs:die, x, y, armAtMs, perfectAtMs});

    el.addEventListener('pointerdown', (ev)=>{
      if(view==='cvr') return;
      ev.preventDefault();
      handleHit(id,'tap');
    }, {passive:false});

    layer.appendChild(el);
    logger.push({type:'spawn', kind, id, x:Math.round(x), y:Math.round(y), ttlMs:Math.round(ttlMs)});
  }

  function removeTarget(id, popped){
    const it=st.targets.get(id);
    if(!it) return;
    st.targets.delete(id);
    const el=it.el;
    if(!el) return;

    if(popped){
      el.classList.add('pop');
      el.classList.add('fade');
      setTimeout(()=>{ try{el.remove();}catch(_){} }, 220);
    }else{
      el.classList.add('fade');
      setTimeout(()=>{ try{el.remove();}catch(_){} }, 220);
    }
  }

  function burstClear(n){
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='droplet' || v.kind==='infected');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const [id] = arr[Math.floor(rng()*arr.length)];
      handleHit(id, 'burst');
    }
  }

  function coughShockwave(x,y){
    const radius=130;
    for(const [id, it] of st.targets){
      if(it.kind!=='droplet') continue;
      const dx=it.x-x, dy=it.y-y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<=radius){
        removeTarget(id,false);
        spawnAt('infected', it.x, it.y, Math.max(560, Math.round(st.ttlBaseMs*0.72)));
      }
    }
    fxShockwave(x,y);
    flashBad();
    toast('🤧 Shockwave!');
    shake();
  }

  function antiSpamOnAction(){
    const t=performance.now();
    const dt = t - (st.lastActionMs||0);
    st.lastActionMs = t;
    st.actionCount++;

    if(dt>0 && dt<140){
      st.spam++;
      st.focus = clamp(st.focus - 6, 0, 100);
      st.risk = Math.min(0.98, st.risk + 0.03);
      popScore(layerRect().width*0.5, layerRect().height*0.80, 'SPAM!', 'bad');
      sfxBad();
    }else{
      st.focus = clamp(st.focus + 1.1, 0, 100);
    }
  }

  function hitCountForAnalyze(kind, judge){
    if(judge!=='hit' && judge!=='perfect') return;
    const z = riskZone();
    if(z==='SAFE') st.safeHits++;
    else if(z==='RISK') st.riskHits++;
    else st.dangerHits++;
    updateRouteChain(kind, judge);
  }

  function handleHit(id, why){
    const it=st.targets.get(id);
    if(!it || st.over || st.paused) return;

    antiSpamOnAction();

    const t=performance.now();
    const remain=it.dieMs - t;

    const r=layerRect();
    const fxX = r.left + it.x;
    const fxY = r.top + it.y;

    removeTarget(id,true);

    const ap=ai.assistParams();
    const perfectWindow=Math.round(st.perfectBaseMs*(1+ap.perfectBoost));

    let judge='hit';
    let scoreDelta = 0;

    if(it.kind==='droplet'){
      scoreDelta += director.feverOn ? 2 : 1;
      st.streak += 1;

      const ttlApprox=st.ttlBaseMs;
      const isPerfect = remain > ttlApprox*0.55;

      if(isPerfect){
        scoreDelta += 1;
        st.perfect += 1;
        judge='perfect';
        fun?.onAction?.({type:'perfect'});
        ai.onEvent({type:'perfect', kind:'droplet', latencyMs:t - it.bornMs});
        freeze(140);
        sfxPerfect();
      }else{
        judge='hit';
        fun?.onAction?.({type:'hit'});
        ai.onEvent({type:'hit', kind:'droplet', latencyMs:t - it.bornMs});
        sfxHit();
      }

      fxSpark(fxX, fxY);
      popScore(fxX, fxY, `+${scoreDelta}`, director.feverOn ? 'pro' : 'good');

      if(director.feverOn && rng()<0.24) burstClear(1);

    } else if(it.kind==='infected'){
      st.miss += 1;
      st.streak = 0;
      scoreDelta -= 2;
      st.shield = clamp(st.shield - 10, 0, 100);

      st.focus = clamp(st.focus - 10, 0, 100);
      st.risk = Math.min(0.98, st.risk + 0.06);

      judge='bad_hit';
      flashBad();
      toast('🦠 โดนเชื้อ!');
      sfxBad();
      ai.onEvent({type:'hit', kind:'infected', latencyMs:t - it.bornMs});
      fxShockwave(fxX, fxY);
      popScore(fxX, fxY, `${scoreDelta}`, 'bad');

    } else if(it.kind==='mask'){
      st.shield = clamp(st.shield + (director.feverOn?16:14), 0, 100);
      scoreDelta += 1;
      st.streak += 1;
      st.focus = clamp(st.focus + 4, 0, 100);
      judge='hit';

      toast('🛡️ Shield +');
      sfxHit();
      fun?.onAction?.({type:'hit'});
      ai.onEvent({type:'hit', kind:'mask', latencyMs:t - it.bornMs});
      fxSpark(fxX, fxY);
      popScore(fxX, fxY, '+1', 'good');

    } else if(it.kind==='cough' || it.kind==='boss'){
      const isPerfect = (t >= it.perfectAtMs) || (remain <= perfectWindow);

      if(isPerfect){
        scoreDelta += (it.kind==='boss' ? (diff==='hard'?9:7) : (diff==='hard'?7:5));
        st.streak += 1;
        st.perfect += 1;
        judge='perfect';

        st.focus = clamp(st.focus + 12, 0, 100);
        st.risk = Math.max(0.05, st.risk - 0.08);

        toast('✨ Perfect Block!');
        sfxPerfect();
        fun?.onAction?.({type:'perfect'});
        ai.onEvent({type:'perfect', kind:it.kind, latencyMs:t - it.bornMs});
        fxConfettiBurst(fxX, fxY);
        popScore(fxX, fxY, `+${scoreDelta}`, 'pro');

        freeze(180);
        shake();

        if(st.bossActive) st.bossNeedPerfect=false;
        if(st.bossSweepOn) st.bossSweepGotPerfect++;
        if(st.stage===2) st.trickPerfectGot++;

      }else{
        scoreDelta += 2;
        st.streak += 1;
        st.focus = clamp(st.focus + 2, 0, 100);
        judge='hit';

        sfxHit();
        fun?.onAction?.({type:'hit'});
        ai.onEvent({type:'hit', kind:it.kind, latencyMs:t - it.bornMs});
        fxSpark(fxX, fxY);
        popScore(fxX, fxY, '+2', 'good');
      }
    }

    st.score = Math.max(0, st.score + scoreDelta);
    st.maxStreak = Math.max(st.maxStreak, st.streak);

    hitCountForAnalyze(it.kind, judge);
    updateThreat();
    checkWarmMission();
    checkTrickMission();

    if(director.feverOn && rng()<0.10) burstClear(1);

    if(performance.now() - st.lastMissWindowAt > 5000){
      st.missRecent = 0;
      st.coughMissRecent = 0;
      st.lastMissWindowAt = performance.now();
    }

    logger.push({
      type:'hha:judge',
      judge,
      kind: it.kind,
      why,
      remainMs: Math.round(remain),
      score: st.score,
      scoreDelta,
      streak: st.streak,
      miss: st.miss,
      shield: Math.round(st.shield),
      risk: +st.risk.toFixed(3),
      threat: st.threat,
      focus: Math.round(st.focus),
      spam: st.spam,
      zone: riskZone(),
      stage: st.stage
    });

    setHud();
    if(st.shield <= 0) endGame('shield');
  }

  function timeoutTarget(id){
    const it=st.targets.get(id);
    if(!it || st.over || st.paused) return;

    removeTarget(id,false);

    const t=performance.now();
    const r=layerRect();
    const fxX = r.left + it.x;
    const fxY = r.top + it.y;

    let judge='timeout';

    if(it.kind==='droplet'){
      st.miss += 1; st.streak = 0;
      st.score = Math.max(0, st.score - 1);
      st.shield = clamp(st.shield - 6, 0, 100);
      st.focus = clamp(st.focus - 5, 0, 100);
      st.risk = Math.min(0.98, st.risk + 0.03);

      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:'droplet', latencyMs:t - it.bornMs});
      popScore(fxX, fxY, '-1', 'bad');
      sfxBad();

    } else if(it.kind==='infected'){
      st.score += 1;
      st.focus = clamp(st.focus + 1, 0, 100);
      judge='avoid';
      fun?.onAction?.({type:'hit'});
      ai.onEvent({type:'timeout', kind:'infected', latencyMs:t - it.bornMs});

    } else if(it.kind==='mask'){
      st.miss += 1; st.streak = 0;
      st.focus = clamp(st.focus - 4, 0, 100);
      st.risk = Math.min(0.98, st.risk + 0.02);
      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:'mask', latencyMs:t - it.bornMs});

    } else if(it.kind==='cough' || it.kind==='boss'){
      st.miss += 1; st.streak = 0;
      st.shield = clamp(st.shield - (it.kind==='boss'?22:16), 0, 100);
      st.score = Math.max(0, st.score - 2);

      st.focus = clamp(st.focus - 12, 0, 100);
      st.risk = Math.min(0.98, st.risk + 0.06);

      toast('😷 โดนละอองไอ!');
      flashBad();
      coughShockwave(fxX, fxY);
      popScore(fxX, fxY, '-2', 'bad');
      sfxBad();

      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:it.kind, latencyMs:t - it.bornMs});
    }

    if(t - st.lastMissWindowAt > 5000){
      st.missRecent = 0;
      st.coughMissRecent = 0;
      st.lastMissWindowAt = t;
    }
    st.missRecent++;
    if(it.kind==='cough' || it.kind==='boss') st.coughMissRecent++;

    updateThreat();

    logger.push({
      type:'hha:judge',
      judge,
      kind: it.kind,
      why:'timeout',
      score: st.score,
      streak: st.streak,
      miss: st.miss,
      shield: Math.round(st.shield),
      risk: +st.risk.toFixed(3),
      threat: st.threat,
      focus: Math.round(st.focus),
      spam: st.spam,
      zone: riskZone(),
      stage: st.stage
    });

    setHud();
    if(st.shield <= 0) endGame('shield');
  }

  // cVR shoot
  function pickTargetAt(x, y){
    let bestId=null, bestD=1e9;
    const rad=58;
    for(const [id, it] of st.targets){
      const dx=it.x-x, dy=it.y-y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<=rad && d<bestD){ bestD=d; bestId=id; }
    }
    return bestId;
  }
  function onShoot(ev){
    if(!st.running || st.over || st.paused) return;
    if(view!=='cvr') return;

    const r=layerRect();
    const x = clamp((ev?.detail?.x ?? (r.left+r.width/2)) - r.left, 0, r.width);
    const y = clamp((ev?.detail?.y ?? (r.top+r.height/2)) - r.top, 0, r.height);

    const id=pickTargetAt(x,y);
    if(id) handleHit(id,'shoot');
  }
  WIN.addEventListener('hha:shoot', onShoot);

  // timers
  let spawnTimer=null, tickTimer=null;

  function scheduleSpawn(){
    if(spawnTimer) clearTimeout(spawnTimer);
    if(!st.running || st.over || st.paused) return;

    const ap=ai.assistParams();
    let base=st.baseSpawnMs;

    if(st.stage===1) base *= 1.08;
    if(st.stage===2) base *= 0.96;
    if(st.stage===3) base *= 0.86;

    base *= (st._ramp || 1.0);

    const now = performance.now();
    if(now < (st.freezeUntil||0)) base *= 1.25;
    if(mode==='play' && st.focus < 30) base *= 1.10;

    const every = fun ? fun.scaleIntervalMs(base, director) : base;
    const eff = Math.max(220, Math.round(every*(1+ap.spawnSlow)));

    spawnTimer=setTimeout(()=>{
      spawn();
      scheduleSpawn();
    }, eff);
  }

  function spawn(){
    if(!st.running || st.over || st.paused) return;

    const r=layerRect();
    const pad=52;
    const x = pad + rng() * Math.max(10,(r.width - pad*2));
    const y = pad + rng() * Math.max(10,(r.height - pad*2));

    const ap=ai.assistParams();

    const ratio = clamp01(st.elapsedSec / Math.max(1, timeLimit));
    const ramp = (diff==='hard') ? (1 - 0.16*ratio) : (diff==='normal') ? (1 - 0.10*ratio) : (1 - 0.06*ratio);
    st._ramp = ramp;

    const ttlMs=Math.round(st.ttlBaseMs*(director.timeScale||1)*(1+ap.ttlBoost) * (diff==='hard' ? 0.98 : 1.0));

    if(st.bossActive){
      spawnAt('boss', x, y, Math.max(760, Math.round(ttlMs*0.82)));
      return;
    }

    let kind = pickKind();
    if(kind==='droplet' && !director.feverOn && st.stage>=2 && (director.intensity||0) > 0.55 && rng() < 0.22){
      kind='infected';
    }
    spawnAt(kind, x, y, ttlMs);
  }

  function maybeBoss(now){
    if(!st.running || st.over || st.paused) return;
    if(st.bossActive) return;

    if(now >= st.nextBossAt){
      st.bossActive=true;
      st.bossNeedPerfect=true;
      showPrompt('👿 MINI BOSS! ทำ Perfect อย่างน้อย 1 ครั้ง!');
      toast('BOSS INCOMING');
      shake();
      sfxBoss();
      logger.push({type:'boss:start'});

      const bossDur = (diff==='hard'?3200:3800);
      const endAt = now + bossDur;

      const bossTick=()=>{
        const t=performance.now();
        if(t>=endAt || st.over || st.paused){
          st.bossActive=false;

          if(st.bossNeedPerfect){
            st.shield=clamp(st.shield-18,0,100);
            st.score=Math.max(0, st.score-4);
            st.focus = clamp(st.focus - 10, 0, 100);
            st.risk = Math.min(0.98, st.risk + 0.06);
            flashBad();
            toast('❌ บอสไม่ผ่าน!');
            sfxBad();
            logger.push({type:'boss:end', pass:false});
          }else{
            st.shield=clamp(st.shield+12,0,100);
            st.score += 6;
            st.focus = clamp(st.focus + 6, 0, 100);
            st.risk = Math.max(0.05, st.risk - 0.04);
            toast('✅ ผ่านบอส! +Shield');
            sfxPerfect();
            burstClear(2);
            logger.push({type:'boss:end', pass:true});
          }
          setHud();
          st.nextBossAt = performance.now() + st.bossEveryMs;
          return;
        }
        setTimeout(bossTick, 160);
      };
      bossTick();
    }
  }

  const LS_LAST='HHA_LAST_SUMMARY';
  const LS_HIST='HHA_SUMMARY_HISTORY';

  function saveSummary(sum){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify(sum));
      const arr = JSON.parse(localStorage.getItem(LS_HIST)||'[]');
      arr.push(sum);
      while(arr.length>60) arr.shift();
      localStorage.setItem(LS_HIST, JSON.stringify(arr));
    }catch(_){}
  }

  function computeAnalyzeScore(){
    const hitTotal = Math.max(1, st.safeHits + st.riskHits + st.dangerHits);
    const perfectRate = st.perfect / Math.max(1,(st.safeHits+st.riskHits+st.dangerHits));
    const spamRate = st.spam / Math.max(1, st.actionCount);
    const dangerOveruse = st.dangerHits / hitTotal;

    let score = 0;
    score += Math.round(100 * (0.44*perfectRate + 0.18*(1-spamRate) + 0.18*(1-dangerOveruse) + 0.20*clamp01(st.routeChain/6)));
    if(st.stage===3 && st.bossSweepGotPerfect < st.bossSweepNeedPerfect) score = Math.max(0, score-14);

    return {
      analyzeScore: score,
      dangerOverusePct: Math.round(dangerOveruse*100),
      spamRatePct: Math.round(spamRate*100),
      perfectRatePct: Math.round(perfectRate*100)
    };
  }

  function makeBadges(){
    const b=[];
    if(st.perfect>=4) b.push({id:'PERFECT_4', label:'✨ Perfect x4'});
    if(st.maxStreak>=14) b.push({id:'STREAK_14', label:'🔥 Streak 14'});
    if(st.spam<=3) b.push({id:'CALM_HAND', label:'🧠 Calm Hand'});
    if(st.routeChain>=2) b.push({id:'ROUTE_READER', label:'🧭 Route Reader'});

    const crown = (st.bossSweepGotPerfect >= st.bossSweepNeedPerfect);
    if(crown) b.unshift({id:'CROWN', label:'👑 Crown Clear', crown:true});
    return b;
  }

  function renderEnd(reason){
    const set=(id,v)=>{ const el=byId(id); if(el) el.textContent=String(v); };
    set('tEndReason', reason);
    set('sScore', st.score);
    set('sMaxStreak', st.maxStreak);
    set('sMiss', st.miss);
    set('sPerfect', st.perfect);
    set('sShield', Math.round(st.shield)+'%');
    set('sRisk', (ai.riskAvg()?ai.riskAvg():st.risk).toFixed(2));

    const an = computeAnalyzeScore();
    set('sAnalyzeScore', an.analyzeScore);
    set('sDangerOveruse', an.dangerOverusePct + '%');
    set('sSpamRate', an.spamRatePct + '%');

    const badgeRow=byId('badgeRow');
    const badges=makeBadges();
    if(badgeRow){
      badgeRow.innerHTML = badges.length
        ? badges.map(x=>`<span class="mc-badge-chip ${x.crown?'crown':''}">${x.label}</span>`).join('')
        : `<span class="mc-badge-chip">🙂 Keep going</span>`;
    }

    const coachSum=byId('endCoachSummary');
    if(coachSum){
      const reasons = ai.topReasons({
        shield: st.shield,
        spam: st.spam,
        focus: st.focus,
        missRecent: st.missRecent,
        coughMissRecent: st.coughMissRecent
      });
      coachSum.textContent = reasons.length
        ? `เหตุผลที่เสี่ยงสูง (Top 2): ${reasons.join(' + ')}`
        : 'ทำได้ดีมาก — รอ Perfect และอย่ายิงรัว';
    }

    const note=byId('endNote');
    if(note){
      note.textContent =
`pid=${pid} | diff=${diff} | mode=${mode} | view=${view} | time=${timeLimit}s | seed=${seed}
warm=${st.warmDone?'PASS':'—'} | trick=${st.trickDone?'PASS':'—'} | bossPerfect=${st.bossSweepGotPerfect}/${st.bossSweepNeedPerfect}
riskAvg=${(ai.riskAvg?ai.riskAvg():st.risk).toFixed(2)} | spam=${st.spam} | route=${st.routeChain}
snd=${FX.sndOn?1:0} vib=${FX.vibOn?1:0} log=${logEndpoint||'—'}`;
    }

    byId('end').hidden=false;
    applyHubLink(byId('btnEndBack'));
  }

  function clearAllTargets(){
    for(const [id] of st.targets){
      const it = st.targets.get(id);
      if(it?.el) it.el.remove();
    }
    st.targets.clear();
  }

  function startGame(){
    // wake audio (must be user gesture)
    ensureAudio();

    byId('end').hidden=true;

    st.running=true; st.paused=false; st.over=false;
    st.t0=performance.now();
    st.elapsedSec=0;

    st.score=0; st.streak=0; st.maxStreak=0; st.miss=0; st.perfect=0;
    st.safeHits=0; st.riskHits=0; st.dangerHits=0;
    st.routeChain=0; st.spam=0; st.actionCount=0;
    st.focus=100; st.lastActionMs=0;

    st.threat='LOW'; st.threatValue=0;
    st.risk = 0.12;

    st.stage=1;
    st.stage2At = (diff==='easy' ? 22 : diff==='hard' ? 18 : 20);
    st.stage3At = Math.max(45, timeLimit - (diff==='hard' ? 14 : 16));
    st.bossSweepOn=false;
    st.bossSweepNeedPerfect = (diff==='hard' ? 3 : 2);
    st.bossSweepGotPerfect=0;

    st.warmNeedStreak = (diff==='easy' ? 7 : diff==='hard' ? 9 : 8);
    st.warmDone=false;
    st.trickNeedPerfect = (diff==='easy' ? 2 : diff==='hard' ? 3 : 2);
    st.trickPerfectGot=0;
    st.trickDone=false;

    setBossBanner(false);

    st.shield = (diff==='easy' ? 46 : diff==='hard' ? 38 : 40);

    st.missRecent=0; st.coughMissRecent=0; st.lastMissWindowAt=performance.now();
    st.freezeUntil = 0;

    clearAllTargets();

    director = fun ? fun.tick() : director;
    ai.reset();

    st.nextBossAt = performance.now() + st.bossEveryMs;
    st.bossActive=false;
    st.bossNeedPerfect=false;

    toast('เริ่ม! ทำภารกิจให้ครบ แล้วลุยบอสท้ายเกม');
    showPrompt(view==='cvr'
      ? '🎯 cVR: ยิงด้วยกากบาท — รอ 🤧 ให้เข้า Perfect!'
      : 'แตะ 💦 ทำ streak • แตะ 😷 เพิ่มโล่ • รอ 🤧 ให้ Perfect!'
    );
    setHud();

    logger.push({type:'hha:start', seed, diff, mode, view, timePlannedSec:timeLimit});
    scheduleSpawn();

    if(tickTimer) clearInterval(tickTimer);
    tickTimer=setInterval(tick, 80);
  }

  function togglePause(){
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    if(st.paused){
      toast('⏸ Pause');
      logger.push({type:'pause', on:true});
    }else{
      toast('▶ Resume');
      st.nextBossAt = performance.now() + 9000;
      logger.push({type:'pause', on:false});
      scheduleSpawn();
    }
  }

  async function endGame(reason){
    if(st.over) return;
    st.over=true; st.running=false; st.paused=false;

    if(spawnTimer) clearTimeout(spawnTimer);
    if(tickTimer) clearInterval(tickTimer);

    clearAllTargets();
    setBossBanner(false);

    const an = computeAnalyzeScore();

    const sum = {
      game:'maskcough',
      ts:Date.now(),
      pid, studyId, phase, conditionGroup,
      hub, diff, mode, view, seed,
      timePlannedSec: timeLimit,
      timePlayedSec: Math.round(st.elapsedSec*10)/10,
      score: st.score,
      streakMax: st.maxStreak,
      miss: st.miss,
      perfect: st.perfect,
      shieldEnd: Math.round(st.shield),
      riskAvg: Math.round((ai.riskAvg?ai.riskAvg():st.risk)*100)/100,
      threatEnd: st.threat,
      focusEnd: Math.round(st.focus),
      spam: st.spam,
      routeChain: st.routeChain,
      safeHits: st.safeHits,
      riskHits: st.riskHits,
      dangerHits: st.dangerHits,
      warmDone: st.warmDone,
      trickDone: st.trickDone,
      trickPerfectGot: st.trickPerfectGot,
      bossSweepPerfect: st.bossSweepGotPerfect,
      bossSweepNeed: st.bossSweepNeedPerfect,
      analyzeScore: an.analyzeScore,
      dangerOverusePct: an.dangerOverusePct,
      spamRatePct: an.spamRatePct,
      perfectRatePct: an.perfectRatePct,
      reason
    };

    saveSummary(sum);
    logger.push({type:'hha:end', ...sum});
    await logger.flush('end');

    toast(reason==='time' ? 'ครบเวลา!' : 'Shield หมด!');
    renderEnd(reason);
  }

  // tick
  let lastFeatures = 0;

  function tick(){
    if(!st.running || st.over || st.paused) return;

    director = fun ? fun.tick() : director;

    const now=performance.now();
    st.elapsedSec = (now - st.t0)/1000;

    updateStage();

    for(const [id, it] of st.targets){
      if(it.kind==='cough' || it.kind==='boss'){
        if(now >= it.armAtMs) it.el.classList.add('armed');
        if(now >= it.perfectAtMs) it.el.classList.add('perfect');
      }
      if(now >= it.dieMs) timeoutTarget(id);
    }

    maybeBoss(now);

    if(st.stage===3){
      st.risk = Math.min(0.98, st.risk + 0.002);
      if(st.focus < 35) st.focus = clamp(st.focus + 0.6, 0, 100);
    }

    st.risk = ai.onTick(now, st.shield, st.focus, st.spam);
    updateThreat();

    const hint = ai.coachHint(now, {
      shield: st.shield,
      spam: st.spam,
      focus: st.focus,
      missRecent: st.missRecent,
      coughMissRecent: st.coughMissRecent,
      stage: st.stage,
      bossSweepGot: st.bossSweepGotPerfect,
      bossSweepNeed: st.bossSweepNeedPerfect,
      mission: {
        need:true,
        done: (st.stage===1?st.warmDone:st.stage===2?st.trickDone:false),
        text: (st.stage===1?`streak ${st.warmNeedStreak}`:st.stage===2?`perfect ${st.trickNeedPerfect}`:'boss perfect')
      }
    });
    if(hint){ showPrompt(hint); logger.push({type:'hha:coach', msg:hint}); }

    if(((now - st.t0) % 1000) < 90){
      logger.push({
        type:'hha:time',
        t: +st.elapsedSec.toFixed(2),
        score: st.score,
        miss: st.miss,
        shield: +st.shield.toFixed(1),
        risk: +st.risk.toFixed(3),
        threat: st.threat,
        focus: Math.round(st.focus),
        spam: st.spam,
        stage: st.stage
      });
    }

    if(now - lastFeatures > 4950){
      lastFeatures = now;
      logger.push({
        type:'ai:features',
        risk:+st.risk.toFixed(4),
        threat: st.threat,
        focus: Math.round(st.focus),
        spam: st.spam,
        miss: st.miss,
        streak: st.streak,
        shield: Math.round(st.shield),
        perfect: st.perfect,
        stage: st.stage,
        warmDone: st.warmDone,
        trickDone: st.trickDone,
        bossSweepGot: st.bossSweepGotPerfect,
        bossSweepNeed: st.bossSweepNeedPerfect
      });
    }

    if(st.elapsedSec >= timeLimit){
      if(st.stage===3 && st.bossSweepGotPerfect < st.bossSweepNeedPerfect){
        st.score = Math.max(0, st.score - 6);
      }
      endGame('time'); return;
    }
    if(st.shield <= 0){ endGame('shield'); return; }

    setHud();
  }

  // bind buttons
  const btnStart=byId('btnStart');
  const btnRetry=byId('btnRetry');
  const btnPause=byId('btnPause');
  const btnBack=byId('btnBack');
  const btnEndRetry=byId('btnEndRetry');

  if(btnStart) btnStart.addEventListener('click', startGame, {passive:true});
  if(btnRetry) btnRetry.addEventListener('click', startGame, {passive:true});
  if(btnPause) btnPause.addEventListener('click', togglePause, {passive:true});
  if(btnEndRetry) btnEndRetry.addEventListener('click', startGame, {passive:true});

  if(btnBack) btnBack.addEventListener('click', ()=>{
    try{
      const u=new URL(hub||'../hub.html', location.href);
      u.searchParams.set('pid', pid);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);
      location.href=u.toString();
    }catch(_){
      location.href = hub || '../hub.html';
    }
  }, {passive:true});

  // init
  setHud();
  showPrompt(view==='cvr'
    ? '🎯 cVR: ยิงด้วยกากบาท — รอ 🤧 ให้เข้า Perfect!'
    : 'แตะ 💦 ทำ streak • แตะ 😷 เพิ่มโล่ • รอ 🤧 ให้ Perfect!'
  );

})();