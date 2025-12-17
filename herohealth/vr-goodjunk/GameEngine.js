// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM targets engine (spawn anywhere) + Correct MISS logic + Adaptive size
// MISS = good expired (missed good target) + junk hit (touched junk)
// If junk is touched while Shield is active and blocks the hit -> NOT a Miss.
//
// API:
//   GameEngine.start(diff, { runMode:'play'|'research', durationSec:number, layerEl:HTMLElement })
//   GameEngine.stop(reason)
//
// Emits:
//   hha:score { score, misses, combo, comboMax, goodHits, fever, shieldActive }
//   hha:judge { label }  // Perfect / Good / Block / ...
//   hha:miss  { misses, reason:'good-expired'|'junk-hit' }
//   hha:end   { reason, scoreFinal, misses, comboMax }

'use strict';

export const GameEngine = (() => {
  let running = false;
  let rafId = 0;
  let spawnTimer = 0;

  let LAYER = null;
  let RUN_MODE = 'play';
  let DIFF = 'normal';
  let DURATION_SEC = 60;

  // ---------- External UI helpers (IIFE modules) ----------
  function FeverUI() {
    const gm = window.GAME_MODULES || {};
    return gm.FeverUI || window.FeverUI || null;
  }
  function Particles() {
    const gm = window.GAME_MODULES || {};
    return gm.Particles || window.Particles || null;
  }

  // ---------- Game params ----------
  const DIFF_BASE = {
    easy:   { spawnMs: 950,  lifeMs: 1400, baseScale: 1.15, maxActive: 4, junkRatio: 0.30, shieldRatio: 0.06 },
    normal: { spawnMs: 820,  lifeMs: 1250, baseScale: 1.00, maxActive: 5, junkRatio: 0.36, shieldRatio: 0.07 },
    hard:   { spawnMs: 700,  lifeMs: 1120, baseScale: 0.85, maxActive: 6, junkRatio: 0.42, shieldRatio: 0.08 }
  };

  // Emoji pools
  const GOOD = ['🥦','🍎','🥛','🍌','🥕','🍊','🍇','🥬','🍠','🐟','🥜'];
  const JUNK = ['🍟','🍔','🍕','🍩','🍪','🍫','🥤','🍭','🧁','🍗'];
  const SHIELD = '🛡️';

  // ---------- State ----------
  const S = {
    score: 0,
    misses: 0,
    combo: 0,
    comboMax: 0,
    goodHits: 0,
    fever: 0,          // 0..100
    feverActive: false,
    shieldActive: false,
    shieldUntil: 0,
    startedAt: 0,
    lastPos: { x: 0.5, y: 0.5 }
  };

  // Targets
  const active = new Map(); // id -> { el, kind, born, lifeMs, x, y, scale }
  let idSeq = 1;

  // ---------- Helpers ----------
  function now() { return performance.now(); }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function dispatch(name, detail){
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function emitScore(){
    dispatch('hha:score', {
      score: S.score|0,
      misses: S.misses|0,
      combo: S.combo|0,
      comboMax: S.comboMax|0,
      goodHits: S.goodHits|0,
      fever: S.fever|0,
      shieldActive: !!S.shieldActive
    });
  }

  function setJudge(label){
    dispatch('hha:judge', { label: label || '' });
  }

  function addMiss(reason){
    S.misses = (S.misses|0) + 1;
    S.combo = 0;
    dispatch('hha:miss', { misses: S.misses|0, reason: reason || 'miss' });
    setJudge('MISS');
    emitScore();
  }

  function updateShield(){
    if (!S.shieldActive) return;
    if (now() >= S.shieldUntil){
      S.shieldActive = false;
      const ui = FeverUI();
      if (ui && ui.setShield) ui.setShield(false);
    }
  }

  function activateShield(ms){
    const t = now();
    S.shieldActive = true;
    S.shieldUntil = t + (ms|0);
    const ui = FeverUI();
    if (ui && ui.setShield) ui.setShield(true);
  }

  function addFever(delta){
    const prev = S.fever|0;
    let v = prev + (delta|0);
    v = clamp(v, 0, 100);
    S.fever = v|0;

    const ui = FeverUI();
    if (ui && ui.setFever) ui.setFever(S.fever);

    const wasActive = !!S.feverActive;
    const isActive = (S.fever >= 100);

    if (!wasActive && isActive){
      S.feverActive = true;
      dispatch('hha:fever', { state: 'start' });
      // fever start -> give shield for a bit (เกมสนุกขึ้น) (กันได้ 1 ครั้ง)
      activateShield(2800);
    }

    // decay / end
    if (wasActive && S.fever < 30){
      S.feverActive = false;
      dispatch('hha:fever', { state: 'end' });
    }
  }

  function scoreForHit(rtMs){
    // rtMs = reaction time; faster = more points
    if (rtMs <= 350) return { pts: 120, label: 'PERFECT' };
    if (rtMs <= 650) return { pts: 90,  label: 'GOOD' };
    return { pts: 70, label: 'OK' };
  }

  function currentAdaptiveScale(baseScale){
    // Research mode: fixed
    if (RUN_MODE === 'research') return baseScale;

    // Play mode: adaptive by combo, fever, timeLeft
    const combo = S.combo|0;
    const feverOn = S.feverActive ? 1 : 0;

    // timeLeft: estimate from elapsed vs duration
    const t = now();
    const elapsedSec = (t - S.startedAt) / 1000;
    const timeLeft = Math.max(0, (DURATION_SEC - elapsedSec));
    const time01 = DURATION_SEC > 0 ? clamp(timeLeft / DURATION_SEC, 0, 1) : 0;

    // Smaller when doing well / later in game
    const comboFactor = 1 - clamp(combo * 0.018, 0, 0.35);     // up to -35%
    const feverFactor = feverOn ? 0.82 : 1.0;                  // fever -> -18%
    const timeFactor  = 1 - (1 - time01) * 0.12;               // late game -> -12%

    let s = baseScale * comboFactor * feverFactor * timeFactor;
    s = clamp(s, 0.55, 1.35);
    return s;
  }

  function rand01(){ return Math.random(); }

  function pickKind(params){
    // decide shield / good / junk
    const r = Math.random();
    if (r < params.shieldRatio) return 'shield';
    if (r < params.shieldRatio + (1 - params.shieldRatio) * (1 - params.junkRatio)) return 'good';
    return 'junk';
  }

  function pickEmoji(kind){
    if (kind === 'good') return GOOD[(Math.random()*GOOD.length)|0];
    if (kind === 'junk') return JUNK[(Math.random()*JUNK.length)|0];
    return SHIELD;
  }

  function pickPosition(){
    // safe areas: avoid very top HUD zone
    // x: 10%..90%, y: 22%..88%
    let x = 0.10 + rand01() * 0.80;
    let y = 0.22 + rand01() * 0.66;

    // keep distance from last pos (avoid "จุดเดียว")
    const dx = x - S.lastPos.x;
    const dy = y - S.lastPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.18){
      // push away
      x = clamp(x + (dx >= 0 ? 0.18 : -0.18), 0.10, 0.90);
      y = clamp(y + (dy >= 0 ? 0.18 : -0.18), 0.22, 0.88);
    }

    S.lastPos = { x, y };
    return { x, y };
  }

  function makeTargetEl(kind, emoji){
    const el = document.createElement('div');
    el.className = 'gj-target ' + (kind === 'junk' ? 'gj-junk' : 'gj-good');
    el.textContent = emoji;

    // important for VR gaze color + raycaster
    el.setAttribute('data-hha-tgt', '1');
    el.dataset.kind = kind;

    // click/tap
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!running) return;
      const root = ev.currentTarget;
      const id = root && root.dataset ? root.dataset.tid : null;
      if (!id) return;
      onHit(id);
    });

    return el;
  }

  function placeTarget(el, pos, scale){
    const px = Math.round(pos.x * window.innerWidth);
    const py = Math.round(pos.y * window.innerHeight);
    el.style.left = px + 'px';
    el.style.top  = py + 'px';
    el.style.setProperty('--tScale', String(scale));
  }

  function spawnOne(params){
    if (!running || !LAYER) return;
    if (active.size >= params.maxActive) return;

    const kind = pickKind(params);
    const emoji = pickEmoji(kind);
    const tid = String(idSeq++);

    const pos = pickPosition();
    const scale = currentAdaptiveScale(params.baseScale);

    const el = makeTargetEl(kind, emoji);
    el.dataset.tid = tid;

    placeTarget(el, pos, scale);
    LAYER.appendChild(el);

    active.set(tid, {
      id: tid,
      el,
      kind,
      born: now(),
      lifeMs: params.lifeMs,
      x: pos.x, y: pos.y,
      scale
    });
  }

  function removeTarget(tid){
    const t = active.get(tid);
    if (!t) return;
    active.delete(tid);
    try{
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    }catch(_){}
  }

  function onHit(tid){
    const t = active.get(tid);
    if (!t) return;

    // prevent double hit
    active.delete(tid);

    const el = t.el;
    if (el){
      el.classList.add('hit');
      // remove after small delay
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 120);
    }

    updateShield();

    if (t.kind === 'good'){
      const rt = now() - t.born;
      const res = scoreForHit(rt);
      // combo + fever multiplier
      const combo = (S.combo|0) + 1;
      S.combo = combo;
      S.comboMax = Math.max(S.comboMax|0, combo)|0;

      const mult = 1 + Math.min(0.9, combo * 0.06) + (S.feverActive ? 0.35 : 0);
      const pts = Math.round(res.pts * mult);

      S.score = (S.score|0) + pts;
      S.goodHits = (S.goodHits|0) + 1;

      setJudge(res.label);
      addFever(12);

      const P = Particles();
      if (P && P.scorePop){
        P.scorePop(window.innerWidth*0.5, window.innerHeight*0.55, '+'+pts, { judgment: res.label, good: true });
      }
      if (P && P.burstAt){
        const px = t.x * window.innerWidth;
        const py = t.y * window.innerHeight;
        P.burstAt(px, py, { count: 14, good: true });
      }

      emitScore();
      return;
    }

    if (t.kind === 'shield'){
      activateShield(3500); // ได้โล่ไว้กัน 1 ครั้ง (หรือหมดเวลา)
      setJudge('SHIELD!');
      const P = Particles();
      if (P && P.scorePop){
        P.scorePop(window.innerWidth*0.5, window.innerHeight*0.55, 'SHIELD', { judgment: 'BLOCK', good: true });
      }
      emitScore();
      return;
    }

    // junk hit
    if (S.shieldActive){
      // ✅ block: NOT a miss
      S.shieldActive = false; // consume once
      const ui = FeverUI();
      if (ui && ui.setShield) ui.setShield(false);
      setJudge('BLOCK');
      const P = Particles();
      if (P && P.scorePop){
        P.scorePop(window.innerWidth*0.5, window.innerHeight*0.55, 'BLOCK', { judgment: 'SHIELD', good: true });
      }
      emitScore();
      return;
    }

    // ✅ Miss only when junk is HIT (no shield)
    addMiss('junk-hit');
    const P = Particles();
    if (P && P.scorePop){
      P.scorePop(window.innerWidth*0.5, window.innerHeight*0.55, 'MISS', { judgment: 'JUNK', good: false });
    }
  }

  function tick(params){
    if (!running) return;

    updateShield();

    const t = now();

    // expire targets
    for (const [tid, obj] of active){
      const age = t - obj.born;
      if (age >= obj.lifeMs){
        // ✅ Expire rule:
        // - good expires -> MISS
        // - junk expires -> no MISS
        // - shield expires -> no MISS
        if (obj.kind === 'good'){
          removeTarget(tid);
          addMiss('good-expired');
        }else{
          removeTarget(tid);
        }
      }
    }

    // fever decay (เบา ๆ)
    if (S.fever > 0){
      const dec = S.feverActive ? 2 : 1; // active decay faster
      S.fever = clamp((S.fever|0) - dec, 0, 100)|0;
      const ui = FeverUI();
      if (ui && ui.setFever) ui.setFever(S.fever);
      if (S.feverActive && S.fever < 30){
        S.feverActive = false;
        dispatch('hha:fever', { state: 'end' });
      }
    }

    rafId = requestAnimationFrame(()=>tick(params));
  }

  function scheduleSpawns(params){
    if (!running) return;
    spawnOne(params);

    // adaptive spawn speed (play mode only)
    let ms = params.spawnMs;
    if (RUN_MODE !== 'research'){
      // doing well -> faster spawns (harder)
      const boost = clamp((S.comboMax|0) * 18, 0, 220);
      ms = clamp(ms - boost, 520, params.spawnMs);
      if (S.feverActive) ms = clamp(ms - 120, 420, ms);
    }
    spawnTimer = window.setTimeout(()=>scheduleSpawns(params), ms);
  }

  function clearAll(){
    for (const [tid] of active) removeTarget(tid);
    active.clear();
  }

  function stop(reason){
    if (!running) return;
    running = false;

    try{ if (spawnTimer) clearTimeout(spawnTimer); }catch(_){}
    spawnTimer = 0;

    try{ if (rafId) cancelAnimationFrame(rafId); }catch(_){}
    rafId = 0;

    clearAll();

    dispatch('hha:end', {
      reason: reason || 'stop',
      scoreFinal: S.score|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0
    });
  }

  function start(diff, opts = {}){
    // reset
    stop('restart');
    running = true;

    DIFF = String(diff || 'normal').toLowerCase();
    RUN_MODE = (String(opts.runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';
    DURATION_SEC = (typeof opts.durationSec === 'number' && opts.durationSec > 0) ? (opts.durationSec|0) : 60;

    LAYER = opts.layerEl || document.getElementById('gj-layer');
    if (!LAYER){
      console.warn('[GoodJunkVR][GameEngine] layer not found');
      running = false;
      return;
    }

    // reset state
    S.score = 0;
    S.misses = 0;
    S.combo = 0;
    S.comboMax = 0;
    S.goodHits = 0;
    S.fever = 0;
    S.feverActive = false;
    S.shieldActive = false;
    S.shieldUntil = 0;
    S.startedAt = now();
    S.lastPos = { x: 0.5, y: 0.5 };

    emitScore();
    setJudge('');

    const params = DIFF_BASE[DIFF] || DIFF_BASE.normal;

    // start loops
    scheduleSpawns(params);
    rafId = requestAnimationFrame(()=>tick(params));
  }

  return { start, stop };
})();
