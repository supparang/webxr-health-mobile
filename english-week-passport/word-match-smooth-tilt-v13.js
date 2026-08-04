(function () {
  "use strict";

  const VERSION = "2026-08-04-WORD-MATCH-SMOOTH-TILT-V13-SENSOR-RELAY";
  const DEAD_ZONE = 2.2;
  const MAX_TILT = 15;
  const MAX_SPEED = 720;
  const SMOOTHING = 0.16;
  const DWELL_MS = 680;
  const RECENTER_MS = 900;
  const syntheticEvents = new WeakSet();

  const state = {
    active:false,sensorSeen:false,baselineGamma:0,baselineBeta:0,calibrated:false,
    calibrationStarted:0,calibrationCount:0,calibrationGamma:0,calibrationBeta:0,
    rawGamma:0,rawBeta:0,velocityX:0,velocityY:0,x:0,y:0,targetCard:null,
    dwellStarted:0,lastFrame:0,lastMotionAt:0,raf:0,cursor:null,progress:null
  };

  function boardReady(){return Boolean(document.getElementById("memoryGrid")&&document.querySelector(".memory-card"));}
  function finite(value){return Number.isFinite(Number(value));}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function clearLegacyFocus(){document.querySelectorAll(".memory-card.ew-tilt-focus").forEach(card=>card.classList.remove("ew-tilt-focus"));}

  function makeNeutralRelay(source){
    let relay;
    try{
      relay=new DeviceOrientationEvent("deviceorientation",{
        alpha:finite(source.alpha)?Number(source.alpha):0,beta:0,gamma:0,absolute:Boolean(source.absolute)
      });
    }catch(_){
      relay=new Event("deviceorientation");
      Object.defineProperties(relay,{
        alpha:{value:finite(source.alpha)?Number(source.alpha):0},beta:{value:0},gamma:{value:0},absolute:{value:Boolean(source.absolute)}
      });
    }
    syntheticEvents.add(relay);
    return relay;
  }

  function relaySensorReady(source){
    try{window.dispatchEvent(makeNeutralRelay(source));}catch(_){}
  }

  function ensureCursor(){
    if(state.cursor?.isConnected)return;
    const cursor=document.createElement("div");
    cursor.id="smoothTiltCursor";
    cursor.setAttribute("aria-hidden","true");
    cursor.innerHTML='<span class="stc-dot"></span><span class="stc-ring"></span><span class="stc-progress"></span>';
    document.body.appendChild(cursor);
    state.cursor=cursor;
    state.progress=cursor.querySelector(".stc-progress");
    state.x=innerWidth/2;
    state.y=innerHeight*.55;
  }

  function resetCalibration(now){
    state.calibrated=false;state.calibrationStarted=now;state.calibrationCount=0;
    state.calibrationGamma=0;state.calibrationBeta=0;state.velocityX=0;state.velocityY=0;state.dwellStarted=0;
  }

  function normalizeTilt(value){
    const sign=Math.sign(value),magnitude=Math.abs(value);
    if(magnitude<=DEAD_ZONE)return 0;
    return sign*clamp((magnitude-DEAD_ZONE)/(MAX_TILT-DEAD_ZONE),0,1);
  }

  function onOrientation(event){
    if(syntheticEvents.has(event))return;
    if(!boardReady()||!finite(event.gamma)||!finite(event.beta))return;

    event.stopImmediatePropagation();
    const now=performance.now();
    const gamma=Number(event.gamma),beta=Number(event.beta);
    state.sensorSeen=true;state.rawGamma=gamma;state.rawBeta=beta;state.lastMotionAt=now;

    if(!state.active){state.active=true;resetCalibration(now);}
    if(!state.calibrated){
      state.calibrationGamma+=gamma;state.calibrationBeta+=beta;state.calibrationCount+=1;
      if(now-state.calibrationStarted>=450&&state.calibrationCount>=4){
        state.baselineGamma=state.calibrationGamma/state.calibrationCount;
        state.baselineBeta=state.calibrationBeta/state.calibrationCount;
        state.calibrated=true;
      }
    }

    // Engine เดิมต้องเห็นว่าเซนเซอร์พร้อม แต่รับค่ากลางเพื่อไม่ให้ขยับ/เปิดการ์ดแข่ง
    relaySensorReady(event);
  }

  function selectableCards(){
    return Array.from(document.querySelectorAll(".memory-card:not(.matched):not([disabled])"))
      .filter(card=>card.getBoundingClientRect().width>20);
  }

  function cardAtCursor(){
    const cards=selectableCards();let best=null,bestDistance=Infinity;
    for(const card of cards){
      const rect=card.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      const inside=state.x>=rect.left&&state.x<=rect.right&&state.y>=rect.top&&state.y<=rect.bottom;
      const distance=Math.hypot(state.x-cx,state.y-cy);
      if((inside&&distance<bestDistance)||(!best&&distance<Math.min(rect.width,rect.height)*.55)){best=card;bestDistance=distance;}
    }
    return best;
  }

  function setTarget(card){
    clearLegacyFocus();
    document.querySelectorAll(".memory-card.smooth-target").forEach(el=>{if(el!==card)el.classList.remove("smooth-target");});
    if(state.targetCard===card){if(card)card.classList.add("smooth-target");return;}
    state.targetCard=card;state.dwellStarted=0;
    if(card){card.classList.add("smooth-target");try{navigator.vibrate?.(10);}catch(_){}}
  }

  function updateInstruction(text){
    const instruction=document.querySelector(".game-panel .instruction");
    if(instruction&&instruction.textContent!==text)instruction.textContent=text;
  }

  function updateCursorVisual(percent){
    if(!state.cursor)return;
    state.cursor.style.transform=`translate3d(${state.x}px,${state.y}px,0)`;
    state.cursor.dataset.active=state.targetCard?"1":"0";
    if(state.progress)state.progress.style.setProperty("--progress",`${clamp(percent,0,100)*3.6}deg`);
  }

  function loop(now){
    if(!boardReady()){
      state.active=false;state.sensorSeen=false;state.cursor?.remove();state.cursor=null;state.progress=null;
      document.querySelectorAll(".memory-card.smooth-target").forEach(card=>card.classList.remove("smooth-target"));
      state.raf=requestAnimationFrame(loop);return;
    }

    clearLegacyFocus();ensureCursor();
    const dt=state.lastFrame?Math.min(.034,(now-state.lastFrame)/1000):.016;state.lastFrame=now;

    if(!state.sensorSeen){
      updateInstruction("กำลังรอ Motion Sensor… ถือโทรศัพท์ในท่าที่ถนัด");
    }else if(!state.calibrated){
      updateInstruction("ตรวจพบ Motion Sensor • ถือเครื่องนิ่งชั่วครู่เพื่อปรับศูนย์");
    }else{
      const nx=normalizeTilt(state.rawGamma-state.baselineGamma),ny=normalizeTilt(state.rawBeta-state.baselineBeta);
      const desiredX=nx*MAX_SPEED,desiredY=ny*MAX_SPEED;
      state.velocityX+=(desiredX-state.velocityX)*SMOOTHING;
      state.velocityY+=(desiredY-state.velocityY)*SMOOTHING;
      state.x=clamp(state.x+state.velocityX*dt,24,innerWidth-24);
      state.y=clamp(state.y+state.velocityY*dt,150,innerHeight-72);

      const target=cardAtCursor();setTarget(target);
      const speed=Math.hypot(state.velocityX,state.velocityY);let percent=0;
      if(target&&speed<58&&!target.classList.contains("flipped")){
        if(!state.dwellStarted)state.dwellStarted=now;
        percent=Math.min(100,((now-state.dwellStarted)/DWELL_MS)*100);
        updateInstruction(`หยุดบนการ์ดเพื่อเปิด ${Math.round(percent)}%`);
        if(percent>=100){state.dwellStarted=0;target.click();setTarget(null);}
      }else{
        state.dwellStarted=0;
        updateInstruction(target?"ชะลอและหยุดบนการ์ดเพื่อเปิด":"เอียงมือถืออย่างนุ่มนวลเพื่อเลื่อนตัวชี้ไปยังการ์ด");
      }

      if(Math.abs(nx)<.03&&Math.abs(ny)<.03&&now-state.lastMotionAt>RECENTER_MS){
        state.baselineGamma+=(state.rawGamma-state.baselineGamma)*.025;
        state.baselineBeta+=(state.rawBeta-state.baselineBeta)*.025;
      }
      updateCursorVisual(percent);
    }
    state.raf=requestAnimationFrame(loop);
  }

  function updateAcademicCopy(){
    const title=document.querySelector(".memory-top .title strong"),subtitle=document.querySelector(".memory-top .title small");
    const heading=document.querySelector(".intro-card h1"),lead=document.querySelector(".intro-card .lead"),start=document.getElementById("startBtn");
    if(title)title.textContent="Vocabulary Navigation Lab";
    if(subtitle&&!subtitle.dataset.smoothV13){subtitle.dataset.smoothV13="1";subtitle.textContent=subtitle.textContent.replace("Tilt Snap","Smooth Tilt").replace("P?","Passport");}
    if(heading)heading.textContent="Smooth Tilt Vocabulary Challenge";
    if(lead)lead.textContent="ควบคุมตัวชี้ด้วยการเอียงมือถืออย่างนุ่มนวล และหยุดบนการ์ดเพื่อเปิด จับคู่คำศัพท์กับความหมายหรือนิยามให้ครบภายใต้เวลาที่กำหนด";
    if(start)start.textContent="Start Vocabulary Challenge";
  }

  updateAcademicCopy();
  const copyPoll=setInterval(()=>{updateAcademicCopy();if(boardReady())clearInterval(copyPoll);},300);
  window.addEventListener("deviceorientation",onOrientation,true);
  state.raf=requestAnimationFrame(loop);

  window.addEventListener("pagehide",()=>{
    clearInterval(copyPoll);cancelAnimationFrame(state.raf);window.removeEventListener("deviceorientation",onOrientation,true);
    state.cursor?.remove();clearLegacyFocus();document.querySelectorAll(".memory-card.smooth-target").forEach(card=>card.classList.remove("smooth-target"));
  },{once:true});

  window.EW_WORD_MATCH_SMOOTH_TILT=Object.freeze({
    version:VERSION,deadZoneDegrees:DEAD_ZONE,maxSpeedPxPerSec:MAX_SPEED,dwellMs:DWELL_MS,
    interaction:"smooth-tilt-single-target-neutral-sensor-relay",singleTarget:true,sensorRelay:true,touchFallback:false
  });
}());
