(function GoodJunkBattleV2LobbyFreshRoomPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.40-lobby-fresh-room-no-auto-lastroom';

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
    const roomCodeInput = $('#roomCodeInput');
    const btnStartBattle = $('#btnStartBattle');

    if (roomCodeText) roomCodeText.textContent = '----';

    /*
     * ถ้าไม่มี room จาก URL ชัดเจน ให้เคลียร์ช่อง room input ด้วย
     */
    if (!state.hasExplicitRoom && roomCodeInput){
      roomCodeInput.value = '';
    }

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

    /*
     * สำคัญ: ไม่ลบชื่อ/ pid แต่ลบ last room เพื่อไม่ auto join
     */
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

    /*
     * ถ้า lobby object ยังไม่พร้อม ให้ patch ผ่าน UI ก่อน
     */
    if (!state.hasExplicitRoom){
      hardResetLobbyState();
    }

    if (!lobby || lobby.__freshRoomPatched) return;

    lobby.__freshRoomPatched = true;

    /*
     * ครอบ createRoom / joinRoom เพื่อปลดล็อกเฉพาะเมื่อผู้ใช้กดจริง
     */
    if (typeof lobby.createRoom === 'function'){
      const originalCreate = lobby.createRoom;

      lobby.createRoom = async function(){
        state.userTouchedRoom = true;
        state.createdOrJoined = true;

        /*
         * ก่อนสร้างห้องใหม่ ล้างห้องเก่าออกจาก state
         */
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

    if (createBtn && createBtn.dataset.gjFreshRoomBound !== '1'){
      createBtn.dataset.gjFreshRoomBound = '1';
      createBtn.addEventListener('click', function(){
        state.userTouchedRoom = true;
        state.createdOrJoined = true;
      }, true);
    }

    if (joinBtn && joinBtn.dataset.gjFreshRoomBound !== '1'){
      joinBtn.dataset.gjFreshRoomBound = '1';
      joinBtn.addEventListener('click', function(){
        state.userTouchedRoom = true;
        state.createdOrJoined = true;
      }, true);
    }

    if (leaveBtn && leaveBtn.dataset.gjFreshRoomBound !== '1'){
      leaveBtn.dataset.gjFreshRoomBound = '1';
      leaveBtn.addEventListener('click', function(){
        state.userTouchedRoom = false;
        state.createdOrJoined = false;
        setTimeout(clearRoomUI, 150);
      }, true);
    }

    if (input && input.dataset.gjFreshRoomInputBound !== '1'){
      input.dataset.gjFreshRoomInputBound = '1';
      input.addEventListener('input', function(){
        state.userTouchedRoom = true;
      });
    }
  }

  function blockOldRoomRender(){
    /*
     * ถ้ายังไม่ได้กดสร้าง/เข้าห้อง และไม่มี room ใน URL
     * ให้บังคับ UI กลับเป็นว่าง กัน patch อื่น render ห้องเก่า
     */
    if (state.hasExplicitRoom) return;
    if (state.createdOrJoined) return;

    const roomText = $('#roomCodeText');
    const list = $('#playersList');

    const hasOldRoom =
      roomText &&
      roomText.textContent &&
      normalizeRoomCode(roomText.textContent) &&
      roomText.textContent.trim() !== '----';

    const hasPlayer =
      list &&
      /READY|host|online|score/i.test(list.textContent || '');

    if (hasOldRoom || hasPlayer){
      hardResetLobbyState();
    }
  }

  function patchHostRepairGuard(){
    const repair = window.GJ_BATTLE_LOBBY_HOST_REPAIR;
    if (!repair || repair.__freshRoomGuardPatched) return;

    repair.__freshRoomGuardPatched = true;

    if (typeof repair.repairCurrentRoom === 'function'){
      const originalRepairCurrent = repair.repairCurrentRoom;

      repair.repairCurrentRoom = async function(source){
        if (!state.hasExplicitRoom && !state.createdOrJoined){
          clearRoomUI();
          return false;
        }

        return await originalRepairCurrent.apply(repair, arguments);
      };
    }

    if (typeof repair.attachRoomListener === 'function'){
      const originalAttach = repair.attachRoomListener;

      repair.attachRoomListener = function(roomCode){
        if (!state.hasExplicitRoom && !state.createdOrJoined){
          clearRoomUI();
          return false;
        }

        return originalAttach.apply(repair, arguments);
      };
    }
  }

  function patchStatusStabilizerGuard(){
    const stabilizer = window.GJ_BATTLE_LOBBY_STATUS_STABILIZER;
    if (!stabilizer || stabilizer.__freshRoomGuardPatched) return;

    stabilizer.__freshRoomGuardPatched = true;

    if (typeof stabilizer.decideStableStatus === 'function'){
      const originalDecide = stabilizer.decideStableStatus;

      stabilizer.decideStableStatus = function(){
        if (!state.hasExplicitRoom && !state.createdOrJoined){
          return {
            key:'fresh-no-room',
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
      clearRoomUI
    };

    /*
     * ถ้าไม่ได้เปิดมาด้วย room ใน URL ให้เริ่มหน้าเปล่าเสมอ
     */
    if (!state.hasExplicitRoom){
      hardResetLobbyState();
    }else{
      state.createdOrJoined = true;
    }

    patchButtons();

    const t = setInterval(function(){
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
      explicitRoom: state.hasExplicitRoom
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
