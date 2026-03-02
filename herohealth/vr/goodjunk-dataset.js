// === /herohealth/vr/goodjunk-dataset.js ===
// GoodJunk Dataset Builder — PRODUCTION (JSONL + CSV download)
// v20260302-DATASET
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function nowIso(){ return new Date().toISOString(); }
function safeJson(v, fb='{}'){ try{ return JSON.stringify(v); }catch{ return fb; } }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function downloadText(filename, text, mime='text/plain'){
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1200);
}

function toCsv(rows){
  if(!rows || !rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (x)=>{
    const s = (x===null || x===undefined) ? '' : String(x);
    if(/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const head = cols.map(esc).join(',');
  const body = rows.map(r=> cols.map(c=>esc(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}

export function createGoodJunkDataset(cfg={}){
  const KEY = String(cfg.storageKey || 'HHA_GJ_DATASET_V1');
  const MAX = Number(cfg.maxRows || 6000) || 6000;

  const ds = {
    enabled: true,
    rows: [],
    meta: {
      schema: 'goodjunk-ds-v1',
      createdAt: nowIso(),
      pid: String(cfg.pid||'anon'),
      seed: String(cfg.seed||''),
      diff: String(cfg.diff||'normal'),
      view: String(cfg.view||''),
      run: String(cfg.run||'play'),
      game: 'goodjunk'
    }
  };

  // load existing (optional)
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){
      const j = JSON.parse(raw);
      if(j && Array.isArray(j.rows)) ds.rows = j.rows;
      if(j && j.meta) ds.meta = Object.assign(ds.meta, j.meta);
    }
  }catch(e){}

  function persist(){
    try{
      localStorage.setItem(KEY, JSON.stringify({ meta: ds.meta, rows: ds.rows.slice(-MAX) }));
    }catch(e){}
  }

  function push(row){
    if(!ds.enabled) return;
    ds.rows.push(row);
    if(ds.rows.length > MAX) ds.rows.splice(0, ds.rows.length - MAX);
    persist();
  }

  function clear(){
    ds.rows = [];
    persist();
  }

  // ---- public: record tick row (features + label) ----
  // label: 1 = high risk of error soon, 0 = ok
  function recordTick(snap, label){
    const r = Object.assign({
      ts: Date.now(),
      tsIso: nowIso(),
      pid: ds.meta.pid,
      seed: ds.meta.seed,
      diff: ds.meta.diff,
      view: ds.meta.view,
      run: ds.meta.run,

      // -------- features (numeric) ----------
      timeLeftSec: Number(snap.timeLeftSec||0),
      timeAllSec: Number(snap.timeAllSec||0),
      score: Number(snap.score||0),
      combo: Number(snap.combo||0),
      miss: Number(snap.miss||0),
      hitJunk: Number(snap.hitJunk||0),
      shots: Number(snap.shots||0),
      hits: Number(snap.hits||0),
      accPct: Number(snap.accPct||0),
      medianRtGoodMs: Number(snap.medianRtGoodMs||0),
      feverPct: Number(snap.feverPct||0),
      shield: Number(snap.shield||0),
      bossOn: snap.bossOn ? 1 : 0,
      bossHp: Number(snap.bossHp||0),

      // label
      y_errorSoon: Number(label||0)
    }, {});

    push(r);
  }

  // ---- public: download JSONL + CSV ----
  function downloadDataset(tag='goodjunk'){
    const metaLine = safeJson({ _meta: ds.meta, rows: ds.rows.length });
    const jsonl = [metaLine].concat(ds.rows.map(r=>safeJson(r,'{}'))).join('\n');
    downloadText(`${tag}-dataset.jsonl`, jsonl, 'application/json');

    // CSV (flat)
    downloadText(`${tag}-dataset.csv`, toCsv(ds.rows), 'text/csv');
  }

  return {
    KEY,
    get rows(){ return ds.rows; },
    meta: ds.meta,
    setEnabled: (v)=>{ ds.enabled = !!v; persist(); },
    clear,
    recordTick,
    downloadDataset
  };
}