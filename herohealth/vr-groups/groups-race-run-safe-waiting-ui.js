/* =========================================================
   HeroHealth Groups Race Run Safe Waiting UI
   PATCH: v20260527-groups-race-run-safe-waiting-ui-05-hard-repair
   File: /herohealth/vr-groups/groups-race-run-safe-waiting-ui.js

   Purpose:
   - Hard repair Waiting Room UI when run/lifecycle keeps placeholders
   - Force Room Code / Player / Player List from URL
   - Add visible fallback status banner
   - Keep existing Race logic untouched
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260527-groups-race-run-safe-waiting-ui-05-hard-repair';

  if (window.__HHA_GROUPS_RACE_SAFE_WAITING_UI_05_HARD_REPAIR__) return;
  window.__HHA_GROUPS_RACE_SAFE_WAITING_UI_05_HARD_REPAIR__ = true;

  var qs = new URLSearchParams(location.search);

  function byId(id){ return document.getElementById(id); }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || '') || '')
      .replace(/\s+/g,' ')
      .trim();
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
    var v =
      qs.get('roomId') ||
      qs.get('room') ||
      qs.get('code') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      sessionStorage.getItem('HHA_RACE_ROOM') ||
      '';

    v = String(v || '').trim().toUpperCase();

    if (!v) {
      var m = location.href.match(/[?&](?:roomId|room|code)=([^&]+)/i);
      if (m) v = decodeURIComponent(m[1]).trim().toUpperCase();
    }

    return v;
  }

  function getName(){
    return String(
      qs.get('name') ||
      qs.get('playerName') ||
      qs.get('player') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_NAME') ||
      sessionStorage.getItem('HHA_RACE_NAME') ||
      'Hero'
    ).trim() || 'Hero';
  }

  function getView(){
    return String(qs.get('view') || sessionStorage.getItem('HHA_GROUPS_RACE_VIEW') || 'pc').toLowerCase();
  }

  function getDiff(){
    return String(qs.get('diff') || sessionStorage.getItem('HHA_GROUPS_RACE_DIFF') || 'normal').toLowerCase();
  }

  function saveBase(){
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

  function addStyle(){
    if (document.getElementById('hha-race-safe-ui05-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-race-safe-ui05-style';
    style.textContent = `
      .hha-race-safe-banner{
        position:fixed;
        left:50%;
        bottom:calc(14px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:999999;
        width:min(680px,92vw);
        padding:12px 16px;
        border-radius:20px;
        background:rgba(15,37,98,.96);
        border:1px solid rgba(118,199,255,.34);
        color:#eaf6ff;
        font:900 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 18px 42px rgba(0,0,0,.32);
        text-align:center;
      }

      .hha-race-safe-banner b{
        color:#ffe29b;
      }

      .hha-safe-forced{
        outline:2px solid rgba(99,217,155,.32);
        box-shadow:0 0 0 5px rgba(99,217,155,.08);
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBanner(){
    var el = document.querySelector('.hha-race-safe-banner');
    if (!el) {
      el = document.createElement('div');
      el.className = 'hha-race-safe-banner';
      document.body.appendChild(el);
    }

    var room = getRoom();
    var name = getName();

    el.innerHTML = room
      ? '✅ เข้าห้องแล้ว: <b>' + esc(room) + '</b> • ผู้เล่น: <b>' + esc(name) + '</b> • รอผู้เล่นคนที่ 2'
      : '⚠️ ไม่พบ Room Code ใน URL • กลับ Lobby แล้วสร้าง/เข้าห้องใหม่';
  }

  function setText(el, value){
    if (el && textOf(el) !== String(value)) {
      el.textContent = String(value);
      el.classList.add('hha-safe-forced');
    }
  }

  function findMetaValueByLabel(labelText){
    var boxes = Array.prototype.slice.call(document.querySelectorAll('.metaBox'));
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      var label = box.querySelector('.metaLabel');
      var value = box.querySelector('.metaValue');
      if (label && value && textOf(label).toLowerCase().indexOf(labelText.toLowerCase()) >= 0) {
        return value;
      }
    }
    return null;
  }

  function hardPaintMeta(){
    var room = getRoom();
    var name = getName();

    var metaRoom = byId('metaRoom') || findMetaValueByLabel('Room');
    var metaName = byId('metaName') || findMetaValueByLabel('Player');

    setText(metaRoom, room || '-');
    setText(metaName, name || 'Hero');
  }

  function hardPaintStatus(){
    var room = getRoom();
    var name = getName();

    var status = byId('statusMsg') || document.querySelector('.status-text');
    if (status) {
      status.className = 'status-text warn hha-safe-forced';
      status.textContent = room
        ? 'เข้าห้องแล้ว: ' + room + ' • ผู้เล่น: ' + name + ' • รอเพื่อนเข้าห้องเดียวกัน'
        : 'ไม่พบ Room Code ใน URL';
    }

    var roomState = byId('roomState') || document.querySelector('.roomState');
    if (roomState) {
      roomState.classList.add('hha-safe-forced');
      roomState.textContent = room
        ? 'ห้อง ' + room + ' พร้อมแล้ว • ต้องมีอย่างน้อย 2 คนก่อนเริ่มแข่ง'
        : 'ยังไม่มี Room Code';
    }

    var countdown = byId('countdown') || document.querySelector('.count');
    if (countdown && (textOf(countdown) === '...' || textOf(countdown) === '' || textOf(countdown).indexOf('Firebase') >= 0)) {
      countdown.className = 'count wait hha-safe-forced';
      countdown.textContent = 'รอ';
    }
  }

  function playerCard(name, tag, status, cls, avatar){
    return '' +
      '<div class="player hha-safe-forced" data-hha-safe-player="1">' +
        '<div class="left">' +
          '<div class="avatar">' + esc(avatar || '🏁') + '</div>' +
          '<div>' +
            '<div class="name">' + esc(name || 'Hero') + '</div>' +
            '<div class="tag">' + esc(tag || 'Waiting') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="right ' + esc(cls || 'wait') + '">' + esc(status || 'รอ...') + '</div>' +
      '</div>';
  }

  function hardPaintPlayers(players){
    var room = getRoom();
    var name = getName();

    var list = byId('playersList') || document.querySelector('.playersWrap');
    if (!list) return;

    if (players && players.length) {
      list.innerHTML = players.map(function(p, idx){
        return playerCard(
          p.name || p.playerName || ('Player ' + (idx + 1)),
          (idx === 0 ? 'Host / ' : '') + 'online • room ' + room,
          'พร้อม',
          'ok',
          idx === 0 ? '🏁' : '🙂'
        );
      }).join('');
      return;
    }

    var t = textOf(list);
    var shouldForce =
      !t ||
      t.indexOf('กำลังโหลดข้อมูลผู้เล่น') >= 0 ||
      t.indexOf('รอข้อมูลจาก Firebase') >= 0 ||
      t.indexOf('รอ...') >= 0 ||
      t.indexOf(name) < 0;

    if (shouldForce) {
      list.innerHTML = playerCard(
        name,
        'Host / local waiting • room ' + (room || '-'),
        'รอเพื่อน',
        'wait',
        '🏁'
      );
    }
  }

  function repair(force){
    saveBase();
    addStyle();
    ensureBanner();
    hardPaintMeta();
    hardPaintStatus();

    if (force) hardPaintPlayers([]);
    else hardPaintPlayers(null);

    window.__HHA_GROUPS_RACE_SAFE_WAITING_UI_STATE__ = {
      patch: PATCH_ID,
      room: getRoom(),
      name: getName(),
      view: getView(),
      diff: getDiff(),
      repairedAt: new Date().toISOString()
    };
  }

  function attachFirebaseSoft(){
    var room = getRoom();
    var name = getName();

    if (!room) return;

    function tryAttach(){
      if (!window.firebase || !firebase.apps || !firebase.apps.length || !firebase.database) return;

      if (window.__HHA_GROUPS_RACE_SAFE_UI05_FIREBASE_ATTACHED__) return;
      window.__HHA_GROUPS_RACE_SAFE_UI05_FIREBASE_ATTACHED__ = true;

      try {
        var db = firebase.database();
        var pid =
          qs.get('pid') ||
          sessionStorage.getItem('HHA_PLAYER_ID') ||
          ('p_' + Math.random().toString(36).slice(2,9));

        try { sessionStorage.setItem('HHA_PLAYER_ID', pid); } catch(e) {}

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
            var roomRef = db.ref(path);
            var playerRef = roomRef.child('players').child(pid);

            playerRef.update({
              name: name,
              playerName: name,
              room: room,
              view: getView(),
              diff: getDiff(),
              ready: true,
              online: true,
              updatedAt: firebase.database.ServerValue.TIMESTAMP
            }).catch(function(){});

            playerRef.onDisconnect().update({
              online:false,
              leftAt:firebase.database.ServerValue.TIMESTAMP
            }).catch(function(){});

            roomRef.child('players').on('value', function(snap){
              var val = snap.val() || {};
              var players = Object.keys(val).map(function(k){
                return Object.assign({ key:k }, val[k] || {});
              }).filter(function(p){
                return p.online !== false;
              });

              if (players.length) {
                renderPlayers(players);
              }
            });
          } catch(e) {}
        });

        console.info('[Groups Race Safe Waiting UI]', PATCH_ID, 'firebase soft attached', { room: room });
      } catch(e) {
        console.warn('[Groups Race Safe Waiting UI]', PATCH_ID, 'firebase attach failed', e);
      }
    }

    tryAttach();
    setTimeout(tryAttach, 500);
    setTimeout(tryAttach, 1200);
    setTimeout(tryAttach, 2500);
  }

  function renderPlayers(players){
    players = players || [];
    hardPaintPlayers(players);

    var room = getRoom();

    var roomState = byId('roomState') || document.querySelector('.roomState');
    if (roomState) {
      roomState.classList.add('hha-safe-forced');
      roomState.textContent = players.length >= 2
        ? 'ผู้เล่นครบแล้ว (' + players.length + ' คน) • กดเริ่มแข่งได้'
        : 'ห้อง ' + room + ' มีผู้เล่น ' + players.length + ' คน • รออีกอย่างน้อย 1 คน';
    }

    var status = byId('statusMsg') || document.querySelector('.status-text');
    if (status) {
      status.className = players.length >= 2
        ? 'status-text ok hha-safe-forced'
        : 'status-text warn hha-safe-forced';

      status.textContent = players.length >= 2
        ? 'พร้อมแข่งแล้ว • ผู้เล่นครบอย่างน้อย 2 คน'
        : 'เข้าห้องแล้ว • รอเพื่อนเข้าห้องเดียวกัน';
    }

    ensureBanner();
  }

  function repoBase(){
    var path = location.pathname;
    var marker = '/herohealth/';
    var idx = path.indexOf(marker);
    if (idx >= 0) return location.origin + path.slice(0, idx);
    return location.origin + '/webxr-health-mobile';
  }

  function buildUrl(path, extra){
    var out = new URL(repoBase() + '/herohealth/' + path.replace(/^\/+/, ''));

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
    var backLobby = byId('btnBackLobby');
    if (backLobby && !backLobby.__hhaRaceSafe05Bound) {
      backLobby.__hhaRaceSafe05Bound = true;
      backLobby.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        location.href = buildUrl('vr-groups/groups-race-lobby.html', {
          from:'race-run-safe-ui05'
        });

        return false;
      }, true);
    }

    var backHub = byId('btnBackHub');
    if (backHub && !backHub.__hhaRaceSafe05Bound) {
      backHub.__hhaRaceSafe05Bound = true;
      backHub.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        location.href = buildUrl('groups-vr.html', {
          from:'race-run-safe-ui05'
        });

        return false;
      }, true);
    }

    var start = byId('btnStartRace');
    if (start && !start.__hhaRaceSafe05Bound) {
      start.__hhaRaceSafe05Bound = true;
      start.addEventListener('click', function(){
        setTimeout(function(){ repair(true); }, 120);
      }, true);
    }
  }

  function boot(){
    repair(true);
    patchButtons();
    attachFirebaseSoft();

    [80, 180, 360, 700, 1200, 2000, 3200].forEach(function(ms){
      setTimeout(function(){
        repair(true);
        patchButtons();
      }, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_RACE_SAFE_UI05_SCAN__);
      window.__HHA_RACE_SAFE_UI05_SCAN__ = setTimeout(function(){
        repair(false);
        patchButtons();
      }, 80);
    });

    if (document.body) {
      mo.observe(document.body, {
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true,
        attributeFilter:['class','style']
      });
    }

    setInterval(function(){
      repair(false);
      patchButtons();
    }, 700);

    console.info('[Groups Race Safe Waiting UI]', PATCH_ID, {
      room:getRoom(),
      name:getName(),
      view:getView(),
      diff:getDiff()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
