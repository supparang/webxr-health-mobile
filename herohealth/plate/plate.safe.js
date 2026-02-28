ได้เลยครับ ✅ รอบนี้ “แปะตัวเต็ม” ให้เลย 2 ไฟล์แบบ SAFE/PRODUCTION ตามแพ็กทั้งหมดที่คุยกัน (A+B + heat/coach + hha:event + end-harden + backguard + local day BKK + deterministic research drift)

ด้านล่างคือ:

1. /herohealth/vr-clean/clean.core.js (ตัวเต็ม)


2. /herohealth/vr-clean/home-clean.html (ตัวเต็ม, run page)



> หมายเหตุ: ไฟล์นี้ใช้ clean.data.js ที่มี HOTSPOTS, MAP และ ZONES (ตามที่เราเคยตั้ง) และใช้ clean.ui.js ที่คุณมีอยู่แล้ว (มี onCoach ด้วย)




---

1) /herohealth/vr-clean/clean.core.js (FULL)

// === /herohealth/vr-clean/clean.core.js ===
// Clean Objects CORE — SAFE/PRODUCTION — v20260228-FULL
// Modes:
//  A) Evaluate (PC/Mobile): timeA (fallback time), sprays=3, pick best risk reduction under constraints
//  B) Create (Cardboard/cVR): timeB (fallback time), maxPoints=N, build route
//
// ✅ Local day key (Asia/Bangkok) for payload.day
// ✅ Deterministic research drift (run=research) based on seed
// ✅ Event bridge: hha:score + hha:coach + hha:event
// ✅ End-event hardened (no double end/summary)
// ✅ Coach micro-tips (explainable + rate-limit)
//
// Depends on: ./clean.data.js exports { HOTSPOTS, MAP, ZONES }

'use strict';

import { HOTSPOTS, MAP } from './clean.data.js';

function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); }
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
}
function nowIso(){ return new Date().toISOString(); }

function localYMD_BKK(ts=Date.now()){
  // Asia/Bangkok = UTC+7 fixed
  const d = new Date(ts + 7*60*60*1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const da = String(d.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

function emitEvt(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(e){}
}

function makeRateLimit(ms){
  let last = 0;
  return function ok(now=Date.now()){
    if(now - last >= ms){ last = now; return true; }
    return false;
  };
}

// --- deterministic RNG (seeded)
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
function makeRng(seedStr){
  const seedFn = xmur3(String(seedStr||'seed'));
  return sfc32(seedFn(), seedFn(), seedFn(), seedFn());
}

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cvr' || v==='cardboard' || v==='vr') return 'cvr';
  if(v==='mobile' || v==='m') return 'mobile';
  if(v==='pc' || v==='desktop') return 'pc';
  return v || '';
}

function makeSessionId(){
  const pid = String(qs('pid','anon')||'anon');
  const seed = String(qs('seed', String(Date.now()))||Date.now());
  const run  = String(qs('run','play')||'play');
  return `CO_${pid}_${run}_${seed}_${Math.floor(Date.now()/1000)}`;
}

function emitHHAEvent(type, payload){
  const base = {
    schema: 'hha_event_v1',
    type: String(type||'event'),
    game: 'cleanobjects',
    zone: 'hygiene',
    theme: 'cleanobjects',
    ts: nowIso(),
    tsMs: Date.now(),
    pid: String(qs('pid','anon')||'anon'),
    run: String(qs('run','play')||'play'),
    diff: String(qs('diff','normal')||'normal'),
    seed: String(qs('seed','')||''),
    view: String(qs('view','')||''),
    hub: String(qs('hub','')||''),
    studyId: String(qs('studyId','')||''),
    phase: String(qs('phase','')||''),
    conditionGroup: String(qs('conditionGroup','')||''),
    sessionId: String(payload?.sessionId || ''),
  };
  const d = Object.assign(base, payload || {});
  emitEvt('hha:event', d);
}

// --- scoring helpers
function valueScoreHotspot(h){
  // "คุ้ม" = risk * (touch + traffic) * surfaceWeight * stalenessWeight
  const risk = clamp(h.risk, 0, 100) / 100;
  const touch = clamp(h.touchLevel, 0, 1);
  const traffic = clamp(h.traffic, 0, 1);
  const mins = Math.max(0, Number(h.timeLastCleanedMin||0));
  const staleness = clamp(mins / (24*60), 0, 2); // 0..2 days scale
  const staleW = 0.6 + 0.4*clamp(staleness/2, 0, 1);

  const surface = String(h.surfaceType||'').toLowerCase();
  const surfaceW =
    (surface==='metal' || surface==='plastic') ? 1.15 :
    (surface==='glass') ? 1.05 :
    (surface==='tile') ? 1.00 :
    (surface==='wood') ? 0.95 :
    (surface==='fabric') ? 0.90 : 1.0;

  const intensity = 0.45*touch + 0.35*traffic + 0.20;
  const v = risk * intensity * surfaceW * staleW; // ~0.. >1
  return v;
}

function rankHotspotsByValue(hs){
  return (hs||[]).slice().sort((a,b)=> valueScoreHotspot(b) - valueScoreHotspot(a));
}

function reasonAuto(h){
  const parts = [];
  if(Number(h.risk||0) >= 75) parts.push('เสี่ยงสูง');
  if(Number(h.touchLevel||0) >= 0.8) parts.push('จุดสัมผัสบ่อย');
  if(Number(h.traffic||0) >= 0.8) parts.push('คนใช้/ผ่านบ่อย');
  const mins = Number(h.timeLastCleanedMin||0);
  if(mins >= 12*60) parts.push('ไม่ได้ทำความสะอาดนาน');
  if(parts.length===0) parts.push('ลดความเสี่ยงรวม');
  return parts.slice(0,2).join(' + ');
}

function mapUserReason(tag, h){
  // optional tag->text mapping
  const m = {
    risk_high: 'เสี่ยงสูง',
    touch_high: 'จุดสัมผัสบ่อย',
    traffic_high: 'คนใช้/ผ่านบ่อย',
    old_clean: 'ไม่ได้ทำความสะอาดนาน',
    shared_use: 'ใช้ร่วมกัน',
    wet_area: 'พื้นที่เปียก'
  };
  const t = m[String(tag||'')] || '';
  if(t) return t;
  return reasonAuto(h);
}

function scoreA(state){
  const sel = state.A.selected || [];
  const top = rankHotspotsByValue(state.hotspots).slice(0,3).map(h=>h.id);

  // Risk reduction: sum of risk removed (we assume cleaning reduces risk to near 5)
  let rrTotal = 0;
  for(const s of sel){
    rrTotal += Number(s.rr||0);
  }

  const coverage = clamp((sel.length / Math.max(1,state.A.maxSelect)) * 100, 0, 100);

  // Decision quality: how many of chosen are in top3 by value
  let hit = 0;
  for(const s of sel){
    if(top.includes(s.id)) hit++;
  }
  const dq = clamp((hit / Math.max(1, state.A.maxSelect)) * 100, 0, 100);

  // Final score
  const score = Math.round(rrTotal * 1.6 + coverage * 1.1 + dq * 1.2);

  return {
    score,
    breakdown: { rrTotal: Math.round(rrTotal), coverage: Math.round(coverage), dq: Math.round(dq) },
    top3: top
  };
}

function scoreB(state){
  const ids = state.B.routeIds || [];
  const hs = state.hotspots || [];
  const chosen = ids.map(id=>hs.find(h=>h.id===id)).filter(Boolean);

  // Coverage: cover high-touch points + high-risk points
  // Use weighted coverage: average of (touch + risk + traffic)
  let covSum = 0;
  for(const h of chosen){
    const touch = clamp(h.touchLevel,0,1);
    const risk = clamp(h.risk,0,100)/100;
    const traffic = clamp(h.traffic,0,1);
    covSum += (0.45*touch + 0.35*risk + 0.20*traffic);
  }
  const covMax = Math.max(1, state.B.maxPoints) * 1.0;
  const coverageB = clamp((covSum / covMax) * 100, 0, 100);

  // Balance: encourage diverse surfaces + zones
  const surfaces = {};
  const zones = {};
  for(const h of chosen){
    const s = String(h.surfaceType||'').toLowerCase();
    surfaces[s] = (surfaces[s]||0)+1;
    const z = String(h.zone||'');
    zones[z] = (zones[z]||0)+1;
  }
  const surfaceKinds = Object.keys(surfaces).length;
  const zoneKinds = Object.keys(zones).length;
  const surfaceScore = clamp((surfaceKinds / 4) * 100, 0, 100); // target 4 types
  const zoneScore = clamp((zoneKinds / 3) * 100, 0, 100);       // target 3 zones
  const balanceScore = Math.round(0.6*surfaceScore + 0.4*zoneScore);

  // Remaining risk: penalize leaving very high value points unchosen
  const ranked = rankHotspotsByValue(hs);
  const topK = ranked.slice(0, Math.max(3, state.B.maxPoints)).map(h=>h.id);
  let miss = 0;
  for(const id of topK){
    if(!ids.includes(id)) miss++;
  }
  const remainScore = Math.round(clamp(100 - (miss / Math.max(1, topK.length)) * 100, 0, 100));

  const score = Math.round(coverageB*1.2 + balanceScore*0.9 + remainScore*1.1);

  return {
    score,
    breakdown: { coverageB: Math.round(coverageB), balanceScore, remainScore },
    routeIds: ids.slice(0)
  };
}

// --- CORE
export function createCleanCore(cfg={}, hooks={}){
  // config parse
  const runMode = String(qs('run', cfg.run || 'play') || 'play');
  const seedStr = String(qs('seed', cfg.seed || String(Date.now())) || Date.now());
  const view = normalizeView(qs('view', cfg.view || ''));
  const isCVR = (view === 'cvr');

  // support hub standard ?time=... as fallback for both modes
  const timeStd = qs('time', '');
  const timeA = clamp(qs('timeA', cfg.timeA ?? (timeStd || '45')), 15, 180);
  const timeB = clamp(qs('timeB', cfg.timeB ?? (timeStd || '60')), 20, 240);

  const sprays = clamp(qs('sprays', cfg.sprays ?? '3'), 1, 9);
  const maxPoints = clamp(qs('maxPoints', cfg.maxPoints ?? '5'), 2, 12);

  cfg = Object.assign({}, cfg, {
    run: runMode,
    seed: seedStr,
    view,
    hub: qs('hub', cfg.hub || ''),
    sessionId: cfg.sessionId || makeSessionId(),
  });

  const rng = makeRng(seedStr + '::cleanobjects');
  const coachOK = makeRateLimit(3500);

  // Deep copy hotspots so we can drift risk in research
  const hotspots = (HOTSPOTS || []).map(h=>Object.assign({}, h));

  // Mode policy: PC/Mobile => A, Cardboard => B (per your spec)
  const mode = isCVR ? 'B' : 'A';

  const state = {
    cfg,
    mode,
    map: MAP,
    hotspots,
    started: false,
    ended: false,
    endEmitted: false,
    t0: 0,
    lastMs: 0,
    timeTotal: (mode==='A') ? timeA : timeB,
    timeLeft: (mode==='A') ? timeA : timeB,

    A: {
      spraysLeft: sprays,
      maxSelect: sprays,
      selected: [] // {id, rr, reasonTag, reasonText}
    },

    B: {
      maxPoints: maxPoints,
      routeIds: []
    }
  };

  function emitCoach(kind, text, data){
    try{ hooks.onCoach && hooks.onCoach({ kind, text, data: data||{}, ts: Date.now() }); }catch(e){}
    emitEvt('hha:coach', {
      game: 'cleanobjects',
      kind: kind,
      text: text,
      data: data || {},
      ts: Date.now()
    });
  }

  function emitScore(phase){
    try{
      let preview = {};
      if(state.mode === 'A'){
        const rr = (state.A.selected||[]).reduce((a,b)=>a+Number(b.rr||0),0);
        preview = {
          spraysLeft: state.A.spraysLeft,
          chosen: (state.A.selected||[]).length,
          rrPreview: Math.round(rr)
        };
      } else {
        preview = {
          routeN: (state.B.routeIds||[]).length,
          maxPoints: state.B.maxPoints
        };
      }

      emitEvt('hha:score', {
        game: 'cleanobjects',
        mode: state.mode,
        phase: phase || 'tick',
        timeLeft: Math.round(state.timeLeft || 0),
        preview,
        ts: Date.now()
      });
    }catch(e){}
  }

  function emitState(){
    try{ hooks.onState && hooks.onState(snapshot()); }catch(e){}
    emitScore('state');
  }

  function snapshot(){
    // keep small; hotspots can be big but ok for 10 points
    return {
      cfg: state.cfg,
      mode: state.mode,
      map: state.map,
      hotspots: state.hotspots,
      started: state.started,
      ended: state.ended,
      timeTotal: state.timeTotal,
      timeLeft: state.timeLeft,
      A: {
        spraysLeft: state.A.spraysLeft,
        maxSelect: state.A.maxSelect,
        selected: state.A.selected.slice(0)
      },
      B: {
        maxPoints: state.B.maxPoints,
        routeIds: state.B.routeIds.slice(0)
      }
    };
  }

  function applyRiskDrift(dt){
    if(runMode !== 'research') return;
    if(state.mode !== 'A') return;
    if(state.ended) return;

    for(const h of state.hotspots){
      const traffic = Number(h.traffic||0);
      const touch = Number(h.touchLevel||0);
      const base = 0.6*traffic + 0.4*touch; // 0..1
      const jitter = (rng()-0.5) * 0.08;
      const inc = (0.9*base + jitter) * dt * 1.8;

      const wasCleaned = (state.A.selected||[]).some(s=>s.id===h.id);
      const mult = wasCleaned ? 0.25 : 1.0;

      h.risk = clamp(Number(h.risk||0) + inc*mult, 0, 100);
    }
  }

  function buildSummaryPayload(finalScore, metrics){
    const pid = String(qs('pid','anon')||'anon');
    const u = new URL(location.href);
    return {
      schema: 'hha_summary_v1',
      title: 'Clean Objects',
      zone: 'hygiene',
      game: 'cleanobjects',
      theme: 'cleanobjects',
      day: localYMD_BKK(),
      run: runMode,
      diff: String(qs('diff','normal')||'normal'),
      view: normalizeView(qs('view','')),
      pid,
      seed: seedStr,
      sessionId: state.cfg.sessionId,
      ts: nowIso(),
      score: finalScore,
      metrics
    };
  }

  function endGame(reason){
    if(state.ended) return;
    state.ended = true;

    let score = 0;
    let metrics = {};
    if(state.mode === 'A'){
      const r = scoreA(state);
      score = r.score;
      metrics = {
        mode: 'A',
        breakdown: r.breakdown,
        top3: r.top3,
        reasons: state.A.selected.map(s=>({ id:s.id, rr:s.rr, reasonTag:s.reasonTag||'', reasonText:s.reasonText||'' }))
      };
    } else {
      const r = scoreB(state);
      score = r.score;
      metrics = {
        mode: 'B',
        breakdown: r.breakdown,
        routeIds: r.routeIds
      };
    }

    const payload = buildSummaryPayload(score, metrics);

    // session_end event once
    if(!state.endEmitted){
      state.endEmitted = true;

      emitHHAEvent('session_end', {
        sessionId: state.cfg.sessionId,
        reason: String(reason||'timeup'),
        mode: state.mode,
        finalScore: score,
        metrics: payload.metrics || {},
        timeLeft: Math.round(state.timeLeft||0),
        day: payload.day
      });

      emitEvt('hha:score', {
        game: 'cleanobjects',
        mode: state.mode,
        phase: 'end',
        timeLeft: Math.round(state.timeLeft || 0),
        finalScore: score,
        metrics: payload.metrics || {},
        ts: Date.now()
      });

      try{ hooks.onSummary && hooks.onSummary(payload); }catch(e){}
    }
  }

  function start(){
    if(state.started) return;
    state.started = true;
    state.t0 = performance.now ? performance.now() : Date.now();
    state.lastMs = state.t0;

    emitHHAEvent('session_start', {
      sessionId: state.cfg.sessionId,
      day: localYMD_BKK(),
      mode: state.mode,
      timeTotal: state.timeTotal
    });

    emitState();
  }

  function tick(){
    if(!state.started || state.ended) return;
    const now = performance.now ? performance.now() : Date.now();
    let dt = (now - state.lastMs) / 1000;
    state.lastMs = now;
    dt = clamp(dt, 0, 0.25);

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    // research drift
    applyRiskDrift(dt);

    try{ hooks.onTick && hooks.onTick(snapshot(), dt); }catch(e){}
    emitScore('tick');

    if(state.timeLeft <= 0){
      endGame('timeup');
    }
  }

  function selectA(id, userReasonTag=null){
    if(state.mode !== 'A' || state.ended) return { ok:false, reason:'mode' };
    id = String(id||'');
    if(!id) return { ok:false, reason:'id' };
    if(state.A.spraysLeft <= 0) return { ok:false, reason:'no_sprays' };
    if(state.A.selected.some(s=>s.id===id)) return { ok:false, reason:'already' };

    const h = state.hotspots.find(x=>x.id===id);
    if(!h) return { ok:false, reason:'missing' };

    // RR: reduce risk to 5
    const before = clamp(h.risk, 0, 100);
    const after = 5;
    const rr = Math.max(0, before - after);

    const reasonText = mapUserReason(userReasonTag, h);

    state.A.selected.push({
      id,
      rr: Math.round(rr),
      reasonTag: String(userReasonTag||''),
      reasonText
    });

    state.A.spraysLeft = Math.max(0, state.A.spraysLeft - 1);

    emitHHAEvent('clean_select', {
      sessionId: state.cfg.sessionId,
      mode: 'A',
      hotspotId: id,
      reasonTag: String(userReasonTag||''),
      reasonText: reasonText || '',
      spraysLeft: state.A.spraysLeft,
      timeLeft: Math.round(state.timeLeft||0)
    });

    if(coachOK()){
      const top3 = rankHotspotsByValue(state.hotspots).slice(0,3).map(x=>x.id);
      const hitTop = top3.includes(id);
      const msg = hitTop
        ? `ดีมาก! จุดนี้คุ้ม เพราะ ${reasonText}`
        : `โอเค! แต่ลองดูจุดสัมผัสสูง/เสี่ยงสูงอีกที (เช่น มือจับ/สวิตช์/ที่ใช้ร่วมกัน)`;
      emitCoach('evaluate_pick', msg, { id, hitTop, reasonText });
    }

    emitState();

    // if selected all sprays, end early (optional)
    if(state.A.spraysLeft <= 0){
      endGame('done');
    }

    return { ok:true };
  }

  function toggleRouteB(id){
    if(state.mode !== 'B' || state.ended) return { ok:false, reason:'mode' };
    id = String(id||'');
    if(!id) return { ok:false, reason:'id' };
    const h = state.hotspots.find(x=>x.id===id);
    if(!h) return { ok:false, reason:'missing' };

    const idx = state.B.routeIds.indexOf(id);
    if(idx >= 0){
      state.B.routeIds.splice(idx,1);
    } else {
      if(state.B.routeIds.length >= state.B.maxPoints) return { ok:false, reason:'full' };
      state.B.routeIds.push(id);
    }

    emitHHAEvent('route_toggle', {
      sessionId: state.cfg.sessionId,
      mode: 'B',
      hotspotId: id,
      routeN: state.B.routeIds.length,
      maxPoints: state.B.maxPoints,
      timeLeft: Math.round(state.timeLeft||0)
    });

    if(coachOK()){
      const bd = scoreB(state).breakdown;
      const n = state.B.routeIds.length;
      let msg = `แผนตอนนี้: Coverage ${bd.coverageB}% • Balance ${bd.balanceScore}% • Remain ${bd.remainScore}%`;
      if(n < state.B.maxPoints){
        if(bd.coverageB < 60) msg += ` — เพิ่ม “จุดสัมผัสสูง” เพื่อดัน Coverage`;
        else if(bd.balanceScore < 55) msg += ` — เลือกพื้นผิวให้หลากหลายขึ้น`;
        else msg += ` — ใกล้ดีมาก! เลือกอีก ${state.B.maxPoints - n} จุดเพื่อปิดความเสี่ยงที่เหลือ`;
      }
      emitCoach('plan_live', msg, { breakdown: bd, n, max: state.B.maxPoints });
    }

    emitState();
    return { ok:true };
  }

  function undoB(){
    if(state.mode !== 'B' || state.ended) return { ok:false };
    if(state.B.routeIds.length <= 0) return { ok:false };
    const id = state.B.routeIds.pop();
    emitHHAEvent('route_undo', {
      sessionId: state.cfg.sessionId,
      mode: 'B',
      hotspotId: id,
      routeN: state.B.routeIds.length,
      maxPoints: state.B.maxPoints,
      timeLeft: Math.round(state.timeLeft||0)
    });
    emitState();
    return { ok:true };
  }

  function clearB(){
    if(state.mode !== 'B' || state.ended) return { ok:false };
    state.B.routeIds = [];
    emitHHAEvent('route_clear', {
      sessionId: state.cfg.sessionId,
      mode: 'B',
      routeN: 0,
      maxPoints: state.B.maxPoints,
      timeLeft: Math.round(state.timeLeft||0)
    });
    emitState();
    return { ok:true };
  }

  function submitB(){
    if(state.mode !== 'B' || state.ended) return { ok:false };
    emitHHAEvent('route_submit', {
      sessionId: state.cfg.sessionId,
      mode: 'B',
      routeIds: state.B.routeIds.slice(0),
      timeLeft: Math.round(state.timeLeft||0)
    });
    endGame('submit');
    return { ok:true };
  }

  return {
    cfg,
    start,
    tick,
    snapshot,

    // actions
    selectA,
    toggleRouteB,
    undoB,
    clearB,
    submitB
  };
}


---

2) /herohealth/vr-clean/home-clean.html (FULL RUN PAGE)

> เวอร์ชันนี้รวม: UI + hooks onCoach + saveSummary + flush-harden + backbutton guard (confirm)



<!-- === /herohealth/vr-clean/home-clean.html ===
Clean Objects (Evaluate → Create) — RUN PAGE — v20260228-FULL
A: PC/Mobile Evaluate (fallback time=45, sprays=3)
B: cVR Create (fallback time=60, maxPoints=5)
-->
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>HeroHealth — Clean Objects</title>
  <meta name="color-scheme" content="dark light"/>
  <style>
    :root{
      color-scheme: dark;
      --bg:#050814;
      --panel: rgba(2,6,23,.72);
      --panel2: rgba(2,6,23,.55);
      --line: rgba(148,163,184,.18);
      --txt: rgba(229,231,235,.94);
      --mut: rgba(148,163,184,.92);

      --sat: env(safe-area-inset-top, 0px);
      --sab: env(safe-area-inset-bottom, 0px);
      --sal: env(safe-area-inset-left, 0px);
      --sar: env(safe-area-inset-right, 0px);
    }
    html,body{height:100%;margin:0;background:
      radial-gradient(1200px 800px at 20% 0%, rgba(99,102,241,.18), transparent 55%),
      radial-gradient(900px 700px at 90% 20%, rgba(34,211,238,.14), transparent 60%),
      radial-gradient(700px 500px at 40% 100%, rgba(244,114,182,.10), transparent 55%),
      var(--bg);
      color:var(--txt);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
    }
    *{box-sizing:border-box}

    /* --- from previous run page (UI layout) --- */
    .cleanApp{
      height:100%;
      display:grid;
      grid-template-columns: 1.2fr .8fr;
      grid-template-rows: auto 1fr auto;
      gap: 10px;
      padding: calc(10px + var(--sat)) calc(10px + var(--sar)) calc(10px + var(--sab)) calc(10px + var(--sal));
    }
    .hud{
      grid-column: 1 / -1;
      border:1px solid var(--line);
      background: var(--panel);
      border-radius: 18px;
      padding: 10px 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,.25);
    }
    .hudRow{display:flex; gap:10px; flex-wrap:wrap; align-items:center;}
    .pill{
      padding: 7px 10px;
      border-radius: 999px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.35);
      font-weight: 900;
      letter-spacing:.02em;
      font-size: 12px;
      opacity:.95;
    }
    .board{
      grid-column: 1 / 2;
      border:1px solid var(--line);
      background: var(--panel2);
      border-radius: 18px;
      position:relative;
      overflow:hidden;
      min-height: 360px;
    }
    .grid{
      position:absolute; inset: 10px;
      border-radius: 16px;
      background: rgba(2,6,23,.35);
      border:1px solid rgba(148,163,184,.12);
      overflow:hidden;
    }
    .overlay{ position:absolute; inset:0; display:flex; align-items:flex-end; justify-content:center; padding: 12px; }
    .ovHint{
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.60);
      border-radius: 16px;
      padding: 10px 12px;
      max-width: 520px;
      text-align:center;
      box-shadow: 0 10px 30px rgba(0,0,0,.22);
    }
    .ovT{ font-weight: 1000; }
    .ovS{ font-size: 12px; opacity:.85; margin-top:4px; }

    .info{
      grid-column: 2 / 3;
      border:1px solid var(--line);
      background: var(--panel);
      border-radius: 18px;
      padding: 12px;
      overflow:auto;
      min-height: 360px;
    }
    .routePanel{
      grid-column: 1 / -1;
      border:1px solid var(--line);
      background: rgba(2,6,23,.50);
      border-radius: 18px;
      padding: 10px 12px;
      max-height: 220px;
      overflow:auto;
    }

    /* --- POLISH PACK: heat overlay, bars, coach toast --- */
    .heatLayer{ position:absolute; inset:0; pointer-events:none; }
    .heat{
      position:absolute;
      border-radius: 999px;
      filter: blur(1px);
      transform: translateZ(0);
      animation: heatPulse 1.8s ease-in-out infinite;
    }
    .heat.hot{ background: radial-gradient(circle, rgba(239,68,68,.55), rgba(239,68,68,0) 70%); }
    .heat.warm{ background: radial-gradient(circle, rgba(251,191,36,.50), rgba(251,191,36,0) 70%); }
    .heat.cool{ background: radial-gradient(circle, rgba(34,197,94,.35), rgba(34,197,94,0) 70%); }
    @keyframes heatPulse{ 0%,100%{ transform: scale(0.95);} 50%{ transform: scale(1.08);} }

    .bars{ margin-top: 10px; display:flex; flex-direction:column; gap:8px; }
    .barRow{ display:grid; grid-template-columns: 78px 1fr 46px; gap:8px; align-items:center; }
    .barLab{ font-size:12px; opacity:.85; font-weight:900; }
    .barTrack{ height:10px; border-radius:999px; background: rgba(148,163,184,.12); overflow:hidden; border:1px solid rgba(148,163,184,.14); }
    .barFill{ height:100%; background: rgba(59,130,246,.40); border-right:1px solid rgba(59,130,246,.50); }
    .barVal{ font-size:12px; opacity:.85; text-align:right; font-weight:900; }

    .coachToast{
      position: fixed;
      left: 50%;
      bottom: calc(14px + var(--sab));
      transform: translateX(-50%);
      z-index: 120;
      pointer-events: none;
    }
    .ctInner{
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.78);
      border-radius: 999px;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 900;
      box-shadow: 0 20px 60px rgba(0,0,0,.35);
    }

    @media (max-width: 980px){
      .cleanApp{ grid-template-columns: 1fr; grid-template-rows: auto 1fr auto auto; }
      .board{ grid-column: 1 / -1; min-height: 340px; }
      .info{ grid-column: 1 / -1; }
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <script type="module">
    import { createCleanCore } from './clean.core.js';
    import { mountCleanUI } from './clean.ui.js';
    import { saveSummary } from '../analytics/summary-store.js';

    // Optional: if you want universal VR UI on this run page, uncomment:
    // import '../vr/vr-ui.js';

    const root = document.getElementById('app');

    // UI first (needs core ref)
    let core = null;
    const ui = mountCleanUI(root, {
      snapshot: ()=> core ? core.snapshot() : null,
      toggleRouteB: (id)=> core && core.toggleRouteB(id),
      selectA: (id, reason)=> core && core.selectA(id, reason),
      undoB: ()=> core && core.undoB(),
      clearB: ()=> core && core.clearB(),
      submitB: ()=> core && core.submitB(),
      cfg: null
    });

    core = createCleanCore({}, {
      onState: (S)=> ui.onState(S),
      onTick: (S,dt)=> ui.onTick(S,dt),
      onCoach: (msg)=> ui.onCoach(msg),
      onSummary: (payload)=> {
        try{ saveSummary(payload); }catch(e){}
        ui.onSummary(payload);
      }
    });

    // patch ui core reference
    ui && (ui.core = core);

    core.start();

    function loop(){
      core.tick();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // --- flush-hardened (safe no-op if HHA.flush missing)
    function safeFlush(tag){
      try{
        if(window.HHA && typeof window.HHA.flush === 'function'){
          window.HHA.flush({ reason: tag || 'pagehide', game:'cleanobjects' });
        }
      }catch(e){}
    }
    window.addEventListener('pagehide', ()=> safeFlush('pagehide'));
    document.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState === 'hidden') safeFlush('hidden');
    });
    window.addEventListener('beforeunload', ()=> safeFlush('beforeunload'));

    // --- Backbutton guard (confirm)
    (function(){
      let armed = false;
      function arm(){
        if(armed) return;
        armed = true;
        try{ history.pushState({hha_guard:1}, '', location.href); }catch(e){}
      }
      arm();

      window.addEventListener('popstate', ()=>{
        // if ended, allow back normally
        try{
          const snap = core.snapshot();
          if(snap && snap.ended) return;
        }catch(_){}

        const ok = confirm('ออกจากเกมตอนนี้? ระบบจะพยายามบันทึกข้อมูลก่อนกลับ HUB');
        if(ok){
          safeFlush('back');
          const hub = new URL(location.href).searchParams.get('hub');
          if(hub) location.href = hub;
          else history.back();
        }else{
          // re-arm
          armed = false;
          arm();
        }
      });
    })();
  </script>
</body>
</html>


---

เช็กให้ชัวร์หลังวางไฟล์

เปิด launcher root:
.../herohealth/clean-objects.html?... → auto redirect → .../herohealth/vr-clean/home-clean.html?...

โหมด A (pc/mobile) = Evaluate + risk drift เฉพาะ run=research

โหมด B (view=cvr) = Create + route bars + submit

จะมี event bridge:

hha:event (session_start / clean_select / route_toggle / route_submit / session_end)

hha:score

hha:coach



พิมพ์ ต่อ อีกที เดี๋ยวผม “แปะตัวเต็ม” ไฟล์ clean.ui.js เวอร์ชันที่เข้ากับ core ตัวนี้แบบ 100% (รวม heatLayer/bars/coach toast/Go Cooldown ปุ่ม) ให้ครบชุดเดียวจบ ✅