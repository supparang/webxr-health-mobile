import{initializeApp,getApps}from"https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import{getFirestore,doc,getDoc}from"https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import{HEROHEALTH_FIREBASE_CONFIG}from"../firebase/firebase-config.js";

const RELEASE='20260812-LIVE-CLASSROOM-CERT-EVIDENCE-R7-LAZY';
const app=getApps().length?getApps()[0]:initializeApp(HEROHEALTH_FIREBASE_CONFIG);
const db=getFirestore(app);
const $=id=>document.getElementById(id);
let lastSid='',busySid='';

function dateOf(v){
  if(!v)return null;
  if(typeof v.toDate==='function')return v.toDate();
  if(v.seconds)return new Date(v.seconds*1000);
  const d=new Date(v);return Number.isNaN(d.getTime())?null:d;
}
function fmt(v){
  const d=dateOf(v);return d?d.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',hour12:false}):'—';
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function sidFromDrawer(){
  const text=String($('dName')?.textContent||'').trim();
  return (text.match(/^([0-9A-Za-z_-]+)/)||[])[1]||'';
}
function assessmentCollection(sid){
  const sandbox=/^9900(?:0[1-9]|1\d|2\d)$/.test(String(sid||''));
  return sandbox?'studentAssessmentsSandbox':'studentAssessments';
}
function host(){
  const body=$('dBody');if(!body)return null;
  let box=body.querySelector('#hh-certificate-evidence-r7');
  if(!box){
    box=document.createElement('section');box.id='hh-certificate-evidence-r7';
    box.style.cssText='margin-top:14px;border:1px solid #d7e9e5;border-radius:14px;padding:12px;background:#fffdf5';
    body.appendChild(box);
  }
  return box;
}
function renderLoading(sid){const box=host();if(box)box.innerHTML=`<h3 style="margin:0 0 8px">🏆 Certificate Evidence</h3><div style="color:#64748b;font-size:12px">กำลังตรวจ Firebase สำหรับ ${esc(sid)}…</div>`;}
function renderMissing(sid){const box=host();if(box)box.innerHTML=`<h3 style="margin:0 0 8px">🏆 Certificate Evidence</h3><div style="padding:10px;border-radius:10px;background:#f8fafc;color:#64748b"><b>ยังไม่ออกใบประกาศ</b><br><small>${esc(assessmentCollection(sid))}/${esc(sid)}_CERTIFICATE</small></div>`;}
function renderError(message){const box=host();if(box)box.innerHTML=`<h3 style="margin:0 0 8px">🏆 Certificate Evidence</h3><div style="padding:10px;border-radius:10px;background:#fee2e2;color:#991b1b"><b>อ่าน Certificate ไม่สำเร็จ</b><br><small>${esc(message)}</small></div>`;}
function renderCert(sid,data){
  const issued=data?.certificateIssuedAt||data?.certificateIssuedAtIso||data?.issuedAt||data?.createdAt;
  const id=data?.certificateId||'—';
  const completed=data?.completed===true;
  const version=data?.certificateVersion||data?.version||'—';
  const box=host();if(!box)return;
  box.innerHTML=`<h3 style="margin:0 0 8px">🏆 Certificate Evidence</h3><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><div class="gameBox" style="background:#ecfdf5"><b>Issued</b><br>${completed?'✅ Firebase verified':'⚠️ document exists'}<br><small>${esc(assessmentCollection(sid))}/${esc(sid)}_CERTIFICATE</small></div><div class="gameBox"><b>Certificate ID</b><br>${esc(id)}<br><small>Version ${esc(version)}</small></div><div class="gameBox"><b>Issued at</b><br>${esc(fmt(issued))}</div><div class="gameBox"><b>Authority</b><br>Firebase<br><small>read on Evidence open only</small></div></div>`;
}
async function loadForOpenDrawer(){
  const drawer=$('drawer');if(!drawer?.classList.contains('open'))return;
  const sid=sidFromDrawer();if(!sid||busySid===sid)return;
  const existing=$('hh-certificate-evidence-r7');
  if(lastSid===sid&&existing)return;
  busySid=sid;lastSid=sid;renderLoading(sid);
  try{
    const ref=doc(db,assessmentCollection(sid),`${sid}_CERTIFICATE`);
    const snap=await getDoc(ref);
    if(!drawer.classList.contains('open')||sidFromDrawer()!==sid)return;
    if(!snap.exists())renderMissing(sid);else renderCert(sid,snap.data()||{});
  }catch(e){if(drawer.classList.contains('open')&&sidFromDrawer()===sid)renderError(e?.message||e)}
  finally{if(busySid===sid)busySid='';}
}

const drawer=$('drawer');
if(drawer){
  const obs=new MutationObserver(()=>{if(drawer.classList.contains('open'))setTimeout(loadForOpenDrawer,30);else lastSid='';});
  obs.observe(drawer,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target?.closest?.('.evidence,.attention[data-id]'))setTimeout(loadForOpenDrawer,60)},true);
}
window.HH_CERTIFICATE_EVIDENCE_R7={release:RELEASE,refresh:loadForOpenDrawer};
console.info('[HeroHealth] Certificate Evidence R7 ready',RELEASE);
