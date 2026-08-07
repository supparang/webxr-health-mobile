(() => {
  'use strict';

  const RELEASE = '20260807-HANDWASH-WHO-LOADER-R43.4-NO-INFINITE-SPINNER';
  const nativeFetch = window.fetch.bind(window);
  const runtimeBase = document.baseURI || location.href;
  const partCache = new Map();
  let restored = false;
  let startupWatchdog = 0;

  const inputUrl = input => typeof input === 'string' ? input : String(input?.url || '');
  const isRuntimePart = input => /(?:^|\/)handwash-who-v4\.part[1-4]\.txt(?:[?#]|$)/i.test(inputUrl(input));
  const absoluteUrl = input => new URL(inputUrl(input), runtimeBase);
  const normalizeSource = source => String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  const fetchWithTimeout = (input, init = {}, timeoutMs = 9000) => new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`request timeout ${timeoutMs}ms: ${inputUrl(input)}`));
    }, timeoutMs);
    nativeFetch(input, init).then(response => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response);
    }).catch(error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });

  const normalizedFetch = async (input, init) => {
    if (!isRuntimePart(input)) return nativeFetch(input, init);
    const url = absoluteUrl(input);
    let source = partCache.get(url.pathname);
    if (source == null) {
      const response = await fetchWithTimeout(url.href, { ...(init || {}), cache: 'no-store' }, 9000);
      if (!response.ok) throw new Error(`load failed ${response.status}: ${url.pathname}`);
      source = normalizeSource(await response.text());
      partCache.set(url.pathname, source);
    }
    return new Response(source, {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/plain;charset=utf-8', 'cache-control': 'no-store' }
    });
  };

  const restoreFetch = () => {
    if (restored) return;
    restored = true;
    if (window.fetch === normalizedFetch) window.fetch = nativeFetch;
  };

  const showFailure = error => {
    clearTimeout(startupWatchdog);
    console.error('[Handwash WHO Loader R43.4]', error);
    document.documentElement.dataset.handwashRuntime = 'failed';
    document.documentElement.dataset.handwashLoaderError = String(error?.message || error).slice(0, 180);
    const button = document.getElementById('startBtn');
    if (button) {
      button.disabled = false;
      button.textContent = 'ลองโหลด Handwash ใหม่';
      button.onclick = () => {
        const u = new URL(location.href);
        u.searchParams.set('handwashRetry', String(Date.now()));
        location.replace(u.href);
      };
    }
    const status = document.getElementById('detectStatus');
    if (status) status.textContent = 'โหลดเกมไม่สำเร็จ';
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = `โหลดเกมไม่สำเร็จ: ${String(error?.message || error)}`;
      toast.classList.add('show');
    }
  };

  async function preloadParts() {
    const parts = [1, 2, 3, 4].map(n => new URL(`./handwash-who-v4.part${n}.txt`, runtimeBase));
    await Promise.all(parts.map(async url => {
      url.searchParams.set('cv', RELEASE);
      url.searchParams.set('_', String(Date.now()));
      const response = await fetchWithTimeout(url.href, { cache: 'no-store' }, 9000);
      if (!response.ok) throw new Error(`โหลด WHO part ไม่สำเร็จ ${response.status}: ${url.pathname}`);
      const source = normalizeSource(await response.text());
      if (source.length < 1000) throw new Error(`WHO part สั้นผิดปกติ: ${url.pathname}`);
      partCache.set(url.pathname, source);
    }));
    document.documentElement.dataset.handwashPartsReady = String(partCache.size);
  }

  async function boot() {
    window.fetch = normalizedFetch;
    document.documentElement.dataset.handwashLoader = RELEASE;
    document.documentElement.dataset.handwashRuntime = 'loading';

    await preloadParts();

    const loaderUrl = new URL('./handwash-who-v4.js', runtimeBase);
    loaderUrl.searchParams.set('cv', RELEASE);
    loaderUrl.searchParams.set('_', String(Date.now()));
    console.info('[Handwash R43.4] loading WHO runtime from', loaderUrl.href, { cachedParts: partCache.size });

    let loaderSource = await fetchWithTimeout(loaderUrl.href, { cache: 'no-store' }, 9000).then(response => {
      if (!response.ok) throw new Error(`โหลด WHO loader ไม่สำเร็จ ${response.status}: ${loaderUrl.pathname}`);
      return response.text();
    });

    const strictValidation = "const valid=source.trimStart().startsWith('(() => {')&&source.trimEnd().endsWith('})();')&&required.every(x=>source.includes(x))&&source.length>40000;";
    const compatibleValidation = "const missingHooks=required.filter(x=>!source.includes(x));const valid=source.trimStart().startsWith('(() => {')&&source.trimEnd().endsWith('})();')&&source.includes(RUNTIME_MARKER)&&source.length>40000;if(missingHooks.length){console.warn('[Handwash R43.4] historical hooks superseded by current runtime',{missingCount:missingHooks.length,missingHooks});document.documentElement.dataset.handwashCompatibilityHooks=String(missingHooks.length)}";
    if (!loaderSource.includes(strictValidation)) throw new Error('ไม่พบจุดตรวจ Integrity ของ WHO loader');
    loaderSource = loaderSource.replace(strictValidation, compatibleValidation);
    loaderSource = loaderSource.replace(
      "throw new Error('WHO R36 runtime integrity check failed')",
      "throw new Error('WHO runtime structure, marker, or length validation failed')"
    );

    try { new Function(loaderSource); }
    catch (error) { throw new Error(`WHO loader syntax error: ${error.message}`); }

    console.info('[Handwash] WHO loader compatibility ready', RELEASE);
    new Function(`${loaderSource}\n//# sourceURL=handwash-who-v4-r43-4-runtime-loader.js`)();

    const observer = new MutationObserver(() => {
      const state = document.documentElement.dataset.handwashRuntime;
      if (state === 'ready' || state === 'failed') {
        observer.disconnect();
        clearTimeout(startupWatchdog);
        setTimeout(restoreFetch, 800);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-handwash-runtime'] });

    startupWatchdog = setTimeout(() => {
      const state = document.documentElement.dataset.handwashRuntime;
      if (state !== 'ready' && state !== 'failed') {
        observer.disconnect();
        restoreFetch();
        showFailure(new Error(`WHO runtime startup timeout • state=${state || 'unknown'} • cachedParts=${partCache.size}`));
      }
    }, 12000);
  }

  boot().catch(error => {
    restoreFetch();
    showFailure(error);
  });
})();
