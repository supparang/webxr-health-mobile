
(() => {
  const HUD = {
    scoreEl: document.getElementById('score'),
    timeEl: document.getElementById('time'),
    hint: document.getElementById('hint')
  };
  const gameRoot = document.getElementById('game');
  const bgm = document.getElementById('bgm');
  const sfxHit = document.getElementById('hit');

  HUD.hint.innerHTML = "Hit pads on the beat. Timing windows: <b>Perfect</b> (±150ms), <b>Good</b> (±300ms).";

  let score = 0, running = true;
  function setScore(v){ score = v; HUD.scoreEl.textContent = score; }

  // simple 60s chart at 100 BPM => beat ~600ms; create pads for 30 seconds
  const BPM = 100;
  const beatMs = 60000 / BPM;
  const chart = [];
  for (let t=0; t<30000; t += beatMs) {
    chart.push(t);
  }
  document.getElementById('time').textContent = 30;

  function spawnPad(atMs){
    if (!running) return;
    const x = (Math.random() * 2 - 1) * 1.2;
    const y = 1 + Math.random()*1;
    const pad = document.createElement('a-sphere');
    pad.setAttribute('radius', 0.25);
    pad.setAttribute('color', '#ff6bd6');
    pad.setAttribute('position', `${x} ${y} -4`);
    pad.classList.add('target');

    // Move toward punch zone time-synced so that it arrives at z=-0.8 at atMs
    const travel = 2000; // ms
    const now = performance.now();
    const start = Math.max(0, atMs - travel - (bgm ? bgm.currentTime*1000 : 0));
    const delay = Math.max(0, start - now);
    pad.setAttribute('animation__move', `property: position; to: ${x} ${y} -0.8; dur: ${travel}; delay: ${delay}; easing: linear`);

    pad.addEventListener('click', () => {
      if (!running) return;
      // judge against audio time
      const t = bgm ? bgm.currentTime*1000 : performance.now();
      const diff = Math.abs(t - atMs);
      let gain = 0, label = "";
      if (diff <= 150){ gain = 20; label = "Perfect"; pad.setAttribute('color', '#30ff9f'); }
      else if (diff <= 300){ gain = 10; label = "Good"; pad.setAttribute('color', '#5ea1ff'); }
      else { gain = 0; label = "Miss"; pad.setAttribute('color', '#ff4d6d'); }
      if (gain>0) sfxHit && sfxHit.play().catch(()=>{});
      setScore(score + gain);
      HUD.hint.innerHTML = label;
      pad.setAttribute('animation__pop', 'property: scale; to: 0 0 0; dur: 80; easing: easeOutQuad');
      setTimeout(()=> pad.remove(), 100);
    });

    // auto-miss when passes
    setTimeout(()=>{
      if (pad.parentElement) {
        pad.remove();
      }
    }, 4000);
    gameRoot.appendChild(pad);
  }

  // schedule pads
  const startTime = performance.now();
  chart.forEach(at => {
    setTimeout(()=> spawnPad(startTime + at), at);
  });

  // timer
  let remain = 30;
  const tim = setInterval(()=>{
    if (!running) return clearInterval(tim);
    remain--; document.getElementById('time').textContent = remain;
    if (remain<=0){ running=false; HUD.hint.innerHTML = `Finished! Final Score: ${score}`; }
  }, 1000);

  bgm && bgm.play().catch(()=>{});
})();
