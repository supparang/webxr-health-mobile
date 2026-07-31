(()=>{'use strict';
const config=window.HH_CONFIG;
if(!config)return;
config.platformVersion=String(config.platformVersion||'HeroHealth')+'-JUMPDUCK-V60-BALANCE-V47';
config.deploymentState=String(config.deploymentState||'QA')+'_JUMPDUCK_DUCK_POLISH_V60_BALANCE_BALANCED_BANK_V47';
const fitness=(config.zones||[]).find(zone=>zone&&zone.id==='fitness');
const jumpduck=fitness?.games?.find(game=>game&&game.id==='jumpduck');
if(jumpduck){
  jumpduck.url='../fitness/jumpduck-classroom-v26-ar.html?v=20260731-duck-polish-v60';
  jumpduck.status='classroom-core-v6.0-duck-polish-pack-v2';
  jumpduck.inputMode='movenet-lightning-body-tracking';
  jumpduck.horizontalDirectionPolicy='front-camera-output-x-inversion-v55';
  jumpduck.calibrationPolicy='real-camera-visible-calibration-with-camera-hold-v54';
  jumpduck.centerPolicy='wide-center-asymmetric-hysteresis';
  jumpduck.visualEffectProfile='canvas2d-lightweight-parallax-v56';
  jumpduck.duckAnimationProfile='vector-duck-v2-lean-landing-trail-wind-hero-streak-recovery-v60';
  jumpduck.resultProfile='thai-labels-achievements-save-state-confetti-v57-compact-layout-v58';
  jumpduck.resultViewportPolicy='top-reset-fixed-passport-responsive-height-v58';
  jumpduck.performancePolicy='adaptive-15-22-30fps-low-particle-cap';
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
  classroom.description=String(classroom.description||'')+' JumpDuck V6.0 คง MoveNet ทิศทางซ้าย–ขวา Camera Hold Visual Polish และหน้าสรุปเดิมทั้งหมด พร้อม Duck Polish Pack V2: เป็ดเอียงตามความเร็วในการเปลี่ยนเลน มี Landing Impact และฝุ่นเบา รอยกระโดด เส้นลมตอนก้ม Hero Mode เมื่อ Combo สูง Perfect Streak Reaction และวง Recovery หลัง Miss โดยจำกัดอนุภาคและรองรับ Reduced Motion เพื่อไม่รบกวนการตรวจจับร่างกายหรือเกณฑ์คะแนน Balance Hold V47 คง 6 ท่าต่อรอบเพื่อเหมาะกับฐาน 10 นาที แต่สุ่มจากลำดับสมดุล 12 รูปแบบ โดยทุกคนได้รับท่ามาตรฐานชุดเดียวกันครบทั้งซ้าย–ขวาและไม่ซ้ำรูปแบบเดิมทันที พร้อมบันทึก Sequence ID และลำดับจริงเพื่อวิเคราะห์งานวิจัย';
}
})();