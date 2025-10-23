/* games/rhythm-boxer/game.js
   Rhythm Boxer · Full game.js (Lane Falling Notes + Scoring + SFX + Results + Pointer Click Fix)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const getQ = (k)=> new URLSearchParams(location.search).get(k);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

  // Null-safe remover to avoid A-Frame "removeChild of null"
  function safeRemove(el){
    try{
      if(!el) return;
      if(!el.isConnected && !el.parentNode) return;
      if(el.parentNode) el.parentNode.removeChild(el);
      else if(el.remove) el.remove();
    }catch(_e){}
  }

  // Toast/ping
  function pingUI(msg,color='#ffcc00'){
    let el=byId('toast');
    if(!el){
      el=document.createElement('div'); el.id='toast'; document.body.appendChild(el);
      Object.assign(el.style,{position:'fixed', left:'50%', top:'12px', transform:'translateX(-50%)',
        background:'rgba(10,12,16,.9)', color:'#ffcc00', padding:'8px 12px',
        borderRadius:'10px', font:'600 14px/1.1 system-ui,Arial', zIndex:9999,
        letterSpacing:'0.4px', transition:'opacity .2s, transform .2s', opacity:'0'});
    }
    el.style.color=color; el.textContent=msg; el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) scale(1)'; }, 900);
  }

  // ---------- SFX ----------
  const SFXN=(p)=>{ const a=new Audio(p); a.onerror=()=>console.warn('SFX not found:',p); return a; };
  const SFX={
    good:SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect:SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`),
    click:SFXN(`${ASSET_BASE}/assets/sfx/laser.wav`),
    success:SFXN(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  const lastPlay=new Map();
  function play(a,guardMs=90){ try{
    const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guardMs) return;
    a.currentTime=0; lastPlay.set(a,now); if(a.paused) a.play();
  }catch(_e){} }

  // ---------- Lane Falling Notes ----------
  const LANES = [-0.9, 0, 0.9];  // X ของแต่ละเลน
  const START_Y = 2.4;           // จุดเกิดด้านบน
  const HIT_LINE_Y = 1.05;       // เส้นฮิต
  const Z = -2.2;

  // เวลาฮิต (ตามความเร็ว) — คิดจากระยะใกล้เส้นฮิต
  const BASE_HIT_WINDOW = 0.12;      // วินาที
  const PERFECT_PORTION = 0.5;

  // ความเร็ว & บีต
  let speedProfile = 'standard';      // beginner | standard | challenge
  let rbSpeedMul = 1.0;               // ปรับตามโปรไฟล์
  let songKey = 'club';               // training | club | rush
  let songBPM = 120;

  // การเกิดโน้ต
  let spawnTimer = null;
  let beatSec = 0.5; // 1/2 beat spawn
  let spawnInterval = 0.3; // seconds

  // ตกลง
  let fallSpeed = 0.88; // หน่วย y/sec
  const fallAcc = 0.02; // ค่อย ๆ เร่ง สูงสุด +40%

  // ---------- State ----------
  let running=false, paused=false, over=false;
  let score=0, combo=0, maxCombo=0;
  let totalNotes=0, hitNotes=0, perfects=0, goods=0, misses=0;
  let startedAt = 0;
  let durationSec = 60; // ความยาวเพลง (กำหนดคร่าว ๆ)

  // HUD อ้างอิง id ถ้ามีก็ใช้
  function updateHUD(){
    const acc = totalNotes? Math.round((hitNotes/totalNotes)*100) : 0;
    if(byId('score')) byId('score').textContent = score;
    if(byId('combo')) byId('combo').textContent = combo;
    if(byId('time'))  byId('time').textContent  = Math.max(0, Math.ceil(getTimeLeft()));
    if(byId('rbAcc')) byId('rbAcc').textContent = acc+'%';
  }

  function getTimeLeft(){
    if(!startedAt) return durationSec;
    const t = (performance.now()-startedAt)/1000;
    return clamp(durationSec - t, 0, durationSec);
  }

  // ใช้เก็บ/เดินรายการโน้ต
  const activeNotes = new Set();

  // เกิดโน้ต 1 อัน ในเลนสุ่ม
  function spawnLaneNote(){
    const laneX = LANES[Math.floor(Math.random()*LANES.length)];
    const note = document.createElement('a-box');
    note.classList.add('note','clickable');
    note.setAttribute('color', '#00d0ff');
    note.setAttribute('depth', '0.06');
    note.setAttribute('width', '0.26');
    note.setAttribute('height','0.26');
    note.setAttribute('position', `${laneX} ${START_Y} ${Z}`);
    note.dataset.spawnT = performance.now()/1000;
    note.dataset.laneX = laneX;
    note.dataset.hit = '0';
    byId('arena')?.appendChild(note);
    activeNotes.add(note);
    totalNotes++;

    // กด/แตะเพื่อฮิต
    note.addEventListener('click', ()=>{
      tryHit(note);
    });
  }

  // อัปเดตทุกเฟรม
  let _lastT = performance.now()/1000;
  function updateFalling(){
    if(!running || paused || over){ requestAnimationFrame(updateFalling); return; }

    const now = performance.now()/1000;
    const dt = Math.min(0.033, now - _lastT);
    _lastT = now;

    // เร่ง fallSpeed ขึ้นทีละน้อย (จำกัดเพดาน +40% จากค่าตั้งต้นตามโปรไฟล์)
    const base = 0.88 * rbSpeedMul;
    const maxV = base * 1.4;
    fallSpeed = clamp(fallSpeed + dt*fallAcc, base, maxV);

    activeNotes.forEach(note=>{
      if(!note.parentNode){ activeNotes.delete(note); return; }
      const p = note.object3D.position;
      p.y -= fallSpeed * dt;
      note.object3D.position.set(p.x, p.y, p.z);

      // เลยเส้นฮิต -> MISS แล้วลบ
      if (p.y < HIT_LINE_Y - 0.2){
        applyMiss(note);
        safeRemove(note);
        activeNotes.delete(note);
      }
    });

    // จบเพลง
    if(getTimeLeft()<=0){
      endGame();
      return;
    }

    requestAnimationFrame(updateFalling);
  }

  function tryHit(note){
    if(!note || note.dataset.hit==='1') return;
    const y = note.object3D.position.y;
    const distY = Math.abs(y - HIT_LINE_Y);

    // window ผูกกับความเร็วตก (เร็ว = เวลากว้างแคบลงทางสัดส่วนเดิม)
    const windowT = BASE_HIT_WINDOW; // วินาที
    const ok = (distY <= fallSpeed * windowT);
    if(ok){
      note.dataset.hit='1';
      const perfectCut = fallSpeed * windowT * PERFECT_PORTION;
      const grade = (distY <= perfectCut) ? 'perfect' : 'good';
      applyHit(note, grade);
      safeRemove(note);
      activeNotes.delete(note);
    }else{
      // ตีเร็ว/ช้าเกิน ให้ตกต่อ
      // hint: ping เล็ก ๆ ได้ ถ้าต้องการ
    }
  }

  // ---------- Score ----------
  function applyHit(note, grade){
    combo++;
    if(combo%10===0) play(SFX.combo);
    if(combo>maxCombo) maxCombo=combo;

    const p = note.object3D.getWorldPosition(new THREE.Vector3());
    let base = 0;
    if(grade==='perfect'){ base=20; perfects++; play(SFX.perfect); floatText('PERFECT','#00ffa3', p); }
    else { base=12; goods++; play(SFX.good); floatText('GOOD','#9bd1ff', p); }

    // คอมโบช่วย: +1 ต่อทุก ๆ 10 คอมโบ
    const comboBonus = Math.floor(combo/10);
    score += base + comboBonus;

    hitNotes++;
    updateHUD();
  }

  function applyMiss(note){
    misses++;
    combo=0;
    play(SFX.miss);
    const p = note?.object3D?.getWorldPosition?.(new THREE.Vector3()) || new THREE.Vector3(0,1.1,-2.2);
    floatText('MISS','#ff5577', p);
    updateHUD();
  }

  // ---------- Float text ----------
  function floatText(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.18;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.55} ${p.z}`,dur:520,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:420,delay:120,easing:'linear'});
    byId('arena')?.appendChild(e);
    setTimeout(()=>safeRemove(e),780);
  }

  // ---------- Game Flow ----------
  function clearArena(){
    const a=byId('arena'); if(!a) return;
    Array.from(a.children).forEach(c=>safeRemove(c));
  }

  function computeSongSettings(){
    // Speed profile
    const selSpeed = (byId('speedSel')?.value || getQ('speed') || 'standard').toLowerCase();
    speedProfile = ['beginner','standard','challenge'].includes(selSpeed) ? selSpeed : 'standard';
    rbSpeedMul = (speedProfile==='beginner')?0.75 : (speedProfile==='challenge')?1.25 : 1.0;

    // Song
    const selSong = (byId('songSel')?.value || getQ('song') || 'club').toLowerCase();
    songKey = ['training','club','rush'].includes(selSong)? selSong : 'club';
    songBPM = (songKey==='training')?100 : (songKey==='rush')?140 : 120;

    // Duration (แบบง่าย)
    durationSec = (songKey==='training')? 55 : (songKey==='rush')? 70 : 60;

    // Spawn interval ตาม BPM (1/2 beat, ช้าสุด 0.28s)
    beatSec = 60 / songBPM;
    spawnInterval = Math.max(beatSec*0.5, 0.28);

    // ตกเริ่มต้น: ช้า แล้วค่อยเร่ง
    fallSpeed = 0.88 * rbSpeedMul;
  }

  function startSpawner(){
    stopSpawner();
    spawnTimer = setInterval(spawnLaneNote, spawnInterval*1000);
  }
  function stopSpawner(){
    if(spawnTimer) clearInterval(spawnTimer), spawnTimer=null;
  }

  function startGame(){
    if(running) return;
    running=true; paused=false; over=false;

    // reset
    score=0; combo=0; maxCombo=0;
    totalNotes=0; hitNotes=0; perfects=0; goods=0; misses=0;
    clearArena();

    // settings
    computeSongSettings();
    startedAt = performance.now();
    updateHUD();

    // fire
    startSpawner();
    requestAnimationFrame(updateFalling);

    // UI
    pingUI('START','#00ffa3');
    if(byId('results')) byId('results').style.display='none';
  }

  function endGame(){
    if(over) return;
    over=true; running=false; stopSpawner();

    // เก็บสถิติ
    const acc = totalNotes? Math.round((hitNotes/totalNotes)*100) : 0;
    const resultsEl = byId('results');
    if(resultsEl){
      // พยายามแมป id ทั่วไป
      const rScore = byId('rScore');
      const rAcc   = byId('rAcc');
      const rCombo = byId('rMaxCombo');
      const rNote  = byId('rNotes');
      const rPerf  = byId('rPerfect');
      const rGood  = byId('rGood');
      const rMiss  = byId('rMiss');
      if(rScore) rScore.textContent = score;
      if(rAcc)   rAcc.textContent   = acc+'%';
      if(rCombo) rCombo.textContent = maxCombo;
      if(rNote)  rNote.textContent  = totalNotes;
      if(rPerf)  rPerf.textContent  = perfects;
      if(rGood)  rGood.textContent  = goods;
      if(rMiss)  rMiss.textContent  = misses;
      resultsEl.style.display='flex';
    }
    play(SFX.success);
    pingUI('RESULTS','#ffd166');
  }

  function togglePause(){
    if(!running || over) return;
    paused=!paused;
    if(paused){
      stopSpawner();
      pingUI('PAUSED','#ffd166');
    }else{
      // resume
      computeSongSettings(); // เผื่อผู้เล่นเปลี่ยนเพลง/สปีดระหว่างพัก
      startSpawner();
      _lastT = performance.now()/1000;
      requestAnimationFrame(updateFalling);
      pingUI('RESUME','#00ffa3');
    }
  }

  // ---------- Pointer Raycast (mouse/touch) ----------
  (function installPointerRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function pick(clientX, clientY){
      const cam = sceneEl.camera;
      if (!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cam);
      const clickable = Array.from(document.querySelectorAll('.clickable'))
        .map(el => el.object3D).filter(Boolean);
      const objects = [];
      clickable.forEach(o => o.traverse(child => objects.push(child)));

      const hits = raycaster.intersectObjects(objects, true);
      if (hits && hits.length){
        let obj = hits[0].object;
        while (obj && !obj.el) obj = obj.parent;
        if (obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', e => pick(e.clientX, e.clientY), {passive:true});
    window.addEventListener('touchstart', e => {
      const t = e.touches && e.touches[0]; if (!t) return;
      pick(t.clientX, t.clientY);
    }, {passive:true});
  })();

  // ---------- Buttons / Wiring ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    // ปุ่ม UI ต้องเป็นปุ่ม HTML ปกติ (DOM) อย่าวางใน a-scene เพื่อให้คลิกได้แน่นอน
    const startBtn = byId('startBtn');
    const pauseBtn = byId('pauseBtn');
    const replayBtn = byId('replayBtn');
    const backBtn = byId('backBtn');

    startBtn?.addEventListener('click', ()=>{ play(SFX.click); startGame(); });
    pauseBtn?.addEventListener('click', ()=>{ play(SFX.click); togglePause(); });
    replayBtn?.addEventListener('click', ()=>{ play(SFX.click); startGame(); });

    backBtn?.addEventListener('click', ()=>{
      play(SFX.click);
      // กลับสู่ Hub (ฐานจาก meta asset-base)
      const hub = `${ASSET_BASE}/vr-fitness/`;
      try{ window.location.href = hub; }catch(_){ location.assign(hub); }
    });

    // ถ้าเปลี่ยนเพลง/ความเร็วขณะพัก ให้รีคอมพิวต์
    byId('songSel')?.addEventListener('change', ()=>{
      if(!running || paused){ computeSongSettings(); pingUI('Song set'); }
    });
    byId('speedSel')?.addEventListener('change', ()=>{
      if(!running || paused){ computeSongSettings(); pingUI('Speed set'); }
    });

    // อัปเดต HUD ตอนแรก
    updateHUD();
  });

  // ---------- iOS audio unlock ----------
  (function unlockAudio(){
    let unlocked=false, ctx = (window.AudioContext||window.webkitAudioContext)? new (window.AudioContext||window.webkitAudioContext)() : null;
    function resume(){
      if(unlocked || !ctx) return;
      ctx.resume?.(); unlocked = ctx.state==='running';
    }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev, resume, {once:true, passive:true}));
  })();

  // ---------- Safety / Fatal UI ----------
  (function bootGuards(){
    function showFatal(msg){
      let o=byId('fatal'); if(!o){ o=document.createElement('div'); o.id='fatal';
        Object.assign(o.style,{position:'fixed',inset:'0',background:'#0b1118',color:'#ffb4b4',
          display:'grid',placeItems:'center',font:'14px/1.5 system-ui',zIndex:99999}); document.body.appendChild(o);}
      o.innerHTML = '<div style="max-width:720px;padding:20px;text-align:center">'+
        '<h2>⚠️ Can’t start VR scene</h2><p>'+msg+'</p>'+
        '<p class="small">Check scripts/CORS/paths and reload.</p></div>';
    }
    let tries=0; (function waitAF(){
      if(window.AFRAME && document.querySelector('a-scene')) return;
      tries++;
      if(tries>120){ showFatal('A-Frame scene not found or failed to load (timeout).'); return; }
      requestAnimationFrame(waitAF);
    })();
    window.addEventListener('error', e=>{
      if(!byId('fatal')) showFatal('JS error: '+(e.message||'unknown'));
    });
    window.addEventListener('beforeunload', ()=>{
      try{ stopSpawner(); }catch(_){}
    });
  })();

})();
