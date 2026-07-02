(() => {
  'use strict';
  const path = location.pathname.toLowerCase();
  const labels = path.includes('w1-')
    ? ['W1 • นักสืบปัญหา UX', 'คดี UX: ตามหาต้นตอปัญหา']
    : path.includes('w2-')
      ? ['W2 • คิดเชิงออกแบบ', 'ภารกิจคิดเชิงออกแบบ']
      : path.includes('w3-')
        ? ['W3 • ลดภาระความคิด', 'ด่านลดภาระความคิด']
        : path.includes('b1-')
          ? ['B1 • ด่านบอส', 'บอสพายุความสับสน']
          : null;
  if (!labels) return;
  function apply() {
    const kicker = document.querySelector('.uxq-hero .uxq-kicker');
    const title = document.querySelector('.uxq-hero h1');
    if (kicker) kicker.textContent = labels[0];
    if (title) title.textContent = labels[1];
  }
  addEventListener('DOMContentLoaded', apply, { once: true });
})();