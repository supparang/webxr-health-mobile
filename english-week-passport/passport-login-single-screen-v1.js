(function(){
  'use strict';
  const VERSION='2026-08-07-PASSPORT-LOGIN-SINGLE-SCREEN-V1';
  const screen=document.getElementById('screen');
  if(!screen)return;

  function sync(){
    const active=Boolean(screen.querySelector('#loginForm'));
    screen.classList.toggle('login-mode',active);
    document.body.classList.toggle('ew-login-single-screen',active);
  }

  sync();
  new MutationObserver(sync).observe(screen,{childList:true,subtree:true});
  window.EW_LOGIN_SINGLE_SCREEN=Object.freeze({version:VERSION});
}());
