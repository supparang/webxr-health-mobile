// === /herohealth/hub.safe.js ===
// HeroHealth HUB — reads HHA_LAST_SUMMARY + HISTORY + CSV export
// ✅ History localStorage: HHA_SUMMARY_HISTORY (append unique by game+sessionId, cap)
// ✅ Table recent 4
// ✅ Export CSV: last / recent4
// ✅ Launch 4 games with consistent params

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function $(id){ return DOC ? DOC.getElementById(id) : null; }
function setTxt(el, t){ if(el) el.textContent = String(t ?? ''); }
function clamp(v,a,b){ v = Number(v); if(!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b,v)); }

function nowLocalText(){
  try{
    const d = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }catch(_){ return '—'; }
}

// ---------- storage keys ----------
const KEY_LAST = 'HHA_LAST_SUMMARY';
const KEY_HIST = 'HHA_SUMMARY_HISTORY';

// ---------- helpers ----------
function safeJSONParse(raw){
  try{ return JSON.parse(raw); }catch(_){ return null; }
}
function readLastSummary(){
  try{
    const raw = localStorage.getItem(KEY_LAST);
    if(!raw) return null;
    const obj = safeJSONParse(raw);
    return (obj && typeof obj === 'object') ? obj : null;
  }catch(_){ return null; }
}
function writeLastSummary(obj){
  try{
    if(!obj){ localStorage.removeItem(KEY_LAST); return; }
    localStorage.setItem(KEY_LAST, JSON.stringify(obj));
  }catch(_){}
}
function readHistory(){
  try{
    const raw = localStorage.getItem(KEY_HIST);
    if(!raw) return [];
    const arr = safeJSONParse(raw);
    return Array.isArray(arr) ? arr.filter(x=>x && typeof x === 'object') : [];
  }catch(_){ return []; }
}
function writeHistory(arr){
  try{
    localStorage.setItem(KEY_HIST, JSON.stringify(Array.isArray(arr)?arr:[]));
  }catch(_){}
}
function pushHistoryUnique(summary, cap=50){
  if(!summary || typeof summary !== 'object') return;
  const gameKey = normalizeGameKey(summary.game);
  const sid = String(summary.sessionId || '');
  if(!sid) return;

  const sig = `${gameKey}::${sid}`;
  const hist = readHistory();

  // remove any existing same signature
  const next = hist.filter(x=>{
    const g = normalizeGameKey(x.game);
    const s = String(x.sessionId || '');
    return `${g}::${s}` !== sig;
  });

  // stamp time (prefer endTimeIso/startTimeIso; fallback now)
  const stamped = { ...summary };
  if(!stamped._hubSavedAt){
    stamped._hubSavedAt = new Date().toISOString();
  }

  next.unshift(stamped); // most recent first
  if(next.length > cap) next.length = cap;
  writeHistory(next);
}

function copyText(txt){
  txt = String(txt ?? '');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(txt);
    }
  }catch(_){}
  try{
    const ta = DOC.createElement('textarea');
    ta.value = txt;
    DOC.body.appendChild(ta);
    ta.select();
    DOC.execCommand('copy');
    ta.remove();
  }catch(_){}
  return Promise.resolve();
}

function badgeClassForGrade(g){
  g = String(g||'').toUpperCase();
  if(g === 'SSS' || g === 'SS' || g === 'S') return 'good';
  if(g === 'A' || g === 'B') return 'warn';
  return 'bad';
}

function normalizeGameKey(gameName){
  const g = String(gameName||'').toLowerCase();
  if(g.includes('goodjunk')) return 'goodjunk';
  if(g.includes('hydration')) return 'hydration';
  if(g.includes('plate')) return 'plate';
  if(g.includes('groups')) return 'groups';
  return g || 'unknown';
}

function niceGameName(key){
  key = normalizeGameKey(key);
  if(key==='goodjunk') return 'GoodJunk';
  if(key==='hydration') return 'Hydration';
  if(key==='plate') return 'Plate';
  if(key==='groups') return 'Groups';
  return key;
}

function niceMode(m){
  m = String(m||'').toLowerCase();
  if(m==='research' || m==='study') return 'Research';
  return 'Play';
}

function pickTimeLabel(summary){
  // prefer endTimeIso/startTimeIso; fallback _hubSavedAt; fallback now
  const iso =
    summary.endTimeIso ||
    summary.startTimeIso ||
    summary._hubSavedAt ||
    '';
  if(!iso) return '—';
  try{
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return iso.slice(0,19).replace('T',' ');
    const pad=(n)=>String(n).padStart(2,'0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }catch(_){
    return String(iso).slice(11,19) || '—';
  }
}

// ---------- CSV export ----------
function flattenSummaryForCsv(s){
  // stable core order first
  const core = [
    'timestampIso','projectTag','runMode','studyId','phase','conditionGroup',
    'sessionOrder','blockLabel','siteCode','schoolYear','semester',
    'sessionId','game','run','mode','diff','timeTotal','seed','grade',
    'durationPlannedSec','durationPlayedSec',
    'scoreFinal','comboMax','misses',
    'goalsCleared','goalsTotal','miniCleared','miniTotal',
    'device','gameVersion','reason',
    'startTimeIso','endTimeIso','_hubSavedAt'
  ];

  // some games pack ctx inside .ctx; flatten it too
  const out = {};
  const ctx = (s && typeof s.ctx === 'object') ? s.ctx : null;

  // include ctx keys explicitly first (same as sheet)
  if(ctx){
    for(const k of Object.keys(ctx)){
      out[`ctx_${k}`] = ctx[k];
    }
  }

  // then include core keys
  for(const k of core){
    if(k in s) out[k] = s[k];
  }

  // include all remaining fields (including nested shallow objects stringified)
  const used = new Set(Object.keys(out).concat(core));
  for(const k of Object.keys(s || {})){
    if(used.has(k)) continue;
    if(k === 'ctx') continue;
    const v = s[k];
    if(v && typeof v === 'object'){
      // small object/array stringify
      try{ out[k] = JSON.stringify(v); }catch(_){ out[k] = String(v); }
    }else{
      out[k] = v;
    }
  }
  return out;
}

function csvEscape(v){
  if(v === null || v === undefined) return '';
  const s = String(v);
  const need = /[",\n\r]/.test(s);
  const cleaned = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const quoted = cleaned.replace(/"/g, '""');
  return need ? `"${quoted}"` : quoted;
}

function toCsv(rows){
  rows = Array.isArray(rows) ? rows : [];
  const keys = [];
  const seen = new Set();

  // union keys in order of first appearance
  for(const r of rows){
    for(const k of Object.keys(r || {})){
      if(seen.has(k)) continue;
      seen.add(k);
      keys.push(k);
    }
  }
  if(keys.length === 0) return 'empty\n';

  const lines = [];
  lines.push(keys.map(csvEscape).join(','));
  for(const r of rows){
    lines.push(keys.map(k => csvEscape((r||{})[k])).join(','));
  }
  return lines.join('\n') + '\n';
}

function downloadText(filename, text, mime='text/csv;charset=utf-8'){
  try{
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{ try{ a.remove(); URL.revokeObjectURL(url); }catch(_){ } }, 200);
  }catch(_){}
}

// ---------- launch URLs ----------
const GAME_URLS = {
  goodjunk: './goodjunk-vr.html',
  hydration:'./hydration-vr.html',
  plate:    './plate-vr.html',
  groups:   './groups-vr.html',
};

const KEEP_CTX_KEYS = [
  'timestampIso','projectTag','runMode','studyId','phase','conditionGroup',
  'sessionOrder','blockLabel','siteCode','schoolYear','semester',
  'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName',
  'gender','age','gradeLevel'
];

function currentHubUrl(){
  try{
    const u = new URL(ROOT.location.href);
    u.hash = '';
    return u.toString();
  }catch(_){
    return './hub.html';
  }
}

function buildLaunchUrl(gameKey, opts={}){
  const base = GAME_URLS[gameKey] || GAME_URLS.plate;
  const url = new URL(base, ROOT.location.href);
  const Q = new URL(ROOT.location.href).searchParams;

  url.searchParams.set('hub', opts.hub || currentHubUrl());

  if(opts.run)  url.searchParams.set('run', String(opts.run));
  if(opts.diff) url.searchParams.set('diff', String(opts.diff));
  if(opts.time) url.searchParams.set('time', String(opts.time));

  if(opts.seed !== null && opts.seed !== undefined && String(opts.seed).length){
    url.searchParams.set('seed', String(opts.seed));
  }

  for(const k of KEEP_CTX_KEYS){
    const v = Q.get(k);
    if(v !== null && v !== undefined && String(v).length){
      url.searchParams.set(k, v);
    }
  }

  if(opts.ctx && typeof opts.ctx === 'object'){
    for(const k of KEEP_CTX_KEYS){
      const v = opts.ctx[k];
      if(v !== null && v !== undefined && String(v).length){
        url.searchParams.set(k, String(v));
      }
    }
  }

  return url.toString();
}

function presetTimeByDiff(diff){
  diff = String(diff||'normal').toLowerCase();
  if(diff === 'easy') return 80;
  if(diff === 'hard') return 60;
  return 70;
}

// ---------- UI ----------
let selectedGame = null;

function bindGameButtons(){
  const btns = Array.from(DOC.querySelectorAll('.gameBtn'));
  btns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      btns.forEach(b=>b.style.outline='none');
      btn.style.outline = '2px solid rgba(34,197,94,.42)';
      selectedGame = btn.dataset.game || null;
      setTxt($('linkHint'), selectedGame ? `เลือก: ${selectedGame}` : 'เลือกเกมด้านบนก่อน');
    });
  });
}

function renderRecent4(history){
  const empty = $('recentEmpty');
  const panel = $('recentPanel');
  const tbody = $('recentTbody');
  const hint = $('historyHint');

  const hist = Array.isArray(history) ? history : [];
  const recent = hist.slice(0,4);

  if(recent.length === 0){
    if(empty) empty.style.display='block';
    if(panel) panel.style.display='none';
    return;
  }

  if(empty) empty.style.display='none';
  if(panel) panel.style.display='block';

  if(hint) setTxt(hint, `เก็บไว้ทั้งหมด ${hist.length} รายการ (แสดง 4 ล่าสุด)`);

  if(tbody){
    tbody.innerHTML = '';
    for(const s of recent){
      const gk = normalizeGameKey(s.game);
      const grade = String(s.grade || 'C').toUpperCase();

      const tr = DOC.createElement('tr');

      const tdTime = DOC.createElement('td');
      tdTime.textContent = pickTimeLabel(s);

      const tdGame = DOC.createElement('td');
      tdGame.className = 'tdGame';
      tdGame.textContent = niceGameName(gk);

      const tdMode = DOC.createElement('td');
      tdMode.textContent = niceMode(s.mode || s.run);

      const tdDiff = DOC.createElement('td');
      tdDiff.textContent = String(s.diff || '—');

      const tdScore = DOC.createElement('td');
      tdScore.textContent = String(s.scoreFinal ?? 0);

      const tdGrade = DOC.createElement('td');
      const tag = DOC.createElement('span');
      tag.className = `gradeTag ${badgeClassForGrade(grade)}`;
      tag.textContent = grade;
      tdGrade.appendChild(tag);

      const tdMiss = DOC.createElement('td');
      tdMiss.textContent = String(s.misses ?? 0);

      const tdGoals = DOC.createElement('td');
      tdGoals.textContent = `${s.goalsCleared ?? 0}/${s.goalsTotal ?? 0}`;

      const tdMinis = DOC.createElement('td');
      tdMinis.textContent = `${s.miniCleared ?? 0}/${s.miniTotal ?? 0}`;

      tr.appendChild(tdTime);
      tr.appendChild(tdGame);
      tr.appendChild(tdMode);
      tr.appendChild(tdDiff);
      tr.appendChild(tdScore);
      tr.appendChild(tdGrade);
      tr.appendChild(tdMiss);
      tr.appendChild(tdGoals);
      tr.appendChild(tdMinis);

      tbody.appendChild(tr);
    }
  }

  // export recent4 csv
  const btnExportRecent = $('btnExportRecentCsv');
  if(btnExportRecent){
    btnExportRecent.onclick = ()=>{
      const rows = recent.map(s => flattenSummaryForCsv(s));
      const csv = toCsv(rows);
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      downloadText(`HHA_recent4_${ts}.csv`, csv);
    };
  }

  // clear history
  const btnClearHist = $('btnClearHistory');
  if(btnClearHist){
    btnClearHist.onclick = ()=>{
      writeHistory([]);
      renderRecent4([]);
      const last = readLastSummary();
      // keep last if exists
      if(last){
        // do nothing
      }
    };
  }
}

function renderLast(summary){
  const empty = $('lastEmpty');
  const panel = $('lastPanel');

  if(!summary){
    if(empty) empty.style.display='block';
    if(panel) panel.style.display='none';
    return;
  }

  if(empty) empty.style.display='none';
  if(panel) panel.style.display='block';

  const gameKey = normalizeGameKey(summary.game);
  const grade = String(summary.grade || 'C').toUpperCase();

  const bg = $('badgeGame');
  if(bg){
    bg.className = 'badge';
    bg.textContent = `🎮 ${summary.game || gameKey}`;
  }

  const bgr = $('badgeGrade');
  if(bgr){
    bgr.className = `badge ${badgeClassForGrade(grade)}`;
    bgr.textContent = `🎖️ ${grade}`;
  }

  setTxt($('lastSession'), summary.sessionId || '—');
  setTxt($('lastScore'), summary.scoreFinal ?? 0);
  setTxt($('lastCombo'), summary.comboMax ?? 0);
  setTxt($('lastMiss'),  summary.misses ?? 0);
  setTxt($('lastGoals'), `${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}`);
  setTxt($('lastMinis'), `${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}`);

  const dur = Number(summary.durationPlayedSec ?? 0);
  setTxt($('lastDur'), `${Math.max(0, Math.round(dur))}s`);

  setTxt($('lastMode'), summary.mode || summary.run || '—');
  setTxt($('lastDiff'), summary.diff || '—');

  const seed = (summary.seed === null || summary.seed === undefined) ? '—' : String(summary.seed);
  setTxt($('lastSeed'), seed);

  try{
    setTxt($('lastJson'), JSON.stringify(summary, null, 2));
  }catch(_){
    setTxt($('lastJson'), String(summary));
  }

  // replay last
  const replayBtn = $('btnReplayLast');
  if(replayBtn){
    replayBtn.onclick = ()=>{
      const run = (summary.run || summary.mode || 'play');
      const diff = summary.diff || 'normal';
      const time = summary.timeTotal || presetTimeByDiff(diff);
      const seedV = (summary.seed === null || summary.seed === undefined) ? null : summary.seed;

      const url = buildLaunchUrl(gameKey, {
        hub: currentHubUrl(),
        run,
        diff,
        time,
        seed: seedV,
        ctx: summary.ctx || {}
      });
      ROOT.location.assign(url);
    };
  }

  const copyJsonBtn = $('btnCopyLastJson');
  if(copyJsonBtn){
    copyJsonBtn.onclick = async ()=>{
      await copyText(JSON.stringify(summary, null, 2));
      copyJsonBtn.textContent = '✅ คัดลอกแล้ว';
      setTimeout(()=>copyJsonBtn.textContent='📋 คัดลอก JSON', 900);
    };
  }

  const exportLastBtn = $('btnExportLastCsv');
  if(exportLastBtn){
    exportLastBtn.onclick = ()=>{
      const row = flattenSummaryForCsv(summary);
      const csv = toCsv([row]);
      const ts = new Date().toISOString().replace(/[:.]/g,'-');
      const g = normalizeGameKey(summary.game);
      downloadText(`HHA_last_${g}_${ts}.csv`, csv);
    };
  }

  const clearBtn = $('btnClearLast');
  if(clearBtn){
    clearBtn.onclick = ()=>{
      writeLastSummary(null);
      renderLast(null);
      // history stays
    };
  }
}

function bindControls(){
  const selRun  = $('selRun');
  const selDiff = $('selDiff');
  const inpTime = $('inpTime');
  const inpSeed = $('inpSeed');

  const applyPreset = ()=>{
    const diff = selDiff ? selDiff.value : 'normal';
    const t = presetTimeByDiff(diff);
    if(inpTime) inpTime.value = String(t);
  };

  const btnPreset = $('btnApplyPreset');
  if(btnPreset) btnPreset.onclick = applyPreset;

  if(selDiff){
    selDiff.addEventListener('change', ()=>{
      applyPreset();
    });
  }

  const btnCopyLink = $('btnCopyLink');
  if(btnCopyLink){
    btnCopyLink.onclick = async ()=>{
      if(!selectedGame){
        setTxt($('linkHint'), 'ยังไม่ได้เลือกเกม');
        return;
      }
      const run  = selRun ? selRun.value : 'play';
      const diff = selDiff ? selDiff.value : 'normal';
      const time = clamp(parseInt(inpTime ? inpTime.value : '70', 10), 20, 9999);
      const seedRaw = inpSeed ? String(inpSeed.value||'').trim() : '';
      const seed = seedRaw.length ? seedRaw : null;

      const url = buildLaunchUrl(selectedGame, {
        hub: currentHubUrl(),
        run,
        diff,
        time,
        seed
      });

      await copyText(url);
      setTxt($('linkHint'), '✅ คัดลอกลิงก์แล้ว');
      setTimeout(()=>setTxt($('linkHint'), `เลือก: ${selectedGame}`), 1200);
    };
  }

  // dblclick = launch quick
  const tiles = Array.from(DOC.querySelectorAll('.gameBtn'));
  tiles.forEach(tile=>{
    tile.addEventListener('dblclick', ()=>{
      const gameKey = tile.dataset.game;
      if(!gameKey) return;

      const run  = selRun ? selRun.value : 'play';
      const diff = selDiff ? selDiff.value : 'normal';
      const time = clamp(parseInt(inpTime ? inpTime.value : String(presetTimeByDiff(diff)), 10), 20, 9999);
      const seedRaw = inpSeed ? String(inpSeed.value||'').trim() : '';
      const seed = seedRaw.length ? seedRaw : null;

      const url = buildLaunchUrl(gameKey, {
        hub: currentHubUrl(),
        run,
        diff,
        time,
        seed
      });
      ROOT.location.assign(url);
    });
  });
}

function bootClock(){
  const el = $('nowText');
  if(!el) return;
  setTxt(el, nowLocalText());
  setInterval(()=>setTxt(el, nowLocalText()), 1000);
}

// ---------- Boot ----------
(function boot(){
  bootClock();
  bindGameButtons();
  bindControls();

  // time preset initial
  const selDiff = $('selDiff');
  const inpTime = $('inpTime');
  if(selDiff && inpTime && !String(inpTime.value||'').trim()){
    inpTime.value = String(presetTimeByDiff(selDiff.value));
  }

  // 1) render last
  const last = readLastSummary();
  renderLast(last);

  // 2) auto-push last -> history (unique) then render recent4
  if(last){
    // stamp game key if absent
    if(!last.game) last.game = normalizeGameKey(last.game);
    pushHistoryUnique(last, 60);
  }
  const hist = readHistory();
  renderRecent4(hist);

  // 3) highlight from=... if any
  try{
    const q = new URL(ROOT.location.href).searchParams;
    const from = q.get('from');
    if(from){
      const btn = DOC.querySelector(`.gameBtn[data-game="${from}"]`);
      if(btn) btn.click();
    }
  }catch(_){}
})();