(function GoodJunkBattleV2LobbyStatusHardLockPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.44-lobby-status-hard-visual-lock';

  function $(sel, root){ return (root || document).querySelector(sel); }

  function injectStyle(){
    if ($('#gjLobbyStatusHardLockStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjLobbyStatusHardLockStyle';
    style.textContent = `
      #lobbyStatus.gj-status-hard-lock{
        position:relative !important;
        min-height:64px !important;
        display:block !important;
        color:transparent !important;
        overflow:hidden !important;
        transition:none !important;
        animation:none !important;
        will-change:auto !important;
        transform:none !important;
      }

      #lobbyStatus.gj-status-hard-lock::after{
        content:attr(data-gj-stable-text);
        position:absolute;
        inset:0;
        display:flex;
        align-items:center;
        padding:11px 13px;
        color:#2d723b;
        font-weight:950;
        line-height:1.4;
        white-space:normal;
        pointer-events:none;
        background:transparent;
        transition:none !important;
        animation:none !important;
        transform:none !important;
      }

      #lobbyStatus.gj-status-hard-lock.status.warn::after{ color:#8a5a20; }
      #lobbyStatus.gj-status-hard-lock.status.bad::after{ color:#8d2b1f; }
      #lobbyStatus.gj-status-hard-lock.status.good::after{ color:#2d723b; }

      #lobbyStatus,
      #lobbyStatus *{
        transition:none !important;
        animation:none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getStableText(){
    const stabilizer = window.GJ_BATTLE_LOBBY_STATUS_STABILIZER;
    if (stabilizer && typeof stabilizer.decideStableStatus === 'function'){
      try{
        const next = stabilizer.decideStableStatus();
        if (next && next.text) return {text:next.text, cls:next.cls || 'warn'};
      }catch(_){}
    }

    const el = $('#lobbyStatus');
    return {
      text:el ? (el.textContent || 'กำลัง sync ผู้เล่นในห้อง...') : 'กำลัง sync ผู้เล่นในห้อง...',
      cls:el && el.classList.contains('good') ? 'good' : el && el.classList.contains('bad') ? 'bad' : 'warn'
    };
  }

  function applyHardLock(force){
    const el = $('#lobbyStatus');
    if (!el) return;

    const stable = getStableText();
    const oldText = el.getAttribute('data-gj-stable-text') || '';
    const oldCls = el.getAttribute('data-gj-stable-cls') || '';

    if (!force && oldText === stable.text && oldCls === stable.cls) return;

    el.classList.add('gj-status-hard-lock');
    el.classList.remove('good','warn','bad');
    el.classList.add('status', stable.cls);
    el.setAttribute('data-gj-stable-text', stable.text);
    el.setAttribute('data-gj-stable-cls', stable.cls);
  }

  function observeStatus(){
    const el = $('#lobbyStatus');
    if (!el || !window.MutationObserver) return;
    if (el.dataset.gjHardLockObserved === '1') return;
    el.dataset.gjHardLockObserved = '1';

    const mo = new MutationObserver(function(){
      requestAnimationFrame(function(){ applyHardLock(false); });
    });

    mo.observe(el, {childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['class']});
  }

  function boot(){
    injectStyle();
    applyHardLock(true);
    observeStatus();

    setInterval(function(){
      applyHardLock(false);
      observeStatus();
    }, 500);

    window.GJ_BATTLE_LOBBY_STATUS_HARD_LOCK = { version: PATCH_VERSION, applyHardLock };
    console.info('[GoodJunk Battle Lobby Status Hard Lock]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
