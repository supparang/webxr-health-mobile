// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR Engine — SAFE FULL v20260224pFULL (overwrite whole file)
// ✅ no auto-end before start
// ✅ no duplicate boot/bind
// ✅ mobile/pc/cVR support (hha:shoot lockPx)
// ✅ boss weakspot bonus + Phase2 shield fake-out + warp
// ✅ Daily Mini-Missions (deterministic by local day + pid)
// ✅ Mission popup (optional, if HTML exists) + Mission panel (optional, if HTML exists)
// ✅ Mission → Boss synergy: Shield Breaker (spotlight reward)
// ✅ HHA Events/Sessions Logger (optional): ?log=1&api=... POST JSON {kind:"events"| "sessions", rows:[...]}
// ✅ hardened summary/menu + dispatch brush:start / brush:end for boot.js
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__BRUSH_SAFE_LOADED__) return;
  WIN.__BRUSH_SAFE_LOADED__ = true;

  /* ---------------- util ---------------- */
  const $ = (s)=>DOC.querySelector(s);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b, Number(v)||a));
  const nowMs = ()=> (typeof performance!=='undefined' && performance.now ? performance.now() : Date.now());
  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }
  function safeNum(v, d=0){ v=Number(v); return Number.isFinite(v)?v:d; }
  function pct(n){ return Math.round(Number(n)||0) + '%'; }
  function hash32(str){
    let h = 2166136261 >>> 0;
    str = String(str || '');
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function getLocalDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function makeRng(seed){
    let s = (Number(seed)||Date.now()) >>> 0;
    return function(){
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function shuffleInPlace(arr, rnd){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(rnd()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }
  function tryEvent(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  /* === tiny audio (optional, safe) === */
  function __beep(freq=660, ms=90, gain=0.06){
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return;
      if(!WIN.__brAC) WIN.__brAC = new AC();
      const ac = WIN.__brAC;
      if(ac.state === 'suspended') ac.resume().catch(()=>{});
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = Number(freq)||660;
      g.gain.value = 0;
      o.connect(g); g.connect(ac.destination);
      const t0 = ac.currentTime;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(Number(gain)||0.06, t0+0.01);
      g.gain.linearRampToValueAtTime(0.0001, t0 + (Number(ms)||90)/1000);
      o.start(t0);
      o.stop(t0 + (Number(ms)||90)/1000 + 0.02);
    }catch(_){}
  }

  /* ---------------- state ---------------- */
  let cfg = null, rng = Math.random;

  let root, layer, fxLayer, menu, end, tapStart;
  let btnStart, btnRetry, btnPause, btnHow, btnRecenter, tapBtn, btnBack, btnBackHub2;
  let toastEl, fatalEl;

  let tScore, tCombo, tMiss, tTime, tClean, tFever, bClean, bFever;
  let mDiff, mTime, ctxView, ctxSeed, ctxTime, diffTag;
  let sScore, sAcc, sMiss, sCombo, sClean, sTime, endGrade, endNote;

  let state = null;

  let rafId = 0;
  let tickTimer = 0;
  let spawnTimer = 0;
  let feverTimer = 0;

  let bootOnce = false;
  let boundOnce = false;
  let endLock = false;
  let lastShootAt = 0;

  const TARGETS = new Map();
  let targetSeq = 1;

  // missions
  let MISSIONS = null;
  let __lastCleanPct = 0;
  let __mpopTm = 0;
  let __mpopLastKey = '';
  let __mpopCooldown = 0;

  // synergy
  let __shieldBreaker = 0;         // 0..2
  let __shieldBreakerUntil = 0;

  // logger
  let LOG = null;

  /* ---------------- config ---------------- */
  function readConfig(){
    const view = String(qs('view','mobile')).toLowerCase();
    const run  = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = clamp(qs('time','80'), 20, 300);
    const pid  = String(qs('pid','anon') || 'anon');
    const seed = safeNum(qs('seed', String(Date.now())), Date.now());
    const hub  = String(qs('hub','../hub.html') || '../hub.html');

    // logger opts
    const logOn = String(qs('log','0')) === '1';
    const api = String(qs('api','') || '').trim();

    const D = {
      easy:   { spawnMs: 1050, ttlMs: 2200, bossEvery: 9,  bossHp: 4, cleanGain: 8,  missClean: 1, maxTargets: 3 },
      normal: { spawnMs: 850,  ttlMs: 1800, bossEvery: 7,  bossHp: 5, cleanGain: 7,  missClean: 1, maxTargets: 4 },
      hard:   { spawnMs: 700,  ttlMs: 1500, bossEvery: 6,  bossHp: 6, cleanGain: 6,  missClean: 2, maxTargets: 5 },
    }[diff] || {
      spawnMs: 850, ttlMs: 1800, bossEvery: 7, bossHp: 5, cleanGain: 7, missClean: 1, maxTargets: 4
    };

    return { view, run, diff, time, pid, seed, hub, logOn, api, ...D };
  }

  /* ---------------- dom ---------------- */
  function cacheDom(){
    root      = $('#br-wrap');
    layer     = $('#br-layer');
    fxLayer   = $('#br-fx');
    menu      = $('#br-menu');
    end       = $('#br-end');
    tapStart  = $('#tapStart');
    toastEl   = $('#toast');
    fatalEl   = $('#fatal');

    btnStart    = $('#btnStart');
    btnRetry    = $('#btnRetry');
    btnPause    = $('#btnPause');
    btnHow      = $('#btnHow');
    btnRecenter = $('#btnRecenter');
    tapBtn      = $('#tapBtn');
    btnBack     = $('#btnBack');
    btnBackHub2 = $('#btnBackHub2');

    tScore = $('#tScore'); tCombo = $('#tCombo'); tMiss = $('#tMiss'); tTime = $('#tTime');
    tClean = $('#tClean'); tFever = $('#tFever'); bClean = $('#bClean'); bFever = $('#bFever');

    mDiff = $('#mDiff'); mTime = $('#mTime');
    ctxView = $('#br-ctx-view'); ctxSeed = $('#br-ctx-seed'); ctxTime = $('#br-ctx-time'); diffTag = $('#br-diffTag');

    sScore = $('#sScore'); sAcc = $('#sAcc'); sMiss = $('#sMiss'); sCombo = $('#sCombo');
    sClean = $('#sClean'); sTime = $('#sTime'); endGrade = $('#endGrade'); endNote = $('#endNote');
  }

  function setFatal(msg){
    try{
      if(!fatalEl) return;
      fatalEl.classList.remove('br-hidden');
      fatalEl.textContent = String(msg || 'Unknown error');
    }catch(_){}
  }

  function setUiMode(mode){
    // mode = menu | play | end
    try{ DOC.documentElement.dataset.brUi = mode; }catch(_){}
    try{ root && (root.dataset.state = mode); }catch(_){}

    if(menu){
      if(mode === 'menu'){
        menu.setAttribute('aria-hidden','false');
        menu.style.display = '';
      }else{
        menu.setAttribute('aria-hidden','true');
        menu.style.display = 'none';
      }
    }
    if(end){
      end.hidden = (mode !== 'end');
      end.style.display = (mode === 'end') ? '' : 'none';
    }

    // broadcast to boot (optional)
    tryEvent('brush:ui', { mode });
  }

  function showToast(msg){
    if(!toastEl) return;
    toastEl.textContent = String(msg || '');
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toastEl && toastEl.classList.remove('show'), 1200);
  }

  /* ---------------- logger (optional) ---------------- */
  function buildLogger(){
    if(!cfg || !cfg.logOn || !cfg.api) return null;
    const endpoint = cfg.api;
    const sid = `brush-${cfg.pid}-${cfg.seed}-${Date.now()}`;

    async function post(kind, rows){
      try{
        await fetch(endpoint, {
          method:'POST',
          headers:{ 'content-type':'application/json' },
          body: JSON.stringify({ kind, rows })
        });
      }catch(_){}
    }

    function baseRow(extra){
      return Object.assign({
        ts: new Date().toISOString(),
        game: 'brush',
        pid: cfg.pid,
        seed: cfg.seed,
        diff: cfg.diff,
        view: cfg.view,
        run: cfg.run,
        sid
      }, extra || {});
    }

    return {
      sid,
      event: (name, extra)=> post('events', [baseRow({ name, ...(extra||{}) })]),
      sessionStart: ()=> post('sessions', [baseRow({ type:'session_start', time: cfg.time })]),
      sessionEnd: (summary)=> post('sessions', [baseRow({ type:'session_end', ...(summary||{}) })]),
    };
  }

  /* ---------------- game state ---------------- */
  function freshState(){
    return {
      started: false,
      ended: false,
      paused: false,

      timeTotal: Number(cfg.time),
      timeLeft: Number(cfg.time),

      score: 0,
      combo: 0,
      maxCombo: 0,
      miss: 0,
      hits: 0,
      shots: 0,
      cleanPct: 0,

      feverOn: false,
      feverGauge: 0, // 0..100
      spawned: 0,
      bossSpawned: 0,

      // deterministic “reads” (in-round only)
      missStreak: 0,
      hitStreak: 0,
      lastHitAt: 0,

      startAtMs: 0,
      endAtMs: 0,
      lastTickAt: 0,
    };
  }

  function resetAllRuntime(){
    stopLoops();
    TARGETS.forEach(t => { try{ t.el.remove(); }catch(_){} });
    TARGETS.clear();
    targetSeq = 1;
    if(layer){
      layer.innerHTML = '';
      layer.style.pointerEvents = '';
    }
    if(fxLayer){
      fxLayer.innerHTML = '';
    }
  }

  function stopLoops(){
    try{ if(rafId){ cancelAnimationFrame(rafId); rafId = 0; } }catch(_){}
    try{ if(tickTimer){ clearInterval(tickTimer); tickTimer = 0; } }catch(_){}
    try{ if(spawnTimer){ clearInterval(spawnTimer); spawnTimer = 0; } }catch(_){}
    try{ if(feverTimer){ clearTimeout(feverTimer); feverTimer = 0; } }catch(_){}
  }

  /* ---------------- hud ---------------- */
  function renderHud(){
    if(!state) return;
    if(tScore) tScore.textContent = String(Math.round(state.score));
    if(tCombo) tCombo.textContent = String(Math.round(state.combo));
    if(tMiss)  tMiss.textContent = String(Math.round(state.miss));
    if(tTime)  tTime.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
    if(tClean) tClean.textContent = pct(state.cleanPct);
    if(tFever) tFever.textContent = state.feverOn ? 'ON' : 'OFF';

    if(bClean) bClean.style.width = clamp(state.cleanPct,0,100) + '%';
    if(bFever) bFever.style.width = clamp(state.feverGauge,0,100) + '%';
  }

  function renderCtx(){
    if(!cfg) return;
    if(ctxView) ctxView.textContent = cfg.view;
    if(ctxSeed) ctxSeed.textContent = String(cfg.seed);
    if(ctxTime) ctxTime.textContent = String(cfg.time);
    if(diffTag) diffTag.textContent = cfg.diff;
    if(mDiff)   mDiff.textContent = cfg.diff;
    if(mTime)   mTime.textContent = String(cfg.time);

    try{ DOC.body.dataset.view = cfg.view; }catch(_){}
    try{ root && (root.dataset.view = cfg.view); }catch(_){}

    if(btnBack) btnBack.href = cfg.hub || '../hub.html';
    if(btnBackHub2) btnBackHub2.href = cfg.hub || '../hub.html';
  }

  /* ---------------- fx ---------------- */
  function ensureFx(kind){
    if(!fxLayer) return null;
    let el = fxLayer.querySelector('.fx-' + kind);
    if(el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-' + kind;
    fxLayer.appendChild(el);
    return el;
  }
  function flashFx(kind){
    const k = (kind === 'shock' || kind === 'flash' || kind === 'laser' || kind === 'fin') ? kind : 'flash';
    const el = ensureFx(k);
    if(!el) return;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
    const dur = (k === 'laser') ? 1300 : (k === 'shock' ? 400 : 180);
    setTimeout(()=>{ try{ el.classList.remove('on'); }catch(_){ } }, dur);
  }

  /* ---------------- scoring helpers ---------------- */
  function __bonusScore(n){
    if(!state) return;
    state.score += Math.max(0, Number(n)||0);
  }
  function __bonusClean(n){
    if(!state) return;
    state.cleanPct = clamp(state.cleanPct + (Number(n)||0), 0, 100);
  }
  function __addTime(sec){
    if(!state) return;
    state.timeLeft = Math.min(state.timeTotal, state.timeLeft + Math.max(0, Number(sec)||0));
  }

  /* ---------------- missions ---------------- */
  function __mpBump(el){
    try{
      if(!el) return;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
      setTimeout(()=>{ try{ el.classList.remove('bump'); }catch(_){ } }, 260);
    }catch(_){}
  }

  function __mpopShow(title, desc, pct01){
    try{
      const pop = DOC.getElementById('br-mpop');
      const t = DOC.getElementById('br-mpop-title');
      const d = DOC.getElementById('br-mpop-desc');
      const b = DOC.getElementById('br-mpop-bar');
      if(!pop || !t || !d || !b) return;
      t.textContent = String(title || 'MISSION');
      d.textContent = String(desc || '');
      b.style.width = Math.round(clamp(pct01,0,1)*100) + '%';
      pop.classList.add('show');
      pop.setAttribute('aria-hidden','false');
      clearTimeout(__mpopTm);
      __mpopTm = setTimeout(()=>{
        try{
          pop.classList.remove('show');
          pop.setAttribute('aria-hidden','true');
        }catch(_){}
      }, 900);
    }catch(_){}
  }

  function __mpopMaybeHint(){
    if(!MISSIONS || !state || !state.started || state.ended) return;
    const now = Date.now();
    if(now < __mpopCooldown) return;

    // spotlight first
    let m = MISSIONS.find(x=>!x.done && x.spot);
    if(!m) m = MISSIONS.find(x=>!x.done);
    if(!m || !m.goal) return;

    const p = clamp(m.cur / m.goal, 0, 1);
    if(p < 0.90 || p >= 1) return;

    const key = `${m.id}:${Math.floor(p*100)}`;
    if(key === __mpopLastKey) return;
    __mpopLastKey = key;

    __mpopCooldown = now + 650;
    __mpopShow('เกือบสำเร็จ!', `${m.title} • ${m.cur}/${m.goal}`, p);
  }

  function __missionCatalog(){
    // goals are computed deterministically from seed+pid+day
    return [
      {
        id:'combo',
        title:'คอมโบให้ถึง',
        desc:'ทำคอมโบสูงสุดให้ถึงเป้า',
        make:(r)=>({ goal: 6 + Math.floor(r()*5) }), // 6..10
        progress:()=>({ cur: Math.min(state.maxCombo, 999), goal: MISSIONS_META.combo.goal }),
        done:()=> state.maxCombo >= MISSIONS_META.combo.goal
      },
      {
        id:'weakspot',
        title:'ยิงจุดอ่อนบอส',
        desc:'ยิง weakspot ให้ครบ',
        make:(r)=>({ goal: 2 + Math.floor(r()*3) }), // 2..4
        progress:()=>({ cur: MISSIONS_META.weakspot.cur, goal: MISSIONS_META.weakspot.goal }),
        done:()=> MISSIONS_META.weakspot.cur >= MISSIONS_META.weakspot.goal
      },
      {
        id:'clean',
        title:'ความสะอาดให้ถึง',
        desc:'สะสม Clean% ให้ถึงเป้า',
        make:(r)=>({ goal: 70 + Math.floor(r()*21) }), // 70..90
        progress:()=>({ cur: Math.floor(state.cleanPct), goal: MISSIONS_META.clean.goal }),
        done:()=> state.cleanPct >= MISSIONS_META.clean.goal
      },
      {
        id:'fever',
        title:'เปิด FEVER',
        desc:'ทำให้ FEVER ติดอย่างน้อย 1 ครั้ง',
        make:()=>({ goal: 1 }),
        progress:()=>({ cur: MISSIONS_META.fever.cur, goal: 1 }),
        done:()=> MISSIONS_META.fever.cur >= 1
      },
      {
        id:'nomiss',
        title:'พลาดให้น้อย',
        desc:'จบรอบด้วย MISS ไม่เกินเป้า',
        make:(r)=>({ goal: 6 + Math.floor(r()*5) }), // 6..10
        progress:()=>({ cur: state.miss, goal: MISSIONS_META.nomiss.goal }),
        done:()=> state.miss <= MISSIONS_META.nomiss.goal && (state.timeLeft<=0 || state.cleanPct>=100 || state.ended)
      },
      {
        id:'perfect',
        title:'เก็บ PERFECT',
        desc:'ยิงใกล้หมดเวลาเป้าให้ได้ครบ',
        make:(r)=>({ goal: 2 + Math.floor(r()*4) }), // 2..5
        progress:()=>({ cur: MISSIONS_META.perfect.cur, goal: MISSIONS_META.perfect.goal }),
        done:()=> MISSIONS_META.perfect.cur >= MISSIONS_META.perfect.goal
      }
    ];
  }

  // runtime meta store for mission-specific counters/goals
  let MISSIONS_META = null;

  function __buildDailyMissions(){
    const day = getLocalDayKey();
    const seedStr = `${cfg.pid}|${cfg.seed}|${cfg.diff}|${cfg.view}|${day}|brush-missions`;
    const r = makeRng(hash32(seedStr));

    const catalog = __missionCatalog();
    const ids = catalog.map(x=>x.id);

    // deterministic pick 3 unique
    shuffleInPlace(ids, r);
    const picked = ids.slice(0,3);

    // pick spotlight deterministically among 3
    const spotIdx = hash32(seedStr + '|spot') % 3;

    // init meta store
    MISSIONS_META = {
      combo: { goal: 8, cur:0 },
      weakspot: { goal: 3, cur:0 },
      clean: { goal: 80, cur:0 },
      fever: { goal: 1, cur:0 },
      nomiss: { goal: 8, cur:0 },
      perfect: { goal: 3, cur:0 }
    };

    // assign goals
    picked.forEach((id)=>{
      const m = catalog.find(x=>x.id===id);
      if(!m) return;
      const g = (m.make ? m.make(r) : {goal:1});
      if(MISSIONS_META[id]){
        MISSIONS_META[id].goal = clamp(g.goal, 1, 999);
        MISSIONS_META[id].cur = 0;
      }
    });

    return picked.map((id, idx)=>{
      const m = catalog.find(x=>x.id===id);
      return {
        id,
        title: m ? m.title : id,
        desc:  m ? m.desc : '',
        goal:  MISSIONS_META[id] ? MISSIONS_META[id].goal : 1,
        cur:   0,
        done:  false,
        spot:  idx === spotIdx
      };
    });
  }

  function __renderMissionsPanel(){
    try{
      const panel = DOC.getElementById('br-mpanel');
      if(!panel || !MISSIONS) return;

      const list = panel.querySelector('.br-mlist');
      const press = panel.querySelector('.br-press b');
      if(!list) return;

      list.innerHTML = '';
      let left = 0;

      MISSIONS.forEach((m)=>{
        left += m.done ? 0 : 1;

        const row = DOC.createElement('div');
        row.className = 'br-mi' + (m.spot ? ' is-spot' : '') + (m.done ? ' is-done' : '');
        row.dataset.mid = m.id;

        const t = DOC.createElement('div');
        t.className = 't';
        t.textContent = m.title + (m.spot ? ' ★' : '');
        row.appendChild(t);

        const d = DOC.createElement('div');
        d.className = 'd';
        d.textContent = m.desc;
        row.appendChild(d);

        const c = DOC.createElement('div');
        c.className = 'c';
        c.textContent = `${m.cur}/${m.goal}`;
        row.appendChild(c);

        const p = DOC.createElement('div');
        p.className = 'p';
        const i = DOC.createElement('i');
        i.style.width = Math.round(clamp(m.cur / Math.max(1,m.goal),0,1) * 100) + '%';
        p.appendChild(i);
        row.appendChild(p);

        list.appendChild(row);
      });

      if(press) press.textContent = String(left);
    }catch(_){}
  }

  function __applyMissionReward(mid){
    if(!state || !MISSIONS) return;
    const m = MISSIONS.find(x=>x.id===mid);
    if(!m) return;

    // small deterministic reward
    const spot = !!m.spot;
    const clutch = state.timeLeft <= 12;

    // reward baseline
    __bonusScore( spot ? 45 : 25 );
    __bonusClean( spot ? 6 : 3 );
    if(clutch && spot) __addTime(0.6);

    showToast(spot ? 'MISSION CLEAR ★' : 'MISSION CLEAR');
    __beep(720, 110, 0.07);

    // synergy: spotlight -> Shield Breaker
    if(spot){
      __grantShieldBreaker(clutch ? 2 : 1, clutch ? 14 : 10);
    }

    // log
    if(LOG) LOG.event('mission_clear', { mid, spot: spot?1:0, clutch: clutch?1:0 });
  }

  function __missionProgress(reason){
    if(!MISSIONS || !MISSIONS_META || !state) return;

    // update dynamic counters
    // clean increment
    const cNow = Math.floor(state.cleanPct);
    const deltaClean = Math.max(0, cNow - (__lastCleanPct||0));
    __lastCleanPct = cNow;

    // apply to missions that depend on deltas
    if(deltaClean>0){
      // nothing special; clean mission reads state.cleanPct
    }

    // update each mission cur/done
    MISSIONS.forEach((m)=>{
      if(m.done) return;

      if(m.id === 'combo'){
        m.cur = Math.min(state.maxCombo, m.goal);
      }else if(m.id === 'weakspot'){
        m.cur = clamp(MISSIONS_META.weakspot.cur, 0, m.goal);
      }else if(m.id === 'clean'){
        m.cur = clamp(Math.floor(state.cleanPct), 0, m.goal);
      }else if(m.id === 'fever'){
        m.cur = clamp(MISSIONS_META.fever.cur, 0, 1);
      }else if(m.id === 'nomiss'){
        // "done" evaluated at end; still show cur
        m.cur = Math.min(state.miss, m.goal+50);
      }else if(m.id === 'perfect'){
        m.cur = clamp(MISSIONS_META.perfect.cur, 0, m.goal);
      }

      // compute done
      let done = false;
      if(m.id === 'nomiss'){
        // only finalize at end, but if already exceed goal => cannot complete
        done = state.ended ? (state.miss <= m.goal) : false;
      }else{
        done = (m.cur >= m.goal);
      }

      if(done && !m.done){
        m.done = true;
        __applyMissionReward(m.id);

        // bump row (if panel exists)
        const row = DOC.querySelector(`.br-mi[data-mid="${m.id}"]`);
        __mpBump(row);
      }
    });

    __renderMissionsPanel();
    __mpopMaybeHint();

    // all clear bonus (in-round, only once when last mission flips)
    if(state.started && !state.ended && MISSIONS.every(x=>x.done)){
      // give a small “victory” glow once (guard using a flag on state)
      if(!state.__allMissionsClear){
        state.__allMissionsClear = true;
        showToast('ALL MISSIONS CLEAR 🎉');
        __beep(760, 140, 0.08);
        __bonusScore(60);
        __bonusClean(4);
      }
    }
  }

  /* ---------------- synergy ---------------- */
  function __grantShieldBreaker(amount, secs){
    amount = clamp(amount, 1, 2);
    secs = clamp(secs, 6, 18);
    __shieldBreaker = Math.max(__shieldBreaker, amount);
    __shieldBreakerUntil = Date.now() + secs*1000;
    showToast(`Shield Breaker ⚡ x${__shieldBreaker}`);
    __beep(820, 110, 0.07);
  }

  function __useShieldBreaker(){
    if(__shieldBreaker <= 0) return 0;
    if(Date.now() > __shieldBreakerUntil){
      __shieldBreaker = 0;
      return 0;
    }
    __shieldBreaker = Math.max(0, __shieldBreaker - 1);
    return 1;
  }

  function __tickSynergy(){
    if(__shieldBreaker > 0 && Date.now() > __shieldBreakerUntil){
      __shieldBreaker = 0;
    }
  }

  /* ---------------- target logic ---------------- */
  function layerRect(){
    return layer ? layer.getBoundingClientRect() : {left:0,top:0,width:320,height:240};
  }

  function pickSpawnPos(size){
    const r = layerRect();
    const pad = Math.max(44, size * 0.7);
    const x = pad + (r.width - pad*2) * rng();
    const y = 70 + (r.height - (70 + pad) - pad) * rng();
    return { x, y };
  }

  function makeTarget(kind='normal'){
    if(!layer || !state || !state.started || state.ended) return null;

    const id = 't' + (targetSeq++);
    const isBoss = (kind === 'boss');

    const hpMax = isBoss ? cfg.bossHp : 1;
    const size = isBoss ? 92 : 78;
    const ttl = isBoss ? Math.round(cfg.ttlMs * 1.65) : cfg.ttlMs;
    const p = pickSpawnPos(size);

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'br-t' + (isBoss ? ' thick' : '') + ' pop';
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.dataset.hp = String(hpMax);
    el.dataset.hpMax = String(hpMax);
    el.dataset.spawnAt = String(nowMs());
    el.dataset.expireAt = String(nowMs() + ttl);

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent = isBoss ? '💎' : '🦠';
    el.appendChild(emo);

    // boss weakspot + shield overlay (Phase2 fake-out)
    if(isBoss){
      const ws = DOC.createElement('div');
      ws.className = 'br-ws';
      const dx = (rng()*16 - 8);
      const dy = (rng()*16 - 8);
      ws.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      el.appendChild(ws);

      const sh = DOC.createElement('div');
      sh.className = 'br-shield';
      sh.style.display = 'none';
      el.appendChild(sh);

      // inline fallback style (in case CSS not patched yet)
      sh.style.position = 'absolute';
      sh.style.left='50%'; sh.style.top='50%';
      sh.style.width='120%'; sh.style.height='120%';
      sh.style.transform='translate(-50%,-50%)';
      sh.style.borderRadius='999px';
      sh.style.border='2px solid rgba(34,211,238,.35)';
      sh.style.boxShadow='0 0 0 2px rgba(34,211,238,.10) inset';
      sh.style.background='radial-gradient(circle at 50% 50%, rgba(34,211,238,.14), rgba(34,211,238,0) 60%)';
      sh.style.pointerEvents='none';
    }

    if(hpMax > 1){
      const hp = DOC.createElement('div');
      hp.className = 'hp';
      hp.innerHTML = '<i></i>';
      el.appendChild(hp);
    }

    const t = {
      id, el, kind, isBoss,
      hp: hpMax, hpMax,
      x: p.x, y: p.y,
      bornAt: nowMs(),
      expireAt: nowMs() + ttl,
      removed: false,
      ttl,

      // boss phase2 fake-out
      phase: 1,
      shieldOn: false,
      shieldHp: 0,
      warpLeft: 0,
    };

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitTargetByPointer(t, ev.clientX, ev.clientY);
    }, {passive:false});

    TARGETS.set(id, t);
    layer.appendChild(el);

    state.spawned++;
    if(isBoss) state.bossSpawned++;
    return t;
  }

  function updateTargetHpUI(t){
    if(!t || !t.el) return;
    t.el.dataset.hp = String(t.hp);
    const hpFill = t.el.querySelector('.hp i');
    if(hpFill){
      const w = clamp((t.hp / t.hpMax) * 100, 0, 100);
      hpFill.style.width = w + '%';
    }
  }

  function removeTarget(t){
    if(!t || t.removed) return;
    t.removed = true;
    TARGETS.delete(t.id);
    try{
      t.el.classList.add('fade');
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 180);
    }catch(_){}
  }

  function bossWeakspotHit(t, clientX, clientY){
    if(!t || !t.isBoss || !t.el) return false;
    const ws = t.el.querySelector('.br-ws');
    if(!ws) return false;
    const a = ws.getBoundingClientRect();
    return (clientX >= a.left && clientX <= a.right && clientY >= a.top && clientY <= a.bottom);
  }

  function gainFever(n){
    state.feverGauge = clamp(state.feverGauge + n, 0, 100);
    if(!state.feverOn && state.feverGauge >= 100){
      state.feverOn = true;
      state.feverGauge = 100;
      MISSIONS_META && (MISSIONS_META.fever.cur = 1);
      showToast('FEVER ON 🔥');
      __beep(690, 110, 0.06);
      clearTimeout(feverTimer);
      feverTimer = setTimeout(()=>{
        if(!state) return;
        state.feverOn = false;
        state.feverGauge = 0;
        renderHud();
      }, 7000);
    }
  }

  function addScore(base, perfect=false, crit=false){
    let s = base;
    if(perfect) s += 3;
    if(crit) s += 6;
    if(state.combo >= 5) s += 2;
    if(state.feverOn) s = Math.round(s * 1.5);
    state.score += s;
  }

  function addClean(n){
    state.cleanPct = clamp(state.cleanPct + n, 0, 100);
  }

  function decayCleanOnMiss(){
    state.cleanPct = clamp(state.cleanPct - cfg.missClean, 0, 100);
  }

  function __bossEnterPhase2(t){
    if(!t || !t.isBoss || t.phase !== 1) return;
    t.phase = 2;
    t.shieldOn = true;

    const base = 3;
    const bonus = (state.hitStreak >= 6) ? 1 : 0;
    const mercy = (state.missStreak >= 2) ? 1 : 0;
    t.shieldHp = clamp(base + bonus - mercy, 2, 4);

    t.warpLeft = (state.hitStreak >= 6) ? 2 : 1;

    const sh = t.el.querySelector('.br-shield');
    if(sh) sh.style.display = '';

    showToast('PHASE 2! โล่ขึ้น ⚡');
    __beep(820, 120, 0.07);
    if(LOG) LOG.event('boss_phase2', { shieldHp: t.shieldHp, warpLeft: t.warpLeft });
  }

  function hitTargetCore(t, hitX, hitY){
    if(!state || !state.started || state.ended || state.paused) return;
    if(!t || t.removed) return;

    state.shots++;

    const rem = Math.max(0, t.expireAt - nowMs());
    const perfect = rem <= Math.min(420, t.ttl * 0.22);

    if(t.isBoss){
      // Phase2 shield fake-out: must break shield first
      if(t.shieldOn){
        t.shieldHp = Math.max(0, (t.shieldHp||0) - 1);

        // synergy breaker (spotlight mission reward)
        const cut = __useShieldBreaker();
        if(cut){
          t.shieldHp = Math.max(0, (t.shieldHp||0) - 1);
          showToast('Breaker! ⚡');
          __beep(900, 80, 0.08);
        }

        addScore(2, false, false);
        gainFever(6);
        flashFx('laser');

        t.el.classList.add('ws-hit');
        setTimeout(()=>{ try{ t.el.classList.remove('ws-hit'); }catch(_){ } }, 120);

        if(t.shieldHp <= 0){
          t.shieldOn = false;
          const sh = t.el.querySelector('.br-shield');
          if(sh) sh.style.display = 'none';
          showToast('โล่แตก! 🎯 ยิงจุดอ่อน!');
          __beep(760, 140, 0.07);
          if(LOG) LOG.event('boss_shield_break', {});
        }else{
          showToast(`โล่ ${t.shieldHp}`);
        }

        renderHud();
        __missionProgress('shield');
        checkEndConditions();
        return;
      }

      // normal boss damage with weakspot crit
      const crit = bossWeakspotHit(t, hitX, hitY);
      const dmg = crit ? 2 : 1;
      t.hp = Math.max(0, t.hp - dmg);

      if(crit){
        // mission weakspot
        if(MISSIONS_META && MISSIONS_META.weakspot) MISSIONS_META.weakspot.cur++;
        t.el.classList.add('ws-hit');
        setTimeout(()=>{ try{ t.el.classList.remove('ws-hit'); }catch(_){ } }, 160);
      }

      // enter phase2 threshold (<=55%)
      if(t.phase === 1 && t.hp <= Math.ceil(t.hpMax * 0.55)){
        __bossEnterPhase2(t);
        // do not return: allow this hit to count, then next hits go to shield
      }

      updateTargetHpUI(t);

      if(t.hp <= 0){
        state.hits++;
        state.combo++;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.hitStreak++;
        state.missStreak = 0;
        state.lastHitAt = Date.now();

        addScore(12, perfect, crit);
        addClean(cfg.cleanGain + 8);
        gainFever(18);
        removeTarget(t);
        flashFx('shock');

        showToast(crit ? 'CRIT! 💎' : 'Boss แตก! 💎');
        __beep(720, 120, 0.07);
        if(LOG) LOG.event('boss_kill', { crit: crit?1:0, perfect: perfect?1:0 });

      }else{
        // hit but not dead yet
        state.hits++;
        state.combo++;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.hitStreak++;
        state.missStreak = 0;
        state.lastHitAt = Date.now();

        addScore(3, false, crit);
        gainFever(6 + (crit?4:0));
        flashFx(crit ? 'flash' : 'laser');

        // warp fake-out (Phase2) after successful hit (shield already down)
        if(t.phase === 2 && !t.shieldOn && t.warpLeft > 0){
          t.warpLeft--;
          const p = pickSpawnPos(92);
          t.el.style.left = p.x + 'px';
          t.el.style.top  = p.y + 'px';
          showToast('WARP! ✨');
          __beep(980, 70, 0.06);
          flashFx('shock');
          if(LOG) LOG.event('boss_warp', { left: t.warpLeft });
        }
      }

    }else{
      // normal germ
      state.hits++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.hitStreak++;
      state.missStreak = 0;
      state.lastHitAt = Date.now();

      addScore(5, perfect, false);
      addClean(cfg.cleanGain);
      gainFever(8);

      if(perfect && MISSIONS_META && MISSIONS_META.perfect){
        MISSIONS_META.perfect.cur++;
      }

      removeTarget(t);
      flashFx(perfect ? 'flash' : 'laser');
      __beep(perfect ? 760 : 690, 70, 0.05);
    }

    renderHud();
    __missionProgress('hit');
    checkEndConditions();
  }

  function hitTargetByPointer(t, clientX, clientY){
    hitTargetCore(t, clientX, clientY);
  }

  function hitByScreenPoint(clientX, clientY){
    if(!state || !state.started || state.ended || state.paused) return;

    state.shots++;

    // lock to closest target
    const lockPx = 28;
    let best = null, bestD = 1e9;

    TARGETS.forEach((t)=>{
      if(!t || t.removed) return;
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dx = cx - clientX, dy = cy - clientY;
      const d = Math.hypot(dx, dy);
      if(d < bestD){
        bestD = d; best = t;
      }
    });

    if(best && bestD <= lockPx + (best.isBoss ? 18 : 8)){
      hitTargetCore(best, clientX, clientY);
      return;
    }

    // miss
    state.miss++;
    state.combo = 0;
    state.missStreak++;
    state.hitStreak = 0;

    decayCleanOnMiss();
    renderHud();
    __missionProgress('miss');
    if(LOG) LOG.event('miss', { kind:'shoot' });
  }

  function expireTargets(){
    const tNow = nowMs();
    TARGETS.forEach((t)=>{
      if(t.removed) return;
      if(tNow >= t.expireAt){
        state.miss++;
        state.combo = 0;
        state.missStreak++;
        state.hitStreak = 0;
        decayCleanOnMiss();
        removeTarget(t);
        if(LOG) LOG.event('miss', { kind:'expire', isBoss: t.isBoss?1:0 });
      }
    });
  }

  function maybeSpawn(){
    if(!state || !state.started || state.ended || state.paused) return;
    if(TARGETS.size >= cfg.maxTargets) return;

    const shouldBoss = (state.spawned > 0 && state.spawned % cfg.bossEvery === 0);
    makeTarget(shouldBoss ? 'boss' : 'normal');
  }

  /* ---------------- loop ---------------- */
  function tick(){
    if(!state || !state.started || state.ended || state.paused) return;

    const t = Date.now();
    if(!state.lastTickAt) state.lastTickAt = t;
    const dt = Math.max(0, (t - state.lastTickAt) / 1000);
    state.lastTickAt = t;

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    expireTargets();

    if(!state.feverOn && state.feverGauge > 0){
      state.feverGauge = Math.max(0, state.feverGauge - dt * 3.5);
    }

    __tickSynergy();
    renderHud();

    // missions tick (also drives popup)
    __missionProgress('tick');

    checkEndConditions();
  }

  function frame(){
    if(!state || !state.started || state.ended) return;
    rafId = requestAnimationFrame(frame);
  }

  function startLoops(){
    stopLoops();
    state.lastTickAt = Date.now();
    tickTimer = setInterval(tick, 100);
    spawnTimer = setInterval(maybeSpawn, cfg.spawnMs);
    rafId = requestAnimationFrame(frame);
  }

  /* ---------------- end/summary ---------------- */
  function gradeFromScore(acc, clean, timeSpent){
    if(clean >= 100 && acc >= 75 && timeSpent <= cfg.time * 0.8) return 'A';
    if(clean >= 100 && acc >= 55) return 'B';
    if(clean >= 80) return 'C';
    return 'D';
  }

  function fillSummary(reason){
    const timeSpent = Math.max(0, cfg.time - state.timeLeft);
    const acc = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0;
    const grade = gradeFromScore(acc, state.cleanPct, timeSpent);

    sScore && (sScore.textContent = String(Math.round(state.score)));
    sAcc && (sAcc.textContent = acc + '%');
    sMiss && (sMiss.textContent = String(Math.round(state.miss)));
    sCombo && (sCombo.textContent = String(Math.round(state.maxCombo)));
    sClean && (sClean.textContent = pct(state.cleanPct));
    sTime && (sTime.textContent = timeSpent.toFixed(1) + 's');
    endGrade && (endGrade.textContent = grade);

    const mDone = (MISSIONS && MISSIONS.length) ? MISSIONS.filter(x=>x.done).length : 0;
    const mAll  = (MISSIONS && MISSIONS.length) ? MISSIONS.length : 0;

    let msg = '-';
    if(reason === 'clean') msg = 'ALMOST!';
    if(reason === 'timeout' && state.cleanPct >= 70) msg = 'เกือบผ่านแล้ว!';
    if(reason === 'timeout' && state.cleanPct < 70) msg = 'ลองโฟกัสเป้าจังหวะท้าย ๆ ให้แม่นขึ้น 💪';

    const meta = `reason=${reason} | missions=${mDone}/${mAll} | seed=${cfg.seed} | diff=${cfg.diff} | view=${cfg.view} | pid=${cfg.pid}`;
    endNote && (endNote.textContent = `${msg}\n${meta}`);
  }

  function endGame(reason){
    if(!state || !state.started) return;
    if(state.ended || endLock) return;

    endLock = true;
    state.ended = true;
    state.endAtMs = Date.now();

    stopLoops();
    TARGETS.forEach(t => { try{ t.el.style.pointerEvents='none'; }catch(_){ } });

    // finalize nomiss mission (only at end)
    try{
      if(MISSIONS){
        const nm = MISSIONS.find(x=>x.id==='nomiss');
        if(nm && !nm.done){
          nm.cur = state.miss;
          if(state.miss <= nm.goal){
            nm.done = true;
            __applyMissionReward('nomiss');
          }
        }
      }
    }catch(_){}

    // ✅ Mission clear bonus at end (big payoff, still safe)
    try{
      if(MISSIONS && MISSIONS.length && MISSIONS.every(m=>m.done)){
        __bonusScore(120);
        __bonusClean(10);
        __addTime(1.0);
        showToast('ALL MISSIONS CLEAR 🎉');
        __beep(740,120,0.07);
      }
    }catch(_){}

    fillSummary(reason || 'timeout');
    renderHud();
    setUiMode('end');

    // dispatch for boot.js
    tryEvent('brush:end', {
      reason: String(reason||'timeout'),
      score: Math.round(state.score),
      miss: Math.round(state.miss),
      maxCombo: Math.round(state.maxCombo),
      cleanPct: Math.round(state.cleanPct),
      accPct: state.shots > 0 ? Math.round((state.hits/state.shots)*100) : 0,
      timeText: (Math.max(0, cfg.time - state.timeLeft)).toFixed(1) + 's',
      grade: endGrade ? endGrade.textContent : '',
      note: endNote ? endNote.textContent : ''
    });

    // logger
    if(LOG){
      const acc = state.shots > 0 ? Math.round((state.hits/state.shots)*100) : 0;
      const mDone = (MISSIONS && MISSIONS.length) ? MISSIONS.filter(x=>x.done).length : 0;
      LOG.event('end', { reason:String(reason||'timeout'), score:Math.round(state.score), miss:state.miss, combo:state.maxCombo, clean:Math.round(state.cleanPct), acc });
      LOG.sessionEnd({ score:Math.round(state.score), miss:state.miss, combo:state.maxCombo, clean:Math.round(state.cleanPct), acc, missions:mDone });
    }

    setTimeout(()=>{ endLock = false; }, 80);
  }

  function checkEndConditions(){
    if(!state || !state.started || state.ended) return;
    if(state.cleanPct >= 100){
      endGame('clean');
      return;
    }
    if(state.timeLeft <= 0){
      endGame('timeout');
      return;
    }
  }

  /* ---------------- controls ---------------- */
  function startGame(){
    if(!state) state = freshState();

    resetAllRuntime();
    state = freshState();
    state.started = true;
    state.startAtMs = Date.now();

    __lastCleanPct = 0;

    // build daily missions once per start (deterministic)
    MISSIONS = __buildDailyMissions();
    __renderMissionsPanel();

    renderHud();
    setUiMode('play');

    if(tapStart) tapStart.style.display = 'none';
    if(btnPause) btnPause.textContent = 'Pause';

    // logger
    if(LOG){
      LOG.sessionStart();
      LOG.event('start', { time: cfg.time });
    }

    startLoops();
    maybeSpawn();
    showToast('เริ่มแปรง! 🪥');
    __beep(660, 90, 0.06);

    // dispatch for boot.js
    tryEvent('brush:start', { ts: Date.now(), seed: cfg.seed, diff: cfg.diff, view: cfg.view });
  }

  function retryGame(){
    if(end){ end.hidden = true; end.style.display = 'none'; }
    startGame();
  }

  function togglePause(){
    if(!state || !state.started || state.ended) return;
    state.paused = !state.paused;
    if(btnPause) btnPause.textContent = state.paused ? 'Resume' : 'Pause';
    showToast(state.paused ? 'พักเกม ⏸' : 'เล่นต่อ ▶');
    __beep(state.paused ? 520 : 690, 80, 0.05);
    if(!state.paused) state.lastTickAt = Date.now();
    if(LOG) LOG.event('pause', { on: state.paused?1:0 });
  }

  function showHow(){
    showToast('ยิง/แตะ 🦠 | บอส 💎 มีจุดอ่อน 🎯 | Phase2 ต้องแตกโล่ก่อน ⚡');
  }

  function doRecenter(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'brush' } })); }catch(_){}
    showToast('Recenter 🎯');
  }

  function maybeRequireTapStart(){
    const isMobileLike = /android|iphone|ipad|mobile/i.test(navigator.userAgent) || cfg.view === 'mobile' || cfg.view === 'cvr';
    if(tapStart && isMobileLike){
      tapStart.style.display = '';
      return true;
    }
    return false;
  }

  function onTapUnlock(){
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(AC){
        if(!WIN.__brAudioCtx) WIN.__brAudioCtx = new AC();
        if(WIN.__brAudioCtx && WIN.__brAudioCtx.state === 'suspended'){
          WIN.__brAudioCtx.resume().catch(()=>{});
        }
      }
    }catch(_){}
    if(tapStart) tapStart.style.display = 'none';
    startGame();
  }

  /* ---------------- bind ---------------- */
  function bindOnce(el, evt, fn, opts){
    if(!el) return;
    const key = '__b_' + evt;
    if(el[key]) return;
    el[key] = true;
    el.addEventListener(evt, fn, opts || false);
  }

  function bindAll(){
    if(boundOnce) return;
    boundOnce = true;

    bindOnce(btnStart, 'click', ()=>{
      if(tapStart && tapStart.style.display !== 'none') return;
      startGame();
    });

    bindOnce(btnRetry, 'click', ()=> retryGame());
    bindOnce(btnPause, 'click', ()=> togglePause());
    bindOnce(btnHow, 'click', ()=> showHow());
    bindOnce(btnRecenter, 'click', ()=> doRecenter());
    bindOnce(tapBtn, 'click', ()=> onTapUnlock());

    // VR UI shoot event (cVR)
    bindOnce(WIN, 'hha:shoot', (ev)=>{
      if(!state || !state.started || state.ended || state.paused) return;

      const d = (ev && ev.detail) || {};
      const tNow = nowMs();
      const cooldownMs = clamp(d.cooldownMs ?? 90, 20, 500);
      if(tNow - lastShootAt < cooldownMs) return;
      lastShootAt = tNow;

      const x = safeNum(d.x, WIN.innerWidth/2);
      const y = safeNum(d.y, WIN.innerHeight/2);
      hitByScreenPoint(x, y);
    });

    // ESC = pause
    bindOnce(DOC, 'keydown', (ev)=>{
      if(ev.code === 'Escape') togglePause();
    });

    // boot.js prestart reset hook (optional)
    bindOnce(WIN, 'brush:prestart-reset', ()=>{
      try{
        // ensure end hidden
        if(end){ end.hidden = true; end.style.display = 'none'; }
        setUiMode('menu');
      }catch(_){}
    });
  }

  /* ---------------- public init ---------------- */
  function initBrushGame(){
    if(bootOnce) return;
    bootOnce = true;

    try{
      cfg = readConfig();
      rng = makeRng(cfg.seed);
      cacheDom();

      if(!root || !layer || !menu || !end){
        throw new Error('BrushVR DOM missing (#br-wrap/#br-layer/#br-menu/#br-end)');
      }

      renderCtx();

      // build logger (optional)
      LOG = buildLogger();

      state = freshState();
      renderHud();
      resetAllRuntime();
      setUiMode('menu');

      // harden end overlay
      try{ end.hidden = true; end.style.display = 'none'; }catch(_){}

      bindAll();
      maybeRequireTapStart();

      // expose for boot.js (safeCall)
      WIN.BrushVR = {
        start: ()=>{ startGame(); return true; },
        reset: ()=>{ retryGame(); return true; },
        togglePause: ()=>{ togglePause(); return true; },
        showHow: ()=>{ showHow(); return true; },
        end: (reason)=>{ endGame(reason||'manual'); return true; },
        getState: ()=> state,
        getCfg: ()=> cfg
      };

      WIN.__BRUSH_STATE__ = ()=> state;
      WIN.__BRUSH_CFG__ = cfg;

    }catch(err){
      console.error('[BrushVR] init error', err);
      setFatal('JS ERROR:\n' + (err.stack || err.message || String(err)));
    }
  }

  // export init (boot may call)
  WIN.initBrushGame = initBrushGame;
  WIN.__brushInit = initBrushGame;

  // auto init when DOM ready (safe)
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', initBrushGame, { once:true });
  }else{
    initBrushGame();
  }
})();