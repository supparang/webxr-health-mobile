// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE Engine — Standalone (NO modules) — PRODUCTION (PATCH v20260217-boss12-aiTipDet)
// ✅ FIX A: HUD-safe spawn + Occlusion guard => timeout_miss NOT counted if target center is under HUD/overlay
// ✅ FIX B: Emit groups:group on start + switchGroup (for highlight current group)
// ✅ FIX C: Emit groups:director (optional HUD MODE pill) — spam-guarded
// ✅ FIX D: Shot rate-limit (prevents missShot spikes from accidental double taps)
// ✅ FIX E: AI hooks attach point via window.HHA.createAIHooks (play only, enable only with ?ai=1; disabled in research/practice)
// ✅ FIX 1: LockPx Aim Assist (uses ev.detail.lockPx from vr-ui.js)
// ✅ FIX 2: FX restored — emits 'groups:hit' for hit_good/hit_bad/shot_miss/timeout_miss
// ✅ EXTRA: direct tap/click on target also works (pointerdown => same pipeline)
// ✅ BADGES: first_play, streak_10, mini_clear_1, boss_clear_1, score_80p, perfect_run
// ✅ BOSS 1+2: “มันส์ขึ้น + ยุติธรรม” deterministic phases (telegraph/open/rage), uses S.rng() only
// ✅ AI TIP -> hha:coach: rate-limit deterministic by timeLeft gate, fallback pool if AI missing
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

    // badges runtime flags
    maxCombo:0,
    streak10Awarded:false,
    miniAwarded:false,
    bossAwarded:false,

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

    // Boss 1+2 (deterministic fair)
    bossPhase:'none',          // none|telegraph|open|rage
    bossTeleLeft:0,            // sec
    bossOpenLeft:0,            // sec
    bossRageLeft:0,            // sec
    bossShield:false,          // telegraph blocks damage
    bossCritReady:false,       // deterministic crit window

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
    lastQuestEmitAt:0,

    // shot throttle (prevents missShot spikes)
    lastShotAt:0,
    shotCooldownMs: 70,

    // director pill cache (prevent spam)
    directorText:'',

    // AI hooks (optional)
    ai:null,
    aiEnabled:false,

    // AI Coach deterministic tip gate
    tipNextAtLeft: 9999,
    tipLastKey: ''
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

  // direct tap/click => same shoot pipeline
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

    const host = S.layerEl || DOC.body;
    const r = host.getBoundingClientRect ? host.getBoundingClientRect() : { left:0, top:0, width:(WIN.innerWidth||360), height:(WIN.innerHeight||640) };

    const w = Math.max(240, r.width||360);
    const h = Math.max(240, r.height||520);

    const size = 72;
    const pad = 10;

    const x = pad + (S.rng() * Math.max(1, (w - pad*2 - size)));
    const y = pad + (S.rng() * Math.max(1, (h - pad*2 - size)));

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

  function emitGroup(){
    const g = currentGroup();
    emit('groups:group', { key: g.key, name: g.name });
  }

  function emitDirectorStatus(text){
    text = String(text||'');
    if (text === S.directorText) return;
    S.directorText = text;
    emit('groups:director', { text });
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

  function coach(text, mood, force){
    const t = nowMs();
    if (!force && (t - S.lastCoachAt) < 520) return;
    S.lastCoachAt = t;
    emit('hha:coach', { text, mood: mood||'neutral' });
  }

  // ---------------- AI hooks (optional) ----------------
  function isAiEnabledByParams(){
    const run = String(qs('run','play')||'play').toLowerCase();
    if (run === 'research') return false;
    const on = String(qs('ai','0')||'0').toLowerCase();
    return (on === '1' || on === 'true');
  }

  function initAI(){
    S.aiEnabled = (S.runMode === 'play') && isAiEnabledByParams();
    S.ai = null;

    if (!S.aiEnabled){
      emitDirectorStatus(S.runMode === 'research' ? 'RESEARCH' :
                         S.runMode === 'practice' ? 'PRACTICE' : 'PLAY');
      return;
    }

    try{
      if (WIN.HHA && typeof WIN.HHA.createAIHooks === 'function'){
        S.ai = WIN.HHA.createAIHooks({
          game: 'groups',
          runMode: S.runMode,
          diff: S.diff,
          seed: S.seed,
          enabled: true
        });
      }
    }catch(_){
      S.ai = null;
    }

    emitDirectorStatus(S.ai ? 'AI ON' : 'PLAY');
  }

  function aiOnEvent(name, payload){
    try{
      if (S.ai && typeof S.ai.onEvent === 'function'){
        S.ai.onEvent(name, payload || {});
      }
    }catch(_){}
  }

  // ---------------- deterministic AI tip -> hha:coach ----------------
  function seededPickTip(key){
    const pools = {
      start: [
        {k:'start_look', t:'ดู “ชื่อหมู่” ก่อนยิงทุกครั้ง ✅', m:'neutral'},
        {k:'start_combo', t:'เก็บคอมโบให้ติด—แต้มพุ่ง 🔥', m:'happy'},
      ],
      miss: [
        {k:'miss_slow', t:'ช้าลงนิด ยิงให้ชัวร์ก่อน 🎯', m:'neutral'},
        {k:'miss_reset', t:'หลุดคอมโบไม่เป็นไร ตั้งหลักแล้วไปต่อ 💪', m:'neutral'},
      ],
      combo: [
        {k:'combo_push', t:'คอมโบมาแล้ว! รักษาจังหวะไว้ 🔥', m:'happy'},
        {k:'combo_focus', t:'ดีมาก! โฟกัส “หมู่ที่ถูก” ต่อเลย ✅', m:'happy'},
      ],
      mini: [
        {k:'mini_fast', t:'MINI มาแล้ว! ยิงถูกติดกันเร็ว ๆ ⚡', m:'fever'},
        {k:'mini_clean', t:'MINI: เน้นความชัวร์ก่อนความเร็ว ✅', m:'neutral'},
      ],
      boss: [
        {k:'boss_wait', t:'บอส: รอ “OPEN” ก่อนค่อยเร่ง 🔥', m:'neutral'},
        {k:'boss_crit', t:'บอส: จังหวะทอง! ยิงให้แม่น 💥', m:'fever'},
      ],
      cvr: [
        {k:'cvr_center', t:'cVR: ให้ crosshair อยู่กลางเป้าก่อนค่อยยิง', m:'neutral'},
        {k:'cvr_norapid', t:'cVR: แตะทีละช็อต อย่ารัว (กันพลาด)', m:'neutral'},
      ]
    };
    const arr = pools[key] || pools.start;
    let p = arr[(S.rng()*arr.length)|0];
    if (p && p.k === S.tipLastKey && arr.length > 1){
      p = arr[(S.rng()*arr.length)|0];
    }
    return p || null;
  }

  function maybeCoachTip(reason, force){
    const left = S.timeLeftSec|0;
    if (!force && left > (S.tipNextAtLeft|0)) return;

    const gap = 6 + ((S.rng()*5)|0); // 6-10 seconds later
    S.tipNextAtLeft = Math.max(0, left - gap);

    let tip = null;
    try{
      if (S.aiEnabled && S.ai && typeof S.ai.getTip === 'function'){
        const t = S.ai.getTip(reason || '');
        if (t && t.text){
          tip = { k: t.key || ('ai_'+String(reason||'tip')), t: t.text, m: t.mood || 'neutral' };
        }
      }
    }catch(_){ tip = null; }

    if (!tip){
      const view = String(S.view||'').toLowerCase();
      const r = String(reason||'');
      if (view === 'cvr' && (r==='start' || r==='miss')) tip = seededPickTip('cvr');
      else if (r.indexOf('boss') >= 0) tip = seededPickTip('boss');
      else if (r.indexOf('mini') >= 0) tip = seededPickTip('mini');
      else if (r.indexOf('combo') >= 0) tip = seededPickTip('combo');
      else if (r.indexOf('miss') >= 0) tip = seededPickTip('miss');
      else tip = seededPickTip('start');
    }

    if (!tip) return;
    S.tipLastKey = tip.k || '';
    coach(tip.t, tip.m || 'neutral', !!force);
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
      coach('MINI มาแล้ว! ยิงให้ “ถูกหมู่” ติดกันเร็ว ๆ ⚡', 'fever', true);
      maybeCoachTip('mini_start', true);
      emitQuest(true);
      aiOnEvent('mini:start', { timeLeft: S.timeLeftSec });
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
    emitGroup();
    coach('สลับหมู่แล้ว! ดูชื่อหมู่แล้วค่อยยิง 🎯', 'neutral');
    aiOnEvent('group:switch', { groupKey: currentGroup().key });
  }

  function addScore(isGood){
    if (isGood){
      S.goodShots++;
      S.combo = Math.min(99, (S.combo|0) + 1);
      S.maxCombo = Math.max(S.maxCombo|0, S.combo|0);

      if (!S.streak10Awarded && S.combo >= 10){
        S.streak10Awarded = true;
        awardOnce('groups','streak_10', { combo:S.combo, maxCombo:S.maxCombo, scoreFinal:S.score|0 });
      }

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

        if(!S.miniAwarded){
          S.miniAwarded = true;
          awardOnce('groups','mini_clear_1', {
            miniKind:S.miniKind,
            miniTot:S.miniTot|0,
            scoreFinal:S.score|0,
            comboMax:S.maxCombo|0
          });
        }
        aiOnEvent('mini:clear', { score:S.score|0, combo:S.combo|0 });
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
      aiOnEvent('storm:on', { frac });
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
      aiOnEvent('storm:off', { frac });
    }
  }

  // ----- Boss 1+2 deterministic phases -----
  function startBossIfNeeded(){
    if (S.boss) return;
    const frac = (S.timePlannedSec - S.timeLeftSec) / Math.max(1,S.timePlannedSec);
    if (frac >= 0.82){
      S.boss = true;
      S.bossHp = 7;

      S.bossPhase = 'telegraph';
      S.bossShield = true;
      S.bossTeleLeft = 2 + ((S.rng()*2)|0); // 2-3
      S.bossOpenLeft = 3 + ((S.rng()*2)|0); // 3-4
      S.bossRageLeft = 2 + ((S.rng()*2)|0); // 2-3
      S.bossCritReady = false;

      emit('groups:progress', { kind:'boss_spawn', hp:S.bossHp|0, phase:S.bossPhase });
      coach('บอสมา! รอ “OPEN” ก่อนค่อยเร่ง 👊', 'fever', true);
      maybeCoachTip('boss_spawn', true);
      aiOnEvent('boss:spawn', { hp:S.bossHp|0, phase:S.bossPhase });
    }
  }

  function bossHit(){
    if (!S.boss) return;

    if (S.bossPhase === 'telegraph' || S.bossShield){
      emit('groups:progress', { kind:'boss_block', phase:'telegraph' });
      return;
    }

    const crit = !!S.bossCritReady;
    S.bossCritReady = false;

    const dmg = crit ? 2 : 1;
    S.bossHp = Math.max(0, (S.bossHp|0) - dmg);

    if (crit){
      S.score += 10;
      emitScore();
      coach('CRIT! 💥', 'fever', true);
      maybeCoachTip('boss_crit', true);
      aiOnEvent('boss:crit', { dmg });
    }

    if (S.bossPhase === 'rage' && (S.combo|0) >= 8 && !crit){
      S.score += 4;
      emitScore();
    }

    emit('groups:progress', { kind:'boss_hit', hp:S.bossHp|0, dmg, crit:crit?1:0, phase:S.bossPhase });

    if (S.bossHp <= 0){
      S.boss = false;
      S.bossPhase = 'none';
      S.score += 60;
      emitScore();
      emitRank();
      emit('groups:progress', { kind:'boss_down' });
      coach('บอสแตก! โคตรดี 💥', 'happy', true);

      if(!S.bossAwarded){
        S.bossAwarded = true;
        awardOnce('groups','boss_clear_1', { scoreFinal:S.score|0, comboMax:S.maxCombo|0, miss:S.miss|0 });
      }
      aiOnEvent('boss:down', { score:S.score|0, miss:S.miss|0 });
    }
  }

  // ---------------- hit test + lockPx aim assist ----------------
  function hitTest(x,y){
    x = Number(x)||0;
    y = Number(y)||0;
    let el = null;
    try{
      el = DOC.elementFromPoint(x,y);
      if (!el) return null;
      if (el.classList && el.classList.contains('tgt')) return el;
      const p = el.closest ? el.closest('.tgt') : null;
      return p || null;
    }catch(_){
      return null;
    }
  }

  function nearestTargetWithin(x, y, rPx){
    rPx = Number(rPx)||0;
    if (rPx <= 0) return null;

    const r2 = rPx * rPx;
    let best = null;
    let bestD2 = r2 + 1;

    for (let i=0;i<S.targets.length;i++){
      const t = S.targets[i];
      if (!t || t.hit || !t.el) continue;
      try{
        const rect = t.el.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top  + rect.height/2;
        const dx = cx - x;
        const dy = cy - y;
        const d2 = dx*dx + dy*dy;
        if (d2 <= r2 && d2 < bestD2){
          bestD2 = d2;
          best = t.el;
        }
      }catch(_){}
    }
    return best;
  }

  function emitFx(kind, x, y, good){
    emit('groups:hit', {
      kind, x, y,
      good: !!good,
      miss: (kind === 'shot_miss' || kind === 'timeout_miss')
    });
  }

  function removeTargetEl(tgtEl){
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
        try{
          tgtEl.style.transition = 'transform 140ms ease, opacity 120ms ease';
          tgtEl.style.transform = 'scale(.75)';
          tgtEl.style.opacity = '0';
          setTimeout(()=>{ try{ tgtEl.remove(); }catch(_){ } }, 140);
        }catch(_){
          try{ tgtEl.remove(); }catch(__){}
        }
      }
    }catch(_){}
  }

  function handleShoot(ev){
    if (!S.running) return;
    if (!ev || !ev.detail) return;

    const tNow = nowMs();
    if ((tNow - (S.lastShotAt||0)) < S.shotCooldownMs) return;
    S.lastShotAt = tNow;

    const d = ev.detail||{};
    const x = Number(d.x)||0;
    const y = Number(d.y)||0;

    const lockPx = clamp(Number(d.lockPx ?? 0), 0, 96);

    S.shots++;

    let tgtEl = hitTest(x,y);

    if (!tgtEl && lockPx > 0){
      tgtEl = nearestTargetWithin(x, y, lockPx);
    }

    if (!tgtEl){
      addScore(false);
      onBadHit();
      emitFx('shot_miss', x, y, false);
      aiOnEvent('shot:miss', { x, y, lockPx });
      maybeCoachTip('miss', false);
      return;
    }

    const tg = String(tgtEl.getAttribute('data-group')||'');
    const cg = currentGroup().key;

    removeTargetEl(tgtEl);

    const good = (tg === cg);
    addScore(good);

    if (good){
      emitFx('hit_good', x, y, true);
      onGoodHit();

      if ((S.combo|0) === 6 || (S.combo|0) === 12) maybeCoachTip('combo', false);

      if (S.boss){
        if (S.bossPhase === 'telegraph'){
          emit('groups:progress', { kind:'boss_block', phase:'telegraph' });
          coach('ยังไม่เปิดบอส! รอจังหวะ “OPEN” ก่อน 🔥', 'neutral', false);
        }else{
          bossHit();
        }
      }
      aiOnEvent('shot:hit_good', { groupKey: tg, combo:S.combo|0, score:S.score|0 });
    }else{
      emitFx('hit_bad', x, y, false);
      onBadHit();
      coach('ดูชื่อหมู่ก่อนนะ แล้วค่อยยิง ✅', 'neutral');
      aiOnEvent('shot:hit_bad', { groupKey: tg, wanted: cg });
      maybeCoachTip('miss', false);
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
          aiOnEvent('mini:timeout', {});
        }
        emitQuest(false);
      }

      maybeStartMini();
      startStormIfNeeded();
      endStormIfNeeded();
      startBossIfNeeded();

      // ----- boss phase countdown (deterministic, 1s tick) -----
      if (S.boss){
        if (S.bossPhase === 'telegraph'){
          S.bossTeleLeft = Math.max(0, (S.bossTeleLeft|0) - 1);
          if (S.bossTeleLeft <= 0){
            S.bossPhase = 'open';
            S.bossShield = false;
            S.bossCritReady = true;
            emit('groups:progress', { kind:'boss_open', phase:'open' });
            coach('OPEN! ยิงให้แม่นตอนนี้ 🔥', 'fever', true);
            maybeCoachTip('boss_open', true);
            aiOnEvent('boss:open', {});
          }
        }else if (S.bossPhase === 'open'){
          S.bossOpenLeft = Math.max(0, (S.bossOpenLeft|0) - 1);
          if (S.bossOpenLeft <= 0){
            S.bossPhase = 'rage';
            emit('groups:progress', { kind:'boss_rage', phase:'rage' });
            coach('RAGE! เร็วขึ้น แต่ยังต้องชัวร์ ⚡', 'fever', true);
            maybeCoachTip('boss_rage', true);
            aiOnEvent('boss:rage', {});
          }
        }else if (S.bossPhase === 'rage'){
          S.bossRageLeft = Math.max(0, (S.bossRageLeft|0) - 1);
          if (S.bossRageLeft <= 0){
            S.bossPhase = 'telegraph';
            S.bossShield = true;
            S.bossTeleLeft = 2 + ((S.rng()*2)|0);
            S.bossOpenLeft = 3 + ((S.rng()*2)|0);
            S.bossRageLeft = 2 + ((S.rng()*2)|0);
            S.bossCritReady = false;
            emit('groups:progress', { kind:'boss_cycle', phase:'telegraph' });
            coach('เตรียม! อีกเดี๋ยว OPEN ใหม่ 🔥', 'neutral', false);
            aiOnEvent('boss:cycle', {});
          }
        }
      }
    }

    // target expiry => timeout miss (only if current group AND not occluded by HUD)
    for (let i=S.targets.length-1;i>=0;i--){
      const tg = S.targets[i];
      if (!tg || tg.hit) { S.targets.splice(i,1); continue; }
      if (t >= tg.dieAt){
        const cg = currentGroup().key;
        const isFairMiss = (tg.groupKey === cg);

        let occluded = false;
        try{ occluded = isOccludedByHud(tg.el); }catch(_){ occluded = true; }

        if (isFairMiss && !occluded){
          S.miss++;
          S.combo = 0;
          S.score = Math.max(0, S.score - 6);
          emitScore();
          emitRank();
          onBadHit();

          try{
            const r = tg.el.getBoundingClientRect();
            emitFx('timeout_miss', r.left + r.width/2, r.top + r.height/2, false);
          }catch(_){}
          aiOnEvent('target:timeout_miss', { groupKey: tg.groupKey, timeLeft: S.timeLeftSec|0 });
        }else{
          aiOnEvent('target:timeout_ignored', { reason: occluded ? 'occluded' : 'not_fair', groupKey: tg.groupKey });
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
    if (S.running){
      S.spawnIt -= dt;
      if (S.spawnIt <= 0){
        const base = cfgForDiff(S.diff).spawnMs;

        let mul = 1.0;
        if (S.aiEnabled && S.ai && typeof S.ai.getDifficulty === 'function'){
          try{
            const d = S.ai.getDifficulty();
            mul = clamp(d, 0.85, 1.18);
            emitDirectorStatus('AI ON');
          }catch(_){}
        }

        const stormMul = S.storm ? 0.70 : 1.0;
        const bossMul  = S.boss ? 0.80 : 1.0;

        const intervalMs = clamp(base * stormMul * bossMul * mul, 360, 1500);
        S.spawnIt = intervalMs / 1000;

        spawnOne();
      }
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

    S.maxCombo = 0;
    S.streak10Awarded = false;
    S.miniAwarded = false;
    S.bossAwarded = false;

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

    // boss reset
    S.boss = false;
    S.bossHp = 0;
    S.bossPhase = 'none';
    S.bossTeleLeft = 0;
    S.bossOpenLeft = 0;
    S.bossRageLeft = 0;
    S.bossShield = false;
    S.bossCritReady = false;

    S.lastCoachAt = 0;
    S.lastQuestEmitAt = 0;

    S.lastShotAt = 0;

    // seed / rng
    S.seed = String(ctx && ctx.seed ? ctx.seed : (qs('seed','')||Date.now()));
    const u32 = strSeedToU32(S.seed);
    S.rng = makeRng(u32);

    // tip gate reset deterministic
    S.tipLastKey = '';
    S.tipNextAtLeft = 9999;

    // time
    const t = Number(ctx && ctx.time ? ctx.time : qs('time', 90));
    S.timePlannedSec = clamp(t, 15, 180);
    S.timeLeftSec = S.timePlannedSec;

    S.spawnIt = 0;

    initAI();

    emitPower();
    emitScore();
    emitRank();
    emitTime();
    emitQuest(true);
    emitGroup();

    coach('เริ่มแล้ว! ยิงให้ถูก “หมู่” แล้วเก็บคอมโบ 🔥', 'neutral', true);
    S.tipNextAtLeft = Math.max(0, (S.timeLeftSec|0) - 2);
    maybeCoachTip('start', true);
  }

  function start(diff, ctx){
    stop();

    readViewEtc();

    S.diff = String(diff||'normal').toLowerCase();
    S.runMode = String((ctx && ctx.runMode) ? ctx.runMode : (qs('run','play')||'play')).toLowerCase();
    if (S.runMode !== 'research' && S.runMode !== 'practice') S.runMode = 'play';

    setLayerEl(S.layerEl || DOC.getElementById('playLayer') || DOC.body);

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

    resetRun(ctx||{});

    awardOnce('groups','first_play',{ startedAt: Date.now() });

    S.running = true;
    S.startT = nowMs();
    S.lastTickT = S.startT;

    WIN.addEventListener('hha:shoot', handleShoot, { passive:true });

    aiOnEvent('run:start', { diff:S.diff, runMode:S.runMode, seed:S.seed, time:S.timePlannedSec|0 });

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

    if (acc >= 80){
      awardOnce('groups','score_80p', { scoreFinal:S.score|0, miss:S.miss|0, accuracyPct:acc|0, shots:S.shots|0, goodShots:S.goodShots|0, comboMax:S.maxCombo|0 });
    }
    if ((S.miss|0) === 0){
      awardOnce('groups','perfect_run', { scoreFinal:S.score|0, miss:0, accuracyPct:acc|0, shots:S.shots|0, goodShots:S.goodShots|0, comboMax:S.maxCombo|0 });
    }

    const summary = {
      reason: reason || 'end',
      scoreFinal: S.score|0,
      miss: S.miss|0,
      shots: S.shots|0,
      goodShots: S.goodShots|0,
      accuracyPct: acc|0,
      grade,
      seed: S.seed,
      runMode: S.runMode,
      diff: S.diff,
      style: S.style,
      view: S.view,
      comboMax: S.maxCombo|0,
      miniCleared: !!S.miniAwarded,
      bossCleared: !!S.bossAwarded,
      aiEnabled: !!S.aiEnabled
    };

    emit('hha:end', summary);
    aiOnEvent('run:end', summary);

    clearTargets();
  }

  // ---------------- flush harden hook (optional for your html) ----------------
  WIN.GroupsVR.bindFlushOnLeave = function bindFlushOnLeave(getSummaryFn){
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
  };

  // ---------------- expose ----------------
  WIN.GroupsVR.GameEngine = { setLayerEl, start, stop };

  WIN.GroupsVR.getResearchCtx = function(){
    try{
      const R = WIN.GroupsVR && WIN.GroupsVR.ResearchCtx;
      if (R && typeof R.get === 'function') return R.get();
    }catch(_){}
    return {};
  };

})();