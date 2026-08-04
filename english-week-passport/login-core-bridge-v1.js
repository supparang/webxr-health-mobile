(function(){
  "use strict";
  const VERSION="2026-08-04-LOGIN-CORE-BRIDGE-V1";
  const nativeAdd=EventTarget.prototype.addEventListener;
  let loginHandler=null;
  let busy=false;

  EventTarget.prototype.addEventListener=function(type,listener,options){
    try{
      if(type==="submit"&&this&&this.id==="loginForm"&&typeof listener==="function"){
        loginHandler=listener;
        this.dataset.loginCoreBridge="captured";
      }
    }catch(_){}
    return nativeAdd.call(this,type,listener,options);
  };

  function bind(){
    const form=document.getElementById("loginForm");
    if(!form||form.dataset.loginCoreButtonBound==="1")return;
    const button=form.querySelector('button[type="submit"],button.btn-primary');
    if(!button)return;
    form.dataset.loginCoreButtonBound="1";
    button.type="button";
    button.id="loginStartBtn";
    button.onclick=async function(event){
      event.preventDefault();
      if(busy)return;
      const playerId=String(form.querySelector("#playerId")?.value||"").trim();
      if(!playerId){form.querySelector("#playerId")?.focus();return;}
      if(typeof loginHandler!=="function"){
        console.error("EW login handler was not captured");
        return;
      }
      busy=true;
      button.disabled=true;
      try{
        await loginHandler({
          preventDefault(){},
          currentTarget:form,
          target:form,
          type:"submit",
          isTrusted:true
        });
      }catch(error){
        console.error("EW login core bridge failed",error);
      }finally{
        busy=false;
        if(button.isConnected)button.disabled=false;
      }
    };
  }

  const observer=new MutationObserver(bind);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("DOMContentLoaded",bind,{once:true});
  setTimeout(bind,0);
  window.EW_LOGIN_CORE_BRIDGE=Object.freeze({version:VERSION});
}());
