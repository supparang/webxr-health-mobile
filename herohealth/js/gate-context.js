// === /herohealth/js/gate-context.js ===
// HeroHealth Gate Context Helper — AN-7
// อ่าน gate markers จาก URL, anti-replay per session, และช่วย serialize ลง logs
'use strict';

const WIN = window;

function qs(name, d=''){
  try{
    const u = new URL(WIN.location.href);
    return u.searchParams.get(name) ?? d;
  }catch(e){
    return d;
  }
}

function qn(name, d=0){
  const n = Number(qs(name, d));
  return Number.isFinite(n) ? n : d;
}

function qbool(name){
  const v = String(qs(name,'')).toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'yes';
}

function safeStr(v, max=120){
  v = String(v ?? '').trim();
  return v.length > max ? v.slice(0,max) : v;
}

function getSessionKeyBase(){
  // ป้องกัน replay ภายใน tab/session เดียว
  // ใช้ path + pid + seed (ถ้ามี)
  const pid = safeStr(qs('pid','anon'), 64) || 'anon';
  const seed = safeStr(qs('seed',''), 64);
  const path = (location.pathname || '').toLowerCase();
  return `HHA_GATE_APPLIED:${path}:${pid}:${seed || 'noseed'}`;
}

export function readGateContextFromUrl(){
  const gateDone = safeStr(qs('gateDone',''));
  const hasGate = !!gateDone;

  const ctx = {
    hasGate,
    gateDone,                           // warmup|cooldown
    gateSkipped: qbool('gateSkipped'),
    gateCat: safeStr(qs('gateCat','')),
    gateTheme: safeStr(qs('gateTheme','')),
    gatePickMode: safeStr(qs('gatePickMode','')),
    gatePickSource: safeStr(qs('gatePickSource','')),

    gateScore: qn('gateScore', 0),
    gateMiss: qn('gateMiss', 0),
    gateTotal: qn('gateTotal', 0),
    gateAcc: qn('gateAcc', 0),
    gateDur: qn('gateDur', 0),
    gateDay: safeStr(qs('gateDay','')),

    gateRank: safeStr(qs('gateRank','')),
    gateBuffPct: qn('gateBuffPct', 0),
    gateBuffType: safeStr(qs('gateBuffType','')),

    // warmup buff passthrough from gate
    wType: safeStr(qs('wType','')),
    wPct: qn('wPct', 0),
    rank: safeStr(qs('rank','')),
    wCrit: qn('wCrit', 0),
    wDmg: qn('wDmg', 0),
    wHeal: qn('wHeal', 0),

    pid: safeStr(qs('pid','anon'), 64) || 'anon',
    run: safeStr(qs('run','play')),
    diff: safeStr(qs('diff','normal')),
    seed: safeStr(qs('seed','')),
    view: safeStr(qs('view','')),
    log: safeStr(qs('log','')),
    studyId: safeStr(qs('studyId','')),
    researchPhase: safeStr(qs('researchPhase', qs('phase',''))),
    conditionGroup: safeStr(qs('conditionGroup','')),
  };

  // normalize rank/buff fallback
  if(!ctx.gateRank && ctx.rank) ctx.gateRank = ctx.rank;
  if(!ctx.gateBuffPct && ctx.wPct) ctx.gateBuffPct = ctx.wPct;
  if(!ctx.gateBuffType && ctx.wType) ctx.gateBuffType = ctx.wType;

  return ctx;
}

export function gateReplayInfo(ctx){
  const key = getSessionKeyBase();
  let applied = false;
  let payload = null;
  try{
    payload = JSON.parse(sessionStorage.getItem(key) || 'null');
    applied = !!payload;
  }catch(e){
    applied = false;
  }
  return { key, applied, payload, ctx };
}

export function markGateApplied(ctx, extra){
  const key = getSessionKeyBase();
  const payload = {
    ts: Date.now(),
    gateDone: String(ctx?.gateDone || ''),
    gateCat: String(ctx?.gateCat || ''),
    gateTheme: String(ctx?.gateTheme || ''),
    gateSkipped: !!ctx?.gateSkipped,
    wPct: Number(ctx?.wPct || 0),
    rank: String(ctx?.rank || ctx?.gateRank || ''),
    extra: extra || {}
  };
  try{ sessionStorage.setItem(key, JSON.stringify(payload)); }catch(e){}
  return payload;
}

export function clearGateAppliedMarker(){
  try{ sessionStorage.removeItem(getSessionKeyBase()); }catch(e){}
}

export function shouldApplyWarmupBuff(ctx){
  if(!ctx || !ctx.hasGate) return false;
  if(ctx.gateDone !== 'warmup') return false;
  if(ctx.gateSkipped) return false;
  return true;
}

export function buildGateContextForLog(ctx){
  if(!ctx || !ctx.hasGate){
    return {
      gate_present: 0
    };
  }
  return {
    gate_present: 1,
    gate_done: ctx.gateDone || '',
    gate_skipped: ctx.gateSkipped ? 1 : 0,
    gate_cat: ctx.gateCat || '',
    gate_theme: ctx.gateTheme || '',
    gate_pick_mode: ctx.gatePickMode || '',
    gate_pick_source: ctx.gatePickSource || '',
    gate_score: Number(ctx.gateScore || 0),
    gate_miss: Number(ctx.gateMiss || 0),
    gate_total: Number(ctx.gateTotal || 0),
    gate_acc: Number(ctx.gateAcc || 0),
    gate_dur: Number(ctx.gateDur || 0),
    gate_day: ctx.gateDay || '',
    gate_rank: ctx.gateRank || '',
    gate_buff_type: ctx.gateBuffType || ctx.wType || '',
    gate_buff_pct: Number(ctx.gateBuffPct || ctx.wPct || 0),

    // warmup buff flags
    w_type: ctx.wType || '',
    w_pct: Number(ctx.wPct || 0),
    w_rank: ctx.rank || ctx.gateRank || '',
    w_crit: Number(ctx.wCrit || 0),
    w_dmg: Number(ctx.wDmg || 0),
    w_heal: Number(ctx.wHeal || 0),
  };
}

// ใช้ลบ query markers หลังอ่านเสร็จ (optional)
export function stripGateParamsFromUrl({ replace=true } = {}){
  try{
    const u = new URL(location.href);
    const keys = [
      'gateDone','gateSkipped','gateCat','gateTheme','gatePickMode','gatePickSource',
      'gateScore','gateMiss','gateTotal','gateAcc','gateDur','gateDay',
      'gateRank','gateBuffPct','gateBuffType',
      'wType','wPct','rank','wCrit','wDmg','wHeal'
    ];
    let changed = false;
    keys.forEach(k=>{
      if(u.searchParams.has(k)){ u.searchParams.delete(k); changed = true; }
    });
    if(changed && replace){
      history.replaceState(null, '', u.toString());
    }
    return changed;
  }catch(e){
    return false;
  }
}