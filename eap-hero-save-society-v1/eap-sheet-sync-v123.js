/* =========================================================
   EAP Hero Sheet Sync entrypoint v129
   Replaces the baseline-based v123 implementation.
   The production index keeps this filename for compatibility,
   while all delivery is handled by Pending Evidence Sync v129.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260802-EAP-SHEET-SYNC-ENTRYPOINT-V129';

  function load(){
    if(window.EAPPendingEvidenceSyncV129){
      try{window.EAPPendingEvidenceSyncV129.sync();}catch(_){ }
      return;
    }
    if(document.querySelector('script[data-eap-pending-evidence-sync="v129"]'))return;
    var script=document.createElement('script');
    script.src='./eap-pending-evidence-sync-v129.js?v=20260802-pending-evidence-sync-v129-production';
    script.async=false;
    script.dataset.eapPendingEvidenceSync='v129';
    script.onload=function(){
      try{window.EAPPendingEvidenceSyncV129&&window.EAPPendingEvidenceSyncV129.sync();}catch(_){ }
    };
    document.head.appendChild(script);
  }

  window.EAPSheetSyncV123={
    version:VERSION,
    sync:load,
    sendLatest:function(){load();return true;}
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
  window.addEventListener('load',function(){load();setTimeout(load,700);});
})();
