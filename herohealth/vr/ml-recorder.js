// === /herohealth/vr/ml-recorder.js ===
// Generic ML dataset recorder (JSONL)
// Usage: attachMLRecorderUI({gameKey,pid,seed,run,diff,view})
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function safeName(s){ return String(s||'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80); }

export function attachMLRecorderUI(meta){
  meta = meta || {};
  const enabled = true;
  if(!enabled) return;

  const rows = [];
  const t0 = Date.now();

  const panel = DOC.createElement('div');
  panel.style.position = 'fixed';
  panel.style.left = `calc(env(safe-area-inset-left,0px) + 10px)`;
  panel.style.bottom = `calc(env(safe-area-inset-bottom,0px) + 10px)`;
  panel.style.zIndex = '9999';
  panel.style.background = 'rgba(2,6,23,.72)';
  panel.style.border = '1px solid rgba(148,163,184,.18)';
  panel.style.backdropFilter = 'blur(10px)';
  panel.style.webkitBackdropFilter = 'blur(10px)';
  panel.style.borderRadius = '14px';
  panel.style.padding = '10px 10px';
  panel.style.color = 'rgba(229,231,235,.96)';
  panel.style.font = '900 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial';
  panel.style.boxShadow = '0 18px 55px rgba(0,0,0,.45)';
  panel.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;min-width:240px">
      <div>🧠 ML REC</div>
      <div id="mlCount" style="opacity:.85">0</div>
    </div>
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
      <button id="mlDL" style="border-radius:12px;padding:8px 10px;font-weight:1000;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.65);color:rgba(229,231,235,.96);cursor:pointer">Download JSONL</button>
      <button id="mlCLR" style="border-radius:12px;padding:8px 10px;font-weight:1000;border:1px solid rgba(239,68,68,.22);background:rgba(239,68,68,.10);color:rgba(229,231,235,.96);cursor:pointer">Clear</button>
    </div>
    <div style="margin-top:6px;opacity:.8">?mlrec=1 (ticks+events+end)</div>
  `;
  DOC.body.appendChild(panel);

  const elCount = panel.querySelector('#mlCount');
  const btnDL = panel.querySelector('#mlDL');
  const btnCLR = panel.querySelector('#mlCLR');

  function push(kind, payload){
    const rec = { kind, t: Date.now(), dtFromStart: Date.now()-t0, meta, ...payload };
    rows.push(rec);
    if(elCount) elCount.textContent = String(rows.length);
  }

  function onTick(ev){ push('tick', ev?.detail || {}); }
  function onEvent(ev){ push('event', ev?.detail || {}); }
  function onEnded(ev){ push('ended', ev?.detail || {}); }

  WIN.addEventListener('hha:tick', onTick);
  WIN.addEventListener('hha:event', onEvent);
  WIN.addEventListener('hha:game-ended', onEnded);

  btnCLR?.addEventListener('click', ()=>{
    rows.length = 0;
    if(elCount) elCount.textContent = '0';
  });

  btnDL?.addEventListener('click', ()=>{
    const jsonl = rows.map(r=>JSON.stringify(r)).join('\n') + '\n';
    const blob = new Blob([jsonl], { type:'application/x-ndjson' });
    const a = DOC.createElement('a');
    const name = safeName(`goodjunk_${meta.pid||'anon'}_${meta.seed||'seed'}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jsonl`);
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(()=> URL.revokeObjectURL(a.href), 1200);
  });

  // expose
  WIN.__HHA_MLREC__ = { rows };
}
