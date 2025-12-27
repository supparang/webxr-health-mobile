/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (PRODUCTION / classic script) + VR-FEEL PATCH
✅ data-emoji (CSS ::before) + left/top from --x/--y
✅ VR-feel: parallax look (drag + gyro) updates --lookX/--lookY
✅ Hit detection corrected with look offset
✅ Spawn safe with look margins
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
  function emit(name, detail){
    root.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function readSafeInsets(){
    const cs = getComputedStyle(DOC.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
    const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
    return { sat, sab, sal, sar };
  }

  const FX = {
    panic(on){ DOC.documentElement.classList.toggle('panic', !!on); },
    stunFlash(){
      DOC.documentElement.classList.add('stunflash');
      setTimeout(()=>DOC.documentElement.classList.remove('stunflash'), 220);
    },
    swapFlash(){
      DOC.documentElement.classList.add('swapflash');
      setTimeout(()=>DOC.documentElement.classList.remove('swapflash'), 220);
    },
    afterimage(){ /* optional */ }
  };
  NS.FX = NS.FX || FX;

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
      timeDefault: 90,
      spawnEveryMs: [650, 900],
      lifeMs: [1300, 1750],
      size: [0.88, 1.05],
      junkRate: 0.16,
      decoyRate: 0.08,
      bossRate: 0.06,
      bossHp: [3, 4],
      stunMs: 450,
      powerThreshold: 7,
      score: { good: 120, bossHit: 90, bossKill: 220, decoy: -60, junk: -90 },
      missPenalty: 1
    },
    normal: {
      timeDefault: 90,
      spawnEveryMs: [520, 800],
      lifeMs: [1050, 1550],
      size: [0.82, 1.02],
      junkRate: 0.22,
      decoyRate: 0.10,
      bossRate: 0.08,
      bossHp: [4, 6],
      stunMs: 650,
      powerThreshold: 9,
      score: { good: 130, bossHit: 95, bossKill: 260, decoy: -70, junk: -110 },
      missPenalty: 1
    },
    hard: {
      timeDefault: 90,
      spawnEveryMs: [430, 690],
      lifeMs: [900, 1300],
      size: [0.76, 0.98],
      junkRate: 0.28,
      decoyRate: 0.12,
      bossRate: 0.10,
      bossHp: [6, 8],
      stunMs: 820,
      powerThreshold: 11,
      score: { good: 140, bossHit: 105, bossKill: 320, decoy: -80, junk: -140 },
      missPenalty: 1
    }
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

      groupIndex:0,
      powerCharge:0,
      powerThreshold:9,

      stunnedUntil:0,
      panicOn:false,

      /* ✅ VR LOOK */
      lookX:0,
      lookY:0,
      lookTX:0,
      lookTY:0,
      lookMaxX:24,
      lookMaxY:18,
      lookRaf:0,

      /* input */
      pointerDown:false,
      downX:0, downY:0,
      moved:false,

      lastPointer:{ x:0, y:0 },
      lockedId:null,
      lockStartMs:0,
      lockNeedMs:220
    };

    function cfg(){ return DIFF[state.diff] || DIFF.normal; }

    function setLayerEl(el){
      state.layerEl = el;
      if (!el) return;

      el.addEventListener('pointerdown', onPointerDown, { passive:false });
      el.addEventListener('pointermove', onPointerMove, { passive:true });
      el.addEventListener('pointerup', onPointerUp, { passive:true });
      el.addEventListener('pointercancel', onPointerUp, { passive:true });
    }

    function applyLookVars(){
      if (!state.layerEl) return;
      DOC.documentElement.style.setProperty('--lookX', state.lookX.toFixed(1) + 'px');
      DOC.documentElement.style.setProperty('--lookY', state.lookY.toFixed(1) + 'px');
    }

    function tickLook(){
      if (!state.running) return;
      const k = 0.14; // smoothing
      state.lookX += (state.lookTX - state.lookX) * k;
      state.lookY += (state.lookTY - state.lookY) * k;
      applyLookVars();
      state.lookRaf = root.requestAnimationFrame(tickLook);
    }

    function startLookLoop(){
      if (state.lookRaf) return;
      state.lookRaf = root.requestAnimationFrame(tickLook);
    }
    function stopLookLoop(){
      if (!state.lookRaf) return;
      try{ root.cancelAnimationFrame(state.lookRaf); }catch(e){}
      state.lookRaf = 0;
    }

    function setLookTarget(x, y){
      state.lookTX = clamp(x, -state.lookMaxX, state.lookMaxX);
      state.lookTY = clamp(y, -state.lookMaxY, state.lookMaxY);
    }

    function setTimeLeft(sec){
      sec = Math.max(1, (sec|0));
      state.timeLeft = sec;
      state.timeTotal = sec;
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
      state.junkHit = 0;
      state.junkSpawn = 0;
      state.decoyHit = 0;
      state.bossKills = 0;

      state.groupIndex = 0;
      state.powerCharge = 0;

      state.stunnedUntil = 0;
      state.panicOn = false;

      state.lockedId = null;
      state.lockStartMs = 0;

      /* look reset */
      state.lookX = 0; state.lookY = 0;
      state.lookTX = 0; state.lookTY = 0;
      applyLookVars();

      if (state.layerEl) state.layerEl.innerHTML = '';
    }

    function currentGroup(){
      return GROUPS[state.groupIndex % GROUPS.length];
    }

    function computePlayRect(){
      const w = root.innerWidth || DOC.documentElement.clientWidth || 360;
      const h = root.innerHeight || DOC.documentElement.clientHeight || 640;
      const insets = readSafeInsets();

      const hud = DOC.querySelector('.hud-top');
      const hudRect = hud ? hud.getBoundingClientRect() : { bottom: 0 };
      const hudBottom = Math.max(0, hudRect.bottom || 0);

      const pad = 12;

      /* ✅ leave margins for look shift so targets won't slide under HUD/edges */
      const mx = state.lookMaxX + 6;
      const my = state.lookMaxY + 6;

      const top = Math.min(h-140, Math.max(hudBottom + 10 + my, 10 + insets.sat + 10 + my));
      const left = 10 + insets.sal + pad + mx;
      const right = w - (10 + insets.sar + pad + mx);
      const bottom = h - (10 + insets.sab + pad + my);

      return {
        left,
        top,
        right,
        bottom,
        width: Math.max(10, right - left),
        height: Math.max(10, bottom - top),
        w, h
      };
    }

    function spawn(){
      if (!state.running) return;

      const c = cfg();
      const play = computePlayRect();

      const r = state.rng();
      let type = 'good';
      if (r < c.bossRate) type = 'boss';
      else if (r < c.bossRate + c.decoyRate) type = 'decoy';
      else if (r < c.bossRate + c.decoyRate + c.junkRate) type = 'junk';

      const g = currentGroup();
      let emoji = pick(state.rng, g.good);
      if (type === 'junk') emoji = pick(state.rng, JUNK_EMOJI);
      if (type === 'decoy') emoji = pick(state.rng, DECOY_EMOJI);
      if (type === 'boss') emoji = pick(state.rng, BOSS_EMOJI);

      const s = c.size[0] + state.rng() * (c.size[1] - c.size[0]);

      const half = (132 * s) * 0.5;
      const x = clamp(play.left + half + state.rng()*(play.width - 2*half), play.left + half, play.right - half);
      const y = clamp(play.top  + half + state.rng()*(play.height - 2*half), play.top  + half, play.bottom - half);

      const life = randInt(state.rng, c.lifeMs[0], c.lifeMs[1]);
      const expireAt = nowMs() + life;

      const id = String(state.nextId++);
      const el = DOC.createElement('div');
      el.className = 'fg-target spawn';
      el.dataset.id = id;
      el.dataset.type = type;

      if (type === 'good') el.classList.add('fg-good');
      if (type === 'junk') el.classList.add('fg-junk');
      if (type === 'decoy') el.classList.add('fg-decoy');
      if (type === 'boss') el.classList.add('fg-boss');

      /* ✅ IMPORTANT: map vars for CSS */
      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', y.toFixed(1) + 'px');
      el.style.setProperty('--s', s.toFixed(3));
      el.style.setProperty('--floatDur', (900 + Math.round(state.rng()*520)) + 'ms');

      /* ✅ emoji via CSS ::before */
      el.dataset.emoji = emoji;
      el.textContent = '';

      let bossHp = 0;
      let bossHpMax = 0;
      let bossFillEl = null;

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
      if (type === 'junk') state.junkSpawn++;

      state.targets.set(id, {
        id,
        el,
        type,
        emoji,
        x, y, s,
        expireAt,
        dead:false,
        groupId: g.id,
        bossHp,
        bossHpMax,
        bossFillEl
      });

      setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch(e){} }, 200);

      const next = randInt(state.rng, c.spawnEveryMs[0], c.spawnEveryMs[1]);
      state.spawnTo = setTimeout(spawn, next);
    }

    function removeTarget(t, reason){
      if (!t || t.dead) return;
      t.dead = true;
      state.targets.delete(t.id);

      const el = t.el;
      if (el){
        el.classList.add('out');
        setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 220);
      }

      if (reason === 'expire'){
        if (t.type === 'good'){
          state.goodExpire++;
          addMiss();
        }
      }
    }

    function addMiss(){
      state.misses += 1;
      state.combo = 0;
      emitScore();
    }

    function emitScore(){
      state.comboMax = Math.max(state.comboMax, state.combo);
      emit('hha:score', {
        score: state.score|0,
        combo: state.combo|0,
        misses: state.misses|0,
        comboMax: state.comboMax|0
      });

      const acc = calcAccuracy();
      emit('hha:rank', { grade: gradeFrom(acc, state.score|0), accuracy: acc|0 });
    }

    function calcAccuracy(){
      const denom = Math.max(1, state.goodHit + state.goodExpire);
      return Math.round((state.goodHit / denom) * 100);
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
      emit('groups:group_change', { groupId: g.id, label: g.label, from: prev.id });
      emit('groups:progress', { kind:'group_swap', groupId:g.id });
    }

    function isStunned(){ return nowMs() < state.stunnedUntil; }

    /* ✅ Visible position = base + look */
    function vx(t){ return (t.x + state.lookX); }
    function vy(t){ return (t.y + state.lookY); }

    function hitTarget(t){
      if (!t || t.dead) return;

      const c = cfg();
      const type = t.type;

      if (t.el){
        t.el.classList.add('hit');
        setTimeout(()=>{ try{ t.el.remove(); }catch(e){} }, 220);
      }
      state.targets.delete(t.id);
      t.dead = true;

      if (type === 'good'){
        state.goodHit++;
        state.combo++;
        state.score += c.score.good + Math.min(220, state.combo * 6);
        powerAdd(1);
        emit('hha:judge', { text:'GOOD!', kind:'good' });
        emit('groups:progress', { kind:'good_hit', groupId: t.groupId });
      }
      else if (type === 'junk'){
        state.junkHit++;
        state.combo = 0;
        state.score += c.score.junk;
        addMiss();
        state.stunnedUntil = nowMs() + (c.stunMs|0);
        (NS.FX || FX).stunFlash();
        emit('groups:stun', { ms: c.stunMs|0 });
        emit('hha:judge', { text:'STUN!', kind:'bad' });
      }
      else if (type === 'decoy'){
        state.decoyHit++;
        state.combo = 0;
        state.score += c.score.decoy;
        addMiss();
        emit('hha:judge', { text:'DECOY!', kind:'warn' });
        emit('groups:progress', { kind:'decoy_hit' });
      }

      emitScore();
    }

    function hitBoss(t){
      if (!t || t.dead) return;

      const c = cfg();
      t.bossHp = Math.max(0, (t.bossHp|0) - 1);

      state.combo++;
      state.score += c.score.bossHit + Math.min(240, state.combo * 6);

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

        if (t.el){
          t.el.classList.add('hit');
          setTimeout(()=>{ try{ t.el.remove(); }catch(e){} }, 220);
        }
        t.dead = true;
        state.targets.delete(t.id);

        emit('hha:judge', { text:'BOSS DOWN!', kind:'boss' });
        emit('groups:progress', { kind:'boss_kill' });
      } else {
        emit('hha:judge', { text:'HIT!', kind:'boss' });
      }

      emitScore();
    }

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

    function tryLock(px, py){
      const t = findNearestTarget(px, py, 120);
      if (!t) {
        if (state.lockedId && state.targets.has(state.lockedId)){
          const old = state.targets.get(state.lockedId);
          if (old && old.el) old.el.classList.remove('lock');
        }
        state.lockedId = null;
        state.lockStartMs = 0;
        return null;
      }

      if (state.lockedId !== t.id){
        if (state.lockedId && state.targets.has(state.lockedId)){
          const old = state.targets.get(state.lockedId);
          if (old && old.el) old.el.classList.remove('lock');
        }
        state.lockedId = t.id;
        state.lockStartMs = nowMs();
        if (t.el) t.el.classList.add('lock');
      }
      return t;
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
        if (!state.moved && (Math.abs(dx) + Math.abs(dy)) > 10){
          state.moved = true;
        }
        if (state.moved){
          /* ✅ drag-to-look */
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

      /* ✅ stop drag => relax look back a bit */
      if (wasMoved){
        setLookTarget(state.lookTX * 0.75, state.lookTY * 0.75);
        return;
      }

      /* ✅ tap => shoot */
      const px = (ev && ev.clientX) ? ev.clientX : state.lastPointer.x;
      const py = (ev && ev.clientY) ? ev.clientY : state.lastPointer.y;

      if (isStunned()) return;

      const t = findNearestTarget(px, py, 110);
      if (t){
        if (t.type === 'boss') hitBoss(t);
        else hitTarget(t);
        return;
      }

      if (state.lockedId && state.targets.has(state.lockedId)){
        const lt = state.targets.get(state.lockedId);
        const held = nowMs() - (state.lockStartMs || 0);
        if (held >= state.lockNeedMs && lt){
          if (lt.type === 'boss') hitBoss(lt);
          else hitTarget(lt);
        }
      }
    }

    function tickSecond(){
      if (!state.running) return;

      state.timeLeft = Math.max(0, (state.timeLeft|0) - 1);
      emit('hha:time', { left: state.timeLeft|0 });

      const panic = state.timeLeft <= 12 && state.timeLeft > 0;
      if (panic !== state.panicOn){
        state.panicOn = panic;
        (NS.FX || FX).panic(panic);
      }

      const tnow = nowMs();
      const exp = [];
      state.targets.forEach((t)=>{
        if (!t || t.dead) return;
        if (tnow >= t.expireAt) exp.push(t);
      });
      for (let i=0;i<exp.length;i++) removeTarget(exp[i], 'expire');

      if (state.timeLeft <= 0){
        stop(true);
      }
    }

    /* ✅ Gyro support (optional) */
    let gyroOn = false;
    function enableGyro(){
      if (gyroOn) return;
      gyroOn = true;

      function onOri(e){
        if (!state.running) return;

        const g = Number(e.gamma || 0); // left-right [-90..90]
        const b = Number(e.beta  || 0); // front-back [-180..180]
        const gx = clamp(g / 35, -1, 1);
        const by = clamp((b - 10) / 40, -1, 1);

        const tx = gx * state.lookMaxX;
        const ty = by * state.lookMaxY;

        /* blend with current drag target */
        state.lookTX = clamp(state.lookTX * 0.6 + tx * 0.4, -state.lookMaxX, state.lookMaxX);
        state.lookTY = clamp(state.lookTY * 0.6 + ty * 0.4, -state.lookMaxY, state.lookMaxY);
      }

      root.addEventListener('deviceorientation', onOri, { passive:true });
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
      state.spawnTo = setTimeout(spawn, 250);

      startLookLoop();

      /* auto enable gyro if opted */
      if (opts.enableGyro) enableGyro();
    }

    function stop(ended){
      if (!state.running) return;
      state.running = false;

      clearInterval(state.timerInt);
      clearTimeout(state.spawnTo);
      state.timerInt = null;
      state.spawnTo = null;

      (NS.FX || FX).panic(false);
      stopLookLoop();

      if (state.lockedId && state.targets.has(state.lockedId)){
        const t = state.targets.get(state.lockedId);
        if (t && t.el) t.el.classList.remove('lock');
      }

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

      /* expose for overlay motion button */
      enableGyro: enableGyro
    };
  })();

  NS.GameEngine = Engine;
})(window);
