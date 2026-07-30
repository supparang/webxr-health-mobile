(() => {
  'use strict';
  const config = window.HH_CONFIG;
  if (!config?.zones) return;
  const nutrition = config.zones.find((zone) => zone.id === 'nutrition');
  const groups = nutrition?.games?.find((game) => game.id === 'groups');
  if (!groups) return;

  groups.title = 'ภารกิจอาหาร 5 หมู่';
  groups.thai = 'ภารกิจอาหาร 5 หมู่';
  groups.url = '../herohealth/groups-ar-gate.html?phase=warmup&next=./groups-ar.html%3Fv%3D20260730-stable-easy-drop-v515%26pinchClose%3D0.085%26pinchOpen%3D0.14%26interactionAssist%3Dgrade5-stable-easy-drop-v3&v=20260730-stable-easy-drop-gate-v515';
  groups.status = 'classroom-direct-thai-strict-ar-stable-easy-drop-v515';
  groups.requiredReturnContract = true;
  groups.progressionByCompletion = true;
  groups.oneRoundCompletes = true;
  groups.retryRequired = false;
  groups.studentRetryVisible = false;
  groups.inputMode = 'hand-ar-only';
  groups.touchFallbackEnabled = false;
  groups.interactionAssist = {
    profile: 'grade5-stable-easy-drop-v3',
    pinchClose: 0.085,
    pinchOpen: 0.14,
    visualGrabAssist: true,
    dropStartRatio: 0.63,
    originalDropStartRatio: 0.75,
    globalMathPatch: false
  };
  groups.mobileHeader = {
    profile: 'compact-full-title-v511',
    title: 'ภารกิจอาหาร 5 หมู่',
    maxLines: 2,
    oneRowHud: true
  };
  groups.summaryReturn = {
    profile: 'static-html-passport-v514',
    label: '← กลับ Hero Passport',
    alwaysVisible: true,
    autoReturnEnabled: true
  };
})();