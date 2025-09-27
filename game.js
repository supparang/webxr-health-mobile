// Energy Runner VR — Difficulty + Beat Map (no external WAV files)
// Desktop: Space=Jump, Ctrl=Duck, A/D=Lean, W/S=Speed +/- , R=Reset
// VR: Right trigger=Jump, Left trigger=Duck, thumbstick L/R=Lean

// ---------- Simple WebAudio Synth (no files) ----------
const AudioSynth = (() => {
  let ctx = null;
  const ensure = async () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  };
  const chord = async (freqs=[440,660], dur=0.25, type='sine', vol=0.18) => {
    const ac = await ensure();
    const now = ac.currentTime;
    freqs.forEach(f => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g).connect(ac.destination);
      o.start(now);
      o.stop(now + dur + 0.05);
    });
  };
  return { tone, chord, ensure };
})();
const SFX = {
  tick: () => AudioSynth.tone(1000, 0.06, 'square', 0.18),  // metronome
  tock: () => AudioSynth.tone(700, 0.06, 'square', 0.16),
  beep: () => AudioSynth.tone(1100, 0.10, 'square', 0.15),   // jump
  pickup: () => AudioSynth.tone(1400, 0.12, 'sine', 0.2),
  hit: () => AudioSynth.tone(220, 0.2, 'sawtooth', 0.25),
  win: () => AudioSynth.chord([880,1320], 0.28, 'triangle', 0.18)
};

// ---------- HUD / UI ----------
const HUD = {
  mode: document.getElementById('modeText'),
  diff: document.getElementById('diffText'),
  time: document.getElementById('timeText'),
  score: document.getElementById('scoreText'),
  dist: document.getElementById('distText'),
  orb: document.getElementById('orbText'),
  life: document.getElementById('lifeText'),
  beat: document.getElementById('beatText'),
  status: document.getElementById('status'),
  btnPractice: document.getElementById('btnPractice'),
  btnChallenge: document.getElementById('btnChallenge'),
  btnStart: document.getElementById('btnStart'),
  btnReset: document.getElementById('btnReset'),
  selDiff: document.getElementById('selDiff'),
  inpBPM: document.getElementById('inpBPM'),
  inpBars: document.getElementById('inpBars'),
  btnMetro: document.getElementById('btnMetro'),
  musicFile: document.getElementById('musicFile')
};

// ---------- Game State ----------
let MODE = 'Practice'; // or 'Challenge'
let DIFFICULTY = 'Normal';
let running = false, startedAt = 0, elapsed = 0;
let score = 0, distance = 0, orbs = 0, lives = 3;
let baseSpeed = 6; // modified by difficulty
let speed = baseSpeed;
let track, rig;
let spawns = []; // {el, type, z}
let spawnTimer = 0; // for random spawn (when NOT using beat)
let timeLimit = 60; // Challenge
// Player state
let action = {jump:false, duck:false, lean:0}; // lean -1..1
let vertical = 0; // jump y
let vVel = 0;

// Beat Map
let useBeat = true;
let bpm = 120;
let beatInterval = 0.5; // 60/bpm
let beatsPerBar = 4;
let totalBars = 16;
let beatTime = 0;
let curBeat = 0; // absolute beat index
let metronomeOn = false;
let music = null; // <audio> created dynamically

// Difficulty config
const DIFF_CFG = {
  Easy:    { speed: 5, lives: 4, spawnBias: 0.2, time: 70 },
  Normal:  { speed: 6.5, lives: 3, spawnBias: 0.3, time: 60 },
  Hard:    { speed: 8, lives: 2, spawnBias: 0.45, time: 50 }
};

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
      const axisToLean = (e)=>{ action.lean = (e.detail.axis && e.detail.axis[0]) || 0; };
      cr.addEventListener('axismove', axisToLean);
      cl.addEventListener('axismove', axisToLean);
    }

    // Buttons
    HUD.btnPractice.onclick = ()=>{ MODE='Practice'; HUD.mode.textContent='Practice'; HUD.status.textContent='โหมดฝึก: ไม่มีจับเวลา'; };
    HUD.btnChallenge.onclick = ()=>{ MODE='Challenge'; HUD.mode.textContent='Challenge'; HUD.status.textContent='โหมดแข่ง: จับเวลา'; };

    HUD.selDiff.onchange = ()=>{
      DIFFICULTY = HUD.selDiff.value;
      HUD.diff.textContent = DIFFICULTY;
      const cfg = DIFF_CFG[DIFFICULTY];
      baseSpeed = cfg.speed; timeLimit = cfg.time; lives = cfg.lives;
      HUD.life.textContent = '❤'.repeat(lives);
      HUD.status.textContent = `ตั้งค่า: ${DIFFICULTY} | speed≈${baseSpeed}`;
    };

    HUD.inpBPM.onchange = HUD.inpBPM.oninput = ()=>{
      bpm = (+HUD.inpBPM.value)||120;
      beatInterval = 60 / bpm;
      HUD.beat.textContent = `${bpm} BPM`;
    };
    HUD.inpBars.onchange = HUD.inpBars.oninput = ()=>{
      totalBars = Math.max(1, (+HUD.inpBars.value||16));
    };

    HUD.btnMetro.onclick = ()=>{
      metronomeOn = !metronomeOn;
      HUD.btnMetro.textContent = metronomeOn ? 'Metronome: ON' : 'Metronome';
      if (metronomeOn) SFX.tick();
    };

    HUD.musicFile.addEventListener('change', handleMusicFile);

    HUD.btnStart.onclick = ()=> startGame();
    HUD.btnReset.onclick = ()=> resetGame();

    // defaults
    bpm = (+HUD.inpBPM.value)||120; beatInterval = 60/bpm;
    DIFFICULTY = HUD.selDiff.value; HUD.diff.textContent = DIFFICULTY;

    this.el.sceneEl.addEventListener('renderstart', ()=> resetGame());
  },
  remove(){ window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); },
  onKey(e){
    if (e.type==='keydown'){
      if (e.code==='Space') action.jump=true;
      if (e.ctrlKey) action.duck=true;
      if (e.code==='KeyA') action.lean=-1;
      if (e.code==='KeyD') action.lean=1;
      if (e.code==='KeyW') speed = Math.min(12, speed+0.5);
      if (e.code==='KeyS') speed = Math.max(3, speed-0.5);
      if (e.code==='KeyR') resetGame();
    } else {
      if (e.code==='Space') action.jump=false;
      if (!e.ctrlKey) action.duck=false;
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

    // Metronome (visual/audio only)
    if (metronomeOn){
      beatTime += dt;
      if (beatTime >= beatInterval){
        beatTime -= beatInterval;
        const beatInBar = (curBeat % beatsPerBar);
        if (beatInBar===0) SFX.tick(); else SFX.tock();
        HUD.beat.textContent = `Beat ${curBeat+1} (bar ${Math.floor(curBeat/beatsPerBar)+1})`;
        curBeat++;
      }
    }

    // Player vertical (jump)
    const g = 20;
    if (action.jump && Math.abs(vertical)<=0.001){ vVel = 6.5; SFX.beep(); }
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

    // Spawning — two modes: beat-driven or random
    if (useBeat){
      // lock to beats; spawn exactly on the beat boundary
      beatTime += dt;
      while (beatTime >= beatInterval){
        beatTime -= beatInterval;
        const beatInBar = (curBeat % beatsPerBar);
        spawnOnBeat(beatInBar);
        curBeat++;
        HUD.beat.textContent = `Beat ${curBeat} (bar ${Math.floor((curBeat-1)/beatsPerBar)+1})`;
        // end after totalBars in Challenge
        if (MODE==='Challenge' && Math.floor((curBeat-1)/beatsPerBar) >= totalBars){ endGame(true); return; }
      }
    } else {
      spawnTimer -= dt;
      if (spawnTimer<=0){
        const cfg = DIFF_CFG[DIFFICULTY];
        // spawn frequency depends on difficulty
        spawnTimer = 1.2 - (cfg.spawnBias*0.6) + Math.random()*0.6;
        spawnRandom();
      }
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
  // difficulty apply
  const cfg = DIFF_CFG[DIFFICULTY];
  baseSpeed = cfg.speed; speed = baseSpeed; timeLimit = cfg.time; lives = cfg.lives;
  HUD.life.textContent = '❤'.repeat(lives);

  // beat config
  bpm = (+HUD.inpBPM.value)||120; beatInterval = 60 / bpm;
  totalBars = Math.max(1,(+HUD.inpBars.value||16));
  useBeat = true; // เปิดโหมด beat map ตามคำขอ
  metronomeOn = false; HUD.btnMetro.textContent = 'Metronome';

  running = true; startedAt = performance.now()/1000;
  score = 0; distance = 0; orbs = 0; curBeat = 0; beatTime = 0;
  HUD.score.textContent = '0'; HUD.dist.textContent = '0 m'; HUD.orb.textContent = '0';
  HUD.status.textContent='เริ่มแล้ว! เล่นตามจังหวะ beat และหลบอุปสรรค + เก็บ Orbs';
  clearTrack();

  // play music if selected
  if (music){ music.currentTime = 0; music.play().catch(()=>{}); }
}
function resetGame(){
  running = false; score = 0; distance = 0; orbs = 0;
  const cfg = DIFF_CFG[DIFFICULTY]; lives = cfg.lives;
  HUD.score.textContent='0'; HUD.dist.textContent='0 m'; HUD.orb.textContent='0';
  HUD.life.textContent='❤'.repeat(lives); HUD.time.textContent='—'; HUD.beat.textContent='—';
  HUD.status.textContent='ตั้งค่าโหมด/ความยาก/BPM แล้วกด Start';
  clearTrack();
  // stop music
  if (music){ try{ music.pause(); }catch(_){} }
}
function endGame(win=false){
  running = false;
  HUD.status.textContent = win ? ('เยี่ยม! จบเพลง/เวลาพอดี คะแนนรวม: '+score) : ('ชนสิ่งกีดขวาง หมดชีวิต! คะแนนรวม: '+score);
  win ? SFX.win() : SFX.hit();
  if (music){ try{ music.pause(); }catch(_){} }
}

// ---------- Music upload ----------
function handleMusicFile(e){
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (music){ try{ music.pause(); }catch(_){} }
  music = new Audio(URL.createObjectURL(file));
  music.crossOrigin = 'anonymous';
}

// ---------- Spawning helpers ----------
function clearTrack(){
  spawns.forEach(s=> s.el.parentNode && s.el.parentNode.removeChild(s.el));
  spawns = [];
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

// Random spawn (when not using beat)
function spawnRandom(){
  const r = Math.random();
  if (r<0.2) return spawnOrb();
  if (r<0.45) return spawnWallLow();
  if (r<0.7)  return spawnTunnel();
  if (r<0.85) return spawnBlock('left');
  return spawnBlock('right');
}

// Beat-driven spawn pattern (4/4)
function spawnOnBeat(beatInBar){
  // สร้างแพตเทิร์นง่าย ๆ: beat 1 = obstacle เด่น, beat 3 = obstacle รอง, beat 2/4 = โอกาสเก็บ orb
  const cfg = DIFF_CFG[DIFFICULTY];
  const rand = Math.random();

  if (beatInBar === 0){ // downbeat — obstacleหลัก
    if (rand < 0.34) spawnWallLow();
    else if (rand < 0.68) spawnTunnel();
    else spawnBlock(Math.random()<0.5?'left':'right');
  } else if (beatInBar === 2){ // beat3 — obstacleรองตามความยาก
    if (rand < cfg.spawnBias){
      if (rand < 0.5) spawnBlock(Math.random()<0.5?'left':'right');
      else spawnWallLow();
    }
  } else { // beat2 & beat4 — ของรางวัล
    if (rand < 0.5) spawnOrb();
  }

  // เพิ่ม score เล็กน้อยตามจังหวะเพื่อกระตุ้นการเล่นตาม beat
  score += 2; HUD.score.textContent = score;
}

// ---------- Scoring / Collision ----------
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
