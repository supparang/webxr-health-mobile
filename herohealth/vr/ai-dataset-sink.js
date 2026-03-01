// === /herohealth/vr/ai-dataset-sink.js ===
// Capture hha:tick + hha:game-ended into localStorage CSV (offline-safe)
// FULL v20260301-DATASET-SINK
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function nowIso(){ return new Date().toISOString(); }

function esc(v){
  v = (v==null) ? '' : String(v);
  if(/[",\n]/.test(v)) return `"${v.replace(/"/g,'""')}"`;
  return v;
}

function toCsvRow(obj, cols){
  return cols.map(k=> esc(obj?.[k])).join(',');
}

export function attachGoodJunkDatasetSink(opts){
  opts = opts || {};
  const pid = String(opts.pid || 'anon');
  const key = String(opts.key || `HHA_GJ_DATASET_CSV:${pid}`);
  const maxRows = clamp(opts.maxRows ?? 6000, 500, 20000);

  // columns for tick rows
  const TICK_COLS = [
    'ts','iso','projectTag','gameKey','pid','zone',
    'runMode','diff','view','seed',
    'tLeftSec','plannedSec','playedSec',
    'score','missTotal','missGoodExpired','missJunkHit',
    'shield','fever','combo','comboMax',
    'shots','hits','accPct',
    'medianRtGoodMs'
  ];

  // labels from end summary (for training C) – we’ll keep separate CSV
  const END_COLS = [
    'ts','iso','projectTag','gameKey','pid','zone',
    'runMode','diff','view','seed',
    'durationPlannedSec','durationPlayedSec',
    'scoreFinal','missTotal','accPct','shots','hits',
    'missGoodExpired','missJunkHit',
    'medianRtGoodMs','grade'
  ];

  function getRaw(){ try{ return localStorage.getItem(key) || ''; }catch(e){ return ''; } }
  function setRaw(v){ try{ localStorage.setItem(key, v); }catch(e){} }

  function appendRow(row){
    let raw = getRaw();
    if(!raw){
      raw = TICK_COLS.join(',') + '\n';
    }
    raw += row + '\n';

    // trim old rows if too big
    const lines = raw.split('\n');
    if(lines.length > maxRows + 2){
      const header = lines[0];
      const kept = lines.slice(lines.length - (maxRows+1));
      raw = header + '\n' + kept.join('\n');
    }
    setRaw(raw);
  }

  const keyEnd = key + ':END';
  function getRawEnd(){ try{ return localStorage.getItem(keyEnd) || ''; }catch(e){ return ''; } }
  function setRawEnd(v){ try{ localStorage.setItem(keyEnd, v); }catch(e){} }

  function appendEndRow(row){
    let raw = getRawEnd();
    if(!raw){
      raw = END_COLS.join(',') + '\n';
    }
    raw += row + '\n';
    const lines = raw.split('\n');
    if(lines.length > 800 + 2){
      const header = lines[0];
      const kept = lines.slice(lines.length - 801);
      raw = header + '\n' + kept.join('\n');
    }
    setRawEnd(raw);
  }

  function onTick(ev){
    const d = ev?.detail || {};
    const rowObj = { ...d, iso: nowIso() };
    appendRow(toCsvRow(rowObj, TICK_COLS));
  }

  function onEnd(ev){
    const s = ev?.detail || {};
    const rowObj = {
      ts: Date.now(),
      iso: nowIso(),
      projectTag: s.projectTag,
      gameKey: s.gameKey,
      pid: s.pid,
      zone: s.zone,
      runMode: s.runMode,
      diff: s.diff,
      view: s.device || s.view,
      seed: s.seed,
      durationPlannedSec: s.durationPlannedSec,
      durationPlayedSec: s.durationPlayedSec,
      scoreFinal: s.scoreFinal,
      missTotal: s.missTotal,
      accPct: s.accPct,
      shots: s.shots,
      hits: s.hits,
      missGoodExpired: s.missGoodExpired,
      missJunkHit: s.missJunkHit,
      medianRtGoodMs: s.medianRtGoodMs,
      grade: s.grade
    };
    appendEndRow(toCsvRow(rowObj, END_COLS));
  }

  WIN.addEventListener('hha:tick', onTick);
  WIN.addEventListener('hha:game-ended', onEnd);

  return {
    key, keyEnd,
    detach(){
      try{ WIN.removeEventListener('hha:tick', onTick); }catch(e){}
      try{ WIN.removeEventListener('hha:game-ended', onEnd); }catch(e){}
    }
  };
}
