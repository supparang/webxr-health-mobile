// Adventure — Weekly + Chain-3 + Auto-Challenge (จากเวอร์ชันก่อน)
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const hud=$("#hud"), scene=$("#scene"), root=$("#root"), sky=$("#sky"), cursor=$("#cursor");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset"), laneSel=$("#lane");

  function setCursorMode(m){ if(!cursor) return;
    if(m==="vr"){ cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900"); cursor.setAttribute("visible","true"); }
    else{ cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false"); cursor.setAttribute("visible","false"); } }
  setCursorMode("desktop"); scene?.addEventListener("enter-vr",()=>setCursorMode("vr")); scene?.addEventListener("exit-vr",()=>setCursorMode("desktop"));

  const q=new URLSearchParams(location.search);
  const diffQ=(q.get("diff")||"easy").toLowerCase();
  const theme=(q.get("theme")||"jungle").toLowerCase();
  const questQ=(q.get("quest")||"collect").toLowerCase();
  const autoChallenge = (q.get("autoChallenge") ?? "1") !== "0";

  // Weekly override (ถ้าส่งมาจาก Weekly Board)
  const wtype = q.get("wtype");      // 'collect'|'survive'|'streak'
  const wtarget = q.get("wtarget");  // ตัวเลข (หรือ 1 สำหรับ survive)

  // Chain-3 (ภารกิจต่อเนื่อง 3 ด่าน)
  const chain = (q.get("chain")||"").toString()==="3";

  const SKY = { jungle:"#bg-jungle", city:"#bg-city", space:"#bg-space" };
  if (SKY[theme]) sky.setAttribute("material", `src: ${SKY[theme]}; color: #fff`);
  else sky.setAttribute("material","color: #0b1220");

  const DIFF = {
    easy:{speed:1.8, hit:0.40, duration:40, spawnStep:1.2},
    normal:{speed:2.2, hit:0.35, duration:50, spawnStep:1.0},
    hard:{speed:2.6, hit:0.30, duration:55, spawnStep:0.8}
  };

  const SAVE_KEY="fitnessDuo_adventure_stats_v1";
  function loadSave(){ try{return JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(e){return{}} }
  function saveSave(s){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }catch(e){} }

  function daySeed(){ const d=new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`; }
  function hashCode(str){ let h=0; for(let i=0;i<str.length;i++) h=((h<<5)-h+str.charCodeAt(i))|0; return h; }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296; }; }

  function autoTuneBase(diffBase){
    const s=loadSave();
    const perf = Math.min(1, Math.max(0, ( (s.lastScore||0)/ (s.lastMax||200) ) ));
    const bump = (perf-0.4)*0.5;
    return {
      speed: diffBase.speed + bump*0.6,
      hit:   Math.max(0.22, diffBase.hit - bump*0.06),
      duration: diffBase.duration,
      spawnStep: Math.max(0.65, diffBase.spawnStep - bump*0.2)
    };
  }

  function genDailyChallenge(seedStr){
    const base=autoTuneBase(DIFF[diffQ]||DIFF.easy);
    const r=mulberry32(hashCode(seedStr));
    const types=["collect","survive","streak","time"];
    const type=types[(r()*types.length)|0];

    const ch={ type, target:10, title:"", hint:"", bonus:100, cfg:base };
    if(type==="collect"){ ch.target=Math.max(8, Math.round(base.duration*(0.22+r()*0.18))); ch.title="เก็บพลังงานให้ครบ"; ch.hint=`เป้า: ≥ ${ch.target}`; }
    if(type==="survive"){ ch.target=1; ch.title="เอาตัวรอด"; ch.hint="ห้ามตาย"; ch.cfg.spawnStep=Math.max(0.7, base.spawnStep*0.92); }
    if(type==="streak"){ ch.target=Math.max(6, 4+((r()*6)|0)); ch.title="สตรีคหลบต่อเนื่อง"; ch.hint=`เป้า: ≥ ${ch.target}`; }
    if(type==="time"){ ch.target=Math.max(35, base.duration-8); ch.cfg.duration=ch.target; ch.cfg.speed+=0.25; ch.title="สปรินต์ทำเวลา"; ch.hint=`ภายใน ${ch.target}s`; }
    return ch;
  }

  // เลือก Challenge (Weekly > Auto > Quest เดิม)
  let CH = autoChallenge ? genDailyChallenge(`${daySeed()}|${theme}|${diffQ}`) : {type:questQ, target:(questQ==="collect"?10:(questQ==="streak"?6:1)), title:"โหมดธรรมดา", hint:"", bonus:0, cfg:(DIFF[diffQ]||DIFF.easy)};
  if(wtype){ // weekly override
    CH.type=wtype; CH.target=(wtype==="survive"?1:parseInt(wtarget||"10",10));
    const base=autoTuneBase(DIFF[diffQ]||DIFF.easy);
    CH.cfg=base; CH.bonus=150; CH.title=`Weekly: ${wtype}`; CH.hint=`เป้า: ${wtype==="survive"?"ไม่ตาย":CH.target}`;
  }

  // ===== Chain-3 =====
  const chainCfg = [
    {speed:+0.00, hit:0.00, dur:-5,  spawn:-0.05},
    {speed:+0.15, hit:-0.03, dur:0,  spawn:-0.10},
    {speed:+0.30, hit:-0.06, dur:+5, spawn:-0.15}
  ];
  let stageIndex=0, totalScore=0, totalBonus=0;

  // ==== Game State ====
  const state = {
    running:false, lane:1, score:0, lives:3,
    duration:CH.cfg.duration, speed:CH.cfg.speed, hitWindow:CH.cfg.hit,
    spawnStep:CH.cfg.spawnStep||1.0,
    items:[], nextSpawn:0, t0:0, raf:0, elapsed:0,
    quest:CH.type, qProgress:0, qTarget: CH.target,
    bestStreak:0, curStreak:0
  };

  const laneX=i=>[-1.2,0,1.2][i];
  function setHUD(msg){
    const chainTxt = chain ? ` | Chain 3: ด่าน ${stageIndex+1}/3` : "";
    hud.textContent = `Adventure • theme=${theme} diff=${diffQ}${chainTxt}\n${CH.title} — ${CH.hint}\nscore=${totalScore+state.score} lives=${state.lives}\n${msg||""}`;
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

  function spawn(){
    const lane=[0,1,2][(Math.random()*3)|0];
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

  function isCleared(){
    if(CH.type==="collect") return state.qProgress>=CH.target;
    if(CH.type==="survive") return state.lives>0;
    if(CH.type==="streak")  return state.bestStreak>=CH.target;
    if(CH.type==="time")    return state.elapsed<=CH.target;
    return false;
  }

  function applyChainTuning(){
    if(!chain) return;
    const t=chainCfg[stageIndex]||chainCfg[0];
    state.speed += t.speed;
    state.hitWindow = Math.max(0.2, state.hitWindow + t.hit);
    state.duration += t.dur;
    state.spawnStep = Math.max(0.6, state.spawnStep + t.spawn);
  }

  function start(){
    state.running=true; state.score=0; state.lives=3; state.lane=1;
    state.items.length=0; state.t0=performance.now()/1000; state.elapsed=0; state.nextSpawn=0;
    buildScene(); applyChainTuning(); setHUD("เริ่มเกม! ใช้ A/S/D หรือ ←↑→ เปลี่ยนเลน");
    loop();
  }
  function resetAll(){
    stageIndex=0; totalScore=0; totalBonus=0;
    state.duration=CH.cfg.duration; state.speed=CH.cfg.speed; state.hitWindow=CH.cfg.hit; state.spawnStep=CH.cfg.spawnStep||1.0;
  }
  function endStage(){
    state.running=false; cancelAnimationFrame(state.raf);
    const cleared=isCleared(); const bonus = cleared ? CH.bonus : 0;
    totalScore += state.score; totalBonus += bonus;
    const doneText = chain ? `ด่าน ${stageIndex+1}/3 จบ • ได้ ${state.score}+${bonus}` : `จบเกม • คะแนน: ${state.score+bonus}`;
    setHUD(`${doneText} (${cleared?"✅ ผ่าน":"❌ ไม่ผ่าน"})`);

    // Chain flow
    if(chain && stageIndex<2){
      stageIndex++;
      // รีเซ็ต state ยกเว้นค่า base (ค่อย ๆ ยากขึ้น)
      state.score=0; state.qProgress=0; state.bestStreak=0; state.curStreak=0; state.items=[];
      setTimeout(()=>start(), 900); // ไปด่านถัดไปอัตโนมัติ
    }else{
      // บันทึกสถิติรวม
      const s=loadSave(); s.lastScore=totalScore+totalBonus; s.lastMax=state.duration*30; s.lastCleared=cleared; s.lastChallenge=CH; s.ts=Date.now(); saveSave(s);
      const summary = chain ? `รวมทั้ง 3 ด่าน: ${totalScore}+${totalBonus} = ${totalScore+totalBonus}` : '';
      setHUD(`${doneText}\n${summary}`);
    }
  }

  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    if(state.elapsed>=state.nextSpawn){ spawn(); state.nextSpawn=state.elapsed + state.spawnStep; }

    for(const it of state.items){
      if(it.judged) continue;
      const dt = it.time - state.elapsed;
      it.el.object3D.position.z = dt*state.speed;
      judge(it, dt);
      if(dt<-state.hitWindow && !it.judged){ it.judged=true; it.el.setAttribute("visible","false"); state.curStreak=0; }
    }

    if(state.lives<=0 || state.elapsed>=state.duration) return endStage();
    state.raf=requestAnimationFrame(loop);
  }

  btnStart.addEventListener('click', ()=>{
    if(stageIndex===0 && !state.running) resetAll();
    if(!state.running) start();
  });
  btnReset.addEventListener('click', ()=>{ state.running=false; cancelAnimationFrame(state.raf); while(root.firstChild) root.removeChild(root.firstChild); resetAll(); setHUD("รีเซ็ตแล้ว"); });
  laneSel.addEventListener('change', e=>{ setLane(parseInt(e.target.value,10)||1); });
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='a'||k==='arrowleft') setLane(0);
    if(k==='s'||k==='arrowup')   setLane(1);
    if(k==='d'||k==='arrowright')setLane(2);
  });

  setHUD(chain? "พร้อมเริ่ม • โหมดภารกิจต่อเนื่อง 3 ด่าน" : "พร้อมเริ่ม • ชาเลนจ์รายวัน/วีค");
}
