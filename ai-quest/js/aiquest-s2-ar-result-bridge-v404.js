/* =========================================================
   CSAI2102 AI Quest — S2 AR Result Bridge v4.0.4
   Repairs historical S2 AR evidence that was completed locally
   before an s2_ar_complete event was added to the cloud pipeline.

   Uses an independent V404 receipt key so an earlier no-cors attempt
   cannot permanently suppress this recovery send.
========================================================= */
(() => {
  'use strict';

  const VERSION = 'v4.0.4-s2-ar-recovery-sync';
  const RESULT_KEY = 'AIQUEST_S2_AR_RESULT_V387';
  const RECEIPT_KEY = 'AIQUEST_S2_AR_EVENT_SYNC_V404';
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
  let busy = false;

  function readJson(key){
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  }
  function writeJson(key,value){
    try { localStorage.setItem(key,JSON.stringify(value || {})); }
    catch (_) {}
  }
  function getResult(){
    const direct = window.AIQUEST_S2_AR_RESULT;
    if (direct?.arCompleted && (direct.sessionId === 's2' || direct.missionId === 'm2')) return direct;
    const stored = readJson(RESULT_KEY);
    return stored?.arCompleted && (stored.sessionId === 's2' || stored.missionId === 'm2') ? stored : null;
  }
  function getProfile(){
    const direct = window.AIQuestStorage?.getProfile?.() || {};
    if (direct.studentId) return direct;
    try {
      for (let i=0;i<localStorage.length;i++) {
        const key = localStorage.key(i) || '';
        if (!/aiquest|profile|classroom/i.test(key)) continue;
        const item = JSON.parse(localStorage.getItem(key) || 'null');
        if (item?.studentId) return item;
      }
    } catch (_) {}
    return {};
  }
  function signature(result){
    return [
      result?.finishedAt || '', result?.correct || 0, result?.total || 0,
      result?.arScore ?? result?.accuracy ?? 0, result?.helpUsed || 0
    ].join('|');
  }
  function makeId(prefix){
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  }
  function endpoint(){
    const config = window.AIQuestDataContract?.loadConfig?.() || {};
    return config.appsScriptUrl || ENDPOINT;
  }
  function buildEvent(result,profile){
    const score = Math.round(Number(result.arScore ?? result.accuracy ?? 0));
    const trace = {
      activity:'S2 AR Practice: Agent Builder',
      supplementary:true,
      completed:true,
      score,
      accuracy:score,
      correct:Number(result.correct || 0),
      total:Number(result.total || 0),
      helpUsed:Number(result.helpUsed || 0),
      usedSec:Number(result.usedSec || 0),
      inputMode:String(result.inputMode || 'hand_or_mouse_touch'),
      arVersion:String(result.version || ''),
      completedAt:String(result.finishedAt || new Date().toISOString())
    };
    const raw = {
      eventId:makeId('s2ar'),
      attemptId:`s2_ar_practice_${String(profile.studentId || 'anon')}_${Date.now()}`,
      studentId:String(profile.studentId || ''),
      studentName:String(profile.studentName || profile.name || ''),
      section:String(profile.section || profile.classSection || '101'),
      sessionId:'s2',
      missionId:'m2',
      runMode:'practice',
      eventType:'s2_ar_complete',
      phase:'S2 AR Practice',
      itemId:'agent_builder',
      prompt:'S2 AR Practice: Agent Builder',
      yourAnswer:JSON.stringify(trace),
      correctAnswer:'completed',
      isCorrect:true,
      scoreDelta:score,
      combo:Number(trace.correct || 0),
      helpLeft:Math.max(0,3-Number(trace.helpUsed || 0)),
      clientTs:trace.completedAt,
      extraJson:{eventKind:'s2_ar_practice',s2ArPractice:trace}
    };
    return window.AIQuestDataContract?.buildEvent
      ? window.AIQuestDataContract.buildEvent(raw,{
          attemptId:raw.attemptId,
          studentId:raw.studentId,
          sessionId:'s2',
          missionId:'m2'
        })
      : raw;
  }
  function showStatus(message,ok){
    const launcher = document.getElementById('aiquestArLauncherV401');
    if (!launcher || launcher.dataset.mode !== 's2') return;
    let node = document.getElementById('s2ArRecoveryStatusV404');
    if (!node) {
      node = document.createElement('div');
      node.id = 's2ArRecoveryStatusV404';
      node.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:12px;font-size:12px;font-weight:900;line-height:1.4';
      launcher.firstElementChild?.appendChild(node);
    }
    node.style.background = ok ? 'rgba(16,185,129,.14)' : 'rgba(245,158,11,.14)';
    node.style.border = `1px solid ${ok ? 'rgba(16,185,129,.32)' : 'rgba(245,158,11,.32)'}`;
    node.style.color = ok ? '#bbf7d0' : '#fde68a';
    node.textContent = message;
  }
  async function sync(){
    const result = getResult();
    if (!result || busy) return false;
    const sig = signature(result);
    const receipt = readJson(RECEIPT_KEY) || {};
    if (receipt.signature === sig && receipt.status === 'dispatched') {
      showStatus(`✓ ส่งหลักฐาน S2 AR แล้ว: ${Number(result.correct||0)}/${Number(result.total||0)} • ${Math.round(Number(result.arScore ?? result.accuracy ?? 0))}%`,true);
      return true;
    }

    const profile = getProfile();
    if (!profile.studentId) {
      showStatus('S2 AR: พบผลในเครื่อง แต่ยังไม่พบ Student Profile สำหรับส่งข้อมูล',false);
      return false;
    }
    const url = endpoint();
    if (!url) {
      showStatus('S2 AR: ไม่พบ Apps Script endpoint',false);
      return false;
    }

    const event = buildEvent(result,profile);
    busy = true;
    showStatus('กำลังส่งหลักฐาน S2 AR ที่ค้างอยู่…',false);
    try {
      await fetch(url,{
        method:'POST',
        mode:'no-cors',
        cache:'no-store',
        keepalive:true,
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({action:'sync_v23',kind:'event',payload:event})
      });
      writeJson(RECEIPT_KEY,{
        signature:sig,
        status:'dispatched',
        eventId:event.eventId,
        studentId:String(profile.studentId),
        sentAt:new Date().toISOString()
      });
      showStatus(`✓ ส่งหลักฐาน S2 AR แล้ว: ${Number(result.correct||0)}/${Number(result.total||0)} • ${Math.round(Number(result.arScore ?? result.accuracy ?? 0))}%`,true);
      window.dispatchEvent(new CustomEvent('aiquest:s2-ar-event-queued',{detail:{event,result,recovery:true}}));
      console.log('[AIQuest S2 AR Recovery] dispatched',event.eventId);
      return true;
    } catch (error) {
      console.warn('[AIQuest S2 AR Recovery] send failed',error);
      showStatus('S2 AR: ส่งไม่สำเร็จในขณะนี้ ระบบจะลองใหม่เมื่อเปิดหน้าอีกครั้ง',false);
      return false;
    } finally {
      busy = false;
    }
  }
  function boot(){
    sync();
    setInterval(sync,1500);
  }

  window.AIQUEST_S2_AR_RESULT_BRIDGE = Object.freeze({version:VERSION,sync,getResult});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  console.log('[AIQuest] '+VERSION+' loaded');
})();
