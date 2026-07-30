(()=>{'use strict';
const config=window.HH_CONFIG;
if(!config)return;
config.platformVersion=String(config.platformVersion||'HeroHealth')+'-JUMPDUCK-V53';
config.deploymentState=String(config.deploymentState||'QA')+'_JUMPDUCK_IOS_DIRECTION_FIX_V53';
const fitness=(config.zones||[]).find(zone=>zone&&zone.id==='fitness');
const jumpduck=fitness?.games?.find(game=>game&&game.id==='jumpduck');
if(jumpduck){
  jumpduck.url='../fitness/jumpduck-classroom-v26-ar.html?v=20260730-ios-direction-v53';
  jumpduck.status='classroom-core-v5.3-ios-front-camera-direction-fix';
  jumpduck.inputMode='movenet-lightning-body-tracking';
  jumpduck.horizontalDirectionPolicy='ios-no-double-flip-default-android-flip';
  jumpduck.calibrationPolicy='move-real-game-camera-to-visible-calibration-v52';
  jumpduck.centerPolicy='wide-center-asymmetric-hysteresis';
}
const classroom=config.missionProfiles?.CLASS_60;
if(classroom){
  classroom.description=String(classroom.description||'')+' JumpDuck V5.3 คง Real Camera Calibration ของ V5.2 และแก้ทิศทางซ้าย–ขวาบน iPhone โดยยกเลิกการ Flip พิกัด MoveNet ซ้ำกับกล้องหน้า iOS ขณะที่ Android ยังคงนโยบายเดิม พร้อม Mirror เฉพาะ Skeleton Overlay ให้ตรงกับภาพ Selfie Preview';
}
})();
