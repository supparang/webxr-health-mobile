/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Speed Profiles + Mouse/Touch Click + Safe DOM + Gradual Ramp)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const q = (sel)=>document.querySelector(sel);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const getQ = (k)=> new URLSearchParams(location.search).get(k);
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

  // UI ping
  function toast(msg, color='#ffd166'){
    let el = $('rb_toast');
    if(!el){
      el = document.createElement('div'); el.id='rb_toast';
      Object.assign(el.style,{position:'fixed',left:'50%',top:'12px',transform:'translateX(-50%)',
        background:'rgba(10,16,24,.9)',color:color,padding:'8px 12px',borderRadius:'10px',
        font:'600 13px system-ui',zIndex:9999,opacity:'0',transition:'opacity .2s, transform .2s'});
      document.body.appendChild(el);
    }
    el.style.color=color; el.textContent=msg; el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) scale(1)'; }, 900);
  }

  // ---------- Speed Profiles ----------
  // ตั้งค่าพฤติกรรมความเร็วตามโปรไฟล์
  const SPEED_PROFILES = {
    beginner : { title:'Beginner',  speedMul:0.45, ramp:1.00025, MAX_SPEED_MUL:0.80 },
    standard : { title:'Standard',  speedMul:0.55, ramp:1.00055, MAX_SPEED_MUL:0.95 },
    challenge: { title:'Challenge', speedMul:0.65, ramp:1.00120, MAX_SPEED_MUL:1.10 }
  };
  let SPEED = SPEED_PROFILES.standard;

  function applySpeedProfile(key){
    SPEED = SPEED_PROFILES[key] || SPEED_PROFILES.standard;
    try{ localStorage.setItem('rb_speed', key); }catch(_e){}
    toast('Speed: '+SPEED.title, '#9bd1ff');
  }

  // อ่านจาก URL ?speed= หรือ localStorage
  (function bootSpeed(){
    const urlSpeed = (getQ('speed')||'').toLowerCase();
    const saved = (localStorage.getItem('rb_speed')||'').toLowerCase();
    const pick = urlSpeed || saved || 'standard';
    applySpeedProfile(pick);
  })();

  // ---------- SFX ----------
  const SFXN=(p)=>{ const a=new Audio(p); a.onerror=()=>console.warn('SFX not found:',p); return a; };
  const SFX={
    hit:SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    whoosh:SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    ready:SFXN(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  function play(a){ try{ a.currentTime=0; a.play(); }catch(_e){} }

  // ---------- Game State ----------
  let running=false, paused=false;
  let timer=null, spawnTimer=null, rampTimer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=90;
  let speedMul = SPEED.speedMul;      // ตัวคูณความเร็วเริ่มต้น (ตกช้า/เร็ว)
  let MAX_SPEED_MUL = SPEED.MAX_SPEED_MUL;
  let ramp = SPEED.ramp;              // เร่งความเร็วทีละนิด
  const NOTE_BASE_INTERVAL = 920;     // ยิ่งสูงยิ่งช้า (ms)

  // ---------- Hands (วัดความเร็วเคลื่อนไหว) ----------
  AFRAME.registerComponent('rb-hand',{
    schema:{speed:{type:'number',default:0}},
    init(){ this.prev=null; this.prevT=performance.now(); this.vel=new THREE.Vector3(); },
    tick(){
      const p=this.el.object3D.getWorldPosition(new THREE.Vector3()), now=performance.now();
      if(this.prev){
        const dt=(now-this.prevT)/1000;
        if(dt>0){
          this.vel.set((p.x-this.prev.x)/dt,(p.y-this.prev.y)/dt,(p.z-this.prev.z)/dt);
          this.data.speed=this.vel.length();
        }
      }
      this.prev=p.clone(); this.prevT=now;
    }
  });

  // ---------- Targets ----------
  const HIT_R=0.42, HIT_R_PERF=0.30, SPEED_GOOD=1.2, SPEED_PERF=2.0;

  function spawnNote(){
    spawns++;
    const el=document.createElement('a-sphere');
    const x=(Math.random()*3.0-1.5).toFixed(2);
    const y=(Math.random()*1.4 + 1.0).toFixed(2);
    const z=(-2.2 - Math.random()*0.6).toFixed(2);
    el.classList.add('rb-note','clickable');
    el.setAttribute('radius','0.12');
    el.setAttribute('color','#7ae1ff');
    el.setAttribute('position',`${x} ${y} ${z}`);
    // อายุโน้ต (ยิ่งเร็ว ยิ่งอายุน้อย)
    const life = Math.max(850, NOTE_BASE_INTERVAL * (1.0/speedMul));
    el.dataset.expire = (performance.now() + life).toString();
    $('arena').appendChild(el);

    // คลิก/แตะ
    el.addEventListener('click', ()=>{
      registerHit(el, 'laser');
    });
  }

  function registerHit(target, method){
    if(!target || !target.parentNode) return;
    const pos = target.object3D.getWorldPosition(new THREE.Vector3());
    safeRemove(target);
    combo++;
    if(combo>maxCombo) maxCombo=combo;
    hits++;
    let base = (method==='laser') ? 12 : 10;
    score += base;
    updateHUD();
    play(SFX.hit);
    floatText('HIT','#00ffa3', pos);
  }

  function miss(target){
    if(target && target.parentNode){
      const pos = target.object3D.getWorldPosition(new THREE.Vector3());
      safeRemove(target);
      combo=0; play(SFX.miss); floatText('MISS','#ff5577', pos); updateHUD();
    }else{
      combo=0; updateHUD();
    }
  }

  // ตรวจจับด้วยมือ (ตีโดยไม่ต้องคลิก)
  function checkHandHits(){
    if(!running) return;
    const arena = $('arena');
    const notes = Array.from(arena.querySelectorAll('.rb-note'));
    if(notes.length===0) return;

    const lh=$('leftHand'), rh=$('rightHand');
    const lc=lh?.components['rb-hand'], rc=rh?.components['rb-hand'];
    const ls=lc?.data?.speed||0, rs=rc?.data?.speed||0;
    const lv=lc?.vel||new THREE.Vector3(), rv=rc?.vel||new THREE.Vector3();
    const lp=lh?.object3D.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();
    const rp=rh?.object3D.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();

    for(const n of notes){
      if(!n.getAttribute('visible')) continue;
      const pos=n.object3D.getWorldPosition(new THREE.Vector3());
      const dl=lp.distanceTo(pos), dr=rp.distanceTo(pos);
      if(ls>=SPEED_GOOD && dl<=HIT_R){ registerHit(n,'slash'); continue; }
      if(rs>=SPEED_GOOD && dr<=HIT_R){ registerHit(n,'slash'); continue; }
      // หมดอายุ = MISS
      if(performance.now() > (+n.dataset.expire || 0)){ miss(n); }
    }
  }
  AFRAME.registerSystem('rb-loop',{tick(){ checkHandHits(); }});

  // ---------- Float text ----------
  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.22;
    e.setAttribute('text',{value:text,color,align:'center',width:2.2});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.5} ${p.z}`,dur:560,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:420,delay:160,easing:'linear'});
    $('arena').appendChild(e); setTimeout(()=>safeRemove(e),820);
  }
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode){ el.parentNode.removeChild(el); } else if(el.remove){ el.remove(); } }catch(_e){} }

  // ---------- Game flow ----------
  function updateHUD(){
    $('score').textContent = score;
    $('combo').textContent = combo;
    $('time').textContent  = timeLeft;
  }

  function clearArena(){
    const a=$('arena');
    Array.from(a.children).forEach(ch=>safeRemove(ch));
  }

  function start(){
    if(running) return;
    // sync โปรไฟล์ล่าสุดจาก select (ถ้าเปลี่ยน)
    const sel = $('speedSel');
    if(sel){ applySpeedProfile(sel.value); }

    running=true; paused=false;
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=90;
    speedMul = SPEED.speedMul;
    MAX_SPEED_MUL = SPEED.MAX_SPEED_MUL;
    ramp = SPEED.ramp;

    clearArena(); updateHUD(); play(SFX.ready);

    // spawn
    spawnTimer = setInterval(spawnNote, Math.max(520, NOTE_BASE_INTERVAL * (1.0/speedMul)));
    // timer
    timer = setInterval(()=>{
      if(!paused){
        timeLeft--;
        $('time').textContent=timeLeft;
        if(timeLeft<=0){ end(); }
      }
    },1000);

    // เร่งความเร็วทีละน้อย ทุก 5 วินาที
    rampTimer = setInterval(()=>{
      if(!paused){
        speedMul = clamp(speedMul*ramp, 0.35, MAX_SPEED_MUL);
      }
    }, 5000);
  }

  function end(){
    running=false;
    try{ clearInterval(timer); clearInterval(spawnTimer); clearInterval(rampTimer); }catch(_){}
    // สรุปผล
    const acc = spawns? Math.round((hits/spawns)*100) : 0;
    $('rScore').textContent = score;
    $('rMaxCombo').textContent = maxCombo;
    $('rAcc').textContent = acc + '%';
    $('results').style.display='flex';
    // บันทึกลีดเดอร์บอร์ด (ถ้ามี)
    try{ window.Leaderboard?.postResult?.('rhythm-boxer',{score,maxCombo,accuracy:acc,speed:SPEED.title}); }catch(_){}
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    toast(paused?'PAUSED':'RESUMED', paused?'#ffd166':'#00ffa3');
  }

  // ---------- Pointer (mouse/touch) raycast คลิกเป้าหมาย ----------
  (function pointerRay(){
    const scene = q('a-scene');
    if(!scene) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function pick(clientX, clientY){
      const cam = scene.camera; if(!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);
      const clickable = Array.from(document.querySelectorAll('.clickable'))
        .map(el => el.object3D).filter(Boolean);
      const objs = []; clickable.forEach(o=>o.traverse(ch=>objs.push(ch)));
      const hits = raycaster.intersectObjects(objs, true);
      if(hits && hits.length){
        let obj = hits[0].object;
        while(obj && !obj.el) obj = obj.parent;
        if(obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX, e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{
      const t=e.touches && e.touches[0]; if(!t) return;
      pick(t.clientX, t.clientY);
    }, {passive:true});
  })();

  // ---------- Mouse move -> ขยับมือขวา (เดสก์ท็อป) ----------
  document.addEventListener('mousemove', e=>{
    const x=(e.clientX/window.innerWidth - .5)*3.0;
    const y=(1 - e.clientY/window.innerHeight)*2 + .6;
    const h=$('rightHand'); if(h) h.setAttribute('position', `${x.toFixed(2)} ${y.toFixed(2)} -1`);
  }, {passive:true});

  // ---------- DOM bindings ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    $('startBtn')?.addEventListener('click', start);
    $('replayBtn')?.addEventListener('click', ()=>{ $('results').style.display='none'; start(); });
    $('pauseBtn')?.addEventListener('click', togglePause);

    // กลับ Hub
    $('backBtn')?.addEventListener('click', ()=>{
      // กลับหน้า Hub root ตามโครงโปรเจกต์
      window.location.href = `${ASSET_BASE}/vr-fitness/`;
    });

    // เลือกเพลง: ยังไม่ผูกเสียงจริง (placeholder)
    $('songSel')?.addEventListener('change', ()=>{
      toast('Song: '+$('songSel').value, '#e6f7ff');
    });

    // เลือก Speed Profile
    const speedSel = $('speedSel');
    if(speedSel){
      // set ค่าเริ่มจาก URL/LS
      const saved = (localStorage.getItem('rb_speed')||'standard');
      if(['beginner','standard','challenge'].includes(saved)) speedSel.value = saved;
      speedSel.addEventListener('change', ()=>{
        applySpeedProfile(speedSel.value);
      });
    }

    // Enter VR (กลางล่าง)
    $('enterVRBtn')?.addEventListener('click', ()=>{
      try{ q('a-scene')?.enterVR?.(); }catch(e){ console.warn(e); }
    });
  });

  // ---------- Safety / cleanup ----------
  window.addEventListener('beforeunload', ()=>{
    try{ clearInterval(timer); clearInterval(spawnTimer); clearInterval(rampTimer); }catch(_){}
  });

})();
