// === /fitness/js/stats-page.js ===
'use strict';

import { getSessions, clearStats } from './stats-store.js';

function fmtTs(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleString('th-TH', { hour12:false });
  }catch(_){
    return String(ts);
  }
}

function render(){
  const rowsEl = document.getElementById('rows');
  const countEl = document.getElementById('count');
  const emptyEl = document.getElementById('empty');

  const sessions = getSessions('shadow-breaker') || [];
  if (countEl) countEl.textContent = String(sessions.length);

  if (!rowsEl) return;
  rowsEl.innerHTML = '';

  if (!sessions.length){
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  for (const s of sessions){
    const tr = document.createElement('tr');

    const tdTime = document.createElement('td');
    tdTime.textContent = fmtTs(s.ts);
    tr.appendChild(tdTime);

    const tdScore = document.createElement('td');
    tdScore.textContent = String(s.score ?? '');
    tr.appendChild(tdScore);

    const tdAcc = document.createElement('td');
    tdAcc.textContent = (s.accuracy_pct != null) ? (Number(s.accuracy_pct).toFixed(1) + '%') : '';
    tr.appendChild(tdAcc);

    const tdGrade = document.createElement('td');
    tdGrade.innerHTML = `<span class="grade ${String(s.grade||'')}">${String(s.grade||'')}</span>`;
    tr.appendChild(tdGrade);

    const tdBoss = document.createElement('td');
    tdBoss.textContent = String(s.bosses_cleared ?? '');
    tr.appendChild(tdBoss);

    const tdDiff = document.createElement('td');
    tdDiff.textContent = String(s.diff ?? '');
    tr.appendChild(tdDiff);

    rowsEl.appendChild(tr);
  }
}

document.getElementById('btn-clear')?.addEventListener('click', ()=>{
  const ok = confirm('ล้างสถิติทั้งหมด?');
  if (!ok) return;
  clearStats();
  render();
});

render();