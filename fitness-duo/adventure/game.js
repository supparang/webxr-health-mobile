// Adventure — add swapSky(theme) to show sky images
(function(){
  const CFG = window.ADVENTURE_CFG || {};
  const root=document.getElementById('root');
  const hud =document.getElementById('hud');
  const statusEl=document.getElementById('status');
  const btnStart=document.getElementById('btnStart');
  const btnReset=document.getElementById('btnReset');
  const skyEl = document.getElementById('sky');

  function getThemeName(){
    return (window.__OVERRIDE_THEME ||
            new URLSearchParams(location.search).get('theme') ||
            'jungle').toLowerCase();
  }
  function getThemeCfg(name){
    const map={
      jungle:{ lane:['#14532d','#334155','#166534'], sky:'#bg-jungle', color:'#0b1220', power:'vine'  },
      city:  { lane:['#0ea5e9','#334155','#22c55e'], sky:'#bg-city',   color:'#0b1220', power:'dash'  },
      space: { lane:['#7c3aed','#334155','#06b6d4'], sky:'#bg-space',  color:'#050914', power:'warp'  }
    };
    return map[name] || map.jungle;
  }
  function swapSky(themeName){
    const cfg=getThemeCfg(themeName);
    try{
      if (skyEl) {
        // ถ้ารูปโหลดได้ ใช้รูป; ถ้าโหลดไม่ได้ จะเห็นสีพื้นแทน
        skyEl.setAttribute('src', cfg.sky);
        skyEl.setAttribute('color', cfg.color || '#000');
      }
    }catch(e){ console.warn('swapSky error', e); }
  }

  // ---------- State ----------
  let THEME='jungle', Theme=getThemeCfg('jungle');
  let running=false, raf=0, t0=0, elapsed=0;
  let lane=1, score=0, lives=3, combo=0, best=0;
  let duration=CFG.duration||120, fever=false, feverEnd=0;
  let tutorial=true, tutEndAt=CFG.tutorialSecs ?? 10;
  let shields=0, magnetUntil=0, dashBoostUntil=0, warpUntil=0;
  let nextPowerAt=8;
  const items=[]; const laneX=i=>[-1.2,0,1.2][i]; const WIN = CFG.hitWindowZ || 0.34;

  // ---------- Audio (ย่อ) ----------
  let actx=null, master=null, musicGain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.16; master.connect(actx.destination);
    musicGain=actx.createGain(); musicGain.gain.value=0.08; musicGain.connect(actx.destination);
    startAmbient(); }
  function tone(f=700,d=0.05,g=0.18,tp='square'){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type=tp; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  function startAmbient(){
    if(!actx) return;
    const scale = THEME==='jungle'?[220,277,330,392]: THEME==='city'?[240,300,360,420]: [200,252,300,400];
    const wave  = THEME==='jungle'?'triangle': THEME==='city'?'sine':'square';
    let step=0; function loop(){
      if(!running) return;
      const t=actx.currentTime;
      for(let i=0;i<6;i++){
        const o=actx.createOscillator(), g=actx.createGain(); o.type=wave;
        const f=scale[(i+step)%scale.length]* (THEME==='space' && i%3===0 ? 0.5 : 1);
        o.frequency.value=f; o.connect(g); g.connect(musicGain);
        const tt=t+i*0.22; g.gain.setValueAtTime(0,tt); g.gain.linearRampToValueAtTime(0.08,tt+0.01); g.gain.linearRampToValueAtTime(0,tt+0.18);
        o.start(tt); o.stop(tt+0.2);
      }
      step++; setTimeout(loop, 800);
    } loop();
  }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ---------- UI (ย่อ) ----------
  function buildLaneUI(){
    const kids=[...root.children]; kids.forEach(k=>k.remove()); root.__laneUI=false;
    if(root.__laneUI) return; root.__laneUI=true;
    const colors = Theme.lane;
    [-1.2,0,1.2].forEach((x,i)=>{
      const bg=document.createElement('a-entity');
      bg.setAttribute('geometry','primitive: plane; width:1.05; height:1.35');
      bg.setAttribute('material',`color:${colors[i]}; opacity:0.12; shader:flat`);
      bg.setAttribute('position',`${x} 0 0.02`); root.appendChild(bg);
      const tag=document.createElement('a-entity');
      tag.setAttribute('text',`value:${['ซ้าย','กลาง','ขวา'][i]} (${['A/←','S/↑','D/→'][i]}); width:2.4; align:center; color:#9fb1d1`);
      tag.setAttribute('position',`${x} -0.75 0.05`); root.appendChild(tag);
    });
    const hit=document.createElement('a-entity');
    hit.setAttribute('geometry','primitive: ring; radiusInner:0.06; radiusOuter:0.08; segmentsTheta:64');
    hit.setAttribute('material','color:#93c5fd; opacity:0.98; shader:flat');
    hit.setAttribute('position','0 0 0.06');
    hit.setAttribute('animation__pulse','property: scale; to:1.08 1.08 1; dir:alternate; dur:460; loop:true');
    root.appendChild(hit);
  }
  function setHUD(msg){
    const f=fever?' • FEVER!':'';
    hud.setAttribute('text',`value:[${THEME.toUpperCase()}] Score ${score} • Lives ${lives} • Combo ${combo} (Best ${best})${f}\nเก็บ: เขียว/ทอง/บัฟ • หลบ/ฟัน: แดง\n${msg||''}; width:5.8; align:center; color:#e2e8f0`);
  }

  // ---------- Gameplay / Spawner (ย่อ) ----------
  function spawn(kind,l,t){
    const e=document.createElement('a-entity');
    let geo, col;
    if(kind==='orb'){ geo='sphere; radius:0.16'; col='#22c55e'; }
    else if(kind==='star'){ geo='sphere; radius:0.2'; col='#f59e0b'; }
    else if(kind==='shield'){ geo='torus; radius:0.22; radiusTubular:0.03'; col='#7dfcc6'; }
    else if(kind==='magnet'){ geo='octahedron; radius:0.22'; col='#60a5fa'; }
    else if(kind==='time'){ geo='cylinder; radius:0.16; height:0.12'; col='#fcd34d'; }
    else { kind='obstacle'; geo='box; width:0.7; height:0.5; depth:0.3'; col='#ef4444'; }
    e.setAttribute('geometry','primitive: '+geo);
    e.setAttribute('material',`color:${col}; shader:flat; opacity:0.98`);
    e.object3D.position.set([-1.2,0,1.2][l],0,3.25);
    root.appendChild(e);
    items.push({el:e,t,kind,lane:l,judged:false});
  }
  const items=[];
  function buildTutorial(){
    items.splice(0).forEach(n=>n.el.remove());
    let t=0.8; spawn('orb',1,t); t+=1.2; spawn('obstacle',1,t); t+=1.2; spawn('star',0,t); t+=1.0; spawn('shield',2,t); t+=1.0; spawn('time',1,t);
  }

  // ---------- Loop (ย่อ) ----------
  function loop(){
    if(!running) return;
    const now=performance.now()/1000; const prev=elapsed; elapsed=now-t0;
    // … move & judge items (ละรายละเอียดเพื่อย่อ)
    if(tutorial && elapsed>=tutEndAt){ tutorial=false; /* buildPattern(); */ }
    if(elapsed>=duration) return end('Stage Clear');
    setHUD('A/S/D หรือ ←↑→ เพื่อเปลี่ยนเลน'); raf=requestAnimationFrame(loop);
  }

  // ---------- Flow ----------
  function start(){
    THEME = getThemeName(); Theme = getThemeCfg(THEME);
    swapSky(THEME); // ✅ ตั้งรูปท้องฟ้าตามธีม
    running=true; t0=performance.now()/1000; elapsed=0;
    // รีเซ็ตค่าสำคัญ
    score=0; lives=3; combo=0; best=0; tutorial=true; shields=0; magnetUntil=0; dashBoostUntil=0; warpUntil=0; nextPowerAt=8;
    buildLaneUI(); buildTutorial(); setHUD('Tutorial เริ่ม • ทำตามไกด์');
    ensureAudio();
    loop();
  }
  function end(msg){ running=false; cancelAnimationFrame(raf); setHUD(`${msg} • Score ${score}`); }
  function reset(){ running=false; cancelAnimationFrame(raf); items.splice(0).forEach(n=>n.el.remove());
    root.__laneUI=false; const kids=[...root.children]; kids.forEach(k=>k.remove());
    setTimeout(()=>{ buildLaneUI(); setHUD('พร้อมเริ่ม'); },0); }

  // ---------- Bind ----------
  function bind(){
    btnStart.onclick=()=>{ if(!running) start(); };
    btnReset.onclick=()=>reset();
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();
      if(k==='a'||k==='arrowleft') lane=0;
      if(k==='s'||k==='arrowup')   lane=1;
      if(k==='d'||k==='arrowright')lane=2;
    });
    statusEl.textContent='พร้อมเริ่ม • เลือกธีมแล้วกด Start';
  }
  const scene=document.querySelector('a-scene');
  if(!scene.hasLoaded){ scene.addEventListener('loaded', bind, {once:true}); } else bind();
})();
