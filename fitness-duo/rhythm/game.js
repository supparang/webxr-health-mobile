(function(){
  const CFG = window.RHYTHM_CFG || {};
  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const skyEl=document.getElementById('sky');
  const btnStart=document.getElementById('btnStart');
  const btnReset=document.getElementById('btnReset');

  function getThemeName(){
    return (window.__OVERRIDE_THEME ||
            new URLSearchParams(location.search).get('theme') ||
            'city').toLowerCase();
  }
  function themeSkyId(name){
    if(name==='jungle') return '#bg-jungle';
    if(name==='space')  return '#bg-space';
    return '#bg-city';
  }
  function swapSky(name){
    try{
      if(skyEl){
        skyEl.setAttribute('src', themeSkyId(name));
        skyEl.setAttribute('color', name==='space' ? '#050914' : '#0b1220');
      }
    }catch(e){ console.warn('swapSky rhythm', e); }
  }

  // … (โค้ดเกมเดิมของ Rhythm Day6 ทั้งหมดคงเดิม) …
  // ใส่แค่ “เรียกใช้ swapSky” ตอน start

  let running=false, raf=0, elapsed=0, t0=0;
  function setHUD(msg){ hud.setAttribute('text',`value:${msg||'พร้อมเริ่ม'}; width:5.8; align:center; color:#e2e8f0`); }

  function start(){
    const THEME = getThemeName();
    swapSky(THEME);              // ✅ ตั้งรูปท้องฟ้าตามธีม
    running=true; t0=performance.now()/1000; elapsed=0;
    setHUD(`[${THEME.toUpperCase()}] Tutorial: ดูจังหวะช้า ๆ ก่อน`);
    // … เริ่มระบบ spawn/loop/audio ตามโค้ดเดิมของคุณ …
    requestAnimationFrame(loop);
  }
  function loop(){ if(!running) return; /* ... เกมเดิม ... */ requestAnimationFrame(loop); }
  function reset(){ running=false; cancelAnimationFrame(raf); setHUD('พร้อมเริ่ม'); }

  function bind(){
    btnStart.onclick=()=>{ if(!running) start(); };
    btnReset.onclick=()=>reset();
  }
  const scene=document.querySelector('a-scene');
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
