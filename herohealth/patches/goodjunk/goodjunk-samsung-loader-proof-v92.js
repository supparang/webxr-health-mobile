(() => {
  'use strict';
  const isSamsung = /SamsungBrowser/i.test(navigator.userAgent || '');
  document.documentElement.dataset.goodjunkRuntime = isSamsung ? 'samsung-mainthread-v92' : 'worker-v83';
  window.__GJ_RUNTIME_PROOF__ = {
    release: '20260722-SAMSUNG-DIRECT-V92',
    samsung: isSamsung,
    runtime: isSamsung ? 'goodjunk-mobile-hand-runtime-v9.js' : 'goodjunk-mobile-handlandmarker-v7.js'
  };
  console.info('[GoodJunk Runtime Proof]', window.__GJ_RUNTIME_PROOF__);
})();
