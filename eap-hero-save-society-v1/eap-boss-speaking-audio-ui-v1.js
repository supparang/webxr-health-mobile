/* =========================================================
   EAP Boss Speaking Audio UI v2
   - Optional, consent-based audio for B1–B5 only.
   - Supports the current Boss Four-Skill Gate IDs:
       #bossSpeakingNote / #bossFinishSpeak
   - Adds consentAudio to the same Boss Speaking evidence payload.
   - Audio is supplementary only; it never changes automatic score,
     grammar, pronunciation, or pass status.
========================================================= */
(function () {
  'use strict';

  var WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var SUBMISSION_KIND = 'fresh_evidence_v118';
  var STORE = 'EAP_HERO_PROGRESS_V3';

  var recorder = null;
  var stream = null;
  var chunks = [];
  var recordedFile = null;
  var recordedConsent = false;
  var patched = false;

  function state() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); }
    catch (_) { return { profile: {} }; }
  }

  function person() {
    var p = state().profile || state().player || {};
    return {
      studentId: String(p.studentId || p.id || 'guest'),
      studentName: String(p.studentName || p.name || 'Guest'),
      section: String(p.section || '122')
    };
  }

  function isBossSpeaking(entry) {
    return /^(B[1-5]|BG[1-5])$/i.test(String((entry && entry.sessionId) || '')) &&
      String((entry && entry.skill) || '').toLowerCase() === 'speaking';
  }

  function postAudio(file, evidenceId, consent) {
    if (!file || !evidenceId || !consent) return;

    var p = person();
    var reader = new FileReader();

    reader.onload = function () {
      var base64 = String(reader.result || '').split(',')[1] || '';
      try {
        fetch(WEB_APP_URL, {
          method: 'POST',
          mode: 'no-cors',
          keepalive: true,
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({
            action: 'submit_speaking_audio',
            submissionKind: SUBMISSION_KIND,
            evidenceId: evidenceId,
            section: p.section,
            studentId: p.studentId,
            studentName: p.studentName,
            consentAudio: true,
            mimeType: file.type || 'audio/webm',
            fileName: 'EAP-Boss-' + p.studentId + '-' + evidenceId + '.webm',
            audioBase64: base64
          })
        }).catch(function () {});
      } catch (_) {}
    };

    reader.readAsDataURL(file);
  }

  function patchEvidenceBridge() {
    var sync = window.EAPEvidenceSyncV130 || window.EAPEvidenceSyncV129;
    if (!sync || patched || typeof sync.submitRaw !== 'function') return false;

    window.EAPEvidenceSyncV129 = sync;
    var original = sync.submitRaw;

    sync.submitRaw = function (entry, gameState, extras) {
      extras = Object.assign({}, extras || {});

      if (isBossSpeaking(entry)) {
        extras.consentAudio = !!recordedConsent;
      }

      var result = original.call(this, entry, gameState, extras);

      if (isBossSpeaking(entry) && recordedFile && recordedConsent && entry && entry.rawEvidenceId) {
        postAudio(recordedFile, entry.rawEvidenceId, true);
        recordedFile = null;
        recordedConsent = false;
      }

      return result;
    };

    sync.__bossAudioBridgeV2 = true;
    patched = true;
    return true;
  }

  function stopTracks() {
    try {
      if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    } catch (_) {}
    stream = null;
  }

  function inject() {
    patchEvidenceBridge();

    var finish = document.getElementById('bossFinishSpeak');
    var note = document.getElementById('bossSpeakingNote');

    if (!finish || !note || document.getElementById('bossAudioControls')) return;

    var box = document.createElement('section');
    box.id = 'bossAudioControls';
    box.style.cssText = 'margin:14px 0;padding:13px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#102033';
    box.innerHTML = '' +
      '<label style="display:block;margin-bottom:10px;font-weight:800">' +
        '<input type="checkbox" id="bossAudioConsent"> ' +
        'ยินยอมให้บันทึกเสียงสั้นเพื่อให้ครูตรวจ Boss Speaking (ไม่บังคับ)' +
      '</label>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<button type="button" class="btn ghost" id="bossRecordAudio">● เริ่มบันทึกเสียง</button>' +
        '<span id="bossAudioStatus" style="font-size:12px;color:#52657a">ไม่บันทึกเสียงก็ส่งหลักฐานได้</span>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:12px;color:#52657a">สูงสุด 45 วินาที · ใช้เฉพาะครูตรวจ Boss Speaking · ไม่ใช้ตัดสิน pronunciation หรือ grammar อัตโนมัติ</div>';

    note.insertAdjacentElement('afterend', box);

    var consent = document.getElementById('bossAudioConsent');
    var button = document.getElementById('bossRecordAudio');
    var status = document.getElementById('bossAudioStatus');

    button.addEventListener('click', function () {
      if (!consent.checked) {
        status.textContent = 'กรุณาติ๊กยินยอมก่อนเริ่มบันทึกเสียง';
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
        status.textContent = 'อุปกรณ์นี้ไม่รองรับการบันทึกเสียง แต่ยังส่ง speaking note ได้ตามปกติ';
        return;
      }

      if (recorder && recorder.state === 'recording') {
        recorder.stop();
        return;
      }

      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (mediaStream) {
          stream = mediaStream;
          chunks = [];
          recorder = new MediaRecorder(stream);

          recorder.ondataavailable = function (event) {
            if (event.data && event.data.size) chunks.push(event.data);
          };

          recorder.onstop = function () {
            var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            recordedFile = new File([blob], 'boss-speaking-evidence.webm', { type: blob.type || 'audio/webm' });
            recordedConsent = !!consent.checked;
            stopTracks();
            button.textContent = '● บันทึกเสียงใหม่';
            status.textContent = 'บันทึกเสียงแล้ว และจะส่งพร้อมหลักฐานเมื่อกด Save speaking';
          };

          recorder.start();
          button.textContent = '■ หยุดบันทึก';
          status.textContent = 'กำลังบันทึกเสียง…';

          setTimeout(function () {
            if (recorder && recorder.state === 'recording') recorder.stop();
          }, 45000);
        })
        .catch(function () {
          status.textContent = 'ไม่สามารถใช้ไมโครโฟนได้ กรุณาอนุญาต Microphone หรือส่ง speaking note โดยไม่อัดเสียง';
        });
    });
  }

  var observer = new MutationObserver(inject);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  var wait = setInterval(function () {
    patchEvidenceBridge();
    inject();
    if (patched) clearInterval(wait);
  }, 120);
})();
