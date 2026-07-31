(()=>{'use strict';
const config=window.HH_CONFIG;
if(!config)return;
config.platformVersion=String(config.platformVersion||'HeroHealth')+'-JUMPDUCK-V55-BALANCE-V47';
config.deploymentState=String(config.deploymentState||'QA')+'_JUMPDUCK_UNIVERSAL_DIRECTION_FIX_V55_BALANCE_BALANCED_BANK_V47';
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
const balance=fitness?.games?.find(game=>game&&game.id==='balance-hold');
if(balance){
  balance.url='../fitness/balance-hold-ar2.html?classroom=1&mode=classroom&source=herohealth&v=20260731-balance-balanced-bank-v47';
  balance.status='classroom-core-v47-balanced-12-sequence-forms-six-validated-poses';
  balance.poseCountPerRound=6;
  balance.sequenceBankSize=12;
  balance.sequencePolicy='balanced-without-immediate-repeat';
  balance.poseSetPolicy='validated-production-pose-set-only';
  balance.bodyTrackingOverlay='lightweight-body-axis';
  balance.progressionByCompletion=true;
  balance.oneRoundCompletes=true;
  balance.retryRequired=false;
  balance.studentRetryVisible=false;
}
const classroom=config.missionProfiles?.CLASS_60;
if(classroom){
  classroom.description=String(classroom.description||'')+' JumpDuck V5.5 แก้ทิศทางซ้าย–ขวาที่พิกัดผลลัพธ์ของ MoveNet แบบเดียวกันทุกอุปกรณ์ ไม่แยก iPhone/Android จึงไม่มี branch ตามรุ่นโทรศัพท์ และคง Camera Hold ระหว่าง Calibration Balance Hold V47 คง 6 ท่าต่อรอบเพื่อเหมาะกับฐาน 10 นาที แต่สุ่มจากลำดับสมดุล 12 รูปแบบ โดยทุกคนได้รับท่ามาตรฐานชุดเดียวกันครบทั้งซ้าย–ขวาและไม่ซ้ำรูปแบบเดิมทันที พร้อมบันทึก Sequence ID และลำดับจริงเพื่อวิเคราะห์งานวิจัย';
}
})();