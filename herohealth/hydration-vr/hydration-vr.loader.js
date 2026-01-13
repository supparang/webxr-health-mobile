// === /herohealth/hydration-vr/hydration-vr.loader.js ===
'use strict';

(async function(){
  const q = new URLSearchParams(location.search);
  const bust = q.get('v') || q.get('ts') || String(Date.now());

  const candidates = [
    `./hydration.safe.js?v=${encodeURIComponent(bust)}`
  ];

  async function fetchOk(url){
    try{
      const r = await fetch(url, { cache:'no-store' });
      return { ok:r.ok, status:r.status };
    }catch(e){
      return { ok:false, status:0, err:e };
    }
  }

  function showFail(lines, err){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.92);color:#e5e7eb;font-family:system-ui;padding:16px;overflow:auto';
    el.innerHTML = `
      <div style="max-width:900px;margin:0 auto">
        <h2 style="margin:0 0 10px 0;font-size:18px">❌ HydrationVR: import failed</h2>
        <div style="opacity:.9;margin-bottom:10px">URL: <code>${location.href}</code></div>
        <div style="margin:12px 0 8px 0;font-weight:700">Checks:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${lines.join('\n')}</pre>
        <div style="margin:12px 0 6px 0;font-weight:700">Error:</div>
        <pre style="white-space:pre-wrap;background:rgba(15,23,42,.75);padding:12px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${String(err && (err.stack||err.message||err))}</pre>
        <div style="opacity:.8;margin-top:10px">Tip: ถ้า hydration.safe.js OK แต่พัง ให้เปิดดู Network จะเห็น 404 ที่ ../vr/ui-water.js หรือ ../vr/ai-coach.js</div>
      </div>
    `;
    document.body.appendChild(el);
  }

  const logs = [];
  for (const url of candidates){
    const chk = await fetchOk(url);
    logs.push(`${url}  -> ${chk.ok ? 'OK' : 'FAIL'} ${chk.status ? '(HTTP '+chk.status+')' : ''}`);
    if (!chk.ok) continue;

    try{
      await import(url);
      logs.push('import() -> OK');
      return;
    }catch(err){
      logs.push('import() -> ERROR (มักเกิดจาก dependency 404 หรือ export ชื่อไม่ตรง)');
      showFail(logs, err);
      return;
    }
  }

  showFail(logs, new Error('hydration.safe.js not found on Pages (404)'));
})();