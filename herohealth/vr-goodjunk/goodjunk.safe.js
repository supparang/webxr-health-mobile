// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Engine — PRODUCTION (spawn-safe + failsafe + shoot support)
// FULL v20260224c
// ✅ spawn uses layer content box (CSS padding = safe spawn zone)
// ✅ supports click/tap + hha:shoot (vr-ui crosshair)
// ✅ failsafe: if no targets appear, force spawn
// ✅ end overlay + summary + window.__GJ_STATE__ for debug

'use strict';

export function boot(cfg = {}){
  const DOC = document;
  const WIN = window;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
  const now = ()=>Date.now();

  // ---------- QS helpers ----------
  const QS = (()=>{ try{ return new URL(location.href).searchParams; }catch{ return new URLSearchParams(); } })();
  const qs = (k,d='')=> (QS.get(k) ?? d);
  const qNum = (k,d)=>{ const n = Number(qs(k,d)); return Number.isFinite(n)?n:d; };

  // ---------- config ----------
  const view = String(cfg.view ?? qs('view','mobile')).toLowerCase();
  const run  = String(cfg.run  ?? qs('run','play')).toLowerCase();
  const diff = String(cfg.diff ?? qs('diff','normal')).toLowerCase();
  const timeLimit = clamp(Number(cfg.time ?? qNum('time',80)), 20, 300);

  const seed0 = String(cfg.seed ?? qs('seed','') ?? '').trim();
  const seed = seed0 || String(Date.now());
  const studyId = String(cfg.studyId ?? qs('studyId', qs('study','')) ?? '').trim();
  const phase = String(cfg.phase ?? qs('phase','') ?? '').trim();
  const conditionGroup = String(cfg.conditionGroup ?? qs('conditionGroup', qs('cond','')) ?? '').trim();

  // ---------- DOM ----------
  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');
  if(!layerL) throw new Error('GoodJunk: missing #gj-layer');

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');

  const elGoal     = DOC.getElementById('hud-goal');
  const elGoalCur  = DOC.getElementById('hud-goal-cur');
  const elGoalTgt  = DOC.getElementById('hud-goal-target');
  const elGoalDesc = DOC.getElementById('goalDesc');

  const elMini     = DOC.getElementById('hud-mini');
  const elMiniT    = DOC.getElementById('miniTimer');

  const elProg = DOC.getElementById('gjProgressFill');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShieldPills = DOC.getElementById('shieldPills');

  const bossBar = DOC.getElementById('bossBar');
  const bossFill = DOC.getElementById('bossFill');
  const bossHint = DOC.getElementById('bossHint');

  const lowTimeOverlay = DOC.getElementById('lowTimeOverlay');
  const lowTimeNum = DOC.getElementById('gj-lowtime-num');

  const endOverlay = DOC.getElementById('endOverlay');
  const endTitle   = DOC.getElementById('endTitle');
  const endSub     = DOC.getElementById('endSub');
  const endGrade   = DOC.getElementById('endGrade');
  const endScore   = DOC.getElementById('endScore');
  const endMiss    = DOC.getElementById('endMiss');
  const endTime    = DOC.getElementById('endTime');

  // ---------- view flags ----------
  DOC.body.classList.toggle('view-cvr', view === 'cvr' || view === 'cardboard' || view === 'vr');
  const strictCvr = String(qs('strict','0')) === '1';
  DOC.body.classList.toggle('strict', strictCvr);

  // Show R eye layer only in cVR/cardboard
  const isCVR = DOC.body.classList.contains('view-cvr');
  if(layerR){
    layerR.style.display = isCVR ? 'block' : 'none';
  }

  // ---------- RNG ----------
  function hash32(str){
    let h = 2166136261 >>> 0;
    str = String(str || '');
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(hash32(`${seed}|goodjunk|${run}|${diff}`));
  const rand = ()=>rng();
  const randi = (n)=> (rand()*n)|0;

  // ---------- gameplay tuning ----------
  const DIFF = {
    easy:   { spawnMin: 520, spawnJit: 420, ttlMin: 1050, ttlJit: 900, junkRate: 0.22, bossEvery: 18, bossHp: 6,  shieldStart: 2 },
    normal: { spawnMin: 430, spawnJit: 360, ttlMin: 920,  ttlJit: 820, junkRate: 0.28, bossEvery: 16, bossHp: 8,  shieldStart: 2 },
    hard:   { spawnMin: 360, spawnJit: 300, ttlMin: 820,  ttlJit: 740, junkRate: 0.34, bossEvery: 14, bossHp: 10, shieldStart: 1 },
  }[diff] || { spawnMin: 430, spawnJit: 360, ttlMin: 920, ttlJit: 820, junkRate: 0.28, bossEvery: 16, bossHp: 8, shieldStart: 2 };

  // goal (simple + stable)
  const goalName = 'HIT GOOD';
  const goalTarget = clamp(qNum('goal', 18), 6, 60);

  // ---------- state ----------
  let started = false;
  let ended = false;

  let tStart = 0;
  let tLeft = timeLimit;

  let score = 0;
  let miss  = 0;
  let totalSpawn = 0;

  let fever = 0; // 0..100
  let shields = DIFF.shieldStart;

  let goalCur = 0;

  let bossActive = false;
  let bossHP = 0;
  let bossMax = 0;

  const targets = new Map(); // id -> {el, kind, born, ttl, hp, layer:'L'|'R'}
  let idSeq = 1;

  // expose for debug
  WIN.__GJ_STATE__ = { targets, get miss(){return miss;}, get score(){return score;} };

  // ---------- HUD ----------
  function setText(el, t){ if(el) el.textContent = String(t); }
  function setAriaHidden(el, hide){
    if(!el) return;
    el.setAttribute('aria-hidden', hide ? 'true' : 'false');
  }

  function computeGrade(){
    // simple: accuracy weight + goal bonus
    const acc = (score + miss) > 0 ? (score / Math.max(1, score+miss)) : 0;
    const g = (acc >= 0.90 && goalCur >= Math.floor(goalTarget*0.8)) ? 'S'
            : (acc >= 0.80) ? 'A'
            : (acc >= 0.65) ? 'B'
            : 'C';
    return g;
  }

  function updateHUD(){
    setText(elScore, score);
    setText(elMiss, miss);
    setText(elTime, Math.ceil(tLeft));
    setText(elGrade, started ? computeGrade() : '—');

    setText(elGoal, goalName);
    setText(elGoalCur, goalCur);
    setText(elGoalTgt, goalTarget);
    setText(elGoalDesc, `แตะ GOOD ให้ถึง ${goalTarget}`);

    // mini info
    setText(elMini, bossActive ? 'BOSS' : 'NORMAL');
    setText(elMiniT, `${Math.ceil(tLeft)}s`);

    if(elProg){
      const pct = clamp(((timeLimit - tLeft) / timeLimit) * 100, 0, 100);
      elProg.style.width = pct.toFixed(2) + '%';
    }

    // fever/shield
    fever = clamp(fever, 0, 100);
    if(elFeverFill) elFeverFill.style.width = fever.toFixed(1) + '%';
    setText(elFeverText, Math.round(fever) + '%');

    const pills = shields <= 0 ? '—' : '🛡️'.repeat(clamp(shields,0,6));
    setText(elShieldPills, pills);

    // boss bar
    if(bossBar){
      setAriaHidden(bossBar, !bossActive);
      if(bossActive && bossFill){
        const hpPct = bossMax > 0 ? clamp((bossHP / bossMax) * 100, 0, 100) : 0;
        bossFill.style.width = hpPct.toFixed(1) + '%';
      }
      if(bossActive && bossHint){
        bossHint.textContent = `ตีบอสให้ครบ ${bossHP}/${bossMax}`;
      }
    }

    // low time
    const low = tLeft <= 5;
    setAriaHidden(lowTimeOverlay, !low);
    if(lowTimeNum) lowTimeNum.textContent = String(Math.max(0, Math.ceil(tLeft)));
  }

  // ---------- layer / spawn helpers ----------
  function activeLayerForPoint(x, y){
    if(!isCVR || !layerR) return { el: layerL, side: 'L' };
    // split screen: left half = L, right half = R
    const w = WIN.innerWidth || DOC.documentElement.clientWidth || 1;
    return (x > w/2) ? { el: layerR, side: 'R' } : { el: layerL, side: 'L' };
  }

  function layerRect(layer){
    try{ return layer.getBoundingClientRect(); }catch{ return {left:0,top:0,width:1,height:1}; }
  }

  function spawnPos(layer){
    // Because layer has padding (spawn-safe), clientWidth/Height already represent safe area.
    const w = Math.max(1, layer.clientWidth || 1);
    const h = Math.max(1, layer.clientHeight || 1);

    // keep away from edges a bit
    const pad = 10;
    const x = pad + rand() * Math.max(1, w - pad*2);
    const y = pad + rand() * Math.max(1, h - pad*2);
    return { x, y };
  }

  function makeTargetEl(kind){
    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.dataset.kind = kind;

    // emoji set
    const GOOD = ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑'];
    const JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭'];
    const BOSS = ['👹','😈','🧟','👾'];

    if(kind === 'good') el.textContent = GOOD[randi(GOOD.length)];
    else if(kind === 'junk') el.textContent = JUNK[randi(JUNK.length)];
    else el.textContent = BOSS[randi(BOSS.length)];

    // size hints
    if(kind === 'boss') el.dataset.size = 'lg';
    else if(rand() < 0.25) el.dataset.size = 'sm';

    return el;
  }

  function addTarget(kind, forceSide=null){
    const spawnLayer = (forceSide === 'R' && layerR) ? layerR : layerL;
    const side = (spawnLayer === layerR) ? 'R' : 'L';

    const id = String(idSeq++);
    const el = makeTargetEl(kind);

    const pos = spawnPos(spawnLayer);
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';

    const ttl = DIFF.ttlMin + rand() * DIFF.ttlJit;

    const obj = {
      id, el, kind,
      born: now(),
      ttl,
      hp: (kind === 'boss') ? bossHP : 1,
      side,
    };

    // click/tap support (unless strict cvr)
    const onTap = (ev)=>{
      if(ended || !started) return;
      if(strictCvr && isCVR) return; // strict: no pointer hits
      ev.preventDefault?.();
      handleHit(id, { via:'tap' });
    };
    el.addEventListener('pointerdown', onTap, {passive:false});

    // store teardown
    obj._off = ()=> el.removeEventListener('pointerdown', onTap);

    targets.set(id, obj);
    spawnLayer.appendChild(el);

    totalSpawn++;
    return obj;
  }

  function removeTarget(id, dying=false){
    const t = targets.get(id);
    if(!t) return;
    targets.delete(id);
    try{
      t._off?.();
      if(dying){
        t.el.classList.add('is-dying');
        setTimeout(()=>{ try{ t.el.remove(); }catch{} }, 160);
      }else{
        t.el.remove();
      }
    }catch{}
  }

  // ---------- scoring ----------
  function onGood(){
    score += 1;
    goalCur += 1;
    fever = clamp(fever + 2.5, 0, 100);
  }
  function onJunk(){
    if(shields > 0){
      shields -= 1;
      // shield blocks miss (per your standard)
      fever = clamp(fever + 1.0, 0, 100);
      return;
    }
    miss += 1;
    fever = clamp(fever + 4.0, 0, 100);
  }
  function onBossHit(){
    score += 2;
    fever = clamp(fever + 3.0, 0, 100);
  }

  // ---------- hit logic ----------
  function handleHit(id, meta={}){
    if(ended || !started) return;
    const t = targets.get(id);
    if(!t) return;

    // hit FX
    t.el.classList.add('is-hit');
    setTimeout(()=>t.el.classList.remove('is-hit'), 110);

    if(t.kind === 'good'){
      onGood();
      removeTarget(id, true);
    }else if(t.kind === 'junk'){
      onJunk();
      removeTarget(id, true);
    }else{ // boss
      if(!bossActive) bossActive = true;

      bossHP = Math.max(0, bossHP - 1);
      onBossHit();

      if(bossHP <= 0){
        bossActive = false;
        // clear any remaining boss targets
        for(const [tid, obj] of targets.entries()){
          if(obj.kind === 'boss') removeTarget(tid, true);
        }
      }else{
        // keep boss target but nudge slightly to feel alive
        const layer = (t.side === 'R' && layerR) ? layerR : layerL;
        const pos = spawnPos(layer);
        t.el.style.left = pos.x + 'px';
        t.el.style.top  = pos.y + 'px';
      }
    }

    updateHUD();

    // goal achieved: small reward (shield)
    if(goalCur === goalTarget){
      shields += 1;
    }
  }

  // ---------- shoot support (VR crosshair) ----------
  function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx + dy*dy; }

  function shootAt(clientX, clientY){
    if(ended || !started) return;

    const { el: layer, side } = activeLayerForPoint(clientX, clientY);
    const rect = layerRect(layer);

    // aim point relative to layer content box
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // pick nearest target within lock radius
    const lockPx = clamp(qNum('lockPx', 64), 24, 140);
    const lock2 = lockPx * lockPx;

    let bestId = null;
    let bestD2 = 1e18;

    for(const [id, t] of targets.entries()){
      if(isCVR && t.side !== side) continue;

      const r = t.el.getBoundingClientRect();
      const cx = (r.left + r.right)/2 - rect.left;
      const cy = (r.top + r.bottom)/2 - rect.top;

      const d2 = dist2(x,y,cx,cy);
      if(d2 < bestD2){
        bestD2 = d2;
        bestId = id;
      }
    }

    if(bestId && bestD2 <= lock2){
      handleHit(bestId, { via:'shoot' });
    }else{
      // missed shot (in strict VR we can count as miss optionally; keep gentle = no miss)
      // If you want: miss++ when strict and no lock.
    }
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    const d = ev?.detail || {};
    const x = Number(d.clientX ?? d.x);
    const y = Number(d.clientY ?? d.y);
    if(Number.isFinite(x) && Number.isFinite(y)){
      shootAt(x,y);
    }else{
      // fallback center of screen
      shootAt((WIN.innerWidth||0)/2, (WIN.innerHeight||0)/2);
    }
  });

  // ---------- main loops ----------
  let raf = 0;
  let lastTs = 0;
  let spawnTimer = 0;
  let failsafeTimer = 0;

  function scheduleSpawn(){
    const ms = DIFF.spawnMin + rand() * DIFF.spawnJit;
    spawnTimer = now() + ms;
  }

  function maybeSpawn(){
    if(now() < spawnTimer) return;

    // boss logic: every N spawns, start a boss phase
    if(!bossActive && totalSpawn > 0 && (totalSpawn % DIFF.bossEvery === 0)){
      bossActive = true;
      bossMax = DIFF.bossHp;
      bossHP = DIFF.bossHp;
      addTarget('boss', isCVR && rand() < 0.5 ? 'R' : 'L');
    }else{
      const kind = (rand() < DIFF.junkRate) ? 'junk' : 'good';
      addTarget(kind, isCVR && rand() < 0.5 ? 'R' : 'L');
    }

    scheduleSpawn();
  }

  function expireOld(){
    const t = now();
    for(const [id, obj] of targets.entries()){
      if(obj.kind === 'boss') continue; // boss does not expire by ttl
      if(t - obj.born > obj.ttl){
        // expired counts as miss only for GOOD (your standard: miss = good expired + junk hit)
        if(obj.kind === 'good'){
          miss += 1;
          fever = clamp(fever + 2.0, 0, 100);
        }
        removeTarget(id, true);
      }
    }
  }

  function failsafe(){
    // if nothing in field for too long => force spawn
    const any = targets.size > 0;
    if(any){
      failsafeTimer = now() + 1100;
      return;
    }
    if(now() > failsafeTimer){
      addTarget('good', isCVR && rand() < 0.5 ? 'R' : 'L');
      failsafeTimer = now() + 1100;
    }
  }

  function tick(ts){
    if(ended) return;

    if(!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if(started){
      tLeft = Math.max(0, tLeft - dt);

      maybeSpawn();
      expireOld();
      failsafe();

      // small fever decay
      fever = clamp(fever - dt * 1.2, 0, 100);

      if(tLeft <= 0){
        endGame('timeup');
        return;
      }
    }

    updateHUD();
    raf = requestAnimationFrame(tick);
  }

  // ---------- start / end ----------
  function startGame(){
    if(started || ended) return;
    started = true;
    tStart = now();
    tLeft = timeLimit;
    score = 0; miss = 0; totalSpawn = 0;
    fever = 0;
    shields = DIFF.shieldStart;
    goalCur = 0;
    bossActive = false; bossHP = 0; bossMax = 0;

    // clear targets
    for(const [id] of targets.entries()) removeTarget(id, false);

    scheduleSpawn();
    failsafeTimer = now() + 900;

    setAriaHidden(endOverlay, true);

    updateHUD();
  }

  function buildSummary(reason){
    const playedSec = Math.round((timeLimit - tLeft));
    const acc = (score + miss) > 0 ? score / (score + miss) : 0;

    return {
      kind: 'summary',
      game: 'goodjunk',
      ts: now(),
      reason: reason || '',
      run, view, diff,
      seed,
      studyId: studyId || null,
      phase: phase || null,
      conditionGroup: conditionGroup || null,
      timeLimit,
      playedSec,
      score,
      miss,
      goal: { name: goalName, cur: goalCur, target: goalTarget },
      fever: Math.round(fever),
      shields,
      grade: computeGrade(),
      acc: Number(acc.toFixed(3)),
    };
  }

  function endGame(reason){
    if(ended) return;
    ended = true;
    started = false;

    // stop spawning/clean up
    cancelAnimationFrame(raf);

    // show end overlay
    const summary = buildSummary(reason);
    setText(endTitle, 'GoodJunk — Completed');
    setText(endSub, `seed=${seed} • run=${run} • diff=${diff} • view=${view}`);
    setText(endGrade, summary.grade);
    setText(endScore, summary.score);
    setText(endMiss, summary.miss);
    setText(endTime, summary.playedSec);

    setAriaHidden(endOverlay, false);

    // dispatch for runner (goodjunk-vr.html)
    try{
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary }));
    }catch(e){}
  }

  // ---------- input start ----------
  // auto start on load (tap anywhere also ok)
  function onAnyStart(){
    if(ended) return;
    if(!started) startGame();
  }
  layerL.addEventListener('pointerdown', onAnyStart, {passive:true});
  layerR?.addEventListener?.('pointerdown', onAnyStart, {passive:true});

  // also start immediately
  startGame();

  // ---------- lifecycle ----------
  raf = requestAnimationFrame(tick);

  // If tab hidden while playing, end cleanly
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && started && !ended){
      endGame('hidden');
    }
  });
}