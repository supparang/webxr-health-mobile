// === /herohealth/vr-brush/brush.boot.js ===
// PATCH v20260304-BRUSH-BOOT-MLLISTEN (optional add)
(function(){
  'use strict';
  const WIN = window;

  // ถ้าคุณมี boot ของคุณอยู่แล้ว ให้ “เพิ่ม” ส่วนนี้พอ:
  WIN.addEventListener('brush:ml', (ev)=>{
    // debug only
    // console.log('[brush:ml]', ev.detail);
  });
})();