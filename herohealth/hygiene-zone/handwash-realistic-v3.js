(() => {
  'use strict';

  const VERSION = '20260716-r2';
  const files = [1, 2, 3, 4].map(
    number => `./handwash-realistic-v3.part${number}.txt?v=${VERSION}`
  );

  Promise.all(
    files.map(url => fetch(url, { cache: 'no-store' }).then(response => {
      if (!response.ok) {
        throw new Error(`load failed ${response.status}: ${url}`);
      }
      return response.text();
    }))
  ).then(parts => {
    const source = parts.join('');
    const startsCorrectly = source.trimStart().startsWith('(() => {');
    const endsCorrectly = source.trimEnd().endsWith('})();');
    const hasVersion = source.includes('20260716-HANDWASH-REALITY-LAB-V3-R1');

    if (!startsCorrectly || !endsCorrectly || !hasVersion || source.length < 45000) {
      throw new Error('runtime integrity check failed');
    }

    const blob = new Blob([source], { type: 'text/javascript;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const script = document.createElement('script');

    script.src = blobUrl;
    script.async = false;
    script.dataset.handwashRuntime = VERSION;

    script.addEventListener('load', () => {
      URL.revokeObjectURL(blobUrl);
    }, { once: true });

    script.addEventListener('error', () => {
      URL.revokeObjectURL(blobUrl);
      showLoadFailure(new Error('compiled runtime could not start'));
    }, { once: true });

    document.head.appendChild(script);
  }).catch(showLoadFailure);

  function showLoadFailure(error) {
    console.error('Handwash Reality Lab loader', error);

    const status = document.getElementById('detectStatus');
    if (status) status.textContent = 'โหลดเกมไม่สำเร็จ';

    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'โหลด Handwash V3 ไม่สำเร็จ กรุณารีเฟรช';
      toast.classList.add('show');
    }
  }
})();
