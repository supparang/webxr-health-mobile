// Phase 2.2 — self-contained Canvas adventure engine. No eval or dynamic code.
export function mountAdventure(canvas, game, onStatus = () => {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas is not supported");
  const W=720,H=400, ground=350;
  canvas.width=W;canvas.height=H;
  const state={x:55,y:ground-38,vy:0,score:0,lives:game.player.lives,level:1,phase:"playing",invulnerable:0,keys:new Set(),touch:new Set(),frame:0};
  const goal=game.rules.targetScore;
  let raf=0,previous=0,accumulator=0;
  const levelTarget=level=>Math.ceil(goal*level/game.rules.levels);
  let coins=[],enemies=[];
  function populate(){
    coins=Array.from({length:Math.min(12,Math.max(1,levelTarget(state.level)-state.score))},(_,i)=>({x:115+(i%12)*46,y:ground-32-(i%3)*12,taken:false}));
    enemies=Array.from({length:Math.min(5,game.rules.enemyCount)},(_,i)=>({x:250+i*95,y:ground-30,dir:i%2?1:-1}));
    state.x=55;state.y=ground-38;state.vy=0;
  }
  const pressed=k=>state.keys.has(k)||state.touch.has(k);
  function step(){
    if(state.phase!=="playing")return;
    state.frame++;if(state.invulnerable>0)state.invulnerable--;
    const speed=2.7+game.rules.difficulty*.3;
    if(pressed("left"))state.x-=speed;
    if(pressed("right"))state.x+=speed;
    if(pressed("jump")&&state.y>=ground-38)state.vy=-10.2;
    state.vy+=.52;state.y+=state.vy;
    if(state.y>ground-38){state.y=ground-38;state.vy=0;}
    state.x=Math.max(0,Math.min(W-32,state.x));
    for(const c of coins){
      if(!c.taken&&Math.abs(state.x+16-c.x)<22&&Math.abs(state.y+18-c.y)<30){c.taken=true;state.score=Math.min(goal,state.score+1);}
    }
    for(const e of enemies){
      e.x+=e.dir*(.65+game.rules.difficulty*.17);
      if(e.x<185||e.x>W-35)e.dir*=-1;
      if(state.invulnerable===0&&Math.abs(state.x-e.x)<27&&Math.abs(state.y-e.y)<32){
        state.lives--;state.invulnerable=75;state.x=55;state.y=ground-38;state.vy=0;
        if(state.lives<=0){state.phase="lost";onStatus("แพ้แล้ว — ลองอีกครั้ง");}
      }
    }
    if(state.score>=levelTarget(state.level)){
      if(state.level>=game.rules.levels){state.phase="won";onStatus("ชนะแล้ว!");}
      else{state.level++;populate();onStatus("ผ่านด่าน "+(state.level-1));}
    }else if(coins.every(c=>c.taken)){
      // Keep objectives reachable even if the player misses an earlier coin.
      populate();
    }
  }
  function draw(){
    ctx.fillStyle="#c9efff";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#8ecf9b";ctx.fillRect(0,ground,W,H-ground);
    ctx.fillStyle="#28683b";ctx.fillRect(0,ground,W,4);
    for(const c of coins)if(!c.taken){ctx.fillStyle="#ffb400";ctx.beginPath();ctx.arc(c.x,c.y,10,0,Math.PI*2);ctx.fill();}
    for(const e of enemies){ctx.fillStyle="#b94553";ctx.fillRect(e.x,e.y,28,30);}
    if(state.invulnerable%8<4){ctx.fillStyle="#4261d6";ctx.fillRect(state.x,state.y,32,38);}
    ctx.fillStyle="#14263e";ctx.font="bold 18px system-ui";ctx.fillText("คะแนน "+state.score+"/"+goal+"   ชีวิต "+state.lives+"   ด่าน "+state.level+"/"+game.rules.levels,16,28);
    if(state.phase!=="playing"){
      ctx.fillStyle="rgba(10,25,45,.75)";ctx.fillRect(0,0,W,H);
      ctx.fillStyle="white";ctx.textAlign="center";ctx.font="bold 36px system-ui";
      ctx.fillText(state.phase==="won"?"ชนะแล้ว!":"เกมจบ",W/2,H/2);
      ctx.font="18px system-ui";ctx.fillText("กด เริ่มใหม่ เพื่อเล่นอีกครั้ง",W/2,H/2+40);ctx.textAlign="left";
    }
  }
  function loop(timestamp){
    if(!previous)previous=timestamp;
    accumulator+=Math.min(50,timestamp-previous);previous=timestamp;
    while(accumulator>=1000/60){step();accumulator-=1000/60;}
    draw();raf=requestAnimationFrame(loop);
  }
  const keyMap={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",Space:"jump",ArrowUp:"jump",KeyW:"jump"};
  function down(e){const k=keyMap[e.code];if(k){e.preventDefault();state.keys.add(k);}}
  function up(e){const k=keyMap[e.code];if(k){e.preventDefault();state.keys.delete(k);}}
  window.addEventListener("keydown",down);window.addEventListener("keyup",up);
  function restart(){state.score=0;state.lives=game.player.lives;state.level=1;state.phase="playing";state.invulnerable=0;state.keys.clear();state.touch.clear();previous=0;accumulator=0;populate();onStatus("เริ่มเกมแล้ว");}
  function setTouch(key,active){if(active)state.touch.add(key);else state.touch.delete(key);}
  function destroy(){cancelAnimationFrame(raf);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);state.keys.clear();state.touch.clear();}
  populate();raf=requestAnimationFrame(loop);
  return {restart,setTouch,destroy};
}
