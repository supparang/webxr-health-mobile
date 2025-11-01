// === Hero Health Academy — game/main.js (fail-safe start/end + real hide menu) ===
window.__HHA_BOOT_OK = 'main';

(function(){
  const $=(s)=>document.querySelector(s);

  // stubs (ของเดิมคุณใช้ได้อยู่)
  let ScoreSystem,SFXClass,Quests,Progress,VRInput,CoachClass;
  async function loadCore(){
    try{({ScoreSystem}=await import('./core/score.js'));}catch{ScoreSystem=class{constructor(){this.value=0;}add(n=0){this.value+=n;}get(){return this.value|0;}reset(){this.value=0;}};}
    try{({SFX:SFXClass}=await import('./core/sfx.js'));}catch{SFXClass=class{play(){}tick(){}good(){}bad(){}perfect(){}power(){}};}
    try{({Quests}=await import('./core/quests.js'));}catch{Quests={beginRun(){} ,event(){},tick(){},endRun(){return[]},bindToMain(){return{refresh(){}}}};}
    try{({Progress}=await import('./core/progression.js'));}catch{Progress={init(){},beginRun(){},endRun(){},emit(){},getStatSnapshot(){return{};},profile(){return{}}};}
    try{({VRInput}=await import('./core/vrinput.js'));}catch{VRInput={init(){},toggleVR(){},isXRActive(){return false;},isGazeMode(){return false;}};}
    try{({Coach:CoachClass}=await import('./core/coach.js'));}catch{
      CoachClass=class{ constructor(){this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase();}
        _say(t){ let b=$('#coachHUD'); if(!b){ b=document.createElement('div'); b.id='coachHUD'; b.style.cssText='position:fixed;right:12px;bottom:92px;background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a;border-radius:12px;padding:8px 10px;box-shadow:0 10px 28px rgba(0,0,0,.45);max-width:48ch;z-index:60;'; document.body.appendChild(b);} b.textContent=t||''; b.style.display=t?'block':'none'; clearTimeout(this.to); this.to=setTimeout(()=>b.style.display='none',1500);}
        onStart(){this._say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!');}
        onGood(){this._say(this.lang==='EN'?'+Nice!':'+ดีมาก!');}
        onPerfect(){this._say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!');}
        onBad(){this._say(this.lang==='EN'?'Watch out!':'ระวัง!');}
        onTimeLow(){this._say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!');}
        onEnd(s){this._say((s|0)>=200?(this.lang==='EN'?'Awesome!':'สุดยอด!'):(this.lang==='EN'?'Nice!':'ดีมาก!'));} };
    }
  }

  const MODE_PATH=(k)=>`./modes/${k}.js`;
  async function loadMode(key){ const mod=await import(MODE_PATH(key)); return {update:mod.update||null, create:mod.create||null, init:mod.init||null, tick:mod.tick||null, cleanup:mod.cleanup||null}; }

  function toast(t){ let el=$('#toast'); if(!el){el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el);} el.textContent=t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1400); }
  function showWarn(msg){ let w=$('#bootWarn'); if(!w){ w=document.createElement('div'); w.id='bootWarn'; document.body.appendChild(w);} w.innerHTML=`<div>${msg}</div>`; w.style.display='block'; }

  let R={playing:false,remain:45,raf:0,sys:{score:null,sfx:null},modeKey:'goodjunk',diff:'Normal',modeAPI:null,modeInst:null,coach:null,_secMark:0,_dtMark:0};

  function busFor(){ return { hit(e){ /* คะแนน/FX ของคุณต่อได้ */ }, miss(){} }; }

  function loop(){
    if(!R.playing) return;
    const now=performance.now(); const sec=Math.floor((now-R._secMark)/1000);
    if(sec>=1){ R.remain=Math.max(0,(R.remain|0)-sec); R._secMark=now; if(R.remain===10) R.coach?.onTimeLow?.(); }
    try{
      if(typeof R.modeAPI?.update==='function'){ const dt=(now-(R._dtMark||now))/1000; R._dtMark=now; R.modeAPI.update(dt,busFor()); }
      else if(R.modeInst?.update){ const dt=(now-(R._dtMark||now))/1000; R._dtMark=now; R.modeInst.update(dt,busFor()); }
      else if(R.modeAPI?.tick){ R.modeAPI.tick({},R.sys,{}); }
    }catch(e){ console.error('[mode.update]',e); showWarn('โหมดทำงานผิดพลาด: '+e.message); end(); return; }
    if(R.remain<=0) return end();
    R.raf=requestAnimationFrame(loop);
  }

  function end(){
    if(!R.playing) return;
    R.playing=false; cancelAnimationFrame(R.raf);
    try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.({},{}); }catch{}
    document.getElementById('menuBar')?.removeAttribute('data-hidden');
    document.getElementById('menuBar').style.display='flex';
    window.HHA._busy=false;
    R.coach?.onEnd?.(0);
  }

  async function start(){
    try{
      if(window.HHA?._busy) return; window.HHA._busy=true;
      await loadCore();
      R.modeKey=document.body.getAttribute('data-mode')||'goodjunk';
      R.diff   =document.body.getAttribute('data-diff')||'Normal';
      R.sys.score=new (ScoreSystem||function(){})();
      R.sys.sfx  =new (SFXClass||function(){})();
      R.coach=new CoachClass({lang:(localStorage.getItem('hha_lang')||'TH')}); R.coach.onStart?.();

      R.modeAPI=await loadMode(R.modeKey);
      if(R.modeAPI.create){ R.modeInst=R.modeAPI.create({coach:R.coach}); R.modeInst.start?.(); }
      else if(R.modeAPI.init){ R.modeAPI.init({difficulty:R.diff},{},{time:45,life:1600}); }

      // ซ่อนเมนูจริง ๆ
      const mb=document.getElementById('menuBar'); if(mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

      R.playing=true; R.remain=45; R._secMark=performance.now(); R._dtMark=performance.now();
      requestAnimationFrame(loop);
    }catch(e){
      console.error('[HHA start]', e);
      showWarn('เริ่มเกมไม่สำเร็จ: '+e.message);
      window.HHA._busy=false;
    }
  }

  window.HHA=window.HHA||{};
  window.HHA.startGame=start;
  window.HHA.endGame=end;

  // กัน canvas บังคลิก
  setTimeout(()=>{ const c=document.querySelector('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }},0);
})();
