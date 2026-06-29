/* UX Quest • Reason Retry Transport v1
   Sends one separate learning-evidence event through the existing public,
   write-only receiver. It never modifies the mission-completed event.
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

  function payload(record){
    const p = profile();
    return {
      app:'ux-quest', schema:'uxq.reason-retry.v1', eventType:'reason_retry_submitted', eventId:record.eventId || id(),
      attemptId:`reason_retry_${record.linkedAttemptId || id()}`,
      linkedAttemptId:String(record.linkedAttemptId || ''), occurredAt:record.occurredAt || new Date().toISOString(),
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok', pageUrl:String(location.href || '').slice(0,500),
      courseId:String(config().courseId || 'UXQ-ACT1').slice(0,120), courseLabel:String(config().courseLabel || 'UX Quest').slice(0,160),
      studentId:String(p.studentId || '').slice(0,80), studentName:String(p.studentName || '').slice(0,120), section:String(p.section || '').slice(0,80),
      missionId:String(record.missionId || '').slice(0,24), missionTitle:String(record.missionTitle || '').slice(0,180),
      reasonRetry:{ response:String(record.response || '').slice(0,420), verifiedAccuracy:Number(record.verifiedAccuracy || 0), focus:Array.isArray(record.focus) ? record.focus : [], submittedAt:record.occurredAt || new Date().toISOString() }
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
    const item = payload(record);
    record.eventId = item.eventId;
    return post(item).then(outcome => {
      if (outcome.state === 'queued') { const queue = get(); if (!queue.some(x => x.eventId === item.eventId)) queue.push(item); put(queue); }
      return outcome;
    });
  }

  function flush(){
    const queue = get(); if (!queue.length) return;
    put([]); queue.forEach(item => post(item).then(outcome => { if (outcome.state !== 'dispatched_unverified') { const pending = get(); pending.push(item); put(pending); } }));
  }
  window.addEventListener('online', flush); window.addEventListener('pageshow', flush);
  window.UXQReasonRetryTransport = Object.freeze({ submit, flush });
})();
