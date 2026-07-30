(() => {
  'use strict';
  const config = window.HH_CONFIG;
  if (!config?.zones) return;
  const nutrition = config.zones.find((zone) => zone.id === 'nutrition');
  const groups = nutrition?.games?.find((game) => game.id === 'groups');
  if (!groups) return;

  groups.title = 'ภารกิจอาหาร 5 หมู่';
  groups.thai = 'ภารกิจอาหาร 5 หมู่';
  groups.url = '../herohealth/groups-ar-gate.html?phase=warmup&next=./groups-ar.html%3Fv%3D20260730-grade5-easy-grab-v510%26pinchClose%3D0.085%26pinchOpen%3D0.145%26interactionAssist%3Dgrade5-easy-grab-v1&v=20260730-grade5-easy-grab-gate-v510';
  groups.status = 'classroom-direct-thai-strict-ar-grade5-easy-grab-v510';
  groups.requiredReturnContract = true;
  groups.progressionByCompletion = true;
  groups.oneRoundCompletes = true;
  groups.retryRequired = false;
  groups.studentRetryVisible = false;
  groups.inputMode = 'hand-ar-only';
  groups.touchFallbackEnabled = false;
  groups.interactionAssist = {
    profile: 'grade5-easy-grab-v1',
    effectiveGrabRadiusPx: 152,
    binStartRatio: 0.645,
    stickyGrabUntilBin: true,
    pinchClose: 0.085,
    pinchOpen: 0.145
  };
})();
