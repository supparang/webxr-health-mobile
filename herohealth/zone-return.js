(function (W, D) {
  'use strict';

  const byId = (id) => D.getElementById(id);
  const toast = byId('toast');

  const ZONES = {
    hygiene: './hygiene-zone.html',
    nutrition: './nutrition-zone.html',
    fitness: './fitness-zone.html'
  };

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    W.clearTimeout(showToast._timer);
    showToast._timer = W.setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function readLastGame() {
    try {
      return localStorage.getItem('HH_FITNESS_LAST_GAME_V1') ||
        localStorage.getItem('HHA_LAST_ZONE') ||
        '';
    } catch (_) {
      return '';
    }
  }

  function pickRecommendedUrl() {
    const last = String(readLastGame() || '').toLowerCase();
    if (last.includes('hygiene')) return ZONES.hygiene;
    if (last.includes('nutrition')) return ZONES.nutrition;
    return ZONES.fitness;
  }

  function bindLinks() {
    const recommended = byId('btnQuickRecommended');
    if (recommended) recommended.href = pickRecommendedUrl();

    const allGames = byId('btnQuickAllGames');
    if (allGames) allGames.href = ZONES.fitness;
  }

  function bindButtons() {
    const btnSettings = byId('btnSettings');
    const btnRewards = byId('btnRewards');

    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        showToast('หน้า local app พร้อมใช้งานแล้ว');
      });
    }

    if (btnRewards) {
      btnRewards.addEventListener('click', () => {
        showToast('รางวัลจะอิงจากผลการเล่นในแต่ละโซน');
      });
    }
  }

  function refreshProfile() {
    const quickline = byId('heroQuickline');
    if (quickline) {
      quickline.textContent = 'เริ่มจาก Fitness ได้เลย หรือเลือกโซนที่ต้องการจากการ์ดด้านล่าง';
    }
  }

  function boot() {
    bindLinks();
    bindButtons();
    refreshProfile();
  }

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window, document);
