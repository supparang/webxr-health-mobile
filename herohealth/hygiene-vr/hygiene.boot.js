// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR (bind UI + start engine)
// ✅ Imports correct named export: boot

import { boot as engineBoot } from './hygiene.safe.js';

(function(){
  'use strict';
  engineBoot();
})();