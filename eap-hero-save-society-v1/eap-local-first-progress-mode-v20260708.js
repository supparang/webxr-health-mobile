/* =========================================================
   EAP Hero Local-First Progress Mode v20260708
   - Student progress/unlock uses localStorage first while Sheet is not ready.
   - Sheet sync becomes a background/optional action, not a blocker.
   - Softens noisy Sheet UI so students focus on continuing the route.
   - Does not change scores, pass criteria, routeOrder, teacher review, or payloads.
========================================================= */
(function(){
'use strict';

const VERSION='v20260708-EAP-LOCAL-FIRST-PROGRESS-MODE-V1';
const STATE_KEY='EAP_HERO_PROGRESS_V3';
const SENT_KEY='EAP_HERO_SHEET_SENT_V123';
const STYLE_ID='eap-local-first-progress-style';
const BADGE_ID='eap-local-first-progress-badge';

function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function readJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(e){return fallback}}
function entries(){const state=readJson(STATE_KEY,{}),out=[];['portfolio','attempts','evidence','summary','records'].forEach(k=>{if(Array.isArray(state[k]))out.push.apply(out,state[k])});return out}
function countLocalEvidence(){return entries().filter(e=>e&&(e.session||e.sessionId)&&(e.skill||e.evidenceType)).length}
function countSentMarkers(){const sent=readJson(SENT_KEY,{});return Object.keys(sent||{}).length}
function profileName(){const s=readJson(STATE_KEY,{}),p=(s&&(s.profile||s.player))||{};return clean(p.studentName||p.name||s.studentName||'')}

function addCss(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    #${BADGE_ID}{
      position:fixed;
      right:14px;
      bottom:76px;
      z-index:99990;
      max-width:min(390px,calc(100vw - 28px));
      border:1px solid rgba(125,211,252,.25);
      border-radius:999px;
      padding:9px 12px;
      background:rgba(8,28,45,.88);
      color:#dff8ff;
      box-shadow:0 12px 30px rgba(0,0,0,.25);
      font:800 12px Arial,'Noto Sans Thai',sans-serif;
      backdrop-filter:blur(10px);
      display:flex;
      align-items:center;
      gap:8px;
      pointer-events:none;
    }
    #${BADGE_ID} b{color:#a7f3d0}
    #${BADGE_ID} small{color:#bcd7e7;font-weight:700}
    @media(max-width:720px),(hover:none) and (pointer:coarse){
      #${BADGE_ID}{
        left:8px;
        right:8px;
        bottom:62px;
        justify-content:center;
        border-radius:14px;
        padding:8px 10px;
        font-size:11px;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureBadge(){
  addCss();
  const local=countLocalEvidence();
  let badge=document.getElementById(BADGE_ID);
  if(!badge){
    badge=document.createElement('div');
    badge.id=BADGE_ID;
    badge.setAttribute('aria-live','polite');
    document.body.appendChild(badge);
  }
  if(local>0){
    badge.innerHTML='💾 <b>Local progress active</b><small>ใช้ความคืบหน้าในเครื่องนี้ก่อน · '+local+' evidence</small>';
  }else{
    badge.innerHTML='💾 <b>Local progress active</b><small>ทำภารกิจได้ก่อน · Sheet sync ภายหลัง</small>';
  }
}

function softenSheetButton(){
  const manual=document.getElementById('eap-sheet-manual-send');
  if(manual){
    manual.textContent='📤 Sync Sheet ภายหลัง';
    manual.title='ตอนนี้เกมใช้ความคืบหน้าในเครื่องนี้ก่อน เมื่อ Sheet พร้อมค่อยกดส่งซ้ำได้';
    manual.style.background='#0f766e';
    manual.style.right='14px';
    manual.style.bottom='18px';
  }
}

function softenNoisySheetBadges(){
  const candidates=[...document.querySelectorAll('button,div,span,a')].filter(el=>{
    const t=clean(el.textContent);
    return /Sheet/i.test(t)&&/(send attempts|ส่งผลล่าสุด|ยังเชื่อม|ไม่สำเร็จ|0 send)/i.test(t);
  });
  candidates.forEach(el=>{
    if(el.id==='eap-sheet-manual-send')return;
    if(el.dataset.eapLocalFirstSoftened==='1')return;
    const t=clean(el.textContent);
    if(/send attempts/i.test(t)||/ยังเชื่อม|ไม่สำเร็จ|0 send/i.test(t)){
      el.dataset.eapLocalFirstSoftened='1';
      el.textContent='💾 Local progress · Sheet sync pending';
      if(el.style){
        el.style.background='#0f766e';
        el.style.color='#fff';
      }
    }
  });
}

function exposeStatus(){
  window.EAPLocalFirstProgressMode={
    version:VERSION,
    active:true,
    stateKey:STATE_KEY,
    localEvidence:countLocalEvidence(),
    sheetSentMarkers:countSentMarkers(),
    player:profileName(),
    refresh:refresh
  };
}

function refresh(){
  ensureBadge();
  softenSheetButton();
  softenNoisySheetBadges();
  exposeStatus();
}

let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(refresh,120)}
function start(){
  addCss();
  window.addEventListener('load',schedule);
  window.addEventListener('storage',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  schedule();
  setInterval(refresh,1500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();