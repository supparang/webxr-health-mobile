// === /herohealth/plate/plate-race-mp-bind.js ===
// FULL PATCH v20260326-PLATE-RACE-MP-BIND-FULL

(function () {
  'use strict';

  let lastSyncAt = 0;
  let finished = false;
  let started = false;
  let lastRoom = null;

  function esc(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function el(id) {
    return document.getElementById(id);
  }

  function injectCss() {
    if (document.getElementById('plateRaceMpStyle')) return;
    const style = document.createElement('style');
    style.id = 'plateRaceMpStyle';
    style.textContent = `
      .plate-race-mp-hud{
        position:fixed;
        top:max(12px, env(safe-area-inset-top));
        right:12px;
        z-index:85;
        pointer-events:none;
      }
      .plate-race-mp-card{
        width:min(280px, calc(100vw - 24px));
        border-radius:18px;
        padding:12px;
        color:#f8fafc;
        background:linear-gradient(180deg, rgba(15,23,42,.94), rgba(2,6,23,.94));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 14px 34px rgba(0,0,0,.34);
        backdrop-filter:blur(8px);
      }
      .plate-race-mp-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:8px;
        margin-bottom:8px;
      }
      .plate-race-mp-title{
        font-size:13px;
        font-weight:900;
        color:#dbeafe;
        letter-spacing:.2px;
      }
      .plate-race-mp-room{
        font-size:11px;
        color:#94a3b8;
        font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      }
      .plate-race-mp-me{
        margin-bottom:8px;
        padding:8px 10px;
        border-radius:12px;
        background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.08);
        font-size:12px;
        color:#cbd5e1;
      }
      .plate-race-mp-list{
        display:grid;
        gap:8px;
      }
      .plate-race-mp-row{
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:center;
        gap:10px;
        padding:9px 10px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.04);
      }
      .plate-race-mp-row.me{
        border-color:rgba(59,130,246,.48);
        background:rgba(59,130,246,.10);
      }
      .plate-race-mp-rank{
        width:26px;
        height:26px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:900;
        color:#fff;
        background:linear-gradient(180deg,#3b82f6,#1d4ed8);
      }
      .plate-race-mp-rank.rank-1{
        background:linear-gradient(180deg,#facc15,#eab308);
        color:#111827;
      }
      .plate-race-mp-rank.rank-2{
        background:linear-gradient(180deg,#cbd5e1,#94a3b8);
        color:#111827;
      }
      .plate-race-mp-rank.rank-3{
        background:linear-gradient(180deg,#fb923c,#ea580c);
      }
      .plate-race-mp-name{
        min-width:0;
      }
      .plate-race-mp-name strong{
        display:block;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        font-size:13px;
      }
      .plate-race-mp-meta{
        font-size:11px;
        color:#cbd5e1;
      }
      .plate-race-mp-state{
        text-align:right;
        display:grid;
        gap:4px;
      }
      .plate-race-mp-score{
        font-size:14px;
        font-weight:900;
        color:#f8fafc;
      }
      .plate-race-mp-badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:3px 8px;
        border-radius:999px;
        font-size:11px;
        font-weight:900;
      }
      .plate-race-mp-badge.ready{
        color:#052e16;
        background:#86efac;
      }
      .plate-race-mp-badge.wait{
        color:#78350f;
        background:#fde68a;
      }
      .plate-race-mp-badge.done{
        color:#082f49;
        background:#93c5fd;
      }
      .plate-race-mp-wait-layer{
        position:fixed;
        inset:0;
        z-index:120;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:rgba(2,6,23,.68);
        backdrop-filter:blur(8px);
      }
      .plate-race-mp-wait-card{
        width:min(520px,100%);
        border-radius:24px;
        padding:22px;
        text-align:center;
        color:#f8fafc;
        background:linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.96));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 18px 50px rgba(0,0,0,.38);
      }
      .plate-race-mp-wait-emoji{
        font-size:42px;
        margin-bottom:8px;
      }
    `;
    document.head.appendChild(style);
  }

  function injectDom() {
    if (el('plateRaceMpHud')) return;

    const hud = document.createElement('div');
    hud.id = 'plateRaceMpHud';
    hud.className = 'plate-race-mp-hud';
    hud.hidden = true;
    hud.innerHTML = `
      <div class="plate-race-mp-card">
        <div class="plate-race-mp-head">
          <div class="plate-race-mp-title">🏁 Race Leaderboard</div>
          <div id="plateRaceMpRoom" class="plate-race-mp-room">room -</div>
        </div>

        <div id="plateRaceMpMe" class="plate-race-mp-me">
          อันดับของฉัน: <strong id="plateRaceMpMyRank">-</strong>
        </div>

        <div id="plateRaceMpList" class="plate-race-mp-list"></div>
      </div>
    `;

    const wait = document.createElement('div');
    wait.id = 'plateRaceMpWaitLayer';
    wait.className = 'plate-race-mp-wait-layer';
    wait.hidden = true;
    wait.innerHTML = `
      <div class="plate-race-mp-wait-card">
        <div class="plate-race-mp-wait-emoji">⏳</div>
        <h2 id="plateRaceMpWaitTitle">รอผู้เล่นคนอื่น</h2>
        <p id="plateRaceMpWaitText">เครื่องนี้จบแล้ว กำลังรอจัดอันดับสุดท้าย</p>
      </div>
    `;

    document.body.appendChild(hud);
    document.body.appendChild(wait);
  }

  function players(room) {
    return Object.values(room?.players || {})
      .filter(Boolean)
      .filter(p => p.online !== false);
  }

  function sortPlayers(input) {
    return [...input].sort((a, b) => {
      const af = !!a.finished;
      const bf = !!b.finished;

      if (af !== bf) return bf - af;

      if (af && bf) {
        return (Number(a.finishedAt || Infinity) - Number(b.finishedAt || Infinity))
          || (Number(b.finalScore || b.score || 0) - Number(a.finalScore || a.score || 0))
          || (Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
      }

      return (Number(b.score || 0) - Number(a.score || 0))
        || (Number(b.contribution || 0) - Number(a.contribution || 0))
        || (Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
    });
  }

  function badge(p) {
    if (!p) return { text: 'รอ', cls: 'wait' };
    if (p.finished) return { text: 'จบแล้ว', cls: 'done' };
    if (p.ready) return { text: 'พร้อม', cls: 'ready' };
    return { text: 'รอ', cls: 'wait' };
  }

  function showHud(show) {
    const n = el('plateRaceMpHud');
    if (n) n.hidden = !show;
  }

  function showWait(show, title = 'รอผู้เล่นคนอื่น', text = 'เครื่องนี้จบแล้ว กำลังรอจัดอันดับสุดท้าย') {
    const layer = el('plateRaceMpWaitLayer');
    if (!layer) return;
    if (el('plateRaceMpWaitTitle')) el('plateRaceMpWaitTitle').textContent = title;
    if (el('plateRaceMpWaitText')) el('plateRaceMpWaitText').textContent = text;
    layer.hidden = !show;
  }

  function render(room) {
    lastRoom = room || null;
    if (!room) return;

    const list = el('plateRaceMpList');
    const roomEl = el('plateRaceMpRoom');
    const myRankEl = el('plateRaceMpMyRank');

    const arr = sortPlayers(players(room));
    const mePid = window.PLATE_MP?.ctx?.pid || '';
    const myIndex = arr.findIndex(p => p.pid === mePid);
    const myRank = myIndex >= 0 ? myIndex + 1 : '-';

    if (roomEl) roomEl.textContent = `room ${room?.meta?.roomId || '-'}`;
    if (myRankEl) myRankEl.textContent = String(myRank);

    if (list) {
      list.innerHTML = arr.map((p, idx) => {
        const rank = idx + 1;
        const b = badge(p);
        const isMe = p.pid === mePid;
        const score = Math.round(Number(p.finalScore || p.score || 0));
        const progress = Math.round(Number(p.contribution || 0));

        return `
          <div class="plate-race-mp-row ${isMe ? 'me' : ''}">
            <div class="plate-race-mp-rank rank-${rank}">${rank}</div>

            <div class="plate-race-mp-name">
              <strong>${esc(p.name || p.pid || 'player')}</strong>
              <div class="plate-race-mp-meta">
                score ${score}${progress ? ` • progress ${progress}%` : ''}
              </div>
            </div>

            <div class="plate-race-mp-state">
              <div class="plate-race-mp-score">${score}</div>
              <span class="plate-race-mp-badge ${b.cls}">${b.text}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    showHud(true);

    const state = String(room?.meta?.state || '');
    if (state === 'playing' && !started) started = true;

    if (finished) {
      const active = players(room);
      const allFinished = active.length >= 2 && active.every(p => !!p.finished);
      showWait(
        !allFinished,
        'รอผู้เล่นคนอื่น',
        allFinished ? 'ครบทุกคนแล้ว' : 'เครื่องนี้จบแล้ว กำลังรอจัดอันดับสุดท้าย'
      );
    }
  }

  function bindEvents() {
    window.addEventListener('plate:multiplayer-room', ev => {
      const room = ev?.detail?.room || null;
      if (!room) return;
      render(room);
    });
  }

  async function waitForGate() {
    if (!window.__PLATE_MP_ENABLED__) return;
    if (!window.__PLATE_MP_LOCKED__) return;

    await new Promise(resolve => {
      window.addEventListener('plate:multiplayer-start', () => resolve(), { once: true });
    });
  }

  function canRunNow() {
    if (!window.__PLATE_MP_ENABLED__) return true;
    return !window.__PLATE_MP_LOCKED__;
  }

  function syncScore(score) {
    if (!window.PLATE_MP) return;
    const now = Date.now();
    if (now - lastSyncAt < 120) return;
    lastSyncAt = now;
    try {
      window.PLATE_MP.syncScore(Number(score || 0));
    } catch {}
  }

  function syncProgress(progressPct) {
    try {
      window.PLATE_MP?.syncContribution(Number(progressPct || 0));
    } catch {}
  }

  async function finishRace(summary = {}) {
    if (!window.PLATE_MP || finished) return;
    finished = true;

    try {
      await window.PLATE_MP.finish({
        finished: true,
        finishedAt: Date.now(),
        finalScore: Number(summary.score || 0),
        finalStars: Number(summary.stars || 0),
        correct: Number(summary.correct || 0),
        wrong: Number(summary.wrong || 0),
        contribution: Number(summary.progressPct || 0)
      });
    } catch {}

    showWait(true, 'รอผู้เล่นคนอื่น', 'เครื่องนี้จบแล้ว กำลังรอจัดอันดับสุดท้าย');

    await new Promise(resolve => {
      const handler = ev => {
        const room = ev?.detail?.room || null;
        const active = players(room || {});
        const allFinished = active.length >= 2 && active.every(p => !!p.finished);
        if (allFinished) {
          window.removeEventListener('plate:multiplayer-room', handler);
          resolve();
        }
      };

      window.addEventListener('plate:multiplayer-room', handler);

      const roomNow = window.PLATE_MP?.getRoom?.() || lastRoom || null;
      if (roomNow) {
        const active = players(roomNow);
        const allFinished = active.length >= 2 && active.every(p => !!p.finished);
        if (allFinished) {
          window.removeEventListener('plate:multiplayer-room', handler);
          resolve();
        }
      }
    });

    showWait(false);
  }

  async function bootstrap(startFn) {
    await waitForGate();
    if (typeof startFn === 'function') startFn();
  }

  function boot() {
    injectCss();
    injectDom();
    bindEvents();

    const room = window.PLATE_MP?.getRoom?.() || null;
    if (room) render(room);
    setTimeout(() => {
      const r = window.PLATE_MP?.getRoom?.() || null;
      if (r) render(r);
    }, 400);
  }

  window.PlateRaceMP = {
    waitForGate,
    canRunNow,
    syncScore,
    syncProgress,
    finish: finishRace,
    bootstrap
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();