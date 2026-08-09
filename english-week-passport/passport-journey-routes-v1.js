(function(){
'use strict';
const VERSION='2026-08-09-PASSPORT-JOURNEY-ROUTES-V4-DIRECT7-PERMISSION-FALLBACK';
const cfg=window.EW_CONFIG||{};
const journey=window.EW_JOURNEY;
const ROUTE_VERSION='20260809-journey-direct7-permission-fallback';
let identity=null;
let journeyStatus=null;
let statusError='';
let loading=false;
let decorateQueued=false;

function readIdentity(){try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
function stageCard(stage){return document.querySelector(`.stage-card[data-stage="${stage}"]`)}
function stateText(card,text){const state=card?.querySelector('.stage-state');if(state)state.textContent=text}
function setCardState(card,state,text){
  if(!card)return;
  card.classList.remove('passed','ready','clickable','locked');
  card.classList.add(state);
  if(state==='ready')card.classList.add('clickable');
  if(state==='ready'){card.setAttribute('tabindex','0');card.setAttribute('role','button')}else{card.removeAttribute('tabindex');card.removeAttribute('role')}
  stateText(card,text);
}
function makeJourneyCard(stage,icon,title,detail){
  const card=document.createElement('article');
  card.className='stage-card locked journey-stage-card';card.dataset.stage=stage;
  card.innerHTML=`<div class="stage-icon">${icon}</div><div><strong>${title}</strong><small>${detail}</small></div><div class="stage-state">ยังล็อก 🔒</div>`;
  return card;
}
function ensureCards(){
  const map=document.querySelector('.passport-map');const certificate=stageCard('certificate');if(!map||!certificate)return null;
  let reflection=stageCard('final_reflection');let summary=stageCard('journey_summary');
  if(!reflection){reflection=makeJourneyCard('final_reflection','💭','Final Reflection','สะท้อนการเรียนรู้สั้น ๆ • 3 คำถามหลัก');map.insertBefore(reflection,certificate)}
  if(!summary){summary=makeJourneyCard('journey_summary','🏁','LEXICON X Journey Summary','Pre → Post • Game 1–5 • Bonus • Reflection');map.insertBefore(summary,certificate)}
  return {reflection,summary,certificate};
}
function postCompleted(){const post=stageCard('post_challenge');return Boolean(post&&(post.classList.contains('passed')||post.querySelector('.stage-state')?.textContent?.includes('ผ่าน')))}
function decorate(){
  decorateQueued=false;
  const cards=ensureCards();if(!cards)return;
  const postDone=postCompleted();
  if(!postDone){setCardState(cards.reflection,'locked','รอ Post-Challenge 🔒');setCardState(cards.summary,'locked','รอ Final Reflection 🔒');setCardState(cards.certificate,'locked','รอ Journey Summary 🔒');return}
  if(statusError){setCardState(cards.reflection,'locked','Firebase Journey ยังไม่พร้อม');setCardState(cards.summary,'locked','Firebase Journey ยังไม่พร้อม');setCardState(cards.certificate,'locked','รอ Firebase Journey');return}
  if(!journeyStatus){setCardState(cards.reflection,'locked','กำลังตรวจ Firebase…');setCardState(cards.summary,'locked','กำลังตรวจ Firebase…');setCardState(cards.certificate,'locked','กำลังตรวจ Journey…');return}
  if(journeyStatus.reflectionDone)setCardState(cards.reflection,'passed','บันทึกแล้ว ✓');else setCardState(cards.reflection,'ready','เริ่มได้');
  if(journeyStatus.reflectionDone){if(journeyStatus.summaryViewed)setCardState(cards.summary,'passed','ดูสรุปแล้ว ✓');else setCardState(cards.summary,'ready','พร้อมดูสรุป')}else setCardState(cards.summary,'locked','รอ Final Reflection 🔒');
  if(journeyStatus.summaryViewed)setCardState(cards.certificate,'ready','พร้อมเปิด Certificate');else setCardState(cards.certificate,'locked','รอ Journey Summary 🔒');
}
function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(decorate)}
async function refreshStatus(){
  identity=readIdentity();if(!identity?.playerId||loading)return;
  if(!journey?.endpointReady?.()){statusError='FIREBASE_JOURNEY_NOT_READY';scheduleDecorate();return}
  loading=true;statusError='';scheduleDecorate();
  try{const result=await journey.status(identity.playerId);if(!result?.ok||result.mode!=='firebase')throw new Error('FIREBASE_JOURNEY_STATUS_REQUIRED');journeyStatus=result}
  catch(error){console.error('Journey status error',error);statusError=String(error?.message||error)}
  finally{loading=false;scheduleDecorate()}
}
function goReflection(){location.assign(`./final-reflection.html?v=${ROUTE_VERSION}`)}
function goSummary(){location.assign(`./journey-summary.html?v=${ROUTE_VERSION}`)}
function goCertificate(){location.assign(`./certificate-v1.html?v=${ROUTE_VERSION}`)}
function handle(event){
  const card=event.target?.closest?.('.stage-card');if(!card)return;
  const stage=card.dataset.stage;if(!['final_reflection','journey_summary','certificate'].includes(stage))return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(!postCompleted())return;
  if(stage==='final_reflection'){if(!journeyStatus?.reflectionDone)goReflection();else if(journeyStatus?.reflectionDone&&!journeyStatus?.summaryViewed)goSummary();else goCertificate();return}
  if(stage==='journey_summary'){if(!journeyStatus?.reflectionDone)goReflection();else goSummary();return}
  if(stage==='certificate'){if(!journeyStatus?.reflectionDone)goReflection();else if(!journeyStatus?.summaryViewed)goSummary();else goCertificate()}
}
document.addEventListener('click',handle,true);
document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')handle(event)},true);
const observer=new MutationObserver(()=>{scheduleDecorate();if(document.querySelector('.passport-map')&&!journeyStatus&&!loading&&!statusError)refreshStatus()});
observer.observe(document.getElementById('screen')||document.body,{childList:true,subtree:true});
scheduleDecorate();refreshStatus();
const style=document.createElement('style');style.textContent='.stage-card.journey-stage-card.ready{border-color:#766ce0;background:linear-gradient(135deg,#fcfbff,#f0f5ff)}.stage-card.journey-stage-card.ready .stage-icon{background:linear-gradient(135deg,#eeeaff,#e3f4ff)}.stage-card[data-stage="certificate"].ready{cursor:pointer}';document.head.appendChild(style);
window.EW_PASSPORT_JOURNEY=Object.freeze({version:VERSION,routeVersion:ROUTE_VERSION,refreshStatus:()=>{journeyStatus=null;statusError="";return refreshStatus()}});
}());