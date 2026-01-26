// === js/stats.js — render sessions table ===
'use strict';

import { loadSessions, saveSessions } from './stats-store.js';

const tbody = document.getElementById('st-body');
const btnClear = document.getElementById('st-clear');

function fmtTime(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleString('th-TH', { hour12:false });
  }catch(_){
    return String(ts || '');
  }
}

function render(){
  if(!tbody) return;

  const all = loadSessions();
  const rows = all.filter(x => x && x.game === 'shadow-breaker')
                  .slice(-30)
                  .reverse();

  tbody.innerHTML = '';

  if(!rows.length){
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'st-empty';
    td.textContent = 'ยังไม่มีข้อมูล — ลองเล่น 1 รอบ แล้วกลับมาหน้านี้';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for(const r of rows){
    const tr = document.createElement('tr');

    const cells = [
      fmtTime(r.ts),
      r.mode || '',
      r.diff || '',
      (r.score != null ? String(r.score) : ''),
      (r.accuracy_pct != null ? (Number(r.accuracy_pct).toFixed(1) + ' %') : ''),
      r.grade || '',
      (r.bosses_cleared != null ? String(r.bosses_cleared) : ''),
      (r.duration_s != null ? (Number(r.duration_s).toFixed(1) + ' s') : '')
    ];

    for(const c of cells){
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
}

btnClear?.addEventListener('click', ()=>{
  if(!confirm('ล้างประวัติทั้งหมดของเครื่องนี้?')) return;
  try{
    // ลบเฉพาะรายการ shadow-breaker
    const all = loadSessions();
    const keep = all.filter(x => !x || x.game !== 'shadow-breaker');
    saveSessions(keep);
  }catch(_){}
  render();
});

render();