// === VR Fitness — Shadow Breaker (Pop-up Targets Edition) ==================
// เป้าไม่ไหลลงมา แต่ "โผล่ขึ้น" ที่ระนาบชก แล้วหายไปใน 0.9–1.2s
// - 3 เลน (L,C,R) : กด J/K/L หรือคลิก/แตะเป้า
// - เป้าหลายสี หลายทรง (Sphere/Box/Tetra/Penta/Hexa/Octa) + Decoy (หักคะแนน/คอมโบ)
// - VFX แตกกระจาย + วงแหวนจับเวลา + Screen Shake
// - HUD เดิม + ส่ง HubScoreTick / HubGameEnd
// ===========================================================================

import * as THREE from "https://unpkg.com/three@0.159.0/build/three.module.js";

(function(){
  "use strict";

  // -------- Launch / Diff --------
  const L = window.HubLaunch || {};
  const GAME_ID = "shadow-breaker";
  const MODE = (L.mode||"timed");
  const DIFF = (L.diff||"normal");
  const TOTAL_TIME = clamp(+L.time || 90, 30, 180);

  const DF = {
    easy:   { bpm: 90,  lifeMin:0.95, lifeMax:1.25, decoy:0.12, spawnBias:["C","L","R","C"], points: {good:1, perfect:2} },
    normal: { bpm: 115, lifeMin:0.90, lifeMax:1.20, decoy:0.20, spawnBias:["L","C","R","C"], points: {good:1, perfect:2} },
    hard:   { bpm: 135, lifeMin:0.88, lifeMax:1.12, decoy:0.26, spawnBias:["L","C","R","L","R"], points: {good:1, perfect:3} },
    final:  { bpm: 155, lifeMin:0.84, lifeMax:1.06, decoy:0.33, spawnBias:["L","C","R","L","C","R"], points: {good:1, perfect:3} },
  }[DIFF] || { bpm: 115, lifeMin:0.90, lifeMax:1.20, decoy:0.20, spawnBias:["L","C","R","C"], points:{good:1, perfect:2} };

  const LANES = ["L","C","R"];
  const laneX = { L:-2.1, C:0, R:2.1 };
  const HIT_Z = -0.6;             // ระนาบชก
  const SPAWN_MS = Math.round(60000/DF.bpm);

  // -------- State --------
  let timeLeft = TOTAL_TIME;
  let score=0, combo=0, bestCombo=0, stars=0;
  let paused=false, finished=false;

  // -------- HUD --------
  mountHUD();
  byId("sb-diff").textContent = DIFF;
  byId("sb-mode").textContent = MODE;
  updateHUD();

  // -------- THREE Setup --------
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 10, 60);

  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 100);
  camera.position.set(0, 1.0, 5.5);
  camera.lookAt(0, 1.0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(2,4,3); scene.add(dir);

  // เลน+วงแหวนระนาบชก
  const rails = new THREE.Group();
  LANES.forEach(k=>{
    const ring = new THREE.TorusGeometry(0.62, 0.045, 10, 36);
    const ringMat = new THREE.MeshBasicMaterial({color:0x7fe8ff});
    const mesh = new THREE.Mesh(ring, ringMat);
    mesh.position.set(laneX[k], 1.0, HIT_Z);
    mesh.rotation.x = Math.PI/2;
    rails.add(mesh);
  });
  scene.add(rails);

  // Raycaster
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Pools
  const targets = new Set();   // mesh with userData
  const particles = new Set();

  // -------- Target Factory --------
  const COLORS_GOOD  = [0x7ec8ff,0x9dffb0,0xfff27e,0xd6b3ff,0xffc6a5];
  const COLORS_DECOY = [0xff6b6b,0xff4d6d,0xff8585,0xff5d5d];

  function makeShape(isDecoy){
    const t = pick(["sphere","box","tetra","penta","hexa","octa"]);
    let g;
    switch(t){
      case "sphere": g = new THREE.SphereGeometry(0.52, 22, 18); break;
      case "box":    g = new THREE.BoxGeometry(1.0,1.0,1.0); break;
      case "tetra":  g = new THREE.TetrahedronGeometry(0.7); break;
      case "octa":   g = new THREE.OctahedronGeometry(0.7); break;
      case "penta":  g = new THREE.CylinderGeometry(0.62,0.62,0.52,5); break;
      case "hexa":   g = new THREE.CylinderGeometry(0.62,0.62,0.52,6); break;
    }
    const color = isDecoy ? pick(COLORS_DECOY) : pick(COLORS_GOOD);
    const m = new THREE.MeshStandardMaterial({
      color, roughness:.35, metalness:.18,
      emissive: isDecoy? new THREE.Color(0x2b0505): new THREE.Color(0x05222b),
      emissiveIntensity: isDecoy? .55 : .35
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = false; mesh.receiveShadow = false;
    return mesh;
  }

  // สร้างวงแหวนถอยเวลา (แยกชิ้น เพื่อย่อขนาด)
  function makeCountdownRing(isDecoy){
    const geo = new THREE.RingGeometry(0.75, 0.83, 42);
    const mat = new THREE.MeshBasicMaterial({color: isDecoy? 0xff7d7d : 0x7fe8ff, side:THREE.DoubleSide});
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI/2;
    ring.position.y = 1.0;
    return ring;
  }

  function spawnTarget(laneKey, forceDecoy=false){
    const isDecoy = forceDecoy || Math.random() < DF.decoy;
    const mesh = makeShape(isDecoy);
    mesh.position.set(laneX[laneKey], 1.0, HIT_Z);
    mesh.scale.set(0.2,0.2,0.2); // pop-in
    scene.add(mesh);

    // countdown ring
    const ring = makeCountdownRing(isDecoy);
    ring.position.x = laneX[laneKey];
    ring.position.z = HIT_Z - 0.001; // กันซ้อน z-fight
    scene.add(ring);

    const life = lerp(DF.lifeMin, DF.lifeMax, Math.random()); // วินาที
    mesh.userData = {
      lane: laneKey,
      isDecoy,
      born: performance.now()/1000,
      life, // sec
      ring
    };
    targets.add(mesh);
  }

  // -------- Particles --------
  function burstAt(pos, color, magnitude=1){
    const cnt = Math.floor(80*magnitude);
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(cnt*3);
    const velArr = new Float32Array(cnt*3);
    for(let i=0;i<cnt;i++){
      posArr[i*3+0]=pos.x; posArr[i*3+1]=pos.y; posArr[i*3+2]=pos.z;
      const v = new THREE.Vector3((Math.random()*2-1),(Math.random()*2-1),(Math.random()*2-1))
                  .normalize().multiplyScalar(6*(0.4+Math.random()*0.8)*magnitude);
      velArr[i*3+0]=v.x; velArr[i*3+1]=v.y; velArr[i*3+2]=v.z;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(posArr,3));
    geo.setAttribute("velocity", new THREE.BufferAttribute(velArr,3));
    const mat = new THREE.PointsMaterial({color, size:0.09, sizeAttenuation:true, transparent:true, opacity:.95});
    const pts = new THREE.Points(geo, mat);
    pts.userData = { life:.75, max:.75 };
    scene.add(pts); particles.add(pts);
  }

  // -------- Scoring / HUD --------
  function calcStars(score, elapsed){
    const rate = score / Math.max(1, elapsed);
    const mul = {easy:.85, normal:1.0, hard:1.2, final:1.35}[DIFF]||1;
    const t=[0.6,1.0,1.6,2.2,3.0].map(x=>x*mul);
    if(rate>=t[4])return 5; if(rate>=t[3])return 4; if(rate>=t[2])return 3; if(rate>=t[1])return 2; if(rate>=t[0])return 1; return 0;
  }
  function judgeHit(mesh){
    targets.delete(mesh);
    const {isDecoy, ring} = mesh.userData;
    if(ring) scene.remove(ring);

    const baseColor = mesh.material.color.getHex();
    scene.remove(mesh);

    if(isDecoy){
      combo = 0;
      score = Math.max(0, score - 5);
      screenShake(1.2);
      burstAt(mesh.position, baseColor, 1.1);
    }else{
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const diffMul = {easy:1.0, normal:1.1, hard:1.25, final:1.35}[DIFF]||1.0;
      score += Math.round( (DF.points.perfect) * diffMul + Math.floor(combo/12) );
      screenShake(0.7);
      burstAt(mesh.position, baseColor, 0.9);
    }
    stars = calcStars(score, TOTAL_TIME-timeLeft);
    updateHUD();
  }
  function judgeMiss(mesh){
    targets.delete(mesh);
    if(mesh.userData.ring) scene.remove(mesh.userData.ring);
    scene.remove(mesh);
    combo = 0;
    stars = calcStars(score, TOTAL_TIME-timeLeft);
    burstAt(mesh.position, 0xff6666, 0.6);
    screenShake(0.5);
    updateHUD();
  }

  function updateHUD(){
    byId("sb-timer").textContent = fmt(timeLeft);
    byId("sb-score").textContent = score;
    byId("sb-combo").textContent = combo;
    byId("sb-stars").textContent = stars;
  }

  // -------- Input --------
  window.addEventListener("keydown",(e)=>{
    if(e.repeat) return;
    if(e.code==="KeyJ"){ e.preventDefault(); tryHit("L"); }
    if(e.code==="KeyK"){ e.preventDefault(); tryHit("C"); }
    if(e.code==="KeyL"){ e.preventDefault(); tryHit("R"); }
  }, {passive:false});

  renderer.domElement.addEventListener("pointerdown",(ev)=>{
    // ยิง ray หาเป้าแล้วใช้เลนของเป้านั้น
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX-rect.left)/rect.width)*2-1;
    mouse.y = -((ev.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const inter = raycaster.intersectObjects([...targets], false);
    if(inter.length){
      const m = inter[0].object;
      tryHit(m.userData.lane, m);
    }
  });

  function tryHit(laneKey, meshPref=null){
    if(paused || finished) return;
    // เลือกเป้าที่ "เกิดล่าสุด" ในเลนนั้น (เพราะทุกเป้าอยู่ที่ระนาบเดียวกัน)
    let chosen=null, lastBorn=-1;
    targets.forEach(m=>{
      if(m.userData.lane!==laneKey) return;
      if(m.userData.born>lastBorn){ lastBorn=m.userData.born; chosen=m; }
    });
    if(meshPref) chosen = meshPref; // ถ้าคลิกเป้าโดยตรง
    if(!chosen) return;
    judgeHit(chosen);
  }

  // -------- Spawning control --------
  let lastSpawn = performance.now();
  function initialBurst(){
    // เปิดมาให้มีของชกทันที
    ["L","C","R"].forEach((k,i)=> setTimeout(()=>spawnTarget(k), i*160));
  }
  initialBurst();

  // -------- Screen Shake --------
  let shakeT=0, shakeAmp=0;
  function screenShake(power=1){
    shakeT = 0.18; shakeAmp = Math.min(0.6, 0.22*power);
  }

  // -------- Loops --------
  let lastT = performance.now();
  function animate(now){
    const dt = Math.min(0.033, (now-lastT)/1000);
    lastT = now;

    if(!paused && !finished){
      // spawn ตาม bpm
      if(now - lastSpawn >= SPAWN_MS){
        spawnTarget(pick(DF.spawnBias));
        lastSpawn = now;
      }

      // pop-in scale + countdown ring + timeout
      const rm=[];
      const nowSec = now/1000;
      targets.forEach(m=>{
        // scale in
        const born = m.userData.born;
        const life = m.userData.life;
        const t = clamp((nowSec-born)/0.15, 0, 1);  // 150ms pop-in
        const s = 0.2 + 0.8*t;
        m.scale.setScalar(s);
        m.rotation.x += 0.9*dt; m.rotation.y += 0.7*dt;

        // ring shrink
        const left = clamp((born+life - nowSec)/life, 0, 1);
        if(m.userData.ring){
          m.userData.ring.scale.set(left,left,1);
        }

        // time out -> miss
        if(nowSec > born + life){ rm.push(m); }
      });
      rm.forEach(judgeMiss);

      // particles update
      const rmP=[];
      particles.forEach(p=>{
        const pos = p.geometry.attributes.position;
        const vel = p.geometry.attributes.velocity;
        for(let i=0;i<pos.count;i++){
          pos.array[i*3+0]+=vel.array[i*3+0]*dt;
          pos.array[i*3+1]+=vel.array[i*3+1]*dt-3.5*dt;
          pos.array[i*3+2]+=vel.array[i*3+2]*dt;
          vel.array[i*3+0]*=0.985; vel.array[i*3+1]*=0.985; vel.array[i*3+2]*=0.985;
        }
        pos.needsUpdate = true;
        p.userData.life -= dt; p.material.opacity = Math.max(0, p.userData.life/p.userData.max);
        if(p.userData.life<=0){ rmP.push(p); }
      });
      rmP.forEach(p=>{ scene.remove(p); particles.delete(p); });

      // shake
      if(shakeT>0){
        shakeT-=dt;
        const s = shakeAmp*(shakeT/0.18);
        camera.position.x = Math.sin(now*0.06)*s;
        camera.position.y = 1.0 + Math.cos(now*0.09)*s*0.6;
      }else{
        camera.position.x=0; camera.position.y=1.0;
      }
    }

    renderer.render(scene,camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // -------- Timer + Hub --------
  const tick = setInterval(()=>{
    if(finished || paused) return;
    timeLeft = Math.max(0, timeLeft - 1);
    updateHUD();
    postToHub("HubScoreTick", { timeLeft, score, combo, stars });
    if(timeLeft<=0){ endGame(true); }
  }, 1000);

  function endGame(byTime){
    if(finished) return;
    finished=true;
    clearInterval(tick);
    postToHub("HubGameEnd", {
      byTime:!!byTime, timeTotal:TOTAL_TIME, timePlayed:TOTAL_TIME-timeLeft,
      score, combo, bestCombo, stars, diff:DIFF, mode:MODE
    });
  }

  // -------- Pause --------
  const bar = byId("sb-pause");
  function setPaused(v){ paused=!!v; bar.classList.toggle("show", paused); }
  window.addEventListener("message",(ev)=>{ if((ev.data||{}).type==="hub:pause") setPaused(!!ev.data.value); });
  window.addEventListener("blur", ()=>setPaused(true));
  window.addEventListener("focus", ()=>setPaused(false));
  document.addEventListener("visibilitychange", ()=> setPaused(document.hidden));

  // -------- Hub Ready --------
  postToHub("game:ready", {ok:true, game:GAME_ID});

  // ======= helpers =======
  function postToHub(type,data){ try{ if(parent && parent!==window){ parent.postMessage({type,game:GAME_ID,...data},"*"); } }catch(e){} }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function fmt(sec){ const m=(sec/60)|0, s=(sec%60)|0; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function byId(id){ return document.getElementById(id); }
  function mountHUD(){
    if(byId("sb-hud")) return;
    const n=document.createElement("div");
    n.id="sb-hud";
    n.innerHTML=`
      <style>
        #sb-hud{position:fixed;inset:0;pointer-events:none;color:#fff;font:16px/1.5 system-ui,Segoe UI,Inter,Arial}
        #sb-top{padding-top:22px;text-align:center}
        #sb-title{color:#cfe6ff;margin:0 0 6px 0;font-weight:800}
        #sb-timer{font-size:56px;font-weight:900;letter-spacing:1px}
        #sb-meta{color:#dbe8ff}
        #sb-stats{display:flex;gap:22px;justify-content:center;margin-top:8px}
        #sb-stats .stat{min-width:110px}
        #sb-stats .label{color:#a9b7d0}
        #sb-stats .val{font-size:28px;font-weight:800}
        #sb-pause{position:fixed;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#00e0ff,#8be7ff);opacity:0;transition:opacity .2s}
        #sb-pause.show{opacity:1}
        @media (max-width: 640px){ #sb-timer{font-size:44px} }
      </style>
      <div id="sb-top">
        <h2 id="sb-title">VR Fitness — <b>Shadow Breaker</b></h2>
        <div id="sb-timer">--:--</div>
        <div id="sb-meta">Diff: <b id="sb-diff"></b> | Mode: <b id="sb-mode"></b></div>
        <div id="sb-stats">
          <div class="stat"><div class="label">Score</div><div id="sb-score" class="val">0</div></div>
          <div class="stat"><div class="label">Combo</div><div id="sb-combo" class="val">0</div></div>
          <div class="stat"><div class="label">Stars</div><div id="sb-stars" class="val">0</div></div>
        </div>
      </div>
      <div id="sb-pause"></div>
    `;
    document.body.appendChild(n);
  }

})();
