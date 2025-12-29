// === /herohealth/hub.safe.js ===
// HeroHealth HUB (PRODUCTION ++ HISTORY + CSV)
// ✅ อ่าน localStorage: HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ ตาราง 4 เกมล่าสุด + ปุ่ม replay/copy/export/clear
// ✅ Export CSV (last / recent4)
// ✅ Launch 4 games พร้อมส่งพารามิเตอร์กลับไป-กลับมา (hub=..., run/runMode, diff, time, seed, + research ctx)
//
// หมายเหตุเรื่องความเข้ากันได้:
// - ส่งทั้ง run และ runMode (play / research) เผื่อแต่ละเกมอ่านคนละคีย์
// - ส่งทั้ง time และ duration (บางเกมใช้ time, บางเกมอาจใช้ durationPlannedSec)

'use strict';

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';
const LS_CTX  = 'HHA_STUDY_CTX';

const PASS_KEYS = [
  // research/session context (ถ้ามีติดมากับ URL หรือเก็บไว้ใน localStorage)
  'projectTag','studyId','phase','condition','conditionGroup','sessionOrder','blockLabel',
  'siteCode','schoolYear','semester',
  'sessionId','studentKey','schoolCode','schoolName','classRoom','studentNo','nickName',
  'gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
  'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent'
];

const GAME_MAP = {
  goodjunk:  { tag:'goodjunk',  name:'🥦 GoodJunk VR',  path:'./goodjunk-vr.html' },
  hydration: { tag:'hydration', name:'💧 Hydration VR', path:'./hydration-vr.html' },
  plate:     { tag:'plate',     name:'🍽️ Plate VR',     path:'./plate-vr.html' },
  groups:    { tag:'groups',    name:'🍎 Groups VR',    path:'./vr-groups/groups-vr.html' }
};

const DEFAULT_RESEARCH_SEED = 777777; // deterministic default ถ้าไม่ใส่ seed ใน Research

// ---------------- helpers ----------------
const $ = (id) => document.getElementById(id);

function safeJsonParse(str, fallback = null){
  try { return JSON.parse(String(str || '')); } catch { return fallback; }
}
function clamp(n, a, b){
  n = Number(n) || 0;
  return n < a ? a : (n > b ? b : n);
}
function nowIso(){
  return new Date().toISOString();
}
function fmtLocal(dt){
  try{
    const d = (dt instanceof Date) ? dt : new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt || '—');
    const pad = (x)=>String(x).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }catch{
    return String(dt || '—');
  }
}
function pick(obj, keys, fallback){
  for (const k of keys){
    if (!obj) continue;
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
}
function normalizeRun(selRunValue){
  // UI: play | study
  // URL: play | research
  return (String(selRunValue || '').toLowerCase() === 'study') ? 'research' : 'play';
}
function normalizeDiff(v){
  v = String(v || 'normal').toLowerCase();
  if (v !== 'easy' && v !== 'hard') v = 'normal';
  return v;
}
function getHubReturnUrl(){
  const u = new URL(location.href);
  u.hash = '';
  return u.toString();
}

// HTML escape (กันค่าใน localStorage แอบใส่ HTML)
function htmlEscape(v){
  const s = String(v ?? '');
  return s
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

async function copyText(text){
  const t = String(text ?? '');
  try{
    await navigator.clipboard.writeText(t);
    return true;
  }catch{
    // fallback
    try{
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    }catch{
      return false;
    }
  }
}

function downloadText(filename, text){
  const blob = new Blob([String(text || '')], { type:'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 250);
}

// ------------- CSV -------------
function csvEscape(v){
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}
function toCsv(rows, columns){
  const head = columns.map(csvEscape).join(',');
  const body = rows.map(r => columns.map(c => csvEscape(r[c])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}

function flattenSummaryToRow(s){
  const ctx     = s?.ctx || s?.context || {};
  const metrics = s?.metrics || {};
  const counts  = s?.counts || {};

  const runMode = pick(s, ['runMode','run','mode'], '');
  const diff    = pick(s, ['diff','difficulty'], '');
  const seed    = pick(s, ['seed','rngSeed'], '');

  const row = {
    timestampIso: pick(s, ['timestampIso','tsIso','timeIso','endTimeIso'], ''),
    projectTag:   pick(s, ['projectTag'], pick(ctx, ['projectTag'], 'HeroHealth')),
    gameTag:      pick(s, ['gameTag','game','tag'], ''),
    runMode:      runMode,
    diff:         diff,
    durationPlannedSec: pick(s, ['durationPlannedSec','time','duration'], pick(ctx, ['durationPlannedSec'], '')),
    durationPlayedSec:  pick(s, ['durationPlayedSec','playedSec','durationPlayed'], pick(metrics, ['durationPlayedSec'], '')),
    scoreFinal:   pick(s, ['scoreFinal','score'], pick(metrics, ['scoreFinal'], 0)),
    comboMax:     pick(s, ['comboMax','maxCombo'], pick(metrics, ['comboMax'], 0)),
    misses:       pick(s, ['misses','miss'], pick(metrics, ['misses'], pick(counts, ['misses'], 0))),
    goalsCleared: pick(s, ['goalsCleared'], pick(metrics, ['goalsCleared'], 0)),
    goalsTotal:   pick(s, ['goalsTotal'], pick(metrics, ['goalsTotal'], 0)),
    miniCleared:  pick(s, ['miniCleared','minisCleared'], pick(metrics, ['miniCleared'], 0)),
    miniTotal:    pick(s, ['miniTotal','minisTotal'], pick(metrics, ['miniTotal'], 0)),

    nTargetGoodSpawned: pick(s, ['nTargetGoodSpawned'], pick(counts, ['nTargetGoodSpawned'], '')),
    nTargetJunkSpawned: pick(s, ['nTargetJunkSpawned'], pick(counts, ['nTargetJunkSpawned'], '')),
    nTargetStarSpawned: pick(s, ['nTargetStarSpawned'], pick(counts, ['nTargetStarSpawned'], '')),
    nTargetDiamondSpawned: pick(s, ['nTargetDiamondSpawned'], pick(counts, ['nTargetDiamondSpawned'], '')),
    nTargetShieldSpawned: pick(s, ['nTargetShieldSpawned'], pick(counts, ['nTargetShieldSpawned'], '')),

    nHitGood:     pick(s, ['nHitGood'], pick(counts, ['nHitGood'], '')),
    nHitJunk:     pick(s, ['nHitJunk'], pick(counts, ['nHitJunk'], '')),
    nHitJunkGuard:pick(s, ['nHitJunkGuard'], pick(counts, ['nHitJunkGuard'], '')),
    nExpireGood:  pick(s, ['nExpireGood'], pick(counts, ['nExpireGood'], '')),

    accuracyGoodPct: pick(s, ['accuracyGoodPct'], pick(metrics, ['accuracyGoodPct'], '')),
    junkErrorPct:    pick(s, ['junkErrorPct'], pick(metrics, ['junkErrorPct'], '')),
    avgRtGoodMs:     pick(s, ['avgRtGoodMs'], pick(metrics, ['avgRtGoodMs'], '')),
    medianRtGoodMs:  pick(s, ['medianRtGoodMs'], pick(metrics, ['medianRtGoodMs'], '')),
    fastHitRatePct:  pick(s, ['fastHitRatePct'], pick(metrics, ['fastHitRatePct'], '')),

    grade:        pick(s, ['grade'], ''),
    sessionId:    pick(s, ['sessionId'], pick(ctx, ['sessionId'], '')),
    studyId:      pick(s, ['studyId'], pick(ctx, ['studyId'], '')),
    phase:        pick(s, ['phase'], pick(ctx, ['phase'], '')),
    conditionGroup: pick(s, ['conditionGroup','condition'], pick(ctx, ['conditionGroup','condition'], '')),
    sessionOrder: pick(s, ['sessionOrder'], pick(ctx, ['sessionOrder'], '')),
    blockLabel:   pick(s, ['blockLabel'], pick(ctx, ['blockLabel'], '')),
    siteCode:     pick(s, ['siteCode'], pick(ctx, ['siteCode'], '')),

    device:       pick(s, ['device'], pick(ctx, ['device'], navigator.userAgent || '')),
    gameVersion:  pick(s, ['gameVersion','version'], pick(ctx, ['gameVersion'], '')),
    reason:       pick(s, ['reason'], '')
  };

  row.seed = seed || pick(ctx, ['seed'], '');

  if (!row.timestampIso) row.timestampIso = nowIso();

  return row;
}

function exportCsvForSummaries(kind, summaries){
  const arr = Array.isArray(summaries) ? summaries : (summaries ? [summaries] : []);
  const rows = arr.map(flattenSummaryToRow);

  const columns = [
    'timestampIso','projectTag','gameTag','runMode','diff','seed',
    'durationPlannedSec','durationPlayedSec',
    'scoreFinal','comboMax','misses',
    'goalsCleared','goalsTotal','miniCleared','miniTotal',
    'nTargetGoodSpawned','nTargetJunkSpawned','nTargetStarSpawned','nTargetDiamondSpawned','nTargetShieldSpawned',
    'nHitGood','nHitJunk','nHitJunkGuard','nExpireGood',
    'accuracyGoodPct','junkErrorPct','avgRtGoodMs','medianRtGoodMs','fastHitRatePct',
    'grade',
    'sessionId','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode',
    'device','gameVersion','reason'
  ];

  const csv = toCsv(rows, columns);
  const stamp = fmtLocal(new Date()).replace(/[:\s]/g,'-');
  const filename = `HHA_${kind}_${stamp}.csv`;
  downloadText(filename, csv);
}

// ------------- grade tag -------------
function gradeClass(grade){
  const g = String(grade || '').toUpperCase().trim();
  if (['SSS','SS','S','A'].includes(g)) return 'good';
  if (['B'].includes(g)) return 'warn';
  if (['C','D','F'].includes(g)) return 'bad';
  return '';
}
function computeGrade(summary){
  const g0 = pick(summary, ['grade'], '');
  if (g0) return String(g0).toUpperCase();

  const acc = Number(pick(summary, ['accuracyGoodPct'], pick(summary?.metrics, ['accuracyGoodPct'], null)));
  if (!Number.isFinite(acc)) return '—';
  if (acc >= 95) return 'SSS';
  if (acc >= 90) return 'SS';
  if (acc >= 85) return 'S';
  if (acc >= 75) return 'A';
  if (acc >= 60) return 'B';
  return 'C';
}

// ------------- storage read/write -------------
function readLast(){
  return safeJsonParse(localStorage.getItem(LS_LAST), null);
}
function readHist(){
  const h = safeJsonParse(localStorage.getItem(LS_HIST), []);
  return Array.isArray(h) ? h : [];
}
function clearLast(){
  try{ localStorage.removeItem(LS_LAST); } catch {}
}
function clearHist(){
  try{ localStorage.removeItem(LS_HIST); } catch {}
}

// history sort (เผื่อบางเกม push แบบท้าย/หัวไม่เหมือนกัน)
function getSortedHistory(){
  const hist = readHist();
  const arr = Array.isArray(hist) ? hist.slice() : [];
  arr.sort((a,b) => {
    const ta = new Date(pick(a, ['timestampIso','endTimeIso','timeIso'], 0)).getTime();
    const tb = new Date(pick(b, ['timestampIso','endTimeIso','timeIso'], 0)).getTime();
    return (Number.isFinite(tb)?tb:0) - (Number.isFinite(ta)?ta:0);
  });
  return arr;
}

function collectStudyCtx(){
  const ctx = {};
  const qp = new URLSearchParams(location.search);

  for (const k of PASS_KEYS){
    if (qp.has(k)) ctx[k] = qp.get(k);
  }

  const stored = safeJsonParse(localStorage.getItem(LS_CTX), null);
  if (stored && typeof stored === 'object'){
    for (const k of PASS_KEYS){
      if (ctx[k] === undefined && stored[k] !== undefined && stored[k] !== null && stored[k] !== ''){
        ctx[k] = stored[k];
      }
    }
  }

  if (!ctx.projectTag) ctx.projectTag = 'HeroHealth';
  return ctx;
}

// ------------- link builder / launcher -------------
function buildGameUrl(gameTag, opts = {}){
  const g = GAME_MAP[gameTag];
  if (!g) return null;

  const u = new URL(g.path, location.href);

  const run = normalizeRun(opts.selRun);
  const diff = normalizeDiff(opts.selDiff);
  const time = clamp(opts.timeSec, 20, 9999);

  let seed = opts.seed;
  if (seed === '' || seed === null || seed === undefined) seed = '';
  if (run === 'research' && !seed) seed = DEFAULT_RESEARCH_SEED;

  u.searchParams.set('hub', getHubReturnUrl());
  u.searchParams.set('run', run);
  u.searchParams.set('runMode', run);
  u.searchParams.set('diff', diff);
  u.searchParams.set('time', String(time));
  u.searchParams.set('duration', String(time));
  if (seed !== '') u.searchParams.set('seed', String(seed));

  const ctx = collectStudyCtx();
  for (const k of PASS_KEYS){
    const v = ctx[k];
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  }

  u.searchParams.set('v', String(Date.now()));
  return u;
}

function buildGameUrlFromSummary(summary){
  const gameTag = pick(summary, ['gameTag','game','tag'], '');
  const g = GAME_MAP[gameTag];
  if (!g) return null;

  const u = new URL(g.path, location.href);

  const run  = String(pick(summary, ['runMode','run','mode'], 'play')).toLowerCase() || 'play';
  const diff = normalizeDiff(pick(summary, ['diff'], 'normal'));
  const time = Number(pick(summary, ['durationPlannedSec','time','duration'], 70)) || 70;
  const seed = pick(summary, ['seed'], pick(summary?.ctx, ['seed'], ''));

  u.searchParams.set('hub', getHubReturnUrl());
  u.searchParams.set('run', run);
  u.searchParams.set('runMode', run);
  u.searchParams.set('diff', diff);
  u.searchParams.set('time', String(clamp(time, 20, 9999)));
  u.searchParams.set('duration', String(clamp(time, 20, 9999)));
  if (seed !== '' && seed !== undefined && seed !== null) u.searchParams.set('seed', String(seed));

  const ctx = { ...(collectStudyCtx() || {}) };
  const sctx = summary?.ctx || summary?.context || {};
  if (sctx && typeof sctx === 'object'){
    for (const k of PASS_KEYS){
      if (sctx[k] !== undefined && sctx[k] !== null && sctx[k] !== '') ctx[k] = sctx[k];
    }
  }
  for (const k of PASS_KEYS){
    const v = ctx[k];
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  }

  u.searchParams.set('v', String(Date.now()));
  return u;
}

// ------------- UI bind -------------
let selectedGame = 'goodjunk';

function setSelectedGame(tag){
  if (!GAME_MAP[tag]) tag = 'goodjunk';
  selectedGame = tag;

  const els = Array.from(document.querySelectorAll('.gameBtn'));
  for (const el of els){
    const isSel = el.dataset.game === selectedGame;
    el.style.borderColor = isSel ? 'rgba(34,197,94,.55)' : 'rgba(148,163,184,.18)';
    el.style.background   = isSel ? 'rgba(34,197,94,.10)' : 'rgba(2,6,23,.58)';
    const rt = el.querySelector('.rightTag');
    if (rt) rt.textContent = isSel ? 'SELECT' : 'PLAY';
  }

  const hint = $('linkHint');
  if (hint){
    hint.textContent = `เลือกแล้ว: ${GAME_MAP[selectedGame].name}`;
  }
}

function applyPreset(){
  const selRun = $('selRun')?.value || 'play';
  const selDiff = $('selDiff')?.value || 'normal';

  const run = normalizeRun(selRun);
  const diff = normalizeDiff(selDiff);

  let t = 70;
  if (diff === 'easy') t = 70;
  if (diff === 'normal') t = 70;
  if (diff === 'hard') t = 80;

  if (run === 'research') t = 70;

  const inpTime = $('inpTime');
  if (inpTime) inpTime.value = String(t);

  const inpSeed = $('inpSeed');
  if (inpSeed && run === 'research' && !String(inpSeed.value || '').trim()){
    inpSeed.value = String(DEFAULT_RESEARCH_SEED);
  }
}

function renderNow(){
  const el = $('nowText');
  if (!el) return;
  el.textContent = fmtLocal(new Date());
}

function renderLast(){
  const last = readLast();

  const empty = $('lastEmpty');
  const panel = $('lastPanel');

  if (!last){
    if (empty) empty.style.display = '';
    if (panel) panel.style.display = 'none';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (panel) panel.style.display = '';

  const gameTag = pick(last, ['gameTag','game','tag'], '');
  const gameName = GAME_MAP[gameTag]?.name || (gameTag ? String(gameTag) : '—');

  const runMode = String(pick(last, ['runMode','run','mode'], '—')).toUpperCase();
  const diff    = String(pick(last, ['diff'], '—')).toUpperCase();
  const seed    = pick(last, ['seed'], pick(last?.ctx, ['seed'], '—'));

  const score = pick(last, ['scoreFinal','score'], 0);
  const combo = pick(last, ['comboMax','maxCombo'], 0);
  const miss  = pick(last, ['misses','miss'], pick(last?.metrics, ['misses'], 0));
  const gc    = pick(last, ['goalsCleared'], pick(last?.metrics, ['goalsCleared'], 0));
  const gt    = pick(last, ['goalsTotal'],   pick(last?.metrics, ['goalsTotal'], 0));
  const mc    = pick(last, ['miniCleared','minisCleared'], pick(last?.metrics, ['miniCleared'], 0));
  const mt    = pick(last, ['miniTotal','minisTotal'],     pick(last?.metrics, ['miniTotal'], 0));
  const dur   = pick(last, ['durationPlayedSec','playedSec'], pick(last?.metrics, ['durationPlayedSec'], 0));

  const grade = computeGrade(last);

  const badgeGame = $('badgeGame');
  const badgeGrade= $('badgeGrade');

  if (badgeGame){
    badgeGame.textContent = gameName;
    badgeGame.className = 'badge';
  }
  if (badgeGrade){
    badgeGrade.textContent = `Grade ${grade}`;
    const cls = gradeClass(grade);
    badgeGrade.className = `badge ${cls}`.trim();
  }

  const lastSession = $('lastSession');
  if (lastSession){
    const sid = pick(last, ['sessionId'], pick(last?.ctx, ['sessionId'], '—'));
    lastSession.textContent = sid || '—';
  }

  const setText = (id, v) => { const el = $(id); if (el) el.textContent = String(v); };

  setText('lastScore', score);
  setText('lastCombo', combo);
  setText('lastMiss',  miss);
  setText('lastGoals', `${gc||0}/${gt||0}`);
  setText('lastMinis', `${mc||0}/${mt||0}`);
  setText('lastDur',   `${Number(dur||0)}s`);
  setText('lastMode',  runMode);
  setText('lastDiff',  diff);
  setText('lastSeed',  seed === undefined ? '—' : String(seed));

  const lastJson = $('lastJson');
  if (lastJson){
    lastJson.textContent = JSON.stringify(last, null, 2);
  }
}

function renderRecent(){
  const hist = getSortedHistory();
  const recent = hist.slice(0, 4);

  const empty = $('recentEmpty');
  const panel = $('recentPanel');
  const tbody = $('recentTbody');
  const hint  = $('historyHint');

  if (!recent.length){
    if (empty) empty.style.display = '';
    if (panel) panel.style.display = 'none';
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="muted">—</td></tr>`;
    return;
  }

  if (empty) empty.style.display = 'none';
  if (panel) panel.style.display = '';

  if (hint){
    hint.textContent = `แสดง 4 ล่าสุด • ทั้งหมดใน history: ${hist.length}  (แตะ 1 ครั้ง = Copy / แตะ 2 ครั้ง = Play)`;
  }

  if (!tbody) return;

  tbody.innerHTML = recent.map((s, idx) => {
    const gameTag = pick(s, ['gameTag','game','tag'], '');
    const gameName = GAME_MAP[gameTag]?.name || gameTag || '—';
    const runMode  = String(pick(s, ['runMode','run','mode'], '—')).toUpperCase();
    const diff     = String(pick(s, ['diff'], '—')).toUpperCase();
    const score    = pick(s, ['scoreFinal','score'], 0);
    const miss     = pick(s, ['misses','miss'], pick(s?.metrics, ['misses'], 0));
    const gc       = pick(s, ['goalsCleared'], pick(s?.metrics, ['goalsCleared'], 0));
    const gt       = pick(s, ['goalsTotal'],   pick(s?.metrics, ['goalsTotal'], 0));
    const mc       = pick(s, ['miniCleared','minisCleared'], pick(s?.metrics, ['miniCleared'], 0));
    const mt       = pick(s, ['miniTotal','minisTotal'],     pick(s?.metrics, ['miniTotal'], 0));
    const grade    = computeGrade(s);
    const gcls     = gradeClass(grade);
    const tIso     = pick(s, ['timestampIso','endTimeIso','timeIso'], '');
    const tText    = tIso ? fmtLocal(tIso) : '—';

    const gradeHtml = `<span class="gradeTag ${htmlEscape(gcls)}">${htmlEscape(grade)}</span>`;

    return `
      <tr data-i="${idx}">
        <td>${htmlEscape(tText)}</td>
        <td class="tdGame">${htmlEscape(gameName)}</td>
        <td>${htmlEscape(runMode)}</td>
        <td>${htmlEscape(diff)}</td>
        <td>${htmlEscape(score)}</td>
        <td>${gradeHtml}</td>
        <td>${htmlEscape(miss)}</td>
        <td>${htmlEscape((gc||0) + '/' + (gt||0))}</td>
        <td>${htmlEscape((mc||0) + '/' + (mt||0))}</td>
      </tr>
    `.trim();
  }).join('\n');
}

// ------------- actions -------------
function bindRecentRowActions(){
  const tbody = $('recentTbody');
  if (!tbody) return;

  let tapTimer = null;
  let lastTapAt = 0;
  let lastTapRowKey = '';
  const DOUBLE_TAP_MS = 320;
  const SINGLE_DELAY  = 240;

  function getRowSummaryByIndex(i){
    const recent = getSortedHistory().slice(0, 4);
    return recent[i] || null;
  }

  async function copyRowLink(i){
    const s = getRowSummaryByIndex(i);
    if (!s) return false;
    const u = buildGameUrlFromSummary(s);
    if (!u) return false;

    const ok = await copyText(u.toString());
    const hint = $('historyHint');
    if (hint){
      hint.textContent = ok
        ? 'คัดลอกลิงก์รอบนี้แล้ว ✅ (แตะ 2 ครั้งเพื่อเล่น)'
        : 'คัดลอกไม่สำเร็จ — ลองคัดลอกเองจากแถบที่อยู่';
    }
    if (!ok) console.log(u.toString());
    return ok;
  }

  function playRow(i){
    const s = getRowSummaryByIndex(i);
    if (!s) return;
    const u = buildGameUrlFromSummary(s);
    if (u) location.href = u.toString();
  }

  function rowKeyFromTr(tr){
    const i = Number(tr.dataset.i);
    if (!Number.isFinite(i)) return '';
    const s = getRowSummaryByIndex(i);
    const gameTag = pick(s, ['gameTag','game','tag'], '');
    const ts = pick(s, ['timestampIso','endTimeIso','timeIso'], '');
    return `${i}|${gameTag}|${ts}`;
  }

  // ✅ Single tap = copy (หลังหน่วงเล็กน้อยเพื่อรอดู double) / Double tap = play
  tbody.addEventListener('click', (ev) => {
    const tr = ev.target?.closest?.('tr');
    if (!tr) return;

    const i = Number(tr.dataset.i);
    if (!Number.isFinite(i)) return;

    const now = performance.now();
    const key = rowKeyFromTr(tr);

    if (tapTimer){
      clearTimeout(tapTimer);
      tapTimer = null;
    }

    const isDouble = (key === lastTapRowKey) && ((now - lastTapAt) <= DOUBLE_TAP_MS);

    if (isDouble){
      lastTapAt = 0;
      lastTapRowKey = '';
      playRow(i);
      return;
    }

    lastTapAt = now;
    lastTapRowKey = key;

    tapTimer = setTimeout(() => {
      tapTimer = null;
      copyRowLink(i);
    }, SINGLE_DELAY);
  });

  // ✅ Desktop-friendly: right click = copy ทันที
  tbody.addEventListener('contextmenu', async (ev) => {
    const tr = ev.target?.closest?.('tr');
    if (!tr) return;
    ev.preventDefault();
    const i = Number(tr.dataset.i);
    if (!Number.isFinite(i)) return;

    if (tapTimer){
      clearTimeout(tapTimer);
      tapTimer = null;
    }
    await copyRowLink(i);
  });

  // ✅ ถ้าลาก/สกรอล ให้ยกเลิก single-tap ที่กำลังรอ
  tbody.addEventListener('pointermove', () => {
    if (tapTimer){
      clearTimeout(tapTimer);
      tapTimer = null;
    }
  }, { passive:true });
}

function bindButtons(){
  // game select
  for (const el of Array.from(document.querySelectorAll('.gameBtn'))){
    el.addEventListener('click', () => setSelectedGame(el.dataset.game));
  }

  $('btnApplyPreset')?.addEventListener('click', applyPreset);

  $('btnCopyLink')?.addEventListener('click', async () => {
    const selRun = $('selRun')?.value || 'play';
    const selDiff= $('selDiff')?.value || 'normal';
    const timeSec= Number($('inpTime')?.value || 70);
    const seedRaw= String($('inpSeed')?.value || '').trim();

    const u = buildGameUrl(selectedGame, {
      selRun, selDiff,
      timeSec,
      seed: seedRaw ? Number(seedRaw) : ''
    });

    if (!u){
      $('linkHint').textContent = 'สร้างลิงก์ไม่สำเร็จ';
      return;
    }

    const ok = await copyText(u.toString());
    $('linkHint').textContent = ok ? 'คัดลอกลิงก์แล้ว ✅' : 'คัดลอกไม่สำเร็จ (ลองคัดลอกเองจากแถบที่อยู่)';
    if (!ok) console.log(u.toString());
  });

  $('btnReplayLast')?.addEventListener('click', () => {
    const last = readLast();
    if (!last) return;
    const u = buildGameUrlFromSummary(last);
    if (u) location.href = u.toString();
  });

  $('btnCopyLastJson')?.addEventListener('click', async () => {
    const last = readLast();
    if (!last) return;
    await copyText(JSON.stringify(last, null, 2));
  });

  $('btnExportLastCsv')?.addEventListener('click', () => {
    const last = readLast();
    if (!last) return;
    exportCsvForSummaries('last', last);
  });

  $('btnExportRecentCsv')?.addEventListener('click', () => {
    const recent = getSortedHistory().slice(0, 4);
    if (!recent.length) return;
    exportCsvForSummaries('recent4', recent);
  });

  $('btnClearLast')?.addEventListener('click', () => {
    clearLast();
    renderLast();
  });

  $('btnClearHistory')?.addEventListener('click', () => {
    clearHist();
    renderRecent();
  });

  $('selRun')?.addEventListener('change', applyPreset);
  $('selDiff')?.addEventListener('change', applyPreset);

  // launch on game card double click (ไว้เหมือนเดิม)
  for (const el of Array.from(document.querySelectorAll('.gameBtn'))){
    el.addEventListener('dblclick', () => {
      setSelectedGame(el.dataset.game);

      const selRun = $('selRun')?.value || 'play';
      const selDiff= $('selDiff')?.value || 'normal';
      const timeSec= Number($('inpTime')?.value || 70);
      const seedRaw= String($('inpSeed')?.value || '').trim();

      const u = buildGameUrl(selectedGame, {
        selRun, selDiff,
        timeSec,
        seed: seedRaw ? Number(seedRaw) : ''
      });

      if (u) location.href = u.toString();
    });
  }

  // ✅ bind row actions once
  bindRecentRowActions();
}

// ------------- init -------------
(function init(){
  renderNow();
  setInterval(renderNow, 1000);

  setSelectedGame('goodjunk');

  const qp = new URLSearchParams(location.search);
  const pre = qp.get('game');
  if (pre && GAME_MAP[pre]) setSelectedGame(pre);

  const preRun = qp.get('run') || qp.get('runMode');
  const preDiff= qp.get('diff');
  const preTime= qp.get('time') || qp.get('duration');
  const preSeed= qp.get('seed');

  if ($('selRun') && preRun){
    $('selRun').value = (String(preRun).toLowerCase() === 'research') ? 'study' : 'play';
  }
  if ($('selDiff') && preDiff){
    $('selDiff').value = normalizeDiff(preDiff);
  }
  if ($('inpTime') && preTime){
    $('inpTime').value = String(clamp(preTime, 20, 9999));
  }
  if ($('inpSeed') && preSeed){
    $('inpSeed').value = String(Number(preSeed) || preSeed);
  }

  applyPreset();
  bindButtons();
  renderLast();
  renderRecent();
})();