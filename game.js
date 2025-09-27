// Energy Runner VR — Prototype (No WAV files; Web Audio API SFX)
// Controls: Desktop => Space=Jump, Ctrl=Duck, A/D=Lean, W/S=Speed +/- , R=Reset
// VR: Right trigger=Jump, Left trigger=Duck, thumbstick left/right=Lean

// ---------- Simple WebAudio Synth ----------
const AudioSynth = (() => {
  let ctx = null;
  const ensure = async () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // resume on first user gesture (some browsers require)
      const resume = () => { if (ctx.state === 'suspended') ctx.resume(); };
      ['pointerdown','keydown','touchstart'].forEach(ev =>
        window.addEventListener(ev, resume, { once:true })
      );
    }
    return ctx;
  };
  const tone = async (freq=440, dur=0.12, type='sine', vol=0.25) => {
    const ac = await ensure();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    // attack/decay envelope
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  };
  const chord = async (freqs=[440,660], dur=0.25, type='sine', vol=0.18) => {
    const ac = await ensure();
    const now = ac.currentTime;
    const group = freqs.map(f => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g).connect(ac.destination);
      o.start(now);
      o.stop(now + dur + 0.05);
      return {o,g};
    });
  };
  return { tone, chord, ensure };
})();

// Predefined SFX (no files)
const SFX = {
  beep: () => AudioSynth.tone(1100, 0.10, 'square', 0.15),
  pickup: () => AudioSynth.tone(1400, 0.12, 'sine', 0.2),
  hit: () => { AudioSynth.tone(220, 0.18, 'sawtooth', 0.25); },
  win: () => { AudioSynth.chord([880,1320], 0.28, 'triangle', 0.18); }
};

// ---------- HUD / Buttons ----------
const HUD = {
  mode: document.getElementById('modeText'),
  time: document.getElementById('timeText'),
  score: document.getElementById('scoreText'),
  dist: document.getElementById('distText'),
  orb: document.getElementById('orbText'),
  life: document.getElementById('lifeText'),
  status: document.getElementById('status'),
  btnPractice: document.getElementById('btnPractice'),
  btnChallenge: document.getElementById('btnChallenge'),
  btnStart: document.getElementById('btnStart'),
  btnReset: document.getElementById('btnReset')
};

// ---------- Game State ----------
let MODE = 'Practice'; // or 'Challenge'
let running = false, startedAt = 0, elapsed = 0;
let score = 0, distance = 0, orbs = 0, lives = 3;
let speed = 6; // m/s world scroll
let track, rig;
let spawns = []; // {el, type, z}
let spawnTimer = 0;
let timeLimit = 60; // seconds (Challenge)

// Player state
let action = {jump:false, duck:false, lean:0}; // lean -1..1
let vertical = 0; // jump y
let vVel = 0;

// ---------- A-Frame Component ----------
AFRAME.registerComponent('runner-game',{
  init(){
    track = document.getElementById('track');
    rig = document.getElementById('rig');

    this.last = performance.now()/1000;
    this.tick = this.tick.bind(this);
    this.onKey = this.onKey.bind(this);

    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);

    // VR controller bindings
    const cr = document.getElementById('ctrlR');
    const cl = document.getElementById('ctrlL');
    if (cr && cl) {
      cr.addEventListener('triggerdown', ()=>{ action.jump=true; });
      cr.addEventListener('triggerup', ()=>{ action.jump=false; });
      cl.addEventListener('triggerdown', ()=>{ action.duck=true; });
      cl.addEventListener('triggerup', ()=>{ action.duck=false; });
      // any thumbstick axis can update lean
      const axisToLean = (e)=>{ action.lean = (e.detail.axis && e.detail.axis[0]) || 0; };
      cr.addEventListener('axismove', axisToLean);
      cl.addEventListener('axismove', axisToLean);
    }

    // Buttons
    HUD.btnPractice.onclick = ()=>{ MODE='Practice'; HUD.mode.textContent='Practice'; HUD.status.textContent='โหมดฝึก: ไม่มีจับเวลา'; };
    HUD.btnChallenge.onclick = ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; HUD.status.textContent='โหมดแข่ง: เวลา 60 วินาที'; };
    HUD.btnStart.onclick = ()=> startGame();
    HUD.btnReset.onclick = ()=> resetGame();

    // Start idle
    this.el.sceneEl.addEventListener('renderstart', ()=> resetGame());
  },
  remove(){ window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); },
  onKey(e){
    if (e.type==='keydown'){
      if (e.code==='Space'){ action.jump=true; }
      if (e.ctrlKey){ action.duck=true; }
      if (e.code==='KeyA'){ action.lean=-1; }
      if (e.code==='KeyD'){ action.lean=1; }
      if (e.code==='KeyW'){ speed = Math.min(12, speed+0.5); }
      if (e.code==='KeyS'){ speed = Math.max(3, speed-0.5); }
      if (e.code==='KeyR'){ resetGame(); }
    } else {
      if (e.code==='Space'){ action.jump=false; }
      if (!e.ctrlKey){ action.duck=false; }
      if (e.code==='KeyA' && action.lean<0) action.lean=0;
      if (e.code==='KeyD' && action.lean>0) action.lean=0;
    }
  },
  tick(){
    const t = performance.now()/1000;
    const dt = t - this.last; this.last = t;
    if (!running) return;

    // Timer / HUD
    elapsed = t - startedAt;
    if (MODE==='Challenge'){
      const remain = Math.max(0, timeLimit - elapsed);
      HUD.time.textContent = remain.toFixed(1)+'s';
      if (remain<=0){ endGame(true); return; }
    } else {
      HUD.time.textContent = elapsed.toFixed(1)+'s';
    }

    // Player vertical (jump)
    const g = 20; // gravity
    if (action.jump && vertical<=0.001){ vVel = 6.5; SFX.beep(); }
    vVel -= g*dt; vertical = Math.max(0, vertical + vVel*dt);

    // Camera Y with duck blending
    const baseY = 1.6 + vertical;
    const targetY = action.duck ? (1.2 + vertical*0.5) : baseY;
    rig.object3D.position.y += (targetY - rig.object3D.position.y) * 0.3;

    // Lean (x axis)
    const xTarget = THREE.MathUtils.clamp((action.lean||0)*0.8, -0.8, 0.8);
    rig.object3D.position.x += (xTarget - rig.object3D.position.x) * 0.2;

    // Distance / score gain
    distance += speed*dt;
    HUD.dist.textContent = (distance|0)+' m';

    // Spawning
    spawnTimer -= dt;
    if (spawnTimer<=0){
      spawnTimer = 1.2 + Math.random()*0.6;
      spawnEntity();
    }

    // Move & collide
    for (let i=spawns.length-1;i>=0;i--){
      const s = spawns[i];
      s.z += speed*dt;
      s.el.object3D.position.z = -s.z;

      // collision near z ~ 0.4
      if (!s.hit && s.z>=0.4){
        const px = rig.object3D.position.x;
        const py = rig.object3D.position.y;

        if (s.type==='orb'){
          // collect if jumping / camera high
          if (py>1.75 || vertical>0.05){
            collectOrb(s,i); continue;
          }
        } else if (s.type==='wall_low'){ // jump over
          if (py<1.75){ onHit(s,i); continue; } else { onPass(s,i); continue; }
        } else if (s.type==='tunnel'){ // duck under
          if (action.duck){ onPass(s,i); continue; } else { onHit(s,i); continue; }
        } else if (s.type==='block_left'){ // lean right
          if (px>-0.2){ onPass(s,i); continue; } else { onHit(s,i); continue; }
        } else if (s.type==='block_right'){ // lean left
          if (px<0.2){ onPass(s,i); continue; } else { onHit(s,i); continue; }
        }
      }
      if (s.z>40){
        if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
        spawns.splice(i,1);
      }
    }
  }
});

// ---------- Game lifecycle ----------
function startGame(){
  running = true; startedAt = performance.now()/1000;
  score = 0; distance = 0; orbs = 0; lives = 3;
  HUD.score.textContent = '0'; HUD.dist.textContent = '0 m'; HUD.orb.textContent = '0';
  HUD.life.textContent = '❤❤❤'; HUD.status.textContent='วิ่งไปข้างหน้า หลบ/กระโดด/ก้ม และเก็บ Orbs';
  clearTrack();
}
function resetGame(){
  running = false; score = 0; distance = 0; orbs = 0; lives = 3;
  HUD.score.textContent='0'; HUD.dist.textContent='0 m'; HUD.orb.textContent='0';
  HUD.life.textContent='❤❤❤'; HUD.time.textContent='—'; HUD.status.textContent='กด Start เพื่อเริ่ม';
  clearTrack();
}
function endGame(win=false){
  running = false;
  HUD.status.textContent = win ? ('จบเวลา! คะแนนรวม: '+score) : ('ชนสิ่งกีดขวาง หมดชีวิต! คะแนนรวม: '+score);
  win ? SFX.win() : SFX.hit();
}

// ---------- Track / Spawning ----------
function clearTrack(){
  spawns.forEach(s=> s.el.parentNode && s.el.parentNode.removeChild(s.el));
  spawns = [];
}
function spawnEntity(){
  const r = Math.random();
  if (r<0.2){ spawnOrb(); return; }
  if (r<0.45) spawnWallLow();
  else if (r<0.7) spawnTunnel();
  else if (r<0.85) spawnBlock('left');
  else spawnBlock('right');
}
function makeBox(color,w,h,d,pos){
  const el = document.createElement('a-box');
  el.setAttribute('color', color);
  el.setAttribute('width', w); el.setAttribute('height', h); el.setAttribute('depth', d);
  el.setAttribute('position', pos);
  document.getElementById('track').appendChild(el);
  return el;
}
function spawnWallLow(){
  const z = -35; const el = makeBox('#24415f', 1.6, 0.9, 0.6, `0 0.45 ${z}`);
  spawns.push({el,type:'wall_low',z:Math.abs(z)});
}
function spawnTunnel(){
  const z = -35; const el = makeBox('#20334f', 1.8, 0.7, 0.8, `0 1.7 ${z}`);
  spawns.push({el,type:'tunnel',z:Math.abs(z)});
}
function spawnBlock(side){
  const z = -35; const x = side==='left' ? -0.6 : 0.6;
  const el = makeBox('#2a3f5e', 0.8, 1.2, 0.6, `${x} 0.9 ${z}`);
  spawns.push({el,type:(side==='left'?'block_left':'block_right'),z:Math.abs(z)});
}
function spawnOrb(){
  const z = -35; const y = 1.9;
  const el = document.createElement('a-sphere');
  el.setAttribute('color','#79a8ff'); el.setAttribute('radius','0.18');
  el.setAttribute('emissive','#79a8ff'); el.setAttribute('position', `0 ${y} ${z}`);
  document.getElementById('track').appendChild(el);
  spawns.push({el,type:'orb',z:Math.abs(z)});
}

// ---------- Scoring / Collision responses ----------
function onPass(s,i){
  score += 20; HUD.score.textContent = score;
  s.hit = true; s.el.setAttribute('color','#28c76f');
}
function onHit(s,i){
  if (s.hit) return;
  s.hit = true; lives -= 1; HUD.life.textContent = '❤'.repeat(Math.max(0,lives));
  s.el.setAttribute('color','#ff6b6b'); SFX.hit();
  if (lives<=0){ endGame(false); }
}
function collectOrb(s,i){
  if (s.hit) return;
  s.hit = true; orbs += 1; score += 50;
  HUD.orb.textContent = orbs; HUD.score.textContent = score; SFX.pickup();
  s.el.setAttribute('color','#28c76f');
}

// Attach component to scene root
document.getElementById('game').setAttribute('runner-game','');
