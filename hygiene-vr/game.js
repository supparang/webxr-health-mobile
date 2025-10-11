// Hygiene Rhythm — 4 Games (V3 Challenge Edition)
// เพิ่ม 3 เลน, Section Pattern, Combo Multiplier, Fever Gauge, Adaptive Difficulty, Boss Phase
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), root=$("#root"), hud=$("#hud");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset");
  const selTask=$("#task"), selDiff=$("#difficulty"), selBpm=$("#bpm"), selTrain=$("#training");
  const calib=$("#calib"), calibVal=$("#calibVal");
  const THAI_FONT = $("#thaiFont")?.getAttribute("src");

  // ---------- Text helper ----------
  function label3D(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#e2e8f0", fontSize=0.18, maxWidth=5, x=0, y=0, z=0.06} = opts;
    e.setAttribute('troika-text',`value:${value}; font:${THAI_FONT}; color:${color}; fontSize:${fontSize}; maxWidth:${maxWidth}; align:center`.replace(/\s+/g,' '));
    e.setAttribute('position',`${x} ${y} ${z}`); e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }
  function toast(text,color){ const t=label3D(text,{color,fontSize:0.2,y:0.85}); uiRoot.appendChild(t); setTimeout(()=>t.remove(),520); }

  // ---------- Audio (metronome) ----------
  let actx=null,gain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; actx=new AC(); gain=actx.createGain(); gain.gain.value=0.12; gain.connect(actx.destination); }
  function click(){ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type="square"; o.frequency.value=880; o.connect(g); g.connect(gain);
    const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.22,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.05); o.start(t); o.stop(t+0.06); }
  ["pointerdown","touchend","click","keydown"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ---------- Difficulty / timing ----------
  const DIFF = { easy:{hit:0.18, secs:70}, normal:{hit:0.14, secs:85}, hard:{hit:0.10, secs:100} };
  let beatSec = 60 / parseInt(selBpm?.value||"96",10);

  // ---------- 4 Tasks ----------
  const TASKS = {
    bathe: { name:"อาบน้ำ", emojis:["#em-shower","#em-soap","#em-scrub","#em-towel"], goalText:"ชำระร่างกายครบส่วนใน 1 รอบ",
      init:(s)=>{ s.goalHits=36; }, onHit:(s)=>{ s.goalHits--; }, pass:(s)=> s.goalHits<=0 },
    oral:  { name:"ช่องปากและฟัน", emojis:["#em-brush","#em-tooth","#em-brush","#em-tooth","#em-dent"], goalText:"แปรงฟัน 2 นาที + ตี 'ตรวจฟัน' ≥1",
      init:(s)=>{ s.duration=120; s.dentOK=false; }, onNoteSpawn:(s,n)=>{ if(Math.random()<0.10){ n.setAttribute('material','src:#em-dent; shader:flat; opacity:0.98; transparent:true'); n.__isDent=true; } }, onHit:(s,n)=>{ if(n?.__isDent) s.dentOK=true; }, pass:(s)=> s.elapsed>=120 && s.dentOK },
    hands: { name:"ล้างมือ", seq:["#em-water","#em-soap","#em-foam","#em-hands","#em-nail","#em-water","#em-dry"], emojis:["#em-water","#em-soap","#em-foam","#em-hands","#em-nail","#em-water","#em-dry"], goalText:"ทำครบ 7 ขั้น ≥1 รอบ",
      init:(s)=>{ s.stepIndex=0; s.stepDone=0; }, onHit:(s)=>{ s.stepIndex=(s.stepIndex+1)%7; if(s.stepIndex===0) s.stepDone++; }, pass:(s)=> s.stepDone>=1 },
    nails: { name:"ดูแลเล็บ", emojis:["#em-clip","#em-clean","#em-nail"], goalText:"ตัด/ทำความสะอาดเล็บ ≥12 ครั้ง",
      init:(s)=>{ s.trimLeft=12; }, onHit:(s)=>{ s.trimLeft--; }, pass:(s)=> s.trimLeft<=0 },
  };

  // ---------- Scene roots ----------
  const uiRoot = (()=>{
    let el=document.getElementById("root");
    if(!el){ el=document.createElement('a-entity'); el.setAttribute('id','root'); el.setAttribute('position','0 1.25 -3'); scene.appendChild(el); }
    return el;
  })();
  const playRoot = uiRoot; // ใช้ตัวเดียวเพื่อให้ง่าย

  // ---------- Lanes (3 pads) ----------
  const laneX = [-0.8, 0, 0.8];
  const lanePads = [];
  function buildLanePads(){
    // ลบของเก่า
    lanePads.splice(0).forEach(p=>p?.remove?.());
    for(let i=0;i<3;i++){
      const pad=document.createElement('a-entity');
      pad.classList.add('clickable'); pad.dataset.lane=i;
      pad.setAttribute('geometry','primitive: plane; width: 0.68; height: 0.42');
      pad.setAttribute('material','color:#0f172a; opacity:0.95; shader:flat');
      pad.setAttribute('position',`${laneX[i]} -0.62 0.06`);
      const t=label3D(i===0?"A\nLEFT":i===1?"S\nCENTER":"D\nRIGHT",{fontSize:0.14,y:0,z:0.01,color:"#93c5fd"});
      pad.appendChild(t);
      pad.addEventListener('click',()=>judgeHit(i));
      pad.addEventListener('pointerup',()=>judgeHit(i));
      pad.addEventListener('touchend',(e)=>{e.preventDefault();judgeHit(i)},{passive:false});
      uiRoot.appendChild(pad);
      lanePads.push(pad);
    }
  }

  // ---------- Fever Gauge ----------
  let feverGauge=null;
  function buildFeverUI(){
    if(feverGauge) feverGauge.remove();
    feverGauge=document.createElement('a-entity');
    feverGauge.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.06');
    feverGauge.setAttribute('material','color:#1e293b; opacity:0.95; shader:flat');
    feverGauge.setAttribute('position','0 0.9 0.05');
    const fill=document.createElement('a-entity');
    fill.setAttribute('geometry','primitive: plane; width: 0.01; height: 0.06');
    fill.setAttribute('material','color:#7dfcc6; opacity:0.96; shader:flat');
    fill.setAttribute('position','-1.1 0 0.01');
    feverGauge.__fill=fill; feverGauge.appendChild(fill);
    const label=label3D("FEVER",{fontSize:0.14,y:0.1,color:"#cbd5e1"}); feverGauge.appendChild(label);
    uiRoot.appendChild(feverGauge);
  }
  function setFeverFill(ratio){
    if(!feverGauge) return;
    const w = Math.max(0.01, Math.min(2.2*ratio, 2.2));
    feverGauge.__fill.setAttribute('geometry',`primitive: plane; width:${w}; height:0.06`);
    feverGauge.__fill.setAttribute('position',`${-1.1 + w/2} 0 0.01`);
  }

  // ---------- State ----------
  const state={
    running:false, raf:0, t0:0, elapsed:0,
    score:0, combo:0, best:0, accHit:0, accTotal:0,
    hitWindow:DIFF.easy.hit, duration:DIFF.easy.secs,
    calibrationMs:0, taskKey: selTask?.value || "bathe",
    fever:0, feverOn:false, feverEnd:0,
    multiplier:1,
    trainOn: (selTrain?.value||"on")==="on",
  };
  let notes=[]; // {el, t, z, lane, judged, __isDent?}
  let nextBeat=0;

  // ---------- Settings ----------
  function applyDiff(){ const d=DIFF[selDiff.value]||DIFF.easy; state.hitWindow=d.hit; state.duration=d.secs; }
  function applyBPM(){ beatSec = 60 / parseInt(selBpm.value||"96",10); }
  function applyTask(){ state.taskKey = selTask.value; (TASKS[state.taskKey]?.init||(()=>{}))(state); }
  function applyCalib(){ state.calibrationMs = parseInt(calib.value||"0",10); calibVal.textContent = state.calibrationMs; }
  function setHUD(msg=""){
    const T=TASKS[state.taskKey], name=T?.name||state.taskKey;
    const acc = state.accTotal? Math.round(state.accHit/state.accTotal*100):0;
    let extra="";
    if(state.taskKey==="bathe") extra=`เหลือ ${Math.max(0,state.goalHits)} จังหวะ`;
    if(state.taskKey==="oral")  extra=`ตรวจฟัน: ${state.dentOK?"✅":"—"}`;
    if(state.taskKey==="hands") extra=`รอบ 7 ขั้น: ${state.stepDone||0}`;
    if(state.taskKey==="nails") extra=`เหลือ ${Math.max(0,state.trimLeft)} ครั้ง`;
    hud.textContent = `Hygiene Rhythm • ${name}\nscore=${state.score} combo=${state.combo} best=${state.best} acc=${acc}% x${state.multiplier} ${state.feverOn?"• FEVER":""}\nเวลา ${Math.max(0,Math.ceil(state.duration - state.elapsed))}s\n${T?.goalText||""}\n${extra}\n${msg}`;
  }

  // ---------- Spawn notes (3 lanes + Sections) ----------
  function randomLane(){ return (Math.random()*3)|0; }
  function spawnNote(lane, aheadSec=1.6, srcOverride=null){
    const n=document.createElement('a-entity');
    n.classList.add('note');
    n.setAttribute('geometry','primitive: plane; width: 0.62; height: 0.62');
    const T=TASKS[state.taskKey];
    let src = srcOverride || T.emojis[(Math.random()*T.emojis.length)|0];
    if(state.taskKey==="hands"){ const idx=(state.stepIndex||0)%7; src=T.seq[idx]; }
    n.setAttribute('material',`src:${src}; shader:flat; opacity:0.98; transparent:true`);
    n.object3D.position.set(laneX[lane],0,2.8);
    playRoot.appendChild(n);
    if(T.onNoteSpawn) T.onNoteSpawn(state, n);
    const obj={el:n, lane, t:state.elapsed + aheadSec, z:2.8, judged:false, __isDent:n.__isDent};
    notes.push(obj);
    return obj;
  }

  // สร้างแพทเทิร์นตาม Section
  function spawnSection(sec){
    const dens = sec.density; // ความถี่ (ยิ่งมากยิ่งถี่)
    const beats = sec.beats;
    let ptr=0;
    while(ptr<beats){
      if(Math.random()<dens){
        // 50% เป็น single, 35% เป็น double, 15% เป็น triple (Chord)
        const r=Math.random();
        if(r<0.5){
          spawnNote(randomLane());
        }else if(r<0.85){
          const l=randomLane(); const l2=(l+1+((Math.random()*2)|0))%3;
          spawnNote(l); spawnNote(l2);
        }else{
          spawnNote(0); spawnNote(1); spawnNote(2);
        }
      }
      nextBeat += beatSec;
      click();
      ptr++;
    }
  }

  // ---------- Fever ----------
  function addFever(v){ state.fever = Math.max(0, Math.min(100, state.fever + v)); setFeverFill(state.fever/100); }
  function triggerFever(){ if(state.feverOn||state.fever<100) return; state.feverOn=true; state.feverEnd = state.elapsed + 7; state.multiplier = Math.min(4, state.multiplier+1); toast("FEVER!! ✨","#7dfcc6"); state.fever = 0; setFeverFill(0); }
  function updateFever(){ if(state.feverOn && state.elapsed>=state.feverEnd){ state.feverOn=false; toast("Fever End","#cbd5e1"); } }

  // ---------- Combo Multiplier ----------
  function updateMultiplier(){
    if(state.combo>=40) state.multiplier=4;
    else if(state.combo>=20) state.multiplier=3;
    else if(state.combo>=10) state.multiplier=2;
    else state.multiplier=1;
  }

  // ---------- Judge ----------
  function judgeHit(lane){
    const target = state.elapsed + (state.calibrationMs/1000);
    // หาโน้ตที่ใกล้ที่สุด "ในเลนเดียวกัน" เท่านั้น
    let best=null, bestErr=999;
    for(const it of notes){
      if(it.judged || it.lane!==lane) continue;
      const err=Math.abs(it.t - target);
      if(err<bestErr){ best=it; bestErr=err; }
    }
    state.accTotal++;
    if(!best || bestErr>state.hitWindow){
      state.combo=0; updateMultiplier(); toast("Miss","#fecaca"); addFever(-8);
      // ปรับความยากลงเบา ๆ
      state.hitWindow=Math.min(DIFF.easy.hit, state.hitWindow+0.01);
      return;
    }
    best.judged=true; best.el.setAttribute("visible","false");
    state.accHit++; state.combo++; updateMultiplier();
    const isPerfect = bestErr<=state.hitWindow*0.35;
    const base = isPerfect? 300:150;
    const gain = Math.round(base * (state.feverOn?1.5:1) * state.multiplier);
    state.score += gain;
    toast((isPerfect?"Perfect ":"Good ") + `+${gain}`, isPerfect?"#7dfcc6":"#a7f3d0");
    // hooks
    (TASKS[state.taskKey]?.onHit||(()=>{}))(state, best);
    // เติม Fever
    addFever(isPerfect? 6:3);
    if(state.fever>=100 && !state.feverOn){
      // เบิร์สด้วยการ "กด/จ้องเลนกลาง" เพื่อเปิดใช้
      // ถ้าผู้เล่นกดเลนกลางทันที ให้ติด FEVER
      // (เพื่อความง่าย ที่นี่เปิดให้อัตโนมัติเมื่อเต็ม)
      triggerFever();
    }
    // ปรับความยากขึ้นเบา ๆ เมื่อเล่นดี
    if(isPerfect && state.hitWindow>0.08) state.hitWindow -= 0.002;
    state.best=Math.max(state.best,state.combo);
  }

  // ---------- Flow ----------
  function start(){
    ensureAudio();
    // reset
    notes.forEach(n=>n.el?.remove()); notes.length=0;
    state.running=true; state.score=0; state.combo=0; state.best=0; state.accHit=0; state.accTotal=0;
    state.fever=0; state.feverOn=false; state.multiplier=1;
    state.trainOn = (selTrain?.value||"on")==="on";
    (TASKS[state.taskKey]?.init||(()=>{}))(state);
    buildLanePads(); buildFeverUI(); setFeverFill(0);

    state.t0=performance.now()/1000; state.elapsed=0; nextBeat=0;
    setHUD("เริ่ม!");

    // สร้าง Section schedule
    sectionPtr=0; sections = makeSections();
    loop();
  }
  function reset(){
    state.running=false; cancelAnimationFrame(state.raf);
    notes.forEach(n=>n.el?.remove()); notes.length=0;
    setHUD("รีเซ็ตแล้ว");
  }
  function end(){
    state.running=false; cancelAnimationFrame(state.raf);
    const pass=(TASKS[state.taskKey]?.pass||(()=>false))(state);
    toast(pass?"ภารกิจสำเร็จ! ✅":"ยังไม่ผ่าน ลองใหม่! ❌", pass?"#7dfcc6":"#fecaca");
    setHUD(`จบเกม • ${pass?"ผ่าน":"ไม่ผ่าน"}`);
  }

  // ---------- Sections (Intro → Main → Boss) ----------
  let sections=[], sectionPtr=0, sectionEndAt=0;
  function makeSections(){
    const mainBeats = Math.max(8, Math.floor((state.duration/beatSec)-24)); // เผื่อเวลา intro/boss อย่างละ ~12 บีต
    return [
      {name:"Intro", beats:12, density:0.35},
      {name:"Main",  beats:mainBeats, density: state.trainOn ? 0.45 : 0.65},
      {name:"Boss",  beats:12, density:0.9}
    ];
  }
  function stepSection(){
    if(sectionPtr>=sections.length) return;
    const sec = sections[sectionPtr];
    spawnSection(sec);
    sectionEndAt = state.elapsed + sec.beats*beatSec;
    sectionPtr++;
  }

  // ---------- Main loop ----------
  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    // เริ่ม section ใหม่เมื่อถึงเวลา
    if(state.elapsed>=sectionEndAt) stepSection();

    // Training: ช้าลง (เพิ่มเวลานำหน้า)
    const ahead = state.trainOn ? 2.0 : 1.6;

    // เคลื่อนโน้ต + มิสที่เลยเส้น
    const speedZ = 1.6;
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - (state.elapsed + (state.calibrationMs/1000));
      it.z = Math.max(0, dt*speedZ);
      it.el.object3D.position.set(laneX[it.lane], 0, it.z);
      if(dt<-state.hitWindow && !it.judged){
        it.judged=true; it.el.setAttribute("visible","false");
        state.combo=0; updateMultiplier(); toast("Miss","#fecaca"); addFever(-8);
        // ยืด hit-window เล็กน้อยเมื่อพลาดบ่อย
        state.hitWindow=Math.min(DIFF.easy.hit, state.hitWindow+0.008);
      }
    }

    updateFever();
    setHUD();

    if(state.elapsed>=state.duration) return end();
    state.raf=requestAnimationFrame(loop);
  }

  // ---------- Input ----------
  function keyLane(e){
    const k=(e.key||"").toLowerCase();
    if(k==='a'||k==='arrowleft') return 0;
    if(k==='s'||k==='arrowup')   return 1;
    if(k==='d'||k==='arrowright')return 2;
    return null;
  }
  window.addEventListener('keydown',(e)=>{
    if(e.key===' '||e.key==='Enter'){ /* no-op (ไว้ใช้อนาคตเป็น “ฮิตทุกเลน”) */ return; }
    const ln=keyLane(e); if(ln!==null) judgeHit(ln);
    if((e.key||'').toLowerCase()==='s' && !state.running) start();
    if((e.key||'').toLowerCase()==='r') reset();
  });

  // ---------- Bind UI ----------
  btnStart?.addEventListener('click', ()=>!state.running&&start());
  btnReset?.addEventListener('click', reset);
  selDiff?.addEventListener('change', ()=>{ applyDiff(); setHUD("ตั้งค่าโหมดแล้ว"); });
  selBpm?.addEventListener('change',  ()=>{ applyBPM(); setHUD("ตั้งค่า BPM แล้ว"); });
  selTask?.addEventListener('change', ()=>{ applyTask(); setHUD("สลับเกมแล้ว"); });
  selTrain?.addEventListener('change',()=>{ state.trainOn=(selTrain.value==="on"); setHUD("สลับ Training แล้ว"); });
  calib?.addEventListener('input', ()=>applyCalib());

  // ---------- Boot ----------
  applyDiff(); applyBPM(); applyTask(); applyCalib();
  buildLanePads(); buildFeverUI(); setFeverFill(0);
  setHUD("พร้อมเริ่ม • เลือก Task แล้วกด Start (A/S/D = เลน ซ้าย/กลาง/ขวา)");
}
