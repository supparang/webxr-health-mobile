(function GoodJunkBattleV2LobbyFreshRoomPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.42-lobby-fresh-room-active-room-only';

  const url = new URL(location.href);
  const params = url.searchParams;

  const EXPLICIT_ROOM =
    params.get('room') ||
    params.get('roomCode') ||
    params.get('code') ||
    params.get('lastRoom') ||
    '';

  const state = {
    version: PATCH_VERSION,
    hasExplicitRoom: !!EXPLICIT_ROOM,
    userTouchedRoom: false,
    createdOrJoined: false,
    bootLocked: true
  };

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function getActiveRoomFromText(){
    const text = $('#roomCodeText');
    const value = text && text.textContent && text.textContent.trim() !== '----'
      ? text.textContent
      : '';

    return normalizeRoomCode(value);
  }

  function getActiveRoomFromLobbyState(){
    const lobby = window.GJ_BATTLE_LOBBY;
    return normalizeRoomCode(
      lobby &&
      lobby.state &&
      lobby.state.roomCode
        ? lobby.state.roomCode
        : ''
    );
  }

  function getActiveRoom(){
    return normalizeRoomCode(
      params.get('room') ||
      params.get('roomCode') ||
      params.get('code') ||
      params.get('lastRoom') ||
      getActiveRoomFromLobbyState() ||
      getActiveRoomFromText() ||
      ''
    );
  }

  function hasActiveRoom(){
    return !!getActiveRoom();
  }

  function setStatus(text, cls){
    const el = $('#lobbyStatus');
    if (!el) return;

    el.className = 'status ' + (cls || 'warn');
    el.textContent = text;
    el.setAttribute('data-gj-stable-text', text);
    el.setAttribute('data-gj-stable-cls', cls || 'warn');
  }

  function renderEmptyPlayers(){
    const list = $('#playersList');
    if (!list) return;

    list.innerHTML = `
      <div class="player">
        <div class="avatar">👤</div>
        <div>
          <div class="p-name">ยังไม่มีผู้เล่นในห้อง</div>
          <div class="p-meta">กดสร้างห้อง หรือใส่รหัสแล้วกดเข้าห้อง</div>
        </div>
        <span class="pill off">WAIT</span>
      </div>
    `;
  }

  function clearRoomUI(){
    const roomCodeText = $('#roomCodeText');
    const btnStartBattle = $('#btnStartBattle');

    if (roomCodeText) roomCodeText.textContent = '----';

    /*
     * สำคัญ:
     * ไม่ล้าง roomCodeInput แล้ว เพราะช่องนี้เป็น “ช่องกรอกรหัส”
     * ไม่ใช่ active room
     */

    if (btnStartBattle){
      btnStartBattle.disabled = true;
      btnStartBattle.textContent = '⏳ รอผู้เล่นอีก 1 คน';
      btnStartBattle.classList.remove('is-ready');
      btnStartBattle.classList.add('is-disabled');
    }

    renderEmptyPlayers();
    setStatus('ยังไม่ได้สร้างหรือเข้าห้อง', 'warn');
  }

  function hardResetLobbyState(){
    const lobby = window.GJ_BATTLE_LOBBY;

    if (lobby && lobby.state && !state.hasExplicitRoom){
      lobby.state.roomCode = '';
      lobby.state.room = null;
      lobby.state.roomRef = null;
      lobby.state.listenerAttached = false;
      lobby.state.attachedRoomCode = '';
      lobby.state.redirecting = false;
      lobby.state.lastRoomKey = '';
    }

    if (!state.hasExplicitRoom){
      try{
        localStorage.removeItem('GJ_BATTLE_LAST_ROOM');
        sessionStorage.removeItem('GJ_BATTLE_LAST_ROOM');
      }catch(_){}
    }

    clearRoomUI();
  }

  function patchInitFields(){
    const lobby = window.GJ_BATTLE_LOBBY;

    if (!state.hasExplicitRoom && !state.createdOrJoined && !hasActiveRoom()){
      hardResetLobbyState();
    }

    if (!lobby || lobby.__freshRoomPatchedV2442) return;

    lobby.__freshRoomPatchedV2442 = true;

    if (typeof lobby.createRoom === 'function'){
      const originalCreate = lobby.createRoom;

      lobby.createRoom = async function(){
        state.userTouchedRoom = true;
        state.createdOrJoined = true;

        if (lobby.state){
          lobby.state.roomCode = '';
          lobby.state.room = null;
          lobby.state.roomRef = null;
          lobby.state.listenerAttached = false;
          lobby.state.attachedRoomCode = '';
          lobby.state.redirecting = false;
          lobby.state.lastRoomKey = '';
        }

        return await originalCreate.apply(lobby, arguments);
      };
    }

    if (typeof lobby.joinRoom === 'function'){
      const originalJoin = lobby.joinRoom;

      lobby.joinRoom = async function(){
        state.userTouchedRoom = true;
        state.createdOrJoined = true;
        return await originalJoin.apply(lobby, arguments);
      };
    }

    if (typeof lobby.leaveRoom === 'function'){
      const originalLeave = lobby.leaveRoom;

      lobby.leaveRoom = async function(){
        state.userTouchedRoom = false;
        state.createdOrJoined = false;

        try{
          localStorage.removeItem('GJ_BATTLE_LAST_ROOM');
          sessionStorage.removeItem('GJ_BATTLE_LAST_ROOM');
        }catch(_){}

        const result = await originalLeave.apply(lobby, arguments);
        clearRoomUI();
        return result;
      };
    }
  }

  function patchButtons(){
    const createBtn = $('#btnCreateRoom');
    const joinBtn = $('#btnJoinRoom');
    const leaveBtn = $('#btnLeaveRoom');
    const input = $('#roomCodeInput');

    if (createBtn && createBtn.dataset.gjFreshRoomBoundV2442 !== '1'){
      createBtn.dataset.gjFreshRoomBoundV2442 = '1';
      createBtn.addEventListener('click', function(){
        state.userTouchedRoom = true;
        state.createdOrJoined = true;
      }, true);
    }

    if (joinBtn && joinBtn.dataset.gjFreshRoomBoundV2442 !== '1'){
      joinBtn.dataset.gjFreshRoomBoundV2442 = '1';
      joinBtn.addEventListener('click', function(){
        state.userTouchedRoom = true;
        state.createdOrJoined = true;
      }, true);
    }

    if (leaveBtn && leaveBtn.dataset.gjFreshRoomBoundV2442 !== '1'){
      leaveBtn.dataset.gjFreshRoomBoundV2442 = '1';
      leaveBtn.addEventListener('click', function(){
        state.userTouchedRoom = false;
        state.createdOrJoined = false;
        setTimeout(clearRoomUI, 150);
      }, true);
    }

    if (input && input.dataset.gjFreshRoomInputBoundV2442 !== '1'){
      input.dataset.gjFreshRoomInputBoundV2442 = '1';

      /*
       * พิมพ์ roomCodeInput ไม่ถือว่าเข้าห้องแล้ว
       * แค่ userTouchedRoom เพื่อกัน auto-clear ช่องกรอกเท่านั้น
       */
      input.addEventListener('input', function(){
        state.userTouchedRoom = true;
      });
    }
  }

  function blockOldRoomRender(){
    /*
     * ถ้ายังไม่ได้สร้าง/เข้าห้องสำเร็จ และไม่มี active room จริง
     * ให้บังคับ UI กลับเป็นว่าง
     */
    if (state.hasExplicitRoom) return;
    if (state.createdOrJoined && hasActiveRoom()) return;

    const list = $('#playersList');
    const hasPlayer =
      list &&
      /READY|LEFT|host|online|score/i.test(list.textContent || '');

    if (!hasActiveRoom() && hasPlayer){
      hardResetLobbyState();
    }
  }

  function patchHostRepairGuard(){
    const repair = window.GJ_BATTLE_LOBBY_HOST_REPAIR;
    if (!repair || repair.__freshRoomGuardPatchedV2442) return;

    repair.__freshRoomGuardPatchedV2442 = true;

    if (typeof repair.repairCurrentRoom === 'function'){
      const originalRepairCurrent = repair.repairCurrentRoom;

      repair.repairCurrentRoom = async function(source){
        if (!state.hasExplicitRoom && !state.createdOrJoined && !hasActiveRoom()){
          clearRoomUI();
          return false;
        }

        return await originalRepairCurrent.apply(repair, arguments);
      };
    }

    if (typeof repair.attachRoomListener === 'function'){
      const originalAttach = repair.attachRoomListener;

      repair.attachRoomListener = function(roomCode){
        if (!state.hasExplicitRoom && !state.createdOrJoined && !hasActiveRoom()){
          clearRoomUI();
          return false;
        }

        return originalAttach.apply(repair, arguments);
      };
    }
  }

  function patchStatusStabilizerGuard(){
    const stabilizer = window.GJ_BATTLE_LOBBY_STATUS_STABILIZER;
    if (!stabilizer || stabilizer.__freshRoomGuardPatchedV2442) return;

    stabilizer.__freshRoomGuardPatchedV2442 = true;

    if (typeof stabilizer.decideStableStatus === 'function'){
      const originalDecide = stabilizer.decideStableStatus;

      stabilizer.decideStableStatus = function(){
        if (!state.hasExplicitRoom && !state.createdOrJoined && !hasActiveRoom()){
          return {
            key:'fresh-no-active-room',
            cls:'warn',
            text:'ยังไม่ได้สร้างหรือเข้าห้อง',
            btnText:'⏳ รอผู้เล่นอีก 1 คน',
            disabled:true,
            ready:false
          };
        }

        return originalDecide.apply(stabilizer, arguments);
      };
    }
  }

  function boot(){
    window.GJ_BATTLE_LOBBY_FRESH_ROOM_PATCH = {
      version: PATCH_VERSION,
      state,
      hardResetLobbyState,
      clearRoomUI,
      getActiveRoom,
      hasActiveRoom
    };

    if (!state.hasExplicitRoom && !hasActiveRoom()){
      hardResetLobbyState();
    }else{
      state.createdOrJoined = true;
    }

    patchButtons();

    setInterval(function(){
      patchInitFields();
      patchButtons();
      patchHostRepairGuard();
      patchStatusStabilizerGuard();
      blockOldRoomRender();
    }, 250);

    setTimeout(function(){
      state.bootLocked = false;
    }, 1600);

    console.info('[GoodJunk Battle Fresh Room Patch]', PATCH_VERSION, 'loaded', {
      explicitRoom: state.hasExplicitRoom,
      activeRoom: getActiveRoom()
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
