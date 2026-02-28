// === /herohealth/vr/battle-ui.auto.js ===
// Auto mount battle UI when ?battle=1
// FULL v20260228-BATTLE-UI-AUTO
'use strict';

import { autoMountBattleUI } from './battle-ui.js';

try{
  if(!window.__HHA_BATTLE_UI_AUTO__){
    window.__HHA_BATTLE_UI_AUTO__ = 1;
    autoMountBattleUI();
  }
}catch(e){}