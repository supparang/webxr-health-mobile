(function(){
  'use strict';
  const VERSION='2026-08-10-FINAL-REFLECTION-V3-PLAYED-MISSIONS-ONLY';
  const cfg=window.EW_CONFIG||{};
  const journey=window.EW_JOURNEY;
  const form=document.getElementById('reflectionForm');
  const status=document.getElementById('status');
  const submitBtn=document.getElementById('submitBtn');
  const backBtn=document.getElementById('backBtn');
  const BONUS_COLLECTION='ewp_game_summary';

  function readIdentity(){
    try{return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}
  }
  function show(message,type){status.textContent=message;status.className='status show '+(type||'')}
  function goPassport(){location.replace('./index.html?resume=passport&from=final_reflection&v=20260810-reflection-played-only1')}
  backBtn.addEventListener('click',goPassport);

  function setBonusChoiceState(played){
    const input=document.getElementById('mb');
    const label=document.querySelector('label[for="mb"]');
    if(!input||!label)return;
    input.disabled=!played;
    input.checked=played?input.checked:false;
    label.textContent=played?'📷 Lexicon Lens Hunt':'📷 Lexicon Lens Hunt • ยังไม่ได้เล่น';
    label.style.opacity=played?'1':'.48';
    label.style.cursor=played?'pointer':'not-allowed';
    label.title=played?'':'เลือกได้เมื่อผู้เรียนเล่น Bonus Mission จริงแล้วเท่านั้น';
    input.closest('.choice')?.setAttribute('data-played',played?'1':'0');
  }

  async function syncPlayedMissions(){
    const identity=readIdentity();
    setBonusChoiceState(false);
    if(!identity?.playerId||!window.firebase?.firestore)return;
    try{
      if(window.firebase?.auth&&!firebase.auth().currentUser)await firebase.auth().signInAnonymously();
      const snap=await firebase.firestore().collection(BONUS_COLLECTION).doc(identity.playerId).get();
      const data=snap.exists?(snap.data()||{}):{};
      const best=data.bonusBest||null;
      const played=Boolean(best&&Number.isFinite(Number(best.score)));
      setBonusChoiceState(played);
      window.EW_REFLECTION_PLAYED_MISSIONS=Object.freeze({version:VERSION,bonusLensPlayed:played,source:'firebase-summary'});
    }catch(error){
      console.warn('[LEXICON X] Reflection played-mission check failed',error);
      // Fail closed: an unverified Bonus must not become a research response option.
      setBonusChoiceState(false);
    }
  }

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
    if(mostUsefulMission==='bonus_lens'&&document.getElementById('mb')?.disabled){show('Lexicon Lens Hunt เลือกได้เฉพาะเมื่อเล่น Bonus Mission แล้ว กรุณาเลือก Mission ที่คุณได้เล่นจริง','bad');return}
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

  syncPlayedMissions();
}());