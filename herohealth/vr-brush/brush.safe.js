// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR Engine — SAFE FULL (v20260224-MISSION+BOSSFAKE+LOGGER)
// ✅ Boss Fake-out Phase2 (warp + fake shield -> break shield first)
// ✅ Daily Missions deterministic (day+pid+seed)
// ✅ Optional HHA logger (?log=1&api=...) safe/no-spam
// ✅ mobile/pc/cVR support (hha:shoot)
// ✅ boot-compatible API: window.BrushVR.start/reset/showHow/togglePause
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

  function hash32(str){
    let h = 2166136261 >>> 0;
    str = String(str || '');
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seed){
    let s = (Number(seed)||Date.now()) >>> 0;
    return function(){
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function pct(n){ return Math.round(Number(n)||0) + '%'; }

  function dayKeyLocal(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /* ---------------- logger (optional) ---------------- */
  const LOG = {
    enabled: false,
    api: '',
    sid: '',
    sentEnd: false,
    latchTs: 0,
    latchTTL: 30_000, // 30s กัน spam
  };

  function logEnabled(){
    const on = String(qs('log','')||'').trim();
    const api = String(qs('api','')||'').trim();
    return (on === '1' || on === 'true') && !!api;
  }

  function normApi(api){
    api = String(api||'').trim();
    if(!api) return '';
    // allow user pass base url; we POST to it with {kind:...}
    return api;
  }

  function makeSid(){
    // lightweight deterministic-ish per run
    const pid = String(qs('pid','anon')||'anon');
    const seed = String(qs('seed', String(Date.now())));
    const t = Date.now();
    return `br_${pid}_${seed}_${t}`;
  }

  async function postLog(kind, payload){
    if(!LOG.enabled || !LOG.api) return;
    const tNow = Date.now();
    if(tNow - LOG.latchTs < LOG.latchTTL && kind !== 'session_end') return;
    LOG.latchTs = tNow;

    try{
      const body = {
        kind: String(kind||'event'),
        game: 'brush',
        ts: Date.now(),
        sid: LOG.sid,
        pid: cfg?.pid || 'anon',
        run: cfg?.run || 'play',
        diff: cfg?.diff || 'normal',
        view: cfg?.view || 'mobile',
        seed: cfg?.seed || '',
        ...payload
      };

      // NOTE: backend vary. This "single endpoint" style is safest.
      await fetch(LOG.api, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(body),
        keepalive: true
      });
    }catch(_){}
  }

  function loggerInit(){
    LOG.enabled = logEnabled();
    LOG.api = normApi(qs('api',''));
    LOG.sid = makeSid();
    LOG.sentEnd = false;
    LOG.latchTs = 0;

    if(LOG.enabled){
      postLog('session_start', { meta:{ href: location.href } });
    }
  }

  /* ---------------- state ---------------- */
  let cfg = null, rng = Math.random;

  let root, layer, fxLayer, menu, end, tapStart;
  let btnStart, btnRetry, btnPause, btnHow, btnRecenter, tapBtn, btnBack, btnBackHub2;
  let toastEl, fatalEl;

  let tScore, tCombo, tMiss, tTime, tClean, tFever, bClean, bFever;
  let mDiff, mTime, ctxView, ctxSeed, ctxTime, diffTag;
  let sScore, sAcc, sMiss, sCombo, sClean, sTime, endGrade, endNote;

  // Mission panel DOM (minimal)
  let mWrap, mSub, mList, mBar, mPct;
  let missions = null;

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

  /* ---------------- config ---------------- */
  function readConfig(){
    const view = String(qs('view','mobile')).toLowerCase();
    const run  = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = clamp(qs('time','80'), 20, 300);
    const pid  = String(qs('pid','anon') || 'anon');
    const seed = safeNum(qs('seed', String(Date.now())), Date.now());
    const hub  = String(qs('hub','../hub.html') || '../hub.html');

    const D = {
      easy:   { spawnMs: 1050, ttlMs: 2200, bossEvery: 9,  bossHp: 4, cleanGain: 8,  missClean: 1, maxTargets: 3 },
      normal: { spawnMs: 850,  ttlMs: 1800, bossEvery: 7,  bossHp: 5, cleanGain: 7,  missClean: 1, maxTargets: 4 },
      hard:   { spawnMs: 700,  ttlMs: 1500, bossEvery: 6,  bossHp: 6, cleanGain: 6,  missClean: 2, maxTargets: 5 },
    }[diff] || {
      spawnMs: 850, ttlMs: 1800, bossEvery: 7, bossHp: 5, cleanGain: 7, missClean: 1, maxTargets: 4
    };

    return { view, run, diff, time, pid, seed, hub, ...D };
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

    // missions panel (optional)
    mWrap = $('#br-missions');
    mSub  = $('#br-mSub');
    mList = $('#br-mList');
    mBar  = $('#br-mBar');
    mPct  = $('#br-mPct');
  }

  function setFatal(msg){
    try{
      if(!fatalEl) return;
      fatalEl.classList.remove('br-hidden');
      fatalEl.textContent = String(msg || 'Unknown error');
    }catch(_){}
  }

  function setUiMode(mode){
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
  }

  function showToast(msg){
    if(!toastEl) return;
    toastEl.textContent = String(msg || '');
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toastEl && toastEl.classList.remove('show'), 1200);
  }

  /* ---------------- mission system ---------------- */
  function pickDailyMissions(pid, seedBase){
    const day = dayKeyLocal();
    const base = `${pid||'anon'}|${day}|${seedBase||0}|brush-missions`;
    const h = hash32(base);
    const r = makeRng(h);

    const pool = [
      { id:'acc',     label:'แม่นยำ ≥ {x}%',         type:'acc',       pick:[60,65,70,75] },
      { id:'combo',   label:'คอมโบสูงสุด ≥ {x}',     type:'maxCombo',  pick:[5,6,7,8] },
      { id:'boss',    label:'จัดการบอส ≥ {x}',       type:'bossKill',  pick:[1,2] },
      { id:'clean',   label:'Clean ถึง ≥ {x}%',       type:'clean',     pick:[70,80,90,100] },
      { id:'crit',    label:'CRIT จุดอ่อนบอส ≥ {x}', type:'bossCrit',  pick:[1,2,3] },
      { id:'perfect', label:'Perfect hit ≥ {x}',      type:'perfect',   pick:[2,3,4] },
    ];

    const chosen = [];
    while(chosen.length < 3){
      const it = pool[(r()*pool.length)|0];
      if(chosen.find(x=>x.id===it.id)) continue;
      const x = it.pick[(r()*it.pick.length)|0];
      chosen.push({
        id: it.id,
        type: it.type,
        goal: x,
        label: it.label.replace('{x}', String(x)),
        value: 0,
        done: false
      });
    }
    return { day, list: chosen };
  }

  function renderMissions(){
    if(!mWrap || !mList || !missions) return;
    if(mSub){
      mSub.textContent = `pid=${cfg.pid||'anon'} • day=${missions.day}`;
    }
    mList.innerHTML = '';
    missions.list.forEach((m, idx)=>{
      const row = DOC.createElement('div');
      row.className = 'br-mi' + (m.done ? ' done' : '');
      row.innerHTML = `
        <div class="br-mchk">${m.done ? '✓' : '•'}</div>
        <div class="br-ml">${m.label}</div>
        <div class="br-mv" id="br-mv-${idx}">${m.value}/${m.goal}</div>
      `;
      mList.appendChild(row);
    });
    updateMissionBar();
  }

  function updateMissionBar(){
    if(!missions) return;
    const doneN = missions.list.filter(m=>m.done).length;
    const pctVal = Math.round((doneN / Math.max(1, missions.list.length)) * 100);
    if(mPct) mPct.textContent = pctVal + '%';
    if(mBar) mBar.style.width = pctVal + '%';
  }

  function updateMissionsFromState(){
    if(!missions || !state) return;

    const acc = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0;

    missions.list.forEach((m)=>{
      if(m.type === 'acc'){ m.value = acc; m.done = (acc >= m.goal); }
      else if(m.type === 'maxCombo'){ m.value = state.maxCombo|0; m.done = (m.value >= m.goal); }
      else if(m.type === 'bossKill'){ m.value = state.bossKills|0; m.done = (m.value >= m.goal); }
      else if(m.type === 'clean'){ m.value = state.cleanPct|0; m.done = (m.value >= m.goal); }
      else if(m.type === 'bossCrit'){ m.value = state.bossCrits|0; m.done = (m.value >= m.goal); }
      else if(m.type === 'perfect'){ m.value = state.perfectHits|0; m.done = (m.value >= m.goal); }
    });

    missions.list.forEach((m, idx)=>{
      const el = DOC.getElementById('br-mv-' + idx);
      if(el) el.textContent = `${m.value}/${m.goal}`;
      const row = el && el.closest('.br-mi');
      if(row){
        if(m.done) row.classList.add('done');
        else row.classList.remove('done');
        const chk = row.querySelector('.br-mchk');
        if(chk) chk.textContent = m.done ? '✓' : '•';
      }
    });

    updateMissionBar();
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

      // missions counters
      bossKills: 0,
      bossCrits: 0,
      perfectHits: 0,

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

  function teleportBoss(t){
    if(!t || !t.el) return;
    const size = t.isBoss ? 92 : 78;
    const p = pickSpawnPos(size);
    t.x = p.x; t.y = p.y;
    t.el.classList.add('warp');
    t.el.style.left = p.x + 'px';
    t.el.style.top  = p.y + 'px';
    setTimeout(()=>{ try{ t.el.classList.remove('warp'); }catch(_){} }, 220);
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
    el.className = 'br-t' + (isBoss ? ' thick boss' : '') + ' pop';
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.dataset.hp = String(hpMax);
    el.dataset.hpMax = String(hpMax);
    el.dataset.spawnAt = String(nowMs());
    el.dataset.expireAt = String(nowMs() + ttl);

    // Boss fake-out state
    if(isBoss){
      el.dataset.bPhase = '1';      // 1 -> 2 (fakeout)
      el.dataset.shield = '0';      // shieldHp
      el.dataset.fakeOn = '0';
    }

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent = isBoss ? '💎' : '🦠';
    el.appendChild(emo);

    if(isBoss){
      const ws = DOC.createElement('div');
      ws.className = 'br-ws';
      const dx = (rng()*16 - 8);
      const dy = (rng()*16 - 8);
      ws.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      el.appendChild(ws);

      // fake shield ring
      const sh = DOC.createElement('div');
      sh.className = 'br-shield';
      el.appendChild(sh);
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
      // fakeout state runtime
      bPhase: 1,
      shieldHp: 0,
      fakeOn: false,
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

  function updateShieldUI(t){
    if(!t || !t.el || !t.isBoss) return;
    t.el.dataset.shield = String(t.shieldHp|0);
    if(t.shieldHp > 0){
      t.el.classList.add('shielded');
    }else{
      t.el.classList.remove('shielded');
    }
  }

  function removeTarget(t, why='hit'){
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
      showToast('FEVER ON 🔥');
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

  // Boss Fake-out trigger: once when hp <= ~half
  function maybeTriggerFakeout(t){
    if(!t || !t.isBoss) return;
    if(t.bPhase !== 1) return;
    const threshold = Math.ceil(t.hpMax * 0.55);
    if(t.hp <= threshold){
      t.bPhase = 2;
      t.fakeOn = true;
      t.shieldHp = Math.max(2, Math.round(2 + (cfg.diff==='hard'?1:0))); // normal/easy=2, hard=3
      updateShieldUI(t);
      showToast('FAKE-OUT! 🛡️');
      flashFx('shock');
      teleportBoss(t);
      // randomize weakspot again
      try{
        const ws = t.el.querySelector('.br-ws');
        if(ws){
          const dx = (rng()*20 - 10);
          const dy = (rng()*20 - 10);
          ws.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
      }catch(_){}
    }
  }

  function hitTargetCore(t, hitX, hitY){
    if(!state || !state.started || state.ended || state.paused) return;
    if(!t || t.removed) return;

    state.shots++;

    const rem = Math.max(0, t.expireAt - nowMs());
    const perfect = rem <= Math.min(420, t.ttl * 0.22);

    if(t.isBoss){
      const crit = bossWeakspotHit(t, hitX, hitY);
      if(crit) state.bossCrits++;

      // Phase2 shield: must break shield first (fake shield)
      if(t.shieldHp > 0){
        const dmgS = crit ? 2 : 1;
        t.shieldHp = Math.max(0, t.shieldHp - dmgS);
        updateShieldUI(t);
        flashFx(crit ? 'flash' : 'laser');
        showToast(t.shieldHp === 0 ? 'Shield BREAK! ⚡' : 'Shield! 🛡️');
        gainFever(4 + (crit?3:0));
        renderHud();
        updateMissionsFromState();
        return;
      }

      // After shield break: weakspot crit = heavy dmg (2), normal = 1
      const dmg = crit ? 2 : 1;
      t.hp = Math.max(0, t.hp - dmg);
      updateTargetHpUI(t);

      // trigger fakeout at mid hp (only in phase1)
      maybeTriggerFakeout(t);

      if(t.hp <= 0){
        state.hits++;
        state.combo++;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.bossKills++;
        if(perfect) state.perfectHits++;

        addScore(12, perfect, crit);
        addClean(cfg.cleanGain + 8);
        gainFever(18);
        removeTarget(t, 'boss-kill');
        flashFx('shock');
        showToast(crit ? 'CRIT KILL! 💎' : 'Boss แตก! 💎');

        postLog('event', { ev:'boss_kill', crit: !!crit, perfect: !!perfect, score: state.score, clean: state.cleanPct });
      }else{
        // hit but not dead
        state.combo = Math.max(0, state.combo);
        addScore(2, false, crit);
        gainFever(6 + (crit?4:0));
        flashFx(crit ? 'flash' : 'laser');
        if(crit){
          try{
            t.el.classList.add('ws-hit');
            setTimeout(()=>{ try{ t.el.classList.remove('ws-hit'); }catch(_){ } }, 160);
          }catch(_){}
        }
      }
    }else{
      state.hits++;
      state.combo++;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      if(perfect) state.perfectHits++;

      addScore(5, perfect, false);
      addClean(cfg.cleanGain);
      gainFever(8);
      removeTarget(t, 'normal-hit');
      flashFx(perfect ? 'flash' : 'laser');

      postLog('event', { ev:'hit', perfect: !!perfect, score: state.score, combo: state.combo });
    }

    renderHud();
    updateMissionsFromState();
    checkEndConditions();
  }

  function hitTargetByPointer(t, clientX, clientY){
    hitTargetCore(t, clientX, clientY);
  }

  function hitByScreenPoint(clientX, clientY){
    if(!state || !state.started || state.ended || state.paused) return;

    state.shots++;

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
    decayCleanOnMiss();
    renderHud();
    updateMissionsFromState();

    postLog('event', { ev:'miss', score: state.score, clean: state.cleanPct });
  }

  function expireTargets(){
    const tNow = nowMs();
    TARGETS.forEach((t)=>{
      if(t.removed) return;
      if(tNow >= t.expireAt){
        state.miss++;
        state.combo = 0;
        decayCleanOnMiss();
        removeTarget(t, 'expire');
      }
    });
  }

  function maybeSpawn(){
    if(!state || !state.started || state.ended || state.paused) return;
    if(TARGETS.size >= cfg.maxTargets) return;

    const shouldBoss = (state.spawned > 0 && state.spawned % cfg.bossEvery === 0);
    makeTarget(shouldBoss ? 'boss' : 'normal');
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

    renderHud();
    updateMissionsFromState();
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

    let msg = '-';
    if(reason === 'clean') msg = 'ALMOST!'; 
    if(reason === 'timeout' && state.cleanPct >= 70) msg = 'เกือบผ่านแล้ว!';
    if(reason === 'timeout' && state.cleanPct < 70) msg = 'ลองจัดลำดับเป้าหมายให้แม่นขึ้น 💪';

    const meta = `reason=${reason} | seed=${cfg.seed} | diff=${cfg.diff} | view=${cfg.view} | pid=${cfg.pid}`;
    const msTxt = missions ? missions.list.map(m=>`${m.done?'✓':'•'} ${m.label}`).join(' | ') : '';
    const doneN = missions ? missions.list.filter(m=>m.done).length : 0;

    endNote && (endNote.textContent = `${msg}\n${meta}\nMISSIONS: ${doneN}/3\n${msTxt}`);
  }

  function endGame(reason){
    if(!state || !state.started) return;
    if(state.ended || endLock) return;

    endLock = true;
    state.ended = true;
    state.endAtMs = Date.now();

    stopLoops();
    TARGETS.forEach(t => { try{ t.el.style.pointerEvents='none'; }catch(_){ } });

    fillSummary(reason || 'timeout');
    renderHud();
    setUiMode('end');

    if(LOG.enabled && !LOG.sentEnd){
      LOG.sentEnd = true;
      const acc = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0;
      postLog('session_end', {
        reason: String(reason||'timeout'),
        summary: {
          score: Math.round(state.score),
          miss: Math.round(state.miss),
          maxCombo: Math.round(state.maxCombo),
          cleanPct: Math.round(state.cleanPct),
          accPct: acc,
          bossKills: state.bossKills|0,
          bossCrits: state.bossCrits|0,
          perfectHits: state.perfectHits|0,
          timeSpent: Number((cfg.time - state.timeLeft).toFixed(2))
        },
        missions: missions ? missions.list : []
      });
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

    // missions for this run
    missions = pickDailyMissions(cfg.pid, cfg.seed);
    renderMissions();

    renderHud();
    setUiMode('play');

    if(tapStart) tapStart.style.display = 'none';
    if(btnPause) btnPause.textContent = 'Pause';

    startLoops();
    maybeSpawn();
    showToast('เริ่มแปรง! 🪥');

    postLog('event', { ev:'start' });
    try{ WIN.dispatchEvent(new CustomEvent('brush:start', { detail:{ ts: Date.now() } })); }catch(_){}
  }

  function resetGame(){
    // for boot retry flow
    resetAllRuntime();
    state = freshState();
    renderHud();
    setUiMode('menu');
    if(end){ end.hidden = true; end.style.display='none'; }
    postLog('event', { ev:'reset' });
  }

  function retryGame(){
    if(end){ end.hidden = true; end.style.display='none'; }
    startGame();
  }

  function togglePause(){
    if(!state || !state.started || state.ended) return;
    state.paused = !state.paused;
    if(btnPause) btnPause.textContent = state.paused ? 'Resume' : 'Pause';
    showToast(state.paused ? 'พักเกม ⏸' : 'เล่นต่อ ▶');
    if(!state.paused) state.lastTickAt = Date.now();
    postLog('event', { ev:'pause', paused: !!state.paused });
  }

  function showHow(){
    showToast('ยิง/แตะ 🦠 | บอส 💎 มีจุดอ่อน 🎯 | โล่หลอก 🛡️ ต้องแตกก่อน!');
  }

  function doRecenter(){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'brush' } }));
    }catch(_){}
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

    // รับยิงจาก vr-ui (cVR / screen center shoot)
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

    bindOnce(DOC, 'keydown', (ev)=>{
      if(ev.code === 'Escape'){
        togglePause();
      }
    });

    // allow boot to force reset-before-start
    bindOnce(WIN, 'brush:prestart-reset', ()=> resetGame());
    bindOnce(WIN, 'brush:toggle-pause', ()=> togglePause());
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

      loggerInit();
      renderCtx();

      state = freshState();
      renderHud();
      resetAllRuntime();
      setUiMode('menu');
      bindAll();

      // missions prepared even before start (panel shows day/pid)
      missions = pickDailyMissions(cfg.pid, cfg.seed);
      renderMissions();
      updateMissionsFromState();

      // mobile/cVR show tap overlay
      maybeRequireTapStart();

      // export for boot (compat)
      WIN.BrushVR = {
        start: startGame,
        reset: resetGame,
        togglePause: togglePause,
        showHow: showHow,
        end: endGame
      };

      // debug (optional)
      WIN.__BRUSH_STATE__ = ()=> state;
      WIN.__BRUSH_CFG__ = cfg;

    }catch(err){
      console.error('[BrushVR] init error', err);
      setFatal('JS ERROR:\n' + (err.stack || err.message || String(err)));
    }
  }

  // auto init when DOM ready
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', initBrushGame, { once:true });
  }else{
    initBrushGame();
  }
})();