/* =========================================================
   EAP Boss Speaking Audio UI v1
   Adds optional consent-based audio recording to Boss Speaking.
   Works with eap-evidence-sync-v130.js and Boss Four-Skill Gate v1.
========================================================= */
(() => {
  'use strict';

  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  const SUBMISSION_KIND = 'fresh_evidence_v118';
  const STORE = 'EAP_HERO_PROGRESS_V3';

  let recorder = null;
  let stream = null;
  let chunks = [];
  let recordedFile = null;
  let installed = false;

  function state() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch (error) { return { profile: {} }; }
  }

  function person() {
    const p = state().profile || {};
    return {
      studentId: String(p.studentId || p.id || 'guest'),
      studentName: String(p.name || p.studentName || 'Guest'),
      section: String(p.section || '122')
    };
  }

  function postAudio(file, evidenceId) {
    if (!file || !evidenceId) return;
    const p = person();
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || '').split(',')[1] || '';
      fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          action: 'submit_speaking_audio',
          submissionKind: SUBMISSION_KIND,
          evidenceId,
          section: p.section,
          studentId: p.studentId,
          studentName: p.studentName,
          mimeType: file.type || 'audio/webm',
          fileName: `EAP-Boss-${p.studentId}-${evidenceId}.webm`,
          audioBase64: base64
        })
      }).catch(() => {});
    };
    reader.readAsDataURL(file);
  }

  function attachEvidenceBridge() {
    const sync = window.EAPEvidenceSyncV130;
    if (!sync || sync.__bossAudioBridge) return;

    // Boss Four-Skill v1 still uses the legacy global name internally.
    window.EAPEvidenceSyncV129 = sync;

    const original = sync.submitRaw;
    sync.submitRaw = function(entry, gameState, extras) {
      const result = original(entry, gameState, extras);
      const isBossSpeaking = /^(B[1-5]|BG[1-5])$/i.test(String(entry?.sessionId || '')) &&
        String(entry?.skill || '').toLowerCase() === 'speaking';
      if (isBossSpeaking && recordedFile && entry?.rawEvidenceId) {
        postAudio(recordedFile, entry.rawEvidenceId);
        recordedFile = null;
      }
      return result;
    };
    sync.__bossAudioBridge = true;
  }

  function inject() {
    attachEvidenceBridge();

    const finish = document.getElementById('finishSpeaking');
    const note = document.getElementById('speakingNote');
    if (!finish || !note || document.getElementById('bossAudioControls')) return;

    const box = document.createElement('div');
    box.id = 'bossAudioControls';
    box.style.cssText = 'margin:14px 0;padding:12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#102033';
    box.innerHTML = `
      <label style="display:block;margin-bottom:10px;font-weight:700">
        <input type="checkbox" id="bossAudioConsent">
        ยินยอมให้บันทึกเสียงสั้นเพื่อการประเมินรายวิชา (ไม่บังคับ)
      </label>
      <button type="button" class="btn ghost" id="bossRecordAudio">● บันทึกเสียง</button>
      <span id="bossAudioStatus" style="margin-left:8px;font-size:12px;color:#52657a">ยังไม่ได้บันทึกเสียง</span>
      <div style="margin-top:8px;font-size:12px;color:#52657a">อัดได้สูงสุด 45 วินาที และจะผูกกับหลักฐาน Boss Speaking รายการนี้</div>
    `;
    note.insertAdjacentElement('afterend', box);

    const consent = box.querySelector('#bossAudioConsent');
    const button = box.querySelector('#bossRecordAudio');
    const status = box.querySelector('#bossAudioStatus');

    button.addEventListener('click', async () => {
      if (!consent.checked) {
        status.textContent = 'กรุณาติ๊กยินยอมก่อนบันทึกเสียง';
        return;
      }
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size) chunks.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          recordedFile = new File([blob], 'boss-speaking-evidence.webm', { type: blob.type });
          stream?.getTracks().forEach(track => track.stop());
          button.textContent = '● บันทึกเสียงใหม่';
          status.textContent = 'บันทึกเสียงแล้ว พร้อมแนบตอนกด Save speaking';
        };
        recorder.start();
        button.textContent = '■ หยุดบันทึก';
        status.textContent = 'กำลังบันทึก…';
        setTimeout(() => {
          if (recorder && recorder.state === 'recording') recorder.stop();
        }, 45000);
      } catch (error) {
        status.textContent = 'ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาต Microphone ในเบราว์เซอร์';
      }
    });
  }

  const observer = new MutationObserver(inject);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const wait = setInterval(() => {
    attachEvidenceBridge();
    inject();
    if (window.EAPEvidenceSyncV130) clearInterval(wait);
  }, 120);
})();