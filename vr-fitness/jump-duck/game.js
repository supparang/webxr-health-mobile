
(() => {
  const HUD = {
    scoreEl: document.getElementById('score'),
    timeEl: document.getElementById('time'),
    hint: document.getElementById('hint')
  };
  const gameRoot = document.getElementById('game');
  const bgm = document.getElementById('bgm');

  HUD.hint.innerHTML = "Press <kbd>J</kbd> to Jump, <kbd>K</kbd> to Duck. Avoid blocks!";
  let score = 0, time = 45, running = true;
  let state = 'run'; // 'jump','duck'
  let speed = 1.5;

  function setScore(v){ score=v; HUD.scoreEl.textContent=v; }
  document.addEventListener('keydown', e => {
    if (!running) return;
    if (e.key.toLowerCase()==='j'){ state='jump'; setTimeout(()=> state='run', 650); }
    if (e.key.toLowerCase()==='k'){ state='duck'; setTimeout(()=> state='run', 650); }
  });

  function startTimer(){
    const t = setInterval(()=>{
      if (!running) return clearInterval(t);
      time--; HUD.timeEl.textContent = time;
      if (time<=0){ running=false; HUD.hint.innerHTML = `Finish! Score: ${score}`; }
      // ramp speed
      speed += 0.05;
    }, 1000);
  }

  function spawnObstacle(){
    if (!running) return;
    const type = Math.random() < 0.5 ? 'high' : 'low';
    const o = document.createElement('a-box');
    o.setAttribute('color', type==='low' ? '#ffb703' : '#fb7185');
    const y = type==='low' ? 0.5 : 1.5;
    const h = type==='low' ? 0.7 : 0.7;
    o.setAttribute('height', h);
    o.setAttribute('width', 0.8);
    o.setAttribute('depth', 0.8);
    o.setAttribute('position', `0 ${y} -6`);
    const dur = Math.max(900, 2500 - speed*400);
    o.setAttribute('animation__move', `property: position; to: 0 ${y} -0.6; dur: ${dur}; easing: linear`);
    gameRoot.appendChild(o);

    const check = setInterval(()=>{
      if (!o.parentElement){ clearInterval(check); return; }
      // naive collision check by z position threshold
      const pos = o.getAttribute('position');
      if (pos.z > -1.4){
        const need = (type==='low' ? 'jump' : 'duck');
        if (state !== need){
          running=false;
          HUD.hint.innerHTML = 'Hit! Game Over.';
        } else {
          setScore(score+5);
        }
        o.remove();
        clearInterval(check);
      }
    }, 60);

    // schedule next
    const nextIn = 700 + Math.random()*600;
    setTimeout(spawnObstacle, nextIn);
  }

  bgm && bgm.play().catch(()=>{});
  startTimer();
  setTimeout(spawnObstacle, 600);
})();
