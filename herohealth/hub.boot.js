// === /herohealth/hub.boot.js ===
// PACK v20260216e (ALL + Heatmap7 + QuestDirector)
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
  // dayKey: YYYY-MM-DD local
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

// ===== Summary history -> plays today by zone =====
const HISTORY_KEYS = ['HHA_SUMMARY_HISTORY','HHA_SUMMARY_HISTORY_V1','HHA_SUMMARY_HISTORY_V2'];

function safeJson(raw){ try{ return JSON.parse(raw); }catch{ return null; } }

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

// Progress: each zone "target plays" per day (tweakable + responds to diff)
function targetPlaysPerZone(){
  const d = String(P.diff||'normal');
  if(d === 'easy') return 1;
  if(d === 'hard') return 3;
  return 2; // normal
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
  for(let i=6;i>=0;i--){
    days.push(addDays(today, -i));
  }

  // Build cells
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

    // label: Mon..Sun style (short)
    let label = dk.slice(5); // MM-DD
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

  if(meta){
    meta.textContent = `ครบ 3/3 = ${fullCount} วัน • มีการเล่น = ${anyCount} วัน`;
  }
}

// ===== Quest Director (deterministic) =====
// simple hash -> seed
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
function pick(rng, arr){
  return arr[(rng() * arr.length) | 0];
}

function zonePlayLink(zone){
  // choose a representative launcher in that zone (quick path)
  if(zone === 'nutrition') return $('goGoodJunk')?.getAttribute('href') || './goodjunk-vr.html';
  if(zone === 'hygiene')  return $('goHandwash')?.getAttribute('href') || './hygiene-vr.html';
  if(zone === 'fitness')  return $('goPlanner')?.getAttribute('href') || './fitness-planner-vr.html';
  return './';
}

function questTargets(){
  // tweakable by diff/time (makes it feel adaptive)
  const d = String(P.diff||'normal');
  const base = (d==='easy')?1:(d==='hard'?2:1);
  const t = Number(P.time)||80;
  const bonus = (t>=120)?1:0;
  return {
    minPlaysPerZone: base,          // zone quests: plays >= base
    bonusPlaysTotal: 3 + bonus      // bonus quest: total plays >= 3(+)
  };
}

function buildTodayQuests(){
  const today = getLocalDayKey();
  const rng = mulberry32(hash32(`HHA_QD|${today}|${P.pid}|${P.diff}|${P.time}`));
  const T = questTargets();

  // Quest templates (verifiable from Hub: plays today + done 3 zones)
  const qZone = (zone, title, desc)=>({
    id:`zone-${zone}`,
    type:'zone',
    zone,
    title,
    desc,
    target:T.minPlaysPerZone
  });

  const nutritionTitles = [
    ['🥗 Nutrition Sprint', `เล่นเกมโภชนาการอย่างน้อย ${T.minPlaysPerZone} รอบวันนี้`],
    ['🍎 Healthy Combo', `เล่นโซน Nutrition ≥ ${T.minPlaysPerZone} รอบ (GoodJunk/Groups/Hydration/Plate)`]
  ];
  const hygieneTitles = [
    ['🧼 Hygiene Hero', `เล่นเกมอนามัยอย่างน้อย ${T.minPlaysPerZone} รอบวันนี้`],
    ['🦠 Clean Defender', `เล่นโซน Hygiene ≥ ${T.minPlaysPerZone} รอบ (Handwash/Brush/MaskCough)`]
  ];
  const fitnessTitles = [
    ['🏃 Fitness Burst', `เล่นเกมออกกำลังกายอย่างน้อย ${T.minPlaysPerZone} รอบวันนี้`],
    ['🥊 Move Master', `เล่นโซน Fitness ≥ ${T.minPlaysPerZone} รอบ (Planner/Shadow/Rhythm/JumpDuck/Balance)`]
  ];

  const n = pick(rng, nutritionTitles);
  const h = pick(rng, hygieneTitles);
  const f = pick(rng, fitnessTitles);

  const quests = [
    qZone('nutrition', n[0], n[1]),
    qZone('hygiene',  h[0], h[1]),
    qZone('fitness',  f[0], f[1]),
    {
      id:'bonus-all',
      type:'bonus',
      title:'🔥 Bonus: Full Clear',
      desc:'ทำให้ครบ 3 โซนวันนี้ (หรือเล่นรวมให้ถึงเป้าหมาย) เพื่อเพิ่ม streak!',
      targetTotal:T.bonusPlaysTotal
    }
  ];

  // persist (stable for the day)
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

function questProgress(quest, counts, done){
  // counts: plays today by zone, done: {nutrition,hygiene,fitness}
  if(quest.type === 'zone'){
    const z = quest.zone;
    const cur = Number(counts?.[z]||0);
    const target = Number(quest.target||1);
    return { cur, target, ok: cur >= target };
  }
  if(quest.type === 'bonus'){
    const total = Number(counts?.total||0);
    const targetTotal = Number(quest.targetTotal || quest.target || 3);
    const doneAll = !!(done?.nutrition && done?.hygiene && done?.fitness);
    // accept either: all 3 zones done OR total plays meets targetTotal
    const ok = doneAll || (total >= targetTotal);
    return { cur: doneAll ? 3 : total, target: doneAll ? 3 : targetTotal, ok };
  }
  return { cur:0, target:1, ok:false };
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

    const card = document.createElement('div');
    card.className = 'qcard';

    const statusCls = pr.ok ? 'qstatus ok' : 'qstatus warn';
    const statusTxt = pr.ok ? 'DONE ✅' : `${pr.cur}/${pr.target}`;

    card.innerHTML = `
      <div class="qtop">
        <div>
          <div class="qtitle">${q.title || 'Quest'}</div>
          <div class="qdesc">${q.desc || ''}</div>
        </div>
        <div class="${statusCls}">${statusTxt}</div>
      </div>
      <div class="qactions">
        <a class="btn ${pr.ok ? 'ghost' : 'primary'}" href="#" data-qplay="${q.zone || 'any'}">${pr.ok ? 'ดูโซน' : 'ไปทำเลย'}</a>
        <a class="btn ghost" href="#" data-qreshow="1">รีเฟรช</a>
      </div>
    `;

    // wire buttons
    card.querySelectorAll('[data-qplay]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        const zone = btn.getAttribute('data-qplay') || 'any';
        const href = zone === 'any' ? ( $('goQuickPlay') ? '#' : './' ) : zonePlayLink(zone);
        if(zone === 'any'){
          toast('Quick Play 🎲');
          // reuse quick play logic below
          quickPlayNow();
          return;
        }
        location.href = withCommonParams(href);
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

  if(meta){
    meta.textContent = `วันนี้ (${today}) • เควสสำเร็จ ${okCount}/${quests.length} • diff=${P.diff} time=${P.time}s`;
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

  // update streak when 3/3 today and not counted yet
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