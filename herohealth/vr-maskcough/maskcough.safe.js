// === /herohealth/vr-maskcough/maskcough.safe.js ===
// MaskCough SAFE Engine — FUN+FX + AI Prediction (ML/DL hooks) + HHA Research Logging
// v20260219a (FULL PATCH 1–4)
// ✅ HOT STREAK 10s (addictive)
// ✅ Decision Fork A/B (Analyze trade-off)
// ✅ Critical replay note (3s moment text) + threatMax + chainPanic
// ✅ Summary metrics & HUD wave=HOT
//
// URL params:
// ?hub=...&pid=...&seed=...&diff=easy|normal|hard&time=60
// &mode=play|study (or run=...)
// &view=pc|mobile|cvr
// &log=https://endpoint
// &studyId&phase&conditionGroup

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const $ = (s)=>DOC.querySelector(s);

  // ---------------- utils ----------------
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const clamp01=(x)=>clamp(x,0,1);

  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }
  function getQS(){ try{return new URL(location.href).searchParams;}catch(_){return new URLSearchParams();} }

  function getViewAuto(){
    const qs=getQS();
    const v=(qs.get('view')||'').toLowerCase(); if(v) return v;
    const ua=navigator.userAgent||'';
    const isMobile=/Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }

  // deterministic RNG (mulberry32-like)
  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1100);
  }
  function showPrompt(msg){
    const el = $('#mc-prompt');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showPrompt._t);
    showPrompt._t = setTimeout(()=> el.classList.remove('show'), 950);
  }

  function flashBad(){
    const el = $('#mc-flash');
    if(!el) return;
    el.style.opacity='1';
    clearTimeout(flashBad._t);
    flashBad._t=setTimeout(()=> el.style.opacity='0', 110);
  }

  // ---------------- context ----------------
  const qs = getQS();
  const hub = (qs.get('hub')||'../hub.html').trim();
  const pid = (qs.get('pid')||qs.get('participantId')||'').trim();
  const diff = (qs.get('diff')||'normal').trim();
  const seedParam = (qs.get('seed')||pid||'maskcough').trim();
  const mode = (qs.get('mode')||qs.get('run')||'play').trim(); // play|study
  const view = getViewAuto();
  const timeLimit = Math.max(20, parseInt(qs.get('time')||'60',10));
  const logEndpoint = (qs.get('log')||'').trim();

  const studyId = (qs.get('studyId')||'').trim();
  const phase = (qs.get('phase')||'').trim();
  const conditionGroup = (qs.get('conditionGroup')||'').trim();

  const seed = (safeNum(seedParam, Date.now()) >>> 0);

  const wrap = $('#mc-wrap');
  const layer = $('#layer');

  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.run = mode;
  }

  // hub links
  function applyHubLink(a){
    if(!a) return;
    try{
      const u = new URL(hub, location.href);
      if(pid) u.searchParams.set('pid', pid);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);
      a.href = u.toString();
    }catch(_){
      a.href = hub || '../hub.html';
    }
  }
  applyHubLink($('#btnEndBack'));

  // ---------------- HHA logger (flush-hardened) ----------------
  function createLogger(ctx){
    const q = [];
    let seq = 0;
    let sessionId = 'mc_' + (Date.now().toString(36)) + '_' + Math.random().toString(36).slice(2,8);

    function base(ev){
      return {
        v: 1,
        game: 'maskcough',
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
        href: location.href.split('#')[0],
        type: ev.type
      };
    }

    function push(ev){
      q.push({ ...base(ev), ...ev });
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
        await fetch(ctx.log, {
          method:'POST',
          headers:{'content-type':'text/plain'},
          body,
          keepalive:true
        });
      }catch(_){}
    }

    return { sessionId, push, flush };
  }

  const ctx = {
    pid, hub, diff, mode, view, seed,
    timePlannedSec: timeLimit,
    log: logEndpoint,
    studyId, phase, conditionGroup
  };
  const logger = createLogger(ctx);

  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden'){
      logger.flush('unload');
    }
  });
  WIN.addEventListener('beforeunload', ()=> logger.flush('unload'));

  // ---------------- Fun Boost (optional) ----------------
  const fun = WIN.HHA?.createFunBoost?.({
    seed: String(seed),
    baseSpawnMul: 1.0,
    waveCycleMs: 18000,
    feverThreshold: 16,
    feverDurationMs: 6500,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });
  let director = fun ? fun.tick() : {spawnMul:1,timeScale:1,wave:'calm',intensity:0,feverOn:false};

  // ---------------- AI Prediction (ML/DL hooks) ----------------
  function sigmoid(x){
    if(x >= 0){ const z=Math.exp(-x); return 1/(1+z); }
    const z=Math.exp(x); return z/(1+z);
  }
  function nz(v, lo, hi){ return clamp01((v - lo) / (hi - lo)); }

  function createRiskModel(){
    const w=[2.2,1.6,2.0,1.3,1.4,1.0,0.8], b=-1.4;
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
      maxAssist: 0.45,
      coachCooldownMs: 8500,
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

    function onTick(nowMs, shield){
      stA.shieldNow=shield;
      stA.riskSum += stA.risk; stA.riskN++;

      if(!cfg.enabled) return stA.risk;

      if(nowMs - stA.lastT >= cfg.windowMs){
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

        stA.risk = cfg.alpha*stA.risk + (1-cfg.alpha)*r;

        stA.taps=stA.hits=stA.timeouts=0;
        stA.coughTimeouts=0; stA.perfects=0;
        stA.latencySum=0; stA.latencyN=0;
        stA.lastT=nowMs;

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
        coughPenalty:0.14*a,
        spawnSlow:0.18*a,
        ttlBoost:0.14*a,
        perfectBoost:0.20*a,
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

    function coachHint(nowMs, state){
      if(!cfg.enabled) return null;
      if(nowMs - stA.coachT < cfg.coachCooldownMs) return null;
      if(stA.risk < 0.42 && state.shield > 34) return null;

      stA.coachT = nowMs;

      if(state.shield < 22) return '⚠️ โล่ใกล้หมด! รีบเก็บ 😷 เพิ่ม Shield ก่อน';
      if(stA.risk > 0.70) return '🎯 โฟกัส 🤧 ตอนท้าย ๆ เพื่อ Perfect Block (คะแนนพุ่ง!)';
      if(state.miss >= 6) return '💦 อย่าให้ละอองหลุดเยอะ—ตี 💦 ให้ทันก่อน!';
      return '✨ สะสม streak แล้วจะเข้า FEVER/HOT ได้เร็วขึ้น!';
    }

    function riskAvg(){ return stA.riskN ? (stA.riskSum/stA.riskN) : stA.risk; }

    return { reset, onTick, onEvent, assistParams, coachHint, riskAvg, get risk(){return stA.risk;} };
  }

  const aiEnabled = (mode === 'play'); // play ON, study OFF
  const ai = createAIDirector({ enabled: aiEnabled, enableDL: aiEnabled });

  // ---------------- FX heavy (DOM) ----------------
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
    el.style.left=(x-6)+'px';
    el.style.top=(y-6)+'px';
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

  function fxFeverGlow(on){
    if(!wrap) return;
    wrap.style.filter = on ? 'saturate(1.12) brightness(1.05)' : '';
  }

  // ---------------- state ----------------
  const rng = seededRng(seed);

  const st = {
    running:false, paused:false, over:false,
    t0:0, elapsedSec:0,

    score:0, streak:0, maxStreak:0, miss:0, perfect:0,
    shield:40,

    baseSpawnMs: (diff==='hard' ? 650 : diff==='easy' ? 880 : 760),
    ttlBaseMs:   (diff==='hard' ? 1450 : diff==='easy' ? 1850 : 1650),
    perfectBaseMs: 220,

    bossEveryMs: (diff==='hard' ? 20000 : diff==='easy' ? 26000 : 23000),
    nextBossAt: 0,
    bossActive:false,
    bossNeedPerfect:false,

    risk: 0.12,

    targets: new Map(),
    uid:0,

    // --- HOT STREAK ---
    hotOn:false,
    hotUntil:0,
    hotCount:0,
    hotTimeMs:0,
    hotScore:0,
    hotNeedStreak: (diff==='hard' ? 10 : diff==='easy' ? 14 : 12),
    hotDurationMs: 10000,
    hotMult: (diff==='hard' ? 1.35 : 1.25),

    // --- Choice / Decision fork ---
    choiceOn:false,
    choiceUntil:0,
    nextChoiceAt:0,
    choiceBuff:'none', // 'A' | 'B' | 'none'
    choiceA:0,
    choiceB:0,

    // --- Replay / Crit ---
    crit: [],
    threatMax: 0,
    chainPanic: 0,
  };

  // HUD elements
  const tScore=$('#tScore'), tStreak=$('#tStreak'), tMiss=$('#tMiss');
  const tMask=$('#tMask'), bMask=$('#bMask');
  const tWave=$('#tWave'), tInt=$('#tInt'), tFever=$('#tFever'), tRisk=$('#tRisk');
  const tFeverPct=$('#tFeverPct'), bFever=$('#bFever');

  function startHot(){
    const now = performance.now();
    if(st.hotOn && now < st.hotUntil) return;
    st.hotOn = true;
    st.hotUntil = now + st.hotDurationMs;
    st.hotCount += 1;
    showPrompt('🔥 HOT STREAK! 10s คะแนนคูณ + สปอว์นถี่ขึ้น');
    toast('🔥 HOT ON');
    logger.push({type:'hot:start', untilMs: Math.round(st.hotUntil)});
    try{ wrap && (wrap.style.boxShadow = '0 0 0 1px rgba(245,158,11,.18), 0 18px 90px rgba(245,158,11,.10)'); }catch(_){}
  }

  function stopHot(reason){
    if(!st.hotOn) return;
    st.hotOn = false;
    logger.push({type:'hot:end', reason:String(reason||'time')});
    try{ wrap && (wrap.style.boxShadow = ''); }catch(_){}
  }

  function setHud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tStreak) tStreak.textContent = String(st.streak);
    if(tMiss) tMiss.textContent = String(st.miss);

    const sh=clamp(st.shield,0,100);
    if(tMask) tMask.textContent = `${Math.round(sh)}%`;
    if(bMask) bMask.style.width = `${sh}%`;

    if(tWave) tWave.textContent = (st.hotOn ? 'HOT' : (director.wave || '—'));
    if(tInt) tInt.textContent = (director.intensity||0).toFixed(2);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    if(tRisk) tRisk.textContent = (st.risk||0).toFixed(2);

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(bFever) bFever.style.width = `${pct}%`;
    if(tFeverPct) tFeverPct.textContent = `${Math.round(pct)}%`;

    fxFeverGlow(!!director.feverOn);
  }

  // Decision Fork UI (optional; won't crash if missing)
  const choiceEl = DOC.getElementById('mc-choice');
  const choiceDesc = DOC.getElementById('mcChoiceDesc');
  const btnChoiceA = DOC.getElementById('btnChoiceA');
  const btnChoiceB = DOC.getElementById('btnChoiceB');

  function showChoice(){
    if(!choiceEl) return;
    st.choiceOn = true;
    st.choiceUntil = performance.now() + 10000;
    choiceEl.hidden = false;

    const a = 'A) 🛡️ Safe Shield: +22% Shield (แต่คะแนนต่อ hit ลดลงนิด)';
    const b = 'B) 🎯 Score Rush: คะแนนคูณเพิ่มชั่วคราว (แต่โทษ miss แรงขึ้น)';
    if(choiceDesc) choiceDesc.textContent = `${a}\n${b}`;
    showPrompt('🧠 เลือกแผน A/B (10s)');
    logger.push({type:'choice:show'});
  }
  function hideChoice(){
    st.choiceOn = false;
    if(choiceEl) choiceEl.hidden = true;
  }
  function pickChoice(which){
    hideChoice();
    st.choiceBuff = which;
    if(which==='A'){ st.choiceA += 1; st.shield = clamp(st.shield + 22, 0, 100); toast('🛡️ Choice A'); }
    if(which==='B'){ st.choiceB += 1; toast('🎯 Choice B'); }
    logger.push({type:'choice:pick', which});
    setHud();
  }
  if(btnChoiceA) btnChoiceA.addEventListener('click', ()=>pickChoice('A'), {passive:true});
  if(btnChoiceB) btnChoiceB.addEventListener('click', ()=>pickChoice('B'), {passive:true});

  function emoji(kind){
    if(kind==='droplet') return '💦';
    if(kind==='cough') return '🤧';
    if(kind==='mask') return '😷';
    if(kind==='infected') return '🦠';
    if(kind==='boss') return '🤧';
    return '🎯';
  }
  function cssClass(kind){
    if(kind==='droplet') return 't good';
    if(kind==='infected') return 't bad';
    if(kind==='cough') return 't cough bad';
    if(kind==='mask') return 't mask';
    if(kind==='boss') return 't cough bad';
    return 't';
  }

  function layerRect(){ return layer.getBoundingClientRect(); }

  function pickKind(){
    const feverOn=!!director.feverOn;
    const inten=director.intensity||0;
    const ap=ai.assistParams();

    let wDroplet=0.60, wCough=0.24, wMask=0.16;

    wCough += inten*0.16;
    wDroplet -= inten*0.10;

    wMask += ap.maskBonus;
    wCough -= ap.coughPenalty;

    wMask += (st.shield < 35 ? 0.10 : 0.00);

    if(feverOn){
      wDroplet += 0.10;
      wMask -= 0.06;
    }

    wDroplet=Math.max(0.34,wDroplet);
    wCough=Math.max(0.10,wCough);
    wMask=Math.max(0.08,wMask);

    const sum=wDroplet+wCough+wMask;
    wDroplet/=sum; wCough/=sum; wMask/=sum;

    const r=rng();
    if(r < wDroplet) return 'droplet';
    if(r < wDroplet + wCough) return 'cough';
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

    st.targets.set(id, {el, kind, bornMs:born, dieMs:die, x, y});

    el.addEventListener('pointerdown', (ev)=>{
      if(view==='cvr') return;
      ev.preventDefault();
      handleHit(id,'tap');
    }, {passive:false});

    layer.appendChild(el);
  }

  function spawn(){
    if(!st.running || st.over || st.paused) return;

    const r=layerRect();
    const pad=52;

    const x = pad + rng() * Math.max(10,(r.width - pad*2));
    const y = pad + rng() * Math.max(10,(r.height - pad*2));

    const ap=ai.assistParams();
    const ttlMs=Math.round(st.ttlBaseMs*(director.timeScale||1)*(1+ap.ttlBoost));

    if(st.bossActive){
      spawnAt('boss', x, y, Math.max(720, Math.round(ttlMs*0.78)));
      return;
    }

    let kind = pickKind();
    if(kind==='droplet' && !director.feverOn && (director.intensity||0) > 0.62 && rng() < 0.18){
      kind='infected';
    }

    spawnAt(kind, x, y, ttlMs);
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
    let mutated = 0;
    for(const [id, it] of st.targets){
      if(it.kind!=='droplet') continue;
      const dx=it.x-x, dy=it.y-y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<=radius){
        mutated++;
        removeTarget(id,false);
        spawnAt('infected', it.x, it.y, Math.max(560, Math.round(st.ttlBaseMs*0.72)));
      }
    }
    st.chainPanic += 1;
    st.crit.push({ t: +st.elapsedSec.toFixed(2), msg: `🤧 Shockwave เปลี่ยน 💦→🦠 x${mutated}` });
    if(st.crit.length>20) st.crit.shift();

    fxShockwave(x,y);
    flashBad();
    toast('🤧 Shockwave!');
  }

  function handleHit(id, why){
    const it=st.targets.get(id);
    if(!it || st.over || st.paused) return;

    const t=performance.now();
    const remain=it.dieMs - t;

    removeTarget(id,true);

    const ap=ai.assistParams();
    const perfectWindow=Math.round(st.perfectBaseMs*(1+ap.perfectBoost));

    const r=layerRect();
    const fxX = r.left + it.x;
    const fxY = r.top + it.y;

    // score multiplier (HOT + Choice)
    let mult = st.hotOn ? st.hotMult : 1.0;
    if(st.choiceBuff==='A') mult *= 0.92;
    if(st.choiceBuff==='B') mult *= 1.10;

    function addScore(n){
      const v = Math.round(n * mult);
      st.score += v;
      if(st.hotOn) st.hotScore += v;
    }

    if(it.kind==='droplet'){
      addScore(director.feverOn ? 2 : 1);
      st.streak += 1;

      const ttlApprox=st.ttlBaseMs;
      if(remain > ttlApprox*0.55){
        addScore(1);
        st.perfect += 1;
        fun?.onAction?.({type:'perfect'});
        ai.onEvent({type:'perfect', kind:'droplet', latencyMs:t - it.bornMs});
        logger.push({type:'hha:judge', judge:'perfect', kind:'droplet', why, remainMs:Math.round(remain)});
      }else{
        fun?.onAction?.({type:'hit'});
        ai.onEvent({type:'hit', kind:'droplet', latencyMs:t - it.bornMs});
        logger.push({type:'hha:judge', judge:'hit', kind:'droplet', why, remainMs:Math.round(remain)});
      }

      fxSpark(fxX, fxY);
      if(director.feverOn && rng()<0.24) burstClear(1);

    } else if(it.kind==='infected'){
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 2);
      st.shield = clamp(st.shield - 10, 0, 100);
      flashBad();
      toast('🦠 โดนเชื้อ!');
      ai.onEvent({type:'hit', kind:'infected', latencyMs:t - it.bornMs});
      logger.push({type:'hha:judge', judge:'bad_hit', kind:'infected', why});

      fxShockwave(fxX, fxY);

    } else if(it.kind==='mask'){
      st.shield = clamp(st.shield + (director.feverOn?16:14), 0, 100);
      addScore(1);
      st.streak += 1;
      toast('🛡️ Shield +');
      fun?.onAction?.({type:'hit'});
      ai.onEvent({type:'hit', kind:'mask', latencyMs:t - it.bornMs});
      logger.push({type:'hha:judge', judge:'hit', kind:'mask', why});

      fxSpark(fxX, fxY);

    } else if(it.kind==='cough' || it.kind==='boss'){
      if(remain <= perfectWindow){
        addScore(it.kind==='boss' ? 6 : 4);
        st.streak += 1;
        st.perfect += 1;
        toast('✨ Perfect Block!');
        fun?.onAction?.({type:'perfect'});
        ai.onEvent({type:'perfect', kind:'cough', latencyMs:t - it.bornMs});
        logger.push({type:'hha:judge', judge:'perfect', kind:it.kind, why, remainMs:Math.round(remain)});

        fxConfettiBurst(fxX, fxY);

        if(st.bossActive) st.bossNeedPerfect=false;
      }else{
        addScore(2);
        st.streak += 1;
        fun?.onAction?.({type:'hit'});
        ai.onEvent({type:'hit', kind:'cough', latencyMs:t - it.bornMs});
        logger.push({type:'hha:judge', judge:'hit', kind:it.kind, why, remainMs:Math.round(remain)});

        fxSpark(fxX, fxY);
      }
    }

    st.maxStreak = Math.max(st.maxStreak, st.streak);

    // HOT trigger
    if(!st.hotOn && st.streak >= st.hotNeedStreak){
      startHot();
    }

    if(director.feverOn && rng()<0.10) burstClear(1);

    setHud();

    if(st.shield <= 0){
      endGame('shield');
    }
  }

  function timeoutTarget(id){
    const it=st.targets.get(id);
    if(!it || st.over || st.paused) return;

    removeTarget(id,false);

    if(it.kind==='droplet'){
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 1);
      st.shield = clamp(st.shield - 6, 0, 100);
      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:'droplet', latencyMs:performance.now() - it.bornMs});
      logger.push({type:'hha:judge', judge:'timeout', kind:'droplet'});

    } else if(it.kind==='infected'){
      st.score += 1;
      fun?.onAction?.({type:'hit'});
      ai.onEvent({type:'timeout', kind:'infected', latencyMs:performance.now() - it.bornMs});
      logger.push({type:'hha:judge', judge:'avoid', kind:'infected'});

    } else if(it.kind==='mask'){
      st.miss += 1;
      st.streak = 0;
      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:'mask', latencyMs:performance.now() - it.bornMs});
      logger.push({type:'hha:judge', judge:'timeout', kind:'mask'});

    } else if(it.kind==='cough' || it.kind==='boss'){
      st.miss += 1;
      st.streak = 0;

      const extra = (st.choiceBuff==='B') ? 1.15 : 1.0;
      st.shield = clamp(st.shield - Math.round((it.kind==='boss'?22:16)*extra), 0, 100);

      st.score = Math.max(0, st.score - 2);
      toast('😷 โดนละอองไอ!');
      flashBad();

      const r=layerRect();
      coughShockwave(r.left + it.x, r.top + it.y);

      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:'cough', latencyMs:performance.now() - it.bornMs});
      logger.push({type:'hha:judge', judge:'timeout', kind:it.kind});
    }

    setHud();

    if(st.shield <= 0){
      endGame('shield');
    }
  }

  // cVR shoot
  function pickTargetAt(x, y){
    let bestId=null, bestD=1e9;
    const rad=54;
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
    const base=st.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;

    const hotMul = st.hotOn ? 0.88 : 1.0;
    const eff = Math.max(200, Math.round(every*(1+ap.spawnSlow) * hotMul));

    spawnTimer=setTimeout(()=>{
      spawn();
      scheduleSpawn();
    }, eff);
  }

  function maybeBoss(nowMs){
    if(!st.running || st.over || st.paused) return;
    if(st.bossActive) return;

    if(nowMs >= st.nextBossAt){
      st.bossActive=true;
      st.bossNeedPerfect=true;
      showPrompt('👿 BOSS WAVE! ทำ Perfect Block อย่างน้อย 1 ครั้ง!');
      toast('BOSS INCOMING');
      logger.push({type:'boss:start'});

      const bossDur = (diff==='hard'?3200:3800);
      const endAt = nowMs + bossDur;

      const bossTick=()=>{
        const t=performance.now();
        if(t>=endAt || st.over || st.paused){
          st.bossActive=false;

          if(st.bossNeedPerfect){
            st.shield=clamp(st.shield-18,0,100);
            st.score=Math.max(0, st.score-4);
            flashBad();
            toast('❌ บอสไม่ผ่าน!');
            logger.push({type:'boss:end', pass:false});
            st.crit.push({ t:+st.elapsedSec.toFixed(2), msg:'❌ บอสไม่ผ่าน (ไม่มี Perfect)' });
          }else{
            st.shield=clamp(st.shield+12,0,100);
            st.score += 6;
            toast('✅ ผ่านบอส! +Shield');
            burstClear(2);
            logger.push({type:'boss:end', pass:true});
            st.crit.push({ t:+st.elapsedSec.toFixed(2), msg:'✅ ผ่านบอส (มี Perfect)' });
          }
          if(st.crit.length>20) st.crit.shift();

          setHud();
          st.nextBossAt = performance.now() + st.bossEveryMs;
          return;
        }
        setTimeout(bossTick, 160);
      };
      bossTick();
    }
  }

  function tick(){
    if(!st.running || st.over || st.paused) return;

    director = fun ? fun.tick() : director;

    const nowMs=performance.now();

    // HOT timer
    if(st.hotOn){
      if(nowMs >= st.hotUntil) stopHot('expire');
      else st.hotTimeMs += 80;
    }

    st.risk = ai.onTick(nowMs, st.shield);

    // threat max + crit moment
    st.threatMax = Math.max(st.threatMax, st.risk||0);
    if(st.risk >= 0.78){
      st.crit.push({ t: +st.elapsedSec.toFixed(2), msg: '⚠️ Threat สูงมาก (เกือบแตก)' });
      if(st.crit.length>20) st.crit.shift();
    }

    const hint = ai.coachHint(nowMs, {shield:st.shield, miss:st.miss});
    if(hint) { showPrompt(hint); logger.push({type:'hha:coach', msg:hint}); }

    for(const [id, it] of st.targets){
      if(nowMs >= it.dieMs) timeoutTarget(id);
    }

    maybeBoss(nowMs);

    // choice timer (skip during boss)
    if(!st.choiceOn && nowMs >= st.nextChoiceAt && !st.bossActive){
      showChoice();
      st.nextChoiceAt = nowMs + (10000 + Math.round(rng()*5000));
    }
    if(st.choiceOn && nowMs >= st.choiceUntil){
      hideChoice();
      logger.push({type:'choice:timeout'});
    }

    st.elapsedSec = (nowMs - st.t0)/1000;
    if(st.elapsedSec >= timeLimit){
      endGame('time'); return;
    }

    if(((nowMs - st.t0) % 1000) < 90){
      logger.push({type:'hha:time', t: +st.elapsedSec.toFixed(2), score:st.score, miss:st.miss, shield:+st.shield.toFixed(1), risk:+st.risk.toFixed(3)});
    }

    setHud();
  }

  // summary store
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

  function makeBadges(){
    const b=[];
    if(st.perfect>=3) b.push({id:'PERFECT_3', label:'✨ Perfect x3'});
    if(st.maxStreak>=12) b.push({id:'STREAK_12', label:'🔥 Streak 12'});
    if(st.hotCount>=1) b.push({id:'HOT_ON', label:'🔥 HOT'});
    if(st.choiceA+st.choiceB>=1) b.push({id:'DECISION', label:'🧠 Decision'});
    if(st.miss<=3 && st.elapsedSec>=timeLimit-0.2) b.push({id:'CLEAN_RUN', label:'🧼 Clean Run'});
    if(st.shield>=60) b.push({id:'SHIELD_MASTER', label:'🛡️ Shield Master'});
    return b;
  }

  function renderEnd(reason){
    const set=(id,v)=>{ const el=DOC.getElementById(id); if(el) el.textContent=String(v); };
    set('tEndReason', reason);
    set('sScore', st.score);
    set('sMaxStreak', st.maxStreak);
    set('sMiss', st.miss);
    set('sPerfect', st.perfect);
    set('sShield', Math.round(st.shield)+'%');
    set('sRisk', (ai.riskAvg()?ai.riskAvg():st.risk).toFixed(2));

    // optional extra fields (won't crash if absent)
    set('sThreatMax', (st.threatMax||0).toFixed(2));
    set('sChainPanic', st.chainPanic||0);
    set('sHot', `${st.hotCount||0}x / ${Math.round(st.hotTimeMs/1000)}s`);

    const badgeRow=DOC.getElementById('badgeRow');
    const badges=makeBadges();
    if(badgeRow){
      badgeRow.innerHTML = badges.length
        ? badges.map(x=>`<span class="mc-badge-chip">${x.label}</span>`).join('')
        : `<span class="mc-badge-chip">🙂 Keep going</span>`;
    }

    const note=DOC.getElementById('endNote');
    const last = st.crit.length ? st.crit[st.crit.length-1] : null;
    if(note){
      note.textContent = `pid=${pid||'—'} | diff=${diff} | mode=${mode} | view=${view} | time=${timeLimit}s | seed=${seed} | log=${logEndpoint||'—'}`
        + ` | threatMax=${(st.threatMax||0).toFixed(2)} | chainPanic=${st.chainPanic||0} | hot=${st.hotCount}x`
        + ` | choice(A/B)=${st.choiceA}/${st.choiceB}`
        + (last && (st.threatMax>=0.72 || st.chainPanic>=2) ? ` | CRIT@${last.t}s: ${last.msg}` : '');
    }

    const endEl=$('#end');
    if(endEl) endEl.hidden=false;

    applyHubLink($('#btnEndBack'));
  }

  function clearAllTargets(){
    for(const [id] of st.targets){ removeTarget(id,false); }
    st.targets.clear();
  }

  function startGame(){
    const endEl=$('#end');
    if(endEl) endEl.hidden=true;

    hideChoice();
    stopHot('reset');

    st.running=true; st.paused=false; st.over=false;
    st.t0=performance.now();
    st.elapsedSec=0;

    st.score=0; st.streak=0; st.maxStreak=0; st.miss=0; st.perfect=0;
    st.shield=40;

    st.hotOn=false; st.hotUntil=0; st.hotCount=0; st.hotTimeMs=0; st.hotScore=0;

    st.choiceBuff='none';
    st.choiceOn=false;
    st.choiceA=0; st.choiceB=0;
    st.nextChoiceAt = performance.now() + (9000 + Math.round(rng()*5000));

    st.crit.length = 0;
    st.threatMax = 0;
    st.chainPanic = 0;

    clearAllTargets();

    director = fun ? fun.tick() : director;

    ai.reset();
    st.nextBossAt = performance.now() + st.bossEveryMs;
    st.bossActive=false;
    st.bossNeedPerfect=false;

    toast('เริ่ม! กันละอองให้ได้มากที่สุด');
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

    hideChoice();
    if(st.hotOn) stopHot('end');

    clearAllTargets();

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
      reason,

      // PATCH 4 metrics
      threatMax: Math.round((st.threatMax||0)*100)/100,
      chainPanic: st.chainPanic||0,
      hotCount: st.hotCount||0,
      hotTimeSec: Math.round((st.hotTimeMs||0)/100)/10,
      hotScore: st.hotScore||0,
      choiceA: st.choiceA||0,
      choiceB: st.choiceB||0,
    };

    saveSummary(sum);

    logger.push({type:'hha:end', ...sum});
    await logger.flush('end');

    toast(reason==='time' ? 'ครบเวลา!' : 'Shield หมด!');
    renderEnd(reason);
  }

  // bind buttons
  const btnStart=$('#btnStart');
  const btnRetry=$('#btnRetry');
  const btnPause=$('#btnPause');
  const btnBack=$('#btnBack');
  const btnEndRetry=$('#btnEndRetry');

  if(btnStart) btnStart.addEventListener('click', startGame, {passive:true});
  if(btnRetry) btnRetry.addEventListener('click', startGame, {passive:true});
  if(btnPause) btnPause.addEventListener('click', togglePause, {passive:true});
  if(btnEndRetry) btnEndRetry.addEventListener('click', startGame, {passive:true});

  if(btnBack) btnBack.addEventListener('click', ()=>{
    try{
      const u=new URL(hub||'../hub.html', location.href);
      if(pid) u.searchParams.set('pid', pid);
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
    ? '🎯 cVR: ยิงด้วยกากบาท (แตะจอเพื่อยิง) เป้าในชั้นเล่นจะไม่รับ tap ตรง ๆ'
    : 'แตะ 💦 ปัดละออง • แตะ 😷 เพิ่มโล่ • 🤧 ตอนท้าย = Perfect! (streak สูงเข้า HOT)');
})();