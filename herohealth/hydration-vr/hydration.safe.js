// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE — PRODUCTION (HHA Standard) — FULL (PACK 1–10)
// PATCH v20260216c
// --------------------------------------------------------------
// ✅ PACK 1  Core loop + seeded RNG (research deterministic) + adaptive (play)
// ✅ PACK 2  WaterPct + Zones (LOW/GREEN/HIGH) + drift + safe return (fix stuck out of green)
// ✅ PACK 3  STORM Gate: must leave GREEN to LOW/HIGH before storm can start
// ✅ PACK 4  Shield system: collect 🛡, STORM ⚡ can be hit ONLY if shield>0 (consumes shield)
// ✅ PACK 5  Storm cycles + Storm level increases lightning count/density
// ✅ PACK 6  Boss 3 phases (action boss) + progress hooks + tuning
// ✅ PACK 7  HUD wiring + overlay/result wiring + gate flow compatible (emit hha:end)
// ✅ PACK 8  cVR shoot support (hha:shoot lockPx) + tap reliability guard
// ✅ PACK 9  AI prediction/ML hooks scaffold (features/event attach point; NO ML by default)
// ✅ PACK 10 CSV/JSON export + flush-hardened summary + badge hooks (optional)
//
// PATCH highlights:
// ✅ FIX: prevent hha:start recursion loop (engine NO LONGER emits hha:start)
// ✅ ADD: HUD-safe spawn using layer rect + occlusion guard (HUD/Quest/Overlays/VRUI)
// ✅ ADD: timeout miss counted only if target center NOT under occluders (Groups-like)

// Requires ids in RUN HTML:
// layer: hydration-layer
// HUD: water-pct, water-zone, water-bar
// stats: stat-score, stat-combo, stat-miss, stat-time, stat-grade
// quest: quest-line1..4, storm-left, shield-count
// result: resultBackdrop, rScore rGrade rAcc rComboMax rMiss rTier rGoals rMinis rTips rNext
// buttons: btnRetry btnCopyJSON btnDownloadCSV btnCloseSummary (optional)
//
// Emits: hha:score, hha:time, hha:judge, hha:end
// Extra emits: hydration:state, hydration:progress, hydration:storm

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function nowIso(){ try{ return new Date().toISOString(); }catch{ return ''; } }
function copyText(text){ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}

// ---- Minimal AI hook attach point (optional) ----
function getAIHooks({gameId, seed, runMode, diff}){
  try{
    if(WIN.HHA && typeof WIN.HHA.createAIHooks === 'function'){
      const h = WIN.HHA.createAIHooks({ gameId, seed, runMode, diff });
      if(h) return {
        predict: typeof h.predict === 'function' ? h.predict : null,
        onEvent: typeof h.onEvent === 'function' ? h.onEvent : null,
        getSummaryExtras: typeof h.getSummaryExtras === 'function' ? h.getSummaryExtras : null
      };
    }
  }catch(_){}
  return { predict:null, onEvent:null, getSummaryExtras:null };
}

// -----------------------------
// CONFIG
// -----------------------------
const ZONE = {
  LOW_MAX: 35,
  GREEN_MIN: 40,
  GREEN_MAX: 70,
  HIGH_MIN: 75,
};

const ICON = {
  DROP: '💧',
  SHIELD: '🛡',
  LIGHT: '⚡',
  HEAL: '🟢',
  OVER: '🟠',
  ALERT: '🚨',
  BOSS: '👾'
};

const LIMIT = {
  maxTargets: 16,
  ttlMs: 5200,
  tapGuardMs: 120,
  spawnMaxPerFrame: 5,
  spawnTry: 18,          // attempts to find safe spot
  occludePad: 6
};

// difficulty base (per sec)
function baseParams(diff){
  if(diff==='easy') return {
    driftPerSec: 2.4,
    spawnPerSec: 2.0,
    dropValue: 5.5,
    shieldRate: 0.12,
    stormGateSec: 3.2,
    stormBaseLightning: 4,
    stormTimeLimitSec: 7.5,
    bossAfterStorms: 2,
  };
  if(diff==='hard') return {
    driftPerSec: 3.4,
    spawnPerSec: 2.8,
    dropValue: 4.8,
    shieldRate: 0.09,
    stormGateSec: 2.4,
    stormBaseLightning: 6,
    stormTimeLimitSec: 7.0,
    bossAfterStorms: 2,
  };
  return {
    driftPerSec: 3.0,
    spawnPerSec: 2.4,
    dropValue: 5.1,
    shieldRate: 0.10,
    stormGateSec: 2.8,
    stormBaseLightning: 5,
    stormTimeLimitSec: 7.2,
    bossAfterStorms: 2,
  };
}

function gradeFrom(accuracy, stormPass, comboMax){
  const a = accuracy;
  if(a>=0.92 && stormPass>=2 && comboMax>=12) return 'SSS';
  if(a>=0.86 && stormPass>=1 && comboMax>=10) return 'SS';
  if(a>=0.78) return 'S';
  if(a>=0.68) return 'A';
  if(a>=0.56) return 'B';
  return 'C';
}

// -----------------------------
// DOM helpers
// -----------------------------
function $(id){ return DOC.getElementById(id); }
function setText(id, v){ const el=$(id); if(el) el.textContent = String(v); }
function setPctBar(id, pct){
  const el=$(id);
  if(el) el.style.width = clamp(pct,0,100).toFixed(0)+'%';
}

function ensureBossUI(){
  if($('bossWrap')) return;
  const cards = DOC.querySelectorAll('.hud .card');
  const statsCard = cards && cards[1] ? cards[1] : null;
  if(!statsCard) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'bossWrap';
  wrap.style.marginTop = '10px';
  wrap.style.pointerEvents = 'none';

  wrap.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <span class="pill" style="border-color:rgba(168,85,247,.22);background:rgba(168,85,247,.10);">
        ${ICON.BOSS} Boss: <b id="bossPhase">—</b>
      </span>
      <div class="bar" style="min-width:160px;">
        <i id="bossBar" style="width:0%;background:rgba(168,85,247,.55)"></i>
      </div>
      <span class="pill" style="opacity:.9;">HP: <b id="bossHpTxt">0</b></span>
    </div>
  `;
  statsCard.appendChild(wrap);
}

// -----------------------------
// Occlusion / HUD-safe spawn (Groups-like)
// -----------------------------
function rectOf(el){
  try{
    if(!el) return null;
    const r = el.getBoundingClientRect();
    if(!r || !Number.isFinite(r.left)) return null;
    if(r.width<=0 || r.height<=0) return null;
    return r;
  }catch(_){ return null; }
}
function isShown(el){
  if(!el) return false;
  if(el.hidden) return false;
  const st = WIN.getComputedStyle ? WIN.getComputedStyle(el) : null;
  if(st && (st.display==='none' || st.visibility==='hidden' || st.opacity==='0')) return false;
  return true;
}
function pointInRect(x,y,r,pad=0){
  if(!r) return false;
  return (x >= r.left+pad && x <= r.right-pad && y >= r.top+pad && y <= r.bottom-pad);
}
function occluderRects(){
  const list = [];
  // HUD + Quest (your RUN uses .hud, .quest)
  const hud = DOC.querySelector('.hud');
  const quest = DOC.querySelector('.quest');
  const startOv = $('startOverlay');
  const result = $('resultBackdrop');

  if(isShown(hud)) list.push(rectOf(hud));
  if(isShown(quest)) list.push(rectOf(quest));
  if(isShown(startOv)) list.push(rectOf(startOv));
  if(isShown(result)) list.push(rectOf(result));

  // Try common VR-UI containers (best-effort)
  const vrCandidates = DOC.querySelectorAll('[id*="vrui"], [class*="vrui"], [id*="vr-ui"], [class*="vr-ui"]');
  vrCandidates.forEach(el=>{
    if(isShown(el)) list.push(rectOf(el));
  });

  return list.filter(Boolean);
}
function isOccludedPoint(x,y,pad=LIMIT.occludePad){
  const rects = occluderRects();
  for(const r of rects){
    if(pointInRect(x,y,r,pad)) return true;
  }
  return false;
}

// -----------------------------
// Target system
// -----------------------------
function getSpawnRect(layer){
  const lr = rectOf(layer);
  const w = Math.max(1, WIN.innerWidth||1);
  const h = Math.max(1, WIN.innerHeight||1);

  // Prefer layer rect. Fall back to viewport.
  const L = lr ? { left: lr.left, top: lr.top, right: lr.right, bottom: lr.bottom } : { left:0, top:0, right:w, bottom:h };

  // dynamic safe boundaries based on HUD & Quest
  const hud = DOC.querySelector('.hud');
  const quest = DOC.querySelector('.quest');

  const hudR = isShown(hud) ? rectOf(hud) : null;
  const questR = isShown(quest) ? rectOf(quest) : null;

  const pad = 14;

  let x0 = L.left + pad;
  let x1 = L.right - pad;

  let y0 = L.top + pad;
  let y1 = L.bottom - pad;

  if(hudR) y0 = Math.max(y0, hudR.bottom + 10);
  if(questR) y1 = Math.min(y1, questR.top - 10);

  // Keep a minimum vertical play space
  const minH = 140;
  if(y1 - y0 < minH){
    // fallback to something usable inside layer
    y0 = Math.min(L.bottom - minH - pad, y0);
    y1 = y0 + minH;
  }

  // clamp
  x0 = clamp(x0, 0, w-60);
  x1 = clamp(x1, x0+60, w);
  y0 = clamp(y0, 0, h-90);
  y1 = clamp(y1, y0+70, h);

  return { x0, x1, y0, y1, w, h };
}

function makeTargetEl(kind, emoji){
  const el = DOC.createElement('button');
  el.type='button';
  el.className = 'h2o-tgt '+kind;
  el.style.position='absolute';
  el.style.left='0'; el.style.top='0';
  el.style.transform='translate(-50%,-50%)';
  el.style.border='1px solid rgba(148,163,184,.16)';
  el.style.background='rgba(15,23,42,.62)';
  el.style.color='#e5e7eb';
  el.style.borderRadius='999px';
  el.style.width='54px';
  el.style.height='54px';
  el.style.display='flex';
  el.style.alignItems='center';
  el.style.justifyContent='center';
  el.style.fontSize='22px';
  el.style.cursor='pointer';
  el.style.userSelect='none';
  el.style.touchAction='manipulation';
  el.innerHTML = `<span>${emoji}</span>`;
  return el;
}

function fxShock(x,y){
  const layer = $('hydration-layer');
  if(!layer) return;
  const d = DOC.createElement('div');
  d.className = 'hha-shock';
  d.style.setProperty('--x', x+'px');
  d.style.setProperty('--y', y+'px');
  layer.appendChild(d);
  setTimeout(()=>{ try{ d.remove(); }catch{} }, 800);
}

// -----------------------------
// Engine
// -----------------------------
(function hydrationEngine(){
  const layer = $('hydration-layer');
  if(!layer){
    console.warn('[Hydration] hydration-layer not found');
    return;
  }
  ensureBossUI();

  // result UI
  const resultBackdrop = $('resultBackdrop');
  const rTips = $('rTips');

  // buttons
  const btnRetry = $('btnRetry');
  const btnCopyJSON = $('btnCopyJSON');
  const btnDownloadCSV = $('btnDownloadCSV');
  const btnCloseSummary = $('btnCloseSummary');

  // Params
  let runMode = 'play';
  let diff = 'normal';
  let view = 'pc';
  let seed = 0;
  let timePlannedSec = 70;

  // RNG + AI
  let rng = makeRNG(Date.now());
  let ai = getAIHooks({gameId:'hydration', seed:0, runMode:'play', diff:'normal'});

  // state
  let running=false, paused=false;
  let tStart=0, tLast=0;
  let timeLeft=0;

  let score=0;
  let combo=0, comboMax=0;
  let miss=0;
  let shots=0, hits=0;

  let waterPct = 50;
  let zoneName = 'GREEN';

  // storm
  let outGreenSec = 0;
  let stormActive = false;
  let stormLevel = 0;
  let stormCycles = 0;
  let stormNeed = 0;
  let stormHit = 0;
  let stormTimer = 0;
  let stormOK = 0;

  // shield
  let shield = 0;

  // boss
  let bossActive = false;
  let bossPhase = 0;
  let bossHp = 0;
  let bossHpMax = 0;

  // spawner
  let spawnAcc = 0;

  // targets
  const targets = []; // {id, el, kind, born, x,y, dead, value}
  let nextId=1;

  // log for CSV
  const events = []; // {t,type,a,b,c}
  function logEv(type, a='', b='', c=''){
    events.push({ t: Math.max(0, (nowMs()-tStart)/1000).toFixed(3), type, a, b, c });
  }

  // dynamic params (adaptive in play)
  let _base = baseParams('normal');
  let _adaptive = { spawnPerSecMul:1, driftMul:1, shieldRateMul:1 };
  function params(){
    const p = _base;
    return {
      driftPerSec: p.driftPerSec * _adaptive.driftMul,
      spawnPerSec: p.spawnPerSec * _adaptive.spawnPerSecMul,
      dropValue: p.dropValue,
      shieldRate: p.shieldRate * _adaptive.shieldRateMul,
      stormGateSec: p.stormGateSec,
      stormBaseLightning: p.stormBaseLightning,
      stormTimeLimitSec: p.stormTimeLimitSec,
      bossAfterStorms: p.bossAfterStorms
    };
  }

  function setHUD(){
    setText('water-pct', clamp(waterPct,0,100).toFixed(0));
    setText('water-zone', zoneName);
    setPctBar('water-bar', waterPct);

    setText('stat-score', score|0);
    setText('stat-combo', combo|0);
    setText('stat-miss', miss|0);
    setText('stat-time', Math.max(0, Math.ceil(timeLeft))|0);

    const acc = shots ? (hits/shots) : 0;
    const g = gradeFrom(acc, stormOK, comboMax);
    setText('stat-grade', g);

    setText('quest-line1', `คุมให้อยู่โซน GREEN ให้นานที่สุด`);
    setText('quest-line2', `ตอนนี้: โซน ${zoneName} • Shield ${shield}`);
    setText('quest-line3', `Storm cycles: ${stormCycles} | Storm OK: ${stormOK} | Level: ${stormLevel}`);
    setText('quest-line4', `ComboMax: ${comboMax} • Acc ${(acc*100).toFixed(0)}%`);

    setText('storm-left', stormActive ? String(Math.max(0, stormNeed - stormHit)) : '0');
    setText('shield-count', String(shield));

    if($('bossPhase')) $('bossPhase').textContent = bossActive ? String(bossPhase) : '—';
    if($('bossHpTxt')) $('bossHpTxt').textContent = bossActive ? String(bossHp) : '0';
    if($('bossBar')) $('bossBar').style.width = bossActive ? (100*(bossHp/Math.max(1,bossHpMax))).toFixed(0)+'%' : '0%';

    emit('hydration:progress', {
      waterPct, zoneName, score, combo, comboMax, miss,
      stormActive, stormLevel, stormCycles, stormOK,
      bossActive, bossPhase, bossHp, bossHpMax,
      timeLeft
    });
  }

  function zoneFromPct(p){
    if(p < ZONE.LOW_MAX) return 'LOW';
    if(p >= ZONE.GREEN_MIN && p <= ZONE.GREEN_MAX) return 'GREEN';
    if(p >= ZONE.HIGH_MIN) return 'HIGH';
    return (p < ZONE.GREEN_MIN) ? 'LOW' : 'HIGH';
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el.remove(); }catch{}
    }
  }

  function killTarget(obj){
    if(!obj || obj.dead) return;
    obj.dead = true;
    try{ obj.el.style.pointerEvents='none'; }catch{}
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    try{ obj.el.remove(); }catch{}
  }

  function shouldTimeoutCountMiss(obj){
    // Count timeout miss only for "player-relevant" targets (not shield)
    // and only if the target was NOT under occluders when it expired.
    if(!obj || obj.dead) return false;
    if(obj.kind === 'shield') return false;

    const occluded = isOccludedPoint(obj.x, obj.y, LIMIT.occludePad);
    if(occluded) return false;

    // Don’t punish lightning timeouts too harshly (storm already pressured)
    if(obj.kind === 'light') return false;

    // Drops/fixes/boss tokens count
    return (obj.kind === 'drop' || obj.kind === 'fixLow' || obj.kind === 'fixHigh' || obj.kind === 'boss');
  }

  function cleanupTargets(){
    const t = nowMs();
    for(let i=targets.length-1;i>=0;i--){
      const obj = targets[i];
      if(obj.dead){ targets.splice(i,1); continue; }
      if((t - obj.born) > LIMIT.ttlMs){
        // timeout miss (Groups-like occlusion guard)
        if(running && !paused && shouldTimeoutCountMiss(obj)){
          miss++;
          combo = 0;
          logEv('timeout_miss', obj.kind, zoneName, stormActive?'storm':(bossActive?'boss':''));
        }else{
          logEv('timeout_drop', obj.kind, '', '');
        }
        killTarget(obj);
      }
    }
    if(targets.length > LIMIT.maxTargets){
      let extra = targets.length - LIMIT.maxTargets;
      while(extra-- > 0 && targets.length){
        let oldest = targets[0];
        for(let k=1;k<targets.length;k++){
          if(targets[k].born < oldest.born) oldest = targets[k];
        }
        killTarget(oldest);
      }
    }
  }

  function pickSafeXY(){
    const rect = getSpawnRect(layer);
    for(let i=0;i<LIMIT.spawnTry;i++){
      const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
      const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);
      if(!isOccludedPoint(x,y, LIMIT.occludePad)) return {x,y};
    }
    // fallback: center-ish inside rect
    return { x: (rect.x0+rect.x1)/2, y: (rect.y0+rect.y1)/2 };
  }

  function spawn(kind){
    const {x,y} = pickSafeXY();

    let emoji = ICON.DROP;
    let value = 0;

    if(kind==='drop'){ emoji = ICON.DROP; value = +params().dropValue; }
    else if(kind==='shield'){ emoji = ICON.SHIELD; value = 1; }
    else if(kind==='light'){ emoji = ICON.LIGHT; value = 1; }
    else if(kind==='fixLow'){ emoji = ICON.HEAL; value = +params().dropValue*1.15; }
    else if(kind==='fixHigh'){ emoji = ICON.OVER; value = -params().dropValue*1.15; }
    else if(kind==='boss'){ emoji = ICON.BOSS; value = 1; }

    const el = makeTargetEl(kind, emoji);
    el.dataset.id = String(nextId);
    el.style.left = x+'px';
    el.style.top = y+'px';
    layer.appendChild(el);

    const obj = { id: nextId++, el, kind, born: nowMs(), x, y, dead:false, value, _lastTap:0 };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('pointerdown', (ev)=>{
        if(!running || paused || obj.dead) return;
        const t = nowMs();
        if(obj._lastTap && (t - obj._lastTap) < LIMIT.tapGuardMs) return;
        obj._lastTap = t;
        try{ ev.preventDefault(); }catch{}
        judgeHit(obj, 'tap', null);
      }, {passive:false});
    }

    return obj;
  }

  function applyAdaptive(){
    if(runMode !== 'play') return;
    const acc = shots ? (hits/shots) : 1;

    if(acc > 0.85 && comboMax >= 8){
      _adaptive.spawnPerSecMul = clamp(_adaptive.spawnPerSecMul + 0.04, 1.0, 1.35);
      _adaptive.driftMul = clamp(_adaptive.driftMul + 0.03, 1.0, 1.30);
    }else if(acc < 0.55 || miss >= 6){
      _adaptive.spawnPerSecMul = clamp(_adaptive.spawnPerSecMul - 0.05, 0.85, 1.25);
      _adaptive.driftMul = clamp(_adaptive.driftMul - 0.04, 0.85, 1.20);
    }
  }

  function startStorm(){
    if(stormActive || bossActive) return;
    stormActive = true;
    stormLevel = Math.min(9, stormLevel + 1);
    stormCycles++;
    stormHit = 0;

    stormNeed = params().stormBaseLightning + Math.floor(stormLevel*1.2);
    stormTimer = params().stormTimeLimitSec + Math.max(0, 1.0 - stormLevel*0.05);

    logEv('storm_start', stormLevel, stormNeed, zoneName);
    emit('hydration:storm', { action:'start', stormLevel, stormNeed });

    DOC.body.classList.add('hha-bossfx');
    setTimeout(()=>DOC.body.classList.remove('hha-bossfx'), 650);

    for(let i=0;i<Math.min(6, stormNeed);i++){
      spawn('light');
    }
  }

  function endStorm(passed){
    if(!stormActive) return;
    stormActive = false;
    outGreenSec = 0;
    stormTimer = 0;

    if(passed){
      stormOK++;
      score += 30 + stormLevel*8;
      combo += 2;
      comboMax = Math.max(comboMax, combo);
      logEv('storm_pass', stormLevel, stormNeed, '');
      emit('hydration:storm', { action:'pass', stormLevel, stormNeed });
    }else{
      miss += 2;
      combo = 0;
      logEv('storm_fail', stormLevel, stormNeed, '');
      emit('hydration:storm', { action:'fail', stormLevel, stormNeed });
    }

    const target = 55;
    const pull = (target - waterPct) * 0.35;
    waterPct = clamp(waterPct + pull, 0, 100);

    if(stormOK >= params().bossAfterStorms && !bossActive){
      startBoss();
    }

    setHUD();
  }

  function startBoss(){
    bossActive = true;
    bossPhase = 1;
    bossHpMax = 14 + stormLevel*3;
    bossHp = bossHpMax;

    logEv('boss_start', stormLevel, bossHpMax, '');
    emit('hydration:state', { bossActive:true, bossPhase });

    DOC.body.classList.add('hha-bossfx');
    setTimeout(()=>DOC.body.classList.remove('hha-bossfx'), 900);

    for(let i=0;i<3;i++) spawn('boss');
  }

  function stepBossPhaseIfNeeded(){
    if(!bossActive) return;
    const hpPct = bossHp / Math.max(1, bossHpMax);

    if(bossPhase===1 && hpPct <= 0.66){
      bossPhase = 2;
      logEv('boss_phase', 2, '', '');
      for(let i=0;i<2;i++) spawn('light');
      if(rng() < 0.7) spawn('shield');
    }else if(bossPhase===2 && hpPct <= 0.33){
      bossPhase = 3;
      logEv('boss_phase', 3, '', '');
      for(let i=0;i<3;i++) spawn('light');
      spawn('shield');
    }

    if(bossHp <= 0){
      bossActive = false;
      logEv('boss_defeat', stormLevel, '', '');

      score += 120 + stormLevel*20;
      combo += 4;
      comboMax = Math.max(comboMax, combo);

      DOC.body.classList.add('hha-endfx');
      setTimeout(()=>DOC.body.classList.remove('hha-endfx'), 900);

      emit('hydration:state', { bossActive:false, bossPhase:0 });
    }
  }

  function judgeHit(obj, source, extra){
    if(!obj || obj.dead) return;

    shots++;
    const hitX = obj.x, hitY = obj.y;

    ai.onEvent && ai.onEvent('hit_attempt', {
      kind: obj.kind, waterPct, zoneName, stormActive, shield, combo, stormLevel, bossActive, bossPhase
    });

    // ⚡ STORM/BOSS lightning: must have shield
    if(obj.kind === 'light'){
      if(!stormActive && !bossActive){
        miss++; combo = 0;
        killTarget(obj); fxShock(hitX, hitY);
        logEv('hit_light_outside', '', '', '');
        emit('hha:judge', { kind:'light', ok:false, reason:'outside', source, extra });
        setHUD();
        return;
      }

      if(shield <= 0){
        miss++; combo = 0;
        killTarget(obj); fxShock(hitX, hitY);
        logEv('hit_light_no_shield', stormActive?'storm':'boss', '', '');
        emit('hha:judge', { kind:'light', ok:false, reason:'no_shield', source, extra });
        setHUD();
        return;
      }

      shield = Math.max(0, shield-1);
      hits++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      score += 12 + stormLevel*2;

      if(stormActive){
        stormHit++;
        logEv('storm_light_hit', stormHit, stormNeed, '');
        emit('hha:judge', { kind:'storm_light', ok:true, stormHit, stormNeed, source, extra });
      }else{
        bossHp = Math.max(0, bossHp - 1);
        logEv('boss_light_hit', bossHp, bossHpMax, bossPhase);
        emit('hha:judge', { kind:'boss_light', ok:true, bossHp, bossPhase, source, extra });
        stepBossPhaseIfNeeded();
      }

      killTarget(obj);
      fxShock(hitX, hitY);
      setHUD();
      return;
    }

    // 🛡 pickup
    if(obj.kind === 'shield'){
      hits++;
      shield = clamp(shield + 1, 0, 9);
      score += 8;
      combo++;
      comboMax = Math.max(comboMax, combo);
      logEv('pickup_shield', shield, '', '');
      emit('hha:judge', { kind:'shield', ok:true, shield, source, extra });
      killTarget(obj);
      fxShock(hitX, hitY);
      setHUD();
      return;
    }

    // 💧 / 🟢 / 🟠 changes waterPct
    if(obj.kind === 'drop' || obj.kind === 'fixLow' || obj.kind === 'fixHigh'){
      hits++;
      const before = waterPct;
      waterPct = clamp(waterPct + obj.value, 0, 100);
      score += 6;
      combo++;
      comboMax = Math.max(comboMax, combo);

      logEv('hit_drop', obj.kind, before.toFixed(0), waterPct.toFixed(0));
      emit('hha:judge', { kind:obj.kind, ok:true, before, after:waterPct, source, extra });

      killTarget(obj);
      fxShock(hitX, hitY);
      setHUD();
      return;
    }

    // 👾 boss core
    if(obj.kind === 'boss'){
      hits++;
      if(bossActive){
        const dmg = (bossPhase===3 ? 2 : 1);
        bossHp = Math.max(0, bossHp - dmg);
        score += 18 + bossPhase*4;
        combo += 1;
        logEv('boss_core_hit', dmg, bossHp, bossPhase);
        emit('hha:judge', { kind:'boss', ok:true, dmg, bossHp, bossPhase, source, extra });
        stepBossPhaseIfNeeded();
      }else{
        score += 10;
        combo += 1;
        logEv('boss_token_hit', '', '', '');
        emit('hha:judge', { kind:'boss_token', ok:true, source, extra });
      }
      comboMax = Math.max(comboMax, combo);
      killTarget(obj);
      fxShock(hitX, hitY);
      setHUD();
      return;
    }

    // fallback
    miss++; combo=0;
    killTarget(obj);
    fxShock(hitX, hitY);
    logEv('miss_unknown', obj.kind, '', '');
    emit('hha:judge', { kind:obj.kind, ok:false, source, extra });
    setHUD();
  }

  // cVR shoot picks nearest target within lockPx
  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||28);

    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    let best=null, bestDist=1e9;
    for(const t of targets){
      if(t.dead) continue;
      const dx = (t.x - cx), dy = (t.y - cy);
      const dist = Math.hypot(dx, dy);
      if(dist < lockPx && dist < bestDist){
        best = t; bestDist = dist;
      }
    }
    if(best){
      judgeHit(best, 'shoot', { lockPx, dist: bestDist });
    }
  }

  function spawnLogic(dt){
    const p = params();

    // storm: prioritize lightning, allow rare shield
    if(stormActive){
      if(targets.filter(t=>t.kind==='light' && !t.dead).length < 4){
        spawn('light');
      }
      if(rng() < 0.10 && shield < 2) spawn('shield');
      return;
    }

    // boss: mix boss + lightning + rare shield
    if(bossActive){
      if(targets.filter(t=>t.kind==='boss' && !t.dead).length < 2) spawn('boss');
      if(rng() < (0.12 + bossPhase*0.05)) spawn('light');
      if(rng() < 0.10 && shield < 2) spawn('shield');
      return;
    }

    // normal
    spawnAcc += (p.spawnPerSec * dt);
    let spawned = 0;

    while(spawnAcc >= 1 && spawned < LIMIT.spawnMaxPerFrame){
      spawnAcc -= 1;

      const z = zoneName;
      if(z==='LOW'){
        if(rng() < 0.55) spawn('fixLow'); else spawn('drop');
      }else if(z==='HIGH'){
        if(rng() < 0.55) spawn('fixHigh'); else spawn('drop');
      }else{
        spawn('drop');
      }

      if(rng() < p.shieldRate){
        spawn('shield');
      }
      spawned++;
    }
  }

  function driftLogic(dt){
    const p = params();

    if(!driftLogic._dir){
      driftLogic._dir = (rng() < 0.5) ? -1 : 1;
      driftLogic._t = 0;
    }
    driftLogic._t += dt;
    if(driftLogic._t > 3.2){
      driftLogic._t = 0;
      if(rng() < 0.45) driftLogic._dir *= -1;
    }

    let drift = p.driftPerSec * driftLogic._dir;
    if(waterPct < 30) drift -= 0.6;
    if(waterPct > 80) drift += 0.6;

    waterPct = clamp(waterPct + drift*dt, 0, 100);
  }

  function stormGateLogic(dt){
    const p = params();

    const z = zoneFromPct(waterPct);
    zoneName = z;

    if(z === 'GREEN'){
      outGreenSec = 0;

      // ✅ safe return: stabilize around center when in GREEN
      const center = 55;
      const pull = (center - waterPct) * 0.04;
      waterPct = clamp(waterPct + pull, 0, 100);
      return;
    }

    // outside green
    outGreenSec += dt;

    const inLowOrHigh = (z==='LOW' || z==='HIGH');
    if(inLowOrHigh && outGreenSec >= p.stormGateSec && !stormActive && !bossActive){
      startStorm();
      outGreenSec = 0;
    }
  }

  function stormTick(dt){
    if(!stormActive) return;

    stormTimer -= dt;

    const aliveLightning = targets.filter(t=>t.kind==='light' && !t.dead).length;
    if(aliveLightning < 4 && (stormHit < stormNeed)){
      if(rng() < 0.75) spawn('light');
    }

    if(stormHit >= stormNeed){
      endStorm(true);
      return;
    }
    if(stormTimer <= 0){
      endStorm(false);
      return;
    }
  }

  function bossTick(dt){
    if(!bossActive) return;

    const push = (bossPhase===3 ? 2.2 : 1.4);
    const dir = (rng() < 0.5) ? -1 : 1;
    waterPct = clamp(waterPct + dir*push*dt, 0, 100);

    stepBossPhaseIfNeeded();
  }

  function computeTier(){
    if(stormOK >= 3 && !bossActive) return 'ULTIMATE';
    if(stormOK >= 2) return 'HARDCORE';
    if(stormOK >= 1) return 'BRAVE';
    return 'ROOKIE';
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    paused=false;

    clearTargets();

    const played = Math.max(0, Math.round((nowMs()-tStart)/1000));
    const acc = shots ? (hits/shots) : 0;
    const grade = gradeFrom(acc, stormOK, comboMax);
    const tier = computeTier();

    const summary = {
      version: 'hydration.safe.full-20260216c',
      game: 'hydration',
      runMode,
      diff,
      view,
      seed,
      timestampIso: nowIso(),
      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec: played,

      score, miss, shots, hits,
      accuracy: acc,
      grade,
      comboMax,

      waterPctEnd: waterPct,
      zoneEnd: zoneName,

      shieldEnd: shield,
      stormOK,
      stormCycles,
      stormLevelMax: stormLevel,

      bossDefeated: (!bossActive && stormOK >= params().bossAfterStorms) ? 1 : 0,
    };

    try{
      if(ai.getSummaryExtras){
        Object.assign(summary, ai.getSummaryExtras());
      }
    }catch(_){}

    emit('hha:end', summary);

    setText('rScore', String(score));
    setText('rGrade', grade);
    setText('rAcc', (acc*100).toFixed(1)+'%');
    setText('rComboMax', String(comboMax));
    setText('rMiss', String(miss));
    setText('rTier', tier);

    setText('rGoals', `Storm OK: ${stormOK} / Cycles: ${stormCycles} / Tier: ${tier}`);
    setText('rMinis', `ShieldEnd: ${shield} • WaterEnd: ${waterPct.toFixed(0)}% • Zone: ${zoneName}`);

    const tips = [
      (stormOK===0 ? `${ICON.ALERT} อยากเข้า STORM ต้อง “หลุด GREEN ไป LOW/HIGH” ค้างสักพัก` : `${ICON.LIGHT} คุณผ่าน STORM ได้ ${stormOK} ครั้ง!`),
      `${ICON.SHIELD} ใน STORM ถ้าไม่มี 🛡 จะ “ตี ⚡ ไม่ได้” — เก็บโล่ก่อนเข้าพายุ`,
      `ลองคุม GREEN (40–70) แต่ยอมหลุดเพื่อเปิด STORM แล้วกลับมาให้ไว`,
      `Grade ขึ้นกับ Accuracy + StormOK + ComboMax`,
    ].join('\n');

    if(rTips) rTips.textContent = tips;
    setText('rNext', `seed=${seed} • mode=${runMode} • diff=${diff}`);

    if(resultBackdrop) resultBackdrop.hidden = false;

    logEv('end', reason, grade, (acc*100).toFixed(1));
  }

  function downloadCSV(){
    const header = 't,type,a,b,c\n';
    const rows = events.map(e=>{
      const esc = (s)=> String(s).replace(/"/g,'""');
      return `"${esc(e.t)}","${esc(e.type)}","${esc(e.a)}","${esc(e.b)}","${esc(e.c)}"`;
    }).join('\n');
    const csv = header + rows + '\n';
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = `hydration_${seed}_${Date.now()}.csv`;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); a.remove(); }catch{} }, 0);
  }

  function resetToIdle(){
    running=false; paused=false;
    clearTargets();
    score=0; combo=0; comboMax=0; miss=0; shots=0; hits=0;
    waterPct=50; zoneName='GREEN';
    outGreenSec=0;
    stormActive=false; stormLevel=0; stormCycles=0; stormNeed=0; stormHit=0; stormTimer=0; stormOK=0;
    shield=0;
    bossActive=false; bossPhase=0; bossHp=0; bossHpMax=0;
    spawnAcc=0;
    events.length=0;
    setHUD();
  }

  function startGame(detail){
    const u = new URL(location.href);
    runMode = String(detail?.runMode || u.searchParams.get('run') || 'play').toLowerCase()==='research' ? 'research' : 'play';
    diff = String(detail?.diff || u.searchParams.get('diff') || 'normal').toLowerCase();
    view = String(u.searchParams.get('view') || 'pc').toLowerCase();
    timePlannedSec = clamp(Number(detail?.timePlannedSec || u.searchParams.get('time') || 70), 20, 9999);
    seed = Number(detail?.seed || u.searchParams.get('seed') || 0) || 0;

    rng = makeRNG(seed || 1);
    ai = getAIHooks({gameId:'hydration', seed, runMode, diff});

    _base = baseParams(diff);
    _adaptive = { spawnPerSecMul:1, driftMul:1, shieldRateMul:1 };

    resetToIdle();

    running=true; paused=false;
    tStart = nowMs();
    tLast = tStart;
    timeLeft = timePlannedSec;

    if(runMode==='play') shield = 1;

    logEv('start', runMode, diff, seed);

    // ✅ FIX: DO NOT emit hha:start here (RUN is the one that emits it)
    // emit('hha:start', ...)  <-- removed to prevent recursion loop

    if(resultBackdrop) resultBackdrop.hidden = true;

    setHUD();
    requestAnimationFrame(tick);
  }

  function tick(){
    if(!running) return;
    const t = nowMs();
    const dt = Math.max(0, (t - tLast)/1000);
    tLast = t;

    if(paused){
      requestAnimationFrame(tick);
      return;
    }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: (t - tStart)/1000 });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    cleanupTargets();

    driftLogic(dt);
    stormGateLogic(dt);
    stormTick(dt);
    bossTick(dt);

    spawnLogic(dt);

    if(runMode==='play'){
      if(!tick._accT) tick._accT = 0;
      tick._accT += dt;
      if(tick._accT >= 2.2){
        tick._accT = 0;
        applyAdaptive();
      }
    }

    if(miss >= 12 && runMode==='play'){
      endGame('fail');
      return;
    }

    if(stormActive){
      if(rng() < 0.05) score = Math.max(0, score-1);
    }

    setHUD();
    emit('hha:score', { score, combo, miss, waterPct, zoneName, stormOK, bossActive, bossPhase });

    requestAnimationFrame(tick);
  }

  // -----------------------------
  // UI binds
  // -----------------------------
  btnRetry?.addEventListener('click', ()=>{
    startGame({ runMode, diff, timePlannedSec, seed });
  }, {passive:true});

  btnCopyJSON?.addEventListener('click', ()=>{
    try{
      const acc = shots ? (hits/shots) : 0;
      const grade = gradeFrom(acc, stormOK, comboMax);
      const json = JSON.stringify({
        score, miss, shots, hits, acc, grade, comboMax,
        stormOK, stormCycles, stormLevel,
        shieldEnd: shield, waterPctEnd: waterPct, zoneEnd: zoneName,
        seed, runMode, diff, timePlannedSec
      }, null, 2);
      copyText(json);
    }catch(_){}
  }, {passive:true});

  btnDownloadCSV?.addEventListener('click', downloadCSV, {passive:true});

  btnCloseSummary?.addEventListener('click', ()=>{
    if(resultBackdrop) resultBackdrop.hidden = true;
  }, {passive:true});

  WIN.addEventListener('hha:shoot', onShoot);

  WIN.addEventListener('hha:start', (e)=>{
    const d = (e && e.detail) || {};
    if(d.game && String(d.game).toLowerCase() !== 'hydration') return;
    startGame(d);
  });

  resetToIdle();
})();