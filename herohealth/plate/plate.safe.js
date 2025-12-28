/* === /herohealth/plate-vr/plate.safe.js ===
Balanced Plate VR — SAFE (PRODUCTION) — HHA Standard (FULL + FLUSH PATCH)
✅ End Summary overlay + Back HUB + localStorage(HHA_LAST_SUMMARY)
✅ Deterministic RNG (research default) + optional play ?seed=
✅ Events logger compatible: hha:log_event {type:'spawn'|'hit'|'miss_expire'|'shield_block', data:{...}}
✅ Metrics computed during play + emitted in hha:end
✅ VR-feel view shift (drag + gyro) + clamp safe zone (avoid HUD all sides)
✅ Goals sequential + Minis chain (incl. Plate Rush: "ครบ 5 ภายใน 8 วินาที" + "ห้ามโดนขยะ")
✅ FEVER -> auto Shield (blocks junk hit; blocked junk does NOT count as miss)
✅ FLUSH: before END + before HUB + pagehide/visibilitychange best-effort
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // ------------------------------------------------------------
  // Root modules (Particles / FeverUI / Cloud Logger)
  // ------------------------------------------------------------
  const Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles ||
    { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

  const FeverUI =
    (root.GAME_MODULES && root.GAME_MODULES.FeverUI) ||
    root.FeverUI ||
    { ensure(){}, set(){}, pulse(){}, setShield(){}, setFeverState(){} };

  const CloudLogger =
    (root.GAME_MODULES && root.GAME_MODULES.HHACloudLogger) ||
    root.HHACloudLogger ||
    null;

  // ------------------------------------------------------------
  // Utils
  // ------------------------------------------------------------
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = 0; return v<a?a:(v>b?b:v); }
  function lerp(a,b,t){ return a + (b-a)*t; }

  function qs(name, def){
    try{
      const u = new URL(root.location.href);
      const v = u.searchParams.get(name);
      return (v === null || v === undefined || v === '') ? def : v;
    }catch(_){ return def; }
  }
  function qsInt(name, def){
    const v = parseInt(qs(name, String(def)), 10);
    return Number.isFinite(v) ? v : def;
  }

  // deterministic RNG
  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
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
  function makeRng(seed){
    const g = xmur3(seed);
    return sfc32(g(), g(), g(), g());
  }
  function pick(rng, arr){
    if (!arr || !arr.length) return '';
    return arr[(rng()*arr.length)|0];
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  // ------------------------------------------------------------
  // Simple SFX (WebAudio) — light + safe
  // ------------------------------------------------------------
  const SFX = {
    ctx:null, nextTickAt:0,
    ensure(){
      if (this.ctx) return this.ctx;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try{ this.ctx = new AC(); return this.ctx; }catch(_){ return null; }
    },
    beep(freq, dur, gain, type){
      const ctx = this.ensure();
      if (!ctx) return;
      try{
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'triangle';
        o.frequency.value = freq;
        g.gain.value = 0.0001;
        o.connect(g); g.connect(ctx.destination);

        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain||0.05), t0+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur||0.06));
        o.start(t0);
        o.stop(t0 + (dur||0.06) + 0.02);
      }catch(_){}
    },
    good(){ this.beep(740, 0.045, 0.040, 'triangle'); },
    bad(){  this.beep(220, 0.065, 0.055, 'sawtooth'); },
    ok(){   this.beep(520, 0.040, 0.030, 'triangle'); },
    power(){
      this.beep(820, 0.06, 0.05, 'triangle');
      this.beep(1040,0.05, 0.045,'triangle');
    },
    tick(leftMs){
      const t = nowMs();
      if (t < this.nextTickAt) return;
      const left = Math.max(0, leftMs);
      const rate = (left <= 1200) ? 90 : (left <= 2200 ? 140 : 220);
      this.nextTickAt = t + rate;
      this.beep(980, 0.040, 0.045, 'triangle');
    }
  };

  // ------------------------------------------------------------
  // DOM layer + base CSS injection (safe)
  // ------------------------------------------------------------
  const layer =
    DOC.getElementById('plate-layer') ||
    DOC.getElementById('pl-layer') ||
    DOC.querySelector('.plate-layer') ||
    DOC.querySelector('.pl-layer');

  if (!layer) {
    // fail-soft: create a layer if missing
    const div = DOC.createElement('div');
    div.id = 'plate-layer';
    div.className = 'plate-layer';
    Object.assign(div.style, { position:'fixed', inset:'0', pointerEvents:'none' });
    DOC.body.appendChild(div);
  }

  const LAYER = layer || DOC.getElementById('plate-layer') || DOC.querySelector('.plate-layer');
  if (!LAYER) return;

  (function ensureBaseCss(){
    if (DOC.getElementById('plate-safe-css')) return;
    const st = DOC.createElement('style');
    st.id = 'plate-safe-css';
    st.textContent = `
      .pl-target{
        position:fixed;
        left: var(--x, 50vw);
        top:  var(--y, 50vh);
        transform: translate(-50%,-50%) scale(var(--s,1));
        width: 72px; height: 72px;
        border-radius: 999px;
        display:grid; place-items:center;
        pointer-events:auto;
        user-select:none;
        -webkit-tap-highlight-color: transparent;
        background: rgba(2,6,23,.55);
        border: 1px solid rgba(148,163,184,.20);
        box-shadow: 0 18px 60px rgba(0,0,0,.40), inset 0 0 0 1px rgba(148,163,184,.06);
        backdrop-filter: blur(8px);
      }
      .pl-target::before{
        content: attr(data-emoji);
        font-size: 36px;
        transform: translateZ(0);
        filter: drop-shadow(0 6px 10px rgba(0,0,0,.35));
      }
      .pl-target.pl-junk{ border-color: rgba(239,68,68,.35); box-shadow: 0 18px 70px rgba(239,68,68,.08), inset 0 0 0 1px rgba(239,68,68,.12); }
      .pl-target.pl-good{ border-color: rgba(34,197,94,.28); box-shadow: 0 18px 70px rgba(34,197,94,.08), inset 0 0 0 1px rgba(34,197,94,.12); }
      .pl-target.pl-star{ border-color: rgba(250,204,21,.35); }
      .pl-target.pl-shield{ border-color: rgba(34,211,238,.35); }
      .pl-target.hit{ transform: translate(-50%,-50%) scale(calc(var(--s,1)*1.15)); opacity:0; transition: transform .18s ease, opacity .18s ease; }
      .pl-target.out{ opacity:0; transition: opacity .16s ease; }
      body.plate-urgent{
        animation: plateUrgent 0.22s linear infinite;
      }
      @keyframes plateUrgent{
        0%{ filter:none; }
        50%{ filter: brightness(1.08) saturate(1.05); }
        100%{ filter:none; }
      }
    `;
    DOC.head.appendChild(st);
  })();

  // ------------------------------------------------------------
  // HHA Cloud Logger wrappers + FLUSH helpers
  // ------------------------------------------------------------
  function hhaLogEvent(type, data){
    try{
      emit('hha:log_event', { type, data: data || {} });
      if (CloudLogger && typeof CloudLogger.log_event === 'function'){
        CloudLogger.log_event({ type, data: data || {} });
      }
    }catch(_){}
  }

  async function flushNowBestEffort(why){
    try{
      // prefer CloudLogger.flushNow()
      const L = CloudLogger;
      if (L && typeof L.flushNow === 'function'){
        await Promise.race([ L.flushNow({ reason: why || 'flush' }), new Promise(r=>setTimeout(r, 1400)) ]);
      } else {
        // fallback: emit flush request
        emit('hha:flush', { reason: why || 'flush' });
      }
    }catch(_){}
  }

  // page lifecycle flush
  (function bindLifecycleFlush(){
    let did = false;
    function once(reason){
      if (did) return;
      did = true;
      flushNowBestEffort(reason);
      // allow future flush again after a moment (pagehide may fire multiple times)
      setTimeout(()=>{ did=false; }, 800);
    }
    root.addEventListener('pagehide', ()=>once('pagehide'), { passive:true });
    root.addEventListener('beforeunload', ()=>once('beforeunload'), { passive:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') once('hidden');
    }, { passive:true });
  })();

  // ------------------------------------------------------------
  // Game content: Balanced Plate groups
  // ------------------------------------------------------------
  // 5 หมู่แบบ “จานสุขภาพ” (ปรับได้ตามงานคุณ)
  const GROUPS = {
    1: { key:'protein', label:'โปรตีน', emoji:['🍗','🐟','🥚','🥛','🫘','🥜'] },
    2: { key:'grains',  label:'ข้าว-แป้ง', emoji:['🍚','🍞','🥖','🍜','🥔','🍠'] },
    3: { key:'veg',     label:'ผัก', emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    4: { key:'fruit',   label:'ผลไม้', emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    5: { key:'fat',     label:'ไขมันดี', emoji:['🥑','🫒','🧈','🥥','🧀','🌰'] }
  };

  const JUNK = ['🍟','🍔','🍕','🍩','🍬','🍭','🧋'];
  const STARS = ['⭐'];
  const SHIELDS = ['🛡️'];

  // ------------------------------------------------------------
  // Difficulty params
  // ------------------------------------------------------------
  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy') {
      return { spawnMs: 900, ttlMs: 1850, size: 1.08, junkBias: 0.12, starBias:0.012, shieldBias:0.010, feverGain: 0.09, feverLoss: 0.14 };
    }
    if (diff === 'hard') {
      return { spawnMs: 680, ttlMs: 1450, size: 0.92, junkBias: 0.20, starBias:0.014, shieldBias:0.010, feverGain: 0.08, feverLoss: 0.18 };
    }
    return { spawnMs: 780, ttlMs: 1650, size: 1.00, junkBias: 0.16, starBias:0.013, shieldBias:0.010, feverGain: 0.085, feverLoss: 0.16 };
  }

  // ------------------------------------------------------------
  // Rank
  // ------------------------------------------------------------
  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  // ------------------------------------------------------------
  // Safe spawn rect (avoid HUD all sides) + VR feel view offset
  // ------------------------------------------------------------
  function getSafeRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    // avoid top HUD + bottom area (end buttons / safe-area)
    const top = 160 + (parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--sat')||'0',10)||0);
    const bot = 190 + (parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--sab')||'0',10)||0);

    // avoid left/right HUD edges
    const side = 18;

    const x0 = side;
    const x1 = W - side;
    const y0 = top;
    const y1 = H - bot;

    // relax if screen small
    const minW = 220, minH = 260;
    let rx0=x0, rx1=x1, ry0=y0, ry1=y1;
    if ((rx1-rx0) < minW){ rx0 = 12; rx1 = W-12; }
    if ((ry1-ry0) < minH){ ry0 = 120; ry1 = H-160; }

    return { W,H, x0:rx0, x1:rx1, y0:ry0, y1:ry1 };
  }

  // ------------------------------------------------------------
  // Engine state
  // ------------------------------------------------------------
  const engine = {
    running:false,
    ended:false,
    runMode:'play',
    diff:'normal',
    timeSec:90,

    seed:'seed',
    rng:Math.random,

    // view offsets
    vx:0, vy:0,
    dragOn:false, dragX:0, dragY:0,

    // timers
    tStartMs:0,
    leftSec:90,
    spawnTimer:0,
    tickTimer:0,

    // gameplay
    score:0,
    combo:0,
    comboMax:0,

    misses:0,            // miss = good expired + junk hit (not blocked)
    nSpawnGood:0,
    nSpawnJunk:0,
    nSpawnStar:0,
    nSpawnShield:0,

    nHitGood:0,
    nHitJunk:0,
    nHitJunkGuard:0,
    nExpireGood:0,

    rtSum:0,
    rtN:0,
    rtList:[], // for median

    // plate balance tracking: counts by group
    groupNeed: {1:3,2:3,3:3,4:2,5:1}, // default “plate balance”
    groupGot:  {1:0,2:0,3:0,4:0,5:0},

    // fever/shield
    fever:0,             // 0..1
    shield:0,            // 0/1
    feverState:'cool',   // cool/warm/hot
    feverGain:0.085,
    feverLoss:0.16,

    // mini: Plate Rush
    miniActive:null,
    miniCount:0,
    miniWindowEnd:0,
    miniNoJunk:true,
    urgent:false,

    // goals
    goalIndex:0,
    goalsCleared:0,
    goalsTotal:3,
    miniCleared:0,
    miniTotal:4,

    // adaptive (play only)
    adapt: { spawnMs:780, ttlMs:1650, size:1.0, junkBias:0.16 }
  };

  function resetPlate(){
    engine.groupGot = {1:0,2:0,3:0,4:0,5:0};
  }
  function totalNeed(){
    let t=0; for (const k in engine.groupNeed) t += (engine.groupNeed[k]|0);
    return t;
  }
  function totalGot(){
    let t=0; for (const k in engine.groupGot) t += (engine.groupGot[k]|0);
    return t;
  }

  function applyView(){
    // allow CSS to use --vx/--vy if exists
    try{
      LAYER.style.setProperty('--vx', engine.vx.toFixed(1)+'px');
      LAYER.style.setProperty('--vy', engine.vy.toFixed(1)+'px');
      // also shift layer visually
      LAYER.style.transform = `translate(${engine.vx.toFixed(1)}px, ${engine.vy.toFixed(1)}px)`;
    }catch(_){}
  }

  function setupView(){
    // drag
    LAYER.addEventListener('pointerdown', (e)=>{
      engine.dragOn = true;
      engine.dragX = e.clientX; engine.dragY = e.clientY;
    }, { passive:true });

    root.addEventListener('pointermove', (e)=>{
      if (!engine.dragOn) return;
      const dx = e.clientX - engine.dragX;
      const dy = e.clientY - engine.dragY;
      engine.dragX = e.clientX; engine.dragY = e.clientY;
      engine.vx = clamp(engine.vx + dx*0.22, -90, 90);
      engine.vy = clamp(engine.vy + dy*0.22, -90, 90);
      applyView();
    }, { passive:true });

    root.addEventListener('pointerup', ()=>{ engine.dragOn=false; }, { passive:true });

    // gyro
    root.addEventListener('deviceorientation', (ev)=>{
      const gx = Number(ev.gamma)||0; // left-right
      const gy = Number(ev.beta)||0;  // front-back
      engine.vx = clamp(engine.vx + gx*0.06, -90, 90);
      engine.vy = clamp(engine.vy + (gy-20)*0.02, -90, 90);
      applyView();
    }, { passive:true });
  }

  // optional external recenter
  function recenter(){
    engine.vx = 0; engine.vy = 0;
    applyView();
    emit('plate:recenter', {});
  }

  // ------------------------------------------------------------
  // HUD / progress emits (HHA Standard)
  // ------------------------------------------------------------
  function accPct(){
    const denom = Math.max(1, (engine.nHitGood + engine.nHitJunk));
    // accuracyGoodPct: good hits / (good hits + junk hits)
    return Math.round((engine.nHitGood / denom) * 100);
  }
  function median(arr){
    if (!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const mid = (a.length/2)|0;
    return (a.length%2) ? a[mid] : Math.round((a[mid-1]+a[mid])/2);
  }
  function updateRank(){
    emit('hha:rank', { grade: rankFromAcc(accPct()), accuracy: accPct() });
  }
  function updateScore(){
    emit('hha:score', {
      score: engine.score|0,
      combo: engine.combo|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0
    });
    updateRank();
  }
  function updateTime(){
    emit('hha:time', { left: Math.max(0, engine.leftSec|0) });
  }
  function updateQuest(){
    // Goal: complete one plate
    const got = totalGot();
    const need = totalNeed();
    emit('quest:update', {
      goalTitle: goalTitle(),
      goalNow: got,
      goalTotal: need,
      miniTitle: miniTitle(),
      miniNow: miniNow(),
      miniTotal: miniTotalNow(),
      miniLeftMs: miniLeftMs()
    });
  }
  function updateFeverUI(){
    try{
      FeverUI.ensure && FeverUI.ensure();
      FeverUI.set && FeverUI.set(engine.fever);
      FeverUI.setShield && FeverUI.setShield(engine.shield>0);
      FeverUI.setFeverState && FeverUI.setFeverState(engine.feverState);
    }catch(_){}
  }

  // ------------------------------------------------------------
  // Goals + Minis (simple director)
  // ------------------------------------------------------------
  const GOALS = [
    { id:'balance1', title:'เติมจานให้ครบ (รอบที่ 1)' },
    { id:'balance2', title:'เติมจานให้ครบ (รอบที่ 2)' },
    { id:'balance3', title:'เติมจานให้ครบ (รอบที่ 3)' },
  ];

  const MINIS = [
    { id:'rush',  title:'Plate Rush: ครบ 5 ภายใน 8 วิ (ห้ามโดนขยะ)' },
    { id:'clean', title:'Clean Streak: ห้ามโดนขยะ 10 วิ' },
    { id:'combo', title:'Combo Burst: ทำคอมโบ 10' },
    { id:'fever', title:'Fever Pop: ทำให้ FEVER เต็ม 1 ครั้ง' },
  ];

  function goalTitle(){
    const g = GOALS[clamp(engine.goalIndex,0,GOALS.length-1)];
    return g ? g.title : '—';
  }

  function miniTitle(){
    const m = engine.miniActive;
    return m ? m.title : '—';
  }
  function miniNow(){
    if (!engine.miniActive) return 0;
    if (engine.miniActive.id === 'rush')  return engine.miniCount|0;
    if (engine.miniActive.id === 'clean') return Math.min(10, ((nowMs() - engine._cleanStartMs)/1000)|0) || 0;
    if (engine.miniActive.id === 'combo') return Math.min(10, engine.combo|0);
    if (engine.miniActive.id === 'fever') return engine._feverPopped ? 1 : 0;
    return 0;
  }
  function miniTotalNow(){
    if (!engine.miniActive) return 0;
    if (engine.miniActive.id === 'rush')  return 5;
    if (engine.miniActive.id === 'clean') return 10;
    if (engine.miniActive.id === 'combo') return 10;
    if (engine.miniActive.id === 'fever') return 1;
    return 0;
  }
  function miniLeftMs(){
    if (!engine.miniActive) return 0;
    if (engine.miniActive.id === 'rush') return Math.max(0, engine.miniWindowEnd - nowMs());
    return 0;
  }

  function startMini(idx){
    idx = clamp(idx, 0, MINIS.length-1);
    engine.miniActive = MINIS[idx];
    engine.urgent = false;
    DOC.body.classList.remove('plate-urgent');

    if (engine.miniActive.id === 'rush'){
      engine.miniCount = 0;
      engine.miniNoJunk = true;
      engine.miniWindowEnd = nowMs() + 8000;
    } else if (engine.miniActive.id === 'clean'){
      engine._cleanStartMs = nowMs();
    } else if (engine.miniActive.id === 'combo'){
      // just track engine.combo
    } else if (engine.miniActive.id === 'fever'){
      engine._feverPopped = false;
    }

    emit('hha:coach', { mood:'neutral', text:`MINI: ${engine.miniActive.title}` });
    emit('hha:celebrate', { kind:'mini', title:'MINI START!' });
    updateQuest();
  }

  function clearMini(){
    engine.miniActive = null;
    engine.urgent = false;
    DOC.body.classList.remove('plate-urgent');
    updateQuest();
  }

  function passMini(){
    engine.miniCleared++;
    emit('hha:judge', { kind:'good', text:'MINI COMPLETE!' });
    emit('hha:celebrate', { kind:'mini', title:'MINI COMPLETE!' });
    Particles.celebrate && Particles.celebrate('mini');
    clearMini();

    // chain: next mini (loop)
    const next = (engine.miniCleared % engine.miniTotal);
    startMini(next);
  }

  function failMini(reason){
    // only Plate Rush has hard fail states
    if (!engine.miniActive) return;
    if (engine.miniActive.id !== 'rush') return;

    emit('hha:judge', { kind:'warn', text: reason || 'MINI FAIL!' });
    emit('hha:celebrate', { kind:'mini', title:'TRY AGAIN!' });

    // reset rush state immediately (stay same mini)
    engine.miniCount = 0;
    engine.miniNoJunk = true;
    engine.miniWindowEnd = nowMs() + 8000;
    DOC.body.classList.remove('plate-urgent');
    engine.urgent = false;
    updateQuest();
  }

  function passGoal(){
    engine.goalsCleared++;
    emit('hha:judge', { kind:'good', text:'GOAL COMPLETE!' });
    emit('hha:celebrate', { kind:'goal', title:'GOAL COMPLETE!' });
    Particles.celebrate && Particles.celebrate('goal');

    // next goal or end all
    engine.goalIndex++;
    resetPlate();
    updateQuest();

    if (engine.goalIndex >= engine.goalsTotal){
      // all done
      emit('hha:celebrate', { kind:'all', title:'ALL GOALS COMPLETE!' });
      Particles.celebrate && Particles.celebrate('all');
      endGame('all_goals');
    } else {
      emit('hha:coach', { mood:'happy', text:`เริ่มรอบใหม่! ${goalTitle()}` });
    }
  }

  // ------------------------------------------------------------
  // Fever + Shield
  // ------------------------------------------------------------
  function feverStateFrom(v){
    if (v >= 0.92) return 'hot';
    if (v >= 0.55) return 'warm';
    return 'cool';
  }

  function addFever(delta){
    engine.fever = clamp(engine.fever + delta, 0, 1);
    const st = feverStateFrom(engine.fever);
    if (st !== engine.feverState){
      engine.feverState = st;
      emit('hha:fever', { value: engine.fever, state: st });
    }
    // auto shield when full-ish
    if (engine.fever >= 0.98 && engine.shield < 1){
      engine.shield = 1;
      emit('hha:judge', { kind:'good', text:'SHIELD READY!' });
      emit('hha:celebrate', { kind:'mini', title:'SHIELD READY!' });
      if (engine.miniActive && engine.miniActive.id === 'fever') engine._feverPopped = true;
    }
    updateFeverUI();
  }

  // ------------------------------------------------------------
  // Spawning
  // ------------------------------------------------------------
  function randPos(){
    const r = getSafeRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  function chooseType(){
    const base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;

    // powerups chance
    if (engine.rng() < base.shieldBias) return 'shield';
    if (engine.rng() < base.starBias) return 'star';

    // junk vs good
    const j = clamp(base.junkBias, 0.08, 0.30);
    return (engine.rng() < j) ? 'junk' : 'good';
  }

  function chooseGoodGroupId(){
    // pick the most-needed group to encourage balancing
    let best = 1;
    let bestNeed = -999;
    for (let g=1; g<=5; g++){
      const need = (engine.groupNeed[g]|0) - (engine.groupGot[g]|0);
      const score = need + (engine.rng()*0.25); // small randomness
      if (score > bestNeed){ bestNeed = score; best = g; }
    }
    // if already full, random group
    if (bestNeed <= 0) best = 1 + ((engine.rng()*5)|0);
    return best;
  }

  function makeTarget(tp, emoji, x, y, s, bornMs){
    const el = DOC.createElement('div');
    el.className = 'pl-target spawn';
    el.dataset.type = tp;
    el.dataset.emoji = emoji || '✨';
    el.dataset.born = String(bornMs|0);

    if (tp === 'good') el.classList.add('pl-good');
    if (tp === 'junk') el.classList.add('pl-junk');
    if (tp === 'star') el.classList.add('pl-star');
    if (tp === 'shield') el.classList.add('pl-shield');

    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
    el.style.setProperty('--s', s.toFixed(3));

    // click -> hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el);
    }, { passive:false });

    // TTL
    const ttl = engine.ttlMs;
    el._ttlTimer = root.setTimeout(()=>{
      if (!el.isConnected) return;

      // expire => miss only if GOOD
      if (tp === 'good'){
        engine.misses++;
        engine.nExpireGood++;
        engine.combo = 0;
        addFever(-engine.feverLoss);

        emit('hha:judge', { kind:'warn', text:'MISS!' });
        Particles.judgeText && Particles.judgeText('MISS!');
        updateScore();
        updateQuest();

        hhaLogEvent('miss_expire', {
          kind:'good',
          itemType:'good',
          emoji: el.dataset.emoji || '',
          rtMs: null,
          judgment:'miss_expire',
          totalScore: engine.score|0,
          combo: engine.combo|0,
          feverValue: engine.fever,
          feverState: engine.feverState,
          shield: engine.shield|0
        });
      }

      el.classList.add('out');
      root.setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 200);
    }, ttl);

    return el;
  }

  function removeTarget(el){
    try{ root.clearTimeout(el._ttlTimer); }catch(_){}
    el.classList.add('hit');
    root.setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 180);
  }

  function spawnOne(){
    if (!engine.running || engine.ended) return;

    const base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;
    const born = nowMs();

    const tp = chooseType();
    const p = randPos();

    let size = base.size;
    if (tp === 'junk') size *= 0.95;
    if (tp === 'star' || tp === 'shield') size *= 0.98;

    let emoji = '✨';
    if (tp === 'junk'){
      emoji = pick(engine.rng, JUNK);
      engine.nSpawnJunk++;
    } else if (tp === 'star'){
      emoji = pick(engine.rng, STARS);
      engine.nSpawnStar++;
    } else if (tp === 'shield'){
      emoji = pick(engine.rng, SHIELDS);
      engine.nSpawnShield++;
    } else {
      const gid = chooseGoodGroupId();
      emoji = pick(engine.rng, GROUPS[gid].emoji);
      engine.nSpawnGood++;
      // tag group id
      // (ใช้กับ analytics + plate balance)
      // good items count to that group when hit
      // note: if you prefer mapping by emoji, you can later.
      // keep it explicit for logging.
      // attach groupId on element
      // eslint-disable-next-line no-self-assign
      emoji = emoji;
    }

    const el = makeTarget(tp, emoji, p.x, p.y, size, born);

    if (tp === 'good'){
      const gid = chooseGoodGroupId(); // keep same heuristic for count tracking
      el.dataset.groupId = String(gid);
    }

    LAYER.appendChild(el);

    hhaLogEvent('spawn', {
      kind: tp,
      itemType: tp,
      emoji,
      timeFromStartMs: Math.max(0, (born - engine.tStartMs)|0),
      totalScore: engine.score|0,
      combo: engine.combo|0,
      feverValue: engine.fever,
      feverState: engine.feverState,
      shield: engine.shield|0
    });
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;

    spawnOne();

    const base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;
    let sMs = Math.max(420, base.spawnMs);

    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ------------------------------------------------------------
  // Hit logic + Plate balance
  // ------------------------------------------------------------
  function addScore(base, x2){
    const mult = x2 ? 2 : 1;
    engine.score += Math.round(base * mult);
  }

  function plateCompleted(){
    // complete when all groups reached need
    for (let g=1; g<=5; g++){
      if ((engine.groupGot[g]|0) < (engine.groupNeed[g]|0)) return false;
    }
    return true;
  }

  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    const tp = String(el.dataset.type||'').toLowerCase();
    const born = Number(el.dataset.born)||0;
    const rt = born ? Math.max(0, (nowMs() - born)) : 0;

    // STAR power: small bonus + fever boost + fx
    if (tp === 'star'){
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      addScore(130 + Math.min(80, engine.combo*2), false);

      addFever(+0.08);
      emit('hha:judge', { kind:'good', text:'STAR!' });
      Particles.burstAt && Particles.burstAt(el, { kind:'star' });
      SFX.power();
      updateScore(); updateQuest();

      hhaLogEvent('hit', {
        kind:'star',
        itemType:'star',
        emoji: el.dataset.emoji || '⭐',
        rtMs: rt|0,
        judgment:'hit',
        totalScore: engine.score|0,
        combo: engine.combo|0,
        isGood:true,
        feverValue: engine.fever,
        feverState: engine.feverState,
        shield: engine.shield|0
      });

      removeTarget(el);
      return;
    }

    // SHIELD pickup
    if (tp === 'shield'){
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      engine.shield = 1;

      addScore(110, false);
      addFever(+0.06);

      emit('hha:judge', { kind:'good', text:'SHIELD!' });
      emit('hha:celebrate', { kind:'mini', title:'SHIELD UP!' });
      Particles.burstAt && Particles.burstAt(el, { kind:'shield' });
      SFX.power();

      updateFeverUI();
      updateScore(); updateQuest();

      hhaLogEvent('hit', {
        kind:'shield',
        itemType:'shield',
        emoji: el.dataset.emoji || '🛡️',
        rtMs: rt|0,
        judgment:'hit',
        totalScore: engine.score|0,
        combo: engine.combo|0,
        isGood:true,
        feverValue: engine.fever,
        feverState: engine.feverState,
        shield: engine.shield|0
      });

      removeTarget(el);
      return;
    }

    // GOOD
    if (tp === 'good'){
      engine.nHitGood++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      // reaction time stats
      if (rt > 0){
        engine.rtSum += rt;
        engine.rtN++;
        engine.rtList.push(rt|0);
      }

      // plate group count
      const gid = Number(el.dataset.groupId)||0;
      if (gid >= 1 && gid <= 5){
        engine.groupGot[gid] = clamp((engine.groupGot[gid]|0) + 1, 0, 99);
      }

      // score
      addScore(100 + Math.min(220, engine.combo*3), false);

      addFever(+engine.feverGain);
      emit('hha:judge', { kind:'good', text:'GOOD!' });
      Particles.scorePop && Particles.scorePop(el, '+'+(100));
      Particles.burstAt && Particles.burstAt(el, { kind:'good' });
      SFX.good();

      updateScore(); updateQuest();

      hhaLogEvent('hit', {
        kind:'good',
        itemType:'good',
        emoji: el.dataset.emoji || '',
        rtMs: rt|0,
        judgment:'hit',
        totalScore: engine.score|0,
        combo: engine.combo|0,
        isGood:true,
        feverValue: engine.fever,
        feverState: engine.feverState,
        shield: engine.shield|0,
        groupId: gid|0
      });

      // mini: Plate Rush
      if (engine.miniActive && engine.miniActive.id === 'rush'){
        // within window and still no junk
        const left = engine.miniWindowEnd - nowMs();
        if (left > 0 && engine.miniNoJunk){
          engine.miniCount = clamp(engine.miniCount + 1, 0, 99);
          if (left <= 1700 && !engine.urgent){
            engine.urgent = true;
            DOC.body.classList.add('plate-urgent');
          }
          if (engine.miniCount >= 5){
            DOC.body.classList.remove('plate-urgent');
            engine.urgent = false;
            passMini();
          }
        }
      }

      // mini: combo
      if (engine.miniActive && engine.miniActive.id === 'combo'){
        if (engine.combo >= 10) passMini();
      }

      // goal: plate complete
      if (plateCompleted()){
        passGoal();
      }

      removeTarget(el);
      return;
    }

    // JUNK
    if (tp === 'junk'){
      engine.nHitJunk++;
      // if shield active => block (no miss)
      if (engine.shield > 0){
        engine.shield = 0;
        engine.nHitJunkGuard++;
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        Particles.burstAt && Particles.burstAt(el, { kind:'shield_block' });
        SFX.ok();
        updateFeverUI();
        updateScore(); updateQuest();

        hhaLogEvent('shield_block', {
          kind:'junk',
          itemType:'junk',
          emoji: el.dataset.emoji || '',
          rtMs: rt|0,
          judgment:'shield_block',
          totalScore: engine.score|0,
          combo: engine.combo|0,
          isGood:false,
          feverValue: engine.fever,
          feverState: engine.feverState,
          shield: engine.shield|0
        });

        removeTarget(el);
        return;
      }

      // count as MISS (miss def)
      engine.misses++;
      engine.combo = 0;
      addFever(-engine.feverLoss);

      emit('hha:judge', { kind:'bad', text:'JUNK!' });
      Particles.burstAt && Particles.burstAt(el, { kind:'junk' });
      SFX.bad();
      updateScore(); updateQuest();

      hhaLogEvent('hit', {
        kind:'junk',
        itemType:'junk',
        emoji: el.dataset.emoji || '',
        rtMs: rt|0,
        judgment:'hit_bad',
        totalScore: engine.score|0,
        combo: engine.combo|0,
        isGood:false,
        feverValue: engine.fever,
        feverState: engine.feverState,
        shield: engine.shield|0
      });

      // mini: rush => fail if junk hit inside window
      if (engine.miniActive && engine.miniActive.id === 'rush'){
        const left = engine.miniWindowEnd - nowMs();
        if (left > 0){
          engine.miniNoJunk = false;
          DOC.body.classList.remove('plate-urgent');
          engine.urgent = false;
          failMini('RUSH FAIL! (โดนขยะ)');
        }
      }

      // mini: clean streak => reset timer
      if (engine.miniActive && engine.miniActive.id === 'clean'){
        engine._cleanStartMs = nowMs();
      }

      removeTarget(el);
      return;
    }
  }

  // ------------------------------------------------------------
  // Tick loop: time + minis timing + adaptive + urgent effects
  // ------------------------------------------------------------
  function loopTick(){
    if (!engine.running || engine.ended) return;

    const t = nowMs();
    const elapsed = Math.max(0, (t - engine.tStartMs) / 1000);
    const left = Math.max(0, engine.timeSec - elapsed);
    engine.leftSec = left;

    updateTime();

    // mini rush countdown + urgent tick + fail when time up
    if (engine.miniActive && engine.miniActive.id === 'rush'){
      const leftMs = engine.miniWindowEnd - t;
      if (leftMs <= 0){
        DOC.body.classList.remove('plate-urgent');
        engine.urgent = false;
        failMini('RUSH FAIL! (หมดเวลา)');
      } else {
        if (leftMs <= 2200){
          SFX.tick(leftMs);
        }
        if (leftMs <= 1700 && !engine.urgent){
          engine.urgent = true;
          DOC.body.classList.add('plate-urgent');
        }
      }
    }

    // mini clean streak pass
    if (engine.miniActive && engine.miniActive.id === 'clean'){
      const sec = (t - (engine._cleanStartMs||t)) / 1000;
      if (sec >= 10) passMini();
    }

    // mini fever pop pass
    if (engine.miniActive && engine.miniActive.id === 'fever'){
      if (engine._feverPopped) passMini();
    }

    // adaptive (play only)
    if (engine.runMode === 'play'){
      const denom = Math.max(1, engine.nHitGood + engine.nHitJunk);
      const acc = engine.nHitGood / denom;
      const heat = clamp((engine.combo/18) + (acc-0.65), 0, 1);

      // spawn faster when heat high, but keep safe
      engine.adapt.spawnMs = clamp(840 - heat*280, 480, 900);
      engine.adapt.ttlMs   = clamp(1750 - heat*280, 1250, 1900);
      engine.adapt.size    = clamp(1.03 - heat*0.10, 0.86, 1.08);
      engine.adapt.junkBias= clamp(0.14 + heat*0.08, 0.10, 0.26);

      engine.ttlMs = engine.adapt.ttlMs;
    }

    // end by time
    if (left <= 0){
      endGame('time');
      return;
    }

    engine.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    const list = Array.from(LAYER.querySelectorAll('.pl-target'));
    list.forEach(el=>{
      try{ root.clearTimeout(el._ttlTimer); }catch(_){}
      try{ el.remove(); }catch(_){}
    });
  }

  // ------------------------------------------------------------
  // End summary overlay (ensure) + Back HUB
  // ------------------------------------------------------------
  function ensureEndOverlay(){
    let ov = DOC.getElementById('endOverlay');
    if (ov) return ov;

    ov = DOC.createElement('div');
    ov.id = 'endOverlay';
    ov.className = 'result-overlay';
    Object.assign(ov.style, {
      position:'fixed', inset:'0',
      display:'none',
      alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.55)',
      zIndex:'9998'
    });

    const card = DOC.createElement('div');
    Object.assign(card.style, {
      width:'min(560px, 92vw)',
      borderRadius:'18px',
      background:'rgba(2,6,23,.88)',
      border:'1px solid rgba(148,163,184,.18)',
      boxShadow:'0 30px 120px rgba(0,0,0,.55)',
      padding:'18px 18px 16px',
      color:'#e5e7eb',
      fontFamily:'system-ui,-apple-system,Segoe UI,sans-serif'
    });
    card.innerHTML = `
      <h2 style="margin:0 0 8px;font-size:20px;">สรุปผล — Balanced Plate VR</h2>
      <div style="opacity:.9;line-height:1.5;font-size:14px;">
        Score: <b id="endScore">0</b> · Rank: <b id="endRank">C</b> · Acc: <b id="endAcc">0%</b><br/>
        ComboMax: <b id="endComboMax">0</b> · Miss: <b id="endMiss">0</b><br/>
        Goals: <b id="endGoals">0/0</b> · Minis: <b id="endMinis">0/0</b>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;">
        <button id="btnRetry" style="padding:10px 14px;border-radius:999px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.18);color:#e5e7eb;font-weight:900;">RETRY</button>
        <button id="btnBackHub" style="padding:10px 14px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.6);color:#e5e7eb;font-weight:900;">กลับ HUB</button>
      </div>
    `;
    ov.appendChild(card);
    DOC.body.appendChild(ov);

    // bind buttons (flush before action)
    const retry = DOC.getElementById('btnRetry');
    const back  = DOC.getElementById('btnBackHub');
    retry && retry.addEventListener('click', async ()=>{
      await flushNowBestEffort('retry');
      root.location.reload();
    });
    back && back.addEventListener('click', async ()=>{
      PlateBoot.goHub();
    });

    return ov;
  }

  function showEndOverlay(detail){
    const ov = ensureEndOverlay();
    const s = DOC.getElementById('endScore'); if (s) s.textContent = String(detail.scoreFinal ?? 0);
    const r = DOC.getElementById('endRank');  if (r) r.textContent = String(detail.grade ?? 'C');
    const a = DOC.getElementById('endAcc');   if (a) a.textContent = String((detail.accuracyGoodPct ?? 0)|0) + '%';
    const cm= DOC.getElementById('endComboMax'); if (cm) cm.textContent = String(detail.comboMax ?? 0);
    const ms= DOC.getElementById('endMiss');     if (ms) ms.textContent = String(detail.misses ?? 0);
    const gl= DOC.getElementById('endGoals');    if (gl) gl.textContent = String(detail.goalsCleared ?? 0) + '/' + String(detail.goalsTotal ?? 0);
    const mn= DOC.getElementById('endMinis');    if (mn) mn.textContent = String(detail.miniCleared ?? 0) + '/' + String(detail.miniTotal ?? 0);

    ov.style.display = 'flex';
  }

  // ------------------------------------------------------------
  // END GAME (✅ FLUSH BEFORE END + store summary)
  // ------------------------------------------------------------
  async function endGame(reason){
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    try{ root.clearTimeout(engine.spawnTimer); }catch(_){}
    try{ root.clearTimeout(engine.tickTimer); }catch(_){}
    clearAllTargets();

    DOC.body.classList.remove('plate-urgent');

    // compute stats
    const acc = accPct();
    const grade = rankFromAcc(acc);
    const avgRt = engine.rtN ? Math.round(engine.rtSum / engine.rtN) : 0;
    const medRt = median(engine.rtList);

    const detail = {
      reason: reason || 'end',

      scoreFinal: engine.score|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,

      goalsCleared: engine.goalsCleared|0,
      goalsTotal: engine.goalsTotal|0,
      miniCleared: engine.miniCleared|0,
      miniTotal: engine.miniTotal|0,

      accuracyGoodPct: acc|0,
      grade,

      avgRtGoodMs: avgRt|0,
      medianRtGoodMs: medRt|0,

      nTargetGoodSpawned: engine.nSpawnGood|0,
      nTargetJunkSpawned: engine.nSpawnJunk|0,
      nTargetStarSpawned: engine.nSpawnStar|0,
      nTargetShieldSpawned: engine.nSpawnShield|0,

      nHitGood: engine.nHitGood|0,
      nHitJunk: engine.nHitJunk|0,
      nHitJunkGuard: engine.nHitJunkGuard|0,
      nExpireGood: engine.nExpireGood|0,

      diff: engine.diff,
      runMode: engine.runMode,
      seed: engine.seed,

      feverValue: engine.fever,
      feverState: engine.feverState
    };

    // save last summary
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(detail));
      localStorage.setItem('hha_last_summary', JSON.stringify(detail));
    }catch(_){}

    // emit end (HUD binder/HTML listeners)
    emit('hha:end', detail);

    // ✅ IMPORTANT: flush BEFORE we show overlay (so data is safe even if user closes)
    await flushNowBestEffort('end');

    // show overlay
    showEndOverlay(detail);
  }

  // ------------------------------------------------------------
  // HUB navigation (✅ FLUSH BEFORE LEAVE)
  // ------------------------------------------------------------
  function buildHubUrl(){
    const hub = String(qs('hub', '../hub.html') || '../hub.html');
    try{
      const u = new URL(hub, root.location.href);
      u.searchParams.set('ts', String(Date.now()));
      return u.toString();
    }catch(_){
      return hub;
    }
  }

  async function goHub(){
    // if not ended yet, end silently (no duplicate overlay glitch)
    if (!engine.ended){
      // end first => will flush too
      await endGame('go_hub');
    } else {
      // ensure flush again (best-effort)
      await flushNowBestEffort('go_hub');
    }
    root.location.href = buildHubUrl();
  }

  // ------------------------------------------------------------
  // Start / Boot
  // ------------------------------------------------------------
  function start(runMode, cfg){
    cfg = cfg || {};

    engine.runMode = (String(runMode||qs('run','play')).toLowerCase() === 'research') ? 'research' : 'play';
    engine.diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
    engine.timeSec = clamp(Number(cfg.time ?? qsInt('time', 90)), 30, 600);

    const sid  = String(qs('sessionId', qs('studentKey','')) || '');
    const ts   = String(qs('ts', Date.now()));
    const seed = String(cfg.seed || qs('seed', sid ? (sid + '|' + ts) : ts));
    engine.seed = seed;

    // deterministic rng:
    // - research: always seeded
    // - play: seeded if provided, else still seeded by ts for stability
    engine.rng = makeRng(seed);

    const dp = diffParams(engine.diff);
    engine.adapt.spawnMs = dp.spawnMs;
    engine.adapt.ttlMs   = dp.ttlMs;
    engine.adapt.size    = dp.size;
    engine.adapt.junkBias= dp.junkBias;

    engine.ttlMs = dp.ttlMs;
    engine.feverGain = dp.feverGain;
    engine.feverLoss = dp.feverLoss;

    // reset gameplay
    engine.running = true;
    engine.ended = false;
    engine.tStartMs = nowMs();
    engine.leftSec = engine.timeSec;

    engine.score=0; engine.combo=0; engine.comboMax=0;
    engine.misses=0;

    engine.nSpawnGood=0; engine.nSpawnJunk=0; engine.nSpawnStar=0; engine.nSpawnShield=0;
    engine.nHitGood=0; engine.nHitJunk=0; engine.nHitJunkGuard=0; engine.nExpireGood=0;

    engine.rtSum=0; engine.rtN=0; engine.rtList=[];

    engine.fever=0; engine.shield=0; engine.feverState='cool';
    updateFeverUI();

    engine.goalIndex=0;
    engine.goalsCleared=0;
    engine.goalsTotal=3;

    engine.miniCleared=0;
    engine.miniTotal=4;

    resetPlate();

    // view
    engine.vx=0; engine.vy=0;
    applyView();

    // ensure end overlay exists but hidden
    ensureEndOverlay().style.display = 'none';

    // start mini chain from 0
    startMini(0);

    // initial HUD
    updateTime();
    updateScore();
    updateQuest();

    emit('hha:coach', { mood:'happy', text:'เริ่มเลย! เติมจานให้สมดุล 🍽️' });

    // kick loops
    try{ root.clearTimeout(engine.spawnTimer); }catch(_){}
    try{ root.clearTimeout(engine.tickTimer); }catch(_){}

    loopSpawn();
    loopTick();
  }

  // Expose Boot API (consistent style)
  const PlateBoot = (root.PlateBoot = root.PlateBoot || {});
  PlateBoot.start = start;
  PlateBoot.endNow = (reason)=> endGame(reason || 'endNow');
  PlateBoot.goHub = goHub;
  PlateBoot.recenter = recenter;

  // bind view controls once
  setupView();

})(typeof window !== 'undefined' ? window : globalThis);
