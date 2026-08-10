(()=>{
'use strict';
const VERSION='2026-08-10-LCA47-FINAL-VOICE-DIRECT-EXIT-V4-DURATION-FALLBACK';
const q=new URLSearchParams(location.search);
const PROD=q.get('from')==='passport'&&q.get('authority')==='firebase'&&q.get('qa')!=='1'&&q.get('submit')!=='0';
const pageStartedAt=Date.now();
let locked=false,timer=0;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const delay=ms=>new Promise((_,reject)=>setTimeout(()=>reject(new Error('TIMEOUT_'+ms)),ms));
function api(){return window.LEXICON_CHAMPION_V47||null}
function liveScore(){const mic=$('mic'),heard=$('heard');if(!mic||!heard)return 0;const m=String(heard.textContent||'').match(/(\d{1,3})\s*%/);return m?clamp(Number(m[1]),0,100):0}
function mastery(st,voice){const firstTryRate=Number(st?.firstTryWins||0)/Math.max(1,Number(st?.firstTryTotal||4));return clamp(Math.round(60+firstTryRate*15+Number(voice||0)*.20+(st?.fallback?0:5)),0,100)}
function overlay(text){let el=$('lcaDirectExit');if(!el){el=document.createElement('div');el.id='lcaDirectExit';el.style.cssText='position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(10,5,28,.82);color:#fff;font:800 18px system-ui;text-align:center;padding:24px';document.body.appendChild(el)}el.innerHTML=`<div style="max-width:420px;padding:24px;border:1px solid #7f6be8;border-radius:18px;background:#20154a">${text}</div>`}
function passportUrl(receipt,reconciled=false){const p=new URLSearchParams({resume:'passport',fromGame:'final_boss',v:'20260810-final-voice-direct-exit4'});if(receipt)p.set('receipt',receipt);if(reconciled)p.set('reconcile','1');if(q.get('view')==='mobile')p.set('view','mobile');return './index.html?'+p.toString()}
function stopRuntime(){try{window.__LCA_VOICE_RECOGNITION_CONTRACT__?.stopAll?.()}catch(_){}try{speechSynthesis?.cancel()}catch(_){}try{const st=api()?.state;if(st){st.micBusy=false;st.looping=false;st.poseDone?.();st.stream?.getTracks?.().forEach(t=>t.stop())}}catch(_){}}
function installSubmitDeduper(){const base=window.EW_AUTHORITY;if(!base||base.__lcaFinalBossSubmitDeduper)return;let finalPromise=null;const wrapped=Object.freeze({...base,__lcaFinalBossSubmitDeduper:true,submitGame:async payload=>{if(payload?.stageId!=='final_boss')return base.submitGame(payload);if(finalPromise)return finalPromise;finalPromise=Promise.resolve().then(()=>base.submitGame(payload)).finally(()=>setTimeout(()=>{finalPromise=null},3000));return finalPromise}});window.EW_AUTHORITY=wrapped}
installSubmitDeduper();
async function resumeConfirmed(playerId,nickname){
  if(!window.EW_AUTHORITY?.resume)return null;
  overlay('⏳ กำลังตรวจสอบผลจาก Firebase…');
  try{
    const r=await Promise.race([window.EW_AUTHORITY.resume(playerId,nickname),delay(6000)]);
    const progress=r?.authority?.progress||r?.progress||{};
    const passed=Array.isArray(progress.passed)&&progress.passed.includes('final_boss');
    return passed?{ok:true,progress}:null;
  }catch(_){return null}
}
async function complete(score){
  if(locked)return;locked=true;clearInterval(timer);
  const A=api(),st=A?.state||{};
  st.voiceScore=Math.max(Number(st.voiceScore||0),score);st.bossAttack=3;st.mastery=mastery(st,st.voiceScore);st.micBusy=false;
  stopRuntime();
  overlay(`✅ Voice ${st.voiceScore}% ผ่านแล้ว<br><small>กำลังบันทึก Firebase…</small>`);
  const playerId=A?.PID||q.get('pid')||q.get('playerId')||'';
  const nickname=q.get('nickname')||'Player';
  try{
    if(!PROD){location.replace(passportUrl('qa-complete'));return}
    installSubmitDeduper();
    if(!window.EW_AUTHORITY?.submitGame)throw new Error('FIREBASE_AUTHORITY_NOT_READY');
    const evidence=A?.getReceipt?.()||{};
    const evidenceDuration=Number(evidence.durationMs||0);
    const elapsedDuration=Math.max(1000,Date.now()-pageStartedAt);
    const durationMs=Number.isFinite(evidenceDuration)&&evidenceDuration>0?evidenceDuration:elapsedDuration;
    const payload={playerId,nickname,stageId:'final_boss',score:st.mastery,total:100,durationMs,clientPoints:Number(st.score||0),answers:[{...evidence,mastery:st.mastery,voiceScore:st.voiceScore,clientPoints:st.score,durationMs,directExitVersion:VERSION}],sourceVersion:VERSION};
    let response=null;
    try{response=await Promise.race([window.EW_AUTHORITY.submitGame(payload),delay(8000)])}catch(submitError){
      const confirmed=await resumeConfirmed(playerId,nickname);
      if(confirmed){
        const synthetic=`firebase-reconciled-final-boss-${Date.now()}`;
        try{sessionStorage.setItem(`ew_passport_receipt::${playerId}::final_boss`,JSON.stringify({receipt:synthetic,at:new Date().toISOString(),passed:true,accuracy:st.mastery,missionSet:A?.SET||'',durationMs,reconciled:true,directExitVersion:VERSION}))}catch(_){}
        overlay('✅ Firebase ยืนยันว่า Final Boss ผ่านแล้ว<br><small>กำลังกลับ Passport…</small>');
        location.replace(passportUrl(synthetic,true));
        return;
      }
      throw submitError;
    }
    if(!response?.ok)throw new Error(response?.error||'SUBMIT_FAILED');
    if(!(response.mode==='firebase'||response.authority?.mode==='firebase'))throw new Error(response.firebaseError||'FIREBASE_RECEIPT_REQUIRED');
    const receipt=response.receiptId||response.resultId||'';
    if(!response.passed)throw new Error(`FINAL_BOSS_NOT_PASSED_MASTERY_${st.mastery}`);
    try{sessionStorage.setItem(`ew_passport_receipt::${playerId}::final_boss`,JSON.stringify({receipt,at:new Date().toISOString(),passed:true,accuracy:response.accuracy??st.mastery,missionSet:A?.SET||'',durationMs,directExitVersion:VERSION}))}catch(_){}
    overlay('✅ Firebase Saved • PASS<br><small>กำลังกลับ Passport…</small>');
    location.replace(passportUrl(receipt));
  }catch(err){
    console.error('[LCA Direct Exit V4]',err);locked=false;
    overlay(`⚠️ บันทึก Firebase ยังไม่ยืนยัน<br><small>${String(err?.message||err)}</small><br><button id="lcaRetryDirect" style="margin-top:14px;padding:10px 18px;border-radius:12px">ลองบันทึกอีกครั้ง</button>`);
    setTimeout(()=>{$('lcaRetryDirect')?.addEventListener('click',()=>{document.getElementById('lcaDirectExit')?.remove();complete(score)},{once:true})},0);
  }
}
function watch(){if(locked)return;const s=liveScore();if(s>=52)complete(s)}
timer=setInterval(watch,120);
addEventListener('pagehide',()=>{clearInterval(timer);stopRuntime()},{once:true});
window.LEXICON_CHAMPION_FINAL_VOICE_DIRECT_EXIT=Object.freeze({version:VERSION,complete,liveScore});
console.info('[LEXICON Champion] Final Voice Direct Exit V4 duration fallback ready');
})();