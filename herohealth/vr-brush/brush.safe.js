/* === /herohealth/vr-brush/brush.safe.js ===
BrushVR SAFE — Plaque Breaker (HHA Standard-ish) v20260216b (PACK 1–3)
PACK 1 ✅ Wave Director (calm→rush→chaos) + adaptive by performance
PACK 2 ✅ Boss phases + WeakSpot + Laser STOP/GO + Shock timing + Telegraph
PACK 3 ✅ ML/DL logging hooks (features + events) local-ready

Controls:
- PC/Mobile: tap targets or tap anywhere
- cVR: crosshair shoot via vr-ui.js => hha:shoot (x,y page coords)
*/

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------- helpers ----------
  const $ = (s)=>DOC.querySelector(s);
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1200);
  }

  function fatal(msg){
    const el = $('#fatal');
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('br-hidden');
  }
  WIN.addEventListener('error', (e)=>{
    fatal('JS ERROR:\n' + (e?.message||e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
  });

  function getQS(){ try{ return new URL(location.href).searchParams; }catch(_){ return new URLSearchParams(); } }
  function ymdLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function passHubUrl(ctx){
    const qs = getQS();
    return qs.get('hub') || ctx.hub || '../hub.html';
  }

  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }

  // ---------- DOM refs ----------
  const wrap = $('#br-wrap');
  const layer = $('#br-layer');

  const menu = $('#br-menu');
  const end = $('#br-end');

  const btnStart = $('#btnStart');
  const btnBack = $('#btnBack');
  const btnBackHub2 = $('#btnBackHub2');
  const btnRetry = $('#btnRetry');
  const btnHow = $('#btnHow');
  const btnPause = $('#btnPause');
  const btnRecenter = $('#btnRecenter');

  const tScore = $('#tScore');
  const tCombo = $('#tCombo');
  const tMiss  = $('#tMiss');
  const tTime  = $('#tTime');

  const tClean = $('#tClean');
  const bClean = $('#bClean');
  const tFever = $('#tFever');
  const bFever = $('#bFever');

  const ctxView = $('#br-ctx-view');
  const ctxSeed = $('#br-ctx-seed');
  const ctxTime = $('#br-ctx-time');
  const diffTag = $('#br-diffTag');

  const mDiff = $('#mDiff');
  const mTime = $('#mTime');

  const sScore = $('#sScore');
  const sAcc   = $('#sAcc');
  const sMiss  = $('#sMiss');
  const sCombo = $('#sCombo');
  const sClean = $('#sClean');
  const sTime  = $('#sTime');
  const endGrade = $('#endGrade');
  const endNote = $('#endNote');

  // ---------- internal ----------
  let BOOTED = false;
  let ctx = null;
  let rng = seededRng(Date.now());

  // ---------- PACK 3: local logger hooks ----------
  const ML = {
    enabled: true,
    events: [],
    maxEvents: 900,
    push(ev){
      if(!this.enabled) return;
      this.events.push(ev);
      if(this.events.length > this.maxEvents) this.events.splice(0, this.events.length - this.maxEvents);
    },
    feature(){
      // small vector; extend later
      const acc = st.shots>0 ? (st.hits/st.shots) : 0;
      return {
        tMs: Math.round(now()),
        score: st.score,
        combo: st.combo,
        comboMax: st.comboMax,
        miss: st.miss,
        shots: st.shots,
        hits: st.hits,
        acc: Math.round(acc*1000)/1000,
        clean: Math.round(st.clean*10)/10,
        wave: wave.name,
        intensity: Math.round(wave.intensity*1000)/1000,
        boss: st.bossActive ? 1 : 0,
        laser: boss.laserOn ? 1 : 0,
        shock: boss.shockOn ? 1 : 0,
        fever: director.feverOn ? 1 : 0
      };
    }
  };

  function logEvent(type, extra){
    const e = { type, ts: Date.now(), ...extra };
    ML.push(e);
    // optional global emit for future cloud logger
    emit('hha:event', e);
  }

  // ---------- fun boost ----------
  let fun = null;
  let director = { spawnMul:1, timeScale:1, wave:'calm', intensity:0, feverOn:false };

  // ---------- game state ----------
  const st = {
    running:false,
    paused:false,
    over:false,
    t0:0,
    lastHud:0,

    score:0,
    combo:0,
    comboMax:0,
    miss:0,
    shots:0,
    hits:0,

    clean:0,
    cleanGainPerHit: 1.2,
    cleanLosePerMiss: 0.6,

    baseSpawnMs: 760,
    ttlMs: 1650,
    perfectWindowMs: 220,

    bossEveryPct: 28,
    nextBossAt: 28,
    bossActive:false,

    uid:0,
    targets: new Map(),
  };

  // ---------- PACK 1: Wave Director ----------
  const wave = {
    name: 'calm',
    t0: 0,
    cycleMs: 22000,
    intensity: 0,   // 0..1
    perf: { hits:0, shots:0, miss:0, combo:0, comboMax:0 },
    // derived each tick:
    spawnMul: 1,
    ttlMul: 1,
    scoreMul: 1,
    bossRateMul: 1
  };

  function waveReset(){
    wave.name='calm';
    wave.t0 = now();
    wave.intensity = 0;
    wave.perf = { hits:0, shots:0, miss:0, combo:0, comboMax:0 };
  }

  function waveOnAction(){
    // update from st
    wave.perf.hits = st.hits;
    wave.perf.shots = st.shots;
    wave.perf.miss = st.miss;
    wave.perf.combo = st.combo;
    wave.perf.comboMax = st.comboMax;
  }

  function waveTick(){
    const t = now();
    const dt = t - wave.t0;

    // base cycle segments
    const p = (dt % wave.cycleMs) / wave.cycleMs; // 0..1
    // calm 0..0.35, rush 0.35..0.75, chaos 0.75..1
    if(p < 0.35) wave.name='calm';
    else if(p < 0.75) wave.name='rush';
    else wave.name='chaos';

    // performance-based intensity (deterministic, no randomness)
    const acc = wave.perf.shots>0 ? (wave.perf.hits / wave.perf.shots) : 0.65;
    const missRate = wave.perf.shots>0 ? (wave.perf.miss / wave.perf.shots) : 0.12;
    const comboBoost = clamp(wave.perf.comboMax / 35, 0, 1);

    // good play increases intensity smoothly, missRate lowers
    let I = 0.15 + 0.55*acc + 0.30*comboBoost - 0.35*missRate;
    I = clamp(I, 0, 1);

    // wave shape multiplier
    const wMul = (wave.name==='calm'? 0.82 : wave.name==='rush'? 1.0 : 1.18);
    wave.intensity = clamp(I * wMul, 0, 1);

    wave.spawnMul = 1.0 + wave.intensity * 0.55;  // more targets
    wave.ttlMul   = 1.0 - wave.intensity * 0.22;  // less time
    wave.scoreMul = 1.0 + wave.intensity * 0.25;  // reward
    wave.bossRateMul = 1.0 + wave.intensity * 0.22;

    return wave;
  }

  // ---------- PACK 2: Boss director ----------
  const boss = {
    active: false,
    phase: 0,
    hp: 0,
    hpMax: 0,
    weakMode: false,
    weakUntil: 0,

    // hazards
    laserOn: false,
    laserUntil: 0,
    shockOn: false,
    shockGateOpen: false,
    shockGateUntil: 0,

    // telegraph
    teleUntil: 0,
    noHit: false
  };

  function bossReset(){
    boss.active=false;
    boss.phase=0;
    boss.hp=0;
    boss.hpMax=0;
    boss.weakMode=false;
    boss.weakUntil=0;

    boss.laserOn=false;
    boss.laserUntil=0;
    boss.shockOn=false;
    boss.shockGateOpen=false;
    boss.shockGateUntil=0;

    boss.teleUntil=0;
    boss.noHit=false;
  }

  function bossStart(){
    bossReset();
    boss.active=true;
    boss.phase=1;

    const baseHp = (ctx.diff==='hard'? 9 : ctx.diff==='easy'? 6 : 8);
    boss.hpMax = baseHp + Math.round(wave.intensity*4);
    boss.hp = boss.hpMax;

    // telegraph then allow hits
    boss.teleUntil = now() + 800;
    boss.noHit = false;

    WIN.BrushAI?.onBossStart?.();
    WIN.dispatchEvent(new CustomEvent('brush:ai', { detail:{ type:'boss_start' }}));

    logEvent('boss_start', { hp: boss.hp, hpMax: boss.hpMax, phase: boss.phase, wave: wave.name });

    toast('💎 BOSS!');
  }

  function bossPhaseAdvance(){
    boss.phase += 1;
    WIN.BrushAI?.onBossPhase?.(boss.phase, boss.hp);
    WIN.dispatchEvent(new CustomEvent('brush:ai', { detail:{ type:'boss_phase', phase: boss.phase, hp: boss.hp }}));
    logEvent('boss_phase', { phase: boss.phase, hp: boss.hp });

    // phase pattern
    // P2: weak spot windows
    // P3: laser stop/go
    // P4: shock timing
    if(boss.phase===2){
      // open weak spot after short telegraph
      boss.teleUntil = now() + 600;
      boss.weakMode = true;
      boss.weakUntil = now() + 3200;
      toast('🎯 Weak Spot!');
    }else if(boss.phase===3){
      // laser: must not hit during sweep
      boss.teleUntil = now() + 600;
      boss.laserOn = true;
      boss.laserUntil = now() + 1500;
      WIN.dispatchEvent(new CustomEvent('brush:ai',{detail:{type:'laser_warn'}}));
      setTimeout(()=> WIN.dispatchEvent(new CustomEvent('brush:ai',{detail:{type:'laser_on'}})), 450);
      toast('⚠️ Laser!');
    }else if(boss.phase===4){
      boss.teleUntil = now() + 600;
      boss.shockOn = true;
      boss.shockGateOpen = false;
      boss.shockGateUntil = 0;
      WIN.dispatchEvent(new CustomEvent('brush:ai',{detail:{type:'shock_on'}}));
      toast('🎵 Shock!');
    }else{
      // final: short weak + reward
      boss.weakMode = true;
      boss.weakUntil = now() + 2400;
      WIN.dispatchEvent(new CustomEvent('brush:ai',{detail:{type:'finisher_on'}}));
      toast('🏁 FINISH!');
    }
  }

  function bossTick(){
    if(!boss.active) return;

    const t = now();

    // end weak mode window
    if(boss.weakMode && t >= boss.weakUntil){
      boss.weakMode = false;
    }

    // laser end
    if(boss.laserOn && t >= boss.laserUntil){
      boss.laserOn = false;
    }

    // shock pulses: gate opens briefly every ~900ms
    if(boss.shockOn){
      if(!boss.shockGateOpen){
        // open gate briefly
        boss.shockGateOpen = true;
        boss.shockGateUntil = t + 320;
        WIN.dispatchEvent(new CustomEvent('brush:ai',{detail:{type:'shock_pulse', idx: Math.floor(t/900) }}));
      }else if(t >= boss.shockGateUntil){
        boss.shockGateOpen = false;
      }
    }
  }

  // ---------- gameplay ----------
  function layerRect(){ return layer.getBoundingClientRect(); }

  function hud(force){
    const t = now();
    if(!force && t - st.lastHud < 60) return;
    st.lastHud = t;

    if(tScore) tScore.textContent = String(st.score);
    if(tCombo) tCombo.textContent = String(st.combo);
    if(tMiss)  tMiss.textContent  = String(st.miss);

    const elapsed = st.running ? ((t - st.t0)/1000) : 0;
    const left = st.running ? Math.max(0, ctx.time - elapsed) : ctx.time;
    if(tTime) tTime.textContent = left.toFixed(0);

    const clean = clamp(st.clean, 0, 100);
    if(tClean) tClean.textContent = `${Math.round(clean)}%`;
    if(bClean) bClean.style.width = `${clean}%`;

    const fb = fun?.getState?.().feverCharge || 0;
    const th = fun?.cfg?.feverThreshold || 18;
    const pct = director.feverOn ? 100 : clamp((fb/th)*100, 0, 100);
    if(tFever) tFever.textContent = director.feverOn ? 'ON' : 'OFF';
    if(bFever) bFever.style.width = `${pct}%`;
  }

  function mkTarget({x,y,kind,hpMax}){
    const id = String(++st.uid);
    const el = DOC.createElement('div');
    el.className = 'br-t' + (kind==='boss' ? ' thick' : '');
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const emo = DOC.createElement('div');
    emo.className = 'emo';
    emo.textContent = (kind==='boss') ? '💎' : '🦠';
    el.appendChild(emo);

    const hp = DOC.createElement('div');
    hp.className = 'hp';
    const fill = DOC.createElement('i');
    hp.appendChild(fill);
    el.appendChild(hp);

    const born = now();
    const ttl = st.ttlMs * (director.timeScale || 1) * (wave.ttlMul || 1);
    const die  = born + ttl;

    st.targets.set(id, { el, kind, bornMs: born, dieMs: die, hpMax, hp: hpMax, fillEl: fill });

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onHitAt(x, y, { source:'tap', targetId:id });
    }, { passive:false });

    layer.appendChild(el);
  }

  function updateHpVis(it){
    if(!it || !it.fillEl) return;
    const pct = clamp((it.hp / it.hpMax) * 100, 0, 100);
    it.fillEl.style.width = pct + '%';
  }

  function removeTarget(id, popped){
    const it = st.targets.get(id);
    if(!it) return;
    st.targets.delete(id);

    const el = it.el;
    if(!el) return;

    if(popped) el.classList.add('pop');
    el.classList.add('fade');
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
  }

  function gradeFromAcc(acc){
    if(acc >= 92) return 'S';
    if(acc >= 82) return 'A';
    if(acc >= 70) return 'B';
    if(acc >= 55) return 'C';
    return 'D';
  }

  function onPerfect(){
    fun?.onAction?.({ type:'perfect' });
    st.score += 2;
    toast('✨ Perfect!');
    logEvent('perfect', { wave: wave.name, I: wave.intensity });
  }

  function onHitTarget(it, remainMs){
    st.hits += 1;

    // boss rules:
    // - laserOn => NO HIT (penalty)
    // - shockOn => only allow hits when gate open; else penalty
    if(it.kind==='boss'){
      if(boss.laserOn){
        st.miss += 1;
        st.combo = 0;
        st.score = Math.max(0, st.score - 2);
        toast('🚫 NO HIT (Laser)');
        WIN.dispatchEvent(new CustomEvent('brush:ai',{detail:{type:'laser_on'}}));
        logEvent('boss_nohit_laser', {});
        return;
      }
      if(boss.shockOn && !boss.shockGateOpen){
        st.miss += 1;
        st.combo = 0;
        st.score = Math.max(0, st.score - 1);
        toast('🎵 Timing!');
        logEvent('boss_nohit_shock', {});
        return;
      }
    }

    // perfect if near expiry
    if(remainMs <= st.perfectWindowMs) onPerfect();
    else fun?.onAction?.({ type:'hit' });

    st.combo += 1;
    st.comboMax = Math.max(st.comboMax, st.combo);

    const comboMul = 1 + Math.min(0.6, st.combo * 0.02);
    const base = (it.kind==='boss') ? 3 : 1;

    // PACK 1 reward scaling
    const waveMul = wave.scoreMul || 1;

    st.score += Math.round(base * comboMul * (director.feverOn ? 1.3 : 1.0) * waveMul);

    // clean progress
    const gain = st.cleanGainPerHit * (it.kind==='boss' ? 1.25 : 1.0) * (director.feverOn ? 1.2 : 1.0);
    st.clean = clamp(st.clean + gain, 0, 100);

    waveOnAction();

    // fever fantasy burst
    if(director.feverOn && rng() < 0.18){
      burstPop(1);
    }

    logEvent('hit', { kind: it.kind, wave: wave.name, I: wave.intensity, combo: st.combo });
  }

  function onMiss(kind, reason){
    st.miss += 1;
    st.combo = 0;
    st.score = Math.max(0, st.score - (kind==='boss'? 2 : 1));
    st.clean = clamp(st.clean - st.cleanLosePerMiss, 0, 100);
    fun?.onAction?.({ type:'timeout' });
    waveOnAction();
    logEvent('miss', { kind, reason: reason||'timeout', wave: wave.name, I: wave.intensity });
  }

  function burstPop(n){
    const arr = Array.from(st.targets.entries()).filter(([,v])=> v.kind==='plaque');
    for(let i=0;i<Math.min(n, arr.length);i++){
      const pick = arr[Math.floor(rng()*arr.length)];
      if(!pick) break;
      const [id] = pick;
      const it = st.targets.get(id);
      if(it){
        onHitTarget(it, 0);
        removeTarget(id, true);
      }
    }
  }

  function hitTest(x,y){
    const rad = 44;
    let best = null, bestD = 1e9;
    for(const [id,it] of st.targets){
      const el = it.el;
      if(!el) continue;
      const ex = parseFloat(el.style.left || '0');
      const ey = parseFloat(el.style.top  || '0');
      const dx = ex - x;
      const dy = ey - y;
      const d2 = dx*dx + dy*dy;
      if(d2 <= rad*rad && d2 < bestD){
        bestD = d2;
        best = { id, it };
      }
    }
    return best;
  }

  function bossDamagePerHit(){
    // weak spot doubles damage
    const base = 1;
    const weak = boss.weakMode ? 2 : 1;
    const fever = director.feverOn ? 1.2 : 1;
    const w = 1 + wave.intensity*0.25;
    return base * weak * fever * w;
  }

  function onHitAt(x,y){
    if(!st.running || st.paused || st.over) return;

    // stop hits during telegraph no-hit windows (visual clarity)
    const t = now();
    if(boss.active && boss.teleUntil && t < boss.teleUntil){
      toast('⏱️ Wait');
      logEvent('nohit_telegraph', {});
      return;
    }

    st.shots += 1;
    WIN.BrushAI?.onAction?.({ shots: st.shots, hits: st.hits, miss: st.miss, combo: st.combo, comboMax: st.comboMax, clean: st.clean });

    const hit = hitTest(x,y);
    if(!hit){
      st.combo = 0;
      st.miss += 1;
      st.score = Math.max(0, st.score - 1);
      fun?.onNearMiss?.({ reason:'whiff' });
      waveOnAction();
      hud(true);
      logEvent('whiff', {});
      return;
    }

    const { id, it } = hit;

    // remain time
    const remain = it.dieMs - t;

    // apply damage
    if(it.kind==='boss'){
      const dmg = bossDamagePerHit();
      it.hp = Math.max(0, it.hp - dmg);
      boss.hp = it.hp; // sync
      updateHpVis(it);

      onHitTarget(it, remain);

      // boss phase thresholds (by hp%)
      const hpPct = (boss.hpMax>0) ? (boss.hp / boss.hpMax) : 0;
      if(boss.phase===1 && hpPct <= 0.72) bossPhaseAdvance();
      else if(boss.phase===2 && hpPct <= 0.48) bossPhaseAdvance();
      else if(boss.phase===3 && hpPct <= 0.28) bossPhaseAdvance();

      if(it.hp <= 0){
        removeTarget(id, true);
        st.bossActive = false;
        boss.active = false;
        toast('💥 Boss แตก!');
        WIN.dispatchEvent(new CustomEvent('brush:ai',{detail:{type:'gate_break'}}));
        logEvent('boss_end', { wave: wave.name });
        st.nextBossAt = Math.min(100, st.nextBossAt + Math.round(st.bossEveryPct * (1 / (wave.bossRateMul||1))));
      }

    }else{
      // plaque
      it.hp = Math.max(0, it.hp - 1);
      updateHpVis(it);
      onHitTarget(it, remain);
      if(it.hp <= 0) removeTarget(id, true);
    }

    hud(true);
    emit('hha:score', { score: st.score, combo: st.combo, miss: st.miss, clean: st.clean, ts: Date.now() });

    if(st.clean >= 100) endGame('clean');
  }

  // cVR shoot hook
  WIN.addEventListener('hha:shoot', (ev)=>{
    const d = ev?.detail || {};
    const x = safeNum(d.x, NaN);
    const y = safeNum(d.y, NaN);
    if(Number.isFinite(x) && Number.isFinite(y)) onHitAt(x, y);
  });

  // ---------- timing ----------
  let spawnTimer = null;
  let tickTimer = null;

  function spawnOne(){
    if(!st.running || st.paused || st.over) return;

    // external fun + our wave director
    director = fun ? fun.tick() : director;
    waveTick();
    bossTick();

    const r = layerRect();
    const pad = 56;

    const x = pad + rng() * Math.max(10, (r.width - pad*2));
    const y = pad + rng() * Math.max(10, (r.height - pad*2));

    // boss spawn condition
    if(!st.bossActive && st.clean >= st.nextBossAt && st.clean < 100){
      st.bossActive = true;

      // create boss target (hpMax sync with bossStart)
      bossStart();
      mkTarget({ x, y, kind:'boss', hpMax: boss.hpMax });

      emit('hha:coach', { msg:'เจอบอสคราบหนา! ทำจังหวะให้แม่น (มีเลเซอร์/ช็อค)!', ts: Date.now() });
      return;
    }

    mkTarget({ x, y, kind:'plaque', hpMax: 1 });
  }

  function scheduleSpawn(){
    clearTimeout(spawnTimer);
    if(!st.running || st.paused || st.over) return;

    const base = st.baseSpawnMs;
    const waveMul = wave.spawnMul || 1;

    const every0 = base / waveMul;
    const every = fun ? fun.scaleIntervalMs(every0, director) : every0;

    spawnTimer = setTimeout(()=>{
      spawnOne();
      scheduleSpawn();
    }, every);
  }

  function tick(){
    if(!st.running || st.paused || st.over) return;

    director = fun ? fun.tick() : director;
    waveTick();
    bossTick();

    const t = now();

    // timeout targets
    for(const [id,it] of st.targets){
      if(t >= it.dieMs){
        removeTarget(id, false);
        if(it.kind==='boss'){
          st.bossActive = false;
          boss.active = false;
          toast('💎 Boss หลุด!');
          logEvent('boss_escape', {});
        }
        onMiss(it.kind, 'timeout');
      }
    }

    const elapsed = (t - st.t0)/1000;
    const left = ctx.time - elapsed;

    // PACK 3: periodic feature snapshot
    if((tick._lastFeat||0) + 260 < Date.now()){
      tick._lastFeat = Date.now();
      logEvent('feat', { f: ML.feature() });
    }

    // AI tick
    WIN.BrushAI?.onTick?.({
      t, left: Math.max(0,left),
      clean: st.clean, combo: st.combo, miss: st.miss,
      feverOn: !!director.feverOn,
      feverCharge: fun?.getState?.().feverCharge || 0,
      bossActive: st.bossActive
    });

    // 10s warning AI
    if(left <= 10 && left > 9.6){
      WIN.dispatchEvent(new CustomEvent('brush:ai',{detail:{type:'time_10s'}}));
    }

    emit('hha:time', { t: Math.max(0,left), elapsed, ts: Date.now() });
    hud();

    if(left <= 0) endGame('time');
  }

  // ---------- start/end ----------
  function setBackLinks(){
    const hubUrl = passHubUrl(ctx);
    for (const a of [btnBack, btnBackHub2]){
      if(!a) continue;
      try{
        const u = new URL(hubUrl, location.href);
        if(ctx.pid) u.searchParams.set('pid', ctx.pid);
        if(ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
        if(ctx.phase) u.searchParams.set('phase', ctx.phase);
        if(ctx.conditionGroup) u.searchParams.set('conditionGroup', ctx.conditionGroup);
        a.href = u.toString();
      }catch(_){
        a.href = hubUrl;
      }
    }
  }

  function tune(){
    if(ctx.diff==='easy'){
      st.baseSpawnMs = 920;
      st.ttlMs = 2000;
      st.perfectWindowMs = 260;
      st.cleanGainPerHit = 1.38;
      st.cleanLosePerMiss = 0.42;
      st.bossEveryPct = 30;
    }else if(ctx.diff==='hard'){
      st.baseSpawnMs = 640;
      st.ttlMs = 1450;
      st.perfectWindowMs = 200;
      st.cleanGainPerHit = 1.05;
      st.cleanLosePerMiss = 0.78;
      st.bossEveryPct = 24;
    }else{
      st.baseSpawnMs = 760;
      st.ttlMs = 1650;
      st.perfectWindowMs = 220;
      st.cleanGainPerHit = 1.2;
      st.cleanLosePerMiss = 0.6;
      st.bossEveryPct = 28;
    }
  }

  function startGame(){
    // reset
    st.running = true;
    st.paused = false;
    st.over = false;

    st.t0 = now();
    st.score = 0;
    st.combo = 0;
    st.comboMax = 0;
    st.miss = 0;
    st.shots = 0;
    st.hits = 0;
    st.clean = 0;

    st.nextBossAt = st.bossEveryPct;
    st.bossActive = false;
    bossReset();
    waveReset();

    // clear
    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    if(menu) menu.style.display = 'none';
    if(end) end.hidden = true;
    if(wrap) wrap.dataset.state = 'play';
    if(btnPause) btnPause.textContent = 'Pause';

    WIN.BrushAI?.onStart?.({});

    toast('เริ่ม! แปรงคราบให้ทัน!');
    hud(true);

    logEvent('start', { ctx, seed: ctx.seed, diff: ctx.diff, view: ctx.view });
    emit('hha:start', {
      game:'brush', category:'hygiene',
      pid: ctx.pid, studyId: ctx.studyId, phase: ctx.phase, conditionGroup: ctx.conditionGroup,
      seed: ctx.seed, diff: ctx.diff, view: ctx.view, timePlannedSec: ctx.time,
      ts: Date.now()
    });

    scheduleSpawn();
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 80);
  }

  function endGame(reason){
    if(st.over) return;
    st.over = true;
    st.running = false;

    clearTimeout(spawnTimer);
    clearInterval(tickTimer);

    for(const [id] of st.targets) removeTarget(id, false);
    st.targets.clear();

    const acc = (st.shots > 0) ? (st.hits / st.shots) * 100 : 0;
    const grade = (acc >= 92 ? 'S' : acc >= 82 ? 'A' : acc >= 70 ? 'B' : acc >= 55 ? 'C' : 'D');
    const elapsed = Math.min(ctx.time, (now() - st.t0)/1000);

    const summary = {
      game:'brush', category:'hygiene',
      reason,
      pid: ctx.pid, studyId: ctx.studyId, phase: ctx.phase, conditionGroup: ctx.conditionGroup,
      seed: ctx.seed, diff: ctx.diff, view: ctx.view,

      score: st.score,
      comboMax: st.comboMax,
      miss: st.miss,
      shots: st.shots,
      hits: st.hits,
      accuracyPct: Math.round(acc*10)/10,
      grade,

      cleanPct: Math.round(clamp(st.clean,0,100)),
      timePlannedSec: ctx.time,
      timePlayedSec: Math.round(elapsed*10)/10,

      // PACK 3: include last features snapshot + event count
      ml_lastFeat: ML.feature(),
      ml_events: ML.events.length,

      date: ymdLocal(),
      ts: Date.now()
    };

    logEvent('end', { reason, summary });

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const k='HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(k)||'[]');
      arr.push(summary);
      localStorage.setItem(k, JSON.stringify(arr.slice(-30)));
    }catch(_){}

    try{
      localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1');
    }catch(_){}

    emit('hha:judge', { ...summary });
    emit('hha:end', { ...summary });

    if(sScore) sScore.textContent = String(summary.score);
    if(sAcc)   sAcc.textContent   = `${summary.accuracyPct}%`;
    if(sMiss)  sMiss.textContent  = String(summary.miss);
    if(sCombo) sCombo.textContent = String(summary.comboMax);
    if(sClean) sClean.textContent = `${summary.cleanPct}%`;
    if(sTime)  sTime.textContent  = `${summary.timePlayedSec}s`;
    if(endGrade) endGrade.textContent = summary.grade;

    if(endNote){
      endNote.textContent =
        `reason=${reason} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | wave=${wave.name} | pid=${summary.pid||'-'}`;
    }

    if(end) end.hidden = false;
    if(menu) menu.style.display = 'none';
    toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'หมดเวลา!');
  }

  function togglePause(){
    if(!st.running || st.over) return;
    st.paused = !st.paused;
    if(btnPause) btnPause.textContent = st.paused ? 'Resume' : 'Pause';
    toast(st.paused ? '⏸ Pause' : '▶ Resume');
    logEvent('pause', { paused: st.paused });
  }

  // ---------- boot ----------
  function boot(inCtx){
    if(BOOTED) return;
    BOOTED = true;

    const qs = getQS();
    ctx = {
      hub: inCtx?.hub || qs.get('hub') || '../hub.html',
      run: inCtx?.run || qs.get('run') || qs.get('mode') || 'play',
      view: (inCtx?.view || qs.get('view') || 'pc').toLowerCase(),
      diff: (inCtx?.diff || qs.get('diff') || 'normal').toLowerCase(),
      time: clamp(safeNum(inCtx?.time ?? qs.get('time'), 80), 30, 120),
      seed: safeNum(inCtx?.seed ?? qs.get('seed'), Date.now()),
      pid: (inCtx?.pid ?? qs.get('pid') ?? qs.get('participantId') ?? '').trim(),
      studyId: (inCtx?.studyId ?? qs.get('studyId') ?? '').trim(),
      phase: (inCtx?.phase ?? qs.get('phase') ?? '').trim(),
      conditionGroup: (inCtx?.conditionGroup ?? qs.get('conditionGroup') ?? '').trim(),
      log: (inCtx?.log ?? qs.get('log') ?? '').trim(),
      api: (inCtx?.api ?? qs.get('api') ?? '').trim(),
      health: (inCtx?.health ?? qs.get('health') ?? '').trim()
    };

    if(wrap) wrap.dataset.view = ctx.view;
    DOC.body.setAttribute('data-view', ctx.view);

    if(ctxView) ctxView.textContent = ctx.view;
    if(ctxSeed) ctxSeed.textContent = String((ctx.seed >>> 0));
    if(ctxTime) ctxTime.textContent = `${ctx.time}s`;
    if(diffTag) diffTag.textContent = ctx.diff;
    if(mDiff) mDiff.textContent = ctx.diff;
    if(mTime) mTime.textContent = `${ctx.time}s`;

    rng = seededRng(ctx.seed);

    // fun boost (optional)
    fun = WIN.HHA?.createFunBoost?.({
      seed: (String(ctx.seed || ctx.pid || 'brush')),
      baseSpawnMul: 1.0,
      waveCycleMs: 20000,
      feverThreshold: 18,
      feverDurationMs: 6800,
      feverSpawnBoost: 1.18,
      feverTimeScale: 0.92
    }) || null;

    director = fun ? fun.tick() : director;

    WIN.BrushAI?.configure?.({ seed: ctx.seed });

    tune();
    setBackLinks();

    // controls
    btnStart?.addEventListener('click', startGame, { passive:true });
    btnRetry?.addEventListener('click', startGame, { passive:true });
    btnPause?.addEventListener('click', togglePause, { passive:true });

    btnHow?.addEventListener('click', ()=>{
      toast('แตะ/ยิง “🦠” ให้ทัน • บอส “💎” มี Weak/ Laser/ Shock • ใกล้หมดเวลา = Perfect!');
    }, { passive:true });

    btnRecenter?.addEventListener('click', ()=>{
      WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
      toast('Recenter');
      logEvent('recenter', {});
    }, { passive:true });

    layer?.addEventListener('pointerdown', (ev)=>{
      if(ctx.view==='cvr') return;
      if(!st.running || st.paused || st.over) return;
      onHitAt(ev.clientX, ev.clientY);
    }, { passive:true });

    hud(true);
    toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');
    logEvent('boot', { ctx });
  }

  // expose
  WIN.BrushVR = { boot };

})();