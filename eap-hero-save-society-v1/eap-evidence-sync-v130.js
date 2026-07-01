/* =========================================================
   EAP Hero Evidence Sync v130
   - Normal Speaking: required typed note, no teacher review
   - Boss Gate Speaking: typed note + optional audio + teacher review
========================================================= */
(function(){
  'use strict';

  const WEB_APP_URL =
    'https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';

  const SUBMISSION_KIND = 'fresh_evidence_v118';
  const SENT_KEY = 'EAP_HERO_RAW_EVIDENCE_SENT_V130';

  const safeText = (v, limit) => String(v == null ? '' : v)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit || 7000);

  const asNumber = (v, fallback = 0) =>
    Number.isFinite(Number(v))
      ? Number(v)
      : fallback;

  function sentMap(){
    try {
      return JSON.parse(
        localStorage.getItem(SENT_KEY) || '{}'
      );
    } catch(error) {
      return {};
    }
  }

  function saveSent(value){
    try {
      localStorage.setItem(
        SENT_KEY,
        JSON.stringify(value)
      );
    } catch(error) {}
  }

  function profileFrom(state){
    const profile = (state && state.profile) || {};

    return {
      studentId: safeText(
        profile.studentId || profile.id || 'guest',
        80
      ),

      studentName: safeText(
        profile.name || profile.studentName || 'Guest',
        160
      ),

      section: safeText(
        profile.section || '122',
        40
      )
    };
  }

  function normalizedSession(entry){
    return safeText(
      entry && (entry.sessionId || entry.session || ''),
      40
    ).toUpperCase();
  }

  function isBossSession(entry){
    return /^(B[1-5]|BG[1-5])$/.test(
      normalizedSession(entry)
    );
  }

  function isSpeaking(entry){
    return safeText(
      entry && entry.skill,
      80
    ).toLowerCase() === 'speaking';
  }

  function requiresTeacherReview(entry){
    return isBossSession(entry) && isSpeaking(entry);
  }

  function makeEvidenceId(entry, state){
    const profile = profileFrom(state);

    return safeText(
      entry.rawEvidenceId ||
      (
        'raw-' +
        profile.studentId + '-' +
        normalizedSession(entry) + '-' +
        safeText(entry.skill, 80)
          .replace(/[^a-z0-9_-]/gi, '') +
        '-' +
        Date.now()
      ),
      220
    );
  }

  function postJson(payload){
    try {
      fetch(WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8'
        },
        body: JSON.stringify(payload)
      }).catch(() => {});

      return true;
    } catch(error) {
      return false;
    }
  }

  function payloadFrom(entry, state, extras){
    const person = profileFrom(state);
    const evidenceId =
      (extras && extras.evidenceId) ||
      makeEvidenceId(entry, state);

    const score = asNumber(entry.score, 0);
    const bossReview = requiresTeacherReview(entry);

    return {
      action: 'submit_evidence',
      submissionKind: SUBMISSION_KIND,
      evidenceId: evidenceId,

      section: person.section,
      studentId: person.studentId,
      studentName: person.studentName,

      sessionId: normalizedSession(entry),
      sessionTitle: safeText(entry.sessionTitle || '', 240),
      skill: safeText(entry.skill || '', 80),

      evidenceType: safeText(
        entry.evidenceType || 'skill_evidence',
        120
      ),

      taskId: safeText(
        entry.taskId || entry.abilityTaskId || '',
        160
      ),

      score: score,
      passed: score >= 60,

      prompt: safeText(
        entry.prompt ||
        entry.instruction ||
        entry.passage ||
        entry.question ||
        entry.sourceText ||
        '',
        6500
      ),

      output: safeText(
        (extras && extras.output) ||
        entry.output ||
        entry.answer ||
        entry.studentAnswer ||
        entry.transcript ||
        entry.response ||
        '',
        9000
      ),

      durationSec: asNumber(
        entry.durationSec || entry.speakingSeconds,
        0
      ),

      targetRange: safeText(
        entry.targetRange || '',
        160
      ),

      /*
       * Teacher review only for B1–B5 / BG Speaking.
       */
      teacherReviewRequired: bossReview,

      teacherReviewStatus: bossReview
        ? safeText(
            (extras && extras.teacherReviewStatus) ||
            'pending_teacher_review',
            120
          )
        : '',

      oralChecklist: entry.oralChecklist || {},

      misconceptionTags: Array.isArray(
        entry.misconceptionTags
      )
        ? entry.misconceptionTags
        : [],

      boss: entry.boss || {},

      attemptCount: asNumber(
        entry.attemptNo || entry.attemptCount,
        1
      ),

      occurredAt: safeText(
        entry.at || new Date().toISOString(),
        80
      ),

      sourceUrl: location.href,

      consentAudio:
        bossReview &&
        !!(extras && extras.consentAudio)
    };
  }

  function submitRaw(entry, state, extras){
    if (!entry || !state) {
      return false;
    }

    const payload = payloadFrom(
      entry,
      state,
      extras || {}
    );

    const sent = sentMap();

    if (sent[payload.evidenceId]) {
      return true;
    }

    const ok = postJson(payload);

    if (ok) {
      sent[payload.evidenceId] = Date.now();
      saveSent(sent);
    }

    return ok;
  }

  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(
          String(reader.result || '')
            .split(',')[1] || ''
        );
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function sendAudio(file, evidenceId, state){
    if (!file || !evidenceId) {
      return;
    }

    const person = profileFrom(state);

    fileToBase64(file)
      .then(base64 => {
        postJson({
          action: 'submit_speaking_audio',
          submissionKind: SUBMISSION_KIND,
          evidenceId: evidenceId,

          section: person.section,
          studentId: person.studentId,
          studentName: person.studentName,

          mimeType: file.type || 'audio/webm',

          fileName:
            'EAP-' +
            person.studentId +
            '-' +
            evidenceId +
            '.webm',

          audioBase64: base64
        });
      })
      .catch(() => {});
  }

  function injectStyle(){
    if (
      document.getElementById(
        'eap-speaking-evidence-style'
      )
    ) {
      return;
    }

    const style = document.createElement('style');

    style.id = 'eap-speaking-evidence-style';

    style.textContent = `
      .eap-evidence-mask{
        position:fixed;
        z-index:999999;
        inset:0;
        background:rgba(7,20,37,.68);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:16px
      }

      .eap-evidence-card{
        width:min(620px,100%);
        background:#fff;
        border-radius:20px;
        padding:22px;
        color:#102033;
        box-shadow:0 20px 70px rgba(0,0,0,.28)
      }

      .eap-evidence-card h2{
        margin:0 0 8px;
        font-size:22px
      }

      .eap-evidence-card p{
        margin:0 0 12px;
        color:#52657a
      }

      .eap-evidence-card textarea{
        width:100%;
        min-height:110px;
        padding:12px;
        border:1px solid #cbd5e1;
        border-radius:12px;
        font:inherit;
        resize:vertical
      }

      .eap-evidence-row{
        display:flex;
        gap:10px;
        align-items:center;
        flex-wrap:wrap;
        margin:12px 0
      }

      .eap-evidence-btn{
        border:0;
        border-radius:10px;
        padding:10px 14px;
        font-weight:800;
        cursor:pointer;
        background:#17375e;
        color:#fff
      }

      .eap-evidence-btn.alt{
        background:#e7edf5;
        color:#102033
      }

      .eap-evidence-btn.recording{
        background:#b42318
      }

      .eap-evidence-status{
        font-size:12px;
        color:#52657a
      }

      .eap-evidence-note{
        font-size:12px;
        color:#6b7280
      }
    `;

    document.head.appendChild(style);
  }

  function captureSpeaking(entry, state){
    injectStyle();

    const evidenceId = makeEvidenceId(entry, state);
    const bossSpeaking = requiresTeacherReview(entry);

    const mask = document.createElement('div');
    mask.className = 'eap-evidence-mask';

    let recorder = null;
    let stream = null;
    let chunks = [];
    let recordedFile = null;

    const heading = bossSpeaking
      ? '🎤 หลักฐานพูด Boss Gate'
      : '🗣️ Speaking note';

    const intro = bossSpeaking
      ? 'พิมพ์สรุปสิ่งที่พูด 1–2 ประโยค และเลือกบันทึกเสียงได้หากยินยอม'
      : 'พิมพ์สรุปสิ่งที่พูด 1–2 ประโยค เพื่อยืนยันหลักฐานการฝึกของคุณ';

    const audioArea = bossSpeaking
      ? `
        <div class="eap-evidence-row">
          <label>
            <input id="eap-audio-consent" type="checkbox">
            ยินยอมให้บันทึกเสียงสั้นเพื่อการประเมินรายวิชา
          </label>
        </div>

        <div class="eap-evidence-row">
          <button
            type="button"
            class="eap-evidence-btn alt"
            id="eap-record"
          >
            ● บันทึกเสียง (ไม่บังคับ)
          </button>

          <span class="eap-evidence-status" id="eap-record-status">
            ยังไม่ได้บันทึกเสียง
          </span>
        </div>

        <div class="eap-evidence-note">
          เสียงเป็นตัวเลือก เก็บเฉพาะเมื่อยินยอมและกดบันทึกเอง
        </div>
      `
      : `
        <div class="eap-evidence-note">
          Note นี้ไม่ใช้คำนวณคะแนนเกม และไม่ต้องรอครูตรวจ
        </div>
      `;

    mask.innerHTML = `
      <section
        class="eap-evidence-card"
        role="dialog"
        aria-modal="true"
      >
        <h2>${heading}</h2>

        <p>${intro}</p>

        <textarea
          id="eap-speaking-note"
          placeholder="เช่น Today, I explained … The source says … This is useful because …"
        ></textarea>

        ${audioArea}

        <div
          class="eap-evidence-row"
          style="justify-content:flex-end"
        >
          <button
            type="button"
            class="eap-evidence-btn"
            id="eap-save"
          >
            บันทึกหลักฐาน
          </button>
        </div>
      </section>
    `;

    document.body.appendChild(mask);

    const note = mask.querySelector('#eap-speaking-note');
    const consent = mask.querySelector('#eap-audio-consent');
    const recordBtn = mask.querySelector('#eap-record');
    const status = mask.querySelector('#eap-record-status');

    function cleanup(){
      if (
        recorder &&
        recorder.state === 'recording'
      ) {
        recorder.stop();
      }

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      mask.remove();
    }

    if (bossSpeaking && recordBtn) {
      recordBtn.addEventListener('click', async () => {
        if (!consent.checked) {
          status.textContent =
            'กรุณาติ๊กยินยอมก่อนบันทึกเสียง';
          return;
        }

        if (
          recorder &&
          recorder.state === 'recording'
        ) {
          recorder.stop();
          return;
        }

        try {
          stream = await navigator.mediaDevices
            .getUserMedia({ audio: true });

          chunks = [];

          recorder = new MediaRecorder(stream);

          recorder.ondataavailable = event => {
            if (event.data && event.data.size) {
              chunks.push(event.data);
            }
          };

          recorder.onstop = () => {
            const blob = new Blob(chunks, {
              type: recorder.mimeType || 'audio/webm'
            });

            recordedFile = new File(
              [blob],
              'speaking-evidence.webm',
              { type: blob.type }
            );

            status.textContent = 'บันทึกเสียงแล้ว';
            recordBtn.textContent = '● บันทึกเสียงอีกครั้ง';
            recordBtn.classList.remove('recording');

            if (stream) {
              stream.getTracks().forEach(
                track => track.stop()
              );
            }
          };

          recorder.start();

          recordBtn.textContent = '■ หยุดบันทึก';
          recordBtn.classList.add('recording');
          status.textContent = 'กำลังบันทึก…';

          setTimeout(() => {
            if (
              recorder &&
              recorder.state === 'recording'
            ) {
              recorder.stop();
            }
          }, 45000);

        } catch(error) {
          status.textContent =
            'ไม่สามารถใช้ไมโครโฟนได้';
        }
      });
    }

    mask.querySelector('#eap-save')
      .addEventListener('click', () => {
        const output = safeText(note.value, 9000);

        if (output.length < 8) {
          alert(
            'กรุณาพิมพ์ speaking note อย่างน้อย 1 ประโยคก่อนบันทึก'
          );

          note.focus();
          return;
        }

        const useAudio =
          bossSpeaking &&
          consent &&
          consent.checked &&
          !!recordedFile;

        submitRaw(entry, state, {
          evidenceId: evidenceId,
          output: output,

          teacherReviewStatus: bossSpeaking
            ? 'pending_teacher_review'
            : '',

          consentAudio: useAudio
        });

        if (useAudio) {
          sendAudio(
            recordedFile,
            evidenceId,
            state
          );
        }

        cleanup();
      });
  }

  window.EAPEvidenceSyncV130 = {
    submitRaw,
    captureSpeaking,
    isBossSession,
    requiresTeacherReview
  };
})();
