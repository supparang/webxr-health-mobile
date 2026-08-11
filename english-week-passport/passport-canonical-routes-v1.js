(function(){
'use strict';
const VERSION='2026-08-11-CANONICAL-FIVE-GAME-ROUTES-R10-EVENT-DAY';
const ROUTES={
  word_match:{title:'LexiMatch Navigator',detail:'Game 1 • จับคู่คำศัพท์ • Swipe + Tilt • A2–B1+',icon:'🧭'},
  category_forest:{title:'Category Forest',detail:'Game 2 • ลากคำเข้าหมวด • Rescue Learning',icon:'🌲'},
  sentence_city:{title:'Sentence City',detail:'Game 3 • AR Hand Builder • Clean Bank V2',icon:'🏙️'},
  word_detective:{title:'Conversation Quest',detail:'Game 4 • เลือกบทสนทนาและพูดทุกช่วง',icon:'💬'},
  bonus_lens:{title:'Lexicon Lens Hunt',detail:'Bonus Mission • กล้องหลังค้นหา QR Clue • ไม่บังคับ Certificate',icon:'📷',bonus:true},
  final_boss:{title:'LEXICON Champion Arena',detail:'Game 5 • 4 Gates + Final Boss • Move → Decide → Speak',icon:'👑'}
};
let scheduled=false;
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
function setClassName(el,value){if(el&&el.className!==value)el.className=value;}
function setData(el,key,value){if(el&&el.dataset[key]!==value)el.dataset[key]=value;}
function readIdentity(){try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
function bonusBest(identity){try{return JSON.parse(localStorage.getItem(`ew_bonus_lens_best::${identity?.playerId||''}`)||'null')}catch(_){return null}}
function currentView(){return new URLSearchParams(location.search).get('view')==='mobile'?'mobile':''}
function carryView(query){const view=currentView();if(view)query.set('view',view);return query}
function makeInteractive(card){
  if(!card)return;
  const unlocked=card.classList.contains('ready')||card.classList.contains('passed');
  if(card.classList.contains('clickable')!==unlocked)card.classList.toggle('clickable',unlocked);
  if(unlocked){
    if(card.tabIndex!==0)card.tabIndex=0;
    if(card.getAttribute('role')!=='button')card.setAttribute('role','button');
    if(card.style.pointerEvents!=='auto')card.style.pointerEvents='auto';
    if(card.hasAttribute('inert'))card.removeAttribute('inert');
  }else{
    if(card.hasAttribute('tabindex'))card.removeAttribute('tabindex');
    if(card.hasAttribute('role'))card.removeAttribute('role');
  }
}
function ensureBonusCard(){
  const source=document.querySelector('.stage-card[data-stage="word_detective"]');
  if(!source)return null;
  let card=document.querySelector('.stage-card[data-stage="bonus_lens"]');
  const ready=source.classList.contains('passed');
  const identity=readIdentity();const best=bonusBest(identity);
  if(!card){card=document.createElement('article');card.dataset.stage='bonus_lens';source.insertAdjacentElement('afterend',card);}
  const wantedClass=`stage-card canonical-game-card bonus-lens-card ${ready?'ready clickable':'locked'}`;
  setClassName(card,wantedClass);
  setData(card,'canonicalRoute','1');setData(card,'canonicalDecorated',VERSION);
  makeInteractive(card);
  const status=best?.score!=null?`โบนัส ${Number(best.score)}% ✓`:ready?'พร้อมเล่นโบนัส':'ผ่าน Game 4 เพื่อเปิด';
  const bestText=best?.score!=null?` • ดีที่สุด ${Number(best.score)}%`:'';
  const wantedHTML=`<div class="stage-icon">📷</div><div><strong>Lexicon Lens Hunt</strong><small>Bonus Mission • กล้องหลังค้นหา QR Clue • ไม่บังคับ Certificate${bestText}</small></div><div class="stage-state">${status}</div>`;
  if(card.innerHTML!==wantedHTML)card.innerHTML=wantedHTML;
  return card;
}
function decorateNow(){
  scheduled=false;ensureBonusCard();
  Object.entries(ROUTES).forEach(([stage,route])=>{
    const card=document.querySelector(`.stage-card[data-stage="${stage}"]`);if(!card)return;
    if(stage==='bonus_lens'){makeInteractive(card);return;}
    setData(card,'canonicalRoute','1');setData(card,'canonicalDecorated',VERSION);
    if(!card.classList.contains('canonical-game-card'))card.classList.add('canonical-game-card');
    makeInteractive(card);
    const icon=card.querySelector('.stage-icon');setText(icon,route.icon);
    const title=card.querySelector('div:nth-child(2)>strong');setText(title,route.title);
    const detail=card.querySelector('div:nth-child(2)>small');
    if(detail){const best=(detail.textContent.match(/• ดีที่สุด[^•]*/)||[])[0]||'';setText(detail,route.detail+(best?' '+best:''));}
    const state=card.querySelector('.stage-state');
    if(state&&card.classList.contains('ready'))setText(state,'พร้อมเล่น');
  });
}
function scheduleDecorate(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorateNow);}
function openStage(stage){
  const identity=readIdentity();if(!identity?.playerId)return;
  if(stage==='bonus_lens'){
    const query=carryView(new URLSearchParams({from:'passport',authority:'firebase',pid:identity.playerId,nickname:identity.nickname||identity.fullName||'Player',stage:'bonus_lens',v:'20260811-event-day-light-r10'}));
    location.assign('./lexicon-lens-hunt.html?'+query.toString());return;
  }
  if(stage==='final_boss'){
    const query=carryView(new URLSearchParams({from:'passport',authority:'firebase',submit:'1',pid:identity.playerId,playerId:identity.playerId,nickname:identity.nickname||identity.fullName||'Player',run:'1',stage:'final_boss',v:'20260811-event-day-light-r10'}));
    location.assign('./lexicon-champion-arena-v47.html?'+query.toString());return;
  }
  const query=carryView(new URLSearchParams({stage,run:'1',v:'20260811-event-day-light-r10'}));
  location.assign('./passport-game-shell-firestore-v2.html?'+query.toString());
}
function intercept(event){
  const card=event.target?.closest?.('.stage-card.canonical-game-card');if(!card)return;
  if(!(card.classList.contains('ready')||card.classList.contains('passed')))return;
  const stage=card.dataset.stage;if(!ROUTES[stage])return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openStage(stage);
}
function keyboard(event){if(event.key!=='Enter'&&event.key!==' ')return;intercept(event)}
document.addEventListener('click',intercept,true);document.addEventListener('keydown',keyboard,true);
const screen=document.getElementById('screen')||document.body;
new MutationObserver(mutations=>{
  const relevant=mutations.some(m=>m.type==='childList'||(m.type==='attributes'&&m.attributeName==='class'));
  if(relevant)scheduleDecorate();
}).observe(screen,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
const style=document.createElement('style');style.textContent='.stage-card.canonical-game-card.ready,.stage-card.canonical-game-card.passed{pointer-events:auto!important;cursor:pointer}.stage-card.canonical-game-card.ready{border-color:#7c75e8;background:linear-gradient(135deg,#fbfaff,#eef5ff)}.stage-card.canonical-game-card.ready .stage-icon{background:linear-gradient(135deg,#ebe7ff,#ddf6ff)}.stage-card.bonus-lens-card{border-style:dashed}.stage-card.bonus-lens-card.ready{border-color:#3bc7a7;background:linear-gradient(135deg,#f2fffb,#eef8ff)}.stage-card.bonus-lens-card .stage-icon{background:linear-gradient(135deg,#d9fff2,#e4f4ff)}';document.head.appendChild(style);
decorateNow();
window.EW_CANONICAL_ROUTES=Object.freeze({version:VERSION,routes:ROUTES,openStage,currentView});
}());