/* games/rhythm-boxer/game.js
 * Rhythm Boxer – vNext (15 features pack)
 * - Fever + Dynamic Speed Scale + Random Lane Challenge
 * - Power-Up Notes + Life Gauge + Lighting Pulse + Skins
 * - Hit Sparks + Haptics + Cheer/Coach + Badges/EXP
 * - Leaderboard Hook + Daily Missions + Song Unlock Tree
 * - Stats Dashboard
 * - Mouse/Touch Raycast; Back to Hub fixed
 */
(function(){
  "use strict";

  // ---------- Utils ----------
  const $ = (id)=>document.getElementById(id);
  const clamp = (n,a,b)=>Math.max(a, Math.min(b, n));
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'') || '/webxr-health-mobile/vr-fitness';
  const HUB_URL = 'https://supparang.github.io/webxr-health-mobile/vr-fitness/';
  const now = ()=>performance.now();

  // ---------- Audio & Haptics ----------
  const SFX = {
    good: new Audio(`${ASSET_BASE}/assets/sfx/rb_good.wav`),
    perfect: new Audio(`${ASSET_BASE}/assets/sfx/rb_perfect.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/rb_miss.wav`),
    cheer: new Audio(`${ASSET_BASE}/assets/sfx/rb_cheer.wav`),
    coach1: new Audio(`${ASSET_BASE}/assets/sfx/coach_keepgoing.wav`),
    coach2: new Audio(`${ASSET_BASE}/assets/sfx/coach_nice.wav`),
    power: new Audio(`${ASSET_BASE}/assets/sfx/rb_power.wav`),
    fever: new Audio(`${ASSET_BASE}/assets/sfx/rb_fever.wav`),
    pulse: new Audio(`${ASSET_BASE}/assets/sfx/metronome.wav`),
  };
  const play = (a)=>{ try{ a.currentTime = 0; a.play(); }catch{} };
  const vibrate = (ms=20)=>{ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch{} };

  // ---------- Game State ----------
  let running=false, paused=false, timer=null, spawner=null;
  let bpm = 110, offsetMs = 0, songLen = 75_000;
  let baseSpeed = 0.9;        // px/ms (จะปรับด้วย difficulty และ dynamic scale)
  let speedMul = 1.0;         // dynamic speed scale (ข้อ 2)
  let spawnGap = 520;         // ms (จะไหลเพิ่มความถี่เรื่อยๆ)
  let spawnEaseTimer = 0;     // คุมการค่อยๆ ถี่ขึ้น (ข้อ feedback)
  let score=0, combo=0, maxCombo=0, total=0, hits=0, perfects=0, goods=0, misses=0;
  let fever=false, feverEnd=0;
  let life=100;               // ข้อ 5: Life Gauge
  let laneMissingCooldown = 0;// ข้อ 3: Random Lane Challenge
  let exp = +localStorage.getItem('rb_exp')||0;  // ข้อ 11
  let envSkin = localStorage.getItem('rb_skin')||'neon'; // ข้อ 7
  let diffKey = localStorage.getItem('rb_diff')||'standard'; // beginner/standard/challenge (จากเมนูหน้า index)

  const DIFF = {
    beginner:  {speed:0.75, gap:700, feverCombo:20, hpLoss:9, hpGain:2},
    standard:  {speed:0.95, gap:560, feverCombo:24, hpLoss:11, hpGain:2},
    challenge: {speed:1.15, gap:460, feverCombo:28, hpLoss:13, hpGain:1},
  };
  let D = DIFF[diffKey] || DIFF.standard;

  // UI bindings (จำเป็นต้องมีใน index.html)
  // #startBtn, #pauseBtn, #endBtn, #backBtn, #songSel, #skinSel, #diffSel, #hitLine, #hud*, #results*
  const scene = document.querySelector('a-scene');

  // ---------- Lanes & Notes ----------
  const LANES = [-0.9, -0.3, 0.3, 0.9]; // x positions
  const LANE_CLR = ['#5de1ff','#ff7aa2','#ffd166','#7affc4']; // สีของ note หลากสี (ข้อเพิ่มสี)
  const HIT_Z = -2.2;
  const HIT_Y = 1.05; // เส้น Hit line
  const NOTE_SIZE = 0.22; // ให้ใหญ่ขึ้นตามคำขอ
  const HIT_WIN_PERF = 140; // ms
  const HIT_WIN_GOOD = 260; // ms
  const HIT_FORGIVENESS_X = 0.42; // ช่วยเล็ง (Hit Assist)

  const pool = new Set(); // เก็บโน้ต active

  // ---------- Songs & Unlock Tree (ข้อ 14) ----------
  // ปลดเพลงตาม EXP สะสม (ตัวอย่าง)
  const SONGS = [
    { id:'intro_gym',  name:'Intro Gym',   src:`${ASSET_BASE}/assets/music/intro_gym.mp3`,  bpm:100, offset:80,  needExp:0,   len:60_000 },
    { id:'neon_pulse', name:'Neon Pulse',  src:`${ASSET_BASE}/assets/music/neon_pulse.mp3`, bpm:118, offset:90,  needExp:50,  len:75_000 },
    { id:'sky_drive',  name:'Sky Drive',   src:`${ASSET_BASE}/assets/music/sky_drive.mp3`,  bpm:132, offset:110, needExp:140, len:90_000 },
  ];
  function availableSongs(){ return SONGS.filter(s=>exp>=s.needExp); }

  let music = null;
  function loadSongById(id){
    const s = SONGS.find(x=>x.id===id) || SONGS[0];
    if(music){ try{ music.pause(); }catch{} }
    music = new Audio(s.src); music.onended = end; music.volume = 0.9;
    bpm = s.bpm; offsetMs = s.offset; songLen=s.len;
    // ปรับ spawn จาก diff และเริ่มค่อยๆถี่ขึ้น
    D = DIFF[diffKey] || DIFF.standard;
    baseSpeed = D.speed;
    spawnGap = D.gap;
    spawnEaseTimer = 0;
    $('songNow') && ( $('songNow').textContent = s.name + (exp<s.needExp? ' (LOCKED)':'') );
  }

  // ---------- Lighting Pulse (ข้อ 6) ----------
  let lastBeat=0, beatMs=600; // จะอัปเดตจาก bpm
  function pulse(){
    try{
      const bg = $('arenaPulse');
      if(!bg) return;
      bg.emit('pulse');
      play(SFX.pulse);
    }catch{}
  }

  // ---------- Fever & Dynamic speed (ข้อ 1,2) ----------
  function tryFever(){
    if(fever) return;
    const need = D.feverCombo;
    if(combo>=need){
      fever = true;
      feverEnd = now() + 8000;
      play(SFX.fever);
      $('feverTag') && ( $('feverTag').style.display='inline-block' );
    }
  }
  function tickFever(){
    if(!fever) return;
    if(now()>feverEnd){
      fever=false;
      $('feverTag') && ( $('feverTag').style.display='none' );
    }
  }
  function tickSpeedScale(){
    // ถ้า perfect/good ต่อเนื่อง ยก speedMul ทีละนิดจน max 1.25, ถ้าพลาดค่อยลด
    if(combo>0 && combo%10===0) speedMul = clamp(speedMul+0.03, 1.0, 1.25);
    if(misses>0 && combo===0)   speedMul = clamp(speedMul-0.04, 0.9, 1.25);
  }

  // ---------- Random Lane Challenge (ข้อ 3) ----------
  function maybeRandomLaneSkip(){
    if(laneMissingCooldown>0){ laneMissingCooldown--; return null; }
    if(Math.random()<0.14){
      laneMissingCooldown = 12;
      return Math.floor(Math.random()*LANES.length); // lane index ที่จะเว้น
    }
    return null;
  }

  // ---------- Power-Up Notes (ข้อ 4) ----------
  // โอกาสเล็กน้อยจะเป็น note ทอง ให้โบนัสคะแนน/ฟื้นพลัง
  function rollPowerNote(){ return Math.random()<0.08; }

  // ---------- Create Note ----------
  function createNote(laneIdx, tSpawn){
    const x = LANES[laneIdx];
    const col = LANE_CLR[laneIdx % LANE_CLR.length];
    const power = rollPowerNote();
    const el = document.createElement(power? 'a-octahedron':'a-sphere');
    el.classList.add('note','clickable');
    el.setAttribute('radius', NOTE_SIZE);
    el.setAttribute('color', power? '#ffd54a': col);
    el.setAttribute('position', `${x} ${HIT_Y+2.6} ${HIT_Z}`);
    el.dataset.lane = laneIdx;
    el.dataset.spawn = tSpawn;
    el.dataset.power = power? '1':'0';
    el.dataset.hit = '0';
    $('arena').appendChild(el);
    pool.add(el);
  }

  // ---------- Spawner (เริ่มห่างๆ แล้วค่อยถี่ขึ้น) ----------
  function spawnLoop(){
    if(!running) return;
    const t = now();
    const skipLane = maybeRandomLaneSkip();
    // สุ่ม 1–2 โน้ต/ชุด แต่ไม่ชน lane ที่ถูกปิด
    let count = (Math.random()<0.35?2:1);
    const lanes = [0,1,2,3].filter(i=>i!==skipLane);
    for(let i=0;i<count;i++){
      if(lanes.length===0) break;
      const idx = lanes.splice(Math.floor(Math.random()*lanes.length),1)[0];
      createNote(idx, t);
    }
    // ค่อยๆ ทำให้ถี่ขึ้น (เริ่มห่างมาก)
    spawnEaseTimer += spawnGap;
    if(spawnGap>320) spawnGap -= 8; // ลดทีละนิด (ปล่อยโน้ตถี่ขึ้น)
    spawner = setTimeout(spawnLoop, spawnGap);
  }

  // ---------- Move Notes ----------
  function tickNotes(dt){
    const speed = baseSpeed * speedMul * (fever?1.12:1.0);
    const arr=[...pool];
    for(const el of arr){
      if(!el.parentNode){ pool.delete(el); continue; }
      const p = el.object3D.position;
      // เคลื่อน “ลง” ตามแกน Y เข้าหา HIT_Y
      p.y = p.y - speed*(dt/16.666);
      el.object3D.position.set(p.x, p.y, p.z);

      // เลยเส้น HIT?
      if(p.y <= HIT_Y-0.12 && el.dataset.hit!=='1'){
        // MISS
        el.dataset.hit='1';
        onHit(el, 'miss');
      }
      // เก็บของที่พ้นจอ
      if(p.y < (HIT_Y-1.8)){
        try{ el.parentNode.removeChild(el); }catch{}
        pool.delete(el);
      }
    }
  }

  // ---------- Hit Detection (เมาส์/ทัช) ----------
  // ใช้ raycaster + window detection (เวลา & ระยะ X)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  function pick(clientX, clientY){
    if(!running) return;
    const cam = scene?.camera; if(!cam) return;
    mouse.x =  (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, cam);

    const objs = [];
    document.querySelectorAll('.note').forEach(n=>{
      if(n.object3D) n.object3D.traverse(o=>objs.push(o));
    });
    const hits = raycaster.intersectObjects(objs, true);
    if(hits.length){
      let o=hits[0].object; while(o && !o.el) o=o.parent;
      if(o && o.el){ judgeHit(o.el); }
    }else{
      // ไม่มี intersect ให้ลองใช้ Hit Assist หา note ใกล้ hit line สุดบน lane ที่ตรง X
      const cand = nearestNoteByX();
      if(cand) judgeHit(cand);
    }
  }
  window.addEventListener('mousedown', e=>pick(e.clientX, e.clientY), {passive:true});
  window.addEventListener('touchstart', e=>{
    const t = e.touches?.[0]; if(!t) return;
    pick(t.clientX, t.clientY);
  }, {passive:true});

  function nearestNoteByX(){
    let best=null, bestDY=999;
    for(const el of pool){
      if(el.dataset.hit==='1') continue;
      const p = el.object3D.position;
      const dy = Math.abs(p.y - HIT_Y);
      if(dy < bestDY && dy < 0.42) { // หน้าต่างกว้างขึ้น
        best = el; bestDY = dy;
      }
    }
    return best;
  }

  function judgeHit(el){
    if(!el || el.dataset.hit==='1') return;
    const p = el.object3D.position;
    const dy = Math.abs(p.y - HIT_Y);
    const dx = Math.abs(p.x - LANES[+el.dataset.lane]);

    // Hit Assist: อนุญาต dx กว้างขึ้น และ Perfect/Good ตามเวลา
    if(dx>HIT_FORGIVENESS_X){ return; } // ไกลเกิน
    const tNow = now();
    const tSpawn = +el.dataset.spawn || (tNow - offsetMs);
    const tDiff = Math.abs( (tNow - tSpawn) - offsetMs ); // ประมาณการ

    let kind='good';
    if(tDiff <= HIT_WIN_PERF) kind='perfect';
    else if(tDiff <= HIT_WIN_GOOD) kind='good';
    else kind='miss';

    onHit(el, kind);
  }

  // ---------- On Hit ----------
  function sparkAt(el, kind){
    // Hit Sparks FX (ข้อ 9)
    const e=document.createElement('a-entity');
    const p=el.object3D.getWorldPosition(new THREE.Vector3());
    e.setAttribute('position', `${p.x} ${p.y} ${p.z}`);
    e.setAttribute('text', {value: kind==='perfect'?'PERFECT':(kind==='good'?'GOOD':'MISS'), color: kind==='perfect'?'#00ffa3': (kind==='good'?'#9bd1ff':'#ff6688'), align:'center', width: 2.6});
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in','property: scale; to: 1 1 1; dur: 100; easing: easeOutBack');
    e.setAttribute('animation__up','property: position; to: '+`${p.x} ${p.y+0.5} ${p.z}`+'; dur: 600; easing: easeOutQuad');
    e.setAttribute('animation__fade','property: opacity; to: 0; dur: 500; delay: 120; easing: linear');
    $('arena').appendChild(e);
    setTimeout(()=>{ try{ e.parentNode && e.parentNode.removeChild(e);}catch{} }, 820);
  }

  function onHit(el, kind){
    el.dataset.hit='1';
    try{ el.parentNode && el.parentNode.removeChild(el); }catch{}
    pool.delete(el);

    total++;
    let add=0;
    const power = el.dataset.power==='1';

    if(kind==='miss'){
      misses++; combo=0;
      life = clamp(life - D.hpLoss, 0, 100);
      play(SFX.miss); vibrate(40);
    }else{
      hits++; combo++; maxCombo = Math.max(maxCombo, combo);
      if(kind==='perfect'){ perfects++; add = 150; play(SFX.perfect);
      } else { goods++; add = 80; play(SFX.good); }
      life = clamp(life + D.hpGain + (power?4:0), 0, 100);
      if(power) play(SFX.power);
      if(combo>0 && combo%25===0){ play(SFX.cheer); (Math.random()<.5?play(SFX.coach1):play(SFX.coach2)); }
      if(combo>=D.feverCombo) tryFever();
      tickSpeedScale();
    }

    if(fever && kind!=='miss') add = Math.round(add*1.5);
    score += add;
    updateHUD();
    sparkAt(el, kind);

    // Lighting Pulse sync (เบา ๆ เมื่อโดน)
    pulse();

    // Haptics
    if(kind==='perfect') vibrate(25);
    else if(kind==='good') vibrate(15);
  }

  // ---------- HUD ----------
  function updateHUD(){
    $('score') && ( $('score').textContent = score );
    $('combo') && ( $('combo').textContent = combo );
    $('life')  && ( $('life').style.width = life+'%' );
    $('acc')   && ( $('acc').textContent = total? Math.round(hits/total*100)+'%':'0%' );
  }

  // ---------- Daily Missions (ข้อ 13) ----------
  // ตัวอย่าง: Perfect >= 60, Combo >= 40, Accuracy >= 90%
  function todayKey(){
    const d=new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
  }
  let mission = JSON.parse(localStorage.getItem('rb_mission')||'null');
  if(!mission || mission.date!==todayKey()){
    mission = { date: todayKey(), needPerfect: 60, needCombo: 40, needAcc: 90, done:false };
    localStorage.setItem('rb_mission', JSON.stringify(mission));
  }

  // ---------- Leaderboard Hook (ข้อ 12) ----------
  function postLeaderboard(payload){
    try{ window.Leaderboard?.postResult?.('rhythm-boxer', payload); }catch{}
  }

  // ---------- Results + EXP (ข้อ 11 & 15) ----------
  function showResults(){
    const acc = total? Math.round(hits/total*100):0;
    const star = (acc>=95?3: acc>=85?2: acc>=70?1:0) + (maxCombo>=60?1:0) + (fever?1:0);
    $('rScore').textContent = score;
    $('rAcc').textContent = acc+'%';
    $('rMaxCombo').textContent = maxCombo;
    $('rStars').textContent = '★'.repeat(Math.min(5,star)) + '☆'.repeat(Math.max(0,5-star));
    $('results').style.display='flex';

    // Stats Dashboard (ย่อ): แสดงสรุป
    $('rDetail').textContent = `Perfect ${perfects} · Good ${goods} · Miss ${misses}`;

    // EXP
    const getExp = Math.max(5, Math.round(score/400)) + (star>=3?15:0);
    exp += getExp;
    localStorage.setItem('rb_exp', exp);
    $('rEXP').textContent = `+${getExp} EXP (Total ${exp})`;

    // Daily mission
    if(!mission.done){
      const ok = perfects>=mission.needPerfect && maxCombo>=mission.needCombo && acc>=mission.needAcc;
      if(ok){ mission.done=true; localStorage.setItem('rb_mission', JSON.stringify(mission)); $('rMission').textContent='Daily Mission: DONE ✅'; }
      else { $('rMission').textContent=`Daily Mission: Perfect≥${mission.needPerfect}, Combo≥${mission.needCombo}, Acc≥${mission.needAcc}%`; }
    }else{
      $('rMission').textContent='Daily Mission: DONE ✅';
    }

    // Leaderboard
    postLeaderboard({ score, acc, maxCombo, diff:diffKey });
  }

  // ---------- Flow ----------
  let lastT=0;
  function loop(t){
    if(!running || paused) { lastT=t; requestAnimationFrame(loop); return; }
    const dt = (t - lastT)||16.666; lastT=t;
    tickNotes(dt);
    tickFever();

    // beat pulse
    if(t - lastBeat >= beatMs){
      lastBeat = t;
      pulse();
    }
    requestAnimationFrame(loop);
  }

  function start(){
    if(running) return;
    // อ่านเมนู
    diffKey = $('diffSel')?.value || diffKey;
    localStorage.setItem('rb_diff', diffKey);
    const sId = $('songSel')?.value || availableSongs()[0]?.id || SONGS[0].id;
    loadSongById(sId);

    // เตรียมค่า
    score=0; combo=0; maxCombo=0; total=0; hits=0; perfects=0; goods=0; misses=0;
    life=100; speedMul=1.0; fever=false; $('feverTag')&&( $('feverTag').style.display='none');

    // HUD
    $('results').style.display='none';
    updateHUD();

    // ปรับ beatMs
    beatMs = 60000 / bpm;

    // เริ่มเพลงด้วย offset
    setTimeout(()=>{ try{ music?.play(); }catch{} }, Math.max(0, offsetMs));

    running=true; paused=false;
    // ลบโน้ตเดิม
    [...pool].forEach(n=>{ try{ n.parentNode && n.parentNode.removeChild(n);}catch{} pool.delete(n); });

    // เริ่ม spawn (เริ่มห่าง)
    spawner && clearTimeout(spawner);
    spawner = setTimeout(spawnLoop, 600);

    // Timer จบเพลง
    timer && clearTimeout(timer);
    timer = setTimeout(end, songLen + 1000);

    requestAnimationFrame(loop);
  }

  function end(){
    if(!running) return;
    running=false; paused=false;
    try{ music?.pause(); }catch{}
    spawner && clearTimeout(spawner); timer && clearTimeout(timer);
    // ล้างโน้ต
    [...pool].forEach(n=>{ try{ n.parentNode && n.parentNode.removeChild(n);}catch{} pool.delete(n); });
    showResults();
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    $('pauseBtn') && ($('pauseBtn').textContent = paused? 'Resume':'Pause');
    try{ if(music){ paused? music.pause(): music.play(); } }catch{}
  }

  // ---------- UI Wiring ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    // สกิน (ข้อ 7)
    const sEl = $('skinSel'); if(sEl){
      sEl.value = envSkin;
      sEl.addEventListener('change', e=>{
        envSkin = e.target.value;
        localStorage.setItem('rb_skin', envSkin);
        applySkin();
      }, {passive:true});
      applySkin();
    }

    // เพลง (ปลดล็อกตาม EXP)
    const songSel = $('songSel');
    if(songSel){
      songSel.innerHTML = '';
      SONGS.forEach(s=>{
        const o=document.createElement('option');
        o.value = s.id;
        o.textContent = exp>=s.needExp? s.name : `${s.name} 🔒(EXP ${s.needExp})`;
        o.disabled = exp < s.needExp;
        songSel.appendChild(o);
      });
    }

    $('diffSel') && ( $('diffSel').value = diffKey );

    $('startBtn')?.addEventListener('click', start);
    $('pauseBtn')?.addEventListener('click', togglePause);
    $('endBtn')?.addEventListener('click', end);
    $('backBtn')?.addEventListener('click', ()=>{ window.location.href = HUB_URL; });

    // ให้ปุ่มคลิกได้แน่นอน
    ['startBtn','pauseBtn','endBtn','backBtn','songSel','diffSel','skinSel'].forEach(id=>{
      if($(id)){ $(id).style.pointerEvents='auto'; $(id).tabIndex=0; }
    });
  });

  function applySkin(){
    // เปลี่ยนสีพื้นหลัง/สภาพแวดล้อม
    const bg = $('arenaBG');
    if(!bg) return;
    const map = {
      neon:  '#09131c',
      space: '#0a0b14',
      gym:   '#0f1214'
    };
    bg.setAttribute('color', map[envSkin]||'#0a0b14');
  }

  // ---------- Hit Line (เขียวเรืองแสง)
  // ใส่ไว้ใน index แล้ว: <a-box id="hitLine">
  const hitLine = $('hitLine');
  if(hitLine){
    hitLine.setAttribute('color', '#00ff88');
    hitLine.setAttribute('material', 'emissive: #00ff88; emissiveIntensity: 0.9; opacity: 0.66; transparent: true');
    hitLine.setAttribute('position', `0 ${HIT_Y} ${HIT_Z}`);
  }

})();
