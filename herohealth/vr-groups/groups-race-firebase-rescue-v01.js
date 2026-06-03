/* =========================================================
   HeroHealth Groups Race Firebase Rescue
   PATCH: v20260527-groups-race-firebase-rescue-v01
   File: /herohealth/vr-groups/groups-race-firebase-rescue-v01.js

   Purpose:
   - Fix Race Waiting Room stuck at Firebase loading
   - Anonymous auth
   - Stable device player id
   - Write player to Realtime Database
   - Listen players in same room
   - Repaint Room Code / Player / Players List
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260527-groups-race-firebase-rescue-v01';

  if (window.__HHA_GROUPS_RACE_FIREBASE_RESCUE_V01__) return;
  window.__HHA_GROUPS_RACE_FIREBASE_RESCUE_V01__ = true;

  const qs = new URLSearchParams(location.search);

  function $(id){ return document.getElementById(id); }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  function getRoom(){
    return String(
      qs.get('roomId') ||
      qs.get('room') ||
      qs.get('code') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      ''
    ).trim().toUpperCase();
  }

  function getName(){
    return String(
      qs.get('name') ||
      qs.get('playerName') ||
      localStorage.getItem('HHA_PLAYER_NAME') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_NAME') ||
      'Hero'
    ).trim() || 'Hero';
  }

  function getView(){
    return String(qs.get('view') || 'pc').trim() || 'pc';
  }

  function getDiff(){
    return String(qs.get('diff') || 'normal').trim() || 'normal';
  }

  function getTimeSec(){
    return Number(qs.get('timeSec') || qs.get('time') || 90) || 90;
  }

  function deviceId(){
    let id = localStorage.getItem('HHA_GROUPS_RACE_DEVICE_ID');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('HHA_GROUPS_RACE_DEVICE_ID', id);
    }
    return id;
  }

  function setStatus(text, type){
    const el = $('statusMsg');
    if (!el) return;
    el.className = 'status-text ' + (type || 'warn');
    el.textContent = text;
  }

  function setRoomMeta(){
    const room = getRoom();
    const name = getName();

    try{
      if (room) sessionStorage.setItem('HHA_GROUPS_RACE_ROOM', room);
      if (name) sessionStorage.setItem('HHA_GROUPS_RACE_NAME', name);
      localStorage.setItem('HHA_PLAYER_NAME', name);
    }catch(e){}

    const metaRoom = $('metaRoom');
    const metaName = $('metaName');

    if (metaRoom) metaRoom.textContent = room || '-';
    if (metaName) metaName.textContent = name || 'Hero';

    const band = $('raceBandPill');
    if (band) band.textContent = '🏁 Race Standard 2–4';
  }

  function renderPlayers(playersObj){
    const list = $('playersList');
    if (!list) return;

    const players = Object.entries(playersObj || {})
      .map(([id, p]) => ({ id, ...(p || {}) }))
      .filter(p => p && p.name)
      .sort((a,b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));

    if (!players.length) {
      list.innerHTML =
        '<div class="player">' +
          '<div class="left">' +
            '<div class="avatar">👀</div>' +
            '<div>' +
              '<div class="name">ยังไม่มีผู้เล่นในห้อง</div>' +
              '<div class="tag">รอการเชื่อมต่อ Firebase</div>' +
            '</div>' +
          '</div>' +
          '<div class="right wait">รอ...</div>' +
        '</div>';
      return;
    }

    list.innerHTML = players.map((p, idx) => {
      const isMe = p.deviceId === deviceId();
      const label = idx === 0 ? 'Host' : 'Player ' + (idx + 1);
      return (
        '<div class="player" data-player-id="' + esc(p.id) + '">' +
          '<div class="left">' +
            '<div class="avatar">' + (idx === 0 ? '🏁' : '👤') + '</div>' +
            '<div>' +
              '<div class="name">' + esc(p.name) + (isMe ? ' <span style="color:#98f2bf">• คุณ</span>' : '') + '</div>' +
              '<div class="tag">' + esc(label) + ' • ' + esc(p.view || '-') + ' • ' + esc(p.diff || '-') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="right ok">พร้อม</div>' +
        '</div>'
      );
    }).join('');

    const count = players.length;
    const state = $('roomState');

    if (state) {
      state.textContent = count >= 2
        ? 'ผู้เล่นครบแล้ว ' + count + ' คน • Host กดเริ่มแข่งได้'
        : 'ห้อง ' + getRoom() + ' พร้อมแล้ว • ต้องมีอย่างน้อย 2 คนก่อนเริ่ม';
    }

    if (count >= 2) {
      setStatus('พร้อมแข่งแล้ว • ผู้เล่นครบอย่างน้อย 2 คน', 'ok');
    } else {
      setStatus('เข้าห้องแล้ว: ' + getRoom() + ' • ผู้เล่น: ' + getName() + ' • รอเพื่อนเข้าห้องเดียวกัน', 'warn');
    }

    window.__HHA_GROUPS_RACE_PLAYERS__ = players;
  }

  function waitFirebase(){
    return new Promise((resolve, reject) => {
      const started = Date.now();

      const timer = setInterval(() => {
        if (window.firebase && firebase.apps && firebase.apps.length) {
          clearInterval(timer);
          resolve(firebase);
          return;
        }

        if (Date.now() - started > 8000) {
          clearInterval(timer);
          reject(new Error('Firebase app not initialized. Check ../firebase-config.js'));
        }
      }, 120);
    });
  }

  async function signIn(firebase){
    try {
      if (!firebase.auth) return null;

      const auth = firebase.auth();

      if (auth.currentUser) return auth.currentUser;

      const cred = await auth.signInAnonymously();
      return cred.user || auth.currentUser || null;
    } catch (e) {
      console.warn('[Groups Race Firebase Rescue] anonymous auth failed', e);
      return null;
    }
  }

  async function boot(){
    const room = getRoom();
    const name = getName();

    setRoomMeta();

    if (!room) {
      setStatus('ไม่พบ Room Code ใน URL', 'err');
      console.error('[Groups Race Firebase Rescue]', PATCH_ID, 'missing room');
      return;
    }

    setStatus('กำลังเชื่อมต่อ Firebase...', 'warn');

    let fb;
    try {
      fb = await waitFirebase();
    } catch (e) {
      setStatus('Firebase ยังไม่พร้อม: ตรวจสอบ ../firebase-config.js', 'err');
      console.error('[Groups Race Firebase Rescue]', PATCH_ID, e);
      return;
    }

    let db;
    try {
      db = fb.database();
    } catch (e) {
      setStatus('เปิด Realtime Database ไม่ได้: ตรวจสอบ databaseURL / firebase-config.js', 'err');
      console.error('[Groups Race Firebase Rescue] database fail', e);
      return;
    }

    const user = await signIn(fb);
    const uid = user && user.uid ? user.uid : deviceId();

    const safeRoom = room.replace(/[.#$\[\]/]/g, '_');
    const pid = String(uid || deviceId()).replace(/[.#$\[\]/]/g, '_');

    const basePath = 'herohealth/groupsRace/rooms/' + safeRoom;
    const roomRef = db.ref(basePath);
    const playerRef = db.ref(basePath + '/players/' + pid);
    const playersRef = db.ref(basePath + '/players');

    db.ref('.info/connected').on('value', snap => {
      const connected = snap.val() === true;

      console.info('[Groups Race Firebase Rescue] connected=', connected);

      if (!connected) {
        setStatus('ยังไม่เชื่อม Firebase • ตรวจสอบเน็ต / databaseURL / rules', 'warn');
        return;
      }

      setStatus('Firebase เชื่อมต่อแล้ว • กำลังเข้าห้อง ' + room, 'ok');

      playerRef.onDisconnect().remove();

      playerRef.set({
        uid: uid,
        deviceId: deviceId(),
        name: name,
        room: room,
        view: getView(),
        diff: getDiff(),
        timeSec: getTimeSec(),
        ready: true,
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        ua: navigator.userAgent || ''
      }).then(() => {
        console.info('[Groups Race Firebase Rescue] WRITE OK', { room, pid });
        setStatus('เข้าห้องแล้ว: ' + room + ' • ผู้เล่น: ' + name + ' • รอเพื่อนเข้าห้องเดียวกัน', 'warn');
      }).catch(e => {
        console.error('[Groups Race Firebase Rescue] WRITE FAIL', e);
        setStatus('Firebase เขียนข้อมูลไม่ได้: ' + (e.code || e.message), 'err');
      });

      roomRef.update({
        room: room,
        band: 'standard',
        minPlayers: 2,
        maxPlayers: 4,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
      }).catch(e => console.warn('[Groups Race Firebase Rescue] room update fail', e));

      setInterval(() => {
        playerRef.update({
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        }).catch(() => {});
      }, 5000);
    });

    playersRef.on('value', snap => {
      const val = snap.val() || {};
      console.info('[Groups Race Firebase Rescue] players update', val);
      renderPlayers(val);
    }, err => {
      console.error('[Groups Race Firebase Rescue] LISTEN FAIL', err);
      setStatus('Firebase อ่านรายชื่อผู้เล่นไม่ได้: ' + (err.code || err.message), 'err');
    });

    const startBtn = $('btnStartRace');
    if (startBtn && !startBtn.__hhaFirebaseRescueBound) {
      startBtn.__hhaFirebaseRescueBound = true;

      startBtn.addEventListener('click', ev => {
        const players = window.__HHA_GROUPS_RACE_PLAYERS__ || [];

        if (players.length < 2) {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          setStatus('ยังเริ่มไม่ได้ • Race Standard ต้องมีอย่างน้อย 2 คน ตอนนี้มี ' + players.length + ' คน', 'warn');
          return false;
        }

        roomRef.update({
          status: 'starting',
          startedBy: pid,
          startAt: Date.now() + 3000,
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        });

        setStatus('กำลังเริ่มแข่ง • นับถอยหลัง...', 'ok');
      }, true);
    }

    console.info('[Groups Race Firebase Rescue]', PATCH_ID, {
      room,
      name,
      uid,
      pid,
      path: basePath
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();