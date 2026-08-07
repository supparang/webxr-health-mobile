(function(){
'use strict';
const VERSION='2026-08-07-CANONICAL-FIVE-GAME-ROUTES-V1.2';
const ROUTES={
  word_match:{title:'LexiMatch Navigator',detail:'Game 1 • จับคู่คำศัพท์ • Swipe + Tilt • A2–B1+',icon:'🧭'},
  category_forest:{title:'Category Forest',detail:'Game 2 • ลากคำเข้าหมวด • Rescue Learning',icon:'🌲'},
  sentence_city:{title:'Sentence City',detail:'Game 3 • AR Hand Builder • Clean Bank V2',icon:'🏙️'},
  word_detective:{title:'Conversation Quest AR',detail:'Game 4 • เลือกบทสนทนาและพูดทุกช่วง',icon:'💬'},
  final_boss:{title:'Champion Command Arena',detail:'Game 5 • 5 Gates + 1 Final Boss',icon:'👑'}
};
let scheduled=false;
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
function decorateNow(){
  scheduled=false;
  Object.entries(ROUTES).forEach(([stage,route])=>{
    const card=document.querySelector(`.stage-card[data-stage="${stage}"]`);if(!card)return;
    if(card.dataset.canonicalDecorated===VERSION)return;
    card.dataset.canonicalRoute='1';card.dataset.canonicalDecorated=VERSION;card.classList.add('canonical-game-card');
    const icon=card.querySelector('.stage-icon');setText(icon,route.icon);
    const title=card.querySelector('div:nth-child(2)>strong');setText(title,route.title);
    const detail=card.querySelector('div:nth-child(2)>small');
    if(detail){const best=(detail.textContent.match(/• ดีที่สุด[^•]*/)||[])[0]||'';setText(detail,route.detail+(best?' '+best:''));}
    const state=card.querySelector('.stage-state');if(state&&card.classList.contains('ready'))setText(state,'พร้อมเล่น');
  });
}
function scheduleDecorate(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorateNow);}
function openStage(stage){
  const identity=(()=>{try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}})();
  if(!identity?.playerId)return;
  const query=new URLSearchParams({stage,run:'1',v:'20260807-passport-shell12'});
  location.assign('./passport-game-shell-v1.html?'+query.toString());
}
function intercept(event){
  const card=event.target?.closest?.('.stage-card.canonical-game-card.clickable');if(!card)return;
  const stage=card.dataset.stage;if(!ROUTES[stage])return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openStage(stage);
}
function keyboard(event){if(event.key!=='Enter'&&event.key!==' ')return;intercept(event)}
document.addEventListener('click',intercept,true);document.addEventListener('keydown',keyboard,true);
new MutationObserver(scheduleDecorate).observe(document.getElementById('screen')||document.body,{childList:true,subtree:true});
const style=document.createElement('style');style.textContent='.stage-card.canonical-game-card.ready{border-color:#7c75e8;background:linear-gradient(135deg,#fbfaff,#eef5ff)}.stage-card.canonical-game-card.ready .stage-icon{background:linear-gradient(135deg,#ebe7ff,#ddf6ff)}';document.head.appendChild(style);
decorateNow();
window.EW_CANONICAL_ROUTES=Object.freeze({version:VERSION,routes:ROUTES,openStage});
}());
