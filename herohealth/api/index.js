// === /herohealth/api/index.js ===
// Entry for HUB API usage
// You can import bootHubApi and then use window.HHA_API.query/mutate safely.

'use strict';

import { bootHubApi } from './hub-api-boot.js';

(function(){
  const API_URI =
    // ให้ override ได้ด้วย ?api=... เวลาทดสอบ
    new URL(location.href).searchParams.get('api') ||
    // หรือกำหนดค่า default ที่คุณใช้จริง
    'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/';

  // Boot (safe)
  bootHubApi({ uri: API_URI }).then((api)=>{
    // Example (optional): call something if you want
    // api.query({ query: SOME_GQL_DOC, variables:{...} })
    // .then(({data,error})=>{ ... });

    // expose for debugging
    window.HHA_API_URI = API_URI;
    window.HHA_API_READY = true;
    console.log('[HHA] API booted. enabled=', api.enabled(), api.disableInfo());
  });
})();
