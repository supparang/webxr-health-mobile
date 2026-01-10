// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Engine — PRODUCTION (Standalone + Boss++ + FX)
// RULES:
// - timeLeft <= 30s => STORM (more spawns)
// - miss >= 4 => BOSS
// - miss >= 5 => RAGE (hardest burst)
// Boss HP: easy/normal/hard => 10/12/14
// Boss phases: each phase lasts 2–6s (random, seeded if seed provided)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

// deterministic rng (mulberry32)
function makeRng(seedStr){
  let seed = 0;
  if(seedStr == null || seedStr === ''){
    seed = (Date.now() ^ (Math.random()*1e9)) >>> 0;
  }else{
    const s = String(seedStr);
    for(let i=0;i<s.length;i++){
      seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
    }
  }
  return function rng(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function fxMode(mode, on){
  emit('hha:fx', { mode, on });
}

function bodyFlash(cls, ms=180){
  try{
    DOC.body.classList.add(cls);
    setTimeout(()=>DOC.body.classList.remove(cls), ms);
  }catch(_){}
}

function getView(){
  const v = String(qs('view','')||'').toLowerCase();
  if(v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;
  // if boot sets body.dataset.view, prefer it
  const dv = String(DOC.body?.dataset?.view || '').toLowerCase();
  if(dv === 'pc' || dv === 'mobile' || dv === 'vr' || dv === 'cvr') return dv;
  return 'mobile';
}

function isCvr(){ return getView() === 'cvr'; }

function el(id){ return DOC.getElementById(id); }

function setText(id, v){
  const e = el(id);
  if(e) e.textContent = String(v);
}

function setAriaHidden(id, hidden){
  const e = el(id);
  if(e) e.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function px(n){ return Math.max(0, Math.round(Number(n)||0)) + 'px'; }

function getSafeRect(){
  const root = DOC.documentElement;
  const cs = getComputedStyle(root);
  const topSafe = parseFloat(cs.getPropertyValue('--gj-top-safe')) || 140;
  const botSafe = parseFloat(cs.getPropertyValue('--gj-bottom-safe')) || 120;

  const w = root.clientWidth;
  const h = root.clientHeight;

  const pad = 10;
  return {
    x0: pad,
    y0: pad + topSafe,
    x1: w - pad,
    y1: h - pad - botSafe,
    w,
    h
  };
}

function gradeFrom(score){
  if(score >= 900) return 'S';
  if(score >= 720) return 'A';
  if(score >= 520) return 'B';
  if(score >= 320) return 'C';
  return 'D';
}

function bossHpFor(diff){
  const d = String(diff||'normal').toLowerCase();
  if(d === 'easy') return 10;
  if(d === 'hard') return 14;
  return 12;
}

function phasePattern(rng){
  // Phase styles: 0=normal,1=decoy,2=swap,3=stormburst
  const p = [0,1,2,3];
  // shuffle
  for(let i=p.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

function createTargetDom(kind, sizePx){
  const t = DOC.createElement('div');
  t.className = 'gj-target spawn';
  t.dataset.kind = kind;

  // emoji per kind
  let emoji = '🥦';
  if(kind === 'junk') emoji = '🍟';
  if(kind === 'star') emoji = '⭐';
  if(kind === 'diamond') emoji = '💎';
  if(kind === 'shield') emoji = '🛡️';

  t.textContent = emoji;
  t.style.fontSize = Math.round(sizePx) + 'px';
  return t;
}

function boot(opts={}){
  const view = String(opts.view || getView());
  const diff = String(opts.diff || qs('diff','normal'));
  const runMode = String(opts.run || qs('run','play'));
  const durationPlannedSec = clamp(opts.time ?? qs('time','80'), 20, 600);
  const seedStr = (opts.seed ?? qs('seed', null));
  const rng = makeRng(seedStr);

  const layerL = el('gj-layer');
  const layerR = el('gj-layer-r');
  if(!layerL) throw new Error('Missing #gj-layer');

  // HUD nodes exist?
  const feverFill = el('feverFill');
  const feverText = el('feverText');
  const shieldPills = el('shieldPills');

  // state
  const state = {
    startedAt: now(),
    lastTick: now(),
    ended: false,

    view,
    diff,
    runMode,
    durationPlannedSec,
    timeLeftSec: durationPlannedSec,

    score: 0,
    miss: 0,

    // fever/shield
    fever: 0,            // 0..100
    shield: 0,           // integer pills
    shieldMax: 3,

    // spawn & targets
    idSeq: 1,
    active: new Map(),   // id => target obj
    maxTargets: 10,

    // difficulty pacing
    baseLifeMs: (String(diff).toLowerCase()==='easy') ? 1400 : (String(diff).toLowerCase()==='hard' ? 980 : 1150),
    baseSize:   (String(diff).toLowerCase()==='easy') ? 78 : (String(diff).toLowerCase()==='hard' ? 60 : 68),
    spawnPerSec: (String(diff).toLowerCase()==='easy') ? 2.4 : (String(diff).toLowerCase()==='hard' ? 3.6 : 3.0),

    // threat FX states
    fxStorm: false,
    fxBoss: false,
    fxRage: false,

    // boss
    bossOn: false,
    bossHp: bossHpFor(diff),
    bossHpLeft: bossHpFor(diff),
    bossPhaseIndex: 0,
    bossPhaseUntil: 0,
    bossPattern: phasePattern(rng),

    // input
    lastShootAt: 0,
    shootCooldownMs: 85,

    // quest (simple)
    goalTitle: 'เก็บของดีให้ครบ',
    goalTarget: 18,
    goalCur: 0,

    miniTitle: 'ทำคอมโบ 5',
    miniTarget: 5,
    miniCur: 0,
    miniTimeLeftMs: 6000,
    miniTimerStart: now(),
  };

  // UI init
  setText('hud-score', state.score);
  setText('hud-miss', state.miss);
  setText('hud-time', Math.ceil(state.timeLeftSec));
  setText('hud-grade', '—');

  setText('hud-goal', state.goalTitle);
  setText('hud-goal-cur', state.goalCur);
  setText('hud-goal-target', state.goalTarget);

  setText('hud-mini', state.miniTitle);
  setText('miniTimer', '6.0s');

  if(shieldPills) shieldPills.textContent = '—';
  if(feverFill) feverFill.style.width = '0%';
  if(feverText) feverText.textContent = '0%';

  setAriaHidden('endOverlay', true);
  setAriaHidden('lowTimeOverlay', true);

  // helpers
  function updateMeters(){
    const f = clamp(state.fever, 0, 100);
    if(feverFill) feverFill.style.width = f.toFixed(0) + '%';
    if(feverText) feverText.textContent = f.toFixed(0) + '%';

    if(shieldPills){
      if(state.shield <= 0) shieldPills.textContent = '—';
      else{
        const pills = Array.from({length: state.shield}, ()=> '🛡️').join('');
        shieldPills.textContent = pills;
      }
    }
  }

  function scorePopAt(x,y,text,cls){
    const P = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles;
    if(P && P.scorePop){
      try{ P.scorePop(x,y,text,cls); }catch(_){}
    }
  }
  function burstAt(x,y,kind){
    const P = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles;
    if(P && P.burstAt){
      try{ P.burstAt(x,y,kind); }catch(_){}
    }
  }

  function addScore(delta){
    state.score = Math.max(0, state.score + (Number(delta)||0));
    setText('hud-score', state.score);
    setText('hud-grade', gradeFrom(state.score));
  }

  function addFever(delta){
    state.fever = clamp(state.fever + (Number(delta)||0), 0, 100);
    // on full fever => +shield + reset fever
    if(state.fever >= 100){
      state.fever = 0;
      state.shield = clamp(state.shield + 1, 0, state.shieldMax);
      emit('hha:judge', { label:'SHIELD +1' });
      try{
        const P = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles;
        P && P.celebrate && P.celebrate('mini');
      }catch(_){}
    }
    updateMeters();
  }

  function incMiss(reason='miss'){
    state.miss++;
    setText('hud-miss', state.miss);
    bodyFlash('gj-junk-hit', 220);
    emit('hha:judge', { label:'MISS' });

    // threat triggers will be updated in updateThreatFx()
    if(state.miss >= 5){
      // rage: bigger penalty
      addScore(-30);
    }else{
      addScore(-18);
    }
  }

  function setLowTimeOverlay(on, n){
    const o = el('lowTimeOverlay');
    if(!o) return;
    o.setAttribute('aria-hidden', on ? 'false' : 'true');
    if(on) setText('gj-lowtime-num', String(n||5));
  }

  function updateThreatFx(){
    const t = state.timeLeftSec;
    const m = state.miss;

    const wantStorm = (t <= 30);
    const wantBoss  = (m >= 4);
    const wantRage  = (m >= 5);

    if(wantStorm !== state.fxStorm){
      state.fxStorm = wantStorm;
      fxMode('storm', wantStorm);
    }
    if(wantBoss !== state.fxBoss){
      state.fxBoss = wantBoss;
      fxMode('boss', wantBoss);
      if(wantBoss) emit('hha:celebrate', { kind:'boss' });
    }
    if(wantRage !== state.fxRage){
      state.fxRage = wantRage;
      fxMode('rage', wantRage);
      if(wantRage) emit('hha:celebrate', { kind:'rage' });
    }
  }

  function startBossIfNeeded(){
    if(state.bossOn) return;
    if(state.miss < 4) return;

    state.bossOn = true;
    state.bossHpLeft = state.bossHp;
    state.bossPhaseIndex = 0;
    state.bossPattern = phasePattern(rng);

    // set first phase window
    const dur = 2000 + Math.floor(rng()*4000); // 2–6s
    state.bossPhaseUntil = now() + dur;

    emit('hha:judge', { label:'BOSS' });
  }

  function bossPhaseType(){
    // pattern cycles
    return state.bossPattern[state.bossPhaseIndex % state.bossPattern.length];
  }

  function advanceBossPhase(){
    state.bossPhaseIndex++;
    const dur = 2000 + Math.floor(rng()*4000); // 2–6s
    state.bossPhaseUntil = now() + dur;
  }

  function spawnRatePerSec(){
    let r = state.spawnPerSec;

    // threat modifiers
    if(state.fxStorm) r *= 1.18;
    if(state.fxBoss)  r *= 1.28;
    if(state.fxRage)  r *= 1.42;

    // boss extra pacing
    if(state.bossOn) r *= 1.18;

    return clamp(r, 1.6, 8.0);
  }

  function targetLifeMs(kind){
    let life = state.baseLifeMs;

    // goodies die faster in boss/rage
    if(state.fxBoss) life = Math.round(life * 0.88);
    if(state.fxRage) life = Math.round(life * 0.78);

    // specials slightly longer so kid can react
    if(kind === 'star' || kind === 'diamond' || kind === 'shield') life = Math.round(life * 1.10);

    return clamp(life, 520, 2200);
  }

  function chooseKind(){
    // base weights
    let wGood = 0.66;
    let wJunk = 0.34;

    // boss/rage => more junk pressure
    if(state.fxBoss){ wGood = 0.58; wJunk = 0.42; }
    if(state.fxRage){ wGood = 0.52; wJunk = 0.48; }

    // phase modifiers
    const phase = state.bossOn ? bossPhaseType() : 0;
    // phase 1 decoy => more junk
    if(phase === 1){ wGood -= 0.08; wJunk += 0.08; }
    // phase 2 swap => equal
    if(phase === 2){ wGood = 0.55; wJunk = 0.45; }
    // phase 3 stormburst => slightly more good but faster life (handled elsewhere)
    if(phase === 3){ wGood += 0.04; wJunk -= 0.04; }

    // specials
    const roll = rng();
    if(roll < 0.035) return 'star';
    if(roll < 0.050) return 'diamond';
    if(roll < 0.070) return 'shield';

    return (rng() < wGood) ? 'good' : 'junk';
  }

  function spawnOne(){
    if(state.ended) return;
    if(state.active.size >= state.maxTargets) return;

    const rect = getSafeRect();
    if(rect.y1 <= rect.y0 + 40 || rect.x1 <= rect.x0 + 40) return;

    const kind = chooseKind();

    // size per kind
    let size = state.baseSize;
    if(kind === 'good') size *= 1.0;
    if(kind === 'junk') size *= 1.02;
    if(kind === 'star' || kind === 'diamond' || kind === 'shield') size *= 0.92;

    // boss phase 3: smaller but faster (hard)
    const phase = state.bossOn ? bossPhaseType() : 0;
    if(phase === 3){ size *= 0.92; }

    size = clamp(size, 46, 92);

    const x = rect.x0 + rng() * (rect.x1 - rect.x0);
    const y = rect.y0 + rng() * (rect.y1 - rect.y0);

    const id = state.idSeq++;

    const elL = createTargetDom(kind, size);
    elL.style.left = px(x);
    elL.style.top  = px(y);

    const elR = createTargetDom(kind, size);
    elR.style.left = px(x + 0); // keep aligned; split view handled by css
    elR.style.top  = px(y);

    // attach (R always exists but may be aria-hidden)
    layerL.appendChild(elL);
    if(layerR) layerR.appendChild(elR);

    const bornAt = now();
    const lifeMs = targetLifeMs(kind) * (phase===3 ? 0.88 : 1);

    const obj = { id, kind, x, y, elL, elR, bornAt, lifeMs, hit:false };
    state.active.set(id, obj);

    // click on L only in pc/mobile/vr; in cvr targets not clickable by CSS
    elL.addEventListener('click', (e)=>{
      if(state.ended) return;
      if(isCvr()) return; // cVR uses hha:shoot
      onHit(id, { source:'tap', x: e.clientX, y: e.clientY });
    }, { passive:true });

    // cleanup spawn class
    setTimeout(()=>{
      try{ elL.classList.remove('spawn'); elR.classList.remove('spawn'); }catch(_){}
    }, 220);
  }

  function removeTarget(id, reason='expired'){
    const obj = state.active.get(id);
    if(!obj) return;

    state.active.delete(id);

    try{ obj.elL.classList.add('gone'); }catch(_){}
    try{ obj.elR.classList.add('gone'); }catch(_){}

    setTimeout(()=>{
      try{ obj.elL.remove(); }catch(_){}
      try{ obj.elR.remove(); }catch(_){}
    }, 180);

    // expired penalty for good only
    if(reason === 'expired' && obj.kind === 'good' && !state.ended){
      bodyFlash('gj-miss-shot', 140);
      addScore(-6);
      addFever(-2);
    }
  }

  function hitBossDamage(kind){
    // in boss mode: only good/star/diamond count as damage
    if(kind === 'good') return 1;
    if(kind === 'star') return 2;
    if(kind === 'diamond') return 3;
    return 0;
  }

  function onHit(id, meta={}){
    const obj = state.active.get(id);
    if(!obj || obj.hit || state.ended) return;
    obj.hit = true;

    // remove first
    removeTarget(id, 'hit');

    const cx = meta.x ?? Math.floor(obj.x);
    const cy = meta.y ?? Math.floor(obj.y);

    if(obj.kind === 'junk'){
      // shield blocks junk (no miss)
      if(state.shield > 0){
        state.shield--;
        updateMeters();
        emit('hha:judge', { label:'BLOCK' });
        burstAt(cx, cy, 'shield');
        scorePopAt(cx, cy-14, '+0 BLOCK', 'block');
        addFever(4);
        return;
      }
      burstAt(cx, cy, 'bad');
      scorePopAt(cx, cy-14, '- MISS', 'bad');
      incMiss('junk');
      addFever(-6);
      return;
    }

    if(obj.kind === 'star'){
      burstAt(cx, cy, 'star');
      scorePopAt(cx, cy-14, '+60', 'star');
      addScore(60);
      addFever(18);
      state.shield = clamp(state.shield + 1, 0, state.shieldMax);
      updateMeters();
      emit('hha:judge', { label:'STAR' });
    }else if(obj.kind === 'diamond'){
      burstAt(cx, cy, 'diamond');
      scorePopAt(cx, cy-14, '+90', 'diamond');
      addScore(90);
      addFever(22);
      emit('hha:judge', { label:'DIAMOND' });
    }else if(obj.kind === 'shield'){
      burstAt(cx, cy, 'shield');
      scorePopAt(cx, cy-14, '+SHIELD', 'block');
      state.shield = clamp(state.shield + 2, 0, state.shieldMax);
      updateMeters();
      addFever(10);
      emit('hha:judge', { label:'SHIELD' });
    }else{
      // good
      burstAt(cx, cy, 'good');
      scorePopAt(cx, cy-14, '+20', 'good');
      addScore(20);
      addFever(7);
      state.goalCur++;
      setText('hud-goal-cur', state.goalCur);
    }

    // boss damage
    if(state.bossOn){
      const dmg = hitBossDamage(obj.kind);
      if(dmg > 0){
        state.bossHpLeft = Math.max(0, state.bossHpLeft - dmg);
        // show boss hp via judge (light)
        emit('hha:judge', { label:`BOSS HP ${state.bossHpLeft}/${state.bossHp}` });
        if(state.bossHpLeft <= 0){
          // boss cleared => reward + exit boss
          state.bossOn = false;
          emit('hha:judge', { label:'BOSS CLEAR' });
          emit('hha:celebrate', { kind:'boss' });
          addScore(160);
          addFever(35);
        }
      }
    }

    // MINI: combo 5 (simple)
    state.miniCur++;
    if(state.miniCur >= state.miniTarget){
      state.miniCur = 0;
      // refresh mini time 6s
      state.miniTimerStart = now();
      state.miniTimeLeftMs = 6000;
      emit('hha:judge', { label:'MINI CLEAR' });
      emit('hha:celebrate', { kind:'mini' });
      bodyFlash('gj-mini-clear', 220);
      addScore(90);
      addFever(20);
    }
  }

  // cVR/VR shoot handler (aim from center)
  function shootFromCrosshair(){
    if(state.ended) return;
    const t = now();
    if(t - state.lastShootAt < state.shootCooldownMs) return;
    state.lastShootAt = t;

    const rect = getSafeRect();
    const cx = Math.floor(rect.w/2);
    const cy = Math.floor(rect.h/2);

    // find nearest target within lock radius
    const lockPx = 34;
    let bestId = null;
    let bestD2 = lockPx*lockPx;

    for(const [id, obj] of state.active){
      const dx = obj.x - cx;
      const dy = obj.y - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD2){
        bestD2 = d2;
        bestId = id;
      }
    }

    if(bestId != null){
      onHit(bestId, { source:'shoot', x: cx, y: cy });
    }else{
      // miss-shot pressure (doesn't increase miss counter, just feedback)
      bodyFlash('gj-miss-shot', 120);
      const P = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles;
      try{ P && P.scorePop && P.scorePop(cx, cy-120, 'MISS SHOT', 'bad'); }catch(_){}
    }
  }

  // listen to vr-ui shoot event if present
  ROOT.addEventListener('hha:shoot', ()=> shootFromCrosshair(), { passive:true });

  // also allow click on background in cVR to shoot (mobile tap)
  DOC.addEventListener('click', (e)=>{
    if(!isCvr()) return;
    // ignore if clicking topbar buttons
    const path = (e.composedPath && e.composedPath()) || [];
    if(path.some(n => n && n.classList && n.classList.contains('gj-btn'))) return;
    shootFromCrosshair();
  }, { passive:true });

  function end(reason='time'){
    if(state.ended) return;
    state.ended = true;

    // cleanup targets
    for(const [id] of state.active) removeTarget(id, 'end');
    state.active.clear();

    const played = Math.max(0, (now() - state.startedAt) / 1000);
    const grade = gradeFrom(state.score);

    setText('endTitle', (reason === 'missLimit') ? 'Game Over' : 'Completed');
    setText('endSub', `reason=${reason} | mode=${state.runMode} | view=${getView()}`);
    setText('endGrade', grade);
    setText('endScore', state.score);
    setText('endMiss', state.miss);
    setText('endTime', Math.round(played));

    setAriaHidden('endOverlay', false);

    emit('hha:end', {
      reason,
      runMode: state.runMode,
      device: getView(),
      diff: state.diff,
      durationPlannedSec: state.durationPlannedSec,
      durationPlayedSec: played,
      scoreFinal: state.score,
      misses: state.miss,
      grade
    });

    emit('hha:celebrate', { kind:'end', grade });
  }

  // main loop
  let spawnAcc = 0;

  function tick(){
    if(state.ended) return;

    const t = now();
    const dt = Math.min(0.05, Math.max(0.001, (t - state.lastTick) / 1000));
    state.lastTick = t;

    // time
    state.timeLeftSec = Math.max(0, state.timeLeftSec - dt);
    setText('hud-time', Math.ceil(state.timeLeftSec));

    // low time overlay (<=5s)
    if(state.timeLeftSec <= 5 && state.timeLeftSec > 0){
      setLowTimeOverlay(true, Math.ceil(state.timeLeftSec));
    }else{
      setLowTimeOverlay(false, 0);
    }

    // threat modes
    updateThreatFx();

    // boss start check
    startBossIfNeeded();

    // boss phase timing
    if(state.bossOn && t >= state.bossPhaseUntil){
      advanceBossPhase();
    }

    // mini timer display
    const miniElapsed = t - state.miniTimerStart;
    const miniLeft = Math.max(0, state.miniTimeLeftMs - miniElapsed);
    setText('miniTimer', (miniLeft/1000).toFixed(1) + 's');
    if(miniLeft <= 0){
      // mini failed -> reset streak
      state.miniCur = 0;
      state.miniTimerStart = t;
      state.miniTimeLeftMs = 6000;
      emit('hha:judge', { label:'MINI RESET' });
    }

    // spawn integrate
    const r = spawnRatePerSec();
    spawnAcc += dt * r;

    // boss phase 3 => extra burst
    const phase = state.bossOn ? bossPhaseType() : 0;
    if(state.fxStorm && rng() < 0.18) spawnAcc += 0.22;
    if(state.fxRage && rng() < 0.22) spawnAcc += 0.28;
    if(phase === 3 && rng() < 0.25) spawnAcc += 0.24;

    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
    }

    // expire targets
    const tt = t;
    for(const [id, obj] of state.active){
      if(tt - obj.bornAt >= obj.lifeMs){
        removeTarget(id, 'expired');
      }
    }

    // win/lose
    if(state.goalCur >= state.goalTarget){
      end('goalComplete');
      return;
    }
    if(state.timeLeftSec <= 0){
      end('time');
      return;
    }
    // optional: if you want gameover by misses, set threshold
    const missLimit = (String(diff).toLowerCase()==='easy') ? 10 : (String(diff).toLowerCase()==='hard' ? 14 : 12);
    if(state.miss >= missLimit){
      end('missLimit');
      return;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return { state };
}

// export for boot.js
export function boot(opts){
  return boot(opts);
}