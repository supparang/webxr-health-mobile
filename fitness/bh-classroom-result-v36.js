(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;

const RELEASE='20260729-BALANCE-CLASSROOM-RESULT-V36';
const s=BH.state;
const e=BH.el;
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const LEGACY_SUBMIT=typeof BH.submitSummary==='function'?BH.submitSummary.bind(BH):null;
const RESULT_KEY='HHA_BALANCE_HOLD_LAST_RESULT';

function clean(value){return String(value==null?'':value).trim()}
function num(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
function escapeHtml(value){return clean(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}

function injectStyle(){
  if(document.getElementById('bhClassroomResultV36Style'))return;
  const style=document.createElement('style');
  style.id='bhClassroomResultV36Style';
  style.textContent=`
    #resultOverlay.bh-result-v36{
      align-items:flex-start!important;
      padding:8px!important;
      overflow:auto!important;
      background:rgba(2,16,32,.82)!important;
      backdrop-filter:blur(8px)!important;
    }
    #resultOverlay.bh-result-v36 .bh-result-modal{
      width:min(94vw,560px)!important;
      max-height:none!important;
      margin:8px auto calc(12px + env(safe-area-inset-bottom,0px))!important;
      padding:16px!important;
      border-radius:24px!important;
      overflow:visible!important;
      background:linear-gradient(180deg,#fff,#f0fdfa)!important;
      border:3px solid #6ee7b7!important;
      box-shadow:0 18px 52px rgba(2,6,23,.42)!important;
    }
    .bh-result-head{text-align:center}
    .bh-result-icon{font-size:40px;line-height:1}
    .bh-result-head h2{margin:5px 0 0!important;font-size:24px!important;line-height:1.1!important;color:#0f172a!important}
    .bh-result-outcome{margin:6px 0 0;font-size:14px;font-weight:900;color:#047857}
    .bh-result-score{display:flex;align-items:end;justify-content:center;gap:8px;margin-top:8px;color:#0f172a}
    .bh-result-score strong{font-size:48px;line-height:.95}
    .bh-result-score span{font-size:14px;font-weight:900;padding-bottom:5px}
    .bh-result-rank{text-align:center;font-size:13px;font-weight:900;color:#475569;margin-top:5px}
    .bh-result-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
    .bh-result-metric{min-width:0;min-height:86px;padding:10px 8px;border-radius:18px;background:#fff;border:2px solid #dbeafe;display:grid;place-items:center;text-align:center}
    .bh-result-metric span{display:block;font-size:11px;line-height:1.18;font-weight:900;color:#475569;white-space:normal;overflow-wrap:anywhere}
    .bh-result-metric b{display:block;margin-top:4px;font-size:30px;line-height:1;color:#0f172a;white-space:nowrap}
    .bh-result-metric.complete{background:#fff7ed;border-color:#fed7aa}
    .bh-result-advice{margin-top:10px;padding:10px 12px;border-radius:16px;background:#f8fafc;color:#334155;font-size:13px;line-height:1.4;font-weight:800}
    #sheetStatus.bh-sheet-status{margin-top:10px;padding:10px 12px;border-radius:16px;text-align:center;font-size:13px;line-height:1.35;font-weight:900;background:#fff7ed;border:2px solid #fdba74;color:#9a3412}
    #sheetStatus.bh-sheet-status.ok{background:#ecfdf5;border-color:#86efac;color:#047857}
    #sheetStatus.bh-sheet-status.error{background:#fef2f2;border-color:#fca5a5;color:#b91c1c}
    .bh-passport-action{margin-top:12px}
    #balancePassportBtn{width:100%;min-height:56px;border:0;border-radius:18px;padding:12px 16px;background:linear-gradient(135deg,#14b8a6,#16a34a);color:#fff;font:inherit;font-size:18px;font-weight:1000;box-shadow:0 10px 24px rgba(5,150,105,.24)}
    #balancePassportBtn:disabled{opacity:.62}
    .bh-result-note{margin:8px 0 0;text-align:center;color:#64748b;font-size:11px;font-weight:800}
    @media(min-width:480px){.bh-result-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-height:700px){
      #resultOverlay.bh-result-v36 .bh-result-modal{padding:12px!important;margin-top:4px!important}
      .bh-result-icon{font-size:32px}.bh-result-head h2{font-size:21px!important}.bh-result-score strong{font-size:40px}
      .bh-result-metric{min-height:72px;padding:8px 6px}.bh-result-metric b{font-size:25px}
    }
  `;
  document.head.appendChild(style);
}

function officialResult(summary){
  const completed=num(summary.completedPoses);
  const total=Math.max(1,num(summary.totalPoses,6));
  const complete=completed>=total;
  const eventId=clean(summary.eventId||summary.roundId||summary.attemptId)||`HH-game-fitness-balance-hold-${clean(summary.studentId)||'anon'}-${Date.now()}`;
  return{
    ...summary,
    eventId,
    record_id:eventId,
    completed:complete,
    procedureCompleted:complete,
    progressionEligible:complete,
    passed:summary.passed===true,
    skillCriteriaMet:summary.passed===true,
    score:num(summary.score),
    accuracy:num(summary.poseAccuracy),
    completion:num(summary.completionRate),
    completedPoses:completed,
    totalPoses:total,
    game:'balance-hold',
    gameId:'balance-hold',
    zone:'fitness',
    inputMode:'classroom-pose',
    gameVersion:RELEASE,
    analyticsSchemaVersion:'HH-UNIFIED-GAME-ANALYTICS-V2',
    completionPolicy:'one-classroom-round-completes-skill-separate',
    retryRequired:false,
    singleAttemptPolicy:true,
    finishedAt:new Date().toISOString()
  };
}

function storeOfficial(summary){
  const result=officialResult(summary);
  try{localStorage.setItem(RESULT_KEY,JSON.stringify(result))}catch(_){}
  window.__BALANCE_HOLD_LAST_RESULT__=result;
  window.__HH_BALANCE_RESULT_V36__=result;
  try{window.dispatchEvent(new CustomEvent('balancehold:completed',{detail:result}))}catch(_){}
  return result;
}

function metric(label,value,extra=''){
  return `<div class="bh-result-metric ${extra}"><div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div></div>`;
}

BH.renderSummary=summary=>{
  injectStyle();
  const official=storeOfficial(summary);
  const completed=num(summary.completedPoses);
  const total=Math.max(1,num(summary.totalPoses,6));
  const done=completed>=total;
  const outcome=done?'จบภารกิจครบแล้ว':'จบรอบแล้ว • บันทึกตามผลที่ทำได้';

  e.resultOverlay.classList.add('bh-result-v36');
  e.resultOverlay.innerHTML=`
    <section class="modal bh-result-modal" role="dialog" aria-labelledby="bhResultTitle">
      <header class="bh-result-head">
        <div class="bh-result-icon">🏆</div>
        <h2 id="bhResultTitle">Balance Hold Summary</h2>
        <p class="bh-result-outcome">${outcome}</p>
      </header>
      <div class="bh-result-score"><strong>${escapeHtml(summary.assessmentScore)}</strong><span>/100</span></div>
      <div class="bh-result-rank">${escapeHtml(summary.rank)} • คะแนนเกม ${escapeHtml(summary.score)}</div>
      <div class="bh-result-metrics">
        ${metric('ท่าทาง',`${num(summary.poseAccuracy)}%`)}
        ${metric('ความนิ่ง',`${num(summary.stabilityScore)}%`)}
        ${metric('การควบคุม',`${num(summary.transitionScore)}%`)}
        ${metric('ความปลอดภัย',`${num(summary.safeZoneScore)}%`)}
        ${metric('การติดตาม',`${num(summary.trackingCoverage)}%`)}
        ${metric('ภารกิจ',`${completed}/${total}`,'complete')}
      </div>
      <div class="bh-result-advice"><b>คำแนะนำ:</b> ${escapeHtml(summary.advice)}</div>
      <div class="bh-sheet-status" id="sheetStatus">⏳ ผลพร้อมส่ง • รอ Google Sheet และ Passport ยืนยัน</div>
      <div class="bh-passport-action"><button id="balancePassportBtn" type="button">← กลับ Passport</button></div>
      <p class="bh-result-note">สถานะอย่างเป็นทางการยึดตาม Google Sheet</p>
    </section>`;

  e.resultOverlay.classList.remove('hidden');
  const button=document.getElementById('balancePassportBtn');
  if(button)button.onclick=()=>BH.plannerReturn(summary);

  // The classroom shell is the authoritative sender. Emit one normalized result.
  if(window.parent!==window){
    try{window.parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:official},location.origin)}catch(_){}
  }
};

BH.submitSummary=async summary=>{
  const status=document.getElementById('sheetStatus');
  if(!status)return;

  if(s.demo){
    status.textContent='Demo Mode • ไม่ส่งข้อมูลเข้า Google Sheet';
    status.classList.add('error');
    return;
  }

  if(window.parent!==window){
    status.textContent='⏳ ส่งผลให้ Passport แล้ว • กำลังรอ Google Sheet ยืนยัน';
    return;
  }

  // Standalone QA cannot verify Sheet authority because the legacy endpoint is no-cors.
  // Send the request, but never claim that the Sheet has confirmed it.
  try{
    if(!BH.ENDPOINT)throw new Error('backend_url_missing');
    const payload=BH.payload(summary);
    await BH.postPayload(payload);
    BH.markSent?.(summary.roundId);
    status.textContent='📤 ส่งคำขอแล้ว • เปิดผ่าน Passport เพื่อยืนยันสถานะจาก Google Sheet';
  }catch(error){
    console.warn('[BalanceHold v36] standalone submit failed',error);
    try{BH.queuePayload?.(BH.payload(summary))}catch(_){}
    status.textContent='⚠️ เครือข่ายขัดข้อง • เก็บคิวไว้และรอ Passport ส่งซ้ำ';
    status.classList.add('error');
  }
};

BH.plannerReturn=summary=>{
  const button=document.getElementById('balancePassportBtn');
  if(button){button.disabled=true;button.textContent='กำลังกลับ Passport…'}

  if(window.parent!==window){
    try{
      const parentDocument=window.parent.document;
      const returnButton=parentDocument.getElementById('returnBtn');
      const leaveButton=parentDocument.getElementById('leaveBtn');
      const backButton=parentDocument.getElementById('back');
      if(returnButton&&!returnButton.disabled){returnButton.click();return}
      if(leaveButton&&!leaveButton.disabled){leaveButton.click();return}
      if(backButton){backButton.click();return}
    }catch(_){}
  }

  const raw=q.get('return')||q.get('back')||q.get('hub')||'../HeroHealth_Learning1/index.html';
  try{
    const url=new URL(raw,location.href);
    const carry={
      studentId:summary.studentId||q.get('studentId')||q.get('sid')||'',
      sid:summary.studentId||q.get('sid')||q.get('studentId')||'',
      fullName:summary.studentName||q.get('fullName')||q.get('name')||'',
      studentName:summary.studentName||q.get('studentName')||q.get('name')||'',
      section:summary.section||q.get('section')||'',
      group:summary.classId||q.get('group')||''
    };
    Object.entries(carry).forEach(([key,value])=>{if(value)url.searchParams.set(key,value)});
    url.searchParams.set('fromGame','balance-hold');
    url.searchParams.set('completedGame','balance-hold');
    url.searchParams.set('authorityRefresh',String(Date.now()));
    url.searchParams.set('pendingGameSync','fitness:balance-hold');
    location.href=url.href;
  }catch(_){
    location.href=raw;
  }
};

window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  const message=event.data||{};
  if(message.type!=='HEROHEALTH_GAME_RECEIPT')return;
  const status=document.getElementById('sheetStatus');
  if(!status)return;
  if(message.ok===true){
    status.textContent='✅ Google Sheet และ Passport ยืนยันผลแล้ว';
    status.classList.add('ok');
  }else{
    status.textContent='⚠️ Google Sheet ยังไม่ยืนยัน • กดกลับ Passport เพื่อลองอีกครั้ง';
    status.classList.add('error');
  }
});

console.info('[BalanceHold] Classroom Result v36 ready',RELEASE);
})();
