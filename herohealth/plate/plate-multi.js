// === /herohealth/plate/plate-multi.js ===
// FULL PATCH v20260326-PLATE-MULTI-CALLER-FULL

import {
  readCtx,
  createOrJoinRoom,
  subscribeRoom,
  roomPlayers,
  roomSlots,
  buildRunUrl,
  makeRoomId,
  makePid
} from './plate-room.js';

const $ = sel => document.querySelector(sel);

const els = {
  mode: $('#mode'),
  roomId: $('#roomId'),
  pid: $('#pid'),
  name: $('#name'),
  diff: $('#diff'),
  time: $('#time'),
  seed: $('#seed'),
  view: $('#view'),
  hub: $('#hub'),
  game: $('#game'),
  theme: $('#theme'),
  cooldown: $('#cooldown'),

  btnCreate: $('#btnCreate'),
  btnJoin: $('#btnJoin'),
  btnRandomSeed: $('#btnRandomSeed'),

  btnBackModes: $('#btnBackModes'),
  btnBackHub: $('#btnBackHub'),

  roomBadge: $('#roomBadge'),
  stateBadge: $('#stateBadge'),
  hostBadge: $('#hostBadge'),

  players: $('#players'),
  links: $('#links')
};

let offRoom = () => {};
let currentCtx = null;
let currentRoom = null;

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function copyText(text) {
  return navigator.clipboard.writeText(String(text || ''));
}

function setDefaultsFromQuery() {
  const ctx = readCtx();
  const sp = new URLSearchParams(location.search);

  els.mode.value = ctx.mode || 'duet';
  els.roomId.value = sp.get('roomId') || '';
  els.pid.value = sp.get('pid') || makePid();
  els.name.value = sp.get('name') || '';
  els.diff.value = ctx.diff || 'normal';
  els.time.value = String(ctx.time || 90);
  els.seed.value = ctx.seed || String(Date.now());
  els.view.value = ctx.view || 'mobile';
  els.hub.value = ctx.hub || 'https://supparang.github.io/webxr-health-mobile/herohealth/hub.html';
  els.game.value = ctx.game || 'platev1';
  els.theme.value = ctx.theme || 'platev1';
  els.cooldown.value = ctx.cooldown || '1';

  els.btnBackModes.href = new URL('./plate-modes.html', location.href).toString();
  els.btnBackHub.href = ctx.hub || '../hub.html';
}

function readForm() {
  return readCtx({
    mode: els.mode.value,
    roomId: (els.roomId.value || '').trim().toUpperCase() || makeRoomId('PLT'),
    pid: (els.pid.value || '').trim() || makePid(),
    name: (els.name.value || '').trim(),
    diff: els.diff.value,
    time: Number(els.time.value || 90),
    seed: (els.seed.value || '').trim() || String(Date.now()),
    view: els.view.value,
    hub: (els.hub.value || '').trim(),
    game: (els.game.value || '').trim() || 'platev1',
    theme: (els.theme.value || '').trim() || 'platev1',
    cooldown: els.cooldown.value
  });
}

function renderBadges(room) {
  els.roomBadge.textContent = room?.meta?.roomId || '-';
  els.stateBadge.textContent = room?.meta?.state || '-';
  els.hostBadge.textContent = room?.meta?.hostPid || '-';
}

function renderPlayers(room) {
  const ps = roomPlayers(room);
  if (!ps.length) {
    els.players.innerHTML = `<div class="tiny">ยังไม่มีผู้เล่นในห้อง</div>`;
    return;
  }

  els.players.innerHTML = ps.map(p => {
    const role = p.role ? ` [${esc(p.role)}]` : '';
    const ready = p.ready ? `<span class="ok">พร้อม</span>` : `<span class="wait">ยังไม่พร้อม</span>`;
    const online = p.online === false ? `<span class="bad">offline</span>` : `<span class="ok">online</span>`;

    return `
      <div class="player">
        <div>
          <div><strong>${esc(p.name || p.pid)}</strong>${role}</div>
          <div class="tiny mono">${esc(p.pid)}</div>
        </div>
        <div style="text-align:right">
          <div>${ready}</div>
          <div class="tiny">${online}</div>
        </div>
      </div>
    `;
  }).join('');
}

function makeLinkBox(title, url, note = '') {
  return `
    <div class="outbox">
      <div><strong>${esc(title)}</strong></div>
      ${note ? `<div class="tiny">${esc(note)}</div>` : ''}
      <div class="mono tiny">${esc(url)}</div>
      <div class="row">
        <button class="btn btn-blue" data-copy="${esc(url)}" type="button">คัดลอกลิงก์</button>
        <a class="btn btn-ghost" href="${esc(url)}" target="_blank" rel="noreferrer">เปิดลิงก์</a>
      </div>
    </div>
  `;
}

function renderLinks(room, ctx) {
  if (!room || !ctx) {
    els.links.innerHTML = `<div class="tiny">ยังไม่มีลิงก์</div>`;
    return;
  }

  const mode = String(room?.meta?.mode || ctx.mode || '').toLowerCase();
  const out = [];

  if (mode === 'duet' || mode === 'battle') {
    const linkA = buildRunUrl({ ...ctx, role: 'A' }, { mode, role: 'A', pid: 'plateA01' });
    const linkB = buildRunUrl({ ...ctx, role: 'B' }, { mode, role: 'B', pid: 'plateB01' });

    out.push(makeLinkBox(
      `${mode.toUpperCase()} — Player A`,
      linkA,
      'ใช้เปิดในเครื่องของ Player A'
    ));
    out.push(makeLinkBox(
      `${mode.toUpperCase()} — Player B`,
      linkB,
      'ใช้เปิดในเครื่องของ Player B'
    ));
  } else {
    const hostLink = buildRunUrl(ctx, { mode, pid: ctx.pid });
    const joinLink = buildRunUrl(ctx, { mode, pid: 'plateJoin01' });

    out.push(makeLinkBox(
      `${mode.toUpperCase()} — Host`,
      hostLink,
      'ลิงก์ของเครื่องที่กำลังสร้างห้อง'
    ));
    out.push(makeLinkBox(
      `${mode.toUpperCase()} — Join Link`,
      joinLink,
      'แจกให้เพื่อนอีกเครื่องเข้าห้องเดียวกัน'
    ));
  }

  if (mode === 'duet' || mode === 'battle') {
    const slots = roomSlots(room);
    out.push(`
      <div class="outbox">
        <div><strong>slot status</strong></div>
        <div class="tiny">A: <span class="mono">${esc(slots.A?.pid || '-')}</span></div>
        <div class="tiny">B: <span class="mono">${esc(slots.B?.pid || '-')}</span></div>
      </div>
    `);
  }

  els.links.innerHTML = out.join('');

  els.links.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await copyText(btn.getAttribute('data-copy') || '');
        btn.textContent = 'คัดลอกแล้ว';
        setTimeout(() => { btn.textContent = 'คัดลอกลิงก์'; }, 1200);
      } catch {
        btn.textContent = 'คัดลอกไม่สำเร็จ';
      }
    });
  });
}

async function connectRoom(ctx) {
  offRoom();

  const joined = await createOrJoinRoom(ctx);
  currentCtx = joined.ctx;

  const url = new URL(location.href);
  url.searchParams.set('roomId', currentCtx.roomId);
  url.searchParams.set('mode', currentCtx.mode);
  url.searchParams.set('pid', currentCtx.pid);
  url.searchParams.set('name', currentCtx.name || '');
  history.replaceState({}, '', url.toString());

  offRoom = subscribeRoom(currentCtx.roomId, room => {
    currentRoom = room;
    renderBadges(room);
    renderPlayers(room);
    renderLinks(room, currentCtx);
  });
}

async function onCreate() {
  const ctx = readForm();
  if (!ctx.roomId) ctx.roomId = makeRoomId('PLT');
  els.roomId.value = ctx.roomId;
  await connectRoom(ctx);
}

async function onJoin() {
  const ctx = readForm();
  if (!ctx.roomId) {
    alert('ใส่ roomId ก่อนเข้าห้อง');
    return;
  }
  await connectRoom(ctx);
}

function boot() {
  setDefaultsFromQuery();

  if (!els.seed.value) els.seed.value = String(Date.now());

  els.btnRandomSeed.addEventListener('click', () => {
    els.seed.value = String(Date.now());
  });

  els.btnCreate.addEventListener('click', onCreate);
  els.btnJoin.addEventListener('click', onJoin);

  const initialRoom = new URL(location.href).searchParams.get('roomId');
  if (initialRoom) {
    onJoin().catch(console.error);
  }
}

boot();