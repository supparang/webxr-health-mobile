// === VR Fitness — Shadow Breaker (3D Edition) ==============================
// - 3 เลน (L,C,R) เป้าเป็น 3D หลายรูปทรง/หลายสี มีทั้ง Good และ Decoy (หักคะแนน/คอมโบ)
// - กด J/K/L หรือคลิก/แตะบนเป้าเพื่อชก (ใช้ Raycaster)
// - แตกกระจายเป็นอนุภาค + Screen Shake ตามแรง
// - Timer/Score/Combo/Stars + ส่ง HubScoreTick ทุกวินาที + HubGameEnd เมื่อหมดเวลา
// - Pause on blur + รับ hub:pause
// ===========================================================================
import * as THREE from "https://unpkg.com/three@0.159.0/build/three.module.js";

(function(){
  "use strict";

  // -------- Launch Params --------
  const L = window.HubLaunch || {};
  const GAME_ID = "shadow-breaker";
  const MODE = (L.mode||"timed");
  const DIFF = (L.diff||"normal");
  const TOTAL_TIME = clamp(+L.time || 90, 30, 180);

  // -------- Difficulty Config --------
  const DF = {
    easy:   { bpm: 90,  speed: 9,  hitWin: 0.65, decoyRate: 0.15 },
    normal: { bpm: 110, speed: 11, hitWin: 0.55, decoyRate: 0.22 },
    hard:   { bpm: 130, speed: 13, hitWin: 0.48, decoyRate: 0.28 },
    final:  { bpm: 150, speed: 15, hitWin: 0.42, decoyRate: 0.33 }
  }[DIFF] || { bpm: 110, speed: 11, hitWin: 0.55, decoyRate: 0.22 };

  const LANES = ["L","C","R"];
  const laneX = { L:-2.2, C:0, R:2.2 };           // world x per lane
  const HIT_Z = -0.6;                             // ระนาบชก
  const MISS_Z = 0.6;                             // เลยระนาบ = miss
  const SPAWN_Z = -28;                            // จุดเกิด
  const SPAWN_MS = Math.round(60000/DF.bpm);      // ตาม bpm

  // -------- State --------
  let timeLeft = TOTAL_TIME;
  let score = 0, combo = 0, bestCombo = 0, stars = 0;
  let paused = false, finished = false;

  // -------- HUD (เหมือนเดิม) --------
  mountHUD();

  // -------- THREE.js Setup --------
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 10, 60);

  const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 100);
  camera.position.set(0, 1.0, 5.5);
  camera.lookAt(0, 1.0, 0);

  // Ambient + rim light
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(2, 4, 3);
  scene.add(dir);

  // Floor grid (เล็ก ๆ)
  const grid = new THREE.GridHelper(60, 30, 0x0a93ff, 0x0a0f18);
  grid.position.y = 0;
  scene.add(grid);

  // Lane rails
  const rails = new THREE.Group();
  LANES.forEach(k=>{
    const g = new THREE.BoxGeometry(0.06, 0.06, 30);
    const m = new THREE.MeshBasicMaterial({ color:0x0a93ff, transparent:true, opacity:0.35 });
    const rail = new THREE.Mesh(g,m);
    rail.position.set(laneX[k], 1.0, -15);
    rails.add(rail);

    // hit ring
    const ringGeo = new THREE.TorusGeometry(0.55, 0.04, 10, 36);
    const ringMat = new THREE.MeshBasicMaterial({ color:0x7fe8ff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(laneX[k], 1.0, HIT_Z);
    ring.rotation.x = Math.PI/2;
    rails.add(ring);
  });
  scene.add(rails);

  // Raycaster for click/touch
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // Pools
  const targets = new Set();   // active mesh (with userData: {lane,isDecoy,vel,ttl})
  const particles = new Set(); // bursts

  // -------- Target Factory (หลายรูปทรง/หลายสี + decoy) --------
  const COLORS_GOOD  = [0x7ec8ff,0x9dffb0,0xfff27e,0xd6b3ff,0xffc6a5];
  const COLORS_DECOY = [0xff7d7d,0xff4d6d,0xff8c8c,0xff5d5d];

  function spawnTarget(laneKey, forceDecoy=false){
    const isDecoy = forceDecoy || Math.random() < DF.decoyRate;
    const mesh = makeShape(isDecoy);
    mesh.position.set(laneX[laneKey], 1.0, SPAWN_Z);
    mesh.userData = {
      lane: laneKey,
      isDecoy,
      vel: DF.speed,     // z velocity (+ to camera)
      ttl: 40            // safety
    };
    scene.add(mesh);
    targets.add(mesh);
  }

  function makeShape(isDecoy){
    // สุ่มรูปทรง: sphere, box, tetra (3), pent/hex prism, octa
    const choice = randPick(["sphere","box","tetra","penta","hexa","octa"]);
    let geo;
    switch(choice){
      case "sphere": geo = new THREE.SphereGeometry(0.45, 24, 20); break;
      case "box":    geo = new THREE.BoxGeometry(0.9,0.9,0.9); break;
      case "tetra":  geo = new THREE.TetrahedronGeometry(0.6); break;
      case "octa":   geo = new THREE.OctahedronGeometry(0.6); break;
      case "penta":  geo = new THREE.CylinderGeometry(0.55,0.55,0.5,5); break; // 5 เหลี่ยม
      case "hexa":   geo = new THREE.CylinderGeometry(0.55,0.55,0.5,6); break; // 6 เหลี่ยม
    }
    const color = isDecoy ? randPick(COLORS_DECOY) : randPick(COLORS_GOOD);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.15,
      emissive: isDecoy ? new THREE.Color(0x2b0505) : new THREE.Color(0x05222b),
      emissiveIntensity: isDecoy ? 0.55 : 0.35
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }

  // -------- Particles (แตกกระจาย) --------
  function burstAt(pos, baseColor, magnitude=1){
    const count = Math.floor(80 * magnitude);
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count*3);
    const velocities = new Float32Array(count*3);
    for(let i=0;i<count;i++){
      positions[i*3+0] = pos.x;
      positions[i*3+1] = pos.y;
      positions[i*3+2] = pos.z;

      const v = new THREE.Vector3(
        (Math.random()*2-1),
        Math.random()*1.4,
        (Math.random()*2-1)
      ).normalize().multiplyScalar(6 * magnitude * (0.4+Math.random()*0.8));
      velocities[i*3+0] = v.x; velocities[i*3+1] = v.y; velocities[i*3+2] = v.z;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions,3));
    geo.setAttribute("velocity", new THREE.BufferAttribute(velocities,3));

    const mat = new THREE.PointsMaterial({
      color: baseColor, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.95
    });

    const points = new THREE.Points(geo, mat);
    points.userData = { life: 0.75, maxLife: 0.75 }; // seconds
    scene.add(points);
    particles.add(points);
  }

  // -------- HUD helpers --------
  function mountHUD(){
    if(document.getElementById("sb-hud")) return;
    const node = document.createElement("div");
    node.id = "sb-hud";
    node.innerHTML = `
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
    document.body.appendChild(node);
    byId("sb-diff").textContent = DIFF;
    byId("sb-mode").textContent = MODE;
    updateHUD();
  }

  function byId(id){ return document.getElementById(id); }
  function updateHUD(){
    byId("sb-timer").textContent = fmt(timeLeft);
    byId("sb-score").textContent = score;
    byId("sb-combo").textContent = combo;
    byId("sb-stars").textContent = stars;
  }

  // -------- Utility --------
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  function fmt(sec){ const m=(sec/60)|0; const s=(sec%60)|0; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
  function randPick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function sendToHub(type, data){ try{ if(parent && parent!==window){ parent.postMessage({type,game:GAME_ID,...data},"*"); } }catch(e){} }

  // -------- Spawning --------
  let lastSpawn = performance.now();
  function ensureInitialWave(){
    // โผล่ 3 ชิ้นทันที (ซ้าย-กลาง-ขวา) และอีก 1 ชิ้นเป็น decoy สุ่ม
    spawnTarget("L"); spawnTarget("C"); spawnTarget("R");
    setTimeout(()=> spawnTarget(randPick(LANES), true), 180);
  }
  ensureInitialWave();

  // -------- Input (Keys + Click/Touch) --------
  window.addEventListener("keydown", (e)=>{
    if(e.repeat) return;
    if(e.code==="KeyJ"){ e.preventDefault(); tryHit("L"); }
    if(e.code==="KeyK"){ e.preventDefault(); tryHit("C"); }
    if(e.code==="KeyL"){ e.preventDefault(); tryHit("R"); }
  }, {passive:false});

  renderer.domElement.addEventListener("pointerdown", (ev)=>{
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX-rect.left)/rect.width)*2 - 1;
    mouse.y = -((ev.clientY-rect.top)/rect.height)*2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...targets], false);
    if(intersects.length){
      const obj = intersects[0].object;
      const lane = obj.userData.lane;
      tryHit(lane, obj); // ส่ง mesh ตรง ๆ ถ้าคลิกถูก
    }
  });

  // -------- Hit / Judge / Feedback --------
  let shakeT = 0, shakeAmp = 0;
  function screenShake(power=1){
    shakeT = 0.18;
    shakeAmp = Math.min(0.6, 0.2*power);
  }

  function tryHit(laneKey, preferredMesh=null){
    if(paused || finished) return;

    // หาเป้าที่ใกล้ HIT_Z ที่สุดในเลน
    let found = null, bestDist = 999;
    targets.forEach(m=>{
      if(m.userData.lane !== laneKey) return;
      const z = m.position.z;
      const d = Math.abs(z - HIT_Z);
      if(d < bestDist){ bestDist = d; found = m; }
    });

    // ถ้ามี mesh จาก raycast และใกล้กว่า ให้ใช้ตัวนั้น
    if(preferredMesh && Math.abs(preferredMesh.position.z - HIT_Z) <= bestDist + 0.05){
      found = preferredMesh;
      bestDist = Math.abs(preferredMesh.position.z - HIT_Z);
    }
    if(!found) return;

    const ok = (bestDist <= DF.hitWin);
    if(!ok){
      // กดพลาดไกลไป — นับเป็น miss เบา ๆ
      miss(found.position);
      return;
    }
    judge(found);
  }

  function judge(mesh){
    targets.delete(mesh);
    scene.remove(mesh);

    const isDecoy = !!mesh.userData.isDecoy;
    const baseColor = mesh.material.color.getHex();

    if(isDecoy){
      // หักคะแนน + ตัดคอมโบ + สั่นจอแรง
      combo = 0;
      score = Math.max(0, score - 5);
      stars = calcStars(score, TOTAL_TIME - timeLeft);
      burstAt(mesh.position, baseColor, 1.1);
      screenShake(1.2);
    }else{
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const diffMul = {easy:1.0, normal:1.1, hard:1.25, final:1.35}[DIFF]||1.0;
      score += Math.round(2*diffMul + Math.floor(combo/12));
      stars = calcStars(score, TOTAL_TIME - timeLeft);
      burstAt(mesh.position, baseColor, 0.9);
      screenShake(0.6);
    }
    updateHUD();
  }

  function miss(posVec3){
    combo = 0;
    stars = calcStars(score, TOTAL_TIME - timeLeft);
    burstAt(posVec3, 0xff6666, 0.6);
    screenShake(0.5);
    updateHUD();
  }

  function calcStars(score, elapsed){
    const rate = score / Math.max(1, elapsed);
    const mul = {easy:0.85, normal:1.0, hard:1.2, final:1.35}[DIFF]||1;
    const t=[0.6,1.0,1.6,2.2,3.0].map(x=>x*mul);
    if(rate>=t[4]) return 5;
    if(rate>=t[3]) return 4;
    if(rate>=t[2]) return 3;
    if(rate>=t[1]) return 2;
    if(rate>=t[0]) return 1;
    return 0;
  }

  // -------- Game Loop --------
  let lastT = performance.now();
  function animate(now){
    const dt = Math.min(0.033, (now-lastT)/1000);
    lastT = now;

    if(!paused && !finished){
      // spawn
      if(now - lastSpawn >= SPAWN_MS){
        spawnTarget(randPick(LANES));
        lastSpawn = now;
      }

      // move targets
      targets.forEach(m=>{
        m.position.z += m.userData.vel * dt;         // เข้าหากล้อง
        m.rotation.x += 0.9*dt; m.rotation.y += 0.7*dt;

        m.userData.ttl -= dt;
        if(m.position.z > MISS_Z || m.userData.ttl <= 0){
          // พลาด/หลุดกรอบ = MISS
          miss(m.position.clone());
          scene.remove(m); targets.delete(m);
        }
      });

      // particles
      const rm = [];
      particles.forEach(p=>{
        const pos = p.geometry.attributes.position;
        const vel = p.geometry.attributes.velocity;
        for(let i=0;i<pos.count;i++){
          pos.array[i*3+0] += vel.array[i*3+0]*dt;
          pos.array[i*3+1] += vel.array[i*3+1]*dt - 3.5*dt; // gravity
          pos.array[i*3+2] += vel.array[i*3+2]*dt;
          vel.array[i*3+0] *= 0.98; vel.array[i*3+1] *= 0.98; vel.array[i*3+2] *= 0.98;
        }
        pos.needsUpdate = true; vel.needsUpdate = false;

        p.userData.life -= dt;
        p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
        if(p.userData.life <= 0){ rm.push(p); }
      });
      rm.forEach(p=>{ scene.remove(p); particles.delete(p); });

      // screen shake
      if(shakeT > 0){
        shakeT -= dt;
        const s = shakeAmp * (shakeT/0.18);
        camera.position.x = Math.sin(now*0.06) * s;
        camera.position.y = 1.0 + Math.cos(now*0.09) * s*0.6;
      }else{
        camera.position.x = 0;
        camera.position.y = 1.0;
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // -------- Timer + Hub Ticks --------
  const tick = setInterval(()=>{
    if(finished || paused) return;
    timeLeft = Math.max(0, timeLeft - 1);
    updateHUD();
    sendToHub("HubScoreTick", { timeLeft, score, combo, stars });
    if(timeLeft <= 0){ endGame(true); }
  }, 1000);

  function endGame(byTime){
    if(finished) return;
    finished = true;
    clearInterval(tick);
    sendToHub("HubGameEnd", {
      byTime: !!byTime,
      timeTotal: TOTAL_TIME,
      timePlayed: TOTAL_TIME - timeLeft,
      score, combo, bestCombo, stars, diff: DIFF, mode: MODE
    });
  }

  // -------- Pause / Resume --------
  const bar = byId("sb-pause");
  function setPaused(v){ paused = !!v; bar.classList.toggle("show", paused); }
  window.addEventListener("message",(ev)=>{ if((ev.data||{}).type==="hub:pause") setPaused(!!ev.data.value); });
  window.addEventListener("blur", ()=>setPaused(true));
  window.addEventListener("focus", ()=>setPaused(false));
  document.addEventListener("visibilitychange", ()=> setPaused(document.hidden));

  // -------- Notify Hub Ready --------
  sendToHub("game:ready", {ok:true, game:GAME_ID});

})();
