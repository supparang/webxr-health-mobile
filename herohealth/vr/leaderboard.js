// === /herohealth/vr/leaderboard.js ===
// HeroHealth Leaderboard — store + rank + render (Hub/EndOverlay)
// Uses: score → acc → miss → medianRT
// FULL v20260228-LB-STORE-RENDER
'use strict';

import { rankList, normalizeResult } from './score-rank.js';

const WIN = (typeof window!=='undefined') ? window : globalThis;
const DOC = WIN.document;

const LS_KEY = 'HHA_SUMMARY_HISTORY_V1';
const LS_MAX = 200;

function safeJSONParse(s, fallback){
  try{ return JSON.parse(s); }catch(e){ return fallback; }
}
function lsGet(k){
  try{ return localStorage.getItem(k); }catch(e){ return null; }
}
function lsSet(k,v){
  try{ localStorage.setItem(k, v); }catch(e){}
}
function nowIso(){ return new Date().toISOString(); }

export function loadHistory(){
  const raw = lsGet(LS_KEY);
  const arr = safeJSONParse(raw || '[]', []);
  return Array.isArray(arr) ? arr : [];
}

export function saveHistory(arr){
  if(!Array.isArray(arr)) return;
  const sliced = arr.slice(-LS_MAX);
  lsSet(LS_KEY, JSON.stringify(sliced));
}

export function appendSummary(summary){
  if(!summary || typeof summary!=='object') return;
  const s = Object.assign({}, summary);
  if(!s.endTimeIso) s.endTimeIso = nowIso();
  const hist = loadHistory();
  hist.push(s);
  saveHistory(hist);

  try{
    WIN.dispatchEvent(new CustomEvent('hha:lb-updated', { detail: { size: hist.length } }));
  }catch(e){}
}

export function filterHistory(hist, opts){
  opts = opts || {};
  const game = String(opts.gameKey || '').toLowerCase();
  const cat  = String(opts.cat || '').toLowerCase();
  const pid  = String(opts.pid || '').trim();

  return (hist||[]).filter(x=>{
    if(!x) return false;

    if(game){
      const g1 = String(x.gameKey || '').toLowerCase();
      const g2 = String(x.projectTag || '').toLowerCase();
      if(g1 !== game && g2.indexOf(game) === -1) return false;
    }

    if(cat){
      const c1 = String(x.zone || x.cat || '').toLowerCase();
      if(c1 && c1 !== cat) return false;
    }

    if(pid && String(x.pid||'').trim() !== pid) return false;
    return true;
  });
}

function fmtNum(n){ n = Number(n)||0; return String(Math.round(n)); }
function fmtPct(n){ n = Number(n)||0; return `${Math.round(n)}%`; }
function fmtMs(n){ n = Number(n)||0; return `${Math.round(n)}ms`; }

function ensureStyle(){
  if(!DOC) return;
  if(DOC.getElementById('hh-lb-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hh-lb-style';
  st.textContent = `
  .hh-lb-card{
    border:1px solid rgba(148,163,184,.16);
    background:rgba(2,6,23,.62);
    color:rgba(229,231,235,.96);
    border-radius:16px;
    padding:12px 12px;
    box-shadow:0 18px 55px rgba(0,0,0,.40);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    font: 800 13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;
  }
  .hh-lb-head{ display:flex; gap:10px; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .hh-lb-title{ font-size:13px; letter-spacing:.2px; }
  .hh-lb-sub{ font-size:11px; opacity:.85; font-weight:800; }
  .hh-lb-table{ width:100%; border-collapse:collapse; }
  .hh-lb-table th, .hh-lb-table td{ padding:6px 6px; border-top:1px solid rgba(148,163,184,.12); text-align:left; }
  .hh-lb-table th{ font-size:11px; opacity:.85; font-weight:900; }
  .hh-lb-r{ text-align:right; }
  .hh-lb-pill{
    display:inline-flex; align-items:center; gap:6px;
    border:1px solid rgba(148,163,184,.18);
    background:rgba(15,23,42,.55);
    border-radius:999px;
    padding:4px 8px;
    font-weight:900;
    font-size:11px;
    opacity:.92;
  }
  .hh-lb-muted{ opacity:.85; font-weight:850; }
  `;
  DOC.head.appendChild(st);
}

export function computeTop(hist, opts){
  opts = opts || {};
  const list = filterHistory(hist, opts);

  const ranked = rankList(list.map(x=>{
    const n = normalizeResult(x);
    const o = Object.assign({}, x);
    o.scoreFinal = n.score;
    o.accPct = n.acc;
    o.missTotal = n.miss;
    o.medianRtGoodMs = n.medRT;
    return o;
  }));

  const nTop = Math.max(1, Math.min(50, Number(opts.top||10)||10));
  return ranked.slice(0, nTop);
}

function pickContext(){
  try{
    const sp = new URL(location.href).searchParams;
    return {
      pid: sp.get('pid') || '',
      cat: sp.get('cat') || sp.get('zone') || '',
      theme: sp.get('theme') || sp.get('game') || sp.get('plannedGame') || ''
    };
  }catch(e){
    return { pid:'', cat:'', theme:'' };
  }
}

export function renderInto(el, opts){
  if(!DOC || !el) return;
  ensureStyle();

  const hist = loadHistory();
  const ctx = pickContext();

  opts = opts || {};
  const title = opts.title || '🏆 Leaderboard';
  const top = computeTop(hist, {
    top: opts.top ?? 10,
    pid: opts.pid ?? '',
    cat: opts.cat ?? ctx.cat,
    gameKey: opts.gameKey ?? ctx.theme
  });

  const rule = 'score→acc→miss→medianRT';

  let rows = '';
  for(let i=0;i<top.length;i++){
    const r = top[i] || {};
    const rank = i+1;
    const who = String(r.pid || r.player || 'anon');
    const score = fmtNum(r.scoreFinal ?? r.score ?? 0);
    const acc = fmtPct(r.accPct ?? r.acc ?? 0);
    const miss = fmtNum(r.missTotal ?? r.miss ?? 0);
    const med = fmtMs(r.medianRtGoodMs ?? r.medianRT ?? 0);
    rows += `
      <tr>
        <td><span class="hh-lb-pill">#${rank}</span></td>
        <td class="hh-lb-muted">${who}</td>
        <td class="hh-lb-r">${score}</td>
        <td class="hh-lb-r">${acc}</td>
        <td class="hh-lb-r">${miss}</td>
        <td class="hh-lb-r">${med}</td>
      </tr>`;
  }

  if(!rows){
    rows = `<tr><td colspan="6" class="hh-lb-muted" style="padding:10px 6px;">ยังไม่มีข้อมูล leaderboard</td></tr>`;
  }

  el.innerHTML = `
    <div class="hh-lb-card">
      <div class="hh-lb-head">
        <div>
          <div class="hh-lb-title">${title}</div>
          <div class="hh-lb-sub">Rule: ${rule}</div>
        </div>
        <div class="hh-lb-pill">Top ${Math.min(Number(opts.top||10)||10, top.length||0) || (Number(opts.top||10)||10)}</div>
      </div>

      <table class="hh-lb-table">
        <thead>
          <tr>
            <th>#</th><th>PID</th>
            <th class="hh-lb-r">Score</th>
            <th class="hh-lb-r">Acc</th>
            <th class="hh-lb-r">Miss</th>
            <th class="hh-lb-r">MedRT</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function autoMount(){
  if(!DOC) return;

  // store summaries (from any game)
  WIN.addEventListener('hha:game-ended', (ev)=>{
    try{
      const s = ev?.detail || null;
      if(s) appendSummary(s);
    }catch(e){}
  });

  const mountAll = ()=>{
    const els = Array.from(DOC.querySelectorAll('[data-hh-leaderboard]'));
    for(const el of els){
      const top = Number(el.getAttribute('data-top') || '10') || 10;
      const title = el.getAttribute('data-title') || '🏆 Leaderboard';
      const cat = el.getAttribute('data-cat') || '';
      const gameKey = el.getAttribute('data-game') || '';
      const pid = el.getAttribute('data-pid') || '';
      renderInto(el, { top, title, cat, gameKey, pid });
    }
  };

  mountAll();
  WIN.addEventListener('hha:lb-updated', ()=> mountAll());
  DOC.addEventListener('visibilitychange', ()=>{ if(!DOC.hidden) mountAll(); });
}