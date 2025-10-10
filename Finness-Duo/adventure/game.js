// Adventure — รับ diff/theme/quest + Auto-Challenge รายวัน + ปรับตามฝีมือ
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
  const diffQ=(q.get("diff")||"easy").toLowerCase();
  const theme=(q.get("theme")||"jungle").toLowerCase();
  const questQ=(q.get("quest")||"collect").toLowerCase();
  const autoChallenge = (q.get("autoChallenge") ?? "1") !== "0";

  // Theme sky
  const SKY = { jungle:"#bg-jungle", city:"#bg-city", space:"#bg-space" };
  if (SKY[theme]) sky.setAttribute("material", `src: ${SKY[theme]}; color: #fff`);
  else sky.setAttribute("material","color: #0b1220");

  // Difficulty base
  const DIFF = {
    easy:{speed:1.8, hit:0.40, duration:40, spawnStep:1.2},
    normal:{speed:2.2, hit:0.35, duration:50, spawnStep:1.0},
    hard:{speed:2.6, hit:0.30, duration:55, spawnStep:0.8}
  };

  // ==== Auto-Challenge Engine ====
  const SAVE_KEY="fitnessDuo_adventure_stats_v1";
  function loadSave(){ try{return JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(e){return{}} }
  function saveSave(s){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }catch(e){} }

  function daySeed(){
    const d=new Date(); // รายวันตามเครื่องผู้เล่น
    return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
  }
  function mulberry32(a){ // PRNG เบา ๆ
    return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296; };
  }

  // ปรับความยากจากสถิติเก่า (ยิ่งดี => ขยับยากขึ้นเล็กน้อย)
  function autoTuneBase(diffBase){
    const s=loadSave();
    const perf = Math.min(1, Math.max(0, ( (s.lastScore||0)/ (s.lastMax||200) ) )); // 0..1
    const bump = (perf-0.4)*0.5; // -0.2..+0.3
    const tuned={
      speed: diffBase.speed + bump*0.6,
      hit:   Math.max(0.22, diffBase.hit - bump*0.06),
      duration: diffBase.duration,
      spawnStep: Math.max(0.65, diffBase.spawnStep - bump*0.2)
    };
    return tuned;
  }

  function genDailyChallenge(seedStr){
    const s=loadSave(); // อ่านผลก่อนหน้า
    const base=autoTuneBase(DIFF[diffQ]||DIFF.easy);
    const r=mulberry32(hashCode(seedStr));

    // หมวดชาเลนจ์หลัก
    const types=["collect","survive","streak","time"];
    const type=types[(r()*types.length)|0];

    let challenge={
      type, // 'collect'|'survive'|'streak'|'time'
      target: 10,
      title:"",
      hint:"",
      bonus: 100,    // โบนัสเมื่อสำเร็จ
      penalties: 0,  // ยังไม่ใช้
      cfg: base      // ค่าพื้นฐานหลังปรับ auto-tune
    };

    // สุ่มพารามิเตอร์เป้า
    if(type==="collect"){
      const mul = 0.22 + r()*0.18; // สัดส่วนของระยะเวลาทั้งหมด
      challenge.target = Math.max(8, Math.round(challenge.cfg.duration * mul));
      challenge.title="เก็บพลังงานให้ครบ";
      challenge.hint=`เป้าหมาย: เก็บ Orb ≥ ${challenge.target}`;
    }else if(type==="survive"){
      challenge.target = 0; // ไม่เสียชีวิต
      challenge.title="เอาตัวรอด";
      challenge.hint="เล่นจบโดยไม่เสียชีวิต";
      // เพิ่มสิ่งกีดขวางขึ้นนิด
      challenge.cfg.spawnStep = Math.max(0.7, challenge.cfg.spawnStep * 0.92);
    }else if(type==="streak"){
      challenge.target = Math.max(6, 4 + ((r()*6)|0));
      challenge.title="สตรีคหลบต่อเนื่อง";
      challenge.hint=`หลบสิ่งกีดขวางติดกัน ≥ ${challenge.target}`;
      // เน้นอุปสรรค
    }else if(type==="time"){
      challenge.target = Math.max(35, challenge.cfg.duration - 8); // ตีเวลาจบเร็ว
      challenge.cfg.duration = challenge.target; // จบไวขึ้น
      challenge.title="สปรินต์ทำเวลา";
      challenge.hint=`จบสเตจภายใน ${challenge.target}s`;
      // เพิ่มความเร็วเล็กน้อย
      challenge.cfg.speed += 0.25;
    }

    // theme-based twist (เล็ก ๆ)
    if(theme==="space"){ challenge.cfg.speed+=0.1; }
    if(theme==="city"){  challenge.cfg.spawnStep=Math.max(0.65, challenge.cfg.spawnStep*0.96); }

    // ถ้ามี quest/diff จากเมนู จะ “ผสม” ไม่ทับ
    challenge.quest = questQ;

    return challenge;
  }
  function hashCode(str){ let h=0, i=0, len=str.length|0; for(; i<len; i++){ h=((h<<5)-h + str.charCodeAt(i))|0; } return h; }

  // == สร้างชาเลนจ์วันนี้ ==
  const todaySeed = `${daySeed()}|${theme}|${diffQ}`;
  const CH = autoChallenge ? genDailyChallenge(todaySeed) : {type:questQ, target: (questQ==="collect"?10: (questQ==="streak"?6:0)), title:"โหมดธรรมดา", hint:"", bonus:0, cfg: (DIFF[diffQ]||DIFF.easy)};

  // ==== Game State ====
  const state = {
    running:false, lane:1, score:0, lives:3,
    duration:CH.cfg.duration, speed:CH.cfg.speed, hitWindow:CH.cfg.hit,
    items:[], nextSpawn:0, t0:0, raf:0, elapsed:0,
    quest:CH.type, qProgress:0, qTarget: CH.target,
    bestStreak:0, curStreak:0
  };

  // Helpers
  const laneX=i=>[-1.2,0,1.2][i];
  function setHUD(msg){
    hud.textContent = `Adventure • theme=${theme} diff=${diffQ} • AutoChallenge=${autoChallenge?"ON":"OFF"}\n${CH.title} — ${CH.hint}\nscore=${state.score} lives=${state.lives}\n${msg||""}`;
  }
  function feedback(msg,color="#7dfcc6"){
    const t=document.createElement('a-entity');
    t.setAttribute('troika-text',`value:${msg}; color:${color}; fontSize:0.18; maxWidth:6; align:center`);
    t.setAttribute('position','0 0.9 0.08'); root.appendChild(t);
    setTimeout(()=>t.parentNode&&t.parentNode.removeChild(t),520);
  }

  function buildScene(){
    while(root.firstChild) root.removeChild(root.firstChild);
    const plane=document.createElement('a-entity');
    plane.setAttribute('geometry','primitive: plane; width: 3.6; height: 2');
    plane.setAttribute('material','color:#94a3b8; opacity:0.12; shader:flat'); root.appendChild(plane);
    [-1.2,0,1.2].forEach(x=>{
      const p=document.createElement('a-entity');
      p.setAttribute('geometry','primitive: box; width:0.06; height:1.6; depth:0.02');
      p.setAttribute('material','color:#94a3b8; opacity:0.35; shader:flat');
      p.setAttribute('position',`${x} 0 0.02`); root.appendChild(p);
    });
    const mk=document.createElement('a-entity'); mk.id="laneMarker";
    mk.setAttribute('geometry','primitive: ring; radiusInner:0.14; radiusOuter:0.2; segmentsTheta:48');
    mk.setAttribute('material','color:#0ea5e9; opacity:0.95; shader:flat');
    mk.setAttribute('position',`${laneX(state.lane)} 0 0.05`); root.appendChild(mk);
  }
  function updateLaneMarker(){ const mk=document.getElementById('laneMarker'); if(mk) mk.object3D.position.set(laneX(state.lane),0,0.05); }
  function setLane(i){ state.lane=Math.max(0,Math.min(2,i)); updateLaneMarker(); }

  // Items
  function spawn(){
    const lane=[0,1,2][(Math.random()*3)|0];
    // ปรับสัดส่วนอุปสรรคตามชาเลนจ์
    const biasOb = CH.type==="streak" || CH.type==="survive" ? 0.55 : 0.35;
    const kind = Math.random()< (1-biasOb) ? 'orb' : 'ob';
    const el=document.createElement('a-entity');
    const body=document.createElement('a-entity');
    if(kind==='orb'){ body.setAttribute('geometry','primitive: sphere; radius:0.16'); body.setAttribute('material','color:#22c55e; shader:flat; opacity:0.98'); }
    else{ body.setAttribute('geometry','primitive: box; width:0.7; height:0.5; depth:0.3'); body.setAttribute('material','color:#ef4444; shader:flat; opacity:0.95'); }
    el.appendChild(body); root.appendChild(el);
    el.object3D.position.set(laneX(lane),0,-2.0*state.speed);
    state.items.push({el,kind,lane,time:state.elapsed+2.0, judged:false});
  }

  function onHitOrb(){ state.score+=20; state.qProgress++; state.curStreak++; state.bestStreak=Math.max(state.bestStreak,state.curStreak); feedback("เก็บพลังงาน +20","#22c55e"); }
  function onClearObstacle(){ state.curStreak++; state.bestStreak=Math.max(state.bestStreak,state.curStreak); feedback("หลบสำเร็จ","#38bdf8"); }
  function onCrash(){ state.lives--; state.curStreak=0; feedback("ชนสิ่งกีดขวาง -1","#ef4444"); }

  function judge(it, dt){
    if(Math.abs(dt)<=state.hitWindow){
      if(it.kind==='orb'){
        if(state.lane===it.lane) onHitOrb(); else feedback("พลาด Orb","#eab308");
      }else{
        if(state.lane===it.lane) onCrash(); else onClearObstacle();
      }
      it.judged=true; it.el.setAttribute("visible","false");
    }
  }

  // Quest check
  function isCleared(){
    if(CH.type==="collect") return state.qProgress>=CH.target;
    if(CH.type==="survive") return state.lives>0;
    if(CH.type==="streak")  return state.bestStreak>=CH.target;
    if(CH.type==="time")    return state.elapsed<=CH.target; // เป้าคือจบในเวลา (เรา set duration = target แล้ว)
    return false;
  }

  // Flow
  function start(){
    state.running=true; state.score=0; state.lives=3; state.lane=1;
    state.items.length=0; state.t0=performance.now()/1000; state.elapsed=0; state.nextSpawn=0;
    state.qProgress=0; state.curStreak=0; state.bestStreak=0;
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
    const cleared=isCleared();
    const bonus = cleared ? CH.bonus : 0;
    const finalScore = state.score + bonus;
    setHUD(`จบเกม • คะแนน: ${finalScore} (${cleared?"✅ ผ่าน":"❌ ไม่ผ่าน"})\nรายละเอียด: เก็บ=${state.qProgress}, สตรีคสูงสุด=${state.bestStreak}, ชีวิต=${state.lives}`);
    // บันทึกเพื่อ auto-tune ครั้งถัดไป
    const s=loadSave();
    s.lastScore=finalScore; s.lastMax=state.duration*30; // เพดานประมาณการหยาบ ๆ
    s.lastCleared=cleared; s.lastChallenge=CH; s.ts=Date.now();
    saveSave(s);
  }

  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    if(state.elapsed>=state.nextSpawn){ spawn(); state.nextSpawn=state.elapsed + (CH.cfg.spawnStep || 1.0); }

    for(const it of state.items){
      if(it.judged) continue;
      const dt = it.time - state.elapsed;
      it.el.object3D.position.z = dt*state.speed;
      judge(it, dt);
      if(dt<-state.hitWindow && !it.judged){ it.judged=true; it.el.setAttribute("visible","false"); state.curStreak=0; }
    }

    if(state.lives<=0 || state.elapsed>=state.duration) return end();
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
  setHUD("พร้อมเริ่ม • ชาเลนจ์รายวันถูกตั้งให้อัตโนมัติ");
}
