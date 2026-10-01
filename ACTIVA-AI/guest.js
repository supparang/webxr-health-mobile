(()=>{
"use strict";
const host=document.getElementById("guestApp");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=v=>v?new Date(v).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"}):"—";
const params=new URLSearchParams(location.hash.replace(/^#/,""));
let pass=params.get("token")||"";
if(location.hash)history.replaceState(null,"",location.pathname+location.search);
let data=null,stream=null,frame=null;
function errorText(e){
 const errors={
  GUEST_PASS_REQUIRED:"ลิงก์ไม่สมบูรณ์ กรุณาขอ Guest Pass จากผู้จัดกิจกรรม",
  GUEST_PASS_INVALID:"Guest Pass ไม่ถูกต้อง",
  GUEST_PASS_EXPIRED:"Guest Pass หมดอายุแล้ว",
  GUEST_PASS_REVOKED:"Guest Pass ถูกยกเลิกหรือถอนความยินยอมแล้ว",
  GUEST_CONSENT_REQUIRED:"กรุณาอ่านและยืนยันความยินยอมก่อน Check-in",
  EVENT_QR_NOT_ACTIVE:"Dynamic QR ไม่ใช่ใบล่าสุดหรือหมดอายุแล้ว กรุณาสแกนใหม่",
  QR_PURPOSE_MISMATCH:"QR ไม่ตรงกับขั้นตอน Check-in/Check-out",
  QR_ACTIVITY_MISMATCH:"QR ไม่ตรงกับกิจกรรมนี้",
  QR_CHECKIN_NOT_OPEN:"ยังไม่เปิดเวลา Check-in",
  QR_CHECKIN_CLOSED:"ปิดเวลา Check-in แล้ว",
  QR_CHECKOUT_NOT_OPEN:"ยังไม่เปิดเวลา Check-out",
  QR_CHECKOUT_CLOSED:"ปิดเวลา Check-out แล้ว",
  ALREADY_CHECKED_IN:"บันทึก Check-in ไปแล้ว",
  ALREADY_CHECKED_OUT:"บันทึก Check-out ไปแล้ว",
 };
 return errors[e?.message]||String(e?.message||e||"เกิดข้อผิดพลาด");
}
async function api(path,body){
 if(!pass)throw Error("GUEST_PASS_REQUIRED");
 const h={"Accept":"application/json","Authorization":"GuestPass "+pass};
 if(body!==undefined)h["Content-Type"]="application/json";
 const r=await fetch(path,{method:body===undefined?"GET":"POST",headers:h,
  body:body===undefined?undefined:JSON.stringify(body),credentials:"omit",cache:"no-store",redirect:"error"});
 let d={};try{d=await r.json();}catch{}
 if(!r.ok)throw Error(d.error||("HTTP_"+r.status));
 return d;
}
async function stopCamera(){
 if(frame)cancelAnimationFrame(frame);frame=null;
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
 const video=document.getElementById("guestVideo");if(video)video.srcObject=null;
}
async function scanQr(purpose){
 const video=document.getElementById("guestVideo");
 const hint=document.getElementById("guestCameraMsg");
 if(!video || !hint)return;
 if(!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia){
  hint.textContent="เบราว์เซอร์นี้ไม่รองรับการอ่าน QR ด้วยกล้อง กรุณากรอก Token จาก Dynamic QR";
  return;
 }
 try{
  await stopCamera();
  const detector=new BarcodeDetector({formats:["qr_code"]});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
  video.srcObject=stream;video.hidden=false;await video.play();
  hint.textContent="เล็งกล้องไปที่ Dynamic "+purpose+" QR บนจอผู้จัดกิจกรรม";
  let busy=false;
  async function detect(){
   if(!stream)return;
   if(!busy){
    busy=true;
    try{
     const found=await detector.detect(video);
     if(found.length){
      document.getElementById("guestEventToken").value=found[0].rawValue||"";
      await stopCamera();
      hint.textContent="อ่าน QR แล้ว กดบันทึก "+purpose+" ได้เลย";
      return;
     }
    }catch{}
    busy=false;
   }
   frame=requestAnimationFrame(detect);
  }
  frame=requestAnimationFrame(detect);
 }catch(e){await stopCamera();hint.textContent="เปิดกล้องไม่ได้ กรุณาใช้ช่อง Token แทน";}
}
function message(s,bad=false){const p=document.getElementById("guestMsg");if(p)p.innerHTML='<div class="alert '+(bad?"bad":"ok")+'">'+esc(s)+'</div>';}
function render(){
 const a=data.activity, c=data.consent, at=data.attendance;
 const done=Boolean(at?.checkoutAt), checked=Boolean(at?.checkinAt);
 const purpose=checked?"CHECKOUT":"CHECKIN";
 host.innerHTML='<div class="panel">'+
 '<div class="alert info"><b>Guest '+esc(data.guestRef)+'</b> • ไม่มีบัญชีผู้ใช้ • ไม่จัดเก็บชื่อ/อีเมลใน Guest Pass<br>'+
 'การถือบัตรไม่ใช่หลักฐานยืนยันตัวตน เจ้าหน้าที่ต้องตรวจสอบบุคคลจริงแยกต่างหาก</div>'+
 '<h2>'+esc(a.title)+'</h2><p class="muted">'+esc(a.category)+' • '+esc(fmt(a.startAt))+' → '+esc(fmt(a.endAt))+
 ' • DATA: '+esc(a.dataClassification)+'</p>'+
 '<p class="muted">Pass หมดอายุ: '+esc(fmt(data.expiresAt))+'</p>'+
 (!c.accepted?
   '<div class="panel"><h3>ความยินยอมเข้าร่วมและการใช้ข้อมูล</h3>'+
   '<p><b>เอกสารฉบับ:</b> '+esc(c.version)+'</p>'+
   '<div style="white-space:pre-wrap;max-height:280px;overflow:auto" class="hint">'+esc(c.text)+'</div>'+
   '<label class="check" style="margin-top:14px"><input type="checkbox" id="guestConsent"> '+
   'ฉันได้อ่านและยินยอมโดยสมัครใจตามข้อความข้างต้น และทราบว่าสามารถถอนความยินยอมได้</label>'+
   '<div class="actions"><button class="btn primary" id="guestAccept">ยืนยันความยินยอม</button></div></div>':
   '<div class="alert ok">ยืนยันความยินยอมแล้ว • ฉบับ '+esc(c.version)+'</div>')+
 (c.accepted ? (
  done?'<div class="alert ok"><b>บันทึก Check-in / Check-out สำเร็จ</b><br>เข้า '+esc(fmt(at.checkinAt))+
      '<br>ออก '+esc(fmt(at.checkoutAt))+'<br>สถานะตัวตน: '+(at.identityVerified?"เจ้าหน้าที่ยืนยันแล้ว":"ยังรอการยืนยันโดยเจ้าหน้าที่")+'</div>':
  '<div class="panel"><h3>'+purpose+' — Dynamic Event QR</h3>'+
  (checked?'<div class="alert info">Check-in แล้วเมื่อ '+esc(fmt(at.checkinAt))+
   '<br>รอ QR สำหรับ Check-out ของกิจกรรมเดียวกัน</div>':'<div class="hint">สแกน QR Check-in ล่าสุดที่ผู้จัดกิจกรรมแสดงบนจอ</div>')+
  '<div class="field"><label>Dynamic '+purpose+' QR Token</label><textarea id="guestEventToken" rows="3" placeholder="สแกน QR หรือวาง Event QR Token"></textarea></div>'+
  '<div class="actions"><button class="btn secondary" id="guestScan">📷 สแกน QR</button>'+
  '<button class="btn primary" id="guestSubmit">ยืนยัน '+purpose+'</button></div>'+
  '<video id="guestVideo" playsinline muted hidden style="width:100%;max-width:420px"></video>'+
  '<div id="guestCameraMsg" class="muted"></div></div>'
 ): "")+
 '<div id="guestMsg"></div>'+
 '<hr><p class="muted">หากต้องการถอนความยินยอม ระบบจะยกเลิกการใช้บันทึกนี้เพื่อการวิจัย แต่เก็บบันทึก Audit ที่จำเป็นเพื่อการตรวจสอบย้อนหลัง</p>'+
 '<button class="btn secondary" id="guestWithdraw">ถอนความยินยอม / ยกเลิก Guest Pass</button>'+
 '</div>';
 const accept=document.getElementById("guestAccept");
 if(accept)accept.onclick=async()=>{
  if(!document.getElementById("guestConsent")?.checked){message("กรุณาติ๊กยืนยันความยินยอมด้วยตนเอง",true);return;}
  accept.disabled=true;
  try{await api("/api/public/guest/consent",{accepted:true,version:c.version});data=await api("/api/public/guest/session");render();}
  catch(e){accept.disabled=false;message(errorText(e),true);}
 };
 const scan=document.getElementById("guestScan");
 if(scan)scan.onclick=()=>scanQr(purpose);
 const submit=document.getElementById("guestSubmit");
 if(submit)submit.onclick=async()=>{
  const eventToken=String(document.getElementById("guestEventToken")?.value||"").trim();
  if(!eventToken){message("กรุณาสแกน/วาง Dynamic QR Token",true);return;}
  submit.disabled=true;
  try{
   await stopCamera();
   await api(purpose==="CHECKIN"?"/api/public/guest/checkin":"/api/public/guest/checkout",{eventToken});
   data=await api("/api/public/guest/session");render();
  }catch(e){submit.disabled=false;message(errorText(e),true);}
 };
 document.getElementById("guestWithdraw").onclick=async()=>{
  if(!confirm("ยืนยันถอนความยินยอม? Guest Pass จะถูกยกเลิก และบันทึกนี้จะถูกตัดออกจาก Research Dataset"))return;
  try{await api("/api/public/guest/withdraw",{confirmWithdrawal:true});pass="";await stopCamera();
   host.innerHTML='<div class="panel"><div class="alert ok">บันทึกการถอนความยินยอมแล้ว • ไม่ใช้ข้อมูลนี้เพื่อการวิจัย</div></div>';
  }catch(e){message(errorText(e),true);}
 };
}
async function init(){
 try{
  data=await api("/api/public/guest/session");render();
 }catch(e){pass="";host.innerHTML='<div class="panel"><div class="alert bad">'+esc(errorText(e))+'</div></div>';}
}
window.addEventListener("pagehide",()=>{void stopCamera();});
void init();
})();