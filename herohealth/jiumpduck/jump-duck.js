/* === Jump-Duck — Engine (Vanilla JS, Production) ===
   - Tap top half = JUMP, bottom half = DUCK
   - Keyboard: ArrowUp = JUMP, ArrowDown = DUCK
   - Obstacles: LOW => must JUMP, HIGH => must DUCK
   - Timing judge at hit-line (x = 32% of play area)
   - Modes:
     training => adaptive speed a bit near end
     test/research => fixed params (deterministic schedule if seed given)
   - Research: collects meta + events + exports CSV
*/
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------- helpers ----------
  const clamp = (v, a, b)=> Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const now = ()=> performance.now();

  function makeRNG(seed){
    let x = (Number(seed) || Date.now()) >>> 0;
    return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
  }
  function mean(arr){
    if(!arr.length) return 0;
    let s=0; for(const v of arr) s += v;
    return s/arr.length;
  }
  function fmt1(v){ return (Math.round(v*10)/10).toFixed(1); }
  function safeText(el, t){ if(el) el.textContent = String(t); }

  function playSfx(id){
    const a = DOC.getElementById(id);
    if(!a) return;
    try{
      a.currentTime = 0;
      a.play().catch(()=>{});
    }catch(_){}
  }

  // ---------- elements ----------
  const viewMenu   = DOC.getElementById('view-menu');
  const viewPlay   = DOC.getElementById('view-play');
  const viewResult = DOC.getElementById('view-result');

  const elMode     = DOC.getElementById('jd-mode');
  const elDiff     = DOC.getElementById('jd-diff');
  const elDuration = DOC.getElementById('jd-duration');

  const researchBlock = DOC.getElementById('jd-research-block');
  const elPid   = DOC.getElementById('jd-participant-id');
  const elGroup = DOC.getElementById('jd-group');
  const elNote  = DOC.getElementById('jd-note');

  const playArea = DOC.getElementById('jd-play-area');
  const avatar   = DOC.getElementById('jd-avatar');
  const obsLayer = DOC.getElementById('jd-obstacles');
  const judgeEl  = DOC.getElementById('jd-judge');

  // HUD
  const hudMode = DOC.getElementById('hud-mode');
  const hudDiff = DOC.getElementById('hud-diff');
  const hudDuration = DOC.getElementById('hud-duration');
  const hudStability = DOC.getElementById('hud-stability');
  const hudObstacles = DOC.getElementById('hud-obstacles');
  const hudScore = DOC.getElementById('hud-score');
  const hudCombo = DOC.getElementById('hud-combo');
  const hudTime  = DOC.getElementById('hud-time');

  // Result
  const resMode = DOC.getElementById('res-mode');
  const resDiff = DOC.getElementById('res-diff');
  const resDuration = DOC.getElementById('res-duration');
  const resTotalObs = DOC.getElementById('res-total-obs');
  const resHits = DOC.getElementById('res-hits');
  const resMiss = DOC.getElementById('res-miss');
  const resJumpHit = DOC.getElementById('res-jump-hit');
  const resDuckHit = DOC.getElementById('res-duck-hit');
  const resJumpMiss = DOC.getElementById('res-jump-miss');
  const resDuckMiss = DOC.getElementById('res-duck-miss');
  const resAcc = DOC.getElementById('res-acc');
  const resRtMean = DOC.getElementById('res-rt-mean');
  const resStabMin = DOC.getElementById('res-stability-min');
  const resScore = DOC.getElementById('res-score');
  const resRank  = DOC.getElementById('res-rank');

  // ---------- state ----------
  let running = false;
  let rafId = 0;

  let cfg = null;
  let rng = null;

  let tStart = 0;
  let tPrev = 0;

  let timeLeft = 0;         // seconds
  let durationSec = 60;

  let spawnTimer = 0;       // seconds
  let spawnInterval = 1.4;  // seconds base
  let speedPx = 320;        // obstacle speed px/s
  let judgeWindowMs = 220;  // timing window

  let hitLineX = 0;         // px
  let totalObstacles = 0;

  let score = 0;
  let combo = 0;

  let hits = 0, miss = 0;
  let jumpHit = 0, duckHit = 0, jumpMiss = 0, duckMiss = 0;

  let rtHits = [];          // ms for hits
  let stability = 100;      // 0-100
  let stabilityMin = 100;

  let obstacleId = 0;

  // latest action (player input)
  let lastAction = { type: null, t: -1 }; // type: 'jump'|'duck'

  // active obstacles list
  let obstacles = []; // {id}
  // research log
  let meta = null;
  let eventLog = []; // {id, kind, expected, tHit, action, judgement, rtMs, tSinceStartMs}

  // ---------- config by mode/diff ----------
  function computeParams(mode, diff){
    // base
    let interval = 1.35;
    let speed = 340;
    let windowMs = 220;

    if(diff === 'easy'){
      interval = 1.55; speed = 300; windowMs = 260;
    } else if(diff === 'normal'){
      interval = 1.35; speed = 340; windowMs = 220;
    } else { // hard
      interval = 1.15; speed = 390; windowMs = 190;
    }

    // test/research = fixed; training = can adapt slightly
    const adaptive = (mode === 'training');
    return { interval, speed, windowMs, adaptive };
  }

  function setView(which){
    viewMenu.classList.toggle('jd-hidden', which !== 'menu');
    viewPlay.classList.toggle('jd-hidden', which !== 'play');
    viewResult.classList.toggle('jd-hidden', which !== 'result');
  }

  function setJudge(text, cls){
    judgeEl.classList.remove('good','miss','tip');
    if(cls) judgeEl.classList.add(cls);
    judgeEl.textContent = text;
  }

  function setAvatarPose(pose){
    avatar.classList.remove('is-jump','is-duck');
    if(pose === 'jump') avatar.classList.add('is-jump');
    if(pose === 'duck') avatar.classList.add('is-duck');
  }

  function updateHitLine(){
    // hit line at 32% of play area width
    const r = playArea.getBoundingClientRect();
    hitLineX = r.width * 0.32;
  }

  function updateHud(){
    safeText(hudMode, (cfg.mode||'training').toUpperCase());
    safeText(hudDiff, cfg.diff);
    safeText(hudDuration, `${durationSec}s`);
    safeText(hudScore, score);
    safeText(hudCombo, combo);
    safeText(hudObstacles, `${hits + miss} / ${totalObstacles}`);
    safeText(hudTime, fmt1(timeLeft));
    safeText(hudStability, `${clamp(stability,0,100).toFixed(0)}%`);
    // color hint
    if(stability >= 80) hudStability.style.color = 'var(--accent)';
    else if(stability >= 55) hudStability.style.color = 'var(--warn)';
    else hudStability.style.color = 'var(--bad)';
  }

  function updateResearchBlock(){
    const m = (elMode.value || 'training');
    researchBlock.classList.toggle('jd-hidden', m !== 'research');
  }

  // ---------- obstacle management ----------
  function createObstacle(kind){
    // kind: 'low'|'high'
    const el = DOC.createElement('div');
    el.className = `jd-obstacle ${kind}`;
    // emoji for readability
    el.textContent = (kind === 'low') ? '🧱' : '🪧';
    obsLayer.appendChild(el);

    // start at right
    const r = playArea.getBoundingClientRect();
    const x0 = r.width + 80;
    const y = (kind === 'low') ? (r.height - 68 - 72) : (r.height - 68 - 72 - 72); // not used directly (css handles bottom)
    el.style.transform = `translate3d(${x0}px, 0, 0)`;

    const id = ++obstacleId;

    // when will it hit hitLine?
    const distToHit = x0 - hitLineX;
    const tToHitMs = (distToHit / speedPx) * 1000;

    const o = {
      id,
      kind,
      el,
      x: x0,
      tSpawn: now(),
      tHit: now() + tToHitMs,
      judged: false,
      removed: false
    };
    obstacles.push(o);
    totalObstacles++;
  }

  function removeObstacle(o){
    if(o.removed) return;
    o.removed = true;
    try{ o.el.remove(); }catch(_){}
  }

  function pickKindDeterministic(){
    // 50/50, but prevent same 3 in a row too often
    const r = rng();
    return (r < 0.5) ? 'low' : 'high';
  }

  function maybeSpawn(dt){
    spawnTimer -= dt;
    if(spawnTimer > 0) return;

    // reset timer (jitter small for natural feel; fixed-ish for test/research)
    const base = spawnInterval;
    let jitter = 0;
    if(cfg.mode === 'training'){
      jitter = (rng() - 0.5) * 0.22; // +/- 0.11s
    } else {
      jitter = (rng() - 0.5) * 0.12; // smaller jitter
    }
    spawnTimer = Math.max(0.7, base + jitter);

    const kind = pickKindDeterministic();
    createObstacle(kind);
  }

  // ---------- judge ----------
  function judgeAtHit(o, tHit){
    const expected = (o.kind === 'low') ? 'jump' : 'duck';
    const actType = lastAction.type;
    const actT = lastAction.t;

    // within window?
    const dtMs = (actT >= 0) ? Math.abs(actT - tHit) : 999999;
    const within = dtMs <= judgeWindowMs;

    let ok = false;
    let judgement = 'MISS';
    let rtMs = null;

    if(actType === expected && within){
      ok = true;
      judgement = 'GOOD';
      rtMs = dtMs;
    }

    // score logic
    if(ok){
      hits++;
      combo++;
      rtHits.push(rtMs);

      if(expected === 'jump') jumpHit++; else duckHit++;

      // points: base + combo bonus + tighter timing bonus
      const timingBonus = Math.round(clamp((judgeWindowMs - rtMs) / judgeWindowMs, 0, 1) * 20);
      const comboBonus = Math.min(60, combo * 3);
      const add = 80 + timingBonus + comboBonus;
      score += add;

      // stability improves slightly
      stability = clamp(stability + 2.5, 0, 100);

      setJudge(`GOOD +${add} (RT ${Math.round(rtMs)}ms)`, 'good');
      playSfx('jd-sfx-hit');

    }else{
      miss++;
      combo = 0;

      if(expected === 'jump') jumpMiss++; else duckMiss++;

      // stability drop
      stability = clamp(stability - 7.5, 0, 100);
      stabilityMin = Math.min(stabilityMin, stability);

      setJudge(`MISS (${expected.toUpperCase()})`, 'miss');
      playSfx('jd-sfx-miss');
    }

    stabilityMin = Math.min(stabilityMin, stability);

    // log event
    eventLog.push({
      id: o.id,
      kind: o.kind,
      expected,
      tHit: Math.round(tHit - tStart),
      action: actType || '-',
      judgement,
      rtMs: (rtMs==null ? '' : Math.round(rtMs)),
      tSinceStartMs: Math.round(tHit - tStart)
    });

    // remove after judged
    removeObstacle(o);

    updateHud();
  }

  // ---------- input ----------
  function doAction(type){
    if(!running) return;

    const t = now();
    lastAction = { type, t };

    // avatar pose
    setAvatarPose(type);
    setTimeout(()=> setAvatarPose(null), 140);

    // small helper judge text (tip)
    if(type === 'jump') setJudge('JUMP!', 'tip');
    else setJudge('DUCK!', 'tip');

    // optional beep
    playSfx('jd-sfx-beep');
  }

  function onPointerDown(ev){
    if(!running) return;
    const r = playArea.getBoundingClientRect();
    const y = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
    const relY = y - r.top;
    const isTop = relY < r.height * 0.5;
    doAction(isTop ? 'jump' : 'duck');
  }

  function onKeyDown(ev){
    if(!running) return;
    if(ev.key === 'ArrowUp'){ ev.preventDefault(); doAction('jump'); }
    if(ev.key === 'ArrowDown'){ ev.preventDefault(); doAction('duck'); }
  }

  // ---------- loop ----------
  function tick(){
    if(!running) return;
    const t = now();
    const dt = Math.min(0.05, (t - tPrev) / 1000); // seconds
    tPrev = t;

    timeLeft = Math.max(0, timeLeft - dt);

    // training adaptive near end (last 25%)
    if(cfg.adaptive && durationSec > 0){
      const p = 1 - (timeLeft / durationSec); // 0..1
      if(p > 0.75){
        const k = (p - 0.75) / 0.25; // 0..1
        speedPx = cfg.baseSpeed * (1 + 0.18*k);
        spawnInterval = cfg.baseInterval * (1 - 0.12*k);
        judgeWindowMs = Math.max(150, Math.round(cfg.baseWindowMs * (1 - 0.10*k)));
      }
    }

    // spawn
    maybeSpawn(dt);

    // move obstacles
    const r = playArea.getBoundingClientRect();
    for(const o of obstacles){
      if(o.removed) continue;
      o.x -= speedPx * dt;
      o.el.style.transform = `translate3d(${o.x}px, 0, 0)`;

      // when crosses hit line -> judge once
      if(!o.judged && o.x <= hitLineX){
        o.judged = true;
        judgeAtHit(o, o.tHit);
      }

      // cleanup if off-screen
      if(o.x < -140){
        removeObstacle(o);
      }
    }
    // filter removed
    obstacles = obstacles.filter(o=> !o.removed);

    // stability natural recovery if combo going
    if(combo > 0) stability = clamp(stability + dt*1.2, 0, 100);
    stabilityMin = Math.min(stabilityMin, stability);

    updateHud();

    if(timeLeft <= 0){
      endRun(false);
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  // ---------- start/stop ----------
  function resetStats(){
    score=0; combo=0;
    hits=0; miss=0;
    jumpHit=0; duckHit=0; jumpMiss=0; duckMiss=0;
    rtHits=[];
    stability=100; stabilityMin=100;
    totalObstacles=0;
    obstacleId=0;
    lastAction={type:null, t:-1};
    eventLog=[];
    // clear obstacles
    for(const o of obstacles){ removeObstacle(o); }
    obstacles=[];
    obsLayer.innerHTML='';
  }

  function readMetaFromUI(mode){
    return {
      participantId: (elPid && elPid.value || '').trim(),
      group: (elGroup && elGroup.value || '').trim(),
      note: (elNote && elNote.value || '').trim(),
      mode
    };
  }

  function startRun(opts){
    const mode = opts.mode;
    const diff = opts.diff;
    durationSec = opts.durationSec;

    const params = computeParams(mode, diff);

    cfg = {
      mode, diff,
      adaptive: params.adaptive,
      baseInterval: params.interval,
      baseSpeed: params.speed,
      baseWindowMs: params.windowMs
    };

    // allow deterministic seed via URL (seed=123) for test/research
    const seedQ = qs('seed', null);
    const seed = (seedQ != null) ? Number(seedQ) : Date.now();
    rng = makeRNG(seed);

    // set runtime params
    spawnInterval = cfg.baseInterval;
    speedPx = cfg.baseSpeed;
    judgeWindowMs = cfg.baseWindowMs;

    resetStats();
    updateHitLine();

    meta = readMetaFromUI(mode);
    meta.seed = seed;
    meta.diff = diff;
    meta.durationSec = durationSec;
    meta.startedAtISO = new Date().toISOString();

    timeLeft = durationSec;
    spawnTimer = 0.35; // small delay
    tStart = now();
    tPrev = tStart;

    running = true;
    setView('play');
    setJudge('READY', null);

    // init HUD
    safeText(hudMode, mode.toUpperCase());
    safeText(hudDiff, diff);
    safeText(hudDuration, `${durationSec}s`);
    updateHud();

    // events
    WIN.dispatchEvent(new CustomEvent('hha:start', { detail: { game:'jump-duck', ...meta }}));

    rafId = requestAnimationFrame(tick);
  }

  function computeRank(acc, s){
    // simple but meaningful
    if(acc >= 92 && s >= 6200) return 'S';
    if(acc >= 85 && s >= 4800) return 'A';
    if(acc >= 72 && s >= 3400) return 'B';
    if(acc >= 58 && s >= 2200) return 'C';
    return 'D';
  }

  function endRun(early){
    if(!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;

    // finalize
    const total = hits + miss;
    const acc = total ? (hits/total)*100 : 0;
    const rtMean = rtHits.length ? mean(rtHits) : 0;

    const rank = computeRank(acc, score);

    // results view populate
    safeText(resMode, (cfg.mode||'training').toUpperCase());
    safeText(resDiff, cfg.diff);
    safeText(resDuration, `${durationSec}s`);
    safeText(resTotalObs, totalObstacles);
    safeText(resHits, hits);
    safeText(resMiss, miss);
    safeText(resJumpHit, jumpHit);
    safeText(resDuckHit, duckHit);
    safeText(resJumpMiss, jumpMiss);
    safeText(resDuckMiss, duckMiss);
    safeText(resAcc, `${fmt1(acc)} %`);
    safeText(resRtMean, rtHits.length ? `${Math.round(rtMean)} ms` : '-');
    safeText(resStabMin, `${fmt1(stabilityMin)} %`);
    safeText(resScore, score);
    safeText(resRank, rank);

    // emit end
    const summary = {
      game:'jump-duck',
      early: !!early,
      mode: cfg.mode,
      diff: cfg.diff,
      durationSec,
      totalObstacles,
      hits, miss,
      jumpHit, duckHit, jumpMiss, duckMiss,
      acc: Number(fmt1(acc)),
      rtMeanMs: rtHits.length ? Math.round(rtMean) : null,
      stabilityMin: Number(fmt1(stabilityMin)),
      score, rank,
      meta
    };
    WIN.dispatchEvent(new CustomEvent('hha:end', { detail: summary }));

    // inject CSV download button for research (and also allow for test)
    injectDownloadIfNeeded(summary);

    setView('result');
    setJudge('DONE', null);
  }

  function injectDownloadIfNeeded(summary){
    // only if research or test
    const isLogMode = (summary.mode === 'research' || summary.mode === 'test');
    // clear old injected row
    const old = DOC.getElementById('jd-download-row');
    if(old) old.remove();

    if(!isLogMode) return;

    const row = DOC.createElement('div');
    row.id = 'jd-download-row';
    row.className = 'jd-mini-row';

    const btn = DOC.createElement('button');
    btn.className = 'jd-mini';
    btn.textContent = '⬇️ ดาวน์โหลดผลเป็น CSV';
    btn.addEventListener('click', ()=>{
      const csv = buildCSV(summary);
      downloadText(csv, `jump-duck_${summary.mode}_${summary.diff}_${Date.now()}.csv`, 'text/csv;charset=utf-8;');
      playSfx('jd-sfx-combo');
    });

    const btn2 = DOC.createElement('button');
    btn2.className = 'jd-mini';
    btn2.textContent = '📋 คัดลอกสรุปผล';
    btn2.addEventListener('click', async ()=>{
      const s = buildSummaryText(summary);
      try{
        await navigator.clipboard.writeText(s);
        // tiny feedback
        const tmp = btn2.textContent;
        btn2.textContent = '✅ คัดลอกแล้ว';
        setTimeout(()=> btn2.textContent = tmp, 900);
      }catch(_){
        alert(s);
      }
    });

    row.appendChild(btn);
    row.appendChild(btn2);

    // append under result grid
    const card = viewResult.querySelector('.jd-card');
    if(card) card.appendChild(row);
  }

  function buildSummaryText(s){
    return [
      `Jump-Duck Summary`,
      `mode=${s.mode}, diff=${s.diff}, duration=${s.durationSec}s, seed=${(s.meta && s.meta.seed) ?? ''}`,
      `totalObstacles=${s.totalObstacles}, hits=${s.hits}, miss=${s.miss}, acc=${s.acc}%`,
      `jumpHit=${s.jumpHit}, duckHit=${s.duckHit}, jumpMiss=${s.jumpMiss}, duckMiss=${s.duckMiss}`,
      `rtMeanMs=${s.rtMeanMs ?? ''}, stabilityMin=${s.stabilityMin}%`,
      `score=${s.score}, rank=${s.rank}`,
      `participantId=${(s.meta && s.meta.participantId)||''}, group=${(s.meta && s.meta.group)||''}, note=${(s.meta && s.meta.note)||''}`,
    ].join('\n');
  }

  function buildCSV(s){
    const header1 = [
      'game','mode','diff','durationSec','seed',
      'participantId','group','note',
      'totalObstacles','hits','miss','acc','rtMeanMs','stabilityMin','score','rank',
      'startedAtISO'
    ];
    const row1 = [
      'jump-duck', s.mode, s.diff, s.durationSec, (s.meta && s.meta.seed) ?? '',
      (s.meta && s.meta.participantId) || '',
      (s.meta && s.meta.group) || '',
      (s.meta && s.meta.note) || '',
      s.totalObstacles, s.hits, s.miss, s.acc, (s.rtMeanMs ?? ''), s.stabilityMin, s.score, s.rank,
      (s.meta && s.meta.startedAtISO) || ''
    ].map(csvCell).join(',');

    const header2 = ['event_id','kind','expected','tHitMs','action','judgement','rtMs','tSinceStartMs'];
    const rows2 = eventLog.map(e=> [
      e.id, e.kind, e.expected, e.tHit, e.action, e.judgement, e.rtMs, e.tSinceStartMs
    ].map(csvCell).join(','));

    return [
      header1.join(','),
      row1,
      '',
      header2.join(','),
      ...rows2
    ].join('\n');

    function csvCell(v){
      const s = String(v ?? '');
      if(/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    }
  }

  function downloadText(text, filename, mime){
    const blob = new Blob([text], {type: mime || 'text/plain;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename || 'download.txt';
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      URL.revokeObjectURL(url);
      a.remove();
    }, 50);
  }

  // ---------- UI actions ----------
  function startFromMenu(isTutorial){
    const mode = elMode.value || 'training';
    const diff = elDiff.value || 'normal';
    const dur = Number(elDuration.value || 60);

    const duration = isTutorial ? 15 : dur;
    startRun({ mode, diff, durationSec: duration });
  }

  function stopEarly(){
    if(!running) return;
    endRun(true);
  }

  function playAgain(){
    // use same settings from menu fields
    startFromMenu(false);
  }

  function backMenu(){
    // stop if somehow running
    if(running) endRun(true);
    setView('menu');
  }

  // ---------- bind ----------
  function bindActions(){
    DOC.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('[data-action]');
      if(!btn) return;
      const a = btn.getAttribute('data-action');
      if(a === 'start') startFromMenu(false);
      if(a === 'tutorial') startFromMenu(true);
      if(a === 'stop-early') stopEarly();
      if(a === 'play-again') playAgain();
      if(a === 'back-menu') backMenu();
    });

    elMode.addEventListener('change', updateResearchBlock);

    // play area inputs
    playArea.addEventListener('pointerdown', onPointerDown, {passive:true});
    WIN.addEventListener('keydown', onKeyDown);

    // resize hitline
    WIN.addEventListener('resize', ()=>{
      updateHitLine();
    });
  }

  // ---------- init ----------
  function init(){
    // default view
    setView('menu');
    updateResearchBlock();
    bindActions();

    // hint text
    setJudge('READY', null);

    // if URL wants auto-start (optional)
    const autostart = qs('autostart', '0');
    if(autostart === '1' || autostart === 'true'){
      // mode/diff/time may come from query (optional)
      const mode = qs('mode', elMode.value || 'training');
      const diff = qs('diff', elDiff.value || 'normal');
      const time = Number(qs('time', elDuration.value || 60));
      elMode.value = mode;
      elDiff.value = diff;
      elDuration.value = String(time);
      updateResearchBlock();
      startFromMenu(false);
    }
  }

  init();

})();