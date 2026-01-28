// === /fitness/js/stats-page.js ===
'use strict';

import { loadSessions, clearSessions } from './stats-store.js';

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, (c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function toCsv(rows){
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const escCsv = (v)=>{
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')){
      return '"' + s.replace(/"/g,'""') + '"';
    }
    return s;
  };
  const out = [];
  out.push(cols.join(','));
  for (const r of rows){
    out.push(cols.map(c=>escCsv(r[c])).join(','));
  }
  return out.join('\n');
}

function downloadCsv(filename, csvText){
  if (!csvText){ alert('ยังไม่มีข้อมูล'); return; }
  const blob = new Blob([csvText], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); }, 0);
}

function fmtTs(ts){
  const d = new Date(Number(ts)||Date.now());
  return d.toLocaleString();
}

function render(){
  const rowsEl = document.getElementById('rows');
  const all = loadSessions().slice(-200).reverse();
  if (!rowsEl) return;

  rowsEl.innerHTML = all.map(s=>{
    return `
      <tr>
        <td class="muted">${esc(fmtTs(s.ts))}</td>
        <td>${esc(s.game)}</td>
        <td>${esc(s.score)}</td>
        <td>${esc(s.accuracy_pct)}%</td>
        <td>${esc(s.grade)}</td>
        <td>${esc(s.bosses_cleared)}</td>
        <td>${esc(s.diff)}</td>
      </tr>
    `;
  }).join('');
  return all;
}

document.getElementById('btn-download')?.addEventListener('click', ()=>{
  const rows = loadSessions().slice(-200);
  downloadCsv('vrfitness-stats.csv', toCsv(rows));
});

document.getElementById('btn-clear')?.addEventListener('click', ()=>{
  if (confirm('ล้างข้อมูลทั้งหมด?')){ clearSessions(); render(); }
});

render();