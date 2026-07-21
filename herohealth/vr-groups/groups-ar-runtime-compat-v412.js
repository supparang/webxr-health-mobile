(() => {
  'use strict';

  const PATCH = 'groups-ar-runtime-compat-v4.1.2';
  const ua = String(navigator.userAgent || '');
  const isSamsungInternet = /SamsungBrowser/i.test(ua);
  const isAndroidWebView = /; wv\)/i.test(ua) || (/Android/i.test(ua) && /Version\/\d+/i.test(ua));
  const hasDecompressionName = typeof window.DecompressionStream === 'function';

  /* Samsung Internet can expose the API name but still fail on gzip streams. */
  const useNativeRuntime = hasDecompressionName && !isSamsungInternet && !isAndroidWebView;

  function copyParams(path) {
    const source = new URLSearchParams(location.search);
    const target = new URL(path, location.href);
    source.forEach((value, key) => target.searchParams.set(key, value));
    return target;
  }

  function patchRoutes() {
    const qa = () => location.assign(copyParams('./vr-groups/groups-ar-check-v2.html'));
    const zone = () => {
      const hub = new URLSearchParams(location.search).get('hub') || './nutrition-zone.html';
      location.assign(new URL(hub, location.href));
    };
    const cooldown = () => {
      const zoneUrl = copyParams('./nutrition-zone.html');
      const gate = copyParams('./groups-ar-gate.html');
      gate.searchParams.set('phase', 'cooldown');
      gate.searchParams.set('next', zoneUrl.toString());
      gate.searchParams.set('back', zoneUrl.toString());
      gate.searchParams.set('hub', zoneUrl.toString());
      try {
        if (localStorage.getItem('HHA_GROUPS_AR_LAST_RESULT')) gate.searchParams.set('result', 'local');
      } catch (_) {}
      location.assign(gate);
    };

    const qaBtn = document.getElementById('qaBtn');
    const openQa = document.getElementById('openQa');
    const zoneBtn = document.getElementById('zoneBtn');
    const sumZone = document.getElementById('sumZone');
    if (qaBtn) qaBtn.onclick = qa;
    if (openQa) openQa.onclick = qa;
    if (zoneBtn) zoneBtn.onclick = zone;
    if (sumZone) sumZone.onclick = cooldown;
  }

  function updateModeLabel(mode) {
    document.documentElement.dataset.groupsRuntime = mode;
    const cameraText = document.getElementById('cameraText');
    if (cameraText && cameraText.textContent === 'ยังไม่เริ่ม') {
      cameraText.textContent = mode === 'legacy' ? 'Compatible Mode' : 'Ready';
    }
  }

  function load(path, onLoaded, onFailed) {
    const script = document.createElement('script');
    script.src = path;
    script.async = false;
    script.dataset.groupsRuntimeLoader = PATCH;
    script.onload = onLoaded;
    script.onerror = onFailed;
    document.head.appendChild(script);
  }

  function renderLoadError() {
    document.body.innerHTML = [
      '<main style="min-height:100dvh;padding:28px;font-family:system-ui;background:#103c3a;color:white">',
      '<h1>โหลดไฟล์เกมไม่ครบ</h1>',
      '<p>กรุณาตรวจอินเทอร์เน็ต แล้วกดปุ่มลองใหม่</p>',
      '<button onclick="location.reload()" style="min-height:48px;padding:10px 16px;border:0;border-radius:14px;font:inherit;font-weight:900">ลองใหม่</button>',
      '</main>'
    ].join('');
  }

  function loadLegacy(reason) {
    updateModeLabel('legacy');
    load(
      './vr-groups/groups-ar-runtime-v311.js?v=20260721-samsung-direct-v412',
      () => {
        patchRoutes();
        window.dispatchEvent(new CustomEvent('groups-runtime-ready', {
          detail: { patch: PATCH, mode: 'legacy', reason }
        }));
        console.info('[Groups AR Runtime]', PATCH, 'legacy', reason);
      },
      renderLoadError
    );
  }

  if (!useNativeRuntime) {
    const reason = isSamsungInternet
      ? 'Samsung Internet forced legacy runtime'
      : isAndroidWebView
        ? 'Android WebView forced legacy runtime'
        : 'DecompressionStream unavailable';
    loadLegacy(reason);
    return;
  }

  updateModeLabel('native');
  load(
    './vr-groups/groups-ar-runtime-v400.js?v=20260721-gameplay-v4',
    () => {
      patchRoutes();
      window.dispatchEvent(new CustomEvent('groups-runtime-ready', {
        detail: { patch: PATCH, mode: 'native' }
      }));
      console.info('[Groups AR Runtime]', PATCH, 'native runtime');
    },
    () => loadLegacy('native runtime script failed')
  );
})();
