// Hygiene Rhythm Game (V2) — ไทยชัด, Training/Calibration, Perfect/Good, เมโทรนอม, เดสก์ท็อป/มือถือ/VR
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), root=$("#root"), cursor=$("#cursor"), hud=$("#hud");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset");
  const selBpm=$("#bpm"), selMode=$("#mode"), selTrain=$("#training");
  const calib=$("#calib"), calibVal=$("#calibVal");
  const hitPad=$("#hitPad");

  // cursor desktop/VR
  function setCursorMode(m){ if(!cursor) return;
    if(m==="vr"){ cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900"); cursor.setAttribute("visible","true"); }
    else{ cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false"); cursor.setAttribute("visible","false"); } }
  setCursorMode("desktop"); scene?.addEventListener("enter-vr",()=>setCursorMode("vr")); scene?.addEventListener("exit-vr",()=>setCursorMode("desktop"));

  // Thai text helper
  const THAI_FONT = $("#thaiFont")?.getAttribute("src");
  function label3D(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#e2e8f0", fontSize=0.18, maxWidth=5, x=0, y=0, z=0.06} = opts;
    e.setAttribute('troika-text',`
      value:${value};
      font:${THAI_FONT};
      color:${color};
      fontSize:${fontSize};
      maxWidth:${maxWidth};
      align:center;
    `.replace(/\s+/g,' '));
    e.setAttribute('position',`${x} ${y} ${z}`);
    e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }
  function toast(text,color){
    const t=label3D(text,{color,fontSize:0.2,y:0.75});
    root.appendChild(t); setTimeout(()=>t.parentNode&&t.parentNode.removeChild(t),460);
  }

  // Audio
  let actx=null,gain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); gain=actx.createGain(); gain.gain.value=0.12; gain.connect(actx.destination); }
  function click(){
    if(!actx) return;
    const o=actx.createOscillator(), g=actx.createGain(); o.type="square"; o.frequency.value=880; o.connect(g); g.connect(gain);
    const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.22,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);
    o.start(t); o.stop(t+0.06);
  }
  ["pointerdown","touchend","click"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true}));

  // Notes & state
  const EMO = ["#em-wash","#em-rub","#em-nail","#em-rinse","#em-dry","#em-brush","#em-molar","#em-timer"];
  const DIFF = { easy:{hit:0.18, secs:55}, normal:{hit:0.14, secs:65}, hard:{hit:0.10, secs:75} };

  const state={
    running:false, raf:0, t0:0, elapsed:0,
    score:0, combo:0, best:0, accHit:0, accTotal:0,
    hitWindow:DIFF.easy.hit, duration:DIFF.easy.secs,
    calibrationMs:0, // + ช้าลง, - เร็วขึ้น
  };
  let beatSec=60/96, nextBeat=0, notes=[]; // {el,t,z,judged}

  // UI helpers
  function setHUD(msg){
    const acc = state.accTotal>0 ? Math.round(state.accHit/state.accTotal*100) : 0;
    hud.textContent = `Hygiene Rhythm — bpm=${Math.round(60/beatSec)} mode=${selMode.value}\nscore=${state.score} combo=${state.combo} best=${state.best} acc=${acc}%\n${msg||""}`;
  }
  function makeNote(){
    const e=document.createElement('a-entity');
    e.classList.add('note');
    e.setAttribute('geometry','primitive: plane; width: 0.66; height: 0.66');
    const id=EMO[(Math.random()*EMO.length)|0];
    e.setAttribute('material',`src:${id}; shader:flat; opacity:0.98; transparent:true`);
    e.object3D.position.set(0,0,2.8);
    root.appendChild(e);
    return {el:e, t:state.elapsed + 1.6, z:2.8, judged:false};
  }

  function applyMode(){
    const m=selMode.value;
    state.hitWindow = DIFF[m]?.hit || DIFF.easy.hit;
    state.duration  = DIFF[m]?.secs || DIFF.easy.secs;
    setHUD("ตั้งค่าโหมดแล้ว");
  }
  function applyBPM(){ beatSec = 60 / parseInt(selBpm.value||"96",10); setHUD("ตั้งค่า BPM แล้ว"); }
  function applyCalib(){ state.calibrationMs = parseInt(calib.value,10)||0; calibVal.textContent = state.calibrationMs; }

  // judge
  function judgeHit(){
    const target = state.elapsed + (state.calibrationMs/1000);
    let best=null, bestErr=999;
    for(const it of notes){
      if(it.judged) continue;
      const err=Math.abs(it.t - target);
      if(err<bestErr){ best=it; bestErr=err; }
    }
    state.accTotal++;
    if(!best || bestErr>state.hitWindow){ state.combo=0; toast("Miss","#fecaca"); return; }
    best.judged=true; best.el.setAttribute("visible","false");
    state.accHit++;
    if(bestErr<=state.hitWindow*0.35){ state.score+=300; state.combo++; toast("Perfect +300","#7dfcc6"); }
    else { state.score+=150; state.combo++; toast("Good +150","#a7f3d0"); }
    state.best=Math.max(state.best,state.combo);
  }

  // flow
  function start(){
    notes.forEach(n=>n.el?.parentNode?.removeChild(n.el)); notes.length=0;
    state.running=true; state.score=0; state.combo=0; state.best=0; state.accHit=0; state.accTotal=0;
    state.t0=performance.now()/1000; state.elapsed=0; nextBeat=0;
    setHUD("เริ่ม! เคาะตามจังหวะที่แผ่น HIT");
    loop();
  }
  function reset(){
    state.running=false; cancelAnimationFrame(state.raf);
    notes.forEach(n=>n.el?.parentNode?.removeChild(n.el)); notes.length=0;
    setHUD("รีเซ็ตแล้ว");
  }
  function end(){
    state.running=false; cancelAnimationFrame(state.raf);
    const acc = state.accTotal? Math.round(state.accHit/state.accTotal*100):0;
    setHUD(`จบเกม • score=${state.score} best=${state.best} ACC=${acc}%`);
  }

  // main loop
  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    // Training mode → ลดความถี่โน้ต (ช้าลงครึ่งหนึ่ง) และโชว์นับ 1-2-3-4
    const trainingOn = selTrain.value==="on";
    const scheduleSpan = trainingOn ? beatSec*2 : beatSec;

    while(nextBeat <= state.elapsed + 1.0){
      notes.push(makeNote());
      click();
      nextBeat += scheduleSpan;
    }

    // count 1-2-3-4 (แสดงทุกบีตใน Training)
    if(trainingOn){
      // คำนวณลิสต์ count ตามจังหวะที่กำลังจะลง
      const tBeat = Math.floor(state.elapsed/beatSec)%4;
      const countText = (["1","2","3","4"][tBeat]);
      // อัปเดตเป็นครั้งคราว
      if(!loop._lastCount || loop._lastCount!==tBeat){
        loop._lastCount=tBeat;
        const c=label3D(countText,{fontSize:0.34,y:0.3,color:"#f8fafc"});
        root.appendChild(c);
        setTimeout(()=>c.parentNode&&c.parentNode.removeChild(c),220);
      }
    }

    // move
    const speedZ = 1.6; // ระยะ/วินาที
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - (state.elapsed + (state.calibrationMs/1000));
      it.z = Math.max(0, dt*speedZ);
      it.el.object3D.position.z = it.z;
      if(dt<-state.hitWindow && !it.judged){ it.judged=true; it.el.setAttribute("visible","false"); state.combo=0; toast("Miss","#fecaca"); }
    }

    setHUD();
    if(state.elapsed>=state.duration) return end();
    state.raf=requestAnimationFrame(loop);
  }

  // input bindings: pad + keyboard + VR select
  function bindHit(el){
    const h=e=>{ e.preventDefault(); e.stopPropagation(); ensureAudio(); judgeHit(); };
    el.addEventListener('click',h);
    el.addEventListener('pointerup',h);
    el.addEventListener('touchend',h,{passive:false});
  }
  bindHit(hitPad);
  window.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') judgeHit(); });
  // VR select (รวม hand/controller)
  scene.addEventListener('select', ()=>judgeHit());

  // UI events
  btnStart.addEventListener('click', ()=>!state.running&&start());
  btnReset.addEventListener('click', reset);
  selMode.addEventListener('change', applyMode);
  selBpm.addEventListener('change', applyBPM);
  selTrain.addEventListener('change', ()=>setHUD("สลับ Training แล้ว"));
  calib.addEventListener('input', applyCalib);

  // boot
  applyMode(); applyBPM(); applyCalib();
  setHUD("พร้อมเริ่ม • กด Start แล้วเคาะตามจังหวะ • Training โชว์ตัวนับ 1-2-3-4");
}
