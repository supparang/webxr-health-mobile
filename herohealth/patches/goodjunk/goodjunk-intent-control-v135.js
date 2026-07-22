(() => {
  'use strict';
  const VERSION = 'goodjunk-intent-control-v13.5.0';
  let wrapped = false;

  const install = () => {
    if (wrapped || typeof window.__GJ_MAGNET_TARGET__ !== 'function') return;
    const original = window.__GJ_MAGNET_TARGET__;
    window.__GJ_MAGNET_TARGET__ = (x, y, preferredId = '') => {
      const target = original(x, y, preferredId);
      if (!target) return null;
      const distance = Math.hypot(target.x - x, target.y - y);
      const enterRadius = Number(target.r || 50) + 34;
      const keepRadius = Number(target.r || 50) + 48;
      const allowed = preferredId && target.id === preferredId ? keepRadius : enterRadius;
      return distance <= allowed ? { ...target, distance } : null;
    };
    wrapped = true;
    window.__GJ_INTENT_CONTROL__ = { version: VERSION, enterPadding: 34, keepPadding: 48 };
    console.info('[GoodJunk Intent Control]', VERSION, 'installed');
  };

  const timer = window.setInterval(() => {
    install();
    if (wrapped) window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 20000);
})();
