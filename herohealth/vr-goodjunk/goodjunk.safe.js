// === /webxr-health-mobile/herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (SOLO EXTREME + deterministic + AI hooks + HUD-safe spawns)
// FULL v20260301-SAFE-EXTREME-AIWIRED
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------------- helpers ----------------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso= ()=> new Date().toISOString();
  function emit(name, detail){ try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(e){} }
  function $(id){ return DOC.getElementById(id); }
  function setText(id, v){ const el=$(id); if(el) el.textContent=String(v); }

  // deterministic RNG (mulberry32)
  function hashSeed(s){
    s = String(s ?? '');
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const RUN = String(cfg.run || qs('run','play') || 'play').toLowerCase();
  const deterministic = (RUN === 'research' || RUN === 'practice'); // research/practice deterministic by seed
  const seedStr = String(cfg.seed ?? qs('seed', String(Date.now())));
  const rngBase = mulberry32(hashSeed(seedStr));

  function rand(){ return rngBase(); }
  function rint(a,b){ return Math.floor(a + rand()*(b-a+1)); }
  function choice(arr){ return arr[Math.floor(rand()*arr.length)] }

  // ---------------- elements ----------------
  const elHud = $('hud');
  const elStage = $('stage');
  const elLayer = $('gj-layer');

  const uiScore = $('hud-score');
  const uiTime  = $('hud-time');
  const uiMiss  = $('hud-miss');
  const uiGrade = $('hud-grade');

  const uiGoalCur = $('hud-goal-cur');
  const uiGoalTarget = $('hud-goal-target');
  const uiGoalDesc = $('goalDesc');
  const uiMini = $('hud-mini');
  const uiMiniTimer = $('miniTimer');

  const uiFeverText = $('feverText');
  const uiFeverFill = $('feverFill');
  const uiShieldPills = $('shieldPills');

  const bossBar = $('bossBar');
  const uiBossFill = $('bossFill');
  const uiBossHint = $('bossHint');

  const uiRisk = $('aiRisk');
  const uiHint = $('aiHint');

  const lowTimeOverlay = $('lowTimeOverlay');
  const lowTimeNum = $('gj-lowtime-num');

  const endOverlay = $('endOverlay');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endGrade = $('endGrade');
  const endScore = $('endScore');
  const endMiss = $('endMiss');
  const endTime = $('endTime');

  const progressFill = $('gjProgressFill');

  // ---------------- HUD-safe layout (compute --hudH) ----------------
  function updateHudHeightVar(){
    try{
      const h = elHud ? Math.ceil(elHud.getBoundingClientRect().height) : 160;
      DOC.documentElement.style.setProperty('--hudH', `${Math.max(120, Math.min(240, h))}px`);
    }catch(e){}
  }
  updateHudHeightVar();
  WIN.addEventListener('resize', ()=>{ updateHudHeightVar(); });

  // ---------------- config ----------------
  const VIEW = String(cfg.view || qs('view','mobile')).toLowerCase();
  const DIFF = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const TIME_LIMIT = clamp(cfg.time ?? qs('time','80'), 30, 300);

  // difficulty baseline
  const DIFF_K = (DIFF==='easy') ? 0.85 : (DIFF==='hard') ? 1.25 : 1.0;

  // ---------------- core state ----------------
  const S = {
    tStartMs: nowMs(),
    tLeft: TIME_LIMIT,
    running: true,
    ended: false,
    reason: '',

    score: 0,
    shots: 0,
    hits: 0,
    miss: 0,          // miss definition = good expired + junk hit (in this game we implement the combined policy)
    junkHit: 0,
    goodExpired: 0,
    combo: 0,
    comboMax: 0,

    // timing stats (good hits only)
    goodRtArr: [],

    // fever
    fever: 0,          // 0..100
    feverOn: false,

    // shield pills
    shield: 0,         // 0..3

    // stage progression
    stage: 1,          // 1=build,2=storm,3=boss
    stageProgress: 0,  // 0..1
    bossHp: 0,
    bossHpMax: 0,

    // spawn control
    spawnMs: 900,      // dynamic
    targetLifeMs: 1550,// dynamic
    maxOnScreen: 5,    // dynamic

    // adaptive difficulty director (play only)
    dda: {
      lastTuneMs: 0,
      intensity: 0.0, // 0..1
    },

    // ai (optional)
    ai: cfg.ai || null,
    aiRisk: null,
    aiHint: null
  };

  // ---------------- stage design (เร้าใจสุด ๆ) ----------------
  // We keep deterministic in research/practice: only uses seeded RNG + fixed rules
  function tuneParams(){
    // base intensity from diff + stage + fever
    const feverBoost = S.feverOn ? 0.18 : 0.0;
    const stageBoost = (S.stage===1)?0.0:(S.stage===2)?0.18:0.28;

    // “fair” adaptive only in play
    let dda = 0;
    if(!deterministic){
      dda = clamp(S.dda.intensity, 0, 1);
    }

    const k = clamp((0.30*DIFF_K) + stageBoost + feverBoost + 0.38*dda, 0.15, 1.35);

    // spawn faster, more targets, shorter life
    S.spawnMs = clamp(980 - 520*k, 320, 980);
    S.targetLifeMs = clamp(1700 - 820*k, 520, 1750);
    S.maxOnScreen = clamp(Math.round(4 + 3.4*k), 4, 9);

    // boss HP scales
    if(S.stage===3){
      if(S.bossHpMax<=0){
        S.bossHpMax = Math.round(18 + 10*k);
        S.bossHp = S.bossHpMax;
      }
    }
  }

  // ---------------- UI update ----------------
  function accPct(){
    const denom = S.hits + S.miss;
    return denom>0 ? Math.round((S.hits*1000)/denom)/10 : 0;
  }
  function medianRtGoodMs(){
    const a = S.goodRtArr.slice().sort((x,y)=>x-y);
    if(!a.length) return 0;
    const m = Math.floor(a.length/2);
    return (a.length%2) ? a[m] : Math.round((a[m-1]+a[m])/2);
  }
  function gradeFrom(){
    // score + acc + miss + rt
    const a = accPct();
    const m = S.miss;
    const rt = medianRtGoodMs();

    let g = 'C';
    if(S.score>=900 && a>=90 && m<=4) g='S';
    else if(S.score>=700 && a>=85 && m<=7) g='A';
    else if(S.score>=520 && a>=75 && m<=10) g='B';
    else if(S.score>=350) g='C';
    else g='D';

    // slow RT penalize slightly for higher grades
    if((g==='S' || g==='A') && rt>1100) g = (g==='S')?'A':'B';
    return g;
  }

  function setFeverUI(){
    const v = clamp(S.fever,0,100);
    if(uiFeverText) uiFeverText.textContent = `${Math.round(v)}%`;
    if(uiFeverFill) uiFeverFill.style.width = `${Math.round(v)}%`;
  }
  function setBossUI(){
    if(!bossBar) return;
    if(S.stage===3){
      bossBar.setAttribute('aria-hidden','false');
      const pct = S.bossHpMax>0 ? clamp((S.bossHp/S.bossHpMax)*100,0,100) : 0;
      if(uiBossFill) uiBossFill.style.width = `${pct}%`;
      if(uiBossHint) uiBossHint.textContent = `HP ${S.bossHp}/${S.bossHpMax}`;
    }else{
      bossBar.setAttribute('aria-hidden','true');
    }
  }
  function setShieldUI(){
    if(!uiShieldPills) return;
    uiShieldPills.textContent = S.shield>0 ? '🛡️'.repeat(S.shield) : '—';
  }

  function setProgressUI(){
    if(!progressFill) return;
    progressFill.style.width = `${Math.round(clamp(S.stageProgress,0,1)*100)}%`;
  }

  function setMiniUI(label, t){
    if(uiMini) uiMini.textContent = label || '—';
    if(uiMiniTimer) uiMiniTimer.textContent = (t==null) ? '—' : String(t);
  }

  function updateHUD(){
    if(uiScore) uiScore.textContent = String(S.score|0);
    if(uiTime)  uiTime.textContent  = String(Math.max(0, Math.ceil(S.tLeft)));
    if(uiMiss)  uiMiss.textContent  = String(S.miss|0);
    if(uiGrade) uiGrade.textContent = gradeFrom();

    setFeverUI();
    setShieldUI();
    setBossUI();
    setProgressUI();

    // AI HUD
    if(uiRisk) uiRisk.textContent = (S.aiRisk==null) ? '—' : String(S.aiRisk);
    if(uiHint) uiHint.textContent = (S.aiHint==null) ? '—' : String(S.aiHint);

    // low time overlay
    if(lowTimeOverlay && lowTimeNum){
      const t = Math.ceil(S.tLeft);
      if(t<=5 && t>0){
        lowTimeOverlay.setAttribute('aria-hidden','false');
        lowTimeNum.textContent = String(t);
      }else{
        lowTimeOverlay.setAttribute('aria-hidden','true');
      }
    }
  }

  // ---------------- AI feature emitter ----------------
  function emitAiFeature(extra={}){
    const feat = {
      ts: nowIso(),
      seed: seedStr,
      run: RUN,
      diff: DIFF,
      stage: S.stage,
      tLeft: Math.max(0, S.tLeft),
      score: S.score,
      combo: S.combo,
      comboMax: S.comboMax,
      miss: S.miss,
      accPct: accPct(),
      medianRtGoodMs: medianRtGoodMs(),
      fever: Math.round(S.fever),
      feverOn: S.feverOn ? 1 : 0,
      shield: S.shield,
      onScreen: elLayer ? elLayer.children.length : 0,
      spawnMs: Math.round(S.spawnMs),
      lifeMs: Math.round(S.targetLifeMs),
      ...extra
    };
    emit('hha:ai-feature', feat);
    return feat;
  }

  // ---------------- AI decide (prediction) ----------------
  function runAiPredict(){
    if(!S.ai || typeof S.ai.predict !== 'function') return;

    const feat = emitAiFeature();
    try{
      const out = S.ai.predict(feat);
      // normalize to {riskLabel, hint}
      S.aiRisk = out?.riskLabel ?? out?.risk ?? '—';
      S.aiHint = out?.hint ?? '—';
    }catch(e){}
  }

  // ---------------- target spawner ----------------
  const EMOJI_GOOD = ['🥦','🍎','🥕','🥛','🍌','🍇','🍞','🐟'];
  const EMOJI_JUNK = ['🍟','🍭','🍩','🥤','🍔','🍫','🧁','🍿'];
  const EMOJI_STAR = ['⭐','✨'];
  const EMOJI_SHIELD = ['🛡️'];

  function stageWeights(){
    // more intense by stage
    // return probability weights for good/junk/star/shield
    if(S.stage===1) return { good:0.62, junk:0.34, star:0.03, shield:0.01 };
    if(S.stage===2) return { good:0.56, junk:0.40, star:0.03, shield:0.01 };
    // boss phase: more junk pressure + shield chance
    return { good:0.52, junk:0.44, star:0.02, shield:0.02 };
  }

  function pickType(){
    const w = stageWeights();
    const r = rand();
    const a = w.good;
    const b = a + w.junk;
    const c = b + w.star;
    if(r < a) return 'good';
    if(r < b) return 'junk';
    if(r < c) return 'star';
    return 'shield';
  }

  function stageSafeBounds(){
    const rect = elStage.getBoundingClientRect();
    // keep within stage with padding; never under HUD because stage already below HUD
    const pad = (VIEW==='mobile') ? 22 : 26;
    return {
      left: pad,
      top: pad,
      right: Math.max(pad, rect.width - pad),
      bottom: Math.max(pad, rect.height - pad),
    };
  }

  function spawnTarget(){
    if(!S.running || S.ended) return;
    if(!elLayer) return;

    if(elLayer.children.length >= S.maxOnScreen) return;

    const t = pickType();
    const el = DOC.createElement('div');
    el.className = `gj-target ${t}`;

    const bounds = stageSafeBounds();
    const x = rint(bounds.left, bounds.right);
    const y = rint(bounds.top, bounds.bottom);

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    const bornMs = nowMs();
    const lifeMs = S.targetLifeMs;

    // emoji
    if(t==='good') el.textContent = choice(EMOJI_GOOD);
    if(t==='junk') el.textContent = choice(EMOJI_JUNK);
    if(t==='star') el.textContent = choice(EMOJI_STAR);
    if(t==='shield') el.textContent = choice(EMOJI_SHIELD);

    // click/tap
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      onHit(el, t, bornMs);
    }, { passive:false });

    elLayer.appendChild(el);

    // expire
    setTimeout(()=>{
      if(!el.isConnected) return;
      // if good expires -> miss++
      if(t==='good'){
        S.goodExpired += 1;
        S.miss += 1; // miss policy
        S.combo = 0;
      }
      // remove
      el.classList.add('dead');
      setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 120);
      pulseScore();
    }, lifeMs);
  }

  function onHit(el, type, bornMs){
    if(!S.running || S.ended) return;

    // remove fast
    try{ el.classList.add('pop'); }catch(e){}
    setTimeout(()=>{ try{ el.classList.add('dead'); }catch(e){} }, 40);
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 120);

    S.shots += 1;

    const rt = Math.max(0, Math.round(nowMs() - bornMs));

    if(type==='good'){
      S.hits += 1;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);

      // score: base + combo + fever
      const base = 20;
      const comboB = Math.min(25, Math.floor(S.combo/3)*3);
      const feverB = S.feverOn ? 12 : 0;
      S.score += (base + comboB + feverB);

      // record rt
      S.goodRtArr.push(rt);

      // fever gain
      S.fever += 6 + Math.min(6, Math.floor(S.combo/6)*2);
      if(S.fever >= 100){
        S.fever = 100;
        S.feverOn = true;
      }

      // stage progress
      addProgress(0.018);

    }else if(type==='junk'){
      // shield can block junk miss
      if(S.shield > 0){
        S.shield -= 1;
        // blocked: do NOT count as miss (per your standard)
      }else{
        S.junkHit += 1;
        S.miss += 1;
        S.combo = 0;
        S.score = Math.max(0, S.score - 35);

        // fever penalty
        S.fever = Math.max(0, S.fever - 18);
        if(S.fever < 100) S.feverOn = false;
      }

      // stage progress slight negative when junk hit (if unblocked)
      addProgress(-0.010);

    }else if(type==='star'){
      // star = burst
      S.score += 120;
      S.combo += 2;
      S.comboMax = Math.max(S.comboMax, S.comboMax);
      S.fever = Math.min(100, S.fever + 22);
      if(S.fever >= 100) S.feverOn = true;

      // clear a bit (remove some junk if exists)
      try{
        const kids = Array.from(elLayer.children);
        let removed=0;
        for(const k of kids){
          if(removed>=2) break;
          if(k.classList.contains('junk')){
            k.classList.add('dead'); setTimeout(()=>{ try{k.remove();}catch(e){} }, 80);
            removed++;
          }
        }
      }catch(e){}

      addProgress(0.055);

    }else if(type==='shield'){
      S.shield = Math.min(3, S.shield + 1);
      S.score += 40;
      addProgress(0.025);
    }

    // boss damage
    if(S.stage===3 && type==='good'){
      S.bossHp = Math.max(0, S.bossHp - 1);
      if(S.bossHp <= 0){
        // boss defeated => big finish
        S.score += 250;
        endGame('boss_clear');
        return;
      }
    }

    // fever decay tick (small) to avoid permanent fever
    if(S.feverOn){
      S.fever = Math.max(55, S.fever - 1.6);
      if(S.fever < 100) S.feverOn = false;
    }

    pulseScore();
  }

  function addProgress(dx){
    S.stageProgress = clamp(S.stageProgress + dx, 0, 1);
    if(S.stage===1 && S.stageProgress >= 1){
      // go storm
      S.stage = 2;
      S.stageProgress = 0;
      setMiniUI('STORM', 10);
      stormStart();
      tuneParams();
    }else if(S.stage===2 && S.stageProgress >= 1){
      // go boss
      S.stage = 3;
      S.stageProgress = 0;
      bossIntro();
      tuneParams();
    }
  }

  // storm: 10 seconds of chaos (more junk + faster)
  let stormTimer = 0;
  function stormStart(){
    let t = 10;
    clearInterval(stormTimer);
    stormTimer = setInterval(()=>{
      if(!S.running || S.ended){ clearInterval(stormTimer); return; }
      t -= 1;
      setMiniUI('STORM', t);
      // temporary boost
      S.dda.intensity = Math.min(1, S.dda.intensity + 0.04);
      if(t<=0){
        clearInterval(stormTimer);
        setMiniUI('—', null);
        // reward shield after storm
        S.shield = Math.min(3, S.shield + 1);
      }
    }, 1000);
  }

  function bossIntro(){
    // boss appears: set hp
    S.bossHpMax = 0; S.bossHp = 0;
    tuneParams();
    setMiniUI('BOSS', null);
  }

  // ---------------- DDA (play only, fair) ----------------
  function updateDDA(){
    if(deterministic) return;
    const t = nowMs();
    if(t - S.dda.lastTuneMs < 1800) return;
    S.dda.lastTuneMs = t;

    // simple signals: high miss -> lower intensity, high combo+acc -> raise
    const a = accPct();
    const missRate = (S.hits + S.miss) ? (S.miss/(S.hits+S.miss)) : 0;
    const comboSignal = clamp(S.combo/18, 0, 1);

    let target = 0.0;
    target += (a>=88 ? 0.45 : a>=80 ? 0.28 : a>=70 ? 0.12 : 0.0);
    target += comboSignal*0.35;
    target -= clamp(missRate*1.15, 0, 0.6);

    // smooth
    const cur = S.dda.intensity;
    S.dda.intensity = clamp(cur*0.72 + target*0.28, 0, 1);
  }

  // ---------------- score pulse event ----------------
  let lastPulseMs = 0;
  function pulseScore(){
    updateHUD();
    const t = nowMs();
    if(t - lastPulseMs < 420) return;
    lastPulseMs = t;

    // AI predict periodically
    runAiPredict();

    emit('hha:score', {
      score: S.score|0,
      shots: S.shots|0,
      hits: S.hits|0,
      miss: S.miss|0,
      combo: S.combo|0,
      comboMax: S.comboMax|0,
      accPct: accPct(),
      medianRtGoodMs: medianRtGoodMs(),
      stage: S.stage,
      feverPct: Math.round(S.fever),
    });
  }

  // ---------------- main loop ----------------
  let spawnAcc = 0;
  function tick(){
    if(!S.running || S.ended) return;

    // time
    const tNow = nowMs();
    const dt = 0.016; // approx
    S.tLeft = Math.max(0, S.tLeft - dt);

    // fever passive decay
    if(S.feverOn){
      S.fever = Math.max(40, S.fever - 0.07);
      if(S.fever < 100) S.feverOn = false;
    }else{
      S.fever = Math.max(0, S.fever - 0.035);
    }

    // DDA + tune
    updateDDA();
    tuneParams();

    // spawn
    spawnAcc += 16; // ms-like
    while(spawnAcc >= S.spawnMs){
      spawnAcc -= S.spawnMs;
      spawnTarget();
      // extra spawn chance when fever or stage 3
      const extra = (S.feverOn ? 0.28 : 0.0) + (S.stage===3 ? 0.18 : 0.0);
      if(rand() < extra) spawnTarget();
    }

    // end by time
    if(S.tLeft <= 0){
      endGame('time');
      return;
    }

    // pulse hud
    if((Math.ceil(S.tLeft) % 1) === 0){
      updateHUD();
    }

    WIN.requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended = true;
    S.running = false;
    S.reason = String(reason||'end');

    try{ clearInterval(stormTimer); }catch(e){}

    // summary
    const summary = {
      timestampIso: nowIso(),
      reason: S.reason,
      run: RUN,
      view: VIEW,
      diff: DIFF,
      seed: seedStr,

      durationPlayedSec: TIME_LIMIT,
      scoreFinal: S.score|0,
      shots: S.shots|0,
      hits: S.hits|0,
      missTotal: S.miss|0,
      comboMax: S.comboMax|0,
      accPct: accPct(),
      medianRtGoodMs: medianRtGoodMs(),

      stageReached: S.stage,
      feverEnd: Math.round(S.fever),
      shieldEnd: S.shield|0,

      miss_breakdown: {
        goodExpired: S.goodExpired|0,
        junkHit: S.junkHit|0
      }
    };

    // emit end
    emit('hha:game-ended', summary);

    // UI
    if(endOverlay){
      endOverlay.setAttribute('aria-hidden','false');
      if(endTitle) endTitle.textContent = (reason==='boss_clear') ? 'BOSS CLEAR! 🏆' : 'Game Over';
      if(endSub) endSub.textContent = `reason=${summary.reason} | mode=${RUN} | view=${VIEW} | acc=${summary.accPct}% | medRT=${summary.medianRtGoodMs}ms`;
      if(endGrade) endGrade.textContent = gradeFrom();
      if(endScore) endScore.textContent = String(summary.scoreFinal);
      if(endMiss)  endMiss.textContent  = String(summary.missTotal);
      if(endTime)  endTime.textContent  = String(TIME_LIMIT);
    }

    // final pulse
    pulseScore();
  }

  // ---------------- goals ----------------
  // Daily goal shown only; you can swap to "daily-first cooldown" logic outside (hub gate)
  const GOAL_TARGET = 50;
  if(uiGoalTarget) uiGoalTarget.textContent = String(GOAL_TARGET);
  if(uiGoalDesc) uiGoalDesc.textContent = `Hit GOOD ${GOAL_TARGET}`;
  function updateGoalUI(){
    if(!uiGoalCur) return;
    uiGoalCur.textContent = String(S.hits|0);
  }

  // ---------------- start ----------------
  updateHUD();
  updateGoalUI();
  tuneParams();
  WIN.requestAnimationFrame(tick);

  // keep goal updated on score pulse
  WIN.addEventListener('hha:score', ()=>{ updateGoalUI(); }, { passive:true });

  // expose debug
  WIN.__GJ__ = { cfg, S };

  return true;
}