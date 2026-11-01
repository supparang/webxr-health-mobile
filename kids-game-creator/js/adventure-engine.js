// Phase 2.2 — self-contained Canvas adventure engine. No eval or dynamic code.
export function mountAdventure(canvas, game, onStatus = () => {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas is not supported");
  const W=720,H=400, ground=350;
  canvas.width=W;canvas.height=H;
  const state={x:55,y:ground-38,vy:0,score:0,lives:game.player.lives,level:1,phase:"playing",invulnerable:0,keys:new Set(),touch:new Set(),frame:0};
  const goal=game.rules.targetScore;
  const theme=["forest","space","castle","ocean"].includes(game.theme)?game.theme:"forest";
  const character=["กระต่าย","แมว","หมี","หุ่นยนต์"].includes(game.player.name)?game.player.name:"กระต่าย";
  canvas.dataset.theme=theme;canvas.dataset.character=character;
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
  // Phase 2.9: original vector artwork; no external assets or changes to hitboxes.
  function cloud(x,y,scale=1){
    ctx.fillStyle="rgba(255,255,255,.88)";
    for(const [dx,dy,r] of [[0,0,18],[19,-8,23],[41,0,17]]){
      ctx.beginPath();ctx.arc(x+dx*scale,y+dy*scale,r*scale,0,Math.PI*2);ctx.fill();
    }
  }
  function tree(x,y,scale=1){
    ctx.fillStyle="#93613f";ctx.fillRect(x-7*scale,y-68*scale,14*scale,74*scale);
    for(const [dx,dy,r,color] of [[0,-91,31,"#368b55"],[-20,-72,24,"#48a968"],[22,-72,25,"#3e9b60"]]){
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+dx*scale,y+dy*scale,r*scale,0,Math.PI*2);ctx.fill();
    }
  }
  function carrot(x,y){
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle="#3b9950";ctx.beginPath();ctx.ellipse(-4,-10,4,9,-.5,0,Math.PI*2);ctx.ellipse(4,-10,4,9,.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fa902e";ctx.beginPath();ctx.moveTo(-10,-5);ctx.quadraticCurveTo(0,-12,10,-5);ctx.lineTo(0,12);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#cf6420";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-5,1);ctx.lineTo(-1,3);ctx.moveTo(3,5);ctx.lineTo(6,3);ctx.stroke();
    ctx.restore();
  }
  function rabbit(x,y,frame){
    const hop=Math.sin(frame*.18)*1.2;
    ctx.save();ctx.translate(x+16,y+hop);
    ctx.fillStyle="#fff7ed";
    ctx.beginPath();ctx.ellipse(-7,-11,6,17,-.13,0,Math.PI*2);ctx.ellipse(7,-11,6,17,.13,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#f6b5c6";
    ctx.beginPath();ctx.ellipse(-7,-12,2.5,11,-.13,0,Math.PI*2);ctx.ellipse(7,-12,2.5,11,.13,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff7ed";ctx.beginPath();ctx.ellipse(0,19,15,17,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(0,9,14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#343b55";ctx.beginPath();ctx.arc(-5,8,1.8,0,Math.PI*2);ctx.arc(5,8,1.8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#e68aa2";ctx.beginPath();ctx.arc(0,13,2.6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff7ed";ctx.beginPath();ctx.ellipse(-9,34,7,4,0,0,Math.PI*2);ctx.ellipse(9,34,7,4,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function playerArtwork(x,y,frame){
    if(character==="กระต่าย"){rabbit(x,y,frame);return;}
    ctx.save();ctx.translate(x+16,y+19+Math.sin(frame*.18)*1.2);
    const robot=character==="หุ่นยนต์",bear=character==="หมี";
    ctx.fillStyle=robot?"#b9d7e7":bear?"#a9744c":"#f4b9a1";
    ctx.beginPath();ctx.ellipse(0,13,14,17,0,0,Math.PI*2);ctx.fill();
    if(robot){ctx.fillRect(-14,-15,28,27);ctx.fillRect(-3,-23,6,8);}
    else{
      ctx.beginPath();
      if(bear){ctx.arc(-12,-12,7,0,Math.PI*2);ctx.arc(12,-12,7,0,Math.PI*2);}
      else{ctx.moveTo(-13,-8);ctx.lineTo(-11,-29);ctx.lineTo(-1,-15);ctx.lineTo(1,-15);ctx.lineTo(11,-29);ctx.lineTo(13,-8);}
      ctx.fill();
      ctx.beginPath();ctx.arc(0,-7,14,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle="#25344d";ctx.beginPath();ctx.arc(-5,-9,2.2,0,Math.PI*2);ctx.arc(5,-9,2.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=robot?"#367fbb":"#7a4b4c";ctx.beginPath();ctx.arc(0,-2,2.7,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function scenery(){
    const palette={forest:["#a7ddf9","#e6f9ff","#7bc67c","#42965a"],space:["#101c49","#5268a5","#5a6287","#929bc2"],castle:["#a6d4f4","#e6eafa","#9ba5ae","#737e91"],ocean:["#8ad8ee","#d4f7ff","#e4c88f","#b29b6e"]}[theme];
    const sky=ctx.createLinearGradient(0,0,0,ground);sky.addColorStop(0,palette[0]);sky.addColorStop(1,palette[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    if(theme==="forest"){
      cloud(75,67,1);cloud(380,84,.7);cloud(575,55,.85);
      ctx.fillStyle="#b7dfb2";ctx.beginPath();ctx.ellipse(155,ground+34,225,112,0,0,Math.PI*2);ctx.ellipse(525,ground+40,265,124,0,0,Math.PI*2);ctx.fill();
      tree(75,ground,.72);tree(670,ground,.85);tree(455,ground,.55);
    }else if(theme==="space"){
      ctx.fillStyle="#fff7bf";for(let i=0;i<28;i++){ctx.beginPath();ctx.arc((i*97+23)%W,(i*53+17)%270,1.5+i%3,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle="#e8b97e";ctx.beginPath();ctx.arc(565,95,49,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#d8a36b";ctx.beginPath();ctx.arc(552,84,11,0,Math.PI*2);ctx.arc(583,110,8,0,Math.PI*2);ctx.fill();
    }else if(theme==="castle"){
      cloud(85,70,.7);cloud(510,85,.8);
      ctx.fillStyle="#71849b";ctx.fillRect(255,158,210,192);ctx.fillRect(227,126,53,224);ctx.fillRect(443,126,53,224);
      ctx.fillStyle="#dce5f1";for(const x of [237,265,453,481])ctx.fillRect(x,112,12,21);
      ctx.fillStyle="#3c526e";ctx.fillRect(343,252,35,98);
    }else{
      cloud(90,68,.8);cloud(530,76,.7);
      ctx.fillStyle="#3baec7";ctx.fillRect(0,195,W,155);
      ctx.strokeStyle="#b0f3f4";ctx.lineWidth=3;
      for(let y=218;y<320;y+=32){ctx.beginPath();for(let x=0;x<=W;x+=12){const wave=y+Math.sin(x*.024+y)*5;x===0?ctx.moveTo(x,wave):ctx.lineTo(x,wave);}ctx.stroke();}
      ctx.fillStyle="#fff2ce";ctx.beginPath();ctx.ellipse(570,316,130,43,0,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle=palette[2];ctx.fillRect(0,ground,W,H-ground);
    ctx.fillStyle=palette[3];ctx.fillRect(0,ground,W,5);
    for(let i=0;i<15;i++){const x=22+i*51;ctx.fillStyle=palette[3];ctx.beginPath();ctx.ellipse(x,ground+19,14,5,0,0,Math.PI*2);ctx.fill();}
  }
  function fox(x,y){
    ctx.save();ctx.translate(x+14,y);
    ctx.fillStyle="#d96e42";ctx.beginPath();ctx.moveTo(-13,13);ctx.lineTo(-11,-4);ctx.lineTo(-3,4);ctx.lineTo(3,4);ctx.lineTo(11,-4);ctx.lineTo(13,13);ctx.closePath();ctx.fill();
    ctx.fillStyle="#e88a4b";ctx.beginPath();ctx.ellipse(0,19,14,14,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fff1d9";ctx.beginPath();ctx.moveTo(-10,16);ctx.lineTo(0,27);ctx.lineTo(10,16);ctx.closePath();ctx.fill();
    ctx.fillStyle="#342f36";ctx.beginPath();ctx.arc(-5,12,2,0,Math.PI*2);ctx.arc(5,12,2,0,Math.PI*2);ctx.arc(0,21,2,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function draw(){
    scenery();
    for(const c of coins)if(!c.taken)carrot(c.x,c.y);
    for(const e of enemies)fox(e.x,e.y);
    if(state.invulnerable%8<4)playerArtwork(state.x,state.y,state.frame);
    ctx.fillStyle="#193b49";ctx.font="bold 18px system-ui";
    ctx.fillText("คะแนน "+state.score+"/"+goal+"   ชีวิต "+state.lives+"   ด่าน "+state.level+"/"+game.rules.levels,16,28);
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
