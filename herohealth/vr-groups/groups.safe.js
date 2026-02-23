// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE Engine — Standalone (NO modules) — PRODUCTION (PATCH v20260223-groupsBossFairAI)
// ✅ HUD-safe spawn + Occlusion guard => timeout_miss NOT counted if target center is under HUD/overlay
// ✅ Emit groups:group / groups:director
// ✅ Shot rate-limit
// ✅ AI hooks attach point via window.HHA.createAIHooks (play only; ?ai=1)
// ✅ LockPx Aim Assist (uses ev.detail.lockPx from vr-ui.js)
// ✅ FX emits 'groups:hit'
// ✅ Direct tap/click targets works
// ✅ Badges bridge
// ✅ NEW: Boss pattern A/B deterministic (using S.rng only) + fairness clamp (no “โกง” streak)
// ✅ NEW: AI tip relay -> hha:coach (rate-limit, deterministic-safe)
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

    runMode:'play',
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

    // boss deterministic patterns / fairness
    bossPattern:'A',        // 'A' | 'B'
    bossPhaseTick:0,        // increments per boss spawn
    bossWaveBurstLeft:0,    // for pattern B
    bossPatternCooldown:0,  // reserved / soft step cooldown
    bossFairStreakBad:0,    // consecutive wrong-group spawns during boss (fairness clamp)

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
    aiEnabled:false,

    // AI tip relay (rate-limit at engine side too)
    aiTipLastAt:0,
    aiTipCooldownMs: 6000
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
      'position:relative; width:100%; height:100%; pointer-events:none; contain:layout style paint;';
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
    emit('groups:director', { text: String(text||'') });
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
    S.aiTipLastAt = 0;

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

  function maybeAiTip(reason){
    try{
      if (!S.aiEnabled || !S.ai || typeof S.ai.getTip !== 'function') return;
      const t = nowMs();
      if ((t - (S.aiTipLastAt||0)) < S.aiTipCooldownMs) return;

      const tip = S.ai.getTip(String(reason||''));
      if (!tip || !tip.text) return;

      S.aiTipLastAt = t;
      emit('hha:coach', {
        text: String(tip.text),
        mood: 'neutral',
        source: 'ai',
        key: tip.key || '',
        reason: tip.reason || String(reason||'')
      });
    }catch(_){}
  }

  // ---------------- gameplay rules ----------------
  function resetMini(){
    S.miniActive = true;
    S.miniLeft = 10;
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
      aiOnEvent('mini:start', { timeLeft: S.timeLeftSec });
      maybeAiTip('mini:start');
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
    maybeAiTip('group:switch');
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
        maybeAiTip('mini:clear');
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
      maybeAiTip('storm:on');
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
      maybeAiTip('storm:off');
    }
  }

  function startBossIfNeeded(){
    if (S.boss) return;
    const frac = (S.timePlannedSec - S.timeLeftSec) / Math.max(1,S.timePlannedSec);
    if (frac >= 0.82){
      S.boss = true;
      S.bossHp = 6;

      // deterministic boss pattern by current seeded RNG
      S.bossPattern = (S.rng() < 0.5) ? 'A' : 'B';
      S.bossPhaseTick = 0;
      S.bossWaveBurstLeft = 0;
      S.bossPatternCooldown = 0;
      S.bossFairStreakBad = 0;

      emit('groups:progress', { kind:'boss_spawn', pattern:S.bossPattern });
      coach(`บอสมา! Pattern ${S.bossPattern} ยิง “หมู่ที่ถูก” ให้แม่น 👊`, 'fever');
      aiOnEvent('boss:spawn', { hp:S.bossHp|0, pattern:S.bossPattern });
      maybeAiTip('boss:spawn');
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

      if(!S.bossAwarded){
        S.bossAwarded = true;
        awardOnce('groups','boss_clear_1', { scoreFinal:S.score|0, comboMax:S.maxCombo|0, miss:S.miss|0 });
      }
      aiOnEvent('boss:down', { score:S.score|0, miss:S.miss|0 });
      maybeAiTip('boss:down');
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
      maybeAiTip('shot:miss');
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
      if (S.boss) bossHit();
      aiOnEvent('shot:hit_good', { groupKey: tg, combo:S.combo|0, score:S.score|0 });
      if ((S.combo|0) >= 6 && (S.combo % 5) === 0) maybeAiTip('combo:high');
    }else{
      emitFx('hit_bad', x, y, false);
      onBadHit();
      coach('ดูชื่อหมู่ก่อนนะ แล้วค่อยยิง ✅', 'neutral');
      aiOnEvent('shot:hit_bad', { groupKey: tg, wanted: cg });
      maybeAiTip('shot:hit_bad');
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
          maybeAiTip('mini:timeout');
        }
        emitQuest(false);
      }

      maybeStartMini();
      startStormIfNeeded();
      endStormIfNeeded();
      startBossIfNeeded();
    }

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
          maybeAiTip('target:timeout_miss');
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

  // ---------------- spawnOne (LATEST deterministic boss pattern A/B) ----------------
  function spawnOne(){
    if (!S.running) return;
    ensureWrap();

    const C = cfgForDiff(S.diff);
    const cg = currentGroup();

    let gKey = '';
    let lifeBoostMul = 1.0;
    let forceCorrect = false;

    // ---------------- BOSS deterministic patterns ----------------
    if (S.boss){
      S.bossPhaseTick = (S.bossPhaseTick|0) + 1;

      if (S.bossPatternCooldown > 0) S.bossPatternCooldown--;

      if ((S.bossFairStreakBad|0) >= 2){
        forceCorrect = true;
      }

      const pat = S.bossPattern || 'A';
      const k = S.bossPhaseTick;

      if (pat === 'A'){
        // Rhythm Boss: 4-step cycle (readable + challenge + recovery)
        const phase = ((k - 1) % 4) + 1;

        if (forceCorrect){
          gKey = cg.key;
          lifeBoostMul = 1.10;
        } else if (phase === 1){
          gKey = cg.key;
          lifeBoostMul = 1.05;
        } else if (phase === 2){
          gKey = (S.rng() < 0.78) ? cg.key : pick(S.rng, GROUPS).key;
        } else if (phase === 3){
          gKey = (S.rng() < 0.62) ? cg.key : pick(S.rng, GROUPS).key;
        } else {
          gKey = (S.rng() < 0.88) ? cg.key : pick(S.rng, GROUPS).key;
          lifeBoostMul = 1.18;
        }

        if ((k % 7) === 0 && S.bossWaveBurstLeft <= 0){
          S.bossWaveBurstLeft = 1; // micro-burst cue
        }

      } else {
        // Burst Boss: calm -> burst(2-3) -> calm, but fair
        if (S.bossWaveBurstLeft > 0){
          if (forceCorrect){
            gKey = cg.key;
            lifeBoostMul = 1.05;
          } else {
            gKey = (S.rng() < 0.68) ? cg.key : pick(S.rng, GROUPS).key;
          }
          S.bossWaveBurstLeft--;
        } else {
          if (forceCorrect){
            gKey = cg.key;
            lifeBoostMul = 1.12;
          } else {
            gKey = (S.rng() < 0.82) ? cg.key : pick(S.rng, GROUPS).key;
          }

          if ((k % 5) === 0 && S.rng() < 0.72){
            S.bossWaveBurstLeft = (S.rng() < 0.5) ? 2 : 3;
          }
        }
      }

      if (gKey === cg.key) S.bossFairStreakBad = 0;
      else S.bossFairStreakBad = (S.bossFairStreakBad|0) + 1;

    } else {
      // ---------------- normal / non-boss spawning ----------------
      const r = S.rng();
      if (r < 0.58) gKey = cg.key;
      else gKey = pick(S.rng, GROUPS).key;

      if (S.storm && S.rng() < 0.64) gKey = cg.key;
    }

    const g = GROUPS.find(x=>x.key===gKey) || cg;
    const em = pick(S.rng, g.emoji);

    const lifeMin = C.lifeMs[0];
    const lifeMax = C.lifeMs[1];
    let life = clamp(lifeMin + S.rng()*(lifeMax-lifeMin), 900, 5200);

    if (S.boss){
      life = Math.round(life * 0.90 * (lifeBoostMul || 1));
      life = clamp(life, 900, 4800);
    }

    const t = mkTarget(g.key, em, life);
    S.targets.push(t);

    const cap = (S.view==='pc') ? 12 : 10;
    if (S.targets.length > cap){
      let idx = -1;
      if (S.boss){
        idx = S.targets.findIndex(x => x.groupKey !== currentGroup().key);
      }
      if (idx < 0){
        idx = S.targets.findIndex(x => x.groupKey !== currentGroup().key);
      }
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
    S.boss = false;
    S.bossHp = 0;

    S.bossPattern = 'A';
    S.bossPhaseTick = 0;
    S.bossWaveBurstLeft = 0;
    S.bossPatternCooldown = 0;
    S.bossFairStreakBad = 0;

    S.lastCoachAt = 0;
    S.lastQuestEmitAt = 0;
    S.lastShotAt = 0;
    S.aiTipLastAt = 0;

    S.seed = String(ctx && ctx.seed ? ctx.seed : (qs('seed','')||Date.now()));
    const u32 = strSeedToU32(S.seed);
    S.rng = makeRng(u32);

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

    coach('เริ่มแล้ว! ยิงให้ถูก “หมู่” แล้วเก็บคอมโบ 🔥', 'neutral');
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
    maybeAiTip('run:start');

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
      aiEnabled: !!S.aiEnabled,
      bossPattern: S.bossPattern || null
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