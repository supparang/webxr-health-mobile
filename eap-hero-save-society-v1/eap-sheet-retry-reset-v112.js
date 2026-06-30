/* EAP Hero v112: one-time reset of failed local sheet-send flags.
   Earlier versions marked evidence as sent before Apps Script received it.
   This only clears the local retry markers; it never resets learning progress.
*/
(function(){
  'use strict';
  var key='EAP_HERO_PROGRESS_V3', done='EAP_HERO_SHEET_RETRY_RESET_V112';
  if(localStorage.getItem(done)) return;
  try{
    var state=JSON.parse(localStorage.getItem(key)||'{}');
    if(state && state.sheetSync){
      state.sheetSync.sent={};
      localStorage.setItem(key,JSON.stringify(state));
    }
    localStorage.setItem(done,'1');
  }catch(_){ }
})();
