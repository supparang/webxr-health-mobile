(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;

const RELEASE='20260730-BALANCE-CLASSROOM-UI-STABLE-V40';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const s=BH.state;
const e=BH.el;
let lastSummary=null;
let postedEventId='';

const clean=value=>String(value==null?'':value).trim();
const num=(value,fallback=0)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback};
const esc=value=>clean(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const pct=value=>`${Math.round(num(value))}%`;
const byId=id=>document.getElementById(id);

function installStyle(){
  if(byId('bhClassroomUiStableV40Style'))return;
  const style=document.createElement('style');
  style.id='bhClassroomUiStableV40Style';
  style.textContent=`
    body.bh-classroom-stable{overflow:hidden!important}
    body.bh-classroom-stable .topbar{padding:8px 10px!important;min-height:64px!important}
    body.bh-classroom-stable .brand{min-width:0!important;max-width:100%!important;flex:1!important;padding:8px 12px!important;border-radius:20px!important}
    body.bh-classroom-stable .brandIcon{width:44px!important;height:44px!important;flex:0 0 44px!important;font-size:24px!important}
    body.bh-classroom-stable .brandTitle{font-size:clamp(20px,6vw,28px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    body.bh-classroom-stable .brandSub{font-size:12px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    body.bh-classroom-stable .topActions,body.bh-classroom-stable #statusPill{display:none!important}

    body.bh-classroom-stable #startOverlay{padding:12px!important;background:rgba(2,16,32,.72)!important;backdrop-filter:blur(7px)!important}
    body.bh-classroom-stable #startOverlay .modal{width:min(92vw,430px)!important;max-height:none!important;padding:20px!important;border-radius:24px!important;overflow:visible!important;text-align:center!important}
    body.bh-classroom-stable #startOverlay .modalHead{display:block!important;margin:0!important}
    body.bh-classroom-stable #startOverlay .modalIcon{margin:0 auto 8px!important}
    body.bh-classroom-stable #startOverlay h1{margin:0!important;font-size:28px!important;line-height:1.1!important}
    body.bh-classroom-stable #startOverlay .lead{margin:8px 0 0!important;font-size:15px!important;line-height:1.45!important}
    body.bh-classroom-stable #startOverlay .actions{display:block!important;margin-top:16px!important}
    body.bh-classroom-stable #startBtn{width:100%!important;min-height:56px!important;font-size:18px!important;border-radius:18px!important}
    body.bh-classroom-stable .bh-hidden-config{display:none!important}

    body.bh-classroom-stable #calibrationOverlay{padding:0!important;align-items:flex-end!important;background:transparent!important;backdrop-filter:none!important}
    body.bh-classroom-stable #calibrationOverlay .calibrationModal{left:8px!important;right:8px!important;bottom:calc(8px + env(safe-area-inset-bottom,0px))!important;width:auto!important;max-width:none!important;max-height:none!important;margin:0!important;padding:10px 12px!important;border-radius:20px!important;overflow:visible!important}
    body.bh-classroom-stable #calibrationOverlay .modalHead{display:block!important;text-align:center!important;margin:0!important}
    body.bh-classroom-stable #calibrationOverlay .modalIcon{display:none!important}
    body.bh-classroom-stable #calibrationOverlay h2{margin:0!important;font-size:19px!important;line-height:1.15!important}
    body.bh-classroom-stable #calibrationOverlay .lead{margin:4px 0 0!important;font-size:12px!important;line-height:1.3!important}
    body.bh-classroom-stable #calibrationOverlay .calibrationSteps{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-top:8px!important}
    body.bh-classroom-stable #calibrationOverlay .calStep{min-height:36px!important;padding:5px 4px!important;font-size:10.5px!important;line-height:1.15!important;border-radius:12px!important}
    body.bh-classroom-stable #calibrationOverlay .calMeter{height:8px!important;margin-top:7px!important}
    body.bh-classroom-stable #calibrationOverlay .cameraHints,
    body.bh-classroom-stable #calibrationOverlay #cancelCalibrationBtn,
    body.bh-classroom-stable #bhCameraDiagV15{display:none!important}
    body.bh-classroom-stable #calibrationOverlay .actions{display:block!important;margin-top:7px!important}
    body.bh-classroom-stable #retryCameraBtn{width:100%!important;min-height:42px!important;margin:0!important;border-radius:14px!important;font-size:14px!important}

    body.bh-classroom-stable .coachText small{display:none!important}
    body.bh-classroom-stable .hudCard small{font-size:11px!important}
    body.bh-classroom-stable .energyItem{font-size:11px!important}

    #resultOverlay.bh-result-stable{position:fixed!important;inset:0!important;z-index:15000!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;padding:8px!important;overflow:auto!important;background:rgba(2,16,32,.86)!important;backdrop-filter:blur(8px)!important}
    #resultOverlay.bh-result-stable .bh-result-card{width:min(94vw,540px)!important;margin:6px auto calc(12px + env(safe-area-inset-bottom,0px))!important;padding:14px!important;border-radius:24px!important;background:linear-gradient(180deg,#fff,#f0fdfa)!important;border:3px solid #6ee7b7!important;box-shadow:0 20px 60px rgba(2,6,23,.45)!important;color:#0f172a!important}
    .bh-result-head{text-align:center}.bh-result-head .icon{font-size:34px;line-height:1}.bh-result-head h2{margin:4px 0 0!important;font-size:24px!important}.bh-result-head p{margin:5px 0 0!important;font-size:14px!important;font-weight:900!important;color:#047857!important}
    .bh-result-score{display:flex;justify-content:center;align-items:flex-end;gap:5px;margin-top:7px}.bh-result-score strong{font-size:46px;line-height:.95}.bh-result-score span{font-size:16px;font-weight:900;padding-bottom:5px}
    .bh-result-level{text-align:center;margin-top:4px;font-size:13px;font-weight:900;color:#475569}
    .bh-result-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
    .bh-result-metric{min-width:0;min-height:74px;padding:8px 6px;border-radius:17px;border:2px solid #dbeafe;background:#fff;display:grid;place-items:center;text-align:center}
    .bh-result-metric span{display:block;font-size:11px;font-weight:900;color:#475569}.bh-result-metric b{display:block;margin-top:4px;font-size:26px;line-height:1;white-space:nowrap}.bh-result-metric.done{background:#fff7ed;border-color:#fed7aa}
    .bh-result-advice,.bh-result-sync{margin-top:9px;padding:9px 11px;border-radius:15px;font-size:12px;line-height:1.35;font-weight:900}
    .bh-result-advice{background:#f8fafc;color:#334155}.bh-result-sync{background:#eff6ff;border:2px solid #93c5fd;text-align:center;color:#1d4ed8}.bh-result-sync.ok{background:#ecfdf5;border-color:#86efac;color:#047857}.bh-result-sync.error{background:#fef2f2;border-color:#fca5a5;color:#b91c1c}
    #bhPassportBtn{width:100%;min-height:54px;margin-top:11px;border:0;border-radius:17px;background:linear-gradient(135deg,#14b8a6,#16a34a);color:#fff;font:inherit;font-size:18px;font-weight:1000}
    .bh-result-note{margin:7px 0 0;text-align:center;font-size:10.5px;font-weight:800;color:#64748b}
    #bhRecoveryV13,.bhRecoveryAction,#replayBtn,#cooldownBtn,#backBtn{display:none!important}
    @media(min-width:480px){.bh-result-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

function localize(){
  document.body.classList.add('bh-classroom-stable');
  const title=document.querySelector('.brandTitle');
  const subtitle=document.querySelector('.brandSub');
  if(title)title.textContent='Balance Hold';
  if(subtitle)subtitle.textContent='ภารกิจทรงตัว 6 ท่า';
  const heading=document.querySelector('#startOverlay h1');
  const lead=document.querySelector('#startOverlay .lead');
  if(heading)heading.textContent='ภารกิจทรงตัว';
  if(lead)lead.textContent='ทำท่าตามหน้าจอ 6 ท่า ยกขาเพียงต่ำ ๆ และค้างให้นิ่ง';
  const calibrationTitle=document.querySelector('#calibrationOverlay h2');
  if(calibrationTitle)calibrationTitle.textContent='ตรวจท่าทางก่อนเริ่ม';
}

function normalized(summary){
  const source=summary&&typeof summary==='object'?summary:{};
  const completed=num(source.completedPoses,num(source.completionCount,6));
  const total=Math.max(1,num(source.totalPoses,6));
  const eventId=clean(source.eventId||source.roundId||source.attemptId)||`HH-game-fitness-balance-hold-${clean(source.studentId)||'anon'}-${Date.now()}`;
  return{
    ...source,
    eventId,
    record_id:eventId,
    assessmentScore:Math.round(num(source.assessmentScore,num(source.assessment,0))),
    completedPoses:completed,
    totalPoses:total,
    completed:completed>=total,
    procedureCompleted:completed>=total,
    progressionEligible:completed>=total,
    game:'balance-hold',
    gameId:'balance-hold',
    zone:'fitness',
    inputMode:'classroom-pose',
    gameVersion:RELEASE,
    analyticsSchemaVersion:'HH-UNIFIED-GAME-ANALYTICS-V2',
    completionPolicy:'one-classroom-round-completes-skill-separate',
    retryRequired:false,
    finishedAt:source.finishedAt||new Date().toISOString()
  };
}

function level(score){
  if(score>=85)return 'ยอดเยี่ยม';
  if(score>=70)return 'ทำได้ดี';
  if(score>=55)return 'ผ่านภารกิจ';
  return 'จบภารกิจแล้ว';
}

function metric(label,value,extra=''){
  return `<div class="bh-result-metric ${extra}"><div><span>${esc(label)}</span><b>${esc(value)}</b></div></div>`;
}

function renderSummary(summary){
  const official=normalized(summary);
  lastSummary=official;
  try{localStorage.setItem('HHA_BALANCE_HOLD_LAST_RESULT',JSON.stringify(official))}catch(_){}
  const overlay=byId('resultOverlay');
  if(!overlay)return;
  const completed=official.completedPoses;
  const total=official.totalPoses;
  const embedded=window.parent!==window;
  const advice=clean(official.advice)||'มองตรง ยืนห่างกล้องพอดี และค้างท่าให้นิ่ง';

  overlay.className='overlay bh-result-stable';
  overlay.innerHTML=`
    <section class="bh-result-card" role="dialog">
      <header class="bh-result-head"><div class="icon">🏆</div><h2>สรุปผล Balance Hold</h2><p>${completed>=total?'ทำภารกิจครบแล้ว':'จบรอบแล้ว'}</p></header>
      <div class="bh-result-score"><strong>${esc(official.assessmentScore)}</strong><span>/100</span></div>
      <div class="bh-result-level">${esc(level(official.assessmentScore))} • สำเร็จ ${completed}/${total} ท่า</div>
      <div class="bh-result-grid">
        ${metric('ท่าทาง',pct(official.poseAccuracy))}
        ${metric('ความนิ่ง',pct(official.stabilityScore))}
        ${metric('ควบคุม',pct(official.transitionScore))}
        ${metric('ปลอดภัย',pct(official.safeZoneScore))}
        ${metric('การติดตาม',pct(official.trackingCoverage))}
        ${metric('สำเร็จ',`${completed}/${total}`,'done')}
      </div>
      <div class="bh-result-advice"><b>คำแนะนำ:</b> ${esc(advice)}</div>
      <div class="bh-result-sync" id="bhResultSync">${embedded?'กำลังส่งผลให้ Passport...':'ผลพร้อมแล้ว • กลับ Passport เพื่อดูความคืบหน้า'}</div>
      <button id="bhPassportBtn" type="button">← กลับ Passport</button>
      <p class="bh-result-note">สถานะทางการตรวจสอบจาก Passport และ Google Sheet</p>
    </section>`;

  byId('bhPassportBtn')?.addEventListener('click',()=>returnPassport(official),{once:true});
  if(embedded&&postedEventId!==official.eventId){
    postedEventId=official.eventId;
    try{window.parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:official},location.origin)}catch(_){}
  }
}

function returnPassport(summary){
  const button=byId('bhPassportBtn');
  if(button){button.disabled=true;button.textContent='กำลังกลับ Passport...'}
  if(window.parent!==window){
    try{
      for(const id of ['returnBtn','leaveBtn','back']){
        const target=window.parent.document.getElementById(id);
        if(target&&!target.disabled){target.click();return}
      }
    }catch(_){}
  }
  const raw=q.get('return')||q.get('back')||q.get('hub')||'../HeroHealth_Learning1/index.html';
  try{
    const url=new URL(raw,location.href);
    const studentId=clean(summary.studentId||q.get('studentId')||q.get('sid'));
    const name=clean(summary.studentName||q.get('studentName')||q.get('fullName')||q.get('name'));
    if(studentId){url.searchParams.set('studentId',studentId);url.searchParams.set('sid',studentId)}
    if(name){url.searchParams.set('studentName',name);url.searchParams.set('fullName',name)}
    if(summary.section||q.get('section'))url.searchParams.set('section',summary.section||q.get('section'));
    if(summary.classId||q.get('group'))url.searchParams.set('group',summary.classId||q.get('group'));
    url.searchParams.set('fromGame','balance-hold');
    url.searchParams.set('completedGame','balance-hold');
    url.searchParams.set('authorityRefresh',String(Date.now()));
    url.searchParams.set('pendingGameSync','fitness:balance-hold');
    location.replace(url.href);
  }catch(_){location.href=raw}
}

BH.renderSummary=renderSummary;
BH.plannerReturn=summary=>returnPassport(normalized(summary||lastSummary||{}));
BH.submitSummary=async summary=>{
  const status=byId('bhResultSync');
  if(s.demo){if(status){status.textContent='โหมดสาธิต • ไม่บันทึกข้อมูล';status.classList.add('error')}return}
  if(window.parent!==window){if(status)status.textContent='กำลังยืนยันผลกับ Passport...';return}
  try{
    if(BH.ENDPOINT&&typeof BH.postPayload==='function'){
      await BH.postPayload(BH.payload(summary));
      BH.markSent?.(summary.roundId);
    }
    if(status)status.textContent='ผลพร้อมแล้ว • กลับ Passport เพื่อดูความคืบหน้า';
  }catch(error){
    console.warn('[BalanceHold Stable UI] submit failed',error);
    try{BH.queuePayload?.(BH.payload(summary))}catch(_){}
    if(status){status.textContent='เครือข่ายขัดข้อง • กลับ Passport เพื่อลองอีกครั้ง';status.classList.add('error')}
  }
};

window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  const message=event.data||{};
  if(message.type!=='HEROHEALTH_GAME_RECEIPT')return;
  const status=byId('bhResultSync');
  if(!status)return;
  if(message.ok===true){status.textContent='บันทึกสำเร็จแล้ว';status.classList.add('ok')}
  else{status.textContent='ยังไม่ยืนยันผล • กลับ Passport เพื่อลองอีกครั้ง';status.classList.add('error')}
});

installStyle();
localize();
console.info('[BalanceHold] Stable Thai UI ready',RELEASE);
})();
