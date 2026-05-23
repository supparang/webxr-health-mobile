(function GoodJunkBattleV2LobbyVisualLockPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.37-lobby-visual-lock-no-shake';

  const state = {
    lastStatusText:'',
    lastStatusClass:'',
    lastButtonText:'',
    lastButtonDisabled:null,
    lastButtonReady:null
  };

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function injectStyle(){
    if ($('#gjBattleLobbyVisualLockStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjBattleLobbyVisualLockStyle';
    style.textContent = `
      /*
       * ปิดอาการสั่นของปุ่มพร้อมเริ่ม Battle
       * เดิม #btnStartBattle.is-ready มี animation pulse ทำให้ดูเหมือน status ไม่นิ่ง
       */
      #btnStartBattle.is-ready{
        animation:none !important;
        transform:none !important;
      }

      #btnStartBattle,
      #lobbyStatus{
        will-change:auto !important;
      }

      /*
       * ล็อกกล่อง status ให้ไม่ยืด/หดเวลา repaint
       */
      #lobbyStatus{
        min-height:58px;
        display:flex;
        align-items:center;
      }

      /*
       * ปุ่ม start ให้สูงนิ่ง ไม่กระโดด
       */
      #btnStartBattle{
        min-height:54px;
      }

      html.gj-lobby-visual-lock-ready #btnStartBattle.is-ready{
        box-shadow:0 8px 0 rgba(70,170,80,.18) !important;
      }
    `;

    document.head.appendChild(style);
  }

  function applyOnlyWhenChanged(){
    const status = $('#lobbyStatus');
    const btn = $('#btnStartBattle');

    if (status){
      const text = status.textContent || '';
      const cls = status.className || '';

      if (text === state.lastStatusText && cls === state.lastStatusClass){
        /*
         * ไม่ต้องทำอะไร ปล่อยนิ่ง
         */
      }else{
        state.lastStatusText = text;
        state.lastStatusClass = cls;
      }
    }

    if (btn){
      const text = btn.textContent || '';
      const disabled = !!btn.disabled;
      const ready = btn.classList.contains('is-ready');

      /*
       * ถ้าปุ่มพร้อมแล้ว ให้ล็อก class ไว้ ไม่ให้เด้งจาก animation/interval
       */
      if (ready && !disabled){
        document.documentElement.classList.add('gj-lobby-visual-lock-ready');
        btn.style.animation = 'none';
        btn.style.transform = 'none';
      }else{
        document.documentElement.classList.remove('gj-lobby-visual-lock-ready');
      }

      state.lastButtonText = text;
      state.lastButtonDisabled = disabled;
      state.lastButtonReady = ready;
    }
  }

  function patchStabilizerApply(){
    const stabilizer = window.GJ_BATTLE_LOBBY_STATUS_STABILIZER;

    if (!stabilizer || stabilizer.__visualLockPatched) return;

    stabilizer.__visualLockPatched = true;

    const originalApply = stabilizer.applyWanted;

    if (typeof originalApply !== 'function') return;

    stabilizer.applyWanted = function(force){
      const status = $('#lobbyStatus');
      const btn = $('#btnStartBattle');

      const before = {
        statusText: status ? status.textContent : '',
        statusClass: status ? status.className : '',
        btnText: btn ? btn.textContent : '',
        btnDisabled: btn ? !!btn.disabled : null,
        btnReady: btn ? btn.classList.contains('is-ready') : null
      };

      const result = originalApply.call(stabilizer, force);

      const afterStatus = $('#lobbyStatus');
      const afterBtn = $('#btnStartBattle');

      const after = {
        statusText: afterStatus ? afterStatus.textContent : '',
        statusClass: afterStatus ? afterStatus.className : '',
        btnText: afterBtn ? afterBtn.textContent : '',
        btnDisabled: afterBtn ? !!afterBtn.disabled : null,
        btnReady: afterBtn ? afterBtn.classList.contains('is-ready') : null
      };

      /*
       * ถ้าไม่มีอะไรเปลี่ยนจริง หยุด visual side effect
       */
      if (
        before.statusText === after.statusText &&
        before.statusClass === after.statusClass &&
        before.btnText === after.btnText &&
        before.btnDisabled === after.btnDisabled &&
        before.btnReady === after.btnReady
      ){
        applyOnlyWhenChanged();
        return result;
      }

      applyOnlyWhenChanged();
      return result;
    };
  }

  function boot(){
    injectStyle();

    setInterval(function(){
      patchStabilizerApply();
      applyOnlyWhenChanged();
    }, 250);

    window.GJ_BATTLE_LOBBY_VISUAL_LOCK = {
      version: PATCH_VERSION,
      state
    };

    console.info('[GoodJunk Battle Lobby Visual Lock]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
