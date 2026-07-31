(() => {
  'use strict';

  const RELEASE = '20260731-HANDWASH-RUNTIME-SOURCE-NORMALIZER-R39.1';
  const nativeFetch = window.fetch.bind(window);
  let restored = false;

  const isWhoRuntimePart = input => {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    return /(?:^|\/)handwash-who-v4\.part[1-4]\.txt(?:[?#]|$)/i.test(url);
  };

  const normalizedFetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    if (!isWhoRuntimePart(input)) return response;

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

  const restore = () => {
    if (restored) return;
    restored = true;
    if (window.fetch === normalizedFetch) window.fetch = nativeFetch;
  };

  window.fetch = normalizedFetch;
  document.documentElement.dataset.handwashSourceNormalizer = RELEASE;

  const observer = new MutationObserver(() => {
    const state = document.documentElement.dataset.handwashRuntime;
    if (state === 'ready' || state === 'failed') {
      observer.disconnect();
      setTimeout(restore, 500);
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-handwash-runtime'] });

  setTimeout(() => {
    observer.disconnect();
    restore();
  }, 20000);

  console.info('[Handwash] WHO runtime source normalizer ready', RELEASE);
})();
