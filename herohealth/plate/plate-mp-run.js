// === /herohealth/plate/plate-mp-run.js ===
// FULL PATCH v20260326-PLATE-MP-RUN-FULL

import {
  readCtx,
  createOrJoinRoom,
  subscribeRoom,
  subscribeRoomActions,
  pushRoomAction,
  roomPlayers,
  roomSlots,
  setReady,
  startRoom,
  leaveRoom,
  canStart,
  updatePlayer,
  isHost,
  buildRunUrl
} from './plate-room.js';

const ctx = readCtx();
const rawSP = new URLSearchParams(location.search);
const rawMode = String(rawSP.get('mode') || '').toLowerCase();
const rawRoomId = String(rawSP.get('roomId') || '').trim();

if (!rawRoomId || !/^(duet|race|battle|coop)$/.test(rawMode)) {
  window.__PLATE_MP_ENABLED__ = false;
  window.__PLATE_MP_LOCKED__ = false;
} else {
  window.__PLATE_MP_ENABLED__ = true;
  window.__PLATE_MP_LOCKED__ = true;
  bootMultiplayer().catch(err => {
    console.error('[PLATE_MP]', err);
  });
}

async function bootMultiplayer() {
  const style = document.createElement('style');
  style.textContent = `
    .plate-mp-root{
      position:fixed;
      inset:0;
      z-index:9999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
      background:rgba(2,6,23,.72);
      backdrop-filter:blur(8px);
    }
    .plate-mp-root.is-hidden{display:none}
    .plate-mp-card{
      width:min(760px,100%);
      border-radius:24px;
      border:1px solid rgba(255,255,255,.12);
      background:linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.96));
      color:#f8fafc;
      box-shadow:0 20px 50px rgba(0,0,0,.38);
      padding:18px;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    }
    .plate-mp-title{
      margin:0 0 6px;
      font-size:clamp(24px,4vw,34px);
      font-weight:900;
    }
    .plate-mp-sub{
      margin:0 0 12px;
      color:#cbd5e1;
      line-height:1.5;
    }
    .plate-mp-grid{
      display:grid;
      gap:12px;
      grid-template-columns:1fr 1fr;
    }
    @media (max-width:720px){
      .plate-mp-grid{grid-template-columns:1fr}
    }
    .plate-mp-box{
      border:1px solid rgba(255,255,255,.1);
      background:rgba(255,255,255,.04);
      border-radius:18px;
      padding:14px;
    }
    .plate-mp-box h3{
      margin:0 0 8px;
      font-size:16px;
    }
    .plate-mp-row{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      border:1px solid rgba(255,255,255,.08);
      border-radius:14px;
      padding:10px 12px;
      margin-top:8px;
      background:rgba(255,255,255,.03);
    }
    .plate-mp-btns{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin-top:14px;
    }
    .plate-mp-btn{
      border:0;
      border-radius:14px;
      padding:12px 14px;
      font-weight:900;
      cursor:pointer;
      color:white;
      background:linear-gradient(180deg, #3b82f6, #1d4ed8);
    }
    .plate-mp-btn.secondary{
      background:linear-gradient(180deg, #334155, #1e293b);
    }
    .plate-mp-btn.green{
      background:linear-gradient(180deg, #22c55e, #15803d);
    }
    .plate-mp-btn.amber{
      background:linear-gradient(180deg, #f59e0b, #d97706);
    }
    .plate-mp-chip{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:7px 10px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.1);
      background:rgba(255,255,255,.06);
      color:#dbeafe;
      font-size:12px;
      font-weight:800;
    }
    .plate-mp-ok{color:#86efac;font-weight:900}
    .plate-mp-wait{color:#fde68a;font-weight:900}
    .plate-mp-bad{color:#fca5a5;font-weight:900}
    .plate-mp-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'plate-mp-root';
  root.innerHTML = `<div class="plate-mp-card" id="plateMpCard">กำลังโหลดห้อง...</div>`;
  document.body.appendChild(root);

  const joined = await createOrJoinRoom(ctx);
  const myCtx = joined.ctx;
  let latestRoom = null;
  let started = false;
  let offRoom = () => {};
  let offActions = () => {};

  function esc(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function copyLink() {
    const url = buildRunUrl(myCtx, {
      mode: myCtx.mode,
      roomId: myCtx.roomId,
      pid: myCtx.pid,
      role: myCtx.role
    });
    return navigator.clipboard.writeText(url);
  }

  function htmlPlayers(room) {
    const mode = String(room?.meta?.mode || '').toLowerCase();

    if (mode === 'duet' || mode === 'battle') {
      const slots = roomSlots(room);
      const row = (label, p) => `
        <div class="plate-mp-row">
          <div>
            <div><strong>${label}</strong></div>
            <div class="plate-mp-mono" style="font-size:12px;color:#cbd5e1">${esc(p?.pid || '-')}</div>
          </div>
          <div>${p ? (p.ready ? `<span class="plate-mp-ok">พร้อม</span>` : `<span class="plate-mp-wait">ยังไม่พร้อม</span>`) : `<span class="plate-mp-bad">ยังไม่มีผู้เล่น</span>`}</div>
        </div>
      `;
      return row('PLAYER A', slots.A) + row('PLAYER B', slots.B);
    }

    return roomPlayers(room).map(p => `
      <div class="plate-mp-row">
        <div>
          <div><strong>${esc(p.name || p.pid)}</strong></div>
          <div class="plate-mp-mono" style="font-size:12px;color:#cbd5e1">${esc(p.pid)}</div>
        </div>
        <div>${p.ready ? `<span class="plate-mp-ok">พร้อม</span>` : `<span class="plate-mp-wait">ยังไม่พร้อม</span>`}</div>
      </div>
    `).join('');
  }

  function render(room) {
    latestRoom = room;
    const me = room?.players?.[myCtx.pid] || null;
    const host = isHost(room, myCtx.pid);
    const readyNow = !!me?.ready;
    const canGo = canStart(room);
    const state = room?.meta?.state || 'lobby';

    window.__PLATE_MP_LOCKED__ = state !== 'playing';
    try {
      window.__PLATE_PAUSE_FOR_MULTIPLAYER__?.(window.__PLATE_MP_LOCKED__);
    } catch {}

    const card = root.querySelector('#plateMpCard');
    card.innerHTML = `
      <h2 class="plate-mp-title">👫 ${esc(myCtx.mode.toUpperCase())} Ready Lobby</h2>
      <p class="plate-mp-sub">
        room <span class="plate-mp-mono">${esc(myCtx.roomId)}</span>
        • state <strong>${esc(state)}</strong>
        • host <span class="plate-mp-mono">${esc(room?.meta?.hostPid || '-')}</span>
      </p>

      <div class="plate-mp-grid">
        <div class="plate-mp-box">
          <h3>สถานะผู้เล่น</h3>
          ${htmlPlayers(room)}
        </div>

        <div class="plate-mp-box">
          <h3>เครื่องนี้</h3>
          <div class="plate-mp-row">
            <div>
              <div><strong>${esc(me?.name || myCtx.pid)}</strong>${myCtx.role ? ` [${esc(myCtx.role)}]` : ''}</div>
              <div class="plate-mp-mono" style="font-size:12px;color:#cbd5e1">${esc(myCtx.pid)}</div>
            </div>
            <div>${readyNow ? `<span class="plate-mp-ok">พร้อมแล้ว</span>` : `<span class="plate-mp-wait">รอพร้อม</span>`}</div>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
            <span class="plate-mp-chip">diff: ${esc(room?.meta?.diff || myCtx.diff)}</span>
            <span class="plate-mp-chip">time: ${esc(room?.meta?.time || myCtx.time)}s</span>
            <span class="plate-mp-chip">seed: ${esc(room?.meta?.seed || myCtx.seed)}</span>
          </div>

          <div class="plate-mp-btns">
            <button class="plate-mp-btn ${readyNow ? 'secondary' : 'green'}" id="mpReadyBtn">
              ${readyNow ? 'ยกเลิกพร้อม' : 'ฉันพร้อม'}
            </button>
            ${host ? `
              <button class="plate-mp-btn ${canGo ? '' : 'secondary'}" id="mpStartBtn">
                เริ่มเกม
              </button>
            ` : ''}
            <button class="plate-mp-btn amber" id="mpCopyBtn">คัดลอกลิงก์เครื่องนี้</button>
            <button class="plate-mp-btn secondary" id="mpLeaveBtn">ออกจากห้อง</button>
          </div>
        </div>
      </div>

      <div style="margin-top:12px;color:#cbd5e1;font-size:13px">
        ${state === 'playing'
          ? 'เริ่มเกมแล้ว กำลังปลดล็อกหน้าเล่น...'
          : 'ทุกคนต้องพร้อมก่อน แล้ว host ค่อยกดเริ่มเกม'}
      </div>
    `;

    const readyBtn = card.querySelector('#mpReadyBtn');
    const startBtn = card.querySelector('#mpStartBtn');
    const copyBtn = card.querySelector('#mpCopyBtn');
    const leaveBtn = card.querySelector('#mpLeaveBtn');

    readyBtn?.addEventListener('click', async () => {
      try {
        await setReady(myCtx.roomId, myCtx.pid, !readyNow);
      } catch (e) {
        console.error(e);
      }
    });

    startBtn?.addEventListener('click', async () => {
      try {
        await startRoom(myCtx.roomId, myCtx.pid);
      } catch (e) {
        alert(
          e?.message === 'room-not-ready'
            ? 'ผู้เล่นยังไม่พร้อมครบ'
            : 'เริ่มเกมไม่ได้'
        );
      }
    });

    copyBtn?.addEventListener('click', async () => {
      try {
        await copyLink();
        copyBtn.textContent = 'คัดลอกแล้ว';
        setTimeout(() => copyBtn.textContent = 'คัดลอกลิงก์เครื่องนี้', 1200);
      } catch {
        copyBtn.textContent = 'คัดลอกไม่สำเร็จ';
      }
    });

    leaveBtn?.addEventListener('click', async () => {
      try { await leaveRoom(myCtx.roomId, myCtx.pid); } catch {}
      location.href = myCtx.hub || '../hub.html';
    });

    if (state === 'playing' && !started) {
      started = true;
      root.classList.add('is-hidden');
      window.__PLATE_MP_LOCKED__ = false;
      window.dispatchEvent(
        new CustomEvent('plate:multiplayer-start', {
          detail: { ctx: myCtx, room }
        })
      );
    } else if (state !== 'playing') {
      root.classList.remove('is-hidden');
    }
  }

  offRoom = subscribeRoom(myCtx.roomId, room => {
    const safeRoom = room || { meta: {}, players: {} };
    render(safeRoom);

    window.dispatchEvent(
      new CustomEvent('plate:multiplayer-room', {
        detail: { ctx: myCtx, room: safeRoom }
      })
    );
  });

  offActions = subscribeRoomActions(myCtx.roomId, action => {
    if (!action) return;
    if (action.pid === myCtx.pid) return;

    window.dispatchEvent(
      new CustomEvent('plate:multiplayer-action', {
        detail: { ctx: myCtx, action }
      })
    );
  });

  window.addEventListener('beforeunload', () => {
    try { leaveRoom(myCtx.roomId, myCtx.pid); } catch {}
    try { offRoom?.(); } catch {}
    try { offActions?.(); } catch {}
  });

  window.PLATE_MP = {
    ctx: myCtx,
    getRoom: () => latestRoom,
    getMe() {
      const room = latestRoom || {};
      return room?.players?.[myCtx.pid] || null;
    },
    getRole() {
      return myCtx.role || '';
    },
    isLocked() {
      return !!window.__PLATE_MP_LOCKED__;
    },
    async setReady(v) {
      return setReady(myCtx.roomId, myCtx.pid, !!v);
    },
    async syncScore(score) {
      return updatePlayer(myCtx.roomId, myCtx.pid, { score: Number(score) || 0 });
    },
    async syncContribution(contribution) {
      return updatePlayer(myCtx.roomId, myCtx.pid, { contribution: Number(contribution) || 0 });
    },
    async syncHp(hp) {
      return updatePlayer(myCtx.roomId, myCtx.pid, { hp: Number(hp) || 0 });
    },
    async sendAction(type, payload = {}) {
      return pushRoomAction(myCtx.roomId, {
        type,
        pid: myCtx.pid,
        role: myCtx.role || '',
        ...payload,
        ts: Date.now()
      });
    },
    async finish(payload = {}) {
      return updatePlayer(myCtx.roomId, myCtx.pid, {
        finished: true,
        ...payload
      });
    }
  };
}