(function () {
  "use strict";

  const VERSION = "2026-08-04-WORD-MATCH-SMOOTH-STEP-V14";
  const TRIGGER_DEG = 5.2;
  const RELEASE_DEG = 2.9;
  const NEUTRAL_MS = 170;
  const MOVE_MS = 240;
  const DWELL_MS = 720;
  const syntheticEvents = new WeakSet();

  const state = {
    boardActive:false,
    sensorSeen:false,
    calibrated:false,
    calibrationStarted:0,
    calibrationCount:0,
    calibrationGamma:0,
    calibrationBeta:0,
    baselineGamma:0,
    baselineBeta:0,
    rawGamma:0,
    rawBeta:0,
    armed:false,
    neutralSince:0,
    current:null,
    moving:false,
    moveStarted:0,
    fromX:0,
    fromY:0,
    toX:0,
    toY:0,
    cursorX:0,
    cursorY:0,
    dwellStarted:0,
    hasNavigated:false,
    cursor:null,
    progress:null,
    raf:0
  };

  function finite(value){ return Number.isFinite(Number(value)); }
  function clamp(value,min,max){ return Math.max(min,Math.min(max,value)); }
  function boardReady(){ return Boolean(document.getElementById("memoryGrid") && document.querySelector(".memory-card")); }
  function clearLegacyFocus(){ document.querySelectorAll(".memory-card.ew-tilt-focus").forEach(card=>card.classList.remove("ew-tilt-focus")); }

  function makeNeutralRelay(source){
    let relay;
    try{
      relay=new DeviceOrientationEvent("deviceorientation",{
        alpha:finite(source.alpha)?Number(source.alpha):0,
        beta:0,
        gamma:0,
        absolute:Boolean(source.absolute)
      });
    }catch(_){
      relay=new Event("deviceorientation");
      Object.defineProperties(relay,{
        alpha:{value:finite(source.alpha)?Number(source.alpha):0},
        beta:{value:0},gamma:{value:0},absolute:{value:Boolean(source.absolute)}
      });
    }
    syntheticEvents.add(relay);
    return relay;
  }

  function relaySensorReady(source){
    try{ window.dispatchEvent(makeNeutralRelay(source)); }catch(_){}
  }

  function selectableCards(){
    return Array.from(document.querySelectorAll(".memory-card:not(.matched):not([disabled])"))
      .filter(card=>card.getBoundingClientRect().width>20);
  }

  function centerOf(card){
    const rect=card.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  }

  function nearestToViewportCenter(cards){
    const cx=innerWidth/2,cy=innerHeight*.56;
    return cards.slice().sort((a,b)=>{
      const pa=centerOf(a),pb=centerOf(b);
      return Math.hypot(pa.x-cx,pa.y-cy)-Math.hypot(pb.x-cx,pb.y-cy);
    })[0]||null;
  }

  function directionalNeighbor(current,direction){
    const cards=selectableCards().filter(card=>card!==current);
    if(!current) return nearestToViewportCenter(cards);
    const origin=centerOf(current);
    const vector=direction==="left"?[-1,0]:direction==="right"?[1,0]:direction==="up"?[0,-1]:[0,1];
    const candidates=[];
    for(const card of cards){
      const p=centerOf(card),dx=p.x-origin.x,dy=p.y-origin.y;
      const forward=dx*vector[0]+dy*vector[1];
      if(forward<=8) continue;
      const lateral=Math.abs(dx*vector[1]-dy*vector[0]);
      const distance=Math.hypot(dx,dy);
      const anglePenalty=lateral/Math.max(forward,1);
      candidates.push({card,score:distance+anglePenalty*220+lateral*.35});
    }
    candidates.sort((a,b)=>a.score-b.score);
    return candidates[0]?.card||current;
  }

  function ensureCursor(){
    if(state.cursor?.isConnected) return;
    const cursor=document.createElement("div");
    cursor.id="smoothTiltCursor";
    cursor.setAttribute("aria-hidden","true");
    cursor.innerHTML='<span class="stc-dot"></span><span class="stc-ring"></span><span class="stc-progress"></span>';
    document.body.appendChild(cursor);
    state.cursor=cursor;
    state.progress=cursor.querySelector(".stc-progress");
  }

  function setTarget(card,animate){
    clearLegacyFocus();
    document.querySelectorAll(".memory-card.smooth-target").forEach(el=>{
      if(el!==card) el.classList.remove("smooth-target");
    });
    if(!card) return;

    const point=centerOf(card);
    if(!state.current){
      state.cursorX=point.x;state.cursorY=point.y;
      state.current=card;card.classList.add("smooth-target");
      return;
    }
    if(state.current===card){
      card.classList.add("smooth-target");
      return;
    }

    state.fromX=state.cursorX;state.fromY=state.cursorY;
    state.toX=point.x;state.toY=point.y;
    state.moveStarted=performance.now();
    state.moving=Boolean(animate);
    state.current=card;
    state.dwellStarted=0;
    state.hasNavigated=true;
    card.classList.add("smooth-target");
    try{ navigator.vibrate?.(14); }catch(_){}
    if(!animate){ state.cursorX=point.x;state.cursorY=point.y;state.moving=false; }
  }

  function directionFromTilt(dx,dy){
    if(Math.max(Math.abs(dx),Math.abs(dy))<TRIGGER_DEG) return "";
    if(Math.abs(dx)>=Math.abs(dy)*1.08) return dx<0?"left":"right";
    return dy<0?"up":"down";
  }

  function resetCalibration(now){
    state.calibrated=false;
    state.calibrationStarted=now;
    state.calibrationCount=0;
    state.calibrationGamma=0;
    state.calibrationBeta=0;
    state.armed=false;
    state.neutralSince=0;
  }

  function onOrientation(event){
    if(syntheticEvents.has(event)) return;
    if(!boardReady()||!finite(event.gamma)||!finite(event.beta)) return;

    event.stopImmediatePropagation();
    relaySensorReady(event);

    const now=performance.now();
    state.sensorSeen=true;
    state.rawGamma=Number(event.gamma);
    state.rawBeta=Number(event.beta);

    if(!state.boardActive){ state.boardActive=true;resetCalibration(now); }
    if(!state.calibrated){
      state.calibrationGamma+=state.rawGamma;
      state.calibrationBeta+=state.rawBeta;
      state.calibrationCount+=1;
      if(now-state.calibrationStarted>=480&&state.calibrationCount>=4){
        state.baselineGamma=state.calibrationGamma/state.calibrationCount;
        state.baselineBeta=state.calibrationBeta/state.calibrationCount;
        state.calibrated=true;
        state.neutralSince=now;
      }
      return;
    }

    const dx=state.rawGamma-state.baselineGamma;
    const dy=state.rawBeta-state.baselineBeta;
    const neutral=Math.max(Math.abs(dx),Math.abs(dy))<=RELEASE_DEG;

    if(neutral){
      if(!state.neutralSince) state.neutralSince=now;
      if(now-state.neutralSince>=NEUTRAL_MS) state.armed=true;
      state.baselineGamma+=(state.rawGamma-state.baselineGamma)*.018;
      state.baselineBeta+=(state.rawBeta-state.baselineBeta)*.018;
      return;
    }

    state.neutralSince=0;
    if(!state.armed||state.moving) return;
    const direction=directionFromTilt(dx,dy);
    if(!direction) return;

    state.armed=false;
    const next=directionalNeighbor(state.current,direction);
    if(next&&next!==state.current) setTarget(next,true);
    else try{ navigator.vibrate?.([8,35,8]); }catch(_){}
  }

  function updateInstruction(text){
    const instruction=document.querySelector(".game-panel .instruction");
    if(instruction&&instruction.textContent!==text) instruction.textContent=text;
  }

  function updateCursorVisual(percent){
    if(!state.cursor) return;
    state.cursor.style.transform=`translate3d(${state.cursorX}px,${state.cursorY}px,0)`;
    state.cursor.dataset.active=state.current?"1":"0";
    if(state.progress) state.progress.style.setProperty("--progress",`${clamp(percent,0,100)*3.6}deg`);
  }

  function smoothstep(t){ return t*t*(3-2*t); }

  function loop(now){
    if(!boardReady()){
      state.boardActive=false;state.sensorSeen=false;state.calibrated=false;state.current=null;
      state.cursor?.remove();state.cursor=null;state.progress=null;
      document.querySelectorAll(".memory-card.smooth-target").forEach(card=>card.classList.remove("smooth-target"));
      state.raf=requestAnimationFrame(loop);return;
    }

    clearLegacyFocus();ensureCursor();
    const cards=selectableCards();
    if(!state.current||!state.current.isConnected||state.current.classList.contains("matched")){
      setTarget(nearestToViewportCenter(cards),false);
    }

    if(!state.sensorSeen){
      updateInstruction("กำลังรอ Motion Sensor… ถือโทรศัพท์ในท่าที่ถนัด");
      updateCursorVisual(0);
      state.raf=requestAnimationFrame(loop);return;
    }
    if(!state.calibrated){
      updateInstruction("ตรวจพบ Motion Sensor • ถือเครื่องนิ่งชั่วครู่เพื่อปรับศูนย์");
      updateCursorVisual(0);
      state.raf=requestAnimationFrame(loop);return;
    }

    if(state.moving){
      const t=clamp((now-state.moveStarted)/MOVE_MS,0,1);
      const e=smoothstep(t);
      state.cursorX=state.fromX+(state.toX-state.fromX)*e;
      state.cursorY=state.fromY+(state.toY-state.fromY)*e;
      state.dwellStarted=0;
      updateInstruction("กำลังเลื่อนไปยังการ์ดถัดไป");
      if(t>=1){ state.moving=false;state.cursorX=state.toX;state.cursorY=state.toY; }
      updateCursorVisual(0);
      state.raf=requestAnimationFrame(loop);return;
    }

    let percent=0;
    if(state.current&&!state.current.classList.contains("flipped")&&!state.current.classList.contains("matched")){
      if(!state.dwellStarted) state.dwellStarted=now;
      percent=Math.min(100,((now-state.dwellStarted)/DWELL_MS)*100);
      updateInstruction(state.armed?`เอียงหนึ่งจังหวะเพื่อเลื่อน 1 ใบ • หรือค้างเพื่อเปิด ${Math.round(percent)}%`:`คืนเครื่องใกล้กลางสั้น ๆ เพื่อพร้อมสั่งครั้งใหม่ • ค้างเพื่อเปิด ${Math.round(percent)}%`);
      if(percent>=100){
        state.dwellStarted=0;
        const selected=state.current;
        selected.click();
      }
    }else{
      state.dwellStarted=0;
      updateInstruction(state.armed?"เอียงหนึ่งจังหวะเพื่อเลื่อนไปการ์ดข้างเคียง":"คืนเครื่องใกล้กลางสั้น ๆ เพื่อพร้อมสั่งครั้งใหม่");
    }
    updateCursorVisual(percent);
    state.raf=requestAnimationFrame(loop);
  }

  function updateAcademicCopy(){
    const title=document.querySelector(".memory-top .title strong");
    const subtitle=document.querySelector(".memory-top .title small");
    const heading=document.querySelector(".intro-card h1");
    const lead=document.querySelector(".intro-card .lead");
    const start=document.getElementById("startBtn");
    if(title) title.textContent="Vocabulary Navigation Lab";
    if(subtitle&&!subtitle.dataset.stepV14){
      subtitle.dataset.stepV14="1";
      subtitle.textContent=subtitle.textContent.replace("Tilt Snap","Smooth Step").replace("Smooth Tilt","Smooth Step").replace("P?","Passport");
    }
    if(heading) heading.textContent="Smooth Step Vocabulary Challenge";
    if(lead) lead.textContent="เอียงมือถือหนึ่งจังหวะเพื่อเลื่อนไปการ์ดข้างเคียงเพียงหนึ่งใบ การเคลื่อนจะลื่นและหยุดตรงกลางการ์ด จากนั้นค้างเพื่อเปิด";
    if(start) start.textContent="Start Vocabulary Challenge";
  }

  updateAcademicCopy();
  const copyPoll=setInterval(()=>{ updateAcademicCopy();if(boardReady())clearInterval(copyPoll); },300);
  window.addEventListener("deviceorientation",onOrientation,true);
  state.raf=requestAnimationFrame(loop);

  window.addEventListener("pagehide",()=>{
    clearInterval(copyPoll);cancelAnimationFrame(state.raf);
    window.removeEventListener("deviceorientation",onOrientation,true);
    state.cursor?.remove();clearLegacyFocus();
    document.querySelectorAll(".memory-card.smooth-target").forEach(card=>card.classList.remove("smooth-target"));
  },{once:true});

  window.EW_WORD_MATCH_SMOOTH_TILT=Object.freeze({
    version:VERSION,
    triggerDegrees:TRIGGER_DEG,
    releaseDegrees:RELEASE_DEG,
    moveDurationMs:MOVE_MS,
    dwellMs:DWELL_MS,
    interaction:"one-gesture-one-adjacent-card-smooth-transition",
    singleTarget:true,
    sensorRelay:true,
    touchFallback:false
  });
}());
