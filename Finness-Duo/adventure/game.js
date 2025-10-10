// Adventure — รับพารามิเตอร์ diff/theme/quest + เล่นง่ายได้ทันที
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const hud=$("#hud"), scene=$("#scene"), root=$("#root"), sky=$("#sky"), cursor=$("#cursor");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset"), laneSel=$("#lane");

  // Cursor desktop/VR
  function setCursorMode(m){ if(!cursor) return;
    if(m==="vr"){ cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900"); cursor.setAttribute("visible","true"); }
    else{ cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false"); cursor.setAttribute("visible","false"); } }
  setCursorMode("desktop"); scene?.addEventListener("enter-vr",()=>setCursorMode("vr")); scene?.addEventListener("exit-vr",()=>setCursorMode("desktop"));

  // Query params + fallback
  const q=new URLSearchParams(location.search);
  const diff=(q.get("diff")||"easy").toLowerCase();
  const theme=(q.get("theme")||"jungle").toLowerCase();
  const quest=(q.get("quest")||"collect").toLowerCase();

  // Theme sky
  const SKY = { jungle:"#bg-jungle", city:"#bg-city", space:"#bg-space" };
  sky.setAttribute("material", SKY[theme] ? `src: ${SKY[theme]}; color: #fff` : "color: #0b1220");

  // Difficulty
  const DIFF = {
    easy:{speed:1.8, hit:0.40, duration:40, spawnStep:1.2},
    normal:{speed:2.2, hit:0.35, duration:50, spawnStep:1.0},
    hard:{speed:2.6, hit:0.30, duration:55, spawnStep:0.8}
  };
  const cfg = DIFF[diff] || DIFF.easy;

  // State
  const state = {
    running:false, lane:1, score:0, lives:3,
    duration:cfg.duration, speed:cfg.speed, hitWindow:cfg.hit,
    items:[], nextSpawn:0, t0:0, raf:0, elapsed:0,
    quest, qProgress:0, qTarget: Math.round(cfg.duration/4)
  };

  // Helpers
  const laneX=i=>[-1.2,0,1.2][i];
  function setHUD(msg){
    hud.textContent = `Adventure • diff=${diff} theme=${theme} quest=${quest}\n${msg||""}`;
  }
  function feedback(msg,color="#7dfcc6"){
    const t=document.createElement('a-entity');
    t.setAttribute('troika-text',`value:${msg}; color:${color}; fontSize:0.18; maxWidth:6; align:center`);
    t.setAttribute('position','0 0.9 0.08'); root.appendChild(t);
    setTimeout(()=>t.parentNode&&t.parentNode.removeChild(t),520);
  }

  function buildScene(){
    while(root.firstChild) root.removeChild(root.firstChild);
    // lane board
    const plane=document.createElement('a-entity');
    plane.setAttribute('geometry','primitive: plane; width: 3.6; height: 2');
    plane.setAttribute('material','color:#94a3b8; opacity:0.12; shader:flat'); root.appendChild(plane);
    // poles
    [-1.2,0,1.2].forEach(x=>{
      const p=document.createElement('a-entity');
      p.setAttribute('geometry','primitive: box; width:0.06; height:1.6; depth:0.02');
      p.setAttribute('material','color:#94a3b8; opacity:0.35; shader:flat');
      p.setAttribute('position',`${x} 0 0.02`); root.appendChild(p);
    });
    // lane marker
    const mk=document.createElement('a-entity'); mk.id="laneMarker";
    mk.setAttribute('geometry','primitive: ring; radiusInner:0.14; radiusOuter:0.2; segmentsTheta:48');
    mk.setAttribute('material','color:#0ea5e9; opacity:0.95; shader:flat');
    mk.setAttribute('position',`${laneX(state.lane)} 0 0.05`); root.appendChild(mk);
  }
  function updateLaneMarker(){ const mk=document.getElementById('laneMarker'); if(mk) mk.object3D.position.set(laneX(state.lane),0,0.05); }
  function setLane(i){ state.lane=Math.max(0,Math.min(2,i)); updateLaneMarker(); }

  // Items
  function spawn(){
    const lane=[0,1,2][Math.floor(Math.random()*3)];
    const kind = Math.random()<0.6?'orb':'ob';
    const el=document.createElement('a-entity');
    const body=document.createElement('a-entity');
    if(kind==='orb'){ body.setAttribute('geometry','primitive: sphere; radius:0.16'); body.setAttribute('material','color:#22c55e; shader:flat; opacity:0.98'); }
    else{ body.setAttribute('geometry','primitive: box; width:0.7; height:0.5; depth:0.3'); body.setAttribute('material','color:#ef4444; shader:flat; opacity:0.95'); }
    el.appendChild(body); root.appendChild(el);
    el.object3D.position.set(laneX(lane),0,-2.0*state.speed);
    state.items.push({el,kind,lane,time:state.elapsed+ (2.0), judged:false});
  }

  function judge(it, dt){
    if(Math.abs(dt)<=state.hitWindow){
      if(it.kind==='orb'){
        if(state.lane===it.lane){ state.score+=20; state.qProgress++; feedback("เก็บพลังงาน +20","#22c55e"); }
        else feedback("พลาด Orb","#eab308");
      }else{
        if(state.lane===it.lane){ state.lives--; feedback("ชนสิ่งกีดขวาง -1","#ef4444"); }
        else feedback("หลบสำเร็จ","#38bdf8");
      }
      it.judged=true; it.el.setAttribute("visible","false");
    }
  }

  // Flow
  function start(){
    state.running=true; state.score=0; state.lives=3; state.lane=1;
    state.items.length=0; state.t0=performance.now()/1000; state.elapsed=0; state.nextSpawn=0;
    buildScene(); setHUD("เริ่มเกม! ใช้ A/S/D หรือ ←↑→ เปลี่ยนเลน");
    loop();
  }
  function reset(){
    state.running=false; cancelAnimationFrame(state.raf);
    while(root.firstChild) root.removeChild(root.firstChild);
    setHUD("รีเซ็ตแล้ว");
  }
  function end(){
    state.running=false; cancelAnimationFrame(state.raf);
    setHUD(`จบเกม • คะแนน: ${state.score} • เควสเก็บ=${state.qProgress}/${state.qTarget}`);
  }

  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    // spawn
    if(state.elapsed>=state.nextSpawn){ spawn(); state.nextSpawn=state.elapsed + (cfg.spawnStep || 1.0); }

    // move + judge
    for(const it of state.items){
      if(it.judged) continue;
      const dt = it.time - state.elapsed; // เวลาเหลือถึงเส้นตัดสิน
      it.el.object3D.position.z = dt*state.speed;
      judge(it, dt);
      if(dt<-state.hitWindow && !it.judged){ it.judged=true; it.el.setAttribute("visible","false"); }
    }

    if(state.elapsed>=state.duration) return end();
    state.raf=requestAnimationFrame(loop);
  }

  // events
  btnStart.addEventListener('click', ()=>!state.running&&start());
  btnReset.addEventListener('click', reset);
  laneSel.addEventListener('change', e=>{ setLane(parseInt(e.target.value,10)||1); });
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='a'||k==='arrowleft') setLane(0);
    if(k==='s'||k==='arrowup')   setLane(1);
    if(k==='d'||k==='arrowright')setLane(2);
  });

  // boot
  setHUD("พร้อมเริ่ม • รับค่าจากเมนูอัตโนมัติ");
}
