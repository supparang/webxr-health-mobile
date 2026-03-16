// /herohealth/vr-brush/brush.tutorial.js
// HOTFIX v20260316c-BRUSH-TUTORIAL-SAFE

export function createBrushTutorial({
  S,
  demoHand,
  demoHint,
  learnOverlay,
  arenaCore,
  audio,
  zones,
  humanZoneInstruction,
  getActiveZone
}){
  let rafId = 0;
  let resizeBound = false;

  function safePlayCue(name){
    try{
      audio?.playCue?.(name);
    }catch{}
  }

  function currentActiveZone(){
    try{
      return getActiveZone?.() || null;
    }catch{
      return null;
    }
  }

  function setDemoVisible(on){
    if(demoHand) demoHand.classList.toggle('on', !!on);
    if(demoHint) demoHint.classList.toggle('on', !!on);
  }

  function stopDemoTutorial(){
    if(rafId){
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    setDemoVisible(false);
  }

  function positionDemoAtZone(zoneEl, t){
    if(!demoHand || !zoneEl || !zones) return false;

    const rect = zones.zoneRectRelative?.(zoneEl);
    if(!rect) return false;

    const swing = (Math.sin(t * Math.PI * 1.6) + 1) / 2;
    const bob = Math.sin(t * Math.PI * 3.2) * 4;

    const x = rect.left + rect.width * (0.18 + swing * 0.64);
    const y = rect.top + rect.height * 0.55 + bob;

    demoHand.style.left = `${x}px`;
    demoHand.style.top = `${y}px`;
    return true;
  }

  function startDemoTutorial(){
    stopDemoTutorial();

    const active = currentActiveZone();
    if(!active?.el || !arenaCore || S.bossStarted || S.finished) return false;

    setDemoVisible(true);
    safePlayCue('demo-start');

    const t0 = performance.now();

    const loop = (ts)=>{
      if(S.finished || S.bossStarted){
        stopDemoTutorial();
        return;
      }

      const current = currentActiveZone();
      if(!current?.el){
        stopDemoTutorial();
        return;
      }

      const ok = positionDemoAtZone(current.el, (ts - t0) / 1000);
      if(!ok){
        stopDemoTutorial();
        return;
      }

      const elapsed = (ts - t0) / 1000;
      if(elapsed >= 2.6){
        stopDemoTutorial();
        return;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return true;
  }

  function updateLearnOverlayText(){
    const el = document.getElementById('learnOverlayNow');
    const active = currentActiveZone();
    if(!el) return;

    if(!active){
      el.textContent = 'ถูในกรอบสีฟ้า';
      return;
    }

    el.textContent = `${humanZoneInstruction(active.label)} ในกรอบสีฟ้า`;
  }

  function openLearnOverlay(){
    if(!learnOverlay) return false;
    updateLearnOverlayText();
    learnOverlay.style.display = 'grid';
    S.learnOverlayShown = true;
    safePlayCue('learn-open');
    return true;
  }

  function closeLearnOverlay(){
    if(!learnOverlay) return false;
    learnOverlay.style.display = 'none';
    return true;
  }

  function isLearnOverlayOpen(){
    return !!learnOverlay && learnOverlay.style.display === 'grid';
  }

  function bindAutoRefresh(){
    if(resizeBound) return;
    resizeBound = true;

    const onResize = ()=>{
      if(isLearnOverlayOpen()){
        updateLearnOverlayText();
      }
      if(rafId){
        const active = currentActiveZone();
        if(active?.el){
          positionDemoAtZone(active.el, 0.2);
        }
      }
    };

    try{
      window.addEventListener('resize', onResize, { passive:true });
      window.addEventListener('orientationchange', onResize, { passive:true });
    }catch{}
  }

  bindAutoRefresh();

  return {
    stopDemoTutorial,
    startDemoTutorial,
    updateLearnOverlayText,
    openLearnOverlay,
    closeLearnOverlay,
    isLearnOverlayOpen
  };
}