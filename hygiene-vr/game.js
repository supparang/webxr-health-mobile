// Hygiene Rhythm — 4 Games (อาบน้ำ / ช่องปาก / ล้างมือ / เล็บ)
// เล่นได้เดสก์ท็อป/มือถือ/VR + Training + Calibration + Perfect/Good + เมโทรนอม
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), root=$("#root"), cursor=$("#cursor"), hud=$("#hud");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset");
  const selTask=$("#task"), selDiff=$("#difficulty"), selBpm=$("#bpm"), selTrain=$("#training");
  const calib=$("#calib"), calibVal=$("#calibVal");
  const hitPad=$("#hitPad");
  const THAI_FONT = $("#thaiFont")?.getAttribute("src");

  // Cursor desktop/VR
  function setCursorMode(m){ if(!cursor) return;
    if(m==="vr"){ cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900"); cursor.setAttribute("visible","true"); }
    else{ cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false"); cursor.setAttribute("visible","false"); } }
  setCursorMode("desktop"); scene?.addEventListener("enter-vr",()=>setCursorMode("vr")); scene?.addEventListener("exit-vr",()=>setCursorMode("desktop"));

  // UI text helper
  function label3D(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#e2e8f0", fontSize=0.18, maxWidth=5, x=0, y=0, z=0.06} = opts;
    e.setAttribute('troika-text',`value:${value}; font:${THAI_FONT}; color:${color}; fontSize:${fontSize}; maxWidth:${maxWidth}; align:center`.replace(/\s+/g,' '));
    e.setAttribute('position',`${x} ${y} ${z}`);
    e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }
  function toast(text,color){ const t=label3D(text,{color,fontSize:0.2,y:0.75}); root.appendChild(t); setTimeout(()=>t.parentNode&&t.parentNode.removeChild(t),520); }

  // Audio (metronome)
  let actx=null,gain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; actx=new AC(); gain=actx.createGain(); gain.gain.value=0.12; gain.connect(actx.destination); }
  function click(){ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type="square"; o.frequency.value=880; o.connect(g); g.connect(gain); const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.22,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.05); o.start(t); o.stop(t+0.06); }
  ["pointerdown","touchend","click"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true}));

  // Difficulty / timing
  const DIFF = { easy:{hit:0.18, secs:60}, normal:{hit:0.14, secs:75}, hard:{hit:0.10, secs:90} };

  // 4 เกม: emoji set + ข้อความเป้าหมาย + เงื่อนไขผ่าน
  const TASKS = {
    // อาบน้ำ: อย่างน้อยวันละ 1 ครั้ง → ในเกมให้ “อาบให้ครบส่วน” ภายในเวลาที่กำหนด
    bathe: {
      name:"อาบน้ำ",
      emojis:["#em-shower","#em-soap","#em-scrub","#em-towel"],
      goalText:"ชำระร่างกายครบส่วนใน 1 รอบ",
      init:(state)=>{ state.goalHits=30; state.specialOK=true; },
      onHit:(state)=>{ state.goalHits--; },
      pass:(state)=> state.goalHits<=0
    },
    // ช่องปากและฟัน: แปรงอย่างน้อยวันละ 2 ครั้ง / ตรวจฟันปีละ 1 → เกม: เล่นครบ 120s + ชน “หมอฟัน” อย่างน้อย 1 ครั้ง
    oral: {
      name:"ช่องปากและฟัน",
      emojis:["#em-brush","#em-tooth","#em-brush","#em-tooth","#em-dent"], // มีโน้ตหมอฟันแทรก
      goalText:"แปรงฟัน 2 นาที และเคาะ 'ตรวจฟัน' อย่างน้อย 1 ครั้ง",
      init:(state)=>{ state.duration=120; state.dentOK=false; },
      onNoteSpawn:(state,note)=>{ // ทำให้ em-dent โผล่เป็นบางจังหวะ
        if(Math.random()<0.08) note.setAttribute('material','src:#em-dent; shader:flat; opacity:0.98; transparent:true'), note.__isDent=true;
      },
      onHit:(state, note)=>{ if(note.__isDent) state.dentOK=true; },
      pass:(state)=> state.elapsed>=120 && state.dentOK
    },
    // ล้างมือ: ก่อนกิน/หลังเข้าห้องน้ำ → เกม: วน “7 ขั้น” ครบอย่างน้อย 1 รอบ
    hands: {
      name:"ล้างมือ",
      // โทเคนตัวแทนขั้น: น้ำ-สบู่-ถู-ซอก-เล็บ-ล้าง-เช็ด
      seq:["#em-water","#em-soap","#em-foam","#em-hands","#em-nail","#em-water","#em-dry"],
      emojis:["#em-water","#em-soap","#em-foam","#em-hands","#em-nail","#em-water","#em-dry"],
      goalText:"ทำครบ 7 ขั้นตอนอย่างน้อย 1 รอบ",
      init:(state)=>{ state.stepIndex=0; state.stepDone=0; },
      onSpawnSeq:(state,i)=> i, // แค่ชี้วัด index เพื่อแสดงชื่อขั้น
      onHit:(state)=>{ state.stepIndex=(state.stepIndex+1)%7; if(state.stepIndex===0) state.stepDone++; },
      pass:(state)=> state.stepDone>=1
    },
    // เล็บ: ตัดเล็บให้สั้นอยู่เสมอ → เกม: เคาะ “กรรไกร/ตะไบ/ทำความสะอาด” ให้ครบจำนวน
    nails: {
      name:"ดูแลเล็บ",
      emojis:["#em-clip","#em-clean","#em-nail"],
      goalText:"ตัด/ทำความสะอาดเล็บอย่างน้อย 10 ครั้ง",
      init:(state)=>{ state.trimLeft=10; },
      onHit:(state)=>{ state.trimLeft--; },
      pass:(state)=> state.trimLeft<=0
    }
  };

  // ---- State ----
  const state={
    running:false, raf:0, t0:0, elapsed:0,
    score:0, combo:0, best:0, accHit:0, accTotal:0,
    hitWindow:DIFF.easy.hit, duration:DIFF.easy.secs,
    calibrationMs:0,
    taskKey:"bathe"
  };
  let beatSec=60/96, nextBeat=0, notes=[]; // {el,t,z,judged, __isDent?}

  // Helpers
  function setHUD(msg=""){
    const taskName = TASKS[state.taskKey]?.name || state.taskKey;
    const acc = state.accTotal>0 ? Math.round(state.accHit/state.accTotal*100) : 0;
    let extra="";
    if(state.taskKey==="bathe") extra=`เหลือ ${Math.max(0,state.goalHits)} จังหวะ`;
    if(state.taskKey==="oral")  extra=`ตรวจฟัน: ${state.dentOK?"✅":"—"}`;
    if(state.taskKey==="hands") extra=`รอบ 7 ขั้น: ${state.stepDone}`;
    if(state.taskKey==="nails") extra=`เหลือ ${Math.max(0,state.trimLeft)} ครั้ง`;
    hud.textContent = `Hygiene Rhythm • ${taskName}\nscore=${state.score} combo=${state.combo} best=${state.best} acc=${acc}% • เวลา ${Math.max(0,Math.ceil((state.duration||0)-state.elapsed))}s\n${TASKS[state.taskKey]?.goalText || ""}\n${extra}\n${msg}`;
  }
  function makeNote(){
    const e=document.createElement('a-entity');
    e.classList.add('note');
    e.setAttribute('geometry','primitive: plane; width: 0.66; height: 0.66');
    // เลือกอีโมจิตาม task
    const T=TASKS[state.taskKey];
    let src = T.emojis[(Math.random()*T.emojis.length)|0];
    // สำหรับโหมด hands ใช้ลำดับ 7 ขั้น (บังคับตาม stepIndex)
    if(state.taskKey==="hands"){
      const idx = (state.stepIndex||0)%7;
      src = T.seq[idx];
    }
    e.setAttribute('material',`src:${src}; shader:flat; opacity:0.98; transparent:true`);
    e.object3D.position.set(0,0,2.8);
    root.appendChild(e);
    // hook ต่อเกม
    if(T.onNoteSpawn) T.onNoteSpawn(state, e);
    return {el:e, t:state.elapsed + 1.6, z:2.8, judged:false};
  }

  // Apply settings
  function applyDiff(){ const d=DIFF[selDiff.value]||DIFF.easy; state.hitWindow=d.hit; state.duration=d.secs; }
  function applyBPM(){ beatSec=60/parseInt(selBpm.value||"96",10); }
  function applyTask(){ state.taskKey = selTask.value; (TASKS[state.taskKey]?.init||(()=>{}))(state); }
  function applyCalib(){ state.calibrationMs=parseInt(calib.value||"0",10); calibVal.textContent = state.calibrationMs; }

  // Judgement
  function judgeHit(){
    const target = state.elapsed + (state.calibrationMs/1000);
    // หาโน้ตที่ใกล้สุด
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

    // hook เป้าหมายเฉพาะเกม
    (TASKS[state.taskKey]?.onHit||(()=>{}))(state, best.el);
  }

  // Flow
  function start(){
    // รีเซ็ตฉาก
    notes.forEach(n=>n.el?.parentNode?.removeChild(n.el)); notes.length=0;
    state.running=true; state.score=0; state.combo=0; state.best=0; state.accHit=0; state.accTotal=0;
    state.t0=performance.now()/1000; state.elapsed=0; nextBeat=0;
    // รีเซ็ต goal เฉพาะเกม
    (TASKS[state.taskKey]?.init||(()=>{}))(state);
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
    const pass = (TASKS[state.taskKey]?.pass||(()=>false))(state);
    toast(pass?"ภารกิจสำเร็จ! ✅":"ยังไม่ผ่าน ลองใหม่! ❌", pass?"#7dfcc6":"#fecaca");
    setHUD(`จบเกม • ${pass?"ผ่าน":"ไม่ผ่าน"}`);
  }

  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    const trainingOn = selTrain.value==="on";
    const scheduleSpan = trainingOn ? beatSec*2 : beatSec;

    // spawn + metronome
    while(nextBeat <= state.elapsed + 1.0){
      notes.push(makeNote());
      click();
      nextBeat += scheduleSpan;
    }

    // Training counter (1-2-3-4)
    if(trainingOn){
      const tBeat = Math.floor(state.elapsed/beatSec)%4;
      if(loop._lastCount!==tBeat){
        loop._lastCount=tBeat;
        const c=label3D(["1","2","3","4"][tBeat],{fontSize:0.34,y:0.3,color:"#f8fafc"});
        root.appendChild(c); setTimeout(()=>c.parentNode&&c.parentNode.removeChild(c),220);
      }
    }

    // move & overtime miss
    const speedZ = 1.6;
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

  // input
  function bindHit(el){
    const h=e=>{ e.preventDefault(); e.stopPropagation(); ensureAudio(); judgeHit(); };
    el.addEventListener('click',h);
    el.addEventListener('pointerup',h);
    el.addEventListener('touchend',h,{passive:false});
  }
  bindHit(hitPad);
  window.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') judgeHit(); });
  scene.addEventListener('select', ()=>judgeHit());

  // bindings
  btnStart.addEventListener('click', ()=>!state.running&&start());
  btnReset.addEventListener('click', reset);
  selDiff.addEventListener('change', ()=>{ applyDiff(); setHUD("ตั้งค่าโหมดแล้ว"); });
  selBpm.addEventListener('change', ()=>{ applyBPM(); setHUD("ตั้งค่า BPM แล้ว"); });
  selTask.addEventListener('change', ()=>{ applyTask(); setHUD("สลับเกมแล้ว"); });
  selTrain.addEventListener('change', ()=>setHUD("สลับ Training แล้ว"));
  calib.addEventListener('input', ()=>applyCalib());

  // boot
  applyDiff(); applyBPM(); applyTask(); applyCalib();
  setHUD("พร้อมเริ่ม • เลือก Task แล้วกด Start");
}
