// === /herohealth/vr/leaderboard.auto.js ===
// Auto boot leaderboard (safe even if imported multiple times)
// FULL v20260228-LB-AUTO
'use strict';

import { autoMount } from './leaderboard.js';

try{
  // prevent double init
  if(!window.__HHA_LB_AUTO__){
    window.__HHA_LB_AUTO__ = 1;
    autoMount();
  }
}catch(e){}