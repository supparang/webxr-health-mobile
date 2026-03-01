// === /herohealth/vr/ml-recorder.js ===
// Lightweight dataset recorder (client-side) for ML/DL training
// Enables with ?mlrec=1
// Saves localStorage + download JSONL
// FULL v20260301-MLREC
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function nowIso(){ return new Date().toISOString(); }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

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

  // Mini UI
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

  function updateN(){
    if(elN) elN.textContent = String(rows.length);
  }
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

  // Record from events (score + end)
  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || null;
    if(!d) return;

    const row = {
      ts: nowIso(),
      type: 'score',
      meta,
      x: {
        score: Number(d.score||0),
        miss: Number(d.miss||0),
        accPct: Number(d.accPct||0),
        shots: Number(d.shots||0),
        hits: Number(d.hits||0),
        combo: Number(d.combo||0),
        comboMax: Number(d.comboMax||0),
        feverPct: Number(d.feverPct||0),
        shield: Number(d.shield||0),
        missGoodExpired: Number(d.missGoodExpired||0),
        missJunkHit: Number(d.missJunkHit||0),
        medianRtGoodMs: Number(d.medianRtGoodMs||0)
      }
    };

    // throttle: keep ~5Hz max
    const last = rows.length ? rows[rows.length-1] : null;
    if(last && last.type==='score'){
      // if too frequent (<200ms) skip
      const lastT = Date.parse(last.ts) || 0;
      const nowT = Date.parse(row.ts) || 0;
      if(nowT - lastT < 200) return;
    }

    rows.push(row);
    if(rows.length > 12000) rows.shift(); // hard cap
    persist();
    updateN();
  });

  WIN.addEventListener('hha:game-ended', (ev)=>{
    const s = ev?.detail || null;
    const row = { ts: nowIso(), type:'end', meta, y: s || null };
    rows.push(row);
    if(rows.length > 12000) rows.shift();
    persist();
    updateN();
  });
}
