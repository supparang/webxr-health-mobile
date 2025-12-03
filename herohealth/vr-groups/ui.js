// === vr-groups/ui.js (2025-12-03 Production Ready) ===
// UI สำหรับ Goal + Mini Quest บน HUD ของ GroupsVR

(function (ns) {
  'use strict';

  let elGoal = null;
  let elMini = null;

  function ensureUI() {
    if (elGoal && elMini) return;

    // กล่อง HUD
    let hud = document.getElementById('fg-quest-panel');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'fg-quest-panel';
      hud.style.position = 'fixed';
      hud.style.top = '12px';
      hud.style.left = '50%';
      hud.style.transform = 'translateX(-50%)';
      hud.style.zIndex = '600';
      hud.style.pointerEvents = 'none';
      hud.style.display = 'flex';
      hud.style.flexDirection = 'column';
      hud.style.alignItems = 'center';
      hud.style.gap = '6px';
      document.body.appendChild(hud);
    }

    // Goal
    elGoal = document.createElement('div');
    elGoal.style.background = 'rgba(15,23,42,0.9)';
    elGoal.style.color = '#facc15';
    elGoal.style.padding = '6px 12px';
    elGoal.style.fontSize = '13px';
    elGoal.style.border = '1px solid rgba(250,204,21,0.45)';
    elGoal.style.borderRadius = '14px';
    elGoal.style.fontWeight = '600';
    elGoal.style.textAlign = 'center';
    elGoal.style.minWidth = '220px';
    elGoal.style.boxShadow = '0 8px 20px rgba(0,0,0,0.35)';

    // Mini
    elMini = document.createElement('div');
    elMini.style.background = 'rgba(15,23,42,0.9)';
    elMini.style.color = '#34d399';
    elMini.style.padding = '6px 12px';
    elMini.style.fontSize = '12px';
    elMini.style.border = '1px solid rgba(52,211,153,0.45)';
    elMini.style.borderRadius = '14px';
    elMini.style.fontWeight = '500';
    elMini.style.textAlign = 'center';
    elMini.style.minWidth = '200px';
    elMini.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25)';

    hud.appendChild(elGoal);
    hud.appendChild(elMini);
  }

  // ---------------------------------------------------------
  // อัปเดตจาก quest-manager.js
  // ---------------------------------------------------------
  window.addEventListener('quest:update', (e) => {
    ensureUI();
    const d = e.detail;

    if (d.goal) {
      const g = d.goal;
      elGoal.textContent =
        `🎯 ${g.label}  (${g.prog}/${g.target})`;
    }

    if (d.mini) {
      const m = d.mini;
      if (m.type === 'avoid') {
        elMini.textContent = `⚡ เลี่ยง Junk ${m.target || 1} / ${m.prog}`;
      } else {
        elMini.textContent =
          `✨ ${m.label}  (${m.prog}/${m.target})`;
      }
    }
  });

  // ---------------------------------------------------------
  // เอฟเฟกต์เมื่อผ่าน quest (goal/mini)
  // ---------------------------------------------------------
  window.addEventListener('quest:clear-goal', () => {
    ensureUI();
    elGoal.style.background = 'rgba(250,204,21,0.22)';
    elGoal.style.color = '#facc15';
    elGoal.style.borderColor = 'rgba(250,204,21,0.8)';
    elGoal.style.fontWeight = '700';
    elGoal.textContent = '🎉 สำเร็จ! — Goal ผ่านแล้ว';
  });

  window.addEventListener('quest:clear-mini', () => {
    ensureUI();
    elMini.style.background = 'rgba(52,211,153,0.22)';
    elMini.style.color = '#34d399';
    elMini.style.borderColor = 'rgba(52,211,153,0.75)';
    elMini.style.fontWeight = '700';
    elMini.textContent = '💫 Mini Quest สำเร็จ!';
  });

  ns.foodGroupsUI = { ensureUI };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));