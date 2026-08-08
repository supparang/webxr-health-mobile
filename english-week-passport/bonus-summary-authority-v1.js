(()=>{
'use strict';
const VERSION='2026-08-08-BONUS-SUMMARY-AUTHORITY-V1';
const original=window.EW_AUTHORITY;
if(!original||typeof original.submitEvent!=='function'){
  console.warn('[Bonus Summary Authority] EW_AUTHORITY not ready');
  return;
}
function clean(v){return String(v==null?'':v).trim()}
function isLensSummary(payload){
  return clean(payload?.stageId)==='bonus_lens'&&clean(payload?.eventName)==='lens_result_summary';
}
function scoreFrom(payload){
  const n=Number(payload?.payload?.score);
  return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;
}
async function mirror(payload,response){
  if(!isLensSummary(payload)||!response?.ok)return response;
  const playerId=clean(payload.playerId),score=scoreFrom(payload);
  if(!playerId||score==null)return response;
  try{
    // resume establishes the per-device owned session required by Firestore rules.
    if(typeof original.resume==='function')await original.resume(playerId,payload?.payload?.nickname||'');
    if(!window.firebase?.firestore)throw new Error('FIRESTORE_NOT_READY');
    const ref=firebase.firestore().collection('ewp_game_summary').doc(playerId);
    await firebase.firestore().runTransaction(async tx=>{
      const snap=await tx.get(ref);
      const old=snap.exists?(snap.data()||{}):{};
      const prev=Number(old?.bonusBest?.score);
      const best=!Number.isFinite(prev)||score>=prev?{
        score,
        receipt:clean(response.eventId||''),
        at:new Date().toISOString(),
        source:'lens-authority-summary'
      }:old.bonusBest;
      tx.set(ref,{
        playerId,
        bonusBest:best,
        bonusUpdatedAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        sourceVersion:VERSION
      },{merge:true});
    });
    window.dispatchEvent(new CustomEvent('ew-bonus-summary-written',{detail:{playerId,score,version:VERSION}}));
    return {...response,bonusSummarySaved:true,bonusScore:score};
  }catch(error){
    console.error('[Bonus Summary Authority] mirror failed',error);
    // Do not pretend cross-device authority succeeded.
    return {...response,bonusSummarySaved:false,bonusSummaryError:String(error?.message||error)};
  }
}
const wrapped=Object.freeze({
  ...original,
  submitEvent:async payload=>mirror(payload,await original.submitEvent(payload)),
  bonusSummaryAuthorityVersion:VERSION
});
window.EW_AUTHORITY=wrapped;
window.EW_BONUS_SUMMARY_AUTHORITY=Object.freeze({version:VERSION});
})();
