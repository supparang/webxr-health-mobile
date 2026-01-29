// === /fitness/js/rank-fx.js ===
// Shadow Breaker — Rank system + pop FX (A-19)
'use strict';

const RANKS = [
  { k:'SSS', min:98 },
  { k:'SS',  min:95 },
  { k:'S',   min:90 },
  { k:'A',   min:80 },
  { k:'B',   min:70 },
  { k:'C',   min:0  },
];

export function rankFromAcc(acc){
  const a = Math.max(0, Math.min(100, Number(acc)||0));
  for (const r of RANKS){
    if (a >= r.min) return r.k;
  }
  return 'C';
}

export function ensureRankBadge(){
  let el = document.getElementById('sb-rank-badge');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'sb-rank-badge';
  el.className = 'sb-rank-badge';
  el.innerHTML = `<span class="k">RANK</span><span class="v">B</span>`;
  document.body.appendChild(el);
  return el;
}

export function setRankBadge(rank){
  const el = ensureRankBadge();
  const v = el.querySelector('.v');
  if (v) v.textContent = rank || 'B';
  el.dataset.rank = String(rank||'B');
}

export function popRank(rank, note){
  const el = document.createElement('div');
  el.className = 'sb-rank-pop';
  el.innerHTML = `<div class="r">${rank}</div>${note ? `<div class="n">${note}</div>`:''}`;
  document.body.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('is-live'));
  setTimeout(()=>{ el.remove(); }, 950);
}