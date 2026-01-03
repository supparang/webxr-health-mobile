/* === /herohealth/vr-groups/fx-aimfeedback.js ===
PACK 25: Aim Feedback for hha:shoot (cVR) — PRODUCTION
✅ lock hint ring when crosshair near target center
✅ close/miss feedback on shoot when no hit
✅ works with DOM targets .fg-target (even pointer-events none in cVR)
Respects: FXPerf level (>=1) and view-cvr mainly
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function isCVR(){
    const cls = DOC.body && DOC.body.className ? DOC.body.className : '';
    return cls.includes('view-cvr');
  }

  // --- UI elements (ring + label) ---
  function ensureAimUI(){
    let wrap = DOC.querySelector('.aim-ui');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'aim-ui';
    wrap.innerHTML = `
      <div class="aim-ring" id="aimRing"></div>
      <div class="aim-label" id="aimLabel">LOCK</div>
      <div class="aim-spark" id="aimSpark"></div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function showRing(mode){
    if (!allow(1)) return;
    const ui = ensureAimUI();
    const ring = ui.querySelector('#aimRing');
    const lab  = ui.querySelector('#aimLabel');
    if (!ring || !lab) return;

    ring.classList.remove('on','lock','close','miss');
    lab.classList.remove('on','lock','close','miss');

    ring.classList.add('on', mode);
    lab.classList.add('on', mode);

    lab.textContent =
      (mode==='lock') ? 'LOCK' :
      (mode==='close')? 'CLOSE!' :
      'MISS';

    const dur = (mode==='lock') ? 140 : (mode==='close') ? 240 : 200;
    setTimeout(()=>{
      ring.classList.remove('on', mode);
      lab.classList.remove('on', mode);
    }, dur);
  }

  function sparkAt(x,y, mode='close'){
    if (!allow(2)) return;                 // spark only >=2
    const ui = ensureAimUI();
    const s = ui.querySelector('#aimSpark');
    if (!s) return;
    x = clamp(x, 10, (root.innerWidth||360)-10);
    y = clamp(y, 10, (root.innerHeight||640)-10);

    s.style.left = x + 'px';
    s.style.top  = y + 'px';

    s.classList.remove('on','close','miss');
    void s.offsetWidth;
    s.classList.add('on', mode);

    setTimeout(()=> s.classList.remove('on', mode), 260);
  }

  // --- Find nearest target to crosshair ---
  function listTargets(){
    try{ return Array.from(DOC.querySelectorAll('.fg-target')); }
    catch{ return []; }
  }

  function targetCenter(el){
    try{
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2, w:r.width, h:r.height };
    }catch{
      return { x:(root.innerWidth||0)*0.5, y:(root.innerHeight||0)*0.5, w:0, h:0 };
    }
  }

  function nearestTo(x,y){
    const tgs = listTargets();
    let best = null;
    let bestD = 1e9;
    for (const el of tgs){
      const c = targetCenter(el);
      const dx = c.x - x;
      const dy = c.y - y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestD){
        bestD = d;
        best = { el, d, c };
      }
    }
    return best;
  }

  // Track last judge time (to know if shot hit)
  let lastJudgeAt = 0;
  root.addEventListener('hha:judge', ()=>{ lastJudgeAt = Date.now(); }, {passive:true});

  // On shoot: lock hint + close/miss feedback when no hit
  root.addEventListener('hha:shoot', (ev)=>{
    if (!allow(1)) return;
    if (!isCVR()) return;                 // focus: cVR

    const d = (ev && ev.detail) ? ev.detail : {};
    const x = (typeof d.x==='number') ? d.x : (root.innerWidth||0)*0.5;
    const y = (typeof d.y==='number') ? d.y : (root.innerHeight||0)*0.5;
    const lockPx = clamp(d.lockPx ?? 92, 40, 160);

    const near = nearestTo(x,y);
    if (!near) { showRing('miss'); return; }

    // LOCK hint if within lock
    if (near.d <= lockPx){
      showRing('lock');
    }

    // After a short delay, if no judge fired, show CLOSE/MISS
    const t0 = Date.now();
    setTimeout(()=>{
      // if we already judged close to the shot time => hit happened (engine emits judge)
      if ((lastJudgeAt - t0) >= -20) return;

      // no hit => near miss?
      const closePx = Math.max(lockPx + 22, 112);
      if (near.d <= closePx){
        showRing('close');
        sparkAt(near.c.x, near.c.y, 'close');
      } else {
        showRing('miss');
        sparkAt(x,y,'miss');
      }
    }, 70);

  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);