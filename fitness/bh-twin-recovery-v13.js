(()=>{
'use strict';
const BH=window.BH;if(!BH)return;
const q=new URLSearchParams(location.search),$=id=>document.getElementById(id);
const SURVEY_PREFIX='fitness_balance_hold_recovery_v13_';
const planner=q.get('entry')==='planner'||q.get('from')==='planner'||!!q.get('planId')||!!q.get('planSlot')||!!q.get('plannerReturnUrl');
let activeSummary=null,allowExit=false;
function clean(v){return String(v==null?'':v).trim()}
function lastSummary(){try{return JSON.parse(localStorage.getItem(BH.KEY_LAST||'fitness_balance_hold_last')||'null')}catch(_){return null}}
function surveyKey(x){return SURVEY_PREFIX+clean(x?.roundId||x?.attemptId||'unknown')}
function surveySaved(x){try{return localStorage.getItem(surveyKey(x))==='1'}catch(_){return false}}
function markSaved(x){try{localStorage.setItem(surveyKey(x),'1')}catch(_){}}
function endpoint(){return q.get('sheet')||q.get('gas')||q.get('webapp')||q.get('api')||BH.ENDPOINT||''}
function hubUrl(){try{return new URL(q.get('hub')||'./hub.html',location.href).href}catch(_){return './hub.html'}}
function plannerTarget(){
  const raw=q.get('plannerReturnUrl')||q.get('plannerReturn')||hubUrl();
  if(raw==='1')return hubUrl();
  try{return new URL(raw,location.href).href}catch(_){return hubUrl()}
}
function carry(u){
  ['pid','playerId','studentId','studentName','name','classId','section','diff','time','duration','program','lang','view','sheet','gas','webapp','planId','planDay','planSlot','plannerReturnUrl','hub'].forEach(k=>{const v=q.get(k);if(v)u.searchParams.set(k,v)});
  return u;
}
function cooldownUrl(x){
  const u=carry(new URL('/webxr-health-mobile/herohealth/warmup-gate.html',location.origin));
  u.searchParams.set('phase','cooldown');u.searchParams.set('game','balance-hold');u.searchParams.set('gameId','balance-hold');
  u.searchParams.set('zone','fitness');u.searchParams.set('cat','fitness');u.searchParams.set('entry',planner?'planner':'solo');
  const next=planner?plannerTarget():hubUrl();u.searchParams.set('next',next);u.searchParams.set('cdnext',next);u.searchParams.set('hub',next);
  u.searchParams.set('cooldownOffered','yes');
  if(x?.roundId)u.searchParams.set('roundId',x.roundId);
  if(x?.score!=null)u.searchParams.set('score',String(x.score));
  return u.href;
}
function installStyle(){if($('bhRecoveryV13Style'))return;const s=document.createElement('style');s.id='bhRecoveryV13Style';s.textContent=`
#bhRecoveryV13{position:fixed;inset:0;z-index:10050;display:none;place-items:center;padding:16px;background:rgba(2,6,23,.80);backdrop-filter:blur(10px)}
#bhRecoveryV13.show{display:grid}.bhRCard{width:min(680px,100%);max-height:92dvh;overflow:auto;border-radius:28px;padding:20px;color:#fff;background:linear-gradient(180deg,#172033,#0f172a);border:1px solid rgba(255,255,255,.18);box-shadow:0 30px 90px rgba(0,0,0,.55)}
.bhRCard h2{margin:0 0 6px}.bhRLead{margin:0 0 16px;color:#cbd5e1;line-height:1.5}.bhRScale{display:grid;grid-template-columns:repeat(11,1fr);gap:5px;margin:10px 0 16px}.bhRScale button{min-height:42px;border-radius:11px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.16);color:#fff;font-weight:900}.bhRScale button.on{background:linear-gradient(135deg,#38bdf8,#6366f1)}
.bhRPain{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}.bhRPain label{display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);font-weight:850}.bhRNote{width:100%;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:#fff;padding:10px}.bhRActions{display:grid;gap:9px;margin-top:16px}.bhRActions button{min-height:52px;border-radius:16px;color:#fff;font-weight:950;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.10)}.bhRActions .primary{background:linear-gradient(135deg,#22c55e,#38bdf8)}.bhRErr{min-height:22px;color:#fda4af;font-weight:850;margin-top:8px}.bhRecoveryAction{background:linear-gradient(135deg,#22c55e,#38bdf8)!important;color:#fff!important;border:0!important}`;document.head.appendChild(s)}
function modal(){
  let m=$('bhRecoveryV13');if(m)return m;installStyle();m=document.createElement('section');m.id='bhRecoveryV13';m.innerHTML=`<div class="bhRCard" role="dialog" aria-modal="true"><h2>🩺 เช็กความรู้สึกหลัง Balance Hold</h2><p class="bhRLead">เลือกความเหนื่อยและอาการหลังเล่นก่อนทำ Cooldown หรือกลับ Fitness Zone</p><b>RPE ความเหนื่อย 0–10</b><div class="bhRScale">${Array.from({length:11},(_,i)=>`<button type="button" data-bhrpe="${i}">${i}</button>`).join('')}</div><b>มีอาการตรงไหนบ้าง</b><div class="bhRPain">${['ไม่มี','ไหล่','แขน','ข้อมือ','หลัง','เข่า','เวียนศีรษะ'].map(v=>`<label><input type="radio" name="bhPainV13" value="${v}"> ${v}</label>`).join('')}</div><label>หมายเหตุเพิ่มเติม<input id="bhRNote" class="bhRNote" maxlength="180" placeholder="ไม่บังคับ"></label><div id="bhRErr" class="bhRErr"></div><div class="bhRActions"><button id="bhRGoCooldown" class="primary">🧘 บันทึกและทำ Cooldown</button><button id="bhRGoHub">บันทึกและกลับ Fitness Zone</button><button id="bhRCancel">กลับไปดูผล</button></div></div>`;document.body.appendChild(m);
  m.querySelectorAll('[data-bhrpe]').forEach(b=>b.onclick=()=>{m.dataset.rpe=b.dataset.bhrpe;m.querySelectorAll('[data-bhrpe]').forEach(x=>x.classList.toggle('on',x===b))});
  m.querySelectorAll('input[name=bhPainV13]').forEach(x=>x.onchange=()=>m.dataset.pain=x.value);
  $('bhRGoCooldown').onclick=()=>saveAndExit(true);$('bhRGoHub').onclick=()=>saveAndExit(false);$('bhRCancel').onclick=()=>m.classList.remove('show');
  if(planner)$('bhRGoHub').style.display='none';return m;
}
async function sendSurvey(x,useCooldown){
  const m=modal(),rpe=m.dataset.rpe,pain=m.dataset.pain;if(rpe==null||!pain){$('bhRErr').textContent='กรุณาเลือก RPE และอาการก่อน';return false}
  $('bhRErr').textContent='กำลังบันทึก...';const payload={action:'fitnessPostSurvey',api:'fitness',type:'fitness_post_survey',game:'balance-hold',gameId:'balance-hold',source:'balance-hold-twin-pose-v13',timestamp:new Date().toISOString(),clientTimestamp:new Date().toISOString(),roundId:x?.roundId||'',attemptId:x?.attemptId||x?.roundId||'',sessionId:x?.sessionId||'',studentId:x?.studentId||q.get('studentId')||q.get('pid')||'',playerId:x?.playerId||q.get('playerId')||q.get('pid')||'',studentName:x?.studentName||q.get('studentName')||q.get('name')||'Hero',classId:x?.classId||q.get('classId')||q.get('group')||'',section:x?.section||q.get('section')||'',entryMode:planner?'planner':'solo',rpe:Number(rpe),painArea:pain,painNote:clean($('bhRNote')?.value),dizzy:pain==='เวียนศีรษะ'?'yes':'no',cooldownOffered:'yes',cooldownDone:useCooldown?'pending':'no',cooldownSkipped:useCooldown?'no':'yes',score:Number(x?.score||0),assessmentScore:Number(x?.assessmentScore||0),poseAccuracy:Number(x?.poseAccuracy||0),stabilityScore:Number(x?.stabilityScore||0),transitionScore:Number(x?.transitionScore||0),safeZoneScore:Number(x?.safeZoneScore||0),trackingCoverage:Number(x?.trackingCoverage||0),sourceUrl:location.href};
  try{if(endpoint())await fetch(endpoint(),{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});markSaved(x);return true}catch(err){console.warn('[BalanceHold Recovery]',err);try{localStorage.setItem('fitness_balance_hold_recovery_queue_v13',JSON.stringify(payload))}catch(_){}markSaved(x);return true}
}
async function saveAndExit(cooldown){const x=activeSummary||lastSummary()||{};if(!await sendSurvey(x,cooldown))return;allowExit=true;modal().classList.remove('show');location.href=cooldown?cooldownUrl(x):hubUrl()}
function openRecovery(x){activeSummary=x||lastSummary()||{};const m=modal();m.dataset.rpe='';delete m.dataset.rpe;delete m.dataset.pain;$('bhRErr').textContent='';m.querySelectorAll('.on').forEach(n=>n.classList.remove('on'));m.querySelectorAll('input[name=bhPainV13]').forEach(n=>n.checked=false);m.classList.add('show')}
function enhance(){
  const result=$('resultOverlay');if(!result||result.classList.contains('hidden'))return;const x=lastSummary();if(!x||x.official===false||BH.state?.demo)return;
  activeSummary=x;const actions=result.querySelector('.actions');if(!actions)return;
  if(!$('bhCooldownBtnV13')){const b=document.createElement('button');b.id='bhCooldownBtnV13';b.className='btn bhRecoveryAction';b.type='button';b.textContent='🧘 RPE + Cooldown';b.onclick=()=>openRecovery(x);actions.insertBefore(b,actions.firstChild)}
}
document.addEventListener('click',ev=>{const back=ev.target?.closest?.('#backBtn');if(!back||allowExit)return;const x=lastSummary();if(!x||x.official===false||BH.state?.demo||surveySaved(x))return;ev.preventDefault();ev.stopImmediatePropagation();openRecovery(x)},true);
const obs=new MutationObserver(enhance);obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});setInterval(enhance,500);enhance();
console.info('[BalanceHold] Recovery/RPE compatibility v13 ready');
})();