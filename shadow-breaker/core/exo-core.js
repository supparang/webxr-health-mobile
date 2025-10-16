<script>
// EXO Core (WebXR-ready)
window.EXO=(function(){
  const AC = {ctx:null, ensure(){ try{this.ctx=this.ctx||new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }};
  function beep(freq=520,dur=0.06,vol=0.15){ AC.ensure(); if(!AC.ctx) return; const c=AC.ctx; const o=c.createOscillator(), g=c.createGain(); o.type="square"; o.frequency.value=freq; g.gain.value=vol; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+dur); }
  function now(){ return performance.now()/1000; }
  function downloadCSV(filename,text){ const blob=new Blob([text],{type:"text/csv"}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); }
  function startOverlay(onStart){
    const wrap=document.createElement('div'); wrap.className='overlay'; wrap.innerHTML=`<div class="panel"><div class="title">EXO TRAINING PROTOCOL</div><p class="note">Tap/Click to start · Audio unlock · Enter WebXR anytime</p><div style="display:flex;gap:.6rem;justify-content:center;margin-top:.5rem"><button id="exoStart" class="btn">▶ Start</button></div></div>`;
    document.body.appendChild(wrap);
    document.getElementById('exoStart').onclick=()=>{ AC.ensure(); wrap.remove(); onStart&&onStart(); };
  }
  // Input: mouse/touch + simple XR mapping
  function attachBasicInput({onLeft,onRight,onPause}){
    const L=ev=>onLeft&&onLeft(); const R=ev=>onRight&&onRight();
    ['mousedown','touchstart'].forEach(ev=>{
      document.getElementById('touchL')?.addEventListener(ev,L,{passive:true});
      document.getElementById('touchR')?.addEventListener(ev,R,{passive:true});
    });
    window.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft'||e.key==='a') L(); else if(e.key==='ArrowRight'||e.key==='d') R(); else if(e.key==='Escape') onPause&&onPause(); });
    // WebXR controller (A-Frame fires 'triggerdown' on controllers if present)
    document.addEventListener('triggerdown', e=>{ // fallback custom events
      // choose side by handedness if available
      const side = e.detail && e.detail.handedness || (Math.random()<0.5?'left':'right');
      side==='left'?L():R();
    });
  }
  return {beep,now,downloadCSV,startOverlay,attachBasicInput};
})();
</script>
