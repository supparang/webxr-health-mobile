// /herohealth/vr-brush-kids/brush.audio.js

export function createBrushAudio() {
  let enabled = true;

  return {
    async unlock() {
      return true;
    },
    setEnabled(v) {
      enabled = !!v;
    },
    isEnabled() {
      return enabled;
    },
    hit() {},
    miss() {},
    combo() {},
    feverStart() {},
    zoneComplete() {},
    scanHit() {},
    bossBreakHit() {},
    shieldBreak() {},
    victory() {}
  };
}
