(()=>{'use strict';
const config=window.HH_CONFIG;
if(!config)return;
config.platformVersion=String(config.platformVersion||'HeroHealth')+'-JUMPDUCK-V52';
config.deploymentState=String(config.deploymentState||'QA')+'_JUMPDUCK_REAL_CAMERA_CALIBRATION_V52';
const fitness=(config.zones||[]).find(zone=>zone&&zone.id==='fitness');
const jumpduck=fitness?.games?.find(game=>game&&game.id==='jumpduck');
if(jumpduck){
  jumpduck.url='../fitness/jumpduck-classroom-v26-ar.html?v=20260730-real-camera-calibration-v52';
  jumpduck.status='classroom-core-v5.2-movenet-real-camera-calibration';
  jumpduck.inputMode='movenet-lightning-body-tracking';
  jumpduck.calibrationPolicy='move-real-game-camera-to-visible-calibration-extended-sampling-visible-retry';
  jumpduck.centerPolicy='wide-center-asymmetric-hysteresis';
}
const classroom=config.missionProfiles?.CLASS_60;
if(classroom){
  classroom.description=String(classroom.description||'')+' JumpDuck V5.2 แก้จอดำใน Calibration โดยย้ายกล้องตัวจริงและ Pose Canvas ของเกมมาแสดงในหน้าปรับตำแหน่งโดยตรง ไม่สร้าง Video ตัวที่สองจาก MediaStream เดียวกันซึ่งไม่เสถียรบน Android ขยายช่วงเก็บตัวอย่างเป็นประมาณ 5.4 วินาที แสดงสถานะความพร้อมของภาพ และมีคำเตือนพร้อมปุ่มลองใหม่แทนการค้างที่เลข 1';
}
})();
