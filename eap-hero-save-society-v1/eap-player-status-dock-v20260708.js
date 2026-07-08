/* =========================================================
   EAP Hero Player Status Dock v20260708
   - Desktop: moves Player Status into the empty mission/home area.
   - Mobile: leaves normal compact/current-route flow alone.
   - Does not change progress, score, unlock, Sheet, or route logic.
========================================================= */
(function(){
'use strict';

const VERSION='v20260708-EAP-PLAYER-STATUS-DOCK-V1-DESKTOP';
const STYLE_ID='eap-player-status-dock-style';
const DOCKED_CLASS='eap-player-status-docked';
const HOST_CLASS='eap-player-status-dock-host';
const MOBILE_QUERY='(max-width: 720px), (hover: none) and (pointer: coarse)';

function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function isMobile(){return window.matchMedia && window.matchMedia(MOBILE_QUERY).matches}

function addCss(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    .${HOST_CLASS}{
      display:grid!important;
      gap:12px!important;
      align-self:start!important;
      min-width:0!important;
    }
    .${DOCKED_CLASS}{
      margin:0!important;
      max-width:100%!important;
      width:100%!important;
      padding:14px!important;
      border-radius:18px!important;
      color:#eaf6ff!important;
      background:linear-gradient(135deg,rgba(17,43,66,.94),rgba(11,28,48,.94))!important;
      border:1px solid rgba(125,211,252,.22)!important;
      box-shadow:0 12px 28px rgba(0,0,0,.16)!important;
      overflow:hidden!important;
    }
    .${DOCKED_CLASS} h1,
    .${DOCKED_CLASS} h2,
    .${DOCKED_CLASS} h3{
      margin:0 0 10px!important;
      font-size:18px!important;
      line-height:1.15!important;
      color:#eaf6ff!important;
    }
    .${DOCKED_CLASS} .grid,
    .${DOCKED_CLASS} [class*="grid"]{
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:8px!important;
    }
    .${DOCKED_CLASS} .stat,
    .${DOCKED_CLASS} [class*="stat"],
    .${DOCKED_CLASS} [class*="metric"],
    .${DOCKED_CLASS} [class*="card"]{
      min-width:0!important;
      border-radius:14px!important;
      padding:10px 11px!important;
      background:rgba(255,255,255,.07)!important;
      border:1px solid rgba(255,255,255,.12)!important;
      color:#eaf6ff!important;
    }
    .${DOCKED_CLASS} b,
    .${DOCKED_CLASS} strong{
      color:#fff!important;
    }
    .${DOCKED_CLASS} span,
    .${DOCKED_CLASS} small,
    .${DOCKED_CLASS} p{
      color:#cfe8f7!important;
    }
    .${DOCKED_CLASS} button{
      min-height:34px!important;
      padding:8px 10px!important;
      border-radius:12px!important;
      font-size:12px!important;
    }
    @media(max-width:720px),(hover:none) and (pointer:coarse){
      .${DOCKED_CLASS}{margin:10px 0!important;padding:12px!important}
      .${DOCKED_CLASS} .grid,
      .${DOCKED_CLASS} [class*="grid"]{grid-template-columns:1fr 1fr!important}
    }
  `;
  document.head.appendChild(style);
}

function findPlayerStatusPanel(){
  const titles=[...document.querySelectorAll('h1,h2,h3,strong,div')]
    .filter(el=>clean(el.textContent)==='Player Status');
  for(const title of titles){
    const panel=title.closest('section,aside,.panel,.card,main,div');
    if(!panel || panel.id==='app' || panel===document.body)continue;
    const text=clean(panel.textContent);
    if(/Player Status/i.test(text) && /(Progress|XP|Player|KAT|\d+\/15)/i.test(text))return panel;
  }
  return null;
}

function findMissionHost(){
  const mf=document.querySelector('.mf-hud');
  if(!mf)return null;
  let host=mf.parentElement;
  if(!host || host.id==='app')host=mf;
  host.classList.add(HOST_CLASS);
  return { host, after: mf };
}

function undock(panel){
  if(!panel || !panel.dataset.eapOriginalParent)return;
  const parent=document.querySelector('[data-eap-status-original-parent="'+panel.dataset.eapOriginalParent+'"]');
  if(parent){
    parent.appendChild(panel);
    panel.classList.remove(DOCKED_CLASS);
    delete panel.dataset.eapDocked;
  }
}

let originalIdSeed=0;
function ensureOriginalParent(panel){
  if(panel.dataset.eapOriginalParent)return;
  const parent=panel.parentElement;
  if(!parent)return;
  const id='eap-status-original-parent-'+(++originalIdSeed);
  parent.dataset.eapStatusOriginalParent=id;
  panel.dataset.eapOriginalParent=id;
}

function dock(){
  addCss();
  const panel=findPlayerStatusPanel();
  if(!panel)return;
  ensureOriginalParent(panel);
  if(isMobile()){
    panel.classList.remove(DOCKED_CLASS);
    return;
  }
  const target=findMissionHost();
  if(!target)return;
  if(panel.dataset.eapDocked==='1' && panel.previousElementSibling===target.after)return;
  panel.classList.add(DOCKED_CLASS);
  panel.dataset.eapDocked='1';
  target.after.insertAdjacentElement('afterend',panel);
}

let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(dock,120)}
function start(){
  addCss();
  window.addEventListener('load',schedule);
  window.addEventListener('resize',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  schedule();
  setInterval(dock,1200);
}

window.EAPPlayerStatusDock={version:VERSION,refresh:dock};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();