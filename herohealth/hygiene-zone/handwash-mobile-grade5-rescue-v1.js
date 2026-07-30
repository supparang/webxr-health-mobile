(()=>{
'use strict';
const VERSION='20260730-HANDWASH-MOBILE-GRADE5-RESCUE-V3.2-PASSPORT-GUARD';
const mobile=matchMedia('(max-width:760px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
if(!mobile)return;

document.documentElement.dataset.handwashMobileRescue='3.2';
const style=document.createElement('style');
style.id='handwashMobileGrade5Rescue';
style.textContent=`
@media(max-width:760px){
  .hud{inset:calc(6px + var(--sat)) 6px auto 6px!important;gap:4px!important}
  .row{gap:4px!important}.back{width:42px!important;height:42px!important}.title{padding:6px 9px!important}.title small{display:none!important}.title strong{font-size:15px!important}.detect{min-width:88px!important;min-height:42px!important;font-size:9px!important;padding:4px 6px!important}
  .stats{gap:3px!important}.stat{padding:4px 2px!important;border-radius:10px!important}.stat span{font-size:7px!important}.stat b{font-size:15px!important}
  .mission{padding:5px 8px!important;border-radius:12px!important}.mission .icon{width:30px!important;height:30px!important;font-size:18px!important}.mission h1{font-size:13px!important}.mission p{font-size:9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .who-strip{padding:4px!important;gap:3px!important;border-radius:11px!important;scroll-behavior:smooth!important;scroll-snap-type:x proximity!important}.phase-chip{font-size:8px!important;padding:5px 6px!important;min-width:76px!important;scroll-snap-align:center!important}
  #hhMobileProgress{display:block!important;padding:6px 8px!important;border-radius:12px!important;background:rgba(5,24,37,.92)!important;border:1px solid rgba(132,226,255,.30)!important;box-shadow:0 8px 20px rgba(0,0,0,.18)!important}
  #hhMobileProgressTop{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;color:#effbff!important;font-size:11px!important;font-weight:1000!important;line-height:1.1!important}
  #hhMobileProgressPct{color:#67eda9!important;font-size:15px!important;white-space:nowrap!important}
  #hhMobileStepRail{display:grid!important;grid-template-columns:repeat(11,1fr)!important;gap:3px!important;margin-top:5px!important}
  #hhMobileStepRail i{display:block!important;height:7px!important;border-radius:999px!important;background:rgba(255,255,255,.13)!important;border:1px solid rgba(255,255,255,.05)!important}
  #hhMobileStepRail i.done{background:#67eda9!important}
  #hhMobileStepRail i.active{background:#ffe27b!important;box-shadow:0 0 0 2px rgba(255,226,123,.18)!important}
  #scrubZone{top:60%!important;left:50%!important;width:97vw!important;height:50vh!important;min-width:0!important;min-height:340px!important;max-height:600px!important;transform:translate(-50%,-50%)!important;border-width:3px!important;border-radius:30px!important}
  html[data-handwash-phase="calibrate"] #scrubZone{top:59%!important;width:98vw!important;height:53vh!important}
  #waterZone{top:34%!important;width:180px!important;height:210px!important}
  html[data-handwash-phase="wet"] #waterZone,html[data-handwash-phase="rinse"] #waterZone{height:280px!important}
  #soapZone{left:7px!important;bottom:112px!important;width:94px!important;height:92px!important}
  #towelZone{right:7px!important;bottom:112px!important;width:94px!important;height:92px!important}
  .coach{left:8px!important;right:8px!important;top:272px!important;bottom:auto!important;width:auto!important;max-height:58px!important;min-height:0!important;padding:6px 9px!important;border-radius:12px!important;overflow:hidden!important;display:flex!important;align-items:center!important;gap:7px!important}
  .coach strong{flex:0 0 auto!important;font-size:8px!important}.coach p{flex:1 1 auto!important;font-size:10px!important;line-height:1.2!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.chips{display:none!important}
  .bottom{bottom:calc(4px + var(--sab))!important;left:6px!important;right:6px!important;gap:4px!important;grid-template-columns:1fr!important}
  .meters{display:none!important}.controls{grid-template-columns:repeat(4,1fr)!important;gap:4px!important}.control{min-height:54px!important;border-radius:12px!important;font-size:8px!important}.control span{font-size:18px!important}
  .toast{position:fixed!important;left:50%!important;bottom:calc(68px + var(--sab))!important;width:min(88vw,430px)!important;max-height:56px!important;overflow:hidden!important;padding:8px 11px!important;border-radius:12px!important;font-size:11px!important;line-height:1.25!important;z-index:120!important;transform:translate(-50%,8px)!important}.toast.show{transform:translate(-50%,0)!important}
  .overlay{padding:10px!important}.card{padding:14px!important;border-radius:20px!important}.hero{font-size:38px!important}.card h2{font-size:24px!important}.card>p{font-size:12px!important;margin:6px auto 10px!important}.rules{gap:5px!important;margin:8px 0!important}.rule{padding:7px!important;font-size:10px!important}.bigbtn{min-height:46px!important}
  #hhPassportReturn{display:none;width:100%;min-height:46px;margin-top:8px;border:1px solid rgba(132,226,255,.30);border-radius:15px;color:#effbff;background:rgba(255,255,255,.08);font-weight:1000}
  html[data-hh-identity="missing"] #hhPassportReturn{display:block}
  html[data-hh-identity="missing"] #passportIdentity{border-color:#ff7089!important;background:rgba(255,112,137,.10)!important}
  html[data-hh-identity="missing"] #startBtn{opacity:.55!important;filter:grayscale(.25)!important}
}
`;
document.head.appendChild(style);

function text(v){return String(v==null?'':v).trim()}
function parse(raw){try{return JSON.parse(raw)}catch(_){return null}}
function allStorageObjects(){
  const out=[];
  [localStorage,sessionStorage].forEach(store=>{
    for(let i=0;i<store.length;i++){
      const key=store.key(i);
      const value=parse(store.getItem(key));
      if(value&&typeof value==='object')out.push({key,value});
    }
  });
  return out;
}
function profileFromObject(root){
  const seen=new Set();
  function walk(node,depth){
    if(!node||typeof node!=='object'||depth>6||seen.has(node))return null;
    seen.add(node);
    const directId=text(node.studentId||node.studentID||node.student_id||node.sid||node.pid||node.participantId||node.participant_id);
    const directName=text(node.fullName||node.full_name||node.studentName||node.student_name||node.name||node.nickname||node.nick);
    if(directId){
      return {
        studentId:directId,
        fullName:directName,
        section:text(node.section||node.classLevel||node.class_level||node.room||node.className),
        group:text(node.group||node.rotationGroup||node.conditionGroup)
      };
    }
    const preferred=['profile','student','user','identity','authoritativeState','live','player','participant'];
    for(const key of preferred){const found=walk(node[key],depth+1);if(found)return found}
    for(const key of Object.keys(node)){
      if(preferred.includes(key))continue;
      const found=walk(node[key],depth+1);if(found)return found;
    }
    return null;
  }
  return walk(root,0);
}
function resolveIdentity(){
  const qs=new URLSearchParams(location.search);
  const fromUrl={
    studentId:text(qs.get('studentId')||qs.get('studentID')||qs.get('sid')||qs.get('pid')),
    fullName:text(qs.get('fullName')||qs.get('studentName')||qs.get('name')||qs.get('nick')),
    section:text(qs.get('section')||qs.get('classLevel')||qs.get('room')),
    group:text(qs.get('group')||qs.get('rotationGroup')||qs.get('conditionGroup'))
  };
  if(fromUrl.studentId)return fromUrl;
  const preferredKeys=[
    'herohealth_learning_platform_state','herohealth_student_resume_v12','herohealth_student_resume_v11',
    'herohealth_student_resume_v10','herohealth_student_resume_v9','herohealth:hygiene:profile',
    'herohealth_profile','herohealth_student_profile','hh_profile','profile'
  ];
  for(const key of preferredKeys){
    const found=profileFromObject(parse(localStorage.getItem(key))||parse(sessionStorage.getItem(key)));
    if(found)return found;
  }
  for(const item of allStorageObjects()){
    const found=profileFromObject(item.value);
    if(found)return found;
  }
  return null;
}
let identity=null;
function passportUrl(){
  const qs=new URLSearchParams(location.search);
  return text(qs.get('passport')||qs.get('return')||qs.get('returnUrl'))||'../../HeroHealth_Learning1/index.html';
}
function ensureReturnButton(){
  if(document.getElementById('hhPassportReturn'))return;
  const start=document.getElementById('startBtn');
  if(!start)return;
  const btn=document.createElement('button');
  btn.id='hhPassportReturn';btn.type='button';btn.textContent='← กลับ Hero Passport';
  btn.addEventListener('click',()=>location.href=passportUrl());
  start.insertAdjacentElement('afterend',btn);
}
function applyIdentity(){
  ensureReturnButton();
  identity=resolveIdentity();
  const nameEl=document.getElementById('passportName');
  const metaEl=document.getElementById('passportMeta');
  const nameInput=document.getElementById('nameInput');
  const classInput=document.getElementById('classInput');
  const start=document.getElementById('startBtn');
  if(identity&&identity.studentId){
    document.documentElement.dataset.hhIdentity='ready';
    const displayName=identity.fullName||('นักเรียนรหัส '+identity.studentId);
    if(nameEl)nameEl.textContent=displayName;
    if(metaEl)metaEl.textContent=['รหัส '+identity.studentId,identity.section,identity.group&&('กลุ่ม '+identity.group)].filter(Boolean).join(' • ');
    if(nameInput)nameInput.value=displayName;
    if(classInput)classInput.value=identity.section||'P5';
    window.HH_HANDWASH_IDENTITY={...identity,source:'hero-passport'};
    return true;
  }
  document.documentElement.dataset.hhIdentity='missing';
  if(nameEl)nameEl.textContent='ไม่พบข้อมูลนักเรียน';
  if(metaEl)metaEl.textContent='กรุณากลับ Hero Passport แล้วเข้าเกมจากภารกิจของนักเรียน';
  if(nameInput)nameInput.value='';
  if(classInput)classInput.value='';
  if(start){start.disabled=true;start.textContent='ต้องเข้าจาก Hero Passport';}
  return false;
}
function enforceIdentity(){
  const ready=applyIdentity();
  const start=document.getElementById('startBtn');
  if(!ready&&start){start.disabled=true;start.textContent='ต้องเข้าจาก Hero Passport'}
}
document.addEventListener('click',event=>{
  const start=event.target.closest?.('#startBtn');
  if(start&&!resolveIdentity()){
    event.preventDefault();event.stopImmediatePropagation();
    enforceIdentity();
    const toast=document.getElementById('toast');
    if(toast){toast.textContent='ไม่พบรหัสนักเรียน กรุณากลับ Hero Passport';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}
  }
},true);
addEventListener('storage',enforceIdentity);

const PHASE_ORDER=['wet','soap','palm','dorsum','interlaced','backsFingers','thumbs','fingertips','rinse','dry','towelFaucet'];
const PHASE_LABELS=['เปียกมือ','ใช้สบู่','ฝ่ามือ','หลังมือ/ซอกนิ้ว','ประสานนิ้ว','หลังนิ้ว','หัวแม่มือ','ปลายนิ้ว','ล้างน้ำ','เช็ดให้แห้ง','ปิดก๊อก'];
function installProgress(){
  if(document.getElementById('hhMobileProgress'))return;
  const strip=document.getElementById('whoStrip');
  if(!strip)return;
  const box=document.createElement('section');
  box.id='hhMobileProgress';
  box.innerHTML='<div id="hhMobileProgressTop"><span id="hhMobileProgressLabel">เตรียมเริ่มภารกิจ 11 ขั้น</span><b id="hhMobileProgressPct">0%</b></div><div id="hhMobileStepRail">'+PHASE_ORDER.map((_,i)=>'<i data-step="'+i+'"></i>').join('')+'</div>';
  strip.insertAdjacentElement('afterend',box);
}
function numberFrom(value){const m=String(value||'').match(/([0-9]+(?:\.[0-9]+)?)/);return m?Number(m[1]):0}
function handCount(){return numberFrom(document.getElementById('chipHands')?.textContent||'')}
function evidence(){return Math.max(0,Math.min(100,numberFrom(document.getElementById('evidenceText')?.textContent||'0')))}
function phase(){return document.documentElement.dataset.handwashPhase||''}
function running(){return !document.getElementById('startOverlay')?.classList.contains('show')&&!document.getElementById('summaryOverlay')?.classList.contains('show')}
let lastProgressSignature='';
function updateProgress(){
  installProgress();
  const currentPhase=phase(),idx=PHASE_ORDER.indexOf(currentPhase),ev=evidence();
  const completed=idx<0?0:idx;
  const percent=idx<0?0:Math.min(100,Math.round(((completed+(ev/100))/PHASE_ORDER.length)*100));
  const labelText=idx<0?'เตรียมเริ่มภารกิจ 11 ขั้น':'ขั้น '+(idx+1)+'/11 • '+PHASE_LABELS[idx];
  const signature=currentPhase+'|'+percent+'|'+labelText;
  if(signature===lastProgressSignature)return;
  lastProgressSignature=signature;
  const label=document.getElementById('hhMobileProgressLabel');
  const pct=document.getElementById('hhMobileProgressPct');
  if(label&&label.textContent!==labelText)label.textContent=labelText;
  const pctText=percent+'%';
  if(pct&&pct.textContent!==pctText)pct.textContent=pctText;
  document.querySelectorAll('#hhMobileStepRail i').forEach((node,i)=>{
    const done=i<idx,active=i===idx;
    if(node.classList.contains('done')!==done)node.classList.toggle('done',done);
    if(node.classList.contains('active')!==active)node.classList.toggle('active',active);
  });
  const active=document.querySelector('#whoStrip .phase-chip.active');
  if(active&&active.dataset.hhCentered!==currentPhase){
    document.querySelectorAll('#whoStrip .phase-chip[data-hh-centered]').forEach(node=>delete node.dataset.hhCentered);
    active.dataset.hhCentered=currentPhase;
    try{active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'})}catch(_){active.parentElement.scrollLeft=Math.max(0,active.offsetLeft-active.parentElement.clientWidth/2+active.clientWidth/2)}
  }
}

let lastEvidence=0,lastChange=Date.now(),oneHandSince=0,lastAssist=0,assistCount=0;
const MAX_ASSISTS=18;
function motionPresent(){return document.getElementById('chipMotion')?.classList.contains('good')||document.getElementById('chipContact')?.classList.contains('good')}
function showHint(message){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');clearTimeout(showHint.timer);showHint.timer=setTimeout(()=>toast.classList.remove('show'),1800)}
function tick(){
  updateProgress();
  if(document.documentElement.dataset.hhIdentity==='missing')enforceIdentity();
  if(!running())return;
  const now=Date.now(),ev=evidence(),hands=handCount(),currentPhase=phase();
  if(ev>lastEvidence+.2){lastEvidence=ev;lastChange=now;oneHandSince=0;return}
  if(hands>=2){oneHandSince=0;return}
  if(hands===1){if(!oneHandSince)oneHandSince=now}else{oneHandSince=0;return}
  const stalled=now-lastChange>5000;
  const heldOneHand=oneHandSince&&now-oneHandSince>1800;
  const scrubPhase=!['','calibrate','wet','soap','rinse','dry','towelFaucet'].includes(currentPhase);
  if(stalled&&heldOneHand&&scrubPhase&&assistCount<MAX_ASSISTS&&now-lastAssist>4200){
    const tap=document.getElementById('tapBtn');
    if(tap&&!tap.disabled){
      tap.click();lastAssist=now;assistCount++;lastChange=now;
      showHint(motionPresent()?'ตรวจพบการถูต่อเนื่อง ✅ ชดเชยมือที่หลุดชั่วคราว':'เห็น 1 มือ • แยกมือเล็กน้อยให้กล้องเห็นอีกมือ');
    }
  }
}
setInterval(tick,500);
addEventListener('DOMContentLoaded',()=>{enforceIdentity();installProgress();updateProgress()},{once:true});
setTimeout(enforceIdentity,100);
setTimeout(enforceIdentity,1200);
window.HHHandwashMobileGrade5Rescue={version:VERSION,updateProgress,resolveIdentity,enforceIdentity,get identity(){return identity},get assistCount(){return assistCount}};
})();