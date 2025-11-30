// vr-goodjunk/ui-fever.js
(function (ns) {
  'use strict';

  const UI = {
    wrap: null,
    scoreEl: null,
    timeEl: null,
    questEl: null,

    init() {
      if (this.wrap) return;

      const wrap = document.createElement('div');
      wrap.id = 'fgHud';
      wrap.style.position = 'fixed';
      wrap.style.top = '10px';
      wrap.style.left = '50%';
      wrap.style.transform = 'translateX(-50%)';
      wrap.style.padding = '8px 16px';
      wrap.style.borderRadius = '999px';
      wrap.style.background = 'rgba(15,23,42,.85)';
      wrap.style.color = '#e5e7eb';
      wrap.style.font = '600 14px system-ui, -apple-system, sans-serif';
      wrap.style.zIndex = '9999';
      wrap.style.display = 'none';
      wrap.style.boxShadow = '0 4px 18px rgba(15,23,42,.7)';

      wrap.innerHTML = `
        <span id="fgScore">คะแนน: 0</span>
        · <span id="fgTime">เวลา: 0s</span>
        · <span id="fgQuest">ภารกิจ: -</span>
      `;

      document.body.appendChild(wrap);

      this.wrap = wrap;
      this.scoreEl = document.getElementById('fgScore');
      this.timeEl = document.getElementById('fgTime');
      this.questEl = document.getElementById('fgQuest');
    },

    show() {
      if (!this.wrap) this.init();
      this.wrap.style.display = 'block';
    },

    hide() {
      if (this.wrap) this.wrap.style.display = 'none';
    },

    setScore(v) {
      if (!this.scoreEl) return;
      this.scoreEl.textContent = 'คะแนน: ' + v;
    },

    setTime(sec) {
      if (!this.timeEl) return;
      this.timeEl.textContent = 'เวลา: ' + sec + 's';
    },

    setQuest(text) {
      if (!this.questEl) return;
      this.questEl.textContent = 'ภารกิจ: ' + text;
    },

    reset() {
      this.setScore(0);
      this.setTime(0);
      this.setQuest('-');
    }
  };

  window.addEventListener('DOMContentLoaded', () => UI.init());

  ns.foodGroupsUI = UI;
})(window.GAME_MODULES);
