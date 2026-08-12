(function(){
'use strict';
const VERSION='2026-08-12-JOURNEY-QUOTA-EXISTING-CERT-V1';
const CERT_COL='ewp_certificates';
let quotaBlocked=false;
const clean=v=>String(v==null?'':v).trim();
function isQuota(error){const s=`${error?.code||''} ${error?.message||error||''}`;return /resource-exhausted|quota exceeded|FIRESTORE_QUOTA_EXCEEDED/i.test(s)}
async function existingCertificate(playerId){
  if(!window.firebase?.firestore)return null;
  try{
    const snap=await firebase.firestore().collection(CERT_COL).doc(playerId).get();
    if(!snap.exists)return null;
    const data=snap.data()||{};
    return data.certificateId?{id:snap.id,...data}:null;
  }catch(error){
    console.warn('[LEXICON X] Existing certificate lookup failed',error);
    return null;
  }
}
function install(){
  const base=window.EW_JOURNEY;
  if(!base?.completeSummary||base.quotaExistingCertificateVersion===VERSION)return false;
  const original=base.completeSummary.bind(base);
  const wrapped={...base,quotaExistingCertificateVersion:VERSION,completeSummary:async function(playerId){
    playerId=clean(playerId);if(!playerId)throw new Error('PLAYER_ID_REQUIRED');
    if(quotaBlocked){
      const cert=await existingCertificate(playerId);
      if(cert)return {ok:true,mode:'firebase',summaryViewed:true,existingCertificate:true,certificateId:cert.certificateId||'',receiptId:cert.certificateId||'',sourceOfTruth:'Existing Certificate • Firestore quota-safe',version:VERSION};
      const e=new Error('FIRESTORE_QUOTA_EXCEEDED_NO_EXISTING_CERTIFICATE');e.code='resource-exhausted';throw e;
    }
    try{return await original(playerId)}catch(error){
      if(!isQuota(error))throw error;
      quotaBlocked=true;
      const cert=await existingCertificate(playerId);
      if(cert){
        console.warn('[LEXICON X] Firestore write quota exhausted; opening existing certificate without another write');
        return {ok:true,mode:'firebase',summaryViewed:true,existingCertificate:true,certificateId:cert.certificateId||'',receiptId:cert.certificateId||'',sourceOfTruth:'Existing Certificate • Firestore quota-safe',version:VERSION};
      }
      const e=new Error('FIRESTORE_QUOTA_EXCEEDED_NO_EXISTING_CERTIFICATE');e.code='resource-exhausted';e.cause=error;throw e;
    }
  }};
  window.EW_JOURNEY=Object.freeze(wrapped);
  console.info('[LEXICON X] Journey quota existing-certificate guard ready',VERSION);
  return true;
}
if(!install()){let i=0;const t=setInterval(()=>{i++;if(install()||i>120)clearInterval(t)},50);}
})();
