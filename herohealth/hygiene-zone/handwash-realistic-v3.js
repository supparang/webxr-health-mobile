(() => {
  'use strict';
  const VERSION = '20260716-r1';
  const files = [1,2,3,4].map(n => `./handwash-realistic-v3.part${n}.txt?v=${VERSION}`);
  Promise.all(files.map(url => fetch(url, { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error(`load failed ${response.status}: ${url}`);
    return response.text();
  }))).then(parts => {
    (0, eval)(parts.join(''));
  }).catch(error => {
    console.error('Handwash Reality Lab loader', error);
    const node = document.getElementById('detectStatus');
    if (node) node.textContent = 'โหลดเกมไม่สำเร็จ';
    const toast = document.getElementById('toast');
    if (toast) { toast.textContent = 'โหลด Handwash V3 ไม่สำเร็จ กรุณารีเฟรช'; toast.classList.add('show'); }
  });
})();
