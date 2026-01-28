// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE — PRODUCTION FULL (v5.2.0)
// ✅ Standalone DOM Engine (no GameEngine.js dependency)
// ✅ Works with vr-ui.js (hha:shoot)
// ✅ Play: adaptive ON (fair) / Research: deterministic seed + adaptive OFF
// ✅ GOAL + MINI (quest:update) + Rank/Acc + Boss + Storm
// ✅ Safe spawn rect (avoid HUD) + responsive for PC/Mobile/cVR
// ✅ Emits: hha:score, hha:time, hha:rank, hha:coach, hha:end, groups:power, groups:progress, groups:telemetry_hint
// ✅ Deterministic RNG for research
'use strict';

(function(){
  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  if (WIN.GroupsVR && WIN.GroupsVR.__ENGINE_LOADED__) return;

  // namespace
  const NS = WIN.GroupsVR = WIN.GroupsVR || {};
  NS.__ENGINE_LOADED__ = true;

  // -------------------------
  // helpers
  // -------------------------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const randi = (a,b)=>Math.floor(a + Math.random()*(b-a+1));
  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function setText(el, t){ if (el) el.textContent = String(t ?? ''); }
  function setW(el, pct){ if (el) el.style.width = clamp(pct,0,100) + '%'; }

  // -------------------------
  // deterministic RNG (mulberry32)
  // -------------------------
  function hash32(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  // -------------------------
  // GameEngine public API
  // -------------------------
  const Engine = {
    _layerEl: null,
    _running: false,
    _timers: [],
    _raf: 0,
    _state: null,

    setLayerEl(el){
      this._layerEl = el || DOC.body;
    },

    start(diff, opts){
      this.stop();

      const runMode = String((opts && opts.runMode) || qs('run','play') || 'play').toLowerCase();
      const view    = String(qs('view','mobile') || 'mobile').toLowerCase();
      const style   = String((opts && opts.style) || qs('style','mix') || 'mix').toLowerCase();
      const timeSec = clamp((opts && opts.time) || qs('time', 90), 30, 180);
      const seedStr = String((opts && opts.seed) || qs('seed', Date.now()) || Date.now());

      // research: deterministic + adaptive OFF
      const isResearch = (runMode === 'research');
      const isPractice = (runMode === 'practice');
      const adaptiveOn = (!isResearch && !isPractice);

      // rng
      const seed32 = hash32(seedStr);
      const rng = isResearch ? mulberry32(seed32) : Math.random;

      // difficulty table
      const D = getDiffTable(String(diff||'normal').toLowerCase(), adaptiveOn);

      // build state
      const S = this._state = {
        runMode, view, style,
        timeSec,
        tLeft: timeSec,
        tStartIso: new Date().toISOString(),
        seedStr, seed32,
        isResearch, isPractice, adaptiveOn,
        rng,
        D,
        // stats
        score: 0,
        hits: 0,
        shots: 0,
        misses: 0,
        combo: 0,
        bestCombo: 0,
        accPct: 0,
        grade: 'C',
        // power
        charge: 0,
        chargeThr: D.chargeThr,
        // phase
        storm: false,
        stormEndsAt: 0,
        boss: null, // {hp,max,active,endsAt}
        // quest
        goal: null,
        mini: null,
        goalNow: 0,
        goalTot: 1,
        miniNow: 0,
        miniTot: 1,
        miniEndsAt: 0,
        // group
        groupKey: '',
        groupName: '—',
        groupOrder: [],
        groupIndex: 0,
        // spawn
        lastSpawnAt: 0,
        spawnEvery: D.spawnEveryMs,
        targets: new Set(),
        // safe rect
        safe: { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 },
        // buffers for adaptive
        recent: [],
        // end
        ended: false,
        endReason: '',
      };

      this._running = true;

      // mount layer
      const layer = this._layerEl || DOC.body;
      layer.classList.add('groups-layer');

      // ensure helpers exist
      ensureStyleOnce();

      // init group order
      S.groupOrder = buildGroupOrder(S, style);
      setCurrentGroup(S, 0, true);

      // init quests
      initGoal(S);
      initMini(S, true);

      // measure safe rect
      measureSafeRect(S);

      // bind input
      bindShoot(this, S);

      // tick timers
      tickHUD(S);

      // start loops
      this._timers.push(setInterval(()=>tick1s(this, S), 1000));
      this._timers.push(setInterval(()=>spawnLoop(this, S), 40));
      this._raf = requestAnimationFrame(()=>rafLoop(this, S));

      // coach hello
      if (S.isResearch) emit('hha:coach', { text:'โหมดวิจัย: ล็อก seed + ปิด adaptive ✅', mood:'neutral' });
      else if (S.isPractice) emit('hha:coach', { text:'โหมดฝึก: 15 วิ ลองเล็ง/ยิงให้คล่อง แล้วเริ่มจริง ✅', mood:'neutral' });
      else emit('hha:coach', { text:'เริ่มเลย! ดูหมู่ให้ชัวร์ก่อนยิง 🎯', mood:'happy' });

      emit('groups:power', { charge: S.charge, threshold: S.chargeThr });
      emitQuest(S);
      emitRank(S);
      emitScore(S);
      emit('hha:time', { left: S.tLeft });

      // hint: telemetry recommended
      emit('groups:telemetry_hint', { recommend: 'lite', reason:'default' });
    },

    stop(){
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this._timers && this._timers.length){
        this._timers.forEach(t=>{ try{ clearInterval(t); clearTimeout(t); }catch(_){ } });
      }
      this._timers = [];
      if (this._state){
        try{ cleanupTargets(this._state); }catch(_){}
      }
      this._state = null;
      unbindShoot();
    }
  };

  NS.GameEngine = Engine;

  // -------------------------
  // difficulty tables
  // -------------------------
  function getDiffTable(diff, adaptiveOn){
    // baseline
    const base = {
      spawnEveryMs: 720,
      ttlMs: 2600,
      sizePx: 86,
      maxTargets: 6,
      scoreHit: 12,
      scoreMiss: -6,
      comboMultMax: 2.2,
      chargeThr: 8,
      stormEverySec: 18,
      stormLenSec: 6,
      bossAtSec: 22,
      bossLenSec: 9,
      bossHp: 18,
      bossBonus: 80
    };

    if (diff === 'easy'){
      base.spawnEveryMs = 820;
      base.ttlMs = 2900;
      base.sizePx = 92;
      base.maxTargets = 5;
      base.chargeThr = 7;
      base.bossHp = 14;
    } else if (diff === 'hard'){
      base.spawnEveryMs = 600;
      base.ttlMs = 2300;
      base.sizePx = 78;
      base.maxTargets = 7;
      base.chargeThr = 9;
      base.bossHp = 22;
    }

    // adaptive: allow small nudges only
    base.adaptiveOn = !!adaptiveOn;
    base.adapt = {
      windowSec: 8,
      maxNudge: 0.22,        // clamp %
      minSpawnMs: 520,
      maxSpawnMs: 980,
      minTtlMs: 1900,
      maxTtlMs: 3300,
      minSizePx: 70,
      maxSizePx: 102,
      coolDownMs: 1800
    };
    return base;
  }

  // -------------------------
  // groups data
  // -------------------------
  // Thai 5 food groups mapping (fixed per memory)
  const GROUPS = [
    { key:'g1', name:'หมู่ 1 โปรตีน',    cls:'g1', emojis:['🥚','🥛','🐟','🍗','🫘'] },
    { key:'g2', name:'หมู่ 2 คาร์โบไฮเดรต', cls:'g2', emojis:['🍚','🍞','🥔','🍜','🍠'] },
    { key:'g3', name:'หมู่ 3 ผัก',       cls:'g3', emojis:['🥦','🥬','🥕','🥒','🌽'] },
    { key:'g4', name:'หมู่ 4 ผลไม้',     cls:'g4', emojis:['🍎','🍌','🍇','🍉','🍍'] },
    { key:'g5', name:'หมู่ 5 ไขมัน',     cls:'g5', emojis:['🥑','🧈','🥜','🫒','🍳'] }
  ];

  function buildGroupOrder(S, style){
    // style=mix (default): random-ish but deterministic in research
    const arr = GROUPS.map(g=>g.key);
    const rand = (n)=> S.isResearch ? S.rng() : Math.random();
    if (style === 'fixed') return arr;

    // shuffle
    for (let i=arr.length-1;i>0;i--){
      const j = Math.floor(rand()*(i+1));
      const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp;
    }
    return arr;
  }

  function getGroupByKey(k){
    return GROUPS.find(g=>g.key===k) || GROUPS[0];
  }

  function setCurrentGroup(S, idx, forceBanner){
    S.groupIndex = (idx|0) % S.groupOrder.length;
    S.groupKey = S.groupOrder[S.groupIndex] || 'g1';
    const g = getGroupByKey(S.groupKey);
    S.groupName = g.name;

    // event
    emitQuest(S, true);
    emit('groups:progress', { kind:'group', groupKey:S.groupKey, groupName:S.groupName, force:!!forceBanner });
  }

  // -------------------------
  // quest system
  // -------------------------
  function initGoal(S){
    // goal: hit N correct of current group
    S.goalTot = Math.max(1, rPick(S, [12, 14, 16]));
    S.goalNow = 0;
    S.goal = { title:`ยิงให้ถูก: ${S.groupName}`, total:S.goalTot };
  }

  function initMini(S, first){
    // mini: within T sec hit M correct OR avoid miss
    const t = first ? 10 : rPick(S, [8, 9, 10]);
    const m = first ? 4  : rPick(S, [4, 5, 6]);
    S.miniTot = m;
    S.miniNow = 0;
    S.miniEndsAt = nowMs() + t*1000;
    S.mini = { title:`มินิ: ยิง ${m} ครั้งใน ${t}s (${S.groupName})`, total:m, sec:t };
  }

  function rPick(S, arr){
    const r = (S.isResearch ? S.rng() : Math.random());
    return arr[Math.floor(r*arr.length)];
  }

  function emitQuest(S, force){
    const now = nowMs();
    const leftMini = Math.max(0, Math.ceil((S.miniEndsAt - now)/1000));
    const goalPct = (S.goalTot>0) ? (S.goalNow/S.goalTot*100) : 0;
    const miniPct = (S.miniTot>0) ? (S.miniNow/S.miniTot*100) : 0;

    emit('quest:update', {
      goalTitle: S.goal ? S.goal.title : '—',
      goalNow: S.goalNow, goalTotal: S.goalTot, goalPct,
      miniTitle: S.mini ? S.mini.title : '—',
      miniNow: S.miniNow, miniTotal: S.miniTot, miniPct,
      miniTimeLeftSec: leftMini,
      groupKey: S.groupKey,
      groupName: S.groupName,
      force: !!force
    });
  }

  // -------------------------
  // safe rect for spawn
  // -------------------------
  function measureSafeRect(S){
    const W = Math.max(1, WIN.innerWidth|0);
    const H = Math.max(1, WIN.innerHeight|0);

    // avoid HUD area (top + a bit bottom)
    const topPad = Math.round(H * 0.18);
    const botPad = Math.round(H * 0.16);

    const left = Math.round(W * 0.06);
    const right= Math.round(W * 0.06);

    S.safe.x0 = left;
    S.safe.y0 = topPad;
    S.safe.x1 = W - right;
    S.safe.y1 = H - botPad;
    S.safe.w = Math.max(1, S.safe.x1 - S.safe.x0);
    S.safe.h = Math.max(1, S.safe.y1 - S.safe.y0);

    // tell UI if needed
    emit('groups:progress', { kind:'safe', safe:{...S.safe} });
  }

  WIN.addEventListener('resize', ()=>{
    if (!Engine._state) return;
    measureSafeRect(Engine._state);
  }, { passive:true });

  // allow external request
  WIN.addEventListener('gj:measureSafe', ()=>{
    if (!Engine._state) return;
    measureSafeRect(Engine._state);
  }, { passive:true });

  // -------------------------
  // targets
  // -------------------------
  function cleanupTargets(S){
    S.targets.forEach(t=>{
      try{ t.el && t.el.remove(); }catch(_){}
    });
    S.targets.clear();
  }

  function spawnLoop(E, S){
    if (!E._running || !S || S.ended) return;

    // throttle by maxTargets
    if (S.targets.size >= S.D.maxTargets) return;

    const t = nowMs();
    if (t - S.lastSpawnAt < S.spawnEvery) return;

    S.lastSpawnAt = t;

    // spawn one target
    spawnTarget(E, S);
  }

  function pickEmoji(S, groupKey){
    const g = getGroupByKey(groupKey);
    const arr = g.emojis || ['🍚'];
    const r = (S.isResearch ? S.rng() : Math.random());
    return arr[Math.floor(r*arr.length)];
  }

  function spawnTarget(E, S){
    const layer = E._layerEl || DOC.body;
    const g = getGroupByKey(S.groupKey);

    // correct/decoy
    const r = (S.isResearch ? S.rng() : Math.random());
    const isCorrect = (r < 0.68); // more correct to make kids feel fair
    const key = isCorrect ? S.groupKey : pickDecoyKey(S);

    const emoji = pickEmoji(S, key);

    // position
    const x = S.safe.x0 + Math.floor((S.isResearch?S.rng():Math.random()) * S.safe.w);
    const y = S.safe.y0 + Math.floor((S.isResearch?S.rng():Math.random()) * S.safe.h);

    const size = Math.round(S.D.sizePx * currentAdaptiveScale(S, 'size'));

    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = 'tgt ' + (getGroupByKey(key).cls || '');
    el.dataset.group = key;
    el.dataset.correct = isCorrect ? '1' : '0';
    el.style.left = (x - size/2) + 'px';
    el.style.top  = (y - size/2) + 'px';
    el.style.width = size + 'px';
    el.style.height= size + 'px';
    el.innerHTML = `<span class="emoji">${emoji}</span>`;

    // TTL
    const ttl = Math.round(S.D.ttlMs * currentAdaptiveScale(S, 'ttl'));
    const born = nowMs();
    const obj = { el, key, isCorrect, born, ttl, dead:false };

    el.addEventListener('click', ()=>onHit(E, S, obj), { passive:true });

    layer.appendChild(el);
    S.targets.add(obj);

    // auto expire
    setTimeout(()=>{
      if (!E._running || !S || obj.dead) return;
      const age = nowMs() - born;
      if (age >= ttl){
        onExpire(E, S, obj);
      }
    }, ttl + 30);
  }

  function pickDecoyKey(S){
    const keys = GROUPS.map(g=>g.key).filter(k=>k!==S.groupKey);
    const r = (S.isResearch ? S.rng() : Math.random());
    return keys[Math.floor(r*keys.length)];
  }

  // -------------------------
  // input: hha:shoot aim assist
  // -------------------------
  let shootHandler = null;
  function bindShoot(E, S){
    unbindShoot();
    shootHandler = (ev)=>{
      if (!E._running || !S || S.ended) return;
      const d = ev.detail || {};
      const x = Number(d.x);
      const y = Number(d.y);
      const lockPx = clamp(d.lockPx ?? 92, 18, 140);

      // find closest target within lockPx
      let best = null;
      let bestDist = 1e9;
      S.targets.forEach(t=>{
        if (!t || t.dead || !t.el) return;
        const r = t.el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top  + r.height/2;
        const dx = cx - x;
        const dy = cy - y;
        const dist = Math.hypot(dx,dy);
        if (dist < bestDist){
          bestDist = dist;
          best = t;
        }
      });

      S.shots++;
      if (best && bestDist <= lockPx){
        onHit(E, S, best, { byShoot:true, lockPx });
      }else{
        onMiss(E, S, { reason:'no_target', lockPx });
      }
    };

    WIN.addEventListener('hha:shoot', shootHandler, { passive:true });
  }

  function unbindShoot(){
    if (shootHandler){
      try{ WIN.removeEventListener('hha:shoot', shootHandler); }catch(_){}
    }
    shootHandler = null;
  }

  // -------------------------
  // scoring + rank + adaptive
  // -------------------------
  function scoreForHit(S, correct){
    let s = correct ? S.D.scoreHit : (S.D.scoreHit * 0.2);
    const comboMult = 1 + Math.min(S.D.comboMultMax-1, (S.combo/10));
    return Math.round(s * comboMult);
  }

  function updateRank(S){
    const shots = Math.max(1, S.shots);
    const acc = Math.round((S.hits / shots) * 100);
    S.accPct = acc;

    // grade
    let g = 'C';
    if (acc >= 92) g = 'S';
    else if (acc >= 85) g = 'A';
    else if (acc >= 75) g = 'B';
    else if (acc >= 60) g = 'C';
    else g = 'D';

    // miss penalty
    if (S.misses >= 12 && g === 'B') g = 'C';
    if (S.misses >= 16 && (g === 'A' || g === 'B')) g = 'C';
    if (S.misses >= 20 && g !== 'D') g = 'D';

    S.grade = g;
  }

  function emitScore(S){
    emit('hha:score', { score:S.score, combo:S.combo, misses:S.misses, hits:S.hits, shots:S.shots });
  }
  function emitRank(S){
    updateRank(S);
    emit('hha:rank', { grade:S.grade, accuracy:S.accPct });
  }

  function pushRecent(S, item){
    const W = S.D.adapt.windowSec * 1000;
    const t = nowMs();
    S.recent.push({ t, ...item });
    while (S.recent.length && (t - S.recent[0].t) > W) S.recent.shift();
  }

  function currentAdaptiveScale(S, kind){
    // returns multiplier
    if (!S.adaptiveOn) return 1;

    const a = S.D.adapt;
    const t = nowMs();

    if (!S._lastAdaptAt) S._lastAdaptAt = 0;
    if (t - S._lastAdaptAt < a.coolDownMs) return (S._adaptScale?.[kind] ?? 1);

    // compute performance
    let hit=0, miss=0;
    for (const r of S.recent){
      if (r.type==='hit') hit++;
      if (r.type==='miss') miss++;
    }
    const total = Math.max(1, hit+miss);
    const acc = hit/total;

    // nudge based on acc
    let nudge = 0;
    if (acc > 0.85) nudge = +0.12;       // harder
    else if (acc < 0.62) nudge = -0.14;  // easier
    else nudge = 0;

    nudge = clamp(nudge, -a.maxNudge, a.maxNudge);

    // map to scales
    S._adaptScale = S._adaptScale || { spawn:1, ttl:1, size:1 };

    // spawn: higher = more frequent
    S._adaptScale.spawn = 1 - nudge; // if nudge + => spawn smaller interval -> scale down
    S._adaptScale.ttl   = 1 + (-nudge * 0.7);
    S._adaptScale.size  = 1 + (-nudge * 0.8);

    S._lastAdaptAt = t;

    // clamp to ranges (convert later)
    return S._adaptScale[kind] ?? 1;
  }

  function applyAdaptiveToTimers(S){
    if (!S.adaptiveOn) return;

    const a = S.D.adapt;

    // spawnEvery
    const spScale = currentAdaptiveScale(S, 'spawn');
    let spawnEvery = Math.round(S.D.spawnEveryMs * spScale);
    spawnEvery = clamp(spawnEvery, a.minSpawnMs, a.maxSpawnMs);
    S.spawnEvery = spawnEvery;

    // ttl & size are applied at spawn-time via currentAdaptiveScale(...)
  }

  // -------------------------
  // hit / miss / expire
  // -------------------------
  function killTarget(S, obj){
    if (!obj || obj.dead) return;
    obj.dead = true;
    try{ obj.el && obj.el.remove(); }catch(_){}
    S.targets.delete(obj);
  }

  function onHit(E, S, obj, meta){
    if (!E._running || !S || S.ended) return;
    if (!obj || obj.dead) return;

    // prevent double
    killTarget(S, obj);

    const correct = (obj.key === S.groupKey);
    S.hits++;
    pushRecent(S, { type:'hit', correct });

    if (correct){
      S.combo++;
      S.bestCombo = Math.max(S.bestCombo, S.combo);
      S.charge++;
      S.goalNow++;
      S.miniNow++;

      const add = scoreForHit(S, true);
      S.score += add;

      // FX
      try{ WIN.Particles && WIN.Particles.popText && WIN.Particles.popText(meta?.x||0, meta?.y||0, `+${add}`, 'good'); }catch(_){}
    }else{
      // wrong group hit
      S.combo = 0;
      S.misses++;
      pushRecent(S, { type:'miss', why:'wrong' });

      const add = scoreForHit(S, false);
      S.score += Math.round(add);
      emit('hha:coach', { text:`อันนั้นไม่ใช่ ${S.groupName} นะ ลองดูใหม่ 👀`, mood:'neutral' });
    }

    // power switch group
    if (S.charge >= S.chargeThr){
      S.charge = 0;
      setCurrentGroup(S, S.groupIndex + 1, true);
      initGoal(S);
      emit('groups:progress', { kind:'perfect_switch', groupKey:S.groupKey, groupName:S.groupName });
      emit('hha:coach', { text:`สลับเป็น ${S.groupName} แล้ว!`, mood:'happy' });
    }

    emit('groups:power', { charge:S.charge, threshold:S.chargeThr });

    // mini check
    checkMini(S);

    // goal check
    if (S.goalNow >= S.goalTot){
      emit('hha:coach', { text:'GOAL ผ่าน! ต่อไปลุยหมู่ใหม่ 💪', mood:'happy' });
      initGoal(S);
      S.goalNow = 0;
    }

    // storm/boss updates
    applyAdaptiveToTimers(S);
    maybeBossStorm(S);

    emitQuest(S);
    emitRank(S);
    emitScore(S);
  }

  function onMiss(E, S, meta){
    if (!E._running || !S || S.ended) return;

    S.combo = 0;
    S.misses++;
    pushRecent(S, { type:'miss', why: meta?.reason || 'empty' });

    S.score += S.D.scoreMiss;

    // coach (rate limited)
    if (!S._lastCoachMissAt) S._lastCoachMissAt = 0;
    const t = nowMs();
    if (t - S._lastCoachMissAt > 1200){
      S._lastCoachMissAt = t;
      emit('hha:coach', { text:'พลาดได้! ช้าลงนิด เล็งให้ชัวร์ก่อนยิง 🎯', mood:'neutral' });
    }

    applyAdaptiveToTimers(S);
    emitRank(S);
    emitScore(S);
  }

  function onExpire(E, S, obj){
    if (!E._running || !S || S.ended) return;
    if (!obj || obj.dead) return;

    // count expire as miss only if it was correct target for current group
    const wasCorrect = (obj.key === S.groupKey);
    killTarget(S, obj);

    if (wasCorrect){
      S.combo = 0;
      S.misses++;
      pushRecent(S, { type:'miss', why:'expire' });
      S.score += Math.round(S.D.scoreMiss * 0.7);
      emit('hha:coach', { text:'เป้าหลุดไปแล้ว! รีบขึ้นอีกนิดนะ ⏱️', mood:'neutral' });
      applyAdaptiveToTimers(S);
      emitRank(S);
      emitScore(S);
      emitQuest(S);
    }
  }

  // -------------------------
  // timers / phases
  // -------------------------
  function tick1s(E, S){
    if (!E._running || !S || S.ended) return;

    S.tLeft = Math.max(0, (S.tLeft|0) - 1);
    emit('hha:time', { left:S.tLeft });

    // mini timer
    checkMini(S);

    // storm/boss
    maybeBossStorm(S);

    // end
    if (S.tLeft <= 0){
      endGame(E, S, 'time');
    }
  }

  function maybeBossStorm(S){
    const t = nowMs();

    // storm scheduling
    const every = Math.max(8, S.D.stormEverySec|0);
    if (!S._nextStormAt) S._nextStormAt = t + every*1000;

    if (!S.storm && t >= S._nextStormAt){
      S.storm = true;
      S.stormEndsAt = t + (S.D.stormLenSec|0)*1000;
      emit('groups:progress', { kind:'storm_on' });
      emit('hha:coach', { text:'พายุมา! เป้าจะโผล่ถี่ขึ้น 🌪️', mood:'fever' });

      // make harder temporarily
      S.spawnEvery = Math.max(520, Math.round(S.spawnEvery * 0.74));
    }
    if (S.storm && t >= S.stormEndsAt){
      S.storm = false;
      emit('groups:progress', { kind:'storm_off' });
      emit('hha:coach', { text:'พายุจบ! เก็บแต้มต่อ ✨', mood:'happy' });
      S._nextStormAt = t + every*1000;
      applyAdaptiveToTimers(S);
    }

    // boss (only play)
    if (S.isResearch || S.isPractice) return;

    const secSpent = (S.timeSec - S.tLeft);
    if (!S.boss && secSpent >= (S.D.bossAtSec|0)){
      spawnBoss(S);
    }

    if (S.boss && S.boss.active && t >= S.boss.endsAt){
      // boss timeout (escape)
      S.boss.active = false;
      emit('groups:progress', { kind:'boss_escape' });
      emit('hha:coach', { text:'บอสหนีไปแล้ว! เอาใหม่รอบหน้า 😅', mood:'sad' });
    }
  }

  function spawnBoss(S){
    S.boss = {
      hp: S.D.bossHp|0,
      max: S.D.bossHp|0,
      active: true,
      endsAt: nowMs() + (S.D.bossLenSec|0)*1000
    };
    emit('groups:progress', { kind:'boss_spawn', hp:S.boss.hp, max:S.boss.max });
    emit('hha:coach', { text:'บอสมาแล้ว! ยิงให้ถูกหมู่เพื่อสยบมัน 👊', mood:'fever' });
  }

  // -------------------------
  // mini quest check
  // -------------------------
  function checkMini(S){
    const t = nowMs();
    if (!S.mini) return;

    const left = Math.max(0, Math.ceil((S.miniEndsAt - t)/1000));
    if (left <= 0){
      // resolve mini
      if (S.miniNow >= S.miniTot){
        // success
        S.score += 60;
        emit('hha:coach', { text:'MINI ผ่าน! +60 🎉', mood:'happy' });
        emit('groups:progress', { kind:'mini_success' });

        // boss damage bonus if active
        if (S.boss && S.boss.active){
          S.boss.hp -= 5;
          if (S.boss.hp <= 0){
            S.boss.active = false;
            S.score += S.D.bossBonus|0;
            emit('groups:progress', { kind:'boss_down' });
            emit('hha:coach', { text:`สยบบอสได้! +${S.D.bossBonus|0} 💥`, mood:'happy' });
          }
        }
      }else{
        // fail
        emit('hha:coach', { text:'MINI ไม่ทัน! ไม่เป็นไร ลองใหม่ 💪', mood:'neutral' });
        emit('groups:progress', { kind:'mini_fail' });
      }

      // next mini
      initMini(S, false);
      emitQuest(S, true);
      return;
    }

    // during mini: urgent hint
    if (left <= 3 && !S._miniWarned){
      S._miniWarned = true;
      emit('hha:coach', { text:'MINI ใกล้หมด! เล็งชัวร์ก่อนยิง ⏱️', mood:'fever' });
    }
    if (left > 3) S._miniWarned = false;

    // update quest HUD periodically
    if (!S._lastQuestAt) S._lastQuestAt = 0;
    const now = nowMs();
    if (now - S._lastQuestAt > 260){
      S._lastQuestAt = now;
      emitQuest(S);
    }
  }

  // -------------------------
  // HUD tick (internal)
  // -------------------------
  function tickHUD(S){
    // engine itself doesn't touch DOM HUD; it emits events
    // but we keep a gentle heartbeat for quest emit
    if (!Engine._running || !S || S.ended) return;
    emitQuest(S);
    Engine._timers.push(setTimeout(()=>tickHUD(S), 480));
  }

  // -------------------------
  // end game
  // -------------------------
  function endGame(E, S, reason){
    if (S.ended) return;
    S.ended = true;
    S.endReason = reason || 'end';

    // finalize
    updateRank(S);

    cleanupTargets(S);

    const summary = {
      reason: S.endReason,
      scoreFinal: S.score|0,
      grade: S.grade,
      accuracyGoodPct: S.accPct|0,
      misses: S.misses|0,
      hits: S.hits|0,
      shots: S.shots|0,
      comboBest: S.bestCombo|0,
      groupLast: S.groupKey,
      groupLastName: S.groupName
    };

    emit('hha:end', summary);

    // stop loops but keep overlay ability outside
    try{ E._running = false; }catch(_){}
  }

  // -------------------------
  // minimal CSS injection (targets only)
  // -------------------------
  function ensureStyleOnce(){
    if (DOC.getElementById('groups-safe-style')) return;
    const s = DOC.createElement('style');
    s.id = 'groups-safe-style';
    s.textContent = `
      .groups-layer{ position:relative; }
      .tgt{
        position:fixed;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.25);
        background: rgba(2,6,23,.55);
        box-shadow: 0 12px 30px rgba(0,0,0,.28);
        cursor:pointer;
        -webkit-tap-highlight-color: transparent;
        user-select:none;
        padding:0;
      }
      .tgt .emoji{ font-size: 34px; line-height:1; }
      .tgt.g1{ outline: 2px solid rgba(239,68,68,.20); }
      .tgt.g2{ outline: 2px solid rgba(245,158,11,.20); }
      .tgt.g3{ outline: 2px solid rgba(34,197,94,.20); }
      .tgt.g4{ outline: 2px solid rgba(34,211,238,.20); }
      .tgt.g5{ outline: 2px solid rgba(167,139,250,.20); }
      .tgt:active{ transform: translateY(1px) scale(.985); }
    `;
    DOC.head.appendChild(s);
  }

})();