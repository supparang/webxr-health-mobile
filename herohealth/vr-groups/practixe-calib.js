/* === /herohealth/vr-groups/practice-calib.js ===
Practice 15s + Calibration Helper for PC/Mobile/Cardboard
- Works with DOM targets on playLayer
- view=cvr: hits via hha:shoot (crosshair)
- view=mobile/pc: tap targets
*/
(function(root){
  'use strict';
  root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function aimPick(layerEl, lockPx){
    const els = Array.from(layerEl.querySelectorAll('.practice-target'));
    if (!els.length) return null;
    const cx = innerWidth/2, cy = innerHeight/2;
    let best=null, bestD=1e18;
    for (const el of els){
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width/2, ey = r.top + r.height/2;
      const dx=ex-cx, dy=ey-cy;
      const d2=dx*dx+dy*dy;
      if (d2 < bestD){ bestD=d2; best=el; }
    }
    if (!best) return null;
    if (Math.sqrt(bestD) > lockPx) return null;
    return best;
  }

  function makeTarget(layerEl, xPct, yPct, emoji){
    const el = DOC.createElement('div');
    el.className = 'fg-target fg-good spawn practice-target';
    el.setAttribute('data-emoji', emoji || '🎯');
    el.style.setProperty('--x', xPct.toFixed(2)+'%');
    el.style.setProperty('--y', yPct.toFixed(2)+'%');
    el.style.setProperty('--s', '0.98');
    layerEl.appendChild(el);
    return el;
  }

  function run(opts){
    opts = opts || {};
    const layerEl = opts.layerEl;
    const overlayEl = opts.overlayEl;
    const seconds = clamp(opts.seconds ?? 15, 8, 30);
    const view = String(opts.view || 'mobile').toLowerCase();
    const lockPx = clamp(opts.lockPx ?? 92, 40, 160);
    const onDone = typeof opts.onDone === 'function' ? opts.onDone : ()=>{};

    if (!layerEl || !overlayEl){
      onDone({ skipped:true });
      return;
    }

    // UI elements inside overlay
    const $ = (id)=>DOC.getElementById(id);
    const vLeft = $('pLeft');
    const vHit  = $('pHit');
    const vNeed = $('pNeed');
    const btnGo = $('btnPracticeGo');
    const btnSkip = $('btnPracticeSkip');
    const btnRecenter = $('btnPracticeRecenter');

    // spawn set (corners + center)
    layerEl.querySelectorAll('.practice-target').forEach(e=>e.remove());
    const pts = [
      [50,50],[20,30],[80,30],[20,78],[80,78],[50,82]
    ];
    let need = 6;
    let hit = 0;
    let left = seconds;
    let started = false;
    let tmr = 0;

    vNeed.textContent = String(need);
    vHit.textContent  = '0';
    vLeft.textContent = String(left);

    function cleanup(){
      clearInterval(tmr);
      root.removeEventListener('hha:shoot', onShoot);
      layerEl.querySelectorAll('.practice-target').forEach(e=>e.remove());
      overlayEl.classList.add('hidden');
    }

    function finish(extra){
      cleanup();
      onDone(Object.assign({seconds, hit, need, view}, extra||{}));
    }

    function pop(){
      // small re-random (deterministic not needed)
      layerEl.querySelectorAll('.practice-target').forEach(e=>e.remove());
      for (let i=0;i<pts.length;i++){
        const p = pts[i];
        const el = makeTarget(layerEl, p[0] + (Math.random()*6-3), p[1] + (Math.random()*6-3), '🎯');
        el.addEventListener('click', ()=>{
          if (!started) return;
          if (!el.isConnected) return;
          el.classList.add('hit');
          setTimeout(()=>{ try{ el.remove(); }catch{} }, 120);
          hit++;
          vHit.textContent = String(hit);
          if (hit >= need) finish({completed:true});
        });
      }
    }

    function onShoot(){
      if (!started) return;
      const el = aimPick(layerEl, lockPx);
      if (!el) return;
      if (!el.isConnected) return;
      el.classList.add('hit');
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 120);
      hit++;
      vHit.textContent = String(hit);
      if (hit >= need) finish({completed:true});
    }

    function start(){
      if (started) return;
      started = true;

      overlayEl.classList.remove('hidden');
      DOC.body.classList.add('practice-on');

      pop();

      // cVR uses shoot
      if (view === 'cvr' || view === 'vr'){
        root.addEventListener('hha:shoot', onShoot, {passive:true});
      }

      tmr = setInterval(()=>{
        left = Math.max(0, left-1);
        vLeft.textContent = String(left);
        if (left <= 0) finish({timeout:true});
      }, 1000);
    }

    // buttons
    btnGo.onclick = ()=> start();
    btnSkip.onclick = ()=> finish({skipped:true});
    btnRecenter.onclick = ()=>{
      try{ root.dispatchEvent(new CustomEvent('hha:vr', {detail:{state:'reset'}})); }catch{}
    };

    // show overlay now (but start only when press GO)
    overlayEl.classList.remove('hidden');
    DOC.body.classList.add('practice-on');

    // if user wants auto-start
    if (String(opts.autoStart||'1') === '1') start();
  }

  root.GroupsVR.Practice = { run };

})(typeof window!=='undefined'?window:globalThis);