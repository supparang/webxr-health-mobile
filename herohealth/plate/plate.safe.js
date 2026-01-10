// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION (HHA Standard + Plate Rush + Safe Spawn)
// ✅ Play: adaptive ON
// ✅ Study/Research: deterministic seed + adaptive OFF
// ✅ Uses DOM target engine (SAFE spawn) — NO A-Frame requirement
// ✅ Works with Universal VR UI (vr-ui.js): listens hha:shoot for cVR/mobile crosshair
// ✅ Emits: hha:score, hha:judge, quest:update, hha:coach, hha:time, hha:end
// ✅ End summary: localStorage HHA_LAST_SUMMARY (handled by run page too)
// ✅ Fix: target pop-in / spawn corner => boundsHost rect + safezone + clamp
// ✅ Fix: "เป้าแว๊บ ๆ" => spawn animation + minimum lifetime + no immediate despawn
//
// Boot API:
//   import { boot } from './plate.safe.js';
//   boot({ host:'#plate-layer', hub, runMode:'play|study|research', diff:'easy|normal|hard', durationPlannedSec:70, seed:..., view:'pc|mobile|vr|cvr' });

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

// -------------------- helpers --------------------
function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function qs(k, def=null){ try{ return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } }

function makeRng(seed){
  // Mulberry32 deterministic RNG
  let t = (Number(seed)||0) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr){
  return arr[Math.floor(rng() * arr.length)];
}

function emit(name, detail={}){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function setAria(el, hidden){
  if(!el) return;
  el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  // optional display helper; CSS can override
  if(hidden){
    el.style.display = el.dataset.keepDisplay ? el.style.display : el.style.display;
  }
}

function getRect(el){
  if(!el) return { left:0, top:0, width:0, height:0, right:0, bottom:0 };
  const r = el.getBoundingClientRect();
  return {
    left:r.left, top:r.top, width:r.width, height:r.height,
    right:r.right, bottom:r.bottom
  };
}

// -------------------- quest (simple) --------------------
// GOAL: "ทำจานให้สมดุล" = กดถูกหมวดที่ต้องการครบ N ครั้ง
// MINI: "Plate Rush" = ทำถูกติดต่อกัน K ครั้งภายใน T วินาที (ล้มเมื่อกดผิด)
function createQuest(cfg){
  const Q = {
    goalText: '',
    miniText: '',
    goalsTotal: 1,
    goalsCleared: 0,
    goalCur: 0,
    goalTarget: 10,
    miniTotal: 1,
    miniCleared: 0,
    miniCur: 0,
    miniTarget: 6,
    miniTimeLeftMs: 15000,
    miniActive: true,
    miniDone: false,
    miniFailed: false,
    allDone: false,
    lastMiniStart: now(),
  };

  function resetMini(){
    Q.miniCur = 0;
    Q.miniTimeLeftMs = cfg.miniTimeMs;
    Q.miniActive = true;
    Q.miniDone = false;
    Q.miniFailed = false;
    Q.lastMiniStart = now();
  }

  function updateTexts(){
    Q.goalText = `เลือกอาหาร “ถูกหมวด” ให้ได้ ${Q.goalTarget} ครั้ง`;
    Q.miniText = `Plate Rush: ถูกติดกัน ${Q.miniTarget} ครั้ง ภายใน ${Math.round(cfg.miniTimeMs/1000)} วิ`;
  }

  function push(){
    emit('quest:update', {
      goalText: Q.goalText,
      goalCur: Q.goalCur, goalTarget: Q.goalTarget,
      goalsCleared: Q.goalsCleared, goalsTotal: Q.goalsTotal,
      miniText: Q.miniText,
      miniCur: Q.miniCur, miniTarget: Q.miniTarget,
      miniCleared: Q.miniCleared, miniTotal: Q.miniTotal,
      miniTimeLeftMs: Q.miniTimeLeftMs,
      allDone: Q.allDone,
      miniDone: Q.miniDone,
      miniFailed: Q.miniFailed
    });
  }

  function onCorrect(){
    if(Q.allDone) return;
    Q.goalCur++;
    if(Q.goalCur >= Q.goalTarget && Q.goalsCleared < Q.goalsTotal){
      Q.goalsCleared = Q.goalsTotal;
    }

    // mini streak
    if(Q.miniActive && !Q.miniDone){
      Q.miniCur++;
      if(Q.miniCur >= Q.miniTarget){
        Q.miniDone = true;
        Q.miniCleared = Q.miniTotal;
      }
    }
    if(Q.goalsCleared >= Q.goalsTotal && Q.miniCleared >= Q.miniTotal){
      Q.allDone = true;
    }
    push();
  }

  function onWrong(){
    if(Q.allDone) return;
    if(Q.miniActive && !Q.miniDone){
      Q.miniFailed = true;
      Q.miniActive = false;
      Q.miniCur = 0;
      // allow re-try after cooldown (handled by engine)
    }
    push();
  }

  function tick(dt){
    if(Q.allDone) return;
    if(Q.miniActive && !Q.miniDone){
      Q.miniTimeLeftMs = Math.max(0, Q.miniTimeLeftMs - dt);
      if(Q.miniTimeLeftMs <= 0){
        Q.miniFailed = true;
        Q.miniActive = false;
        Q.miniCur = 0;
      }
    }
    // keep update frequency lower by engine
  }

  function allowMiniRetry(){
    if(Q.miniDone) return;
    resetMini();
    push();
  }

  // init
  Q.goalTarget = cfg.goalTarget;
  Q.miniTarget = cfg.miniTarget;
  cfg.miniTimeMs = cfg.miniTimeMs || 15000;
  updateTexts();
  resetMini();
  push();

  return { Q, onCorrect, onWrong, tick, allowMiniRetry, push, updateTexts };
}

// -------------------- target sets --------------------
// Plate logic simplified for kid-friendly play:
// - GOOD targets = categories needed now
// - BAD targets  = wrong category / too much
// Each spawn chooses a "food tile" icon + label with truth flag
function makeTargetCatalog(){
  // Thai-ish examples; you can later swap to images
  const groups = [
    { key:'rice',   label:'ข้าว-แป้ง', emoji:'🍚' },
    { key:'veg',    label:'ผัก',       emoji:'🥦' },
    { key:'fruit',  label:'ผลไม้',     emoji:'🍎' },
    { key:'protein',label:'เนื้อ/ไข่',  emoji:'🍗' },
    { key:'milk',   label:'นม',        emoji:'🥛' }
  ];
  const junk = [
    { key:'soda', label:'น้ำอัดลม', emoji:'🥤' },
    { key:'cake', label:'เค้ก', emoji:'🍰' },
    { key:'chip', label:'ขนมกรุบกรอบ', emoji:'🍟' }
  ];
  return { groups, junk };
}

// -------------------- engine --------------------
export function boot(opts = {}){
  if(!DOC) return;

  const hostSel = opts.host || '#plate-layer';
  const host = DOC.querySelector(hostSel);
  if(!host){
    console.warn('[plate.safe] host not found:', hostSel);
    return;
  }

  const runMode = (opts.runMode || qs('run','play') || 'play').toLowerCase();
  const diff = (opts.diff || qs('diff','normal') || 'normal').toLowerCase();
  const view = (opts.view || qs('view','auto') || 'auto').toLowerCase();

  const durationPlannedSec = Math.max(20, Number(opts.durationPlannedSec || qs('time','70') || 70));
  const durationPlannedMs = durationPlannedSec * 1000;

  // deterministic in study/research; play can still accept seed, but adaptive uses rng too
  const seed = Number(opts.seed || qs('seed','0') || 0) || Date.now();
  const rng = makeRng(seed);

  const isResearch = (runMode === 'study' || runMode === 'research');
  const adaptiveOn = !isResearch; // ✅ research OFF

  // difficulty tuning
  const TUNE = (()=>{
    const base = {
      easy:   { spawnMs: 1100, lifeMs: 3200, size: 86, speed: 1.00, goal: 8,  mini: 5, miniTime: 16000, badRate: 0.20 },
      normal: { spawnMs: 950,  lifeMs: 2900, size: 78, speed: 1.10, goal: 10, mini: 6, miniTime: 15000, badRate: 0.25 },
      hard:   { spawnMs: 820,  lifeMs: 2600, size: 70, speed: 1.22, goal: 12, mini: 7, miniTime: 14000, badRate: 0.30 }
    }[diff] || { spawnMs: 950, lifeMs: 2900, size: 78, speed:1.1, goal:10, mini:6, miniTime:15000, badRate:0.25 };

    // adaptive bounds
    return {
      spawnMs: base.spawnMs,
      lifeMs: base.lifeMs,
      size: base.size,
      speed: base.speed,
      goalTarget: base.goal,
      miniTarget: base.mini,
      miniTimeMs: base.miniTime,
      badRate: base.badRate
    };
  })();

  const catalog = makeTargetCatalog();

  // UI hooks
  const uiScore = DOC.getElementById('uiScore');
  const uiCombo = DOC.getElementById('uiCombo');
  const uiTime  = DOC.getElementById('uiTime');
  const uiGoalText = DOC.getElementById('uiGoalText');
  const uiGoalFill = DOC.getElementById('uiGoalFill');
  const uiMiniText = DOC.getElementById('uiMiniText');
  const uiMiniFill = DOC.getElementById('uiMiniFill');
  const coachMsg = DOC.getElementById('coachMsg');
  const hitFx = DOC.getElementById('hitFx');

  function coach(text, tone='neutral'){
    if(coachMsg) coachMsg.textContent = text;
    emit('hha:coach', { text, tone });
  }

  function fx(text, cls='fx-ok'){
    if(!hitFx) return;
    hitFx.textContent = text;
    hitFx.className = '';
    hitFx.classList.add('fx', cls);
    hitFx.setAttribute('aria-hidden','false');
    clearTimeout(fx._t);
    fx._t = setTimeout(()=> hitFx.setAttribute('aria-hidden','true'), 520);
  }

  // state
  const S = {
    started: false,
    ended: false,
    t0: 0,
    lastTick: 0,
    timeLeftMs: durationPlannedMs,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    nSpawnedGood: 0,
    nSpawnedBad: 0,
    nHitGood: 0,
    nHitBad: 0,
    nExpired: 0,
    avgRtGoodMs: 0,
    rtCount: 0,

    // adaptive skill estimate
    skill: 0.50, // 0..1
    spawnMs: TUNE.spawnMs,
    lifeMs: TUNE.lifeMs,
    size: TUNE.size,
    badRate: TUNE.badRate,

    // mini retry cooldown
    miniRetryAt: 0
  };

  const quest = createQuest({
    goalTarget: TUNE.goalTarget,
    miniTarget: TUNE.miniTarget,
    miniTimeMs: TUNE.miniTimeMs
  });

  // Ensure host has positioning
  host.style.position = host.style.position || 'fixed';
  host.style.inset = host.style.inset || '0';

  // SAFE SPAWN geometry (fix corner spawn)
  // Use host rect as bounds; create inner playRect with padding + safe zones.
  function getPlayRect(){
    const r = getRect(host);
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);

    // padding keeps away from edges + UI
    const padTop = 110;   // keep off top HUD
    const padBottom = 120; // keep off bottom buttons / safe area
    const padSide = 18;

    // If small screen, relax padding a bit
    const relax = (w < 420 || h < 720) ? 0.75 : 1.0;

    const left = r.left + padSide * relax;
    const top = r.top + padTop * relax;
    const right = r.right - padSide * relax;
    const bottom = r.bottom - padBottom * relax;

    const pr = {
      left, top,
      right, bottom,
      width: Math.max(1, right-left),
      height: Math.max(1, bottom-top)
    };

    // If playRect too small, auto-relax (fix "เป้าเกิดที่เดียว")
    if(pr.width < 220 || pr.height < 260){
      const left2 = r.left + 8;
      const top2  = r.top + 80;
      const right2 = r.right - 8;
      const bottom2 = r.bottom - 96;
      return {
        left:left2, top:top2, right:right2, bottom:bottom2,
        width: Math.max(1, right2-left2),
        height: Math.max(1, bottom2-top2)
      };
    }
    return pr;
  }

  function spawnPoint(sizePx){
    const pr = getPlayRect();
    const half = sizePx/2;

    // safe-zone around center crosshair for cVR strict
    const cx = pr.left + pr.width/2;
    const cy = pr.top + pr.height/2;
    const safeR = (view === 'cvr' || view === 'vr') ? 76 : 58;

    // try several times to avoid safe zone
    for(let i=0;i<18;i++){
      const x = pr.left + half + rng() * (pr.width - sizePx);
      const y = pr.top + half + rng() * (pr.height - sizePx);
      const dx = x - cx, dy = y - cy;
      if((dx*dx + dy*dy) >= safeR*safeR){
        return { x, y, pr };
      }
    }
    // fallback
    const x = pr.left + half + rng() * (pr.width - sizePx);
    const y = pr.top + half + rng() * (pr.height - sizePx);
    return { x, y, pr };
  }

  // create target element
  function makeTarget(isGood){
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'plate-target ' + (isGood ? 'is-good' : 'is-bad');
    el.setAttribute('aria-label', isGood ? 'good target' : 'bad target');
    el.style.position = 'fixed';
    el.style.border = '0';
    el.style.background = 'transparent';
    el.style.padding = '0';
    el.style.cursor = 'pointer';
    el.style.touchAction = 'manipulation';

    const tile = DOC.createElement('div');
    tile.className = 'tile';
    tile.style.width = tile.style.height = `${S.size}px`;
    tile.style.borderRadius = '999px';
    tile.style.display = 'grid';
    tile.style.placeItems = 'center';
    tile.style.font = '900 22px/1 system-ui';
    tile.style.userSelect = 'none';
    tile.style.boxShadow = '0 18px 55px rgba(0,0,0,.35)';

    const label = DOC.createElement('div');
    label.className = 'tile-label';
    label.style.position = 'absolute';
    label.style.left = '50%';
    label.style.top = 'calc(100% + 6px)';
    label.style.transform = 'translateX(-50%)';
    label.style.font = '900 12px/1 system-ui';
    label.style.padding = '6px 10px';
    label.style.borderRadius = '999px';
    label.style.whiteSpace = 'nowrap';

    const item = isGood ? pick(rng, catalog.groups) : pick(rng, catalog.junk);
    tile.textContent = item.emoji;
    label.textContent = item.label;

    // theme
    if(isGood){
      tile.style.background = 'rgba(34,197,94,.18)';
      tile.style.border = '1px solid rgba(34,197,94,.45)';
      label.style.background = 'rgba(34,197,94,.16)';
      label.style.border = '1px solid rgba(34,197,94,.30)';
      label.style.color = '#e5e7eb';
    }else{
      tile.style.background = 'rgba(239,68,68,.18)';
      tile.style.border = '1px solid rgba(239,68,68,.42)';
      label.style.background = 'rgba(239,68,68,.14)';
      label.style.border = '1px solid rgba(239,68,68,.28)';
      label.style.color = '#e5e7eb';
    }

    el.appendChild(tile);
    el.appendChild(label);
    return el;
  }

  const targets = new Map(); // id -> data
  let spawnTimer = 0;

  function updateHUD(){
    if(uiScore) uiScore.textContent = String(S.score|0);
    if(uiCombo) uiCombo.textContent = String(S.combo|0);

    const sec = Math.ceil(S.timeLeftMs/1000);
    const mm = String(Math.floor(sec/60)).padStart(2,'0');
    const ss = String(sec%60).padStart(2,'0');
    if(uiTime) uiTime.textContent = `${mm}:${ss}`;

    // quest -> HUD bars
    if(uiGoalText) uiGoalText.textContent = quest.Q.goalText;
    if(uiMiniText) uiMiniText.textContent = quest.Q.miniText;

    if(uiGoalFill){
      const p = quest.Q.goalTarget ? clamp(quest.Q.goalCur/quest.Q.goalTarget,0,1) : 0;
      uiGoalFill.style.width = `${Math.round(p*100)}%`;
    }
    if(uiMiniFill){
      const p = quest.Q.miniTarget ? clamp(quest.Q.miniCur/quest.Q.miniTarget,0,1) : 0;
      uiMiniFill.style.width = `${Math.round(p*100)}%`;
      // if mini active, add subtle time pressure via opacity
      const t = quest.Q.miniTimeLeftMs / (TUNE.miniTimeMs || 15000);
      uiMiniFill.style.opacity = String(clamp(0.35 + t*0.65, 0.35, 1));
    }
  }

  function scoreCorrect(rtMs){
    S.nHitGood++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    const base = 10;
    const comboBonus = Math.min(25, S.combo * 2);
    const speedBonus = clamp(12 - (rtMs/250), 0, 12); // faster => more
    const add = Math.round(base + comboBonus + speedBonus);
    S.score += add;

    // avg rt
    S.rtCount++;
    S.avgRtGoodMs = S.avgRtGoodMs + (rtMs - S.avgRtGoodMs) / S.rtCount;

    emit('hha:score', { score:S.score, add, combo:S.combo, rtMs, kind:'good' });
    fx(`+${add}`, 'fx-good');
  }

  function scoreWrong(){
    S.nHitBad++;
    S.combo = 0;
    S.misses++;
    emit('hha:judge', { kind:'bad', misses:S.misses });
    fx('พลาด!', 'fx-bad');
  }

  function onHit(id, source='tap'){
    const t = targets.get(id);
    if(!t || t.dead) return;
    t.dead = true;

    const rt = Math.max(1, now() - t.spawnAt);

    // remove element
    try{ t.el.remove(); }catch{}
    targets.delete(id);

    if(t.good){
      scoreCorrect(rt);
      quest.onCorrect();
      if(quest.Q.allDone){
        coach('เยี่ยม! ทำครบทั้ง GOAL และ MINI แล้ว 🎉', 'happy');
      }else{
        coach(S.combo >= 4 ? 'คอมโบกำลังมา! เก่งมาก' : 'ดีมาก! เลือกถูกแล้ว', 'happy');
      }
    }else{
      scoreWrong();
      quest.onWrong();
      coach('อันนี้ไม่เหมาะนะ ลองเลือกอาหารที่ดีต่อสุขภาพ', 'sad');

      // mini retry schedule if failed
      if(quest.Q.miniFailed && !quest.Q.miniDone){
        S.miniRetryAt = now() + 1800; // 1.8s cooldown
      }
    }

    // adaptive update
    if(adaptiveOn){
      // update skill based on correctness streaks
      const target = t.good ? 1 : 0;
      const err = target - S.skill;
      S.skill = clamp(S.skill + err * 0.07, 0, 1);

      // adjust spawn/life/size softly
      const harden = clamp((S.skill - 0.5) * 2, -1, 1); // -1..1
      S.spawnMs = clamp(TUNE.spawnMs * (1 - 0.18*harden), 680, 1400);
      S.lifeMs  = clamp(TUNE.lifeMs  * (1 - 0.10*harden), 2100, 3800);
      S.size    = clamp(TUNE.size    * (1 - 0.10*harden), 58, 92);
      S.badRate = clamp(TUNE.badRate + (0.06*harden), 0.16, 0.38);
    }

    updateHUD();
  }

  // hook crosshair shooting (vr-ui.js emits hha:shoot)
  function hookShoot(){
    ROOT.addEventListener('hha:shoot', (ev)=>{
      if(!S.started || S.ended) return;
      const d = ev.detail || {};
      const x = Number(d.x), y = Number(d.y);
      if(!isFinite(x) || !isFinite(y)) return;

      // find target whose center is within lockPx (default 28 in vr-ui config)
      const lockPx = Number(d.lockPx || 28);
      let best = null, bestDist = 1e9;

      targets.forEach((t, id)=>{
        if(t.dead) return;
        const r = t.el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;
        const dx = cx - x, dy = cy - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < bestDist){
          bestDist = dist;
          best = id;
        }
      });

      if(best && bestDist <= lockPx){
        onHit(best, 'shoot');
      }
    }, { passive:true });
  }

  function spawnOne(){
    const good = (rng() > S.badRate); // majority good
    const el = makeTarget(good);
    const id = String(Math.floor(rng()*1e9)) + '-' + String(Date.now());

    const sizePx = S.size;
    const pt = spawnPoint(sizePx);

    el.style.left = `${pt.x}px`;
    el.style.top = `${pt.y}px`;
    el.style.transform = 'translate(-50%,-50%) scale(.82)';
    el.style.opacity = '0';

    // animate in (avoid "แว๊บ ๆ")
    requestAnimationFrame(()=>{
      el.style.transition = 'transform 180ms ease, opacity 180ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    host.appendChild(el);

    const t = {
      id,
      el,
      good,
      spawnAt: now(),
      dieAt: now() + Math.max(800, S.lifeMs), // min lifetime
      dead: false
    };
    targets.set(id, t);

    if(good) S.nSpawnedGood++; else S.nSpawnedBad++;

    el.addEventListener('click', (e)=>{
      e.preventDefault();
      onHit(id, 'tap');
    }, { passive:false });
  }

  function clearAll(){
    targets.forEach(t=>{ try{ t.el.remove(); }catch{} });
    targets.clear();
  }

  function end(reason='time'){
    if(S.ended) return;
    S.ended = true;
    clearAll();

    const playedMs = durationPlannedMs - S.timeLeftMs;
    const acc = (S.nSpawnedGood > 0) ? (S.nHitGood / Math.max(1, S.nSpawnedGood)) : 0;
    const junkErr = (S.nHitBad / Math.max(1, (S.nHitGood + S.nHitBad))) || 0;

    const summary = {
      timestampIso: new Date().toISOString(),
      projectTag: 'herohealth',
      phase: 'end',
      sessionId: String(seed),
      gameMode: 'plate',
      runMode,
      diff,
      durationPlannedSec,
      durationPlayedSec: Math.round(playedMs/1000),
      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      goalsCleared: quest.Q.goalsCleared|0,
      goalsTotal: quest.Q.goalsTotal|0,
      miniCleared: quest.Q.miniCleared|0,
      miniTotal: quest.Q.miniTotal|0,
      nTargetGoodSpawned: S.nSpawnedGood|0,
      nTargetJunkSpawned: S.nSpawnedBad|0,
      nHitGood: S.nHitGood|0,
      nHitJunk: S.nHitBad|0,
      nExpireGood: S.nExpired|0,
      accuracyGoodPct: Math.round(acc*1000)/10,
      junkErrorPct: Math.round(junkErr*1000)/10,
      avgRtGoodMs: Math.round(S.avgRtGoodMs||0),
      device: (view || 'auto'),
      gameVersion: 'plate.safe.js@2026-01-10',
      reason
    };

    emit('hha:end', summary);

    // Cloud logger: if present, send summary
    try{
      if(ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.logSession === 'function'){
        ROOT.HHACloudLogger.logSession(summary);
      }
    }catch{}

    // Safety: store last summary
    try{
      ROOT.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game:'plate', at: summary.timestampIso, url: location.href, summary
      }));
    }catch{}
  }

  // start control
  function start(){
    if(S.started) return;
    S.started = true;
    S.t0 = now();
    S.lastTick = S.t0;
    S.timeLeftMs = durationPlannedMs;

    coach(isResearch ? 'โหมดวิจัย: รูปแบบคงที่ (seeded) พร้อมเก็บข้อมูล' : 'โหมดเล่น: ปรับความยากอัตโนมัติให้พอดี', 'neutral');

    updateHUD();
    emit('hha:time', { leftMs: S.timeLeftMs, durationPlannedMs });

    spawnTimer = 0;
    requestAnimationFrame(tick);
  }

  // pause/resume hooks (optional)
  let paused = false;
  ROOT.addEventListener('hha:pause', ()=>{ paused = true; });
  ROOT.addEventListener('hha:resume', ()=>{ paused = false; S.lastTick = now(); });

  function tick(ts){
    if(S.ended) return;
    if(!S.started){
      requestAnimationFrame(tick);
      return;
    }

    const t = now();
    let dt = t - S.lastTick;
    S.lastTick = t;

    if(paused){
      requestAnimationFrame(tick);
      return;
    }

    dt = clamp(dt, 0, 80);

    // time
    S.timeLeftMs = Math.max(0, S.timeLeftMs - dt);
    emit('hha:time', { leftMs: S.timeLeftMs, durationPlannedMs });

    // quest tick (mini timer)
    quest.tick(dt);

    // mini retry after fail
    if(!quest.Q.miniDone && quest.Q.miniFailed && !quest.Q.miniActive && now() >= S.miniRetryAt){
      quest.allowMiniRetry();
      coach('Mini Quest รีเซ็ตแล้ว! ลองทำคอมโบให้ติดกันนะ', 'neutral');
    }

    // spawn cadence
    spawnTimer += dt;
    const spawnEvery = Math.max(520, S.spawnMs);
    while(spawnTimer >= spawnEvery){
      spawnTimer -= spawnEvery;
      spawnOne();
    }

    // expire
    const tnow = now();
    targets.forEach((t, id)=>{
      if(t.dead) return;
      if(tnow >= t.dieAt){
        t.dead = true;
        try{ t.el.remove(); }catch{}
        targets.delete(id);
        S.nExpired++;
        // expiring a GOOD target counts as "miss pressure" lightly
        if(t.good){
          S.combo = 0;
          S.misses++;
          emit('hha:judge', { kind:'expire', misses:S.misses });
        }
      }
    });

    // HUD refresh throttled (every ~150ms)
    tick._hudAcc = (tick._hudAcc || 0) + dt;
    if(tick._hudAcc >= 150){
      tick._hudAcc = 0;
      updateHUD();
    }

    if(S.timeLeftMs <= 0){
      end('time');
      return;
    }

    requestAnimationFrame(tick);
  }

  // hook shoots
  hookShoot();

  // auto start on hha:start (run page triggers this)
  ROOT.addEventListener('hha:start', ()=>{
    if(!S.started) start();
  });

  // if user wants auto-start (optional query)
  const autostart = (qs('autostart','0') === '1');
  if(autostart) start();

  // initial HUD paint
  updateHUD();
}