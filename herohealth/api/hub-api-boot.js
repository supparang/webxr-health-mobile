// === /herohealth/api/hub-api-boot.js ===
// Hub API boot: updates banner safely + exposes safe client on window
// PATCH v20260215b

'use strict';

import { guardApi } from './hub-api-guard.js';
import { createSafeClient } from './apolloClient.safe.js';

// Resolve defaults from window (optional) so you can tune without rebuilding.
// Example in hub.html before hub.boot.js:
// <script>window.__HHA_API_DEFAULTS__={ graphqlPath:'/prod/graphql', disableOnAuth:false, timeoutMs:6000 };</script>
function getDefaults(){
  const d = (typeof window !== 'undefined' && window.__HHA_API_DEFAULTS__) || {};
  return {
    graphqlPath: d.graphqlPath || '/prod/graphql', // ✅ set to your real GraphQL route
    timeoutMs: Number.isFinite(d.timeoutMs) ? d.timeoutMs : 6000,
    disableOnAuth: (typeof d.disableOnAuth === 'boolean') ? d.disableOnAuth : false, // ✅ hub-friendly default
    extraHeaders: (d.extraHeaders && typeof d.extraHeaders === 'object') ? d.extraHeaders : null
  };
}

export async function bootHubApi({ uri }){
  const apiBase = String(uri || '').trim();
  const defaults = getDefaults();

  // 1) Update banner / remote guard (should be lightweight inside guardApi)
  // IMPORTANT: guardApi should probe a public GET health endpoint if you want "green" without auth.
  const r = await guardApi({ uri: apiBase });

  // 2) Expose safe client even if offline (it won't throw)
  try{
    window.HHA = window.HHA || {};
    window.HHA.apiUri = apiBase;

    // Ensure client never posts to root "/" by providing graphqlPath
    window.HHA.client = createSafeClient({
      uri: apiBase,
      graphqlPath: defaults.graphqlPath,
      timeoutMs: defaults.timeoutMs,
      disableOnAuth: defaults.disableOnAuth,
      extraHeaders: defaults.extraHeaders
    });

    window.HHA.apiStatus = r;
    window.HHA.apiClientEndpoint = window.HHA.client?.endpoint || '';
  }catch{}

  return r;
}
