// === /herohealth/vr-maskcough/maskcough.safe.js ===
// Mask & Cough (Analyze) SAFE Engine — FUN+FX + Explainable AI + Research Logging
// v20260223a
//
// ✅ Play / Study modes
// - play: adaptive AI + DL hooks allowed
// - study/research: deterministic seed + adaptive assist OFF
//
// ✅ Controls
// - PC/Mobile: tap/click targets
// - cVR: hha:shoot event from ../vr/vr-ui.js
//
// ✅ Analyze mechanics
// - Risk Zones (safe/risk/danger)
// - Telegraph 2-stage (amber -> red -> active)
// - Mini-boss patterns (sweep/pulse/fake)
// - Route Combo bonus (anti-spam / route thinking)
// - Focus + Threat + Quality metrics
//
// ✅ Logging
// - ?log=https://... text/plain NDJSON
// - hha:start/time/judge/end + ai:risk + coach explainable + hazard/boss events
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
  const lerp=(a,b,t)=>a+(b-a)*t;
  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }
  function getQS(){ try{return new URL(location.href).searchParams;}catch(_){return new URLSearchParams();} }

  function getViewAuto(){
    const qs=getQS();
    const v=(qs.get('view')||'').toLowerCase(); if(v) return v;
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

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1200);
  }

  function showPrompt(msg){
    const el = $('#mc-prompt');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(showPrompt._t);
    showPrompt._t = setTimeout(()=> el.classList.remove('show'), 980);
  }

  function flashBad(){
    const el = $('#mc-flash');
    if(!el) return;
    el.style.opacity='1';
    clearTimeout(flashBad._t);
    flashBad._t = setTimeout(()=> el.style.opacity='0', 110);
  }

  function feverGlow(on){
    const el = $('#mc-feverGlow');
    if(!el) return;
    el.style.opacity = on ? '1' : '0';
  }

  // ---------------- context ----------------
  const qs = getQS();
  const hub = (qs.get('hub')||'../hub.html').trim();
  const pid = (qs.get('pid')||qs.get('participantId')||'').trim();
  const diff = (qs.get('diff')||'normal').trim().toLowerCase();
  const seedParam = (qs.get('seed')||pid||'maskcough').trim();
  const mode = (qs.get('mode')||qs.get('run')||'play').trim().toLowerCase(); // play|study
  const view = getViewAuto();
  const timeLimit = Math.max(20, parseInt(qs.get('time')||'60',10));
  const logEndpoint = (qs.get('log')||'').trim();
  const studyId = (qs.get('studyId')||'').trim();
  const phase = (qs.get('phase')||'').trim();
  const conditionGroup = (qs.get('conditionGroup')||'').trim();
  const seed = (safeNum(seedParam, Date.now()) >>> 0);

  const wrap = $('#mc-wrap');
  const layer = $('#layer');
  const bossBanner = $('#bossBanner');
  const bossBannerText = $('#bossBannerText');
  const crosshairHint = $('#crosshairHint');

  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.run = mode;
  }
  if(crosshairHint) crosshairHint.hidden = (view !== 'cvr');

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

  // ---------------- logger (flush-hardened) ----------------
  function createLogger(ctx){
    const q = [];
    let seq = 0;
    const sessionId = 'mc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);

    function base(ev){
      return {
        v:1,
        game:'maskcough',
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
      if(q.length > 1500) q.splice(0, q.length - 1100);
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

  const logger = createLogger({
    pid, studyId, phase, conditionGroup,
    diff, mode, view, seed, timePlannedSec: timeLimit, log: logEndpoint
  });

  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') logger.flush('unload');
  });
  WIN.addEventListener('beforeunload', ()=> logger.flush('unload'));

  // ---------------- optional Fun Boost bridge ----------------
  const fun = WIN.HHA?.createFunBoost?.({
    seed: String(seed),
    baseSpawnMul: 1.0,
    waveCycleMs: 18000,
    feverThreshold: 16,
    feverDurationMs: 6500,
    feverSpawnBoost: 1.18,
    feverTimeScale: 0.92
  });
  let director = fun ? fun.tick() : {spawnMul:1, timeScale:1, wave:'calm', intensity:0, feverOn:false};
  function feverChargeState(){
    if(fun?.getState && fun?.cfg){
      const fb = fun.getState().feverCharge || 0;
      const th = fun.cfg.feverThreshold || 18;
      return { fb, th };
    }
    return { fb:0, th:18 };
  }

  // ---------------- AI risk / DL hooks ----------------
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
    const W2=Array(8).fill(0); const B2=0;
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
    const model = createRiskModel();
    const mlp = createTinyMLP();
    const cfg = {
      windowMs: 5000,
      enabled: !!opts?.enabled,
      enableDL: !!opts?.enableDL,
      alpha: 0.65,
      maxAssist: 0.45,
      coachCooldownMs: 8500
    };
    const st = {
      lastT: performance.now(),
      risk: 0.12,
      taps:0,hits:0,timeouts:0,coughTimeouts:0,perfects:0,
      latencySum:0,latencyN:0,
      shieldNow:40,shieldPrev:40,shieldSlope:0,
      coachT:0,riskSum:0,riskN:0
    };

    function reset(){
      st.lastT=performance.now();
      st.risk=0.12;
      st.taps=st.hits=st.timeouts=0;
      st.coughTimeouts=0; st.perfects=0;
      st.latencySum=0; st.latencyN=0;
      st.shieldPrev=st.shieldNow=40;
      st.shieldSlope=0;
      st.coachT=0; st.riskSum=0; st.riskN=0;
    }

    function onTick(nowMs, shield){
      st.shieldNow = shield;
      st.riskSum += st.risk; st.riskN++;

      if(!cfg.enabled) return st.risk;

      if(nowMs - st.lastT >= cfg.windowMs){
        const total=Math.max(1, st.taps + st.timeouts);
        const hitRate=st.hits/total;
        const missRate=st.timeouts/total;
        const avgLat=st.latencyN ? (st.latencySum/st.latencyN) : 0;
        const coughFail=st.coughTimeouts/Math.max(1, st.timeouts);
        const perfectRate=st.perfects/Math.max(1, st.hits);

        st.shieldSlope=(st.shieldNow - st.shieldPrev)/100;
        st.shieldPrev=st.shieldNow;

        const feat=[
          nz(missRate,0.05,0.55),
          nz(1-hitRate,0.10,0.70),
          nz(1-(st.shieldNow/100),0.30,0.95),
          nz(Math.max(0,-st.shieldSlope),0.00,0.30),
          nz(coughFail,0.05,0.60),
          nz(avgLat,180,650),
          nz(1-perfectRate,0.20,0.95),
        ];
        const r1=model.predict(feat);
        const r2=cfg.enableDL ? mlp.predict(feat) : r1;
        const r=cfg.enableDL ? (0.55*r1 + 0.45*r2) : r1;

        st.risk = cfg.alpha*st.risk + (1-cfg.alpha)*r;

        st.taps=st.hits=st.timeouts=0;
        st.coughTimeouts=0; st.perfects=0;
        st.latencySum=0; st.latencyN=0;
        st.lastT=nowMs;

        logger.push({ type:'ai:risk', risk:+st.risk.toFixed(4) });
      }
      return st.risk;
    }

    function assistParams(){
      if(!cfg.enabled) return {assist:0,maskBonus:0,coughPenalty:0,spawnSlow:0,ttlBoost:0,perfectBoost:0};
      const a=Math.min(cfg.maxAssist, Math.max(0,(st.risk-0.25)*0.85));
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
      st.taps += 1;
      if(ev.type==='hit'){ st.hits += 1; }
      else if(ev.type==='perfect'){ st.hits += 1; st.perfects += 1; }
      else if(ev.type==='timeout'){
        st.timeouts += 1;
        if(ev.kind==='cough' || ev.kind==='boss') st.coughTimeouts += 1;
      }
      if(Number.isFinite(ev.latencyMs)){ st.latencySum += ev.latencyMs; st.latencyN += 1; }
    }

    function coachHint(nowMs, state){
      if(!cfg.enabled) return null;
      if(nowMs - st.coachT < cfg.coachCooldownMs) return null;
      if(st.risk < 0.42 && state.shield > 34) return null;

      st.coachT = nowMs;

      if(state.shield < 22) return '⚠️ โล่ใกล้หมด! รีบเก็บ 😷 เพิ่ม Shield ก่อน';
      if(st.risk > 0.70) return '🎯 โฟกัส 🤧 ตอนท้าย ๆ เพื่อ Perfect Block (คะแนนพุ่ง!)';
      if(state.miss >= 6) return '💦 อย่าให้ละอองหลุดเยอะ—ตี 💦 ให้ทันก่อน!';
      return '✨ สะสม streak แล้วจะเข้า FEVER ได้เร็วขึ้น!';
    }

    function riskAvg(){ return st.riskN ? (st.riskSum/st.riskN) : st.risk; }

    return { reset, onTick, onEvent, assistParams, coachHint, riskAvg, get risk(){return st.risk;} };
  }

  const aiEnabled = (mode === 'play'); // study/research => OFF adaptive
  const ai = createAIDirector({ enabled: aiEnabled, enableDL: aiEnabled });

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
    el.style.left=(x-6)+'px'; el.style.top=(y-6)+'px';
    el.style.width='12px'; el.style.height='12px';
    el.style.borderRadius='999px';
    el.style.background='rgba(34,197,94,.9)';
    el.style.boxShadow='0 0 20px rgba(34,197,94,.55)';
    el.style.transform='scale(.8)';
    el.style.opacity='1';
    el.style.transition='transform .18s ease, opacity .18s ease';
    fxLayer.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform='scale(1.9)'; el.style.opacity='0'; });
    setTimeout(()=>{ try{el.remove();}catch(_){} }, 220);
  }

  function fxShockwave(x,y){
    const el=DOC.createElement('div');
    el.style.position='absolute';
    el.style.left=x+'px'; el.style.top=y+'px';
    el.style.width='12px'; el.style.height='12px';
    el.style.borderRadius='999px';
    el.style.border='2px solid rgba(239,68,68,.70)';
    el.style.boxShadow='0 0 24px rgba(239,68,68,.24)';
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
      c.style.left=x+'px'; c.style.top=y+'px';
      c.style.width='6px'; c.style.height='10px';
      c.style.borderRadius='2px';
      c.style.background=(i%3===0)?'rgba(56,189,248,.9)':(i%3===1)?'rgba(34,197,94,.9)':'rgba(167,139,250,.9)';
      c.style.transform='translate(-50%,-50%)';
      c.style.opacity='1';
      c.style.transition='transform .65s ease, opacity .65s ease';
      fxLayer.appendChild(c);
      const ang=(Math.PI*2)*(i/14);
      const dx=Math.cos(ang)*(70+Math.random()*60);
      const dy=Math.sin(ang)*(70+Math.random()*60)+(20+Math.random()*40);
      const rot=(Math.random()*260-130);
      requestAnimationFrame(()=>{
        c.style.transform=`translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
        c.style.opacity='0';
      });
      setTimeout(()=>{ try{c.remove();}catch(_){} }, 700);
    }
  }

  // ---------------- state ----------------
  const rng = seededRng(seed);

  const st = {
    running:false, paused:false, over:false,
    t0:0, elapsedSec:0,

    score:0, streak:0, maxStreak:0, miss:0, perfect:0,
    shield:40,
    focus:100,

    baseSpawnMs: (diff==='hard' ? 640 : diff==='easy' ? 900 : 760),
    ttlBaseMs:   (diff==='hard' ? 1380 : diff==='easy' ? 1880 : 1630),
    perfectBaseMs: 220,

    bossEveryMs: (diff==='hard' ? 19000 : diff==='easy' ? 25500 : 22500),
    nextBossAt: 0,
    bossActive:false,
    bossNeedPerfect:false,
    bossPattern:'sweep',

    risk:0.12,

    targets: new Map(), // id -> {el, kind, bornMs, dieMs, x,y, zone}
    hazards: [],        // telegraph/active hazards
    uid:0,

    // analyze metrics
    zoneHits:{ safe:0, risk:0, danger:0 },
    zoneShots:{ safe:0, risk:0, danger:0 },
    spamMiss:0,
    emptyShots:0,
    hazardActiveMs:0,
    hazardWasActive:false,
    routeCombo:{ lastZone:'', chain:0, bonusReady:false },

    // explainable coach cache
    lastCoachExplain:null
  };

  // HUD refs
  const tScore=$('#tScore'), tStreak=$('#tStreak'), tMiss=$('#tMiss');
  const tMask=$('#tMask'), bMask=$('#bMask');
  const tWave=$('#tWave'), tInt=$('#tInt'), tFever=$('#tFever'), tRisk=$('#tRisk'), tThreat=$('#tThreat');
  const tFeverPct=$('#tFeverPct'), bFever=$('#bFever'), tFever2=$('#tFever2');
  const tFocus=$('#tFocus'), bFocus=$('#bFocus');
  const tSafeHits=$('#tSafeHits'), tRiskHits=$('#tRiskHits'), tDangerHits=$('#tDangerHits');
  const tPerfectRate=$('#tPerfectRate'), tSpam=$('#tSpam'), tRouteChain=$('#tRouteChain');

  function layerRect(){ return layer.getBoundingClientRect(); }

  function zoneByX(x){
    const r = layerRect();
    const w = Math.max(1, r.width);
    const xn = clamp01(x / w);
    if(xn < 1/3) return 'safe';
    if(xn < 2/3) return 'risk';
    return 'danger';
  }

  function threatLabel(){
    const active = st.hazards.some(h=>h.active);
    if(active || st.risk > 0.70) return 'HIGH';
    if(st.risk > 0.42) return 'MID';
    return 'LOW';
  }

  function perfectRatePct(){
    const hits = st.zoneHits.safe + st.zoneHits.risk + st.zoneHits.danger;
    return Math.round((st.perfect / Math.max(1,hits)) * 100);
  }

  function setHud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tStreak) tStreak.textContent = String(st.streak);
    if(tMiss) tMiss.textContent = String(st.miss);

    const sh = clamp(st.shield,0,100);
    if(tMask) tMask.textContent = `${Math.round(sh)}%`;
    if(bMask) bMask.style.width = `${sh}%`;

    if(tWave) tWave.textContent = director.wave || '—';
    if(tInt) tInt.textContent = (director.intensity||0).toFixed(2);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    if(tRisk) tRisk.textContent = (st.risk||0).toFixed(2);
    if(tThreat) tThreat.textContent = threatLabel();

    const { fb, th } = feverChargeState();
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(bFever) bFever.style.width = `${pct}%`;
    if(tFeverPct) tFeverPct.textContent = `${Math.round(pct)}%`;
    if(tFever2) tFever2.textContent = director.feverOn ? 'ACTIVE' : 'Charge';

    const focus = clamp(st.focus,0,100);
    if(tFocus) tFocus.textContent = String(Math.round(focus));
    if(bFocus) bFocus.style.width = `${focus}%`;

    if(tSafeHits) tSafeHits.textContent = String(st.zoneHits.safe);
    if(tRiskHits) tRiskHits.textContent = String(st.zoneHits.risk);
    if(tDangerHits) tDangerHits.textContent = String(st.zoneHits.danger);
    if(tPerfectRate) tPerfectRate.textContent = `${perfectRatePct()}%`;
    if(tSpam) tSpam.textContent = String(st.spamMiss);
    if(tRouteChain) tRouteChain.textContent = String(st.routeCombo?.chain || 0);

    feverGlow(!!director.feverOn);
  }

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
    if(kind==='infected') return 't bad infected';
    if(kind==='cough') return 't cough bad';
    if(kind==='mask') return 't mask';
    if(kind==='boss') return 't cough bad';
    return 't';
  }

  // ---------------- hazard system (Telegraph 2-stage) ----------------
  function removeHazard(hz){
    try{ hz.elTele && hz.elTele.remove(); }catch(_){}
    try{ hz.elActive && hz.elActive.remove(); }catch(_){}
  }

  function createHazardEl(kind, x,y,w,h,r){
    const tele = DOC.createElement('div');
    tele.className = 'hz-tele';
    tele.dataset.stage = 'amber';

    if(kind === 'pulse'){
      tele.style.left = (x-r) + 'px';
      tele.style.top = (y-r) + 'px';
      tele.style.width = (r*2) + 'px';
      tele.style.height = (r*2) + 'px';
      tele.style.borderRadius = '999px';
    }else{
      tele.style.left = x + 'px';
      tele.style.top = y + 'px';
      tele.style.width = w + 'px';
      tele.style.height = h + 'px';
      tele.style.borderRadius = '16px';
    }
    tele.style.border = '2px dashed rgba(251,191,36,.95)';
    tele.style.boxShadow = '0 0 0 2px rgba(251,191,36,.12), inset 0 0 24px rgba(251,191,36,.08)';
    tele.style.background = 'rgba(251,191,36,.03)';
    layer.appendChild(tele);
    return tele;
  }

  function activateHazard(hz, nowMs){
    hz.active = true;
    hz.startAt = nowMs;
    hz.endAt = nowMs + hz.activeMs;

    const active = DOC.createElement('div');
    active.className = 'hz-active' + (hz.kind === 'pulse' ? ' pulse' : '');

    if(hz.kind === 'pulse'){
      active.style.left = (hz.x - hz.r) + 'px';
      active.style.top = (hz.y - hz.r) + 'px';
      active.style.width = (hz.r * 2) + 'px';
      active.style.height = (hz.r * 2) + 'px';
    }else{
      active.style.left = hz.x + 'px';
      active.style.top = hz.y + 'px';
      active.style.width = hz.w + 'px';
      active.style.height = hz.h + 'px';
    }

    layer.appendChild(active);
    hz.elActive = active;

    if(hz.elTele){ try{ hz.elTele.remove(); }catch(_){} hz.elTele = null; }

    logger.push({ type:'hazard:start', hazardKind:hz.kind, activeMs:hz.activeMs });
  }

  function setHazardRedStage(hz, nowMs){
    if(!hz || hz.stage !== 'amber') return;
    hz.stage = 'red';
    hz.redStart = nowMs;

    if(hz.elTele){
      hz.elTele.dataset.stage = 'red';
      hz.elTele.style.border = '2px solid rgba(239,68,68,.95)';
      hz.elTele.style.background = 'rgba(239,68,68,.07)';
      hz.elTele.style.boxShadow = '0 0 0 2px rgba(239,68,68,.16), inset 0 0 28px rgba(239,68,68,.12)';
    }

    showPrompt('🚨 RED TELEGRAPH! เตรียมหลบ/เลี่ยงโซนนั้น');
    logger.push({ type:'hazard:red', hazardKind: hz.kind, redMs: hz.redMs });
  }

  function spawnHazardTelegraph(nowMs){
    if(!st.running || st.over || st.paused) return;
    const r = layerRect();

    const kind = (rng() < 0.55) ? 'laneV' : 'pulse';

    let x=0, y=0, w=0, h=0, rr=0;
    if(kind === 'laneV'){
      w = Math.max(64, Math.round(r.width * (0.12 + rng()*0.07)));
      h = r.height;
      x = Math.round(rng() * Math.max(0, r.width - w));
      y = 0;
    }else{
      rr = Math.round(Math.min(r.width, r.height) * (0.11 + rng()*0.07));
      x = Math.round(rr + rng() * Math.max(1, r.width - rr*2));
      y = Math.round(rr + rng() * Math.max(1, r.height - rr*2));
    }

    const tele = createHazardEl(kind, x,y,w,h,rr);

    const hz = {
      id: 'hz_' + Math.random().toString(36).slice(2,7),
      kind,
      x,y,w,h,r:rr,
      stage: 'amber',        // amber -> red -> active
      telegraphStart: nowMs,
      telegraphMs: 520 + Math.floor(rng()*280),
      redMs: 420 + Math.floor(rng()*260),
      redStart: 0,
      active:false,
      activeMs: 820 + Math.floor(rng()*520),
      startAt: 0, endAt: 0,
      fake:false,
      elTele: tele,
      elActive: null
    };
    st.hazards.push(hz);
    logger.push({ type:'hazard:telegraph', hazardKind:kind, telegraphMs:hz.telegraphMs });
    return hz;
  }

  function isPointInHazard(x,y){
    for(const hz of st.hazards){
      if(!hz.active) continue;
      if(hz.kind === 'pulse'){
        const dx=x-hz.x, dy=y-hz.y;
        if((dx*dx + dy*dy) <= (hz.r*hz.r)) return true;
      }else{
        if(x>=hz.x && x<=hz.x+hz.w && y>=hz.y && y<=hz.y+hz.h) return true;
      }
    }
    return false;
  }

  function isPointNearHazardEdge(x,y){
    for(const hz of st.hazards){
      if(hz.active) continue;
      if(hz.stage !== 'red') continue;
      if(hz.kind === 'pulse'){
        const dx=x-hz.x, dy=y-hz.y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(Math.abs(d - hz.r) <= 28) return true;
      }else{
        const insideX = (x >= hz.x-20 && x <= hz.x+hz.w+20);
        const insideY = (y >= hz.y-20 && y <= hz.y+hz.h+20);
        const edgeBand = (
          Math.abs(x-hz.x)<=22 || Math.abs(x-(hz.x+hz.w))<=22 ||
          Math.abs(y-hz.y)<=22 || Math.abs(y-(hz.y+hz.h))<=22
        );
        if(insideX && insideY && edgeBand) return true;
      }
    }
    return false;
  }

  function tickHazards(nowMs){
    let hazardActiveNow = false;

    for(let i=st.hazards.length-1; i>=0; i--){
      const hz = st.hazards[i];
      const dt = nowMs - hz.telegraphStart;

      // amber -> red
      if(!hz.active && hz.stage === 'amber' && dt >= hz.telegraphMs){
        setHazardRedStage(hz, nowMs);
      }

      // red -> active (or fake)
      if(!hz.active && hz.stage === 'red' && (nowMs - hz.redStart) >= hz.redMs){
        if(hz.fake){
          logger.push({ type:'hazard:fake', hazardKind: hz.kind });
          removeHazard(hz);
          st.hazards.splice(i,1);
          continue;
        }
        activateHazard(hz, nowMs);
      }

      if(hz.active){
        hazardActiveNow = true;
        if(nowMs >= hz.endAt){
          logger.push({ type:'hazard:end', hazardKind: hz.kind });
          removeHazard(hz);
          st.hazards.splice(i,1);
        }
      }
    }

    // hazard active time accumulation
    if(hazardActiveNow) st.hazardActiveMs += 80; // tick interval
    st.hazardWasActive = hazardActiveNow;
  }

  function maybeSpawnHazard(nowMs){
    if(!st.running || st.over || st.paused) return;
    if(st.bossActive) return; // boss has its own pattern hazards
    const intensity = director.intensity || 0;
    const risk = st.risk || 0;
    const p = 0.004 + intensity*0.010 + risk*0.010; // per tick
    if(rng() < p) spawnHazardTelegraph(nowMs);
  }

  // ---------------- boss patterns ----------------
  function showBossBanner(pattern){
    if(!bossBanner || !bossBannerText) return;
    bossBannerText.textContent = `👿 BOSS ${String(pattern).toUpperCase()}! อ่านสัญญาณให้ดี`;
    bossBanner.hidden = false;
    clearTimeout(showBossBanner._t);
    showBossBanner._t = setTimeout(()=>{ bossBanner.hidden = true; }, 1800);
  }

  function pickBossPattern(){
    const r = rng();
    if(r < 0.34) return 'sweep';
    if(r < 0.68) return 'pulse';
    return 'fake';
  }

  function spawnBossPatternHazards(pattern){
    if(pattern === 'sweep'){
      for(let i=0;i<3;i++){
        setTimeout(()=>{
          if(!st.running || st.over || st.paused) return;
          const hz = spawnHazardTelegraph(performance.now());
          if(!hz) return;
          const r = layerRect();
          hz.kind = 'laneV';
          hz.stage = 'amber';
          hz.telegraphMs = 420 + i*80;
          hz.redMs = 260;
          hz.w = Math.max(56, Math.round(r.width * 0.12));
          hz.h = r.height; hz.y = 0;
          hz.x = (i % 2 === 0)
            ? Math.round(r.width * (0.12 + rng()*0.22))
            : Math.round(r.width * (0.58 + rng()*0.20));
          if(hz.elTele){
            hz.elTele.style.left = hz.x + 'px';
            hz.elTele.style.top = '0px';
            hz.elTele.style.width = hz.w + 'px';
            hz.elTele.style.height = hz.h + 'px';
            hz.elTele.style.borderRadius = '16px';
          }
        }, i*260);
      }
    } else if(pattern === 'pulse'){
      for(let i=0;i<2;i++){
        setTimeout(()=>{
          if(!st.running || st.over || st.paused) return;
          const hz = spawnHazardTelegraph(performance.now());
          if(!hz) return;
          const r = layerRect();
          hz.kind = 'pulse';
          hz.stage = 'amber';
          hz.telegraphMs = 520 + i*120;
          hz.redMs = 300;
          hz.r = Math.round(Math.min(r.width,r.height) * (i===0 ? 0.16 : 0.12));
          hz.x = (i===0) ? Math.round(r.width*0.5) : Math.round(r.width*(rng()<0.5?0.22:0.78));
          hz.y = (i===0) ? Math.round(r.height*0.5) : Math.round(r.height*(rng()<0.5?0.28:0.72));
          if(hz.elTele){
            hz.elTele.style.left = (hz.x-hz.r)+'px';
            hz.elTele.style.top  = (hz.y-hz.r)+'px';
            hz.elTele.style.width = (hz.r*2)+'px';
            hz.elTele.style.height= (hz.r*2)+'px';
            hz.elTele.style.borderRadius='999px';
          }
        }, i*360);
      }
    } else if(pattern === 'fake'){
      for(let i=0;i<3;i++){
        setTimeout(()=>{
          if(!st.running || st.over || st.paused) return;
          const hz = spawnHazardTelegraph(performance.now());
          if(!hz) return;
          hz.telegraphMs = 350 + Math.floor(rng()*180);
          hz.redMs = 220;
          if(rng() < 0.5) hz.fake = true;
        }, i*220);
      }
    }
    logger.push({ type:'boss:pattern', pattern });
  }

  // ---------------- targets ----------------
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
    if(feverOn){ wDroplet += 0.10; wMask -= 0.06; }

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
    const zone = zoneByX(x);

    st.targets.set(id, { el, kind, bornMs:born, dieMs:die, x, y, zone });

    el.addEventListener('pointerdown', (ev)=>{
      if(view==='cvr') return;
      ev.preventDefault();
      handleTapAt(x,y);
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

    // bias by zone risk + AI
    let kind = st.bossActive ? 'boss' : pickKind();
    if(kind === 'droplet' && !director.feverOn && (director.intensity||0) > 0.62 && rng() < 0.18) kind='infected';

    // danger zone slightly more likely cough/infected (Analyze pressure)
    const zone = zoneByX(x);
    if(!st.bossActive && zone === 'danger' && rng() < 0.18){
      kind = (rng() < 0.65) ? 'cough' : 'infected';
    }

    const ap=ai.assistParams();
    let ttlMs=Math.round(st.ttlBaseMs*(director.timeScale||1)*(1+ap.ttlBoost));
    if(zone === 'danger') ttlMs = Math.round(ttlMs * 0.92);
    else if(zone === 'safe') ttlMs = Math.round(ttlMs * 1.05);

    if(st.bossActive) ttlMs = Math.max(720, Math.round(ttlMs*0.78));

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
      const pick = arr[Math.floor(rng()*arr.length)];
      if(!pick) continue;
      handleHit(pick[0], 'burst');
    }
  }

  function coughShockwave(x,y){
    const radius=130;
    for(const [id, it] of st.targets){
      if(it.kind!=='droplet') continue;
      const dx=it.x-x, dy=it.y-y;
      if(Math.sqrt(dx*dx+dy*dy) <= radius){
        removeTarget(id,false);
        spawnAt('infected', it.x, it.y, Math.max(560, Math.round(st.ttlBaseMs*0.72)));
      }
    }
    const r = layerRect();
    fxShockwave(r.left + x, r.top + y);
    flashBad();
    toast('🤧 Shockwave!');
  }

  // ---------------- analyze / quality metrics ----------------
  function resetRouteCombo(){
    st.routeCombo.chain = 0;
    st.routeCombo.lastZone = '';
    st.routeCombo.bonusReady = false;
  }

  function onRouteComboHit(zone, kind){
    if(!zone) zone = 'risk';
    if(kind === 'infected') return;

    const rc = st.routeCombo;
    if(!rc.lastZone){
      rc.lastZone = zone; rc.chain = 1; rc.bonusReady = false; return;
    }

    if(zone !== rc.lastZone){
      rc.chain += 1;
      rc.lastZone = zone;
    }else{
      rc.chain = Math.max(1, rc.chain - 1);
    }

    if(rc.chain >= 3 && (st.spamMiss||0) < 6){
      const bonus = Math.min(4, 1 + Math.floor((rc.chain - 3)/2));
      st.score += bonus;
      rc.bonusReady = true;
      logger.push({ type:'route:bonus', chain: rc.chain, zone, bonus });
      toast(`🌀 Route Combo +${bonus}`);
      if(rng() < 0.35){
        const rr = layerRect();
        fxConfettiBurst(rr.left + rr.width*0.5, rr.top + 40);
      }
    }else{
      rc.bonusReady = false;
    }
  }

  function handleTapAt(x,y){
    const zone = zoneByX(x);
    st.zoneShots[zone] = (st.zoneShots[zone]||0) + 1;
  }

  function onEmptyShot(x,y, why){
    if(st.over || st.paused) return;
    st.emptyShots += 1;
    st.spamMiss += 1;
    st.focus = clamp(st.focus - 2.2, 0, 100);
    resetRouteCombo();
    logger.push({ type:'empty_shot', why, zone: zoneByX(x), spamMiss: st.spamMiss });
    if(st.spamMiss % 5 === 0) showPrompt('🎯 ยิงวืดเยอะไป — รอ RED telegraph แล้วค่อยยิง');
    setHud();
  }

  function getLiveCoachMetrics(){
    const totalZoneShots = Math.max(1,
      (st.zoneShots.safe||0)+(st.zoneShots.risk||0)+(st.zoneShots.danger||0)
    );
    const hits = Math.max(1, (st.zoneHits.safe||0)+(st.zoneHits.risk||0)+(st.zoneHits.danger||0));
    const dangerUse = (st.zoneShots.danger||0) / totalZoneShots;
    const spamRate = (st.spamMiss||0) / totalZoneShots;
    const perfectRate = st.perfect / hits;
    const hazardPressure = clamp01(((st.hazardActiveMs||0)/1000) / Math.max(1, timeLimit*0.22));
    return {
      dangerUse, spamRate, perfectRate, hazardPressure,
      focus: st.focus||100, shield: st.shield||0, risk: st.risk||0
    };
  }

  function getExplainableCoachTip(){
    const m = getLiveCoachMetrics();

    if(m.shield < 22){
      return { msg:'🛡️ Shield ต่ำ — เก็บ 😷 ก่อนเข้าโซนเสี่ยง', reason:'shield_low', evidence:{shield:Math.round(m.shield)} };
    }
    if(m.spamRate > 0.28){
      return { msg:'🎯 กดย้ำพื้นที่ว่างเยอะไป — รอ telegraph RED แล้วค่อยยิง', reason:'high_spam', evidence:{spamRate:+m.spamRate.toFixed(2)} };
    }
    if(m.dangerUse > 0.42 && m.risk > 0.45){
      return { msg:'⚠️ เข้า danger บ่อยเกิน — เล่น safe/risk สลับเพื่อรักษา streak', reason:'danger_overuse', evidence:{dangerUse:+m.dangerUse.toFixed(2), risk:+m.risk.toFixed(2)} };
    }
    if(m.perfectRate < 0.22){
      return { msg:'✨ Perfect ยังน้อย — กดช่วงท้ายของ 🤧 เพื่อคะแนนพุ่ง', reason:'low_perfect', evidence:{perfectRate:+m.perfectRate.toFixed(2)} };
    }
    if(m.hazardPressure > 0.35 && m.focus < 65){
      return { msg:'🧠 Hazard กดดันสูง — ลด spam เพื่อดึง Focus กลับมา', reason:'hazard_pressure_focus_drop', evidence:{hazardPressure:+m.hazardPressure.toFixed(2), focus:Math.round(m.focus)} };
    }
    return null;
  }

  function analyzeScore(){
    const m = getLiveCoachMetrics();
    // score 0..100 emphasizing decision quality, not just reflex
    let s = 100;
    s -= m.spamRate * 38;
    s -= Math.max(0, m.dangerUse - 0.40) * 45;
    s += Math.min(20, m.perfectRate * 28);
    s += Math.min(14, (st.routeCombo.chain || 0) * 1.4);
    s += Math.min(12, st.focus * 0.12);
    return Math.round(clamp(s, 0, 100));
  }

  // ---------------- core interaction ----------------
  function handleHit(id, why){
    const it=st.targets.get(id);
    if(!it || st.over || st.paused) return;

    const t=performance.now();
    const remain=it.dieMs - t;
    const zone = it.zone || zoneByX(it.x);

    removeTarget(id,true);

    const ap=ai.assistParams();
    const perfectWindow=Math.round(st.perfectBaseMs*(1+ap.perfectBoost));
    const r=layerRect();
    const fxX = r.left + it.x;
    const fxY = r.top + it.y;

    // zone shot/hit metrics
    st.zoneHits[zone] = (st.zoneHits[zone]||0) + ((it.kind==='infected') ? 0 : 1);

    // telegraph read bonus
    if(isPointNearHazardEdge(it.x, it.y)){
      st.score += 1;
      logger.push({ type:'telegraph:read_bonus', bonus:1, kind:it.kind, zone });
      if(rng() < 0.35) showPrompt('🧠 Nice read! อ่าน telegraph ได้ดี');
    }

    // pressure log (not always penalize)
    if(isPointInHazard(it.x, it.y) && (it.kind==='mask' || it.kind==='droplet') && rng()<0.22){
      logger.push({ type:'hazard:pressure_hit', kind: it.kind, zone });
    }

    if(it.kind==='droplet'){
      st.score += director.feverOn ? 2 : 1;
      st.streak += 1;
      st.focus = clamp(st.focus + 0.6, 0, 100);

      const ttlApprox=st.ttlBaseMs;
      if(remain > ttlApprox*0.55){
        st.score += 1;
        st.perfect += 1;
        fun?.onAction?.({type:'perfect'});
        ai.onEvent({type:'perfect', kind:'droplet', latencyMs:t - it.bornMs});
        logger.push({type:'hha:judge', judge:'perfect', kind:'droplet', why, zone, remainMs:Math.round(remain)});
      }else{
        fun?.onAction?.({type:'hit'});
        ai.onEvent({type:'hit', kind:'droplet', latencyMs:t - it.bornMs});
        logger.push({type:'hha:judge', judge:'hit', kind:'droplet', why, zone, remainMs:Math.round(remain)});
      }

      onRouteComboHit(zone, it.kind);
      fxSpark(fxX, fxY);
      if(director.feverOn && rng()<0.24) burstClear(1);

    } else if(it.kind==='infected'){
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 2);
      st.shield = clamp(st.shield - 10, 0, 100);
      st.focus = clamp(st.focus - 6, 0, 100);
      flashBad();
      toast('🦠 โดนเชื้อ!');
      ai.onEvent({type:'hit', kind:'infected', latencyMs:t - it.bornMs});
      logger.push({type:'hha:judge', judge:'bad_hit', kind:'infected', why, zone});
      resetRouteCombo();
      fxShockwave(fxX, fxY);

    } else if(it.kind==='mask'){
      st.shield = clamp(st.shield + (director.feverOn?16:14), 0, 100);
      st.score += 1;
      st.streak += 1;
      st.focus = clamp(st.focus + 1.2, 0, 100);
      toast('🛡️ Shield +');
      fun?.onAction?.({type:'hit'});
      ai.onEvent({type:'hit', kind:'mask', latencyMs:t - it.bornMs});
      logger.push({type:'hha:judge', judge:'hit', kind:'mask', why, zone});
      onRouteComboHit(zone, it.kind);
      fxSpark(fxX, fxY);

    } else if(it.kind==='cough' || it.kind==='boss'){
      if(remain <= perfectWindow){
        st.score += (it.kind==='boss' ? 6 : 4);
        st.streak += 1;
        st.perfect += 1;
        st.focus = clamp(st.focus + 1.0, 0, 100);
        toast('✨ Perfect Block!');
        fun?.onAction?.({type:'perfect'});
        ai.onEvent({type:'perfect', kind:'cough', latencyMs:t - it.bornMs});
        logger.push({type:'hha:judge', judge:'perfect', kind:it.kind, why, zone, remainMs:Math.round(remain)});
        fxConfettiBurst(fxX, fxY);
        onRouteComboHit(zone, it.kind);

        if(director.feverOn && rng() < 0.45) burstClear(2);
        if(st.bossActive) st.bossNeedPerfect=false;
      }else{
        st.score += 2;
        st.streak += 1;
        st.focus = clamp(st.focus + 0.3, 0, 100);
        fun?.onAction?.({type:'hit'});
        ai.onEvent({type:'hit', kind:'cough', latencyMs:t - it.bornMs});
        logger.push({type:'hha:judge', judge:'hit', kind:it.kind, why, zone, remainMs:Math.round(remain)});
        onRouteComboHit(zone, it.kind);
        fxSpark(fxX, fxY);
      }
    }

    st.maxStreak = Math.max(st.maxStreak, st.streak);

    if(director.feverOn && rng()<0.10) burstClear(1);
    setHud();
    if(st.shield <= 0) endGame('shield');
  }

  function timeoutTarget(id){
    const it=st.targets.get(id);
    if(!it || st.over || st.paused) return;
    const zone = it.zone || zoneByX(it.x);
    removeTarget(id,false);

    if(it.kind==='droplet'){
      st.miss += 1;
      st.streak = 0;
      st.score = Math.max(0, st.score - 1);
      st.shield = clamp(st.shield - 6, 0, 100);
      st.focus = clamp(st.focus - 2.8, 0, 100);
      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:'droplet', latencyMs:performance.now() - it.bornMs});
      logger.push({type:'hha:judge', judge:'timeout', kind:'droplet', zone});
      resetRouteCombo();

    } else if(it.kind==='infected'){
      st.score += 1; // good avoid
      st.focus = clamp(st.focus + 0.4, 0, 100);
      fun?.onAction?.({type:'hit'});
      ai.onEvent({type:'timeout', kind:'infected', latencyMs:performance.now() - it.bornMs});
      logger.push({type:'hha:judge', judge:'avoid', kind:'infected', zone});

    } else if(it.kind==='mask'){
      st.miss += 1;
      st.streak = 0;
      st.focus = clamp(st.focus - 1.4, 0, 100);
      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:'mask', latencyMs:performance.now() - it.bornMs});
      logger.push({type:'hha:judge', judge:'timeout', kind:'mask', zone});
      resetRouteCombo();

    } else if(it.kind==='cough' || it.kind==='boss'){
      st.miss += 1;
      st.streak = 0;
      st.shield = clamp(st.shield - (it.kind==='boss'?22:16), 0, 100);
      st.score = Math.max(0, st.score - 2);
      st.focus = clamp(st.focus - 7, 0, 100);
      toast('😷 โดนละอองไอ!');
      flashBad();
      coughShockwave(it.x, it.y);
      fun?.onAction?.({type:'timeout'});
      ai.onEvent({type:'timeout', kind:'cough', latencyMs:performance.now() - it.bornMs});
      logger.push({type:'hha:judge', judge:'timeout', kind:it.kind, zone});
      resetRouteCombo();
    }

    setHud();
    if(st.shield <= 0) endGame('shield');
  }

  // ---------------- input (PC/Mobile/cVR) ----------------
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

    handleTapAt(x,y);
    const id=pickTargetAt(x,y);
    if(id) handleHit(id,'shoot');
    else onEmptyShot(x,y,'shoot');
  }
  WIN.addEventListener('hha:shoot', onShoot);

  // background empty taps on layer (PC/Mobile)
  layer?.addEventListener('pointerdown', (ev)=>{
    if(view==='cvr') return;
    // target handlers call stop? we won't rely on it; detect if clicked target
    const r = layerRect();
    const x = clamp(ev.clientX - r.left, 0, r.width);
    const y = clamp(ev.clientY - r.top, 0, r.height);

    // if clicking on a .t target, target handler will also run; ignore duplicate empty shot
    const tgt = ev.target;
    if(tgt && tgt.classList && tgt.classList.contains('t')) return;

    handleTapAt(x,y);
    const id = pickTargetAt(x,y);
    if(id) handleHit(id,'tap-layer');
    else onEmptyShot(x,y,'tap-layer');
  }, { passive:true });

  // ---------------- timers ----------------
  let spawnTimer=null, tickTimer=null;

  function scheduleSpawn(){
    if(spawnTimer) clearTimeout(spawnTimer);
    if(!st.running || st.over || st.paused) return;

    const ap=ai.assistParams();
    const base=st.baseSpawnMs;
    const every = fun ? fun.scaleIntervalMs(base, director) : base;
    const eff = Math.max(220, Math.round(every*(1+ap.spawnSlow)));

    spawnTimer=setTimeout(()=>{
      spawn();
      scheduleSpawn();
    }, eff);
  }

  function maybeBoss(nowMs){
    if(!st.running || st.over || st.paused) return;
    if(st.bossActive) return;

    if(nowMs >= st.nextBossAt){
      st.bossActive = true;
      st.bossNeedPerfect = true;
      st.bossPattern = pickBossPattern();

      showBossBanner(st.bossPattern);
      showPrompt(`👿 BOSS ${String(st.bossPattern).toUpperCase()}! อ่านสัญญาณให้ดี`);
      toast('BOSS INCOMING');

      logger.push({type:'boss:start', pattern: st.bossPattern});

      spawnBossPatternHazards(st.bossPattern);

      const bossDur = (diff==='hard'?3200:3800);
      const endAt = nowMs + bossDur;

      const bossTick = ()=>{
        const t=performance.now();
        if(t>=endAt || st.over || st.paused){
          st.bossActive=false;

          if(st.bossNeedPerfect){
            st.shield=clamp(st.shield-18,0,100);
            st.score=Math.max(0, st.score-4);
            st.focus=clamp(st.focus-8,0,100);
            flashBad();
            toast('❌ บอสไม่ผ่าน!');
            logger.push({type:'boss:end', pass:false, pattern: st.bossPattern});
          }else{
            st.shield=clamp(st.shield+12,0,100);
            st.score += 6;
            st.focus=clamp(st.focus+5,0,100);
            toast('✅ ผ่านบอส! +Shield');
            burstClear(2);
            logger.push({type:'boss:end', pass:true, pattern: st.bossPattern});
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

  function tick(){
    if(!st.running || st.over || st.paused) return;

    director = fun ? fun.tick() : director;
    const nowMs = performance.now();

    st.risk = ai.onTick(nowMs, st.shield);

    const aiHint = ai.coachHint(nowMs, {shield:st.shield, miss:st.miss});
    if(aiHint){
      showPrompt(aiHint);
      logger.push({type:'hha:coach', msg:aiHint});
    }

    const exTip = getExplainableCoachTip();
    if(exTip && (!aiHint || rng() < 0.65)){
      showPrompt(exTip.msg);
      st.lastCoachExplain = exTip;
      logger.push({
        type:'hha:coach_explainable',
        msg: exTip.msg,
        reason: exTip.reason,
        evidence: exTip.evidence
      });
    }

    // target timeout
    for(const [id, it] of st.targets){
      if(nowMs >= it.dieMs) timeoutTarget(id);
    }

    tickHazards(nowMs);
    maybeSpawnHazard(nowMs);
    maybeBoss(nowMs);

    st.elapsedSec = (nowMs - st.t0)/1000;
    if(st.elapsedSec >= timeLimit){
      endGame('time'); return;
    }

    // focus natural recovery (slow)
    if(!st.hazardWasActive && st.spamMiss === 0){
      st.focus = clamp(st.focus + 0.08, 0, 100);
    }else{
      st.focus = clamp(st.focus + 0.03, 0, 100);
    }

    // decay spam penalty slowly (lets player recover)
    if(rng() < 0.08 && st.spamMiss > 0) st.spamMiss--;

    // heartbeat
    if(((nowMs - st.t0) % 1000) < 90){
      logger.push({
        type:'hha:time',
        t:+st.elapsedSec.toFixed(2),
        score:st.score,
        miss:st.miss,
        shield:+st.shield.toFixed(1),
        risk:+st.risk.toFixed(3),
        focus:+st.focus.toFixed(1),
        threat:threatLabel()
      });
    }

    setHud();
  }

  // ---------------- summary / storage ----------------
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
    const badges = [];
    if(st.perfect>=3) badges.push({id:'PERFECT_3', label:'✨ Perfect x3'});
    if(st.maxStreak>=12) badges.push({id:'STREAK_12', label:'🔥 Streak 12'});
    if(st.miss<=3 && st.elapsedSec>=timeLimit-0.2) badges.push({id:'CLEAN_RUN', label:'🧼 Clean Run'});
    if(st.shield>=60) badges.push({id:'SHIELD_MASTER', label:'🛡️ Shield Master'});
    if(analyzeScore()>=80) badges.push({id:'ANALYZE_ACE', label:'🧠 Analyze Ace'});
    const shots = st.zoneShots.safe + st.zoneShots.risk + st.zoneShots.danger;
    const dangerUse = Math.round((st.zoneShots.danger / Math.max(1,shots))*100);
    if(dangerUse <= 28 && st.zoneHits.risk >= 4) badges.push({id:'SMART_ROUTE', label:'🌀 Smart Route'});
    return badges;
  }

  function renderEnd(reason){
    const set=(id,v)=>{ const el=DOC.getElementById(id); if(el) el.textContent=String(v); };

    const shots = st.zoneShots.safe + st.zoneShots.risk + st.zoneShots.danger;
    const dangerUsePct = Math.round((st.zoneShots.danger / Math.max(1, shots))*100);
    const spamRatePct = Math.round((st.spamMiss / Math.max(1, shots))*100);
    const riskAvg = (ai.riskAvg ? ai.riskAvg() : st.risk);
    const analyze = analyzeScore();

    set('tEndReason', reason);
    set('sScore', st.score);
    set('sMaxStreak', st.maxStreak);
    set('sMiss', st.miss);
    set('sPerfect', st.perfect);
    set('sShield', Math.round(st.shield)+'%');
    set('sRisk', riskAvg.toFixed(2));
    set('sAnalyzeScore', analyze);
    set('sDangerOveruse', `${dangerUsePct}%`);
    set('sSpamRate', `${spamRatePct}%`);

    const badgeRow=DOC.getElementById('badgeRow');
    const badges=makeBadges();
    if(badgeRow){
      badgeRow.innerHTML = badges.length
        ? badges.map(x=>`<span class="mc-badge-chip">${x.label}</span>`).join('')
        : `<span class="mc-badge-chip">🙂 Keep going</span>`;
    }

    const endCoachSummary = DOC.getElementById('endCoachSummary');
    if(endCoachSummary){
      const tip = st.lastCoachExplain;
      endCoachSummary.textContent = tip
        ? `${tip.msg} | reason=${tip.reason} | evidence=${JSON.stringify(tip.evidence)}`
        : 'AI Coach: ไม่มีคำเตือนเฉพาะทางล่าสุด (เล่นได้ค่อนข้างนิ่ง)';
    }

    const endNote=DOC.getElementById('endNote');
    if(endNote){
      endNote.textContent =
        `pid=${pid||'—'} | diff=${diff} | mode=${mode} | view=${view} | time=${timeLimit}s | seed=${seed}` +
        ` | log=${logEndpoint||'—'} | shots=${shots} (safe:${st.zoneShots.safe}, risk:${st.zoneShots.risk}, danger:${st.zoneShots.danger})`;
    }

    const endEl=$('#end');
    if(endEl) endEl.hidden=false;
    applyHubLink($('#btnEndBack'));
  }

  function clearAllTargets(){
    for(const [id] of st.targets){ removeTarget(id,false); }
    st.targets.clear();
  }
  function clearAllHazards(){
    for(const hz of st.hazards){ removeHazard(hz); }
    st.hazards.length = 0;
  }

  function startGame(){
    const endEl=$('#end');
    if(endEl) endEl.hidden=true;
    if(bossBanner) bossBanner.hidden = true;

    st.running=true; st.paused=false; st.over=false;
    st.t0=performance.now();
    st.elapsedSec=0;

    st.score=0; st.streak=0; st.maxStreak=0; st.miss=0; st.perfect=0;
    st.shield=40;
    st.focus=100;
    st.risk=0.12;

    st.zoneHits = { safe:0, risk:0, danger:0 };
    st.zoneShots = { safe:0, risk:0, danger:0 };
    st.spamMiss=0;
    st.emptyShots=0;
    st.hazardActiveMs=0;
    st.hazardWasActive=false;
    st.routeCombo = { lastZone:'', chain:0, bonusReady:false };
    st.lastCoachExplain = null;

    clearAllTargets();
    clearAllHazards();

    director = fun ? fun.tick() : director;
    ai.reset();

    st.nextBossAt = performance.now() + st.bossEveryMs;
    st.bossActive=false;
    st.bossNeedPerfect=false;
    st.bossPattern='sweep';

    toast('เริ่ม! อ่านโซน + อ่านสัญญาณ แล้วตัดสินใจให้คุ้ม');
    setHud();

    logger.push({type:'hha:start', seed, diff, mode, view, timePlannedSec:timeLimit});

    scheduleSpawn();
    if(tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 80);
  }

  function togglePause(){
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    if(st.paused){
      if(spawnTimer) clearTimeout(spawnTimer);
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
    clearAllHazards();

    const shots = st.zoneShots.safe + st.zoneShots.risk + st.zoneShots.danger;
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
      focusEnd: Math.round(st.focus),
      riskAvg: Math.round((ai.riskAvg?ai.riskAvg():st.risk)*100)/100,
      analyzeScore: analyzeScore(),
      zoneShots: st.zoneShots,
      zoneHits: st.zoneHits,
      spamMiss: st.spamMiss,
      shotsTotal: shots,
      reason
    };

    saveSummary(sum);
    logger.push({type:'hha:end', ...sum});
    await logger.flush('end');

    toast(reason==='time' ? 'ครบเวลา!' : 'Shield หมด!');
    renderEnd(reason);
  }

  // ---------------- buttons ----------------
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
      const u = new URL(hub || '../hub.html', location.href);
      if(pid) u.searchParams.set('pid', pid);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);
      location.href = u.toString();
    }catch(_){
      location.href = hub || '../hub.html';
    }
  }, {passive:true});

  // ---------------- init ----------------
  setHud();
  showPrompt(
    view==='cvr'
      ? '🎯 cVR: ยิงด้วยกากบาทกลางจอ • อ่าน telegraph เหลือง→แดง แล้วตัดสินใจยิง'
      : 'แตะ 💦 ปัดละออง • แตะ 😷 เพิ่มโล่ • 🤧 กดช่วงท้าย = Perfect! • อ่านโซน SAFE/RISK/DANGER'
  );
})();