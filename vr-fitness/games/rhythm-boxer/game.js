/* games/rhythm-boxer/game.js
   Rhythm Boxer · mouse/touch click fix + Start/Pause near Song + Enter VR center + difficulties
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const getQ = (k)=> new URLSearchParams(location.search).get(k);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  // Safe remove
  function safeRemove(el){
    try{ if(!el) return; if(!el.isConnected && !el.parentNode) return;
      if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.();
    }catch(_){}
  }

  // RNG
  let seed = 1234567;
  function rnd(){ seed=(seed*1664525+1013904223)>>>0; return (seed & 0x7fffffff)/0x80000000; }

  // ---------- Difficulty ----------
  const DIFFS = {
    easy:   { speed:0.85, len:55, spawn:680, scoreMul:0.9,  title:'EASY'   },
    normal: { speed:1.00, len:60, spawn:600, scoreMul:1.0,  title:'NORMAL' },
    hard:   { speed:1.15, len:70, spawn:520, scoreMul:1.1,  title:'HARD'   },
    final:  { speed:1.28, len:80, spawn:470, scoreMul:1.2,  title:'FINAL'  }
  };
  function getDiffKey(){
    return getQ('diff') || localStorage.getItem('rb_diff') || 'normal';
  }
  let D = DIFFS.normal;

  // ---------- SFX ----------
  const SFX = {
    hit: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good: new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    start: new Audio(`${ASSET_BASE}/assets/sfx/enrage.wav`)
  };
  const lastPlay=new Map();
  function play(a,guard=90){ try{
    const now = performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guard) return;
    a.currentTime=0; lastPlay.set(a,now); a.play();
  }catch(e){} }

  // ---------- State ----------
  let running=false, paused=false, timer=null, spawner=null;
  let score=0, combo=0, maxCombo=0, hits=0, total=0, timeLeft=60;
  let songKey = 'neo-run';

  function updateHUD(){
    $('score').textContent = Math.round(score*D.scoreMul);
    $('combo').textContent = combo;
    $('time').textContent = timeLeft;
  }
  function addScore(v){
    score += v; if(combo>maxCombo) maxCombo=combo; updateHUD();
  }

  // ---------- Beat objects ----------
  function makeBeat(lane){ // lane: -1,0,1
    const e=document.createElement('a-sphere');
    e.classList.add('beat','clickable');
    e.setAttribute('radius','0.12');
    e.setAttribute('color', lane===0?'#7a5cff':(lane<0?'#00d0ff':'#ffd166'));
    e.setAttribute('position', `${lane*0.9} 0.75 0`);
    $('lanes').appendChild(e);
    const spd = 0.0032 * D.speed; // world units per ms (ลงด้านล่าง)
    const born = performance.now();

    function step(){
      if(!e.parentNode) return;
      const t=performance.now()-born;
      const y = 0.75 - t*spd; // เคลื่อนลง
      e.setAttribute('position', `${lane*0.9} ${y.toFixed(3)} 0`);
      if (y <= -0.78){ // ถึงเส้น target
        safeRemove(e);
        onMiss();
        return;
      }
      requestAnimationFrame(step);
    }
    e.addEventListener('click', ()=>judgeAndRemove(e));
    requestAnimationFrame(step);
  }

  function judgeAndRemove(e){
    if(!e || !e.parentNode) return;
    // ตัดสินจากระยะห่างจากเส้น target (y=-0.78)
    const p = e.object3D.getWorldPosition(new THREE.Vector3());
    const dy = Math.abs(p.y - ( $('lanes').object3D.getWorldPosition(new THREE.Vector3()).y - 0.78 ));
    safeRemove(e);
    if (dy < 0.05){ // perfect
      combo++; play(SFX.hit); addScore(30);
      spawnFloat('PERFECT', '#00ffa3', p);
    } else if (dy < 0.12){
      combo++; play(SFX.good); addScore(18);
      spawnFloat('GOOD', '#9bd1ff', p);
    } else {
      onMiss();
    }
    hits++; // hit ที่กดได้
    updateHUD();
    if(combo>0 && combo%10===0) play(SFX.combo);
  }

  function onMiss(){
    combo=0; play(SFX.miss);
    spawnFloat('MISS','#ff5577', new THREE.Vector3(0,0.42,-2.2));
    updateHUD();
  }

  function spawnFloat(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone();
    e.setAttribute('text',{value:text,color,align:'center',width:2.2});
    e.setAttribute('position',`${p.x} ${Math.max(0.1,p.y)} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.5} ${p.z}`,dur:520,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:430,delay:120,easing:'linear'});
    $('arena').appendChild(e); setTimeout(()=>safeRemove(e),760);
  }

  // ---------- Song / pattern ----------
  const SONGS = {
    'tutorial': (i)=> (i%3)-1, // -1,0,1 วน
    'neo-run' : (i)=> (i%2===0? 0 : (rnd()<0.5?-1:1)),
    'skyline' : (i)=> (rnd()<0.33? -1 : (rnd()<0.66? 0 : 1)),
    'rush'    : (i)=> (i%4===0? -1 : (i%4===1? 0 : (i%4===2? 1 : (rnd()<0.5?-1:1))))
  };

  function loadSong(key){
    songKey = SONGS[key] ? key : 'neo-run';
    $('rSong').textContent = songKey;
  }

  // ---------- Game flow ----------
  function startGame(){
    if(running) return;
    // diff
    const dk = $('diffSel')?.value || getDiffKey();
    D = DIFFS[dk] || DIFFS.normal;
    localStorage.setItem('rb_diff', dk);

    // song
    const sk = $('songSel')?.value || getQ('song') || 'neo-run';
    loadSong(sk);

    reset();
    running=true; paused=false;
    play(SFX.start);

    spawner = setInterval(()=>{
      if(!running || paused) return;
      const idx = total;
      const lane = SONGS[songKey](idx); // -1,0,1
      makeBeat(lane);
      total++;
    }, Math.max(320, D.spawn));

    timer = setInterval(()=>{
      if(!running || paused) return;
      timeLeft--; $('time').textContent=timeLeft;
      if(timeLeft<=0){ end(); }
    }, 1000);
  }

  function reset(){
    score=0; combo=0; maxCombo=0; hits=0; total=0; timeLeft=D.len;
    $('results').style.display='none';
    // ล้างบีตที่ค้าง
    try{
      const arena = $('lanes');
      Array.from(arena.querySelectorAll('.beat')).forEach(safeRemove);
    }catch(_){}
    updateHUD();
  }

  function end(){
    running=false; paused=false;
    try{ clearInterval(spawner); }catch(_){}
    try{ clearInterval(timer); }catch(_){}
    // คำนวณ accuracy
    const acc = total? Math.round((hits/total)*100) : 0;
    $('rScore').textContent = Math.round(score*D.scoreMul);
    $('rMaxCombo').textContent = maxCombo;
    $('rAcc').textContent = acc+'%';
    $('results').style.display='flex';
    try{ window.Leaderboard?.postResult?.('rhythm-boxer',{
      score:Math.round(score*D.scoreMul),
      maxCombo, accuracy:acc, diff:getDiffKey(), song:songKey
    }); }catch(_){}
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
  }

  // ---------- Pointer Raycast (เมาส์/ทัชให้คลิกได้ทุกเบราว์เซอร์) ----------
  (function pointerRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function pick(clientX, clientY){
      const cam = sceneEl.camera; if(!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cam);
      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objects = [];
      clickable.forEach(o=>o.traverse(child=>objects.push(child)));

      const hits = raycaster.intersectObjects(objects, true);
      if(hits && hits.length){
        let obj = hits[0].object;
        while (obj && !obj.el) obj = obj.parent;
        if (obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX, e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches&&e.touches[0]; if(!t) return; pick(t.clientX, t.clientY); }, {passive:true});
  })();

  // ---------- Controls wiring ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    $('startBtn')?.addEventListener('click', startGame);
    $('pauseBtn')?.addEventListener('click', togglePause);
    $('replayBtn')?.addEventListener('click', startGame);
    $('backBtn')?.addEventListener('click', ()=>{
      // กลับ Hub ที่ถูกต้อง
      const base = ASSET_BASE || '/webxr-health-mobile/vr-fitness';
      location.href = `${base}/`;
    });
    $('songSel')?.addEventListener('change', (e)=> loadSong(e.target.value));
    $('diffSel')?.addEventListener('change', (e)=>{
      const v=e.target.value; localStorage.setItem('rb_diff', v);
      const url = new URL(location.href);
      url.searchParams.set('diff', v);
      history.replaceState(null,'', url.pathname + '?' + url.searchParams.toString());
    });
    $('enterVRBtn')?.addEventListener('click', ()=>{
      try{ document.querySelector('a-scene')?.enterVR?.(); }catch(e){ console.warn(e); }
    });
  });

  // ---------- Mouse-hand follow (เดสก์ท็อป) ----------
  document.addEventListener('mousemove', e=>{
    const x=(e.clientX/window.innerWidth - .5)*3.2;
    const y=(1 - e.clientY/window.innerHeight)*2 + .6;
    const h=$('rightHand'); if(h) h.setAttribute('position', `${x.toFixed(2)} ${y.toFixed(2)} -1`);
  }, {passive:true});

  // ---------- Boot guard ----------
  (function bootGuard(){
    let tries=0; (function waitAF(){
      if(window.AFRAME && document.querySelector('a-scene')) return;
      tries++; if(tries>180){
        const m='A-Frame scene not found or failed to load (timeout).';
        let o=document.getElementById('fatal'); if(!o){ o=document.createElement('div'); o.id='fatal';
          Object.assign(o.style,{position:'fixed',inset:'0',background:'#0b1118',color:'#ffb4b4',
            display:'grid',placeItems:'center',font:'14px/1.5 system-ui',zIndex:99999}); document.body.appendChild(o);}
        o.innerHTML='<div style="max-width:720px;padding:20px;text-align:center"><h2>⚠️ Can’t start VR scene</h2><p>'+m+'</p></div>';
        return;
      }
      requestAnimationFrame(waitAF);
    })();
    window.addEventListener('beforeunload', ()=>{
      try{ clearInterval(timer); clearInterval(spawner); }catch(_){}
    });
  })();

})();
