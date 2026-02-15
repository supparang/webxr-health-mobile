// === /herohealth/api/hub-api-guard.js ===
// HUB API Guard: probe endpoint + show offline banner (optional)

'use strict';

import { isRemoteDisabled, disabledInfo } from './api-status.js';
import { probeApi } from './api-probe.js';

function setBanner(text){
  // Optional: ถ้า hub มี element banner ก็อัปเดตให้
  const el = document.getElementById('offlineBanner') || document.querySelector('[data-offline-banner]');
  if(!el) return;
  el.style.display = text ? 'block' : 'none';
  el.textContent = text || '';
}

export async function guardApi({ uri }){
  if(isRemoteDisabled()){
    const info = disabledInfo();
    setBanner(`⚠️ Offline mode (API ${info.code || 403})`);
    return { ok:false, status: info.code || 403, reason:'disabled' };
  }

  const r = await probeApi({ uri });
  if(!r.ok){
    if(r.status === 401 || r.status === 403){
      setBanner(`⚠️ Offline mode (API ${r.status})`);
    }else{
      setBanner(`⚠️ Offline mode (API down)`);
    }
  }else{
    setBanner('');
  }
  return r;
}
