// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE Engine — Standalone (NO modules) — PRODUCTION PATCHED
// ✅ API: window.GroupsVR.GameEngine.start(diff, ctx), stop(), setLayerEl(el)
// ✅ Emits: hha:time, hha:score, hha:rank, hha:coach, quest:update, groups:power, groups:progress, hha:end
// ✅ Deterministic RNG (seeded) for research/play
// ✅ Mobile/cVR friendly:
//    - hit test via hha:shoot {x,y,lockPx,source}
//    - PATCH: tap on target triggers internal shoot at target center (always hits)
// ✅ PATCH: fallback nearest target within lockPx radius
// ✅ PATCH: shooting empty space does NOT increase MISS (only breaks combo)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};

  // ---------------- utils ----------------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function strSeedToU32(s){
    s = String(s ?? '');
    if (!s) s = String(Date.now());
    let h = 2166136261 >>> 0;
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // mulberry32
  function makeRng(seedU32){
    let t = seedU32 >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr){
    return arr[(rng()*arr.length)|0];
  }

  // ---------------- food groups (ไทย) ----------------
  // mapping ที่คุณล็อกไว้: หมู่ 1 โปรตีน, หมู่ 2 คาร์บ, หมู่ 3 ผัก, หมู่ 4 ผลไม้, หมู่ 5 ไขมัน
  const GROUPS = [
    { key:'g1', name:'หมู่ 1 โปรตีน', emoji:['🍗','🥚','🥛','🐟','🫘','🍖','🧀'] },
    { key:'g2', name:'หมู่ 2 คาร์โบไฮเดรต', emoji:['🍚','🍞','🥔','🍜','🥟','🍠','🍙'] },
    { key:'g3', name:'หมู่ 3 ผัก', emoji:['🥦','🥬','🥒','🥕','🌽','🍅','🫛'] },
    { key:'g4', name:'หมู่ 4 ผลไม้', emoji:['🍌','🍎','🍉','🍇','🍍','🍊','🥭'] },
    { key:'g5', name:'หมู่ 5 ไขมัน', emoji:['🥑','🧈','🥜','🫒','🍳','🥥','🧴'] }
  ];

  // ---------------- engine state ----------------
  const S = {
    running:false,
    rafId:0,
    layerEl:null,
    wrapEl:null,

    rng:()=>Math.random(),
    seed:'',

    runMode:'play', // play|research|practice
    diff:'normal',
    style:'mix',
    view:'mobile',
    timePlannedSec:90,
    timeLeftSec:90,
    startT:0,
    lastTickT:0,

    score:0,
    combo:0,
    miss:0,
    shots:0,
    goodShots:0,

    // power / group cycle
    groupIdx:0,
    powerCur:0,
    powerThr:8,

    // spawn pacing
    spawnIt:0,
    targets:[],
    storm:false,
    boss:false,
    bossHp:0,

    // mini quest
    goalNow:0,
    goalTot:12,
    miniNow:0,
    miniTot:5,
    miniLeft:0,
    miniActive:false,
    miniKind:'streak',

    // throttles
    lastCoachAt:0,
    lastQuestEmitAt:0
  };

  function cfgForDiff(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy') return { spawnMs: 930, lifeMs:[2200,3200], powerThr:7, goalTot:10, miniTot:4 };
    if (diff === 'hard') return { spawnMs: 620, lifeMs:[1600,2500], powerThr:9, goalTot:14, miniTot:6 };
    return { spawnMs: 760, lifeMs:[1900,2900], powerThr:8, goalTot:12, miniTot:5 };
  }

  // ---------------- DOM helpers ----------------
  function ensureWrap(){
    if (S.wrapEl && DOC.body.contains(S.wrapEl)) return;
    const w = DOC.createElement('div');
    w.id = 'groupsPlayWrap';
    w.style.cssText =
      'position:relative; width:100%; height:100%; pointer-events:none; ' +
      'contain:layout style paint;';
    S.wrapEl = w;
    // layerEl is where targets should go (playLayer)
    if (S.layerEl){
      S.layerEl.innerHTML = '';
      S.layerEl.appendChild(w);
    }else{
      DOC.body.appendChild(w);
    }
  }

  function setLayerEl(el){
    S.layerEl = el || DOC.getElementById('playLayer') || DOC.body;
    ensureWrap();
    // init FX pack if present
    try{
      const FX = WIN.GroupsVR && WIN.GroupsVR.EffectsPack;
      FX && FX.init && FX.init({ layerEl: S.layerEl });
    }catch(_){}
  }

  function clearTargets(){
    S.targets.forEach(t=>{ try{ t.el.remove(); }catch(_){ } });
    S.targets.length = 0;
  }

  // ===== PATCHED mkTarget: spawn inside playLayer + tap target always hits =====
  function mkTarget(groupKey, emoji, lifeMs){
    const el = DOC.createElement('div');
    el.className = 'tgt';
    el.setAttribute('data-group', groupKey);
    el.setAttribute('role','button');

    el.style.cssText =
      'position:absolute; border-radius:18px; '+
      'display:flex; align-items:center; justify-content:center; '+
      'font-size:34px; font-weight:900; '+
      'background:rgba(15,23,42,.72); border:1px solid rgba(148,163,184,.22); '+
      'box-shadow:0 12px 30px rgba(0,0,0,.22); '+
      'pointer-events:auto; user-select:none; -webkit-tap-highlight-color:transparent;';

    // use CSS var sizing (works across PC/Mobile/VR/cVR)
    el.style.width  = 'var(--tSize)';
    el.style.height = 'var(--tSize)';
    el.textContent = emoji;

    // position relative to playLayer (NOT viewport)
    const host = S.layerEl || DOC.getElementById('playLayer') || DOC.body;
    const br = host.getBoundingClientRect();

    const pad = 10;
    const w = Math.max(120, br.width);
    const h = Math.max(180, br.height);

    // conservative bound (avoid spill)
    const approxSize = Math.max(72, Math.min(140, Math.min(w,h) * 0.22));
    const maxX = Math.max(pad, w - pad - approxSize);
    const maxY = Math.max(pad, h - pad - approxSize);

    const lx = pad + (S.rng() * (maxX - pad));
    const ly = pad + (S.rng() * (maxY - pad));

    el.style.left = Math.round(lx) + 'px';
    el.style.top  = Math.round(ly) + 'px';

    // appear anim
    el.style.transform = 'scale(.82)';
    el.style.opacity = '0';
    requestAnimationFrame(()=>{
      el.style.transition = 'transform 160ms ease, opacity 140ms ease';
      el.style.transform = 'scale(1)';
      el.style.opacity = '1';
    });

    const born = nowMs();
    const t = { el, groupKey, born, dieAt: born + lifeMs, hit:false };
    S.wrapEl.appendChild(el);

    // IMPORTANT: tap directly on target => guaranteed hit (bypasses crosshair mismatch)
    el.addEventListener('pointerdown', (e)=>{
      if (!S.running) return;
      try{ e.preventDefault(); e.stopPropagation(); }catch(_){}

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      handleShoot({ detail:{ x: cx, y: cy, lockPx: 999, source:'tap-target' }});
    }, { passive:false });

    return t;
  }

  // ---------------- events (HUD/Quest/Coach) ----------------
  function emitScore(){
    emit('hha:score', { score:S.score, combo:S.combo, misses:S.miss });
  }
  function emitTime(){
    emit('hha:time', { left:S.timeLeftSec });
  }
  function emitRank(){
    const acc = (S.shots>0) ? Math.round((S.goodShots/S.shots)*100) : 0;
    const grade =
      (acc>=92 && S.score>=220) ? 'S' :
      (acc>=86 && S.score>=170) ? 'A' :
      (acc>=76 && S.score>=120) ? 'B' :
      (acc>=62) ? 'C' : 'D';
    emit('hha:rank', { accuracy: acc, grade });
  }
  function emitPower(){
    emit('groups:power', { charge:S.powerCur, threshold:S.powerThr });
  }

  function currentGroup(){
    return GROUPS[clamp(S.groupIdx, 0, GROUPS.length-1)];
  }

  function emitQuest(force){
    const t = nowMs();
    if (!force && (t - S.lastQuestEmitAt) < 120) return;
    S.lastQuestEmitAt = t;

    const g = currentGroup();
    const goalPct = Math.round((S.goalNow / Math.max(1,S.goalTot))*100);
    const miniPct = Math.round((S.miniNow / Math.max(1,S.miniTot))*100);

    emit('quest:update', {
      groupKey: g.key,
      groupName: g.name,

      goalTitle: `ยิงให้ถูก: ${g.name}`,
      goalNow: S.goalNow,
      goalTotal: S.goalTot,
      goalPct,

      miniTitle: (S.miniKind==='streak')
        ? `MINI: คอมโบติดกัน ${S.miniTot} ครั้ง`
        : `MINI: เก็บให้ได้ ${S.miniTot} ครั้ง`,
      miniNow: S.miniNow,
      miniTotal: S.miniTot,
      miniPct,
      miniTimeLeftSec: S.miniActive ? S.miniLeft : 0
    });
  }

  function coach(text, mood){
    const t = nowMs();
    if ((t - S.lastCoachAt) < 520) return;
    S.lastCoachAt = t;
    emit('hha:coach', { text, mood: mood||'neutral' });
  }

  // ---------------- gameplay rules ----------------
  function resetMini(){
    S.miniActive = true;
    S.miniLeft = 10; // seconds
    S.miniNow = 0;
    S.miniKind = 'streak';
  }

  function maybeStartMini(){
    if (S.runMode === 'practice') return;
    if (S.miniActive) return;

    if (S.timeLeftSec <= 0) return;
    if (S.timeLeftSec % 11 === 0 && S.timeLeftSec <= (S.timePlannedSec-6)){
      resetMini();
      coach('MINI มาแล้ว! ยิงให้ “ถูกหมู่” ติดกันเร็ว ๆ ⚡', 'fever');
      emitQuest(true);
    }
  }

  function switchGroup(){
    S.groupIdx = (S.groupIdx + 1) % GROUPS.length;
    S.powerCur = 0;
    S.goalNow = 0;
    resetMini();
    emit('groups:progress', { kind:'perfect_switch' });
    emitPower();
    emitQuest(true);
    coach('สลับหมู่แล้ว! ดูชื่อหมู่แล้วค่อยยิง 🎯', 'neutral');
  }

  function addScore(isGood){
    if (isGood){
      S.goodShots++;
      S.combo = Math.min(99, (S.combo|0) + 1);
      const comboBonus = Math.min(25, (S.combo>=3)? (S.combo*2) : 0);
      S.score += (10 + comboBonus);
      S.powerCur = Math.min(S.powerThr, S.powerCur + 1);
      if (S.powerCur >= S.powerThr){
        switchGroup();
      }else{
        emitPower();
      }
    }else{
      S.combo = 0;
      S.miss++;
      S.score = Math.max(0, S.score - 8);
    }
    emitScore();
    emitRank();
  }

  function onGoodHit(){
    S.goalNow = Math.min(S.goalTot, S.goalNow + 1);

    if (S.miniActive){
      S.miniNow = Math.min(S.miniTot, S.miniNow + 1);
      if (S.miniNow >= S.miniTot){
        S.score += 35;
        coach('MINI สำเร็จ! +โบนัส ✅', 'happy');
        S.miniActive = false;
      }
    }
    emitQuest(false);
  }

  function onBadHit(){
    if (S.miniActive){
      S.miniNow = 0;
      emitQuest(false);
    }
  }

  function startStormIfNeeded(){
    if (S.storm) return;
    const elapsed = (S.timePlannedSec - S.timeLeftSec);
    const frac = elapsed / Math.max(1,S.timePlannedSec);
    if (frac >= 0.35 && frac < 0.70){
      S.storm = true;
      emit('groups:progress', { kind:'storm_on' });
      coach('พายุมาแล้ว! ช้าลงนิด แต่ยิงให้ชัวร์ 🌪️', 'fever');
    }
  }
  function endStormIfNeeded(){
    if (!S.storm) return;
    const elapsed = (S.timePlannedSec - S.timeLeftSec);
    const frac = elapsed / Math.max(1,S.timePlannedSec);
    if (frac >= 0.72){
      S.storm = false;
      emit('groups:progress', { kind:'storm_off' });
      coach('พายุจบ! เก็บคอมโบต่อเลย ✨', 'happy');
    }
  }

  function startBossIfNeeded(){
    if (S.boss) return;
    const frac = (S.timePlannedSec - S.timeLeftSec) / Math.max(1,S.timePlannedSec);
    if (frac >= 0.82){
      S.boss = true;
      S.bossHp = 6;
      emit('groups:progress', { kind:'boss_spawn' });
      coach('บอสมา! ยิง “หมู่ที่ถูก” ให้แม่น 👊', 'fever');
    }
  }

  function bossHit(){
    if (!S.boss) return;
    S.bossHp = Math.max(0, (S.bossHp|0) - 1);
    if (S.bossHp <= 0){
      S.boss = false;
      S.score += 60;
      emitScore();
      emitRank();
      emit('groups:progress', { kind:'boss_down' });
      coach('บอสแตก! โคตรดี 💥', 'happy');
    }
  }

  // ---------------- hit test (PATCHED) ----------------
  function hitTest(x, y, lockPx){
    x = Number(x)||0;
    y = Number(y)||0;

    // 1) try elementFromPoint
    try{
      let el = DOC.elementFromPoint(x,y);
      if (el){
        if (el.classList && el.classList.contains('tgt')) return el;
        const p = el.closest ? el.closest('.tgt') : null;
        if (p) return p;
      }
    }catch(_){}

    // 2) fallback: nearest target within lockPx radius
    const r = Math.max(18, Number(lockPx)||28);
    let bestEl = null;
    let bestD2 = 1e18;

    for (let i=0;i<S.targets.length;i++){
      const t = S.targets[i];
      if (!t || !t.el || t.hit) continue;

      let br;
      try{ br = t.el.getBoundingClientRect(); }catch(_){ continue; }

      const cx = br.left + br.width/2;
      const cy = br.top  + br.height/2;
      const dx = cx - x, dy = cy - y;
      const d2 = dx*dx + dy*dy;

      if (d2 <= r*r && d2 < bestD2){
        bestD2 = d2;
        bestEl = t.el;
      }
    }
    return bestEl;
  }

  function handleShoot(ev){
    if (!S.running) return;
    if (!ev || !ev.detail) return;

    const d = ev.detail||{};
    const x = Number(d.x)||0;
    const y = Number(d.y)||0;
    const lockPx = Number(d.lockPx ?? 28) || 28;

    S.shots++;

    const tgtEl = hitTest(x, y, lockPx);

    // PATCH: shooting empty space => no MISS (only breaks combo)
    if (!tgtEl){
      S.combo = 0;
      emitScore();
      emitRank();
      onBadHit();
      return;
    }

    const tg = String(tgtEl.getAttribute('data-group')||'');
    const cg = currentGroup().key;

    // remove target as hit
    try{
      const idx = S.targets.findIndex(t=>t.el===tgtEl);
      if (idx>=0){
        const t = S.targets[idx];
        if (!t.hit){
          t.hit = true;
          try{
            tgtEl.style.transition = 'transform 140ms ease, opacity 120ms ease';
            tgtEl.style.transform = 'scale(.75)';
            tgtEl.style.opacity = '0';
            setTimeout(()=>{ try{ tgtEl.remove(); }catch(_){ } }, 140);
          }catch(_){}
          S.targets.splice(idx,1);
        }
      }else{
        try{ tgtEl.remove(); }catch(_){}
      }
    }catch(_){}

    const good = (tg === cg);
    addScore(good);

    if (good){
      onGoodHit();
      if (S.boss) bossHit();
    }else{
      onBadHit();
      coach('ดูชื่อหมู่ก่อนนะ แล้วค่อยยิง ✅', 'neutral');
    }
  }

  // ---------------- RAF loop ----------------
  function rafLoop(){
    if (!S.running) return;

    const t = nowMs();
    const dt = Math.min(0.06, Math.max(0.001, (t - S.lastTickT) / 1000));
    S.lastTickT = t;

    const elapsed = (t - S.startT) / 1000;
    const left = Math.max(0, Math.ceil(S.timePlannedSec - elapsed));
    if (left !== S.timeLeftSec){
      S.timeLeftSec = left;
      emit('hha:time', { left:S.timeLeftSec });

      if (S.miniActive){
        S.miniLeft = Math.max(0, (S.miniLeft|0) - 1);
        if (S.miniLeft <= 0){
          S.miniActive = false;
          S.miniNow = 0;
          coach('MINI หมดเวลา! เล่นต่อได้เลย 🔥', 'neutral');
        }
        emitQuest(false);
      }

      maybeStartMini();
      startStormIfNeeded();
      endStormIfNeeded();
      startBossIfNeeded();
    }

    // expiry
    for (let i=S.targets.length-1;i>=0;i--){
      const tg = S.targets[i];
      if (!tg || tg.hit) { S.targets.splice(i,1); continue; }
      if (t >= tg.dieAt){
        // fair: count miss only if it was current group
        const cg = currentGroup().key;
        if (tg.groupKey === cg){
          S.miss++;
          S.combo = 0;
          S.score = Math.max(0, S.score - 6);
          emitScore();
          emitRank();
          onBadHit();
        }
        try{
          tg.el.style.transition = 'transform 120ms ease, opacity 120ms ease';
          tg.el.style.transform = 'scale(.85)';
          tg.el.style.opacity = '0';
          setTimeout(()=>{ try{ tg.el.remove(); }catch(_){ } }, 130);
        }catch(_){}
        S.targets.splice(i,1);
      }
    }

    // spawn pacing
    S.spawnIt -= dt;
    if (S.spawnIt <= 0){
      const base = cfgForDiff(S.diff).spawnMs;
      const stormMul = S.storm ? 0.70 : 1.0;
      const bossMul  = S.boss ? 0.80 : 1.0;

      const intervalMs = clamp(base * stormMul * bossMul, 360, 1400);
      S.spawnIt = intervalMs / 1000;

      spawnOne();
    }

    if (S.timeLeftSec <= 0){
      endRun('time');
      return;
    }

    S.rafId = requestAnimationFrame(rafLoop);
  }

  function spawnOne(){
    if (!S.running) return;
    ensureWrap();

    const C = cfgForDiff(S.diff);
    const cg = currentGroup();

    let gKey = '';
    const r = S.rng();
    if (r < 0.58) gKey = cg.key;
    else gKey = pick(S.rng, GROUPS).key;

    if (S.boss && S.rng() < 0.70) gKey = cg.key;

    const g = GROUPS.find(x=>x.key===gKey) || cg;
    const em = pick(S.rng, g.emoji);

    const lifeMin = C.lifeMs[0];
    const lifeMax = C.lifeMs[1];
    const life = clamp(lifeMin + S.rng()*(lifeMax-lifeMin), 900, 5200);

    const t = mkTarget(g.key, em, life);
    S.targets.push(t);

    const cap = (S.view==='pc') ? 12 : 10;
    if (S.targets.length > cap){
      let idx = S.targets.findIndex(x=>x.groupKey !== currentGroup().key);
      if (idx < 0) idx = 0;
      const old = S.targets[idx];
      try{ old.el.remove(); }catch(_){}
      S.targets.splice(idx,1);
    }
  }

  // ---------------- start/stop/end ----------------
  function readViewEtc(){
    S.view = String(qs('view','mobile')||'mobile').toLowerCase();
    S.style = String(qs('style','mix')||'mix').toLowerCase();
  }

  function resetRun(ctx){
    const C = cfgForDiff(S.diff);

    S.score = 0; S.combo = 0; S.miss = 0;
    S.shots = 0; S.goodShots = 0;

    S.groupIdx = 0;
    S.powerCur = 0;
    S.powerThr = C.powerThr;

    S.goalNow = 0;
    S.goalTot = C.goalTot;

    S.miniTot = C.miniTot;
    S.miniNow = 0;
    S.miniActive = false;
    S.miniLeft = 0;
    S.miniKind = 'streak';

    S.targets.length = 0;
    S.storm = false;
    S.boss = false;
    S.bossHp = 0;

    S.lastCoachAt = 0;
    S.lastQuestEmitAt = 0;

    // seed / rng
    S.seed = String(ctx && ctx.seed ? ctx.seed : (qs('seed','')||Date.now()));
    const u32 = strSeedToU32(S.seed);
    S.rng = makeRng(u32);

    // time
    const tt = Number(ctx && ctx.time ? ctx.time : qs('time', 90));
    S.timePlannedSec = clamp(tt, 15, 180);
    S.timeLeftSec = S.timePlannedSec;

    S.spawnIt = 0;

    emitPower();
    emitScore();
    emitRank();
    emitTime();

    emitQuest(true);
    coach('เริ่มแล้ว! ยิงให้ถูก “หมู่” แล้วเก็บคอมโบ 🔥', 'neutral');
  }

  function start(diff, ctx){
    stop();

    readViewEtc();

    S.diff = String(diff||'normal').toLowerCase();
    S.runMode = String((ctx && ctx.runMode) ? ctx.runMode : (qs('run','play')||'play')).toLowerCase();
    if (S.runMode !== 'research' && S.runMode !== 'practice') S.runMode = 'play';

    setLayerEl(S.layerEl || DOC.getElementById('playLayer') || DOC.body);

    // optional helpers
    try{
      const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
      H && H.init && H.init({ view:S.view });
    }catch(_){}

    try{
      const FX = WIN.GroupsVR && WIN.GroupsVR.EffectsPack;
      FX && FX.init && FX.init({ layerEl: S.layerEl });
    }catch(_){}

    try{
      const T = WIN.GroupsVR && WIN.GroupsVR.Telemetry;
      if (T && T.init){
        const ep = String(qs('log','')||'');
        T.init({
          runMode: S.runMode,
          endpoint: ep,
          flushEveryMs: 2000,
          maxEventsPerBatch: 60,
          maxQueueBatches: 16,
          statusEveryMs: 850
        });
      }
    }catch(_){}

    try{
      const AI = WIN.GroupsVR && WIN.GroupsVR.AIHooks;
      if (AI && AI.attach){
        AI.attach({ runMode:S.runMode, seed:S.seed, enabled:false });
      }
    }catch(_){}

    resetRun(ctx||{});

    S.running = true;
    S.startT = nowMs();
    S.lastTickT = S.startT;

    WIN.addEventListener('hha:shoot', handleShoot, { passive:true });

    S.rafId = requestAnimationFrame(rafLoop);
    return true;
  }

  function stop(){
    if (!S.running && !S.rafId) return;
    S.running = false;
    if (S.rafId){
      try{ cancelAnimationFrame(S.rafId); }catch(_){}
      S.rafId = 0;
    }
    WIN.removeEventListener('hha:shoot', handleShoot, { passive:true });

    clearTargets();
    try{ if (S.wrapEl) S.wrapEl.innerHTML = ''; }catch(_){}
  }

  function endRun(reason){
    if (!S.running) return;
    S.running = false;

    if (S.rafId){
      try{ cancelAnimationFrame(S.rafId); }catch(_){}
      S.rafId = 0;
    }
    WIN.removeEventListener('hha:shoot', handleShoot, { passive:true });

    const acc = (S.shots>0) ? Math.round((S.goodShots/S.shots)*100) : 0;
    const grade =
      (acc>=92 && S.score>=220) ? 'S' :
      (acc>=86 && S.score>=170) ? 'A' :
      (acc>=76 && S.score>=120) ? 'B' :
      (acc>=62) ? 'C' : 'D';

    const summary = {
      reason: reason || 'end',
      scoreFinal: S.score|0,
      misses: S.miss|0,
      shots: S.shots|0,
      goodShots: S.goodShots|0,
      accuracyGoodPct: acc|0,
      grade,
      seed: S.seed,
      runMode: S.runMode,
      diff: S.diff,
      style: S.style,
      view: S.view
    };

    emit('hha:end', summary);
    clearTargets();
  }

  // ---------------- flush harden hook ----------------
  function bindFlushOnLeave(getSummaryFn){
    function safeCall(){
      try{
        const s = getSummaryFn ? getSummaryFn() : null;
        const T = WIN.GroupsVR && WIN.GroupsVR.Telemetry;
        T && T.flush && T.flush(s);
      }catch(_){}
    }
    WIN.addEventListener('pagehide', safeCall);
    WIN.addEventListener('beforeunload', safeCall);
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') safeCall();
    });
  }

  // ---------------- expose ----------------
  WIN.GroupsVR.GameEngine = {
    setLayerEl,
    start,
    stop
  };
  WIN.GroupsVR.bindFlushOnLeave = bindFlushOnLeave;

  WIN.GroupsVR.getResearchCtx = function(){
    try{
      const R = WIN.GroupsVR && WIN.GroupsVR.ResearchCtx;
      if (R && typeof R.get === 'function') return R.get();
    }catch(_){}
    return {};
  };

})();