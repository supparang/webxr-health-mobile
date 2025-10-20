
(() => {
  const HUD = {
    scoreEl: document.getElementById('score'),
    timeEl: document.getElementById('time'),
    hint: document.getElementById('hint')
  };
  const gameRoot = document.getElementById('game');
  const bgm = document.getElementById('bgm');
  const sfxHit = document.getElementById('hit');

  let score = 0, time = 60, combo = 0, running = true;
  HUD.hint.innerHTML = "Punch (click/gaze) incoming blocks before they reach you. Combo up!";

  function setScore(v){ score = v; HUD.scoreEl.textContent = score; }
  function addScore(delta){ setScore(score + delta + Math.floor(combo * 1.5)); }

  function startTimer(){
    const t = setInterval(()=>{
      if (!running) return clearInterval(t);
      time--; HUD.timeEl.textContent = time;
      if (time <= 0) { running = false; HUD.hint.textContent = `Finished! Final Score: ${score}`; }
    }, 1000);
  }

  function spawnBlock(){
    if (!running) return;
    const e = document.createElement('a-box');
    // spawn in front, random x/y a bit
    const x = (Math.random() * 2 - 1) * 1.2;
    const y = 1 + Math.random()*1;
    e.setAttribute('position', `${x} ${y} -4`);
    e.setAttribute('depth', 0.4);
    e.setAttribute('height', 0.4);
    e.setAttribute('width', 0.4);
    e.setAttribute('color', '#5ea1ff');
    e.setAttribute('shadow', 'cast: true');
    e.classList.add('target');

    // approach animation
    const speed = 2000 + Math.random()*1200;
    e.setAttribute('animation__move', `property: position; to: ${x} ${y} -0.6; dur: ${speed}; easing: linear`);

    e.addEventListener('click', () => {
      if (!running) return;
      combo++;
      addScore(10);
      sfxHit && sfxHit.play().catch(()=>{});
      e.setAttribute('color', '#30ff9f');
      e.setAttribute('animation__pop', 'property: scale; to: 0 0 0; dur: 80; easing: easeOutQuad');
      setTimeout(()=> e.remove(), 90);
    });

    // if reaches player => break combo / penalty
    setTimeout(()=>{
      if (!e.parentElement) return; // already cleared
      combo = 0;
      setScore(Math.max(0, score - 15));
      e.setAttribute('color', '#ff4d6d');
      setTimeout(()=> e.remove(), 80);
    }, 2100 + 1200); // a bit > speed
    gameRoot.appendChild(e);
  }

  // spawner
  const sp = setInterval(()=>{
    if (!running) return clearInterval(sp);
    spawnBlock();
  }, 450);

  // music
  bgm && bgm.play().catch(()=>{});
  startTimer();
})();
