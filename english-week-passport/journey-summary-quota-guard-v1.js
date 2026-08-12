(function(){
'use strict';
const VERSION='2026-08-12-JOURNEY-SUMMARY-QUOTA-GUARD-V1';
const PROGRESS_COL='ewp_progress';
const clean=v=>String(v==null?'':v).trim();
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
function isQuota(error){const s=`${error?.code||''} ${error?.message||error||''}`;return /resource-exhausted|quota exceeded/i.test(s)}
function install(){
  const base=window.EW_JOURNEY;
  if(!base?.completeSummary||base.quotaGuardVersion===VERSION)return false;
  const wrapped={...base,quotaGuardVersion:VERSION,completeSummary:async function(playerId){
    playerId=clean(playerId);if(!playerId)throw new Error('PLAYER_ID_REQUIRED');
    if(!window.firebase?.firestore)throw new Error('FIRESTORE_NOT_READY');
    const db=firebase.firestore(),ref=db.collection(PROGRESS_COL).doc(playerId),finishReceiptId=uid('finish');
    try{
      // Minimum authoritative operation: one transaction read + at most one write.
      // No resume(), no extra progress read, and no post-transaction read.
      let alreadyDone=false,existingReceipt='',existingFinishedAt=null;
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);if(!snap.exists)throw new Error('PROGRESS_NOT_FOUND');
        const current=snap.data()||{};
        if(!(current.reflectionDone||current.finalReflection))throw new Error('FINAL_REFLECTION_REQUIRED');
        if(!current.postDone||!current.certificateEligible)throw new Error('CERTIFICATE_NOT_ELIGIBLE');
        if(current.summaryViewed&&current.finishedAt){
          alreadyDone=true;existingReceipt=clean(current.finishReceiptId||'');existingFinishedAt=current.finishedAt;return;
        }
        const patch={playerId,summaryViewed:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),journeySourceVersion:VERSION};
        if(!current.summaryViewedAt)patch.summaryViewedAt=firebase.firestore.FieldValue.serverTimestamp();
        if(!current.finishedAt){patch.finishedAt=firebase.firestore.FieldValue.serverTimestamp();patch.finishReceiptId=finishReceiptId;patch.finishSource='journey_summary_confirmed';patch.finishVersion=VERSION;}
        tx.set(ref,patch,{merge:true});
      });
      return {ok:true,mode:'firebase',receiptId:existingReceipt||finishReceiptId,summaryViewed:true,finishedAt:existingFinishedAt||null,alreadyDone,sourceOfTruth:'Cloud Firestore Server Finish Authority • quota-safe',version:VERSION};
    }catch(error){
      if(isQuota(error)){
        const e=new Error('FIRESTORE_QUOTA_EXCEEDED');e.code='resource-exhausted';e.cause=error;throw e;
      }
      throw error;
    }
  }};
  window.EW_JOURNEY=Object.freeze(wrapped);
  window.dispatchEvent(new CustomEvent('ew-journey-quota-guard-ready',{detail:{version:VERSION}}));
  console.info('[LEXICON X] Journey Summary Quota Guard ready',VERSION);
  return true;
}
if(!install()){let i=0;const t=setInterval(()=>{i++;if(install()||i>120)clearInterval(t)},50);}
})();