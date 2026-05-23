(function GoodJunkBattleV2LobbyEmptyGuardPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.41-lobby-empty-guard-clear-stale-players';

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

  function getDisplayedRoom(){
  const text = $('#roomCodeText');
  const fromText = normalizeRoomCode(text && text.textContent);

  if (fromText && fromText !== '----'){
    return fromText;
  }

  return '';
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
    if (!repair || repair.__emptyGuardPatched) return;

    repair.__emptyGuardPatched = true;

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
    if (!lobby || lobby.__emptyGuardPatched) return;

    lobby.__emptyGuardPatched = true;

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
  }

  function observePlayersList(){
    const list = $('#playersList');
    if (!list || !window.MutationObserver) return;

    if (list.dataset.gjEmptyGuardObserved === '1') return;
    list.dataset.gjEmptyGuardObserved = '1';

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

    if (createBtn && createBtn.dataset.gjEmptyGuardCreate !== '1'){
      createBtn.dataset.gjEmptyGuardCreate = '1';
      createBtn.addEventListener('click', function(){
        document.documentElement.dataset.gjBattleUserEnteredRoom = '1';
      }, true);
    }

    if (joinBtn && joinBtn.dataset.gjEmptyGuardJoin !== '1'){
      joinBtn.dataset.gjEmptyGuardJoin = '1';
      joinBtn.addEventListener('click', function(){
        document.documentElement.dataset.gjBattleUserEnteredRoom = '1';
      }, true);
    }

    if (leaveBtn && leaveBtn.dataset.gjEmptyGuardLeave !== '1'){
      leaveBtn.dataset.gjEmptyGuardLeave = '1';
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

    const userEntered = document.documentElement.dataset.gjBattleUserEnteredRoom === '1';

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
      renderEmptyPlayers
    };

    /*
     * เปิด lobby ใหม่ ไม่มี room ใน URL = ต้องสะอาดทันที
     */
    if (isEmptyLobby()){
      clearLobbyState();
    }

    setInterval(hardGuardLoop, 250);

    console.info('[GoodJunk Battle Empty Guard Patch]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
