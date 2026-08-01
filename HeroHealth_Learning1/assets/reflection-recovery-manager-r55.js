(()=>{
'use strict';
const RELEASE='20260801-REFLECTION-RECOVERY-MANAGER-R55';
const STATE_KEY='herohealth_learning_platform_rc2';
const ROOT_ID='hh-reflection-recovery-r55';
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}};
const clean=v=>String(v==null?'':v).trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let busy=false;

function eligible(state){
  const reflection=state?.reflection||{};
  return Boolean(
    state?.profile?.studentId &&
    state?.completed?.posttest===true &&
    state?.completed?.reflection!==true &&
    reflection.submittedAt &&
    Number(reflection.understand)>0 &&
    clean(reflection.best) &&
    clean(reflection.action)
  );
}

function remove(){document.getElementById(ROOT_ID)?.remove()}
function ensureStyles(){
  if(document.getElementById(ROOT_ID+'-style'))return;
  const style=document.createElement('style');
  style.id=ROOT_ID+'-style';
  style.textContent=`
  #${ROOT_ID}{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(8,35,31,.72);backdrop-filter:blur(5px)}
  #${ROOT_ID} .hh-rm-card{width:min(560px,100%);background:#fff;border-radius:24px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);color:#12302c;border:1px solid #d7e8e4}
  #${ROOT_ID} h2{margin:0 0 10px;font-size:1.65rem;line-height:1.2}
  #${ROOT_ID} p{margin:0 0 13px;line-height:1.55;color:#526c67}
  #${ROOT_ID} .hh-rm-proof{padding:12px 14px;border-radius:15px;background:#ecfdf5;color:#166534;font-weight:800;margin:12px 0}
  #${ROOT_ID} .hh-rm-status{padding:12px 14px;border-radius:15px;background:#f0fdfa;color:#0f766e;font-weight:800;white-space:pre-line;margin:12px 0}
  #${ROOT_ID} .hh-rm-status.error{background:#fee2e2;color:#991b1b}
  #${ROOT_ID} .hh-rm-actions{display:grid;gap:9px;margin-top:14px}
  #${ROOT_ID} button,#${ROOT_ID} a{min-height:50px;border:0;border-radius:15px;padding:13px 16px;font:inherit;font-weight:900;text-align:center;text-decoration:none;cursor:pointer}
  #${ROOT_ID} .primary{background:#0f766e;color:#fff}
  #${ROOT_ID} .secondary{background:#e7f7f4;color:#0f766e}
  #${ROOT_ID} .quiet{background:#f4f7f6;color:#526c67}
  #${ROOT_ID} button:disabled{opacity:.55;cursor:wait}
  @media(max-width:560px){#${ROOT_ID}{padding:10px;align-items:end}#${ROOT_ID} .hh-rm-card{border-radius:22px 22px 0 0;padding:20px}}
  `;
  document.head.appendChild(style);
}

function render(){
  const state=read();
  if(!eligible(state)){remove();return false}
  if(document.getElementById(ROOT_ID))return true;
  ensureStyles();
  const reflection=state.reflection||{};
  const root=document.createElement('div');
  root.id=ROOT_ID;
  root.innerHTML=`<section class="hh-rm-card" role="dialog" aria-modal="true" aria-labelledby="hh-rm-title">
    <h2 id="hh-rm-title">พบ Reflection ที่ยังไม่ยืนยัน</h2>
    <p>คำตอบเดิมยังอยู่ในเครื่อง แต่ Google Sheet ยังไม่รับรองขั้น Reflection ระบบจะส่งคำตอบเดิมอีกครั้งโดยไม่ให้กรอกใหม่</p>
    <div class="hh-rm-proof">✓ มีหลักฐานคำตอบเดิม • ส่งเมื่อ ${clean(reflection.submittedAt)||'ไม่ทราบเวลา'}</div>
    <div class="hh-rm-status" id="hh-rm-status">พร้อมกู้ข้อมูลจากเครื่องไปยัง Google Sheet</div>
    <div class="hh-rm-actions">
      <button class="primary" id="hh-rm-recover">ส่ง Reflection เดิมอีกครั้ง</button>
      <a class="secondary" href="./assessment/reflection.html?recovery=1">เปิดหน้า Reflection เพื่อตรวจคำตอบ</a>
      <button class="quiet" id="hh-rm-later">ไว้ภายหลัง</button>
    </div>
  </section>`;
  document.body.appendChild(root);
  root.querySelector('#hh-rm-recover').onclick=recover;
  root.querySelector('#hh-rm-later').onclick=()=>remove();
  return true;
}

function setStatus(text,error=false){
  const el=document.getElementById('hh-rm-status');
  if(!el)return;
  el.textContent=text;
  el.className='hh-rm-status'+(error?' error':'');
}

async function recover(){
  if(busy)return;
  busy=true;
  const button=document.getElementById('hh-rm-recover');
  if(button){button.disabled=true;button.textContent='กำลังกู้ Reflection…'}
  try{
    setStatus('กำลังส่งคำตอบเดิมไป Google Sheet…');
    for(let wait=0;wait<30&&!window.HHBackend?.recoverReflection;wait++)await sleep(200);
    if(!window.HHBackend?.recoverReflection)throw new Error('recovery_service_not_ready');
    const started=await window.HHBackend.recoverReflection();
    if(started===false){
      const current=read();
      if(current?.completed?.reflection===true){location.reload();return}
      throw new Error('reflection_recovery_not_confirmed');
    }
    setStatus('Google Sheet ยืนยัน Reflection แล้ว\nกำลังอัปเดต Passport…');
    await sleep(900);
    location.reload();
  }catch(error){
    console.warn('[Reflection Recovery Manager R55]',error);
    setStatus('ยังยืนยันกับ Google Sheet ไม่สำเร็จ\nคำตอบเดิมยังคงอยู่และไม่สูญหาย กรุณากดส่งอีกครั้ง',true);
    if(button){button.disabled=false;button.textContent='ส่ง Reflection เดิมอีกครั้ง'}
  }finally{busy=false}
}

function boot(){
  render();
  setTimeout(()=>{if(eligible(read()))recover()},1200);
  setInterval(()=>render(),5000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HHReflectionRecoveryManager={version:RELEASE,render,recover,eligible:()=>eligible(read())};
console.info('[Reflection Recovery Manager R55] installed',RELEASE);
})();