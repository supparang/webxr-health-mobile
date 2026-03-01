// === /herohealth/vr/goodjunk-model.js ===
// GoodJunk ML Feature Builder — OFFLINE-FIRST (no network)
// Purpose:
//  - Define a stable feature schema for prediction (hazardRisk, next watchout, etc.)
//  - Convert gameplay telemetry (tick/hit/expire) into ML rows
//  - Provide helpers to export dataset as CSV/JSON (for training in Python)
//
// NOTE: This file does NOT do adaptive difficulty. It's prediction/analytics only.
// v20260301-ML-SCHEMA

'use strict';

/**
 * Feature schema (per short window, e.g., 3–5 seconds)
 * You can train different heads:
 *  - hazardRisk: probability of "bad outcome" in the next window (e.g., miss increase)
 *  - next5: list of textual tips ("watchout") derived from simple heuristics or model output
 *
 * Inputs are purely telemetry and are deterministic if seed is fixed.
 */

export const GOODJUNK_FEATURES_V1 = [
  't_sec',                  // time elapsed
  't_left_sec',             // time remaining
  'diff_easy', 'diff_normal','diff_hard',
  'view_mobile','view_pc','view_vr','view_cvr',
  'score',
  'miss_total',
  'miss_good_expired',
  'miss_junk_hit',
  'combo',
  'combo_max',
  'fever_pct',
  'shield',
  'shots',
  'hits',
  'acc_pct',
  'median_rt_good_ms',
  'storm_on',
  'boss_active',
];

/**
 * Simple rolling collector to build dataset windows.
 * You can feed it from GoodJunk hooks:
 * - onTick(dt, state)
 * - onHit(kind, meta)
 * - onExpire(kind, meta)
 */
export function createGoodJunkDatasetCollector(opts){
  opts = opts || {};
  const windowSec = clamp(opts.windowSec ?? 4, 1, 12);
  const stepSec   = clamp(opts.stepSec   ?? 1, 0.25, windowSec);
  const labelMode = String(opts.labelMode || 'hazard_miss_increase'); // default label
  const bufferMax = clamp(opts.bufferMax ?? 8000, 200, 50000);

  let t = 0;
  let nextEmitAt = stepSec;

  // last-known state snapshot (from game loop)
  let last = null;

  // for label generation
  let missAtEmit = null;

  // dataset rows
  const rows = [];

  function onTick(dt, state){
    dt = Number(dt)||0;
    t += dt;
    last = state ? { ...state } : last;

    if(t >= nextEmitAt){
      nextEmitAt += stepSec;

      const row = buildRow(last, t);
      if(!row) return null;

      // label (super simple baseline):
      // hazard=1 if miss_total increases within next windowSec
      // To do that offline, we store "miss_total at emit", and later you can
      // post-process labels using future rows; or set label when next row arrives.
      row.__miss_at_emit = Number(state?.missTotal ?? state?.miss_total ?? 0) || 0;
      row.__t_emit = t;

      rows.push(row);
      if(rows.length > bufferMax) rows.shift();
      return row;
    }
    return null;
  }

  function getRows(){
    return rows.slice();
  }

  function clear(){
    rows.length = 0;
  }

  return { onTick, getRows, clear, features: GOODJUNK_FEATURES_V1 };
}

export function buildRow(state, tSec){
  if(!state) return null;

  // normalize fields (accept either camelCase or snake_case)
  const score = n(state.score ?? state.scoreFinal);
  const miss_total = n(state.missTotal ?? state.miss_total);
  const miss_good_expired = n(state.missGoodExpired ?? state.miss_good_expired);
  const miss_junk_hit = n(state.missJunkHit ?? state.miss_junk_hit);
  const combo = n(state.combo);
  const combo_max = n(state.comboMax ?? state.combo_max);
  const fever_pct = n(state.feverPct ?? state.fever_pct);
  const shield = n(state.shield);
  const shots = n(state.shots);
  const hits = n(state.hits);
  const acc_pct = n(state.accPct ?? state.acc_pct);
  const median_rt_good_ms = n(state.medianRtGoodMs ?? state.median_rt_good_ms);

  const t_left_sec = n(state.tLeft ?? state.t_left_sec);
  const storm_on = b(state.stormOn ?? state.storm_on);
  const boss_active = b(state.bossActive ?? state.boss_active);

  const diff = String(state.diff || 'normal').toLowerCase();
  const view = String(state.view || 'mobile').toLowerCase();

  const row = {
    t_sec: round1(tSec),
    t_left_sec: t_left_sec,

    diff_easy: diff==='easy'?1:0,
    diff_normal: diff==='normal'?1:0,
    diff_hard: diff==='hard'?1:0,

    view_mobile: view==='mobile'?1:0,
    view_pc: view==='pc'?1:0,
    view_vr: view==='vr'?1:0,
    view_cvr: view==='cvr'?1:0,

    score,
    miss_total,
    miss_good_expired,
    miss_junk_hit,
    combo,
    combo_max,
    fever_pct,
    shield,
    shots,
    hits,
    acc_pct,
    median_rt_good_ms,
    storm_on,
    boss_active,
  };

  return row;
}

/**
 * Post-process labels for hazardRisk using future window.
 * Given rows with __t_emit and __miss_at_emit:
 * label=1 if miss_total increases within next windowSec.
 */
export function addHazardLabels(rows, windowSec=4){
  windowSec = clamp(windowSec, 1, 20);
  const out = rows.map(r=>({ ...r }));
  for(let i=0;i<out.length;i++){
    const r = out[i];
    const t0 = Number(r.__t_emit)||0;
    const m0 = Number(r.__miss_at_emit)||0;
    let hazard = 0;
    for(let j=i+1;j<out.length;j++){
      const t1 = Number(out[j].__t_emit)||0;
      if(t1 - t0 > windowSec) break;
      const m1 = Number(out[j].__miss_at_emit)||0;
      if(m1 > m0){ hazard = 1; break; }
    }
    r.hazard_label = hazard;
  }
  return out;
}

/**
 * Export helpers (browser)
 */
export function rowsToCSV(rows, featureOrder=GOODJUNK_FEATURES_V1, extraCols=['hazard_label']){
  const cols = featureOrder.concat(extraCols || []);
  const esc = (v)=>{
    const s = String(v ?? '');
    if(/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const head = cols.join(',');
  const body = rows.map(r=> cols.map(c=> esc(r[c])).join(',')).join('\n');
  return head + '\n' + body + '\n';
}

export function downloadText(filename, text){
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 300);
}

export function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function n(v){ v = Number(v); return Number.isFinite(v)?v:0; }
function b(v){ return v?1:0; }
function round1(v){ return Math.round((Number(v)||0)*10)/10; }
