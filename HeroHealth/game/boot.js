// === Hero Health Academy — game/boot.js (v2.2 resilient+dev tools) ===
window.__HHA_BOOT_OK  = 'boot';
window.__HHA_BOOT_ERR = null;
window.__HHA_BOOT_LOG = [];

function qsBool(name){ return /^(1|true|yes)$/i.test(new URL(location.href).searchParams.get(name)||''); }
function qsStr(name){  return new URL(location.href).searchParams.get(name); }

function ensureWarn() {
  let w = document.getElementById('bootWarn');
  if (!w) {
    w = document.createElement('div');
    w.id = 'bootWarn';
    w.style.cssText = [
      'position:fixed','inset:auto 0 0 0','background:#b00020','color:#fff',
      'padding:10px 12px','font:700 14px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto',
      'z-index:10000','display:none','box-shadow:0 -6px 18px #0006'
    ].join(';');
    w.innerHTML = `
      <div style="margin:.25rem 0">⚠️ โหลดสคริปต์ไม่สำเร็จ: ตรวจ path <b>game/main.js</b> หรือ &lt;base&gt;</div>
      <div id="bootWarnBody"></div>
      <div style="margin-top:.5rem;display:flex;gap:.5rem;flex-wrap:wrap">
        <button id="bootRetry"  style="padding:.4rem .7rem;border-radius:8px;border:0;background:#222;color:#fff;cursor:pointer">Retry</button>
        <button id="bootCopy"   style="padding:.4rem .7rem;border-radius:8px;border:0;background:#222;color:#fff;cursor:pointer">Copy candidates</button>
      </div>`;
    document.body.appendChild(w);
    w.querySelector('#bootRetry')?.addEventListener('click', ()=>location.reload());
    w.querySelector('#bootCopy')?.addEventListener('click', async ()=>{
      try{
        const list = guessCandidates().join('\n');
        await navigator.clipboard.writeText(list);
        alert('Copied candidate URLs to clipboard');
      }catch{}
    });
  }
  return w;
}
function showWarn(lines) {
  const w = ensureWarn();
  const body = w.querySelector('#bootWarnBody');
  const arr = Array.isArray(lines) ? lines : [String(lines)];
  body.innerHTML = arr.map((t)=> `<div style="margin:.25rem 0;white-space:pre-wrap">${t}</div>`).join('');
  w.style.display = 'block';
}
function hideWarn(){ const w=document.getElementById('bootWarn'); if (w) w.style.display='none'; }

function ensureDebug() {
  const want = qsBool('hha_debug');
  if (!want) return null;
  let box = document.getElementById('bootDebug');
  if (box) return box;
  box = document.createElement('details');
  box.id = 'bootDebug';
  box.open = true;
  box.style.cssText = 'position:fixed;top:8px;left:8px;max-width:560px;z-index:10001;background:#111c;border:1px solid #fff3;border-radius:10px;color:#fff;padding:8px;font:12px ui-monospace';
  box.innerHTML = `<summary style="cursor:pointer">HHA Boot Debug</summary>
  <pre id="bootDebugLog" style="margin:8px 0;white-space:pre-wrap"></pre>
  <div style="display:flex;gap:.5rem;flex-wrap:wrap">
    <button id="bootBtnReload">Reload</button>
    <button id="bootBtnTryMain">Try data-main</button>
  </div>`;
  document.body.appendChild(box);
  box.querySelector('#bootBtnReload')?.addEventListener('click', ()=>location.reload());
  box.querySelector('#bootBtnTryMain')?.addEventListener('click', ()=> {
    const src = (document.currentScript && document.currentScript.dataset && document.currentScript.dataset.main) || '';
    if (src) HHA_BOOT.load(src); else alert('No data-main on boot.js');
  });
  return box;
}
function debugLog(msg) {
  try{
    const line = (typeof msg==='string') ? msg : JSON.stringify(msg);
    window.__HHA_BOOT_LOG.push(line);
    const pre = document.getElementById('bootDebugLog');
    if (pre) pre.textContent = window.__HHA_BOOT_LOG.join('\n');
  }catch{}
}

window.HHA_BOOT = {
  reportError(err){ try{
    window.__HHA_BOOT_ERR = err;
    window.__HHA_BOOT_OK = 'fail';
    debugLog(`[main] reported error: ${err?.message||err}`);
    showWarn(['⚠️ เกิดข้อผิดพลาดหลังโหลด main.js สำเร็จ:', String(err?.message||err)]);
  }catch{} },
  async load(url){
    try{
      ensureDebug(); hideWarn();
      debugLog(`[dev] manual load: ${url}`);
      const okUrl = await preflight(url);
      await tryImport(okUrl);
      window.__HHA_BOOT_OK = 'main';
      window.__HHA_BOOT_ERR = null;
      debugLog(`[ok ] imported main from ${okUrl}`);
      hideWarn();
      return true;
    }catch(e){
      window.__HHA_BOOT_OK = 'fail';
      window.__HHA_BOOT_ERR = e;
      debugLog(`[fail] manual load → ${e?.message||e}`);
      showWarn([`⚠️ manual load fail: ${String(e?.message||e)}`]);
      return false;
    }
  },
  reload(){ location.reload(); }
};

function withTimeout(promise, ms, label='timeout') {
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>reject(new Error(`${label} after ${ms}ms`)), ms);
    promise.then(v=>{ clearTimeout(t); resolve(v); }, e=>{ clearTimeout(t); reject(e); });
  });
}

function readOverrides(){
  // Priority: query (?hha_main=...), data-main on this script, then auto-guess
  const q = qsStr('hha_main');
  const scr = document.currentScript;
  const data = (scr && scr.dataset && scr.dataset.main) ? scr.dataset.main : null;
  return { queryMain: q, dataMain: data };
}

function guessCandidates() {
  const { queryMain, dataMain } = readOverrides();

  // If user specified, try that first (both as-is and resolved against baseURI)
  const list = [];
  const seen = new Set();
  const push = (u)=>{ try{ const s=String(u); if(!seen.has(s)){ seen.add(s); list.push(s); } }catch{} };

  const baseURI = document.baseURI;
  const here    = (document.currentScript && document.currentScript.src) ? document.currentScript.src : baseURI;

  const resolv = (rel)=> new URL(rel, baseURI).href;
  const resolv2= (rel)=> new URL(rel, here).href;

  if (queryMain){
    push(queryMain);
    push(resolv(queryMain));
  }
  if (dataMain){
    push(dataMain);
    push(resolv(dataMain));
  }

  // Common relatives
  const rels = ['game/main.js','./game/main.js','main.js','./main.js'];

  // Rooted guess: detect /HeroHealth/ in path
  try {
    const parts = location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('HeroHealth');
    if (idx >= 0) {
      const root = '/' + parts.slice(0, idx+1).join('/');
      push(root + '/game/main.js');
      push(root + '/main.js');
    }
  } catch {}

  // GitHub Pages quirk: project root is /repo-name/... ensure absolute with origin
  try {
    const projectRoot = new URL('.', baseURI).href;
    for (const r of rels){ push(new URL(r, projectRoot).href); }
    for (const r of rels){ push(resolv2(r)); }
  } catch {}

  // De-duped
  return list;
}

async function preflight(url){
  // Try fetch HEAD first (faster) then GET as fallback (for servers that disallow HEAD)
  try {
    const resHead = await withTimeout(fetch(url, { method:'HEAD', cache:'no-store', mode:'cors' }), 5000, 'head');
    if (!resHead.ok) throw new Error(`HEAD ${resHead.status} ${resHead.statusText}`);
    return url;
  } catch {
    const res = await withTimeout(fetch(url, { cache:'no-store', mode:'cors' }), 7000, 'fetch');
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    // Guard: Some hosts serve text/plain; dynamic import still ok if CORS allows. Log MIME.
    debugLog(`[mime] ${url} → ${res.headers.get('content-type')||'unknown'}`);
    return url;
  }
}
async function tryImport(url){
  const stamp = (Date.now()).toString(36);
  const src = `${url}${url.includes('?') ? '&' : '?'}v=${stamp}`;
  // Some strict CSPs require 'module' type via static tag; dynamic import usually fine.
  return import(src);
}

(async function boot(){
  try {
    ensureDebug(); hideWarn();
    debugLog(`[boot] baseURI: ${document.baseURI}`);
    debugLog(`[boot] location: ${location.href}`);

    const { queryMain, dataMain } = readOverrides();
    if (queryMain) debugLog(`[boot] override via ?hha_main=… → ${queryMain}`);
    if (dataMain)  debugLog(`[boot] override via data-main  → ${dataMain}`);

    const candidates = guessCandidates();
    debugLog(`[boot] candidates:\n - ` + candidates.join('\n - '));

    let lastErr = null;
    for (const url of candidates){
      try {
        debugLog(`[try] preflight ${url}`);
        const okUrl = await preflight(url);
        debugLog(`[ok ] preflight ${okUrl} ✓`);
        debugLog(`[try] import ${okUrl}`);
        await tryImport(okUrl);
        window.__HHA_BOOT_OK = 'main';
        window.__HHA_BOOT_ERR = null;
        debugLog(`[ok ] imported main from ${okUrl}`);
        hideWarn();
        return;
      } catch (e) {
        lastErr = e; debugLog(`[fail] ${url} → ${e?.message||e}`);
      }
    }
    window.__HHA_BOOT_OK = 'fail';
    window.__HHA_BOOT_ERR = lastErr;
    showWarn([
      '⚠️ โหลดสคริปต์ไม่สำเร็จ — ไม่พบหรือเปิด main.js ไม่ได้',
      'วิธีแก้เร็ว:',
      '• ใส่ <script src="game/boot.js" data-main="game/main.js"></script> ใน index.html',
      '• หรือเปิดด้วยพารามิเตอร์: ?hha_main=game/main.js หรือ ?hha_debug=1',
      '• ตรวจ <base> ให้ตรงโฟลเดอร์ที่มี /game/main.js',
      'Paths ที่ลอง:', ...guessCandidates().map(u=>'· '+u),
      `ข้อความล่าสุด: ${String(lastErr?.message||lastErr)}`
    ]);
  } catch (err) {
    window.__HHA_BOOT_OK = 'fail';
    window.__HHA_BOOT_ERR = err;
    debugLog(`[fatal] boot error: ${err?.message||err}`);
    showWarn(['⚠️ Boot ล้มเหลว:', String(err?.message||err)]);
  }
})();
