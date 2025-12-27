// === /herohealth/hub.safe.js ===
// HeroHealth HUB — reads HHA_LAST_SUMMARY + launches games with consistent params
// ✅ standardized param passing: hub=..., run, diff, time, seed + research ctx passthrough
// ✅ show last result, replay last, copy json, clear
// ✅ copy launch link for selected game

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

function readLastSummary(){
  try{
    const raw = localStorage.getItem('HHA_LAST_SUMMARY');
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || typeof obj !== 'object') return null;
    return obj;
  }catch(_){ return null; }
}

function writeLastSummary(obj){
  try{
    if(!obj){ localStorage.removeItem('HHA_LAST_SUMMARY'); return; }
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(obj));
  }catch(_){}
}

function copyText(txt){
  txt = String(txt ?? '');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(txt);
    }
  }catch(_){}
  // fallback
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
    // remove hash but keep origin/path
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

  // hub return
  url.searchParams.set('hub', opts.hub || currentHubUrl());

  // run/diff/time/seed
  if(opts.run)  url.searchParams.set('run', String(opts.run));
  if(opts.diff) url.searchParams.set('diff', String(opts.diff));
  if(opts.time) url.searchParams.set('time', String(opts.time));

  // seed: only include if provided (or forced)
  if(opts.seed !== null && opts.seed !== undefined && String(opts.seed).length){
    url.searchParams.set('seed', String(opts.seed));
  }

  // pass through ctx fields from current hub url (most reliable)
  for(const k of KEEP_CTX_KEYS){
    const v = Q.get(k);
    if(v !== null && v !== undefined && String(v).length){
      url.searchParams.set(k, v);
    }
  }

  // allow overriding ctx (e.g., replay last)
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

  // badges
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

  // json detail
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

  const clearBtn = $('btnClearLast');
  if(clearBtn){
    clearBtn.onclick = ()=>{
      writeLastSummary(null);
      renderLast(null);
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

  // auto update time when diff changes (nice)
  if(selDiff){
    selDiff.addEventListener('change', ()=>{
      // only adjust if user hasn't typed custom time (simple heuristic)
      applyPreset();
    });
  }

  // copy link for selected game
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

  // clicking game tiles launches immediately
  const tiles = Array.from(DOC.querySelectorAll('.gameBtn'));
  tiles.forEach(tile=>{
    tile.addEventListener('dblclick', ()=>{
      // double tap/click = launch
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

  // set time preset initial
  const selDiff = $('selDiff');
  const inpTime = $('inpTime');
  if(selDiff && inpTime && !String(inpTime.value||'').trim()){
    inpTime.value = String(presetTimeByDiff(selDiff.value));
  }

  // render last
  const last = readLastSummary();
  renderLast(last);

  // if launched from a game, optionally highlight it
  try{
    const q = new URL(ROOT.location.href).searchParams;
    const from = q.get('from');
    if(from){
      const btn = DOC.querySelector(`.gameBtn[data-game="${from}"]`);
      if(btn){
        btn.click();
      }
    }
  }catch(_){}
})();