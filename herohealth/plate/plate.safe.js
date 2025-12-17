// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — DOM Target Engine (GoodJunk-style, NO a-text, NO msdf)
// - Emoji targets in DOM overlay (#plate-layer)
// - Click/tap on mobile/PC
// - VR gaze fuse via elementFromPoint() center
// - Emits events: hha:score, hha:judge, hha:time, quest:update, hha:end
//
// 2025-12-17 (DOM conversion):
// ✅ Fix black screen by removing A-Frame text usage completely
// ✅ Target spawn/expire handled in DOM, no hidden 3D entities
// ✅ Miss only from: junk hit OR good expire (configurable)
// ✅ Perfect plate when collect groups 1–5 in same plate

'use strict';

export function bootPlateDOM(opts = {}) {
  const layer = opts.layerEl || document.getElementById('plate-layer');
  if (!layer) {
    console.error('[PlateVR] plate-layer not found');
    return;
  }

  const diff = String(opts.diff || 'normal').toLowerCase();
  const runMode = (String(opts.runMode || 'play').toLowerCase() याद)? (String(opts.runMode || 'play').toLowerCase()) : 'play';
  const durationSec = Math.max(20, Math.min(180, (opts.durationSec|0) || 70));

  // ---- FX helper ----
  function getParticlesAPI(){
    const gm = window.GAME_MODULES || {};
    return gm.Particles || window.Particles || null;
  }

  // ---- Random helpers ----
  const R = (a,b)=> a + Math.random()*(b-a);
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));

  // ---- Difficulty tuning ----
  const DIFF = {
    easy:   { spawnMs: 850,  lifeMs: 2400, maxActive: 6,  junkRatio: 0.18, drift: 0.7,  missOnGoodExpire: false },
    normal: { spawnMs: 720,  lifeMs: 2200, maxActive: 7,  junkRatio: 0.22, drift: 0.85, missOnGoodExpire: true  },
    hard:   { spawnMs: 600,  lifeMs: 1850, maxActive: 8,  junkRatio: 0.28, drift: 1.05, missOnGoodExpire: true  },
  }[diff] || { spawnMs: 720, lifeMs: 2200, maxActive: 7, junkRatio: 0.22, drift: 0.85, missOnGoodExpire: true };

  // ---- Plate content (emoji by food group) ----
  const GROUPS = {
    1: ['🥚','🥛','🫘','🍗','🐟'],
    2: ['🍚','🍞','🍜','🥔','🌽'],
    3: ['🥦','🥬','🥒','🥕','🍅'],
    4: ['🍎','🍌','🍊','🍇','🍉'],
    5: ['🥑','🫒','🥜','🧈','🫗'], // (emoji อาจไม่รองรับทุกเครื่อง แต่ไม่พัง)
  };
  const JUNK = ['🍟','🍔','🍕','🍭','🍩','🥤'];

  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // ---- Game state ----
  let started = true;
  let timeLeft = durationSec;
  let timerId = null;
  let spawnId = null;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let fever = 0; // 0..100
  const FEVER_GAIN = 7;
  const FEVER_DECAY = 6;

  // Plate state: collect 1..5 then perfect++
  const have = {1:0,2:0,3:0,4:0,5:0};
  let groupsHave = 0;
  let perfectPlates = 0;

  // Quest: Goal = perfect plates >=2
  // Mini quest: "Plate Rush" = make 1 perfect within 15s (repeat 3 minis)
  const GOAL_TARGET = 2;
  const MINI_TOTAL = 3;
  const MINI_WINDOW = 15;

  let goalsCleared = 0;
  let goalsTotal = 1;

  let miniCleared = 0;
  let miniTotal = MINI_TOTAL;
  let miniActive = true;
  let miniTimer = MINI_WINDOW;
  let miniStartPerfectBase = 0;

  // ---- Emit helpers ----
  function emit(name, detail){
    window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function emitScore(judgeLabel){
    const feverPct = clamp(Math.round(fever), 0, 100);
    emit('hha:score', {
      score, combo, misses,
      feverPct,
      groupsHave,
      perfectPlates
    });
    if (judgeLabel) emit('hha:judge', { label: judgeLabel });
  }

  function updateQuestUI(){
    goalsCleared = (perfectPlates >= GOAL_TARGET) ? 1 : 0;

    // mini logic
    let miniProg = miniCleared;
    let miniTgt = MINI_TOTAL;

    // main
    emit('quest:update', {
      goal: {
        label: `ทำ PERFECT PLATE ให้ได้อย่างน้อย ${GOAL_TARGET} จาน`,
        prog: perfectPlates,
        target: GOAL_TARGET
      },
      mini: {
        label: `Plate Rush ${miniCleared}/${MINI_TOTAL} — ทำ Perfect ภายใน ${MINI_WINDOW}s`,
        prog: miniCleared,
        target: MINI_TOTAL
      },
      hint: (miniActive ? `เวลาที่เหลือสำหรับ Mini: ${miniTimer}s` : ''),
      goalsAll: [{ done: goalsCleared >= 1 }],
      minisAll: new Array(MINI_TOTAL).fill(0).map((_,i)=>({ done: i < miniCleared }))
    });
  }

  // ---- DOM targets ----
  let activeTargets = new Set();

  function mkTarget({ kind, emoji, group }){
    const el = document.createElement('div');
    el.className = 'p-target ' + (kind === 'junk' ? 'junk' : 'good');
    el.textContent = emoji;
    el.dataset.kind = kind; // good / junk
    if (group) el.dataset.group = String(group);

    // spawn position (safe pad)
    const pad = 70;
    const x = pad + Math.random() * Math.max(10, (window.innerWidth - pad*2));
    const y = pad + Math.random() * Math.max(10, (window.innerHeight - pad*2));
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // drift
    const drift = DIFF.drift;
    const vx = R(-0.18, 0.18) * drift;
    const vy = R(-0.12, 0.14) * drift;

    const born = performance.now();
    const lifeMs = DIFF.lifeMs;
    let dead = false;

    function kill(reason){
      if (dead) return;
      dead = true;
      try{ el.remove(); }catch(_){}
      activeTargets.delete(el);

      // expire penalty (only if good and configured)
      if (reason === 'expire' && kind !== 'junk' && DIFF.missOnGoodExpire){
        addMiss('GOOD EXPIRED');
      }
    }

    // motion loop (cheap)
    function tick(){
      if (dead) return;
      const t = performance.now() - born;

      // expire
      if (t >= lifeMs){
        kill('expire');
        return;
      }

      // move
      const cx = parseFloat(el.style.left||'0') + vx * 16;
      const cy = parseFloat(el.style.top ||'0') + vy * 16;
      el.style.left = clamp(cx, 50, window.innerWidth - 50) + 'px';
      el.style.top  = clamp(cy, 80, window.innerHeight - 80) + 'px';

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // hit handler
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (dead) return;

      el.classList.add('hit');
      setTimeout(()=> kill('hit'), 120);

      if (kind === 'junk'){
        addMiss('HIT JUNK');
        const P = getParticlesAPI();
        if (P?.burstAt) P.burstAt(ev.clientX, ev.clientY, { count: 14, good:false });
        if (P?.scorePop) P.scorePop(ev.clientX, ev.clientY, '-MISS', { judgment:'JUNK', good:false });
        return;
      }

      // good: collect group
      const g = parseInt(el.dataset.group||'0',10) || 0;
      if (g >= 1 && g <= 5){
        if (have[g] === 0){
          have[g] = 1;
          groupsHave++;
          addScore(80, 'GOOD +GROUP');
        } else {
          addScore(35, 'GOOD');
        }
      } else {
        addScore(50, 'GOOD');
      }

      const P = getParticlesAPI();
      if (P?.burstAt) P.burstAt(ev.clientX, ev.clientY, { count: 16, good:true });
      if (P?.scorePop) P.scorePop(ev.clientX, ev.clientY, '+', { judgment:'GOOD', good:true });

      // check perfect plate
      if (groupsHave >= 5){
        perfectPlates++;
        // reset plate
        for (let i=1;i<=5;i++) have[i]=0;
        groupsHave = 0;

        addScore(250, 'PERFECT PLATE!');
        emit('hha:judge', { label: 'PERFECT PLATE! 🌟' });

        // mini quest progress: within window
        if (miniActive && perfectPlates > miniStartPerfectBase){
          miniCleared = Math.min(MINI_TOTAL, miniCleared + 1);
          miniActive = (miniCleared < MINI_TOTAL);
          miniTimer = MINI_WINDOW;
          miniStartPerfectBase = perfectPlates;

          const P2 = getParticlesAPI();
          if (P2?.burstAt) P2.burstAt(window.innerWidth*0.5, window.innerHeight*0.22, { count: 22, good:true });
          if (P2?.scorePop) P2.scorePop(window.innerWidth*0.5, window.innerHeight*0.22, 'MISSION CLEAR!', { judgment:`Mini ${miniCleared}/${MINI_TOTAL}`, good:true });
        }
      }

      updateQuestUI();
      emitScore();
    }, { passive:false });

    return el;
  }

  function spawnOne(){
    if (!started) return;
    if (activeTargets.size >= DIFF.maxActive) return;

    const isJunk = Math.random() < DIFF.junkRatio;

    if (isJunk){
      const el = mkTarget({ kind:'junk', emoji: pick(JUNK) });
      layer.appendChild(el);
      activeTargets.add(el);
      return;
    }

    // good target: choose a group (prefer missing)
    const missing = [];
    for (let i=1;i<=5;i++) if (!have[i]) missing.push(i);
    const g = (missing.length ? missing[(Math.random()*missing.length)|0] : (1 + ((Math.random()*5)|0)));
    const el = mkTarget({ kind:'good', emoji: pick(GROUPS[g] || ['🥗']), group:g });
    layer.appendChild(el);
    activeTargets.add(el);
  }

  // ---- Score / miss ----
  function addScore(pts, judge){
    score += (pts|0);
    combo += 1;
    comboMax = Math.max(comboMax, combo);

    fever = clamp(fever + FEVER_GAIN, 0, 100);
    emitScore(judge || '');
  }

  function addMiss(judge){
    misses += 1;
    combo = 0;
    fever = clamp(fever - FEVER_DECAY*2, 0, 100);

    emit('hha:judge', { label: judge || 'MISS' });
    emitScore('MISS');

    updateQuestUI();
  }

  // ---- VR Gaze fuse ----
  const reticleWrap = document.getElementById('reticle-progress');
  const reticleRing = document.getElementById('reticle-ring');

  let gazeEnabled = false;
  let fuseMs = 650;
  let gazeRAF = null;
  let lastHoverEl = null;
  let hoverStart = 0;

  function showReticle(show){
    if (!reticleWrap) return;
    reticleWrap.classList.toggle('show', !!show);
  }

  function setReticleColor(kind){
    let c = '#e5e7eb';
    if (kind === 'good') c = '#22c55e';
    if (kind === 'junk') c = '#f97316';
    if (reticleWrap) reticleWrap.style.setProperty('--rp-color', c);
  }

  function setReticleProgress01(p01){
    if (!reticleRing || !reticleWrap) return;
    const deg = Math.max(0, Math.min(360, Math.round(p01 * 360)));
    const color = getComputedStyle(reticleWrap).getPropertyValue('--rp-color') || '#38bdf8';
    reticleRing.style.background = `conic-gradient(${color} ${deg}deg, rgba(255,255,255,0.12) 0deg)`;
  }

  function firePointerDownAtCenter(el){
    try{
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      const evt = new PointerEvent('pointerdown', {
        bubbles:true,
        cancelable:true,
        clientX: cx,
        clientY: cy,
        pointerId: 1,
        pointerType: 'mouse'
      });
      el.dispatchEvent(evt);
    }catch(_){
      try{ el.click(); }catch(__){}
    }
  }

  function gazeLoop(){
    if (!gazeEnabled) return;

    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.5;

    const el = document.elementFromPoint(cx, cy);
    const tgt = el && typeof el.closest === 'function' ? el.closest('.p-target') : null;

    if (tgt && layer.contains(tgt)){
      const kind = (tgt.classList.contains('junk') ? 'junk' : 'good');
      setReticleColor(kind);

      if (lastHoverEl !== tgt){
        lastHoverEl = tgt;
        hoverStart = performance.now();
        setReticleProgress01(0);
        showReticle(true);
      } else {
        const dt = performance.now() - hoverStart;
        const p = fuseMs > 0 ? (dt / fuseMs) : 0;
        setReticleProgress01(Math.min(1, p));
        if (p >= 1){
          firePointerDownAtCenter(tgt);
          lastHoverEl = null;
          hoverStart = performance.now();
          setReticleProgress01(0);
          showReticle(false);
        }
      }
    } else {
      lastHoverEl = null;
      hoverStart = 0;
      setReticleProgress01(0);
      showReticle(false);
    }

    gazeRAF = requestAnimationFrame(gazeLoop);
  }

  function enableGaze(on){
    gazeEnabled = !!on;
    if (!gazeEnabled){
      if (gazeRAF) cancelAnimationFrame(gazeRAF);
      gazeRAF = null;
      lastHoverEl = null;
      hoverStart = 0;
      setReticleProgress01(0);
      showReticle(false);
    } else {
      showReticle(true);
      gazeRAF = requestAnimationFrame(gazeLoop);
    }
  }

  function hookVrModeAutoSwitch(){
    const scene = document.querySelector('a-scene');
    if (!scene) return;

    scene.addEventListener('enter-vr', () => {
      enableGaze(true);
      emit('hha:judge', { label: 'VR: จ้องค้างเพื่อยิง 🎯' });
    });

    scene.addEventListener('exit-vr', () => {
      enableGaze(false);
      emit('hha:judge', { label: 'แตะ/คลิกเป้าได้เลย 👆' });
    });
  }

  // ---- Main loops ----
  function tickTime(){
    timeLeft -= 1;
    if (timeLeft < 0) return;

    // mini timer
    if (miniActive && miniCleared < MINI_TOTAL){
      miniTimer -= 1;
      if (miniTimer <= 0){
        miniTimer = MINI_WINDOW;
        miniStartPerfectBase = perfectPlates; // reset window
      }
    }

    emit('hha:time', { sec: timeLeft });
    updateQuestUI();

    // fever decay slowly when no combo
    if (combo === 0) fever = clamp(fever - 1.2, 0, 100);

    if (timeLeft <= 0){
      stop('time-up');
    }
  }

  function stop(reason){
    if (!started) return;
    started = false;

    try{ clearInterval(timerId); }catch(_){}
    try{ clearInterval(spawnId); }catch(_){}

    // clear targets
    activeTargets.forEach(el => { try{ el.remove(); }catch(_){} });
    activeTargets.clear();

    emit('hha:end', {
      reason: reason || 'end',
      score,
      comboMax,
      misses,
      perfectPlates,
      goalsCleared: (perfectPlates >= GOAL_TARGET) ? 1 : 0,
      goalsTotal: 1,
      miniCleared,
      miniTotal: MINI_TOTAL
    });
  }

  // ---- Start ----
  emit('hha:judge', { label: 'เริ่มเลย! เก็บให้ครบหมู่ 1–5 แล้วจะได้ PERFECT PLATE 🌟' });
  emit('hha:time', { sec: timeLeft });
  emitScore();
  updateQuestUI();

  // spawn loop
  spawnId = setInterval(() => {
    // spawn 1–2 per tick (hard faster)
    spawnOne();
    if (diff === 'hard' && Math.random() < 0.55) spawnOne();
  }, DIFF.spawnMs);

  // time loop
  timerId = setInterval(tickTime, 1000);

  // VR gaze
  hookVrModeAutoSwitch();

  // stop on hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop('tab-hidden');
  }, { passive:true });

  // expose for debug
  window.__PLATE_DOM_STOP__ = stop;
  console.log('[PlateVR] DOM engine started', { diff, runMode, durationSec });
}