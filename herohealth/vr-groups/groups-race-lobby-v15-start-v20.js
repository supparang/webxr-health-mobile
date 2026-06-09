/* =========================================================
   HeroHealth • Groups Race Lobby v15 Start Override
   File: /herohealth/vr-groups/groups-race-lobby-v15-start-v20.js
   PATCH: v20260609-GROUPS-RACE-LOBBY-V15-START-V20

   Purpose:
   - ดักปุ่มสร้างห้อง / เข้าห้อง / LOCAL คนเดียว
   - ส่งไป groups-race-run-v15.html เสมอ
   - ไม่ปล่อยให้ JS เดิมพาไป v09/v10
   ========================================================= */

(function(){
  'use strict';

  const PATCH = 'v20260609-GROUPS-RACE-LOBBY-V15-START-V20';
  const RUN_FILE = 'groups-race-run-v15.html';

  if (window.__HHA_GROUPS_RACE_LOBBY_V15_START_V20__) return;
  window.__HHA_GROUPS_RACE_LOBBY_V15_START_V20__ = true;

  const qs = new URLSearchParams(location.search || '');

  function $(id){
    return document.getElementById(id);
  }

  function norm(v){
    return String(v == null ? '' : v).trim();
  }

  function roomify(v){
    return norm(v).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
  }

  function makeRoom(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = 'R';
    for (let i = 0; i < 5; i += 1) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function repoBase(){
    const path = location.pathname || '';
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);
    if (idx >= 0) return location.origin + path.slice(0, idx);
    return location.origin + '/webxr-health-mobile';
  }

  function getName(){
    const input = $('playerName');
    return norm(
      (input && input.value) ||
      qs.get('name') ||
      localStorage.getItem('HHA_GROUPS_RACE_PLAYER_NAME') ||
      localStorage.getItem('HHA_PLAYER_NAME') ||
      'Hero'
    ) || 'Hero';
  }

  function getDiff(){
    const el = $('diffSelect');
    return norm((el && el.value) || qs.get('diff') || 'normal') || 'normal';
  }

  function getTime(){
    const el = $('timeSelect');
    return norm((el && el.value) || qs.get('time') || '45') || '45';
  }

  function getView(){
    return norm(qs.get('view') || localStorage.getItem('HHA_GROUPS_VIEW') || 'mobile') || 'mobile';
  }

  function getRoomOrCreate(forceNew){
    const input = $('roomInput');

    let room = roomify(
      !forceNew && input && input.value ||
      !forceNew && qs.get('room') ||
      !forceNew && qs.get('roomId') ||
      !forceNew && qs.get('code') ||
      !forceNew && localStorage.getItem('HHA_GROUPS_RACE_ROOM_CODE') ||
      ''
    );

    if (!room) room = makeRoom();

    if (input) input.value = room;

    try {
      sessionStorage.setItem('HHA_GROUPS_RACE_ROOM', room);
      sessionStorage.setItem('HHA_GROUPS_RACE_ROOM_CODE', room);
      sessionStorage.setItem('HHA_GROUPS_RACE_NAME', getName());

      localStorage.setItem('HHA_GROUPS_RACE_ROOM', room);
      localStorage.setItem('HHA_GROUPS_RACE_ROOM_CODE', room);
      localStorage.setItem('HHA_RACE_ROOM', room);
      localStorage.setItem('HHA_GROUPS_RACE_PLAYER_NAME', getName());
      localStorage.setItem('HHA_GROUPS_RACE_TIME', getTime());
    } catch(_) {}

    paintRoom(room);

    return room;
  }

  function runUrl(opts){
    opts = opts || {};

    const room = opts.room || getRoomOrCreate(false);
    const out = new URL(repoBase() + '/herohealth/vr-groups/' + RUN_FILE);

    out.searchParams.set('name', getName());
    out.searchParams.set('view', getView());
    out.searchParams.set('diff', getDiff());
    out.searchParams.set('time', getTime());
    out.searchParams.set('timeSec', getTime());

    out.searchParams.set('room', room);
    out.searchParams.set('roomId', room);
    out.searchParams.set('code', room);

    out.searchParams.set('mode', 'race');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    out.searchParams.set('raceBand', 'standard');
    out.searchParams.set('band', 'standard');

    if (opts.mock) out.searchParams.set('mock', '1');
    if (qs.get('qa') === '1') out.searchParams.set('qa', '1');
    if (qs.get('debug') === '1') out.searchParams.set('debug', '1');

    out.searchParams.set('from', opts.from || 'groups-race-lobby-v20');
    out.searchParams.set('t', String(Date.now()));

    return out.toString();
  }

  function setStatus(msg, cls){
    const el = $('status');
    if (!el) return;

    el.className = 'status ' + (cls || 'ok');
    el.textContent = msg;
  }

  function paintRoom(room){
    const preview = $('roomPreview');
    const sub = $('roomPreviewSub');

    if (preview) preview.textContent = room || '----';
    if (sub) sub.textContent = room ? 'พร้อมใช้เข้าห้อง Race' : 'ยังไม่ได้สร้างห้อง';
  }

  function go(opts){
    const url = runUrl(opts);

    console.info('[GroupsRaceLobbyV15StartV20]', {
      patch: PATCH,
      url: url,
      opts: opts
    });

    location.href = url;
  }

  function bind(){
    const create = $('btnCreate');
    const join = $('btnJoin');
    const local = $('btnLocal');
    const copy = $('btnCopy');
    const roomInput = $('roomInput');

    if (create && !create.__v20Bound) {
      create.__v20Bound = true;
      create.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        const room = getRoomOrCreate(true);
        setStatus('สร้างห้องแล้ว: ' + room + ' • กำลังเข้า Waiting Room v15', 'ok');

        go({
          room: room,
          from: 'lobby-create-v20'
        });

        return false;
      }, true);
    }

    if (join && !join.__v20Bound) {
      join.__v20Bound = true;
      join.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        const room = roomify(roomInput && roomInput.value);

        if (!room) {
          setStatus('กรุณาใส่ Room Code ก่อนเข้าห้อง', 'err');
          return false;
        }

        if (roomInput) roomInput.value = room;
        getRoomOrCreate(false);

        setStatus('เข้าห้อง ' + room + ' • กำลังเข้า Waiting Room v15', 'ok');

        go({
          room: room,
          from: 'lobby-join-v20'
        });

        return false;
      }, true);
    }

    if (local && !local.__v20Bound) {
      local.__v20Bound = true;
      local.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        const room = getRoomOrCreate(true);
        setStatus('LOCAL TEST • สร้าง RaceBot และเข้า v15', 'ok');

        go({
          room: room,
          mock: true,
          from: 'lobby-local-v20'
        });

        return false;
      }, true);
    }

    if (copy && !copy.__v20Bound) {
      copy.__v20Bound = true;
      copy.addEventListener('click', function(ev){
        ev.preventDefault();

        const room = getRoomOrCreate(false);
        const url = runUrl({
          room: room,
          from: 'lobby-copy-v20'
        });

        try {
          navigator.clipboard.writeText(url);
          setStatus('คัดลอกลิงก์ Race v15 แล้ว: ' + room, 'ok');
        } catch(_) {
          setStatus(url, 'warn');
        }
      }, true);
    }

    if (roomInput && !roomInput.__v20Bound) {
      roomInput.__v20Bound = true;
      roomInput.addEventListener('input', function(){
        const room = roomify(roomInput.value);
        roomInput.value = room;
        paintRoom(room);
      });
    }
  }

  function boot(){
    const savedRoom = roomify(
      qs.get('room') ||
      qs.get('roomId') ||
      qs.get('code') ||
      localStorage.getItem('HHA_GROUPS_RACE_ROOM_CODE') ||
      ''
    );

    if (savedRoom) {
      const input = $('roomInput');
      if (input) input.value = savedRoom;
      paintRoom(savedRoom);
    }

    const nameInput = $('playerName');
    if (nameInput && !nameInput.value) nameInput.value = getName();

    bind();

    console.info('[GroupsRaceLobbyV15StartV20]', {
      patch: PATCH,
      target: RUN_FILE
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
