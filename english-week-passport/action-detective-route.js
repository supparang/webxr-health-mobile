(function(){
  "use strict";
  const URL="./action-detective.html?v=20260803-action1";
  const selector='.stage-card[data-stage="word_detective"].clickable';
  function decorate(){
    const card=document.querySelector('.stage-card[data-stage="word_detective"]');
    if(!card||card.dataset.actionDecorated==="1")return;
    card.dataset.actionDecorated="1";card.classList.add("action-stage-card");
    const small=card.querySelector("small");if(small)small.textContent="Body Pose • AR Scan • Hand Tracking";
    const state=card.querySelector(".stage-state");if(state&&card.classList.contains("ready"))state.innerHTML="Action Lab พร้อมเล่น 🎥";
  }
  function open(event){const card=event.target?.closest?.(selector);if(!card)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();location.href=URL;}
  function key(event){if(event.key!=="Enter"&&event.key!==" ")return;open(event);}
  function resume(){const p=new URLSearchParams(location.search);if(p.get("resume")!=="action")return;let id=null;try{id=JSON.parse(localStorage.getItem(window.EW_CONFIG.cacheKeys.identity)||"null");}catch(_){}if(!id?.playerId)return;const form=document.getElementById("loginForm"),input=document.getElementById("playerId");if(!form||!input)return;input.value=id.playerId;const nick=document.getElementById("nickname");if(nick)nick.value=id.nickname||id.fullName||"";p.delete("resume");history.replaceState(null,"",`${location.pathname}${p.toString()?`?${p}`:""}`);form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));}
  const style=document.createElement("style");style.textContent='.stage-card.action-stage-card.ready{border-color:#55c9dc;background:linear-gradient(135deg,#f1fcff,#f2fff8)}.stage-card.action-stage-card .stage-icon{background:linear-gradient(135deg,#dff8ff,#e2faeb)}';document.head.appendChild(style);
  document.addEventListener("click",open,true);document.addEventListener("keydown",key,true);new MutationObserver(decorate).observe(document.getElementById("screen")||document.body,{childList:true,subtree:true});decorate();setTimeout(resume,70);
}());
