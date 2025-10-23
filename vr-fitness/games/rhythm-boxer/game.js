/* games/rhythm-box/game.js
   Rhythm Box · game.js (Hub-back OK + Buttons Clickable + Pointer Raycast + Centered Enter VR)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const getQuery=(k)=> new URLSearchParams(location.search).get(k);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const after=(ms,fn)=> setTimeout(fn,ms);

  // ---------- Difficulty ----------
  function getDiffKey(){
    const q = getQuery('diff');
    const ls = localStorage.getItem('rb_diff');
    return q || ls || 'normal';
  }
  const DIFFS = {
    easy:   { noteInt: 700, feverNeed: 20, scoreMul: 0.9,  title:'EASY'   },
    normal: { noteInt: 550, feverNeed: 25, scoreMul: 1.0,  title:'NORMAL' },
    hard:   { noteInt: 430, feverNeed: 30, scoreMul: 1.1,  title:'HARD'   },
    final:  { noteInt: 360, feverNeed: 35, scoreMul: 1.2,  title:'FINAL'  }
  };
  let D = DIFFS.normal;

  // ---------- State ----------
  let running=false, paused=false, timer=null, spawnTimer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let fever=false, feverT=0;
  let lanes = [-0.9, -0.3, 0.3, 0.9];

  // ---------- SFX ----------
  const SFXN=(p)=>{ const a=new Audio(p); a.onerror=()=>console.warn('SFX not found:',p); return a; };
  const SFX={
    hit:SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good:SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss:SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`),
    fever:SFXN(`${ASSET_BASE}/assets/sfx/enrage.wav`),
    success:SFXN(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  const lastPlay=new Map();
  function play(a,guardMs=90){ try{ const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guardMs) return; a.currentTime=0; lastPlay.set(a,now); if(a.paused) a.play(); }catch(_){} }

  // ---------- HUD ----------
  function updateHUD(){
    byId('score') && (byId('score').textContent = Math.round(score * D.scoreMul));
    byId('combo') && (byId('combo').textContent = combo);
    byId('time')  && (byId('time').textContent  = timeLeft);
  }
  function onComboChange(){
    byId('combo') && (byId('combo').textContent = combo);
    if(combo>0 && combo%10===0){ play(SFX.combo); }
    if(combo>maxCombo) maxCombo=combo;
    if(!fever && combo>=D.feverNeed){ fever=true; feverT=performance.now()+8000; play(SFX.fever); ping('FEVER x1.5','#ffd166'); }
  }
  function ping(text,color='#ffcc00'){
    let el=byId('toast');
    if(!el){
      el=document.createElement('div'); el.id='toast'; document.body.appendChild(el);
      Object.assign(el.style,{position:'fixed', left:'50%', top:'12px', transform:'translateX(-50%)',
        background:'rgba(10,12,16,.9)', color:'#ffcc00', padding:'8px 12px',
        borderRadius:'10px', font:'600 14px/1.1 system-ui,Arial', zIndex:10050, opacity:0, transition:'opacity .15s, transform .15s'});
    }
    el.style.color=color; el.textContent=text; el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.03)';
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) scale(1)'; }, 800);
  }

  // Fever tick
  setInterval(()=>{ if(fever && performance.now()>feverT){ fever=false; ping('Fever End'); } }, 150);

  // ---------- Notes ----------
  function spawnNote(){
    spawns++;
    const lane = lanes[Math.floor(Math.random()*lanes.length)];
    const note=document.createElement('a-entity');
    note.classList.add('clickable','rb-note');
    note.setAttribute('geometry','primitive: box; height:.12; width:.36; depth:.06');
    note.setAttribute('material','color:#00d0ff;opacity:.95;transparent:true');
    note.setAttribute('position',`${lane} 2.2 -2.2`);
    byId('arena').appendChild(note);

    // กดโดน
    let hit=false;
    note.addEventListener('click', ()=>{
      if(hit) return; hit=true;
      const p=note.object3D.getWorldPosition(new THREE.Vector3());
      const y = p.y;
      const kind = (y>0.95 && y<1.15) ? 'perfect' : (y>0.85 && y<1.25 ? 'good' : 'bad');
      handleHit(note, kind, p);
    });

    // ตกลงมาที่โซน Hit
    const T = 1200; // ms
    const start=performance.now();
    (function step(){
      if(!note.parentNode) return;
      const t=(performance.now()-start)/T;
      const y = 2.2 - t*1.6; // 2.2 -> ~0.6
      note.setAttribute('position',`${lane} ${y.toFixed(3)} -2.2`);
      if(t>=1){ // ตกผ่านโซนแล้ว
        if(note.parentNode){ miss(note); }
        return;
      }
      requestAnimationFrame(step);
    })();
  }

  function floatText(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.18;
    e.setAttribute('text',{value:text,color,align:'center',width:2.4});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:80,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.5} ${p.z}`,dur:550,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:460,delay:140,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(()=>{ try{e.remove();}catch(_e){} },780);
  }

  function handleHit(note, kind, pos){
    try{ note.remove(); }catch(_){}
    let base=0;
    if(kind==='perfect'){ base=20; play(SFX.hit); floatText('PERFECT','#00ffa3',pos); }
    else if(kind==='good'){ base=12; play(SFX.good); floatText('GOOD','#00d0ff',pos); }
    else { base=4;  play(SFX.good); floatText('LATE','#9bd1ff',pos); }
    if(fever) base = Math.round(base*1.5);
    score += base; hits++; combo++; onComboChange(); updateHUD();
  }

  function miss(note){
    try{ note.remove(); }catch(_){}
    play(SFX.miss);
    combo=0; onComboChange(); updateHUD();
  }

  // ---------- Game flow ----------
  function clearArena(){ const a=byId('arena'); Array.from(a.children).forEach(c=>{ try{c.remove();}catch(_e){} }); }
  function start(){
    if(running) return;
    const key = getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    localStorage.setItem('rb_diff', key);
    reset(); running=true;
    spawnTimer=setInterval(spawnNote, Math.max(260, D.noteInt));
    timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
  }
  function reset(){
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; fever=false; feverT=0;
    updateHUD(); byId('results').style.display='none'; clearArena();
  }
  function end(){
    running=false; clearInterval(timer); clearInterval(spawnTimer);
    const finalScore = Math.round(score * D.scoreMul);
    byId('rScore').textContent=finalScore; byId('rMaxCombo').textContent=maxCombo; byId('rAcc').textContent=spawns? Math.round((hits/spawns)*100)+'%':'0%';
    byId('rDiff').textContent=(D?.title||'NORMAL');
    byId('results').style.display='flex';
    try{ window.Leaderboard?.postResult?.('rhythm-box',{score:finalScore,maxCombo,accuracy:spawns?Math.round((hits/spawns)*100):0,diff:getDiffKey()}); }catch(_e){}
  }
  function togglePause(){
    if(!running) return;
    paused=!paused;
    const pause = ()=>{ clearInterval(timer); clearInterval(spawnTimer); ping('PAUSED','#ffd166'); };
    const resume= ()=>{ timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
                        spawnTimer=setInterval(spawnNote, Math.max(260, D.noteInt)); ping('RESUME','#00ffa3'); };
    paused ? pause() : resume();
  }
  function bankNow(){
    // Rhythm Box: แปลงคอมโบเป็นคะแนน + รีเซ็ตคอมโบ (แนวเดียวกับ Shadow Breaker)
    const add = Math.floor(combo*3);
    score += add; combo=0; updateHUD();
    ping('Bank +'+add, '#ffd166');
  }

  // ---------- Buttons (DOM ต้องกดได้ชัวร์) ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    // ปรับปุ่มลอยให้คลิกได้แน่นอน
    const uiDock = byId('uiDock');
    if (uiDock){
      Object.assign(uiDock.style, {position:'fixed', bottom:'12px', left:'12px', display:'flex', gap:'8px',
        zIndex: 10040, pointerEvents:'auto'});
    }

    byId('startBtn')?.addEventListener('click', start, {passive:true});
    byId('pauseBtn')?.addEventListener('click', togglePause, {passive:true});
    byId('bankBtn')?.addEventListener('click', bankNow, {passive:true});
    byId('replayBtn')?.addEventListener('click', start, {passive:true});
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = `${ASSET_BASE}/`; }, {passive:true});
  });

  // ---------- Pointer Raycast (เมาส์/ทัช กดวัตถุ 3D ได้แน่) ----------
  (function installPointerRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const pt = new THREE.Vector2();

    function pick(clientX, clientY){
      const cam = sceneEl.camera;
      if (!cam) return;
      pt.x =  (clientX / window.innerWidth) * 2 - 1;
      pt.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pt, cam);

      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objects=[]; clickable.forEach(o=>o.traverse(child=>objects.push(child)));
      const hits = raycaster.intersectObjects(objects, true);
      if (hits && hits.length){
        let obj = hits[0].object;
        while (obj && !obj.el) obj = obj.parent;
        if (obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX, e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches?.[0]; if(!t) return; pick(t.clientX, t.clientY); }, {passive:true});
  })();

  // ---------- Enter VR (กลางล่าง) ----------
  (function vrButton(){
    if (document.getElementById('enterVRBtn')) return;
    const btn=document.createElement('button');
    btn.id='enterVRBtn';
    btn.textContent='Enter VR';
    Object.assign(btn.style,{
      position:'fixed', left:'50%', transform:'translateX(-50%)',
      bottom:'12px', zIndex:10030, padding:'8px 12px',
      borderRadius:'10px', border:'0', background:'#0e2233', color:'#e6f7ff', cursor:'pointer'
    });
    document.body.appendChild(btn);
    btn.addEventListener('click', ()=>{ try{ const sc=document.querySelector('a-scene'); sc?.enterVR?.(); }catch(e){ console.warn(e); } });
  })();

  // ---------- Safety ----------
  window.addEventListener('beforeunload', ()=>{ try{ clearInterval(timer); clearInterval(spawnTimer); }catch(_e){} });

  // ---------- Keyboard helpers ----------
  document.addEventListener('keydown', (e)=>{
    if(e.key==='p' || e.key==='P') togglePause();
    if(e.key==='b' || e.key==='B') bankNow();
    if(e.key==='`'){ const d=byId('dbg')||Object.assign(document.body.appendChild(document.createElement('div')), {id:'dbg'}); d.textContent=`Score:${score}|Combo:${combo}|Time:${timeLeft}|Fever:${fever?'Y':'N'}`; Object.assign(d.style,{position:'fixed',left:'12px',bottom:'54px',background:'rgba(0,0,0,.6)',color:'#0ff',padding:'6px 10px',borderRadius:'8px',font:'12px monospace',zIndex:10020}); }
  });

})();
