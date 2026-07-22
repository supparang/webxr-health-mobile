(() => {
  'use strict';

  const VERSION = 'goodjunk-worker-v83-bootstrap-1.0.0';
  const NativeWorker = window.Worker;

  if (typeof NativeWorker === 'function' && !window.__GJ_WORKER_V83_PATCHED__) {
    const WorkerProxy = function WorkerProxy(url, options) {
      let resolved = url;
      try {
        const parsed = new URL(url, location.href);
        if (parsed.pathname.endsWith('/goodjunk-hand-worker-v8.js')) {
          parsed.search = '?v=20260722-83';
          resolved = parsed.href;
        }
      } catch (_) {}
      return new NativeWorker(resolved, options);
    };

    WorkerProxy.prototype = NativeWorker.prototype;
    Object.setPrototypeOf(WorkerProxy, NativeWorker);
    window.Worker = WorkerProxy;
    window.__GJ_WORKER_V83_PATCHED__ = true;
  }

  const statusText = state => {
    if (!state) return 'กำลังเตรียม Hand Tracking…';
    if (state.detected) return 'ตรวจพบมือแล้ว • ชี้ค้างเหนืออาหาร';
    if (state.reconnecting) return `กำลังเชื่อม Hand Tracking ใหม่ • ครั้งที่ ${state.retryCount || 1}`;
    if (state.workerStage === 'wasm') return 'กำลังโหลดระบบตรวจมือ…';
    if (state.workerStage === 'model') return 'กำลังโหลดโมเดลตรวจมือ…';
    if (state.workerReady) return 'Hand Tracking พร้อม • ถอยมือให้เห็นทั้งฝ่ามือ';
    if (state.workerError) return `Hand Tracking สะดุด • ${state.workerStage || 'worker'}`;
    return 'กำลังเริ่ม Hand Tracking…';
  };

  const syncStatus = () => {
    const box = document.querySelector('.missionBox');
    if (!box) return;
    const runtime = window.GJMobileHandV7;
    const state = runtime?.state;
    box.dataset.handStatus = statusText(state);
    if (state?.detected) {
      box.classList.remove('touchRescue');
      box.classList.add('handLite');
    }
  };

  window.setInterval(syncStatus, 300);
  syncStatus();
  console.info('[GoodJunk Worker Bootstrap]', VERSION, 'active');
})();
