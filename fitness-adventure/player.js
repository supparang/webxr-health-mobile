// Player with BPM sync, metronome preview, multi-song selection, beat map loader
const APP = {
  running: false,
  duration: 60,
  timeLeft: 60,
  score: 0, combo: 0,
  basePerfect: 0.28, baseGood: 0.52,
  perfectWindow: 0.28, goodWindow: 0.52,
  baseSpeed: 2.0, speed: 2.0,
  track: [], nextIdx: 0, lastTick: 0,
  mapMeta: { title: "Beat Map", bpm: 120 },
  startAt: 0,
};

const hud = {
  root: document.getElementById('hud'),
  time: document.getElementById('hudTime'),
  score: document.getElementById('hudScore'),
  combo: document.getElementById('hudCombo'),
  diff: document.getElementById('hudDiff'),
};

const ui = {
  start: document.getElementById('btnStart'),
  how: document.getElementById('btnHow'),
  preview: document.getElementById('btnPreview'),
  selectBeat: document.getElementById('selectBeat'),
  selectSong: document.getElementById('selectSong'),
  fileSong: document.getElementById('fileSong'),
};

const world = document.getElementById('world');
const pools = { targets: [], hurdles: [], cues: [] };

async function loadBeatMap(url){
  try{
    const res = await fetch(url, {cache:'no-store'});
    const json = await res.json();
    const events = (json.events||[]).slice().sort((a,b)=>a.t-b.t);
    APP.duration = json.duration || 60;
    const bpmAttr = ui.selectSong.options[ui.selectSong.selectedIndex]?.dataset?.bpm;
    APP.mapMeta = { title: json.title||'Beat Map', bpm: json.bpm || parseInt(bpmAttr||120) };
    return events;
  }catch(e){
    console.warn('Beat map load failed', e);
    return [];
  }
}

function resetGame(){
  APP.running=false;
  APP.timeLeft = APP.duration;
  APP.score = 0; APP.combo=0; APP.nextIdx=0; APP.lastTick=0;
  APP.perfectWindow = APP.basePerfect;
  APP.goodWindow = APP.baseGood;
  APP.speed = APP.baseSpeed;
  hud.time.textContent = APP.timeLeft;
  hud.score.textContent = APP.score;
  hud.combo.textContent = APP.combo;
  if (hud.diff) hud.diff.textContent = 0;
  document.getElementById('summaryPanel').setAttribute('visible', false);
  document.getElementById('titleBoard').setAttribute('visible', true);
}

function setupSong(){
  const bgm = document.getElementById('bgm');
  const sel = ui.selectSong.value;
  if (ui.fileSong.files[0]){
    const url = URL.createObjectURL(ui.fileSong.files[0]);
    bgm.src = url;
  }else{
    bgm.src = sel;
  }
}

async function startGame(){
  setupSong();
  APP.track = await loadBeatMap(ui.selectBeat.value);
  resetGame();
  APP.running = true;
  hud.root.hidden = false;
  document.getElementById('titleBoard').setAttribute('visible', false);
  const bgm = document.getElementById('bgm');
  APP.startAt = performance.now()/1000;
  try{ bgm.currentTime = 0; await bgm.play(); }catch{}
  requestAnimationFrame(tick);
}

function addScore(kind){
  let delta=0; let color='#fff';
  if (kind==='perfect'){ delta=360; color='#7CFC00'; APP.combo++; }
  else if (kind==='good'){ delta=120; color='#A7F3D0'; APP.combo=0; }
  else { delta=0; color='#ffb3b3'; APP.combo=0; }
  const elapsed = APP.duration - APP.timeLeft;
  const p = Math.min(1, Math.max(0, elapsed / APP.duration));
  const mult = 1 + Math.floor(p*3);
  APP.score += (delta + Math.floor(APP.combo*6)) * mult;
  hud.score.textContent = APP.score; hud.combo.textContent = APP.combo;
  feedback((mult>1?`x${mult} `:'') + kind.toUpperCase(), color);
}

function endGame(){
  APP.running=false;
  hud.root.hidden = true;
  const bgm = document.getElementById('bgm'); if (bgm) bgm.pause();
  [...world.children].forEach(c=>world.removeChild(c));
  const s = document.getElementById('summaryPanel');
  const stars = APP.score>4800? '★★★' : (APP.score>2500? '★★☆' : '★☆☆');
  s.querySelector('#sumStars').setAttribute('text', `value: ${stars}; align:center; color:#FFD166; width: 2`);
  s.querySelector('#sumStats').setAttribute('text', `value: Score: ${APP.score} | Time: ${APP.duration}s; align:center; color:#CFE8FF; width:2`);
  s.setAttribute('visible', true);
  document.getElementById('titleBoard').setAttribute('visible', true);
}

function spawnTarget(side){
  const x = side==='L'?-0.45:0.45; const y = 1.3; const z = -10;
  const e = document.createElement('a-entity');
  e.setAttribute('geometry', 'primitive: circle; radius: 0.22');
  e.setAttribute('material', 'color: #28c76f; emissive: #28c76f; emissiveIntensity: 0.5');
  e.setAttribute('position', `${x} ${y} ${z}`);
  e.classList.add('target');
  const ring = document.createElement('a-ring');
  ring.setAttribute('radius-inner','0.22');
  ring.setAttribute('radius-outer','0.28');
  ring.setAttribute('color','#b7f5d6');
  e.appendChild(ring);
  world.appendChild(e);
  pools.targets.push({el:e, active:true, tHit: performance.now()/1000 + 10/APP.speed});
}
function spawnHurdle(){
  const e = document.createElement('a-box');
  e.setAttribute('width','1.2'); e.setAttribute('height','0.6'); e.setAttribute('depth','0.4');
  e.setAttribute('color', '#ff6b6b');
  e.setAttribute('position', `0 0.6 -12`);
  e.classList.add('hurdle');
  world.appendChild(e);
  pools.hurdles.push({el:e, active:true, tHit: performance.now()/1000 + 12/APP.speed});
}
function spawnHandsUpCue(){
  const e = document.createElement('a-entity');
  e.setAttribute('position', `0 1.6 -11`);
  const arrow = document.createElement('a-triangle');
  arrow.setAttribute('color', '#ffd166');
  arrow.setAttribute('vertex-a','0 0.6 0');
  arrow.setAttribute('vertex-b','-0.6 -0.4 0');
  arrow.setAttribute('vertex-c','0.6 -0.4 0');
  e.appendChild(arrow);
  const outline = document.createElement('a-triangle');
  outline.setAttribute('color', '#fff'); outline.setAttribute('opacity','0.6');
  outline.setAttribute('vertex-a','0 0.7 0'); outline.setAttribute('vertex-b','-0.7 -0.5 0'); outline.setAttribute('vertex-c','0.7 -0.5 0');
  e.appendChild(outline);
  world.appendChild(e);
  pools.cues.push({el:e, active:true, tHit: performance.now()/1000 + 11/APP.speed});
}

function feedback(text, color){
  const tpl = document.getElementById('fxTemplate');
  const fx = tpl.cloneNode(true); fx.id='';
  fx.setAttribute('visible', true);
  fx.setAttribute('position', `0 2 -1.2`);
  fx.querySelector('#fxText').setAttribute('text', `value: ${text}; align:center; color: ${color}; width: 3`);
  world.appendChild(fx);
  const start = performance.now();
  function anim(){
    const dt = (performance.now()-start)/1000;
    if (dt<0.7){ fx.object3D.position.y = 2 + dt*0.6; fx.object3D.children[0].material.opacity = 1 - dt/0.7; requestAnimationFrame(anim); }
    else { world.removeChild(fx); }
  }
  requestAnimationFrame(anim);
}

function areHandsUp(){
  const left = document.getElementById('leftHand').object3D.getWorldPosition(new THREE.Vector3());
  const right = document.getElementById('rightHand').object3D.getWorldPosition(new THREE.Vector3());
  return (left.y>2.0 && right.y>2.0);
}

function handlePunches(){
  const left = document.getElementById('leftHand').object3D.getWorldPosition(new THREE.Vector3());
  const right = document.getElementById('rightHand').object3D.getWorldPosition(new THREE.Vector3());
  const now = performance.now()/1000;
  pools.targets.forEach(o=>{
    if (!o.active) return;
    const p = o.el.object3D.getWorldPosition(new THREE.Vector3());
    const d = Math.min(p.distanceTo(left), p.distanceTo(right));
    if (p.z>-0.2 && p.z<0.2 && d<0.25){
      const off = Math.abs(now - o.tHit);
      addScore(off < APP.perfectWindow ? 'perfect' : (off < APP.goodWindow ? 'good' : 'good'));
      o.active=false; world.removeChild(o.el);
    }
  });
}

function tick(t){
  if (!APP.running){ APP.lastTick=t; return; }
  if (!APP.lastTick) APP.lastTick=t; const dt=(t-APP.lastTick)/1000; APP.lastTick=t;
  APP.timeLeft -= dt; if (APP.timeLeft<=0){ APP.timeLeft=0; endGame(); }
  hud.time.textContent = Math.ceil(APP.timeLeft);

  const elapsed = APP.duration - APP.timeLeft;
  const p = Math.min(1, Math.max(0, elapsed / APP.duration));
  APP.speed = APP.baseSpeed + 1.6 * p;
  APP.perfectWindow = APP.basePerfect - 0.10 * p;
  APP.goodWindow = APP.baseGood - 0.12 * p;
  if (hud.diff) hud.diff.textContent = Math.round(p*100);

  // Pre-spawn upcoming events based on music time alignment (elapsed seconds since start)
  while(APP.nextIdx < APP.track.length && APP.track[APP.nextIdx].t <= elapsed + 2.2){
    const evt = APP.track[APP.nextIdx++];
    if (evt.type==='punchL') spawnTarget('L');
    else if (evt.type==='punchR') spawnTarget('R');
    else if (evt.type==='duck') spawnHurdle();
    else if (evt.type==='handsUp') spawnHandsUpCue();
  }

  const dz = APP.speed * dt;
  [...world.children].forEach(el=>{ el.object3D.position.z += dz; });

  handlePunches();
  // duck + handsUp judged when passing z>0 in cull below
  pools.targets = pools.targets.filter(o=>{
    const z=o.el.object3D.position.z; if (z>0){
      if (o.active){ addScore('miss'); o.active=false; }
      world.removeChild(o.el); return false;
    } return true;
  });
  pools.hurdles = pools.hurdles.filter(o=>{
    const z=o.el.object3D.position.z; if (z>0){
      if (o.active){
        const cam = document.getElementById('camera');
        const y = cam.object3D.position.y + document.getElementById('rig').object3D.position.y;
        if (y>1.1) addScore('miss'); else addScore('good');
        o.active=false;
      }
      world.removeChild(o.el); return false;
    } return true;
  });
  pools.cues = pools.cues.filter(o=>{
    const z=o.el.object3D.position.z; if (z>0){
      if (o.active){ const ok = areHandsUp(); addScore(ok? 'perfect' : 'miss'); o.active=false; }
      world.removeChild(o.el); return false;
    } return true;
  });

  requestAnimationFrame(tick);
}

// Metronome Preview (just click track + console event preview times)
ui.preview.addEventListener('click', async ()=>{
  const m = document.getElementById('metronome');
  try{ m.currentTime=0; await m.play(); }catch{}
  alert('Metronome started (10s). Use editor.html for full visual grid preview.');
});

ui.start.addEventListener('click', ()=>{ startGame(); });
ui.how.addEventListener('click', ()=>{
  const meta = APP.mapMeta;
  alert('HOW TO PLAY\\n\\n• Punch green targets as they reach you.\\n• Duck under red hurdles.\\n• Raise both hands for yellow arrow.\\n• Multi-song + BPM sync with selected beat map.\\n\\nBeat Map: ' + meta.title + (meta.bpm? ('  |  BPM: '+meta.bpm):''));
});
