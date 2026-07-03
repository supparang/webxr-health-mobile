/* EAP Hero Boss Gate v2 optional audio bridge.
   Consent-based recording; audio is attached only to Boss Speaking evidence. */
(function(){
  'use strict';
  var WEB_APP_URL='https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var STORE='EAP_HERO_PROGRESS_V3';
  var media=null, stream=null, chunks=[], file=null;
  function state(){try{return JSON.parse(localStorage.getItem(STORE)||'{}');}catch(_){return {};}}
  function person(){var p=state().profile||state().player||{};return {studentId:String(p.studentId||p.id||'guest'),studentName:String(p.studentName||p.name||'Guest'),section:String(p.section||'122')};}
  function sendAudio(blob,id){
    if(!blob||!id)return;
    var p=person(), reader=new FileReader();
    reader.onload=function(){
      var payload={action:'submit_speaking_audio',submissionKind:'fresh_evidence_v118',evidenceId:id,section:p.section,studentId:p.studentId,studentName:p.studentName,mimeType:blob.type||'audio/webm',fileName:'EAP-Boss-'+p.studentId+'-'+id+'.webm',audioBase64:String(reader.result||'').split(',')[1]||''};
      fetch(WEB_APP_URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)}).catch(function(){});
    };
    reader.readAsDataURL(blob);
  }
  function bridge(){
    var sync=window.EAPEvidenceSyncV130||window.EAPEvidenceSyncV129;
    if(!sync||sync.__bossV2AudioBridge)return;
    var original=sync.submitRaw;
    sync.submitRaw=function(entry,gameState,extras){
      var result=original(entry,gameState,extras);
      if(/^B[1-5]$/i.test(String(entry&&entry.sessionId||''))&&String(entry&&entry.skill||'').toLowerCase()==='speaking'&&file){sendAudio(file,entry.rawEvidenceId);file=null;}
      return result;
    };
    sync.__bossV2AudioBridge=true;
  }
  function install(){
    bridge();
    var note=document.getElementById('bossSpeakingNote'), finish=document.getElementById('bossFinishSpeak');
    if(!note||!finish||document.getElementById('bossV2AudioBox'))return;
    var box=document.createElement('div');
    box.id='bossV2AudioBox';
    box.style.cssText='margin:14px 0;padding:12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#102033';
    box.innerHTML='<label style="display:block;margin-bottom:10px;font-weight:700"><input type="checkbox" id="bossV2AudioConsent"> ยินยอมให้บันทึกเสียงสั้นเพื่อการประเมินรายวิชา (ไม่บังคับ)</label><button type="button" class="btn ghost" id="bossV2Record">● บันทึกเสียง</button><span id="bossV2AudioState" style="margin-left:8px;font-size:12px;color:#52657a">ยังไม่ได้บันทึกเสียง</span><div style="margin-top:8px;font-size:12px;color:#52657a">อัดได้สูงสุด 45 วินาที และแนบกับหลักฐาน Boss Speaking เท่านั้น</div>';
    note.insertAdjacentElement('afterend',box);
    var consent=box.querySelector('#bossV2AudioConsent'), button=box.querySelector('#bossV2Record'), status=box.querySelector('#bossV2AudioState');
    button.addEventListener('click',async function(){
      if(!consent.checked){status.textContent='กรุณาติ๊กยินยอมก่อนบันทึกเสียง';return;}
      if(media&&media.state==='recording'){media.stop();return;}
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];media=new MediaRecorder(stream);
        media.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
        media.onstop=function(){file=new Blob(chunks,{type:media.mimeType||'audio/webm'});if(stream)stream.getTracks().forEach(function(track){track.stop();});button.textContent='● บันทึกเสียงใหม่';status.textContent='บันทึกเสียงแล้ว พร้อมแนบตอนกด Save speaking';};
        media.start();button.textContent='■ หยุดบันทึก';status.textContent='กำลังบันทึก…';
        setTimeout(function(){if(media&&media.state==='recording')media.stop();},45000);
      }catch(_){status.textContent='ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาต Microphone ในเบราว์เซอร์';}
    });
  }
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
  var timer=setInterval(function(){bridge();install();if(window.EAPEvidenceSyncV130||window.EAPEvidenceSyncV129)clearInterval(timer);},140);
})();
