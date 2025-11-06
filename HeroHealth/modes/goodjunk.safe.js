
// GoodJunk Safe Mode (module)
export async function boot({host, duration=60, difficulty='normal'}){
  const zone = host || document.getElementById('spawnZone');
  while(zone.firstChild) zone.removeChild(zone.firstChild);

  const plane = document.createElement('a-plane');
  plane.setAttribute('width','2.2'); plane.setAttribute('height','1.2');
  plane.setAttribute('color','#0b1d38'); plane.setAttribute('opacity','0.85');
  plane.setAttribute('position','0 0 -0.01');
  zone.appendChild(plane);

  const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  let tLeft = duration, score=0, paused=false;

  function setHudTime(sec){
    const t = document.querySelector('#hudRoot a-entity[troika-text]:nth-of-type(2)');
    if(t) t.setAttribute('troika-text','value','เวลา: '+sec+'s');
  }
  function setHudScore(sc){
    const t = document.querySelector('#hudRoot a-entity[troika-text]:nth-of-type(3)');
    if(t) t.setAttribute('troika-text','value','คะแนน: '+sc);
  }
  setHudTime(tLeft); setHudScore(score);

  function randPos(){
    return [ (Math.random()*1.8-0.9), (Math.random()*0.9-0.45), 0.01 ];
  }
  function spawnOne(){
    if(paused) return;
    const good = Math.random()<0.7;
    const emoji = (good?GOOD:JUNK)[(Math.random()* (good?GOOD.length:JUNK.length))|0];
    const pos = randPos();
    const e = document.createElement('a-entity');
    e.classList.add('clickable','target');
    e.setAttribute('troika-text', `value: ${emoji}; color:#fff; fontSize:0.20; anchor:center;`);
    e.setAttribute('position', `${pos[0].toFixed(2)} ${pos[1].toFixed(2)} ${pos[2]}`);
    const life = setTimeout(()=>e.remove(), 2200);
    e.addEventListener('click', ()=>{
      clearTimeout(life);
      score = Math.max(0, score + (good?1:-1));
      setHudScore(score);
      e.remove();
    });
    zone.appendChild(e);
  }

  const rate = (difficulty==='hard')? 260 : (difficulty==='normal')? 360 : 480;
  let spawner = setInterval(spawnOne, rate);
  let timer = setInterval(()=>{
    if(paused) return;
    tLeft--; setHudTime(tLeft);
    if(tLeft<=0){
      clearInterval(spawner); clearInterval(timer);
    }
  }, 1000);

  return { pause(){ paused=true; }, resume(){ paused=false; }, destroy(){ try{ clearInterval(spawner); clearInterval(timer); }catch{}; while(zone.firstChild) zone.removeChild(zone.firstChild);} };
}
