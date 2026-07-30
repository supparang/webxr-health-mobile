(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;

const RELEASE='20260730-BALANCE-CLASSROOM-UI-FINAL-V38';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const s=BH.state;
const e=BH.el;
let lastSummary=null;
let postedEventId='';

function clean(value){return String(value==null?'':value).trim()}
function number(value,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback}
function escapeHtml(value){return clean(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function percent(value){return `${Math.round(number(value))}%`}
function query(selector,root=document){return root.querySelector(selector)}

function installStyle(){
  if(document.getElementById('bhClassroomUiFinalV38Style'))return;
  const style=document.createElement('style');
  style.id='bhClassroomUiFinalV38Style';
  style.textContent=`
    body.bh-classroom-final .topbar{padding:8px 10px!important;gap:8px!important;min-height:64px!important}
    body.bh-classroom-final .brand{min-width:0!important;max-width:100%!important;flex:1!important;padding:8px 12px!important;border-radius:20px!important}
    body.bh-classroom-final .brandIcon{width:44px!important;height:44px!important;font-size:24px!important;flex:0 0 44px!important}
    body.bh-classroom-final .brandTitle{font-size:clamp(20px,6vw,28px)!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    body.bh-classroom-final .brandSub{font-size:12px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    body.bh-classroom-final .topActions,body.bh-classroom-final #statusPill{display:none!important}

    body.bh-classroom-final #startOverlay .concept,
    body.bh-classroom-final #startOverlay .eightPoseLegend,
    body.bh-classroom-final #startOverlay .formGrid,
    body.bh-classroom-final #startOverlay .toggles,
    body.bh-classroom-final #startOverlay #cameraTestBtn,
    body.bh-classroom-final #startOverlay #demoBtn,
    body.bh-classroom-final #startOverlay .safetyNote{display:none!important}
    body.bh-classroom-final #startOverlay .modal{width:min(92vw,460px)!important;padding:18px!important;border-radius:24px!important}
    body.bh-classroom-final #startOverlay .modalHead{display:block!important;text-align:center!important}
    body.bh-classroom-final #startOverlay .modalIcon{margin:0 auto 8px!important}
    body.bh-classroom-final #startOverlay h1{font-size:28px!important;margin:0!important}
    body.bh-classroom-final #startOverlay .lead{font-size:15px!important;line-height:1.45!important;margin-top:8px!important}
    body.bh-classroom-final #startOverlay .actions{display:block!important;margin-top:16px!important}
    body.bh-classroom-final #startOverlay #startBtn{width:100%!important;min-height:54px!important;font-size:18px!important}

    body.bh-classroom-final #calibrationOverlay{padding:0!important;align-items:flex-end!important;background:transparent!important;backdrop-filter:none!important}
    body.bh-classroom-final #calibrationOverlay .calibrationModal{left:8px!important;right:8px!important;bottom:calc(8px + env(safe-area-inset-bottom,0px))!important;width:auto!important;max-width:none!important;margin:0!important;padding:10px 12px!important;border-radius:20px!important;max-height:none!important;overflow:visible!important}
    body.bh-classroom-final #calibrationOverlay .modalHead{display:block!important;text-align:center!important;margin:0!important}
    body.bh-classroom-final #calibrationOverlay .modalIcon{display:none!important}
    body.bh-classroom-final #calibrationOverlay h2{font-size:19px!important;line-height:1.15!important;margin:0!important}
    body.bh-classroom-final #calibrationOverlay .lead{font-size:12px!important;line-height:1.3!important;margin:4px 0 0!important}
    body.bh-classroom-final #calibrationOverlay .calibrationSteps{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-top:8px!important}
    body.bh-classroom-final #calibrationOverlay .calStep{min-height:36px!important;padding:5px 4px!important;border-radius:12px!important;font-size:10.5px!important;line-height:1.15!important}
    body.bh-classroom-final #calibrationOverlay .calMeter{height:8px!important;margin-top:7px!important}
    body.bh-classroom-final #calibrationOverlay .cameraHints,
    body.bh-classroom-final #calibrationOverlay #cancelCalibrationBtn,
    body.bh-classroom-final #bhCameraDiagV15{display:none!important}
    body.bh-classroom-final #calibrationOverlay .actions{display:block!important;margin-top:7px!important}
    body.bh-classroom-final #calibrationOverlay #retryCameraBtn{width:100%!important;min-height:42px!important;margin:0!important;border-radius:14px!important;font-size:14px!important}

    body.bh-classroom-final .hudCard small{font-size:11px!important}
    body.bh-classroom-final .energyTitle span:first-child{font-size:14px!important}
    body.bh-classroom-final .energyItem{font-size:11px!important}
    body.bh-classroom-final .coachText small{display:none!important}

    #resultOverlay.bh-final-result{position:fixed!important;inset:0!important;z-index:15000!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;padding:8px!important;overflow:auto!important;background:rgba(2,16,32,.86)!important;backdrop-filter:blur(8px)!important}
    #resultOverlay.bh-final-result .bh-final-card{width:min(94vw,540px)!important;margin:6px auto calc(12px + env(safe-area-inset-bottom,0px))!important;padding:14px!important;border-radius:24px!important;background:linear-gradient(180deg,#ffffff,#f0fdfa)!important;border:3px solid #6ee7b7!important;box-shadow:0 20px 60px rgba(2,6,23,.45)!important;color:#0f172a!important}
    .bh-final-head{text-align:center}
    .bh-final-trophy{font-size:36px;line-height:1}
    .bh-final-head h2{margin:4px 0 0!important;font-size:25px!important;line-height:1.1!important}
    .bh-final-head p{margin:5px 0 0!important;font-size:14px!important;font-weight:900!important;color:#047857!important}
    .bh-final-score{display:flex;justify-content:center;align-items:flex-end;gap:5px;margin-top:7px}
    .bh-final-score strong{font-size:48px;line-height:.95}
    .bh-final-score span{font-size:16px;font-weight:900;padding-bottom:5px}
    .bh-final-level{text-align:center;margin-top:4px;font-size:13px;font-weight:900;color:#475569}
    .bh-final-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
    .bh-final-metric{min-width:0;min-height:76px;padding:9px 6px;border-radius:17px;border:2px solid #dbeafe;background:#fff;display:grid;place-items:center;text-align:center}
    .bh-final-metric span{display:block;font-size:11px;font-weight:900;color:#475569;line-height:1.15}
    .bh-final-metric b{display:block;margin-top:4px;font-size:27px;line-height:1;white-space:nowrap}
    .bh-final-metric.done{background:#fff7ed;border-color:#fed7aa}
    .bh-final-advice{margin-top:10px;padding:9px 11px;border-radius:15px;background:#f8fafc;font-size:12.5px;line-height:1.38;font-weight:800;color:#334155}
    .bh-final-sync{margin-top:9px;padding:9px 11px;border-radius:15px;background:#eff6ff;border:2px solid #93c5fd;text-align:center;font-size:12.5px;line-height:1.35;font-weight:900;color:#1d4ed8}
    .bh-final-sync.ok{background:#ecfdf5;border-color:#86efac;color:#047857}
    .bh-final-sync.error{background:#fef2f2;border-color:#fca5a5;color:#b91c1c}
    #bhFinalPassportBtn{width:100%;min-height:54px;margin-top:11px;border:0;border-radius:17px;padding:11px 16px;background:linear-gradient(135deg,#14b8a6,#16a34a);color:#fff;font:inherit;font-size:18px;font-weight:1000;box-shadow:0 10px 22px rgba(5,150,105,.24)}
    #bhFinalPassportBtn:disabled{opacity:.65}
    .bh-final-note{margin:7px 0 0;text-align:center;font-size:10.5px;font-weight:800;color:#64748b}
    #bhRecoveryV13,.bhRecoveryAction,#replayBtn,#cooldownBtn,#backBtn{display:none!important}

    @media(min-width:480px){.bh-final-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-height:700px){
      #resultOverlay.bh-final-result .bh-final-card{padding:11px!important;margin-top:3px!important}
      .bh-final-trophy{font-size:29px}.bh-final-head h2{font-size:21px!important}.bh-final-score strong{font-size:39px}
      .bh-final-metric{min-height:65px;padding:7px 5px}.bh-final-metric b{font-size:23px}
      .bh-final-advice{font-size:11.5px}.bh-final-sync{font-size:11.5px}
    }
  `;
  document.head.appendChild(style);
}

function localizeStatic(){
  document.body.classList.add('bh-classroom-final');
  const title=query('.brandTitle');
  const subtitle=query('.brandSub');
  if(title)title.textContent='Balance Hold';
  if(subtitle)subtitle.textContent='ภารกิจทรงตัว 6 ท่า';

  const hudLabels=[['#hudTime','เวลา'],['#hudScore','คะแนน'],['#hudPose','ท่า'],['#hudConfidence','ความชัด'],['#hudStability','ความนิ่ง'],['#hudTracking','การติดตาม']];
  hudLabels.forEach(([id,label])=>{
    const value=query(id);
    const small=value?.closest('.hudCard')?.querySelector('small');
    if(small)small.textContent=label;
  });

  const energyLabels=['ท่าทาง','ความนิ่ง','ควบคุม'];
  document.querySelectorAll('.energyItem').forEach((node,index)=>{
    if(energyLabels[index]){
      const meter=node.querySelector('.meter');
      node.childNodes[0].textContent=energyLabels[index];
      if(meter&&!node.contains(meter))node.appendChild(meter);
    }
  });
  const energyTitle=query('.energyTitle span:first-child');
  if(energyTitle)energyTitle.textContent='⚡ พลังการทรงตัว';

  const startHeading=query('#startOverlay h1');
  const startLead=query('#startOverlay .lead');
  const startButton=query('#startBtn');
  if(startHeading)startHeading.textContent='ภารกิจทรงตัว';
  if(startLead)startLead.textContent='ทำท่าตามหน้าจอ 6 ท่า ยกขาเพียงต่ำ ๆ และค้างให้นิ่ง';
  if(startButton)startButton.textContent='📷 เริ่มภารกิจ';

  compactCalibration();
}

function compactCalibration(){
  const overlay=query('#calibrationOverlay');
  if(!overlay)return;
  const heading=query('h2',overlay);
  const lead=query('#calibrationText',overlay);
  const body=query('#calBody',overlay);
  const arms=query('#calArms',overlay);
  const stable=query('#calStable',overlay);
  const retry=query('#retryCameraBtn',overlay);
  if(heading)heading.textContent='ตรวจท่าทางก่อนเริ่ม';
  if(lead&&!/ดีมาก|ค้าง|กางแขน|ศีรษะ/.test(lead.textContent||''))lead.textContent='ให้เห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสอง';
  if(body&&!/✅|⚠️/.test(body.textContent||''))body.textContent='1. ศีรษะ–เข่า';
  if(arms&&!/✅|⚠️/.test(arms.textContent||''))arms.textContent='2. กางแขน';
  if(stable&&!/✅|⚠️/.test(stable.textContent||''))stable.textContent='3. ยืนนิ่ง';
  if(retry)retry.textContent='↻ ลองเปิดกล้องใหม่';
}

function readStoredSummary(){
  const keys=[BH.KEY_LAST,'fitness_balance_hold_last','HHA_BALANCE_HOLD_LAST_RESULT'];
  for(const key of keys){
    if(!key)continue;
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||'null');
      if(parsed&&typeof parsed==='object')return parsed;
    }catch(_){}
  }
  return window.__HH_BALANCE_RESULT_V36__||window.__BALANCE_HOLD_LAST_RESULT__||{};
}

function normalized(summary){
  const source=summary&&typeof summary==='object'?summary:{};
  const completed=number(source.completedPoses,number(source.completionCount,6));
  const total=Math.max(1,number(source.totalPoses,6));
  const assessment=Math.round(number(source.assessmentScore,number(source.assessment,0)));
  const eventId=clean(source.eventId||source.roundId||source.attemptId)||`HH-game-fitness-balance-hold-${clean(source.studentId)||'anon'}-${Date.now()}`;
  return{
    ...source,
    eventId,
    record_id:eventId,
    assessmentScore:assessment,
    completedPoses:completed,
    totalPoses:total,
    completed:completed>=total,
    procedureCompleted:completed>=total,
    progressionEligible:completed>=total,
    passed:source.passed===true,
    skillCriteriaMet:source.passed===true,
    game:'balance-hold',
    gameId:'balance-hold',
    zone:'fitness',
    inputMode:'classroom-pose',
    gameVersion:RELEASE,
    analyticsSchemaVersion:'HH-UNIFIED-GAME-ANALYTICS-V2',
    completionPolicy:'one-classroom-round-completes-skill-separate',
    retryRequired:false,
    singleAttemptPolicy:true,
    finishedAt:source.finishedAt||new Date().toISOString()
  };
}

function levelText(score){
  if(score>=85)return 'ยอดเยี่ยม';
  if(score>=70)return 'ทำได้ดี';
  if(score>=55)return 'ผ่านภารกิจ';
  return 'จบภารกิจแล้ว';
}

function metric(label,value,extra=''){
  return `<div class="bh-final-metric ${extra}"><div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div></div>`;
}

function renderFinal(summary,force=false){
  const overlay=query('#resultOverlay');
  if(!overlay)return;
  if(overlay.dataset.bhFinalV38==='1'&&!force)return;

  const official=normalized(summary||readStoredSummary());
  lastSummary=official;
  try{localStorage.setItem('HHA_BALANCE_HOLD_LAST_RESULT',JSON.stringify(official))}catch(_){}
  window.__HH_BALANCE_RESULT_V38__=official;

  const score=official.assessmentScore;
  const completed=official.completedPoses;
  const total=official.totalPoses;
  const advice=clean(official.advice)||'ยืนห่างกล้องพอดี มองตรง และค้างท่าให้นิ่ง';
  const embedded=window.parent!==window;

  overlay.dataset.bhFinalV38='1';
  overlay.className='overlay bh-final-result';
  overlay.innerHTML=`
    <section class="bh-final-card" role="dialog" aria-labelledby="bhFinalTitle">
      <header class="bh-final-head">
        <div class="bh-final-trophy">🏆</div>
        <h2 id="bhFinalTitle">สรุปผล Balance Hold</h2>
        <p>${completed>=total?'ทำภารกิจครบแล้ว':'จบรอบแล้ว'}</p>
      </header>
      <div class="bh-final-score"><strong>${escapeHtml(score)}</strong><span>/100</span></div>
      <div class="bh-final-level">${escapeHtml(levelText(score))} • สำเร็จ ${completed}/${total} ท่า</div>
      <div class="bh-final-grid">
        ${metric('ท่าทาง',percent(official.poseAccuracy))}
        ${metric('ความนิ่ง',percent(official.stabilityScore))}
        ${metric('ควบคุม',percent(official.transitionScore))}
        ${metric('ปลอดภัย',percent(official.safeZoneScore))}
        ${metric('การติดตาม',percent(official.trackingCoverage))}
        ${metric('สำเร็จ',`${completed}/${total}`,'done')}
      </div>
      <div class="bh-final-advice"><b>คำแนะนำ:</b> ${escapeHtml(advice)}</div>
      <div class="bh-final-sync" id="bhFinalSync">${embedded?'กำลังส่งผลให้ Passport...':'บันทึกผลเกมแล้ว • กลับ Passport เพื่อดูความคืบหน้า'}</div>
      <button id="bhFinalPassportBtn" type="button">← กลับ Passport</button>
      <p class="bh-final-note">สถานะทางการตรวจสอบจาก Passport และ Google Sheet</p>
    </section>`;

  const button=query('#bhFinalPassportBtn');
  if(button)button.onclick=()=>returnToPassport(official);

  if(embedded&&postedEventId!==official.eventId){
    postedEventId=official.eventId;
    try{window.parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:official},location.origin)}catch(_){}
  }
}

function returnToPassport(summary){
  const button=query('#bhFinalPassportBtn');
  if(button){button.disabled=true;button.textContent='กำลังกลับ Passport...'}

  if(window.parent!==window){
    try{
      const parentDocument=window.parent.document;
      const candidates=['returnBtn','leaveBtn','back'];
      for(const id of candidates){
        const target=parentDocument.getElementById(id);
        if(target&&!target.disabled){target.click();return}
      }
    }catch(_){}
  }

  const raw=q.get('return')||q.get('back')||q.get('hub')||'../HeroHealth_Learning1/index.html';
  try{
    const url=new URL(raw,location.href);
    const studentId=clean(summary.studentId||q.get('studentId')||q.get('sid'));
    const name=clean(summary.studentName||q.get('studentName')||q.get('fullName')||q.get('name'));
    const section=clean(summary.section||q.get('section'));
    const group=clean(summary.classId||q.get('group'));
    if(studentId){url.searchParams.set('studentId',studentId);url.searchParams.set('sid',studentId)}
    if(name){url.searchParams.set('studentName',name);url.searchParams.set('fullName',name)}
    if(section)url.searchParams.set('section',section);
    if(group)url.searchParams.set('group',group);
    url.searchParams.set('fromGame','balance-hold');
    url.searchParams.set('completedGame','balance-hold');
    url.searchParams.set('authorityRefresh',String(Date.now()));
    url.searchParams.set('pendingGameSync','fitness:balance-hold');
    location.replace(url.href);
  }catch(_){
    location.href=raw;
  }
}

BH.renderSummary=summary=>renderFinal(summary,true);
BH.plannerReturn=summary=>returnToPassport(normalized(summary||lastSummary||readStoredSummary()));
BH.submitSummary=async summary=>{
  const status=query('#bhFinalSync');
  if(s.demo){if(status){status.textContent='โหมดสาธิต • ไม่บันทึกข้อมูล';status.classList.add('error')}return}
  if(window.parent!==window){if(status)status.textContent='กำลังยืนยันผลกับ Passport...';return}
  try{
    if(BH.ENDPOINT&&typeof BH.postPayload==='function'){
      await BH.postPayload(BH.payload(summary));
      BH.markSent?.(summary.roundId);
      if(status)status.textContent='บันทึกผลเกมแล้ว • กลับ Passport เพื่อดูความคืบหน้า';
    }else if(status){
      status.textContent='ผลพร้อมแล้ว • กลับ Passport เพื่อบันทึกความคืบหน้า';
    }
  }catch(error){
    console.warn('[BalanceHold V38] submit failed',error);
    try{BH.queuePayload?.(BH.payload(summary))}catch(_){}
    if(status){status.textContent='เครือข่ายขัดข้อง • กลับ Passport เพื่อลองบันทึกอีกครั้ง';status.classList.add('error')}
  }
};

window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  const message=event.data||{};
  if(message.type!=='HEROHEALTH_GAME_RECEIPT')return;
  const status=query('#bhFinalSync');
  if(!status)return;
  if(message.ok===true){status.textContent='บันทึกสำเร็จแล้ว';status.classList.add('ok')}
  else{status.textContent='ยังไม่ยืนยันผล • กลับ Passport เพื่อลองอีกครั้ง';status.classList.add('error')}
});

const observer=new MutationObserver(()=>{
  compactCalibration();
  const overlay=query('#resultOverlay');
  if(!overlay||overlay.classList.contains('hidden'))return;
  if(overlay.dataset.bhFinalV38==='1')return;
  renderFinal(lastSummary||readStoredSummary(),true);
});

installStyle();
localizeStatic();
observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});

console.info('[BalanceHold] Classroom UI Final v38 ready',RELEASE);
})();
