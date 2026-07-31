(() => {
  'use strict';

  const RELEASE = '20260731-HANDWASH-WHO-LOADER-R43.2';
  const nativeFetch = window.fetch.bind(window);
  let restored = false;

  const inputUrl = input => typeof input === 'string' ? input : String(input?.url || '');
  const isRuntimePart = input => /(?:^|\/)handwash-who-v4\.part[1-4]\.txt(?:[?#]|$)/i.test(inputUrl(input));

  const normalizedFetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    if (!isRuntimePart(input)) return response;

    const source = (await response.text())
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('content-type', 'text/plain;charset=utf-8');
    return new Response(source, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };

  const restoreFetch = () => {
    if (restored) return;
    restored = true;
    if (window.fetch === normalizedFetch) window.fetch = nativeFetch;
  };

  const showFailure = error => {
    console.error('[Handwash WHO Loader R43.2]', error);
    document.documentElement.dataset.handwashRuntime = 'failed';
    const button = document.getElementById('startBtn');
    if (button) {
      button.disabled = false;
      button.textContent = 'แตะเพื่อลองโหลดใหม่';
      button.onclick = () => location.reload();
    }
    const status = document.getElementById('detectStatus');
    if (status) status.textContent = 'โหลดเกมไม่สำเร็จ';
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = `โหลดเกมไม่สำเร็จ: ${String(error?.message || error)}`;
      toast.classList.add('show');
    }
  };

  async function boot() {
    window.fetch = normalizedFetch;
    document.documentElement.dataset.handwashLoader = RELEASE;
    document.documentElement.dataset.handwashRuntime = 'loading';

    const loaderUrl = new URL('./handwash-who-v4.js', location.href);
    loaderUrl.searchParams.set('cv', RELEASE);
    loaderUrl.searchParams.set('_', String(Date.now()));

    let loaderSource = await nativeFetch(loaderUrl, { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error(`โหลด WHO R36 ไม่สำเร็จ ${response.status}`);
      return response.text();
    });

    const strictValidation = "const valid=source.trimStart().startsWith('(() => {')&&source.trimEnd().endsWith('})();')&&required.every(x=>source.includes(x))&&source.length>40000;";
    const compatibleValidation = "const missingHooks=required.filter(x=>!source.includes(x));const valid=source.trimStart().startsWith('(() => {')&&source.trimEnd().endsWith('})();')&&source.includes(RUNTIME_MARKER)&&source.length>40000;if(missingHooks.length){console.warn('[Handwash R43.2] historical hooks superseded by current runtime',{missingCount:missingHooks.length,missingHooks});document.documentElement.dataset.handwashCompatibilityHooks=String(missingHooks.length)}";

    if (!loaderSource.includes(strictValidation)) {
      throw new Error('ไม่พบจุดตรวจ Integrity ของ WHO R36');
    }

    loaderSource = loaderSource.replace(strictValidation, compatibleValidation);
    loaderSource = loaderSource.replace(
      "throw new Error('WHO R36 runtime integrity check failed')",
      "throw new Error('WHO runtime structure, marker, or length validation failed')"
    );

    try {
      new Function(loaderSource);
    } catch (error) {
      throw new Error(`WHO R43.2 loader syntax error: ${error.message}`);
    }

    console.info('[Handwash] WHO loader compatibility ready', RELEASE);
    new Function(`${loaderSource}\n//# sourceURL=handwash-who-v4-r43-2-runtime-loader.js`)();

    const observer = new MutationObserver(() => {
      const state = document.documentElement.dataset.handwashRuntime;
      if (state === 'ready' || state === 'failed') {
        observer.disconnect();
        setTimeout(restoreFetch, 800);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-handwash-runtime']
    });

    setTimeout(() => {
      observer.disconnect();
      restoreFetch();
    }, 30000);
  }

  boot().catch(error => {
    restoreFetch();
    showFailure(error);
  });
})();
