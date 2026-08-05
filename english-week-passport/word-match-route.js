(function () {
  "use strict";
  const GAME_URL = "./word-match-memory.html?v=20260805-buttons7";
  const selector = '.stage-card[data-stage="word_match"].clickable';

  function decorateCard(){
    const card=document.querySelector('.stage-card[data-stage="word_match"]');
    if(!card)return;
    card.classList.add("memory-stage-card");
    const title=card.querySelector("div:nth-child(2) > strong");
    if(title)title.textContent="LEXICON X Challenge";
    const detail=card.querySelector("small");
    if(detail)detail.textContent="Adaptive Tilt + Swipe Assist • Safe V7 • CEFR A2–B1+";
    const state=card.querySelector(".stage-state");
    if(state&&card.classList.contains("ready"))state.textContent="พร้อมเริ่ม Challenge";
    card.dataset.lexiconDecorated="1";
  }

  function openGame(event){
    const card=event.target?.closest?.(selector);
    if(!card)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();location.href=GAME_URL;
  }
  function openByKeyboard(event){if(event.key!=="Enter"&&event.key!==" ")return;openGame(event);}
  function autoResume(){
    const params=new URLSearchParams(location.search);
    if(params.get("resume")!=="memory")return;
    let identity=null;
    try{identity=JSON.parse(localStorage.getItem(window.EW_CONFIG.cacheKeys.identity)||"null");}catch(_){}
    if(!identity?.playerId)return;
    const form=document.getElementById("loginForm"),input=document.getElementById("playerId");
    if(!form||!input){setTimeout(autoResume,120);return;}
    input.value=identity.playerId;
    const nick=document.getElementById("nickname");
    if(nick)nick.value=identity.nickname||identity.fullName||"";
    params.delete("resume");
    history.replaceState(null,"",`${location.pathname}${params.toString()?`?${params}`:""}`);
    const start=document.getElementById("loginStartBtn")||form.querySelector(".btn-primary");
    if(start){start.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true,pointerType:"touch"}));start.click();}
  }
  const style=document.createElement("style");style.textContent=`.stage-card.memory-stage-card.ready{border-color:#38bdf8;background:linear-gradient(135deg,#f8fbff,#e8f3fb)}.stage-card.memory-stage-card .stage-icon{background:linear-gradient(135deg,#e9f3fa,#dcecf8);position:relative}.stage-card.memory-stage-card.ready>div:nth-child(2)>strong{letter-spacing:.01em;color:#0f2742}.stage-card.passed.memory-stage-card .stage-icon::after{content:" LX";font-size:.42rem;font-weight:900;color:#184d73;position:absolute;margin-top:48px}`;document.head.appendChild(style);
  document.addEventListener("click",openGame,true);document.addEventListener("keydown",openByKeyboard,true);new MutationObserver(decorateCard).observe(document.getElementById("screen")||document.body,{childList:true,subtree:true});decorateCard();setTimeout(autoResume,100);
}());
