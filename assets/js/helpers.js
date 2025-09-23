
window.MobileReady = {
  async enableMotionIfNeeded(btnId){
    const btn = document.getElementById(btnId);
    if(!btn) return;
    btn.addEventListener('click', async ()=>{
      try{
        if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
          const p1 = await DeviceMotionEvent.requestPermission();
          const p2 = await (DeviceOrientationEvent.requestPermission?.() || Promise.resolve('granted'));
          if (p1 === 'granted' || p2 === 'granted') { btn.style.display='none'; }
          else { alert('ไม่ได้รับอนุญาตเซนเซอร์'); }
        } else { btn.style.display='none'; }
      }catch(e){ console.log(e); }
    });
  },
  joystick(onMove){
    const joy = document.querySelector('.joy'), stick = document.querySelector('.joy .stick');
    if(!joy||!stick) return;
    let active=false, rect=null, cx=0, cy=0;
    function updateCenter(){
      rect = joy.getBoundingClientRect();
      cx = rect.left + rect.width/2;
      cy = rect.top + rect.height/2;
    }
    updateCenter(); window.addEventListener('resize', updateCenter);
    function pos(e){ const t=e.touches?e.touches[0]:e; return {x:t.clientX, y:t.clientY}; }
    function move(e){
      if(!active) return;
      const p=pos(e); const dx=p.x-cx, dy=p.y-cy;
      const r=50; const len=Math.min(Math.hypot(dx,dy), r);
      const ang=Math.atan2(dy,dx);
      const sx = Math.cos(ang)*len, sy = Math.sin(ang)*len;
      stick.style.transform=`translate(${sx}px, ${sy}px)`;
      const nx = (sx/r), ny = (sy/r);
      onMove && onMove(nx, ny);
    }
    joy.addEventListener('touchstart', e=>{ active=true; move(e); }, {passive:false});
    joy.addEventListener('touchmove',  e=>{ move(e); e.preventDefault(); }, {passive:false});
    joy.addEventListener('touchend',   ()=>{ active=false; stick.style.transform='translate(0,0)'; onMove && onMove(0,0); });
  }
};
