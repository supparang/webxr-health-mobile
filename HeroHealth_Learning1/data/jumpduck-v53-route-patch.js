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
  jumpduck.calibrationPolicy='real-game-camera-visible-calibration-v52';
}
const classroom=config.missionProfiles?.CLASS_60;
if(classroom){
  classroom.description=String(classroom.description||'')+' JumpDuck V5.3 แก้ทิศทางซ้าย–ขวาบน iPhone โดยไม่ Flip พิกัด MoveNet ซ้ำกับกล้องหน้า iOS ขณะที่ Android ยังคงนโยบายเดิม และ Mirror เฉพาะ Skeleton Overlay ให้ตรงกับภาพ Selfie Preview';
}
})();
