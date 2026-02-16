// === /herohealth/hub.boot.js ===
// PACK v20260216h (ALL + QuestDirector Per-Game + Boss Contract + Smart QuickPlay)
'use strict';

import { setBanner, probeAPI, attachRetry, toast, qs } from './api/api-status.js';

function clamp(v,min,max){ v = Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }
function nowSeed(){ return String(Date.now()); }

const API_ENDPOINT = qs('api', 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/');

const P = {
  run:  String(qs('run','play')).toLowerCase() || 'play',
  diff: String(qs('diff','normal')).toLowerCase() || 'normal',
  time: clamp(qs('time','80'), 20, 300),
  seed: String(qs('seed','') || nowSeed()),
  pid:  String(qs('pid','')).trim() || 'anon',
  view: String(qs('view','')).toLowerCase(),
  log:  String(qs('log','')),
  studyId: String(qs('studyId','')),
  phase: String(qs('phase','')),
  conditionGroup: String(qs('conditionGroup',''))
};

const $ = (id)=>document.getElementById(id);

// chips
if($('cRun')) $('cRun').textContent = P.run;
if($('cDiff')) $('cDiff').textContent = P.diff;
if($('cTime')) $('cTime').textContent = String(P.time);
if($('cPid')) $('cPid').textContent = P.pid;

function buildHubUrl(){
  const u = new URL(location.href);
  u.search = '';
  const sp = u.searchParams;
  sp.set('run', P.run);
  sp.set('diff', P.diff);
  sp.set('time', String(P.time));
  sp.set('seed', P.seed);
  sp.set('pid', P.pid);
  if(P.view) sp.set('view', P.view);
  if(P.log) sp.set('log', P.log);
  if(P.studyId) sp.set('studyId', P.studyId);
  if(P.phase) sp.set('phase', P.phase);
  if(P.conditionGroup) sp.set('conditionGroup', P.conditionGroup);
  if(API_ENDPOINT) sp.set('api', API_ENDPOINT);
  return u.toString();
}

function withCommonParams(url){
  const u = new URL(url, location.href);
  const sp = u.searchParams;
  sp.set('hub', buildHubUrl());
  sp.set('run', P.run);
  sp.set('diff', P.diff);
  sp.set('time', String(P.time));
  sp.set('seed', P.seed);
  sp.set('pid', P.pid);
  if(P.view) sp.set('view', P.view);
  if(P.log) sp.set('log', P.log);
  if(P.studyId) sp.set('studyId', P.studyId);
  if(P.phase) sp.set('phase', P.phase);
  if(P.conditionGroup) sp.set('conditionGroup', P.conditionGroup);
  if(API_ENDPOINT) sp.set('api', API_ENDPOINT);
  return u.toString();
}

// same but allow override diff/time/seed/etc for contracts
function withParamsOverride(url, overrides){
  overrides = overrides || {};
  const u = new URL(url, location.href);
  const sp = u.searchParams;

  sp.set('hub', buildHubUrl());
  sp.set('run', overrides.run || P.run);

  sp.set('diff', overrides.diff || P.diff);
  sp.set('time', String(overrides.time != null ? overrides.time : P.time));
  sp.set('seed', String(overrides.seed || P.seed));
  sp.set('pid', overrides.pid || P.pid);

  if((overrides.view || P.view)) sp.set('view', overrides.view || P.view);
  if((overrides.log || P.log)) sp.set('log', overrides.log || P.log);
  if((overrides.studyId || P.studyId)) sp.set('studyId', overrides.studyId || P.studyId);
  if((overrides.phase || P.phase)) sp.set('phase', overrides.phase || P.phase);
  if((overrides.conditionGroup || P.conditionGroup)) sp.set('conditionGroup', overrides.conditionGroup || P.conditionGroup);
  if(API_ENDPOINT) sp.set('api', API_ENDPOINT);

  return u.toString();
}

// patch links (ALL) — ต้องมี id ใน hub.html ตามนี้
const linkIds = [
  'goGoodJunk','goGroups','goHydration','goPlate',
  'goHandwash','goBrush','goMaskCough','goGermDetective',
  'goPlanner','goShadow','goRhythm','goJumpDuck','goBalanceHold',
  'goBadges','goCheckin','goQuickPlay'
];
for(const id of linkIds){
  const a = $(id);
  if(!a) continue;
  const href = a.getAttribute('href');
  if(!href || href === '#') continue;
  a.href = withCommonParams(href);
}

// coming soon (avoid 404)
function wireComingSoon(id, msg){
  const a = $(id);
  if(!a) return;
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    toast(msg || 'Coming soon ✨');
  });
}
wireComingSoon('goGermDetective', 'Germ Detective: กำลังพัฒนา 🦠🔎');

// ===== Date helpers =====
function dayKeyFromDate(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}
function getLocalDayKey(){ return dayKeyFromDate(new Date()); }

function addDays(dayKey, delta){
  const d = new Date(dayKey + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return dayKeyFromDate(d);
}
function isSameDay(ts, dayKey){
  try{
    const d = new Date(Number(ts)||0);
    if(!Number.isFinite(d.getTime())) return false;
    return dayKeyFromDate(d) === dayKey;
  }catch{ return false; }
}

function zoneDoneKey(zone, dayKey){ return `HHA_ZONE_DONE::${zone}::${dayKey}`; }

// ===== Safe JSON =====
function safeJson(raw){ try{ return JSON.parse(raw); }catch{ return null; } }

// ===== Catalog (per-game link + zone) =====
function linkHref(id, fallback){
  const el = $(id);
  const h = el ? el.getAttribute('href') : '';
  return (h && h !== '#') ? h : (fallback || './');
}

const GAME_CATALOG = [
  // Nutrition
  { key:'goodjunk',  zone:'nutrition', title:'GoodJunkVR',       linkId:'goGoodJunk',  href:()=>linkHref('goGoodJunk','./goodjunk-vr.html') },
  { key:'groups',    zone:'nutrition', title:'GroupsVR',         linkId:'goGroups',    href:()=>linkHref('goGroups','./groups-vr.html') },
  { key:'hydration', zone:'nutrition', title:'HydrationVR',      linkId:'goHydration', href:()=>linkHref('goHydration','./hydration-vr.html') },
  { key:'plate',     zone:'nutrition', title:'PlateVR',          linkId:'goPlate',     href:()=>linkHref('goPlate','./plate-vr.html') },
  // Hygiene
  { key:'handwash',  zone:'hygiene',   title:'Handwash',         linkId:'goHandwash',  href:()=>linkHref('goHandwash','./hygiene-vr.html') },
  { key:'brush',     zone:'hygiene',   title:'Brush',            linkId:'goBrush',     href:()=>linkHref('goBrush','./brush-vr.html') },
  { key:'maskcough', zone:'hygiene',   title:'MaskCough',        linkId:'goMaskCough', href:()=>linkHref('goMaskCough','./maskcough-vr.html') },
  // Fitness
  { key:'planner',   zone:'fitness',   title:'Fitness Planner',  linkId:'goPlanner',   href:()=>linkHref('goPlanner','./fitness-planner/planner.html') },
  { key:'shadow',    zone:'fitness',   title:'Shadow Breaker',   linkId:'goShadow',    href:()=>linkHref('goShadow','../fitness/shadow-breaker.html') },
  { key:'rhythm',    zone:'fitness',   title:'Rhythm Boxer',     linkId:'goRhythm',    href:()=>linkHref('goRhythm','../fitness/rhythm-boxer.html') },
  { key:'jumpduck',  zone:'fitness',   title:'Jump-Duck',        linkId:'goJumpDuck',  href:()=>linkHref('goJumpDuck','../fitness/jump-duck.html') },
  { key:'balance',   zone:'fitness',   title:'Balance Hold',     linkId:'goBalanceHold', href:()=>linkHref('goBalanceHold','../fitness/balance-hold.html') },
];

function catalogByKey(key){
  key = String(key||'').toLowerCase();
  return GAME_CATALOG.find(g=>g.key===key) || null;
}

// ===== Zone Done pills =====
function readZoneDone(zone, dayKey){
  dayKey = dayKey || getLocalDayKey();
  try{
    const raw = localStorage.getItem(zoneDoneKey(zone, dayKey));
    if(!raw) return null;
    if(raw === '1' || raw === 'true' || raw === 'done') return { ok:true, raw };
    try{ return { ok:true, raw, json: JSON.parse(raw) }; }catch{ return { ok:true, raw }; }
  }catch(_){ return null; }
}

function setPill(id, done){
  const el = $(id);
  if(!el) return;
  el.classList.remove('ok','warn','bad');
  if(done){
    el.classList.add('ok');
    el.textContent = 'Today: Done ✅';
  }else{
    el.classList.add('warn');
    el.textContent = 'Today: Not yet';
  }
}

function refreshZonePills(){
  const dk = getLocalDayKey();
  setPill('zNutrition', !!readZoneDone('nutrition', dk));
  setPill('zHygiene',  !!readZoneDone('hygiene',  dk));
  setPill('zFitness',  !!readZoneDone('fitness',  dk));
}

// ===== Summary history =====
const HISTORY_KEYS = ['HHA_SUMMARY_HISTORY','HHA_SUMMARY_HISTORY_V1','HHA_SUMMARY_HISTORY_V2'];

function readHistory(){
  for(const k of HISTORY_KEYS){
    try{
      const raw = localStorage.getItem(k);
      const j = safeJson(raw);
      if(Array.isArray(j)) return j;
    }catch{}
  }
  return [];
}

function normalizeGameName(s){
  s = String(s||'').toLowerCase();
  return s.replace(/\s+/g,'').replace(/[-_]/g,'');
}

function gameKeyFromName(name){
  const g = normalizeGameName(name);
  if(g.includes('goodjunk')) return 'goodjunk';
  if(g.includes('groups')) return 'groups';
  if(g.includes('hydration')) return 'hydration';
  if(g.includes('plate')) return 'plate';
  if(g.includes('handwash') || g.includes('hygiene')) return 'handwash';
  if(g.includes('brush')) return 'brush';
  if(g.includes('maskcough') || g.includes('mask') || g.includes('cough')) return 'maskcough';
  if(g.includes('planner')) return 'planner';
  if(g.includes('shadow')) return 'shadow';
  if(g.includes('rhythm')) return 'rhythm';
  if(g.includes('jumpduck') || (g.includes('jump') && g.includes('duck'))) return 'jumpduck';
  if(g.includes('balance')) return 'balance';
  if(g.includes('germ') || g.includes('detective')) return 'germ';
  return '';
}

function zoneFromGameKey(k){ return catalogByKey(k)?.zone || ''; }
function zoneFromGameName(name){ return zoneFromGameKey(gameKeyFromName(name)); }

function playsByZoneForDay(dayKey){
  const hist = readHistory();
  const counts = { nutrition:0, hygiene:0, fitness:0, total:0 };
  for(const it of hist){
    const ts = it?.ts || it?.endedAt || it?.timeEnd || it?.t || 0;
    if(!isSameDay(ts, dayKey)) continue;
    const game = it?.game || it?.mode || it?.name || '';
    const zone = it?.zone || zoneFromGameName(game);
    if(zone && counts[zone]!=null){ counts[zone]++; counts.total++; }
  }
  if(counts.total === 0){
    try{
      const j = safeJson(localStorage.getItem('HHA_LAST_SUMMARY')) || {};
      const ts = j.ts || j.endedAt || j.timeEnd || 0;
      if(isSameDay(ts, dayKey)){
        const game = j.game || j.mode || j.name || '';
        const zone = j.zone || zoneFromGameName(game);
        if(zone && counts[zone]!=null){
          counts[zone] = Math.max(counts[zone], 1);
          counts.total = 1;
        }
      }
    }catch{}
  }
  return counts;
}

// ===== Progress bars =====
function targetPlaysPerZone(){
  const d = String(P.diff||'normal');
  if(d === 'easy') return 1;
  if(d === 'hard') return 3;
  return 2;
}
function setProgress(metaId, fillId, plays){
  const meta = $(metaId);
  const fill = $(fillId);
  const target = targetPlaysPerZone();
  const pct = Math.max(0, Math.min(100, Math.round((plays / target) * 100)));
  if(meta) meta.textContent = `${plays} play • ${pct}%`;
  if(fill) fill.style.width = `${pct}%`;
}
function refreshProgress(){
  const dk = getLocalDayKey();
  const c = playsByZoneForDay(dk);
  setProgress('pNutritionMeta','pNutritionFill', c.nutrition);
  setProgress('pHygieneMeta','pHygieneFill', c.hygiene);
  setProgress('pFitnessMeta','pFitnessFill', c.fitness);
  if($('kPlaysToday')) $('kPlaysToday').textContent = String(c.total || 0);
  return c;
}

function computeDoneForDay(dayKey, counts){
  counts = counts || playsByZoneForDay(dayKey);
  const doneByKey = {
    nutrition: !!readZoneDone('nutrition', dayKey),
    hygiene:  !!readZoneDone('hygiene',  dayKey),
    fitness:  !!readZoneDone('fitness',  dayKey)
  };
  const doneByPlay = {
    nutrition: (counts.nutrition||0) >= 1,
    hygiene:  (counts.hygiene||0) >= 1,
    fitness:  (counts.fitness||0) >= 1
  };
  return {
    nutrition: doneByKey.nutrition || doneByPlay.nutrition,
    hygiene:  doneByKey.hygiene  || doneByPlay.hygiene,
    fitness:  doneByKey.fitness  || doneByPlay.fitness
  };
}

// ===== Daily Streak =====
const STREAK_KEY = 'HHA_DAILY_STREAK_V1';
function readStreak(){
  try{
    const j = safeJson(localStorage.getItem(STREAK_KEY)) || {};
    return { streak: Number(j.streak)||0, lastDay: String(j.lastDay||'') };
  }catch{ return { streak:0, lastDay:'' }; }
}
function writeStreak(streak, lastDay){
  try{ localStorage.setItem(STREAK_KEY, JSON.stringify({ streak, lastDay })); }catch{}
}

// ===== Heatmap 7 =====
function renderHeatmap7(){
  const grid = $('heatGrid');
  const meta = $('heatMeta');
  if(!grid) return;

  const today = getLocalDayKey();
  const days = [];
  for(let i=6;i>=0;i--) days.push(addDays(today, -i));

  grid.innerHTML = '';
  let fullCount = 0;
  let anyCount = 0;

  for(const dk of days){
    const c = playsByZoneForDay(dk);
    const done = computeDoneForDay(dk, c);
    const doneCount = (done.nutrition?1:0)+(done.hygiene?1:0)+(done.fitness?1:0);

    let cls = 'cell';
    let sym = '—';
    if(doneCount === 0){ cls += ' none'; sym = '0/3'; }
    else if(doneCount < 3){ cls += ' part'; sym = `${doneCount}/3`; anyCount++; }
    else{ cls += ' full'; sym = '3/3'; fullCount++; anyCount++; }
    if(dk === today) cls += ' today';

    let label = dk.slice(5);
    try{
      const d = new Date(dk + 'T00:00:00');
      const wd = d.toLocaleDateString(undefined, { weekday:'short' });
      label = `${wd} ${dk.slice(5)}`;
    }catch{}

    const div = document.createElement('div');
    div.className = cls;
    div.innerHTML = `<div class="d">${label}</div><div class="s">${sym}</div>`;
    grid.appendChild(div);
  }

  if(meta) meta.textContent = `ครบ 3/3 = ${fullCount} วัน • มีการเล่น = ${anyCount} วัน`;
}

// ===== Perf extraction (supports diff/time if present in summary) =====
function num(v, def=null){
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function getPerfFromSummary(s){
  if(!s) return null;
  const acc = num(s.acc ?? s.accuracy ?? s.hitRate ?? s.accPct, null);
  const score = num(s.score ?? s.points ?? s.totalScore, null);
  const miss = num(s.miss ?? s.misses ?? s.missCount, null);
  const time = num(s.time ?? s.duration ?? s.dur, null);
  const diff = String(s.diff || s.difficulty || '').toLowerCase();
  const name = String(s.game ?? s.mode ?? s.name ?? '').trim();
  const gameKey = String(s.gameKey || gameKeyFromName(name) || '').trim();
  const zone = String(s.zone ?? zoneFromGameKey(gameKey) ?? zoneFromGameName(name) ?? '').trim();
  const ts = num(s.ts ?? s.endedAt ?? s.timeEnd ?? s.t, null);
  return { acc, score, miss, time, diff, name, gameKey, zone, ts };
}

function readLastPerf(){
  try{
    const j = safeJson(localStorage.getItem('HHA_LAST_SUMMARY'));
    const p = getPerfFromSummary(j);
    return p && (p.acc!=null || p.score!=null || p.miss!=null) ? p : null;
  }catch{ return null; }
}

function bestPerfByGameToday(dayKey){
  const hist = readHistory();
  const map = {}; // gameKey -> {plays,bestAcc,bestScore,bestMiss,last, bestAccHard120? ...}
  function ensure(k){
    if(!map[k]) map[k] = { plays:0, bestAcc:null, bestScore:null, bestMiss:null, last:null };
    return map[k];
  }

  for(const it of hist){
    const ts = it?.ts || it?.endedAt || it?.timeEnd || it?.t || 0;
    if(!isSameDay(ts, dayKey)) continue;
    const p = getPerfFromSummary(it);
    if(!p) continue;
    const k = p.gameKey || gameKeyFromName(p.name) || '';
    if(!k) continue;
    const o = ensure(k);
    o.plays++;
    if(p.acc!=null) o.bestAcc = (o.bestAcc==null)?p.acc:Math.max(o.bestAcc, p.acc);
    if(p.score!=null) o.bestScore = (o.bestScore==null)?p.score:Math.max(o.bestScore, p.score);
    if(p.miss!=null) o.bestMiss = (o.bestMiss==null)?p.miss:Math.min(o.bestMiss, p.miss);
    if(!o.last || (p.ts!=null && p.ts > (o.last.ts||0))) o.last = p;

    // contract-specific slice: hard + 120s (best-effort; if summary carries diff/time)
    if(p.diff === 'hard' && Number(p.time) === 120){
      o.contract = o.contract || { bestAcc:null, bestScore:null, bestMiss:null };
      if(p.acc!=null) o.contract.bestAcc = (o.contract.bestAcc==null)?p.acc:Math.max(o.contract.bestAcc, p.acc);
      if(p.score!=null) o.contract.bestScore = (o.contract.bestScore==null)?p.score:Math.max(o.contract.bestScore, p.score);
      if(p.miss!=null) o.contract.bestMiss = (o.contract.bestMiss==null)?p.miss:Math.min(o.contract.bestMiss, p.miss);
    }
  }

  if(Object.keys(map).length === 0){
    const lp = readLastPerf();
    if(lp && lp.ts!=null && isSameDay(lp.ts, dayKey)){
      const k = lp.gameKey || gameKeyFromName(lp.name) || '';
      if(k){
        const o = ensure(k);
        o.plays = 1;
        if(lp.acc!=null) o.bestAcc = lp.acc;
        if(lp.score!=null) o.bestScore = lp.score;
        if(lp.miss!=null) o.bestMiss = lp.miss;
        o.last = lp;
        if(lp.diff === 'hard' && Number(lp.time) === 120){
          o.contract = { bestAcc: lp.acc ?? null, bestScore: lp.score ?? null, bestMiss: lp.miss ?? null };
        }
      }
    }
  }
  return map;
}

function pickWeakGame(dayKey){
  const map = bestPerfByGameToday(dayKey);
  const keys = Object.keys(map);
  if(!keys.length) return null;

  const accCandidates = keys.map(k=>({ k, v: map[k].bestAcc })).filter(x=>x.v!=null && Number.isFinite(x.v));
  if(accCandidates.length){
    accCandidates.sort((a,b)=>a.v-b.v);
    return { key: accCandidates[0].k, reason:'acc', value: accCandidates[0].v };
  }

  const missCandidates = keys.map(k=>({ k, v: map[k].bestMiss })).filter(x=>x.v!=null && Number.isFinite(x.v));
  if(missCandidates.length){
    missCandidates.sort((a,b)=>b.v-a.v);
    return { key: missCandidates[0].k, reason:'miss', value: missCandidates[0].v };
  }

  keys.sort((a,b)=>(map[a].plays||0)-(map[b].plays||0));
  return { key: keys[0], reason:'plays', value: map[keys[0]].plays||0 };
}

// ===== RNG deterministic =====
function hash32(str){
  str = String(str||'');
  let h = 2166136261 >>> 0;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr){ return arr[(rng() * arr.length) | 0]; }

// ===== Quest targets =====
function questTargets(){
  const d = String(P.diff||'normal');
  const t = Number(P.time)||80;
  const basePlays = (d==='easy')?1:(d==='hard'?2:1);
  const bonus = (t>=120)?1:0;
  const accTarget = (d==='easy')?70:(d==='hard'?85:80);
  const missTarget = (d==='easy')?6:(d==='hard'?3:4);
  return { minPlaysPerZone: basePlays, bonusPlaysTotal: 3 + bonus, accTarget, missTarget };
}

function zonePlayLink(zone){
  if(zone === 'nutrition') return linkHref('goGoodJunk','./goodjunk-vr.html');
  if(zone === 'hygiene')  return linkHref('goHandwash','./hygiene-vr.html');
  if(zone === 'fitness')  return linkHref('goPlanner','./fitness-planner/planner.html');
  return './';
}

// ===== Boss Contract =====
function buildBossContract(today, rng){
  // contract rule: force hard + 120s (pushed through link)
  const contractDiff = 'hard';
  const contractTime = 120;

  const weak = pickWeakGame(today);
  // if no data, rotate deterministic among 3 zones then pick a flagship game
  const fallbackOrder = ['goodjunk','handwash','shadow'];
  const fallbackKey = fallbackOrder[(rng() * fallbackOrder.length) | 0];

  const gameKey = (weak && weak.key) ? weak.key : fallbackKey;
  const g = catalogByKey(gameKey);
  const name = g ? g.title : gameKey;

  // boss thresholds (harder than normal quests)
  const accBoss = 88;   // strong but fair
  const missBoss = 2;   // clean run
  const scoreBoss = (P.diff === 'easy') ? 90 : 140; // fallback if no best

  return {
    id:`contract-${gameKey}`,
    type:'contract',
    gameKey,
    title:`👑 Boss Contract: ${name}`,
    desc:`โหมดบอส: ${name} • diff=hard • time=120s • ทำ acc ≥ ${accBoss}% และ miss ≤ ${missBoss}`,
    contract: { diff: contractDiff, time: contractTime, acc: accBoss, miss: missBoss, score: scoreBoss }
  };
}

function buildTodayQuests(){
  const today = getLocalDayKey();
  const rng = mulberry32(hash32(`HHA_QD_BOSS|${today}|${P.pid}|${P.diff}|${P.time}`));
  const T = questTargets();

  // Base zone quests
  const qZone = (zone, title, desc)=>({ id:`zone-${zone}`, type:'zone', zone, title, desc, target:T.minPlaysPerZone });

  const n = pick(rng, [
    ['🥗 Nutrition Sprint', `เล่นโซน Nutrition ≥ ${T.minPlaysPerZone} รอบวันนี้`],
    ['🍎 Healthy Combo', `เล่น Nutrition ≥ ${T.minPlaysPerZone} รอบ (GoodJunk/Groups/Hydration/Plate)`]
  ]);
  const h = pick(rng, [
    ['🧼 Hygiene Hero', `เล่นโซน Hygiene ≥ ${T.minPlaysPerZone} รอบวันนี้`],
    ['🦠 Clean Defender', `เล่น Hygiene ≥ ${T.minPlaysPerZone} รอบ (Handwash/Brush/MaskCough)`]
  ]);
  const f = pick(rng, [
    ['🏃 Fitness Burst', `เล่นโซน Fitness ≥ ${T.minPlaysPerZone} รอบวันนี้`],
    ['🥊 Move Master', `เล่น Fitness ≥ ${T.minPlaysPerZone} รอบ (Planner/Shadow/Rhythm/JumpDuck/Balance)`]
  ]);

  const base = [ qZone('nutrition', n[0], n[1]), qZone('hygiene', h[0], h[1]), qZone('fitness', f[0], f[1]) ];

  // Per-game quests (2)
  const map = bestPerfByGameToday(today);
  const weak = pickWeakGame(today);
  const perGameCandidates = [];

  {
    const k = weak?.key || pick(rng, GAME_CATALOG.map(x=>x.key));
    const c = catalogByKey(k); const name = c ? c.title : k;
    perGameCandidates.push({
      id:`g-acc-${k}`, type:'game', gameKey:k, metric:'acc',
      title:`🎯 Evaluate: ${name} Accuracy`,
      desc:`ใน ${name}: ทำ Accuracy ≥ ${T.accTarget}% อย่างน้อย 1 รอบวันนี้`,
      targetAcc:T.accTarget
    });
  }

  {
    const k = weak?.key || pick(rng, GAME_CATALOG.map(x=>x.key));
    const c = catalogByKey(k); const name = c ? c.title : k;
    perGameCandidates.push({
      id:`g-miss-${k}`, type:'game', gameKey:k, metric:'miss',
      title:`🛡️ Evaluate: ${name} Clean Run`,
      desc:`ใน ${name}: ทำ Miss ≤ ${T.missTarget} อย่างน้อย 1 รอบวันนี้`,
      targetMiss:T.missTarget
    });
  }

  {
    const playedKeys = Object.keys(map);
    const k = playedKeys.length ? pick(rng, playedKeys) : pick(rng, GAME_CATALOG.map(x=>x.key));
    const c = catalogByKey(k); const name = c ? c.title : k;
    const best = map[k]?.bestScore;
    const targetScore = (best!=null && Number.isFinite(best))
      ? Math.max(10, Math.round(best * (P.diff==='hard'?1.06:(P.diff==='easy'?0.92:1.02))))
      : (P.diff==='hard'?140:(P.diff==='easy'?70:100));
    perGameCandidates.push({
      id:`g-score-${k}`, type:'game', gameKey:k, metric:'score',
      title:`🏁 Analyze: ${name} Score Push`,
      desc:`ใน ${name}: ทำ Score ≥ ${targetScore} (อิง best วันนี้/ค่าเริ่มต้น)`,
      targetScore
    });
  }

  // deterministic shuffle pick 2
  const pool = perGameCandidates.slice();
  for(let i=pool.length-1;i>0;i--){
    const j = (rng() * (i+1)) | 0;
    const tmp = pool[i]; pool[i]=pool[j]; pool[j]=tmp;
  }
  const picked = pool.slice(0,2);

  // Boss contract (1)
  const contract = buildBossContract(today, rng);

  // Bonus quest
  const bonus = {
    id:'bonus-all', type:'bonus',
    title:'🔥 Bonus: Full Clear',
    desc:'ทำให้ครบ 3 โซนวันนี้ (หรือเล่นรวมให้ถึงเป้าหมาย) เพื่อเพิ่ม streak!',
    targetTotal:T.bonusPlaysTotal
  };

  const quests = [...base, ...picked, contract, bonus];

  try{
    localStorage.setItem(`HHA_DAILY_QUESTS::${today}::${P.pid}`, JSON.stringify(quests));
  }catch{}

  return quests;
}

function loadTodayQuests(){
  const today = getLocalDayKey();
  try{
    const raw = localStorage.getItem(`HHA_DAILY_QUESTS::${today}::${P.pid}`);
    const j = safeJson(raw);
    if(Array.isArray(j) && j.length) return j;
  }catch{}
  return buildTodayQuests();
}

// ===== Quest progress =====
function bestTodayForGame(dayKey, gameKey){
  const map = bestPerfByGameToday(dayKey);
  return map[gameKey] || { plays:0, bestAcc:null, bestMiss:null, bestScore:null, last:null, contract:null };
}

function questProgress(quest, counts, done){
  const today = getLocalDayKey();

  if(quest.type === 'zone'){
    const z = quest.zone;
    const cur = Number(counts?.[z]||0);
    const target = Number(quest.target||1);
    return { cur, target, ok: cur >= target, hint:`${cur}/${target} plays` };
  }

  if(quest.type === 'game'){
    const k = String(quest.gameKey||'');
    const s = bestTodayForGame(today, k);

    if(quest.metric === 'acc'){
      const cur = (s.bestAcc==null) ? 0 : Math.round(s.bestAcc);
      const target = Number(quest.targetAcc||80);
      const ok = (s.bestAcc!=null) && (s.bestAcc >= target);
      return { cur, target, ok, hint: s.bestAcc==null ? 'no data' : `bestAcc ${cur}% • plays ${s.plays||0}` };
    }
    if(quest.metric === 'miss'){
      const cur = (s.bestMiss==null) ? 0 : Math.round(s.bestMiss);
      const target = Number(quest.targetMiss||4);
      const ok = (s.bestMiss!=null) && (s.bestMiss <= target);
      return { cur: (s.bestMiss==null?0:cur), target, ok, hint: s.bestMiss==null ? 'no data' : `bestMiss ${cur} • plays ${s.plays||0}` };
    }
    if(quest.metric === 'score'){
      const cur = (s.bestScore==null) ? 0 : Math.round(s.bestScore);
      const target = Number(quest.targetScore||100);
      const ok = (s.bestScore!=null) && (s.bestScore >= target);
      return { cur, target, ok, hint: s.bestScore==null ? 'no data' : `bestScore ${cur} • plays ${s.plays||0}` };
    }
    return { cur:0, target:1, ok:false, hint:'no metric' };
  }

  if(quest.type === 'contract'){
    const k = String(quest.gameKey||'');
    const s = bestTodayForGame(today, k);
    const c = quest.contract || {};
    // prefer contract slice if summary carries diff/time; else fall back to best overall (still fair)
    const bestAcc = (s.contract && s.contract.bestAcc!=null) ? s.contract.bestAcc : s.bestAcc;
    const bestMiss = (s.contract && s.contract.bestMiss!=null) ? s.contract.bestMiss : s.bestMiss;

    const curAcc = bestAcc==null ? 0 : Math.round(bestAcc);
    const curMiss = bestMiss==null ? 0 : Math.round(bestMiss);

    const needAcc = Number(c.acc||88);
    const needMiss = Number(c.miss||2);

    const ok = (bestAcc!=null && bestAcc >= needAcc) && (bestMiss!=null && bestMiss <= needMiss);

    const hint = (bestAcc==null && bestMiss==null)
      ? 'no data'
      : `bestAcc ${curAcc}% • bestMiss ${curMiss} • plays ${s.plays||0}`;

    // show 2D progress as "acc/miss"
    return { cur: ok?1:0, target:1, ok, hint, acc:{cur:curAcc, target:needAcc}, miss:{cur:curMiss, target:needMiss} };
  }

  if(quest.type === 'bonus'){
    const total = Number(counts?.total||0);
    const targetTotal = Number(quest.targetTotal || quest.target || 3);
    const doneAll = !!(done?.nutrition && done?.hygiene && done?.fitness);
    const ok = doneAll || (total >= targetTotal);
    return { cur: doneAll ? 3 : total, target: doneAll ? 3 : targetTotal, ok, hint: doneAll ? '3/3 zones' : `${total}/${targetTotal} plays` };
  }

  return { cur:0, target:1, ok:false, hint:'' };
}

// ===== Smart Quick Play =====
function quickPlaySmart(){
  const today = getLocalDayKey();
  const quests = loadTodayQuests();
  const counts = playsByZoneForDay(today);
  const done = computeDoneForDay(today, counts);

  // 1) If boss contract not done -> go contract game with contract overrides
  const contract = quests.find(q=>q.type==='contract');
  if(contract){
    const pr = questProgress(contract, counts, done);
    if(!pr.ok){
      const g = catalogByKey(contract.gameKey);
      if(g){
        toast(`ไปทำ Boss Contract: ${g.title} 👑`);
        const c = contract.contract || {};
        location.href = withParamsOverride(g.href(), { diff:c.diff||'hard', time:c.time||120, seed:P.seed });
        return;
      }
    }
  }

  // 2) else go weakest played/perf game today (if any)
  const weak = pickWeakGame(today);
  if(weak){
    const g = catalogByKey(weak.key);
    if(g){
      toast(`ฝึกจุดอ่อน: ${g.title} 🎯`);
      location.href = withCommonParams(g.href());
      return;
    }
  }

  // 3) else random from all available
  const links = [];
  for(const g of GAME_CATALOG){
    const h = g.href();
    if(h && h !== '#') links.push(h);
  }
  if(!links.length){ toast('ยังไม่มีลิงก์เกมให้สุ่ม 😅'); return; }
  const target = links[(Math.random() * links.length) | 0];
  toast('Quick Play 🎲');
  location.href = withCommonParams(target);
}

function wireQuickPlay(){
  const a = $('goQuickPlay');
  if(!a) return;
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    quickPlaySmart();
  });
}

// ===== Quest render =====
function renderQuests(){
  const grid = $('qGrid');
  const meta = $('qMeta');
  if(!grid) return;

  const today = getLocalDayKey();
  const counts = playsByZoneForDay(today);
  const done = computeDoneForDay(today, counts);
  const quests = loadTodayQuests();

  grid.innerHTML = '';
  let okCount = 0;

  for(const q of quests){
    const pr = questProgress(q, counts, done);
    if(pr.ok) okCount++;

    const statusCls = pr.ok ? 'qstatus ok' : 'qstatus warn';

    let statusTxt = pr.ok ? 'DONE ✅' : `${pr.cur}/${pr.target}`;
    if(q.type === 'contract' && !pr.ok && pr.acc && pr.miss){
      statusTxt = `acc ${pr.acc.cur}/${pr.acc.target} • miss ${pr.miss.cur}/${pr.miss.target}`;
    }

    let playLabel = 'ไปทำเลย';
    let playData = 'any';

    if(q.type === 'zone'){
      playData = q.zone || 'any';
      playLabel = pr.ok ? 'ดูโซน' : 'ไปทำเลย';
    }else if(q.type === 'game'){
      playData = `game:${q.gameKey || ''}`;
      playLabel = 'ไปเกมนี้';
    }else if(q.type === 'contract'){
      playData = `contract:${q.gameKey || ''}`;
      playLabel = pr.ok ? 'เล่นต่อ' : 'รับสัญญา';
    }else if(q.type === 'bonus'){
      playData = 'smart';
      playLabel = 'สุ่มแบบฉลาด';
    }

    const card = document.createElement('div');
    card.className = 'qcard';
    card.innerHTML = `
      <div class="qtop">
        <div>
          <div class="qtitle">${q.title || 'Quest'}</div>
          <div class="qdesc">${q.desc || ''}</div>
          <div class="qdesc" style="opacity:.85;margin-top:6px">Hint: ${pr.hint || '-'}</div>
        </div>
        <div class="${statusCls}">${statusTxt}</div>
      </div>
      <div class="qactions">
        <a class="btn ${pr.ok ? 'ghost' : 'primary'}" href="#" data-qgo="${playData}">${playLabel}</a>
        <a class="btn ghost" href="#" data-qreshow="1">รีเฟรช</a>
      </div>
    `;

    card.querySelectorAll('[data-qgo]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const token = btn.getAttribute('data-qgo') || 'any';

        if(token === 'smart'){
          quickPlaySmart();
          return;
        }

        if(token.startsWith('contract:')){
          const k = token.slice(9);
          const c = catalogByKey(k);
          if(!c){ toast('ไม่พบลิงก์เกมนี้ 😅'); return; }
          // hard+120 override
          location.href = withParamsOverride(c.href(), { diff:'hard', time:120, seed:P.seed });
          return;
        }

        if(token.startsWith('game:')){
          const k = token.slice(5);
          const c = catalogByKey(k);
          if(!c){ toast('ไม่พบลิงก์เกมนี้ 😅'); return; }
          location.href = withCommonParams(c.href());
          return;
        }

        if(token === 'any'){
          quickPlaySmart();
          return;
        }

        // zone
        location.href = withCommonParams(zonePlayLink(token));
      });
    });

    card.querySelectorAll('[data-qreshow]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        refreshAllUI();
        toast('Refreshed ✅');
      });
    });

    grid.appendChild(card);
  }

  const weak = pickWeakGame(today);
  const weakName = weak ? (catalogByKey(weak.key)?.title || weak.key) : '—';
  const weakWhy  = weak ? `${weak.reason}:${Math.round(weak.value||0)}` : 'no data';
  if(meta){
    meta.textContent = `วันนี้ (${today}) • เควสสำเร็จ ${okCount}/${quests.length} • weak=${weakName} (${weakWhy})`;
  }
}

// ===== Last summary panel =====
function prettyTime(ts){
  try{
    const d = new Date(Number(ts)||Date.now());
    if(!Number.isFinite(d.getTime())) return '';
    return d.toLocaleString();
  }catch{ return ''; }
}
function showLastSummary(){
  const box = $('lastSummary');
  const t = $('lsTitle');
  const b = $('lsBody');
  if(!box || !t || !b) return;

  let raw = null;
  try{ raw = localStorage.getItem('HHA_LAST_SUMMARY'); }catch(_){}
  if(!raw){ box.style.display = 'none'; return; }

  const j = safeJson(raw) || {};
  const game = String(j.game || j.mode || j.name || 'เกมล่าสุด');
  const score = (j.score!=null) ? `score ${j.score}` : '';
  const acc = (j.acc!=null) ? `acc ${j.acc}` : (j.accuracy!=null ? `acc ${j.accuracy}` : '');
  const miss = (j.miss!=null) ? `miss ${j.miss}` : '';
  const dur = (j.time!=null) ? `${j.time}s` : (j.duration!=null ? `${j.duration}s` : '');
  const when = prettyTime(j.ts || j.endedAt || j.timeEnd || j.date || 0);

  t.textContent = `สรุปล่าสุด: ${game}`;
  const parts = [score, acc, miss, dur].filter(Boolean).join(' • ');
  b.textContent = (parts ? `${parts}${when ? ' • ' : ''}` : '') + (when || '');

  box.style.display = 'block';
}

const btnClearSummary = $('btnClearSummary');
if(btnClearSummary){
  btnClearSummary.addEventListener('click', (e)=>{
    e.preventDefault();
    try{ localStorage.removeItem('HHA_LAST_SUMMARY'); }catch(_){}
    toast('Clear summary ✅');
    showLastSummary();
    refreshAllUI();
  });
}

// ===== Reset today =====
function resetToday(){
  const dk = getLocalDayKey();
  try{
    localStorage.removeItem(zoneDoneKey('nutrition', dk));
    localStorage.removeItem(zoneDoneKey('hygiene',  dk));
    localStorage.removeItem(zoneDoneKey('fitness',  dk));
  }catch(_){}
}

const btnResetToday = $('btnResetToday');
if(btnResetToday){
  btnResetToday.addEventListener('click', (e)=>{
    e.preventDefault();
    resetToday();
    toast('Reset today ✅ (ล้าง 3 โซน)');
    refreshAllUI();
  });
}

const btnRefreshDaily = $('btnRefreshDaily');
if(btnRefreshDaily){
  btnRefreshDaily.addEventListener('click', (e)=>{
    e.preventDefault();
    refreshAllUI();
    toast('Refreshed ✅');
  });
}

// ===== Daily streak updater =====
function refreshDailyStreakAndKPIs(){
  const dk = getLocalDayKey();
  const counts = playsByZoneForDay(dk);
  const done = computeDoneForDay(dk, counts);
  const todayDoneCount = (done.nutrition?1:0) + (done.hygiene?1:0) + (done.fitness?1:0);

  if($('kTodayDone')) $('kTodayDone').textContent = `${todayDoneCount} / 3`;

  const s = readStreak();
  if(todayDoneCount === 3 && s.lastDay !== dk){
    let next = 1;
    try{
      const last = s.lastDay;
      if(last){
        const d0 = new Date(last + 'T00:00:00');
        const d1 = new Date(dk   + 'T00:00:00');
        const diffDays = Math.round((d1 - d0) / (24*60*60*1000));
        if(diffDays === 1) next = (s.streak||0) + 1;
      }
    }catch{}
    writeStreak(next, dk);
  }

  const s2 = readStreak();
  if($('kStreak')) $('kStreak').textContent = `${s2.streak} 🔥`;

  const dm = $('dailyMeta');
  if(dm){
    if(todayDoneCount === 3) dm.textContent = 'ครบ 3 โซนแล้ววันนี้ ✅ streak อัปเดตแล้ว!';
    else dm.textContent = `วันนี้ทำแล้ว ${todayDoneCount}/3 • ทำให้ครบเพื่อรักษา streak 🔥`;
  }
}

// ===== Master refresh =====
function refreshAllUI(){
  refreshZonePills();
  refreshProgress();
  refreshDailyStreakAndKPIs();
  renderHeatmap7();
  renderQuests();
}

// ===== 401/403-safe API probe =====
let probeLock = false;
async function probe(){
  if(probeLock) return;
  probeLock = true;

  setBanner({}, 'warn', 'กำลังตรวจสอบระบบ…', 'กำลัง ping API แบบสั้น ๆ (ถ้า 401/403 จะใช้โหมดออฟไลน์)');
  const r = await probeAPI(API_ENDPOINT, { ping:true }, 3200);

  if(r.status === 200){
    setBanner({}, 'ok', 'ออนไลน์ ✅', 'API ตอบกลับปกติ (Hub ใช้งานเต็มรูปแบบ)');
  }else if(r.status === 401){
    setBanner({}, 'bad', '401 Unauthorized ⚠️', 'API ต้องมีสิทธิ์/Token • Hub ยังเข้าเกมได้ปกติ — logging ถูกปิด');
  }else if(r.status === 403){
    setBanner({}, 'bad', '403 Forbidden ⚠️', 'API ปฏิเสธสิทธิ์/Origin • Hub ยังเข้าเกมได้ปกติ — แนะนำแก้ CORS/Authorizer');
  }else if(r.status){
    setBanner({}, 'warn', `API ตอบ ${r.status}`, 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจ route/headers');
  }else{
    setBanner({}, 'bad', 'ออฟไลน์/เชื่อมต่อไม่ได้', 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจเครือข่าย/CORS');
  }

  probeLock = false;
}

attachRetry('btnRetry', probe);
probe();

// init
wireQuickPlay();
showLastSummary();
refreshAllUI();