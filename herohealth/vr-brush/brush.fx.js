// /herohealth/vr-brush/brush.fx.js
// HOTFIX v20260316d-BRUSH-FX-EXPORT-FIX

export function createBrushFx({
  fxLayer,
  trailLayer,
  screenFlash,
  comboBadge,
  phaseToast
} = {}){
  function safeRemove(el, delay = 0){
    if(!el) return;
    if(delay > 0){
      setTimeout(()=> {
        try{ el.remove(); }catch{}
      }, delay);
      return;
    }
    try{ el.remove(); }catch{}
  }

  function flashScreen(kind = 'good'){
    if(!screenFlash) return;

    if(kind === 'good'){
      screenFlash.style.background = 'rgba(34,197,94,.12)';
    }else if(kind === 'bad'){
      screenFlash.style.background = 'rgba(239,68,68,.13)';
    }else if(kind === 'boss'){
      screenFlash.style.background = 'rgba(245,158,11,.12)';
    }else{
      screenFlash.style.background = 'rgba(255,255,255,.08)';
    }

    screenFlash.style.opacity = '1';
    setTimeout(()=>{
      if(screenFlash) screenFlash.style.opacity = '0';
    }, 90);
  }

  function showComboBadge(text = 'COMBO'){
    if(!comboBadge) return;
    comboBadge.textContent = text;
    comboBadge.classList.add('on');
    clearTimeout(showComboBadge._t);
    showComboBadge._t = setTimeout(()=>{
      comboBadge?.classList.remove('on');
    }, 520);
  }

  function showPhaseToast(text = 'PHASE'){
    if(!phaseToast) return;
    phaseToast.textContent = text;
    phaseToast.classList.remove('on');
    void phaseToast.offsetWidth;
    phaseToast.classList.add('on');
  }

  function spawnPop(x, y, text = '+1'){
    if(!fxLayer) return;
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    fxLayer.appendChild(el);
    safeRemove(el, 720);
  }

  function spawnSparkle(x, y){
    if(!fxLayer) return;

    for(let i=0;i<5;i++){
      const s = document.createElement('div');
      s.className = 'spark';
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty('--dx', `${((Math.random()*80)-40).toFixed(0)}px`);
      s.style.setProperty('--dy', `${((Math.random()*-70)-8).toFixed(0)}px`);
      fxLayer.appendChild(s);
      safeRemove(s, 760);
    }
  }

  function spawnTrail(x, y, rot = 0){
    if(!trailLayer) return;
    const el = document.createElement('div');
    el.className = 'brushTrail';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--rot', `${rot}deg`);
    trailLayer.appendChild(el);
    safeRemove(el, 340);
  }

  function spawnFoam(x, y){
    if(!trailLayer) return;
    const el = document.createElement('div');
    el.className = 'foam';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    trailLayer.appendChild(el);
    safeRemove(el, 460);
  }

  return {
    flashScreen,
    showComboBadge,
    showPhaseToast,
    spawnPop,
    spawnSparkle,
    spawnTrail,
    spawnFoam
  };
}