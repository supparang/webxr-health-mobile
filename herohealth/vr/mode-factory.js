// === /herohealth/vr/mode-factory.js ===
// PATCH: add controller.updateConfig(nextCfg) with reschedule spawn timer
// NOTE: โค้ดนี้เป็น "ส่วนเพิ่ม" ที่คุณต้องใส่ในไฟล์เดิม
// -------------------------------------------------------------

/*
  ✅ วิธีใส่:
  1) ในฟังก์ชัน boot()/spawnBoot ของคุณ ต้องมีตัวแปร cfg ที่ใช้จริง
     เช่น cfg.spawnRate, cfg.sizeRange, cfg.kinds ...
  2) ต้องมีตัวแปร timerId ที่ใช้ setInterval/setTimeout สำหรับ spawn loop
  3) ใส่ helper ด้านล่าง "ก่อน return controller"
*/

// --- helper: deep-ish merge (พอสำหรับ config เกม) ---
function _hhaMergeCfg(dst, src){
  if(!src) return dst;
  for(const k of Object.keys(src)){
    const v = src[k];
    if(v && typeof v === 'object' && !Array.isArray(v)){
      dst[k] = _hhaMergeCfg(Object.assign({}, dst[k]||{}), v);
    }else{
      dst[k] = v;
    }
  }
  return dst;
}

/*
  สมมติในโค้ดเดิมคุณมีประมาณนี้:

  let cfg = {...}
  let timerId = null;

  function schedule(){
    clearInterval(timerId);
    timerId = setInterval(spawnOne, cfg.spawnRate || 900);
  }

  schedule();

  const controller = { stop(){...}, destroy(){...} };
  return controller;

  ✅ ให้แก้เป็น:
*/

// --- ✅ เพิ่มเข้าไปก่อน return controller ---
const controller = controller || {}; // (ถ้าคุณมี controller เดิมแล้ว ให้ลบบรรทัดนี้)

controller.updateConfig = function(nextCfg = {}){
  // merge เข้ากับ cfg ที่ใช้งานจริง
  _hhaMergeCfg(cfg, nextCfg);

  // ถ้ามีการเปลี่ยน spawnRate ให้ reschedule ทันที
  try{
    if(typeof schedule === 'function'){
      schedule(); // ใช้ schedule() ของเดิม
    }else if(timerId != null){
      // fallback (ถ้าเดิมใช้ setInterval)
      clearInterval(timerId);
      timerId = setInterval(spawnOne, cfg.spawnRate || 900);
    }
  }catch(_){}

  return cfg;
};

// แล้วค่อย return controller ตามปกติ
// return controller;