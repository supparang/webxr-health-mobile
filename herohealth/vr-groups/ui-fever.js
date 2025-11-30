// vr-groups/ui-fever.js
(function (ns) {
  'use strict';

  const UI = {
    wrap: null,
    scoreEl: null,
    timeEl: null,
    questEl: null,
    legendEl: null,
    hitFxEl: null,
    quitBtn: null,
    sceneEl: null,

    init() {
      if (this.wrap) return;

      // ===== แถบ HUD ด้านบน =====
      const wrap = document.createElement('div');
      wrap.id = 'fgHud';
      wrap.style.position = 'fixed';
      wrap.style.top = '10px';
      wrap.style.left = '50%';
      wrap.style.transform = 'translateX(-50%)';
      wrap.style.padding = '8px 16px 4px';
      wrap.style.borderRadius = '999px';
      wrap.style.background = 'rgba(15,23,42,.9)';
      wrap.style.color = '#e5e7eb';
      wrap.style.font = '600 14px system-ui, -apple-system, sans-serif';
      wrap.style.zIndex = '9999';
      wrap.style.display = 'none';
      wrap.style.boxShadow = '0 4px 18px rgba(15,23,42,.7)';

      wrap.innerHTML = `
        <div>
          <span id="fgScore">คะแนน: 0</span>
          · <span id="fgTime">เวลา: 0s</span>
          · <span id="fgQuest">ภารกิจ: -</span>
        </div>
        <div id="fgLegend"
             style="margin-top:4px;font-weight:500;font-size:12px;
                    opacity:.9;white-space:nowrap;">
        </div>
      `;

      document.body.appendChild(wrap);

      this.wrap    = wrap;
      this.scoreEl = document.getElementById('fgScore');
      this.timeEl  = document.getElementById('fgTime');
      this.questEl = document.getElementById('fgQuest');
      this.legendEl = document.getElementById('fgLegend');

      // ===== กล่องข้อความ HIT / MISS ใต้ HUD =====
      const fx = document.createElement('div');
      fx.id = 'fgHitFx';
      fx.style.position = 'fixed';
      fx.style.top = '56px';
      fx.style.left = '50%';
      fx.style.transform = 'translateX(-50%)';
      fx.style.font = '700 20px system-ui,-apple-system';
      fx.style.color = '#4ade80';
      fx.style.pointerEvents = 'none';
      fx.style.opacity = '0';
      fx.style.zIndex = '9999';
      document.body.appendChild(fx);
      this.hitFxEl = fx;
    },

    attachScene(sceneEl) {
      this.sceneEl = sceneEl;
      if (this.quitBtn) return;

      const btn = document.createElement('button');
      btn.id = 'fgQuitBtn';
      btn.textContent = 'ออกเกม';
      btn.style.position = 'fixed';
      btn.style.bottom = '12px';
      btn.style.left = '12px';
      btn.style.padding = '6px 12px';
      btn.style.font = '500 13px system-ui,-apple-system';
      btn.style.borderRadius = '999px';
      btn.style.border = '1px solid #f97373';
      btn.style.background = 'rgba(15,23,42,.9)';
      btn.style.color = '#fecaca';
      btn.style.cursor = 'pointer';
      btn.style.zIndex = '9999';
      btn.style.display = 'none';

      btn.addEventListener('click', () => {
        if (this.sceneEl) {
          this.sceneEl.emit('fg-stop', { reason: 'quit' });
        }
      });

      document.body.appendChild(btn);
      this.quitBtn = btn;
    },

    show() {
      if (!this.wrap) this.init();
      this.wrap.style.display = 'block';
      if (this.quitBtn) this.quitBtn.style.display = 'inline-block';
    },

    hide() {
      if (this.wrap) this.wrap.style.display = 'none';
      if (this.quitBtn) this.quitBtn.style.display = 'none';
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
      this.questEl.textContent = 'ภารกิจ: ' + (text || '-');
    },

    setLegend(groups) {
      if (!this.legendEl) return;
      if (!groups || !groups.length) {
        this.legendEl.textContent = '';
        return;
      }
      this.legendEl.innerHTML = groups.map(g => (
        `<span style="margin-right:8px;">
           ${g.id}: ${g.emoji} ${g.label}
         </span>`
      )).join('');
    },

    flashJudgment(opts) {
      if (!this.hitFxEl) return;
      const el = this.hitFxEl;
      const isMiss = !!opts.isMiss;
      const text = opts.text || (isMiss ? 'MISS' : `+${opts.scoreDelta || 0}`);

      el.textContent = text;
      if (isMiss) {
        el.style.color = '#fca5a5';
      } else if (opts.isQuestTarget) {
        el.style.color = '#facc15';
      } else {
        el.style.color = '#4ade80';
      }

      // reset animation
      el.style.transition = 'none';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,0)';
      // force reflow
      void el.offsetWidth;
      // animate fade-out
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-10px)';
    },

    reset() {
      this.setScore(0);
      this.setTime(0);
      this.setQuest('ฟังภารกิจจากโค้ช แล้วเล็งให้ถูกหมู่เลย! ✨');
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => UI.init());
  } else {
    UI.init();
  }

  ns.foodGroupsUI = UI;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
