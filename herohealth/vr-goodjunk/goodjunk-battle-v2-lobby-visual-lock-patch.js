(function GoodJunkBattleV2LobbyVisualLockPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.44-lobby-visual-lock-no-shake';

  function $(sel, root){ return (root || document).querySelector(sel); }

  function injectStyle(){
    if ($('#gjBattleLobbyVisualLockStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjBattleLobbyVisualLockStyle';
    style.textContent = `
      #btnStartBattle.is-ready{
        animation:none !important;
        transform:none !important;
      }

      #btnStartBattle,
      #lobbyStatus{
        will-change:auto !important;
      }

      #lobbyStatus{
        min-height:58px;
        display:flex;
        align-items:center;
      }

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
    const btn = $('#btnStartBattle');
    if (btn){
      const ready = btn.classList.contains('is-ready');
      const disabled = !!btn.disabled;

      if (ready && !disabled){
        document.documentElement.classList.add('gj-lobby-visual-lock-ready');
        btn.style.animation = 'none';
        btn.style.transform = 'none';
      }else{
        document.documentElement.classList.remove('gj-lobby-visual-lock-ready');
      }
    }
  }

  function patchStabilizerApply(){
    const stabilizer = window.GJ_BATTLE_LOBBY_STATUS_STABILIZER;
    if (!stabilizer || stabilizer.__visualLockPatched) return;
    stabilizer.__visualLockPatched = true;

    const originalApply = stabilizer.applyWanted;
    if (typeof originalApply !== 'function') return;

    stabilizer.applyWanted = function(force){
      const result = originalApply.call(stabilizer, force);
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

    window.GJ_BATTLE_LOBBY_VISUAL_LOCK = { version: PATCH_VERSION };
    console.info('[GoodJunk Battle Lobby Visual Lock]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
