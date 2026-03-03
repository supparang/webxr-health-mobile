// === /herohealth/vr-clean/ai-hooks.js ===
// Clean Objects AI Hooks — PREDICT-ONLY (deterministic-friendly)
// v20260303-AI-FORECASTER-COACH-GERMWAVE-HEIST
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

// deterministic RNG from seed string
function makeRng(seedStr){
  let s = 0;
  const str = String(seedStr||'0');
  for(let i=0;i<str.length;i++) s = (s*31 + str.charCodeAt(i)) >>> 0;
  return function(){
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

function surfaceFactor(surfaceType){
  const t = String(surfaceType||'').toLowerCase();
  if(t.includes('glass')) return 1.10;
  if(t.includes('metal')) return 1.08;
  if(t.includes('plastic')) return 1.05;
  if(t.includes('wood')) return 1.00;
  if(t.includes('tile')) return 1.03;
  if(t.includes('paper')) return 0.95;
  return 1.00;
}

// ===== Forecaster (predict hazard rise in next horizonSec) =====
function predictHotspotScore(h, state, horizonSec){
  // features
  const risk = clamp(h.risk, 0, 100);
  const traffic = clamp(h.traffic, 0, 1);
  const touch = clamp(h.touchLevel, 0, 1);
  const lastMin = clamp(h.timeLastCleanedMin, 0, 2000);

  // contagion / wave multiplier
  const wave = state && state.germ && state.germ.active ? 1.15 : 1.00;
  const waveBoost = state && state.germ && state.germ.boost ? clamp(state.germ.boost,1,1.5) : 1.0;

  // time pressure: near end => prioritize fast value
  const tLeft = clamp(state.timeLeftS, 0, 999);
  const hurry = (tLeft <= 12) ? 1.12 : (tLeft <= 20 ? 1.06 : 1.0);

  // predicted delta in next horizon: traffic*touch*(age) + wave
  const age = clamp(lastMin/1200, 0, 1.2);
  const sf = surfaceFactor(h.surfaceType);

  // score: "expected risk impact" (0..~200)
  const base = (risk * 0.55) + (traffic*100 * 0.25) + (touch*100 * 0.20);
  const delta = (traffic*touch*100) * (0.35 + 0.45*age) * (horizonSec/10);
  const score = (base + delta) * wave * waveBoost * sf * hurry;

  return score;
}

function topKHotspots(hotspots, state, k=3, horizonSec=10){
  const arr = hotspots.map(h=>({
    id: h.id, name: h.name || h.id, label: h.label || '',
    x: h.x, y: h.y,
    score: predictHotspotScore(h, state, horizonSec),
    meta: {
      risk: h.risk, traffic: h.traffic, touchLevel: h.touchLevel,
      surfaceType: h.surfaceType, timeLastCleanedMin: h.timeLastCleanedMin,
      zone: h.zone || ''
    }
  }));
  arr.sort((a,b)=> b.score - a.score);
  return arr.slice(0, k);
}

function explainWhy(h){
  const parts = [];
  if((h.meta?.traffic||0) >= 0.85) parts.push('คนจับบ่อย');
  if((h.meta?.touchLevel||0) >= 0.9) parts.push('จุดสัมผัสสูง');
  if((h.meta?.risk||0) >= 78) parts.push('เสี่ยงสูง');
  if((h.meta?.timeLastCleanedMin||0) >= 800) parts.push('ไม่ได้เช็ดนาน');
  if(String(h.meta?.zone||'').includes('wet')) parts.push('โซนเปียก');
  if(!parts.length) parts.push('คุ้มสุดตอนนี้');
  return parts.slice(0,2).join(' + ');
}

// ===== Coach (explainable micro tips) =====
function pickCoachTip(state, top3){
  // 1) resource warning
  if(state.mode==='A'){
    if(state.spraysLeft <= 1 && top3[0]){
      return { tipId:'spray_last', text:`เหลือ ${state.spraysLeft} ครั้ง! เลือก "${top3[0].name}" เพราะ ${explainWhy(top3[0])}` };
    }
    if(state.timeLeftS <= 12 && top3[0]){
      return { tipId:'time_low', text:`ใกล้หมดเวลา! รีบเก็บ "${top3[0].name}" (คุ้มสุดตอนนี้)` };
    }
    if(state.germ?.active && top3[0]){
      return { tipId:'wave_active', text:`คลื่นเชื้อมาแล้ว! จุด "${top3[0].name}" เสี่ยงพุ่ง เพราะ ${explainWhy(top3[0])}` };
    }
  }
  if(state.mode==='B'){
    if(state.routeLen===0) return { tipId:'route_start', text:'เริ่มจากจุด “สัมผัสร่วม” ก่อน แล้วค่อยเก็บโซนเปียก' };
    if(state.routeLen>0 && state.balance && state.balance.wet===0) return { tipId:'route_wet', text:'แผนยังขาด “โซนเปียก” 1 จุด — เพิ่มก๊อกน้ำ/ห้องน้ำจะคุ้ม' };
    if(state.routeLen>0 && state.balance && state.balance.shared<2) return { tipId:'route_shared', text:'ลองเพิ่ม “ของใช้ร่วม” ให้ครบอย่างน้อย 2 จุด (คุมการแพร่เชื้อได้ดี)' };
  }
  return { tipId:'ok', text:'เลือกแบบคุ้ม ๆ แล้วไปต่อเลย!' };
}

// ===== Germ Wave (storm) =====
function makeGermSchedule(seedStr){
  const rng = makeRng(`germ::${seedStr}`);
  // deterministic start around 18..28s, duration 8..12s, boost 1.15..1.35
  const startS = 18 + Math.floor(rng()*11);   // 18-28
  const durS = 8 + Math.floor(rng()*5);       // 8-12
  const boost = 1.15 + rng()*0.20;            // 1.15-1.35
  return { startS, endS: startS+durS, boost: Number(boost.toFixed(2)) };
}

// ===== Heist scoring (Mode B) =====
function scoreRoute(routeIds, hotspotsById){
  const ids = Array.isArray(routeIds) ? routeIds : [];
  const uniq = [];
  const seen = new Set();
  for(const id of ids){
    if(!id || seen.has(id)) continue;
    seen.add(id); uniq.push(id);
  }

  let riskSum=0, touchSum=0, trafficSum=0;
  const balance = { wet:0, shared:0, highTouch:0, entry:0, rows:0, front:0, other:0 };
  const coords = [];

  for(const id of uniq){
    const h = hotspotsById[id];
    if(!h) continue;
    riskSum += clamp(h.risk,0,100);
    touchSum += clamp(h.touchLevel,0,1);
    trafficSum += clamp(h.traffic,0,1);
    coords.push([Number(h.x)||0, Number(h.y)||0]);

    const z = String(h.zone||'other');
    if(z.includes('wet')) balance.wet++;
    else if(z.includes('shared')) balance.shared++;
    else if(z.includes('entry')) balance.entry++;
    else if(z.includes('rows')) balance.rows++;
    else if(z.includes('front')) balance.front++;
    else balance.other++;

    if((h.touchLevel||0) >= 0.9) balance.highTouch++;
  }

  // travel efficiency: Manhattan distance total
  let dist=0;
  for(let i=1;i<coords.length;i++){
    dist += Math.abs(coords[i][0]-coords[i-1][0]) + Math.abs(coords[i][1]-coords[i-1][1]);
  }

  const n = Math.max(1, coords.length);
  const avgRisk = riskSum/n;
  const avgTouch = touchSum/n;
  const avgTraffic = trafficSum/n;

  // coverage proxy: selected count vs total unknown here -> caller provides
  const travelPenalty = clamp(dist / Math.max(1, n-1), 0, 8); // per-step
  const balanceScore =
    clamp(balance.highTouch/Math.max(1,n),0,1)*35 +
    clamp(balance.shared/2,0,1)*25 +
    clamp(balance.wet/1,0,1)*15;

  const valueScore = clamp(avgRisk/100,0,1)*45 + clamp(avgTraffic,0,1)*25 + clamp(avgTouch,0,1)*20;
  const efficiency = clamp(1 - (travelPenalty/8), 0, 1) * 20;

  const total = Math.round(balanceScore + valueScore + efficiency); // 0..100-ish

  // explain 2 points
  const explain = [];
  if(balance.shared < 2) explain.push('ของใช้ร่วมยังน้อย (<2)');
  if(balance.wet < 1) explain.push('ยังไม่มีโซนเปียก');
  if(balance.highTouch < 2) explain.push('จุดสัมผัสสูงยังไม่พอ');
  if(travelPenalty > 4) explain.push('ทางเดินอ้อมไป (สิ้นเปลืองเวลา)');
  if(!explain.length) explain.push('แผนสมดุลและคุ้มมาก');

  return {
    routeUniq: uniq,
    dist,
    travelPenalty,
    balance,
    total,
    explainTop2: explain.slice(0,2)
  };
}

// ===== Public API =====
export function createCleanAI(cfg){
  cfg = cfg || {};
  const seed = String(cfg.seed || Date.now());
  const schedule = makeGermSchedule(seed);
  let lastCoachAt = -1e9;
  let lastPredAt = -1e9;

  return {
    germSchedule: schedule,

    predict({ hotspots, state, horizonSec=10 }){
      const t = nowMs();
      // throttle
      if(t - lastPredAt < 700) return null;
      lastPredAt = t;
      const top3 = topKHotspots(hotspots, state, 3, horizonSec);
      // attach why
      for(const x of top3) x.why = explainWhy(x);
      return top3;
    },

    coach({ state, top3 }){
      const t = nowMs();
      if(t - lastCoachAt < 2200) return null; // rate-limit
      lastCoachAt = t;
      return pickCoachTip(state, top3 || []);
    },

    scoreRoute({ routeIds, hotspotsById }){
      return scoreRoute(routeIds, hotspotsById);
    }
  };
}