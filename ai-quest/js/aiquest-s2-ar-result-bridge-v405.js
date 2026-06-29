/* =========================================================
   CSAI2102 AI Quest — S2 AR Result Bridge v4.0.5
   Mirrors the known-working S1 AR event pipeline for Agent Builder.

   Guarantees:
   - S2 AR remains supplementary and never changes Session 2 score/gate.
   - Completed local S2 AR evidence is queued as `s2_ar_complete`.
   - Uses a new recovery receipt V405 for historical results.
   - Suppresses the retired runtime sender (V403) for the same run to
     avoid duplicate events while migration completes.
========================================================= */
(() => {
  'use strict';

  const VERSION = 'v4.0.5-s2-ar-mirror-s1-event-sync';
  const RESULT_KEYS = [
    'AIQUEST_S2_AR_RESULT_V387',
    'AIQUEST_S2_AR_RESULT_V386',
    'AIQUEST_S2_AR_PRACTICE_RESULT_V386'
  ];
  const EVENT_SYNC_KEY = 'AIQUEST_S2_AR_EVENT_SYNC_V405';
  const LEGACY_SYNC_KEY = 'AIQUEST_S2_AR_EVENT_SYNC_V403';
  const FALLBACK_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  let syncBusy = false;
  let lastVisualSignature = '';

  function readJson(key){
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  }
  function writeJson(key,value){
    try { localStorage.setItem(key,JSON.stringify(value || {})); }
    catch (_) {}
  }
  function getArResult(){
    const direct = window.AIQUEST_S2_AR_RESULT;
    if (direct?.arCompleted && (direct.sessionId === 's2' || direct.missionId === 'm2')) return direct;
    for (const key of RESULT_KEYS) {
      const item = readJson(key);
      if (item?.arCompleted && (item.sessionId === 's2' || item.missionId === 'm2')) return item;
    }
    return null;
  }
  function evidence(){
    const ar = getArResult();
    if (!ar?.arCompleted) return null;
    const total = Number(ar.total || 0);
    const correct = Number(ar.correct || 0);
    const score = Math.round(Number(ar.arScore ?? ar.accuracy ?? (total ? correct * 100 / total : 0)));
    return {
      activity:'S2 AR Practice: Agent Builder',
      supplementary:true,
      completed:true,
      score,
      accuracy:score,
      correct,
      total,
      helpUsed:Number(ar.helpUsed || 0),
      usedSec:Number(ar.usedSec || 0),
      inputMode:String(ar.inputMode || ar.arInputMode || 'hand_or_mouse_touch'),
      arVersion:String(ar.version || ''),
      completedAt:String(ar.finishedAt || new Date().toISOString())
    };
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
  function signature(ar){
    return [ar?.completedAt || '',ar?.score || 0,ar?.correct || 0,ar?.total || 0,ar?.helpUsed || 0].join('|');
  }
  function endpoint(){
    const config = window.AIQuestDataContract?.loadConfig?.() || {};
    return config.appsScriptUrl || FALLBACK_ENDPOINT;
  }
  function makeId(prefix){
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  }
  function payload(ar,profile){
    const trace = {
      activity:ar.activity,
      supplementary:true,
      completed:true,
      score:ar.score,
      accuracy:ar.accuracy,
      correct:ar.correct,
      total:ar.total,
      helpUsed:ar.helpUsed,
      usedSec:ar.usedSec,
      inputMode:ar.inputMode,
      arVersion:ar.arVersion,
      completedAt:ar.completedAt
    };
    const raw = {
      eventId:makeId('s2ar'),
      attemptId:`s2_ar_practice_${String(profile.studentId || 'anon')}_${Date.now()}`,
      studentId:String(profile.studentId || ''),
      section:String(profile.section || '101'),
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
      scoreDelta:Number(ar.score || 0),
      combo:Number(ar.correct || 0),
      helpLeft:Math.max(0,3-Number(ar.helpUsed || 0)),
      clientTs:ar.completedAt,
      extraJson:{eventKind:'s2_ar_practice',s2ArPractice:trace}
    };
    return window.AIQuestDataContract?.buildEvent
      ? window.AIQuestDataContract.buildEvent(raw,{attemptId:raw.attemptId,studentId:raw.studentId,sessionId:'s2',missionId:'m2'})
      : raw;
  }
  function suppressRetiredSender(sig,profile){
    const prior = readJson(LEGACY_SYNC_KEY) || {};
    if (prior.signature === sig && prior.status === 'queued') return;
    writeJson(LEGACY_SYNC_KEY,{
      signature:sig,
      status:'queued',
      owner:'s2-result-bridge-v405',
      studentId:String(profile?.studentId || ''),
      queuedAt:new Date().toISOString()
    });
  }
  function status(message,tone){
    const launcher = document.getElementById('aiquestArLauncherV401');
    if (!launcher || launcher.dataset.mode !== 's2') return;
    let box = document.getElementById('s2ArBridgeStatusV405');
    if (!box) {
      box = document.createElement('div');
      box.id = 's2ArBridgeStatusV405';
      box.style.cssText = 'margin-top:8px;padding:9px 11px;border-radius:13px;font-size:12px;font-weight:900;line-height:1.45';
      launcher.firstElementChild?.appendChild(box);
    }
    const good = tone === 'good';
    box.style.background = good ? 'rgba(16,185,129,.14)' : 'rgba(245,158,11,.14)';
    box.style.border = `1px solid ${good ? 'rgba(16,185,129,.32)' : 'rgba(245,158,11,.32)'}`;
    box.style.color = good ? '#bbf7d0' : '#fde68a';
    box.textContent = message;
  }
  function renderStatus(){
    const ar = evidence();
    if (!ar) return;
    const receipt = readJson(EVENT_SYNC_KEY) || {};
    const ok = receipt.signature === signature(ar) && receipt.status === 'queued';
    status(
      ok
        ? `✓ ส่งหลักฐาน S2 AR แล้ว: ${ar.correct}/${ar.total} • ${ar.score}% • รอ Teacher Dashboard Refresh`
        : `S2 AR ล่าสุด: ${ar.correct}/${ar.total} • ${ar.score}% • กำลังเตรียมส่งหลักฐาน`,
      ok ? 'good' : 'warn'
    );
  }
  async function sync(){
    const ar = evidence();
    if (!ar || syncBusy) return false;
    const sig = signature(ar);
    const receipt = readJson(EVENT_SYNC_KEY) || {};
    if (receipt.signature === sig && receipt.status === 'queued') return true;

    const profile = getProfile();
    if (!profile.studentId) {
      status('S2 AR พบผลในเครื่อง แต่ยังไม่พบ Student Profile สำหรับส่งข้อมูล','warn');
      return false;
    }
    const url = endpoint();
    if (!url) {
      status('S2 AR ไม่พบ Apps Script endpoint','warn');
      return false;
    }

    suppressRetiredSender(sig,profile);
    const event = payload(ar,profile);
    syncBusy = true;
    status('กำลังส่งหลักฐาน S2 AR…','warn');
    try {
      await fetch(url,{
        method:'POST',
        mode:'no-cors',
        cache:'no-store',
        keepalive:true,
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({action:'sync_v23',kind:'event',payload:event})
      });
      writeJson(EVENT_SYNC_KEY,{
        signature:sig,
        status:'queued',
        eventId:event.eventId,
        studentId:String(profile.studentId),
        queuedAt:new Date().toISOString()
      });
      status(`✓ ส่งหลักฐาน S2 AR แล้ว: ${ar.correct}/${ar.total} • ${ar.score}% • รอ Teacher Dashboard Refresh`,'good');
      window.dispatchEvent(new CustomEvent('aiquest:s2-ar-event-queued',{detail:{event,evidence:ar,bridge:VERSION}}));
      console.log('[AIQuest S2 AR Sync] queued s2_ar_complete event',event.eventId);
      return true;
    } catch (error) {
      console.warn('[AIQuest S2 AR Sync] event send failed',error);
      status('S2 AR ส่งไม่สำเร็จในขณะนี้ ระบบจะลองใหม่เมื่อเปิดหน้านี้อีกครั้ง','warn');
      return false;
    } finally {
      syncBusy = false;
    }
  }
  function installAttemptBridge(){
    const wrap = (owner,method) => {
      if (!owner || typeof owner[method] !== 'function' || owner[method].__s2ArBridgeV405) return;
      const original = owner[method];
      owner[method] = function(attempt,...rest){ return original.call(this,attempt,...rest); };
      owner[method].__s2ArBridgeV405 = true;
    };
    wrap(window.AIQuestSync,'submitAttempt');
    wrap(window.AIQuestCloudLogger,'sendAttempt');
  }
  function tick(){
    installAttemptBridge();
    const ar = evidence();
    const sig = ar ? signature(ar) : '';
    if (sig !== lastVisualSignature) {
      lastVisualSignature = sig;
      renderStatus();
    }
    if (ar) sync().then(ok => { if (ok) renderStatus(); });
  }
  function boot(){
    tick();
    setInterval(tick,850);
    window.addEventListener('aiquest:s2-ar-start',()=>{ lastVisualSignature=''; });
  }

  window.AIQUEST_S2_AR_RESULT_BRIDGE = Object.freeze({version:VERSION,sync,getResult:getArResult,evidence});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  console.log('[AIQuest] '+VERSION+' loaded');
})();
