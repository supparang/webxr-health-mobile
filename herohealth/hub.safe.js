// === /herohealth/hub.safe.js ===
// HeroHealth HUB (PRODUCTION ++ HISTORY + CSV)
// ✅ อ่าน localStorage: HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ ตาราง 4 เกมล่าสุด
// ✅ Export CSV (last / recent4)
// ✅ Launch 4 games พร้อมพารามิเตอร์กลับไป-กลับมา (hub=..., run, diff, time, seed, + research ctx)
// ✅ UX: แตะ 1 ครั้ง = Copy, แตะ 2 ครั้ง = Play (ทั้งปุ่มเกมและแถว history)
// ✅ เพิ่ม Action ใน history: Play + Copy JSON

'use strict';

const STORAGE_LAST = 'HHA_LAST_SUMMARY';
const STORAGE_HIST = 'HHA_SUMMARY_HISTORY';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function clamp(n, a, b){
  n = Number(n);
  if (!Number.isFinite(n)) n = a;
  return Math.max(a, Math.min(b, n));
}

function safeJsonParse(s, fallback){
  try{
    if (typeof s !== 'string' || !s.trim()) return fallback;
    return JSON.parse(s);
  }catch(e){
    return fallback;
  }
}

function prettyIso(ts){
  try{
    const d = (typeof ts === 'number') ? new Date(ts) : new Date(String(ts));
    if (Number.isNaN(d.getTime())) return '—';
    // th-TH เพื่ออ่านง่ายในไทย
    return d.toLocaleString('th-TH', { hour12:false });
  }catch(e){
    return '—';
  }
}

function nowClock(){
  try{
    return new Date().toLocaleString('th-TH', { hour12:false });
  }catch(e){
    return String(Date.now());
  }
}

function ensureToast(){
  let t = $('#hhaToast');
  if (t) return t;
  t = document.createElement('div');
  t.id = 'hhaToast';
  t.style.cssText =
    'position:fixed;left:50%;bottom:22px;transform:translate(-50%, 16px);' +
    'padding:10px 14px;border-radius:999px;' +
    'background:rgba(2,6,23,.88);border:1px solid rgba(148,163,184,.22);' +
    'color:#e5e7eb;font:900 13px/1.2 system-ui;z-index:9999;' +
    'opacity:0;pointer-events:none;' +
    'transition:opacity .14s ease, transform .14s ease;';
  document.body.appendChild(t);
  return t;
}
let toastTimer = 0;
function toast(msg){
  const t = ensureToast();
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translate(-50%, 0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{
    t.style.opacity = '0';
    t.style.transform = 'translate(-50%, 16px)';
  }, 900);
}

function copyText(text){
  if (!text) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text).then(()=>true).catch(()=>false);
  }
  return new Promise((resolve)=>{
    try{
      const ta = document.createElement('textarea');
      ta.value = String(text);
      ta.setAttribute('readonly','readonly');
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand('copy'); }catch(e){}
      ta.remove();
      resolve(true);
    }catch(e2){
      resolve(false);
    }
  });
}

function absUrl(u){
  try{ return new URL(String(u||''), location.href).toString(); }
  catch(e){ return String(u||''); }
}

function pick(obj, keys, fallback='—'){
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys){
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  return fallback;
}

function normalizeRun(run){
  run = String(run||'').toLowerCase();
  if (run === 'study' || run === 'research') return 'research';
  return 'play';
}

function normalizeDiff(diff){
  diff = String(diff||'normal').toLowerCase();
  if (diff !== 'easy' && diff !== 'normal' && diff !== 'hard') diff = 'normal';
  return diff;
}

function defaultSeedFor(run){
  // Research deterministic เสมอ -> ถ้าไม่ใส่ seed ใช้ค่า default
  return (run === 'research') ? 1 : null;
}

function gradeBucket(grade){
  const g = String(grade||'').toUpperCase().trim();
  const good = new Set(['SSS','SS','S','A']);
  const warn = new Set(['B']);
  const bad  = new Set(['C','D','F']);
  if (good.has(g)) return 'good';
  if (warn.has(g)) return 'warn';
  if (bad.has(g))  return 'bad';
  return 'warn';
}

function pulse(el, bucket){
  if (!el) return;
  const cls = bucket === 'good' ? 'pulseGood' : bucket === 'bad' ? 'pulseBad' : 'pulseWarn';
  el.classList.remove('pulseGood','pulseWarn','pulseBad');
  // force reflow เพื่อเล่น animation ซ้ำได้
  void el.offsetWidth;
  el.classList.add(cls);
}

function downloadText(filename, text){
  try{
    const blob = new Blob([text], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }catch(e){
    // fallback: copy
    copyText(text).then(ok=>{
      toast(ok ? '📋 CSV คัดลอกแล้ว' : '❌ Export ไม่สำเร็จ');
    });
  }
}

function toCsv(rows){
  // rows: array of objects (flat)
  const allKeys = new Set();
  rows.forEach(r=>{
    if (r && typeof r === 'object'){
      Object.keys(r).forEach(k=>allKeys.add(k));
    }
  });

  // Prefer “core” columns first if exist
  const core = [
    'timestampIso','startTimeIso','endTimeIso',
    'projectTag','game','gameTag',
    'runMode','run','mode',
    'diff','durationPlannedSec','durationPlayedSec',
    'scoreFinal','score','comboMax','misses',
    'goalsCleared','goalsTotal','miniCleared','miniTotal',
    'accuracyGoodPct','junkErrorPct','avgRtGoodMs','medianRtGoodMs',
    'device','gameVersion','sessionId','reason',
    'seed','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode',
    'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName','gender','age','gradeLevel'
  ];
  const keys = [];
  core.forEach(k=>{ if (allKeys.has(k) && !keys.includes(k)) keys.push(k); });
  Array.from(allKeys).sort().forEach(k=>{ if (!keys.includes(k)) keys.push(k); });

  const esc = (v)=>{
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };

  const header = keys.map(esc).join(',');
  const lines = rows.map(r=>{
    return keys.map(k=>esc(r && typeof r === 'object' ? r[k] : '')).join(',');
  });
  return [header].concat(lines).join('\n');
}

// ---------- URL builder ----------
const GAME_PAGES = {
  goodjunk: './goodjunk-vr.html',
  hydration:'./hydration-vr.html',
  plate:    './plate/plate-vr.html',
  groups:   './vr-groups/groups-vr.html'
};

function buildLaunchUrl(gameTag, opts){
  const tag = String(gameTag||'').toLowerCase();
  const page = GAME_PAGES[tag] || GAME_PAGES.plate;

  const run = normalizeRun(opts.run);
  const diff = normalizeDiff(opts.diff);

  let time = Number(opts.time);
  if (!Number.isFinite(time)) time = 70;
  time = clamp(time, 20, 9999);

  let seed = (opts.seed !== undefined && opts.seed !== null && String(opts.seed).trim() !== '')
    ? Number(opts.seed)
    : defaultSeedFor(run);

  if (seed !== null && !Number.isFinite(seed)) seed = defaultSeedFor(run);

  const u = new URL(page, location.href);

  // core params
  u.searchParams.set('diff', diff);
  u.searchParams.set('time', String(time));

  // run naming compatibility: ใส่ทั้ง run และ runMode ให้เกมรับได้หมด
  u.searchParams.set('run', run === 'research' ? 'research' : 'play');
  u.searchParams.set('runMode', run === 'research' ? 'research' : 'play');

  // seed
  if (seed !== null && seed !== undefined){
    u.searchParams.set('seed', String(Math.trunc(seed)));
  }

  // hub return (ใช้ absolute ชัวร์สุด)
  const hubUrl = new URL('./hub.html', location.href).toString();
  u.searchParams.set('hub', hubUrl);

  // cache-bust / version (ให้สอดคล้องกับ pattern เดิมของคุณ)
  u.searchParams.set('v', String(Date.now()));

  return u.toString();
}

// ---------- Tap: 1 = copy, 2 = play ----------
function bindTapCopyPlay(el, getUrl, onPlay){
  const DOUBLE_TAP_MS = 280;
  let lastAt = 0;
  let singleTimer = 0;

  const handle = (e)=>{
    try{ e.preventDefault(); }catch(_){}
    const now = Date.now();
    const dt = now - lastAt;

    if (dt > 0 && dt < DOUBLE_TAP_MS){
      lastAt = 0;
      clearTimeout(singleTimer);
      singleTimer = 0;
      const url = getUrl();
      if (url){
        toast('▶ Play!');
        onPlay(url);
      }
      return;
    }

    lastAt = now;
    clearTimeout(singleTimer);
    singleTimer = setTimeout(async ()=>{
      lastAt = 0;
      const url = getUrl();
      if (!url) return;
      const ok = await copyText(url);
      toast(ok ? '📋 Copied!' : '❌ Copy ไม่สำเร็จ');
    }, DOUBLE_TAP_MS);
  };

  el.addEventListener('pointerup', handle, { passive:false });

  // keyboard accessibility
  el.addEventListener('keydown', async (e)=>{
    const k = e.key || '';
    if (k === 'Enter'){
      try{ e.preventDefault(); }catch(_){}
      const url = getUrl();
      if (url){
        toast('▶ Play!');
        onPlay(url);
      }
    } else if (k === ' ' || k === 'Spacebar'){
      try{ e.preventDefault(); }catch(_){}
      const url = getUrl();
      if (!url) return;
      const ok = await copyText(url);
      toast(ok ? '📋 Copied!' : '❌ Copy ไม่สำเร็จ');
    }
  });
}

// ---------- HUB state ----------
let selectedGame = 'plate';
let lastSummary = null;
let hist = [];

function readStorage(){
  lastSummary = safeJsonParse(localStorage.getItem(STORAGE_LAST), null);
  hist = safeJsonParse(localStorage.getItem(STORAGE_HIST), []);
  if (!Array.isArray(hist)) hist = [];
}

function writeStorage(){
  try{
    if (lastSummary) localStorage.setItem(STORAGE_LAST, JSON.stringify(lastSummary));
    else localStorage.removeItem(STORAGE_LAST);
  }catch(e){}

  try{
    if (Array.isArray(hist) && hist.length) localStorage.setItem(STORAGE_HIST, JSON.stringify(hist));
    else localStorage.removeItem(STORAGE_HIST);
  }catch(e){}
}

// ---------- UI helpers ----------
function setText(id, v){
  const el = $('#' + id);
  if (!el) return;
  el.textContent = (v === null || v === undefined) ? '—' : String(v);
}

function setBadge(el, text, bucket){
  if (!el) return;
  el.textContent = String(text || '—');
  el.classList.remove('good','warn','bad');
  if (bucket) el.classList.add(bucket);
}

function normalizeGameTagFromSummary(s){
  const g = pick(s, ['gameTag','game','projectTag','tag'], '');
  const gg = String(g||'').toLowerCase();
  if (gg.includes('goodjunk')) return 'goodjunk';
  if (gg.includes('hydration')) return 'hydration';
  if (gg.includes('plate')) return 'plate';
  if (gg.includes('groups')) return 'groups';
  // fallback by pathname maybe
  return 'plate';
}

function computeGradeFromSummary(s){
  const g = pick(s, ['grade','finalGrade','uiGrade','rank'], '');
  if (g && g !== '—') return String(g).toUpperCase();
  // fallback: score/accuracy guess
  const acc = Number(pick(s, ['accuracyGoodPct','accPct','accuracy'], 'NaN'));
  if (Number.isFinite(acc)){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }
  return 'C';
}

function fillLastPanel(){
  const emptyEl = $('#lastEmpty');
  const panelEl = $('#lastPanel');

  if (!lastSummary){
    if (emptyEl) emptyEl.style.display = '';
    if (panelEl) panelEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (panelEl) panelEl.style.display = '';

  const gameTag = normalizeGameTagFromSummary(lastSummary);
  const grade = computeGradeFromSummary(lastSummary);
  const bucket = gradeBucket(grade);

  // badges
  setBadge($('#badgeGame'), `🎮 ${gameTag}`, null);
  setBadge($('#badgeGrade'), `🏅 ${grade}`, bucket);

  // session/time
  const sid = pick(lastSummary, ['sessionId','session','id'], '—');
  setText('lastSession', sid);

  // stats
  setText('lastScore', pick(lastSummary, ['scoreFinal','score'], 0));
  setText('lastCombo', pick(lastSummary, ['comboMax','maxCombo'], 0));
  setText('lastMiss',  pick(lastSummary, ['misses','miss','missCount'], 0));

  const gCleared = Number(pick(lastSummary, ['goalsCleared'], 0)) || 0;
  const gTotal   = Number(pick(lastSummary, ['goalsTotal'], 0)) || 0;
  const mCleared = Number(pick(lastSummary, ['miniCleared'], 0)) || 0;
  const mTotal   = Number(pick(lastSummary, ['miniTotal'], 0)) || 0;

  setText('lastGoals', `${gCleared}/${gTotal}`);
  setText('lastMinis', `${mCleared}/${mTotal}`);

  const dur = pick(lastSummary, ['durationPlayedSec','durPlayedSec','playedSec'], 0);
  setText('lastDur', `${dur}s`);

  // mode/diff/seed
  const run = normalizeRun(pick(lastSummary, ['runMode','run','mode'], 'play'));
  const diff = normalizeDiff(pick(lastSummary, ['diff'], 'normal'));
  const seed = pick(lastSummary, ['seed'], '—');

  setText('lastMode', run);
  setText('lastDiff', diff);
  setText('lastSeed', seed);

  // json detail
  const pre = $('#lastJson');
  if (pre) pre.textContent = JSON.stringify(lastSummary, null, 2);

  // buttons
  const replayBtn = $('#btnReplayLast');
  if (replayBtn){
    replayBtn.onclick = ()=>{
      const url = buildLaunchUrl(gameTag, {
        run,
        diff,
        time: pick(lastSummary, ['durationPlannedSec','time','timeSec'], $('#inpTime')?.value ?? 70),
        seed: (seed === '—') ? '' : seed
      });
      toast('▶ Play!');
      location.href = url;
    };
  }

  const copyJsonBtn = $('#btnCopyLastJson');
  if (copyJsonBtn){
    copyJsonBtn.onclick = async ()=>{
      const ok = await copyText(JSON.stringify(lastSummary));
      toast(ok ? '📋 Copied JSON!' : '❌ Copy ไม่สำเร็จ');
    };
  }

  const exportLastBtn = $('#btnExportLastCsv');
  if (exportLastBtn){
    exportLastBtn.onclick = ()=>{
      const row = Object.assign({}, lastSummary, {
        gameTag,
        grade
      });
      const csv = toCsv([row]);
      downloadText(`HHA_last_${gameTag}_${Date.now()}.csv`, csv);
      toast('⬇️ Export CSV');
    };
  }

  const clearLastBtn = $('#btnClearLast');
  if (clearLastBtn){
    clearLastBtn.onclick = ()=>{
      lastSummary = null;
      writeStorage();
      renderAll();
      toast('🧹 ล้างผลล่าสุดแล้ว');
    };
  }

  // also refresh history panels
  fillHistoryPanel();
}

function fillHistoryPanel(){
  const recentEmpty = $('#recentEmpty');
  const recentPanel = $('#recentPanel');
  const tbody = $('#recentTbody');
  const hint = $('#historyHint');

  const arr = Array.isArray(hist) ? hist.slice() : [];
  // show last 4 (ใหม่สุดก่อน)
  const recent = arr.slice().reverse().slice(0, 4);

  if (!recent.length){
    if (recentEmpty) recentEmpty.style.display = '';
    if (recentPanel) recentPanel.style.display = 'none';
    if (hint) hint.textContent = '—';
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="muted">—</td></tr>`;
    return;
  }

  if (recentEmpty) recentEmpty.style.display = 'none';
  if (recentPanel) recentPanel.style.display = '';
  if (hint) hint.textContent = `แสดง ${recent.length} รายการล่าสุด`;

  if (!tbody) return;

  tbody.innerHTML = '';

  recent.forEach((s, idx)=>{
    const gameTag = normalizeGameTagFromSummary(s);
    const run = normalizeRun(pick(s, ['runMode','run','mode'], 'play'));
    const diff = normalizeDiff(pick(s, ['diff'], 'normal'));
    const score = pick(s, ['scoreFinal','score'], 0);
    const grade = computeGradeFromSummary(s);
    const bucket = gradeBucket(grade);

    const misses = pick(s, ['misses','miss'], 0);
    const gCleared = Number(pick(s, ['goalsCleared'], 0)) || 0;
    const gTotal   = Number(pick(s, ['goalsTotal'], 0)) || 0;
    const mCleared = Number(pick(s, ['miniCleared'], 0)) || 0;
    const mTotal   = Number(pick(s, ['miniTotal'], 0)) || 0;

    const ts = pick(s, ['timestampIso','endTimeIso','startTimeIso','timestamp'], '');
    const timeText = ts ? prettyIso(ts) : '—';

    // build url from saved fields (fallback to current UI preset time if missing)
    const time = pick(s, ['durationPlannedSec','time','timeSec'], $('#inpTime')?.value ?? 70);
    const seed = pick(s, ['seed'], '');

    const url = buildLaunchUrl(gameTag, { run, diff, time, seed });

    const tr = document.createElement('tr');
    tr.setAttribute('data-i', String(idx)); // index within recent
    tr.innerHTML = `
      <td>${timeText}</td>
      <td class="tdGame">${gameTag}</td>
      <td>${run}</td>
      <td>${diff}</td>
      <td>${score}</td>
      <td><span class="gradeTag ${bucket}">${grade}</span></td>
      <td>${misses}</td>
      <td>${gCleared}/${gTotal}</td>
      <td>${mCleared}/${mTotal}</td>
      <td>
        <div class="actWrap">
          <span class="actBtn play" data-act="play" title="Play">▶</span>
          <span class="actBtn json" data-act="json" title="Copy JSON">📋</span>
        </div>
      </td>
    `;

    // row: 1 tap copy / 2 tap play (ยกเว้นกดปุ่ม action)
    tr.tabIndex = 0;
    tr.setAttribute('role','button');

    bindTapCopyPlay(
      tr,
      ()=>url,
      (u)=>{ location.href = u; }
    );

    // action buttons
    tr.addEventListener('pointerup', async (e)=>{
      const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      // กัน row handler ทำงานซ้อน
      e.stopPropagation();
      try{ e.preventDefault(); }catch(_){}

      if (act === 'play'){
        toast('▶ Play!');
        location.href = url;
      } else if (act === 'json'){
        const ok = await copyText(JSON.stringify(s));
        toast(ok ? '📋 Copied JSON!' : '❌ Copy ไม่สำเร็จ');
      }
    }, { passive:false });

    // pulse feedback
    tr.addEventListener('pointerdown', ()=>{
      pulse(tr, bucket);
    }, { passive:true });

    tbody.appendChild(tr);
  });

  // export/clear buttons
  const exportRecentBtn = $('#btnExportRecentCsv');
  if (exportRecentBtn){
    exportRecentBtn.onclick = ()=>{
      const rows = recent.map(s=>{
        const gameTag = normalizeGameTagFromSummary(s);
        const grade = computeGradeFromSummary(s);
        return Object.assign({}, s, { gameTag, grade });
      });
      const csv = toCsv(rows);
      downloadText(`HHA_recent4_${Date.now()}.csv`, csv);
      toast('⬇️ Export CSV');
    };
  }

  const clearHistBtn = $('#btnClearHistory');
  if (clearHistBtn){
    clearHistBtn.onclick = ()=>{
      hist = [];
      writeStorage();
      renderAll();
      toast('🧹 ล้าง History แล้ว');
    };
  }
}

// ---------- Launch controls ----------
function updateSelectedGameUI(){
  const btns = $$('.gameBtn');
  btns.forEach(b=>{
    const g = String(b.getAttribute('data-game')||'').toLowerCase();
    const tag = b.querySelector('.rightTag');
    if (g === selectedGame){
      b.style.borderColor = 'rgba(34,197,94,.35)';
      b.style.background = 'rgba(34,197,94,.08)';
      if (tag) tag.textContent = 'SELECTED';
    } else {
      b.style.borderColor = 'rgba(148,163,184,.18)';
      b.style.background = 'rgba(2,6,23,.58)';
      if (tag) tag.textContent = 'PLAY';
    }
  });

  const hint = $('#linkHint');
  if (hint) hint.textContent = `เลือกแล้ว: ${selectedGame}`;
}

function currentOptsFromUI(){
  const runUI = $('#selRun')?.value || 'play';
  const diff = $('#selDiff')?.value || 'normal';
  const time = $('#inpTime')?.value || 70;
  const seed = $('#inpSeed')?.value || '';
  const run = (runUI === 'study') ? 'research' : runUI;
  return { run, diff, time, seed };
}

function wireLaunchButtons(){
  const nowEl = $('#nowText');
  if (nowEl){
    nowEl.textContent = nowClock();
    setInterval(()=>{ nowEl.textContent = nowClock(); }, 1000);
  }

  const presetBtn = $('#btnApplyPreset');
  if (presetBtn){
    presetBtn.onclick = ()=>{
      const diff = normalizeDiff($('#selDiff')?.value || 'normal');
      // preset แบบ “จับง่าย”: easy 60 / normal 70 / hard 90
      const val = diff === 'easy' ? 60 : diff === 'hard' ? 90 : 70;
      const inp = $('#inpTime');
      if (inp) inp.value = String(val);
      toast('⚙️ ตั้งเวลาอัตโนมัติแล้ว');
    };
  }

  // choose game
  $$('.gameBtn').forEach(el=>{
    const g = String(el.getAttribute('data-game')||'').toLowerCase() || 'plate';

    // ทำให้โฟกัสได้
    el.tabIndex = 0;
    el.setAttribute('role','button');

    // tap = select + 1copy/2play (ตามคำสั่ง: ทั้งปุ่มเกมก็ต้อง 1=copy 2=play)
    bindTapCopyPlay(
      el,
      ()=>{
        const opts = currentOptsFromUI();
        return buildLaunchUrl(g, opts);
      },
      (url)=>{ location.href = url; }
    );

    // แค่ pointerdown ให้ “select” เกมนั้นด้วย (ไม่รอ pointerup)
    el.addEventListener('pointerdown', ()=>{
      selectedGame = g;
      updateSelectedGameUI();
      pulse(el, 'good');
    }, { passive:true });

    // keyboard: focus + Enter จะ play (bindTapCopyPlay ทำให้แล้ว) — เพิ่ม select เมื่อ focus
    el.addEventListener('focus', ()=>{
      selectedGame = g;
      updateSelectedGameUI();
    });
  });

  // copy selected link button
  const btnCopyLink = $('#btnCopyLink');
  if (btnCopyLink){
    btnCopyLink.onclick = async ()=>{
      const opts = currentOptsFromUI();
      const url = buildLaunchUrl(selectedGame, opts);
      const ok = await copyText(url);
      toast(ok ? '📋 Copied!' : '❌ Copy ไม่สำเร็จ');
    };
  }
}

// ---------- Render everything ----------
function renderAll(){
  // show/hide last wrapper
  const lastEmpty = $('#lastEmpty');
  const lastPanel = $('#lastPanel');
  const wrapper = $('#lastPanel')?.parentElement; // not used

  if (!lastSummary){
    if ($('#lastPanel')) $('#lastPanel').style.display = 'none';
    if ($('#lastEmpty')) $('#lastEmpty').style.display = '';
  } else {
    if ($('#lastEmpty')) $('#lastEmpty').style.display = 'none';
    if ($('#lastPanel')) $('#lastPanel').style.display = '';
  }

  fillLastPanel();
  // fillLastPanel จะเรียก fillHistoryPanel ต่อให้ด้วย (เพื่อ sync)
  updateSelectedGameUI();
}

// ---------- Boot ----------
function boot(){
  readStorage();
  wireLaunchButtons();

  // ถ้าไม่มี selection เลือกจาก lastSummary ได้
  if (lastSummary){
    selectedGame = normalizeGameTagFromSummary(lastSummary);
  }

  // เปิดส่วน lastPanel wrapper ตามมี/ไม่มี
  const lastEmpty = $('#lastEmpty');
  const lastPanel = $('#lastPanel');
  if (!lastSummary){
    if (lastEmpty) lastEmpty.style.display = '';
    if (lastPanel) lastPanel.style.display = 'none';
  } else {
    if (lastEmpty) lastEmpty.style.display = 'none';
    if (lastPanel) lastPanel.style.display = '';
  }

  // Bind “Clear last” “Clear history” เผื่อ panel ยังไม่โชว์
  const clearLastBtn = $('#btnClearLast');
  if (clearLastBtn){
    clearLastBtn.onclick = ()=>{
      lastSummary = null;
      writeStorage();
      renderAll();
      toast('🧹 ล้างผลล่าสุดแล้ว');
    };
  }
  const clearHistBtn = $('#btnClearHistory');
  if (clearHistBtn){
    clearHistBtn.onclick = ()=>{
      hist = [];
      writeStorage();
      renderAll();
      toast('🧹 ล้าง History แล้ว');
    };
  }

  renderAll();
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}