// === /herohealth/api/hub-api-boot.js ===
// Hub API boot: updates banner safely + exposes safe client on window

'use strict';

import { guardApi } from './hub-api-guard.js';
import { createSafeClient } from './apolloClient.safe.js';

export async function bootHubApi({ uri }){
  const r = await guardApi({ uri });

  // expose safe client even if offline (it won't throw)
  try{
    window.HHA = window.HHA || {};
    window.HHA.apiUri = uri;
    window.HHA.client = createSafeClient({ uri });
    window.HHA.apiStatus = r;
  }catch{}

  return r;
}
