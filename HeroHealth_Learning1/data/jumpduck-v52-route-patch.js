(()=>{'use strict';
const config=window.HH_CONFIG;
if(!config)return;
config.platformVersion=String(config.platformVersion||'HeroHealth')+'-JUMPDUCK-V55';
config.deploymentState=String(config.deploymentState||'QA')+'_JUMPDUCK_UNIVERSAL_DIRECTION_FIX_V55';
const fitness=(config.zones||[]).find(zone=>zone&&zone.id==='fitness');
const jumpduck=fitness?.games?.find(game=>game&&game.id==='jumpduck');
if(jumpduck){
  jumpduck.url='../fitness/jumpduck-classroom-v26-ar.html?v=20260730-universal-direction-v55';
  jumpduck.status='classroom-core-v5.5-universal-front-camera-direction-fix';
  jumpduck.inputMode='movenet-lightning-body-tracking';
  jumpduck.horizontalDirectionPolicy='front-camera-output-x-inversion-v55';
  jumpduck.calibrationPolicy='real-camera-visible-calibration-with-camera-hold-v54';
  jumpduck.centerPolicy='wide-center-asymmetric-hysteresis';
}
const classroom=config.missionProfiles?.CLASS_60;
if(classroom){
  classroom.description=String(classroom.description||'')+' JumpDuck V5.5 แก้ทิศทางซ้าย–ขวาที่พิกัดผลลัพธ์ของ MoveNet แบบเดียวกันทุกอุปกรณ์ ไม่แยก iPhone/Android จึงไม่มี branch ตามรุ่นโทรศัพท์ และคง Camera Hold ระหว่าง Calibration';
}
})();