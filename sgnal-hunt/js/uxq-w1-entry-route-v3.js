/* UX Quest • W1 Case Pressure route bridge
   Keeps the existing Mission Control layout while routing W1 to the expanded v3 case bank.
*/
(() => {
  'use strict';
  const route = './w1-ux-detective-casefile-v3.html';

  function href(){
    const next = new URL(route, location.href);
    const current = new URL(location.href);
    ['classroom', 'uxqClassroom', 'section', 'uxqSection'].forEach((key) => {
      const value = current.searchParams.get(key);
      if (value) next.searchParams.set(key, value);
    });
    return next.href;
  }

  function open(event){
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    location.assign(href());
  }

  function patch(){
    const launch = document.getElementById('nowLaunch');
    const title = document.getElementById('w1Title')?.textContent || '';
    const week = document.getElementById('nowWeek')?.textContent || '';
    if (launch && (/UX Detective/i.test(title) || /W1/i.test(week))) {
      launch.href = href();
      launch.onclick = open;
    }

    const path = document.getElementById('pathW1');
    if (path) {
      path.setAttribute('role', 'link');
      path.setAttribute('tabindex', '0');
      path.setAttribute('aria-label', 'เปิด S1 / W1 UX Detective: Casefile Hunt');
      path.onclick = open;
      path.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') open(event);
      };
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#pathW1')) return open(event);
    const launch = target.closest('#nowLaunch');
    const title = document.getElementById('w1Title')?.textContent || '';
    const week = document.getElementById('nowWeek')?.textContent || '';
    if (launch && (/UX Detective/i.test(title) || /W1/i.test(week))) open(event);
  }, true);

  document.addEventListener('DOMContentLoaded', patch);
  window.addEventListener('uxq-progress-updated', () => window.setTimeout(patch, 0));
})();
