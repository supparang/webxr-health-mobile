/* UX Quest • Reason Retry Transport v2
   Sends one separate learning-evidence event through the existing public,
   write-only receiver. It never modifies the mission-completed event.

   v2
   - Rejects empty, template, and system-status text before it reaches Sheets.
   - Keeps a clear invalid_response state so the UI can ask the learner to write
     their own explanation rather than saving a false reflection.
*/
(() => {
  'use strict';

  const queueKey = 'uxq.reason-retry.queue.v1';
  const id = () => `uxqreason-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  const get = () => { try { return JSON.parse(localStorage.getItem(queueKey) || '[]'); } catch (_) { return []; } };
  const put = items => { try { localStorage.setItem(queueKey, JSON.stringify((items || []).slice(-12))); } catch (_) {} };
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const profile = () => { try { return window.UXQIdentity?.get?.() || {}; } catch (_) { return {}; } };
  const complete = p => { try { return Boolean(window.UXQIdentity?.isComplete?.(p)); } catch (_) { return false; } };

  const blockedFragments = [
    'กำลังส่งคำขอผลลัพธ์',
    'ส่งคำขอผลลัพธ์ไปยัง student receiver',
    'ผู้สอนสามารถตรวจผลใน teacher dashboard',
    'หน้าผู้เรียนไม่อ่านคำตอบกลับจาก google sheets',
    'because the request uses no-cors',
    'เพราะการส่งใช้ no-cors',
    'reasoning pattern แข็งแรงแล้ว',
    'คุณไม่ได้เพียงเลือกคำตอบถูก'
  ];

  function cleanResponse(value){
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function validateResponse(value){
    const response = cleanResponse(value);
    const normalized = response.toLowerCase();

    if (response.length < 24) {
      return {
        ok:false,
        code:'too_short',
        message:'กรุณาอธิบายด้วยคำของตนเองอย่างน้อย 1–2 ประโยค ก่อนส่งให้ครูตรวจ'
      };
    }

    if (blockedFragments.some(fragment => normalized.includes(fragment.toLowerCase()))) {
      return {
        ok:false,
        code:'system_text',
        message:'ข้อความนี้เป็นข้อความระบบหรือข้อความตัวอย่าง กรุณาเขียนเหตุผลของตนเอง โดยเชื่อมพฤติกรรมผู้ใช้ จุดติดขัด และสิ่งที่ควรปรับหรือทดสอบ'
      };
    }

    return { ok:true, response };
  }

  function payload(record){
    const p = profile();
    const checked = validateResponse(record && record.response);

    if (!checked.ok) return null;

    return {
      app:'ux-quest', schema:'uxq.reason-retry.v2', eventType:'reason_retry_submitted', eventId:record.eventId || id(),
      attemptId:`reason_retry_${record.linkedAttemptId || id()}`,
      linkedAttemptId:String(record.linkedAttemptId || ''), occurredAt:record.occurredAt || new Date().toISOString(),
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok', pageUrl:String(location.href || '').slice(0,500),
      courseId:String(config().courseId || 'UXQ-ACT1').slice(0,120), courseLabel:String(config().courseLabel || 'UX Quest').slice(0,160),
      studentId:String(p.studentId || '').slice(0,80), studentName:String(p.studentName || '').slice(0,120), section:String(p.section || '').slice(0,80),
      missionId:String(record.missionId || '').slice(0,24), missionTitle:String(record.missionTitle || '').slice(0,180),
      reasonRetry:{ response:checked.response.slice(0,420), verifiedAccuracy:Number(record.verifiedAccuracy || 0), focus:Array.isArray(record.focus) ? record.focus : [], submittedAt:record.occurredAt || new Date().toISOString() }
    };
  }

  function post(item){
    const endpoint = String(config().receiverUrl || '').trim();
    if (!endpoint) return Promise.resolve({ state:'local_only' });
    if (!complete(profile())) return Promise.resolve({ state:'profile_incomplete' });

    return fetch(endpoint,{ method:'POST', mode:'no-cors', cache:'no-store', keepalive:true, headers:{'Content-Type':'text/plain;charset=UTF-8'}, body:JSON.stringify(item) })
      .then(() => ({ state:'dispatched_unverified' }))
      .catch(() => ({ state:'queued' }));
  }

  function submit(record){
    const checked = validateResponse(record && record.response);
    if (!checked.ok) return Promise.resolve({ state:'invalid_response', code:checked.code, message:checked.message });

    const normalizedRecord = Object.assign({}, record, { response:checked.response });
    const item = payload(normalizedRecord);
    normalizedRecord.eventId = item.eventId;

    return post(item).then(outcome => {
      if (outcome.state === 'queued') {
        const queue = get();
        if (!queue.some(x => x.eventId === item.eventId)) queue.push(item);
        put(queue);
      }
      return outcome;
    });
  }

  function flush(){
    const queue = get();
    if (!queue.length) return;
    put([]);
    queue.forEach(item => post(item).then(outcome => {
      if (outcome.state !== 'dispatched_unverified') {
        const pending = get();
        pending.push(item);
        put(pending);
      }
    }));
  }

  window.addEventListener('online', flush);
  window.addEventListener('pageshow', flush);
  window.UXQReasonRetryTransport = Object.freeze({ submit, flush, validateResponse });
})();