// === /fitness/js/stats-page.js ===
'use strict';

import { readAllSessions, clearAllSessions } from './stats-store.js';

const rowsEl = document.getElementById('rows');
const emptyEl = document.getElementById('empty');
const btnClear = document.getElementById('btn-clear');

function fmt(ts){
  try{ return new Date(ts).toLocaleString(); }catch{ return String(ts); }
}

function esc(s){
  return String(s).replace(/[&<>"']/g, (m)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function render(){
  const list = readAllSessions();
  rowsEl.innerHTML = '';

  if (!list.length){
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  for (const it of list){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(fmt(it.ts))}</td>
      <td>${esc(it.game || '')}</td>
      <td>${esc(it.score ?? '')}</td>
      <td>${esc((it.accuracy_pct ?? '') + (it.accuracy_pct!=null?'%':''))}</td>
      <td>${esc(it.grade || '')}</td>
      <td>${esc(it.bosses_cleared ?? '')}</td>
      <td>${esc(it.diff || '')}</td>
    `;
    rowsEl.appendChild(tr);
  }
}

if (btnClear){
  btnClear.addEventListener('click', ()=>{
    if (!confirm('ล้างสถิติทั้งหมด?')) return;
    clearAllSessions();
    render();
  });
}

render();