// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (HHA Standard + BOSS A+B+C)
// ✅ Storm: timeLeft<=30s
// ✅ Boss: miss>=4
// ✅ Rage: miss>=5
// ✅ Boss HP: easy/normal/hard = 10/12/14
// ✅ Phase length: deterministic 2–6s
// ✅ Skills: Decoy / Swap / StormWall
// ✅ Counter items: ⭐ slow pressure, 💎 stun boss+bonus, 🛡️ block junk

'use strict';

export function boot(payload = {}) {
  const ROOT = window;
  const DOC  = document;

  // ----------------------- helpers -----------------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const byId = (id)=> DOC.getElementById(id);

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function addBody(c){ try{ DOC.body.classList.add(c); }catch(_){ } }
  function rmBody(c){ try{ DOC.body.classList.remove(c); }catch(_){ } }
  function pulseBody(c,ms=220){ try{ DOC.body.classList.add(c); setTimeout(()=>DOC.body.classList.remove(c), ms); }catch(_){ } }

  // rng (deterministic for research)
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

  // particles (optional)
  function P(){ return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null; }
  function fxPop(x,y,text,cls){ try{ P()?.popText?.(x,y,text,cls); }catch(_){ } }
  function fxBurst(x,y,r){ try{ P()?.burst?.(x,y,{r}); }catch(_){ } }
  function fxShock(x,y,r){ try{ P()?.shockwave?.(x,y,{r}); }catch(_){ fxBurst(x,y,r); } }

  // ----------------------- config -----------------------
  const view = String(payload.view || qs('view','mobile') || 'mobile').toLowerCase();
  const diff = String(payload.diff || qs('diff','normal') || 'normal').toLowerCase();
  const runMode = String(payload.run || qs('run','play') || 'play').toLowerCase(); // play | research
  const durationPlannedSec = clamp(Number(payload.time ?? qs('time','80') ?? 80) || 80, 20, 300);
  const hub = payload.hub ?? qs('hub', null);
  const seedParam = (payload.seed ?? qs('seed', null));
  const seed = (runMode === 'research')
    ? (seedParam ?? (qs('ts', null) ?? 'RESEARCH-SEED'))
    : (seedParam ?? String(Date.now()));

  const GAME_VERSION = 'GoodJunkVR_SAFE_2026-01-10a_BOSSABC';
  const PROJECT_TAG = 'GoodJunkVR';

  const rng = makeSeededRng(String(seed));
  const isVR  = (view === 'vr');
  const isCVR = (view === 'cvr');

  // difficulty tuning (base)
  const DIFF = (() => {
    if(diff==='easy') return {
      spawnPerSec: 1.05,
      junkRate: 0.22,
      starRate: 0.08,
      shieldRate: 0.06,
      goodLifeMs: 2100,
      junkPenaltyMiss: 1,
      goodScore: 12,
      junkPenaltyScore: -10,
      missLimit: 12,
      bossHp: 10,
    };
    if(diff==='hard') return {
      spawnPerSec: 1.55,
      junkRate: 0.32,
      starRate: 0.06,
      shieldRate: 0.045,
      goodLifeMs: 1500,
      junkPenaltyMiss: 1,
      goodScore: 14,
      junkPenaltyScore: -14,
      missLimit: 9,
      bossHp: 14,
    };
    return { // normal
      spawnPerSec: 1.25,
      junkRate: 0.27,
      starRate: 0.07,
      shieldRate: 0.055,
      goodLifeMs: 1800,
      junkPenaltyMiss: 1,
      goodScore: 13,
      junkPenaltyScore: -12,
      missLimit: 10,
      bossHp: 12,
    };
  })();

  const adaptiveOn = (runMode !== 'research');

  // ----------------------- UI refs -----------------------
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

    // boss UI (optional if you added elements)
    bossBar: byId('gjBossBar'),
    bossTitle: byId('gjBossTitle'),
    bossPhase: byId('gjBossPhase'),
    bossHp: byId('gjBossHp'),
    bossFill: byId('gjBossFill'),
  };

  const LAYER_L = byId('gj-layer');
  const LAYER_R = byId('gj-layer-r');
  if(!LAYER_L){
    console.error('[GoodJunkVR] missing #gj-layer');
    return;
  }

  // ----------------------- state -----------------------
  const state = {
    started:false,
    ended:false,
    timeLeftSec: durationPlannedSec,
    score:0,
    combo:0,
    comboMax:0,
    miss:0,

    nTargetGoodSpawned:0,
    nTargetJunkSpawned:0,
    nTargetStarSpawned:0,
    nTargetShieldSpawned:0,
    nTargetDiamondSpawned:0,

    nHitGood:0,
    nHitJunk:0,
    nHitJunkGuard:0,
    nExpireGood:0,

    rtGood:[],
    rtBreakdown:{ lt300:0, lt450:0, lt700:0, ge700:0 },

    fever:0,
    shield:0,

    goal:null,
    goals:[],
    goalsCleared:0,
    goalsTotal:3,

    mini:null,
    miniCleared:0,
    miniTotal:3,
    miniSeq:[],
    miniIndex:0,

    spawnAcc:0,
    targets:new Map(),

    startTimeIso:new Date().toISOString(),
    endTimeIso:null,
  };

  // ----------------------- FAST MINI (เดิม) -----------------------
  function fastCfgByView(view){
    if(view==='pc')  return { thrMs: 440, target: 2, timeLimitSec: 10 };
    if(view==='cvr') return { thrMs: 460, target: 2, timeLimitSec: 10 };
    if(view==='vr')  return { thrMs: 480, target: 2, timeLimitSec: 10 };
    return { thrMs: 470, target: 2, timeLimitSec: 10 };
  }
  function pickMiniSequence(view='mobile'){
    const fast = fastCfgByView(view);
    return [
      { type:'streak_good', title:'เก็บดีติดกัน', target:3, cur:0, done:false },
      { type:'avoid_junk',  title:'อย่าโดนขยะ', target:6, cur:0, done:false },
      { type:'fast_hits', title:'เก็บให้ไว', target: fast.target, cur:0, done:false,
        thrMs: fast.thrMs, timeLimitSec: fast.timeLimitSec, leftSec: fast.timeLimitSec }
    ];
  }
  function resetMini(m){
    m.cur = 0; m.done = false;
    if(m.type==='fast_hits') m.leftSec = Number(m.timeLimitSec)||10;
  }

  // ----------------------- goals (เดิม) -----------------------
  function makeGoals(){
    return [
      { type:'survive', title:'เอาตัวรอด', target: DIFF.missLimit, cur:0, done:false,
        desc:`MISS ต้องไม่เกิน ${DIFF.missLimit}` },
      { type:'score', title:'ทำคะแนน', target: (diff==='easy'? 420 : diff==='hard'? 520 : 470), cur:0, done:false,
        desc:`เก็บของดีเพื่อทำคะแนน` },
      { type:'minis', title:'ทำ MINI', target: 2, cur:0, done:false,
        desc:`ผ่าน MINI ให้ได้ 2 ครั้ง` }
    ];
  }

  function setGoalText(){
    const g = state.goal;
    if(!g) return;
    HUD.goal && (HUD.goal.textContent = g.title || '—');
    HUD.goalTarget && (HUD.goalTarget.textContent = String(g.target ?? 0));
    HUD.goalCur && (HUD.goalCur.textContent = String(g.cur ?? 0));
    HUD.goalDesc && (HUD.goalDesc.textContent = g.desc || '—');
  }

  function setMiniText(){
    const m = state.mini;
    if(!m){
      HUD.mini && (HUD.mini.textContent = '—');
      HUD.miniTimer && (HUD.miniTimer.textContent = '—');
      emit('quest:update', { mini:null, goal:state.goal });
      return;
    }
    if(HUD.mini){
      if(m.type==='fast_hits'){
        HUD.mini.textContent = `${m.title}: ${m.cur}/${m.target} (เร็วกว่า ${m.thrMs}ms)`;
      }else if(m.type==='avoid_junk'){
        HUD.mini.textContent = `${m.title}: อยู่ให้ครบ ${m.target}s (ห้ามโดนขยะ)`;
      }else{
        HUD.mini.textContent = `${m.title}: ${m.cur}/${m.target}`;
      }
    }
    if(HUD.miniTimer){
      HUD.miniTimer.textContent = (m.type==='fast_hits') ? `${Math.ceil(m.leftSec||0)}s` : '—';
    }
    emit('quest:update', { mini:m, goal:state.goal });
  }

  function nextMini(){
    state.miniIndex = (state.miniIndex + 1) % state.miniSeq.length;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);
    setMiniText();
  }

  function markMiniCleared(){
    state.miniCleared++;
    if(state.goal && state.goal.type==='minis'){
      state.goal.cur = clamp(state.miniCleared, 0, state.goal.target);
      if(state.goal.cur >= state.goal.target && !state.goal.done){
        state.goal.done = true; state.goalsCleared++;
        emit('hha:judge', { type:'good', label:'GOAL!' });
      }
      setGoalText();
    }
    emit('hha:judge', { type:'perfect', label:'MINI CLEAR!' });
    emit('hha:celebrate', { kind:'mini' });
    nextMini();
  }

  function tickMini(dt){
    const m = state.mini;
    if(!m || m.done) return;

    if(m.type==='avoid_junk'){
      m.cur += dt;
      if(m.cur >= m.target){
        m.cur = m.target; m.done = true;
        markMiniCleared();
      }else{
        if((Math.floor(m.cur*3) % 2)===0) setMiniText();
      }
      return;
    }
    if(m.type==='fast_hits'){
      m.leftSec = Math.max(0, (Number(m.leftSec)||0) - dt);
      HUD.miniTimer && (HUD.miniTimer.textContent = `${Math.ceil(m.leftSec)}s`);
      if(m.leftSec <= 0 && !m.done){
        resetMini(m);
        setMiniText();
      }
      return;
    }
  }

  // ----------------------- HUD / fever / shield -----------------------
  function setScore(v){
    state.score = Math.max(0, Math.floor(v));
    HUD.score && (HUD.score.textContent = String(state.score));
    emit('hha:score', { score: state.score });
  }
  function setMiss(v){
    state.miss = Math.max(0, Math.floor(v));
    HUD.miss && (HUD.miss.textContent = String(state.miss));
  }
  function setTimeLeft(sec){
    state.timeLeftSec = Math.max(0, sec);
    HUD.time && (HUD.time.textContent = String(Math.ceil(state.timeLeftSec)));
    emit('hha:time', { t: state.timeLeftSec });
  }
  function setGradeText(txt){ HUD.grade && (HUD.grade.textContent = txt); }
  function addFever(delta){
    state.fever = clamp(state.fever + (Number(delta)||0), 0, 100);
    HUD.feverFill && (HUD.feverFill.style.width = `${state.fever}%`);
    HUD.feverText && (HUD.feverText.textContent = `${Math.round(state.fever)}%`);
  }
  function renderShield(){
    if(!HUD.shieldPills) return;
    HUD.shieldPills.textContent = state.shield ? Array.from({length:state.shield}).map(()=> '🛡️').join(' ') : '—';
  }
  function addShield(n){ state.shield = clamp(state.shield + (Number(n)||0), 0, 5); renderShield(); }
  function useShield(){ if(state.shield>0){ state.shield--; renderShield(); return true; } return false; }

  function updateLowTimeFx(){
    const t = state.timeLeftSec;
    DOC.body.classList.remove('gj-lowtime','gj-lowtime5','gj-tick');
    if(t <= 10){
      DOC.body.classList.add('gj-lowtime');
      if(t <= 5) DOC.body.classList.add('gj-lowtime5');
      if(HUD.lowTimeOverlay) HUD.lowTimeOverlay.setAttribute('aria-hidden', (t<=5) ? 'false' : 'true');
      if(HUD.lowTimeNum && t<=5){
        HUD.lowTimeNum.textContent = String(Math.ceil(t));
        DOC.body.classList.add('gj-tick');
        setTimeout(()=>DOC.body.classList.remove('gj-tick'), 120);
      }
    }else{
      if(HUD.lowTimeOverlay) HUD.lowTimeOverlay.setAttribute('aria-hidden','true');
    }
  }

  // ----------------------- safe spawn rect -----------------------
  function readRootPxVar(name, fallbackPx){
    try{
      const cs = getComputedStyle(DOC.documentElement);
      const v = String(cs.getPropertyValue(name) || '').trim().replace('px','');
      const n = Number(v);
      return Number.isFinite(n) ? n : fallbackPx;
    }catch(_){ return fallbackPx; }
  }
  function getSafeRect(){
    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;
    const sat = readRootPxVar('--sat', 0);
    const topSafe = readRootPxVar('--gj-top-safe', 130 + sat);
    const botSafe = readRootPxVar('--gj-bottom-safe', 120);
    const xMin = Math.floor(W * 0.12);
    const xMax = Math.floor(W * 0.88);
    const yMin = Math.floor(topSafe);
    const yMax = Math.floor(Math.max(yMin + 120, H - botSafe));
    return { W,H, xMin,xMax, yMin,yMax };
  }

  // ----------------------- targets -----------------------
  let targetSeq = 0;
  const EMOJI = {
    good: ['🥦','🍎','🥕','🍌','🍇','🥬','🍊','🍉'],
    junk: ['🍟','🍔','🍭','🍩','🧁','🥤','🍪','🍫'],
    star: ['⭐'],
    shield: ['🛡️'],
    diamond: ['💎'],
  };

  // ----------------------- BOSS / STORM DIRECTOR (A+B+C) -----------------------
  const BOSS = {
    active:false,
    rage:false,
    storm:false,

    hpMax: DIFF.bossHp,
    hp: DIFF.bossHp,

    phase: '—',
    phaseLeft: 0,
    phaseDur: 0,

    // for skill effects
    swapEvery: 0,
    swapAcc: 0,
    stormWallAcc: 0,

    // counters
    stunLeft: 0,
  };

  function bossUIEnsure(){
    // allow CSS-only if element exists; otherwise auto-create minimal
    if(HUD.bossBar && HUD.bossFill && HUD.bossHp && HUD.bossPhase) return;

    const veil = DOC.querySelector('.gj-stormveil') || (()=>{
      const v = DOC.createElement('div');
      v.className = 'gj-stormveil';
      v.setAttribute('aria-hidden','true');
      DOC.body.appendChild(v);
      return v;
    })();

    let bar = DOC.getElementById('gjBossBar');
    if(!bar){
      bar = DOC.createElement('div');
      bar.className = 'gj-bossbar';
      bar.id = 'gjBossBar';
      bar.setAttribute('aria-hidden','true');
      bar.innerHTML = `
        <div class="card">
          <div class="row">
            <div class="title" id="gjBossTitle">👿 BOSS</div>
            <div class="phase" id="gjBossPhase">Phase —</div>
            <div class="hp" id="gjBossHp">HP —</div>
          </div>
          <div class="bar"><div class="fill" id="gjBossFill"></div></div>
        </div>
      `;
      DOC.body.appendChild(bar);
    }

    HUD.bossBar = bar;
    HUD.bossTitle = byId('gjBossTitle');
    HUD.bossPhase = byId('gjBossPhase');
    HUD.bossHp = byId('gjBossHp');
    HUD.bossFill = byId('gjBossFill');
  }

  function bossUIUpdate(){
    bossUIEnsure();
    if(!HUD.bossBar) return;

    if(!BOSS.active){
      HUD.bossBar.setAttribute('aria-hidden','true');
      return;
    }
    HUD.bossBar.setAttribute('aria-hidden','false');

    const hp = clamp(BOSS.hp, 0, BOSS.hpMax);
    const pct = Math.round((hp / Math.max(1,BOSS.hpMax)) * 1000)/10;
    HUD.bossHp && (HUD.bossHp.textContent = `HP ${hp}/${BOSS.hpMax}`);
    HUD.bossPhase && (HUD.bossPhase.textContent = `${BOSS.phase} · ${Math.ceil(BOSS.phaseLeft||0)}s`);
    HUD.bossFill && (HUD.bossFill.style.width = `${pct}%`);
  }

  function phasePick(){
    // deterministic choose
    const roll = rng();
    if(roll < 0.34) return 'DECOY';
    if(roll < 0.67) return 'SWAP';
    return 'STORMWALL';
  }

  function phaseStart(p){
    BOSS.phase = p;
    // 2–6s deterministic
    BOSS.phaseDur = Math.round(randIn(rng, 2, 6) * 10) / 10;
    BOSS.phaseLeft = BOSS.phaseDur;

    // configure skill knobs
    if(p === 'SWAP'){
      BOSS.swapEvery = BOSS.rage ? 0.85 : 1.15; // seconds
      BOSS.swapAcc = 0;
    }
    if(p === 'STORMWALL'){
      BOSS.stormWallAcc = 0;
    }

    pulseBody('gj-phase-flash', 220);
    emit('hha:judge', { type:'perfect', label:`PHASE ${p}!` });
    bossUIUpdate();
  }

  function bossStart(){
    if(BOSS.active) return;
    BOSS.active = true;
    BOSS.hpMax = DIFF.bossHp;
    BOSS.hp = DIFF.bossHp;
    addBody('gj-boss');

    // first phase
    phaseStart(phasePick());

    // boss entrance FX
    fxShock(innerWidth/2, innerHeight*0.28, 92);
    fxPop(innerWidth/2, innerHeight*0.28, 'BOSS!', 'big');
    emit('hha:celebrate', { kind:'boss' });
  }

  function bossRageOn(){
    if(BOSS.rage) return;
    BOSS.rage = true;
    addBody('gj-rage');
    fxShock(innerWidth/2, innerHeight*0.3, 110);
    fxPop(innerWidth/2, innerHeight*0.3, 'RAGE!', 'bad');
    emit('hha:judge', { type:'bad', label:'RAGE!' });

    // make next phase more aggressive immediately
    phaseStart(phasePick());
  }

  function bossDamage(amount, x, y){
    if(!BOSS.active) return;
    if(BOSS.stunLeft > 0) amount = Math.ceil(amount * 1.3); // reward for stun window
    BOSS.hp = clamp(BOSS.hp - (Number(amount)||0), 0, BOSS.hpMax);
    bossUIUpdate();
    fxBurst(x,y, 48);

    if(BOSS.hp <= 0){
      // boss defeated => reward + celebrate + reduce pressure a bit
      fxShock(innerWidth/2, innerHeight*0.28, 120);
      fxPop(innerWidth/2, innerHeight*0.28, 'BOSS DOWN!', 'perfect');
      emit('hha:celebrate', { kind:'bossDown' });

      // reward: score + shield
      setScore(state.score + 80);
      addShield(1);
      addFever(-18);

      BOSS.active = false;
      rmBody('gj-boss');
      rmBody('gj-rage');
      BOSS.rage = false;
      bossUIUpdate();
    }
  }

  function bossHeal(amount){
    if(!BOSS.active) return;
    BOSS.hp = clamp(BOSS.hp + (Number(amount)||0), 0, BOSS.hpMax);
    bossUIUpdate();
  }

  function stormOn(){
    if(BOSS.storm) return;
    BOSS.storm = true;
    addBody('gj-storm');
    const veil = DOC.querySelector('.gj-stormveil');
    veil && veil.setAttribute('aria-hidden','false');
    fxPop(innerWidth/2, innerHeight*0.22, 'STORM!', 'big');
  }

  function stormOff(){
    if(!BOSS.storm) return;
    BOSS.storm = false;
    rmBody('gj-storm');
    const veil = DOC.querySelector('.gj-stormveil');
    veil && veil.setAttribute('aria-hidden','true');
  }

  function bossTick(dt){
    // triggers (per your rule)
    if(!BOSS.storm && state.timeLeftSec <= 30) stormOn();
    if(!BOSS.active && state.miss >= 4) bossStart();
    if(BOSS.active && !BOSS.rage && state.miss >= 5) bossRageOn();

    // storm stays until end (last 30 sec)
    // (ถ้าคุณอยากให้ storm เป็น burst แบบ 6s ค่อยบอก เดี๋ยวเปลี่ยนได้)
    if(BOSS.active){
      if(BOSS.stunLeft > 0) BOSS.stunLeft = Math.max(0, BOSS.stunLeft - dt);

      // phase timer
      BOSS.phaseLeft -= dt;
      if(BOSS.phaseLeft <= 0){
        phaseStart(phasePick());
      }

      // phase actions
      if(BOSS.phase === 'SWAP'){
        BOSS.swapAcc += dt;
        while(BOSS.swapAcc >= BOSS.swapEvery){
          BOSS.swapAcc -= BOSS.swapEvery;
          doSwapSkill();
        }
      } else if(BOSS.phase === 'STORMWALL'){
        BOSS.stormWallAcc += dt;
        if(BOSS.stormWallAcc >= (BOSS.rage ? 0.85 : 1.15)){
          BOSS.stormWallAcc = 0;
          doStormWallSkill();
        }
      } else if(BOSS.phase === 'DECOY'){
        // passive: handled by spawn weighting (see makeTargetKind)
      }

      bossUIUpdate();
    }
  }

  function doSwapSkill(){
    // choose a random alive target and flip kind between good<->junk (but not star/shield/diamond)
    const arr = [];
    for(const t of state.targets.values()){
      if(t.hit) continue;
      if(t.kind==='good' || t.kind==='junk') arr.push(t);
    }
    if(arr.length === 0) return;

    const t = arr[Math.floor(rng()*arr.length)];
    const was = t.kind;
    t.kind = (t.kind === 'good') ? 'junk' : 'good';

    // update emoji + hint flash
    try{
      t.elL && (t.elL.textContent = pickEmoji(t.kind));
      t.elR && (t.elR.textContent = pickEmoji(t.kind));
      fxShock(t.x, t.y, 48);
      fxPop(t.x, t.y, 'SWAP!', 'score');
      emit('hha:judge', { type:'bad', label:'SWAP!' });
    }catch(_){}

    // fairness: never chain swap the same target too fast
    t.bornAt = now(); // resets RT window slightly (fair)
    if(was !== t.kind){
      // small mark for visual debugging
      try{
        t.elL && (t.elL.dataset.decoy = '1');
        t.elR && (t.elR.dataset.decoy = '1');
        setTimeout(()=>{ try{ t.elL && (t.elL.dataset.decoy='0'); t.elR && (t.elR.dataset.decoy='0'); }catch(_){ } }, 550);
      }catch(_){}
    }
  }

  function doStormWallSkill(){
    // spawn a ring of targets around crosshair area (forces aim)
    const rect = getSafeRect();
    const cx = rect.W/2, cy = rect.H/2;
    const ringR = Math.min(rect.W, rect.H) * (BOSS.rage ? 0.22 : 0.18);

    const n = BOSS.rage ? 7 : 6;
    for(let i=0;i<n;i++){
      const a = (Math.PI*2) * (i/n) + randIn(rng,-0.08,0.08);
      const x = Math.floor(cx + Math.cos(a)*ringR);
      const y = Math.floor(cy + Math.sin(a)*ringR);
      spawnOneAt(x,y, (rng()<0.55 ? 'junk' : 'good'), true);
    }
    fxShock(cx, cy, 86);
    fxPop(cx, cy-40, 'WALL!', 'big');
  }

  // ----------------------- kind / emoji / spawn -----------------------
  function pickEmoji(kind){
    const arr = EMOJI[kind] || EMOJI.good;
    return arr[Math.floor(rng() * arr.length)];
  }

  function makeTargetKind(){
    // base weights
    let diamondW = (diff==='hard') ? 0.012 : 0.015;
    let starW = DIFF.starRate;
    let shieldW = DIFF.shieldRate;
    let junkW = DIFF.junkRate;
    let goodW = Math.max(0.01, 1 - (junkW + starW + shieldW + diamondW));

    // storm pressure: more junk, fewer goodies
    if(BOSS.storm){
      junkW *= 1.22;
      goodW *= 0.92;
    }

    // boss phase A: DECOY -> spawn more "good-looking junk"
    // (เราจะสร้าง kind เป็น junk แต่ติด decoy flag ตอน spawn)
    if(BOSS.active && BOSS.phase === 'DECOY'){
      junkW *= 1.18;
      goodW *= 0.90;
      // reward fairness: give slightly more shield in DECOY
      shieldW *= 1.10;
    }

    // rage: tighten window, still fair by more star/diamond a bit
    if(BOSS.rage){
      junkW *= 1.18;
      starW *= 1.10;
      diamondW *= 1.10;
    }

    return pickWeighted(rng, [
      {k:'good', w:goodW},
      {k:'junk', w:junkW},
      {k:'star', w:starW},
      {k:'shield', w:shieldW},
      {k:'diamond', w:diamondW},
    ]);
  }

  function spawnOneAt(x,y,forceKind=null, forceShortLife=false){
    if(state.ended) return;

    const kind = forceKind || makeTargetKind();

    if(kind==='good') state.nTargetGoodSpawned++;
    else if(kind==='junk') state.nTargetJunkSpawned++;
    else if(kind==='star') state.nTargetStarSpawned++;
    else if(kind==='shield') state.nTargetShieldSpawned++;
    else if(kind==='diamond') state.nTargetDiamondSpawned++;

    const id = `t${++targetSeq}`;

    let baseLife =
      (kind==='good') ? DIFF.goodLifeMs :
      (kind==='junk') ? Math.round(DIFF.goodLifeMs * 1.05) :
      (kind==='star') ? Math.round(DIFF.goodLifeMs * 1.15) :
      (kind==='shield') ? Math.round(DIFF.goodLifeMs * 1.15) :
      Math.round(DIFF.goodLifeMs * 1.25);

    // storm makes everything feel faster but fair
    if(BOSS.storm) baseLife *= 0.92;
    if(BOSS.rage)  baseLife *= 0.90;
    if(forceShortLife) baseLife *= 0.82;

    const lifeMs = clamp(Math.round(baseLife), 700, 2600);

    const baseSize = (kind==='good') ? 54 : (kind==='junk') ? 56 : 50;
    let size = clamp(baseSize + randIn(rng, -4, 10), 44, 72);
    if(BOSS.rage && (kind==='junk')) size = clamp(size + 2, 44, 76);

    const elL = DOC.createElement('div');
    elL.className = 'gj-target';
    elL.dataset.id = id;
    elL.dataset.kind = kind;

    // DECOY: junk disguised (skill A)
    const decoy = (BOSS.active && BOSS.phase === 'DECOY' && kind==='junk' && rng()<0.55);
    if(decoy){
      elL.dataset.decoy = '1';
      elL.textContent = pickEmoji('good'); // look like good
    }else{
      elL.dataset.decoy = '0';
      elL.textContent = pickEmoji(kind);
    }

    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.fontSize = `${size}px`;

    let elR = null;
    if(LAYER_R){
      elR = elL.cloneNode(true);
      elR.dataset.eye = 'r';
    }

    const bornAt = now();
    const tObj = { id, kind, bornAt, lifeMs, x,y, elL, elR, hit:false, decoy };

    elL.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onTargetHit(tObj, { via:'tap', clientX: ev.clientX, clientY: ev.clientY });
    }, { passive:false });

    LAYER_L.appendChild(elL);
    if(elR && LAYER_R) LAYER_R.appendChild(elR);

    state.targets.set(id, tObj);
  }

  function spawnOne(){
    const rect = getSafeRect();
    const x = Math.floor(randIn(rng, rect.xMin, rect.xMax));
    const y = Math.floor(randIn(rng, rect.yMin, rect.yMax));
    spawnOneAt(x,y);
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

  // ----------------------- RT stats -----------------------
  function recordRt(ms){
    if(ms == null) return;
    const v = Math.max(0, Math.floor(ms));
    state.rtGood.push(v);
    if(v < 300) state.rtBreakdown.lt300++;
    else if(v < 450) state.rtBreakdown.lt450++;
    else if(v < 700) state.rtBreakdown.lt700++;
    else state.rtBreakdown.ge700++;
  }
  function median(arr){
    if(!arr.length) return null;
    const a = arr.slice().sort((x,y)=>x-y);
    const mid = Math.floor(a.length/2);
    return (a.length%2) ? a[mid] : Math.round((a[mid-1]+a[mid]) / 2);
  }
  function avg(arr){
    if(!arr.length) return null;
    let s=0; for(const v of arr) s += v;
    return Math.round(s/arr.length);
  }

  // ----------------------- minis -----------------------
  function miniOnGoodHit(rtMs){
    const m = state.mini;
    if(!m || m.done) return;

    if(m.type==='streak_good'){
      m.cur++;
      if(m.cur >= m.target){
        m.done = true;
        markMiniCleared();
      }else setMiniText();
      return;
    }

    if(m.type==='fast_hits'){
      const thr = Number(m.thrMs)||450;
      if(rtMs!=null && rtMs<=thr){
        m.cur++;
        if(m.cur >= m.target){
          m.done = true;
          emit('hha:judge', { type:'perfect', label:'FAST PASS!' });
          markMiniCleared();
        }else setMiniText();
      }
      return;
    }
  }
  function miniOnJunkHit(){
    const m = state.mini;
    if(!m || m.done) return;
    if(m.type==='avoid_junk' || m.type==='streak_good'){
      resetMini(m);
      setMiniText();
    }
  }

  // ----------------------- goals -----------------------
  function updateGoalsOnScore(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='score'){
      g.cur = clamp(state.score, 0, g.target);
      if(g.cur >= g.target){
        g.done = true; state.goalsCleared++;
        emit('hha:judge', { type:'perfect', label:'GOAL!' });
      }
      setGoalText();
    }
  }
  function updateGoalsOnMiss(){
    const g = state.goal;
    if(!g || g.done) return;
    if(g.type==='survive'){
      g.cur = clamp(state.miss, 0, g.target);
      setGoalText();
    }
  }

  // ----------------------- combat helpers -----------------------
  function addCombo(){
    state.combo++;
    if(state.combo > state.comboMax) state.comboMax = state.combo;
  }
  function resetCombo(){ state.combo = 0; }

  // ----------------------- HIT logic (with boss A+B+C) -----------------------
  function onTargetHit(tObj, meta={}){
    if(!tObj || tObj.hit || state.ended) return;
    tObj.hit = true;

    const hitAt = now();
    const rtMs = Math.max(0, Math.round(hitAt - tObj.bornAt));
    const kind = tObj.kind;

    const px = meta.clientX ?? tObj.x;
    const py = meta.clientY ?? tObj.y;

    // If decoy: looks good but actually junk (kind already junk) — add hint
    if(tObj.decoy && kind==='junk'){
      fxPop(px,py,'DECOY!', 'bad');
    }

    if(kind==='good'){
      state.nHitGood++;
      addCombo();
      addFever(3.2);

      const delta = DIFF.goodScore + Math.min(6, Math.floor(state.combo/5));
      setScore(state.score + delta);
      updateGoalsOnScore();
      recordRt(rtMs);
      miniOnGoodHit(rtMs);

      emit('hha:judge', { type: (rtMs<=fastCfgByView(view).thrMs ? 'perfect' : 'good'), combo: state.combo });

      // BOSS damage: good hit damages boss (A+B+C)
      if(BOSS.active){
        const dmg = (rtMs <= fastCfgByView(view).thrMs) ? 2 : 1;
        bossDamage(dmg, px, py);
      }

      fxShock(px,py, 62);
      fxPop(px,py, `+${delta}`, delta>=50?'big':'score');

    } else if(kind==='junk'){
      // Shield blocks junk => NOT count as miss (standard)
      const blocked = useShield();
      if(blocked){
        state.nHitJunkGuard++;
        resetCombo();
        addFever(-6);
        emit('hha:judge', { type:'block' });
        fxBurst(px,py, 48);
        fxPop(px,py,'BLOCK','score');
      }else{
        state.nHitJunk++;
        resetCombo();
        addFever(9.5);

        setMiss(state.miss + (DIFF.junkPenaltyMiss||1));
        setScore(state.score + (DIFF.junkPenaltyScore||-10));
        updateGoalsOnMiss();
        miniOnJunkHit();

        emit('hha:judge', { type:'bad' });
        emit('hha:miss', { x:px, y:py, type:'miss' });

        // BOSS heal on junk hit (pressure but fair)
        if(BOSS.active){
          bossHeal(BOSS.rage ? 2 : 1);
          fxPop(px,py,'BOSS +HP','bad');
        }

        fxShock(px,py, 72);
        fxPop(px,py,'OOPS','bad');
      }

    } else if(kind==='star'){
      resetCombo();
      addFever(-10);
      setMiss(Math.max(0, state.miss - 1));
      updateGoalsOnMiss();
      emit('hha:judge', { type:'good' });
      fxBurst(px,py, 44);
      fxPop(px,py,'MISS -1','score');

      // STAR as counter: calm boss a bit (C)
      if(BOSS.active){
        // shorten current phase slightly (gives breathing room)
        BOSS.phaseLeft = Math.max(0.6, BOSS.phaseLeft - 0.8);
        fxPop(px,py,'CALM','score');
        bossUIUpdate();
      }

    } else if(kind==='shield'){
      resetCombo();
      addFever(-8);
      addShield(1);
      emit('hha:judge', { type:'good' });
      fxBurst(px,py, 40);
      fxPop(px,py,'SHIELD +1','score');

    } else if(kind==='diamond'){
      resetCombo();
      addFever(-12);
      addShield(2);
      const bonus = 35;
      setScore(state.score + bonus);
      updateGoalsOnScore();
      emit('hha:judge', { type:'perfect' });

      fxShock(px,py, 92);
      fxPop(px,py,`+${bonus}`,'big');

      // DIAMOND as counter: stun boss (C)
      if(BOSS.active){
        BOSS.stunLeft = BOSS.rage ? 1.2 : 1.6;
        fxPop(px,py,'STUN!','perfect');
        bossDamage(2, px, py); // immediate burst
      }
    }

    setMiniText();
    removeTarget(tObj);

    // end conditions
    if(state.miss >= DIFF.missLimit){
      endGame('miss-limit');
    }
  }

  // cVR shooting (crosshair center)
  function shootCrosshair(){
    if(state.ended) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    const R = (isCVR || isVR) ? 82 : 70;
    let best = null, bestD = 1e9;

    for(const t of state.targets.values()){
      if(t.hit) continue;
      const dx = (t.x - cx);
      const dy = (t.y - cy);
      const d = Math.hypot(dx,dy);
      if(d < R && d < bestD){ bestD = d; best = t; }
    }
    if(best) onTargetHit(best, { via:'shoot', clientX: cx, clientY: cy });
    else pulseBody('gj-miss-shot', 120);
  }
  ROOT.addEventListener('hha:shoot', shootCrosshair, { passive:true });

  // ----------------------- expiry tick -----------------------
  function expireTargets(){
    const t = now();
    for(const tObj of state.targets.values()){
      if(tObj.hit) continue;
      if((t - tObj.bornAt) >= tObj.lifeMs){
        tObj.hit = true;

        if(tObj.kind === 'good'){
          state.nExpireGood++;
          resetCombo();
          addFever(6);
          setMiss(state.miss + 1);
          updateGoalsOnMiss();

          emit('hha:judge', { type:'miss' });
          emit('hha:miss', { x:tObj.x, y:tObj.y, type:'miss' });

          fxBurst(tObj.x, tObj.y, 56);
          fxPop(tObj.x, tObj.y, 'MISS', 'bad');

          if(state.miss >= DIFF.missLimit){
            removeTarget(tObj);
            endGame('miss-limit');
            return;
          }
        }
        removeTarget(tObj);
      }
    }
  }

  // ----------------------- spawn rate (adaptive + storm/boss/rage) -----------------------
  function spawnRate(){
    let r = DIFF.spawnPerSec;

    if(adaptiveOn){
      const struggle = clamp((state.miss / DIFF.missLimit), 0, 1);
      const comboBoost = clamp(state.combo / 18, 0, 1);
      r = r * (1 + 0.18*comboBoost) * (1 - 0.20*struggle);
      if(state.timeLeftSec <= 18) r *= 1.10;
      if(state.timeLeftSec <= 10) r *= 1.15;
    }

    if(BOSS.storm) r *= 1.12;
    if(BOSS.active) r *= 1.10;
    if(BOSS.rage) r *= 1.15;

    // clamp
    return clamp(r, 0.8, 2.25);
  }

  // ----------------------- grading / end overlay (ของเดิมคุณ) -----------------------
  function calcAccuracyGoodPct(){
    if(state.nTargetGoodSpawned <= 0) return null;
    return Math.round((state.nHitGood / Math.max(1, state.nTargetGoodSpawned)) * 1000) / 10;
  }
  function calcJunkErrorPct(){
    const denom = Math.max(1, state.nTargetJunkSpawned);
    return Math.round((state.nHitJunk / denom) * 1000) / 10;
  }
  function calcFastHitRatePct(){
    if(!state.rtGood.length) return null;
    const fast = state.rtGood.filter(x => x <= 450).length;
    return Math.round((fast / state.rtGood.length) * 1000) / 10;
  }
  function gradeFrom(score, miss){
    if(miss <= 2 && score >= 520) return 'S';
    if(miss <= 4 && score >= 460) return 'A';
    if(miss <= 6 && score >= 380) return 'B';
    if(miss <= 8 && score >= 300) return 'C';
    return 'D';
  }

  function showEndOverlay(summary){
    // ใช้ของเดิมคุณได้ — ที่นี่คงไว้แบบสั้น
    const ov = DOC.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:220;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.86);backdrop-filter:blur(10px);padding:16px;';
    const card = DOC.createElement('div');
    card.style.cssText = 'width:min(760px,94vw);background:rgba(2,6,23,.84);border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:18px;box-shadow:0 18px 55px rgba(0,0,0,.45);color:#e5e7eb;font-family:system-ui;';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;">
        <div>
          <div style="font-size:22px;font-weight:1200;">สรุปผล — GoodJunkVR</div>
          <div style="margin-top:6px;color:#94a3b8;font-weight:900;font-size:12px;">
            view=${deviceLabel(view)} | run=${runMode} | diff=${diff}
          </div>
        </div>
        <div style="font-size:56px;font-weight:1300;line-height:1;">${summary.grade || '-'}</div>
      </div>
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.20);border-radius:18px;padding:12px;">
          <div style="color:#94a3b8;font-weight:1000;font-size:12px;">SCORE</div>
          <div style="font-size:26px;font-weight:1200;">${summary.scoreFinal ?? 0}</div>
          <div style="margin-top:10px;color:#94a3b8;font-weight:1000;font-size:12px;">MISS</div>
          <div style="font-size:22px;font-weight:1200;">${summary.misses ?? 0}</div>
        </div>
        <div style="background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.20);border-radius:18px;padding:12px;">
          <div style="color:#94a3b8;font-weight:1000;font-size:12px;">GOAL / MINI</div>
          <div style="font-size:16px;font-weight:1100;margin-top:4px;">
            Goals: ${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}<br/>
            Mini : ${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}
          </div>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="btnReplay" type="button" style="flex:1;min-width:220px;height:54px;border-radius:16px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.16);color:#eafff3;font-weight:1200;font-size:16px;cursor:pointer;">เล่นอีกครั้ง</button>
        <button id="btnBackHub" type="button" style="flex:1;min-width:220px;height:54px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.55);color:#e5e7eb;font-weight:1200;font-size:16px;cursor:pointer;">กลับ HUB</button>
      </div>
    `;
    ov.appendChild(card);
    DOC.body.appendChild(ov);
    byId('btnReplay')?.addEventListener('click', ()=>location.reload());
    byId('btnBackHub')?.addEventListener('click', ()=>{ if(hub) location.href = hub; else alert('ยังไม่ได้ใส่ hub url'); });
  }

  function endGame(reason='timeup'){
    if(state.ended) return;
    state.ended = true;

    for(const tObj of state.targets.values()) removeTarget(tObj);
    state.targets.clear();

    if(state.goal && state.goal.type==='survive' && !state.goal.done){
      if(state.miss <= DIFF.missLimit){ state.goal.done = true; state.goalsCleared++; }
      setGoalText();
    }

    const scoreFinal = state.score;
    const misses = state.miss;
    const avgRtGoodMs = avg(state.rtGood);
    const medianRtGoodMs = median(state.rtGood);
    const accuracyGoodPct = calcAccuracyGoodPct();
    const junkErrorPct = calcJunkErrorPct();
    const fastHitRatePct = calcFastHitRatePct();
    const grade = gradeFrom(scoreFinal, misses);

    setGradeText(grade);
    state.endTimeIso = new Date().toISOString();

    const summary = {
      projectTag: PROJECT_TAG,
      gameVersion: GAME_VERSION,
      device: deviceLabel(view),
      runMode, diff, seed,
      reason,
      durationPlannedSec,
      durationPlayedSec: Math.round(durationPlannedSec - state.timeLeftSec),
      scoreFinal,
      comboMax: state.comboMax,
      misses,
      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      miniCleared: state.miniCleared,
      miniTotal: state.miniTotal,
      nTargetGoodSpawned: state.nTargetGoodSpawned,
      nTargetJunkSpawned: state.nTargetJunkSpawned,
      nTargetStarSpawned: state.nTargetStarSpawned,
      nTargetDiamondSpawned: state.nTargetDiamondSpawned,
      nTargetShieldSpawned: state.nTargetShieldSpawned,
      nHitGood: state.nHitGood,
      nHitJunk: state.nHitJunk,
      nHitJunkGuard: state.nHitJunkGuard,
      nExpireGood: state.nExpireGood,
      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct,
      rtBreakdownJson: JSON.stringify(state.rtBreakdown),
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
      grade,
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

    emit('hha:end', {
      projectTag: PROJECT_TAG,
      runMode, diff, seed,
      device: deviceLabel(view),
      durationPlannedSec,
      durationPlayedSec: summary.durationPlayedSec,
      scoreFinal,
      comboMax: summary.comboMax,
      misses,
      goalsCleared: summary.goalsCleared,
      goalsTotal: summary.goalsTotal,
      miniCleared: summary.miniCleared,
      miniTotal: summary.miniTotal,
      nTargetGoodSpawned: summary.nTargetGoodSpawned,
      nTargetJunkSpawned: summary.nTargetJunkSpawned,
      nTargetStarSpawned: summary.nTargetStarSpawned,
      nTargetDiamondSpawned: summary.nTargetDiamondSpawned,
      nTargetShieldSpawned: summary.nTargetShieldSpawned,
      nHitGood: summary.nHitGood,
      nHitJunk: summary.nHitJunk,
      nHitJunkGuard: summary.nHitJunkGuard,
      nExpireGood: summary.nExpireGood,
      accuracyGoodPct,
      junkErrorPct,
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct,
      rtBreakdownJson: summary.rtBreakdownJson,
      reason,
      startTimeIso: state.startTimeIso,
      endTimeIso: state.endTimeIso,
      grade,
    });

    emit('hha:celebrate', { kind:'end', grade });
    showEndOverlay(summary);
  }

  // ----------------------- MAIN LOOP -----------------------
  let lastTick = 0;

  function tick(){
    if(state.ended) return;

    const t = now();
    if(!lastTick) lastTick = t;
    const dt = Math.min(0.05, (t - lastTick) / 1000);
    lastTick = t;

    // time
    state.timeLeftSec -= dt;
    if(state.timeLeftSec < 0) state.timeLeftSec = 0;
    setTimeLeft(state.timeLeftSec);
    updateLowTimeFx();

    // boss/storm
    bossTick(dt);

    // mini
    tickMini(dt);

    // spawn
    state.spawnAcc += dt * spawnRate();
    while(state.spawnAcc >= 1){
      state.spawnAcc -= 1;
      spawnOne();

      // storm extra waves (fun pressure)
      if(BOSS.storm && rng() < (BOSS.rage ? 0.22 : 0.16)){
        // extra 1–2 targets
        spawnOne();
        if(rng() < 0.35) spawnOne();
      }
    }

    // expiry
    expireTargets();

    if(state.timeLeftSec <= 0){
      endGame('timeup');
      return;
    }

    requestAnimationFrame(tick);
  }

  function initHud(){
    setScore(0);
    setMiss(0);
    setTimeLeft(durationPlannedSec);
    setGradeText('—');
    addFever(0);
    renderShield();

    // goals
    state.goals = makeGoals();
    state.goal = state.goals[0];
    setGoalText();

    // minis
    state.miniSeq = pickMiniSequence(view);
    state.miniIndex = 0;
    state.mini = state.miniSeq[state.miniIndex];
    resetMini(state.mini);
    setMiniText();

    emit('quest:update', { goal: state.goal, mini: state.mini });

    // UI extras
    bossUIEnsure();
    bossUIUpdate();
  }

  function start(){
    if(state.started) return;
    state.started = true;

    state.startTimeIso = new Date().toISOString();
    initHud();

    emit('hha:start', {
      projectTag: PROJECT_TAG,
      runMode,
      view,
      device: deviceLabel(view),
      diff,
      seed,
      gameVersion: GAME_VERSION,
      durationPlannedSec,
      startTimeIso: state.startTimeIso
    });

    emit('hha:coach', { msg:'ทริค: ⭐ ลด MISS / 💎 สตันบอส / 🛡️ บล็อกขยะ (บล็อกแล้วไม่เป็น MISS)', kind:'tip' });

    requestAnimationFrame(tick);
  }

  start();

  ROOT.__GJ_STATE__ = state;
}