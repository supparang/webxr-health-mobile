// Rhythm — รับพารามิเตอร์ bpm/diff + โน้ตตกง่าย ๆ + Perfect/Good
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), root=$("#root"), cursor=$("#cursor"), hud=$("#hud");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset");

  // Cursor desktop/VR
  function setCursorMode(m){ if(!cursor) return;
    if(m==="vr"){ cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900"); cursor.setAttribute("visible","true"); }
    else{ cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false"); cursor.setAttribute("visible","false"); } }
  setCursorMode("desktop"); scene?.addEventListener("enter-vr",()=>setCursorMode("vr")); scene?.addEventListener("exit-vr",()=>setCursorMode("desktop"));

  // Query + fallback
  const q=new URLSearchParams(location.search);
  const diff=(q.get("diff")||"easy").toLowerCase();
  const bpm = parseInt(q.get("bpm")||"96",10);
  const DIFF = { easy:{hit:0.18, secs:50}, normal:{hit:0.14, secs:60}, hard:{hit:0.10, secs:70} };
  const cfg = DIFF[diff]||DIFF.easy;

  // State
  const state={ running:false, raf:0, t0:0, elapsed:0, score:0, combo:0, best:0, hitWindow:cfg.hit, duration:cfg.secs, nextBeat:0 };
  const beatSec = 60/bpm;

  function setHUD(msg){
    hud.textContent = `Rhythm • diff=${diff} bpm=${bpm}\nscore=${state.score} combo=${state.combo} best=${state.best}\n${msg||""}`;
  }

  function makeText(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#fff",fontSize=0.18,maxWidth=5,y=0,z=0.06}=opts;
    e.setAttribute('troika-text',`value:${value}; color:${color}; fontSize:${fontSize}; maxWidth:${maxWidth}; align:center`);
    e.setAttribute('position',`0 ${y} ${z}`);
    e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }

  function spawnNote(){
    const n=document.createElement('a-entity');
    n.classList.add('note');
    n.setAttribute('geometry','primitive: circle; radius: 0.14; segments:32');
    n.setAttribute('material','color:#93c5fd; shader:flat; opacity:0.95');
    n.object3D.position.set(0,0,2.8);
    root.appendChild(n);
    return {el:n, t:state.elapsed+1.6, z:2.8, judged:false};
  }

  function toast(txt,color){
    const t=makeText(txt,{color,fontSize:0.2,y:0.7});
    root.appendChild(t);
    setTimeout(()=>t.parentNode&&t.parentNode.removeChild(t),420);
  }

  function judgeHit(){
    // called on input at "target line" (z≈0)
    // find closest unjudged note around now
    const target = state.elapsed;
    let best=null, bestErr=999;
    for(const it of notes){
      if(it.judged) continue;
      const err=Math.abs(it.t - target);
      if(err<bestErr){ best=it; bestErr=err; }
    }
    if(!best || bestErr>state.hitWindow){ state.combo=0; toast("Miss","#fecaca"); return; }
    best.judged=true; best.el.setAttribute("visible","false");
    if(bestErr<=state.hitWindow*0.35){ state.score+=300; state.combo++; toast("Perfect +300","#7dfcc6"); }
    else { state.score+=150; state.combo++; toast("Good +150","#a7f3d0"); }
    state.best=Math.max(state.best,state.combo);
  }

  // Audio (metronome-ish)
  let actx=null, gain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); gain=actx.createGain(); gain.gain.value=0.12; gain.connect(actx.destination); }
  function click(){
    if(!actx) return;
    const o=actx.createOscillator(), g=actx.createGain(); o.type="square"; o.frequency.value=880; o.connect(g); g.connect(gain);
    const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.2,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.04);
    o.start(t); o.stop(t+0.05);
  }
  ["pointerdown","touchend","click"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true}));

  // Notes
  let notes=[];
  function start(){
    notes.length=0; state.running=true; state.score=0; state.combo=0; state.best=0;
    state.t0=performance.now()/1000; state.elapsed=0; state.nextBeat=0;
    setHUD("เริ่ม!");
    loop();
  }
  function reset(){
    state.running=false; cancelAnimationFrame(state.raf);
    notes.forEach(n=>n.el?.parentNode?.removeChild(n.el)); notes.length=0;
    setHUD("รีเซ็ตแล้ว");
  }
  function end(){
    state.running=false; cancelAnimationFrame(state.raf);
    setHUD(`จบเกม • score=${state.score} bestCombo=${state.best}`);
  }

  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    // schedule beats
    while(state.nextBeat <= state.elapsed + 1.0){
      notes.push(spawnNote());
      click(); // เมโทรนอม
      state.nextBeat += beatSec;
    }

    // move & auto-judge overtime
    const dz = 1.6 * (1/60);
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - state.elapsed; // time until target
      it.z = Math.max(0, dt*1.6);
      it.el.object3D.position.z = it.z;
      if(dt<-state.hitWindow && !it.judged){ it.judged=true; it.el.setAttribute("visible","false"); state.combo=0; toast("Miss","#fecaca"); }
    }

    setHUD();
    if(state.elapsed>=state.duration) return end();
    state.raf=requestAnimationFrame(loop);
  }

  // input (desktop/mobile/VR hit line)
  function bindHit(el){
    const h=e=>{ e.preventDefault(); e.stopPropagation(); ensureAudio(); judgeHit(); };
    el.addEventListener('click',h);
    el.addEventListener('pointerup',h);
    el.addEventListener('touchend',h,{passive:false});
  }
  // hit pad (3D big button)
  const pad=document.createElement('a-entity');
  pad.classList.add('clickable');
  pad.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.5');
  pad.setAttribute('material','color:#1e293b; opacity:0.95; shader:flat');
  pad.setAttribute('position','0 -0.5 0.06');
  const padText=makeText("TAP / GAZE HERE",{color:"#93c5fd",fontSize:0.18,y:0});
  padText.setAttribute('position','0 0 0.01');
  pad.appendChild(padText);
  root.appendChild(pad);
  bindHit(pad);
  window.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') judgeHit(); });

  // events
  btnStart.addEventListener('click', ()=>!state.running&&start());
  btnReset.addEventListener('click', reset);

  setHUD("พร้อมเริ่ม • กด Start แล้วตบตามจังหวะที่แผ่น HIT");
}
