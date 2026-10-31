// Phase 2.5 — Dodge Engine. Validated Game JSON only; no arbitrary code execution.
export function mountDodge(canvas,game,onStatus=()=>{}){
 const ctx=canvas.getContext("2d");
 if(!ctx)throw Error("Canvas is not supported");
 const W=720,H=400;
 canvas.width=W;canvas.height=H;
 const state={x:W/2-16,lives:game.player.lives,score:0,phase:"playing",obstacles:[],keys:new Set(),touch:new Set(),elapsed:0,spawn:0,invincible:0};
 const target=game.rules.targetScore;
 const speed=2.8+game.rules.difficulty*.55;
 let raf=0,last=0,accumulator=0,sequence=0;
 const pressed=k=>state.keys.has(k)||state.touch.has(k);
 function restart(){
  state.x=W/2-16;state.lives=game.player.lives;state.score=0;state.phase="playing";
  state.obstacles=[];state.elapsed=0;state.spawn=0;state.invincible=0;last=0;accumulator=0;sequence=0;
  onStatus("เริ่มเกมหลบสิ่งกีดขวาง");
 }
 function step(){
  if(state.phase!=="playing")return;
  if(pressed("left"))state.x-=5.1;
  if(pressed("right"))state.x+=5.1;
  state.x=Math.max(0,Math.min(W-32,state.x));
  if(state.invincible>0)state.invincible--;
  state.elapsed++;
  state.spawn--;
  if(state.spawn<=0){
   // Deterministic positions help make classroom QA repeatable.
   const x=20+((sequence*137+game.rules.difficulty*53)%650);
   sequence++;
   state.obstacles.push({x,y:-30,w:25,h:25});
   state.spawn=Math.max(17,48-game.rules.difficulty*5);
  }
  for(const obstacle of state.obstacles){
   obstacle.y+=speed;
   if(obstacle.y>H){
    obstacle.missed=true;state.score++;
   }else if(state.invincible===0&&obstacle.x<state.x+32&&obstacle.x+obstacle.w>state.x&&obstacle.y<360&&obstacle.y+obstacle.h>322){
    obstacle.missed=true;state.lives--;state.invincible=65;
   }
  }
  state.obstacles=state.obstacles.filter(o=>!o.missed);
  if(state.lives<=0){state.phase="lost";onStatus("เกมจบ — ชีวิตหมด");}
  else if(state.score>=target){state.phase="won";onStatus("ชนะแล้ว! หลบสิ่งกีดขวางสำเร็จ");}
 }
 function draw(){
  ctx.fillStyle="#142c49";ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#31516e";ctx.fillRect(0,360,W,40);
  ctx.fillStyle="#fff";ctx.font="bold 18px system-ui";
  ctx.fillText("คะแนน "+state.score+"/"+target+"   ชีวิต "+state.lives,16,27);
  for(const obstacle of state.obstacles){ctx.fillStyle="#ff9b54";ctx.fillRect(obstacle.x,obstacle.y,obstacle.w,obstacle.h);}
  if(state.invincible%8<4){ctx.fillStyle="#5dd4ff";ctx.fillRect(state.x,322,32,38);}
  if(state.phase!=="playing"){
   ctx.fillStyle="rgba(0,0,0,.72)";ctx.fillRect(0,0,W,H);
   ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="bold 36px system-ui";
   ctx.fillText(state.phase==="won"?"ชนะแล้ว!":"เกมจบ",W/2,H/2);
   ctx.font="18px system-ui";ctx.fillText("กดเริ่มใหม่เพื่อเล่นอีกครั้ง",W/2,H/2+38);
   ctx.textAlign="left";
  }
 }
 function loop(t){
  if(!last)last=t;
  accumulator+=Math.min(50,t-last);last=t;
  while(accumulator>=1000/60){step();accumulator-=1000/60;}
  draw();raf=requestAnimationFrame(loop);
 }
 const mapping={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right"};
 function down(e){const key=mapping[e.code];if(key){e.preventDefault();state.keys.add(key);}}
 function up(e){const key=mapping[e.code];if(key){e.preventDefault();state.keys.delete(key);}}
 window.addEventListener("keydown",down);window.addEventListener("keyup",up);
 function setTouch(key,active){if(active)state.touch.add(key);else state.touch.delete(key);}
 function destroy(){cancelAnimationFrame(raf);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);state.keys.clear();state.touch.clear();}
 restart();raf=requestAnimationFrame(loop);
 return {restart,setTouch,destroy};
}
