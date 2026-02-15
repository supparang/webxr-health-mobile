// === /herohealth/api/hub-api-boot.js ===
// Boot API safely for HUB (403-safe)

'use strict';

import { guardApi } from './hub-api-guard.js';
import { initApolloSafe } from './apolloClient.safe.js';

export async function bootHubApi({ uri }){
  // 1) probe first (don’t spam apollo if forbidden)
  await guardApi({ uri });

  // 2) init Apollo safe wrapper (will self-disable on 403 anyway)
  const api = initApolloSafe({ uri });

  return api;
}
