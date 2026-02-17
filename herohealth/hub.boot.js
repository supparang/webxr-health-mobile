// === PATCH for /herohealth/hub.boot.js (v20260217a) ===
import { attachHubLinks } from './hub.links.js';

function ensureHubParam(){
  // เติม hub= ให้กับ URL ตัวเอง (เพื่อให้ launcher-core ส่งต่อได้สวย)
  const u = new URL(location.href);
  if (!u.searchParams.get('hub')){
    u.searchParams.set('hub', u.toString());
    history.replaceState(null, '', u.toString());
  }
}
ensureHubParam();
attachHubLinks();