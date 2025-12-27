/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (PRODUCTION)
✅ Emits: hha:score / hha:rank / hha:time / hha:fever / hha:judge / hha:end
✅ Includes Goals/Mini counts INSIDE hha:end (listens quest:update)
✅ stop() accepts boolean OR reason string (compat with GroupsBoot.stop(reason))
✅ End summary always emitted (reason included)
✅ Adds HHA-ish fields: startTimeIso/endTimeIso/durationPlayedSec/durationPlannedSec
✅ Deterministic RNG by seed
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});

  // -------------------- Utilities --------------------
  function nowMs() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function randInt(rng, a, b){ return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{}
  }

  function isoNow(){ try{ return new Date().toISOString(); }catch{ return ''; } }

  function qs(name, def){
    try{
      const u = new URL(root.location.href);
      return u.searchParams.get(name) ?? def;
    }catch{
      return def;
    }
  }

  function hashSeed(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
  }
  function mulberry32(a){
    return function(){
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function readSafeInsets(){
    const cs = getComputedStyle(DOC.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
    const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
    return { sat, sab, sal, sar };
  }

  // -------------------- FX bridge --------------------
  const FX = NS.FX || {
    panic(on){ DOC.documentElement.classList.toggle('panic', !!on); },
    stunFlash(){ DOC.documentElement.classList.add('stunflash'); setTimeout(()=>DOC.documentElement.classList.remove('stunflash'), 220); },
    swapFlash(){ DOC.documentElement.classList.add('swapflash'); setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 220); },
    storm(on){ DOC.documentElement.classList.toggle('storm', !!on); },
    stormBadFlash(){ DOC.documentElement.classList.add('storm-badflash'); setTimeout(()=>DOC.documentElement.classList.remove('storm-badflash'), 180); },
    stormTick(){},
    afterimage(){ }
  };
  NS.FX = FX;

  // -------------------- Content --------------------
  const GROUPS = [
    { id:1, label:'หมู่ 1 โปรตีน 💪', good:['🥚','🥛','🐟','🥜','🍗','🧀'] },
    { id:2, label:'หมู่ 2 คาร์บ 🌾',   good:['🍚','🍞','🥔','🍠','🥨','🍜'] },
    { id:3, label:'หมู่ 3 ผัก 🥦',     good:['🥦','🥬','🥕','🌽','🥒','🍅'] },
    { id:4, label:'หมู่ 4 ผลไม้ 🍎',   good:['🍎','🍌','🍊','🍇','🍉','🍓'] },
    { id:5, label:'หมู่ 5 ไขมัน 🫒',   good:['🫒','🥑','🧈','🥥','🥜','🧀'] }
  ];

  const JUNK_EMOJI  = ['🍟','🍔','🍕','🍩','🍭','🧁','🥤','🍿','🍫','🍪'];
  const DECOY_EMOJI = ['❓','🌀','🎭','🧩','🎲'];
  const BOSS_EMOJI  = ['👹','😈','🧟','🦂','🐲'];

  const DIFF = {
    easy: {
      spawnEveryMs: [520, 820],
      lifeMs: [1150, 1700],
      size: [0.86, 1.05],
      junkRate: 0.18,
      wrongRate: 0.12,
      decoyRate: 0.08,
      bossRate: 0.07,
      bossHp: [3, 5],
      stunMs: 460,
      powerThreshold: 7,
      fever: { gainGood: 4.2, gainCombo: 0.55, loseBad: 10.0, decayPerSec: 1.15, burstAt: 92, burstMs: 5200 },
      score: { good: 120, wrong: -110, bossHit: 95, bossKill: 260, decoy: -80, junk: -120 },
      storm: { durSec: 5, shrink: 0.92, spawnMul: 0.70, stunMul: 1.25, badMissExtra: 1, goodBonus: 70 }
    },
    normal: {
      spawnEveryMs: [460, 760],
      lifeMs: [980, 1500],
      size: [0.80, 1.02],
      junkRate: 0.24,
      wrongRate: 0.16,
      decoyRate: 0.10,
      bossRate: 0.09,
      bossHp: [5, 7],
      stunMs: 680,
      powerThreshold: 9,
      fever: { gainGood: 4.6, gainCombo: 0.65, loseBad: 12.0, decayPerSec: 1.25, burstAt: 90, burstMs: 5400 },
      score: { good: 130, wrong: -125, bossHit: 105, bossKill: 310, decoy: -95, junk: -150 },
      storm: { durSec: 5, shrink: 0.90, spawnMul: 0.62, stunMul: 1.35, badMissExtra: 1, goodBonus: 85 }
    },
    hard: {
      spawnEveryMs: [390, 660],
      lifeMs: [860, 1280],
      size: [0.76, 0.98],
      junkRate: 0.30,
      wrongRate: 0.20,
      decoyRate: 0.12,
      bossRate: 0.11,
      bossHp: [6, 9],
      stunMs: 860,
      powerThreshold: 11,
      fever: { gainGood: 5.0, gainCombo: 0.75, loseBad: 14.0, decayPerSec: 1.35, burstAt: 88, burstMs: 5600 },
      score: { good: 140, wrong: -140, bossHit: 115, bossKill: 360, decoy: -110, junk: -180 },
      storm: { durSec: 5, shrink: 0.88, spawnMul: 0.58, stunMul: 1.45, badMissExtra: 1, goodBonus: 95 }
    }
  };

  function gradeFrom(acc, score){
    if (acc >= 92 && score >= 9000) return 'SSS';
    if (acc >= 88 && score >= 7400) return 'SS';
    if (acc >= 83) return 'S';
    if (acc >= 74) return 'A';
    if (acc >= 62) return 'B';
    return 'C';
  }

  // -------------------- Engine --------------------
  const Engine = (function(){
    const state = {
      running:false,
      diff:'normal',
      runMode:'play',
      seed:'',
      rng: Math.random,

      layerEl:null,
      cameraEl:null,

      targets:new Map(),
      nextId:1,

      timeLeft:90,
      timeTotal:90,
      timerInt:null,
      spawnTo:null,

      // score
      score:0,
      combo:0,
      comboMax:0,
      misses:0,

      // counters
      goodHit:0,
      goodSpawn:0,
      goodExpire:0,
      wrongHit:0,
      wrongSpawn:0,
      junkHit:0,
      junkSpawn:0,
      decoyHit:0,
      bossKills:0,

      // group/power
      groupIndex:0,
      powerCharge:0,
      powerThreshold:9,

      // status
      stunnedUntil:0,
      panicOn:false,

      // fever
      feverPct:0,
      feverBurstUntil:0,

      // adaptive
      adaptLevel:0,
      adaptTick:0,

      // storm
      stormActive:false,
      stormEndsAtMs:0,
      stormPlanIdx:0,
      stormPlan:[],
      lastStormTickLeft:999,

      // quest progress (listens quest:update)
      goalsCleared:0,
      goalsTotal:0,
      miniCleared:0,
      miniTotal:0,

      // timing
      startTimeIso:'',
      endTimeIso:'',
      startAtMs:0,

      // reason
      stopReason:''
    };

    function cfg(){ return DIFF[state.diff] || DIFF.normal; }
    function currentGroup(){ return GROUPS[state.groupIndex % GROUPS.length]; }

    function setLayerEl(el){
      state.layerEl = el;
      if (el){
        el.addEventListener('pointerdown', onPointerDown, { passive:false });
      }
    }
    function setCameraEl(el){ state.cameraEl = el || null; }

    function setTimeLeft(sec){
      sec = Math.max(1, (sec|0));
      state.timeLeft = sec;
      state.timeTotal = sec;
    }

    // ---- quest:update listener (once) ----
    let questBound = false;
    function bindQuestListenerOnce(){
      if (questBound) return;
      questBound = true;
      root.addEventListener('quest:update', (ev)=>{
        const d = ev && ev.detail ? ev.detail : {};
        if (Number.isFinite(d.goalsCleared)) state.goalsCleared = d.goalsCleared|0;
        if (Number.isFinite(d.goalsTotal))   state.goalsTotal   = d.goalsTotal|0;
        if (Number.isFinite(d.miniCleared))  state.miniCleared  = d.miniCleared|0;
        if (Number.isFinite(d.miniTotal))    state.miniTotal    = d.miniTotal|0;
      }, { passive:true });
    }

    function resetStats(){
      state.targets.clear();
      state.nextId = 1;

      state.score = 0;
      state.combo = 0;
      state.comboMax = 0;
      state.misses = 0;

      state.goodHit = 0;
      state.goodSpawn = 0;
      state.goodExpire = 0;
      state.wrongHit = 0;
      state.wrongSpawn = 0;
      state.junkHit = 0;
      state.junkSpawn = 0;
      state.decoyHit = 0;
      state.bossKills = 0;

      state.groupIndex = 0;
      state.powerCharge = 0;

      state.stunnedUntil = 0;
      state.panicOn = false;

      state.feverPct = 0;
      state.feverBurstUntil = 0;

      state.adaptLevel = 0;
      state.adaptTick = 0;

      state.stormActive = false;
      state.stormEndsAtMs = 0;
      state.stormPlanIdx = 0;
      state.lastStormTickLeft = 999;

      state.goalsCleared = 0;
      state.goalsTotal = 0;
      state.miniCleared = 0;
      state.miniTotal = 0;

      state.stopReason = '';

      if (state.layerEl) state.layerEl.innerHTML = '';
      FX.storm(false);
    }

    function planStorms(){
      const T = Math.max(30, state.timeTotal|0);
      const marks = [
        Math.round(T * 0.78),
        Math.round(T * 0.56),
        Math.round(T * 0.34),
        Math.round(T * 0.14)
      ].map(v => clamp(v, 6, T-6));
      state.stormPlan = Array.from(new Set(marks)).sort((a,b)=>b-a);
      state.stormPlanIdx = 0;
    }

    function computePlayRect(){
      const w = root.innerWidth || DOC.documentElement.clientWidth || 360;
      const h = root.innerHeight || DOC.documentElement.clientHeight || 640;
      const insets = readSafeInsets();

      const hud = DOC.querySelector('.hud-top');
      const hudRect = hud ? hud.getBoundingClientRect() : { bottom: 0 };
      const hudBottom = Math.max(0, hudRect.bottom || 0);

      const pad = 12;
      const top = Math.min(h-150, Math.max(hudBottom + 10, 10 + insets.sat + 10));
      const left = 10 + insets.sal + pad;
      const right = w - (10 + insets.sar + pad);
      const bottom = h - (10 + insets.sab + pad);

      return { left, top, right, bottom, width: Math.max(10, right-left), height: Math.max(10, bottom-top) };
    }

    function isBurstOn(){ return Date.now() < state.feverBurstUntil; }
    function isStormOn(){ return state.stormActive && Date.now() < state.stormEndsAtMs; }

    function feverEmit(){ emit('hha:fever', { pct: clamp(state.feverPct, 0, 100) }); }
    function feverAdd(delta){
      const c = cfg();
      state.feverPct = clamp(state.feverPct + (Number(delta)||0), 0, 100);
      if (!isBurstOn() && state.feverPct >= (c.fever.burstAt||90)){
        state.feverBurstUntil = Date.now() + (c.fever.burstMs||5200);
        emit('hha:judge', { text:'FEVER BURST!', kind:'boss' });
      }
      feverEmit();
    }

    function calcAccuracy(){
      // good accuracy vs (good hit + good expire + wrong hit)
      const denom = Math.max(1, state.goodHit + state.goodExpire + state.wrongHit);
      return Math.round((state.goodHit / denom) * 100);
    }

    function calcJunkErrorPct(){
      const denom = Math.max(1, state.goodHit + state.wrongHit + state.junkHit + state.decoyHit);
      return Math.round((state.junkHit / denom) * 100);
    }

    function emitScore(){
      state.comboMax = Math.max(state.comboMax, state.combo);
      emit('hha:score', { score: state.score|0, combo: state.combo|0, misses: state.misses|0, comboMax: state.comboMax|0 });
      const acc = calcAccuracy();
      emit('hha:rank', { grade: gradeFrom(acc, state.score|0), accuracy: acc|0 });
    }

    function addMiss(extra=0){
      state.misses += 1 + (extra|0);
      state.combo = 0;
      emitScore();
    }

    function powerAdd(n){
      const c = cfg();
      const th = state.powerThreshold || c.powerThreshold || 9;
      const burstBonus = isBurstOn() ? 1 : 0;
      const stormBonus = isStormOn() ? 1 : 0;

      state.powerCharge = clamp(state.powerCharge + (n|0) + burstBonus + stormBonus, 0, th);
      emit('groups:power', { charge: state.powerCharge|0, threshold: th|0 });

      if (state.powerCharge >= th){
        state.powerCharge = 0;
        emit('groups:power', { charge: 0, threshold: th|0 });
        swapGroup(+1);
      }
    }

    function maybeKaraokeOnSwap(gid){
      // optional — do not block gameplay
      const K = root.KaraokeUI;
      if (!K || !K.playGroup) return;
      try{ K.playGroup(gid, { mode:'switch' }); }catch{}
    }

    function swapGroup(dir){
      const prev = currentGroup();
      state.groupIndex = (state.groupIndex + (dir|0) + GROUPS.length) % GROUPS.length;
      const g = currentGroup();
      FX.swapFlash();
      emit('groups:group_change', { groupId:g.id, label:g.label, from:prev.id });
      emit('groups:progress', { kind:'group_swap', groupId:g.id });

      maybeKaraokeOnSwap(g.id);
    }

    function isStunned(){
      if (isBurstOn()) return false;
      return nowMs() < state.stunnedUntil;
    }

    function startStorm(){
      const c = cfg();
      const dur = (c.storm && c.storm.durSec) ? (c.storm.durSec|0) : 5;
      state.stormActive = true;
      state.stormEndsAtMs = Date.now() + dur*1000;
      state.lastStormTickLeft = 999;
      FX.storm(true);
      emit('groups:storm', { on:true, durSec: dur });
      emit('hha:judge', { text:'STORM!', kind:'warn' });
    }
    function stopStorm(){
      if (!state.stormActive) return;
      state.stormActive = false;
      state.stormEndsAtMs = 0;
      FX.storm(false);
      emit('groups:storm', { on:false });
    }

    function effectiveRates(){
      const c = cfg();
      const allowAdaptive = (state.runMode !== 'study' && state.runMode !== 'research');
      let adapt = allowAdaptive ? clamp(state.adaptLevel, -2, 2) : 0;
      const burst = isBurstOn() ? 1 : 0;

      const add = (adapt > 0 ? 0.02*adapt : 0.015*adapt);
      const bossAdd = 0.01*adapt + 0.02*burst;

      let bossRate = clamp(c.bossRate + bossAdd, 0.03, 0.18);
      let decoyRate= clamp(c.decoyRate + 0.01*adapt, 0.05, 0.18);
      let junkRate = clamp(c.junkRate + add + 0.03*burst, 0.10, 0.45);
      let wrongRate= clamp(c.wrongRate + add + 0.02*burst, 0.08, 0.40);

      if (isStormOn()){
        bossRate *= 0.92;
        wrongRate = clamp(wrongRate * 1.18, 0.10, 0.50);
        junkRate  = clamp(junkRate  * 1.12, 0.12, 0.55);
      }

      const sum = bossRate + decoyRate + junkRate + wrongRate;
      if (sum > 0.82){
        const k = 0.82 / sum;
        bossRate *= k; decoyRate *= k; junkRate *= k; wrongRate *= k;
      }
      return { bossRate, decoyRate, junkRate, wrongRate };
    }

    function spawn(){
      if (!state.running) return;

      const c = cfg();
      const play = computePlayRect();
      const rates = effectiveRates();

      const r = state.rng();
      let type = 'good';
      const b = rates.bossRate;
      const d = b + rates.decoyRate;
      const j = d + rates.junkRate;
      const w = j + rates.wrongRate;

      if (r < b) type = 'boss';
      else if (r < d) type = 'decoy';
      else if (r < j) type = 'junk';
      else if (r < w) type = 'wrong';

      const g = currentGroup();
      let emoji = pick(state.rng, g.good);

      if (type === 'junk') emoji = pick(state.rng, JUNK_EMOJI);
      if (type === 'decoy') emoji = pick(state.rng, DECOY_EMOJI);
      if (type === 'boss') emoji = pick(state.rng, BOSS_EMOJI);

      let wrongGroupId = 0;
      if (type === 'wrong'){
        const other = pick(state.rng, GROUPS.filter(x => x.id !== g.id));
        wrongGroupId = other.id;
        emoji = pick(state.rng, other.good);
      }

      let s = c.size[0] + state.rng()*(c.size[1]-c.size[0]);
      if (isBurstOn()) s *= 0.96;
      if (isStormOn()) s *= (c.storm && c.storm.shrink ? c.storm.shrink : 0.90);

      const half = (132 * s) * 0.5;
      const x = clamp(play.left + half + state.rng()*(play.width - 2*half), play.left + half, play.right - half);
      const y = clamp(play.top  + half + state.rng()*(play.height - 2*half), play.top  + half, play.bottom - half);

      let life = randInt(state.rng, c.lifeMs[0], c.lifeMs[1]);
      if (isBurstOn()) life *= 0.90;
      if (isStormOn()) life *= 0.88;

      const expireAt = nowMs() + life;

      const id = String(state.nextId++);
      const el = DOC.createElement('div');
      el.className = 'fg-target spawn';
      el.dataset.id = id;
      el.dataset.type = type;
      el.setAttribute('data-emoji', emoji);     // CSS ::before reads this
      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', y.toFixed(1) + 'px');
      el.style.setProperty('--s', s.toFixed(3));

      if (type === 'good') el.classList.add('fg-good');
      if (type === 'wrong') el.classList.add('fg-wrong');
      if (type === 'junk') el.classList.add('fg-junk');
      if (type === 'decoy') el.classList.add('fg-decoy');
      if (type === 'boss') el.classList.add('fg-boss');

      let bossHp = 0, bossHpMax = 0, bossFillEl = null;
      if (type === 'boss'){
        bossHpMax = randInt(state.rng, c.bossHp[0], c.bossHp[1]);
        bossHp = bossHpMax;

        const bar = DOC.createElement('div');
        bar.className = 'bossbar';
        const fill = DOC.createElement('div');
        fill.className = 'bossbar-fill';
        bar.appendChild(fill);
        el.appendChild(bar);
        bossFillEl = fill;
      }

      state.layerEl.appendChild(el);

      if (type === 'good') state.goodSpawn++;
      if (type === 'wrong') state.wrongSpawn++;
      if (type === 'junk') state.junkSpawn++;

      state.targets.set(id, { id, el, type, emoji, x, y, s, expireAt, dead:false, groupId:g.id, wrongGroupId, bossHp, bossHpMax, bossFillEl });

      setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch{} }, 220);

      const baseNext = randInt(state.rng, c.spawnEveryMs[0], c.spawnEveryMs[1]);
      let speed = isBurstOn() ? 0.70 : 1.0;
      if (isStormOn()) speed *= (c.storm && c.storm.spawnMul ? c.storm.spawnMul : 0.62);
      const next = Math.max(150, Math.round(baseNext * speed));
      state.spawnTo = setTimeout(spawn, next);
    }

    function removeTarget(t, reason){
      if (!t || t.dead) return;
      t.dead = true;
      state.targets.delete(t.id);
      if (t.el){
        t.el.classList.add('out');
        setTimeout(()=>{ try{ t.el.remove(); }catch{} }, 220);
      }
      if (reason === 'expire' && t.type === 'good'){
        state.goodExpire++;
        addMiss(isStormOn() ? 1 : 0);
      }
    }

    function hitRemove(t){
      if (!t || t.dead) return;
      t.dead = true;
      state.targets.delete(t.id);
      if (t.el){
        t.el.classList.add('hit');
        setTimeout(()=>{ try{ t.el.remove(); }catch{} }, 220);
      }
    }

    function findNearest(px, py, radius){
      let best=null, bestD=1e9;
      const rad = radius || 110;
      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        const dx = t.x - px, dy = t.y - py;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < bestD){ bestD = d; best = t; }
      });
      return (best && bestD <= rad) ? best : null;
    }

    function stormBadPunish(){
      const c = cfg();
      const st = c.storm || {};
      const extraMiss = (st.badMissExtra|0);
      const stunMul = Number(st.stunMul || 1.25);
      FX.stormBadFlash();
      state.stunnedUntil = Math.max(state.stunnedUntil, nowMs() + Math.round((c.stunMs|0) * stunMul));
      addMiss(extraMiss);
      feverAdd(-c.fever.loseBad * 0.70);
    }

    function hitGood(t){
      const c = cfg();
      const storm = isStormOn();
      const bonus = storm ? (c.storm.goodBonus|0) : 0;

      state.goodHit++;
      state.combo++;
      state.score += c.score.good + Math.min(260, state.combo * (isBurstOn()? 9 : 6)) + bonus;

      feverAdd(c.fever.gainGood + (storm ? 1.5 : 0));
      powerAdd(1);
      FX.afterimage(t.x, t.y, t.emoji);
      emit('hha:judge', { text: storm ? 'STORM GOOD!' : 'GOOD!', kind:'good' });
      emitScore();
    }

    function hitWrong(t){
      const c = cfg();
      state.wrongHit++;
      state.combo = 0;
      state.score += c.score.wrong;
      if (isStormOn()) stormBadPunish();
      else { addMiss(0); feverAdd(-c.fever.loseBad * 0.65); }
      FX.afterimage(t.x, t.y, '⚠️');
      emit('hha:judge', { text: isStormOn() ? 'WRONG! (STORM)' : 'WRONG GROUP!', kind:'warn' });
      emitScore();
    }

    function hitJunk(t){
      const c = cfg();
      state.junkHit++;
      state.combo = 0;
      state.score += c.score.junk;
      if (isStormOn()) stormBadPunish();
      else { addMiss(0); feverAdd(-c.fever.loseBad); state.stunnedUntil = nowMs() + (c.stunMs|0); }
      FX.stunFlash();
      emit('hha:judge', { text: isStormOn() ? 'STUN! (STORM)' : 'STUN!', kind:'bad' });
      emitScore();
    }

    function hitDecoy(t){
      const c = cfg();
      state.decoyHit++;
      state.combo = 0;
      state.score += c.score.decoy;
      if (isStormOn()) stormBadPunish();
      else { addMiss(0); feverAdd(-c.fever.loseBad * 0.55); }
      state.powerCharge = Math.max(0, state.powerCharge - 2);
      emit('groups:power', { charge: state.powerCharge|0, threshold: (state.powerThreshold|0) });
      FX.afterimage(t.x, t.y, '🌀');
      emit('hha:judge', { text: isStormOn() ? 'DECOY! (STORM)' : 'DECOY!', kind:'warn' });
      emitScore();
    }

    function hitBoss(t){
      const c = cfg();
      t.bossHp = Math.max(0, (t.bossHp|0) - 1);
      state.combo++;
      state.score += c.score.bossHit + Math.min(300, state.combo * (isBurstOn()? 10 : 7));
      feverAdd((c.fever.gainGood*0.55) + (isStormOn()? 0.9 : 0));

      if (t.bossFillEl && t.bossHpMax){
        const pct = Math.max(0, (t.bossHp / t.bossHpMax) * 100);
        t.bossFillEl.style.width = pct.toFixed(1) + '%';
      }
      if (t.el && t.bossHpMax && t.bossHp <= Math.ceil(t.bossHpMax * 0.35)){
        t.el.classList.add('rage');
      }

      if (t.bossHp <= 0){
        state.bossKills++;
        state.score += c.score.bossKill;
        powerAdd(2);
        FX.afterimage(t.x, t.y, '💥');
        emit('hha:judge', { text:'BOSS DOWN!', kind:'boss' });
        hitRemove(t);
      } else {
        emit('hha:judge', { text:'HIT!', kind:'boss' });
      }
      emitScore();
    }

    function onPointerDown(ev){
      if (!state.running || !ev) return;
      try{ ev.preventDefault(); }catch{}
      if (isStunned()) return;

      const px = ev.clientX || 0;
      const py = ev.clientY || 0;

      const t = findNearest(px, py, isBurstOn() ? 135 : 110);
      if (!t) return;

      if (t.type === 'boss'){ hitBoss(t); return; }
      hitRemove(t);

      if (t.type === 'good') hitGood(t);
      else if (t.type === 'wrong') hitWrong(t);
      else if (t.type === 'junk') hitJunk(t);
      else if (t.type === 'decoy') hitDecoy(t);
    }

    function adaptiveTick(){
      if (state.runMode === 'study' || state.runMode === 'research') return;
      state.adaptTick++;
      if (state.adaptTick % 5 !== 0) return;

      const acc = calcAccuracy();
      const missRate = state.misses / Math.max(1, state.timeTotal - state.timeLeft + 1);

      if (acc >= 86 && missRate <= 0.20) state.adaptLevel = clamp(state.adaptLevel + 1, -2, 2);
      else if (acc <= 68 || missRate >= 0.42) state.adaptLevel = clamp(state.adaptLevel - 1, -2, 2);
    }

    function stormTickLogic(){
      if (!isStormOn()) return;
      const left = Math.max(0, Math.ceil((state.stormEndsAtMs - Date.now())/1000));
      if (left !== state.lastStormTickLeft){
        state.lastStormTickLeft = left;
        FX.stormTick(left);
      }
      if (Date.now() >= state.stormEndsAtMs) stopStorm();
    }

    function tickSecond(){
      if (!state.running) return;

      state.timeLeft = Math.max(0, (state.timeLeft|0) - 1);
      emit('hha:time', { left: state.timeLeft|0 });

      if (state.stormPlanIdx < state.stormPlan.length){
        const mark = state.stormPlan[state.stormPlanIdx]|0;
        if (state.timeLeft === mark){
          startStorm();
          state.stormPlanIdx++;
        }
      }
      stormTickLogic();

      const c = cfg();
      state.feverPct = clamp(state.feverPct - (c.fever.decayPerSec||1.2), 0, 100);
      feverEmit();

      adaptiveTick();

      const panic = state.timeLeft <= 12 && state.timeLeft > 0;
      if (panic !== state.panicOn){
        state.panicOn = panic;
        FX.panic(panic);
      }

      const tnow = nowMs();
      const exp = [];
      state.targets.forEach((t)=>{ if (t && !t.dead && tnow >= t.expireAt) exp.push(t); });
      for (let i=0;i<exp.length;i++) removeTarget(exp[i], 'expire');

      if (state.timeLeft <= 0) stop(true, 'timeup');
    }

    function start(diff, opts){
      opts = opts || {};

      bindQuestListenerOnce();

      state.diff = String(diff || 'normal').toLowerCase();
      if (!DIFF[state.diff]) state.diff = 'normal';

      state.runMode = String(opts.runMode || 'play').toLowerCase();
      state.seed = String(opts.seed || '');

      const seedNum = state.seed ? hashSeed(state.seed) : (Math.random()*1e9)>>>0;
      state.rng = mulberry32(seedNum);

      const c = cfg();
      state.powerThreshold = (c.powerThreshold|0);

      if (!state.layerEl){
        console.warn('[GroupsVR] layer not set');
        return;
      }

      resetStats();
      planStorms();

      state.running = true;

      // timing
      state.startTimeIso = isoNow();
      state.endTimeIso = '';
      state.startAtMs = nowMs();

      // emit initial HUD
      emit('groups:group_change', { groupId: currentGroup().id, label: currentGroup().label, from: 0 });
      emit('groups:power', { charge:0, threshold: state.powerThreshold|0 });
      emit('hha:time', { left: state.timeLeft|0 });
      feverEmit();
      emitScore();

      // optional karaoke intro on start (group 1)
      try{
        const K = root.KaraokeUI;
        if (K && K.playGroup) K.playGroup(currentGroup().id, { mode:'switch' });
      }catch{}

      clearInterval(state.timerInt);
      state.timerInt = setInterval(tickSecond, 1000);

      clearTimeout(state.spawnTo);
      state.spawnTo = setTimeout(spawn, 260);
    }

    // stop(ended:boolean, reason?:string) OR stop(reason:string)  (backward compat)
    function stop(a, b){
      if (!state.running) return;

      let ended = true;
      let reason = 'stop';

      if (typeof a === 'boolean'){
        ended = a;
        reason = String(b || (ended ? 'ended' : 'stop'));
      } else if (typeof a === 'string'){
        ended = true;           // Boot.stop(reason) should still show end summary
        reason = a || 'stop';
      } else {
        ended = true;
        reason = 'stop';
      }

      state.running = false;
      state.stopReason = reason;

      clearInterval(state.timerInt);
      clearTimeout(state.spawnTo);
      state.timerInt = null;
      state.spawnTo = null;

      FX.panic(false);
      stopStorm();

      // always emit end summary (ended or forced stop)
      const acc = calcAccuracy();
      const grade = gradeFrom(acc, state.score|0);

      state.endTimeIso = isoNow();
      const durationPlayedSec = Math.max(0, Math.round((nowMs() - (state.startAtMs || nowMs())) / 1000));

      emit('hha:rank', { grade, accuracy: acc|0 });

      emit('hha:end', {
        // --- core ---
        game:'groups',
        diff: state.diff,
        runMode: state.runMode,
        seed: state.seed,
        reason: reason,

        // --- timing ---
        startTimeIso: state.startTimeIso || '',
        endTimeIso: state.endTimeIso || '',
        durationPlannedSec: state.timeTotal|0,
        durationPlayedSec: durationPlayedSec|0,

        // --- score ---
        scoreFinal: state.score|0,
        comboMax: state.comboMax|0,
        misses: state.misses|0,
        accuracyGoodPct: acc|0,
        grade,

        // --- quest progress (now inside engine) ---
        goalsCleared: state.goalsCleared|0,
        goalsTotal: state.goalsTotal|0,
        miniCleared: state.miniCleared|0,
        miniTotal: state.miniTotal|0,

        // --- counters (HHA-ish mapping) ---
        nTargetGoodSpawned: state.goodSpawn|0,
        nTargetJunkSpawned: state.junkSpawn|0,
        nHitGood: state.goodHit|0,
        nHitJunk: state.junkHit|0,
        nExpireGood: state.goodExpire|0,
        junkErrorPct: calcJunkErrorPct()|0,

        // keep raw counters too
        goodHit: state.goodHit|0,
        goodSpawn: state.goodSpawn|0,
        goodExpire: state.goodExpire|0,
        wrongHit: state.wrongHit|0,
        wrongSpawn: state.wrongSpawn|0,
        junkHit: state.junkHit|0,
        junkSpawn: state.junkSpawn|0,
        decoyHit: state.decoyHit|0,
        bossKills: state.bossKills|0
      });
    }

    return { setLayerEl, setCameraEl, setTimeLeft, start, stop };
  })();

  NS.GameEngine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);