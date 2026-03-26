(function(){
  'use strict';

  const qs = new URLSearchParams(location.search);

  const GAME = 'goodjunk';
  const MODE = 'duet';
  const MAX_PLAYERS = 2;
  const MIN_READY = 2;

  const $ = (id) => document.getElementById(id);

  const ui = {
    roomCode: $('roomCode'),
    playerCount: $('playerCount'),
    roomStatus: $('roomStatus'),
    hostName: $('hostName'),
    copyState: $('copyState'),
    joinGuard: $('joinGuard'),
    inviteLink: $('inviteLink'),
    qrBox: $('qrBox'),
    countdown: $('countdown'),
    playersBox: $('playersBox'),
    hint: $('hint'),

    btnCopyRoom: $('btnCopyRoom'),
    btnCopyInvite: $('btnCopyInvite'),
    btnReady: $('btnReady'),
    btnUnready: $('btnUnready'),
    btnStart: $('btnStart'),
    btnBack: $('btnBack')
  };

  const hubUrl = qs.get('hub') || '../hub.html';

  function txt(v){ return String(v ?? '').trim(); }
  function clamp(n, min, max){
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function randRoom(){
    const pool = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = 'DUO-';
    for (let i = 0; i < 4; i++) s += pool[Math.floor(Math.random() * pool.length)];
    return s;
  }

  function makeDevicePid(){
    try{
      const KEY = 'GJ_DEVICE_PID';
      let pid = localStorage.getItem(KEY);
      if (!pid){
        pid = `p-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(KEY, pid);
      }
      return pid;
    }catch(_){
      return `p-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function normalizePid(raw){
    const v = txt(raw).replace(/[.#$[\]/]/g,'-');
    if (!v) return makeDevicePid();
    if (v.toLowerCase() === 'anon') return makeDevicePid();
    return v.slice(0, 80);
  }

  function normalizeName(raw){
    return txt(raw).replace(/\s+/g,' ').slice(0, 40) || 'Player';
  }

  const SELF = {
    pid: normalizePid(qs.get('pid') || ''),
    name: normalizeName(qs.get('name') || 'Player'),
    view: txt(qs.get('view') || 'mobile').toLowerCase() || 'mobile'
  };

  const ROOM_ID = txt(qs.get('roomId') || qs.get('room') || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g,'')
    .slice(0, 40) || randRoom();

  const DIFF = txt(qs.get('diff') || 'normal').toLowerCase() || 'normal';
  const TIME_SEC = clamp(qs.get('time') || 120, 15, 900);

  let roomState = null;
  let stopWatchRoom = null;
  let heartbeatTimer = null;
  let countdownTimer = null;
  let destroyed = false;

  function backLauncherUrl(){
    const u = new URL('./goodjunk-launcher.html', location.href);
    [
      'pid','name','hub','run','diff','time','studyId','phase','conditionGroup',
      'view','api','log','debug','ai'
    ].forEach(k => {
      const v = qs.get(k);
      if (v != null && v !== '') u.searchParams.set(k, v);
    });
    u.searchParams.set('hub', hubUrl);
    return u.toString();
  }

  function runUrl(){
    const u = new URL('./goodjunk-duet-run.html', location.href);
    [
      'pid','name','hub','run','diff','time','studyId','phase','conditionGroup',
      'view','api','log','debug','ai','seed'
    ].forEach(k => {
      const v = qs.get(k);
      if (v != null && v !== '') u.searchParams.set(k, v);
    });
    u.searchParams.set('roomId', ROOM_ID);
    u.searchParams.set('mode', MODE);
    u.searchParams.set('hub', hubUrl);
    return u.toString();
  }

  function inviteUrl(){
    const u = new URL(location.href);
    u.searchParams.set('roomId', ROOM_ID);
    u.searchParams.set('mode', MODE);
    u.searchParams.set('hub', hubUrl);
    u.searchParams.set('diff', DIFF);
    u.searchParams.set('time', TIME_SEC);
    return u.toString();
  }

  function renderQr(url){
    if (!url) {
      ui.qrBox.innerHTML = '<div class="qr-empty">ยังไม่มีลิงก์</div>';
      return;
    }
    const img = new Image();
    img.alt = 'QR';
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
    ui.qrBox.innerHTML = '';
    ui.qrBox.appendChild(img);
  }

  async function copyText(value){
    try{
      await navigator.clipboard.writeText(String(value || ''));
      return true;
    }catch(_){
      try{
        const ta = document.createElement('textarea');
        ta.value = String(value || '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return !!ok;
      }catch(_2){
        return false;
      }
    }
  }

  function getPlayers(room){
    const playersObj = room?.players || {};
    return Object.values(playersObj).sort((a,b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));
  }

  function getReadyCount(room){
    return getPlayers(room).filter(p => !!p.ready).length;
  }

  function getHostPid(room){
    return txt(room?.meta?.hostPlayerId || '');
  }

  function getSelf(room){
    return (room?.players || {})[SELF.pid] || null;
  }

  function isHost(room){
    return getHostPid(room) === SELF.pid;
  }

  function canStart(room){
    if (!room) return false;
    const players = getPlayers(room);
    const readyCount = getReadyCount(room);
    const phase = txt(room?.match?.phase || room?.meta?.status || 'lobby');
    return isHost(room) && players.length === 2 && readyCount === 2 && (phase === 'lobby' || phase === 'waiting');
  }

  function renderPlayers(room){
    const players = getPlayers(room);
    if (!players.length) {
      ui.playersBox.innerHTML = `<div class="player">ยังไม่มีผู้เล่น</div><div class="player">รอผู้เล่นคนที่ 2</div>`;
      return;
    }

    const cards = [];
    for (let i = 0; i < 2; i++) {
      const p = players[i];
      if (!p) {
        cards.push(`
          <div class="player">
            <div style="font-size:18px;font-weight:900;">ช่องว่าง</div>
            <div class="muted" style="margin-top:6px;">รอผู้เล่นคนที่ 2 เข้าห้อง</div>
            <div class="waiting" style="margin-top:10px;">WAITING</div>
          </div>
        `);
        continue;
      }

      const me = p.playerId === SELF.pid;
      const readyCls = p.ready ? 'ready' : (p.online === false ? 'offline' : 'waiting');
      const readyText = p.online === false ? 'OFFLINE' : (p.ready ? 'READY' : 'WAITING');

      cards.push(`
        <div class="player ${me ? 'me' : ''}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div style="font-size:18px;font-weight:900;">${escapeHtml(p.name || p.playerId)} ${me ? '<span style="color:#fbcfe8;font-size:12px;">(คุณ)</span>' : ''}</div>
            <div style="font-size:12px;font-weight:900;color:${p.playerId === getHostPid(room) ? '#fbcfe8' : '#94a3b8'};">${p.playerId === getHostPid(room) ? 'HOST' : 'PLAYER'}</div>
          </div>
          <div class="muted" style="margin-top:6px;">PID: ${escapeHtml(p.playerId || '-')}</div>
          <div class="${readyCls}" style="margin-top:10px;">${readyText}</div>
        </div>
      `);
    }

    ui.playersBox.innerHTML = cards.join('');
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');
  }

  function render(room){
    roomState = room || null;

    ui.roomCode.textContent = ROOM_ID;
    ui.inviteLink.value = inviteUrl();
    renderQr(inviteUrl());

    if (!room) {
      ui.playerCount.textContent = '0/2';
      ui.roomStatus.textContent = 'loading';
      ui.hostName.textContent = '-';
      ui.hint.textContent = 'กำลังโหลดห้อง...';
      renderPlayers(null);
      return;
    }

    const players = getPlayers(room);
    const readyCount = getReadyCount(room);
    const hostName = txt(room?.meta?.hostName || '-');
    const phase = txt(room?.match?.phase || room?.meta?.status || 'lobby');

    ui.playerCount.textContent = `${players.length}/2`;
    ui.roomStatus.textContent = phase;
    ui.hostName.textContent = hostName || '-';

    ui.btnReady.disabled = !getSelf(room) || !!getSelf(room)?.ready || phase !== 'lobby';
    ui.btnUnready.disabled = !getSelf(room) || !getSelf(room)?.ready || phase !== 'lobby';
    ui.btnStart.disabled = !canStart(room);

    if (players.length >= 2 && !getSelf(room)) {
      ui.joinGuard.style.display = 'block';
      ui.joinGuard.textContent = 'ห้องนี้เต็มแล้ว';
    } else {
      ui.joinGuard.style.display = 'none';
    }

    if (phase === 'countdown') {
      ui.hint.textContent = 'เริ่มเกมในอีกไม่กี่วินาที...';
    } else if (canStart(room)) {
      ui.hint.textContent = 'พร้อมครบ 2 คนแล้ว Host กดเริ่มได้เลย';
    } else if (players.length < 2) {
      ui.hint.textContent = 'รอผู้เล่นคนที่ 2 เข้าห้อง';
    } else if (readyCount < 2) {
      ui.hint.textContent = 'ต้อง ready ครบ 2 คนก่อนเริ่ม Duet';
    } else {
      ui.hint.textContent = 'กำลังรอ...';
    }

    renderPlayers(room);
    maybeFollow(room);
  }

  function maybeFollow(room){
    const phase = txt(room?.match?.phase || room?.meta?.status || '');
    if (phase === 'playing') {
      location.href = runUrl();
    }
  }

  async function ensureRoom(){
    const room = await HHAMulti.readRoom(GAME, MODE, ROOM_ID);

    if (!room) {
      await HHAMulti.createRoom({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        hostPlayerId: SELF.pid,
        hostName: SELF.name,
        diff: DIFF,
        timeSec: TIME_SEC,
        view: SELF.view,
        pid: SELF.pid,
        maxPlayers: 2
      });

      const ref = HHAMulti.rootRef(GAME, MODE, ROOM_ID);
      await ref.child('meta/minReady').set(MIN_READY);
      await ref.child('meta/runUrl').set(runUrl());
      return;
    }

    const players = room.players || {};
    const ids = Object.keys(players);

    if (!players[SELF.pid]) {
      if (ids.length >= 2) throw new Error('room-full');

      await HHAMulti.joinRoom({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        playerId: SELF.pid,
        name: SELF.name,
        view: SELF.view,
        pid: SELF.pid
      });
    } else {
      await HHAMulti.rootRef(GAME, MODE, ROOM_ID).child(`players/${SELF.pid}`).update({
        name: SELF.name,
        online: true,
        lastSeenAt: Date.now(),
        view: SELF.view,
        pid: SELF.pid
      });
    }
  }

  async function setReady(v){
    await HHAMulti.setReady({
      game: GAME,
      mode: MODE,
      roomCode: ROOM_ID,
      playerId: SELF.pid,
      ready: !!v
    });
  }

  async function startDuet(){
    if (!canStart(roomState)) return;

    const ref = HHAMulti.rootRef(GAME, MODE, ROOM_ID);
    await ref.child('meta/runUrl').set(runUrl());
    await ref.child('meta/minReady').set(MIN_READY);

    await HHAMulti.startMatch({
      game: GAME,
      mode: MODE,
      roomCode: ROOM_ID,
      playerId: SELF.pid,
      countdownSec: 3
    });

    let left = 3;
    ui.countdown.textContent = String(left);

    clearInterval(countdownTimer);
    countdownTimer = setInterval(async () => {
      left -= 1;
      ui.countdown.textContent = left > 0 ? String(left) : 'GO!';
      if (left <= 0) {
        clearInterval(countdownTimer);
        setTimeout(() => { ui.countdown.textContent = ''; }, 500);
        try{
          await HHAMulti.promoteCountdownToPlaying({
            game: GAME,
            mode: MODE,
            roomCode: ROOM_ID
          });
        }catch(_){}
      }
    }, 1000);
  }

  function watchRoom(){
    if (stopWatchRoom) {
      try{ stopWatchRoom(); }catch(_){}
    }

    stopWatchRoom = HHAMulti.watchRoom(
      { game: GAME, mode: MODE, roomCode: ROOM_ID },
      (room) => render(room),
      (err) => {
        console.error(err);
        ui.hint.textContent = `เชื่อมห้องไม่สำเร็จ: ${err?.message || err}`;
      }
    );
  }

  function startHeartbeat(){
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (destroyed) return;
      HHAMulti.heartbeat({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        playerId: SELF.pid
      }).catch(() => {});
    }, 2500);
  }

  async function leaveLobby(){
    try{
      await HHAMulti.setOffline({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        playerId: SELF.pid
      });
      await HHAMulti.leaveRoom({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        playerId: SELF.pid
      });
    }catch(_){}
    location.href = backLauncherUrl();
  }

  function bind(){
    ui.btnCopyRoom.addEventListener('click', async () => {
      const ok = await copyText(ROOM_ID);
      ui.copyState.textContent = ok ? 'คัดลอก Room Code แล้ว' : 'คัดลอกไม่สำเร็จ';
    });

    ui.btnCopyInvite.addEventListener('click', async () => {
      const ok = await copyText(inviteUrl());
      ui.copyState.textContent = ok ? 'คัดลอก Invite Link แล้ว' : 'คัดลอกไม่สำเร็จ';
    });

    ui.btnReady.addEventListener('click', () => setReady(true).catch(console.error));
    ui.btnUnready.addEventListener('click', () => setReady(false).catch(console.error));
    ui.btnStart.addEventListener('click', () => startDuet().catch(console.error));
    ui.btnBack.addEventListener('click', leaveLobby);
  }

  async function boot(){
    try{
      if (!window.firebase || !window.firebase.database) throw new Error('firebase-database not loaded');
      if (!window.HHAMulti) throw new Error('HHAMulti not loaded');

      bind();
      render(null);
      await ensureRoom();
      watchRoom();
      startHeartbeat();

    }catch(err){
      console.error(err);
      ui.hint.textContent = `เชื่อมห้องไม่สำเร็จ: ${err?.message || err}`;
      if (String(err?.message || '').includes('room-full')) {
        ui.joinGuard.style.display = 'block';
        ui.joinGuard.textContent = 'ห้องนี้เต็มแล้ว';
      }
    }
  }

  window.addEventListener('beforeunload', () => {
    destroyed = true;
    clearInterval(heartbeatTimer);
    clearInterval(countdownTimer);
    try{
      HHAMulti.setOffline({
        game: GAME,
        mode: MODE,
        roomCode: ROOM_ID,
        playerId: SELF.pid
      });
    }catch(_){}
    try{ stopWatchRoom && stopWatchRoom(); }catch(_){}
  });

  boot();
})();
