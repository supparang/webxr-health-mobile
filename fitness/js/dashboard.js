// fitness/js/dashboard.js
'use strict';

import { loadSessions } from './stats-store.js';

const gameInfo = {
  'shadow-breaker': { icon:'🥊', name:'Shadow Breaker' },
  'rhythm-boxer':   { icon:'🥁', name:'Rhythm Boxer' },
  'jump-duck':      { icon:'🦘', name:'Jump-Duck' },
  'balance-hold':   { icon:'⚖️', name:'Balance Hold' },
};

function fmtTime(ts){
  const d = new Date(ts);
  return d.toLocaleString('th-TH', {
    hour:'2-digit', minute:'2-digit',
    day:'2-digit', month:'2-digit'
  });
}

function render(){
  const grid = document.getElementById('stats-grid');
  const empty = document.getElementById('stats-empty');
  if (!grid) return;

  const sessions = loadSessions();
  const byGame = {};

  for (const s of sessions){
    if (!byGame[s.gameId]) byGame[s.gameId] = [];
    byGame[s.gameId].push(s);
  }

  grid.innerHTML = '';

  const gameIds = Object.keys(gameInfo);
  let hasAny = false;

  for (const gid of gameIds){
    const info = gameInfo[gid];
    const list = byGame[gid] || [];
    if (!list.length){
      const card = document.createElement('div');
      card.className = 'stats-card';
      card.innerHTML = `
        <div class="stats-title">
          <span>${info.icon} ${info.name}</span>
          <span class="badge">ยังไม่มีข้อมูล</span>
        </div>
        <div class="stats-meta">เล่นอย่างน้อย 1 รอบเพื่อดูสรุป</div>
      `;
      grid.appendChild(card);
      continue;
    }
    hasAny = true;
    const last = list[0];
    const totalSessions = list.length;

    const acc = last.accuracy != null
      ? (last.accuracy * 100).toFixed(1) + ' %'
      : '-';

    const card = document.createElement('div');
    card.className = 'stats-card';
    card.innerHTML = `
      <div class="stats-title">
        <span>${info.icon} ${info.name}</span>
        <span class="badge">${totalSessions} รอบ</span>
      </div>
      <div class="stats-meta">
        โหมด: ${last.mode || '-'} • diff: ${last.difficulty || '-'} • เมื่อ: ${fmtTime(last.ts)}
      </div>
      <div>คะแนนล่าสุด: <strong>${last.score != null ? last.score.toFixed ? last.score.toFixed(1) : last.score : '-'}</strong></div>
      <div>คอมโบสูงสุด: ${last.maxCombo ?? '-'}</div>
      <div>จำนวน miss: ${last.missCount ?? '-'}</div>
      <div>จำนวน hit: ${last.totalHits ?? '-'}</div>
      <div>Accuracy: ${acc}</div>
    `;
    grid.appendChild(card);
  }

  if (empty){
    empty.style.display = hasAny ? 'none' : 'block';
  }
}

window.addEventListener('DOMContentLoaded', render);
