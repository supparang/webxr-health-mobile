(() => {
  'use strict';

  const PATCH = 'groups-ar-runtime-compat-v4.1.1';
  const hasNativeDecompression = typeof window.DecompressionStream === 'function';
  const runtimePath = hasNativeDecompression
    ? './vr-groups/groups-ar-runtime-v400.js?v=20260721-gameplay-v4'
    : './vr-groups/groups-ar-runtime-v311.js?v=20260717-5';

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
        if (localStorage.getItem('HHA_GROUPS_AR_LAST_RESULT')) {
          gate.searchParams.set('result', 'local');
        }
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

  function showLegacyNotice() {
    document.documentElement.dataset.groupsRuntime = 'legacy';
    const cameraText = document.getElementById('cameraText');
    if (cameraText && cameraText.textContent === 'ยังไม่เริ่ม') {
      cameraText.textContent = 'Compatible Mode';
    }
    console.info('[Groups AR Runtime]', PATCH, 'legacy fallback');
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

  function loadLegacy(reason) {
    showLegacyNotice();
    load(
      './vr-groups/groups-ar-runtime-v311.js?v=20260717-5',
      () => {
        patchRoutes();
        window.dispatchEvent(new CustomEvent('groups-runtime-ready', {
          detail: { patch: PATCH, mode: 'legacy', reason }
        }));
      },
      () => {
        document.body.innerHTML = [
          '<main style="min-height:100dvh;padding:28px;font-family:system-ui;background:#103c3a;color:white">',
          '<h1>เปิดเกมไม่สำเร็จ</h1>',
          '<p>ไฟล์เกมโหลดไม่ครบ กรุณาตรวจอินเทอร์เน็ตแล้วกดรีเฟรชอีกครั้ง</p>',
          '<button onclick="location.reload()" style="min-height:48px;padding:10px 16px;border:0;border-radius:14px;font:inherit;font-weight:900">ลองใหม่</button>',
          '</main>'
        ].join('');
      }
    );
  }

  if (!hasNativeDecompression) {
    loadLegacy('DecompressionStream unavailable');
    return;
  }

  document.documentElement.dataset.groupsRuntime = 'native';
  load(
    runtimePath,
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
