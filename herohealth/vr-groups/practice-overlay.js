/* === /herohealth/vr-groups/practice-overlay.js ===
GroupsVR Practice Overlay — PACK 14
✅ Shows PRACTICE banner in cVR when vMode==PRACTICE
✅ Countdown hint + tap-to-shoot tip
✅ Auto hides on real run (vMode PLAY/RESEARCH)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function ensure(){
    let el = DOC.getElementById('practiceOverlay');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'practiceOverlay';
    el.style.cssText = `
      position:fixed; inset:0; z-index:120;
      display:flex; align-items:flex-start; justify-content:center;
      padding: calc(14px + env(safe-area-inset-top,0px)) 14px 14px;
      pointer-events:none;
    `;

    const card = DOC.createElement('div');
    card.style.cssText = `
      width:min(520px, 100%);
      border-radius:22px;
      background: rgba(2,6,23,.70);
      border: 1px solid rgba(148,163,184,.22);
      box-shadow: 0 18px 55px rgba(0,0,0,.45);
      padding: 12px 14px;
      backdrop-filter: blur(10px);
    `;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div style="font-weight:1000;letter-spacing:.2px;">🧪 PRACTICE</div>
        <div id="pLeft" style="font-weight:1000;color:#94a3b8;">15s</div>
      </div>
      <div style="margin-top:6px;font-weight:900;line-height:1.25;">
        ซ้อมเล็ง “จาก crosshair” แล้วแตะจอเพื่อยิง 🎯
      </div>
      <div style="margin-top:6px;font-weight:800;color:#94a3b8;font-size:12px;">
        หมดเวลาแล้วจะเริ่มรอบจริงอัตโนมัติ
      </div>
    `;

    el.appendChild(card);
    DOC.body.appendChild(el);
    return el;
  }

  function show(on){
    const el = ensure();
    el.style.display = on ? 'flex' : 'none';
  }

  // show only when view=cvr & practice=1 & vMode==PRACTICE
  const view = String(qs('view','mobile')||'mobile').toLowerCase();
  const practice = String(qs('practice','0')||'0');
  const enable = (view==='cvr' && (practice==='1' || practice==='true'));

  if (!enable) return;

  let lastLeft = 15;

  // watch time ticks
  root.addEventListener('hha:time', (ev)=>{
    const left = Number((ev.detail||{}).left ?? 0);
    // During practice the planned time is 15, so just show left
    const el = DOC.getElementById('pLeft');
    if (el) el.textContent = Math.max(0, left|0) + 's';
    lastLeft = left|0;
  }, {passive:true});

  // watch mode changes (your HTML sets vMode)
  const modeEl = DOC.getElementById('vMode');
  const obs = new MutationObserver(()=>{
    const m = String(modeEl && modeEl.textContent || '').toUpperCase();
    show(m === 'PRACTICE');
  });

  function boot(){
    if (!modeEl) return;
    obs.observe(modeEl, { childList:true, subtree:true, characterData:true });
    const m = String(modeEl.textContent||'').toUpperCase();
    show(m === 'PRACTICE');
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();

})(typeof window !== 'undefined' ? window : globalThis);