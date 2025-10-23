/* games/rhythm-box/game.js
   Rhythm Box · minimal playable (mouse/touch click fixed, difficulty, HUD, back-to-hub, center Enter VR)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const getQ = (k)=> new URLSearchParams(location.search).get(k);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'') || '';

  // Safe remove (ป้องกัน A-Frame removeChild of null)
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_){} }

  // SFX (ใช้ชุดเดียวกับ Shadow Breaker)
  const SFXN=(p)=>{ const a=new Audio(p); a.onerror=()=>console.warn('SFX not found:',p); return a; };
  const SFX={
    hit:SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good:SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss:SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`),
    success:SFXN(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  const lastPlay=new Map();
  function play(a,guard=90){ try{
    const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guard) return;
    a.currentTime=0; lastPlay.set(a,now); if(a.paused) a.play();
  }catch(_){} }

  // ---------- Difficulty ----------
  const DIFFS = {
    easy:   { bpm:95,  noteLife:1600, spawnLead:1600, scoreMul:0.9, lanes:3,  title:'EASY'   },
    normal: { bpm:120, noteLife:1300, spawnLead:1350, scoreMul:1.0, lanes:4,  title:'NORMAL' },
    hard:   { bpm:140, noteLife:1050, spawnLead:1100, scoreMul:1.1, lanes:4,  title:'HARD'   },
    final:  { bpm:160, noteLife:900,  spawnLead:950,  scoreMul:1.2, lanes:5,  title:'FINAL'  }
  };
  function getDiffKey(){
    const q = getQ('diff');
    const ls = localStorage.getItem('rb_diff');
    return q || ls || 'normal';
  }
  let D = DIFFS.normal;

  // ---------- State ----------
  let running=false, paused=false;
  let songTimer=null, hudTimer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let bank=0;

  // ---------- HUD ----------
  function updateHUD(){
    $('score').textContent = Math.round((score+bank) * D.scoreMul);
    $('combo').textContent = combo;
    $('time').textContent  = timeLeft;
  }
  function onComboChange(){
    $('combo').textContent = combo;
    if(combo>0 && combo%10===0) play(SFX.combo);
    if(combo>maxCombo) maxCombo=combo;
  }
  function floatText(text, color, pos){
    const e=document.createElement('a-entity');
    const p=(pos||new THREE.Vector3(0,1.2,-2.1)).clone(); p.y+=0.15;
    e.setAttribute('text',{value:text,color,align:'center',width:2.4});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:80,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.5} ${p.z}`,dur:520,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:420,delay:120,easing:'linear'});
    $('arena').appendChild(e);
    setTimeout(()=>safeRemove(e),760);
  }

  // ---------- Lanes / Notes ----------
  // Lane positions (X) จะกระจายอัตโนมัติจากจำนวนเลนใน DIFF
  function laneX(i, lanes){
    const width = Math.min(1.8, lanes*0.45);
    const left  = -width/2;
    const step  = width/(lanes-1||1);
    return left + i*step;
  }

  // สร้างโน้ต
  function spawnNote(lane, tHit){
    spawns++;
    const el=document.createElement('a-cylinder');
    el.classList.add('clickable','rb-note');
    el.setAttribute('radius','0.11');
    el.setAttribute('height','0.08');
    el.setAttribute('color','#00d0ff');
    el.setAttribute('position',`${laneX(lane,D.lanes)} 1.3 -2.2`);
    el.dataset.tHit = tHit.toString();

    // move-in (จากด้านหลังเข้ามา)
    const lead = D.spawnLead;
    const startY = 1.8, endY = 1.1;
    el.setAttribute('position',`${laneX(lane,D.lanes)} ${startY} -2.2`);
    $('arena').appendChild(el);

    // Animate by JS (ให้สัมพันธ์กับเวลาปัจจุบัน)
    const born = performance.now();
    const life = D.noteLife;

    function step(){
      if(!el.parentNode) return;
      const now = performance.now();
      const p = Math.min(1, (now-born)/life);
      const y = startY + (endY-startY)*p;
      el.setAttribute('position',`${laneX(lane,D.lanes)} ${y} -2.2`);

      // หมดเวลา = MISS
      if(p>=1){
        miss(el);
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    // คลิก = HIT
    el.addEventListener('click', ()=>{
      if(!el.parentNode) return;
      const pos = el.object3D.getWorldPosition(new THREE.Vector3());
      const now = performance.now();
      const dt = Math.abs(now - tHit); // ความตรงจังหวะ
      let kind='good', pts=20;
      if(dt <= 70){ kind='perfect'; pts=35; play(SFX.hit); floatText('PERFECT','#00ffa3',pos); }
      else if(dt <= 140){ kind='good'; pts=20; play(SFX.good); floatText('GOOD','#9bd1ff',pos); }
      else { kind='late'; pts=10; play(SFX.good); floatText('LATE','#ffd166',pos); }
      score += pts; hits++; combo++; onComboChange();
      safeRemove(el);
      updateHUD();
    });

    // กันกดรัว lane เดียวกัน: ให้ทึบเล็กน้อยตอนเกิด
    el.setAttribute('material','color: #00d0ff; opacity: 0.95; transparent: true');
  }

  function miss(el){
    if(!el || !el.parentNode) return;
    const pos = el.object3D.getWorldPosition(new THREE.Vector3());
    play(SFX.miss);
    combo=0; onComboChange();
    floatText('MISS','#ff5577', pos);
    safeRemove(el);
    updateHUD();
  }

  // ---------- Song generator ----------
  // สร้างลิสต์โน้ตจาก bpm และเวลาทั้งหมด 60s
  function buildChart(){
    const bpm = D.bpm;
    const beat = 60000 / bpm;        // 1 beat (ms)
    const bar  = beat * 4;           // 4/4
    const T = 60000;                 // 60s gameplay
    const chart = [];
    let t = 0;
    // pattern ง่ายๆ: เต้น 8th notes + ใส่สลับเลน
    let i=0;
    while(t < T){
      const lane = (i % D.lanes);
      chart.push({t, lane});
      // เติม off-beat
      chart.push({t: t + beat/2, lane: (lane+1)%D.lanes});
      // เติม accent ทุก 2 บีท
      if(i%2===0) chart.push({t: t + beat*0.75, lane: (lane+2)%D.lanes});
      t += beat;
      i++;
    }
    return chart;
  }

  // ---------- Game flow ----------
  function start(){
    if(running) return;
    const key = getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    localStorage.setItem('rb_diff', key);

    // HUD
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; bank=0;
    $('results').style.display='none';
    updateHUD();
    $('rDiff') && ($('rDiff').textContent = D.title);

    // Clear arena
    Array.from($('arena').children).forEach(c=>safeRemove(c));

    // สร้าง chart & schedule spawn
    const chart = buildChart();
    const startAt = performance.now() + 600; // หน่วงก่อนเริ่มเล็กน้อย
    chart.forEach(n=>{
      const tHit = startAt + n.t;
      const tSpawn = tHit - D.spawnLead; // เกิดก่อนถึงจุดคลิก
      setTimeout(()=> spawnNote(n.lane, tHit), Math.max(0, tSpawn - performance.now()));
    });

    // timer นับเวลาถอยหลัง
    running=true; paused=false;
    songTimer = setInterval(()=>{
      if(paused) return;
      timeLeft--;
      $('time').textContent=timeLeft;
      if(timeLeft<=0){ end(); }
    },1000);

    // tiny HUD refresher
    hudTimer = setInterval(()=>{ if(running && !paused) updateHUD(); }, 500);
  }

  function end(){
    running=false;
    clearInterval(songTimer); clearInterval(hudTimer);
    // เก็บผล
    const acc = spawns ? Math.round((hits/spawns)*100) : 0;
    const finalScore = Math.round((score+bank)*D.scoreMul);
    $('rScore').textContent = finalScore;
    $('rMaxCombo').textContent = maxCombo;
    $('rAcc').textContent = acc + '%';
    $('results').style.display='flex';
    play(SFX.success);
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
  }
  function bankNow(){
    // เก็บคอมโบเป็นคะแนนพิเศษ (ธรรมดาๆ ในเวอร์ชันนี้)
    const add = Math.floor(combo*3);
    bank += add;
    combo = 0;
    onComboChange();
    updateHUD();
  }

  // ---------- Buttons ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    $('startBtn')?.addEventListener('click', start);
    $('replayBtn')?.addEventListener('click', start);
    $('pauseBtn')?.addEventListener('click', togglePause);
    $('bankBtn')?.addEventListener('click', bankNow);

    // กลับ Hub → ใช้ asset-base root (ถูกต้องสำหรับ GitHub Pages)
    $('backBtn')?.addEventListener('click', ()=>{
      location.href = `${ASSET_BASE}/`;
    });

    // ปุ่ม Enter VR (อยู่กลางล่าง)
    if(!document.getElementById('enterVRBtn')){
      const btn=document.createElement('button');
      btn.id='enterVRBtn';
      btn.textContent='Enter VR';
      Object.assign(btn.style,{
        position:'fixed',left:'50%',bottom:'12px',transform:'translateX(-50%)',
        zIndex:10050, padding:'10px 14px', borderRadius:'10px', border:'0',
        background:'#0e2233', color:'#e6f7ff', cursor:'pointer'
      });
      document.body.appendChild(btn);
      btn.addEventListener('click', ()=>{ try{ document.querySelector('a-scene')?.enterVR?.(); }catch(e){ console.warn(e); } });
    }
  });

  // ---------- Pointer Raycast (แก้ปุ่ม/โน้ตคลิกไม่ติดในบางเบราว์เซอร์) ----------
  (function installPointerRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const pt = new THREE.Vector2();

    function pick(clientX, clientY){
      const cam = sceneEl.camera;
      if(!cam) return;
      pt.x =  (clientX / window.innerWidth) * 2 - 1;
      pt.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pt, cam);

      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objs=[]; clickable.forEach(o=>o.traverse(ch=>objs.push(ch)));
      const hits = raycaster.intersectObjects(objs, true);
      if(hits && hits.length){
        let obj=hits[0].object;
        while(obj && !obj.el) obj=obj.parent;
        if(obj && obj.el) obj.el.emit('click');
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{
      const t=e.touches && e.touches[0]; if(!t) return;
      pick(t.clientX,t.clientY);
    }, {passive:true});
  })();

  // ---------- Boot guard ----------
  (function bootGuard(){
    let tries=0;
    (function waitAF(){
      if(window.AFRAME && document.querySelector('a-scene')) return;
      tries++; if(tries>120){
        let o=document.getElementById('fatal'); if(!o){
          o=document.createElement('div'); o.id='fatal';
          Object.assign(o.style,{position:'fixed',inset:'0',background:'#0b1118',color:'#ffb4b4',
            display:'grid',placeItems:'center',font:'14px/1.5 system-ui',zIndex:99999}); document.body.appendChild(o);
        }
        o.innerHTML='<div style="max-width:720px;padding:20px;text-align:center"><h2>⚠️ Can’t start A-Frame</h2><p>ตรวจไฟล์/พาธ แล้วรีโหลดใหม่</p></div>';
        return;
      }
      requestAnimationFrame(waitAF);
    })();
  })();

  // iOS: ปลดล็อกออดิโอครั้งแรก
  (function unlockAudio(){
    let unlocked=false, ctx=(window.AudioContext||window.webkitAudioContext)?new (window.AudioContext||window.webkitAudioContext)():null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked = ctx.state==='running'; }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev, resume, {once:true, passive:true}));
  })();

})();
