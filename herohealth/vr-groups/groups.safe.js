// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE Engine — Standalone (NO modules) — PRODUCTION (PATCH v20260226-safeSpawnZone)
// ✅ HUD-safe spawn + Occlusion guard => timeout_miss NOT counted if target center is under HUD/overlay
// ✅ Emit groups:group on start + switchGroup
// ✅ Emit groups:director (optional)
// ✅ Shot rate-limit
// ✅ AI hooks attach point via window.HHA.createAIHooks (play only, enable only with ?ai=1; disabled in research/practice)
// ✅ LockPx Aim Assist (uses ev.detail.lockPx)
// ✅ FX restored — emits 'groups:hit'
// ✅ direct tap/click on target also works
// ✅ BADGES: first_play, streak_10, mini_clear_1, boss_clear_1, score_80p, perfect_run
// ✅ NEW: SAFE SPAWN ZONE (mobile/cVR) so targets never appear under HUD/VR UI (deterministic with S.rng)
// API: window.GroupsVR.GameEngine.start(diff, ctx), stop(), setLayerEl(el)

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

  // ---------------- BADGES (classic bridge) ----------------
  function badgeMeta(extra){
    let pid = '';
    try{
      const B = WIN.HHA_Badges;
      pid = (B && typeof B.getPid === 'function') ? (B.getPid()||'') : '';
    }catch(_){}

    let q;
    try{ q = new URL(location.href).searchParams; }catch(_){ q = new URLSearchParams(); }

    const base = {
      pid,
      run: String(q.get('run')||'').toLowerCase() || 'play',
      diff: String(q.get('diff')||'').toLowerCase() || 'normal',
      time: Number(q.get('time')||0) || 0,
      seed: String(q.get('seed')||'') || '',
      view: String(q.get('view')||'').toLowerCase() || '',
      style: String(q.get('style')||'').toLowerCase() || '',
      game: 'groups'
    };
    if(extra && typeof extra === 'object'){
      for(const k of Object.keys(extra)) base[k] = extra[k];
    }
    return base;
  }

  function awardOnce(gameKey, badgeId, meta){
    try{
      const B = WIN.HHA_Badges;
      if(!B || typeof B.awardBadge !== 'function') return false;
      return !!B.awardBadge(gameKey, badgeId, badgeMeta(meta));
    }catch(_){
      return false;
    }
  }

  // ---------------- food groups (ไทย) ----------------
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

    maxCombo:0,
    streak10Awarded:false,
    miniAwarded:false,
    bossAwarded:false,

    groupIdx:0,
    powerCur:0,
    powerThr:8,

    spawnIt:0,
    targets:[],
    storm:false,
    boss:false,
    bossHp:0,

    goalNow:0,
    goalTot:12,
    miniNow:0,
    miniTot:5,
    miniLeft:0,
    miniActive:false,
    miniKind:'streak',

    lastCoachAt:0,
    lastQuestEmitAt:0,

    lastShotAt:0,
    shotCooldownMs: 70,

    ai:null,
    aiEnabled:false
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
    try{
      const FX = WIN.GroupsVR && WIN.GroupsVR.EffectsPack;
      FX && FX.init && FX.init({ layerEl: S.layerEl });
    }catch(_){}
  }

  function clearTargets(){
    S.targets.forEach(t=>{ try{ t.el.remove(); }catch(_){ } });
    S.targets.length = 0;
  }

  function wireDirectTap(el){
    if(!el) return;
    el.addEventListener('pointerdown', (e)=>{
      if(!S.running) return;
      const x = Number(e.clientX)||0;
      const y = Number(e.clientY)||0;
      emit('hha:shoot', { x, y, lockPx: 10, source:'direct' });
    }, { passive:true });
  }

  function mkTarget(groupKey, emoji, lifeMs){
    const el = DOC.createElement('div');
    el.className = 'tgt';
    el.setAttribute('data-group', groupKey);
    el.setAttribute('role','button');

    el.style.cssText =
      'position:absolute; width:72px; height:72px; border-radius:18px; '+
      'display:flex; align-items:center; justify-content:center; '+
      'font-size:34px; font-weight:900; '+
      'background:rgba(15,23,42,.72); border:1px solid rgba(148,163,184,.22); '+
      'box-shadow:0 12px 30px rgba(0,0,0,.22); '+
      'pointer-events:auto; user-select:none; -webkit-tap-highlight-color:transparent;';

    el.textContent = emoji;

    // position inside playLayer area
    const host = S.layerEl || DOC.body;
    const r = host.getBoundingClientRect
      ? host.getBoundingClientRect()
      : { left:0, top:0, width:(WIN.innerWidth||360), height:(WIN.innerHeight||640) };

    const w = Math.max(240, r.width||360);
    const h = Math.max(240, r.height||520);

    const size = 72;
    const pad = 10;

    // ✅ SAFE SPAWN ZONE (deterministic with S.rng)
    // avoid: top HUD + quest + power + bottom coach + vr-ui buttons
    const topSafe = 110;                     // tune if needed
    const botSafe = (S.view === 'cvr') ? 160 : 130;

    const minX = pad;
    const maxX = Math.max(minX+1, (w - pad - size));

    const minY = topSafe;
    const maxY = Math.max(minY+1, (h - botSafe - size));

    const x = minX + (S.rng() * (maxX - minX));
    const y = minY + (S.rng() * (maxY - minY));

    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    el.style.transform = 'scale(.82)';
    el.style.opacity = '0';
    requestAnimationFrame(()=>{
      el.style.transition = 'transform 160ms ease, opacity 140ms ease';
      el.style.transform = 'scale(1)';
      el.style.opacity = '1';
    });

    const born = nowMs();
    const t = { el, groupKey, born, dieAt: born + lifeMs, hit:false };
    ensureWrap();
    S.wrapEl.appendChild(el);

    wireDirectTap(el);
    return t;
  }

  // ---------------- HUD occlusion guard ----------------
  function isOccludedByHud(tgEl){
    try{
      const r = tgEl.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      const topEl = DOC.elementFromPoint(cx, cy);
      if(!topEl) return true;

      if(topEl === tgEl) return false;
      if(topEl.closest && topEl.closest('.tgt') === tgEl) return false;

      const hud = topEl.closest && (
        topEl.closest('.hud') ||
        topEl.closest('.questTop') ||
        topEl.closest('.powerWrap') ||
        topEl.closest('.coachWrap') ||
        topEl.closest('.overlay')
      );
      return !!hud;
    }catch(_){
      return true;
    }
  }

  // ---------------- events (HUD/Quest/Coach) ----------------
  function emitScore(){ emit('hha:score', { score:S.score, combo:S.combo, misses:S.miss }); }
  function emitTime(){ emit('hha:time', { left:S.timeLeftSec }); }
  function emitRank(){
    const acc = (S.shots>0) ? Math.round((S.goodShots/S.shots)*100) : 0;
    const grade =
      (acc>=92 && S.score>=220) ? 'S' :
      (acc>=86 && S.score>=170) ? 'A' :
      (acc>=76 && S.score>=120) ? 'B' :
      (acc>=62) ? 'C' : 'D';
    emit('hha:rank', { accuracy: acc, grade });
  }
  function emitPower(){ emit('groups:power', { charge:S.powerCur, threshold:S.powerThr }); }

  function currentGroup(){ return GROUPS[clamp(S.groupIdx, 0, GROUPS.length-1)]; }
  function emitGroup(){ const g = currentGroup(); emit('groups:group