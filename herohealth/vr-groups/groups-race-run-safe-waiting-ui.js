/* =========================================================
   HeroHealth Groups Race Run Safe Waiting UI
   PATCH: v20260527-groups-race-run-safe-waiting-ui-04-force
   File: /herohealth/vr-groups/groups-race-run-safe-waiting-ui.js

   Purpose:
   - Force room/name UI from URL immediately
   - Prevent Waiting Room from looking stuck while Firebase syncs
   - Keep existing Race logic untouched
   - Works even if run.js/lifecycle keeps repainting placeholders
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260527-groups-race-run-safe-waiting-ui-04-force';

  if (window.__HHA_GROUPS_RACE_SAFE_WAITING_UI_04_FORCE__) return;
  window.__HHA_GROUPS_RACE_SAFE_WAITING_UI_04_FORCE__ = true;

  var qs = new URLSearchParams(location.search);

  function $(id){
    return document.getElementById(id);
  }

  function txt(id, value){
    var el = $(id);
    if (el) el.textContent = String(value);
  }

  function html(id, value){
    var el = $(id);
    if (el) el.innerHTML = String(value);
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[c];
    });
  }

  function getRoom(){
    var room =
      qs.get('roomId') ||
      qs.get('room') ||
      qs.get('code') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      sessionStorage.getItem('HHA_RACE_ROOM') ||
      '';

    room = String(room || '').trim().toUpperCase();

    if (!room) {
      var m = location.href.match(/[?&](?:roomId|room|code)=([^&]+)/i);
      if (m) room = decodeURIComponent(m[1]).trim().toUpperCase();
    }

    return room;
  }

  function getName(){
    var name =
      qs.get('name') ||
      qs.get('playerName') ||
      qs.get('player') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_NAME') ||
      sessionStorage.getItem('HHA_RACE_NAME') ||
      'Hero';

    return String(name || 'Hero').trim() || 'Hero';
  }

  function getView(){
    return String(qs.get('view') || sessionStorage.getItem('HHA_GROUPS_RACE_VIEW') || 'pc').toLowerCase();
  }

  function getDiff(){
    return String(qs.get('diff') || sessionStorage.getItem('HHA_GROUPS_RACE_DIFF') || 'normal').toLowerCase();
  }

  function storeBase(){
    var room = getRoom();
    var name = getName();

    try {
      if (room) {
        sessionStorage.setItem('HHA_GROUPS_RACE_ROOM', room);
        sessionStorage.setItem('HHA_RACE_ROOM', room);
      }

      if (name) {
        sessionStorage.setItem('HHA_GROUPS_RACE_NAME', name);
        sessionStorage.setItem('HHA_RACE_NAME', name);
      }

      sessionStorage.setItem('HHA_GROUPS_RACE_VIEW', getView());
      sessionStorage.setItem('HHA_GROUPS_RACE_DIFF', getDiff());
    } catch(e) {}
  }

  function playerCard(name, tag, status, statusClass, avatar){
    return '' +
      '<div class="player" data-hha-safe-player="1">' +
        '<div class="left">' +
          '<div class="avatar">' + esc(avatar || '🏁') + '</div>' +
          '<div>' +
            '<div class="name">' + esc(name || 'Hero') + '</div>' +
            '<div class="tag">' + esc(tag || 'Waiting') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="right ' + esc(statusClass || 'wait') + '">' + esc(status || 'รอ...') + '</div>' +
      '</div>';
  }

  function paintBase(force){
    var room = getRoom();
    var name = getName();
    var view = getView();
    var diff = getDiff();

    storeBase();

    if (room) txt('metaRoom', room);
    else txt('metaRoom', '-');

    txt('metaName', name || 'Hero');

    var status = $('statusMsg');
    if (status) {
      status.className = 'status-text warn';
      status.textContent = room
        ? 'เข้าห้องแล้ว: ' + room + ' • ผู้เล่น: ' + name + ' • กำลังรอผู้เล่นอีกอย่างน้อย 1 คน'
        : 'ไม่พบ Room Code ใน URL • กลับไป Lobby แล้วสร้าง/เข้าห้องใหม่';
    }

    var roomState = $('roomState');
    if (roomState) {
      roomState.textContent = room
        ? 'ห้อง ' + room + ' พร้อมแล้ว • ต้องมีอย่างน้อย 2 คนก่อนเริ่มแข่ง'
        : 'ยังไม่มี Room Code';
    }

    var countdown = $('countdown');
    if (countdown && (!countdown.textContent || countdown.textContent === '...' || force)) {
      countdown.className = 'count wait';
      countdown.textContent = 'รอ';
    }

    var list = $('playersList');
    if (list) {
      var current = list.textContent || '';
      var shouldForce =
        force ||
        current.indexOf('กำลังโหลดข้อมูลผู้เล่น') >= 0 ||
        current.indexOf('รอข้อมูลจาก Firebase') >= 0 ||
        current.trim() === '';

      if (shouldForce) {
        list.innerHTML =
          playerCard(
            name,
            'Host / local presence • room ' + (room || '-'),
            'รอเพื่อน',
            'wait',
            '🏁'
          );
      }
    }

    window.__HHA_GROUPS_RACE_SAFE_WAITING_UI_STATE__ = {
      patch: PATCH_ID,
      room: room,
      name: name,
      view: view,
      diff: diff,
      paintedAt: new Date().toISOString()
    };
  }

  function repoBase(){
    var path = location.pathname;
    var marker = '/herohealth/';
    var idx = path.indexOf(marker);

    if (idx >= 0) return location.origin + path.slice(0, idx);

    return location.origin + '/webxr-health-mobile';
  }

  function buildUrl(path, extra){
    var base = repoBase() + '/herohealth/' + path.replace(/^\/+/, '');
    var out = new URL(base);

    [
      'pid',
      'studentId',
      'studentName',
      'classSection',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'qa',
      'debug',
      'teacher'
    ].forEach(function(k){
      var v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('roomId', getRoom());
    out.searchParams.set('room', getRoom());
    out.searchParams.set('name', getName());
    out.searchParams.set('diff', getDiff());
    out.searchParams.set('view', getView());
    out.searchParams.set('mode', 'race');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');

    Object.keys(extra || {}).forEach(function(k){
      out.searchParams.set(k, String(extra[k]));
    });

    return out.toString();
  }

  function patchButtons(){
    var backLobby = $('btnBackLobby');
    if (backLobby && !backLobby.__hhaRaceSafe04Bound) {
      backLobby.__hhaRaceSafe04Bound = true;
      backLobby.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        location.href = buildUrl('vr-groups/groups-race-lobby.html', {
          from: 'race-run-safe-ui'
        });

        return false;
      }, true);
    }

    var backHub = $('btnBackHub');
    if (backHub && !backHub.__hhaRaceSafe04Bound) {
      backHub.__hhaRaceSafe04Bound = true;
      backHub.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        location.href = buildUrl('groups-vr.html', {
          from: 'race-run-safe-ui'
        });

        return false;
      }, true);
    }

    var start = $('btnStartRace');
    if (start && !start.__hhaRaceSafe04Bound) {
      start.__hhaRaceSafe04Bound = true;

      start.addEventListener('click', function(){
        var list = $('playersList');
        var text = list ? (list.textContent || '') : '';
        var status = $('statusMsg');

        if (text.indexOf('รอเพื่อน') >= 0 || text.indexOf('กำลังโหลด') >= 0) {
          if (status) {
            status.className = 'status-text warn';
            status.textContent = 'ยังเริ่มไม่ได้ • Race ต้องมีอย่างน้อย 2 คนในห้องเดียวกันก่อน';
          }
        }

        setTimeout(function(){ paintBase(true); }, 120);
      }, true);
    }
  }

  function attachFirebaseSoft(){
    var room = getRoom();
    var name = getName();

    if (!room) return;

    var started = false;

    function tryAttach(){
      if (started) return;

      if (!window.firebase || !firebase.apps || !firebase.apps.length || !firebase.database) {
        return;
      }

      started = true;

      try {
        var db = firebase.database();

        var paths = [
          'herohealth/groups/race/rooms/' + room,
          'groups/race/rooms/' + room,
          'groupsRace/rooms/' + room,
          'groupsRaceRooms/' + room,
          'raceRooms/' + room,
          'rooms/groupsRace/' + room,
          'rooms/' + room
        ];

        paths.forEach(function(path){
          try {
            var ref = db.ref(path);
            var pid =
              qs.get('pid') ||
              sessionStorage.getItem('HHA_PLAYER_ID') ||
              ('p_' + Math.random().toString(36).slice(2, 9));

            var playerRef = ref.child('players').child(pid);

            playerRef.update({
              name: name,
              room: room,
              view: getView(),
              diff: getDiff(),
              ready: true,
              online: true,
              updatedAt: firebase.database.ServerValue.TIMESTAMP
            }).catch(function(){});

            playerRef.onDisconnect().update({
              online: false,
              leftAt: firebase.database.ServerValue.TIMESTAMP
            }).catch(function(){});

            ref.child('players').on('value', function(snap){
              var val = snap.val() || {};
              var players = Object.keys(val).map(function(k){
                return Object.assign({ key:k }, val[k] || {});
              }).filter(function(p){
                return p.online !== false;
              });

              if (players.length) {
                renderPlayers(players, path);
              }
            });
          } catch(e) {}
        });

        var status = $('statusMsg');
        if (status) {
          status.className = 'status-text ok';
          status.textContent = 'เชื่อม Firebase แล้ว • ห้อง ' + room + ' • รอผู้เล่นอย่างน้อย 2 คน';
        }

        console.info('[Groups Race Safe Waiting UI]', PATCH_ID, 'firebase soft attached', { room: room });
      } catch(e) {
        console.warn('[Groups Race Safe Waiting UI]', PATCH_ID, 'firebase soft attach failed', e);
      }
    }

    tryAttach();
    setTimeout(tryAttach, 500);
    setTimeout(tryAttach, 1200);
    setTimeout(tryAttach, 2500);
  }

  function renderPlayers(players, path){
    var list = $('playersList');
    if (!list) return;

    players = players || [];

    list.innerHTML = players.map(function(p, idx){
      return playerCard(
        p.name || p.playerName || ('Player ' + (idx + 1)),
        (idx === 0 ? 'Host / ' : '') + 'online • ' + path,
        'พร้อม',
        'ok',
        idx === 0 ? '🏁' : '🙂'
      );
    }).join('');

    var state = $('roomState');
    if (state) {
      state.textContent = players.length >= 2
        ? 'ผู้เล่นครบแล้ว (' + players.length + ' คน) • เจ้าของห้องกดเริ่มแข่งได้'
        : 'มีผู้เล่น ' + players.length + ' คน • ต้องมีอย่างน้อย 2 คนก่อนเริ่ม';
    }

    var status = $('statusMsg');
    if (status) {
      status.className = players.length >= 2 ? 'status-text ok' : 'status-text warn';
      status.textContent = players.length >= 2
        ? 'พร้อมแข่งแล้ว • ผู้เล่นครบอย่างน้อย 2 คน'
        : 'เข้าห้องแล้ว • รอเพื่อนเข้าห้องเดียวกัน';
    }
  }

  function boot(){
    paintBase(true);
    patchButtons();
    attachFirebaseSoft();

    setTimeout(function(){ paintBase(true); }, 80);
    setTimeout(function(){ paintBase(true); patchButtons(); }, 300);
    setTimeout(function(){ paintBase(true); patchButtons(); }, 900);
    setTimeout(function(){ paintBase(true); patchButtons(); }, 1800);

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_RACE_SAFE_UI04_SCAN__);
      window.__HHA_RACE_SAFE_UI04_SCAN__ = setTimeout(function(){
        paintBase(false);
        patchButtons();
      }, 80);
    });

    if (document.body) {
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    setInterval(function(){
      paintBase(false);
      patchButtons();
    }, 1000);

    console.info('[Groups Race Safe Waiting UI]', PATCH_ID, {
      room: getRoom(),
      name: getName(),
      view: getView(),
      diff: getDiff()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
