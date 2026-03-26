// === /herohealth/plate/plate-duet-mp-bind.js ===
// FULL PATCH v20260326-PLATE-DUET-MP-BIND-FULL

(function () {
  'use strict';

  let lastScoreSyncAt = 0;
  let finished = false;
  let started = false;

  function el(id) {
    return document.getElementById(id);
  }

  function injectCss() {
    if (document.getElementById('plateDuetMpStyle')) return;
    const style = document.createElement('style');
    style.id = 'plateDuetMpStyle';
    style.textContent = `
      .plate-mp-mini-hud{
        position:fixed;
        top:max(12px, env(safe-area-inset-top));
        right:12px;
        z-index:80;
        pointer-events:none;
      }
      .plate-mp-mini-card{
        min-width:220px;
        border-radius:18px;
        padding:10px 12px;
        background:linear-gradient(180deg, rgba(15,23,42,.92), rgba(2,6,23,.92));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 14px 34px rgba(0,0,0,.32);
        color:#f8fafc;
        backdrop-filter:blur(8px);
      }
      .plate-mp-mini-title{
        font-size:12px;
        font-weight:900;
        letter-spacing:.3px;
        color:#cbd5e1;
        margin-bottom:8px;
        text-transform:uppercase;
      }
      .plate-mp-mini-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:8px 0;
        border-top:1px solid rgba(255,255,255,.08);
      }
      .plate-mp-mini-row:first-of-type{border-top:0}
      .plate-mp-mini-left{
        display:flex;
        align-items:center;
        gap:8px;
        min-width:0;
      }
      .plate-mp-mini-right{
        display:flex;
        align-items:center;
        gap:10px;
      }
      .plate-mp-role{
        width:24px;
        height:24px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:900;
        color:#fff;
      }
      .plate-mp-role.role-a{
        background:linear-gradient(180deg,#f97316,#ea580c);
      }
      .plate-mp-role.role-b{
        background:linear-gradient(180deg,#3b82f6,#1d4ed8);
      }
      .plate-mp-mini-right .ok{
        color:#86efac;
        font-weight:900;
      }
      .plate-mp-mini-right .wait{
        color:#fde68a;
        font-weight:900;
      }
      .plate-mp-mini-right .done{
        color:#93c5fd;
        font-weight:900;
      }
      .plate-mp-wait-layer{
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
      .plate-mp-wait-card{
        width:min(520px,100%);
        border-radius:24px;
        padding:22px;
        text-align:center;
        color:#f8fafc;
        background:linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.96));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 18px 50px rgba(0,0,0,.38);
      }
      .plate-mp-wait-emoji{
        font-size:42px;
        margin-bottom:8px;
      }
    `;
    document.head.appendChild(style);
  }

  function injectDom() {
    if (el('plateMpMiniHud')) return;

    const hud = document.createElement('div');
    hud.id = 'plateMpMiniHud';
    hud.className = 'plate-mp-mini-hud';
    hud.hidden = true;
    hud.innerHTML = `
      <div class="plate-mp-mini-card">
        <div class="plate-mp-mini-title">Duet Status</div>

        <div class="plate-mp-mini-row">
          <div class="plate-mp-mini-left">
            <span class="plate-mp-role role-a">A</span>
            <span id="plateMpAName">Player A</span>
          </div>
          <div class="plate-mp-mini-right">
            <span id="plateMpAReady" class="wait">รอ</span>
            <strong id="plateMpAScore">0</strong>
          </div>
        </div>

        <div class="plate-mp-mini-row">
          <div class="plate-mp-mini-left">
            <span class="plate-mp-role role-b">B</span>
            <span id="plateMpBName">Player B</span>
          </div>
          <div class="plate-mp-mini-right">
            <span id="plateMpBReady" class="wait">รอ</span>
            <strong id="plateMpBScore">0</strong>
          </div>
        </div>
      </div>
    `;

    const wait = document.createElement('div');
    wait.id = 'plateMpWaitLayer';
    wait.className = 'plate-mp-wait-layer';
    wait.hidden = true;
    wait.innerHTML = `
      <div class="plate-mp-wait-card">
        <div class="plate-mp-wait-emoji">⏳</div>
        <h2 id="plateMpWaitTitle">รอเพื่อนเล่นจบก่อน</h2>
        <p id="plateMpWaitText">เครื่องนี้จบแล้ว กำลังรออีกคนทำให้เสร็จ</p>
      </div>
    `;

    document.body.appendChild(hud);
    document.body.appendChild(wait);
  }

  function showHud(show) {
    const n = el('plateMpMiniHud');
    if (n) n.hidden = !show;
  }

  function showWait(show, title = 'รอเพื่อนเล่นจบก่อน', text = 'เครื่องนี้จบแล้ว กำลังรออีกคนทำให้เสร็จ') {
    const layer = el('plateMpWaitLayer');
    const titleEl = el('plateMpWaitTitle');
    const textEl = el('plateMpWaitText');
    if (!layer) return;
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    layer.hidden = !show;
  }

  function playersFromRoom(room) {
    const players = Object.values(room?.players || {});
    const A = players.find(p => String(p.role || '').toUpperCase() === 'A') || null;
    const B = players.find(p => String(p.role || '').toUpperCase() === 'B') || null;
    return { A, B };
  }

  function readyText(p) {
    if (!p) return 'ยังไม่มี';
    if (p.finished) return 'จบแล้ว';
    return p.ready ? 'พร้อม' : 'รอ';
  }

  function readyClass(p) {
    if (!p) return 'wait';
    if (p.finished) return 'done';
    return p.ready ? 'ok' : 'wait';
  }

  function renderRoom(room) {
    const { A, B } = playersFromRoom(room);

    if (el('plateMpAName')) el('plateMpAName').textContent = A?.name || A?.pid || 'Player A';
    if (el('plateMpBName')) el('plateMpBName').textContent = B?.name || B?.pid || 'Player B';

    if (el('plateMpAReady')) {
      el('plateMpAReady').textContent = readyText(A);
      el('plateMpAReady').className = readyClass(A);
    }
    if (el('plateMpBReady')) {
      el('plateMpBReady').textContent = readyText(B);
      el('plateMpBReady').className = readyClass(B);
    }

    if (el('plateMpAScore')) el('plateMpAScore').textContent = String(Math.round(Number(A?.finalScore || A?.score || 0)));
    if (el('plateMpBScore')) el('plateMpBScore').textContent = String(Math.round(Number(B?.finalScore || B?.score || 0)));

    showHud(true);

    const state = String(room?.meta?.state || '');
    if (state === 'playing' && !started) {
      started = true;
    }

    if (finished) {
      const bothFinished = !!(A?.finished && B?.finished);
      showWait(
        !bothFinished,
        'รอเพื่อนเล่นจบก่อน',
        bothFinished ? 'ครบแล้ว' : 'เครื่องนี้จบแล้ว กำลังรออีกคนทำให้เสร็จ'
      );
    }
  }

  function bindEvents() {
    window.addEventListener('plate:multiplayer-room', ev => {
      const room = ev?.detail?.room || null;
      if (!room) return;
      renderRoom(room);
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
    if (now - lastScoreSyncAt < 120) return;
    lastScoreSyncAt = now;
    try {
      window.PLATE_MP.syncScore(Number(score || 0));
    } catch {}
  }

  async function finish(summary = {}) {
    if (!window.PLATE_MP || finished) return;
    finished = true;

    try {
      await window.PLATE_MP.finish({
        finished: true,
        finishedAt: Date.now(),
        finalScore: Number(summary.score || 0),
        finalStars: Number(summary.stars || 0),
        correct: Number(summary.correct || 0),
        wrong: Number(summary.wrong || 0)
      });
    } catch {}

    showWait(true, 'รอเพื่อนเล่นจบก่อน', 'เครื่องนี้จบแล้ว กำลังรออีกคนทำให้เสร็จ');

    await new Promise(resolve => {
      const off = ev => {
        const room = ev?.detail?.room || null;
        const { A, B } = playersFromRoom(room || {});
        if (A?.finished && B?.finished) {
          window.removeEventListener('plate:multiplayer-room', off);
          resolve();
        }
      };
      window.addEventListener('plate:multiplayer-room', off);

      const roomNow = window.PLATE_MP?.getRoom?.() || null;
      if (roomNow) {
        const { A, B } = playersFromRoom(roomNow);
        if (A?.finished && B?.finished) {
          window.removeEventListener('plate:multiplayer-room', off);
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
    if (room) renderRoom(room);
    setTimeout(() => {
      const r = window.PLATE_MP?.getRoom?.() || null;
      if (r) renderRoom(r);
    }, 400);
  }

  window.PlateDuetMP = {
    waitForGate,
    canRunNow,
    syncScore,
    finish,
    bootstrap
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();