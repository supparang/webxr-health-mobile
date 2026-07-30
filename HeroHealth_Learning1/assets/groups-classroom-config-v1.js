(() => {
  'use strict';
  const config = window.HH_CONFIG;
  if (!config?.zones) return;
  const nutrition = config.zones.find((zone) => zone.id === 'nutrition');
  const groups = nutrition?.games?.find((game) => game.id === 'groups');
  if (!groups) return;

  groups.title = 'ภารกิจอาหาร 5 หมู่';
  groups.thai = 'ภารกิจอาหาร 5 หมู่';
  groups.url = '../herohealth/groups-ar-gate.html?phase=warmup&next=./groups-ar.html%3Fv%3D20260730-thai-strict-ar-v500&v=20260730-thai-gate-v500';
  groups.status = 'classroom-direct-thai-strict-ar-v500';
  groups.requiredReturnContract = true;
  groups.progressionByCompletion = true;
  groups.oneRoundCompletes = true;
  groups.retryRequired = false;
  groups.studentRetryVisible = false;
  groups.inputMode = 'hand-ar-only';
  groups.touchFallbackEnabled = false;
})();
