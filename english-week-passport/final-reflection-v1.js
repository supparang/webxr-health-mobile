(function(){
  'use strict';
  const VERSION='2026-08-09-FINAL-REFLECTION-V2-PASSPORT-RESUME';
  const cfg=window.EW_CONFIG||{};
  const journey=window.EW_JOURNEY;
  const form=document.getElementById('reflectionForm');
  const status=document.getElementById('status');
  const submitBtn=document.getElementById('submitBtn');
  const backBtn=document.getElementById('backBtn');

  function readIdentity(){
    try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}
  }
  function show(message,type){status.textContent=message;status.className='status show '+(type||'')}
  function goPassport(){location.replace('./index.html?resume=passport&from=final_reflection&v=20260809-journey-resume2')}
  backBtn.addEventListener('click',goPassport);

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const identity=readIdentity();
    if(!identity?.playerId){show('ไม่พบรหัสผู้เล่น กรุณากลับ Passport แล้วเข้าสู่ระบบใหม่','bad');return}
    const data=new FormData(form);
    const confidence=Number(data.get('confidence')||0);
    const mostUsefulMission=String(data.get('mission')||'');
    const helpedMost=String(data.get('helped')||'');
    const takeaway=String(document.getElementById('takeaway').value||'').trim();
    if(!confidence||!mostUsefulMission||!helpedMost){show('กรุณาตอบข้อ 1–3 ให้ครบก่อนบันทึก','bad');return}
    if(!journey?.endpointReady?.()){show('Firebase Journey Authority ยังไม่พร้อม จึงยังบันทึก Reflection ไม่ได้','bad');return}
    submitBtn.disabled=true;submitBtn.textContent='กำลังบันทึก Reflection…';show('กำลังส่ง Reflection และรอ Firebase Receipt…','');
    try{
      const receipt=await journey.submitReflection({
        playerId:identity.playerId,
        confidence,
        mostUsefulMission,
        helpedMost,
        takeaway,
        sourceVersion:VERSION
      });
      if(!receipt?.ok||receipt.mode!=='firebase'||!receipt.receiptId)throw new Error('FIREBASE_REFLECTION_RECEIPT_REQUIRED');
      show(`บันทึก Reflection สำเร็จ ✓ • ${receipt.receiptId} • กำลังกลับ Passport`,'good');
      setTimeout(goPassport,900);
    }catch(error){
      console.error(error);
      show('บันทึก Reflection ไม่สำเร็จ: '+String(error?.message||error),'bad');
      submitBtn.disabled=false;submitBtn.textContent='ลองบันทึก Reflection อีกครั้ง';
    }
  });
}());
