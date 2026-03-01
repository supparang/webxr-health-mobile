// === /herohealth/fitness-planner/planner.safe.js ===
// HeroHealth • Fitness Planner SAFE — PRODUCTION (Create + Evaluate + Boss Week + Chain + Cooldown + Reward Inbox)
// FULL v20260301-PLANNER-FULL-AUTONEXT-COOLDOWN-AB-EVAL
//
// ✅ MVP Create: 7-day Plan Builder (goals, day limits, load scoring, explainable coach)
// ✅ MVP Evaluate: A/B Session Today + self-report (ok/tired)
// ✅ Boss Week: 1 Boss Day/week (theme-enforced) + Trophy bonus
// ✅ Challenge Chain: Bronze→Silver→Gold (no heavy UI) + Gem bonus
// ✅ Robust launch: absolute URLs + fallback minimal params + safeAssign
// ✅ Hub-wrapper compatible (optional): if hub= is present, keeps back-link stable
// ✅ Seq mode: auto-next second game after return (seq=1&day=&done=)
// ✅ Cooldown daily-once (exercise+pid+day) with theme by goal + pending reward
// ✅ Reward Inbox: combine banners into ONE
//
// NOTE
// - This file is designed to be robust even if your HTML is minimal.
// - Expected HTML: a container #app. If missing, it will build a simple UI.
// - If you already have a richer planner.html UI, this SAFE file will still work,
//   but you may want to map element IDs in the "DOM anchors" section below.

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  /* =======================
   * A) HELPERS
   * ======================= */
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const qi = (k, d=0)=>{ const n = Number(qs(k,'')); return Number.isFinite(n) ? n : d; };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); };
  const nowMs = ()=> Date.now();
  const safeJson = (o, d='')=>{ try{ return JSON.stringify(o);}catch(_){ return d; } };
  const parseJson = (s, d=null)=>{ try{ return JSON.parse(s);}catch(_){ return d; } };

  function absUrl(maybe){
    try{ return new URL(String(maybe||''), location.href).toString(); }catch(_){ return ''; }
  }
  function isUrlOk(u){
    u = String(u||'').trim();
    if(!u) return false;
    if(u.startsWith('javascript:')) return false;
    return true;
  }
  function looksLikeHtml(u){
    u = String(u||'');
    return (u.includes('.html') || u.includes('.htm') || u.includes('/'));
  }
  function safeAssign(url){
    try{ location.assign(url); }
    catch(_){ location.href = url; }
  }

  function loadLS(k, d=null){
    try{
      const raw = localStorage.getItem(k);
      return raw==null ? d : JSON.parse(raw);
    }catch(_){ return d; }
  }
  function saveLS(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){}
  }
  function delLS(k){ try{ localStorage.removeItem(k); }catch(_){} }

  /* =======================
   * B) CANONICAL URLS
   * ======================= */
  function siteBase(){
    try{
      const u = new URL(location.href);
      const cut = u.pathname.split('/herohealth/')[0] || '';
      return `${u.origin}${cut}`;
    }catch(_){ return ''; }
  }
  const SITE_BASE = siteBase();

  function canonHubUrl(){
    const h = String(qs('hub','')||'').trim();
    if(h) return h;
    if(SITE_BASE) return `${SITE_BASE}/herohealth/hub.html`;
    return '';
  }

  function plannerSelfUrl(params){
    // keep existing params but optionally override / add
    const u = new URL(location.href);
    // keep hub/run/pid/seed/view if exists
    const keep = ['hub','run','pid','seed','view','diff','time'];
    const base = new URL(location.href);
    const nu = new URL(base.toString());

    // ensure we keep known ones
    keep.forEach(k=>{
      const v = u.searchParams.get(k);
      if(v!=null && v!=='') nu.searchParams.set(k,v);
    });

    // remove seq markers by default
    ['seq','day','done','cooldownNow','return','coolTheme'].forEach(k=> nu.searchParams.delete(k));

    if(params && typeof params === 'object'){
      Object.keys(params).forEach(k=>{
        const v = params[k];
        if(v===undefined || v===null || v==='') nu.searchParams.delete(k);
        else nu.searchParams.set(k, String(v));
      });
    }
    return nu.toString();
  }

  /* =======================
   * C) CONFIG / DATA MODEL
   * ======================= */
  const ENERGY_BUDGET = 10; // 0..~15 typical; used for overload penalties

  // Games (exercise)
  const GAMES = {
    rhythm:   { id:'rhythm',   name:'Rhythm Boxer',  ico:'🥊', goal:{ endurance:0.55, speed:0.35, balance:0.10 }, baseLoad: 1.0 },
    shadow:   { id:'shadow',   name:'Shadow Breaker',ico:'⚡', goal:{ endurance:0.25, speed:0.65, balance:0.10 }, baseLoad: 1.2 },
    jumpduck: { id:'jumpduck', name:'JumpDuck',     ico:'🦆', goal:{ endurance:0.55, speed:0.35, balance:0.10 }, baseLoad: 1.05 },
    balance:  { id:'balance',  name:'Balance Hold', ico:'🧘', goal:{ endurance:0.25, speed:0.15, balance:0.60 }, baseLoad: 0.95 },
  };

  // Absolute run URLs (as you confirmed)
  const DEFAULT_URLS = {
    shadow:   `${SITE_BASE}/fitness/shadow-breaker.html`,
    rhythm:   `${SITE_BASE}/fitness/rhythm-boxer.html`,
    jumpduck: `${SITE_BASE}/fitness/jump-duck.html`,
    balance:  `${SITE_BASE}/fitness/balance-hold.html`,
  };

  // Plan state
  const DEFAULT_PLAN = ()=>{
    const pid = String(qs('pid','anon')||'anon').trim() || 'anon';
    const run = String(qs('run','play')||'play').toLowerCase();
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const time = clamp(qs('time','80'), 20, 300);
    const seed = String(qs('seed','')||'') || String(Date.now());

    return {
      ver: 'v20260301',
      pid,
      run: (run==='research'?'research':'play'),
      diff: (diff==='easy'||diff==='hard'||diff==='normal') ? diff : 'normal',
      time,
      seed,
      goals: ['endurance'], // endurance|speed|balance
      constraints: {
        limitWeekday: 10, // minutes
        limitWeekend: 14
      },
      urls: Object.assign({}, DEFAULT_URLS),
      days: Array.from({length:7}, (_,i)=>({ dayIndex:i, items:[] })),
      ts: Date.now()
    };
  };

  // Rewards (local, no App Script)
  const REW_KEY = (pid)=> `HHA_PLANNER_REW:${String(pid||'anon').trim()||'anon'}`;
  const loadRewards = ()=>{
    const pid = PLAN.pid || 'anon';
    const r = loadLS(REW_KEY(pid), null) || { xp:0, stickers:{}, badges:{} };
    if(!r.stickers) r.stickers = {};
    if(!r.badges) r.badges = {};
    if(!Number.isFinite(Number(r.xp))) r.xp = 0;
    return r;
  };
  const saveRewards = (r)=>{
    const pid = PLAN.pid || 'anon';
    saveLS(REW_KEY(pid), r);
  };

  // Plan storage
  const PLAN_KEY = (pid)=> `HHA_PLANNER_PLAN:${String(pid||'anon').trim()||'anon'}`;
  const loadPlan = ()=>{
    const pid = String(qs('pid','anon')||'anon').trim() || 'anon';
    const raw = loadLS(PLAN_KEY(pid), null);
    const p = raw && typeof raw === 'object' ? raw : DEFAULT_PLAN();
    // merge defaults
    if(!p.urls) p.urls = Object.assign({}, DEFAULT_URLS);
    Object.keys(DEFAULT_URLS).forEach(k=>{
      if(!p.urls[k]) p.urls[k] = DEFAULT_URLS[k];
    });
    if(!p.constraints) p.constraints = { limitWeekday:10, limitWeekend:14 };
    if(!p.days || !Array.isArray(p.days) || p.days.length!==7){
      p.days = Array.from({length:7}, (_,i)=>({ dayIndex:i, items:[] }));
    }else{
      // normalize items
      p.days.forEach((d,i)=>{
        if(!d || typeof d!=='object') p.days[i] = { dayIndex:i, items:[] };
        if(!Array.isArray(p.days[i].items)) p.days[i].items = [];
      });
    }
    // canonical run/pid/seed from URL (keep research safety)
    p.pid = String(qs('pid', p.pid||'anon')||'anon').trim() || 'anon';
    p.run = (String(qs('run', p.run||'play'))||'play').toLowerCase()==='research' ? 'research' : 'play';
    p.seed = String(qs('seed', p.seed||Date.now())||Date.now());
    p.diff = String(qs('diff', p.diff||'normal')||'normal').toLowerCase();
    p.ts = Date.now();
    return p;
  };
  const savePlan = ()=> saveLS(PLAN_KEY(PLAN.pid), PLAN);

  let PLAN = loadPlan();
  let REW  = loadRewards();

  const RUNTIME = {
    view: String(qs('view','mobile')||'mobile').trim() || 'mobile'
  };

  /* =======================
   * D) DATE / DAY HELPERS
   * ======================= */
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  function dayName(i){ return DAY_NAMES[clamp(i,0,6)]; }
  function localDayKey(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  // map JS Sunday(0) to Mon0..Sun6
  function todayIndexMon0(){
    const d = new Date();
    const js = d.getDay(); // 0 Sun .. 6 Sat
    return (js===0) ? 6 : (js-1);
  }
  function isWeekend(dayIdx){
    return (dayIdx===5 || dayIdx===6); // Sat/Sun
  }

  /* =======================
   * E) SCORING / VECTORS
   * ======================= */
  function getGame(id){ return GAMES[id] || GAMES.rhythm; }

  function itemLoad(it){
    const g = getGame(it.game);
    const min = clamp(it.min,2,20);
    const diff = String(it.diff||'normal');
    const diffMult = diff==='hard' ? 1.25 : (diff==='easy' ? 0.85 : 1.0);
    return g.baseLoad * diffMult * (min/6);
  }
  function dayLoad(day){
    return (day.items||[]).reduce((s,it)=> s + itemLoad(it), 0);
  }
  function dayEnergy(day){
    // energy is just scaled load for budget checks
    return dayLoad(day) * 6; // typical dayLoad ~1.2..2.5 => energy ~7..15
  }
  function dayGoalVector(day){
    const v = { endurance:0, speed:0, balance:0 };
    const items = day.items || [];
    items.forEach(it=>{
      const g = getGame(it.game);
      const min = clamp(it.min,2,20);
      v.endurance += min * g.goal.endurance;
      v.speed     += min * g.goal.speed;
      v.balance   += min * g.goal.balance;
    });
    return v;
  }

  function scorePlan(plan){
    // Balanced load (prefer medium over extremes)
    let loads = plan.days.map(d=> dayLoad(d));
    const mean = loads.reduce((a,b)=>a+b,0) / (loads.length||1);
    const varr = loads.reduce((s,x)=> s + Math.pow(x-mean,2), 0) / (loads.length||1);
    const balanced = clamp(100 - varr*35, 0, 100);

    // Consistency: count non-empty days
    const active = plan.days.filter(d=> (d.items||[]).length>0).length;
    const consistency = clamp(active * 14, 0, 100);

    // Realism: penalize days over limits
    let realism = 100;
    for(let i=0;i<7;i++){
      const d = plan.days[i];
      const mins = (d.items||[]).reduce((s,it)=> s+clamp(it.min,2,20), 0);
      const lim = isWeekend(i) ? plan.constraints.limitWeekend : plan.constraints.limitWeekday;
      if(mins > lim) realism -= (mins-lim)*10;
      if(dayEnergy(d) > ENERGY_BUDGET*1.15) realism -= 12;
    }
    realism = clamp(realism, 0, 100);

    // Goal fit: compare normalized day vectors to plan goals
    const goals = plan.goals || ['endurance'];
    let want = { endurance:0, speed:0, balance:0 };
    goals.forEach(g=>{ if(want[g]!==undefined) want[g]=1; });
    let wSum = want.endurance + want.speed + want.balance;
    if(!wSum) wSum=1;
    want.endurance/=wSum; want.speed/=wSum; want.balance/=wSum;

    let distSum = 0;
    plan.days.forEach(d=>{
      const v = dayGoalVector(d);
      const s = v.endurance+v.speed+v.balance;
      if(!s) return;
      const r = { endurance:v.endurance/s, speed:v.speed/s, balance:v.balance/s };
      const dist = Math.abs(r.endurance-want.endurance)+Math.abs(r.speed-want.speed)+Math.abs(r.balance-want.balance);
      distSum += dist;
    });
    const goalFit = clamp(100 - (distSum*10), 0, 100);

    // Bonus from boss + gold chain
    const bossIdx = detectBossDay(plan);
    let bonus = 0;
    if(bossIdx >= 0) bonus += 4;
    for(const d of plan.days){
      if(challengeScore(d) >= 5) bonus += 2;
    }

    const total = Math.round(balanced*0.30 + consistency*0.25 + realism*0.25 + goalFit*0.20 + bonus);
    return { total, balanced:Math.round(balanced), consistency:Math.round(consistency), realism:Math.round(realism), goalFit:Math.round(goalFit), bonus };
  }

  /* =======================
   * F) BOSS WEEK + CHAIN
   * ======================= */
  function detectBossDay(plan){
    let bestIdx = -1;
    let bestLoad = 0;

    for(let i=0;i<7;i++){
      const d = plan.days[i];
      if(!d.items || d.items.length < 2) continue;

      const load = dayLoad(d);
      const energy = dayEnergy(d);

      // ต้องท้าทายแต่ไม่ overload
      if(energy > ENERGY_BUDGET * 1.15) continue;

      if(load > bestLoad){
        bestLoad = load;
        bestIdx = i;
      }
    }
    return bestIdx;
  }
  function bossTheme(day){
    const v = dayGoalVector(day);
    if(v.speed > v.endurance && v.speed > v.balance) return 'speed';
    if(v.balance > v.endurance) return 'balance';
    return 'endurance';
  }
  function themeLabel(th){
    return th==='speed'?'ความไว' : th==='balance'?'ทรงตัว' : 'ความทน';
  }
  function gameTheme(gameId){
    if(gameId==='balance') return 'balance';
    if(gameId==='shadow') return 'speed';
    if(gameId==='rhythm') return 'endurance';
    if(gameId==='jumpduck') return 'endurance';
    return 'endurance';
  }
  function normalizeBossDay(plan, bossIdx){
    if(bossIdx < 0) return;
    const d = plan.days[bossIdx];
    if(!d || !d.items || d.items.length < 2) return;

    const th = bossTheme(d);
    const t0 = gameTheme(d.items[0].game);
    const t1 = gameTheme(d.items[1].game);

    if(t0 !== th){
      d.items[0].game = (th==='balance') ? 'balance' : (th==='speed' ? 'shadow' : 'rhythm');
    }
    if(t1 !== th){
      d.items[1].game = (th==='balance') ? 'balance' : (th==='speed' ? 'shadow' : 'jumpduck');
    }

    if(d.items[0].game==='balance' && d.items[1].game==='balance'){
      d.items[1].game='rhythm';
      d.items[1].diff='easy';
      d.items[1].min = Math.min(4, clamp(d.items[1].min,2,20));
    }
  }

  // Challenge Chain
  function challengeTier(item){
    const min = clamp(item.min,2,20);
    if(item.diff === 'hard' && min >= 7) return 'gold';
    if(item.diff === 'normal' && min >= 5) return 'silver';
    return 'bronze';
  }
  function challengeScore(day){
    let score = 0;
    for(const it of (day.items||[])){
      const t = challengeTier(it);
      score += (t==='gold') ? 3 : (t==='silver' ? 2 : 1);
    }
    return score;
  }

  /* =======================
   * G) EVALUATE A/B
   * ======================= */
  function sessionMinutes(items){
    return (items||[]).reduce((s,it)=>s + clamp(it.min,2,20), 0);
  }
  function sessionEnergy(items){
    return dayEnergy({ items: items||[] });
  }
  function sessionLoad(items){
    return dayLoad({ items: items||[] });
  }
  function goalFitScore(items){
    const v = { endurance:0, speed:0, balance:0 };
    for(const it of (items||[])){
      const g = getGame(it.game);
      const min = clamp(it.min,2,20);
      v.endurance += min * g.goal.endurance;
      v.speed     += min * g.goal.speed;
      v.balance   += min * g.goal.balance;
    }
    const sum = v.endurance + v.speed + v.balance;
    if(!sum) return 0;

    const ratio = { endurance:v.endurance/sum, speed:v.speed/sum, balance:v.balance/sum };

    const want = { endurance:0, speed:0, balance:0 };
    const goals = PLAN.goals || ['endurance'];
    for(const g of goals) want[g] = 1;
    const wSum = want.endurance + want.speed + want.balance || 1;
    want.endurance/=wSum; want.speed/=wSum; want.balance/=wSum;

    const dist = Math.abs(ratio.endurance - want.endurance)
               + Math.abs(ratio.speed     - want.speed)
               + Math.abs(ratio.balance   - want.balance);

    return clamp(100 - dist*120, 0, 100);
  }
  function evaluateSession(items, fatigue){
    const mins = sessionMinutes(items);
    const load = sessionLoad(items);
    const energy = sessionEnergy(items);

    let score = goalFitScore(items) * 0.55;

    const overE = Math.max(0, energy - ENERGY_BUDGET);
    score -= overE * 10;

    if(fatigue === 'tired'){
      if(energy > ENERGY_BUDGET*0.95) score -= 12;
      if((items||[]).some(it=>it.diff==='hard')) score -= 10;
    }

    const dayLimit = isWeekend(todayIndexMon0()) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;
    if(mins > dayLimit) score -= (mins - dayLimit) * 8;

    if((items||[]).length===2) score += 4;

    score = clamp(score, 0, 100);
    return { score: Math.round(score), mins, load: Number(load.toFixed(1)), energy: Number(energy.toFixed(1)) };
  }

  function proposeSessionsForToday(dayIdx){
    const limit = isWeekend(dayIdx) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;

    const A = {
      name: 'A (Balanced Pair)',
      items: [
        { game:'rhythm', diff:'normal', min: Math.min(6, limit) },
        { game:'balance', diff:'easy',  min: Math.min(4, Math.max(3, limit-6)) },
      ].slice(0,2)
    };

    const B = {
      name: 'B (Single Boss)',
      items: [
        { game:'shadow', diff:'hard', min: Math.min(8, limit) }
      ]
    };

    return { A, B };
  }

  /* =======================
   * H) AI DIRECTOR (research-safe)
   * ======================= */
  const AI_ON = (PLAN.run !== 'research') && (String(qs('ai','0')) === '1');

  function aiDirectorAdjustPlan(plan){
    if(!AI_ON) return;

    for(let i=0;i<7;i++){
      const d = plan.days[i];
      if(!d.items || !d.items.length) continue;

      let energy = dayEnergy(d);
      if(energy <= ENERGY_BUDGET) continue;

      for(const it of d.items){
        if(energy <= ENERGY_BUDGET) break;
        if(it.diff === 'hard'){
          it.diff = 'normal';
          energy = dayEnergy(d);
        }
      }
      for(const it of d.items){
        if(energy <= ENERGY_BUDGET) break;
        if(it.diff === 'normal'){
          it.diff = 'easy';
          energy = dayEnergy(d);
        }
      }
      for(const it of d.items){
        if(energy <= ENERGY_BUDGET) break;
        const m = clamp(it.min,2,20);
        if(m > 4){
          it.min = m - 1;
          energy = dayEnergy(d);
        }
      }
    }
  }

  /* =======================
   * I) COOLDOWN (daily-once) + THEME + PENDING REWARD
   * ======================= */
  function cooldownDoneKey(zone, pid){
    const z = String(zone||'exercise').toLowerCase().trim() || 'exercise';
    const p = String(pid||'anon').trim() || 'anon';
    return `HHA_COOLDOWN_DONE:${z}:${p}:${localDayKey()}`;
  }
  function isCooldownDone(zone, pid){
    try{ return localStorage.getItem(cooldownDoneKey(zone,pid)) === '1'; }catch(_){ return false; }
  }
  function setCooldownDone(zone, pid){
    try{ localStorage.setItem(cooldownDoneKey(zone,pid), '1'); }catch(_){}
  }

  function cooldownPendingKey(zone, pid){
    const z = String(zone||'exercise').toLowerCase().trim() || 'exercise';
    const p = String(pid||'anon').trim() || 'anon';
    return `HHA_COOLDOWN_PENDING:${z}:${p}:${localDayKey()}`;
  }
  function getCooldownPending(zone, pid){
    try{
      const raw = localStorage.getItem(cooldownPendingKey(zone,pid));
      return raw ? JSON.parse(raw) : null;
    }catch(_){ return null; }
  }
  function setCooldownPending(zone, pid, data){
    try{ localStorage.setItem(cooldownPendingKey(zone,pid), JSON.stringify(data||{})); }catch(_){}
  }
  function clearCooldownPending(zone, pid){
    try{ localStorage.removeItem(cooldownPendingKey(zone,pid)); }catch(_){}
  }

  function cooldownStreakKey(zone, pid){
    const z = String(zone||'exercise').toLowerCase().trim() || 'exercise';
    const p = String(pid||'anon').trim() || 'anon';
    return `HHA_COOLDOWN_STREAK:${z}:${p}`;
  }
  function loadCooldownStreak(zone, pid){
    try{
      const raw = localStorage.getItem(cooldownStreakKey(zone,pid));
      return raw ? JSON.parse(raw) : { day:'', streak:0 };
    }catch(_){ return { day:'', streak:0 }; }
  }
  function saveCooldownStreak(zone, pid, d){
    try{ localStorage.setItem(cooldownStreakKey(zone,pid), JSON.stringify(d||{})); }catch(_){}
  }

  function pickCooldownThemeForToday(dayIdx){
    const d = (PLAN.days && PLAN.days[dayIdx]) ? PLAN.days[dayIdx] : null;
    if(d && d.items && d.items.length){
      const v = dayGoalVector(d);
      if(v.speed > v.endurance && v.speed > v.balance) return 'shadow';
      if(v.balance > v.endurance) return 'balance';
      return 'rhythm';
    }
    const goals = PLAN.goals || ['endurance'];
    if(goals.includes('speed')) return 'shadow';
    if(goals.includes('balance')) return 'balance';
    return 'rhythm';
  }

  function maybeStartCooldownNow(){
    const cnow = String(qs('cooldownNow','')).trim();
    if(cnow !== '1') return false;

    const pid = PLAN.pid || 'anon';
    if(isCooldownDone('exercise', pid)){
      try{
        const u = new URL(location.href);
        u.searchParams.delete('cooldownNow');
        u.searchParams.delete('return');
        u.searchParams.delete('coolTheme');
        history.replaceState(null,'',u.toString());
      }catch(_){}
      return false;
    }

    const ret = String(qs('return','')).trim() || plannerSelfUrl(null);
    const theme = String(qs('coolTheme','')).trim() || 'rhythm';

    // warmup-gate.html lives at /herohealth/warmup-gate.html
    const gate = `${SITE_BASE}/herohealth/warmup-gate.html`;
    const g = new URL(gate);

    g.searchParams.set('gatePhase','cooldown');
    g.searchParams.set('cat','exercise');
    g.searchParams.set('theme', theme);
    g.searchParams.set('pid', pid);
    g.searchParams.set('run', (PLAN.run==='research'?'research':'play'));
    g.searchParams.set('diff', PLAN.diff || 'normal');
    g.searchParams.set('seed', PLAN.seed);
    g.searchParams.set('view', RUNTIME.view);
    g.searchParams.set('hub', ret);
    g.searchParams.set('next', ret);
    g.searchParams.set('cdur', '15');

    // mark done immediately to prevent loops/spam
    setCooldownDone('exercise', pid);
    // set pending reward claim back at planner
    setCooldownPending('exercise', pid, { theme, ts: Date.now(), claimed:false });

    safeAssign(g.toString());
    return true;
  }

  function goCooldownGateAfterSession(returnUrl, dayIdxOverride){
    const pid = PLAN.pid || 'anon';
    if(isCooldownDone('exercise', pid)) return false;

    const dayIdx = (typeof dayIdxOverride==='number' && dayIdxOverride>=0) ? dayIdxOverride : todayIndexMon0();
    const coolTheme = pickCooldownThemeForToday(dayIdx);

    const hub = canonHubUrl();
    const next = String(returnUrl || plannerSelfUrl(null));

    // We bounce through planner with cooldownNow flag (simple & reliable)
    const u = new URL(next);
    u.searchParams.set('cooldownNow','1');
    u.searchParams.set('return', next);
    u.searchParams.set('coolTheme', coolTheme);
    safeAssign(u.toString());
    return true;
  }

  /* =======================
   * J) REWARD INBOX (single banner)
   * ======================= */
  function rewardInboxKey(pid){
    const p = String(pid||'anon').trim()||'anon';
    return `HHA_PLANNER_INBOX:${p}:${localDayKey()}`;
  }
  function inboxLoad(pid){
    try{
      const raw = sessionStorage.getItem(rewardInboxKey(pid));
      return raw ? JSON.parse(raw) : [];
    }catch(_){ return []; }
  }
  function inboxPush(pid, item){
    try{
      const arr = inboxLoad(pid);
      arr.push(Object.assign({ ts: Date.now() }, item||{}));
      sessionStorage.setItem(rewardInboxKey(pid), JSON.stringify(arr));
    }catch(_){}
  }
  function inboxClear(pid){
    try{ sessionStorage.removeItem(rewardInboxKey(pid)); }catch(_){}
  }

  // banner UI
  function showRewardBanner(msg){
    msg = String(msg||'').trim();
    if(!msg) return;
    ensureUI();
    elBanner.textContent = msg;
    elBanner.classList.add('show');
    setTimeout(()=> elBanner.classList.remove('show'), 3600);
  }

  function showCombinedRewardBannerIfAny(){
    const pid = PLAN.pid || 'anon';
    const arr = inboxLoad(pid);
    if(!arr || !arr.length) return false;

    // throttle
    const k = 'HHA_PLANNER_LAST_COMBINED_BANNER';
    const last = Number(loadLS(k, 0)) || 0;
    if(Date.now() - last < 1200) return false;
    saveLS(k, Date.now());

    const xp = arr.reduce((s,it)=>s + (Number(it.xp)||0), 0);
    const stickers = arr.filter(it=>it.sticker).map(it=>it.sticker);
    const tags = arr.filter(it=>it.tag).map(it=>it.tag);
    const extras = arr.filter(it=>it.extra).map(it=>it.extra);

    const stTxt = stickers.length ? ` ${stickers.join('')}` : '';
    const tagTxt = tags.length ? ` · ${tags.join(' · ')}` : '';
    const exTxt  = extras.length ? ` · โบนัส: ${extras.join(' / ')}` : '';

    showRewardBanner(`🎉 ได้รางวัลแล้ว!${stTxt} +${xp} XP${tagTxt}${exTxt}`);
    inboxClear(pid);
    return true;
  }

  /* =======================
   * K) DAILY REWARD + COOLDOWN REWARD (push to inbox)
   * ======================= */
  const STK_EMOJI = ['🟦','🟥','🟩','🟪','🟨','🟧','⬛'];
  const TROPHY = '🏆';
  const GEM = '💎';

  function dailyChallenge(dayIdx){
    // Simple daily tag based on weekday for motivation
    const tags = ['FOCUS','POWER','FLOW','BALANCE','SPEED','FUN','BOSS'];
    const tag = tags[clamp(dayIdx,0,6)];
    // xp add small
    const xp = (tag==='BOSS') ? 8 : 4;
    return { tag, xp };
  }

  function awardTodayIfEligible(dayIdx){
    REW = loadRewards();
    if(REW.stickers[dayIdx]) return { awarded:false };

    const day = PLAN.days[dayIdx] || { items:[] };
    if(!day.items || !day.items.length) return { awarded:false };

    // require that day has been "played" — MVP rule: if user has arrived with seq done markers OR clicked "Claim"
    // In this SAFE, we accept that finishing the seq will call this explicitly.
    const ch = dailyChallenge(dayIdx);
    const baseXP = 20;
    const bonusCh = Number(ch.xp)||0;

    const bossIdx = detectBossDay(PLAN);
    const isBoss = (bossIdx === dayIdx);

    const chain = challengeScore(day);
    const isGoldChain = (chain >= 5);

    const bossXP = isBoss ? 10 : 0;
    const chainXP = isGoldChain ? 8 : 0;

    const totalXP = baseXP + bonusCh + bossXP + chainXP;

    REW.stickers[dayIdx] = true;
    REW.xp = (Number(REW.xp)||0) + totalXP;
    REW.lastEarnTs = Date.now();
    saveRewards(REW);
    renderRewards();

    const extras = [];
    if(isBoss) extras.push(`${TROPHY} Boss +${bossXP}`);
    if(isGoldChain) extras.push(`${GEM} Gold +${chainXP}`);

    inboxPush(PLAN.pid||'anon', {
      kind: 'daily',
      xp: totalXP,
      sticker: STK_EMOJI[dayIdx],
      tag: `Challenge [${ch.tag}]`,
      extra: extras.length ? extras.join(' / ') : ''
    });

    return { awarded:true, xp:totalXP };
  }

  function awardCooldownRewardIfAny(){
    const pid = PLAN.pid || 'anon';
    const zone = 'exercise';

    if(!isCooldownDone(zone, pid)) return false;

    const pending = getCooldownPending(zone, pid);
    if(!pending || pending.claimed) return false;

    REW = loadRewards();

    const theme = String(pending.theme || 'rhythm');
    const themeEmoji = (theme==='shadow')?'⚡' : (theme==='balance')?'🧘' : '🎵';

    let xp = 12;

    const today = localDayKey();
    const st = loadCooldownStreak(zone, pid);

    if(st.day !== today){
      let isConsecutive = false;
      try{
        const d = new Date();
        const y = new Date(d.getFullYear(), d.getMonth(), d.getDate()-1);
        const yyyy = y.getFullYear();
        const mm = String(y.getMonth()+1).padStart(2,'0');
        const dd = String(y.getDate()).padStart(2,'0');
        const yKey = `${yyyy}-${mm}-${dd}`;
        isConsecutive = (st.day === yKey);
      }catch(_){}

      const newStreak = isConsecutive ? (Number(st.streak)||0) + 1 : 1;
      saveCooldownStreak(zone, pid, { day: today, streak: newStreak });

      xp += Math.min(10, newStreak * 2);
    }

    const st2 = loadCooldownStreak(zone, pid);
    const s = Number(st2.streak)||1;

    const b0 = 'cooldown_starter';
    const b3 = 'cooldown_streak_3';
    const b7 = 'cooldown_streak_7';

    if(!REW.badges) REW.badges = {};
    if(!REW.badges[b0]) REW.badges[b0] = { ts: Date.now(), name:'Calm Starter', ico:'🌿' };
    if(s >= 3 && !REW.badges[b3]) REW.badges[b3] = { ts: Date.now(), name:'Calm Streak 3', ico:'🧊' };
    if(s >= 7 && !REW.badges[b7]) REW.badges[b7] = { ts: Date.now(), name:'Calm Streak 7', ico:'🏅' };

    REW.xp = (Number(REW.xp)||0) + xp;
    saveRewards(REW);
    renderRewards();

    pending.claimed = true;
    setCooldownPending(zone, pid, pending);

    inboxPush(PLAN.pid||'anon', {
      kind: 'cooldown',
      xp: xp,
      tag: `Cooldown ${themeEmoji}`,
      extra: `Streak ${s} วัน`
    });

    clearCooldownPending(zone, pid);
    return true;
  }

  /* =======================
   * L) LAUNCH (robust) + SEQ
   * ======================= */
  function gameUrl(gameId){
    const u = (PLAN.urls && PLAN.urls[gameId]) ? PLAN.urls[gameId] : (DEFAULT_URLS[gameId]||'');
    return String(u||'').trim();
  }

  function withParams(base, params){
    const u = new URL(absUrl(base));
    Object.keys(params||{}).forEach(k=>{
      const v = params[k];
      if(v===undefined || v===null || v==='') return;
      u.searchParams.set(k, String(v));
    });
    return u.toString();
  }

  function launchGameItem(it, dayIdx, itemIdx, seqMode){
    const raw = gameUrl(it.game);
    if(!isUrlOk(raw)){
      toast('ยังไม่ตั้ง URL เกม หรือ URL ไม่ถูกต้อง');
      openUrlModal();
      return;
    }

    const baseUrl = absUrl(raw);
    if(!baseUrl || !looksLikeHtml(baseUrl)){
      toast('URL เกมดูไม่ถูกต้อง (ลองตั้งค่าใหม่)');
      openUrlModal();
      return;
    }

    const min = clamp(it.min, 2, 20);
    const diff = (it.diff==='easy' || it.diff==='normal' || it.diff==='hard') ? it.diff : 'normal';

    const back = seqMode
      ? plannerSelfUrl({ seq: 1, day: dayIdx, done: itemIdx })
      : plannerSelfUrl(null);

    const paramsFull = {
      pid: PLAN.pid,
      run: (PLAN.run==='research' ? 'research' : 'play'),
      diff,
      time: String(min * 60),
      seed: PLAN.seed,
      view: RUNTIME.view,
      hub: back
    };
    const urlFull = withParams(baseUrl, paramsFull);

    const paramsMin = {
      pid: PLAN.pid,
      run: (PLAN.run==='research' ? 'research' : 'play'),
      diff,
      seed: PLAN.seed
    };
    const urlMin = withParams(baseUrl, paramsMin);

    const failKey = 'HHA_PLANNER_LAST_LAUNCH_FAIL';
    const lastFail = loadLS(failKey, null);
    const now = Date.now();

    const chosen = (lastFail && lastFail.game===it.game && (now - lastFail.ts) < 8000) ? urlMin : urlFull;
    saveLS(failKey, { game: it.game, ts: now, mode: (chosen===urlMin?'min':'full') });

    safeAssign(chosen);
  }

  function autoContinueSeqIfAny(){
    const seq = String(qs('seq','')).trim();
    if(seq !== '1') return false;

    const dayIdx = qi('day', -1);
    const doneIdx = qi('done', -1);

    if(dayIdx < 0 || doneIdx < 0) return false;

    const d = PLAN.days && PLAN.days[dayIdx];
    if(!d || !d.items || !d.items.length) return false;

    const nextIdx = doneIdx + 1;

    // Clean URL first to prevent loops
    try{
      const u = new URL(location.href);
      ['seq','day','done'].forEach(k=> u.searchParams.delete(k));
      history.replaceState(null, '', u.toString());
    }catch(_){}

    if(nextIdx >= d.items.length){
      // session finished -> award daily + cooldown
      awardTodayIfEligible(dayIdx);

      const ret = plannerSelfUrl(null);
      // go cooldown (once/day) after finishing session
      if(goCooldownGateAfterSession(ret, dayIdx)) return true;

      return false;
    }

    // guard duplicate auto launch
    const key = 'HHA_PLANNER_SEQ_LAST';
    const last = loadLS(key, null);
    const now = Date.now();
    if(last && last.day===dayIdx && last.next===nextIdx && (now - last.ts) < 1200){
      return false;
    }
    saveLS(key, { day: dayIdx, next: nextIdx, ts: now });

    setTimeout(()=>{
      launchGameItem(d.items[nextIdx], dayIdx, nextIdx, true);
    }, 650);

    return true;
  }

  /* =======================
   * M) AUTO FILL (MVP Create)
   * ======================= */
  function autoFillPlan(){
    // simple auto build: 5 active days + weekend optional
    const goals = PLAN.goals || ['endurance'];
    const main = goals.includes('speed') ? 'speed' : (goals.includes('balance') ? 'balance' : 'endurance');

    // reset
    PLAN.days = Array.from({length:7}, (_,i)=>({ dayIndex:i, items:[] }));

    const makeItem = (game, diff, min)=>({ game, diff, min });

    for(let i=0;i<7;i++){
      const lim = isWeekend(i) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;

      // choose 0..2 sessions
      if(i===6) continue; // Sun off by default

      if(main==='speed'){
        PLAN.days[i].items.push(makeItem('shadow', (i%3===0?'hard':'normal'), Math.min(lim, i%3===0?8:6)));
        if(i%2===0) PLAN.days[i].items.push(makeItem('jumpduck', 'easy', Math.min(4, Math.max(3, lim-6))));
      }else if(main==='balance'){
        PLAN.days[i].items.push(makeItem('balance', (i%3===0?'normal':'easy'), Math.min(lim, 6)));
        if(i%2===0) PLAN.days[i].items.push(makeItem('rhythm', 'easy', Math.min(4, Math.max(3, lim-6))));
      }else{
        PLAN.days[i].items.push(makeItem('rhythm', (i%3===0?'normal':'easy'), Math.min(lim, 6)));
        if(i%2===0) PLAN.days[i].items.push(makeItem('balance', 'easy', Math.min(4, Math.max(3, lim-6))));
      }

      // enforce per-day limit
      let mins = PLAN.days[i].items.reduce((s,it)=>s+clamp(it.min,2,20),0);
      while(mins > lim && PLAN.days[i].items.length){
        PLAN.days[i].items[PLAN.days[i].items.length-1].min = Math.max(3, PLAN.days[i].items[PLAN.days[i].items.length-1].min - 1);
        mins = PLAN.days[i].items.reduce((s,it)=>s+clamp(it.min,2,20),0);
        if(mins <= lim) break;
        PLAN.days[i].items.pop();
        mins = PLAN.days[i].items.reduce((s,it)=>s+clamp(it.min,2,20),0);
      }
    }

    // ensure Boss Day thematic consistency
    const bossIdx = detectBossDay(PLAN);
    normalizeBossDay(PLAN, bossIdx);

    // AI adjust (if enabled)
    aiDirectorAdjustPlan(PLAN);

    PLAN.ts = Date.now();
    savePlan();
  }

  /* =======================
   * N) COACH (explainable)
   * ======================= */
  function coachReasons(plan){
    const out = [];

    if(AI_ON){
      out.push({ cls:'good', t:'🤖 AI Director เปิดอยู่ (play เท่านั้น) — ปรับให้ไม่โอเวอร์โหลดอัตโนมัติ' });
    }

    const s = scorePlan(plan);
    out.push({ cls:'good', t:`คะแนนแผนรวม ${s.total}/100 (บาลานซ์ ${s.balanced} · สม่ำเสมอ ${s.consistency} · สมจริง ${s.realism} · ตรงเป้าหมาย ${s.goalFit})` });

    const bossIdx = detectBossDay(plan);
    if(bossIdx >= 0){
      const theme = bossTheme(plan.days[bossIdx]);
      out.unshift({ cls:'good', t:`🔥 Boss Day = ${dayName(bossIdx)} (ธีม ${themeLabel(theme)}) — วันท้าทายประจำสัปดาห์!` });
    }

    // chain hints
    for(let i=0;i<7;i++){
      const d = plan.days[i];
      if(!d.items || !d.items.length) continue;

      const cs = challengeScore(d);
      if(cs >= 5){
        out.push({ cls:'good', t:`🏆 ${dayName(i)} ทำ Challenge Chain ระดับ GOLD — ไต่ระดับดีมาก` });
      }else if(cs >= 3){
        out.push({ cls:'warn', t:`🥈 ${dayName(i)} มี chain ต่อเนื่อง ลองเพิ่ม hard เพื่อ Gold` });
      }
    }

    // overload warnings
    for(let i=0;i<7;i++){
      const d = plan.days[i];
      if(!d.items || !d.items.length) continue;
      const e = dayEnergy(d);
      if(e > ENERGY_BUDGET*1.15){
        out.push({ cls:'warn', t:`⚠️ ${dayName(i)} หนักไปหน่อย (energy ${e.toFixed(1)}/${ENERGY_BUDGET}) ลองลดนาทีหรือ diff` });
      }
    }

    return out.slice(0, 10);
  }

  /* =======================
   * O) UI (build if missing)
   * ======================= */
  let elApp, elTop, elGrid, elTry, elCoach, elRewards, elBanner, elToast;
  let elUrlModal, elUrlForm;

  function ensureUI(){
    elApp = DOC.getElementById('app') || DOC.body;

    if(!DOC.getElementById('hhaPlannerStyle')){
      const st = DOC.createElement('style');
      st.id = 'hhaPlannerStyle';
      st.textContent = `
        :root{ --bg:#050815; --fg:#e8eefc; --mut:#9fb0d0; --card:#0b1226; --bd:rgba(255,255,255,.14); --good:#36d399; --warn:#fbbf24; --bad:#fb7185; }
        html,body{ margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; }
        .wrap{ max-width:980px; margin:0 auto; padding:14px 12px 80px; }
        .row{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .card{ border:1px solid var(--bd); background:rgba(3,8,23,.55); border-radius:16px; padding:12px; }
        .btn{ border:1px solid var(--bd); background:rgba(255,255,255,.06); color:var(--fg); padding:10px 12px; border-radius:14px; font-weight:900; cursor:pointer; }
        .btn.ghost{ background:transparent; }
        .btn.small{ padding:7px 10px; border-radius:12px; font-weight:900; }
        .pill{ border:1px solid var(--bd); background:rgba(255,255,255,.05); padding:6px 10px; border-radius:999px; font-weight:900; color:var(--mut); }
        .grid7{ display:grid; grid-template-columns:repeat(7, minmax(120px, 1fr)); gap:10px; overflow:auto; padding-bottom:4px; }
        .day h4{ margin:0 0 8px; font-size:13px; letter-spacing:.2px; color:var(--mut); display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .item{ border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:8px 10px; margin-bottom:8px; background:rgba(0,0,0,.12); }
        .item .meta{ color:var(--mut); font-size:12px; margin-top:4px; }
        .tag.good{ color:var(--good); font-weight:1100; }
        .tag.warn{ color:var(--warn); font-weight:1100; }
        .tag.bad{ color:var(--bad); font-weight:1100; }
        .banner{ position:fixed; left:12px; right:12px; top:10px; max-width:980px; margin:0 auto; z-index:50;
          border:1px solid var(--bd); background:rgba(0,0,0,.72); padding:10px 12px; border-radius:16px;
          transform:translateY(-18px); opacity:0; transition:all .18s ease; }
        .banner.show{ transform:translateY(0); opacity:1; }
        .toast{ position:fixed; left:12px; right:12px; bottom:14px; max-width:980px; margin:0 auto; z-index:60;
          border:1px solid var(--bd); background:rgba(0,0,0,.78); padding:10px 12px; border-radius:16px;
          transform:translateY(18px); opacity:0; transition:all .18s ease; }
        .toast.show{ transform:translateY(0); opacity:1; }
        .modal{ position:fixed; inset:0; z-index:80; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.55); }
        .modal.show{ display:flex; }
        .modal .panel{ width:min(760px, 94vw); }
        input,select{ width:100%; box-sizing:border-box; padding:10px 12px; border-radius:12px; border:1px solid var(--bd);
          background:rgba(255,255,255,.06); color:var(--fg); outline:none; font-weight:800; }
        label{ display:block; color:var(--mut); font-size:12px; font-weight:900; margin:10px 0 6px; }
      `;
      DOC.head.appendChild(st);
    }

    if(!DOC.getElementById('plannerRoot')){
      const wrap = DOC.createElement('div');
      wrap.id = 'plannerRoot';
      wrap.className = 'wrap';
      wrap.innerHTML = `
        <div class="banner" id="rewardBanner" aria-live="polite"></div>
        <div class="toast" id="toast" aria-live="polite"></div>

        <div class="row" style="justify-content:space-between; margin-bottom:10px;">
          <div class="row">
            <span class="pill">pid=<b id="uiPid"></b></span>
            <span class="pill">run=<b id="uiRun"></b></span>
            <span class="pill">seed=<b id="uiSeed"></b></span>
          </div>
          <div class="row">
            <button class="btn small" id="btnAuto">✨ Auto Plan</button>
            <button class="btn small" id="btnUrls">🔧 URLs</button>
          </div>
        </div>

        <div class="card" style="margin-bottom:10px;">
          <div class="row" style="justify-content:space-between;">
            <div style="font-weight:1200; font-size:16px;">📅 7-day Plan Builder</div>
            <div class="row">
              <span class="pill">XP: <b id="uiXp">0</b></span>
              <span class="pill">Stickers: <b id="uiStk">0</b></span>
            </div>
          </div>

          <div class="row" style="margin-top:10px;">
            <span style="font-weight:1000; color:var(--mut);">Goal:</span>
            <button class="btn small" id="goalEnd">ความทน</button>
            <button class="btn small ghost" id="goalSpeed">ความไว</button>
            <button class="btn small ghost" id="goalBal">ทรงตัว</button>

            <span style="margin-left:auto; font-weight:1000; color:var(--mut);">Limit:</span>
            <span class="pill">weekday <b id="uiWk">10</b>m</span>
            <span class="pill">weekend <b id="uiWe">14</b>m</span>
          </div>
        </div>

        <div class="grid7" id="weekGrid"></div>

        <div class="row" style="margin-top:12px;">
          <div class="card" style="flex:1; min-width:280px;">
            <div style="font-weight:1200;">🧑‍🏫 Coach (Explainable)</div>
            <div id="coachList" style="margin-top:8px;"></div>
          </div>
          <div class="card" style="flex:1; min-width:280px;">
            <div style="font-weight:1200;">🎯 Try Today</div>
            <div id="tryList" style="margin-top:8px;"></div>
          </div>
        </div>

        <div class="modal" id="urlModal" role="dialog" aria-modal="true">
          <div class="panel card">
            <div class="row" style="justify-content:space-between;">
              <div style="font-weight:1200;">🔧 ตั้งค่า URL เกม (Run)</div>
              <button class="btn small ghost" id="urlClose">ปิด</button>
            </div>
            <div id="urlForm"></div>
            <div class="row" style="justify-content:flex-end; margin-top:12px;">
              <button class="btn" id="urlSave">บันทึก</button>
            </div>
            <div style="margin-top:10px; color:var(--mut); font-size:12px;">
              แนะนำ: ใช้ URL แบบ absolute เพื่อกันหลุดโฟลเดอร์บน GitHub Pages
            </div>
          </div>
        </div>
      `;
      DOC.body.appendChild(wrap);
    }

    elTop = DOC.getElementById('plannerRoot');
    elGrid = DOC.getElementById('weekGrid');
    elTry = DOC.getElementById('tryList');
    elCoach = DOC.getElementById('coachList');
    elRewards = DOC.getElementById('uiXp');
    elBanner = DOC.getElementById('rewardBanner');
    elToast = DOC.getElementById('toast');
    elUrlModal = DOC.getElementById('urlModal');
    elUrlForm = DOC.getElementById('urlForm');

    // top pills
    const pidEl = DOC.getElementById('uiPid'); if(pidEl) pidEl.textContent = PLAN.pid;
    const runEl = DOC.getElementById('uiRun'); if(runEl) runEl.textContent = PLAN.run;
    const seedEl = DOC.getElementById('uiSeed'); if(seedEl) seedEl.textContent = PLAN.seed;

    // limits
    const wk = DOC.getElementById('uiWk'); if(wk) wk.textContent = PLAN.constraints.limitWeekday;
    const we = DOC.getElementById('uiWe'); if(we) we.textContent = PLAN.constraints.limitWeekend;

    // buttons
    const btnAuto = DOC.getElementById('btnAuto');
    if(btnAuto) btnAuto.onclick = ()=>{ autoFillPlan(); renderAll(); toast('สร้างแผนอัตโนมัติแล้ว'); };

    const btnUrls = DOC.getElementById('btnUrls');
    if(btnUrls) btnUrls.onclick = openUrlModal;

    const urlClose = DOC.getElementById('urlClose');
    if(urlClose) urlClose.onclick = closeUrlModal;

    const urlSave = DOC.getElementById('urlSave');
    if(urlSave) urlSave.onclick = saveUrlModal;

    // goals
    const gEnd = DOC.getElementById('goalEnd');
    const gSpeed = DOC.getElementById('goalSpeed');
    const gBal = DOC.getElementById('goalBal');
    if(gEnd) gEnd.onclick = ()=> setGoal('endurance');
    if(gSpeed) gSpeed.onclick = ()=> setGoal('speed');
    if(gBal) gBal.onclick = ()=> setGoal('balance');

    function setGoal(g){
      PLAN.goals = [g];
      savePlan();
      renderAll();
      toast('ตั้งเป้าหมายแล้ว');
    }
  }

  function toast(msg){
    msg = String(msg||'').trim();
    if(!msg) return;
    ensureUI();
    elToast.textContent = msg;
    elToast.classList.add('show');
    setTimeout(()=> elToast.classList.remove('show'), 2600);
  }

  function openUrlModal(){
    ensureUI();
    elUrlForm.innerHTML = '';
    const mk = (key, label)=>{
      const wrap = DOC.createElement('div');
      wrap.innerHTML = `
        <label>${label}</label>
        <input data-urlkey="${key}" value="${String(PLAN.urls[key]||DEFAULT_URLS[key]||'').replace(/"/g,'&quot;')}" />
      `;
      return wrap;
    };
    elUrlForm.appendChild(mk('shadow','⚡ Shadow Breaker (run URL)'));
    elUrlForm.appendChild(mk('rhythm','🥊 Rhythm Boxer (run URL)'));
    elUrlForm.appendChild(mk('jumpduck','🦆 JumpDuck (run URL)'));
    elUrlForm.appendChild(mk('balance','🧘 Balance Hold (run URL)'));

    elUrlModal.classList.add('show');
  }
  function closeUrlModal(){
    if(elUrlModal) elUrlModal.classList.remove('show');
  }
  function saveUrlModal(){
    const inputs = elUrlForm ? Array.from(elUrlForm.querySelectorAll('input[data-urlkey]')) : [];
    inputs.forEach(inp=>{
      const k = inp.getAttribute('data-urlkey');
      const v = String(inp.value||'').trim();
      PLAN.urls[k] = v;
    });
    savePlan();
    closeUrlModal();
    toast('บันทึก URL แล้ว');
  }

  /* =======================
   * P) RENDER
   * ======================= */
  function renderRewards(){
    ensureUI();
    REW = loadRewards();
    const xpEl = DOC.getElementById('uiXp');
    const stkEl = DOC.getElementById('uiStk');
    if(xpEl) xpEl.textContent = String(REW.xp||0);
    if(stkEl) stkEl.textContent = String(Object.keys(REW.stickers||{}).length);
  }

  function renderWeekGrid(){
    ensureUI();
    elGrid.innerHTML = '';

    // keep boss day consistent
    const bossIdx = detectBossDay(PLAN);
    normalizeBossDay(PLAN, bossIdx);

    for(let i=0;i<7;i++){
      const d = PLAN.days[i];
      const card = DOC.createElement('div');
      card.className = 'card day';

      const mins = (d.items||[]).reduce((s,it)=>s+clamp(it.min,2,20),0);
      const lim = isWeekend(i) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;
      const energy = dayEnergy(d);

      const badge = (bossIdx===i) ? `🔥 Boss` : (challengeScore(d)>=5 ? `🏅 Gold` : '');
      const badgeCls = (bossIdx===i || challengeScore(d)>=5) ? 'good' : (energy>ENERGY_BUDGET*1.15 ? 'warn' : 'tag');

      card.innerHTML = `
        <h4>
          <span>${dayName(i)}</span>
          <span class="tag ${badgeCls}">${badge || `${mins}/${lim}m`}</span>
        </h4>
        <div class="items"></div>
        <div class="row" style="justify-content:space-between; margin-top:6px;">
          <button class="btn small ghost" data-add="${i}">＋ เพิ่ม</button>
          <button class="btn small" data-play="${i}">▶️ เล่น</button>
        </div>
        <div class="meta" style="margin-top:6px; color:var(--mut); font-size:12px;">
          energy ${energy.toFixed(1)}/${ENERGY_BUDGET}
        </div>
      `;

      const itemsBox = card.querySelector('.items');

      (d.items||[]).forEach((it, idx)=>{
        const g = getGame(it.game);
        const div = DOC.createElement('div');
        div.className = 'item';
        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">
            <div style="font-weight:1100;">${g.ico} ${g.name}</div>
            <button class="btn small ghost" data-del="${i}:${idx}">ลบ</button>
          </div>
          <div class="meta">${it.diff} · ${clamp(it.min,2,20)} นาที · tier ${challengeTier(it).toUpperCase()}</div>
          <div class="row" style="margin-top:6px;">
            <select data-game="${i}:${idx}">
              ${Object.keys(GAMES).map(id=>`<option value="${id}" ${id===it.game?'selected':''}>${GAMES[id].ico} ${GAMES[id].name}</option>`).join('')}
            </select>
            <select data-diff="${i}:${idx}">
              ${['easy','normal','hard'].map(x=>`<option value="${x}" ${x===it.diff?'selected':''}>${x}</option>`).join('')}
            </select>
            <input data-min="${i}:${idx}" type="number" min="2" max="20" value="${clamp(it.min,2,20)}" />
          </div>
        `;
        itemsBox.appendChild(div);
      });

      elGrid.appendChild(card);
    }

    // events
    elGrid.querySelectorAll('[data-add]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = Number(btn.getAttribute('data-add'));
        addItem(i);
      };
    });
    elGrid.querySelectorAll('[data-play]').forEach(btn=>{
      btn.onclick = ()=>{
        const i = Number(btn.getAttribute('data-play'));
        playDay(i);
      };
    });
    elGrid.querySelectorAll('[data-del]').forEach(btn=>{
      btn.onclick = ()=>{
        const [di, ii] = String(btn.getAttribute('data-del')).split(':').map(Number);
        delItem(di, ii);
      };
    });
    elGrid.querySelectorAll('select[data-game]').forEach(sel=>{
      sel.onchange = ()=>{
        const [di, ii] = String(sel.getAttribute('data-game')).split(':').map(Number);
        PLAN.days[di].items[ii].game = sel.value;
        savePlan();
        renderAll();
      };
    });
    elGrid.querySelectorAll('select[data-diff]').forEach(sel=>{
      sel.onchange = ()=>{
        const [di, ii] = String(sel.getAttribute('data-diff')).split(':').map(Number);
        PLAN.days[di].items[ii].diff = sel.value;
        savePlan();
        renderAll();
      };
    });
    elGrid.querySelectorAll('input[data-min]').forEach(inp=>{
      inp.onchange = ()=>{
        const [di, ii] = String(inp.getAttribute('data-min')).split(':').map(Number);
        PLAN.days[di].items[ii].min = clamp(inp.value,2,20);
        savePlan();
        renderAll();
      };
    });
  }

  function addItem(dayIdx){
    const d = PLAN.days[dayIdx];
    if(d.items.length >= 2){
      toast('วันนี้เต็มแล้ว (สูงสุด 2 เกม/วันใน MVP)');
      return;
    }
    d.items.push({ game:'rhythm', diff:'normal', min:6 });
    savePlan();
    renderAll();
  }
  function delItem(dayIdx, itemIdx){
    const d = PLAN.days[dayIdx];
    d.items.splice(itemIdx,1);
    savePlan();
    renderAll();
  }

  function playDay(dayIdx){
    const d = PLAN.days[dayIdx];
    if(!d.items || !d.items.length){
      toast('วันนี้ยังไม่มีเกมในแผน');
      return;
    }
    // start seq play (auto next)
    launchGameItem(d.items[0], dayIdx, 0, true);
  }

  function startEvaluateSession(dayIdx, items){
    if(!items || !items.length){
      toast('Session ว่าง');
      return;
    }
    PLAN.days[dayIdx] = PLAN.days[dayIdx] || { dayIndex: dayIdx, items: [] };
    PLAN.days[dayIdx].items = items.slice(0,2);
    PLAN.ts = Date.now();
    savePlan();
    renderAll();
    launchGameItem(PLAN.days[dayIdx].items[0], dayIdx, 0, true);
  }

  function renderTryToday(){
    ensureUI();
    elTry.innerHTML = '';

    const idx = todayIndexMon0();
    const prop = proposeSessionsForToday(idx);

    let fatigue = loadLS('HHA_PLANNER_FATIGUE', 'ok');
    if(fatigue !== 'tired') fatigue = 'ok';

    const evA = evaluateSession(prop.A.items, fatigue);
    const evB = evaluateSession(prop.B.items, fatigue);

    const box = DOC.createElement('div');
    box.style.cssText = `
      border:1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.14);
      border-radius:16px;
      padding:10px 12px;
      margin: 6px 0 12px;
    `;
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
        <div style="font-weight:1100">🧠 Evaluate วันนี้: เลือก Session ที่เหมาะกับร่างกายวันนี้</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span style="color:rgba(148,163,184,.92); font-weight:1000">สภาพร่างกาย:</span>
          <button id="fatOk" class="btn small ${fatigue==='ok'?'':'ghost'}">😌 ok</button>
          <button id="fatTired" class="btn small ${fatigue==='tired'?'':'ghost'}">😮‍💨 tired</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;" id="abGrid"></div>
      <div style="color:rgba(148,163,184,.92); font-size:12px; margin-top:8px;">
        กติกา: เลือก A หรือ B → เล่นต่อเนื่อง (auto-next) → จบวันได้ Sticker + XP (+โบนัส Boss/Gold + Cooldown)
      </div>
    `;
    elTry.appendChild(box);

    const abGrid = box.querySelector('#abGrid');
    const mkCard = (label, items, ev, key)=> {
      const itemsTxt = items.map(it=>`${getGame(it.game).ico} ${getGame(it.game).name} (${it.diff}, ${clamp(it.min,2,20)}m)`).join(' + ');
      const c = DOC.createElement('div');
      c.style.cssText = `
        border:1px solid rgba(255,255,255,.14);
        background: rgba(2,6,23,.55);
        border-radius:16px;
        padding:10px 12px;
      `;
      c.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div style="font-weight:1200">${label}</div>
          <div style="font-weight:1200">เหมาะสม: ${ev.score}/100</div>
        </div>
        <div style="margin-top:6px; font-weight:1000">${itemsTxt}</div>
        <div style="margin-top:6px; color:rgba(148,163,184,.92); font-size:12px">
          นาที ${ev.mins} · load ${ev.load} · energy ${ev.energy}/${ENERGY_BUDGET}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="btn small" id="choose_${key}">เลือก ${label} ▶️ เล่น</button>
        </div>
      `;
      return c;
    };
    abGrid.appendChild(mkCard('A', prop.A.items, evA, 'A'));
    abGrid.appendChild(mkCard('B', prop.B.items, evB, 'B'));

    box.querySelector('#fatOk').onclick = ()=>{
      saveLS('HHA_PLANNER_FATIGUE', 'ok');
      renderTryToday();
    };
    box.querySelector('#fatTired').onclick = ()=>{
      saveLS('HHA_PLANNER_FATIGUE', 'tired');
      renderTryToday();
    };
    box.querySelector('#choose_A').onclick = ()=> startEvaluateSession(idx, prop.A.items);
    box.querySelector('#choose_B').onclick = ()=> startEvaluateSession(idx, prop.B.items);

    // Also show "Play today's planned day" button
    const d = PLAN.days[idx];
    const btn = DOC.createElement('div');
    btn.style.cssText = 'margin-top:10px;';
    btn.innerHTML = `
      <button class="btn" id="btnPlayPlan">▶️ เล่นตามแผนวันนี้ (${dayName(idx)})</button>
    `;
    elTry.appendChild(btn);
    btn.querySelector('#btnPlayPlan').onclick = ()=> playDay(idx);
  }

  function renderCoach(){
    ensureUI();
    elCoach.innerHTML = '';
    const items = coachReasons(PLAN);
    items.forEach(it=>{
      const div = DOC.createElement('div');
      div.style.cssText = 'margin:6px 0; padding:8px 10px; border-radius:14px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.12);';
      div.innerHTML = `<span class="tag ${it.cls||'tag'}">${it.t}</span>`;
      elCoach.appendChild(div);
    });
  }

  function renderAll(){
    // AI adjust on every render (play only)
    aiDirectorAdjustPlan(PLAN);

    // keep boss thematic
    const bossIdx = detectBossDay(PLAN);
    normalizeBossDay(PLAN, bossIdx);

    renderRewards();
    renderWeekGrid();
    renderCoach();
    renderTryToday();

    // goal buttons style
    const g = (PLAN.goals && PLAN.goals[0]) ? PLAN.goals[0] : 'endurance';
    const a = (id, on)=>{ const el=DOC.getElementById(id); if(!el) return; el.classList.toggle('ghost', !on); };
    a('goalEnd', g!=='endurance'?false:true);
    a('goalSpeed', g!=='speed'?false:true);
    a('goalBal', g!=='balance'?false:true);
  }

  /* =======================
   * Q) BOOT
   * ======================= */
  function boot(){
    ensureUI();

    // If we returned to planner to start cooldown now
    if(maybeStartCooldownNow()) return;

    renderAll();

    // 1) award cooldown reward if any (push to inbox)
    awardCooldownRewardIfAny();

    // 2) auto-next if seq markers exist (will award daily + maybe cooldown at end)
    const launched = autoContinueSeqIfAny();
    if(launched) return;

    // 3) show combined banner once (if any)
    showCombinedRewardBannerIfAny();
  }

  // Start
  boot();

})();