// === /herohealth/hub.boot.js ===
// PACK v20260216f (ALL + Heatmap7 + QuestDirector Advanced: Analyze/Evaluate)
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

// patch links (ALL)
const linkIds = [
  'goGoodJunk','goGroups','goHydration','goPlate',
  'goHandwash','goBrush','goMaskCough',
  'goPlanner','goShadow','goRhythm','goJumpDuck','goBalanceHold',
  'goBadges','goCheckin'
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
function zoneFromGame(game){
  const g = normalizeGameName(game);
  if(g.includes('goodjunk') || g.includes('groups') || g.includes('hydration') || g.includes('plate')) return 'nutrition';
  if(g.includes('handwash') || g.includes('hygiene') || g.includes('brush') || g.includes('maskcough') || g.includes('germ')) return 'hygiene';
  if(g.includes('planner') || g.includes('shadow') || g.includes('rhythm') || g.includes('jumpduck') || g.includes('balance')) return 'fitness';
  return '';
}

function playsByZoneForDay(dayKey){
  const hist = readHistory();
  const counts = { nutrition:0, hygiene:0, fitness:0, total:0 };
  for(const it of hist){
    const ts = it?.ts || it?.endedAt || it?.timeEnd || it?.t || 0;
    if(!isSameDay(ts, dayKey)) continue;
    const game = it?.game || it?.mode || it?.name || '';
    const zone = it?.zone || zoneFromGame(game);
    if(zone && counts[zone]!=null){ counts[zone]++; counts.total++; }
  }

  if(counts.total === 0){
    // fallback: last summary
    try{
      const raw = localStorage.getItem('HHA_LAST_SUMMARY');
      const j = safeJson(raw) || {};
      const ts = j.ts || j.endedAt || j.timeEnd || 0;
      if(isSameDay(ts, dayKey)){
        const game = j.game || j.mode || j.name || '';
        const zone = j.zone || zoneFromGame(game);
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

// ===== Heatmap (7 days) =====
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
    if(doneCount === 0){
      cls += ' none';
      sym = '0/3';
    }else if(doneCount < 3){
      cls += ' part';
      sym = `${doneCount}/3`;
      anyCount++;
    }else{
      cls += ' full';
      sym = '3/3';
      fullCount++;
      anyCount++;
    }
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

// ===== Performance extraction =====
function num(v, def=null){
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function getPerfFromSummary(s){
  if(!s) return null;
  // accept common field names
  const acc = num(s.acc ?? s.accuracy ?? s.hitRate ?? s.accPct, null);
  const score = num(s.score ?? s.points ?? s.totalScore, null);
  const miss = num(s.miss ?? s.misses ?? s.missCount, null);
  const time = num(s.time ?? s.duration ?? s.dur, null);
  const game = String(s.game ?? s.mode ?? s.name ?? '').trim();
  const zone = String(s.zone ?? zoneFromGame(game) ?? '').trim();
  const ts = num(s.ts ?? s.endedAt ?? s.timeEnd ?? s.t, null);
  return { acc, score, miss, time, game, zone, ts };
}

function readLastPerf(){
  try{
    const raw = localStorage.getItem('HHA_LAST_SUMMARY');
    const j = safeJson(raw);
    const p = getPerfFromSummary(j);
    return p && (p.acc!=null || p.score!=null || p.miss!=null) ? p : null;
  }catch{ return null; }
}

function dayPerfAggregate(dayKey){
  // aggregate from history (best-effort)
  const hist = readHistory();
  let n = 0;
  let accSum = 0;
  let missSum = 0;
  let scoreSum = 0;
  let bestAcc = null, bestScore = null, bestMiss = null;
  const byZone = { nutrition:{n:0, accSum:0, missSum:0, scoreSum:0},
                   hygiene:{n:0, accSum:0, missSum:0, scoreSum:0},
                   fitness:{n:0, accSum:0, missSum:0, scoreSum:0} };

  for(const it of hist){
    const ts = it?.ts || it?.endedAt || it?.timeEnd || it?.t || 0;
    if(!isSameDay(ts, dayKey)) continue;
    const p = getPerfFromSummary(it);
    if(!p) continue;

    const z = p.zone || zoneFromGame(p.game);
    const acc = p.acc; const miss = p.miss; const score = p.score;

    n++;
    if(acc!=null){ accSum += acc; bestAcc = (bestAcc==null)?acc:Math.max(bestAcc, acc); }
    if(miss!=null){ missSum += miss; bestMiss = (bestMiss==null)?miss:Math.min(bestMiss, miss); }
    if(score!=null){ scoreSum += score; bestScore = (bestScore==null)?score:Math.max(bestScore, score); }

    if(z && byZone[z]){
      byZone[z].n++;
      if(acc!=null) byZone[z].accSum += acc;
      if(miss!=null) byZone[z].missSum += miss;
      if(score!=null) byZone[z].scoreSum += score;
    }
  }

  // fallback to last summary if it's today and we have no history entries
  if(n === 0){
    const lp = readLastPerf();
    if(lp && lp.ts!=null && isSameDay(lp.ts, dayKey)){
      const z = lp.zone || zoneFromGame(lp.game);
      n = 1;
      if(lp.acc!=null){ accSum = lp.acc; bestAcc = lp.acc; }
      if(lp.miss!=null){ missSum = lp.miss; bestMiss = lp.miss; }
      if(lp.score!=null){ scoreSum = lp.score; bestScore = lp.score; }
      if(z && byZone[z]){
        byZone[z].n = 1;
        if(lp.acc!=null) byZone[z].accSum = lp.acc;
        if(lp.miss!=null) byZone[z].missSum = lp.miss;
        if(lp.score!=null) byZone[z].scoreSum = lp.score;
      }
    }
  }

  const avgAcc = (n && accSum) ? (accSum / n) : null;
  const avgMiss = (n && missSum) ? (missSum / n) : null;
  const avgScore = (n && scoreSum) ? (scoreSum / n) : null;

  function avgZone(z, key){
    const o = byZone[z];
    if(!o || !o.n) return null;
    if(key==='acc') return o.accSum / o.n;
    if(key==='miss') return o.missSum / o.n;
    if(key==='score') return o.scoreSum / o.n;
    return null;
  }

  // find weakest zone by avgAcc (if available), else by plays
  const plays = playsByZoneForDay(dayKey);
  const zones = ['nutrition','hygiene','fitness'];
  let weakest = null;
  let bestMetric = null;

  // prefer avgAcc if present
  const accs = zones.map(z=>({ z, v: avgZone(z,'acc') })).filter(x=>x.v!=null);
  if(accs.length){
    accs.sort((a,b)=>a.v-b.v);
    weakest = accs[0].z;
    bestMetric = { type:'acc', value: accs[0].v };
  }else{
    // else choose least-played zone (encourage variety)
    zones.sort((a,b)=>(plays[a]||0)-(plays[b]||0));
    weakest = zones[0];
    bestMetric = { type:'plays', value: plays[weakest]||0 };
  }

  return { n, avgAcc, avgMiss, avgScore, bestAcc, bestMiss, bestScore, weakestZone: weakest, weakestMetric: bestMetric, plays };
}

// ===== Quest Director (deterministic) =====
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

function zonePlayLink(zone){
  if(zone === 'nutrition') return $('goGoodJunk')?.getAttribute('href') || './goodjunk-vr.html';
  if(zone === 'hygiene')  return $('goHandwash')?.getAttribute('href') || './hygiene-vr.html';
  if(zone === 'fitness')  return $('goPlanner')?.getAttribute('href') || './fitness-planner-vr.html';
  return './';
}

// dynamic targets by diff/time
function questTargets(){
  const d = String(P.diff||'normal');
  const t = Number(P.time)||80;

  const basePlays = (d==='easy')?1:(d==='hard'?2:1);
  const bonus = (t>=120)?1:0;

  // performance thresholds
  const accTarget = (d==='easy')?70:(d==='hard'?85:80);
  const missTarget = (d==='easy')?6:(d==='hard'?3:4);
  // score is game-dependent; we set a relative target based on recent best/avg later

  return {
    minPlaysPerZone: basePlays,
    bonusPlaysTotal: 3 + bonus,
    accTarget,
    missTarget
  };
}

function buildTodayQuests(){
  const today = getLocalDayKey();
  const rng = mulberry32(hash32(`HHA_QD_ADV|${today}|${P.pid}|${P.diff}|${P.time}`));
  const T = questTargets();
  const agg = dayPerfAggregate(today);

  // Base zone quests (always safe)
  const qZone = (zone, title, desc)=>({
    id:`zone-${zone}`,
    type:'zone',
    zone,
    title,
    desc,
    target:T.minPlaysPerZone
  });

  const nutritionTitles = [
    ['🥗 Nutrition Sprint', `เล่นโซน Nutrition อย่างน้อย ${T.minPlaysPerZone} รอบวันนี้`],
    ['🍎 Healthy Combo', `เล่น Nutrition ≥ ${T.minPlaysPerZone} รอบ (GoodJunk/Groups/Hydration/Plate)`]
  ];
  const hygieneTitles = [
    ['🧼 Hygiene Hero', `เล่นโซน Hygiene อย่างน้อย ${T.minPlaysPerZone} รอบวันนี้`],
    ['🦠 Clean Defender', `เล่น Hygiene ≥ ${T.minPlaysPerZone} รอบ (Handwash/Brush/MaskCough)`]
  ];
  const fitnessTitles = [
    ['🏃 Fitness Burst', `เล่นโซน Fitness อย่างน้อย ${T.minPlaysPerZone} รอบวันนี้`],
    ['🥊 Move Master', `เล่น Fitness ≥ ${T.minPlaysPerZone} รอบ (Planner/Shadow/Rhythm/JumpDuck/Balance)`]
  ];

  const n = pick(rng, nutritionTitles);
  const h = pick(rng, hygieneTitles);
  const f = pick(rng, fitnessTitles);

  const base = [
    qZone('nutrition', n[0], n[1]),
    qZone('hygiene',  h[0], h[1]),
    qZone('fitness',  f[0], f[1]),
  ];

  // Advanced performance quests (2 quests picked deterministically)
  // Candidates:
  const adv = [];

  // A) Accuracy quest
  adv.push({
    id:'adv-acc',
    type:'perf',
    metric:'acc',
    title:'🎯 Evaluate: Accuracy Challenge',
    desc:`ทำ Accuracy ≥ ${T.accTarget}% ในเกมใดก็ได้วันนี้`,
    targetAcc: T.accTarget
  });

  // B) Miss quest
  adv.push({
    id:'adv-miss',
    type:'perf',
    metric:'miss',
    title:'🛡️ Evaluate: Clean Run',
    desc:`ทำ Miss ≤ ${T.missTarget} ในรอบใดก็ได้วันนี้`,
    targetMiss: T.missTarget
  });

  // C) Score quest (relative)
  const baseScore = (agg.bestScore!=null) ? Math.max(10, Math.round(agg.bestScore * ( (P.diff==='hard')?1.05:(P.diff==='easy'?0.9:1.0) )))
                   : (P.diff==='hard'?120:(P.diff==='easy'?60:90));
  adv.push({
    id:'adv-score',
    type:'perf',
    metric:'score',
    title:'🏁 Analyze: Score Push',
    desc:`ทำ Score ≥ ${baseScore} (อิงจากสถิติวันนี้/ค่าเริ่มต้น)`,
    targetScore: baseScore
  });

  // D) Weakest zone quest (adaptive but deterministic since derived from stored data)
  const wz = agg.weakestZone || pick(rng, ['nutrition','hygiene','fitness']);
  const wzTitle = (wz==='nutrition')?'🥗 Fix Weak Spot: Nutrition'
                : (wz==='hygiene')?'🧼 Fix Weak Spot: Hygiene'
                : '🏃 Fix Weak Spot: Fitness';
  adv.push({
    id:'adv-weak',
    type:'adaptive',
    zone:wz,
    title:wzTitle,
    desc:`วันนี้โซนนี้ “ยังอ่อน” — เล่นเพิ่มอีก 1 รอบเพื่อบาลานซ์`,
    targetExtra: 1
  });

  // Pick 2 advanced quests (deterministic)
  // ensure variety by shuffling via rng
  const pool = adv.slice();
  for(let i=pool.length-1;i>0;i--){
    const j = (rng() * (i+1)) | 0;
    const tmp = pool[i]; pool[i]=pool[j]; pool[j]=tmp;
  }
  const picked = pool.slice(0,2);

  // Bonus quest: Full Clear OR total plays
  const bonus = {
    id:'bonus-all',
    type:'bonus',
    title:'🔥 Bonus: Full Clear',
    desc:'ทำให้ครบ 3 โซนวันนี้ (หรือเล่นรวมให้ถึงเป้าหมาย) เพื่อเพิ่ม streak!',
    targetTotal:T.bonusPlaysTotal
  };

  const quests = [...base, ...picked, bonus];

  // persist for the day (stable)
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

function bestPerfToday(dayKey){
  // scan history for the best (max acc/score, min miss) and last run
  const hist = readHistory();
  let bestAcc = null, bestScore = null, bestMiss = null;
  let last = null;

  for(const it of hist){
    const ts = it?.ts || it?.endedAt || it?.timeEnd || it?.t || 0;
    if(!isSameDay(ts, dayKey)) continue;
    const p = getPerfFromSummary(it);
    if(!p) continue;
    if(p.acc!=null) bestAcc = (bestAcc==null)?p.acc:Math.max(bestAcc, p.acc);
    if(p.score!=null) bestScore = (bestScore==null)?p.score:Math.max(bestScore, p.score);
    if(p.miss!=null) bestMiss = (bestMiss==null)?p.miss:Math.min(bestMiss, p.miss);
    if(!last || (p.ts!=null && p.ts > (last.ts||0))) last = p;
  }

  // fallback last summary if today
  if(!last){
    const lp = readLastPerf();
    if(lp && lp.ts!=null && isSameDay(lp.ts, dayKey)){
      last = lp;
      if(lp.acc!=null) bestAcc = lp.acc;
      if(lp.score!=null) bestScore = lp.score;
      if(lp.miss!=null) bestMiss = lp.miss;
    }
  }

  return { bestAcc, bestScore, bestMiss, last };
}

function questProgress(quest, counts, done){
  const today = getLocalDayKey();
  const perf = bestPerfToday(today);

  if(quest.type === 'zone'){
    const z = quest.zone;
    const cur = Number(counts?.[z]||0);
    const target = Number(quest.target||1);
    return { cur, target, ok: cur >= target, hint:`${cur}/${target} plays` };
  }

  if(quest.type === 'adaptive'){
    const z = quest.zone;
    const cur = Number(counts?.[z]||0);
    // require: play at least (current targetPlaysPerZone + extra?) — but keep it simple: +1 from current baseline
    const base = targetPlaysPerZone();
    const target = Math.max(base, 1) + Number(quest.targetExtra||1) - 1;
    return { cur, target, ok: cur >= target, hint:`${cur}/${target} plays` };
  }

  if(quest.type === 'perf'){
    if(quest.metric === 'acc'){
      const cur = (perf.bestAcc==null) ? 0 : Math.round(perf.bestAcc);
      const target = Number(quest.targetAcc||80);
      const ok = (perf.bestAcc!=null) && (perf.bestAcc >= target);
      return { cur, target, ok, hint: perf.bestAcc==null ? 'no data' : `best ${cur}%` };
    }
    if(quest.metric === 'miss'){
      const cur = (perf.bestMiss==null) ? 999 : Math.round(perf.bestMiss);
      const target = Number(quest.targetMiss||4);
      const ok = (perf.bestMiss!=null) && (perf.bestMiss <= target);
      return { cur: (cur===999?0:cur), target, ok, hint: perf.bestMiss==null ? 'no data' : `best ${cur}` };
    }
    if(quest.metric === 'score'){
      const cur = (perf.bestScore==null) ? 0 : Math.round(perf.bestScore);
      const target = Number(quest.targetScore||90);
      const ok = (perf.bestScore!=null) && (perf.bestScore >= target);
      return { cur, target, ok, hint: perf.bestScore==null ? 'no data' : `best ${cur}` };
    }
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
    const statusTxt = pr.ok ? 'DONE ✅' : `${pr.cur}/${pr.target}`;

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
        <a class="btn ${pr.ok ? 'ghost' : 'primary'}" href="#" data-qplay="${q.zone || (q.type==='bonus'?'any':'any')}">${pr.ok ? 'ดูโซน' : 'ไปทำเลย'}</a>
        <a class="btn ghost" href="#" data-qreshow="1">รีเฟรช</a>
      </div>
    `;

    card.querySelectorAll('[data-qplay]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const zone = btn.getAttribute('data-qplay') || 'any';
        if(zone === 'any'){
          toast('Quick Play 🎲');
          quickPlayNow();
          return;
        }
        location.href = withCommonParams(zonePlayLink(zone));
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

  // meta: show some perf info
  const perf = bestPerfToday(today);
  const perfTxt = [
    (perf.bestAcc!=null ? `bestAcc ${Math.round(perf.bestAcc)}%` : 'bestAcc —'),
    (perf.bestMiss!=null ? `bestMiss ${Math.round(perf.bestMiss)}` : 'bestMiss —'),
    (perf.bestScore!=null ? `bestScore ${Math.round(perf.bestScore)}` : 'bestScore —'),
  ].join(' • ');

  if(meta){
    meta.textContent = `วันนี้ (${today}) • เควสสำเร็จ ${okCount}/${quests.length} • ${perfTxt}`;
  }
}

// ===== Quick Play =====
function quickPlayNow(){
  const gameIds = [
    'goGoodJunk','goGroups','goHydration','goPlate',
    'goHandwash','goBrush','goMaskCough',
    'goPlanner','goShadow','goRhythm','goJumpDuck','goBalanceHold'
  ];
  const links = [];
  for(const id of gameIds){
    const el = $(id);
    if(!el) continue;
    const href = el.getAttribute('href');
    if(!href || href === '#') continue;
    links.push(href);
  }
  if(!links.length){ toast('ยังไม่มีลิงก์เกมให้สุ่ม 😅'); return; }
  const target = links[(Math.random() * links.length) | 0];
  location.href = withCommonParams(target);
}
function wireQuickPlay(){
  const a = $('goQuickPlay');
  if(!a) return;
  a.addEventListener('click', (e)=>{
    e.preventDefault();
    toast('Quick Play 🎲');
    quickPlayNow();
  });
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