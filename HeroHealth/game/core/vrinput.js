// === core/vrinput.js ===
let _isXR = false;
let _isGaze = false;

export const VRInput = {
  init(){/* reserved */},
  toggleVR(v){ _isXR = !!v; },
  isXRActive(){ return !!_isXR; },
  isGazeMode(){ return !!_isGaze; },
  setGaze(v){ _isGaze = !!v; }
};
