// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR (bind UI + start engine)

import { boot as engineBoot } from './hygiene.safe.js';

(function(){
  'use strict';
  try{
    engineBoot();
  }catch(err){
    console.error('[HygieneVR] boot failed:', err);
  }
})();