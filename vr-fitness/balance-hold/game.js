
(() => {
  const HUD = {
    scoreEl: document.getElementById('score'),
    timeEl: document.getElementById('time'),
    hint: document.getElementById('hint')
  };
  const gameRoot = document.getElementById('game');
  const bgm = document.getElementById('bgm');
  HUD.hint.innerHTML = "Keep the reticle inside the ring to fill stability. Click/tap to recenter.";

  let stable = 0, time=40, running=true;
  document.getElementById('time').textContent = time;

  const ring = document.createElement('a-ring');
  ring.setAttribute('position', '0 1.6 -3');
  ring.setAttribute('radius-inner', '0.12');
  ring.setAttribute('radius-outer', '0.18');
  ring.setAttribute('color', '#22d3ee');
  gameRoot.appendChild(ring);

  const dot = document.createElement('a-sphere');
  dot.setAttribute('radius', '0.03');
  dot.setAttribute('color', '#ffffff');
  dot.setAttribute('position', '0 1.6 -3');
  gameRoot.appendChild(dot);

  function jitter(){
    if (!running) return;
    // move ring around slightly to require tracking
    const x = (Math.random()*2 - 1) * 0.5;
    const y = 1.4 + Math.random()*0.6;
    ring.setAttribute('position', `${x} ${y} -3`);
    setTimeout(jitter, 900);
  }

  function track(){
    if (!running) return;
    // dot follows camera forward
    const cam = document.querySelector('[camera]');
    if (cam){
      const wp = cam.object3D.getWorldPosition(new THREE.Vector3());
      const wd = new THREE.Vector3(0,0,-1).applyQuaternion(cam.object3D.quaternion);
      const pos = wp.clone().add(wd.multiplyScalar(3));
      dot.object3D.position.copy(pos);
    }
    // score if dot close to ring center
    const dr = ring.object3D.position.clone().sub(dot.object3D.position).length();
    if (dr < 0.12){
      stable += 1;
      HUD.scoreEl.textContent = stable;
      if (stable >= 500){ running=false; HUD.hint.innerHTML = "Stable! Great balance."; }
    }
    requestAnimationFrame(track);
  }

  // timer
  const tim = setInterval(()=>{
    if (!running) return clearInterval(tim);
    time--; document.getElementById('time').textContent = time;
    if (time<=0){ running=false; HUD.hint.innerHTML = `Finished! Stability: ${stable}`; }
  }, 1000);

  bgm && bgm.play().catch(()=>{});
  jitter();
  track();
})();
