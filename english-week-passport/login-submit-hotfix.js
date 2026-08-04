(function(){
  "use strict";

  const VERSION="2026-08-04-EW-LOGIN-SUBMIT-HOTFIX-V1";
  let lastSubmitAt=0;

  function submitForm(form){
    const now=Date.now();
    if(!form||now-lastSubmitAt<700)return;
    lastSubmitAt=now;

    const player=form.querySelector("#playerId");
    if(!String(player?.value||"").trim()){
      player?.focus();
      return;
    }

    try{
      if(typeof form.requestSubmit==="function"){
        form.requestSubmit();
      }else{
        form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
      }
    }catch(error){
      console.error("EW login hotfix submit failed",error);
      form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
    }
  }

  function bind(){
    const form=document.getElementById("loginForm");
    if(!form||form.dataset.ewSubmitHotfix==="1")return;
    form.dataset.ewSubmitHotfix="1";

    const button=form.querySelector('button[type="submit"]');
    if(button){
      const activate=event=>{
        event.preventDefault();
        event.stopPropagation();
        submitForm(form);
      };
      button.addEventListener("pointerup",activate,{passive:false});
      button.addEventListener("touchend",activate,{passive:false});
      button.addEventListener("click",activate,{passive:false});
    }

    form.addEventListener("keydown",event=>{
      if(event.key!=="Enter")return;
      event.preventDefault();
      submitForm(form);
    });
  }

  bind();
  const observer=new MutationObserver(bind);
  observer.observe(document.getElementById("screen")||document.body,{childList:true,subtree:true});

  window.EW_LOGIN_SUBMIT_HOTFIX=Object.freeze({version:VERSION});
}());
