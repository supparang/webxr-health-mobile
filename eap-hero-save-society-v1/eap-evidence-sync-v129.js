/* =========================================================
   EAP Hero Evidence Sync v129
   - Sends raw evidence before portfolio compaction
   - Speaking: teacher-review note required
   - Optional 30–45 sec audio recording, opt-in only
========================================================= */
(function(){
  'use strict';

  const WEB_APP_URL =
    'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const SUBMISSION_KIND = 'fresh_evidence_v118';
  const SENT_KEY = 'EAP_HERO_RAW_EVIDENCE_SENT_V129';

  const safeText = (v, limit) => String(v == null ? '' : v)
    .replace(/\s+/g, ' ').trim().slice(0, limit || 7000);

  const asNumber = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

  function sentMap(){
    try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); }
    catch(e){ return {}; }
  }

  function saveSent(v){
    try { localStorage.setItem(SENT_KEY, JSON.stringify(v)); } catch(e){}
  }

  function profileFrom(state){
    const p = (state && state.profile) || {};
    return {
      studentId: safeText(p.studentId || p.id || 'guest', 80),
      studentName: safeText(p.name || p.studentName || 'Guest', 160),
      section: safeText(p.section || '122', 40)
    };
  }

  function makeEvidenceId(entry, state){
    const p = profileFrom(state);
    return safeText(
      entry.rawEvidenceId ||
      ('raw-' + p.studentId + '-' +
       safeText(entry.sessionId || entry.session, 40) + '-' +
       safeText(entry.skill, 80).replace(/[^a-z0-9_-]/gi,'') + '-' +
       Date.now()),
      220
    );
  }

  function postJson(payload){
    try{
      fetch(WEB_APP_URL, {
        method:'POST',
        mode:'no-cors',
        keepalive:true,
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body: JSON.stringify(payload)
      }).catch(()=>{});
      return true;
    }catch(e){ return false; }
  }

  function payloadFrom(entry, state, extras){
    const person = profileFrom(state);
    const evidenceId = (extras && extras.evidenceId) || makeEvidenceId(entry, state);
    const score = asNumber(entry.score, 0);
    return {
      action:'submit_evidence',
      submissionKind:SUBMISSION_KIND,
      evidenceId:evidenceId,
      section:person.section,
      studentId:person.studentId,
      studentName:person.studentName,
      sessionId:safeText(entry.sessionId || entry.session || '', 40),
      sessionTitle:safeText(entry.sessionTitle || '', 240),
      skill:safeText(entry.skill || '', 80),
      evidenceType:safeText(entry.evidenceType || 'skill_evidence', 120),
      taskId:safeText(entry.taskId || entry.abilityTaskId || '', 160),
      score:score,
      passed:score >= 60,
      prompt:safeText(entry.prompt || entry.instruction || entry.passage || entry.question || entry.sourceText || '', 6500),
      output:safeText((extras && extras.output) || entry.output || entry.answer || entry.studentAnswer || entry.transcript || entry.response || '', 9000),
      durationSec:asNumber(entry.durationSec || entry.speakingSeconds, 0),
      targetRange:safeText(entry.targetRange || '', 160),
      teacherReviewRequired:!!entry.teacherReviewRequired,
      teacherReviewStatus:safeText((extras && extras.teacherReviewStatus) || entry.teacherReviewStatus || '', 120),
      oralChecklist:entry.oralChecklist || {},
      misconceptionTags:Array.isArray(entry.misconceptionTags) ? entry.misconceptionTags : [],
      boss:entry.boss || {},
      attemptCount:asNumber(entry.attemptNo || entry.attemptCount, 1),
      occurredAt:safeText(entry.at || new Date().toISOString(), 80),
      sourceUrl:location.href,
      consentAudio: !!(extras && extras.consentAudio)
    };
  }

  function submitRaw(entry, state, extras){
    if(!entry || !state) return false;
    const payload = payloadFrom(entry, state, extras || {});
    const sent = sentMap();
    if(sent[payload.evidenceId]) return true;
    const ok = postJson(payload);
    if(ok){ sent[payload.evidenceId] = Date.now(); saveSent(sent); }
    return ok;
  }

  function fileToBase64(file){
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function sendAudio(file, evidenceId, state){
    if(!file || !evidenceId) return;
    const person = profileFrom(state);
    fileToBase64(file).then(base64=>{
      postJson({
        action:'submit_speaking_audio',
        submissionKind:SUBMISSION_KIND,
        evidenceId:evidenceId,
        section:person.section,
        studentId:person.studentId,
        studentName:person.studentName,
        mimeType:file.type || 'audio/webm',
        fileName:'EAP-' + person.studentId + '-' + evidenceId + '.webm',
        audioBase64:base64
      });
    }).catch(()=>{});
  }

  function injectStyle(){
    if(document.getElementById('eap-speaking-evidence-style')) return;
    const s=document.createElement('style');
    s.id='eap-speaking-evidence-style';
    s.textContent=`
      .eap-evidence-mask{position:fixed;z-index:999999;inset:0;background:rgba(7,20,37,.68);display:flex;align-items:center;justify-content:center;padding:16px}
      .eap-evidence-card{width:min(620px,100%);background:#fff;border-radius:20px;padding:22px;color:#102033;box-shadow:0 20px 70px rgba(0,0,0,.28)}
      .eap-evidence-card h2{margin:0 0 8px;font-size:22px}.eap-evidence-card p{margin:0 0 12px;color:#52657a}
      .eap-evidence-card textarea{width:100%;min-height:110px;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font:inherit;resize:vertical}
      .eap-evidence-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}
      .eap-evidence-btn{border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;background:#17375e;color:#fff}
      .eap-evidence-btn.alt{background:#e7edf5;color:#102033}.eap-evidence-btn.recording{background:#b42318}
      .eap-evidence-status{font-size:12px;color:#52657a}.eap-evidence-note{font-size:12px;color:#6b7280}
    `;
    document.head.appendChild(s);
  }

  function captureSpeaking(entry, state){
    injectStyle();
    const evidenceId=makeEvidenceId(entry,state);
    const mask=document.createElement('div');
    mask.className='eap-evidence-mask';
    let recorder=null, stream=null, chunks=[], recordedFile=null;

    mask.innerHTML=`
      <section class="eap-evidence-card" role="dialog" aria-modal="true">
        <h2>🎤 หลักฐานคำพูดสำหรับครู</h2>
        <p>พิมพ์สรุปสิ่งที่พูด 1–2 ประโยค เพื่อให้ครูตรวจได้ง่ายขึ้น</p>
        <textarea id="eap-speaking-note" placeholder="เช่น Today, I explained … The source says … This is useful because …"></textarea>
        <div class="eap-evidence-row">
          <label><input id="eap-audio-consent" type="checkbox"> ยินยอมให้บันทึกเสียงสั้นเพื่อการประเมินรายวิชา</label>
        </div>
        <div class="eap-evidence-row">
          <button type="button" class="eap-evidence-btn alt" id="eap-record">● บันทึกเสียง (ไม่บังคับ)</button>
          <span class="eap-evidence-status" id="eap-record-status">ยังไม่ได้บันทึกเสียง</span>
        </div>
        <div class="eap-evidence-note">เสียงเป็นตัวเลือก เก็บเฉพาะเมื่อกดยินยอมและกดบันทึกเอง</div>
        <div class="eap-evidence-row" style="justify-content:flex-end">
          <button type="button" class="eap-evidence-btn alt" id="eap-skip">ข้ามหลักฐานคำพูด</button>
          <button type="button" class="eap-evidence-btn" id="eap-save">บันทึกหลักฐาน</button>
        </div>
      </section>`;
    document.body.appendChild(mask);

    const note=mask.querySelector('#eap-speaking-note');
    const consent=mask.querySelector('#eap-audio-consent');
    const recordBtn=mask.querySelector('#eap-record');
    const status=mask.querySelector('#eap-record-status');

    function cleanup(){
      if(recorder && recorder.state==='recording') recorder.stop();
      if(stream) stream.getTracks().forEach(t=>t.stop());
      mask.remove();
    }

    recordBtn.addEventListener('click', async ()=>{
      if(!consent.checked){
        status.textContent='กรุณาติ๊กยินยอมก่อนบันทึกเสียง';
        return;
      }
      if(recorder && recorder.state==='recording'){
        recorder.stop();
        return;
      }
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true});
        chunks=[];
        recorder=new MediaRecorder(stream);
        recorder.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop=()=>{
          const blob=new Blob(chunks,{type:recorder.mimeType || 'audio/webm'});
          recordedFile=new File([blob],'speaking-evidence.webm',{type:blob.type});
          status.textContent='บันทึกเสียงแล้ว';
          recordBtn.textContent='● บันทึกเสียงอีกครั้ง';
          recordBtn.classList.remove('recording');
          if(stream) stream.getTracks().forEach(t=>t.stop());
        };
        recorder.start();
        recordBtn.textContent='■ หยุดบันทึก';
        recordBtn.classList.add('recording');
        status.textContent='กำลังบันทึก…';
        setTimeout(()=>{ if(recorder && recorder.state==='recording') recorder.stop(); },45000);
      }catch(err){
        status.textContent='ไม่สามารถใช้ไมโครโฟนได้';
      }
    });

    mask.querySelector('#eap-skip').addEventListener('click', ()=>{
      submitRaw(entry,state,{evidenceId:evidenceId,output:'',teacherReviewStatus:'pending_note'});
      cleanup();
    });

    mask.querySelector('#eap-save').addEventListener('click', ()=>{
      const output=safeText(note.value,9000);
      const useAudio=consent.checked && !!recordedFile;
      submitRaw(entry,state,{
        evidenceId:evidenceId,
        output:output,
        teacherReviewStatus:output ? 'pending_teacher_review' : 'pending_note',
        consentAudio:useAudio
      });
      if(useAudio) sendAudio(recordedFile,evidenceId,state);
      cleanup();
    });
  }

  window.EAPEvidenceSyncV129={submitRaw, captureSpeaking};
})();