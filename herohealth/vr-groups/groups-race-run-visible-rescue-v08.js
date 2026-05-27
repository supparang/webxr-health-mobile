/* =========================================================
   HeroHealth Groups Race Run Visible Rescue
   PATCH: v20260527-race-run-visible-rescue-08
   File: /herohealth/vr-groups/groups-race-run-visible-rescue-v08.js

   Purpose:
   - Force visible rescue panel when main waiting-room layout is blank
   - Does not depend on Firebase
   - Reads room/name from URL/sessionStorage
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260527-race-run-visible-rescue-08';

  if (window.__HHA_RACE_RUN_VISIBLE_RESCUE_08__) return;
  window.__HHA_RACE_RUN_VISIBLE_RESCUE_08__ = true;

  function qs(){
    return new URLSearchParams(location.search);
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
    var q = qs();
    return String(
      q.get('roomId') ||
      q.get('room') ||
      q.get('code') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      ''
    ).trim().toUpperCase();
  }

  function getName(){
    var q = qs();
    return String(
      q.get('name') ||
      q.get('playerName') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_NAME') ||
      'Hero'
    ).trim() || 'Hero';
  }

  function forceBaseVisible(){
    if (!document.body) return;

    document.documentElement.style.background = '#071a52';
    document.documentElement.style.minHeight = '100%';
    document.documentElement.style.overflow = 'auto';

    document.body.style.background = 'linear-gradient(180deg,#030b26,#071a52 52%,#0c2d84)';
    document.body.style.minHeight = '100vh';
    document.body.style.overflow = 'auto';
    document.body.style.display = 'block';
    document.body.style.opacity = '1';
    document.body.style.visibility = 'visible';

    var page = document.querySelector('.page');
    if (page) {
      page.style.display = 'grid';
      page.style.opacity = '1';
      page.style.visibility = 'visible';
      page.style.transform = 'none';
      page.style.position = 'relative';
      page.style.zIndex = '1';
    }
  }

  function updateOriginalDom(){
    var room = getRoom();
    var name = getName();

    try {
      if (room) sessionStorage.setItem('HHA_GROUPS_RACE_ROOM', room);
      if (name) sessionStorage.setItem('HHA_GROUPS_RACE_NAME', name);
    } catch(e) {}

    var metaRoom = document.getElementById('metaRoom');
    var metaName = document.getElementById('metaName');
    var statusMsg = document.getElementById('statusMsg');
    var roomState = document.getElementById('roomState');
    var playersList = document.getElementById('playersList');
    var countdown = document.getElementById('countdown');

    if (metaRoom) metaRoom.textContent = room || '-';
    if (metaName) metaName.textContent = name || 'Hero';

    if (statusMsg) {
      statusMsg.className = 'status-text warn';
      statusMsg.textContent = room
        ? 'เข้าห้องแล้ว: ' + room + ' • ผู้เล่น: ' + name + ' • รอเพื่อนเข้าห้องเดียวกัน'
        : 'ไม่พบ Room Code ใน URL';
    }

    if (roomState) {
      roomState.textContent = room
        ? 'ห้อง ' + room + ' พร้อมแล้ว • Race Standard ต้องมี 2–4 คนก่อนเริ่ม'
        : 'ยังไม่มี Room Code';
    }

    if (countdown) {
      countdown.className = 'count wait';
      countdown.textContent = 'รอ';
    }

    if (playersList) {
      var t = String(playersList.textContent || '');

      if (
        !t ||
        t.indexOf('กำลังโหลดข้อมูลผู้เล่น') >= 0 ||
        t.indexOf('รอข้อมูลจาก Firebase') >= 0 ||
        t.indexOf(name) < 0
      ) {
        playersList.innerHTML =
          '<div class="player" data-visible-rescue-player="1">' +
            '<div class="left">' +
              '<div class="avatar">🏁</div>' +
              '<div>' +
                '<div class="name">' + esc(name) + '</div>' +
                '<div class="tag">Host / waiting • room ' + esc(room || '-') + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="right wait">รอเพื่อน</div>' +
          '</div>';
      }
    }
  }

  function ensureRescuePanel(){
    if (!document.body) return;

    var room = getRoom();
    var name = getName();

    var box = document.getElementById('hhaRaceVisibleRescue');
    if (!box) {
      box = document.createElement('div');
      box.id = 'hhaRaceVisibleRescue';
      document.body.appendChild(box);
    }

    box.style.cssText = [
      'position:fixed',
      'inset:12px',
      'z-index:9999999',
      'overflow:auto',
      'padding:16px',
      'border-radius:24px',
      'background:linear-gradient(180deg,rgba(10,22,66,.98),rgba(6,16,52,.98))',
      'border:1px solid rgba(132,168,255,.24)',
      'box-shadow:0 22px 60px rgba(0,0,0,.42)',
      'color:#f8fbff',
      'font-family:ui-rounded,Nunito,\"Noto Sans Thai\",system-ui,sans-serif'
    ].join(';');

    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<div style="width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:30px;background:linear-gradient(180deg,#fff2b9,#f4d36d);color:#3f2f00">🏁</div>' +
          '<div>' +
            '<div style="font-size:26px;font-weight:1000;line-height:1.05">Groups Race Waiting Room</div>' +
            '<div style="margin-top:5px;color:#c8d7ff;font-weight:900">Rescue View • ห้องแสดงผลสำรอง</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button id="hhaRaceRescueBackLobby" style="min-height:42px;border:0;border-radius:14px;padding:0 14px;font-weight:1000;background:#1f2d66;color:#dbe8ff">← กลับ Lobby</button>' +
          '<button id="hhaRaceRescueBackMode" style="min-height:42px;border:0;border-radius:14px;padding:0 14px;font-weight:1000;background:#f0c16d;color:#251600">🏠 กลับโหมด</button>' +
        '</div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div style="border-radius:20px;background:rgba(255,255,255,.06);padding:16px;border:1px solid rgba(255,255,255,.08)">' +
          '<div style="color:#95a7d6;font-weight:900;margin-bottom:6px">Room Code</div>' +
          '<div style="font-size:36px;font-weight:1000;letter-spacing:.04em">' + esc(room || '-') + '</div>' +
        '</div>' +
        '<div style="border-radius:20px;background:rgba(255,255,255,.06);padding:16px;border:1px solid rgba(255,255,255,.08)">' +
          '<div style="color:#95a7d6;font-weight:900;margin-bottom:6px">Player</div>' +
          '<div style="font-size:36px;font-weight:1000">' + esc(name) + '</div>' +
        '</div>' +
      '</div>' +

      '<div style="border-radius:20px;background:rgba(255,226,155,.10);padding:14px;border:1px solid rgba(255,226,155,.20);color:#ffe29b;font-weight:1000;margin-bottom:12px">' +
        'เข้าห้องแล้ว: ' + esc(room || '-') + ' • ผู้เล่น: ' + esc(name) + ' • รอเพื่อนเข้าห้องเดียวกัน' +
      '</div>' +

      '<div style="border-radius:20px;background:rgba(255,255,255,.05);padding:14px;border:1px solid rgba(255,255,255,.08)">' +
        '<div style="font-size:22px;font-weight:1000;margin-bottom:10px">ผู้เล่นในห้อง</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08)">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<div style="width:46px;height:46px;border-radius:16px;display:grid;place-items:center;background:rgba(255,255,255,.10);font-size:24px">🏁</div>' +
            '<div>' +
              '<div style="font-size:18px;font-weight:1000">' + esc(name) + '</div>' +
              '<div style="color:#95a7d6;font-size:12px;font-weight:850">Host / waiting • room ' + esc(room || '-') + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="min-width:82px;min-height:34px;border-radius:999px;display:grid;place-items:center;background:rgba(240,193,109,.12);color:#ffe4bd;font-weight:1000">รอเพื่อน</div>' +
        '</div>' +
      '</div>';

    var backLobby = document.getElementById('hhaRaceRescueBackLobby');
    if (backLobby && !backLobby.__bound) {
      backLobby.__bound = true;
      backLobby.onclick = function(){
        location.href =
          './groups-race-lobby.html?room=' + encodeURIComponent(room) +
          '&roomId=' + encodeURIComponent(room) +
          '&name=' + encodeURIComponent(name) +
          '&mode=race&view=pc';
      };
    }

    var backMode = document.getElementById('hhaRaceRescueBackMode');
    if (backMode && !backMode.__bound) {
      backMode.__bound = true;
      backMode.onclick = function(){
        location.href =
          '../groups-vr.html?mode=race&view=pc&name=' + encodeURIComponent(name);
      };
    }
  }

  function tick(){
    forceBaseVisible();
    updateOriginalDom();
    ensureRescuePanel();
  }

  function boot(){
    tick();

    setTimeout(tick, 80);
    setTimeout(tick, 200);
    setTimeout(tick, 500);
    setTimeout(tick, 1000);
    setInterval(tick, 1000);

    console.info('[Groups Race Visible Rescue]', PATCH_ID, {
      room: getRoom(),
      name: getName()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();