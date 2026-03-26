// === /herohealth/plate/plate-coop-mp-bind.js ===
// FULL PATCH v20260326-PLATE-COOP-MP-BIND-FULL

(function () {
  'use strict';

  let lastScoreSyncAt = 0;
  let lastContributionSyncAt = 0;
  let finished = false;
  let started = false;
  let lastRoom = null;
  const sp = new URLSearchParams(location.search);
  let teamGoal = Math.max(1, Number(sp.get('teamGoal') || sp.get('goal') || 100));

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
    if (document.getElementById('plateCoopMpStyle')) return;
    const style = document.createElement('style');
    style.id = 'plateCoopMpStyle';
    style.textContent = `
      .plate-coop-mp-hud{
        position:fixed;
        top:max(12px, env(safe-area-inset-top));
        right:12px;
        z-index:85;
        pointer-events:none;
      }
      .plate-coop-mp-card{
        width:min(320px, calc(100vw - 24px));
        border-radius:18px;
        padding:12px;
        color:#f8fafc;
        background:linear-gradient(180deg, rgba(15,23,42,.94), rgba(2,6,23,.94));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 14px 34px rgba(0,0,0,.34);
        backdrop-filter:blur(8px);
      }
      .plate-coop-mp-title{
        font-size:13px;
        font-weight:900;
        color:#dbeafe;
        margin-bottom:8px;
      }
      .plate-coop-mp-room{
        font-size:11px;
        color:#94a3b8;
        font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
        margin-bottom:8px;
      }
      .plate-coop-mp-goal{
        font-size:12px;
        color:#cbd5e1;
        margin-bottom:8px;
      }
      .plate-coop-mp-bar{
        height:12px;
        border-radius:999px;
        background:rgba(255,255,255,.08);
        overflow:hidden;
        border:1px solid rgba(255,255,255,.08);
        margin-bottom:10px;
      }
      .plate-coop-mp-fill{
        height:100%;
        width:0%;
        background:linear-gradient(90deg,#22c55e,#3b82f6);
      }
      .plate-coop-mp-team{
        margin-bottom:10px;
        padding:8px 10px;
        border-radius:12px;
        background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.08);
        font-size:12px;
        color:#cbd5e1;
      }
      .plate-coop-mp-list{
        display:grid;
        gap:8px;
      }
      .plate-coop-mp-row{
        display:grid;
        grid-template-columns:1fr auto;
        gap:10px;
        align-items:center;
        padding:9px 10px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.04);
      }
      .plate-coop-mp-row.me{
        border-color:rgba(34,197,94,.48);
        background:rgba(34,197,94,.08);
      }
      .plate-coop-mp-name strong{
        display:block;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        font-size:13px;
      }
      .plate-coop-mp-meta{
        font-size:11px;
        color:#cbd5e1;
      }
      .plate-coop-mp-right{
        text-align:right;
        display:grid;
        gap:4px;
      }
      .plate-coop-mp-score{
        font-size:14px;
        font-weight:900;
      }
      .plate-coop-mp-badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:3px 8px;
        border-radius:999px;
        font-size:11px;
        font-weight:900;
      }
      .plate-coop-mp-badge.ready{
        color:#052e16;
        background:#86efac;
      }
      .plate-coop-mp-badge.wait{
        color:#78350f;
        background:#fde68a;
      }
      .plate-coop-mp-badge.done{
        color:#082f49;
        background:#93c5fd;
      }
      .plate-coop-mp-wait-layer{
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
      .plate-coop-mp-wait-card{
        width:min(520px,100%);
        border-radius:24px;
        padding:22px;
        text-align:center;
        color:#f8fafc;
        background:linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.96));
        border:1px solid rgba(255,255,255,.12);
        box-shadow:0 18px 50px rgba(0,0,0,.38);
      }
      .plate-coop-mp-wait-emoji{
        font-size:42px;
        margin-bottom:8px;
      }
    `;
    document.head.appendChild(style);
  }

  function injectDom() {
    if (el('plateCoopMpHud')) return;

    const hud = document.createElement('div');
    hud.id = 'plateCoopMpHud';
    hud.className = 'plate-coop-mp-hud';
    hud.hidden = true;
    hud.innerHTML = `
      <div class="plate-coop-mp-card">
        <div class="plate-coop-mp-title">🤝 Coop Team Status</div>
        <div id="plateCoopMpRoom" class="plate-coop-mp-room">room -</div>
        <div id="plateCoopMpGoal" class="plate-coop-mp-goal">goal 0 / 0</div>

        <div class="plate-coop-mp-bar">
          <div id="plateCoopMpFill" class="plate-coop-mp-fill"></div>
        </div>

        <div id="plateCoopMpTeam" class="plate-coop-mp-team">
          Team Score <strong id="plateCoopMpTeamScore">0</strong> • Team Progress <strong id="plateCoopMpTeamProgress">0</strong>
        </div>

        <div id="plateCoopMpList" class="plate-coop-mp-list"></div>
      </div>
    `;

    const wait = document.createElement('div');
    wait.id = 'plateCoopMpWaitLayer';
    wait.className = 'plate-coop-mp-wait-layer';
    wait.hidden = true;
    wait.innerHTML = `
      <div class="plate-coop-mp-wait-card">
        <div class="plate-coop-mp-wait-emoji">⏳</div>
        <h2 id="plateCoopMpWaitTitle">รอสมาชิกทีม</h2>
        <p id="plateCoopMpWaitText">เครื่องนี้จบแล้ว กำลังรอผลทีมสุดท้าย</p>
      </div>
    `;

    document.body.appendChild(hud);
    document.body.appendChild(wait);
  }

  function roomPlayers(room) {
    return Object.values(room?.players || {})
      .filter(Boolean)
      .filter(p => p.online !== false);
  }

  function showHud(show) {
    const n = el('plateCoopMpHud');
    if (n) n.hidden = !show;
  }

  function showWait(show, title = 'รอสมาชิกทีม', text = 'เครื่องนี้จบแล้ว กำลังรอผลทีมสุดท้าย') {
    const layer = el('plateCoopMpWaitLayer');
    if (!layer) return;
    if (el('plateCoopMpWaitTitle')) el('plateCoopMpWaitTitle').textContent = title;
    if (el('plateCoopMpWaitText')) el('plateCoopMpWaitText').textContent = text;
    layer.hidden = !show;
  }

  function badge(p) {
    if (!p) return { text: 'รอ', cls: 'wait' };
    if (p.finished) return { text: 'จบแล้ว', cls: 'done' };
    if (p.ready) return { text: 'พร้อม', cls: 'ready' };
    return { text: 'รอ', cls: 'wait' };
  }

  function render(room) {
    lastRoom = room || null;
    if (!room) return;

    const arr = roomPlayers(room).sort((a, b) => {
      return (Number(b.contribution || 0) - Number(a.contribution || 0))
        || (Number(b.finalScore || b.score || 0) - Number(a.finalScore || a.score || 0))
        || (Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
    });

    const mePid = window.PLATE_MP?.ctx?.pid || '';
    const teamProgress = arr.reduce((sum, p) => sum + Number(p.contribution || 0), 0);
    const teamScore = arr.reduce((sum, p) => sum + Number(p.finalScore || p.score || 0), 0);
    const pct = Math.max(0, Math.min(100, (teamProgress / teamGoal) * 100));

    if (el('plateCoopMpRoom')) el('plateCoopMpRoom').textContent = `room ${room?.meta?.roomId || '-'}`;
    if (el('plateCoopMpGoal')) el('plateCoopMpGoal').textContent = `goal ${Math.round(teamProgress)} / ${Math.round(teamGoal)}`;
    if (el('plateCoopMpTeamScore')) el('plateCoopMpTeamScore').textContent = String(Math.round(teamScore));
    if (el('plateCoopMpTeamProgress')) el('plateCoopMpTeamProgress').textContent = String(Math.round(teamProgress));
    if (el('plateCoopMpFill')) el('plateCoopMpFill').style.width = `${pct}%`;

    const list = el('plateCoopMpList');
    if (list) {
      list.innerHTML = arr.map(p => {
        const isMe = p.pid === mePid;
        const b = badge(p);
        const contribution = Math.round(Number(p.contribution || 0));
        const score = Math.round(Number(p.finalScore || p.score || 0));

        return `
          <div class="plate-coop-mp-row ${isMe ? 'me' : ''}">
            <div class="plate-coop-mp-name">
              <strong>${esc(p.name || p.pid || 'player')}</strong>
              <div class="plate-coop-mp-meta">contribution ${contribution} • score ${score}</div>
            </div>
            <div class="plate-coop-mp-right">
              <div class="plate-coop-mp-score">${contribution}</div>
              <span class="plate-coop-mp-badge ${b.cls}">${b.text}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    showHud(true);

    const state = String(room?.meta?.state || '');
    if (state === 'playing' && !started) started = true;

    if (finished) {
      const active = roomPlayers(room);
      const allFinished = active.length >= 2 && active.every(p => !!p.finished);
      showWait(
        !allFinished,
        'รอสมาชิกทีม',
        allFinished
          ? (teamProgress >= teamGoal ? 'ทีมทำเป้าครบแล้ว' : 'ครบทุกคนแล้ว กำลังสรุปผล')
          : 'เครื่องนี้จบแล้ว กำลังรอผลทีมสุดท้าย'
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
    if (now - lastScoreSyncAt < 120) return;
    lastScoreSyncAt = now;
    try {
      window.PLATE_MP.syncScore(Number(score || 0));
    } catch {}
  }

  function syncContribution(value) {
    if (!window.PLATE_MP) return;
    const now = Date.now();
    if (now - lastContributionSyncAt < 120) return;
    lastContributionSyncAt = now;
    try {
      window.PLATE_MP.syncContribution(Number(value || 0));
    } catch {}
  }

  async function finishCoop(summary = {}) {
    if (!window.PLATE_MP || finished) return;
    finished = true;

    try {
      await window.PLATE_MP.finish({
        finished: true,
        finishedAt: Date.now(),
        finalScore: Number(summary.score || 0),
        contribution: Number(summary.contribution || summary.progress || 0)
      });
    } catch {}

    showWait(true, 'รอสมาชิกทีม', 'เครื่องนี้จบแล้ว กำลังรอผลทีมสุดท้าย');

    await new Promise(resolve => {
      const handler = ev => {
        const room = ev?.detail?.room || null;
        const active = roomPlayers(room || {});
        const allFinished = active.length >= 2 && active.every(p => !!p.finished);
        if (allFinished) {
          window.removeEventListener('plate:multiplayer-room', handler);
          resolve();
        }
      };

      window.addEventListener('plate:multiplayer-room', handler);

      const roomNow = window.PLATE_MP?.getRoom?.() || lastRoom || null;
      if (roomNow) {
        const active = roomPlayers(roomNow);
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

  function setGoal(v) {
    teamGoal = Math.max(1, Number(v || 100));
    const room = window.PLATE_MP?.getRoom?.() || lastRoom || null;
    if (room) render(room);
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

  window.PlateCoopMP = {
    waitForGate,
    canRunNow,
    syncScore,
    syncContribution,
    finish: finishCoop,
    bootstrap,
    setGoal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();