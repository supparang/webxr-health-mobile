// === /herohealth/hub.boot.js ===
// HeroHealth HUB Controller — PRODUCTION (PATCH v20260222-planWarmupSeq-ultra)
// ✅ Warmup/Cooldown Gate routing for real Hub buttons
// ✅ Supports hygiene additions: germ-detective, bath, cleanobjects(home-clean)
// ✅ Supports overrides: ?pick=rand|day and ?variant=1..5
// ✅ Plan Runner integration (AN + AN-Plus + AN-Ultra)
// ✅ Direct cooldown chain via cdnext (slot -> next slot warmup gate)
// ✅ Preserves hub context + plan sequence params in ?hub=
'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

// ---- base endpoint
const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

// ---- Hub params (pass-through)
const P = {
  run:  String(qs('run','play')).toLowerCase() || 'play',        // play|research
  diff: String(qs('diff','normal')).toLowerCase() || 'normal',
  time: clamp(qs('time','80'), 20, 300),
  seed: String(qs('seed', nowSeed())),

  // research context
  studyId: String(qs('studyId','')).trim(),
  phase: String(qs('phase','')).trim(), // research phase (not gate phase)
  conditionGroup: String(qs('conditionGroup','')).trim(),
  pid: String(qs('pid','')).trim() || 'anon',

  // view/log passthrough
  view: String(qs('view','')).trim(),
  log: String(qs('log','')).trim(),

  // overrides for warmup-gate
  pick: String(qs('pick','')).toLowerCase().trim(),   // rand|day
  variant: String(qs('variant','')).trim(),           // 1..5
};

// ---- DOM helpers
const DOC = document;
const $$ = (sel)=>Array.from(DOC.querySelectorAll(sel));
const $  = (sel)=>DOC.querySelector(sel);

function abs(url){
  if(!url) return '';
  try{ return new URL(url, location.href).toString(); }catch(e){ return url; }
}

function buildUrl(base, params){
  const u = new URL(base, location.href);
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v===undefined || v===null || v==='') return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

function passCommon(u){
  const keys = ['run','diff','time','seed','studyId','phase','conditionGroup','pid','view','log','pick','variant'];
  keys.forEach(k=>{
    const v = P[k];
    if(v!==undefined && v!==null && String(v).trim()!=='') u.searchParams.set(k, String(v));
  });
}

function decidePickMode(){
  // user override wins
  if(P.pick==='rand' || P.pick==='day') return P.pick;
  // default policy: play=rand, research=day
  return (P.run==='research') ? 'day' : 'rand';
}

// ============================================================
// PLAN / SEQUENCE HELPERS (AN + AN-Plus + AN-Ultra)
// ============================================================

function parseCsvList(s){
  return String(s || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

function normDayKey(v){
  const s = String(v || '').trim().toLowerCase();
  if (!s) return '1';
  if (['1','d1','day1'].includes(s)) return '1';
  if (['2','d2','day2'].includes(s)) return '2';
  if (['3','d3','day3'].includes(s)) return '3';
  return s.replace(/[^\w-]/g,'') || '1';
}

function normalizeSlotOrder(slots){
  const uniq = [];
  const seen = new Set();
  (slots || []).forEach(x=>{
    const k = String(x || '').trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    uniq.push(k);
  });
  return uniq;
}

function todayKeyLocal(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

// default slot templates per day (customize later)
function getPlanSlotsForDay(day){
  const d = normDayKey(day);
  if (d === '2') return ['s1','s2','s3'];
  if (d === '3') return ['s1','s2','s3'];
  return ['s1','s2','s3'];
}

// ---------- canonical game/zone ----------
function canonicalGameKey(game){
  const g = String(game || '').toLowerCase().trim();

  // nutrition
  if (['goodjunk','good-junk'].includes(g)) return 'goodjunk';
  if (['groups','foodgroups','food-groups'].includes(g)) return 'groups';
  if (['hydration','water'].includes(g)) return 'hydration';
  if (['plate','balancedplate','balanced-plate'].includes(g)) return 'plate';

  // hygiene
  if (['handwash','wash','hygiene'].includes(g)) return 'handwash';
  if (['brush','toothbrush','brushing'].includes(g)) return 'brush';
  if (['maskcough','mask-cough','mask','cough'].includes(g)) return 'maskcough';
  if (['germdetective','germ-detective','germ'].includes(g)) return 'germdetective';
  if (['bath','bathing'].includes(g)) return 'bath';
  if (['cleanobjects','clean-objects','clean','home-clean'].includes(g)) return 'cleanobjects';

  // exercise
  if (['planner','fitnessplanner','fitness-planner'].includes(g)) return 'planner';
  if (['shadow','shadowbreaker','shadow-breaker'].includes(g)) return 'shadow';
  if (['rhythm','rhythmboxer','rhythm-boxer'].includes(g)) return 'rhythm';
  if (['jumpduck','jump-duck'].includes(g)) return 'jumpduck';
  if (['balance','balancehold','balance-hold'].includes(g)) return 'balancehold';

  return g || 'goodjunk';
}

function zoneOfGame(game){
  const g = canonicalGameKey(game);
  if (['goodjunk','groups','hydration','plate'].includes(g)) return 'nutrition';
  if (['handwash','brush','maskcough','germdetective','bath','cleanobjects'].includes(g)) return 'hygiene';
  if (['planner','shadow','rhythm','jumpduck','balancehold'].includes(g)) return 'exercise';
  return 'nutrition';
}

function gamesInZone(zone){
  const z = String(zone || '').toLowerCase().trim();
  if (z === 'nutrition') return ['goodjunk','groups','hydration','plate'];
  if (z === 'hygiene') return ['handwash','brush','maskcough','germdetective','bath','cleanobjects'];
  if (z === 'exercise') return ['planner','shadow','rhythm','jumpduck','balancehold'];
  return ['goodjunk','groups','hydration','plate'];
}

function hash32(str){
  let h = 2166136261 >>> 0;
  const s = String(str || '');
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickVariantInSameZone(baseGame, pickMode, ctx){
  const zone = zoneOfGame(baseGame);
  const pool = gamesInZone(zone);
  if (!pool.length) return canonicalGameKey(baseGame);

  const mode = String(pickMode || '').toLowerCase().trim() || 'rand';
  if (mode === 'rand'){
    return pool[(Math.random() * pool.length) | 0];
  }

  // day deterministic
  const pid = String((ctx && ctx.pid) || P.pid || 'anon').trim() || 'anon';
  const dayKey = String((ctx && ctx.dayKey) || todayKeyLocal());
  const slot = String((ctx && ctx.slot) || '');
  const run = String((ctx && ctx.run) || P.run || 'play');
  const seedStr = `${pid}|${dayKey}|${slot}|${zone}|${run}`;
  const idx = hash32(seedStr) % pool.length;
  return pool[idx];
}

// ---------- plan source (state/config) ----------
function resolvePlanItemFromState(day, slot){
  const d = normDayKey(day);
  const s = String(slot || '').toLowerCase().trim();

  // localStorage override (optional)
  try{
    const key = `HHA_PLAN_DAY_${d}`;
    const raw = localStorage.getItem(key);
    if (raw){
      const obj = JSON.parse(raw);
      const item = obj && obj[s];
      if (item && (item.game || item.zone)) {
        return {
          game: canonicalGameKey(item.game || ''),
          zone: String(item.zone || zoneOfGame(item.game || '')).toLowerCase()
        };
      }
    }
  }catch(e){}

  // fallback defaults (edit later)
  const defaults = {
    '1': {
      s1: { game:'goodjunk', zone:'nutrition' },
      s2: { game:'handwash', zone:'hygiene'   },
      s3: { game:'planner',  zone:'exercise'  },
    },
    '2': {
      s1: { game:'groups',    zone:'nutrition' },
      s2: { game:'maskcough', zone:'hygiene'   },
      s3: { game:'rhythm',    zone:'exercise'  },
    },
    '3': {
      s1: { game:'plate',         zone:'nutrition' },
      s2: { game:'germdetective', zone:'hygiene'   },
      s3: { game:'jumpduck',      zone:'exercise'  },
    }
  };

  const dayMap = defaults[d] || defaults['1'];
  return dayMap[s] || dayMap['s1'] || { game:'goodjunk', zone:'nutrition' };
}

// ---------- hub URL helper (preserve sequence context) ----------
function buildHubUrlWithContext(extra){
  const u = new URL(abs('./hub.html'), location.href);

  passCommon(u);

  const seqKeys = ['planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext','plannedGame','finalGame','zone'];
  seqKeys.forEach(k=>{
    const v = qs(k,'');
    if(v!=='' && !u.searchParams.has(k)) u.searchParams.set(k, String(v));
  });

  Object.entries(extra || {}).forEach(([k,v])=>{
    if(v===undefined || v===null || v==='') return;
    u.searchParams.set(k, String(v));
  });

  return u.toString();
}

// Map each game to (cat, theme) for gate
function mapGameToCatTheme(gameKey){
  gameKey = String(gameKey||'').toLowerCase().trim();

  // nutrition
  if(gameKey==='goodjunk')      return { cat:'nutrition', theme:'goodjunk' };
  if(gameKey==='groups')        return { cat:'nutrition', theme:'groups' };
  if(gameKey==='hydration')     return { cat:'nutrition', theme:'hydration' };
  if(gameKey==='plate')         return { cat:'nutrition', theme:'plate' };

  // hygiene
  if(gameKey==='handwash')      return { cat:'hygiene', theme:'handwash' };
  if(gameKey==='brush')         return { cat:'hygiene', theme:'brush' };
  if(gameKey==='maskcough')     return { cat:'hygiene', theme:'maskcough' };
  if(gameKey==='germdetective') return { cat:'hygiene', theme:'germdetective' };
  if(gameKey==='germ')          return { cat:'hygiene', theme:'germdetective' }; // alias
  if(gameKey==='bath')          return { cat:'hygiene', theme:'bath' };
  if(gameKey==='cleanobjects')  return { cat:'hygiene', theme:'clean' };
  if(gameKey==='clean')         return { cat:'hygiene', theme:'clean' };          // alias

  // exercise (warmup-gate uses cat='exercise')
  if(gameKey==='shadow')        return { cat:'exercise', theme:'shadow' };
  if(gameKey==='rhythm')        return { cat:'exercise', theme:'rhythm' };
  if(gameKey==='jumpduck')      return { cat:'exercise', theme:'jumpduck' };
  if(gameKey==='balancehold')   return { cat:'exercise', theme:'balance' };
  if(gameKey==='balance')       return { cat:'exercise', theme:'balance' };        // alias
  if(gameKey==='planner')       return { cat:'exercise', theme:'planner' };

  return { cat:'nutrition', theme:'goodjunk' };
}

function warmupGateUrlFor(nextUrl, gameKey, gatePhase, extra){
  const gate = abs('./warmup-gate.html');
  const hub  = abs('./hub.html');

  const { cat, theme } = mapGameToCatTheme(gameKey);
  const pick = decidePickMode();
  const ex = extra || {};

  const params = {
    hub,
    next: abs(nextUrl || hub),

    // gate phase
    gatePhase: String(gatePhase || 'warmup'),
    phase: String(gatePhase || 'warmup'), // backward compatibility

    cat,
    theme,
    pick,

    // common context
    run: P.run, diff: P.diff, time: P.time, seed: P.seed,
    studyId: P.studyId,
    pid: P.pid,
    view: P.view, log: P.log
  };

  // preserve research phase separately
  if (P.phase) params.researchPhase = P.phase;
  if (P.conditionGroup) params.conditionGroup = P.conditionGroup;

  if (P.variant) params.variant = P.variant;

  Object.entries(ex).forEach(([k,v])=>{
    if(v===undefined || v===null || v==='') return;
    params[k] = v;
  });

  return buildUrl(gate, params);
}

// ---------- Build real game run URL ----------
function buildGameRunUrlFromGameKey(gameKey, params){
  const key = canonicalGameKey(gameKey);
  const p = params || {};

  const hrefMap = {
    // nutrition
    goodjunk: './goodjunk-vr.html',
    groups: './groups-vr.html',
    hydration: './hydration-vr.html',
    plate: './plate-vr.html',

    // hygiene
    handwash: './hygiene-vr.html',
    brush: './brush-vr.html',
    maskcough: './maskcough-vr.html',
    germdetective: './germ-detective-vr.html', // ปรับถ้าชื่อไฟล์จริงต่าง
    bath: './bath-vr.html',                    // ปรับถ้าชื่อไฟล์จริงต่าง
    cleanobjects: './home-clean.html',

    // exercise
    planner: './fitness-planner-vr.html',
    shadow: '../fitness/shadow-breaker.html',
    rhythm: '../fitness/rhythm-boxer.html',
    jumpduck: './jump-duck-vr.html',
    balancehold: './balance-hold-vr.html',
  };

  const base = hrefMap[key] || './goodjunk-vr.html';
  const u = new URL(base, location.href);

  passCommon(u);

  const hubUrl = buildHubUrlWithContext({
    planSeq: p.planSeq ? 1 : '',
    planDay: p.planDay || '',
    planSlot: p.planSlot || '',
    planMode: p.planMode || '',
    planSlots: p.planSlots || '',
    planIndex: (p.planIndex ?? ''),
    autoNext: p.autoNext ? 1 : '',
    plannedGame: p.plannedGame || '',
    finalGame: p.finalGame || key,
    zone: p.zone || zoneOfGame(key)
  });
  u.searchParams.set('hub', hubUrl);

  if (Number(p.cooldown || 0)) u.searchParams.set('cooldown', '1');
  if (p.cdur != null) u.searchParams.set('cdur', String(p.cdur));
  if (p.cdnext) u.searchParams.set('cdnext', String(p.cdnext)); // direct-chain

  if (p.dur != null) u.searchParams.set('dur', String(p.dur));

  [
    'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
    'plannedGame','finalGame','zone'
  ].forEach(k=>{
    const v = p[k];
    if(v===undefined || v===null || v==='') return;
    u.searchParams.set(k, String(v));
  });

  return u.toString();
}

// ---------- AN-Ultra) Build next warmup gate URL for next plan slot ----------
function computeNextPlanSlotGateUrl(ctx, options){
  const day = normDayKey(ctx.day || '1');
  const slots = (ctx.slots && ctx.slots.length) ? normalizeSlotOrder(ctx.slots) : getPlanSlotsForDay(day);

  const curIndex = Number.isFinite(Number(ctx.index))
    ? Number(ctx.index)
    : Math.max(0, slots.indexOf(String(ctx.slot||'').toLowerCase()));

  const nextIndex = curIndex + 1;
  const hasNext = nextIndex < slots.length;

  const opt = Object.assign({
    warmupDur: 20,
    cooldownDur: 15,
    enableCooldown: 1
  }, options || {});

  if(!hasNext){
    return buildHubUrlWithContext({
      planSeq: 1,
      planDay: day,
      planSlot: ctx.slot || '',
      planMode: ctx.mode || 'plan',
      planSlots: slots.join(','),
      planIndex: curIndex,
      autoNext: ctx.autoNext ? 1 : ''
    });
  }

  const nextSlot = slots[nextIndex];
  const resolved = resolvePlanItemFromState(day, nextSlot);
  let baseGame = canonicalGameKey((resolved && resolved.game) || '');
  let zone = String((resolved && resolved.zone) || '').toLowerCase().trim();

  if(!baseGame){
    if(zone === 'hygiene') baseGame = 'handwash';
    else if(zone === 'exercise') baseGame = 'planner';
    else baseGame = 'goodjunk';
  }
  if(!zone) zone = zoneOfGame(baseGame);

  const mode = String(ctx.mode || 'plan').toLowerCase();
  let finalGame = baseGame;
  if(mode === 'zone-random' || mode === 'zone-day'){
    finalGame = pickVariantInSameZone(baseGame, (mode === 'zone-day' ? 'day' : 'rand'), {
      pid: P.pid,
      dayKey: todayKeyLocal(),
      slot: nextSlot,
      run: P.run
    });
  }

  const planMeta = {
    planDay: day,
    planSlot: nextSlot,
    planMode: mode,
    planSeq: 1,
    planSlots: slots.join(','),
    planIndex: nextIndex,
    autoNext: ctx.autoNext ? 1 : 0,
    plannedGame: baseGame,
    finalGame,
    zone
  };

  const gameUrl = buildGameRunUrlFromGameKey(finalGame, {
    ...planMeta,
    cdur: opt.cooldownDur,
    cooldown: opt.enableCooldown ? 1 : 0
  });

  return warmupGateUrlFor(gameUrl, finalGame, 'warmup', {
    dur: opt.warmupDur,
    cdur: opt.cooldownDur,
    ...planMeta
  });
}

function computeCooldownNextTargetForPlan(params){
  const day = normDayKey(params.planDay || '1');
  const slots = parseCsvList(params.planSlots || '').length
    ? normalizeSlotOrder(parseCsvList(params.planSlots || ''))
    : getPlanSlotsForDay(day);

  const idx = Number.isFinite(Number(params.planIndex))
    ? Number(params.planIndex)
    : Math.max(0, slots.indexOf(String(params.planSlot || '').toLowerCase()));

  const ctx = {
    day,
    slot: params.planSlot || slots[idx] || '',
    mode: params.planMode || 'plan',
    slots,
    index: idx,
    autoNext: Number(params.autoNext || 0) ? 1 : 0
  };

  const input = (typeof readPlanRunnerInputs === 'function')
    ? readPlanRunnerInputs()
    : { warmupDur:20, cooldownDur:15, enableCooldown:true };

  return computeNextPlanSlotGateUrl(ctx, {
    warmupDur: Number(input.warmupDur || 20),
    cooldownDur: Number(input.cooldownDur || 15),
    enableCooldown: input.enableCooldown ? 1 : 0
  });
}

// ---------- Optional plan runner inputs reader (safe fallback) ----------
function readPlanRunnerInputs(){
  // ถ้าคุณมี UI panel อยู่แล้ว ให้เปลี่ยน selector ให้ตรงจริงได้
  const dayEl = DOC.getElementById('planDay');
  const slotEl = DOC.getElementById('planSlot');
  const modeEl = DOC.getElementById('planMode');
  const autoEl = DOC.getElementById('planAutoNext');
  const wuEl = DOC.getElementById('planWarmupDur');
  const cdEl = DOC.getElementById('planCooldownDur');
  const enCdEl = DOC.getElementById('planEnableCooldown');

  return {
    day: dayEl ? String(dayEl.value || '1') : String(qs('planDay','1') || '1'),
    slot: slotEl ? String(slotEl.value || 's1') : String(qs('planSlot','s1') || 's1'),
    mode: modeEl ? String(modeEl.value || 'plan') : String(qs('planMode','plan') || 'plan'),
    autoNext: autoEl ? !!autoEl.checked : Number(qs('autoNext','0')) === 1,
    warmupDur: wuEl ? Number(wuEl.value || 20) : Number(qs('dur','20') || 20),
    cooldownDur: cdEl ? Number(cdEl.value || 15) : Number(qs('cdur','15') || 15),
    enableCooldown: enCdEl ? !!enCdEl.checked : Number(qs('cooldown','1')) !== 0
  };
}

// ---------- Start a plan slot (AN-Plus/Ultra) ----------
function startPlanDaySlot(opts){
  const o = opts || {};

  const day = normDayKey(o.day || qs('planDay','1') || '1');
  const slot = String(o.slot || qs('planSlot','s1') || 's1').toLowerCase();
  const mode = String(o.mode || qs('planMode','plan') || 'plan').toLowerCase(); // plan | zone-random | zone-day
  const planSeq = Number(o.planSeq ?? qs('planSeq','1')) ? 1 : 0;
  const autoNext = Number(o.autoNext ?? qs('autoNext','0')) ? 1 : 0;

  const input = (typeof readPlanRunnerInputs === 'function')
    ? readPlanRunnerInputs()
    : { warmupDur:20, cooldownDur:15, enableCooldown:true };

  const warmupDur = Number(o.warmupDur ?? input.warmupDur ?? 20) || 20;
  const cooldownDur = Number(o.cooldownDur ?? input.cooldownDur ?? 15) || 15;
  const enableCooldown = Number(o.enableCooldown ?? (input.enableCooldown ? 1 : 0));

  const slots = normalizeSlotOrder(
    parseCsvList(o.planSlots || qs('planSlots','')).length
      ? parseCsvList(o.planSlots || qs('planSlots',''))
      : getPlanSlotsForDay(day)
  );
  const planSlotsCsv = slots.join(',');
  const planIndex = Number.isFinite(Number(o.planIndex))
    ? Number(o.planIndex)
    : Math.max(0, slots.indexOf(slot));

  const resolved = resolvePlanItemFromState(day, slot);
  let baseGame = canonicalGameKey((resolved && resolved.game) || '');
  let zone = String((resolved && resolved.zone) || zoneOfGame(baseGame)).toLowerCase();

  if (!baseGame){
    if(zone === 'hygiene') baseGame = 'handwash';
    else if(zone === 'exercise') baseGame = 'planner';
    else baseGame = 'goodjunk';
  }
  if (!zone) zone = zoneOfGame(baseGame);

  let finalGame = baseGame;
  if (mode === 'zone-random' || mode === 'zone-day'){
    finalGame = pickVariantInSameZone(baseGame, mode === 'zone-day' ? 'day' : 'rand', {
      pid: P.pid,
      dayKey: todayKeyLocal(),
      slot,
      run: P.run
    });
  }

  const planMeta = {
    planSeq,
    planDay: day,
    planSlot: slot,
    planMode: mode,
    planSlots: planSlotsCsv,
    planIndex: (planIndex < 0 ? 0 : planIndex),
    autoNext,
    plannedGame: baseGame,
    finalGame,
    zone
  };

  let cdnext = '';
  if (planSeq) {
    cdnext = computeCooldownNextTargetForPlan(planMeta);
  }

  const gameUrl = buildGameRunUrlFromGameKey(finalGame, {
    ...planMeta,
    cooldown: enableCooldown ? 1 : 0,
    cdur: cooldownDur,
    cdnext
  });

  const gateUrl = warmupGateUrlFor(gameUrl, finalGame, 'warmup', {
    dur: warmupDur,
    cdur: cooldownDur,
    ...planMeta
  });

  location.href = gateUrl;
}

// ---------- Patch plain hub links (pass-through + hub back link) ----------
function patchLink(id){
  const el = DOC.getElementById(id);
  if(!el) return;
  const href = el.getAttribute('href');
  if(!href || href === '#' || el.getAttribute('aria-disabled') === 'true') return;

  try{
    const u = new URL(href, location.href);
    passCommon(u);
    u.searchParams.set('hub', buildHubUrlWithContext());
    el.setAttribute('href', u.toString());
  }catch(e){}
}

// ---------- Real hub button routing via warmup-gate ----------
function setupHubButtons(){
  const BTN_GAME_MAP = {
    // Nutrition
    goGoodJunk: 'goodjunk',
    goGroups: 'groups',
    goHydration: 'hydration',
    goPlate: 'plate',

    // Hygiene
    goHandwash: 'handwash',
    goBrush: 'brush',
    goMaskCough: 'maskcough',
    goGermDetective: 'germdetective',
    goBath: 'bath',
    goCleanObjects: 'cleanobjects',

    // Fitness
    goPlanner: 'planner',
    goShadow: 'shadow',
    goRhythm: 'rhythm',
    goJumpDuck: 'jumpduck',
    goBalanceHold: 'balancehold',
  };

  Object.entries(BTN_GAME_MAP).forEach(([id, gameKey])=>{
    const el = DOC.getElementById(id);
    if(!el) return;

    const href = el.getAttribute('href') || '';
    const disabled = el.classList.contains('btn--disabled') || el.getAttribute('aria-disabled') === 'true' || href === '#';
    if(disabled) return;

    patchLink(id);

    el.addEventListener('click', (e)=>{
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;

      e.preventDefault();

      const currentHref = el.getAttribute('href') || href;
      const gateUrl = warmupGateUrlFor(currentHref, gameKey, 'warmup');
      location.href = gateUrl;
    });
  });
}

// ---------- Legacy generic card wiring ----------
function setupGameCards(){
  $$('.game-card,[data-game][data-run-href]').forEach(el=>{
    const game = el.getAttribute('data-game');
    const runHref = el.getAttribute('data-run-href');
    if(!game || !runHref) return;

    el.addEventListener('click', (e)=>{
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      e.preventDefault();
      const gate = warmupGateUrlFor(runHref, game, 'warmup');
      location.href = gate;
    });
  });

  const cd = $('#btnCooldown');
  if(cd){
    cd.addEventListener('click', (e)=>{
      e.preventDefault();
      const cat = String(cd.getAttribute('data-cat')||'nutrition').toLowerCase();
      const next = String(cd.getAttribute('data-next')||'./hub.html');
      const gate = buildUrl(abs('./warmup-gate.html'), {
        hub: abs('./hub.html'),
        next: abs(next),
        gatePhase: 'cooldown',
        phase: 'cooldown',
        cat,
        theme: 'calm',
        pick: decidePickMode(),
        run: P.run, pid: P.pid, diff: P.diff, time: P.time, seed: P.seed,
        studyId: P.studyId,
        researchPhase: P.phase || '',
        conditionGroup: P.conditionGroup || '',
        view: P.view, log: P.log
      });
      location.href = gate;
    });
  }
}

// ---------- Optional plan runner buttons ----------
function bindPlanRunnerButtons(){
  const btnStartSlot = DOC.getElementById('btnPlanStartSlot');
  const btnStartDay = DOC.getElementById('btnPlanStartDay');

  if (btnStartSlot){
    btnStartSlot.addEventListener('click', (e)=>{
      e.preventDefault();
      const v = readPlanRunnerInputs();
      startPlanDaySlot({
        day: v.day || '1',
        slot: v.slot || 's1',
        mode: v.mode || 'plan',
        planSeq: 1,
        autoNext: v.autoNext ? 1 : 0
      });
    });
  }

  if (btnStartDay){
    btnStartDay.addEventListener('click', (e)=>{
      e.preventDefault();
      const v = readPlanRunnerInputs();
      const day = normDayKey(v.day || '1');
      const slots = getPlanSlotsForDay(day);
      startPlanDaySlot({
        day,
        slot: slots[0] || 's1',
        mode: v.mode || 'plan',
        planSeq: 1,
        planSlots: slots.join(','),
        planIndex: 0,
        autoNext: v.autoNext ? 1 : 0
      });
    });
  }
}

// ---------- API banner + retry ----------
async function boot(){
  try{
    setBanner('info', 'กำลังตรวจสอบระบบ…');
    attachRetry();

    await probeAPI(API_ENDPOINT);
    setBanner('ok', 'พร้อมใช้งาน');
  }catch(err){
    setBanner('warn', 'โหมดออฟไลน์/จำกัดการเชื่อมต่อ (ยังเล่นได้)');
  }

  setupHubButtons();
  setupGameCards();

  try { bindPlanRunnerButtons(); } catch(e){}

  try{
    const pick = decidePickMode();
    const tip = $('#hubPickTip');
    if(tip) tip.textContent = `Pick: ${pick.toUpperCase()} (run=${P.run})`;
  }catch(e){}

  try{
    if (typeof toast === 'function') {
      toast(`Warmup routing: ${decidePickMode().toUpperCase()} • run=${P.run}`, { kind:'info', ttl: 1800 });
    }
  }catch(e){}
}

boot();