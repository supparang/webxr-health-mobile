// === /herohealth/plate/plate.main.js ===
// Plate Main Boot — for modular refactor later (global)
// NOTE: ตอนนี้ production จริงยังใช้ plate.safe.js อยู่
// Provides window.GAME_MODULES.PlateMain

(function (root) {
  'use strict';
  const W = root;

  function boot(){
    // ถ้ายังใช้ plate.safe.js -> ไม่ต้องทำอะไร (กันซ้ำ)
    if(W.__PLATE_SAFE_RUNNING__) return;

    // ถ้าอนาคตย้าย engine มาอยู่ main: ให้เริ่มที่นี่
    console.warn('[PlateMain] This file is ready for modular refactor. Production uses plate.safe.js currently.');
  }

  W.GAME_MODULES = W.GAME_MODULES || {};
  W.GAME_MODULES.PlateMain = { boot };

})(window);