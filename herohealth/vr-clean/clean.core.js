// === /herohealth/vr-clean/clean.core.js ===
// Clean Objects — Core (Mode A Evaluate / Mode B Create) — MVP v20260223
'use strict';

import { HOTSPOTS, SURFACE_EFF, zoneIds, surfaceTypes, clamp, norm01, getHotspot } from './clean.data.js';

/* ----------------------------
  Query helpers
---------------------------- */
export function qs(name, fallback=''){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(name);
    return (v===null || v==='') ? fallback : v;
  }catch(e){
    return fallback;
  }
}

export function boolQS(name, def=true){
  const v = String(qs(name, def ? '1' : '0')).toLowerCase();
  if(v==='0' || v==='false' || v==='no') return false;
  if(v==='1' || v==='true' || v==='yes') return true;
  return !!def;
}

/* ----------------------------
  Seeded RNG (deterministic)
  - Used ONLY when run=research (or when seed given)
---------------------------- */
function hashSeedToU32(seedStr){
  const s = String(seedStr ?? '');
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32
function makeRng(seedU32){
  let a = (seedU32 >>> 0) || 1;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----------------------------
  Mode router
  - A: PC/Mobile Evaluate
  - B: Cardboard/cVR Create
---------------------------- */
export function detectMode(){
  const override = String(qs('mode','')).toUpperCase();
  if(override === 'A' || override === 'B') return override;

  const view = String(qs('view','')).toLowerCase();
  if(view === 'cvr' || view === 'cardboard' || view === 'vr') return 'B';

  // fallback: if URL hints VR, treat as B
  const ua = (navigator.userAgent || '').toLowerCase();
  if(ua.includes('oculus') || ua.includes('quest') || ua.includes('vive')) return 'B';

  return 'A';
}

/* ----------------------------
  Core config
---------------------------- */
export function defaultConfig(){
  const run = String(qs('run','play')).toLowerCase();
  const seed = String(qs('seed', String(Date.now())));
  const pid = String(qs('pid','anon'));
  const hub = String(qs('hub',''));

  const mode = detectMode(); // 'A' or 'B'
  const view = String(qs('view', mode==='B' ? 'cvr' : 'mobile')).toLowerCase();

  return {
    zone: 'hygiene',
    game: 'clean-objects',
    title: 'Clean Objects',
    run,
    pid,
    hub,
    seed,
    mode,
    view,

    // MVP timers
    timeA: clamp(qs('timeA', '45'), 15, 180),
    timeB: clamp(qs('timeB', '60'), 20, 240),

    spraysA: clamp(qs('sprays', '3'), 1, 10),
    maxPointsB: clamp(qs('n', '5'), 2, 10),

    // pressure (risk drift) — enabled in play, deterministic in research
    pressure: boolQS('pressure', true),
  };
}

/* ----------------------------
  Value model (decision quality)
---------------------------- */
function trafficFactor(t){ return clamp(Number(t||0), 0, 1); }
function touchFactor(t){ return clamp(Number(t||0), 0, 1); }

// Normalize timeLastCleanedMin into 0..1 (0 = fresh, 1 = very old)
function timeOldNorm(mins){
  // 0..4320 min (0..3 days) mapped
  return norm01(Number(mins||0), 0, 4320);
}

// Value_i for decision ranking
export function computeValue(h){
  const risk = clamp(h.risk, 0, 100);
  const touch = touchFactor(h.touchLevel);
  const traffic = trafficFactor(h.traffic);
  const old = timeOldNorm(h.timeLastCleanedMin);

  // weights: risk dominates, then touch/traffic/old
  const v =
    risk *
    (0.6 + 0.4*touch) *
    (0.7 + 0.3*traffic) *
    (1.0 + 0.5*old);

  return v;
}

export function rankHotspotsByValue(list){
  return [...list].sort((a,b)=> computeValue(b) - computeValue(a));
}

/* ----------------------------
  Auto-reason generator
---------------------------- */
function featureScores(h){
  // normalized 0..1
  return {
    risk: clamp(h.risk/100, 0, 1),
    touch: clamp(h.touchLevel, 0, 1),
    traffic: clamp(h.traffic, 0, 1),
    old: timeOldNorm(h.timeLastCleanedMin),
    wet: (h.tags||[]).includes('wet') ? 0.75 : 0,
    shared: (h.tags||[]).includes('shared') ? 0.55 : 0,
  };
}

function reasonFromTop2(h){
  const f = featureScores(h);
  const entries = Object.entries(f).sort((a,b)=> b[1]-a[1]);
  const top = entries.filter(e=> e[1] > 0.45).slice(0,2); // threshold prevents nonsense

  const tags = [];
  const phrases = [];

  for(const [k] of top){
    if(k==='risk'){ tags.push('risk_high'); phrases.push('เสี่ยงสูง'); }
    else if(k==='touch'){ tags.push('touch_high'); phrases.push('จุดสัมผัสบ่อย'); }
    else if(k==='traffic'){ tags.push('traffic_high'); phrases.push('คนใช้/ผ่านบ่อย'); }
    else if(k==='old'){ tags.push('old_clean'); phrases.push('ไม่ได้ทำความสะอาดนาน'); }
    else if(k==='wet'){ tags.push('wet_area'); phrases.push('พื้นที่เปียกสะสมง่าย'); }
    else if(k==='shared'){ tags.push('shared_use'); phrases.push('ใช้ร่วมกันหลายคน'); }
  }

  // fallback (always have at least one)
  if(!phrases.length){
    tags.push('balanced_pick');
    phrases.push('เลือกเพื่อครอบคลุมพื้นที่');
  }

  // short 1-liner
  const text = phrases.join(' + ');
  return { tags, text };
}

/* ----------------------------
  Cleaning effectiveness
---------------------------- */
function surfaceEff(surfaceType){
  const k = String(surfaceType||'').toLowerCase();
  return Number(SURFACE_EFF[k] ?? 0.60);
}

function applyClean(riskBefore, eff){
  // riskAfter = riskBefore * (1 - eff)
  const rb = clamp(riskBefore, 0, 100);
  const e = clamp(eff, 0.05, 0.95);
  return clamp(rb * (1 - e), 0, 100);
}

/* ----------------------------
  Score A (Evaluate)
---------------------------- */
function scoreA(state){
  const all = state.hotspots;
  const selected = state.A.selected; // array of {id, before, after, rr, reasonText, reasonTags}

  // RR_total
  let rrTotal = 0;
  for(const s of selected) rrTotal += Number(s.rr||0);

  // Coverage: zones covered + surface types covered
  const zAll = zoneIds().length || 1;
  const zones = new Set();
  const surfs = new Set();
  selected.forEach(s=>{
    const h = state.hById.get(s.id);
    if(h){ zones.add(h.zone); surfs.add(h.surfaceType); }
  });
  const covZones = (zones.size / zAll) * 100;

  const surfAll = surfaceTypes().length || 1;
  const covSurf = (surfs.size / surfAll) * 100;

  const coverage = 0.6*covZones + 0.4*covSurf;

  // Decision quality: rank by value, top5
  const ranked = rankHotspotsByValue(all);
  const top5 = new Set(ranked.slice(0,5).map(h=>h.id));
  const hit = selected.filter(s=> top5.has(s.id)).length;
  const dq = (hit / Math.max(1, selected.length)) * 100;

  // Total score
  const score = 0.55*rrTotal + 0.20*coverage + 0.25*dq;

  return {
    rrTotal: Math.round(rrTotal),
    covZones: Math.round(covZones),
    covSurf: Math.round(covSurf),
    coverage: Math.round(coverage),
    dq: Math.round(dq),
    score: Math.round(score),
  };
}

/* ----------------------------
  Score B (Create Route)
---------------------------- */
function scoreB(state){
  const all = state.hotspots;
  const route = state.B.routeIds.map(id=> state.hById.get(id)).filter(Boolean);

  const totalTouchHigh = all.filter(h=> (h.touchLevel||0) >= 0.9).length || 1;
  const inPlanTouchHigh = route.filter(h=> (h.touchLevel||0) >= 0.9).length;
  const covTouchHigh = (inPlanTouchHigh / totalTouchHigh) * 100;

  const zAll = zoneIds().length || 1;
  const zPlan = new Set(route.map(h=>h.zone)).size;
  const covZones = (zPlan / zAll) * 100;

  const coverageB = 0.6*covTouchHigh + 0.4*covZones;

  // Balance: surface diversity
  const surfAll = surfaceTypes().length || 1;
  const surfPlan = new Set(route.map(h=>h.surfaceType)).size;
  const surfaceDiversity = surfPlan / surfAll;
  const balanceScore = surfaceDiversity * 100;

  // Remaining risk penalty (weighted value)
  const inPlan = new Set(route.map(h=>h.id));
  let remain = 0;
  let remainMax = 0;
  for(const h of all){
    const v = computeValue(h);
    if(!inPlan.has(h.id)) remain += v;
    remainMax += v;
  }
  // normalize remain to 0..100; high remain => low score
  const remainNorm = remainMax > 0 ? clamp(remain / remainMax, 0, 1) : 1;
  const remainScore = 100 - Math.round(remainNorm * 100);

  const score = 0.45*coverageB + 0.25*balanceScore + 0.30*remainScore;

  return {
    covTouchHigh: Math.round(covTouchHigh),
    covZones: Math.round(covZones),
    coverageB: Math.round(coverageB),
    balanceScore: Math.round(balanceScore),
    remainScore: Math.round(remainScore),
    score: Math.round(score),
  };
}

/* ----------------------------
  Badges (simple MVP)
---------------------------- */
function badgesFromA(b){
  const out = [];
  if(b.dq >= 100) out.push('dq_100');
  if(b.coverage >= 75) out.push('coverage_good');
  if(b.rrTotal >= 120) out.push('risk_smasher');
  return out;
}

function badgesFromB(b){
  const out = [];
  if(b.coverageB >= 75) out.push('plan_coverage_good');
  if(b.balanceScore >= 60) out.push('plan_balanced');
  if(b.remainScore >= 70) out.push('risk_left_low');
  return out;
}

/* ----------------------------
  Core engine (UI-agnostic)
  - Provide hooks: onTick, onState, onSummary
---------------------------- */
export function createCleanCore(userCfg={}, hooks={}){
  const cfg = { ...defaultConfig(), ...userCfg };

  const isResearch = cfg.run === 'research';
  const rng = makeRng(hashSeedToU32(cfg.seed + '|' + cfg.pid + '|' + cfg.mode));

  // clone hotspots into state (so we can drift risk in play)
  const hotspots = HOTSPOTS.map(h=> ({ ...h }));

  const hById = new Map(hotspots.map(h=>[h.id, h]));

  // precompute baseline ranking for decision quality (deterministic)
  const ranked = rankHotspotsByValue(hotspots);

  const state = {
    cfg,
    phase: 'init', // init | playing | summary
    mode: cfg.mode, // 'A'|'B'
    t: 0,
    timeLeft: cfg.mode==='A' ? cfg.timeA : cfg.timeB,

    hotspots,
    hById,
    ranked,

    // Evaluate
    A: {
      spraysLeft: cfg.spraysA,
      selected: [], // {id, before, after, rr, reasonText, reasonTags, chosenBy:'auto'|'user'}
    },

    // Create
    B: {
      maxPoints: cfg.maxPointsB,
      routeIds: [],
    },

    // internal
    _lastTick: 0,
    _ended: false,
  };

  function emitState(){
    try{ hooks.onState && hooks.onState(snapshot()); }catch(e){}
  }

  function emitTick(dt){
    try{ hooks.onTick && hooks.onTick(snapshot(), dt); }catch(e){}
  }

  function emitSummary(sum){
    try{ hooks.onSummary && hooks.onSummary(sum, snapshot()); }catch(e){}
  }

  function snapshot(){
    // shallow safe snapshot (UI should not mutate)
    return {
      cfg: { ...state.cfg },
      phase: state.phase,
      mode: state.mode,
      timeLeft: state.timeLeft,
      A: {
        spraysLeft: state.A.spraysLeft,
        selected: state.A.selected.map(x=>({ ...x })),
      },
      B: {
        maxPoints: state.B.maxPoints,
        routeIds: [...state.B.routeIds],
      },
      hotspots: state.hotspots.map(h=>({
        id:h.id, name:h.name, zone:h.zone, x:h.x, y:h.y,
        risk:h.risk, traffic:h.traffic, surfaceType:h.surfaceType,
        touchLevel:h.touchLevel, timeLastCleanedMin:h.timeLastCleanedMin,
        tags:[...(h.tags||[])],
      })),
    };
  }

  function start(){
    state.phase = 'playing';
    state._lastTick = performance.now();
    emitState();
  }

  // optional: small pressure in play mode
  function driftRisk(dt){
    if(!cfg.pressure) return;
    if(isResearch){
      // deterministic drift: use rng every 0.5s tick via accumulator
      // handled by tick accumulator below
      return;
    }
    // play mode: slight continuous drift based on traffic (very small)
    for(const h of state.hotspots){
      const inc = 0.12 * trafficFactor(h.traffic) * (dt/1000); // ~0.06..0.12 per sec
      h.risk = clamp(h.risk + inc, 0, 100);
    }
  }

  // research drift tick (0.5s step) deterministic
  let acc500 = 0;

  function tick(){
    if(state._ended || state.phase !== 'playing') return;

    const now = performance.now();
    const dt = Math.max(0, now - state._lastTick);
    state._lastTick = now;

    // time
    state.timeLeft = Math.max(0, state.timeLeft - dt/1000);
    state.t += dt/1000;

    // pressure drift
    if(cfg.pressure){
      if(isResearch){
        acc500 += dt;
        while(acc500 >= 500){
          acc500 -= 500;
          // deterministic small drift: pick 2 random hotspots each step
          for(let k=0;k<2;k++){
            const idx = Math.floor(rng() * state.hotspots.length);
            const h = state.hotspots[idx];
            const bump = 0.8 * trafficFactor(h.traffic); // step bump
            h.risk = clamp(h.risk + bump, 0, 100);
          }
        }
      } else {
        driftRisk(dt);
      }
    }

    emitTick(dt);

    if(state.timeLeft <= 0){
      finish();
    }
  }

  function canSelectA(id){
    if(state.mode !== 'A') return false;
    if(state.A.spraysLeft <= 0) return false;
    if(state.A.selected.find(s=>s.id===id)) return false;
    return !!hById.get(id);
  }

  function selectA(id, userReasonTag=null){
    if(!canSelectA(id)) return { ok:false, reason:'not_allowed' };
    const h = hById.get(id);
    const before = clamp(h.risk, 0, 100);
    const eff = surfaceEff(h.surfaceType);
    const after = applyClean(before, eff);
    const rr = before - after;

    h.risk = after;

    const auto = reasonFromTop2(h);
    const chosenBy = userReasonTag ? 'user' : 'auto';
    let reasonTags = auto.tags;
    let reasonText = auto.text;

    if(userReasonTag){
      // map user tag -> short text, but keep auto in tags for analytics
      const map = {
        risk_high: 'เสี่ยงสูง',
        touch_high: 'จุดสัมผัสบ่อย',
        traffic_high: 'คนใช้/ผ่านบ่อย',
        old_clean: 'ไม่ได้ทำความสะอาดนาน',
        wet_area: 'พื้นที่เปียกสะสมง่าย',
        shared_use: 'ใช้ร่วมกันหลายคน',
      };
      reasonTags = Array.from(new Set([String(userReasonTag), ...auto.tags]));
      reasonText = map[userReasonTag] ? map[userReasonTag] : auto.text;
    }

    state.A.spraysLeft -= 1;
    state.A.selected.push({
      id,
      before: Math.round(before),
      after: Math.round(after),
      rr: Math.round(rr),
      reasonTags,
      reasonText,
      chosenBy,
    });

    emitState();

    // auto-finish if sprays used up
    if(state.A.spraysLeft <= 0){
      // let player see, but you can call finish() from UI if you want immediate
    }

    return { ok:true };
  }

  function toggleRouteB(id){
    if(state.mode !== 'B') return { ok:false, reason:'not_allowed' };
    if(!hById.get(id)) return { ok:false, reason:'bad_id' };

    const idx = state.B.routeIds.indexOf(id);
    if(idx >= 0){
      state.B.routeIds.splice(idx, 1);
      emitState();
      return { ok:true, action:'remove' };
    }

    if(state.B.routeIds.length >= state.B.maxPoints){
      return { ok:false, reason:'max_points' };
    }

    state.B.routeIds.push(id);
    emitState();
    return { ok:true, action:'add' };
  }

  function undoB(){
    if(state.mode !== 'B') return;
    state.B.routeIds.pop();
    emitState();
  }

  function clearB(){
    if(state.mode !== 'B') return;
    state.B.routeIds = [];
    emitState();
  }

  function submitB(){
    if(state.mode !== 'B') return { ok:false };
    finish();
    return { ok:true };
  }

  function finish(){
    if(state._ended) return;
    state._ended = true;
    state.phase = 'summary';

    let breakdown;
    let score;
    let badges;

    if(state.mode === 'A'){
      breakdown = scoreA(state);
      score = breakdown.score;
      badges = badgesFromA(breakdown);
    } else {
      breakdown = scoreB(state);
      score = breakdown.score;
      badges = badgesFromB(breakdown);
    }

    const summary = buildSummaryPayload(score, breakdown, badges);
    emitSummary(summary);
    emitState();
  }

  function buildSummaryPayload(score, breakdown, badges){
    const cfg = state.cfg;

    // Bonus: for MVP keep 0; you can later add timeBonus, etc.
    const bonus = { boss:0, micro:0, time:0, other:0 };

    const metrics = {
      mode: state.mode,
      breakdown,
    };

    if(state.mode === 'A'){
      metrics.selectedIds = state.A.selected.map(s=>s.id);
      metrics.reasons = state.A.selected.map(s=>({
        id: s.id,
        reasonText: s.reasonText,
        reasonTags: s.reasonTags,
        chosenBy: s.chosenBy,
        rr: s.rr,
      }));
      metrics.spraysUsed = (cfg.spraysA - state.A.spraysLeft);
      metrics.timeLeft = Math.round(state.timeLeft);
    } else {
      metrics.routeIds = [...state.B.routeIds];
      metrics.maxPoints = state.B.maxPoints;
      metrics.timeLeft = Math.round(state.timeLeft);
    }

    // Paths (boss A/B) — MVP: use A/B concept as “dual condition”
    // For now: pathA = coverage good, pathB = decision/balance good (per mode)
    let bossA = false;
    let bossB = false;

    if(state.mode === 'A'){
      bossA = (breakdown.coverage >= 70);
      bossB = (breakdown.dq >= 70);
    } else {
      bossA = (breakdown.coverageB >= 70);
      bossB = (breakdown.balanceScore >= 55);
    }

    const paths = { bossA, bossB, dual: !!(bossA && bossB) };

    const payload = {
      v: 1,
      ts: Date.now(),
      day: (new Date()).toISOString().slice(0,10), // local not required for payload; hub normalizes anyway

      zone: cfg.zone,
      game: cfg.game,
      title: cfg.title,

      mode: cfg.run === 'research' ? 'research' : 'play',
      view: cfg.view,

      score: Math.round(score),
      bestCombo: 1,
      durationSec: state.mode === 'A' ? cfg.timeA : cfg.timeB,

      bonus,
      badges,
      paths,

      metrics,

      openUrl: location.href,
      hubUrl: cfg.hub ? String(cfg.hub) : '',
    };

    return payload;
  }

  return {
    cfg,
    start,
    tick,
    finish,

    // Mode A
    selectA,

    // Mode B
    toggleRouteB,
    undoB,
    clearB,
    submitB,

    // state
    snapshot,
  };
}