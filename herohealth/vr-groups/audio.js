// vr-groups/audio.js
(function (ns) {
  'use strict';

  function get(id) {
    return document.getElementById(id) || null;
  }

  function safePlay(el) {
    if (!el) return;
    // บาง browser ไม่ให้ autoplay ถ้าไม่มี interaction มาก่อน
    try {
      const p = el.cloneNode(true); // clone เพื่อให้เล่นซ้อนกันได้
      p.volume = el.volume != null ? el.volume : 0.9;
      p.play().catch(() => {});
    } catch (e) {}
  }

  const AudioFx = {
    hitEl: null,
    missEl: null,
    questEl: null,

    init() {
      this.hitEl = get('fgSfxHit');
      this.missEl = get('fgSfxMiss');
      this.questEl = get('fgSfxQuest');
    },

    playHit() {
      safePlay(this.hitEl);
    },

    playMiss() {
      safePlay(this.missEl);
    },

    playQuest() {
      safePlay(this.questEl);
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => AudioFx.init());
  } else {
    AudioFx.init();
  }

  ns.foodGroupsAudio = AudioFx;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));