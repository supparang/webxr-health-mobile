(function () {
  let audioContext, masterGain;
  let muted = false;
  let initialized = false;

  async function init() {
    if (initialized) return;

    // สร้าง AudioContext ตาม Browser
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(audioContext.destination);

    initialized = true;
    console.log("Audio initialized");
  }

  function toggle() {
    muted = !muted;
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : 0.6;
    }
    return muted;
  }

  window.APP = window.APP || {};
  APP.audio = { init, toggle };
})();
