(function(){
  "use strict";

  const VERSION="2026-08-04-EW-LOGIN-DIRECT-SUBMIT-V2";

  function bind(){
    const form=document.getElementById("loginForm");
    if(!form||form.dataset.ewDirectSubmitV2==="1")return;
    const button=form.querySelector('button[type="submit"]');
    if(!button)return;

    form.dataset.ewDirectSubmitV2="1";
    button.addEventListener("click",function(event){
      event.preventDefault();
      event.stopPropagation();

      const player=form.querySelector("#playerId");
      if(!String(player?.value||"").trim()){
        player?.focus();
        return;
      }

      let submitEvent;
      try{
        submitEvent=new SubmitEvent("submit",{
          bubbles:true,
          cancelable:true,
          submitter:button
        });
      }catch(_){
        submitEvent=new Event("submit",{bubbles:true,cancelable:true});
      }
      form.dispatchEvent(submitEvent);
    },false);
  }

  bind();
  const observer=new MutationObserver(bind);
  observer.observe(document.getElementById("screen")||document.body,{childList:true,subtree:true});

  window.EW_LOGIN_DIRECT_SUBMIT_V2=Object.freeze({version:VERSION});
}());
