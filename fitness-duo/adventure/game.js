(function(){
  const root=document.getElementById('root'), hud=document.getElementById('hud'), skyEl=document.getElementById('sky');
  const btnStart=document.getElementById('btnStart'), btnPause=document.getElementById('btnPause'), btnResume=document.getElementById('btnResume'), btnReset=document.getElementById('btnReset'), statusEl=document.getElementById('status');
  let paused=false,pauseAt=0,pauseAccum=0;
  function pauseGame(){ if(paused) return; paused=true; pauseAt=performance.now()/1000; }
  function resumeGame(){ if(!paused) return; const now=performance.now()/1000; pauseAccum+=now-pauseAt; paused=false; }
  function showFirstTimeOverlay(key,msg){ if(localStorage.getItem(key)) return; const d=document.createElement('div'); d.style.cssText='position:fixed;inset:0;background:rgba(5,10,20,.72);z-index:9999;display:flex;align-items:center;justify-content:center;color:#e2e8f0;font:16px system-ui;text-align:center';
    d.innerHTML='<div style="max-width:620px;background:#0f172a;border:1px solid #334155;border-radius:14px;padding:18px"><h3 style="margin:0 0 10px">วิธีเล่น (สั้น ๆ)</h3><div style="opacity:.92;line-height:1.45">'+msg+'</div><button id="ok" style="margin-top:14px;background:#1e293b;border:1px solid #334155;color:#fff;border-radius:10px;padding:8px 14px;cursor:pointer">เริ่มเลย</button></div>';
    document.body.appendChild(d); const bye=()=>{localStorage.setItem(key,'1'); d.remove();}; d.querySelector('#ok').onclick=bye; d.addEventListener('click',e=>{if(e.target===d) bye();}); }
  function candidatePaths(file){ return ['../assets/backgrounds/'+file,'./assets/backgrounds/'+file,'/webxr-health-mobile/fitness-duo/assets/backgrounds/'+file,'/fitness-duo/assets/backgrounds/'+file]; }
  function probeImg(u){return new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(u); i.onerror=()=>rej(u); i.src=u+'?v='+Date.now();});}
  async function findFirstOK(file){ for(const u of candidatePaths(file)){ try{ await probeImg(u); return u;}catch(e){} } throw new Error('bg not found'); }
  async function swapSky(theme){ const file=theme==='space'?'space_sky.jpg':theme==='city'?'city_sky.jpg':'jungle_sky.jpg'; const id='bg-'+theme;
    try{ const scene=document.querySelector('a-scene'); if(scene && !scene.hasLoaded) await new Promise(r=>scene.addEventListener('loaded',r,{once:true}));
      const url=await findFirstOK(file); let assets=document.querySelector('a-assets'); if(!assets){ assets=document.createElement('a-assets'); document.querySelector('a-scene').appendChild(assets); }
      const img=document.createElement('img'); img.id=id; img.src=url+'?v='+Date.now(); assets.appendChild(img); skyEl.setAttribute('src','#'+id); statusEl.textContent='Sky OK • '+theme; }catch(e){ skyEl.removeAttribute('src'); statusEl.textContent='Sky Fallback • '+theme; } }
  function themeCfg(n){ return n==='space'?{lane:['#7c3aed','#334155','#06b6d4'],bg:'#050914'}:n==='city'?{lane:['#0ea5e9','#334155','#22c55e'],bg:'#0b1220'}:{lane:['#14532d','#334155','#166534'],bg:'#0b1220'}; }
  function laneX(i){ return [-1.2,0,1.2][i]; }
  let THEME='jungle', Theme=themeCfg('jungle');
  let running=false,raf=0,t0=0,elapsed=0,lane=1,score=0,lives=3,combo=0,best=0,duration=60,tutorial=true,tutEndAt=8;
  const items=[];
  let actx=null, master=null; function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; actx=new AC(); master=actx.createGain(); master.gain.value=0.16; master.connect(actx.destination); }
  function beep(f=740,d=0.05,g=0.18,tp='square'){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain(); o.type=tp; o.frequency.value=f; o.connect(v); v.connect(master); const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d); o.start(t); o.stop(t+d+0.02); }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>{ ensureAudio(); window.__audioUnlocked=true; },{once:true,capture:true}));
  function buildLaneUI(){ [...root.children].forEach(k=>k.remove()); const colors=Theme.lane;
    [-1.2,0,1.2].forEach((x,i)=>{ const bg=document.createElement('a-entity'); bg.setAttribute('geometry','primitive:plane; width:1.05; height:1.35'); bg.setAttribute('material','color:'+colors[i]+'; opacity:0.18; shader:flat'); bg.setAttribute('position',x+' 0 0.02'); root.appendChild(bg);
      const tag=document.createElement('a-entity'); tag.setAttribute('text','value:'+['ซ้าย','กลาง','ขวา'][i]+' ('+['A/←','S/↑','D/→'][i]+'); width:2.4; align:center; color:#9fb1d1'); tag.setAttribute('position',x+' -0.75 0.05'); root.appendChild(tag); });
    const hit=document.createElement('a-entity'); hit.setAttribute('geometry','primitive:ring; radiusInner:0.06; radiusOuter:0.08; segmentsTheta:64'); hit.setAttribute('material','color:#93c5fd; opacity:0.98; shader:flat'); hit.setAttribute('position','0 0 0.06'); hit.setAttribute('animation__pulse','property: scale; to:1.08 1.08 1; dir:alternate; dur:460; loop:true'); root.appendChild(hit); }
  function setHUD(msg){ hud.setAttribute('text','value:['+THEME.toUpperCase()+'] Score '+score+' • Lives '+lives+' • Combo '+combo+' (Best '+best+')\nเก็บ: เขียว/ทอง • หลบ: แดง\n'+(msg||'')+'; width:5.8; align:center; color:#e2e8f0'); }
  function toast(txt,color='#7dfcc6',y=0.98,ms=560){ const t=document.createElement('a-entity'); t.setAttribute('text','value:'+txt+'; width:5; align:center; color:'+color); t.setAttribute('position','0 '+y+' 0.05'); root.appendChild(t); t.setAttribute('animation__up','property: position; to: 0 1.16 0.05; dur: 400; easing: easeOutQuad'); setTimeout(()=>t.remove(),ms); }
  function spawn(kind,l,t){ const e=document.createElement('a-entity'); let geo,col; if(kind==='orb'){ geo='sphere; radius:0.16'; col='#22c55e'; } else if(kind==='star'){ geo='sphere; radius:0.2'; col='#f59e0b'; } else { kind='ob'; geo='box; width:0.7; height:0.5; depth:0.3'; col='#ef4444'; } e.setAttribute('geometry','primitive:'+geo); e.setAttribute('material','color:'+col+'; shader:flat; opacity:0.98'); e.object3D.position.set(laneX(l),0,3.25); root.appendChild(e); items.push({el:e,t,kind,lane:l,judged:false}); }
  function buildTutorial(){ items.splice(0).forEach(n=>n.el.remove()); let t=0.9; spawn('orb',1,t); t+=1.2; spawn('ob',1,t); t+=1.2; spawn('star',0,t); t+=1.0; spawn('orb',2,t); t+=1.0; spawn('ob',1,t); }
  function buildPattern(){ items.splice(0).forEach(n=>n.el.remove()); let t=0.8; const pick=()=>Math.random()<0.65?'orb':(Math.random()<0.5?'ob':'star'); while(t<duration){ const l=(Math.random()*3|0), kind=pick(); spawn(kind,l,t); if(Math.random()<0.2) spawn('ob',(Math.random()*3|0), t+0.22); t += 0.86 + (Math.random()*0.22 - 0.08); } }
  function addScore(n){ score+=n; }
  function collect(kind){ if(kind==='orb'){ addScore(20); combo++; beep(820,0.05,0.18,'triangle'); toast('เก็บ +20','#34d399'); } else if(kind==='star'){ addScore(90); combo+=2; beep(980,0.06,0.2,'square'); toast('ดาว +90','#fbbf24'); } best=Math.max(best,combo); }
  function hitObstacle(){ lives--; combo=0; toast('ชน -1 ชีวิต','#ef4444'); beep(200,0.1,0.24,'sawtooth'); if(lives<=0) return end('Game Over'); }
  function curSpeed(){ const base=tutorial?1.6:2.0; const timeBoost=Math.min(1.0, Math.max(0,(elapsed-(tutorial?0:tutEndAt))*0.016)); const comboBoost=Math.min(0.8, Math.floor(combo/8)*0.12); return base + timeBoost + comboBoost; }
  function loop(){ if(!running) return; if(paused){ raf=requestAnimationFrame(loop); return; } const now=performance.now()/1000; elapsed=(now - t0) - pauseAccum; const speed=curSpeed();
    for(const it of items){ if(it.judged) continue; const dz=it.t - elapsed; it.el.object3D.position.z=Math.max(0, dz*speed);
      if(Math.abs(dz)<=0.34){ if(it.lane===lane){ it.judged=true; it.el.setAttribute('visible','false'); if(it.kind==='ob') hitObstacle(); else collect(it.kind); } }
      else if(dz<-0.36 && !it.judged){ it.judged=true; it.el.setAttribute('visible','false'); } }
    if(tutorial && elapsed>=tutEndAt){ tutorial=false; buildPattern(); }
    if(elapsed>=duration) return end('Stage Clear'); setHUD('A/S/D หรือ ←↑→ เพื่อเปลี่ยนเลน'); raf=requestAnimationFrame(loop); }
  function start(){ const t=(window.__OVERRIDE_THEME||'jungle').toLowerCase(); THEME=t; Theme=themeCfg(t); swapSky(THEME); running=true; t0=performance.now()/1000; elapsed=0; pauseAccum=0; paused=false; lane=1; score=0; lives=3; combo=0; best=0; duration=60; tutorial=true; buildLaneUI(); buildTutorial(); setHUD('Tutorial เริ่ม • ทำตามไกด์'); ensureAudio(); raf=requestAnimationFrame(loop); }
  function end(msg){ running=false; cancelAnimationFrame(raf); setHUD(msg+' • Score '+score); }
  function reset(){ running=false; cancelAnimationFrame(raf); items.splice(0).forEach(n=>n.el.remove()); [...root.children].forEach(k=>k.remove()); buildLaneUI(); setHUD('พร้อมเริ่ม'); pauseAccum=0; paused=false; }
  function bind(){ btnStart.onclick=()=>{ ensureAudio(); if(!running) start(); }; btnReset.onclick=()=>reset(); btnPause.onclick=()=>pauseGame(); btnResume.onclick=()=>resumeGame();
    window.addEventListener('keydown',e=>{ const k=e.key.toLowerCase(); if(k==='a'||k==='arrowleft') lane=0; if(k==='s'||k==='arrowup') lane=1; if(k==='d'||k==='arrowright') lane=2; if(k===' '||k==='enter'){ if(!running) btnStart.click(); } if(k==='p'){ paused?resumeGame():pauseGame(); } });
    showFirstTimeOverlay('fd_seen_tutorial_adv','A/S/D หรือ ←↑→ เพื่อเปลี่ยนเลน<br>✔️ เขียว/ทอง = เก็บแต้ม • ❌ แดง = หลบ<br>Tip: คอมโบต่อเนื่องจะทำให้เกมเร็วขึ้นเล็กน้อย'); statusEl && (statusEl.textContent='พร้อมเริ่ม • เลือกธีมแล้วกด Start'); }
  const scene=document.querySelector('a-scene'); if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();