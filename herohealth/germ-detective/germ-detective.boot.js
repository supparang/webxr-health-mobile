// === /herohealth/germ-detective/germ-detective.boot.js ===
// Germ Detective boot
// PATCH v20260310-BOOT-HARDEN-r1
// ✅ mount into #app
// ✅ import game module safely
// ✅ visible error if boot fails
// ✅ pass query config to game

function qs(k, d=''){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
}

function normalizeMaybeEncodedUrl(v){
  v = String(v ?? '').trim();
  if(!v || v === 'null' || v === 'undefined') return '';
  if(/%3A|%2F|%3F|%26|%3D/i.test(v)){
    try{ v = decodeURIComponent(v); }catch(e){}
  }
  return v.trim();
}

function showBootError(msg, err){
  console.error('[germ-boot]', msg, err || '');
  const app = document.getElementById('app') || document.body;
  const box = document.createElement('div');
  box.style.margin = '12px';
  box.style.padding = '14px';
  box.style.border = '1px solid rgba(148,163,184,.18)';
  box.style.borderRadius = '16px';
  box.style.background = 'rgba(255,255,255,.03)';
  box.style.color = '#e5e7eb';
  box.innerHTML = `
    <div style="font-weight:1000;margin-bottom:8px;">Germ Detective boot ไม่สำเร็จ</div>
    <div style="font-size:12px;line-height:1.6;white-space:pre-wrap;">${String(msg)}</div>
  `;
  app.appendChild(box);
}

async function main(){
  const app = document.getElementById('app');
  if(!app) throw new Error('#app not found');

  const cfg = {
    pid: String(qs('pid','anon')).trim() || 'anon',
    run: String(qs('run','play')).toLowerCase() || 'play',
    diff: String(qs('diff','normal')).toLowerCase() || 'normal',
    time: Math.max(20, Number(qs('time','80')) || 80),
    seed: Number(qs('seed', String(Date.now()))) || Date.now(),
    view: String(qs('view','mobile')).toLowerCase() || 'mobile',
    scene: String(qs('scene','classroom')).toLowerCase() || 'classroom',
    zone: String(qs('zone','hygiene')).toLowerCase() || 'hygiene',
    studyId: String(qs('studyId','')),
    phase: String(qs('phase','')),
    conditionGroup: String(qs('conditionGroup','')),
    hub: normalizeMaybeEncodedUrl(qs('hub','../hub.html')) || '../hub.html'
  };

  console.log('[germ-boot] cfg =', cfg);

  // loading state
  app.innerHTML = `
    <div style="padding:16px;color:#cbd5e1;font-weight:900;">
      กำลังโหลด Germ Detective...
    </div>
  `;

  const mod = await import('./germ-detective.js?v=20260310-BOOT-HARDEN-r1');
  console.log('[germ-boot] module loaded =', Object.keys(mod || {}));

  const mountFn =
    mod.mountGame ||
    mod.mount ||
    mod.boot ||
    mod.default;

  if(typeof mountFn !== 'function'){
    throw new Error('No mount function found in germ-detective.js (expected one of: mountGame, mount, boot, default)');
  }

  app.innerHTML = '';
  const api = await mountFn(app, cfg);

  if(api && typeof api.start === 'function'){
    api.start();
  }
}

main().catch((err)=>{
  showBootError(err?.stack || err?.message || String(err), err);
});