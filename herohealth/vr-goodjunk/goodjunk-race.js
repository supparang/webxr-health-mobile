// === /herohealth/vr-goodjunk/goodjunk-race.js ===
// GoodJunk RACE Controller — PRODUCTION
// FULL v20260304-RACE-OVERLAY-COUNTDOWN
'use strict';

export function bootRace(opts = {}){
  const overlayId = String(opts.overlayId || 'raceOverlay');
  const numId = String(opts.numId || 'raceNum');
  const subId = String(opts.subId || 'raceSub');

  const wait = !!opts.wait;
  const autostartMs = Number(opts.autostartMs || 3000) || 3000;
  const onGo = (typeof opts.onGo === 'function') ? opts.onGo : null;

  const overlay = document.getElementById(overlayId);
  const numEl = document.getElementById(numId);
  const subEl = document.getElementById(subId);

  if(!overlay || !numEl || !subEl){
    console.warn('[Race] missing overlay elements');
    // ถ้าไม่มี overlay ก็ปล่อยเริ่มเลย
    try{ onGo && onGo(); }catch(_){}
    return;
  }

  function show(on){
    overlay.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  function setNum(v){ numEl.textContent = String(v); }
  function setSub(v){ subEl.textContent = String(v); }

  // ถ้าไม่ wait ก็แค่โชว์ “RACE” สั้น ๆ แล้วปิด
  if(!wait){
    show(true);
    setSub('RACE! ไปเลย!');
    setNum('GO');
    setTimeout(()=> show(false), 900);
    try{ onGo && onGo(); }catch(_){}
    return;
  }

  // wait=1 : นับถอยหลัง
  show(true);
  setSub('เตรียมตัว…');
  setNum('3');

  const t0 = performance.now();
  let phase = 0; // 0=delay, 1=count, 2=go, 3=hide
  let lastShown = '';

  function tick(){
    const t = performance.now() - t0;

    if(phase === 0){
      if(t < autostartMs){
        const left = Math.max(0, Math.ceil((autostartMs - t)/1000));
        const label = `เริ่มใน ${left}s`;
        if(label !== lastShown){
          lastShown = label;
          setSub(label);
        }
        requestAnimationFrame(tick);
        return;
      }
      phase = 1;
      lastShown = '';
    }

    if(phase === 1){
      // countdown 3..2..1
      const elapsed = t - autostartMs;
      const sec = Math.floor(elapsed / 1000);
      const n = 3 - sec;

      if(n > 0){
        setSub('พร้อม…');
        setNum(String(n));
        requestAnimationFrame(tick);
        return;
      }
      phase = 2;
    }

    if(phase === 2){
      setSub('GO!');
      setNum('GO');
      try{ onGo && onGo(); }catch(_){}
      phase = 3;
      setTimeout(()=> show(false), 650);
      return;
    }
  }

  requestAnimationFrame(tick);
}