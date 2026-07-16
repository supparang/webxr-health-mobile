(() => {
  'use strict';
  const VERSION = '20260716-WHO-V4-R2-START-FIX';
  const RUNTIME_MARKER = '20260716-HANDWASH-WHO-V4-R1';
  const DOM_HOOK = "document.addEventListener('DOMContentLoaded', init);";
  const DOM_FIX = "if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init, {once:true}); } else { init(); }";
  const files = [1,2,3,4].map(n => `./handwash-who-v4.part${n}.txt?v=${VERSION}`);

  Promise.all(files.map(url => fetch(url,{cache:'no-store'}).then(response => {
    if(!response.ok) throw new Error(`load failed ${response.status}: ${url}`);
    return response.text();
  }))).then(parts => {
    const source = parts.join('');
    const valid = source.trimStart().startsWith('(() => {') &&
      source.trimEnd().endsWith('})();') &&
      source.includes(RUNTIME_MARKER) &&
      source.includes(DOM_HOOK) &&
      source.length > 40000;

    if(!valid) throw new Error('WHO runtime integrity check failed');

    const runtime = source.replace(DOM_HOOK, DOM_FIX);
    if(!runtime.includes(DOM_FIX)) throw new Error('WHO runtime DOM-ready patch failed');

    const blobUrl = URL.createObjectURL(new Blob([runtime],{type:'text/javascript;charset=utf-8'}));
    const script = document.createElement('script');
    script.src = blobUrl;
    script.async = false;
    script.dataset.handwashWhoRuntime = VERSION;
    script.onload = () => {
      document.documentElement.dataset.handwashRuntime = 'ready';
      URL.revokeObjectURL(blobUrl);
    };
    script.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      showFailure('compiled runtime could not start');
    };
    document.head.appendChild(script);
  }).catch(error => showFailure(error?.message || String(error)));

  function showFailure(message){
    console.error('Handwash WHO loader',message);
    document.documentElement.dataset.handwashRuntime = 'failed';
    const status=document.getElementById('detectStatus');
    if(status) status.textContent='โหลดเกมไม่สำเร็จ';
    const start=document.getElementById('startBtn');
    if(start){
      start.disabled=true;
      start.textContent='โหลดไม่สำเร็จ • แตะรีเฟรชหน้า';
    }
    const toast=document.getElementById('toast');
    if(toast){toast.textContent='โหลด WHO Technique ไม่สำเร็จ กรุณารีเฟรช';toast.classList.add('show');}
  }
})();
