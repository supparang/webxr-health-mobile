// === /fitness/js/stats.js ===
'use strict';

import { loadSessions } from './stats-store.js';

const $ = (id) => document.getElementById(id);

const elGame = $('filter-game');
const elRange = $('filter-range');
const elQ = $('filter-q');
const elSort = $('filter-sort');

const elTbody = $('tbody');
const elRowsInfo = $('rows-info');

const kTotal = $('kpi-total');
const kAvgScore = $('kpi-avg-score');
const kAvgAcc = $('kpi-avg-acc');
const kTopGrade = $('kpi-top-grade');

const lastWhen = $('last-when');
const lastGame = $('last-game');
const lastScore = $('last-score');
const lastAcc = $('last-acc');
const lastGrade = $('last-grade');

const topList = $('top-list');

const btnExportJson = $('btn-export-json');
const btnExportCsv = $('btn-export-csv');
const btnClear = $('btn-clear');

const KEY = 'vrfitness_stats_v1';

function fmtWhen(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleString('th-TH', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }catch{ return String(ts); }
}

function normGameId(v){
  if (!v) return 'unknown';
  const s = String(v).toLowerCase();
  // รองรับ id ที่อาจเรียกต่างกัน
  if (s.includes('shadow')) return 'shadow-breaker';
  if (s.includes('rhythm')) return 'rhythm-boxer';
  if (s.includes('jump')) return 'jump-duck';
  if (s.includes('balance')) return 'balance-hold';
  return s;
}

function pickAcc(row){
  // รองรับหลายชื่อ field
  const v = row.accuracy_pct ?? row.accuracy ?? row.acc ?? row.acc_pct;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickScore(row){
  const v = row.score ?? row.final_score ?? row.total_score;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickGrade(row){
  return (row.grade ?? row.rank ?? '-').toString();
}

function pickDiff(row){
  return (row.diff ?? row.difficulty ?? '-').toString();
}

function pickDur(row){
  const v = row.duration_s ?? row.duration ?? row.time ?? row.sec;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function filterByRange(rows, rangeKey){
  if (rangeKey === 'all') return rows;
  const now = Date.now();
  const ms =
    rangeKey === '24h' ? 24*60*60*1000 :
    rangeKey === '7d'  ? 7*24*60*60*1000 :
    rangeKey === '30d' ? 30*24*60*60*1000 :
    null;
  if (!ms) return rows;
  return rows.filter(r => (now - (Number(r.ts) || 0)) <= ms);
}

function applySearch(rows, q){
  const s = (q || '').trim().toLowerCase();
  if (!s) return rows;
  return rows.filter(r => JSON.stringify(r).toLowerCase().includes(s));
}

function sortRows(rows, key){
  const arr = rows.slice();
  if (key === 'oldest') arr.sort((a,b)=>(Number(a.ts)||0) - (Number(b.ts)||0));
  else if (key === 'score_desc') arr.sort((a,b)=>pickScore(b) - pickScore(a));
  else if (key === 'acc_desc') arr.sort((a,b)=>(pickAcc(b)||-1) - (pickAcc(a)||-1));
  else arr.sort((a,b)=>(Number(b.ts)||0) - (Number(a.ts)||0));
  return arr;
}

function computeSummary(rows){
  const total = rows.length;
  const avgScore = total ? rows.reduce((s,r)=>s + pickScore(r), 0) / total : 0;

  const accVals = rows.map(pickAcc).filter(v=>v!=null);
  const avgAcc = accVals.length ? accVals.reduce((s,v)=>s+v,0)/accVals.length : null;

  const gradeCount = new Map();
  for (const r of rows){
    const g = pickGrade(r);
    gradeCount.set(g, (gradeCount.get(g)||0)+1);
  }
  let topG = '-';
  let topN = -1;
  for (const [g,n] of gradeCount.entries()){
    if (n>topN){ topN=n; topG=g; }
  }

  return {
    total,
    avgScore,
    avgAcc,
    topGrade: topG
  };
}

function renderTop5(rows){
  topList.innerHTML = '';
  const top = rows.slice().sort((a,b)=>pickScore(b)-pickScore(a)).slice(0,5);
  if (!top.length){
    topList.innerHTML = '<li class="muted">ยังไม่มีข้อมูล</li>';
    return;
  }

  for (const r of top){
    const li = document.createElement('li');
    const gid = normGameId(r.gameId);
    const sc = pickScore(r);
    const acc = pickAcc(r);
    const g = pickGrade(r);
    li.innerHTML = `
      <strong>${sc}</strong>
      <span class="meta"> • ${gid} • ${acc!=null ? acc.toFixed(1)+'%' : '-'} • ${g} • ${fmtWhen(r.ts)}</span>
    `;
    topList.appendChild(li);
  }
}

function renderTable(rows){
  elTbody.innerHTML = '';
  elRowsInfo.textContent = `${rows.length} แถว`;

  if (!rows.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="muted">ยังไม่มีข้อมูล (เริ่มเล่นเกมก่อน แล้วค่อยกลับมาดูสรุปผล)</td>`;
    elTbody.appendChild(tr);
    return;
  }

  for (const r of rows){
    const tr = document.createElement('tr');
    const gid = normGameId(r.gameId);
    const diff = pickDiff(r);
    const score = pickScore(r);
    const acc = pickAcc(r);
    const grade = pickGrade(r);
    const dur = pickDur(r);

    tr.innerHTML = `
      <td>${fmtWhen(r.ts)}</td>
      <td>${gid}</td>
      <td>${diff}</td>
      <td class="num">${score}</td>
      <td class="num">${acc!=null ? acc.toFixed(1) : '-'}</td>
      <td>${grade}</td>
      <td class="num">${dur!=null ? dur.toFixed(1) : '-'}</td>
    `;
    elTbody.appendChild(tr);
  }
}

function setLast(rows){
  if (!rows.length){
    lastWhen.textContent = '-';
    lastGame.textContent = '-';
    lastScore.textContent = '-';
    lastAcc.textContent = '-';
    lastGrade.textContent = '-';
    return;
  }
  const r = rows.slice().sort((a,b)=>(Number(b.ts)||0)-(Number(a.ts)||0))[0];
  lastWhen.textContent = fmtWhen(r.ts);
  lastGame.textContent = normGameId(r.gameId);
  lastScore.textContent = String(pickScore(r));
  const acc = pickAcc(r);
  lastAcc.textContent = acc!=null ? acc.toFixed(1)+'%' : '-';
  lastGrade.textContent = pickGrade(r);
}

function exportJson(rows){
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type:'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vrfitness-stats.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(rows){
  if (!rows.length){ alert('ยังไม่มีข้อมูลให้ Export'); return; }

  // รวมคอลัมน์ให้ครบจากทุกแถว (stable columns)
  const colSet = new Set();
  for (const r of rows) Object.keys(r).forEach(k => colSet.add(k));
  // เติมคอลัมน์มาตรฐานด้านหน้าเพื่อความอ่านง่าย
  const preferred = ['ts','gameId','diff','score','accuracy_pct','grade','duration_s'];
  const cols = Array.from(new Set([...preferred, ...Array.from(colSet)]));

  const esc = (v)=>{
    const s = (v==null) ? '' : String(v);
    return `"${s.replace(/"/g,'""')}"`;
  };

  const head = cols.join(',');
  const lines = rows.map(r => cols.map(c => esc(r[c])).join(','));
  const csv = [head, ...lines].join('\n');

  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vrfitness-stats.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function applyAll(){
  let rows = loadSessions().map(r => {
    // normalize: gameId + ts
    return {
      ...r,
      gameId: normGameId(r.gameId),
      ts: Number(r.ts) || Date.now()
    };
  });

  // filter game
  const g = elGame.value;
  if (g !== 'all') rows = rows.filter(r => normGameId(r.gameId) === g);

  // range
  rows = filterByRange(rows, elRange.value);

  // search
  rows = applySearch(rows, elQ.value);

  // sort
  rows = sortRows(rows, elSort.value);

  // KPIs
  const sum = computeSummary(rows);
  kTotal.textContent = String(sum.total);
  kAvgScore.textContent = sum.total ? sum.avgScore.toFixed(0) : '0';
  kAvgAcc.textContent = sum.avgAcc!=null ? sum.avgAcc.toFixed(1)+'%' : '0%';
  kTopGrade.textContent = sum.topGrade;

  // last
  setLast(rows);

  // top5 (จาก rows ที่กรองแล้ว)
  renderTop5(rows);

  // table
  renderTable(rows);

  // wire exports
  btnExportJson.onclick = () => exportJson(rows);
  btnExportCsv.onclick = () => exportCsv(rows);
}

function clearAll(){
  const ok = confirm('ต้องการล้างข้อมูลสถิติทั้งหมดในเครื่องนี้จริงหรือไม่?');
  if (!ok) return;
  localStorage.removeItem(KEY);
  applyAll();
}

function wire(){
  elGame.addEventListener('change', applyAll);
  elRange.addEventListener('change', applyAll);
  elSort.addEventListener('change', applyAll);
  elQ.addEventListener('input', () => {
    // debounce เล็กน้อย
    clearTimeout(wire._t);
    wire._t = setTimeout(applyAll, 160);
  });

  btnClear.addEventListener('click', clearAll);
}

wire();
applyAll();
