// === /herohealth/vr-groups/dl-dataset.js ===
// DL Dataset Collector (1Hz) — LOCAL ONLY
// ✅ Enable: run=play AND (?dl=1 OR ?mode=dl)
// ✅ Disable: run=research/practice (hard OFF)
// ✅ Collects features each 1s -> localStorage
// ✅ Labels positives when miss-like events happen (window ~2.5s back)
// ✅ API:
//    - GroupsVR.exportDLDatasetCSV() -> triggers download
//    - GroupsVR.getDLDatasetInfo()
//    - GroupsVR.clearDLDataset()

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});
  const LS_KEY = 'HHA_GROUPS_DL_DATASET_V1';

  function getRunMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    if (r==='research') return 'research';
    if (r==='practice') return 'practice';
    return 'play';
  }
  function enabled(){
    const rm = getRunMode();
    if (rm==='research' || rm==='practice') return false;
    const dl = String(qs('dl','0')||'0').toLowerCase();
    const mode = String(qs('mode','')||'').toLowerCase();
    return (dl==='1'||dl==='true'||mode==='dl');
  }

  // ---------- runtime state aggregator ----------
  const S = {
    startedAtMs: nowMs(),
    tSec: 0,
    leftSec: 0,
    score: 0,
    combo: 0,
    misses: 0,
    accGoodPct: 0,
    grade: 'C',
    powerCharge: 0,
    powerThreshold: 8,
    goalPct: 0,
    goalNow: 0,
    goalTotal: 1,
    groupKey: '',
    runMode: getRunMode(),
    view: String(qs('view','mobile')||'mobile').toLowerCase(),
    // mini
    miniOn: false,
    miniNeed: 0,
    miniNow: 0,
    miniTimeLeftSec: 0,
    miniCountTotal: 0,
    miniCountCleared: 0,
  };

  function bodyHas(c){ try{ return DOC.body && DOC.body.classList.contains(c); }catch{ return false; } }
  function currentPressure(){
    // from classes press-1..3
    if (bodyHas('press-3')) return 3;
    if (bodyHas('press-2')) return 2;
    if (bodyHas('press-1')) return 1;
    return 0;
  }

  WIN.addEventListener('hha:start', (ev)=>{
    const d = ev.detail||{};
    S.startedAtMs = nowMs();
    S.tSec = 0;
    S.runMode = String(d.runMode||getRunMode()).toLowerCase();
    S.view = String(d.view || qs('view','mobile') || 'mobile').toLowerCase();
  }, {passive:true});

  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    S.score = Number(d.score||0);
    S.combo = Number(d.combo||0);
    S.misses= Number(d.misses||0);
  }, {passive:true});

  WIN.addEventListener('hha:time', (ev)=>{
    const d = ev.detail||{};
    S.leftSec = Number(d.left||0);
    S.tSec = Math.max(0, Math.round(((qs('time',90)*1)||90) - S.leftSec));
  }, {passive:true});

  WIN.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail||{};
    S.grade = String(d.grade||'C');
    S.accGoodPct = Number(d.accuracy||0);
  }, {passive:true});

  WIN.addEventListener('groups:power', (ev)=>{
    const d = ev.detail||{};
    S.powerCharge = Number(d.charge||0);
    S.powerThreshold = Math.max(1, Number(d.threshold||8));
  }, {passive:true});

  WIN.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    S.groupKey = String(d.groupKey||'');
    S.goalNow = Number(d.goalNow||0);
    S.goalTotal = Math.max(1, Number(d.goalTotal||1));
    S.goalPct = clamp(Number(d.goalPct ?? (S.goalNow/S.goalTotal*100)), 0, 100);

    // mini
    const on = (String(d.miniTitle||'—') !== '—') && (Number(d.miniTotal||0) > 0);
    S.miniOn = !!on;
    S.miniNeed = Number(d.miniTotal||0);
    S.miniNow  = Number(d.miniNow||0);
    S.miniTimeLeftSec = Number(d.miniTimeLeftSec||0);

    S.miniCountTotal = Number(d.miniCountTotal||0);
    S.miniCountCleared = Number(d.miniCountCleared||0);
  }, {passive:true});

  // ---------- dataset store ----------
  function load(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }catch{ return []; }
  }
  function save(rows){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(rows)); }catch{}
  }

  // ring for delayed labeling
  const ring = []; // {tsMs, rowIndex}
  const POS_WIN_MS = 2500;

  function addRow(row){
    const rows = load();
    rows.push(row);
    // cap
    if (rows.length > 5000) rows.splice(0, rows.length - 5000);
    save(rows);

    const idx = rows.length - 1;
    ring.push({ tsMs: row.tsMs, rowIndex: idx });
    if (ring.length > 80) ring.splice(0, ring.length - 80);
  }

  function markPositive(tsMs, reason){
    const rows = load();
    for (let i=ring.length-1;i>=0;i--){
      const r = ring[i];
      if ((tsMs - r.tsMs) > POS_WIN_MS) break;
      const idx = r.rowIndex;
      if (rows[idx]){
        rows[idx].y = 1;
        rows[idx].yReason = String(reason||'miss');
      }
    }
    save(rows);
  }

  // miss-like triggers
  WIN.addEventListener('groups:progress', (ev)=>{
    if (!enabled()) return;
    const d = ev.detail||{};
    if (String(d.kind||'') === 'miss'){
      markPositive(nowMs(), d.why || 'miss');
    }
  }, {passive:true});

  WIN.addEventListener('hha:judge', (ev)=>{
    if (!enabled()) return;
    const d = ev.detail||{};
    const k = String(d.kind||'');
    if (k==='bad'){
      // wrong / junk => positive
      markPositive(nowMs(), 'bad');
    }
    if (k==='miss'){
      markPositive(nowMs(), 'miss');
    }
  }, {passive:true});

  // ---------- feature vector (32) ----------
  function toX32(){
    const acc = clamp(S.accGoodPct,0,100)/100;
    const misses = clamp(S.misses,0,30)/30;
    const combo = clamp(S.combo,0,20)/20;
    const score = clamp(S.score,0,2500)/2500;

    const pressure = clamp(currentPressure(),0,3)/3;
    const storm = bodyHas('groups-storm') ? 1 : 0;

    const miniOn = S.miniOn ? 1 : 0;
    const miniGap = (miniOn && S.miniNeed>0) ? clamp((S.miniNeed - S.miniNow)/S.miniNeed,0,1) : 0;
    const miniLeft= clamp(S.miniTimeLeftSec||0,0,12)/12;

    // spawn rate not directly in DOM here -> approximate from difficulty
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const spawnMs = (diff==='hard')?560 : (diff==='easy'?780:650);
    const spawnFast = clamp((720 - spawnMs)/720,0,1);

    const timePlan = clamp(qs('time',90), 5, 180);
    const leftSec = clamp(S.leftSec,0,timePlan)/Math.max(1,timePlan);

    const gk = String(S.groupKey||'');
    const keys = ['fruit','veg','protein','grain','dairy'];
    const onehot = keys.map(k=>k===gk?1:0);

    // deltas using last row
    const rows = load();
    const last = rows.length ? rows[rows.length-1] : null;
    let dAcc=0,dMiss=0,dCombo=0,dScore=0;
    if (last){
      dAcc   = clamp(((acc)-(last.f0))/0.30, -1, 1);
      dMiss  = clamp(((misses)-(last.f1))/0.18, -1, 1);
      dCombo = clamp(((combo)-(last.f2))/0.25, -1, 1);
      dScore = clamp(((score)-(last.f3))/0.16, -1, 1);
    }

    const x = new Array(32).fill(0);

    x[0]=acc; x[1]=misses; x[2]=combo; x[3]=score;
    x[4]=pressure; x[5]=storm; x[6]=miniOn; x[7]=miniGap;
    x[8]=miniLeft; x[9]=spawnFast; x[10]=leftSec;

    x[11]= clamp(S.powerCharge/Math.max(1,S.powerThreshold),0,1);
    x[12]= clamp(S.goalPct/100,0,1);
    x[13]= clamp(S.goalNow/Math.max(1,S.goalTotal),0,1);
    x[14]= clamp(S.miniCountCleared/Math.max(1,S.miniCountTotal||1),0,1);

    for(let i=0;i<5;i++) x[15+i]=onehot[i];

    x[20]= dAcc*0.5+0.5;
    x[21]= dMiss*0.5+0.5;
    x[22]= dCombo*0.5+0.5;
    x[23]= dScore*0.5+0.5;

    x[24]= bodyHas('groups-storm-urgent')?1:0;
    x[25]= bodyHas('clutch')?1:0;
    x[26]= (S.view==='cvr')?1:0;
    x[27]= (S.view==='vr')?1:0;
    x[28]= (S.view==='pc')?1:0;
    x[29]= (diff==='hard')?1:0;
    x[30]= (diff==='easy')?1:0;
    x[31]= 1; // bias-helper slot (kept as 1)

    return x;
  }

  // ---------- tick 1Hz ----------
  let timer = 0;
  function tick(){
    if (!enabled()) return;
    const rm = getRunMode();
    if (rm==='research' || rm==='practice') return;

    const x = toX32();
    const row = {
      tsMs: Date.now(),
      tSec: S.tSec|0,
      leftSec: S.leftSec|0,
      view: S.view,
      runMode: rm,
      diff: String(qs('diff','normal')||'normal'),
      groupKey: String(S.groupKey||''),
      y: 0,
      yReason: '',
    };
    // flatten f0..f31
    for(let i=0;i<32;i++) row['f'+i] = Number(x[i]);

    addRow(row);
  }

  function start(){
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }
  if (enabled()) start();

  // ---------- CSV export ----------
  function toCSV(rows){
    if (!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    const esc = (v)=>{
      const s = String(v ?? '');
      if (s.includes('"')||s.includes(',')||s.includes('\n')) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    const head = cols.join(',');
    const lines = rows.map(r=> cols.map(c=>esc(r[c])).join(','));
    return [head].concat(lines).join('\n');
  }

  function downloadText(filename, text){
    try{
      const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 800);
      return true;
    }catch(_){ return false; }
  }

  NS.getDLDatasetInfo = function(){
    const rows = load();
    let pos=0;
    for(const r of rows) if ((r.y|0)===1) pos++;
    return { rows: rows.length, positives: pos, key: LS_KEY };
  };

  NS.exportDLDatasetCSV = function(){
    const rows = load();
    if (!rows.length){ alert('ยังไม่มี DL dataset (เปิดด้วย ?dl=1)'); return false; }
    const csv = toCSV(rows);
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const ok = downloadText(`groups_dl_dataset_${stamp}.csv`, csv);
    if (!ok) alert('ดาวน์โหลดไม่สำเร็จ');
    return ok;
  };

  NS.clearDLDataset = function(){
    try{ localStorage.removeItem(LS_KEY); }catch{}
  };

})();