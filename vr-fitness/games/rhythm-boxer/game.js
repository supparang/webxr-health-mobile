/* Rhythm Boxer · Ultra Slow Start + Gentle Ramp + Mouse/Touch Hit */
(function(){
  "use strict";

  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  function ping(msg,color='#ffcc00'){
    const t=$('toast'); if(!t) return;
    t.style.color=color; t.textContent=msg;
    t.style.opacity='1';
    setTimeout(()=>{ t.style.opacity='0'; }, 1000);
  }
  function safeRemove(el){ try{ el?.parentNode?.removeChild(el); }catch(_e){} }

  // ---------- Difficulty (ช้าอย่างเห็นได้ชัด + เร่งช้า ๆ) ----------
  const DIFF = {
    easy:   { spawn:1000, speed:0.58, ramp:1.0000, name:'EASY'   }, // ช้ามาก แทบไม่เร่ง
    normal: { spawn:920,  speed:0.62, ramp:1.0003, name:'NORMAL' }, // ช้า + ค่อยเร่งเล็กน้อย
    hard:   { spawn:850,  speed:0.70, ramp:1.0006, name:'HARD'   }, // ยังช้า แต่เริ่มเร่งขึ้น
    final:  { spawn:780,  speed:0.78, ramp:1.0009, name:'FINAL'  }, // ช้า แล้วค่อย ๆ เร่ง
  };
  function getDiffKey(){
    return new URLSearchParams(location.search).get('diff') ||
           localStorage.getItem('rb_diff') || 'normal';
  }
  let D = DIFF.normal;

  // ---------- Sound ----------
  const SFX = {
    hit: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good: new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`)
  };
  const lastPlay=new Map();
  function play(a,guard=70){
    try{
      const now=performance.now();
      if(lastPlay.get(a)&&now-lastPlay.get(a)<guard)return;
      a.currentTime=0; lastPlay.set(a,now); a.play();
    }catch(_e){}
  }

  // ---------- State ----------
  let running=false, paused=false;
  let score=0, combo=0, maxCombo=0, timeLeft=60;
  let spawnTimer=null, secondTimer=null;
  let speedMul=0.55;                // เริ่ม “ช้ามาก”
  const MAX_SPEED_MUL=1.0;          // ไม่ให้เร็วทะลุไปไกล
  const BASE_DROP=0.0016;           // ค่าคงที่การตกของโน้ต “ช้า” ลง

  function hud(){
    if($('sc')) $('sc').textContent=score;
    if($('cb')) $('cb').textContent=combo;
    if($('tm')) $('tm').textContent=timeLeft;
  }

  // ---------- Judgement (กว้างขึ้น เล่นง่ายช่วงแรก) ----------
  const JUDGE={ perfect:0.14, good:0.30 };
  function judgeAndRemove(root){
    if(!root||!root.parentNode)return;
    const pos=root.getAttribute('position');
    const dy=Math.abs(pos.y-0);
    safeRemove(root);
    if(dy<=JUDGE.perfect){
      combo++; score+=30; play(SFX.hit); ping('PERFECT','#00ffa3');
    }else if(dy<=JUDGE.good){
      combo++; score+=18; play(SFX.good); ping('GOOD','#9bd1ff');
    }else{
      combo=0; play(SFX.miss); ping('MISS','#ff5577');
    }
    if(combo>0&&combo%10===0)play(SFX.combo);
    if(combo>maxCombo)maxCombo=combo;
    hud();
  }

  function onMiss(){ combo=0; play(SFX.miss); hud(); }

  // ---------- Beat ----------
  function makeBeat(lane,y0=0.85,spdMul=1){
    const lanes=$('lanes'); if(!lanes)return;
    const root=document.createElement('a-entity');
    root.classList.add('beat','clickable');
    root.setAttribute('position',`${lane*0.9} ${y0} 0`);
    lanes.appendChild(root);

    const vis=document.createElement('a-sphere');
    vis.setAttribute('radius','0.12');
    vis.setAttribute('color',lane===0?'#7a5cff':(lane<0?'#00d0ff':'#ffd166'));
    root.appendChild(vis);

    // ฮิตบ็อกซ์กว้างขึ้นให้กดโดนง่าย
    const col=document.createElement('a-sphere');
    col.setAttribute('radius','0.28');
    col.setAttribute('material','opacity:0.001;transparent:true;color:#000');
    root.appendChild(col);

    // ความเร็วตกของโน้ต (ช้ามาก + ปรับตาม diff/ramp)
    const spd=BASE_DROP*D.speed*speedMul*spdMul;
    const born=performance.now();

    function step(){
      if(!root.parentNode)return;
      const t=performance.now()-born;
      const y=y0-t*spd;
      root.setAttribute('position',`${lane*0.9} ${y.toFixed(3)} 0`);
      if(y<=-0.82){ safeRemove(root); onMiss(); return; }
      requestAnimationFrame(step);
    }
    root.addEventListener('click',()=>judgeAndRemove(root));
    requestAnimationFrame(step);
  }

  // ---------- Song pattern ----------
  function songScript(song){
    if(song==='rush') return (i)=>makeBeat([-1,0,1][Math.floor(Math.random()*3)]);
    if(song==='boss') return (i)=>makeBeat([0,1,-1][i%3]);
    return (i)=>makeBeat(i%2===0?0:(Math.random()<0.5?-1:1));
  }

  // ---------- Game Flow ----------
  function start(){
    if(running)return;
    const key=$('diffSel')?.value||getDiffKey();
    D=DIFF[key]||DIFF.normal;
    localStorage.setItem('rb_diff',key);

    running=true;paused=false;score=0;combo=0;maxCombo=0;timeLeft=60;
    speedMul=0.55; // reset ให้ช้าเสมอ
    if($('pauseBtn')) $('pauseBtn').disabled=false;
    hud();

    const song=$('songSel')?.value||'intro';
    const chart=songScript(song);
    let spawnIdx=0;

    spawnTimer=setInterval(()=>{
      if(!running||paused)return;
      chart(spawnIdx++);
    },D.spawn);

    secondTimer=setInterval(()=>{
      if(!running||paused)return;
      timeLeft--;
      if(timeLeft<=0){end();return;}
      // เร่ง “ช้ามาก” เพิ่มทุก 5 วินาทีเท่านั้น
      if(timeLeft%5===0){
        speedMul=Math.min(MAX_SPEED_MUL, speedMul*D.ramp);
      }
      hud();
    },1000);

    ping(`START · ${D.name}`);
  }

  function end(){
    running=false;
    clearInterval(spawnTimer); clearInterval(secondTimer);
    spawnTimer=null;secondTimer=null;
    if($('pauseBtn')) $('pauseBtn').disabled=true;
    ping(`RESULT: ${score} · Combo ${maxCombo}`,'#00ffa3');
    const lanes=$('lanes');
    if(lanes) Array.from(lanes.children).forEach(safeRemove);
  }

  function togglePause(){
    if(!running)return;
    paused=!paused;
    ping(paused?'PAUSED':'RESUME',paused?'#ffd166':'#00ffa3');
  }

  // ---------- Controls ----------
  document.addEventListener('DOMContentLoaded',()=>{
    $('startBtn')?.addEventListener('click',start);
    $('pauseBtn')?.addEventListener('click',togglePause);
    $('diffSel')?.addEventListener('change',e=>{
      const v=e.target.value; localStorage.setItem('rb_diff',v);
    });
    $('enterVRBtn')?.addEventListener('click',()=>{
      try{document.querySelector('a-scene')?.enterVR?.();}catch(_){}
    });
  });

  // ---------- Mouse / Touch Raycast ----------
  (function(){
    const scene=document.querySelector('a-scene'); if(!scene)return;
    const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    function pick(x,y){
      const cam=scene.camera;if(!cam)return;
      mouse.x=(x/window.innerWidth)*2-1;
      mouse.y=-(y/window.innerHeight)*2+1;
      ray.setFromCamera(mouse,cam);
      const objs=Array.from(document.querySelectorAll('.clickable'))
        .map(el=>el.object3D).filter(Boolean);
      const all=[]; objs.forEach(o=>o.traverse(c=>all.push(c)));
      const hits=ray.intersectObjects(all,true);
      if(hits.length){
        let o=hits[0].object;
        while(o&&!o.el)o=o.parent;
        o?.el?.emit('click');
      }
    }
    window.addEventListener('pointerdown',e=>pick(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart',e=>{
      const t=e.touches?.[0];if(t)pick(t.clientX,t.clientY);
    }, {passive:true});
  })();

  window.addEventListener('beforeunload',()=>{
    try{clearInterval(spawnTimer);clearInterval(secondTimer);}catch(_){}
  });

})();
