/* === /herohealth/vr-groups/fx-debug.js ===
PACK 17: FX Debug Self-test
✅ Enable with ?debug=1
✅ Buttons emit hha:judge + hha:end + groups:progress
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  const dbg = String(qs('debug','0')||'0');
  if (!(dbg==='1' || dbg==='true')) return;

  function makeBtn(txt, on){
    const b = DOC.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.style.cssText = `
      appearance:none;border:1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.72); color:#e5e7eb;
      font-weight:1000;border-radius:14px;padding:10px 12px;
      cursor:pointer;
    `;
    b.addEventListener('click', on);
    return b;
  }

  const wrap = DOC.createElement('div');
  wrap.style.cssText = `
    position:fixed; right: calc(12px + env(safe-area-inset-right,0px));
    bottom: calc(84px + env(safe-area-inset-bottom,0px));
    z-index:160; display:flex; flex-direction:column; gap:8px;
    pointer-events:auto;
  `;

  const cx = ()=> (root.innerWidth||0)*0.5;
  const cy = ()=> (root.innerHeight||0)*0.45;

  wrap.appendChild(makeBtn('FX GOOD', ()=> emit('hha:judge',{kind:'good', text:'+20', x:cx(), y:cy()})));
  wrap.appendChild(makeBtn('FX BAD', ()=> emit('hha:judge',{kind:'bad', text:'-12', x:cx(), y:cy()})));
  wrap.appendChild(makeBtn('FX PERFECT', ()=> emit('hha:judge',{kind:'perfect', text:'PERFECT', x:cx(), y:cy()})));
  wrap.appendChild(makeBtn('FX BOSS', ()=> emit('hha:judge',{kind:'boss', text:'BOSS -1', x:cx(), y:cy()})));
  wrap.appendChild(makeBtn('FX STORM', ()=> emit('groups:progress',{kind:'storm_on'})));
  wrap.appendChild(makeBtn('FX END', ()=> emit('hha:end',{reason:'debug', scoreFinal:123, misses:2, accuracyGoodPct:88, grade:'A'})));

  DOC.body.appendChild(wrap);

})(typeof window !== 'undefined' ? window : globalThis);