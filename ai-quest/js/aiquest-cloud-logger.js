/*
  CSAI2102 AI Quest Cloud Logger
  Version: v1.6
  Sends data to Google Apps Script Web App with local fallback.
*/

(function(){
  'use strict';

  // วาง Apps Script Web App URL ตรงนี้ หรือส่งผ่าน ?api=...
  const DEFAULT_API_URL = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE';

  function storage(){ return window.AIQuestStorage; }

  function getApiUrl(){
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('api') || params.get('log');
    if(fromUrl && fromUrl.startsWith('https://')){
      storage().saveConfig({apiUrl:fromUrl, cloudEnabled:true});
      return fromUrl;
    }

    const cfg = storage().getConfig();
    if(cfg.apiUrl) return cfg.apiUrl;
    return DEFAULT_API_URL;
  }

  function isCloudReady(){
    const api = getApiUrl();
    const cfg = storage().getConfig();
    return !!(cfg.cloudEnabled !== false && api && api.startsWith('https://') && !api.includes('PASTE_'));
  }

  async function post(payload){
    if(!storage()) throw new Error('AIQuestStorage missing');

    const api = getApiUrl();
    if(!isCloudReady()){
      storage().addPending(payload);
      return {ok:false, queued:true, reason:'cloud_not_configured'};
})();
