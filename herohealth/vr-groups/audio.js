// vr-groups/audio.js
(function (ns) {
  'use strict';

  const settings = ns.foodGroupsSettings = ns.foodGroupsSettings || {};

  // โหลดสถานะ mute จาก localStorage
  if (typeof settings.soundMuted !== 'boolean') {
    try {
      const saved = localStorage.getItem('fgSoundMuted');
      settings.soundMuted = (saved === '1');
    } catch (e) {
      settings.soundMuted = false;
    }
  }

  function play(id) {
    if (settings.soundMuted) return;
    const el = document.getElementById(id);
    if (!el) return;
    try {
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch (e) {}
  }

  ns.foodGroupsAudio = {
    playHit()   { play('fgSfxHit'); },
    playMiss()  { play('fgSfxMiss'); },
    playQuest() { play('fgSfxQuest'); },

    setMuted(muted) {
      settings.soundMuted = !!muted;
      try {
        localStorage.setItem('fgSoundMuted', muted ? '1' : '0');
      } catch (e) {}
    },
    isMuted() {
      return !!settings.soundMuted;
    }
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));