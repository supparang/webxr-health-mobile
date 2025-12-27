/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (HARDCORE+++ / classic script)
✅ window.GroupsVR.GameEngine (no module import)
✅ Spawn GOOD/JUNK/DECOY/BOSS on #fg-layer
✅ Safe-zone avoids HUD + safe-area + edges
✅ VR-look (drag + optional gyro) + shake additive vars
✅ STORM MODE (time + streak) => faster spawns, shorter life, double-spawn
✅ Perfect Streak => Slow-mo + Shield + Reward goods (cooldown)
✅ Junk Chain Stun => stun stacks + burst
✅ Boss patterns: dash + bullets + rage summon
✅ Emits:
  - hha:score {score, combo, misses, comboMax}
  - hha:rank  {grade, accuracy}
  - hha:time  {left}
  - hha:end   {... + extra metrics}
  - hha:shake {ms,intensity}
  - hha:slowmo {on,speed,ms,reason}
  - groups:group_change {groupId,label}
  - groups:power {charge,threshold}
  - groups:storm {level,on,reason}
  - groups:stun {ms,chain}
  - groups:boss_rage {on}
  - groups:boss_roar {}
  - groups:shield {on,charges,ms,reason}
*/

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});

  function nowMs() { return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function randInt(rng, a, b){ return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }
  function emit(name, detail){ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }

  // RNG
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

  // FX hooks (fallback if groups-fx.js missing)
  const FX = {
    panic(on){ DOC.documentElement.classList.toggle('panic', !!on); },
    stunFlash(){
      DOC.documentElement.classList.add('stunflash');
      setTimeout(()=>DOC.documentElement.classList.remove('stunflash'), 220);
    },
    swapFlash(){
      DOC.documentElement.classList.add('swapflash');
      setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 220);
    }
  };
  NS.FX = NS.FX || FX;

  // Content
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
  const BULLET_EMOJI = ['💥','☠️','🧨','⚡','🔥'];

  // Difficulty
  const DIFF = {
    easy:   { timeDefault:90, spawnEveryMs:[650,900], lifeMs:[1300,1750], size:[0.88,1.05], junkRate:0.16, decoyRate:0.08, bossRate:0.06, bossHp:[3,4], stunMs:450, powerThreshold:7,  score:{good:120,bossHit:90,bossKill:220,decoy:-60,junk:-90,bullet:-70}  },
    normal: { timeDefault:90, spawnEveryMs:[520,800], lifeMs:[1050,1550], size:[0.82,1.02], junkRate:0.22, decoyRate:0.10, bossRate:0.08, bossHp:[4,6], stunMs:650, powerThreshold:9,  score:{good:130,bossHit:95,bossKill:260,decoy:-70,junk:-110,bullet:-85} },
    hard:   { timeDefault:90, spawnEveryMs:[430,690], lifeMs:[900,1300],  size:[0.76,0.98], junkRate:0.28, decoyRate:0.12, bossRate:0.10, bossHp:[6,8], stunMs:820, powerThreshold:11, score:{good:140,bossHit:105,bossKill:320,decoy:-80,junk:-140,bullet:-105} }
  };

  function gradeFrom(acc, score){
    if (acc >= 92 && score >= 8500) return 'SSS';
    if (acc >= 88 && score >= 7000) return 'SS';
    if (acc >= 83) return 'S';
    if (acc >= 74) return 'A';
    if (acc >= 62) return 'B';
    return 'C';
  }

  const Engine = (function(){
    const state = {
      running:false,
      diff:'normal',
      runMode:'play',
      seed:'',
      rng: Math.random,

      layerEl:null,
      targets:new Map(),
      nextId:1,

      timeLeft:90,
      timeTotal:90,
      timerInt:null,
      spawnTo:null,
      frameRaf:0,

      score:0,
      combo:0,
      comboMax:0,
      misses:0,

      goodHit:0,
      goodSpawn:0,
      goodExpire:0,
      junkHit:0,
      junkSpawn:0,
      decoyHit:0,
      bossKills:0,

      // extras
      bossSpawn:0,
      bossHit:0,
      bulletSpawn:0,
      bulletHit:0,
      slowmoCount:0,
      shieldBlocks:0,
      stormMax:0,
      stormMs:0,
      stormLastAt:0,

      groupIndex:0,
      powerCharge:0,
      powerThreshold:9,

      stunnedUntil:0,
      panicOn:false,

      // look
      lookX:0, lookY:0, lookTX:0, lookTY:0,
      lookMaxX:24, lookMaxY:18,
      pointerDown:false, downX:0, downY:0, moved:false,

      lastPointer:{x:0,y:0},
      lockedId:null,
      lockStartMs:0,
      lockNeedMs:220,

      // Storm
      stormLevel:0,
      stormUntilMs:0,

      // Perfect streak
      streakGood:0,
      streakNeed:14,
      streakCooldownUntil:0,

      // Chain junk
      junkChain:0,
      lastJunkAt:0,

      // Slowmo
      slowmoOn:false,
      slowmoSpeed:1,          // <1 means slower
      slowmoUntil:0,

      // Shield
      shieldCharges:0,
      shieldUntil:0,

      // Boss rage flag
      bossRageOn:false
    };

    function cfg(){ return DIFF[state.diff] || DIFF.normal; }
    function currentGroup(){ return GROUPS[state.groupIndex % GROUPS.length]; }
    function isStunned(){ return nowMs() < state.stunnedUntil; }
    function isShield(){ return state.shieldCharges > 0 && nowMs() < state.shieldUntil; }

    function applyLookVars(){
      DOC.documentElement.style.setProperty('--lookX', state.lookX.toFixed(1) + 'px');
      DOC.documentElement.style.setProperty('--lookY', state.lookY.toFixed(1) + 'px');
    }

    function tickFrame(){
      if (!state.running) return;

      // collect storm time
      const now = nowMs();
      if (state.stormLevel > 0){
        if (state.stormLastAt) state.stormMs += Math.max(0, now - state.stormLastAt);
        state.stormLastAt = now;
      } else {
        state.stormLastAt = 0;
      }

      // boss actions (dash/shoot) - lightweight scan
      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        if (t.type !== 'boss') return;

        if (now >= (t.nextActAt || 0)){
          bossAct(t);
        }
      });

      state.frameRaf = root.requestAnimationFrame(tickFrame);
    }

    function startFrame(){ if (!state.frameRaf) state.frameRaf = root.requestAnimationFrame(tickFrame); }
    function stopFrame(){
      if (!state.frameRaf) return;
      try{ root.cancelAnimationFrame(state.frameRaf); }catch(e){}
      state.frameRaf = 0;
    }

    // -------- Slowmo (time scaling by shifting expireAt) --------
    function rescaleAllExpire(speed){
      // speed < 1 => slower => extend remaining time by /speed
      const now = nowMs();
      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        const rem = Math.max(0, (t.expireAt || now) - now);
        t.expireAt = now + (rem / Math.max(0.10, speed));
      });
    }
    function unscaleAllExpire(speed){
      // when leaving slowmo, compress remaining by *speed
      const now = nowMs();
      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        const rem = Math.max(0, (t.expireAt || now) - now);
        t.expireAt = now + (rem * Math.max(0.10, speed));
      });
    }

    function startSlowmo(ms, speed, reason){
      const now = nowMs();
      if (state.slowmoOn) return;
      if (now < state.streakCooldownUntil) return;

      speed = clamp(speed || 0.65, 0.45, 0.85);
      ms = clamp(ms || 900, 400, 1400);

      state.slowmoOn = true;
      state.slowmoSpeed = speed;
      state.slowmoUntil = now + ms;
      state.slowmoCount++;

      DOC.documentElement.classList.add('slowmo');
      emit('hha:slowmo', { on:true, speed, ms, reason: reason || 'streak' });

      // extend lifetimes
      rescaleAllExpire(speed);

      // end
      setTimeout(()=>{
        stopSlowmo();
      }, ms);
    }

    function stopSlowmo(){
      if (!state.slowmoOn) return;
      const speed = state.slowmoSpeed || 0.65;

      state.slowmoOn = false;
      state.slowmoSpeed = 1;
      state.slowmoUntil = 0;

      DOC.documentElement.classList.remove('slowmo');
      emit('hha:slowmo', { on:false });

      // compress remaining lifetimes back
      unscaleAllExpire(speed);
    }

    // -------- Shield --------
    function giveShield(charges, ms, reason){
      const now = nowMs();
      charges = clamp(charges || 1, 1, 3)|0;
      ms = clamp(ms || 3200, 1200, 8000)|0;

      state.shieldCharges = Math.max(state.shieldCharges|0, charges);
      state.shieldUntil = Math.max(state.shieldUntil|0, now + ms);

      emit('groups:shield', { on:true, charges: state.shieldCharges|0, ms, reason: reason || 'reward' });
    }
    function consumeShield(){
      if (!isShield()) return false;
      state.shieldCharges = Math.max(0, (state.shieldCharges|0) - 1);
      state.shieldBlocks++;
      emit('groups:shield', { on: state.shieldCharges>0, charges: state.shieldCharges|0, ms: Math.max(0, (state.shieldUntil-nowMs())|0), reason:'block' });
      return true;
    }

    // -------- Storm model --------
    function stormFromTime(){
      if (state.timeLeft <= 6 && state.timeLeft > 0) return 3;
      if (state.timeLeft <= 12 && state.timeLeft > 0) return 2;
      return 0;
    }
    function stormFromStreak(){
      const now = nowMs();
      if (now < state.stormUntilMs) return state.stormLevel|0;
      return 0;
    }
    function setStorm(level, reason){
      level = level|0;
      if (level === state.stormLevel) return;
      state.stormLevel = level;
      state.stormMax = Math.max(state.stormMax, level);
      emit('groups:storm', { level, on: level>0, reason: reason || 'auto' });
      DOC.documentElement.classList.toggle('storm', level>0);
      DOC.documentElement.classList.toggle('storm2', level>=2);
      DOC.documentElement.classList.toggle('storm3', level>=3);
    }
    function stormMult(){
      const lvl = state.stormLevel|0;
      return 1 + 0.52*lvl; // heavier: 1.52 / 2.04 / 2.56
    }
    function maybeEnterStormByCombo(){
      const c = state.combo|0;
      let lvl = 0;
      if (c >= 38) lvl = 3;
      else if (c >= 24) lvl = 2;
      else if (c >= 12) lvl = 1;

      if (lvl > 0){
        state.stormLevel = Math.max(state.stormLevel, lvl);
        state.stormMax = Math.max(state.stormMax, state.stormLevel);
        state.stormUntilMs = Math.max(state.stormUntilMs, nowMs() + (2400 + lvl*1300));
        emit('groups:storm', { level: state.stormLevel|0, on:true, reason:'streak' });
        DOC.documentElement.classList.toggle('storm', state.stormLevel>0);
        DOC.documentElement.classList.toggle('storm2', state.stormLevel>=2);
        DOC.documentElement.classList.toggle('storm3', state.stormLevel>=3);
      }
    }

    function buildRates(base){
      const lvl = state.stormLevel|0;
      let bossRate  = base.bossRate;
      let decoyRate = base.decoyRate;
      let junkRate  = base.junkRate;

      if (lvl > 0){
        bossRate  = Math.min(0.26, bossRate  + 0.02*lvl);
        decoyRate = Math.min(0.26, decoyRate + 0.02*lvl);
        junkRate  = Math.min(0.48, junkRate  + 0.035*lvl);
      }
      const sum = bossRate + decoyRate + junkRate;
      if (sum > 0.93){
        const k = 0.93 / sum;
        bossRate *= k; decoyRate *= k; junkRate *= k;
      }
      return { bossRate, decoyRate, junkRate };
    }

    // -------- Core metrics --------
    function calcAccuracy(){
      const denom = Math.max(1, state.goodHit + state.goodExpire);
      return Math.round((state.goodHit / denom) * 100);
    }

    function emitScore(){
      state.comboMax = Math.max(state.comboMax, state.combo);
      emit('hha:score', { score: state.score|0, combo: state.combo|0, misses: state.misses|0, comboMax: state.comboMax|0 });
      const acc = calcAccuracy();
      emit('hha:rank', { grade: gradeFrom(acc, state.score|0), accuracy: acc|0 });

      maybeEnterStormByCombo();
    }

    function addMiss(){
      state.misses += 1;
      state.combo = 0;
      state.streakGood = 0;
      emitScore();
    }

    function powerAdd(n){
      const c = cfg();
      const th = state.powerThreshold || c.powerThreshold || 9;
      state.powerCharge = clamp(state.powerCharge + (n|0), 0, th);
      emit('groups:power', { charge: state.powerCharge|0, threshold: th|0 });

      if (state.powerCharge >= th){
        state.powerCharge = 0;
        emit('groups:power', { charge: 0, threshold: th|0 });
        swapGroup(+1);
      }
    }

    function swapGroup(dir){
      const prev = currentGroup();
      state.groupIndex = (state.groupIndex + (dir|0) + GROUPS.length) % GROUPS.length;
      const g = currentGroup();
      (NS.FX || FX).swapFlash();
      emit('hha:shake', { ms: 140, intensity: 6 });
      emit('groups:group_change', { groupId: g.id, label: g.label, from: prev.id });
      emit('groups:progress', { kind:'group_swap', groupId:g.id });
    }

    // -------- Layout safe rect --------
    function computePlayRect(){
      const w = root.innerWidth || DOC.documentElement.clientWidth || 360;
      const h = root.innerHeight || DOC.documentElement.clientHeight || 640;
      const insets = readSafeInsets();

      const hud = DOC.querySelector('.hud-top');
      const hudRect = hud ? hud.getBoundingClientRect() : { bottom: 0 };
      const hudBottom = Math.max(0, hudRect.bottom || 0);

      const pad = 12;
      const mx = state.lookMaxX + 6;
      const my = state.lookMaxY + 6;

      const top = Math.min(h-140, Math.max(hudBottom + 10 + my, 10 + insets.sat + 10 + my));
      const left = 10 + insets.sal + pad + mx;
      const right = w - (10 + insets.sar + pad + mx);
      const bottom = h - (10 + insets.sab + pad + my);

      return { left, top, right, bottom, width: Math.max(10,right-left), height: Math.max(10,bottom-top) };
    }

    // -------- Targets --------
    function makeTarget(type, play, opts){
      opts = opts || {};
      const c = cfg();
      const g = currentGroup();

      let emoji = pick(state.rng, g.good);
      if (type === 'junk')  emoji = pick(state.rng, JUNK_EMOJI);
      if (type === 'decoy') emoji = pick(state.rng, DECOY_EMOJI);
      if (type === 'boss')  emoji = pick(state.rng, BOSS_EMOJI);

      // bullets override emoji
      const isBullet = !!opts.isBullet;
      if (isBullet) emoji = pick(state.rng, BULLET_EMOJI);

      const lvl = state.stormLevel|0;
      const sBase = (c.size[0] + state.rng()*(c.size[1]-c.size[0])) * (1 - 0.06*lvl);
      const s = isBullet ? (sBase * 0.62) : sBase;

      const half = (132 * s) * 0.5;
      const x = clamp(play.left + half + state.rng()*(play.width - 2*half), play.left + half, play.right - half);
      const y = clamp(play.top  + half + state.rng()*(play.height - 2*half), play.top  + half, play.bottom - half);

      const m = stormMult();
      const baseLife = randInt(state.rng, c.lifeMs[0], c.lifeMs[1]);
      let life = Math.max(520, Math.round(baseLife / m));
      if (isBullet) life = 520 + Math.round(state.rng()*260);

      // if slowmo on, extend by /speed (spawn scheduling will slow too)
      if (state.slowmoOn) life = Math.round(life / Math.max(0.1, state.slowmoSpeed));

      const expireAt = nowMs() + life;

      const id = String(state.nextId++);
      const el = DOC.createElement('div');
      el.className = 'fg-target spawn';
      el.dataset.id = id;
      el.dataset.type = type;

      if (type === 'good')  el.classList.add('fg-good');
      if (type === 'junk')  el.classList.add('fg-junk');
      if (type === 'decoy') el.classList.add('fg-decoy');
      if (type === 'boss')  el.classList.add('fg-boss');
      if (isBullet) el.classList.add('fg-bullet');

      // ✅ emoji via CSS ::before
      el.dataset.emoji = emoji;

      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', y.toFixed(1) + 'px');
      el.style.setProperty('--s', s.toFixed(3));
      el.style.setProperty('--fg-scale', s.toFixed(3));

      // Boss HP + action timer
      let bossHp = 0, bossHpMax = 0, bossFillEl = null;
      let nextActAt = 0;

      if (type === 'boss'){
        bossHpMax = randInt(state.rng, c.bossHp[0], c.bossHp[1]) + lvl;
        bossHp = bossHpMax;
        state.bossSpawn++;

        const bar = DOC.createElement('div');
        bar.className = 'bossbar';
        const fill = DOC.createElement('div');
        fill.className = 'bossbar-fill';
        bar.appendChild(fill);
        el.appendChild(bar);
        bossFillEl = fill;

        nextActAt = nowMs() + (520 + Math.round(state.rng()*520));
      }

      state.layerEl.appendChild(el);

      // spawn stats
      if (type === 'good') state.goodSpawn++;
      if (type === 'junk' && !isBullet) state.junkSpawn++;
      if (isBullet) state.bulletSpawn++;

      // near-expire blink
      const nxAt = Math.max(120, Math.round(life * (0.72 - 0.06*lvl)));
      setTimeout(()=>{
        const t = state.targets.get(id);
        if (t && !t.dead && t.el) t.el.classList.add('nx');
      }, nxAt);

      // cleanup spawn class
      setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch(e){} }, 180);

      const tObj = {
        id, el, type, emoji,
        x, y, s,
        expireAt,
        dead:false,
        groupId: g.id,

        isBullet: isBullet,

        bossHp, bossHpMax, bossFillEl,
        nextActAt,
        blinked:false
      };

      state.targets.set(id, tObj);

      // decoy blink (storm3 can blink twice)
      if (type === 'decoy'){
        const maxBlink = (state.stormLevel >= 3) ? 2 : 1;
        const doBlink = ()=>{
          const t = state.targets.get(id);
          if (!t || t.dead) return;
          if ((t.blinks|0) >= maxBlink) return;

          t.blinks = (t.blinks|0) + 1;

          const p2 = computePlayRect();
          const half2 = (132 * t.s) * 0.5;
          const nx = clamp(p2.left + half2 + state.rng()*(p2.width - 2*half2), p2.left + half2, p2.right - half2);
          const ny = clamp(p2.top  + half2 + state.rng()*(p2.height - 2*half2), p2.top  + half2, p2.bottom - half2);

          t.x = nx; t.y = ny;
          if (t.el){
            t.el.classList.remove('nx');
            t.el.style.setProperty('--x', nx.toFixed(1)+'px');
            t.el.style.setProperty('--y', ny.toFixed(1)+'px');
            t.el.classList.add('dash');
            setTimeout(()=>{ try{ t.el.classList.remove('dash'); }catch(e){} }, 120);
          }
          emit('hha:shake', { ms: 110, intensity: 6 });
        };

        const d1 = 280 + Math.round(state.rng()*520);
        setTimeout(doBlink, d1);
        if (maxBlink >= 2){
          const d2 = 760 + Math.round(state.rng()*680);
          setTimeout(doBlink, d2);
        }
      }

      return tObj;
    }

    function removeTarget(t, reason){
      if (!t || t.dead) return;
      t.dead = true;
      state.targets.delete(t.id);

      if (t.el){
        t.el.classList.remove('spawn');
        t.el.classList.add('out');
        setTimeout(()=>{ try{ t.el.remove(); }catch(e){} }, 200);
      }

      if (reason === 'expire'){
        if (t.type === 'good'){
          state.goodExpire++;
          addMiss();
          emit('hha:shake', { ms: 150, intensity: 7 });
        }
      }
    }

    function vx(t){ return (t.x + state.lookX); }
    function vy(t){ return (t.y + state.lookY); }

    function findNearestTarget(px, py, radiusPx){
      let best = null;
      let bestD = 1e9;

      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        const dx = (vx(t) - px);
        const dy = (vy(t) - py);
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < bestD){ bestD = d; best = t; }
      });

      if (!best) return null;
      return (bestD <= radiusPx) ? best : null;
    }

    function clearLock(){
      if (state.lockedId && state.targets.has(state.lockedId)){
        const old = state.targets.get(state.lockedId);
        if (old && old.el) old.el.classList.remove('lock');
      }
      state.lockedId = null;
      state.lockStartMs = 0;
    }

    function tryLock(px, py){
      const t = findNearestTarget(px, py, 120);
      if (!t){ clearLock(); return null; }

      if (state.lockedId !== t.id){
        clearLock();
        state.lockedId = t.id;
        state.lockStartMs = nowMs();
        if (t.el) t.el.classList.add('lock');
      }
      return t;
    }

    // -------- Boss patterns --------
    function bossDash(t){
      const play = computePlayRect();
      const half = (132 * t.s) * 0.5;
      const nx = clamp(play.left + half + state.rng()*(play.width - 2*half), play.left + half, play.right - half);
      const ny = clamp(play.top  + half + state.rng()*(play.height - 2*half), play.top  + half, play.bottom - half);

      t.x = nx; t.y = ny;
      if (t.el){
        t.el.style.setProperty('--x', nx.toFixed(1)+'px');
        t.el.style.setProperty('--y', ny.toFixed(1)+'px');
        t.el.classList.add('dash');
        setTimeout(()=>{ try{ t.el.classList.remove('dash'); }catch(e){} }, 120);
      }
      emit('hha:shake', { ms: 160, intensity: 9 });
    }

    function bossShoot(t){
      const play = computePlayRect();
      const n = 2 + (state.stormLevel>=2 ? 2 : 1) + (state.stormLevel>=3 ? 1 : 0);

      for (let i=0;i<n;i++){
        const b = makeTarget('junk', play, { isBullet:true });
        // force near boss
        const rx = (Math.random()*2-1) * (70 + Math.random()*70);
        const ry = (Math.random()*2-1) * (70 + Math.random()*70);
        b.x = clamp(t.x + rx, play.left+40, play.right-40);
        b.y = clamp(t.y + ry, play.top+40, play.bottom-40);
        if (b.el){
          b.el.style.setProperty('--x', b.x.toFixed(1)+'px');
          b.el.style.setProperty('--y', b.y.toFixed(1)+'px');
        }
      }
      emit('groups:boss_roar', {});
    }

    function summonBurst(cx, cy, count){
      const play = computePlayRect();
      for (let i=0;i<count;i++){
        const kind = (state.rng()<0.58) ? 'junk' : 'decoy';
        const t = makeTarget(kind, play, { isBullet:false });
        const rx = (Math.random()*2-1) * (70 + Math.random()*60);
        const ry = (Math.random()*2-1) * (70 + Math.random()*60);
        t.x = clamp(cx + rx, play.left+40, play.right-40);
        t.y = clamp(cy + ry, play.top+40, play.bottom-40);
        if (t.el){
          t.el.style.setProperty('--x', t.x.toFixed(1)+'px');
          t.el.style.setProperty('--y', t.y.toFixed(1)+'px');
        }
      }
    }

    function bossAct(t){
      const now = nowMs();
      if (!t || t.dead) return;

      const lvl = state.stormLevel|0;
      const r = state.rng();

      // dash more in storm 2+
      if (lvl >= 2 && r < 0.48){
        bossDash(t);
      } else {
        bossShoot(t);
      }

      // next action
      const base = (lvl>=3) ? 420 : (lvl>=2 ? 520 : 680);
      t.nextActAt = now + base + Math.round(state.rng()*420);
    }

    // -------- Hits --------
    function applyPerfectStreakReward(){
      const now = nowMs();
      if (now < state.streakCooldownUntil) return;

      // reward: slowmo + shield + spawn goods
      startSlowmo(900, 0.62, 'perfect_streak');
      giveShield(1, 3600, 'perfect_streak');

      // cooldown
      state.streakCooldownUntil = now + 6000;

      // reward goods (3)
      const play = computePlayRect();
      for (let i=0;i<3;i++){
        const gt = makeTarget('good', play, {});
        gt.x = clamp(gt.x + (Math.random()*2-1)*90, play.left+40, play.right-40);
        gt.y = clamp(gt.y + (Math.random()*2-1)*90, play.top+40, play.bottom-40);
        if (gt.el){
          gt.el.style.setProperty('--x', gt.x.toFixed(1)+'px');
          gt.el.style.setProperty('--y', gt.y.toFixed(1)+'px');
        }
      }

      emit('hha:judge', { text:'PERFECT! SLOW-MO!', kind:'boss' });
      emit('hha:shake', { ms: 240, intensity: 12 });

      // reset streak so reward feels discrete
      state.streakGood = 0;
    }

    function hitGood(t){
      const c = cfg();

      state.goodHit++;
      state.combo++;
      state.streakGood++;

      // score ramps harder in storm
      state.score += c.score.good + Math.min(300, state.combo * (6 + state.stormLevel*2));

      powerAdd(1);

      // small shake at high combo
      if (state.combo >= 18) emit('hha:shake', { ms: 90, intensity: 5 });

      emit('hha:judge', { text:'GOOD!', kind:'good' });
      emit('groups:progress', { kind:'good_hit', groupId: t.groupId });

      // perfect streak trigger
      if (state.streakGood >= state.streakNeed){
        applyPerfectStreakReward();
      }
    }

    function junkPenalty(isBullet){
      const c = cfg();

      // Shield blocks once
      if (consumeShield()){
        state.combo = Math.max(0, state.combo - 2);
        state.score += Math.round((isBullet ? c.score.bullet : c.score.junk) * 0.20); // small penalty
        emit('hha:judge', { text:'BLOCK!', kind:'warn' });
        emit('hha:shake', { ms: 140, intensity: 8 });
        emitScore();
        return;
      }

      // chain stun stacking
      const now = nowMs();
      const within = (now - (state.lastJunkAt||0)) <= 2600;
      state.lastJunkAt = now;
      state.junkChain = within ? Math.min(5, (state.junkChain|0) + 1) : 1;

      state.combo = 0;
      state.streakGood = 0;

      state.score += isBullet ? c.score.bullet : c.score.junk;
      addMiss();

      const baseStun = (c.stunMs|0) + (state.stormLevel*90);
      const stun = Math.round(baseStun * (1 + 0.32*(state.junkChain-1)));
      state.stunnedUntil = now + stun;

      (NS.FX || FX).stunFlash();
      emit('groups:stun', { ms: stun, chain: state.junkChain|0 });
      emit('hha:judge', { text: (isBullet?'BULLET!':'STUN!'), kind:'bad' });
      emit('hha:shake', { ms: 220 + 40*(state.junkChain|0), intensity: 11 + 2*(state.junkChain|0) });

      // chain burst (โหด+++): chain>=2 หรือ storm3 จะ summon junk/decoy เพิ่ม
      if (state.junkChain >= 2 || state.stormLevel >= 3){
        summonBurst(state.lastPointer.x||0, state.lastPointer.y||0, 2 + Math.min(4, state.junkChain));
      }
    }

    function hitDecoy(){
      const c = cfg();
      state.decoyHit++;
      state.combo = 0;
      state.streakGood = 0;
      state.score += c.score.decoy;
      addMiss();
      emit('hha:judge', { text:'DECOY!', kind:'warn' });
      emit('hha:shake', { ms: 180, intensity: 10 });

      // decoy punishment in storm2+: spawn 1 junk near pointer
      if (state.stormLevel >= 2){
        const play = computePlayRect();
        const jt = makeTarget('junk', play, {});
        jt.x = clamp((state.lastPointer.x||jt.x) - state.lookX, play.left+40, play.right-40);
        jt.y = clamp((state.lastPointer.y||jt.y) - state.lookY, play.top+40, play.bottom-40);
        if (jt.el){
          jt.el.style.setProperty('--x', jt.x.toFixed(1)+'px');
          jt.el.style.setProperty('--y', jt.y.toFixed(1)+'px');
        }
      }
    }

    function hitBoss(t){
      if (!t || t.dead) return;
      const c = cfg();

      t.bossHp = Math.max(0, (t.bossHp|0) - 1);
      state.bossHit++;

      state.combo++;
      state.score += c.score.bossHit + Math.min(360, state.combo * (6 + state.stormLevel*2));

      emit('hha:shake', { ms: 120, intensity: 8 });

      if (t.bossFillEl && t.bossHpMax){
        const pct = Math.max(0, (t.bossHp / t.bossHpMax) * 100);
        t.bossFillEl.style.width = pct.toFixed(1) + '%';
      }

      // rage
      const rageNow = (t.bossHpMax && t.bossHp <= Math.ceil(t.bossHpMax * 0.35));
      if (rageNow && !state.bossRageOn){
        state.bossRageOn = true;
        if (t.el) t.el.classList.add('rage');
        emit('groups:boss_rage', { on:true });
        emit('hha:shake', { ms: 260, intensity: 13 });
        summonBurst(t.x, t.y, 3 + state.stormLevel);
      }

      // kill
      if (t.bossHp <= 0){
        state.bossKills++;
        state.score += c.score.bossKill + (state.stormLevel*90);
        powerAdd(2);

        if (t.el){
          t.el.classList.add('hit');
          setTimeout(()=>{ try{ t.el.remove(); }catch(e){} }, 210);
        }
        t.dead = true;
        state.targets.delete(t.id);

        // reward: shield + mini slowmo chance
        giveShield(1 + (state.stormLevel>=3?1:0), 3600, 'boss_kill');
        if (!state.slowmoOn && state.rng() < 0.35) startSlowmo(750, 0.66, 'boss_kill');

        emit('hha:judge', { text:'BOSS DOWN!', kind:'boss' });
        emit('hha:shake', { ms: 280, intensity: 15 });
        emit('groups:progress', { kind:'boss_kill' });

        // reward goods near kill
        const play = computePlayRect();
        for (let i=0;i<2;i++){
          const gt = makeTarget('good', play, {});
          gt.x = clamp(t.x + (Math.random()*2-1)*90, play.left+40, play.right-40);
          gt.y = clamp(t.y + (Math.random()*2-1)*90, play.top+40, play.bottom-40);
          if (gt.el){
            gt.el.style.setProperty('--x', gt.x.toFixed(1)+'px');
            gt.el.style.setProperty('--y', gt.y.toFixed(1)+'px');
          }
        }
      } else {
        emit('hha:judge', { text:'HIT!', kind:'boss' });
      }

      emitScore();
    }

    function hitTarget(t){
      if (!t || t.dead) return;

      // remove anim
      if (t.el){
        t.el.classList.remove('nx');
        t.el.classList.add('hit');
        setTimeout(()=>{ try{ t.el.remove(); }catch(e){} }, 200);
      }
      state.targets.delete(t.id);
      t.dead = true;

      if (t.type === 'good'){
        hitGood(t);
      }
      else if (t.type === 'junk'){
        state.junkHit++;
        if (t.isBullet) state.bulletHit++;
        junkPenalty(!!t.isBullet);
      }
      else if (t.type === 'decoy'){
        hitDecoy();
      }
      // boss handled separately
      emitScore();
    }

    // -------- Spawn loop --------
    function spawn(){
      if (!state.running) return;

      const c = cfg();
      const play = computePlayRect();
      const rates = buildRates(c);

      const r = state.rng();
      let type = 'good';
      if (r < rates.bossRate) type = 'boss';
      else if (r < rates.bossRate + rates.decoyRate) type = 'decoy';
      else if (r < rates.bossRate + rates.decoyRate + rates.junkRate) type = 'junk';

      const t = makeTarget(type, play, {});
      if (type === 'boss') emit('groups:boss_roar', {});

      // double spawn (storm2+)
      if (state.stormLevel >= 2 && state.rng() < (0.12 + 0.06*(state.stormLevel-2))){
        const r2 = state.rng();
        let t2 = 'good';
        if (r2 < rates.junkRate*0.68) t2 = 'junk';
        else if (r2 < rates.junkRate*0.68 + rates.decoyRate*0.80) t2 = 'decoy';
        makeTarget(t2, play, {});
      }

      const m = stormMult();
      const baseNext = randInt(state.rng, c.spawnEveryMs[0], c.spawnEveryMs[1]);

      // slowmo on => slower spawns (interval bigger)
      const speed = state.slowmoOn ? Math.max(0.1, state.slowmoSpeed) : 1;
      const next = Math.max(150, Math.round((baseNext / m) / speed));

      clearTimeout(state.spawnTo);
      state.spawnTo = setTimeout(spawn, next);
    }

    // -------- Input --------
    function setLookTarget(x,y){
      state.lookTX = clamp(x, -state.lookMaxX, state.lookMaxX);
      state.lookTY = clamp(y, -state.lookMaxY, state.lookMaxY);
      // lerp a bit each move
      state.lookX += (state.lookTX - state.lookX) * 0.22;
      state.lookY += (state.lookTY - state.lookY) * 0.22;
      applyLookVars();
    }

    let gyroOn = false;
    function enableGyro(){
      if (gyroOn) return;
      gyroOn = true;
      function onOri(e){
        if (!state.running) return;
        const g = Number(e.gamma || 0);
        const b = Number(e.beta  || 0);
        const gx = clamp(g / 35, -1, 1);
        const by = clamp((b - 10) / 40, -1, 1);
        const tx = gx * state.lookMaxX;
        const ty = by * state.lookMaxY;
        state.lookTX = clamp(state.lookTX * 0.6 + tx * 0.4, -state.lookMaxX, state.lookMaxX);
        state.lookTY = clamp(state.lookTY * 0.6 + ty * 0.4, -state.lookMaxY, state.lookMaxY);
        state.lookX += (state.lookTX - state.lookX) * 0.10;
        state.lookY += (state.lookTY - state.lookY) * 0.10;
        applyLookVars();
      }
      root.addEventListener('deviceorientation', onOri, { passive:true });
    }

    function onPointerMove(ev){
      if (!state.running || !ev) return;
      const px = ev.clientX || 0;
      const py = ev.clientY || 0;
      state.lastPointer.x = px;
      state.lastPointer.y = py;

      if (state.pointerDown){
        const dx = px - state.downX;
        const dy = py - state.downY;
        if (!state.moved && (Math.abs(dx)+Math.abs(dy)) > 10) state.moved = true;
        if (state.moved){
          setLookTarget(dx * 0.22, dy * 0.18);
          return;
        }
      }

      if (isStunned()) return;
      tryLock(px, py);
    }

    function onPointerDown(ev){
      if (!state.running || !ev) return;
      try{ ev.preventDefault(); }catch(e){}
      const px = ev.clientX || 0;
      const py = ev.clientY || 0;

      state.pointerDown = true;
      state.downX = px; state.downY = py;
      state.moved = false;

      state.lastPointer.x = px;
      state.lastPointer.y = py;

      if (isStunned()) return;
      tryLock(px, py);
    }

    function onPointerUp(ev){
      if (!state.running) return;

      const wasMoved = state.moved;
      state.pointerDown = false;
      state.moved = false;

      if (wasMoved){
        // ease back slightly
        state.lookTX *= 0.75; state.lookTY *= 0.75;
        return;
      }

      const px = (ev && ev.clientX) ? ev.clientX : state.lastPointer.x;
      const py = (ev && ev.clientY) ? ev.clientY : state.lastPointer.y;

      if (isStunned()) return;

      const t = findNearestTarget(px, py, 110);
      if (t){
        if (t.type === 'boss') hitBoss(t);
        else hitTarget(t);
        return;
      }

      // locked auto-hit
      if (state.lockedId && state.targets.has(state.lockedId)){
        const lt = state.targets.get(state.lockedId);
        const held = nowMs() - (state.lockStartMs || 0);
        if (held >= state.lockNeedMs && lt){
          if (lt.type === 'boss') hitBoss(lt);
          else hitTarget(lt);
        }
      }
    }

    // -------- Timer tick --------
    function tickSecond(){
      if (!state.running) return;

      state.timeLeft = Math.max(0, (state.timeLeft|0) - 1);
      emit('hha:time', { left: state.timeLeft|0 });

      // panic
      const panic = state.timeLeft <= 12 && state.timeLeft > 0;
      if (panic !== state.panicOn){
        state.panicOn = panic;
        (NS.FX || FX).panic(panic);
      }

      // storm decide
      const timeStorm = stormFromTime();
      const streakStorm = stormFromStreak();
      const lvl = Math.max(timeStorm, streakStorm);
      if (lvl !== state.stormLevel) setStorm(lvl, (timeStorm>0)?'time':'streak');

      // expire sweep (storm3 does 2 passes)
      const sweeps = (state.stormLevel >= 3) ? 2 : 1;
      for (let s=0;s<sweeps;s++){
        const tnow = nowMs();
        const exp = [];
        state.targets.forEach((t)=>{
          if (!t || t.dead) return;
          if (tnow >= t.expireAt) exp.push(t);
        });
        for (let i=0;i<exp.length;i++) removeTarget(exp[i], 'expire');
      }

      if (state.timeLeft <= 0){
        stop(true);
      }
    }

    // -------- Lifecycle --------
    function resetStats(){
      state.targets.clear();
      state.nextId = 1;

      state.score=0; state.combo=0; state.comboMax=0; state.misses=0;
      state.goodHit=0; state.goodSpawn=0; state.goodExpire=0;
      state.junkHit=0; state.junkSpawn=0; state.decoyHit=0;
      state.bossKills=0;

      state.bossSpawn=0; state.bossHit=0;
      state.bulletSpawn=0; state.bulletHit=0;
      state.slowmoCount=0; state.shieldBlocks=0;
      state.stormMax=0; state.stormMs=0; state.stormLastAt=0;

      state.groupIndex=0;
      state.powerCharge=0;

      state.stunnedUntil=0;
      state.panicOn=false;

      clearLock();
      state.lookX=0; state.lookY=0; state.lookTX=0; state.lookTY=0;
      applyLookVars();

      state.stormLevel=0; state.stormUntilMs=0;
      state.streakGood=0; state.streakCooldownUntil=0;

      state.junkChain=0; state.lastJunkAt=0;

      state.slowmoOn=false; state.slowmoSpeed=1; state.slowmoUntil=0;
      DOC.documentElement.classList.remove('slowmo');

      state.shieldCharges=0; state.shieldUntil=0;
      state.bossRageOn=false;

      if (state.layerEl) state.layerEl.innerHTML = '';
    }

    function setLayerEl(el){
      state.layerEl = el;
      if (!el) return;
      el.addEventListener('pointerdown', onPointerDown, { passive:false });
      el.addEventListener('pointermove', onPointerMove, { passive:true });
      el.addEventListener('pointerup', onPointerUp, { passive:true });
      el.addEventListener('pointercancel', onPointerUp, { passive:true });
    }

    function setTimeLeft(sec){
      sec = Math.max(1, (sec|0));
      state.timeLeft = sec;
      state.timeTotal = sec;
    }

    function start(diff, opts){
      opts = opts || {};
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
      state.running = true;

      emit('groups:group_change', { groupId: currentGroup().id, label: currentGroup().label, from: 0 });
      emit('groups:power', { charge:0, threshold: state.powerThreshold|0 });
      emit('hha:time', { left: state.timeLeft|0 });
      emitScore();

      clearInterval(state.timerInt);
      state.timerInt = setInterval(tickSecond, 1000);

      clearTimeout(state.spawnTo);
      state.spawnTo = setTimeout(spawn, 240);

      startFrame();

      if (opts.enableGyro) enableGyro();
    }

    function stop(ended){
      if (!state.running) return;
      state.running = false;

      clearInterval(state.timerInt);
      clearTimeout(state.spawnTo);
      state.timerInt = null;
      state.spawnTo = null;

      stopFrame();

      (NS.FX || FX).panic(false);
      emit('groups:storm', { level:0, on:false, reason:'stop' });
      DOC.documentElement.classList.remove('storm','storm2','storm3','edgewarn','slowmo');

      clearLock();
      stopSlowmo();

      if (ended){
        const acc = calcAccuracy();
        const grade = gradeFrom(acc, state.score|0);

        emit('hha:rank', { grade, accuracy: acc|0 });

        emit('hha:end', {
          game: 'groups',
          diff: state.diff,
          runMode: state.runMode,
          seed: state.seed,

          scoreFinal: state.score|0,
          comboMax: state.comboMax|0,
          misses: state.misses|0,

          goodHit: state.goodHit|0,
          goodSpawn: state.goodSpawn|0,
          goodExpire: state.goodExpire|0,

          junkHit: state.junkHit|0,
          junkSpawn: state.junkSpawn|0,
          decoyHit: state.decoyHit|0,

          bossKills: state.bossKills|0,
          bossSpawn: state.bossSpawn|0,
          bossHit: state.bossHit|0,

          bulletSpawn: state.bulletSpawn|0,
          bulletHit: state.bulletHit|0,

          slowmoCount: state.slowmoCount|0,
          shieldBlocks: state.shieldBlocks|0,

          stormMax: state.stormMax|0,
          stormMs: Math.round(state.stormMs)||0,

          accuracyGoodPct: acc|0,
          grade: grade
        });
      }
    }

    return {
      setLayerEl,
      setTimeLeft,
      start,
      stop,
      enableGyro
    };
  })();

  NS.GameEngine = Engine;
})(window);
