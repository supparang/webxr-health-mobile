// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Engine — PRODUCTION (DOM targets + cVR shoot + boss + fever/shield + deterministic RNG)
// FULL v20260224c-goodjunk-safe
// ✅ export boot({ view, run, diff, time, seed, studyId, phase, conditionGroup })
// ✅ Deterministic RNG when seed provided
// ✅ MISS definition: miss = good expired + junk hit (junk blocked by shield => NOT miss)
// ✅ Supports view-cvr shooting via event 'hha:shoot' (uses elementFromPoint hit-test)
// ✅ End overlay + dispatch window event 'hha:game-ended' with summary

'use strict';

function $(sel, root=document){ return root.querySelector(sel); }

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }

function nowISO(){ try{ return new Date().toISOString(); }catch{ return String(Date.now()); } }

/* ---------- Seeded RNG (mulberry32) ---------- */
function hash32(str){
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- DOM helpers ---------- */
function safeRect(el){
  try{ return el.getBoundingClientRect(); }catch{ return {left:0,top:0,width:0,height:0,right:0,bottom:0}; }
}
function pxVar(name, fallback=0){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if(!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }catch{ return fallback; }
}
function setAriaHidden(el, hidden){
  if(!el) return;
  el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

/* ---------- Game config ---------- */
function cfgByDiff(diff){
  const d = String(diff||'normal').toLowerCase();
  if(d==='easy'){
    return {
      spawnMs: 720,
      ttlMs: 1750,
      junkRate: 0.22,
      bossEveryGood: 18,
      bossHp: 10,
      shieldStart: 2,
      feverOnJunk: 12,
      feverDecayPerSec: 3.2,
    };
  }
  if(d==='hard'){
    return {
      spawnMs: 520,
      ttlMs: 1400,
      junkRate: 0.34,
      bossEveryGood: 14,
      bossHp: 14,
      shieldStart: 1,
      feverOnJunk: 16,
      feverDecayPerSec: 2.6,
    };
  }
  return {
    spawnMs: 620,
    ttlMs: 1550,
    junkRate: 0.28,
    bossEveryGood: 16,
    bossHp: 12,
    shieldStart: 2,
    feverOnJunk: 14,
    feverDecayPerSec: 3.0,
  };
}

function gradeOf(score, miss, total){
  const acc = total>0 ? (score/Math.max(1,total)) : 0;
  if(acc>=0.88 && miss<=2) return 'S';
  if(acc>=0.76) return 'A';
  if(acc>=0.62) return 'B';
  return 'C';
}

/* ---------- Public API ---------- */
export function boot(userCfg={}){
  const view = String(userCfg.view || 'mobile').toLowerCase();
  const run  = String(userCfg.run  || 'play').toLowerCase();
  const diff = String(userCfg.diff || 'normal').toLowerCase();
  const timeSec = clamp(userCfg.time ?? 80, 20, 300);

  const seedRaw = (userCfg.seed ?? '').toString().trim();
  const seedUsed = seedRaw || String(Date.now());
  const rng = mulberry32(hash32(seedUsed));

  const C = cfgByDiff(diff);

  /* DOM refs */
  const layerL = $('#gj-layer');
  const layerR = $('#gj-layer-r');
  const endOverlay = $('#endOverlay');

  const hudScore = $('#hud-score');
  const hudTime  = $('#hud-time');
  const hudMiss  = $('#hud-miss');
  const hudGrade = $('#hud-grade');

  const hudGoal = $('#hud-goal');
  const hudGoalCur = $('#hud-goal-cur');
  const hudGoalTarget = $('#hud-goal-target');
  const goalDesc = $('#goalDesc');

  const feverFill = $('#feverFill');
  const feverText = $('#feverText');

  const shieldPills = $('#shieldPills');

  const bossBar = $('#bossBar');
  const bossFill = $('#bossFill');
  const bossHint = $('#bossHint');

  const lowTimeOverlay = $('#lowTimeOverlay');
  const lowTimeNum = $('#gj-lowtime-num');

  const progressFill = $('#gjProgressFill');

  const endTitle = $('#endTitle');
  const endSub   = $('#endSub');
  const endGrade = $('#endGrade');
  const endScore = $('#endScore');
  const endMiss  = $('#endMiss');
  const endTime  = $('#endTime');

  if(!layerL){
    console.error('[GoodJunk] Missing #gj-layer');
    return;
  }

  /* view flags */
  const isCVR = view.includes('cvr') || view.includes('cardboard');
  document.body.classList.toggle('view-cvr', !!isCVR);

  /* State (exposed for debug in HTML) */
  const S = {
    startedAt: performance.now(),
    ended: false,
    timeLeft: timeSec,
    score: 0,
    miss: 0,
    total: 0,
    fever: 0,            // 0..100
    shield: C.shieldStart,
    boss: null,          // {hp,max,active,hits}
    goodHits: 0,
    targets: new Map(),  // id -> {el, kind, born, ttl, x, y}
    nextId: 1,
    lastSpawnAt: 0,
    lastTickAt: performance.now(),
    lastSecondShown: -1,
    seed: seedUsed,
    diff, run, view,
  };
  window.__GJ_STATE__ = S;

  /* Goal (simple + readable) */
  const goalTarget = (diff==='easy') ? 20 : (diff==='hard') ? 28 : 24;
  const goalName = 'GOOD HITS';
  const goalText = 'เก็บของดีให้ถึงเป้า (ระวังของ junk)';
  if(hudGoal) hudGoal.textContent = goalName;
  if(goalDesc) goalDesc.textContent = goalText;
  if(hudGoalTarget) hudGoalTarget.textContent = String(goalTarget);

  /* Spawn safe zone from CSS vars (fallback ok) */
  function spawnBounds(){
    const r = safeRect(layerL);
    const topPad  = pxVar('--spawn-top', 140);
    const botPad  = pxVar('--spawn-bot', 110);
    const sidePad = pxVar('--spawn-side', 14);

    const x0 = r.left + sidePad;
    const x1 = r.left + Math.max(sidePad+40, r.width - sidePad);
    const y0 = r.top + topPad;
    const y1 = r.top + Math.max(topPad+40, r.height - botPad);

    return { r, x0, x1, y0, y1 };
  }

  /* Render helpers */
  function setHUD(){
    if(hudScore) hudScore.textContent = String(S.score);
    if(hudMiss)  hudMiss.textContent  = String(S.miss);

    const t = Math.max(0, S.timeLeft);
    const sec = Math.ceil(t);
    if(hudTime) hudTime.textContent = String(sec);

    const grade = gradeOf(S.score, S.miss, S.total);
    if(hudGrade) hudGrade.textContent = grade;

    if(hudGoalCur) hudGoalCur.textContent = String(S.goodHits);

    if(progressFill){
      const p = 1 - (t / timeSec);
      progressFill.style.width = `${clamp(p*100, 0, 100)}%`;
    }

    if(feverFill) feverFill.style.width = `${clamp(S.fever, 0, 100)}%`;
    if(feverText) feverText.textContent = `${Math.round(clamp(S.fever, 0, 100))}%`;

    if(shieldPills){
      shieldPills.textContent = S.shield>0 ? '🛡️'.repeat(Math.min(6, S.shield)) : '—';
    }

    if(lowTimeOverlay && lowTimeNum){
      const on = (S.timeLeft <= 5 && S.timeLeft > 0);
      setAriaHidden(lowTimeOverlay, !on);
      if(on) lowTimeNum.textContent = String(Math.ceil(S.timeLeft));
    }
  }

  function showBossBar(show){
    if(!bossBar) return;
    setAriaHidden(bossBar, !show);
  }

  function setBoss(hp, max, hint=''){
    S.boss = { hp, max, active:true, hits:0 };
    showBossBar(true);
    if(bossFill) bossFill.style.width = `${clamp((hp/max)*100, 0, 100)}%`;
    if(bossHint) bossHint.textContent = hint || 'ตี BOSS ให้ครบ';
  }

  function updateBossUI(){
    if(!S.boss || !S.boss.active){ showBossBar(false); return; }
    const {hp,max} = S.boss;
    if(bossFill) bossFill.style.width = `${clamp((hp/max)*100, 0, 100)}%`;
    if(bossHint) bossHint.textContent = `HP ${hp}/${max}`;
  }

  function clearAllTargets(){
    for(const [id, t] of S.targets){
      try{ t.el.remove(); }catch{}
    }
    S.targets.clear();
  }

  function makeTarget(kind, x, y, emo){
    const el = document.createElement('div');
    el.className = 'gj-target';
    el.dataset.kind = kind;
    el.dataset.id = String(S.nextId);

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    // size tuning (feels gamey)
    const base = (kind==='boss') ? 74 : 56;
    const wobble = (rng()*10 - 5);
    el.style.fontSize = `${base + wobble}px`;

    el.textContent = emo;

    const id = S.nextId++;
    const born = performance.now();
    const ttl  = (kind==='boss') ? 999999 : C.ttlMs;

    S.targets.set(id, { el, kind, born, ttl, x, y });

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      hitByElement(el, {clientX: ev.clientX, clientY: ev.clientY});
    }, {passive:false});

    layerL.appendChild(el);
    return id;
  }

  function randomEmoji(kind){
    if(kind==='good'){
      const list = ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑'];
      return list[(rng()*list.length)|0];
    }
    if(kind==='junk'){
      const list = ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭'];
      return list[(rng()*list.length)|0];
    }
    return '👹';
  }

  function spawnOne(){
    if(S.ended) return;

    // boss gate
    if(!S.boss?.active && S.goodHits>0 && (S.goodHits % C.bossEveryGood === 0)){
      const b = spawnBounds();
      const x = b.x0 + (rng()*(b.x1-b.x0));
      const y = b.y0 + (rng()*(b.y1-b.y0));
      makeTarget('boss', x, y, randomEmoji('boss'));
      setBoss(C.bossHp, C.bossHp, 'BOSS โผล่! ตีให้ครบ');
      return;
    }

    const kind = (rng() < C.junkRate) ? 'junk' : 'good';
    const b = spawnBounds();
    const x = b.x0 + (rng()*(b.x1-b.x0));
    const y = b.y0 + (rng()*(b.y1-b.y0));
    makeTarget(kind, x, y, randomEmoji(kind));
  }

  function expireTargets(now){
    for(const [id, t] of S.targets){
      if(t.kind==='boss') continue;
      if(now - t.born >= t.ttl){
        // good expiring counts miss; junk expiring does not
        if(t.kind==='good'){
          S.miss += 1;
          S.total += 1;
        }
        try{
          t.el.classList.add('is-dying');
          setTimeout(()=>{ try{ t.el.remove(); }catch{} }, 160);
        }catch{}
        S.targets.delete(id);
      }
    }
  }

  function findIdByEl(el){
    const s = el?.dataset?.id;
    const id = Number(s);
    return Number.isFinite(id) ? id : null;
  }

  function hitByElement(el, pos){
    if(S.ended) return;
    if(!el) return;

    const id = findIdByEl(el);
    if(id==null) return;

    const t = S.targets.get(id);
    if(!t) return;

    // visual hit
    try{ el.classList.add('is-hit'); setTimeout(()=>el.classList.remove('is-hit'), 120); }catch{}

    if(t.kind === 'good'){
      S.score += 1;
      S.total += 1;
      S.goodHits += 1;

      // tiny fever reward for good play (keeps action)
      S.fever = clamp(S.fever + 3.5, 0, 100);

      // remove
      S.targets.delete(id);
      try{ el.classList.add('is-dying'); setTimeout(()=>{ try{ el.remove(); }catch{} }, 160); }catch{}

      // boss trigger: if boss currently active and element is boss, handled below
    }
    else if(t.kind === 'junk'){
      S.total += 1;

      // shield blocks junk hit => no miss
      if(S.shield > 0){
        S.shield -= 1;
        // still remove the junk
        S.targets.delete(id);
        try{ el.classList.add('is-dying'); setTimeout(()=>{ try{ el.remove(); }catch{} }, 160); }catch{}
      }else{
        // counts miss (junk hit)
        S.miss += 1;
        S.fever = clamp(S.fever + C.feverOnJunk, 0, 100);

        S.targets.delete(id);
        try{ el.classList.add('is-dying'); setTimeout(()=>{ try{ el.remove(); }catch{} }, 160); }catch{}
      }
    }
    else if(t.kind === 'boss'){
      // boss needs multiple hits
      if(!S.boss?.active){
        // safety: if boss state missing, create one
        setBoss(C.bossHp, C.bossHp, 'BOSS');
      }
      S.total += 1;
      S.score += 1;

      S.boss.hits += 1;
      S.boss.hp = Math.max(0, S.boss.hp - 1);

      if(S.boss.hp <= 0){
        S.boss.active = false;
        showBossBar(false);

        // reward: shield + fever
        S.shield += 1;
        S.fever = clamp(S.fever + 10, 0, 100);

        // remove boss target
        S.targets.delete(id);
        try{ el.classList.add('is-dying'); setTimeout(()=>{ try{ el.remove(); }catch{} }, 160); }catch{}
      }else{
        updateBossUI();
      }
    }

    // win condition hint (not force stop; still play until time)
    setHUD();
  }

  /* cVR shoot handler: hit-test by screen point */
  function hitByPoint(x, y){
    if(S.ended) return;
    x = Number(x); y = Number(y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let el = null;
    try{
      el = document.elementFromPoint(x, y);
    }catch(e){ el = null; }

    if(!el) return;

    const tgt = el.closest ? el.closest('.gj-target') : null;
    if(tgt) hitByElement(tgt, {clientX:x, clientY:y});
  }

  function onShoot(ev){
    // expected: ev.detail = { x, y, lockPx? } OR {clientX, clientY}
    const d = ev?.detail || {};
    const x = d.x ?? d.clientX;
    const y = d.y ?? d.clientY;

    if(Number.isFinite(Number(x)) && Number.isFinite(Number(y))){
      hitByPoint(Number(x), Number(y));
      return;
    }
    // fallback to center
    hitByPoint(window.innerWidth/2, window.innerHeight/2);
  }

  /* main pointer fallback: tap anywhere => try hit top-most target under pointer */
  function onStagePointer(ev){
    if(S.ended) return;
    // if tapped empty, no penalty; just attempt hit
    hitByPoint(ev.clientX, ev.clientY);
  }

  /* Fever decay + time */
  function tick(){
    if(S.ended) return;

    const now = performance.now();
    const dt = Math.min(0.25, (now - S.lastTickAt)/1000);
    S.lastTickAt = now;

    // time
    S.timeLeft = Math.max(0, S.timeLeft - dt);

    // fever decay
    S.fever = clamp(S.fever - (C.feverDecayPerSec * dt), 0, 100);

    // spawn
    if(now - S.lastSpawnAt >= C.spawnMs){
      S.lastSpawnAt = now;
      spawnOne();
      // spawn spice: fever high => slightly more spawns
      if(S.fever >= 70 && rng() < 0.25) spawnOne();
    }

    // expire
    expireTargets(now);

    // goal tick
    if(hudGoalCur) hudGoalCur.textContent = String(S.goodHits);

    // update HUD (but not every frame heavy)
    setHUD();

    // end
    if(S.timeLeft <= 0){
      endGame('timeup');
      return;
    }

    requestAnimationFrame(tick);
  }

  function buildSummary(reason){
    const grade = gradeOf(S.score, S.miss, S.total);
    const playedSec = Math.round(timeSec - Math.max(0, S.timeLeft));
    const acc = (S.total>0) ? (S.score/Math.max(1,S.total)) : 0;

    return {
      ok: true,
      game: 'goodjunk',
      ts: nowISO(),
      reason: reason || 'end',
      run: S.run,
      view: S.view,
      diff: S.diff,
      seed: S.seed,
      time: timeSec,
      playedSec,
      score: S.score,
      miss: S.miss,
      total: S.total,
      goodHits: S.goodHits,
      goalTarget,
      goalMet: (S.goodHits >= goalTarget),
      feverEnd: Math.round(S.fever),
      shieldEnd: S.shield,
      grade,
      acc: Math.round(acc*1000)/10, // percent with 0.1
      studyId: userCfg.studyId ?? null,
      phase: userCfg.phase ?? null,
      conditionGroup: userCfg.conditionGroup ?? null,
    };
  }

  function showEnd(summary){
    if(!endOverlay) return;

    if(endTitle) endTitle.textContent = (summary.goalMet ? 'Completed ✅' : 'Finished');
    if(endSub)   endSub.textContent   = `seed=${summary.seed} • diff=${summary.diff} • view=${summary.view} • run=${summary.run}`;
    if(endGrade) endGrade.textContent = summary.grade;
    if(endScore) endScore.textContent = String(summary.score);
    if(endMiss)  endMiss.textContent  = String(summary.miss);
    if(endTime)  endTime.textContent  = String(summary.playedSec);

    setAriaHidden(endOverlay, false);
  }

  function dispatchEnded(summary){
    try{
      window.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary }));
    }catch(e){}
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended = true;

    clearAllTargets();
    showBossBar(false);

    const summary = buildSummary(reason);
    showEnd(summary);
    dispatchEnded(summary);
  }

  /* ---------- Wire events ---------- */
  // pointer on layer
  layerL.addEventListener('pointerdown', onStagePointer, {passive:true});

  // cVR shoot event from universal vr-ui.js
  window.addEventListener('hha:shoot', onShoot);

  // if tab hidden, end gracefully (prevents stuck sessions)
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden && !S.ended) endGame('hidden');
  });

  // init UI
  setAriaHidden(endOverlay, true);
  setAriaHidden(lowTimeOverlay, true);
  showBossBar(false);

  S.timeLeft = timeSec;
  S.lastSpawnAt = performance.now();
  S.lastTickAt = performance.now();
  setHUD();

  // start loop
  requestAnimationFrame(tick);
}