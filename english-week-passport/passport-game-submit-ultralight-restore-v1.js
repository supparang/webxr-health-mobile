(function(){
'use strict';
const VERSION='2026-08-18-GAME-SUBMIT-ULTRALIGHT-RESTORE-V1';
const current=window.EW_AUTHORITY;
const light=window.EW_EVENT_DAY_BRIDGE_BASE;
if(!current||!light||typeof light.submitGame!=='function'){console.warn('EW game submit restore: light bridge unavailable');return;}
const submitGame=payload=>light.submitGame(payload);
const patched=Object.freeze({...current,submitGame,gameWritesPerAttempt:1,gameSubmitMode:'bridge-progress-only',gameSubmitRestoreVersion:VERSION});
window.EW_AUTHORITY=patched;
window.EW_GAME_SUBMIT_ULTRALIGHT=Object.freeze({version:VERSION,writesPerAttempt:1});
}());
