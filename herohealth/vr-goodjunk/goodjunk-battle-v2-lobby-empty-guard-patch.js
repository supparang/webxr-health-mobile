(function GoodJunkBattleV2LobbyEmptyGuardPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.42-lobby-empty-guard-active-room-only';

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

  function hasExplicitRoomInUrl(){
    const p = new URL(location.href).searchParams;
    return !!(
      normalizeRoomCode(p.get('room')) ||
      normalizeRoomCode(p.get('roomCode')) ||
      normalizeRoomCode(p.get('code')) ||
      normalizeRoomCode(p.get('lastRoom'))
    );
  }

  function getActiveRoomFromText(){
    const text = $('#roomCodeText');
    const fromText =
      text && text.textContent && text.textContent.trim() !== '----'
        ? text.textContent
        : '';

    return normalizeRoomCode(fromText);
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

  function getDisplayedRoom(){
    /*
     * สำคัญ:
     * ไม่อ่าน #roomCodeInput แล้ว
     * เพราะ input เป็นช่องกรอกรหัส ไม่ใช่ active room
     */
    return normalizeRoomCode(
      getActiveRoomFromLobbyState() ||
      getActiveRoomFromText() ||
      ''
    );
  }

  function isEmptyLobby(){
    return !hasExplicitRoomInUrl() && !getDisplayedRoom();
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

  function clearStatus(){
    const status = $('#lobbyStatus');

    if (status){
      status.className = 'status warn';
      status.textContent = 'ยังไม่ได้สร้างหรือเข้าห้อง';
      status.setAttribute('data-gj-stable-text', 'ยังไม่ได้สร้างหรือเข้าห้อง');
      status.setAttribute('data-gj-stable-cls', 'warn');
    }

    const btn = $('#btnStartBattle');

    if (btn){
      btn.disabled = true;
      btn.textContent = '⏳ รอผู้เล่นอีก 1 คน';
      btn.classList.remove('is-ready');
      btn.classList.add('is-disabled');
    }
  }

  function clearLobbyState(){
    const roomText = $('#roomCodeText');

    if (roomText){
      roomText.textContent = '----';
    }

    /*
     * ไม่ล้าง #roomCodeInput
     * เพื่อให้ผู้ใช้พิมพ์/คัดลอก room code ค้างไว้ได้
     * แต่ยังไม่ถือว่าเข้าห้องจนกว่าจะกด “เข้าห้อง”
     */

    const lobby = window.GJ_BATTLE_LOBBY;

    if (lobby && lobby.state){
      lobby.state.roomCode = '';
      lobby.state.room = null;
      lobby.state.roomRef = null;
      lobby.state.listenerAttached = false;
      lobby.state.attachedRoomCode = '';
      lobby.state.redirecting = false;
      lobby.state.lastRoomKey = '';
    }

    const repair = window.GJ_BATTLE_LOBBY_HOST_REPAIR;

    if (repair && repair.state){
      repair.state.roomCode = '';
      repair.state.roomRef = null;
      repair.state.attached = false;
      repair.state.lastRoom = null;
      repair.state.lastRoomKey = '';
    }

    try{
      localStorage.removeItem('GJ_BATTLE_LAST_ROOM');
      sessionStorage.removeItem('GJ_BATTLE_LAST_ROOM');
    }catch(_){}

    renderEmptyPlayers();
    clearStatus();
  }

  function patchHostRepairRender(){
    const repair = window.GJ_BATTLE_LOBBY_HOST_REPAIR;
    if (!repair || repair.__emptyGuardPatchedV2442) return;

    repair.__emptyGuardPatchedV2442 = true;

    if (typeof repair.repairCurrentRoom === 'function'){
      const originalRepairCurrentRoom = repair.repairCurrentRoom;

      repair.repairCurrentRoom = async function(){
        if (isEmptyLobby()){
          clearLobbyState();
          return false;
        }

        return await originalRepairCurrentRoom.apply(repair, arguments);
      };
    }

    if (typeof repair.attachRoomListener === 'function'){
      const originalAttachRoomListener = repair.attachRoomListener;

      repair.attachRoomListener = function(roomCode){
        if (isEmptyLobby()){
          clearLobbyState();
          return false;
        }

        return originalAttachRoomListener.apply(repair, arguments);
      };
    }
  }

  function patchLobbyRender(){
    const lobby = window.GJ_BATTLE_LOBBY;
    if (!lobby || lobby.__emptyGuardPatchedV2442) return;

    lobby.__emptyGuardPatchedV2442 = true;

    if (typeof lobby.checkRoomForStart === 'function'){
      const originalCheckRoomForStart = lobby.checkRoomForStart;

      lobby.checkRoomForStart = function(){
        if (isEmptyLobby()){
          clearLobbyState();
          return false;
        }

        return originalCheckRoomForStart.apply(lobby, arguments);
      };
    }

    if (typeof lobby.canStartBattle === 'function'){
      const originalCanStartBattle = lobby.canStartBattle;

      lobby.canStartBattle = function(){
        if (isEmptyLobby()){
          return {
            ok:false,
            reason:'empty-lobby',
            onlineCount:0,
            host:false
          };
        }

        return originalCanStartBattle.apply(lobby, arguments);
      };
    }

    if (typeof lobby.redirectToRun === 'function'){
      const originalRedirectToRun = lobby.redirectToRun;

      lobby.redirectToRun = function(){
        if (isEmptyLobby()){
          clearLobbyState();
          return false;
        }

        return originalRedirectToRun.apply(lobby, arguments);
      };
    }
  }

  function observePlayersList(){
    const list = $('#playersList');
    if (!list || !window.MutationObserver) return;

    if (list.dataset.gjEmptyGuardObservedV2442 === '1') return;
    list.dataset.gjEmptyGuardObservedV2442 = '1';

    const mo = new MutationObserver(function(){
      if (!isEmptyLobby()) return;

      const txt = list.textContent || '';

      if (/READY|LEFT|host|online|score/i.test(txt)){
        requestAnimationFrame(clearLobbyState);
      }
    });

    mo.observe(list, {
      childList:true,
      subtree:true,
      characterData:true
    });
  }

  function bindButtons(){
    const createBtn = $('#btnCreateRoom');
    const joinBtn = $('#btnJoinRoom');
    const leaveBtn = $('#btnLeaveRoom');

    if (createBtn && createBtn.dataset.gjEmptyGuardCreateV2442 !== '1'){
      createBtn.dataset.gjEmptyGuardCreateV2442 = '1';

      createBtn.addEventListener('click', function(){
        document.documentElement.dataset.gjBattleUserEnteredRoom = '1';
      }, true);
    }

    if (joinBtn && joinBtn.dataset.gjEmptyGuardJoinV2442 !== '1'){
      joinBtn.dataset.gjEmptyGuardJoinV2442 = '1';

      joinBtn.addEventListener('click', function(){
        document.documentElement.dataset.gjBattleUserEnteredRoom = '1';
      }, true);
    }

    if (leaveBtn && leaveBtn.dataset.gjEmptyGuardLeaveV2442 !== '1'){
      leaveBtn.dataset.gjEmptyGuardLeaveV2442 = '1';

      leaveBtn.addEventListener('click', function(){
        document.documentElement.dataset.gjBattleUserEnteredRoom = '';
        setTimeout(clearLobbyState, 120);
      }, true);
    }
  }

  function hardGuardLoop(){
    patchHostRepairRender();
    patchLobbyRender();
    observePlayersList();
    bindButtons();

    const userEntered =
      document.documentElement.dataset.gjBattleUserEnteredRoom === '1';

    /*
     * ถ้ายังไม่มี active room จริง แม้ input จะมีรหัสอยู่
     * ก็ต้องห้าม render ผู้เล่นค้าง
     */
    if (isEmptyLobby() && !userEntered){
      const list = $('#playersList');
      const txt = list ? list.textContent || '' : '';

      if (/READY|LEFT|host|online|score/i.test(txt)){
        clearLobbyState();
      }
    }
  }

  function boot(){
    window.GJ_BATTLE_LOBBY_EMPTY_GUARD = {
      version: PATCH_VERSION,
      isEmptyLobby,
      clearLobbyState,
      renderEmptyPlayers,
      getDisplayedRoom,
      getActiveRoomFromText,
      getActiveRoomFromLobbyState
    };

    if (isEmptyLobby()){
      clearLobbyState();
    }

    setInterval(hardGuardLoop, 250);

    console.info('[GoodJunk Battle Empty Guard Patch]', PATCH_VERSION, 'loaded', {
      activeRoom:getDisplayedRoom(),
      explicitRoom:hasExplicitRoomInUrl()
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
