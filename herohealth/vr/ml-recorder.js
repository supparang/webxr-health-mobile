// === /herohealth/vr/ml-recorder.js ===
// ML Recorder + Online Labeler (hazardRisk_1s + miss_3s)
// Enable: ?mlrec=1
// Output: JSONL with {ts,type:'frame',meta,x,y}
// FULL v20260301-MLREC-LABELS-BOTH
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function nowIso(){ return new Date().toISOString(); }
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function dlText(filename, text){
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = DOC.createElement('a');
  a.href = url;
  a.download = filename;
  DOC.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 1500);
}
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function attachMLRecorderUI(meta){
  meta = meta || {};
  const gameKey = String(meta.gameKey||'unknown');
  const pid = String(meta.pid||'anon');
  const seed = String(meta.seed||'0');

  const KEY = `HHA_MLREC:${gameKey}:${pid}:${seed}`;

  let rows = [];
  try{
    const raw = localStorage.getItem(KEY);
    if(raw) rows = JSON.parse(raw) || [];
  }catch(e){ rows = []; }

  function persist(){
    try{ localStorage.setItem(KEY, JSON.stringify(rows)); }catch(e){}
  }

  // --- mini UI ---
  const ui = DOC.createElement('div');
  ui.style.position='fixed';
  ui.style.left=`calc(env(safe-area-inset-left,0px) + 10px)`;
  ui.style.bottom=`calc(env(safe-area-inset-bottom,0px) + 10px)`;
  ui.style.zIndex='999';
  ui.style.display='flex';
  ui.style.gap='8px';
  ui.style.alignItems='center';
  ui.style.padding='8px 10px';
  ui.style.border='1px solid rgba(148,163,184,.16)';
  ui.style.borderRadius='14px';
  ui.style.background='rgba(2,6,23,.60)';
  ui.style.backdropFilter='blur(10px)';
  ui.style.webkitBackdropFilter='blur(10px)';
  ui.style.color='rgba(229,231,235,.96)';
  ui.style.font='900 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial';
  ui.innerHTML = `
    <span style="opacity:.85">MLREC</span>
    <span id="mlrecN" style="opacity:.95">0</span>
    <button id="mlrecDL" style="all:unset;cursor:pointer;padding:6px 10px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35)">Download</button>
    <button id="mlrecCLR" style="all:unset;cursor:pointer;padding:6px 10px;border-radius:12px;border:1px solid rgba(239,68,68,.22);background:rgba(239,68,68,.10)">Clear</button>
  `;
  DOC.body.appendChild(ui);

  const elN = ui.querySelector('#mlrecN');
  const btnDL = ui.querySelector('#mlrecDL');
  const btnCLR = ui.querySelector('#mlrecCLR');

  function updateN(){ if(elN) elN.textContent = String(rows.length); }
  updateN();

  btnDL?.addEventListener('click', ()=>{
    const name = `mlrec_${gameKey}_${pid}_${seed}.jsonl`;
    const text = rows.map(r=>JSON.stringify(r)).join('\n') + '\n';
    dlText(name, text);
  });

  btnCLR?.addEventListener('click', ()=>{
    rows = [];
    persist();
    updateN();
  });

  // --- online labeling queue ---
  // Each frame becomes labeled later when we observe miss changes in future windows.
  const pending = []; // {tMs, frame, missAtFrame}
  const MAX_PENDING = 3000; // safety

  let last = null;
  let lastPushMs = 0;

  function makeFrame(detail){
    const d = detail || {};
    const miss = Number(d.miss||0);
    const score = Number(d.score||0);
    const shots = Number(d.shots||0);
    const hits  = Number(d.hits||0);
    const combo = Number(d.combo||0);

    const prev = last;

    const dMiss  = prev ? (miss  - Number(prev.miss||0))  : 0;
    const dScore = prev ? (score - Number(prev.score||0)) : 0;
    const dShots = prev ? (shots - Number(prev.shots||0)) : 0;
    const dHits  = prev ? (hits  - Number(prev.hits||0))  : 0;
    const dCombo = prev ? (combo - Number(prev.combo||0)) : 0;

    const accRecent = (dShots>0) ? clamp(dHits/dShots, 0, 1) : null;

    const frame = {
      ts: nowIso(),
      type: 'frame',
      meta,
      x: {
        score,
        miss,
        accPct: Number(d.accPct||0),
        shots, hits,
        combo,
        comboMax: Number(d.comboMax||0),
        feverPct: Number(d.feverPct||0),
        shield: Number(d.shield||0),
        missGoodExpired: Number(d.missGoodExpired||0),
        missJunkHit: Number(d.missJunkHit||0),
        medianRtGoodMs: Number(d.medianRtGoodMs||0),

        // derived
        dMiss, dScore, dShots, dHits, dCombo,
        accRecent
      },
      y: {
        hazardRisk_1s: null,
        miss_3s: null
      }
    };

    last = { miss, score, shots, hits, combo };
    return { frame, miss };
  }

  function flushLabeled(){
    // Move any labeled frames into rows, keep unlabeled in pending
    // (We label in-place and only push when both labels resolved or timeout)
    const keep = [];
    for(const it of pending){
      const y = it.frame.y || {};
      const ready = (y.hazardRisk_1s !== null) && (y.miss_3s !== null);
      if(ready){
        rows.push(it.frame);
      }else{
        keep.push(it);
      }
    }
    pending.length = 0;
    pending.push(...keep);

    if(rows.length > 200000) rows.splice(0, rows.length-200000);
    persist();
    updateN();
  }

  function labelByFutureMiss(){
    // For each pending item, check if miss increased within windows from its timestamp
    const tNow = nowMs();

    // We'll need current miss to decide future increase, so we keep snapshots of miss over time.
    // But simpler: we label when we detect miss change events (dMiss>0) and propagate backwards to items within window.
  }

  // We'll implement miss-event propagation:
  // When miss increases at time t, then:
  // - For items with (t - tItem) <= 1000ms => hazardRisk_1s = 1
  // - For items with (t - tItem) <= 3000ms => miss_3s = 1
  // Items not receiving any miss by deadlines => label 0 when window passes.
  function propagateMissEvent(tMissMs){
    for(const it of pending){
      const dt = tMissMs - it.tMs;
      if(dt >= 0 && dt <= 1000){
        if(it.frame.y.hazardRisk_1s === null) it.frame.y.hazardRisk_1s = 1;
      }
      if(dt >= 0 && dt <= 3000){
        if(it.frame.y.miss_3s === null) it.frame.y.miss_3s = 1;
      }
    }
  }

  function finalizeZeros(){
    // When window has passed and still null => 0
    const t = nowMs();
    for(const it of pending){
      const age = t - it.tMs;
      if(it.frame.y.hazardRisk_1s === null && age >= 1000) it.frame.y.hazardRisk_1s = 0;
      if(it.frame.y.miss_3s === null && age >= 3000) it.frame.y.miss_3s = 0;
    }
  }

  function onScore(ev){
    const detail = ev?.detail || null;
    if(!detail) return;

    // throttle ~5Hz max
    const t = nowMs();
    if(t - lastPushMs < 200) return;
    lastPushMs = t;

    const { frame } = makeFrame(detail);

    // push to pending
    pending.push({ tMs: t, frame });
    if(pending.length > MAX_PENDING){
      pending.splice(0, pending.length - MAX_PENDING);
    }

    // detect miss change this tick (from dMiss)
    const dMiss = Number(frame.x.dMiss||0);
    if(dMiss > 0){
      propagateMissEvent(t);
    }

    // finalize windows
    finalizeZeros();
    flushLabeled();
  }

  function onEnd(ev){
    const summary = ev?.detail || null;

    // force finalize remaining
    finalizeZeros();
    // any remaining null after end => set 0
    for(const it of pending){
      if(it.frame.y.hazardRisk_1s === null) it.frame.y.hazardRisk_1s = 0;
      if(it.frame.y.miss_3s === null) it.frame.y.miss_3s = 0;
      rows.push(it.frame);
    }
    pending.length = 0;

    rows.push({ ts: nowIso(), type:'end', meta, y: summary || null });
    persist();
    updateN();
  }

  WIN.addEventListener('hha:score', onScore);
  WIN.addEventListener('hha:game-ended', onEnd);
}
