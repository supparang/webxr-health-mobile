// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (BOSS++ + STORM + RAGE) v20260216a
// ✅ STORM when timeLeft<=30s
// ✅ BOSS when miss>=4
// ✅ RAGE when miss>=5
// ✅ Boss HP by diff: easy/normal/hard = 10/12/14
// ✅ Phase2 cadence every 6s
// ✅ Miss = good expired + junk hit ; Shield-blocked junk NOT count miss
// ✅ HUD-safe spawn via --gj-top-safe / --gj-bottom-safe (layer-rect based)
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ cVR/VR shoot from center via hha:shoot (uses ev.detail.x/y if provided)

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> (performance && performance.now ? performance.now() : Date.now());
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // fx bridge (Particles.js optional)
  function fx(){
    return ROOT.Particles || (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || null;
  }
  function fxText(x,y,txt){
    try{
      const P = fx();
      if(P && typeof P.popText==='function') P.popText(x,y,txt);
    }catch(_){}
  }
  function bodyPulse(cls, ms=160){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), ms);
    }catch(_){}
  }

  // seeded RNG (deterministic)
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeSeededRng(seedStr){
    const seed = String(seedStr ?? '');
    const gen = xmur3(seed || String(Date.now()));
    return sfc32(gen(), gen(), gen(), gen());
  }
  function randIn(rng, a, b){ return a + (b-a) * rng(); }

  function pickWeighted(rng, items){
    let sum = 0;
    for(const it of items) sum += (Number(it.w)||0);
    let r = rng() * sum;
    for(const it of items){
      r -= (Number(it.w)||0);
      if(r <= 0) return it.k;
    }
    return items[items.length-1]?.k;
  }

  function deviceLabel(view){
    if(view==='pc') return 'pc';
    if(view==='vr') return 'vr';
    if(view==='cvr') return 'cvr';
    return 'mobile';
  }

  // ---------------- daily keys (zone done / last summary) ----------------
  function ymdLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  function zoneDoneKey(zone){ return `HHA_ZONE_DONE::${zone}::${ymdLocal()}`; }
  function markZoneDone(zone){
    try{ localStorage.setItem(zoneDoneKey(zone), '1'); }catch(_){}
  }

  // ---------------- config ----------------
  const view = String(payload.view || qs('view','mobile') || 'mobile').toLowerCase();
  const diff = String(payload.diff || qs('diff','normal') || 'normal').toLowerCase();
  const runMode = String(payload.run || qs('run','play') || 'play').toLowerCase();
  const durationPlannedSec = clamp(Number(payload.time ?? qs('time','80') ?? 80) || 80, 20, 300);
  const hub = String(payload.hub ?? qs('hub','../hub.html') ?? '../hub.html');

  const seedParam = (payload.seed ?? qs('seed', null));
  const seed = (runMode === 'research')
    ? (seedParam ?? (qs('ts', null) ?? 'RESEARCH-SEED'))
    : (seedParam ?? String(Date.now()));

  const studyId = payload.studyId ?? qs('studyId', qs('study', null));
  const phase = payload.phase ?? qs('phase', null);
  const conditionGroup = payload.conditionGroup ?? qs('conditionGroup', qs('cond', null));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-02-16_BOSSpp';
  const PROJECT_TAG = 'GoodJunkVR';
  const CATEGORY = 'nutrition';

  const rng = makeSeededRng(String(seed));
  const isVR  = (view === 'vr');
  const isCVR = (view === 'cvr');

  const LAYER_L = payload.layerL || byId('gj-layer');
  const LAYER_R = payload.layerR || byId('gj-layer-r');

  if(!LAYER_L){
    console.error('[GoodJunkVR] missing #gj-layer');
    return;
  }

  const DIFF = (() => {
    if(diff==='easy') return {
      spawnPerSec: 1.15,
      junkRate: 0.22,
      starRate: 0.08,
      shieldRate: 0.06,
      diamondRate: 0.015,
      goodLifeMs: 2050,
      goodScore: 12,
      junkPenaltyScore: -10,
      missLimit: 12,
      bossHP: 10,
    };
    if(diff==='hard') return {
      spawnPerSec: 1.65,
      junkRate: 0.32,
      starRate: 0.06,
      shieldRate: 0.045,
      diamondRate: 0.012,
      goodLifeMs: 1500,
      goodScore: 14,
      junkPenaltyScore: -14,
      missLimit: 9,
      bossHP: 14,
    };
    return { // normal
      spawnPerSec: 1.35,
      junkRate: 0.27,
      starRate: 0.07,
      shieldRate: 0.055,
      diamondRate: 0.014,
      goodLifeMs: 1820,
      goodScore: 13,
      junkPenaltyScore: -12,
      missLimit: 10,
      bossHP: 12,
    };
  })();

  const adaptiveOn = (runMode !== 'research');

  // ---------------- UI refs ----------------
  const HUD = {
    score: byId('hud-score'),
    time: byId('hud-time'),
    miss: byId('hud-miss'),
    grade: byId('hud-grade'),

    goal: byId('hud-goal'),
    goalCur: byId('hud-goal-cur'),
    goalTarget: byId('hud-goal-target'),
    goalDesc: byId('goalDesc'),

    mini: byId('hud-mini'),
    miniTimer: byId('miniTimer'),

    feverFill: byId('feverFill'),
    feverText: byId('feverText'),
    shieldPills: byId('shieldPills'),

    lowTimeOverlay: byId('lowTimeOverlay'),
    lowTimeNum: byId('gj-lowtime-num'),
  };

  // ---------------- state ----------------
  const state = {
    started: false,
    ended: false,

    tStart: 0,
    tNow: 0,
    timeLeftSec: durationPlannedSec,

    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    // counts
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetShieldSpawned: 0,
    nTargetDiamondSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    // RT
    rtGood: [],

    // fever / shield
    fever: 0,
    shield: 0,

    // spawn
    spawnAcc: 0,
    targets: new Map(),

    // BOSS / STORM / RAGE
    stormOn: false,
    bossOn: false,
    rageOn: false,

    boss: {
      active:false,
      hp: DIFF.bossHP,
      hpMax: DIFF.bossHP,
      phase: 1,
      phaseEverySec: 6,
      phaseTimer: 0,
      stompCooldown: 0,
      rageBoost: 0,
      defeated: false,
    },

    startTimeIso: new Date().toISOString(),
    endTimeIso: null,
  };

  // ---------------- class hooks ----------------
  function setModeClass(){
    const b = DOC.body;
    b.classList.toggle('storm', !!state.stormOn);
    b.classList.toggle('boss',  !!state.bossOn);
    b.classList.toggle('rage',  !!state.rageOn);
  }

  // ---------------- HUD setters ----------------
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    if(HUD.score) HUD.score.textContent = String(state.score);
    emit('hha:score', { score: state.score });
  }
  function setMiss(v){
    state.miss = Math.max(0, Math.floor(v));
    if(HUD.miss) HUD.miss.textContent = String(state.miss);
  }
  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    if(HUD.time) HUD.time.textContent = String(Math.ceil(state.timeLeftSec));
    emit('hha:time', { left: state.timeLeftSec });
  }
  function setGradeText(txt){
    if(HUD.grade) HUD.grade.textContent = txt;
  }
  function addFever(delta){
    state.fever = clamp(state.fever + (Number(delta)||0), 0, 100);
    if(HUD.feverFill) HUD.feverFill.style.width = `${state.fever}%`;
    if(HUD.feverText) HUD.feverText.textContent = `${Math.round(state.fever)}%`;
  }
  function addShield(n){
    state.shield = clamp(state.shield + (Number(n)||0), 0, 5);
    renderShield();
  }
  function useShield(){
    if(state.shield > 0){
      state.shield--;
      renderShield();
      return true;
    }
    return false;
  }
  function renderShield(){
    if(!HUD.shieldPills) return;
    const pills = [];
    for(let i=0;i<state.shield;i++) pills.push('🛡️');
    HUD.shieldPills.textContent = pills.length ? pills.join(' ') : '—';
  }

  function updateLowTimeFx(){
    const t = state.timeLeftSec;
    if(!HUD.lowTimeOverlay) return;
    if(t <= 5){
      HUD.lowTimeOverlay.setAttribute('aria-hidden','false');
      if(HUD.lowTimeNum) HUD.lowTimeNum.textContent = String(Math.ceil(t));
      DOC.body.classList.add('gj-tick');
      setTimeout(()=>DOC.body.classList.remove('gj-tick'), 120);
    }else{
      HUD.lowTimeOverlay.setAttribute('aria-hidden','true');
    }
  }

  // ---------------- safe spawn rect (layer-based) ----------------
  function cssPx(varName, fallbackPx){
    try{
      const v = getComputedStyle(DOC.documentElement).getPropertyValue(varName);
      const n = parseFloat(String(v||'').trim());
      return Number.isFinite(n) ? n : fallbackPx;
    }catch(_){ return fallbackPx; }
  }
  function getSafeRectForLayer(layerEl){
    const r = layerEl.getBoundingClientRect();
    const topSafe = cssPx('--gj-top-safe', 120);
    const botSafe = cssPx('--gj-bottom-safe', 110);
    const padX = 14;

    const x = padX;
    const y = Math.max(8, topSafe);
    const w = Math.max(140, r.width - padX*2);
    const h = Math.max(190, r.height - y - botSafe);

    return { x,y,w,h, rect:r };
  }

  // ---------------- targets ----------------
  let targetSeq = 0;

  const EMOJI = {
    good: ['🥦','🍎','🥕','🍌','🍇','🥬','🍊','🍉'],
    junk: ['🍟','🍔','🍭','🍩','🧁','🥤','🍪','🍫'],
    star: ['⭐'],
    shield: ['🛡️'],
    diamond: ['💎'],
    bomb: ['💣'],
    skull: ['💀'],
  };

  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function makeTargetKind(){
    const junkW   = DIFF.junkRate;
    const starW   = DIFF.starRate;
    const shieldW = DIFF.shieldRate;
    const diamondW= DIFF.diamondRate;

    const bossHazW = state.boss.active ? (state.rageOn ? 0.12 : 0.085) : 0;
    const bossBombW= state.boss.active ? (state.rageOn ? 0.065 : 0.045) : 0;

    const goodW = Math.max(0.01, 1 - (junkW+starW+shieldW+diamondW+bossHazW+bossBombW));

    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW},
      {k:'shield', w:shieldW},
      {k:'diamond', w:diamondW},
      {k:'skull', w:bossHazW},
      {k:'bomb',  w:bossBombW},
    ]);
  }

  function spawnOne(){
    if(state.ended) return;

    const kind = makeTargetKind();

    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const id = `t${++targetSeq}`;
    const baseLife =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='diamond') ? Math.round(DIFF.goodLifeMs * 1.25) :
      (kind==='skull') ? Math.round(DIFF.goodLifeMs * 0.95) :
      Math.round(DIFF.goodLifeMs * 0.85);

    const stormMul = state.stormOn ? (state.rageOn ? 0.80 : 0.86) : 1;
    const lifeMs = Math.max(520, Math.round(baseLife * stormMul));

    const baseSize =
      (kind==='good') ? 54 :
      (kind==='junk') ? 56 :
      (kind==='skull')? 58 :
      (kind==='bomb') ? 58 : 50;

    const size = clamp(baseSize + randIn(rng, -4, 12), 44, 78);

    // spawn in layer safe rect
    const safeL = getSafeRectForLayer(LAYER_L);
    const xL = safeL.x + rng()*safeL.w;
    const yL = safeL.y + rng()*safeL.h;

    const elL = DOC.createElement('div');
    elL.className = 'gj-target spawn';
    elL.dataset.id = id;
    elL.dataset.kind = kind;
    elL.textContent = pickEmoji(kind);
    elL.style.position = 'absolute';
    elL.style.left = `${Math.round(xL)}px`;
    elL.style.top  = `${Math.round(yL)}px`;
    elL.style.fontSize = `${Math.round(size)}px`;

    let elR = null;
    let xR = xL, yR = yL;

    if(isCVR && LAYER_R){
      const safeR = getSafeRectForLayer(LAYER_R);
      const xRatio = safeR.w / Math.max(1, safeL.w);
      xR = safeR.x + (xL - safeL.x) * xRatio;
      yR = yL; // keep y
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
      elR.style.left = `${Math.round(xR)}px`;
      elR.style.top  = `${Math.round(yR)}px`;
    }

    const bornAt = now();
    const tObj = { id, kind, bornAt, lifeMs, x:xL, y:yL, elL, elR, hit:false };

    elL.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onTargetHit(tObj, { via:'tap', clientX: ev.clientX, clientY: ev.clientY });
    }, { passive:false });

    LAYER_L.appendChild(elL);
    if(elR && LAYER_R) LAYER_R.appendChild(elR);

    state.targets.set(id, tObj);
  }

  function removeTarget(tObj){
    if(!tObj) return;
    try{
      tObj.elL?.classList.add('gone');
      tObj.elR?.classList.add('gone');
      setTimeout(()=>{
        try{ tObj.elL?.remove(); }catch(_){}
        try{ tObj.elR?.remove(); }catch(_){}
      }, 140);
    }catch(_){}
    state.targets.delete(tObj.id);
  }

  // ---------------- scoring / boss damage ----------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  function bossTakeDamage(dmg, px, py){
    if(!state.boss.active) return;
    const b = state.boss;
    b.hp = Math.max(0, b.hp - Math.max(1, dmg|0));
    fxText(px,py,`-HP ${dmg}`);
    emit('hha:judge', { label:`BOSS HIT! (${b.hp}/${b.hpMax})` });

    if(b.hp <= 0){
      state.boss.active = false;
      state.boss.defeated = true;
      state.bossOn = false;
      state.rageOn = false;
      b.phase = 1;
      b.phaseTimer = 0;
      b.stompCooldown = 0;
      b.rageBoost = 0;
      setModeClass();

      const bonus = 120;
      setScore(state.score + bonus);
      addFever(-20);
      addShield(2);
      emit('hha:celebrate', { kind:'boss_clear' });
      emit('hha:judge', { label:'BOSS DOWN!' });
      bodyPulse('gj-boss-down', 260);
    }
  }

  // ---------------- hit logic ----------------
  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    const px = meta.clientX ?? tObj.x;
    const py = meta.clientY ?? tObj.y;

    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);

      const phaseMul = state.boss.active ? (state.boss.phase===2 ? 1.35 : 1.15) : 1.0;
      const stormMul = state.stormOn ? (state.rageOn ? 1.22 : 1.12) : 1.0;

      const delta = Math.round((DIFF.goodScore + Math.min(7, Math.floor(state.combo/5))) * phaseMul * stormMul);
      setScore(state.score + delta);

      if(state.boss.active){
        const dmg = (state.boss.phase===2) ? 2 : 1;
        bossTakeDamage(dmg, px, py);
      }

      state.rtGood.push(rtMs);
      fxText(px,py,`+${delta}`);
      emit('hha:judge', { label:'GOOD!' });

    } else if(kind==='junk'){
      const blocked = useShield();
      resetCombo();

      if(blocked){
        state.nHitJunkGuard++;
        addFever(-6);
        fxText(px,py,'BLOCK');
        emit('hha:judge', { label:'BLOCK!' });
        // ✅ shield-blocked junk NOT count miss
      }else{
        state.nHitJunk++;
        addFever(10);
        setMiss(state.miss + 1);
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        fxText(px,py,'-');
        emit('hha:judge', { label:'OOPS!' });
        bodyPulse('gj-junk-hit', 220);
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      fxText(px,py,'MISS -1');
      emit('hha:judge', { label:'STAR!' });

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      fxText(px,py,'SHIELD +1');
      emit('hha:judge', { label:'SHIELD!' });

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      fxText(px,py,`+${bonus}`);
      emit('hha:judge', { label:'DIAMOND!' });

    } else if(kind==='skull'){
      resetCombo();
      addFever(14);
      setMiss(state.miss + 1);
      setScore(state.score - 8);
      fxText(px,py,'💀');
      emit('hha:judge', { label:'SKULL!' });
      bodyPulse('gj-skull-hit', 240);

      if(state.boss.active && state.boss.phase===2){
        state.boss.stompCooldown = Math.max(state.boss.stompCooldown, 0.9);
      }

    } else if(kind==='bomb'){
      const blocked = useShield();
      resetCombo();

      if(blocked){
        addFever(-8);
        fxText(px,py,'DEFUSE');
        emit('hha:judge', { label:'DEFUSED!' });
      }else{
        addFever(20);
        setMiss(state.miss + 2);
        setScore(state.score - 22);
        fxText(px,py,'BOOM');
        emit('hha:judge', { label:'BOOM!' });
        bodyPulse('gj-bomb', 320);

        if(state.boss.active) state.boss.rageBoost = Math.min(1.0, state.boss.rageBoost + 0.25);
      }
    }

    removeTarget(tObj);

    updateModeThresholds();
    emitQuestUpdate();

    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // ---------------- shoot (hha:shoot) ----------------
  function shootPick(ev){
    if(state.ended) return;

    let cx = Number(ev?.detail?.x);
    let cy = Number(ev?.detail?.y);
    if(!Number.isFinite(cx) || !Number.isFinite(cy)){
      cx = Math.floor(DOC.documentElement.clientWidth/2);
      cy = Math.floor(DOC.documentElement.clientHeight/2);
    }

    const R = (isCVR || isVR) ? 86 : 72;
    let best = null;
    let bestD = 1e9;

    for(const t of state.targets.values()){
      if(t.hit) continue;
      const dx = (t.x - cx);
      const dy = (t.y - cy);
      const d = Math.hypot(dx,dy);
      if(d < R && d < bestD){
        bestD = d;
        best = t;
      }
    }

    if(best){
      onTargetHit(best, { via:'shoot', clientX: cx, clientY: cy });
    }else{
      bodyPulse('gj-miss-shot', 120);
      fxText(cx,cy,'…');
    }
  }
  ROOT.addEventListener('hha:shoot', shootPick, { passive:true });

  // ---------------- expiry ----------------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.hit) continue;
      const age = t - tObj.bornAt;
      if(age >= tObj.lifeMs){
        tObj.hit = true;

        if(tObj.kind === 'good'){
          state.nExpireGood++;
          resetCombo();
          addFever(6);
          setMiss(state.miss + 1);
          fxText(tObj.x,tObj.y,'MISS');
          emit('hha:judge', { label:'MISS!' });
          bodyPulse('gj-good-expire', 160);

          updateModeThresholds();
          emitQuestUpdate();

          removeTarget(tObj);

          if(state.miss >= DIFF.missLimit){
            endGame('miss-limit');
            return;
          }
          continue;
        }

        removeTarget(tObj);
      }
    }
  }

  // ---------------- mode thresholds (storm/boss/rage) ----------------
  function updateModeThresholds(){
    const wantStorm = (state.timeLeftSec <= 30);
    if(wantStorm && !state.stormOn){
      state.stormOn = true;
      emit('hha:judge', { label:'STORM!' });
      fxText(DOC.documentElement.clientWidth/2, 80, '⚡ STORM');
      bodyPulse('gj-storm', 240);
    }

    const wantBoss = (state.miss >= 4);
    if(wantBoss && !state.bossOn){
      state.bossOn = true;
      state.boss.active = true;
      state.boss.defeated = false;
      state.boss.hpMax = DIFF.bossHP;
      state.boss.hp = DIFF.bossHP;
      state.boss.phase = 1;
      state.boss.phaseTimer = 0;
      state.boss.stompCooldown = 0;
      state.boss.rageBoost = 0;

      emit('hha:judge', { label:`BOSS! HP ${state.boss.hp}/${state.boss.hpMax}` });
      fxText(DOC.documentElement.clientWidth/2, 110, '👹 BOSS');
      bodyPulse('gj-boss', 280);

      for(let i=0;i<3;i++) spawnOne();
    }

    const wantRage = (state.miss >= 5);
    if(wantRage && !state.rageOn){
      state.rageOn = true;
      emit('hha:judge', { label:'RAGE!!' });
      fxText(DOC.documentElement.clientWidth/2, 140, '🔥 RAGE');
      bodyPulse('gj-rage', 320);
    }

    setModeClass();
  }

  // ---------------- boss tick (phase rotation + stomp) ----------------
  function tickBoss(dt){
    if(!state.boss.active) return;
    const b = state.boss;

    b.phaseTimer += dt;
    if(b.phaseTimer >= b.phaseEverySec){
      b.phaseTimer = 0;
      b.phase = (b.phase === 1) ? 2 : 1;
      emit('hha:judge', { label: (b.phase===2 ? 'PHASE 2!' : 'PHASE 1') });
      fxText(DOC.documentElement.clientWidth/2, 165, b.phase===2 ? '⚔️ PHASE 2' : '🛡️ PHASE 1');

      if(b.phase===2){
        for(let i=0;i<2;i++) spawnOne();
      }
    }

    if(b.stompCooldown > 0){
      b.stompCooldown = Math.max(0, b.stompCooldown - dt);
      if(b.stompCooldown <= 0){
        let popped = 0;
        for(const tObj of state.targets.values()){
          if(popped >= 2) break;
          if(!tObj.hit && tObj.kind === 'good'){
            tObj.hit = true;
            state.nExpireGood++;
            setMiss(state.miss + 1);
            fxText(tObj.x,tObj.y,'STOMP');
            removeTarget(tObj);
            popped++;
          }
        }
        emit('hha:judge', { label:'STOMP!' });
        bodyPulse('gj-stomp', 240);
        updateModeThresholds();
        emitQuestUpdate();

        if(state.miss >= DIFF.missLimit){
          endGame('miss-limit');
        }
      }
    }
  }

  // ---------------- spawn rate ----------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / Math.max(1, DIFF.missLimit)), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);
    }

    if(state.stormOn) r *= (state.rageOn ? 1.35 : 1.22);

    if(state.boss.active){
      r *= (state.boss.phase===2 ? 1.25 : 1.12);
      r *= (1 + 0.18 * clamp(state.boss.rageBoost, 0, 1));
    }

    if(state.timeLeftSec <= 10) r *= 1.12;

    return clamp(r, 0.85, 2.25);
  }

  // ---------------- quests emit ----------------
  function emitQuestUpdate(){
    const played = Math.max(0, Math.round(durationPlannedSec - state.timeLeftSec));
    const boss = state.boss.active ? `HP ${state.boss.hp}/${state.boss.hpMax} (P${state.boss.phase})` : (state.boss.defeated ? 'CLEAR ✅' : '—');
    emit('quest:update', {
      goal: { title:'Survive', desc:'อยู่ให้รอด ลด MISS', cur: state.miss, target: DIFF.missLimit, done: state.miss < DIFF.missLimit },
      mini: { title:'BOSS / STORM', cur: played, target: durationPlannedSec, done: false, boss, storm: state.stormOn, rage: state.rageOn }
    });
  }

  // ---------------- grading + end overlay ----------------
  function avg(arr){
    if(!arr.length) return null;
    let s=0; for(const v of arr) s += v;
    return Math.round(s/arr.length);
  }
  function median(arr){
    if(!arr.length) return null;
    const a = arr.slice().sort((x,y)=>x-y);
    const mid = Math.floor(a.length/2);
    return (a.length%2) ? a[mid] : Math.round((a[mid-1]+a[mid]) / 2);
  }
  function gradeFrom(score, miss){
    if(miss <= 2 && score >= 560) return 'S';
    if(miss <= 4 && score >= 480) return 'A';
    if(miss <= 6 && score >= 400) return 'B';
    if(miss <= 8 && score >= 320) return 'C';
    return 'D';
  }

  function ensureEndOverlay(){
    let ov = byId('gjEndOverlay');
    if(ov) return ov;

    ov = DOC.createElement('div');
    ov.id = 'gjEndOverlay';
    ov.style.position = 'fixed';
    ov.style.inset = '0';
    ov.style.zIndex = '9999';
    ov.style.display = 'none';
    ov.style.alignItems = 'center';
    ov.style.justifyContent = 'center';
    ov.style.padding = '24px';
    ov.style.background = 'rgba(2,6,23,.72)';
    ov.style.backdropFilter = 'blur(6px)';

    const card = DOC.createElement('div');
    card.style.width = 'min(740px, 92vw)';
    card.style.border = '1px solid rgba(148,163,184,.18)';
    card.style.borderRadius = '22px';
    card.style.background = 'linear-gradient(180deg, rgba(2,6,23,.92), rgba(2,6,23,.70))';
    card.style.boxShadow = '0 18px 60px rgba(0,0,0,.45)';
    card.style.padding = '16px';

    card.innerHTML = `
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <div style="font-weight:1000; letter-spacing:.2px;">สรุปผล GoodJunkVR</div>
        <div id="gjEndGrade" style="margin-left:auto; font-weight:1000; padding:6px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.18); background:rgba(2,6,23,.45);">—</div>
      </div>
      <div id="gjEndMsg" style="margin-top:8px; color:rgba(229,231,235,.86); font-weight:850; font-size:12px; line-height:1.35;">—</div>

      <div style="margin-top:12px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;">
        <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
          <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">SCORE</div>
          <div id="gjEndScore" style="font-size:18px; font-weight:1000; margin-top:2px;">0</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
          <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">MISS</div>
          <div id="gjEndMiss" style="font-size:18px; font-weight:1000; margin-top:2px;">0</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
          <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">COMBO MAX</div>
          <div id="gjEndCombo" style="font-size:18px; font-weight:1000; margin-top:2px;">0</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.14); background:rgba(2,6,23,.35); border-radius:16px; padding:10px 12px;">
          <div style="color:rgba(148,163,184,.9); font-size:11px; font-weight:900;">BOSS</div>
          <div id="gjEndBoss" style="font-size:18px; font-weight:1000; margin-top:2px;">—</div>
        </div>
      </div>

      <div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
        <button id="gjEndToHub" style="font-weight:1000; padding:10px 14px; border-radius:14px; border:1px solid rgba(148,163,184,.18); background:rgba(2,6,23,.35); color:#e5e7eb;">กลับ HUB</button>
        <button id="gjEndReplay" style="font-weight:1000; padding:10px 14px; border-radius:14px; border:1px solid rgba(34,211,238,.35); background:rgba(34,211,238,.14); color:#e5e7eb;">เล่นอีกครั้ง</button>
      </div>
    `;
    ov.appendChild(card);
    DOC.body.appendChild(ov);
    return ov;
  }

  function showEndOverlay(summary){
    const ov = ensureEndOverlay();
    const $ = (id)=>byId(id);

    const grade = summary.grade || '—';
    if($('gjEndGrade')) $('gjEndGrade').textContent = `GRADE: ${grade}`;
    if($('gjEndScore')) $('gjEndScore').textContent = String(summary.scoreFinal ?? 0);
    if($('gjEndMiss'))  $('gjEndMiss').textContent  = String(summary.misses ?? 0);
    if($('gjEndCombo')) $('gjEndCombo').textContent = String(summary.comboMax ?? 0);
    if($('gjEndBoss'))  $('gjEndBoss').textContent  = summary.bossDefeated ? 'CLEAR ✅' : (summary.bossOn ? 'ACTIVE/FAIL' : '—');

    const msg =
      (summary.misses <= 3 && summary.scoreFinal >= 480) ? 'โคตรดี! แม่นมาก 🔥' :
      (summary.misses <= 6) ? 'ดีมาก! รอบหน้าลองคุม MISS ให้น้อยลงอีกนิด ✨' :
      'รอบหน้าลองโฟกัส “ของดี” + ใช้โล่ให้คุ้ม 🛡️';
    if($('gjEndMsg')) $('gjEndMsg').textContent = msg;

    const btnHub = $('gjEndToHub');
    if(btnHub){
      const n = btnHub.cloneNode(true);
      btnHub.parentNode.replaceChild(n, btnHub);
      n.addEventListener('click', ()=>{ location.href = hub; });
    }
    const btnReplay = $('gjEndReplay');
    if(btnReplay){
      const n = btnReplay.cloneNode(true);
      btnReplay.parentNode.replaceChild(n, btnReplay);
      n.addEventListener('click', ()=>{ location.reload(); });
    }

    ov.style.display = 'flex';
  }

  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    try{ ROOT.removeEventListener('hha:shoot', shootPick); }catch(_){}

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    const scoreFinal = state.score;
    const comboMax = state.comboMax;
    const misses = state.miss;
    const avgRtGoodMs = avg(state.rtGood);
    const medianRtGoodMs = median(state.rtGood);
    const grade = gradeFrom(scoreFinal, misses);

    setGradeText(grade);
    state.endTimeIso = new Date().toISOString();

    const durationPlayedSec = Math.round(durationPlannedSec - state.timeLeftSec);

    const summary = {
      projectTag: PROJECT_TAG,
      category: CATEGORY,
      gameVersion: GAME_VERSION,
      device: deviceLabel(view),
      runMode,
      diff,
      seed,
      reason,
      durationPlannedSec,
      durationPlayedSec,
      scoreFinal,
      comboMax,
      misses,
      avgRtGoodMs,
      medianRtGoodMs,
      bossOn: state.bossOn || state.boss.active,
      bossDefeated: !!state.boss.defeated,
      stormOn: state.stormOn,
      rageOn: state.rageOn,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
      grade,
      studyId,
      phase,
      conditionGroup
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

    // ✅ mark zone done today (nutrition)
    markZoneDone(CATEGORY);

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', grade });

    showEndOverlay(summary);
  }

  // ---------------- loop ----------------
  let lastTick = 0;

  function tick(){
    if(state.ended) return;

    const t = now();
    if(!lastTick) lastTick = t;
    const dt = Math.min(0.05, (t - lastTick) / 1000);
    lastTick = t;

    state.tNow = t;

    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;
    setTimeLeft(state.timeLeftSec);

    updateModeThresholds();
    updateLowTimeFx();
    tickBoss(dt);

    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();

      if(state.rageOn && rng() < 0.18) spawnOne();
      if(state.stormOn && state.timeLeftSec <= 8 && rng() < 0.14) spawnOne();
    }

    expireTargets();

    if(state.timeLeftSec <= 0){
      endGame('timeup');
      return;
    }

    requestAnimationFrame(tick);
  }

  // ---------------- init/start ----------------
  function initHud(){
    setScore(0);
    setMiss(0);
    setTimeLeft(durationPlannedSec);
    setGradeText('—');
    addFever(0);
    renderShield();

    emit('hha:coach', {
      msg: 'โหมดโหด: ⚡เหลือ 30s = STORM | MISS ≥4 = BOSS | MISS ≥5 = RAGE (ระวัง 💣/💀)',
      kind: 'tip'
    });

    emitQuestUpdate();
  }

  function start(){
    if(state.started) return;
    state.started = true;

    state.tStart = now();
    state.startTimeIso = new Date().toISOString();

    initHud();

    emit('hha:start', {
      projectTag: PROJECT_TAG,
      category: CATEGORY,
      runMode,
      studyId,
      phase,
      conditionGroup,
      view,
      device: deviceLabel(view),
      diff,
      seed,
      gameVersion: GAME_VERSION,
      durationPlannedSec,
      startTimeIso: state.startTimeIso
    });

    requestAnimationFrame(tick);
  }

  start();

  // debug exposure
  ROOT.__GJ_STATE__ = state;
}