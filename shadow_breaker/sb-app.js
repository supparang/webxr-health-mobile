/* Shadow Breaker — Fixed Core (A-Frame/WebXR)
 * - Robust init order (no 'UI before initialization')
 * - No VRButton dependency
 * - Visible Start/Pause/Back overlays
 * - Working click/gaze with fuse cursor
 */
(function(){
  // --- URL params ---
  const P = new URLSearchParams(location.search);
  const MODE = P.get('mode') || 'timed';     // timed | endless
  const DIFF = P.get('diff') || 'normal';    // easy | normal | hard
  const TIME = Math.max(10, parseInt(P.get('time')||'60',10));

  const diffCfg = {
    easy:   { spawnInterval: 1200, speed: 0.35, missLimit: 8 },
    normal: { spawnInterval: 850,  speed: 0.55, missLimit: 6 },
    hard:   { spawnInterval: 620,  speed: 0.75, missLimit: 4 }
  }[DIFF] || { spawnInterval: 850, speed: 0.55, missLimit: 6 };

  // State
  const S = {
    score: 0,
    timeLeft: (MODE==='timed') ? TIME : -1,
    playing: false,
    paused: false,
    spawnTimer: null,
    tickTimer: null,
    missed: 0
  };

  // DOM refs (created after load)
  let $start,$pause,$end,$strip,$endSummary,$hudScore,$hudTime,$hudMode,$spawner;

  // Safe UI accessors
  function uiReady(){
    return $hudScore && $hudTime && $hudMode && $spawner && $start && $pause && $end && $strip && $endSummary;
  }

  function setHUD(){
    if($hudScore) $hudScore.setAttribute('value', `Score: ${S.score}`);
    if($hudTime)  $hudTime.setAttribute('value',  `Time: ${S.timeLeft > -1 ? S.timeLeft : '∞'}`);
    if($hudMode)  $hudMode.setAttribute('value',  `Mode: ${MODE==='timed'?'Timed':'Endless'} (${cap(DIFF)})`);
  }
  function cap(s){ return (s||'').charAt(0).toUpperCase()+s.slice(1); }

  // Spawner
  function spawnOne(){
    if(!S.playing || S.paused) return;
    const x = (Math.random()*3 - 1.5);
    const z = - (1.6 + Math.random()*2.8);
    const y = 0.8 + Math.random()*0.6;

    const e = document.createElement('a-image');
    e.setAttribute('src', '#tex-target');
    e.setAttribute('position', `${x} ${y} ${z}`);
    e.setAttribute('scale', '0.7 0.7 0.7');
    e.classList.add('clickable');
    e.setAttribute('sb-target', {speed: diffCfg.speed});

    $spawner.appendChild(e);
  }

  AFRAME.registerComponent('sb-target', {
    schema: {speed: {type:'number', default:0.5}},
    init: function(){
      this.hit = false;
      this.age = 0;
      this.el.addEventListener('click', () => {
        if(!S.playing || S.paused || this.hit) return;
        this.hit = true;
        S.score += 5;
        setHUD();
        this.el.setAttribute('animation__pop', {property:'scale', to:'0.5 0.5 0.5', dur:140, dir:'alternate', loop:2});
        setTimeout(()=> this.el.remove(), 140);
      });
    },
    tick: function(time, delta){
      if(!S.playing || S.paused) return;
      this.age += delta;
      const p = this.el.object3D.position;
      p.y += (this.data.speed * (delta/1000));
      if(p.y > 3.2){ // missed
        this.el.remove();
        if(!this.hit){
          S.missed++;
          if(MODE==='endless' && S.missed >= diffCfg.missLimit){
            endGame();
          }
        }
      }
    }
  });

  function startGame(){
    if(!uiReady()) return;
    S.playing = true; S.paused = false;
    setHUD();
    $start.classList.add('hidden');
    $strip.classList.remove('hidden');

    S.spawnTimer = setInterval(spawnOne, diffCfg.spawnInterval);
    if(MODE==='timed'){
      S.tickTimer = setInterval(()=>{
        if(S.paused) return;
        S.timeLeft--;
        setHUD();
        if(S.timeLeft <= 0){ endGame(); }
      }, 1000);
    }
  }

  function endGame(){
    S.playing = false;
    clearInterval(S.spawnTimer); clearInterval(S.tickTimer);
    Array.from($spawner.children).forEach(ch => ch.remove());
    const verdict = S.score>=80 ? "สุดยอด!" : (S.score>=40 ? "ดีมาก" : "สู้ต่อ!");
    $endSummary.textContent = `${verdict} • Score ${S.score} • Missed ${S.missed}`;
    $end.classList.remove('hidden');
    $strip.classList.add('hidden');
  }

  function pause(){
    if(!S.playing) return;
    S.paused = true;
    $pause.classList.remove('hidden');
  }
  function resume(){
    S.paused = false;
    $pause.classList.add('hidden');
  }
  function togglePause(){
    S.paused ? resume() : pause();
  }

  // Expose minimal UI API AFTER elements exist
  window.addEventListener('load', () => {
    $start = document.getElementById('start');
    $pause = document.getElementById('pause');
    $end = document.getElementById('end');
    $strip = document.getElementById('strip');
    $endSummary = document.getElementById('end-summary');
    $hudScore = document.getElementById('hud-score');
    $hudTime = document.getElementById('hud-time');
    $hudMode = document.getElementById('hud-mode');
    $spawner = document.getElementById('spawner');

    // Publish UI only after refs are valid to prevent "UI before initialization"
    window.SB_UI = {
      start: startGame,
      pause, resume, togglePause
    };

    setHUD();
  });

})();