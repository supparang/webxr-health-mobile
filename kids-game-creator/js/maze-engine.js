// Phase 2.3: deterministic, connected maze generated from validated Game JSON.
export function mountMaze(canvas,game,onStatus=()=>{}){
 const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas unavailable");
 canvas.width=720;canvas.height=400;
 const cols=15,rows=9,cell=38,ox=75,oy=27;
 const keys=new Set(),touch=new Set();
 let grid,player,phase,level,raf=0,moveAt=0;
 const index=(x,y)=>y*cols+x;
 function generate(stage){
  const cells=Array.from({length:cols*rows},()=>({walls:[1,1,1,1],visited:false}));
  // Recursive backtracker: guarantees all cells reachable.
  const stack=[[0,0]];cells[0].visited=true;
  let seed=(stage*65537+game.rules.difficulty*7919)>>>0;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  while(stack.length){
   const [x,y]=stack[stack.length-1];
   const options=[[x,y-1,0,2],[x+1,y,1,3],[x,y+1,2,0],[x-1,y,3,1]].filter(([nx,ny])=>nx>=0&&nx<cols&&ny>=0&&ny<rows&&!cells[index(nx,ny)].visited);
   if(!options.length){stack.pop();continue;}
   const [nx,ny,side,opposite]=options[Math.floor(random()*options.length)];
   cells[index(x,y)].walls[side]=0;cells[index(nx,ny)].walls[opposite]=0;cells[index(nx,ny)].visited=true;stack.push([nx,ny]);
  }
  return cells;
 }
 function startStage(){grid=generate(level);player={x:0,y:0};phase="playing";onStatus("เขาวงกตด่าน "+level);}
 function restart(){level=1;startStage();}
 function move(direction){
  if(phase!=="playing")return;
  const directions={up:[0,-1,0],right:[1,0,1],down:[0,1,2],left:[-1,0,3]};
  const d=directions[direction];if(!d)return;
  const [dx,dy,wall]=d;
  if(grid[index(player.x,player.y)].walls[wall])return;
  player.x+=dx;player.y+=dy;
  if(player.x===cols-1&&player.y===rows-1){
   if(level>=game.rules.levels){phase="won";onStatus("ชนะแล้ว! ผ่านเขาวงกตครบทุกด่าน");}
   else{level++;startStage();}
  }
 }
 function draw(){
  ctx.fillStyle="#f4f8ff";ctx.fillRect(0,0,720,400);
  ctx.fillStyle="#243b57";ctx.font="bold 18px system-ui";ctx.fillText("เขาวงกต — ด่าน "+level+"/"+game.rules.levels,15,20);
  ctx.strokeStyle="#2e496a";ctx.lineWidth=3;ctx.beginPath();
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const w=grid[index(x,y)].walls,px=ox+x*cell,py=oy+y*cell;
   if(w[0]){ctx.moveTo(px,py);ctx.lineTo(px+cell,py);}
   if(w[3]){ctx.moveTo(px,py);ctx.lineTo(px,py+cell);}
   if(y===rows-1&&w[2]){ctx.moveTo(px,py+cell);ctx.lineTo(px+cell,py+cell);}
   if(x===cols-1&&w[1]){ctx.moveTo(px+cell,py);ctx.lineTo(px+cell,py+cell);}
  }
  ctx.stroke();
  ctx.fillStyle="#2ba96b";ctx.fillRect(ox+(cols-1)*cell+8,oy+(rows-1)*cell+8,cell-16,cell-16);
  ctx.fillStyle="#3659db";ctx.beginPath();ctx.arc(ox+(player.x+.5)*cell,oy+(player.y+.5)*cell,cell*.28,0,Math.PI*2);ctx.fill();
  if(phase==="won"){ctx.fillStyle="rgba(20,35,60,.82)";ctx.fillRect(0,0,720,400);ctx.fillStyle="white";ctx.font="bold 36px system-ui";ctx.textAlign="center";ctx.fillText("ชนะแล้ว!",360,190);ctx.font="18px system-ui";ctx.fillText("กดเริ่มใหม่เพื่อเล่นอีกครั้ง",360,225);ctx.textAlign="left";}
 }
 const mapping={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",ArrowUp:"up",KeyW:"up",ArrowDown:"down",KeyS:"down"};
 function down(e){const k=mapping[e.code];if(k){e.preventDefault();if(!e.repeat)move(k);keys.add(k);}}
 function up(e){const k=mapping[e.code];if(k){e.preventDefault();keys.delete(k);}}
 function loop(time){if(time-moveAt>145){for(const key of touch){move(key);break;}moveAt=time;}draw();raf=requestAnimationFrame(loop);}
 function setTouch(key,active){if(active){touch.add(key);move(key);}else touch.delete(key);}
 function destroy(){cancelAnimationFrame(raf);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);touch.clear();}
 window.addEventListener("keydown",down);window.addEventListener("keyup",up);
 restart();raf=requestAnimationFrame(loop);return{restart,setTouch,destroy};
}
