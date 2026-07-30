(()=>{'use strict';
const config=window.HH_CONFIG;
if(!config)return;
config.platformVersion=String(config.platformVersion||'HeroHealth')+'-JUMPDUCK-V51';
config.deploymentState=String(config.deploymentState||'QA')+'_JUMPDUCK_CALIBRATION_RECOVERY_V51';
const fitness=(config.zones||[]).find(zone=>zone&&zone.id==='fitness');
const jumpduck=fitness?.games?.find(game=>game&&game.id==='jumpduck');
if(jumpduck){
  jumpduck.url='../fitness/jumpduck-classroom-v26-ar.html?v=20260730-calibration-recovery-v51';
  jumpduck.status='classroom-core-v5.1-movenet-live-calibration-recovery';
  jumpduck.inputMode='movenet-lightning-body-tracking';
  jumpduck.calibrationPolicy='live-preview-extended-sampling-visible-retry-no-stuck-at-one';
  jumpduck.centerPolicy='wide-center-asymmetric-hysteresis';
}
const classroom=config.missionProfiles?.CLASS_60;
if(classroom){
  classroom.description=String(classroom.description||'')+' JumpDuck V5.1 ใช้ MoveNet Lightning ตรวจไหล่และสะโพกจริง เพิ่มภาพกล้องสดในหน้าปรับตำแหน่ง ขยายช่วงเก็บตัวอย่าง Calibration สำหรับมือถือ และคืนหน้าเริ่มพร้อมคำแนะนำแทนการค้างที่เลข 1 เมื่อยังเห็นร่างกายไม่ครบ พร้อมคงช่องกลางแบบกว้างและกลับเข้ากลางได้ง่ายกว่าออกซ้าย–ขวา';
}
})();
