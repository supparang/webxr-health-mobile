// === /herohealth/vr-bath/bath.safe.js ===
// BathVR SAFE — PRODUCTION (HHA Standard-lite + 3-Stage + Boss + FX + AI Predict hooks)
// FULL v20260304-BATH-3STAGE-BOSS-FX-AIHOOKS-PRO
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const $ = (id)=> DOC.getElementById(id);

  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const clamp01=(x)=>clamp(x,0,1);
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();

  function qs(k, d=''){
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
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
  const hub = (qs('hub','../hub.html')||'../hub.html').trim();
  const pid = (qs('pid','anon')||'anon').trim() || 'anon';
  const run = (qs('run', qs('mode','play'))||'play').trim().toLowerCase(); // play|study|research
  const diff = (qs('diff','normal')||'normal').trim().toLowerCase();      // easy|normal|hard
  const timeLimit = Math.max(25, parseInt(qs('time','80'),10) || 80);

  // PRO switch: hard+pro => โหดขึ้น แต่แฟร์ (คุมเพดาน ไม่ทำให้ท้อ)
  const pro = (qs('pro','0')||'0').trim() === '1' || (diff==='hard' && (qs('mode2','')||'').toLowerCase()==='pro');

  const seedParam = (qs('seed', pid)||pid).trim();
  const view = (qs('view','')||'').trim().toLowerCase() || (
    (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches) ? 'mobile' : 'pc'
  );

  const logEndpoint = (qs('log','')||'').trim();
  const studyId = (qs('studyId','')||'').trim();
  const phase = (qs('phase','')||'').trim();
  const conditionGroup = (qs('conditionGroup','')||'').trim();

  const seed = ((Number(seedParam)||Date.now())>>>0);
  const rng = seededRng(seed);

  const wrap = $('wrap');
  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.run = run;
    wrap.dataset.diff = diff;
    wrap.dataset.pro = pro ? '1':'0';
  }

  // ---------------- UI refs ----------------
  const layer = $('layer');

  const tScore=$('tScore'), tClean=$('tClean'), tMistake=$('tMistake'), tCombo=$('tCombo'), tTime=$('tTime');
  const tMeter=$('tMeter'), bMeter=$('bMeter');
  const tRisk=$('tRisk'), bRisk=$('bRisk');
  const tStage=$('tStage');       // (optional) แสดง stage
  const tBoss=$('tBoss'), bBoss=$('bBoss'); // (optional) boss hp
  const tCoach=$('tCoach');       // (optional) AI Coach line
  const fxLayer=$('fx');          // (optional) เอฟเฟกต์ overlay

  const endEl=$('end');
  const tReason=$('tReason');
  const sScore=$('sScore'), sClean=$('sClean'), sMistake=$('sMistake'), sMaxCombo=$('sMaxCombo'), sAcc=$('sAcc'), sRiskAvg=$('sRiskAvg');
  const endNote=$('endNote');

  const btnStart=$('btnStart'), btnRetry=$('btnRetry'), btnPause=$('btnPause'), btnBack=$('btnBack'), btnEndRetry=$('btnEndRetry'), btnEndBack=$('btnEndBack');

  // back link
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
  applyHubLink(btnEndBack);

  // ---------------- toast ----------------
  const toastEl = $('toast');
  function toast(msg){
    if(!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> toastEl.classList.remove('show'), 1100);
  }

  // ---------------- HHA events (hooks) ----------------
  function emit(name, detail){
    try{
      WIN.dispatchEvent(new CustomEvent(name, { detail: detail||{} }));
    }catch(_){}
  }
  // Unified bath hook name (for ai-hooks.js)
  function emitBath(type, data){
    emit('bath:hook', { type, ...(data||{}) });
    emit('hha:event', { game:'bath', type, ...(data||{}) }); // compatible
  }

  // ---------------- logger (NDJSON, flush-hardened) ----------------
  function createLogger(ctx){
    const q = [];
    let seq = 0;
    const sessionId = 'bath_' + (Date.now().toString(36)) + '_' + Math.random().toString(36).slice(2,8);

    function base(type){
      return {
        v: 1,
        game: 'bath',
        type,
        sessionId,
        seq: ++seq,
        ts: Date.now(),
        pid: ctx.pid || '',
        studyId: ctx.studyId || '',
        phase: ctx.phase || '',
        conditionGroup: ctx.conditionGroup || '',
        runMode: ctx.runMode || '',
        diff: ctx.diff || '',
        pro: ctx.pro ? 1 : 0,
        view: ctx.view || '',
        seed: ctx.seed || 0,
        timePlannedSec: ctx.timePlannedSec || 0,
        href: location.href.split('#')[0]
      };
    }

    function push(type, data){
      q.push({ ...base(type), ...(data||{}) });
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

  const logger = createLogger({
    pid, studyId, phase, conditionGroup,
    runMode: run, diff, pro, view, seed, timePlannedSec: timeLimit,
    log: logEndpoint
  });

  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') logger.flush('unload');
  });
  WIN.addEventListener('beforeunload', ()=> logger.flush('unload'));

  // ---------------- safety ----------------
  if(!layer){
    console.warn('[BathVR] Missing #layer');
    return;
  }

  function layerRect(){
    return layer.getBoundingClientRect();
  }

  // ---------------- FX helpers ----------------
  function fxPulse(cls, ms=160){
    if(!fxLayer) return;
    fxLayer.classList.add(cls);
    clearTimeout(fxPulse._t);
    fxPulse._t = setTimeout(()=>{ try{fxLayer.classList.remove(cls);}catch(_){ } }, ms);
  }
  function popScoreAt(x, y, text){
    const r = layerRect();
    const el = DOC.createElement('div');
    el.className = 'popScore';
    el.textContent = text;
    el.style.left = clamp(x, 0, r.width-10) + 'px';
    el.style.top  = clamp(y, 0, r.height-10) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch(_){ } }, 650);
  }
  function screenShake(){
    if(!wrap) return;
    wrap.classList.add('shake');
    setTimeout(()=>{ try{wrap.classList.remove('shake');}catch(_){ } }, 220);
  }

  // ---------------- game state ----------------
  const st = {
    running:false, paused:false, over:false,
    t0:0, elapsed:0,

    score:0,
    clean:0,
    mistake:0,
    combo:0,
    maxCombo:0,

    cleanMeter:0,      // 0..100
    germRisk:0,        // 0..100
    riskSum:0, riskN:0,

    // counts
    spawnedGood:0,
    spawnedBad:0,
    spawnedBonus:0,
    spawnedBoss:0,
    hitGood:0,
    hitBad:0,
    hitBonus:0,
    hitBoss:0,
    missGood:0,

    comboBreaks:0,
    lastComboWas:0,

    // difficulty knobs (base)
    spawnMsBase: (diff==='hard' ? 620 : diff==='easy' ? 860 : 720),
    ttlMsBase:   (diff==='hard' ? 1350 : diff==='easy' ? 1850 : 1550),

    // stage system (Warm → Trick → Boss)
    stage: 1,
    stageName: 'WARM',
    stageEndsAtSec: 0,
    stage2EndsAtSec: 0,

    // boss
    bossOn:false,
    bossHp:0,
    bossHpMax:0,

    // powerups
    shield: 0,         // blocks bad hit count
    soapBurst: 0,      // aoe clean charges
    timeBonusSec: 0,   // extra time earned
    slowUntilMs: 0,    // trick: slow spawn window
    feverUntilMs: 0,   // score buff window

    // timing
    spawnMs: 720,
    ttlMs: 1500,

    // ai prediction (computed)
    hazardRisk: 0,
    coachLine: '',

    targets: new Map(),
    uid:0
  };

  // compute stage timings (percent of timeLimit)
  function setupStages(){
    const t = timeLimit;
    const s1 = Math.max(16, Math.round(t * 0.33));
    const s2 = Math.max(18, Math.round(t * 0.66));
    st.stageEndsAtSec = s1;
    st.stage2EndsAtSec = s2;
  }

  function setHud(){
    if(tScore) tScore.textContent = String(st.score);
    if(tClean) tClean.textContent = String(st.clean);
    if(tMistake) tMistake.textContent = String(st.mistake);
    if(tCombo) tCombo.textContent = String(st.combo);
    if(tTime) tTime.textContent = String(Math.max(0, Math.ceil((timeLimit + st.timeBonusSec) - st.elapsed)));

    if(tMeter) tMeter.textContent = `${Math.round(st.cleanMeter)}%`;
    if(bMeter) bMeter.style.width = `${clamp(st.cleanMeter,0,100)}%`;

    if(tRisk) tRisk.textContent = `${Math.round(st.germRisk)}%`;
    if(bRisk) bRisk.style.width = `${clamp(st.germRisk,0,100)}%`;

    if(tStage) tStage.textContent = `STAGE ${st.stage}: ${st.stageName}`;

    if(tBoss && bBoss){
      if(st.bossOn){
        tBoss.textContent = `${Math.max(0, st.bossHp)}/${st.bossHpMax}`;
        bBoss.style.width = `${clamp((st.bossHp/st.bossHpMax)*100,0,100)}%`;
        tBoss.parentElement && (tBoss.parentElement.hidden = false);
      }else{
        tBoss.parentElement && (tBoss.parentElement.hidden = true);
      }
    }

    if(tCoach){
      tCoach.textContent = st.coachLine || '';
    }
  }

  // ---------------- targets ----------------
  // kinds: good (dirt), bad (germ), bonus (soap/time), boss (mega dirt)
  function makeTarget(kind, x, y, ttl, extra){
    const id = String(++st.uid);
    const el = DOC.createElement('div');

    const big = (kind==='good' && rng()<0.18);
    const small = (kind==='bad' && rng()<0.24);

    el.className = 'dirt ' + kind + (big ? ' big' : small ? ' small' : '');
    el.dataset.id = id;
    el.dataset.kind = kind;

    // visuals
    if(kind==='good') el.textContent = '🟤';
    else if(kind==='bad') el.textContent = '🦠';
    else if(kind==='bonus') el.textContent = (extra && extra.bonusType==='time') ? '⏱️' : '🧼';
    else if(kind==='boss') el.textContent = '🪨';

    el.style.left = x+'px';
    el.style.top = y+'px';

    const born = nowMs();
    const die = born + ttl;

    const it = { id, el, kind, born, die, x, y, ...(extra||{}) };
    st.targets.set(id, it);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hit(id, {src:'pointer'});
    }, {passive:false});

    layer.appendChild(el);
    return id;
  }

  function removeTarget(id, popped){
    const it = st.targets.get(id);
    if(!it) return;
    st.targets.delete(id);
    const el = it.el;
    if(!el) return;
    if(popped) el.classList.add('pop');
    setTimeout(()=>{ try{el.remove();}catch(_){ } }, 170);
  }

  // ---------------- aim support (cVR / hha:shoot) ----------------
  function findNearestTarget(px, py){
    let best = null;
    let bestD = 1e9;
    for(const [,it] of st.targets){
      const dx = (it.x - px);
      const dy = (it.y - py);
      const d = dx*dx + dy*dy;
      if(d < bestD){
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  // Expect event from /herohealth/vr/vr-ui.js: window dispatch 'hha:shoot' with detail {x,y,lockPx}
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!st.running || st.paused || st.over) return;
    const r = layerRect();
    const d = (ev && ev.detail) ? ev.detail : {};
    const px = clamp(Number(d.x ?? (r.width/2)), 0, r.width);
    const py = clamp(Number(d.y ?? (r.height/2)), 0, r.height);

    const cand = findNearestTarget(px, py);
    if(!cand) return;

    // lock radius (fair) — tighter in pro, wider in mobile
    const lock = clamp(Number(d.lockPx || 64), 30, 140) * (pro ? 0.92 : 1.0) * (view==='mobile' ? 1.12 : 1.0);
    const dx = cand.x - px, dy = cand.y - py;
    if((dx*dx + dy*dy) <= lock*lock){
      hit(cand.id, {src:'shoot', px, py, lockPx: Math.round(lock)});
    }
  });

  // ---------------- stage rules ----------------
  function stageParams(){
    // base
    let spawn = st.spawnMsBase;
    let ttl   = st.ttlMsBase;

    // stage modifiers
    if(st.stage===1){ // WARM: forgiving
      spawn *= 1.08;
      ttl   *= 1.15;
    }else if(st.stage===2){ // TRICK: faster, more deception
      spawn *= 0.95;
      ttl   *= 0.98;
    }else{ // BOSS: pressure
      spawn *= 0.88;
      ttl   *= 0.92;
    }

    // pro adds intensity but caps unfairness
    if(pro){
      spawn *= 0.90;
      ttl   *= 0.93;
    }

    // global fairness: if risk is very high, slightly extend ttl (avoid hopeless)
    const mercy = clamp01((st.germRisk-72)/28);
    ttl *= (1.0 + mercy*0.10);

    // trick slow window
    if(nowMs() < st.slowUntilMs){
      spawn *= 1.25;
      ttl   *= 1.10;
    }

    return {
      spawnMs: clamp(Math.round(spawn), 260, 1400),
      ttlMs:   clamp(Math.round(ttl),   720, 2600)
    };
  }

  function enterStage(n){
    st.stage = n;
    if(n===1){
      st.stageName = 'WARM';
      toast('🛁 WARM: เริ่มอุ่นเครื่อง!');
    }else if(n===2){
      st.stageName = 'TRICK';
      toast('😈 TRICK: เริ่มหลอกแล้วนะ!');
      // trick: short slow window to re-balance after transition
      st.slowUntilMs = nowMs() + 900;
    }else{
      st.stageName = 'BOSS';
      toast('💥 BOSS: คราบยักษ์มาแล้ว!');
      startBoss();
    }
    emitBath('stage', { stage: st.stage, name: st.stageName });
    logger.push('stage', { stage: st.stage, name: st.stageName });
    setHud();
  }

  function maybeAdvanceStage(){
    if(st.stage===1 && st.elapsed >= st.stageEndsAtSec){
      enterStage(2);
    }
    if(st.stage===2 && st.elapsed >= st.stage2EndsAtSec){
      enterStage(3);
    }
  }

  // ---------------- boss ----------------
  function startBoss(){
    if(st.bossOn) return;
    st.bossOn = true;
    st.spawnedBoss++;

    // boss HP scales with diff/pro
    const base = (diff==='hard' ? 16 : diff==='easy' ? 10 : 13);
    const hp = Math.round(base * (pro ? 1.25 : 1.0));
    st.bossHp = hp;
    st.bossHpMax = hp;

    // spawn boss as target at center-ish
    const r = layerRect();
    const x = (r.width/2) + (rng()*70-35);
    const y = (r.height/2) + (rng()*70-35);
    makeTarget('boss', Math.round(x), Math.round(y), 999999, { hp: st.bossHp });

    fxPulse('fxBoss', 240);
    emitBath('boss_start', { hp, hpMax: hp });
    logger.push('boss_start', { hp, hpMax: hp });
  }

  function damageBoss(dmg, x, y){
    st.bossHp = Math.max(0, st.bossHp - dmg);
    popScoreAt(x, y, `-${dmg}`);
    fxPulse('fxBossHit', 170);
    if(st.bossHp<=0){
      // remove boss target
      for(const [id,it] of st.targets){
        if(it.kind==='boss'){ removeTarget(id, true); break; }
      }
      st.bossOn = false;
      toast('🏆 ชนะบอส! สะอาดสุดๆ');
      st.score += 8 + (pro?2:0);
      st.cleanMeter = clamp(st.cleanMeter + 22, 0, 100);
      st.germRisk = clamp(st.germRisk - 18, 0, 100);
      emitBath('boss_clear', { score: st.score });
      logger.push('boss_clear', { score: st.score });
    }
  }

  // ---------------- spawning ----------------
  function spawn(){
    if(!st.running || st.paused || st.over) return;

    const r = layerRect();
    const pad = 58;
    const x = pad + rng() * Math.max(10, r.width - pad*2);
    const y = pad + rng() * Math.max(10, r.height - pad*2);

    // weights depend on stage + current state
    let wGood = 0.70;
    let wBad  = 0.26;
    let wBonus= 0.04;

    if(st.stage===1){ wGood += 0.06; wBad -= 0.04; }
    if(st.stage===2){ wBad  += 0.06; wGood -= 0.05; }
    if(st.stage===3){ wBad  += 0.08; wBonus += 0.02; wGood -= 0.08; }

    // bias by state (more germs if risk high; more dirt if meter low)
    wBad  += clamp01(st.germRisk/100) * 0.18;
    wGood += clamp01((100-st.cleanMeter)/100) * 0.10;

    // pro adds trick but keeps bonus slightly higher to be fair
    if(pro) wBonus += 0.01;

    // normalize
    let sum = wGood + wBad + wBonus;
    wGood /= sum; wBad /= sum; wBonus /= sum;

    let kind = 'good';
    const roll = rng();
    if(roll < wGood) kind='good';
    else if(roll < (wGood + wBad)) kind='bad';
    else kind='bonus';

    // boss storm: during boss, occasional germ wave
    if(st.stage===3 && st.bossOn && rng()<0.22){
      kind = (rng()<0.78) ? 'bad' : 'bonus';
    }

    const { ttlMs } = stageParams();

    if(kind==='bonus'){
      const bonusType = (rng()<0.35) ? 'time' : 'soap';
      makeTarget('bonus', Math.round(x), Math.round(y), Math.round(ttlMs*1.15), { bonusType });
      st.spawnedBonus++;
      logger.push('spawn', { kind:'bonus', bonusType, x:Math.round(x), y:Math.round(y), ttlMs });
      emitBath('spawn', { kind:'bonus', bonusType, x, y, ttlMs });
      return;
    }

    // normal good/bad
    makeTarget(kind, Math.round(x), Math.round(y), ttlMs);
    if(kind==='good') st.spawnedGood++;
    else st.spawnedBad++;

    logger.push('spawn', { kind, x:Math.round(x), y:Math.round(y), ttlMs });
    emitBath('spawn', { kind, x, y, ttlMs });
  }

  // ---------------- scoring helpers ----------------
  function addCombo(){
    st.combo++;
    st.maxCombo = Math.max(st.maxCombo, st.combo);
  }
  function breakCombo(reason){
    if(st.combo>0) st.comboBreaks++;
    st.combo = 0;
    emitBath('combo_break', { reason, comboBreaks: st.comboBreaks });
  }

  function applySoapBurst(x,y){
    // AOE: remove 1-2 nearby bad targets
    const r = layerRect();
    const rad = (pro ? 110 : 125) * (view==='mobile' ? 1.12 : 1.0);
    const rad2 = rad*rad;
    let cleared = 0;

    for(const [id,it] of st.targets){
      if(it.kind!=='bad') continue;
      const dx = it.x - x, dy = it.y - y;
      if((dx*dx+dy*dy) <= rad2){
        removeTarget(id, true);
        cleared++;
        st.score += 1;
        st.germRisk = clamp(st.germRisk - 2.0, 0, 100);
        popScoreAt(it.x, it.y, '+1');
        if(cleared >= (pro?1:2)) break;
      }
    }
    if(cleared>0){
      toast(`🧼 ล้างเชื้อ ${cleared}!`);
      fxPulse('fxClean', 170);
      emitBath('power', { type:'soap_burst', cleared });
      logger.push('power', { type:'soap_burst', cleared });
    }else{
      toast('🧼 ใช้สบู่! (+meter)');
    }
  }

  // ---------------- hit/timeout ----------------
  function hit(id, meta){
    if(!st.running || st.paused || st.over) return;
    const it = st.targets.get(id);
    if(!it) return;

    removeTarget(id, true);

    const mx = it.x, my = it.y;
    const src = (meta && meta.src) ? meta.src : 'pointer';

    // boss hit
    if(it.kind === 'boss'){
      st.hitBoss++;
      // boss requires multiple hits; combo helps
      const dmg = (st.combo>=6 ? 2 : 1) + (pro && st.combo>=10 ? 1 : 0);
      addCombo();
      st.score += 1 + (st.combo>=6 ? 1 : 0);
      popScoreAt(mx, my, `+${(st.combo>=6)?2:1}`);
      damageBoss(dmg, mx, my);

      // keep pressure: boss also spawns some germs by raising risk slightly
      st.germRisk = clamp(st.germRisk + (pro?0.9:0.7), 0, 100);

      logger.push('judge', { judge:'hit', kind:'boss', dmg, combo: st.combo, score: st.score, src });
      emitBath('judge', { judge:'hit', kind:'boss', dmg, combo: st.combo, score: st.score, src });
      setHud();
      return;
    }

    if(it.kind === 'bonus'){
      st.hitBonus++;
      // bonus never breaks combo
      addCombo();

      if(it.bonusType==='time'){
        st.timeBonusSec = clamp(st.timeBonusSec + 4, 0, 18);
        st.score += 2;
        toast('⏱️ +4 วิ!');
        fxPulse('fxBonus', 170);
        popScoreAt(mx,my,'+2');
        emitBath('power', { type:'time', addSec:4 });
        logger.push('power', { type:'time', addSec:4 });
      }else{
        st.cleanMeter = clamp(st.cleanMeter + 7.5, 0, 100);
        st.germRisk   = clamp(st.germRisk - 5.0, 0, 100);
        st.shield     = clamp(st.shield + 1, 0, 3);
        st.score     += 2;
        toast('🧼 สบู่+โล่!');
        fxPulse('fxBonus', 170);
        popScoreAt(mx,my,'+2');
        applySoapBurst(mx,my);
        emitBath('power', { type:'soap', shield: st.shield });
        logger.push('power', { type:'soap', shield: st.shield });
      }

      logger.push('judge', { judge:'hit', kind:'bonus', bonusType: it.bonusType, combo: st.combo, score: st.score, src });
      emitBath('judge', { judge:'hit', kind:'bonus', bonusType: it.bonusType, combo: st.combo, score: st.score, src });
      setHud();
      return;
    }

    if(it.kind === 'good'){
      st.hitGood++;
      st.clean++;
      addCombo();

      // points
      const base = 1;
      const comboBonus = (st.combo >= 6) ? 1 : 0;
      const feverBonus = (nowMs() < st.feverUntilMs) ? 1 : 0;
      const add = base + comboBonus + feverBonus;
      st.score += add;

      // meter changes
      st.cleanMeter = clamp(st.cleanMeter + (st.combo>=6 ? 2.3 : 1.65), 0, 100);
      st.germRisk   = clamp(st.germRisk - 1.9, 0, 100);

      // stage clear micro-goals -> reward (เด็ก ป.5 ชอบ!)
      if(st.stage===1 && st.cleanMeter>=40 && st.elapsed < st.stageEndsAtSec){
        // one-time early reward
        if(!st._s1Reward){
          st._s1Reward = true;
          st.score += 3;
          st.feverUntilMs = nowMs() + 2200;
          toast('🔥 โบนัสอุ่นเครื่อง! (Fever)');
          fxPulse('fxFever', 220);
          emitBath('milestone', { id:'warm_goal', score: st.score });
          logger.push('milestone', { id:'warm_goal', score: st.score });
        }
      }

      popScoreAt(mx,my, `+${add}`);
      fxPulse('fxClean', 130);
      if(st.combo>=10) fxPulse('fxStreak', 150);

      toast(st.combo>=6 ? '✨ CLEAN COMBO!' : '✅ ดีมาก!');
      logger.push('judge', { judge:'hit', kind:'good', combo: st.combo, score: st.score, add, src });
      emitBath('judge', { judge:'hit', kind:'good', combo: st.combo, score: st.score, add, src });

    }else{
      // bad hit
      st.hitBad++;
      st.mistake++;

      if(st.shield>0){
        st.shield--;
        // guarded: no score loss, smaller penalty
        st.germRisk = clamp(st.germRisk + 2.2, 0, 100);
        st.cleanMeter = clamp(st.cleanMeter - 1.0, 0, 100);
        fxPulse('fxGuard', 170);
        toast('🛡️ กันเชื้อได้!');
        logger.push('judge', { judge:'guard', kind:'bad', shieldLeft: st.shield, score: st.score, src });
        emitBath('judge', { judge:'guard', kind:'bad', shieldLeft: st.shield, score: st.score, src });
      }else{
        breakCombo('bad_hit');
        st.score = Math.max(0, st.score - 2);
        st.germRisk = clamp(st.germRisk + 6.6, 0, 100);
        st.cleanMeter = clamp(st.cleanMeter - 3.3, 0, 100);

        fxPulse('fxBad', 180);
        screenShake();
        popScoreAt(mx,my,'-2');
        toast('🦠 โดนเชื้อ!');
        logger.push('judge', { judge:'bad_hit', kind:'bad', score: st.score, src });
        emitBath('judge', { judge:'bad_hit', kind:'bad', score: st.score, src });
      }
    }

    setHud();

    // lose condition: risk too high
    if(st.germRisk >= 100){
      endGame('risk');
    }
  }

  function timeoutTarget(id){
    const it = st.targets.get(id);
    if(!it) return;

    removeTarget(id, false);

    if(it.kind === 'boss'){
      // boss doesn't timeout (should not happen)
      return;
    }

    if(it.kind === 'bonus'){
      // bonus expired: tiny penalty only in pro (keeps pressure)
      if(pro){
        st.germRisk = clamp(st.germRisk + 0.8, 0, 100);
      }
      logger.push('judge', { judge:'expire', kind:'bonus', bonusType: it.bonusType, score: st.score });
      emitBath('judge', { judge:'expire', kind:'bonus', bonusType: it.bonusType, score: st.score });
      setHud();
      return;
    }

    if(it.kind === 'good'){
      st.missGood++;
      st.mistake++;
      breakCombo('timeout_good');

      st.score = Math.max(0, st.score - 1);
      st.germRisk = clamp(st.germRisk + 3.6, 0, 100);
      st.cleanMeter = clamp(st.cleanMeter - 1.7, 0, 100);

      fxPulse('fxMiss', 160);
      logger.push('judge', { judge:'timeout', kind:'good', score: st.score });
      emitBath('judge', { judge:'timeout', kind:'good', score: st.score });
    }else{
      // good avoid: germs expired without touching
      st.germRisk = clamp(st.germRisk - 0.85, 0, 100);
      logger.push('judge', { judge:'avoid', kind:'bad', score: st.score });
      emitBath('judge', { judge:'avoid', kind:'bad', score: st.score });
    }

    setHud();

    if(st.germRisk >= 100){
      endGame('risk');
    }
  }

  // ---------------- AI prediction (local, deterministic, prediction-only) ----------------
  function computeHazard(){
    // features (0..1)
    const shots = st.hitGood + st.hitBad + st.hitBonus + st.hitBoss;
    const badRate = shots ? (st.hitBad / shots) : 0;
    const missRate = (st.spawnedGood>0) ? (st.missGood / st.spawnedGood) : 0;
    const comboBreakRate = (shots>0) ? (st.comboBreaks / Math.max(1, st.clean)) : 0;
    const riskNow = clamp01(st.germRisk/100);
    const meterLow = clamp01((100 - st.cleanMeter)/100);
    const timeLeft = Math.max(0, (timeLimit + st.timeBonusSec) - st.elapsed);
    const pressure = clamp01(1 - (timeLeft / Math.max(1, (timeLimit + st.timeBonusSec))));

    // weighted sum → 0..100
    let z =
      0.36*riskNow +
      0.22*meterLow +
      0.20*badRate +
      0.16*missRate +
      0.06*pressure +
      0.10*clamp01(comboBreakRate);

    // stage pressure
    if(st.stage===3) z += 0.06;
    if(pro) z += 0.03;

    // clamp
    const hazard = Math.round(clamp(z, 0, 1)*100);

    // explanations (top2 factors)
    const factors = [
      {k:'risk',  w:0.36*riskNow,  t:'ความเสี่ยงเชื้อสูง (Risk ขึ้น)'},
      {k:'meter', w:0.22*meterLow, t:'ความสะอาดยังต่ำ (Meter ยังไม่ขึ้น)'},
      {k:'bad',   w:0.20*badRate,  t:'แตะเชื้อบ่อย (โดน 🦠)'},
      {k:'miss',  w:0.16*missRate, t:'พลาดคราบบ่อย (คราบหายไป)'},
      {k:'press', w:0.06*pressure, t:'เวลาเริ่มกดดัน'},
      {k:'break', w:0.10*clamp01(comboBreakRate), t:'คอมโบหลุดบ่อย'}
    ].sort((a,b)=>b.w-a.w);

    const top = factors.slice(0,2).filter(x=>x.w>0.04).map(x=>x.t);
    let coach = '';
    if(hazard>=75){
      coach = `⚠️ ระวัง! ${top.join(' + ') || 'โฟกัสคราบก่อน แล้วค่อยกันเชื้อ'}`;
    }else if(hazard>=45){
      coach = `👀 ดีอยู่ แต่… ${top[0] || 'รักษาคอมโบให้ได้ 6+'}`;
    }else{
      coach = `👍 เยี่ยม! ลองทำคอมโบ 6+ เพื่อโบนัส`;
    }

    st.hazardRisk = hazard;
    st.coachLine = coach;

    emitBath('ai', {
      hazardRisk: hazard,
      coach,
      features: {
        badRate:+badRate.toFixed(3),
        missRate:+missRate.toFixed(3),
        comboBreaks: st.comboBreaks,
        riskNow:+riskNow.toFixed(3),
        meterLow:+meterLow.toFixed(3),
        pressure:+pressure.toFixed(3),
        stage: st.stage,
        pro: pro?1:0
      }
    });
  }

  // ---------------- timers ----------------
  let spawnTimer = 0;
  let tickTimer = 0;
  let aiTimer = 0;

  function scheduleSpawn(){
    clearTimeout(spawnTimer);
    if(!st.running || st.paused || st.over) return;

    const p = stageParams();
    st.spawnMs = p.spawnMs;
    st.ttlMs = p.ttlMs;

    // mild adaptive spawn (play only) — prediction-only in study/research
    let every = st.spawnMs;
    if(run === 'play'){
      const pressure = clamp01(st.germRisk/100);
      every = clamp(every - pressure*120, 260, 1400);
      // if meter is very low, help a bit with pacing (avoid frustration)
      const mercy = clamp01((25 - st.cleanMeter)/25);
      every = clamp(every + mercy*120, 240, 1500);
    }

    spawnTimer = setTimeout(()=>{
      spawn();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!st.running || st.paused || st.over) return;

    const t = nowMs();
    st.elapsed = (t - st.t0)/1000;

    maybeAdvanceStage();

    // expire targets
    for(const [id, it] of st.targets){
      if(t >= it.die) timeoutTarget(id);
    }

    // risk avg for summary
    st.riskSum += st.germRisk;
    st.riskN += 1;

    // heartbeat (1s)
    if(((t - st.t0) % 1000) < 90){
      logger.push('time', {
        t: +st.elapsed.toFixed(2),
        stage: st.stage,
        score: st.score,
        clean: st.clean,
        mistake: st.mistake,
        combo: st.combo,
        shield: st.shield,
        cleanMeter: +st.cleanMeter.toFixed(1),
        germRisk: +st.germRisk.toFixed(1),
        hazardRisk: st.hazardRisk
      });
      emitBath('time', {
        t: +st.elapsed.toFixed(2),
        stage: st.stage,
        score: st.score,
        clean: st.clean,
        mistake: st.mistake,
        combo: st.combo,
        shield: st.shield,
        cleanMeter: +st.cleanMeter.toFixed(1),
        germRisk: +st.germRisk.toFixed(1),
        hazardRisk: st.hazardRisk
      });
    }

    setHud();

    const effectiveLimit = (timeLimit + st.timeBonusSec);
    if(st.elapsed >= effectiveLimit){
      // if boss still alive, end as time (เด็กจะเห็นว่า “เกือบแล้ว”)
      endGame('time');
    }
  }

  // AI every 800ms (rate-limited)
  function scheduleAI(){
    clearInterval(aiTimer);
    aiTimer = setInterval(()=>{
      if(!st.running || st.paused || st.over) return;
      computeHazard();
      setHud();
    }, 800);
  }

  // ---------------- localStorage summary standard-ish ----------------
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

  function renderEnd(reason){
    if(tReason) tReason.textContent = reason;

    const acc = (st.hitGood + st.hitBad) ? (st.hitGood / (st.hitGood + st.hitBad)) : 0;
    const riskAvg = st.riskN ? (st.riskSum / st.riskN) : st.germRisk;

    if(sScore) sScore.textContent = String(st.score);
    if(sClean) sClean.textContent = String(st.clean);
    if(sMistake) sMistake.textContent = String(st.mistake);
    if(sMaxCombo) sMaxCombo.textContent = String(st.maxCombo);
    if(sAcc) sAcc.textContent = `${Math.round(acc*100)}%`;
    if(sRiskAvg) sRiskAvg.textContent = `${Math.round(riskAvg)}%`;

    if(endNote){
      endNote.textContent =
`pid=${pid} | run=${run} | diff=${diff}${pro?'+pro':''} | view=${view} | time=${timeLimit}s(+${st.timeBonusSec}s) | seed=${seed}
log=${logEndpoint||'—'} | studyId=${studyId||'—'} | phase=${phase||'—'} | conditionGroup=${conditionGroup||'—'}`;
    }

    applyHubLink(btnEndBack);
    if(endEl) endEl.hidden = false;
  }

  async function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;
    st.paused = false;

    clearTimeout(spawnTimer);
    clearInterval(tickTimer);
    clearInterval(aiTimer);

    // clear targets
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    const acc = (st.hitGood + st.hitBad) ? (st.hitGood / (st.hitGood + st.hitBad)) : 0;
    const riskAvg = st.riskN ? (st.riskSum / st.riskN) : st.germRisk;

    const sum = {
      game: 'bath',
      ts: Date.now(),
      pid, studyId, phase, conditionGroup,
      hub, runMode: run, diff, pro: pro?1:0, view, seed,
      timePlannedSec: timeLimit,
      timeBonusSec: st.timeBonusSec,
      timePlayedSec: Math.round(st.elapsed*10)/10,
      score: st.score,
      cleaned: st.clean,
      mistakes: st.mistake,
      comboMax: st.maxCombo,
      accuracyPct: Math.round(acc*100),
      riskAvgPct: Math.round(riskAvg),
      hazardRisk: st.hazardRisk,
      coachLine: st.coachLine,

      spawnedGood: st.spawnedGood,
      spawnedBad: st.spawnedBad,
      spawnedBonus: st.spawnedBonus,
      spawnedBoss: st.spawnedBoss,

      hitGood: st.hitGood,
      hitBad: st.hitBad,
      hitBonus: st.hitBonus,
      hitBoss: st.hitBoss,
      missGood: st.missGood,
      comboBreaks: st.comboBreaks,

      reason
    };

    saveSummary(sum);
    logger.push('end', sum);
    emitBath('end', sum);
    await logger.flush('end');

    toast(reason==='time' ? 'ครบเวลา!' : 'จบเกม!');
    renderEnd(reason);
  }

  function startGame(){
    if(endEl) endEl.hidden = true;

    st.running = true;
    st.paused = false;
    st.over = false;

    st.t0 = nowMs();
    st.elapsed = 0;

    st.score=0; st.clean=0; st.mistake=0; st.combo=0; st.maxCombo=0;
    st.cleanMeter = 0;
    st.germRisk = 15;
    st.riskSum = 0; st.riskN = 0;

    st.spawnedGood=0; st.spawnedBad=0; st.spawnedBonus=0; st.spawnedBoss=0;
    st.hitGood=0; st.hitBad=0; st.hitBonus=0; st.hitBoss=0; st.missGood=0;

    st.comboBreaks = 0;
    st.shield = 0;
    st.timeBonusSec = 0;
    st.slowUntilMs = 0;
    st.feverUntilMs = 0;

    st.hazardRisk = 0;
    st.coachLine = '';

    st.bossOn=false; st.bossHp=0; st.bossHpMax=0;
    st._s1Reward = false;

    setupStages();
    enterStage(1);

    // clear targets
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    setHud();
    toast('เริ่ม! ทำความสะอาดให้ทัน');
    logger.push('start', { seed, diff, pro: pro?1:0, runMode: run, view, timePlannedSec: timeLimit });
    emitBath('start', { seed, diff, pro: pro?1:0, runMode: run, view, timePlannedSec: timeLimit });

    scheduleSpawn();
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 80);

    scheduleAI();
  }

  function togglePause(){
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    if(st.paused){
      toast('⏸ Pause');
      logger.push('pause', { on:true });
      emitBath('pause', { on:true });
    }else{
      toast('▶ Resume');
      logger.push('pause', { on:false });
      emitBath('pause', { on:false });
      scheduleSpawn();
    }
  }

  // buttons
  if(btnStart) btnStart.addEventListener('click', startGame, {passive:true});
  if(btnRetry) btnRetry.addEventListener('click', startGame, {passive:true});
  if(btnEndRetry) btnEndRetry.addEventListener('click', startGame, {passive:true});
  if(btnPause) btnPause.addEventListener('click', togglePause, {passive:true});

  if(btnBack) btnBack.addEventListener('click', ()=>{
    try{
      const u = new URL(hub||'../hub.html', location.href);
      u.searchParams.set('pid', pid);
      if(studyId) u.searchParams.set('studyId', studyId);
      if(phase) u.searchParams.set('phase', phase);
      if(conditionGroup) u.searchParams.set('conditionGroup', conditionGroup);
      location.href = u.toString();
    }catch(_){
      location.href = hub || '../hub.html';
    }
  }, {passive:true});

  // init
  if(endEl) endEl.hidden = true;
  setHud();
  toast('พร้อมแล้ว! กด “เริ่มเกม”');
})();