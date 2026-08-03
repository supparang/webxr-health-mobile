(function(){
  "use strict";
  const URL="./sentence-builder.html?v=20260803-sentence2";
  const selector='.stage-card[data-stage="sentence_city"].clickable';
  function decorate(){const card=document.querySelector('.stage-card[data-stage="sentence_city"]');if(!card||card.dataset.sentenceDecorated==="1")return;card.dataset.sentenceDecorated="1";card.classList.add("sentence-stage-card");const detail=card.querySelector("small");if(detail)detail.textContent="Hand Pinch Builder • 24-task Bank • A2–B1+";const state=card.querySelector(".stage-state");if(state&&card.classList.contains("ready"))state.innerHTML="Hand Builder พร้อมเล่น 🖐️";}
  function open(e){const card=e.target?.closest?.(selector);if(!card)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();location.href=URL;}
  function key(e){if(e.key==="Enter"||e.key===" ")open(e);}
  function resume(){const p=new URLSearchParams(location.search);if(p.get("resume")!=="sentence")return;let id=null;try{id=JSON.parse(localStorage.getItem(window.EW_CONFIG.cacheKeys.identity)||"null");}catch(_){}if(!id?.playerId)return;const form=document.getElementById("loginForm"),input=document.getElementById("playerId");if(!form||!input)return;input.value=id.playerId;const nick=document.getElementById("nickname");if(nick)nick.value=id.nickname||id.fullName||"";p.delete("resume");history.replaceState(null,"",`${location.pathname}${p.toString()?`?${p}`:""}`);if(typeof form.requestSubmit==="function")form.requestSubmit();else form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));}
  const style=document.createElement("style");style.textContent='.stage-card.sentence-stage-card.ready{border-color:#8f6ee8;background:linear-gradient(135deg,#fbf9ff,#f0ecff)}.stage-card.sentence-stage-card .stage-icon{background:linear-gradient(135deg,#eee7ff,#f8f4ff)}';document.head.appendChild(style);
  document.addEventListener("click",open,true);document.addEventListener("keydown",key,true);new MutationObserver(decorate).observe(document.getElementById("screen")||document.body,{childList:true,subtree:true});decorate();setTimeout(resume,80);
}());
