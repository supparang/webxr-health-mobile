(() => {
  'use strict';

  const PATCH = 'groups-ar-runtime-compat-v4.1.4-classroom-stable';

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

  function updateModeLabel() {
    document.documentElement.dataset.groupsRuntime = 'legacy';
    const cameraText = document.getElementById('cameraText');
    if (cameraText && cameraText.textContent === 'ยังไม่เริ่ม') {
      cameraText.textContent = 'Compatible Mode';
    }
  }

  function renderLoadError() {
    document.body.innerHTML = [
      '<main style="min-height:100dvh;padding:28px;font-family:system-ui;background:#103c3a;color:white">',
      '<h1>เปิดเกมไม่สำเร็จ</h1>',
      '<p>ไฟล์เกมโหลดไม่ครบ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่</p>',
      '<button onclick="location.reload()" style="min-height:48px;padding:10px 16px;border:0;border-radius:14px;font:inherit;font-weight:900">ลองใหม่</button>',
      '</main>'
    ].join('');
  }

  function loadStableRuntime() {
    updateModeLabel();
    const script = document.createElement('script');
    script.src = './vr-groups/groups-ar-runtime-v311.js?v=20260722-classroom-stable-v414';
    script.async = false;
    script.dataset.groupsRuntimeLoader = PATCH;
    script.onload = () => {
      patchRoutes();
      window.dispatchEvent(new CustomEvent('groups-runtime-ready', {
        detail: { patch: PATCH, mode: 'legacy', reason: 'classroom stable runtime' }
      }));
      console.info('[Groups AR Runtime]', PATCH, 'stable compatible runtime');
    };
    script.onerror = renderLoadError;
    document.head.appendChild(script);
  }

  /*
   * Classroom Mode uses one stable runtime on every browser.
   * This avoids the compressed native runtime failure seen inside Game Shell,
   * especially during QA on desktop Chrome and on mixed Android devices.
   */
  loadStableRuntime();
})();